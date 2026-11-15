const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const net = require('net');
const https = require('https');
const { spawn } = require('child_process');

/**
 * Browser-session privacy routing. Tor requires a compatible bundled runtime;
 * custom mode requires a reachable SOCKS5 or HTTP proxy endpoint.
 */

const PRESET_LOCATIONS = {
    'tor': {
        id: 'tor',
        name: 'Tor Network',
        badge: 'Onion route',
        protocol: 'Tor SOCKS5',
        description: 'Route browser requests through Tor. The exit location varies and is not guaranteed.',
        defaultPort: 9050,
        region: 'Tor exit network',
        color: '#7C3AED',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="6" r="6"/><circle cx="12" cy="2" r="2"/></svg>',
        setupTip: 'Uses the bundled Tor runtime where the current desktop build supports it.'
    },
    'custom': {
        id: 'custom',
        name: 'Custom Endpoint',
        badge: 'User Defined',
        protocol: 'SOCKS5 / HTTP proxy',
        description: 'Route this browser through a reachable proxy endpoint.',
        region: 'Custom Endpoint',
        color: '#10B981',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.2"><circle cx="12" cy="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        setupTip: 'Enter a SOCKS5 or HTTP proxy server and port.'
    }
};

function checkSocketListening(port, host = '127.0.0.1', timeout = 350) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => {
            resolve(false);
        });
        try {
            socket.connect(port, host);
        } catch (_) {
            resolve(false);
        }
    });
}

function checkSocks5Listener(port, host = '127.0.0.1', timeout = 800) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        let response = Buffer.alloc(0);
        let settled = false;
        const finish = result => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => socket.write(Buffer.from([5, 1, 0])));
        socket.on('data', chunk => {
            response = Buffer.concat([response, chunk]);
            if (response.length >= 2) finish(response[0] === 5 && response[1] === 0);
        });
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        try { socket.connect(port, host); } catch (_) { finish(false); }
    });
}

class VpnEngine extends EventEmitter {
    constructor(userDataPath) {
        super();
        this.userDataPath = userDataPath || path.join(process.cwd(), 'tor_data');
        this.configFile = path.join(this.userDataPath, 'fokk_vpn_config.json');

        this.state = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
        this.activeMode = 'tor';
        this.killSwitch = true;
        this.customConfig = '';
        this.connectedAt = null;
        this.currentProxyRules = '';
        this.virtualIp = 'Direct (Real IP Exposed)';
        this.virtualCountry = 'Local Direct';
        this.ping = 0;
        this.errorMessage = null;
        this.activeSessions = new Set();
        this.torProcess = null;
        this.routeHealthTimer = null;

        this.loadConfig();
        // Stop the embedded route process when the browser exits.
        process.on('exit', () => {
            this.stopEmbeddedTor();
        });
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                if (data.activeMode === 'auto' || data.activeMode === 'warp') this.activeMode = 'tor';
                else if (data.activeMode && PRESET_LOCATIONS[data.activeMode]) this.activeMode = data.activeMode;
                if (typeof data.killSwitch === 'boolean') {
                    this.killSwitch = data.killSwitch;
                }
                if (data.customConfig) {
                    this.customConfig = data.customConfig;
                }
            }
        } catch (_) {}

        if (!this.customConfig) {
            this.customConfig = '127.0.0.1:1080';
        }
    }

    saveConfig() {
        try {
            if (!fs.existsSync(this.userDataPath)) {
                fs.mkdirSync(this.userDataPath, { recursive: true });
            }
            fs.writeFileSync(this.configFile, JSON.stringify({
                activeMode: this.activeMode,
                killSwitch: this.killSwitch,
                customConfig: this.customConfig
            }, null, 2), 'utf8');
        } catch (_) {}
    }

    registerSession(sess) {
        if (!sess) return;
        this.activeSessions.add(sess);
        this.applyProxyToSession(sess);
    }

    getLocations() {
        return Object.values(PRESET_LOCATIONS).map(loc => ({
            id: loc.id,
            name: loc.name,
            badge: loc.badge,
            color: loc.color,
            description: loc.description,
            iconSvg: loc.iconSvg,
            protocol: loc.protocol,
            region: loc.region,
            setupTip: loc.setupTip,
            isSelected: loc.id === this.activeMode
        }));
    }

    getStatus() {
        return {
            state: this.state,
            activeMode: this.activeMode,
            location: PRESET_LOCATIONS[this.activeMode] || PRESET_LOCATIONS.tor,
            virtualIp: this.virtualIp,
            virtualCountry: this.virtualCountry,
            ping: this.ping,
            killSwitch: this.killSwitch,
            customConfig: this.customConfig,
            connectedAt: this.connectedAt,
            uptimeSeconds: this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0,
            errorMessage: this.errorMessage
        };
    }

    checkDirectPublicIp() {
        return new Promise(resolve => {
            const request = https.get('https://api4.ipify.org?format=json', { timeout: 5_000 }, response => {
                let body = '';
                response.on('data', chunk => { body += chunk; });
                response.on('end', () => {
                    try {
                        if (response.statusCode !== 200) return resolve({ ip: null, error: `HTTP ${response.statusCode}` });
                        const ip = JSON.parse(body).ip;
                        resolve({ ip: typeof ip === 'string' ? ip : null, error: null });
                    } catch (_) {
                        resolve({ ip: null, error: 'Invalid response from the public IP check.' });
                    }
                });
            });
            request.on('timeout', () => request.destroy(new Error('Public IP check timed out.')));
            request.on('error', error => resolve({ ip: null, error: error.message || 'Public IP check failed.' }));
        });
    }

    getEmbeddedTorPath() {
        // Do not attempt to run Linux Tor ELF binaries on Windows!
        if (process.platform === 'win32') {
            const winCandidates = [
                path.resolve(__dirname, '..', 'bin', 'tor', 'tor.exe')
            ];
            for (const p of winCandidates) {
                if (fs.existsSync(p)) return p;
            }
            return null;
        }

        const candidates = [];
        if (process.resourcesPath) {
            candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'tor', 'tor'));
            candidates.push(path.join(process.resourcesPath, 'bin', 'tor', 'tor'));
        }
        if (process.execPath) {
            const execDir = path.dirname(process.execPath);
            candidates.push(path.join(execDir, 'resources', 'app.asar.unpacked', 'bin', 'tor', 'tor'));
            candidates.push(path.join(execDir, 'bin', 'tor', 'tor'));
        }
        // Dev mode candidates
        candidates.push(path.resolve(__dirname, '..', 'bin', 'tor', 'tor'));
        candidates.push('/usr/bin/tor');

        for (let p of candidates) {
            if (p.includes('app.asar') && !p.includes('app.asar.unpacked')) {
                p = p.replace('app.asar', 'app.asar.unpacked');
            }
            if (fs.existsSync(p)) {
                try {
                    const dir = path.dirname(p);
                    fs.readdirSync(dir).forEach(file => {
                        try { fs.chmodSync(path.join(dir, file), 0o755); } catch (_) {}
                    });
                } catch (_) {}
                return p;
            }
        }
        return null;
    }

    async ensureTorRunning() {
        // 1. Check if port 9050 is already listening (system tor daemon)
        if (await checkSocks5Listener(9050, '127.0.0.1', 800)) {
            console.log('[Tor Engine] Reusing active Tor listener on port 9050');
            return 9050;
        }
        // 2. Check Tor Browser port 9150
        if (await checkSocks5Listener(9150, '127.0.0.1', 800)) {
            console.log('[Tor Engine] Reusing Tor Browser listener on port 9150');
            return 9150;
        }

        // 3. Launch embedded Tor if executable exists
        const torBin = this.getEmbeddedTorPath();
        if (!torBin) {
            return null;
        }

        try {
            let chosenPort = 9050;
            for (const p of [9050, 9052, 9053, 9054]) {
                const inUse = await checkSocketListening(p, '127.0.0.1', 200);
                if (!inUse) {
                    chosenPort = p;
                    break;
                }
            }

            const torDataDir = path.join(this.userDataPath, 'tor_embedded_data');
            try {
                if (!fs.existsSync(this.userDataPath)) fs.mkdirSync(this.userDataPath, { recursive: true });
                if (!fs.existsSync(torDataDir)) fs.mkdirSync(torDataDir, { recursive: true, mode: 0o700 });
                if (process.platform !== 'win32') fs.chmodSync(torDataDir, 0o700);
            } catch (_) {}

            const lockFile = path.join(torDataDir, 'lock');
            if (fs.existsSync(lockFile) && !this.torProcess) {
                try { fs.unlinkSync(lockFile); } catch (_) {}
            }

            const torLibDir = path.dirname(torBin);
            const env = { 
                ...process.env, 
                LD_LIBRARY_PATH: `${torLibDir}:${process.env.LD_LIBRARY_PATH || ''}`
            };

            await this.stopEmbeddedTor();

            let spawnFailed = false;
            this.torProcess = spawn(torBin, [
                '--SocksPort', `127.0.0.1:${chosenPort}`,
                '--DataDirectory', torDataDir,
                '--ClientOnly', '1',
                '--AvoidDiskWrites', '1',
                '--Log', 'notice stdout'
            ], { env, detached: false });

            this.torProcess.on('error', () => {
                spawnFailed = true;
                this.torProcess = null;
            });

            this.torProcess.on('exit', () => {
                this.torProcess = null;
            });

            for (let i = 0; i < 20; i++) {
                if (spawnFailed) break;
                await new Promise(r => setTimeout(r, 200));
                if (await checkSocks5Listener(chosenPort, '127.0.0.1', 800)) {
                    return chosenPort;
                }
            }
        } catch (_) {}

        return null;
    }

    async stopEmbeddedTor() {
        if (this.torProcess) {
            try {
                this.torProcess.kill('SIGKILL');
            } catch (_) {}
            this.torProcess = null;
        }
    }

    async setMode(modeId) {
        if (!PRESET_LOCATIONS[modeId]) return false;
        this.activeMode = modeId;
        this.saveConfig();

        if (this.state === 'connected') {
            await this.connect();
        } else {
            this.emitStatus();
        }
        return true;
    }

    setKillSwitch(enabled) {
        this.killSwitch = !!enabled;
        this.saveConfig();
        this.emitStatus();
    }

    setCustomConfig(configStr) {
        this.customConfig = (configStr || '').trim();
        this.saveConfig();
        if (this.activeMode === 'custom' && this.state === 'connected') {
            this.connect();
        } else {
            this.emitStatus();
        }
    }

    async toggle() {
        if (this.state === 'connected' || this.state === 'connecting') {
            return await this.disconnect();
        } else {
            return await this.connect();
        }
    }

    async connect() {
        this.stopRouteHealthMonitor();
        this.state = 'connecting';
        this.errorMessage = null;
        this.connectedAt = null;
        this.emitStatus();

        try {
            if (this.killSwitch) {
                await this.applyProxyRules('127.0.0.1:9');
            }
            if (this.activeMode !== 'tor') await this.stopEmbeddedTor();
            let proxyRules = '';
            let locationName = '';

            if (this.activeMode === 'tor') {
                const torPort = await this.ensureTorRunning();
                if (torPort) {
                    proxyRules = `socks5://127.0.0.1:${torPort}`;
                    locationName = 'Tor network (exit varies)';
                } else {
                    throw new Error('The bundled Tor runtime is unavailable on this desktop build. Routing was not enabled.');
                }
            } else if (this.activeMode === 'custom') {
                proxyRules = this.resolveCustomProxyRules();
                if (!proxyRules) {
                    throw new Error('Enter a SOCKS5 or HTTP proxy URL. WireGuard profiles are not supported in browser-proxy mode.');
                }

                const endpoint = this.getProxyEndpoint(proxyRules);
                if (!endpoint || !await checkSocketListening(endpoint.port, endpoint.host, 1_500)) {
                    throw new Error('The configured proxy endpoint is unreachable. Browser routing was not enabled.');
                }
                locationName = 'Custom Endpoint';
            }

            if (!proxyRules) {
                throw new Error('Relay proxy configuration failed.');
            }

            // Apply proxy rules across all Electron web sessions
            await this.applyProxyRules(proxyRules);

            this.state = 'connected';
            this.connectedAt = Date.now();
            this.virtualCountry = locationName;
            this.virtualIp = 'Route configured — verify exit IP';
            this.ping = 0;
            this.errorMessage = null;

            this.startRouteHealthMonitor();
            this.emitStatus();

            return { success: true, status: this.getStatus() };
        } catch (err) {
            this.state = 'error';
            this.errorMessage = err.message || 'Connection failed';
            this.connectedAt = null;
            this.stopRouteHealthMonitor();
            await this.stopEmbeddedTor();
            if (this.killSwitch) {
                try { await this.applyProxyRules('127.0.0.1:9'); } catch (_) {}
            } else {
                try { await this.applyProxyRules(''); } catch (_) {}
            }
            this.emitStatus();
            return { success: false, status: this.getStatus(), error: this.errorMessage };
        }
    }

    async disconnect() {
        this.state = 'disconnected';
        this.connectedAt = null;
        this.errorMessage = null;
        this.stopRouteHealthMonitor();
        this.currentProxyRules = '';
        this.virtualIp = 'Direct connection (IP not masked)';
        this.virtualCountry = 'Local Direct';
        this.ping = 0;

        // Restore direct connection on all tracked sessions
        await this.applyProxyRules('');
        await this.stopEmbeddedTor();

        this.emitStatus();
        return { success: true, status: this.getStatus() };
    }

    resolveCustomProxyRules() {
        if (!this.customConfig) return '';
        // A WireGuard Endpoint is UDP, not a SOCKS server. Treating it as SOCKS
        // would leak/fail; a bundled native WireGuard runtime must own it.
        if (this.customConfig.includes('[Interface]') || this.customConfig.includes('[Peer]')) return '';
        if (/^socks5?:\/\//i.test(this.customConfig)) {
            return this.customConfig.replace(/^socks:\/\//i, 'socks5://');
        }
        if (/^https:\/\//i.test(this.customConfig)) return '';
        if (/^http:\/\//i.test(this.customConfig)) {
            const proxy = new URL(this.customConfig);
            if (!proxy.hostname || !proxy.port) return '';
            return `http=${proxy.host};https=${proxy.host}`;
        }
        if (!this.customConfig.includes('=')) {
            return `socks5://${this.customConfig}`;
        }
        return this.customConfig;
    }

    getProxyEndpoint(rules) {
        try {
            const firstRule = rules.split(';')[0];
            const rawEndpoint = firstRule.includes('=') ? firstRule.slice(firstRule.indexOf('=') + 1) : firstRule;
            const endpoint = rawEndpoint.includes('://') ? new URL(rawEndpoint) : new URL(`http://${rawEndpoint}`);
            const port = Number(endpoint.port);
            if (!endpoint.hostname || !Number.isInteger(port) || port < 1 || port > 65535) return null;
            return { host: endpoint.hostname, port };
        } catch (_) {
            return null;
        }
    }

    formatProxyString(rules) {
        if (!rules || rules === 'direct://') return 'direct://';
        if (/^socks5?:\/\//i.test(rules)) return rules;
        if (rules.includes('=')) return rules;
        return `http=${rules};https=${rules}`;
    }

    async applyProxyRules(rules) {
        const proxyStr = this.formatProxyString(rules);
        const config = rules ? {
            proxyRules: proxyStr,
            proxyBypassRules: '<local>,localhost,127.0.0.1,::1'
        } : {
            proxyRules: 'direct://',
            proxyBypassRules: ''
        };

        const sessions = [...this.activeSessions].filter(sess => sess && typeof sess.setProxy === 'function');
        if (rules && sessions.length === 0) throw new Error('No browser network session is ready to accept the route.');
        await Promise.all(sessions.map(async sess => {
            await sess.setProxy(config);
            if (typeof sess.closeAllConnections === 'function') await sess.closeAllConnections();
        }));
        this.currentProxyRules = rules || '';
    }

    startRouteHealthMonitor() {
        this.stopRouteHealthMonitor();
        this.routeHealthTimer = setInterval(async () => {
            const routeGeneration = this.connectedAt;
            if (this.state !== 'connected' || !routeGeneration) return;

            let reachable = false;
            if (this.activeMode === 'tor') {
                const endpoint = this.getProxyEndpoint(this.currentProxyRules);
                reachable = !!endpoint && await checkSocks5Listener(endpoint.port, endpoint.host, 1_000);
            } else {
                const endpoint = this.getProxyEndpoint(this.currentProxyRules);
                reachable = !!endpoint && await checkSocketListening(endpoint.port, endpoint.host, 1_000);
            }

            if (!reachable && this.state === 'connected' && this.connectedAt === routeGeneration) {
                this.state = 'error';
                this.connectedAt = null;
                this.errorMessage = 'The selected proxy stopped responding. Browser routing is still fail-closed.';
                this.stopRouteHealthMonitor();
                if (this.killSwitch) {
                    try { await this.applyProxyRules('127.0.0.1:9'); } catch (_) {}
                }
                this.emitStatus();
            }
        }, 5_000);
        if (this.routeHealthTimer.unref) this.routeHealthTimer.unref();
    }

    stopRouteHealthMonitor() {
        if (this.routeHealthTimer) {
            clearInterval(this.routeHealthTimer);
            this.routeHealthTimer = null;
        }
    }

    applyProxyToSession(sess) {
        if (!sess || typeof sess.setProxy !== 'function') return;
        const routeRequired = ['connected', 'connecting', 'error'].includes(this.state);
        // A session added during a connected state must never silently become
        // direct if a route is missing. Port 9 is intentionally closed and
        // produces a visible failure until the selected tunnel is restored.
        const rawRules = routeRequired
            ? (this.currentProxyRules || (this.killSwitch ? '127.0.0.1:9' : 'direct://'))
            : 'direct://';
        const proxyStr = this.formatProxyString(rawRules);

        sess.setProxy({
            proxyRules: proxyStr,
            proxyBypassRules: routeRequired ? '<local>,localhost,127.0.0.1,::1' : ''
        }).then(() => {
            if (typeof sess.closeAllConnections === 'function') {
                return sess.closeAllConnections();
            }
        }).catch(() => {});
    }

    emitStatus() {
        this.emit('status-changed', this.getStatus());
    }
}

module.exports = {
    VpnEngine,
    PRESET_LOCATIONS
};
