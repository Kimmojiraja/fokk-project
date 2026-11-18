const net = require('net');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class HomeBaseService {
    constructor(userDataPath) {
        this.userDataPath = userDataPath || os.tmpdir();
        this.configFile = path.join(this.userDataPath, 'fokk_home_base_config.json');
        this.port = 10850;
        this.token = this.loadOrCreateToken();
        this.server = null;
        this.isRunning = false;
        this.activeConnections = new Set();
        this.bytesRelayed = 0;
    }

    loadOrCreateToken() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                if (data.token) return data.token;
            }
        } catch (_) {}
        const token = crypto.randomBytes(16).toString('hex');
        try {
            fs.writeFileSync(this.configFile, JSON.stringify({ token, createdAt: Date.now() }, null, 2), 'utf8');
        } catch (_) {}
        return token;
    }

    getLanIp() {
        const ifaces = os.networkInterfaces();
        for (const name of Object.keys(ifaces)) {
            for (const iface of ifaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    getPairingUrl() {
        const lanIp = this.getLanIp();
        const hostname = encodeURIComponent(os.hostname() || 'Desktop');
        return `fokk://pair?host=${lanIp}&port=${this.port}&token=${this.token}&name=${hostname}`;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            token: this.token,
            lanIp: this.getLanIp(),
            pairingUrl: this.getPairingUrl(),
            activeConnections: this.activeConnections.size,
            bytesRelayed: this.bytesRelayed
        };
    }

    start() {
        if (this.isRunning && this.server) return Promise.resolve(this.getStatus());

        return new Promise((resolve, reject) => {
            const server = net.createServer(clientSock => {
                clientSock.setNoDelay(true);
                let headerBuf = Buffer.alloc(0);
                let handled = false;

                const onData = chunk => {
                    if (handled) return;
                    headerBuf = Buffer.concat([headerBuf, chunk]);
                    const headerEnd = headerBuf.indexOf('\r\n\r\n');
                    if (headerEnd === -1) {
                        if (headerBuf.length > 8192) clientSock.destroy();
                        return;
                    }
                    handled = true;
                    clientSock.removeListener('data', onData);

                    const headStr = headerBuf.slice(0, headerEnd).toString('latin1');
                    const rest = headerBuf.slice(headerEnd + 4);
                    const lines = headStr.split('\r\n');
                    const [method, target] = (lines[0] || '').split(' ');

                    // Check Authentication
                    let authValid = false;
                    for (const line of lines.slice(1)) {
                        const lower = line.toLowerCase();
                        if (lower.startsWith('proxy-authorization:')) {
                            const val = line.slice(20).trim();
                            if (val.startsWith('Basic ')) {
                                const decoded = Buffer.from(val.slice(6), 'base64').toString('utf8');
                                const tokenPart = decoded.split(':')[1] || decoded;
                                if (tokenPart.trim() === this.token) authValid = true;
                            }
                        } else if (lower.startsWith('x-fokk-token:')) {
                            if (line.slice(13).trim() === this.token) authValid = true;
                        }
                    }

                    if (!authValid) {
                        clientSock.write(
                            'HTTP/1.1 407 Proxy Authentication Required\r\n' +
                            'Proxy-Authenticate: Basic realm="Fokk Home-Base"\r\n' +
                            'Content-Length: 0\r\n\r\n'
                        );
                        clientSock.destroy();
                        return;
                    }

                    if (method === 'CONNECT') {
                        const idx = target.lastIndexOf(':');
                        const targetHost = idx > -1 ? target.slice(0, idx) : target;
                        const targetPort = idx > -1 ? Number(target.slice(idx + 1)) || 443 : 443;

                        const destSock = new net.Socket();
                        destSock.setNoDelay(true);
                        destSock.connect(targetPort, targetHost, () => {
                            clientSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                            if (rest.length > 0) destSock.write(rest);

                            this.activeConnections.add(clientSock);
                            this.activeConnections.add(destSock);

                            clientSock.pipe(destSock);
                            destSock.pipe(clientSock);

                            const cleanup = () => {
                                this.activeConnections.delete(clientSock);
                                this.activeConnections.delete(destSock);
                                clientSock.destroy();
                                destSock.destroy();
                            };

                            clientSock.on('close', cleanup);
                            destSock.on('close', cleanup);
                            clientSock.on('error', cleanup);
                            destSock.on('error', cleanup);
                        });

                        destSock.on('error', () => {
                            try { clientSock.write('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (_) {}
                            clientSock.destroy();
                        });
                    } else {
                        clientSock.destroy();
                    }
                };

                clientSock.on('data', onData);
                clientSock.once('error', () => clientSock.destroy());
            });

            server.on('error', err => {
                this.isRunning = false;
                reject(err);
            });

            server.listen(this.port, '0.0.0.0', () => {
                this.server = server;
                this.isRunning = true;
                resolve(this.getStatus());
            });
        });
    }

    stop() {
        if (!this.isRunning || !this.server) return Promise.resolve(this.getStatus());
        return new Promise(resolve => {
            for (const sock of this.activeConnections) {
                try { sock.destroy(); } catch (_) {}
            }
            this.activeConnections.clear();
            this.server.close(() => {
                this.server = null;
                this.isRunning = false;
                resolve(this.getStatus());
            });
        });
    }
}

module.exports = { HomeBaseService };
