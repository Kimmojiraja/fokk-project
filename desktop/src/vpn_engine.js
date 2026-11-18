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
    'relay_auto': {
        id: 'relay_auto',
        name: 'Optimal Location',
        badge: 'Fokk Mesh',
        protocol: 'Fokk Mesh SOCKS5',
        description: 'Fastest verified Fokk Mesh relay node selected automatically by live ping.',
        region: 'Global Optimal',
        meshRegion: 'AUTO',
        color: '#38BDF8',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>',
        setupTip: 'Probes verified Fokk Mesh relays in parallel and connects to the lowest-latency exit.'
    },
    'relay_eu': {
        id: 'relay_eu',
        name: 'Europe Cluster',
        badge: 'DE · NL · GB · SE',
        protocol: 'Fokk Mesh SOCKS5',
        description: 'High-speed European privacy exits across Frankfurt, Amsterdam, London, Paris, and Stockholm.',
        region: 'Europe',
        meshRegion: 'EU',
        color: '#60A5FA',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>',
        setupTip: 'Routes browser traffic through verified European Fokk Mesh nodes.'
    },
    'relay_am': {
        id: 'relay_am',
        name: 'Americas Cluster',
        badge: 'US · CA',
        protocol: 'Fokk Mesh SOCKS5',
        description: 'High-speed Americas privacy exits across Miami, North Bergen, and Montreal.',
        region: 'Americas',
        meshRegion: 'AM',
        color: '#34D399',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>',
        setupTip: 'Routes browser traffic through verified Americas Fokk Mesh nodes.'
    },
    'relay_as': {
        id: 'relay_as',
        name: 'Asia & Pacific Cluster',
        badge: 'SG · JP · HK · IN',
        protocol: 'Fokk Mesh SOCKS5',
        description: 'High-speed APAC privacy exits across Singapore, Tokyo, Hong Kong, Mumbai, and Suwon.',
        region: 'Asia-Pacific',
        meshRegion: 'AS',
        color: '#FBBF24',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>',
        setupTip: 'Routes browser traffic through verified Asia-Pacific Fokk Mesh nodes.'
    },
    'tor': {
        id: 'tor',
        name: 'Tor Onion Network',
        badge: 'Multi-Hop',
        protocol: 'Tor SOCKS5',
        description: 'Maximum anonymity multi-hop onion routing via the bundled Tor client.',
        defaultPort: 9050,
        region: 'Tor Exit Network',
        color: '#A78BFA',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="6" r="6"/><circle cx="12" cy="2" r="2"/></svg>',
        setupTip: 'Starts the bundled Tor client and routes this browser through its local SOCKS port.'
    },
    'custom': {
        id: 'custom',
        name: 'Custom Endpoint',
        badge: 'User Proxy',
        protocol: 'SOCKS5 / HTTP',
        description: 'Route this browser through your own reachable SOCKS5 or HTTP proxy.',
        region: 'Custom Endpoint',
        color: '#10B981',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        setupTip: 'Enter a SOCKS5 or HTTP proxy server and port.'
    }
};

const MESH_COUNTRIES = [
    { code: 'US', name: 'United States', city: 'Miami / North Bergen', region: 'Americas' },
    { code: 'DE', name: 'Germany', city: 'Frankfurt / Falkenstein', region: 'Europe' },
    { code: 'GB', name: 'United Kingdom', city: 'London', region: 'Europe' },
    { code: 'NL', name: 'Netherlands', city: 'Amsterdam', region: 'Europe' },
    { code: 'FR', name: 'France', city: 'Paris', region: 'Europe' },
    { code: 'SE', name: 'Sweden', city: 'Stockholm', region: 'Europe' },
    { code: 'CA', name: 'Canada', city: 'Montreal', region: 'Americas' },
    { code: 'SG', name: 'Singapore', city: 'Singapore', region: 'Asia-Pacific' },
    { code: 'JP', name: 'Japan', city: 'Tokyo', region: 'Asia-Pacific' },
    { code: 'HK', name: 'Hong Kong', city: 'Hong Kong', region: 'Asia-Pacific' },
    { code: 'IN', name: 'India', city: 'Mumbai', region: 'Asia-Pacific' },
    { code: 'KR', name: 'South Korea', city: 'Suwon', region: 'Asia-Pacific' }
];

for (const c of MESH_COUNTRIES) {
    PRESET_LOCATIONS[`country_${c.code}`] = {
        id: `country_${c.code}`,
        name: c.name,
        badge: c.code,
        countryCode: c.code,
        city: c.city,
        protocol: 'Fokk Mesh SOCKS5',
        description: `${c.city} · ${c.region}`,
        region: `${c.city}, ${c.name}`,
        meshRegion: c.code,
        color: '#38BDF8',
        isCountry: true
    };
}

// Certified Fokk Mesh nodes (parity with Android NodeRegistry.kt & nodes_manifest.json)
const BUILTIN_MESH_NODES = [
    { host: '45.61.188.134',   port: 44499, type: 'socks5', country: 'US', city: 'Miami' },
    { host: '69.55.49.177',    port: 38182, type: 'socks5', country: 'US', city: 'North Bergen' },
    { host: '184.75.221.82',   port: 3118,  type: 'http',   country: 'CA', city: 'Montreal' },
    { host: '49.13.22.249',    port: 10805, type: 'socks5', country: 'DE', city: 'Frankfurt' },
    { host: '49.13.22.249',    port: 10802, type: 'socks5', country: 'DE', city: 'Frankfurt' },
    { host: '5.75.133.113',    port: 10802, type: 'socks5', country: 'DE', city: 'Frankfurt' },
    { host: '5.75.133.113',    port: 10807, type: 'socks5', country: 'DE', city: 'Falkenstein' },
    { host: '171.25.158.95',   port: 1080,  type: 'socks5', country: 'SE', city: 'Stockholm' },
    { host: '193.218.118.128', port: 1080,  type: 'socks5', country: 'NL', city: 'Amsterdam' },
    { host: '51.159.115.233',  port: 1080,  type: 'socks5', country: 'FR', city: 'Paris' },
    { host: '77.91.90.27',     port: 1082,  type: 'socks5', country: 'GB', city: 'London' },
    { host: '188.166.178.163', port: 1088,  type: 'socks5', country: 'SG', city: 'Singapore' },
    { host: '183.87.145.150',  port: 2080,  type: 'socks5', country: 'IN', city: 'Mumbai' },
    { host: '101.36.104.239',  port: 10808, type: 'socks5', country: 'JP', city: 'Tokyo' },
    { host: '123.58.219.171',  port: 10808, type: 'socks5', country: 'HK', city: 'Hong Kong' },
    { host: '121.169.46.116',  port: 1090,  type: 'socks5', country: 'KR', city: 'Suwon' }
];

const MESH_MANIFEST_URLS = [
    'https://raw.githubusercontent.com/Kimmojiraja/fokk-project/mesh-manifest/nodes_manifest.json',
    'https://github.com/Kimmojiraja/fokk-project/releases/download/mesh-manifest-live/nodes_manifest.json',
    'https://raw.githubusercontent.com/Kimmojiraja/fokk-project/main/nodes_manifest.json'
];
const AM_COUNTRIES = new Set(['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'CR', 'PA']);
const EU_COUNTRIES = new Set(['GB', 'DE', 'NL', 'FR', 'CH', 'SE', 'NO', 'FI', 'ES', 'IT', 'PL', 'IE', 'BE', 'AT', 'CZ', 'DK', 'PT', 'RO']);
const AS_COUNTRIES = new Set(['JP', 'KR', 'SG', 'HK', 'IN', 'AU', 'NZ', 'TW', 'MY', 'ID', 'TH', 'VN']);

const COUNTRY_NAMES = {
    US: 'United States', CA: 'Canada', DE: 'Germany', SE: 'Sweden',
    NL: 'Netherlands', FR: 'France', GB: 'United Kingdom', SG: 'Singapore',
    IN: 'India', JP: 'Japan', HK: 'Hong Kong', KR: 'South Korea'
};

function isSafePublicRelayHost(host) {
    const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (!h || h === 'localhost' || h === '::1' || h === '0.0.0.0') return false;
    if (h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.') || h.startsWith('0.')) return false;
    const parts = h.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
        const [a, b] = parts.map(Number);
        if (a === 172 && b >= 16 && b <= 31) return false;
        if (a === 100 && b >= 64 && b <= 127) return false;
        if (a >= 224) return false;
    }
    return true;
}

function socks5HandshakeAndConnect(socket, targetHost, targetPort, doGreeting = true, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
        let stage = doGreeting ? 'greet' : 'connect';
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('SOCKS5 timeout'));
        }, timeoutMs);

        const cleanup = () => {
            clearTimeout(timer);
            socket.removeListener('data', onData);
            socket.removeListener('error', onErr);
            socket.removeListener('close', onClose);
        };
        const onErr = err => { cleanup(); reject(err); };
        const onClose = () => { cleanup(); reject(new Error('SOCKS5 socket closed')); };

        const sendConnect = () => {
            const hostBuf = Buffer.from(targetHost, 'ascii');
            const req = Buffer.alloc(4 + 1 + hostBuf.length + 2);
            req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = 0x03;
            req[4] = hostBuf.length;
            hostBuf.copy(req, 5);
            req.writeUInt16BE(targetPort, 5 + hostBuf.length);
            socket.write(req);
        };

        const onData = chunk => {
            buf = Buffer.concat([buf, chunk]);
            if (stage === 'greet') {
                if (buf.length < 2) return;
                if (buf[0] !== 0x05 || buf[1] !== 0x00) {
                    cleanup();
                    return reject(new Error('SOCKS5 auth rejected'));
                }
                buf = buf.slice(2);
                stage = 'connect';
                sendConnect();
            }
            if (stage === 'connect') {
                if (buf.length < 4) return;
                if (buf[0] !== 0x05 || buf[1] !== 0x00) {
                    cleanup();
                    return reject(new Error('SOCKS5 CONNECT rejected'));
                }
                const atyp = buf[3];
                let need = 0;
                if (atyp === 0x01) need = 4 + 4 + 2;
                else if (atyp === 0x04) need = 4 + 16 + 2;
                else if (atyp === 0x03) {
                    if (buf.length < 5) return;
                    need = 4 + 1 + buf[4] + 2;
                } else {
                    cleanup();
                    return reject(new Error('Invalid SOCKS5 ATYP'));
                }
                if (buf.length < need) return;
                cleanup();
                resolve(buf.slice(need));
            }
        };

        socket.on('data', onData);
        socket.once('error', onErr);
        socket.once('close', onClose);
        if (doGreeting) socket.write(Buffer.from([0x05, 0x01, 0x00]));
        else sendConnect();
    });
}

function httpConnectViaSocket(socket, targetHost, targetPort, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => { cleanup(); reject(new Error('HTTP CONNECT timeout')); }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timer);
            socket.removeListener('data', onData);
            socket.removeListener('error', onErr);
            socket.removeListener('close', onClose);
        };
        const onErr = err => { cleanup(); reject(err); };
        const onClose = () => { cleanup(); reject(new Error('HTTP proxy closed')); };
        const onData = chunk => {
            buf = Buffer.concat([buf, chunk]);
            const idx = buf.indexOf('\r\n\r\n');
            if (idx === -1) {
                if (buf.length > 4096) { cleanup(); reject(new Error('Header overflow')); }
                return;
            }
            const firstLine = buf.slice(0, idx).toString('latin1').split('\r\n')[0];
            cleanup();
            if (firstLine.startsWith('HTTP/') && firstLine.includes(' 200')) {
                resolve(buf.slice(idx + 4));
            } else {
                reject(new Error(`HTTP proxy rejected: ${firstLine}`));
            }
        };
        socket.on('data', onData);
        socket.once('error', onErr);
        socket.once('close', onClose);
        socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
    });
}

function openSingleHopSocket(node, targetHost, targetPort, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const sock = new net.Socket();
        sock.setNoDelay(true);
        const timer = setTimeout(() => { sock.destroy(); reject(new Error('Connect timeout')); }, timeoutMs);
        sock.once('error', err => { clearTimeout(timer); sock.destroy(); reject(err); });
        sock.connect(node.port, node.host, async () => {
            clearTimeout(timer);
            try {
                if (node.type === 'http') await httpConnectViaSocket(sock, targetHost, targetPort, timeoutMs);
                else await socks5HandshakeAndConnect(sock, targetHost, targetPort, true, timeoutMs);
                resolve(sock);
            } catch (err) {
                sock.destroy();
                reject(err);
            }
        });
    });
}

function openDualHopSocket(ingress, egress, targetHost, targetPort, timeoutMs = 3800) {
    return new Promise((resolve, reject) => {
        if (!ingress || ingress.type === 'http' || ingress.host === egress.host) {
            return reject(new Error('Invalid dual-hop pair'));
        }
        const sock = new net.Socket();
        sock.setNoDelay(true);
        const timer = setTimeout(() => { sock.destroy(); reject(new Error('Dual-hop timeout')); }, timeoutMs);
        sock.once('error', err => { clearTimeout(timer); sock.destroy(); reject(err); });
        sock.connect(ingress.port, ingress.host, async () => {
            clearTimeout(timer);
            try {
                // Hop 1: Ingress -> Egress
                await socks5HandshakeAndConnect(sock, egress.host, egress.port, true, timeoutMs);
                // Hop 2: Egress -> Final Target
                if (egress.type === 'http') await httpConnectViaSocket(sock, targetHost, targetPort, timeoutMs);
                else await socks5HandshakeAndConnect(sock, targetHost, targetPort, true, timeoutMs);
                resolve(sock);
            } catch (err) {
                sock.destroy();
                reject(err);
            }
        });
    });
}

// Protocol-level probe: verifies real SOCKS5/HTTP CONNECT to api.ipify.org:443 (no fake TCP-only passes)
async function probeMeshNode(node, timeout = 2600) {
    if (!isSafePublicRelayHost(node.host)) return null;
    const start = Date.now();
    try {
        const sock = await openSingleHopSocket(node, 'api.ipify.org', 443, timeout);
        try { sock.destroy(); } catch (_) {}
        return { node, latencyMs: Math.max(1, Date.now() - start) };
    } catch (_) {
        return null;
    }
}

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
        this.activeMode = 'relay_auto';
        this.killSwitch = true;
        this.customConfig = '';
        this.connectedAt = null;
        this.currentProxyRules = '';
        this.virtualIp = 'Direct connection (IP not masked)';
        this.virtualCountry = 'Local Direct';
        this.ping = 0;
        this.errorMessage = null;
        this.activeSessions = new Set();
        this.torProcess = null;
        this.torPort = null;
        this.lastTorMode = null;
        this.routeHealthTimer = null;
        this.manifestNodes = [];
        this.manifestExpiry = 0;
        this.activeMeshNode = null;
        this.activeIngressNode = null;
        this.activeHopMode = 'OFFLINE'; // 'DUAL_HOP' | 'SINGLE_HOP' | 'CONNECTING' | 'OFFLINE'
        this.meshServer = null;
        this.meshPort = 0;
        this.meshRegion = 'AUTO';
        this.aliveMeshNodes = [];
        this.deadUntilMap = new Map();

        this.loadConfig();
        this.refreshManifestIfNeeded();
        process.on('exit', () => {
            this.stopMeshTunnel();
            this.stopEmbeddedTor();
        });
    }

    fetchJsonUrl(urlStr, redirectsLeft = 3) {
        return new Promise((resolve, reject) => {
            const req = https.get(urlStr, {
                timeout: 6000,
                headers: { 'User-Agent': 'FokkMesh/3.0', 'Cache-Control': 'no-cache' }
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
                    res.resume();
                    return this.fetchJsonUrl(res.headers.location, redirectsLeft - 1).then(resolve, reject);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                let body = '';
                res.on('data', c => { body += c; });
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
                });
            });
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.on('error', reject);
        });
    }

    async refreshManifestIfNeeded(force = false) {
        if (!force && Date.now() < this.manifestExpiry && this.manifestNodes.length > 0) return;
        this.manifestExpiry = Date.now() + 30 * 60 * 1000;
        for (const url of MESH_MANIFEST_URLS) {
            try {
                const parsed = await this.fetchJsonUrl(url);
                if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
                    const cleanNodes = parsed.nodes
                        .filter(n => n && n.host && Number(n.port) >= 1 && Number(n.port) <= 65535 && isSafePublicRelayHost(n.host))
                        .map(n => ({
                            host: String(n.host).trim(),
                            port: Number(n.port),
                            type: n.type === 'http' ? 'http' : 'socks5',
                            country: String(n.country || '').toUpperCase(),
                            city: String(n.city || ''),
                            ingress_relay: !!n.ingress_relay && n.type !== 'http',
                            supports_dual_hop: !!n.supports_dual_hop
                        }));
                    if (cleanNodes.length > 0) {
                        this.manifestNodes = cleanNodes;
                        this.manifestExpiry = Date.now() + 3 * 60 * 60 * 1000; // 3h TTL aligned with 6h Sentinel
                        return;
                    }
                }
            } catch (_) {}
        }
    }

    nodeKey(n) { return `${n.host}:${n.port}`; }
    isNodeAlive(n) { return Date.now() > (this.deadUntilMap.get(this.nodeKey(n)) || 0); }
    markNodeDead(n, ms = 120_000) { this.deadUntilMap.set(this.nodeKey(n), Date.now() + ms); }

    getMeshPoolForRegion(region) {
        const all = this.manifestNodes.length > 0 ? this.manifestNodes : BUILTIN_MESH_NODES;
        if (!region || region === 'AUTO') return all;
        let filtered = [];
        if (region === 'EU') filtered = all.filter(n => EU_COUNTRIES.has(n.country));
        else if (region === 'AM') filtered = all.filter(n => AM_COUNTRIES.has(n.country));
        else if (region === 'AS') filtered = all.filter(n => AS_COUNTRIES.has(n.country));
        else filtered = all.filter(n => n.country === region);
        return filtered.length > 0 ? filtered : all;
    }

    async findAliveMeshNodes(region) {
        const pool = this.getMeshPoolForRegion(region);
        const results = await Promise.all(pool.map(n => probeMeshNode(n, 2600)));
        const alive = results.filter(Boolean).sort((a, b) => a.latencyMs - b.latencyMs);
        this.aliveMeshNodes = alive;
        return alive;
    }

    async findBestMeshNode(region) {
        const alive = await this.findAliveMeshNodes(region);
        return alive.length > 0 ? alive[0] : null;
    }

    async routeMeshConnection(targetHost, targetPort) {
        if (!isSafePublicRelayHost(targetHost)) {
            throw new Error('Blocked private/SSRF target');
        }
        const regionPool = this.aliveMeshNodes.length > 0
            ? this.aliveMeshNodes.map(x => x.node).filter(n => this.isNodeAlive(n))
            : this.getMeshPoolForRegion(this.meshRegion).filter(n => this.isNodeAlive(n));
        const allPool = (this.manifestNodes.length > 0 ? this.manifestNodes : BUILTIN_MESH_NODES).filter(n => this.isNodeAlive(n));
        const egressList = (regionPool.length > 0 ? regionPool : allPool).slice(0, 4);
        const ingressList = allPool.filter(n => n.type === 'socks5' && (n.ingress_relay || n.supports_dual_hop));
        const fallbackIngress = ingressList.length > 0 ? ingressList : allPool.filter(n => n.type === 'socks5');

        // Tier 1: Dual-Hop (Ingress -> Egress -> Target)
        for (const egress of egressList.slice(0, 2)) {
            const ingress = fallbackIngress.find(i => i.host !== egress.host);
            if (!ingress) continue;
            try {
                const t0 = Date.now();
                const sock = await openDualHopSocket(ingress, egress, targetHost, targetPort, 3800);
                this.activeHopMode = 'DUAL_HOP';
                this.activeIngressNode = ingress;
                this.activeMeshNode = egress;
                this.ping = Math.max(1, Date.now() - t0);
                return sock;
            } catch (_) {
                this.markNodeDead(egress, 90_000);
            }
        }

        // Tier 2: Single-Hop failover across surviving verified relays
        for (const node of egressList) {
            try {
                const t0 = Date.now();
                const sock = await openSingleHopSocket(node, targetHost, targetPort, 3200);
                this.activeHopMode = 'SINGLE_HOP';
                this.activeIngressNode = null;
                this.activeMeshNode = node;
                this.ping = Math.max(1, Date.now() - t0);
                return sock;
            } catch (_) {
                this.markNodeDead(node, 120_000);
            }
        }

        // Tier 3: Self-heal manifest & stay strictly fail-closed
        this.activeHopMode = 'OFFLINE';
        this.refreshManifestIfNeeded(true).catch(() => {});
        throw new Error('All Fokk Mesh relays exhausted (fail-closed killswitch)');
    }

    startMeshTunnel(region) {
        this.meshRegion = region || 'AUTO';
        if (this.meshServer && this.meshPort > 0) {
            return Promise.resolve(this.meshPort);
        }
        return new Promise((resolve, reject) => {
            const server = net.createServer(clientSock => {
                clientSock.setNoDelay(true);
                let headerBuf = Buffer.alloc(0);
                let handled = false;
                const onData = async chunk => {
                    if (handled) return;
                    headerBuf = Buffer.concat([headerBuf, chunk]);
                    const headerEnd = headerBuf.indexOf('\r\n\r\n');
                    if (headerEnd === -1) {
                        if (headerBuf.length > 16384) clientSock.destroy();
                        return;
                    }
                    handled = true;
                    clientSock.removeListener('data', onData);
                    const headStr = headerBuf.slice(0, headerEnd).toString('latin1');
                    const rest = headerBuf.slice(headerEnd + 4);
                    const firstLine = headStr.split('\r\n')[0] || '';
                    const [method, target, version = 'HTTP/1.1'] = firstLine.split(' ');

                    try {
                        if (method === 'CONNECT') {
                            const idx = target.lastIndexOf(':');
                            const targetHost = idx > -1 ? target.slice(0, idx) : target;
                            const targetPort = idx > -1 ? Number(target.slice(idx + 1)) || 443 : 443;
                            const upstream = await this.routeMeshConnection(targetHost, targetPort);
                            clientSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                            if (rest.length > 0) upstream.write(rest);
                            clientSock.pipe(upstream);
                            upstream.pipe(clientSock);
                            clientSock.on('error', () => upstream.destroy());
                            upstream.on('error', () => clientSock.destroy());
                        } else {
                            // Plain HTTP: rewrite absolute URI to origin-form and strip Proxy-* headers
                            const parsed = new URL(target.startsWith('http') ? target : `http://${target}`);
                            const targetHost = parsed.hostname;
                            const targetPort = Number(parsed.port) || 80;
                            const upstream = await this.routeMeshConnection(targetHost, targetPort);
                            const lines = headStr.split('\r\n');
                            const cleanLines = [`${method} ${parsed.pathname || '/'}${parsed.search || ''} ${version}`];
                            for (let i = 1; i < lines.length; i++) {
                                if (/^proxy-(?:connection|authorization):/i.test(lines[i])) continue;
                                cleanLines.push(lines[i]);
                            }
                            upstream.write(cleanLines.join('\r\n') + '\r\n\r\n');
                            if (rest.length > 0) upstream.write(rest);
                            clientSock.pipe(upstream);
                            upstream.pipe(clientSock);
                            clientSock.on('error', () => upstream.destroy());
                            upstream.on('error', () => clientSock.destroy());
                        }
                    } catch (_) {
                        try { clientSock.end('HTTP/1.1 407 Mesh Unavailable\r\n\r\n'); } catch (__) {}
                    }
                };
                clientSock.on('data', onData);
                clientSock.on('error', () => {});
            });
            server.on('error', reject);
            server.listen(0, '127.0.0.1', () => {
                this.meshServer = server;
                this.meshPort = server.address().port;
                resolve(this.meshPort);
            });
        });
    }

    stopMeshTunnel() {
        const srv = this.meshServer;
        this.meshServer = null;
        this.meshPort = 0;
        this.activeHopMode = 'OFFLINE';
        this.activeIngressNode = null;
        if (srv) {
            try { srv.close(); } catch (_) {}
        }
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
                if (typeof data.customConfig === 'string') {
                    this.customConfig = data.customConfig.trim();
                }
            }
        } catch (_) {}

        // Older builds prefilled a local proxy address even though Fokk did not
        // start a proxy there. Remove that placeholder so Custom mode is explicit.
        if (this.customConfig.trim() === '127.0.0.1:1080') {
            this.customConfig = '';
            this.saveConfig();
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
            countryCode: loc.countryCode || '',
            city: loc.city || '',
            isCountry: !!loc.isCountry,
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
            location: PRESET_LOCATIONS[this.activeMode] || PRESET_LOCATIONS.relay_auto,
            virtualIp: this.virtualIp,
            virtualCountry: this.virtualCountry,
            ping: this.ping,
            killSwitch: this.killSwitch,
            customConfig: this.customConfig,
            connectedAt: this.connectedAt,
            uptimeSeconds: this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0,
            errorMessage: this.errorMessage,
            activeMeshNode: this.activeMeshNode,
            activeIngressNode: this.activeIngressNode,
            activeHopMode: this.activeHopMode,
            aliveMeshCount: this.aliveMeshNodes.length,
            meshNodeCount: (this.manifestNodes.length > 0 ? this.manifestNodes : BUILTIN_MESH_NODES).length
        };
    }

    checkDirectPublicIp() {
        return new Promise(resolve => {
            const endpoints = [
                'https://api.ipify.org?format=json',
                'https://ipinfo.io/json',
                'https://ifconfig.me/ip',
                'https://icanhazip.com/',
                'https://cloudflare.com/cdn-cgi/trace'
            ];
            let index = 0;
            let lastError = 'No direct public IP service returned an address.';
            const next = () => {
                if (index >= endpoints.length) {
                    resolve({ ip: null, error: lastError });
                    return;
                }
                const url = endpoints[index++];
                let settled = false;
                const fail = error => {
                    if (settled) return;
                    settled = true;
                    lastError = error?.message || 'The direct public IP service failed.';
                    next();
                };
                const request = https.get(url, { timeout: 4_000, headers: { 'User-Agent': 'FokkBrowser-RouteCheck/1.0' } }, response => {
                    let body = '';
                    response.on('data', chunk => { body += chunk; });
                    response.on('end', () => {
                        if (settled) return;
                        settled = true;
                        if (response.statusCode !== 200) {
                            lastError = `IP service returned HTTP ${response.statusCode}`;
                            next();
                            return;
                        }
                        let candidate = '';
                        try { candidate = JSON.parse(body)?.ip || ''; } catch (_) {}
                        if (!candidate) candidate = body.match(/(?:^|\n)ip=([^\s]+)/)?.[1] || body.trim();
                        candidate = String(candidate).trim();
                        if (net.isIP(candidate)) resolve({ ip: candidate, error: null });
                        else {
                            lastError = 'The IP service returned an invalid address.';
                            next();
                        }
                    });
                });
                request.on('timeout', () => request.destroy(new Error('Direct public IP check timed out.')));
                request.on('error', fail);
            };
            next();
        });
    }

    getEmbeddedTorPath() {
        // Do not attempt to run Linux Tor ELF binaries on Windows!
        if (process.platform === 'win32') {
            const winCandidates = [];
            if (process.resourcesPath) {
                winCandidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'tor', 'windows-x64', 'tor', 'tor.exe'));
                winCandidates.push(path.join(process.resourcesPath, 'bin', 'tor', 'windows-x64', 'tor', 'tor.exe'));
            }
            if (process.execPath) {
                const execDir = path.dirname(process.execPath);
                winCandidates.push(path.join(execDir, 'resources', 'app.asar.unpacked', 'bin', 'tor', 'windows-x64', 'tor', 'tor.exe'));
            }
            winCandidates.push(path.resolve(__dirname, '..', 'bin', 'tor', 'windows-x64', 'tor', 'tor.exe'));
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
        // Only report Tor when this engine owns the Tor process, is on the requested mode, and socket is alive
        if (this.torProcess && this.torPort && this.lastTorMode === this.activeMode && await checkSocks5Listener(this.torPort, '127.0.0.1', 800)) {
            return this.torPort;
        }

        const torBin = this.getEmbeddedTorPath();
        if (!torBin) {
            return null;
        }

        try {
            let chosenPort = null;
            for (const p of [9050, 9052, 9053, 9054]) {
                const inUse = await checkSocketListening(p, '127.0.0.1', 200);
                if (!inUse) {
                    chosenPort = p;
                    break;
                }
            }
            if (!chosenPort) throw new Error('All local Tor SOCKS ports are already in use.');

            const torDataDir = path.join(this.userDataPath, 'tor_embedded_data');
            try {
                if (!fs.existsSync(this.userDataPath)) fs.mkdirSync(this.userDataPath, { recursive: true });
                if (!fs.existsSync(torDataDir)) fs.mkdirSync(torDataDir, { recursive: true, mode: 0o700 });
                if (process.platform !== 'win32') fs.chmodSync(torDataDir, 0o700);
            } catch (_) {}

            const torLibDir = path.dirname(torBin);
            const env = { ...process.env };
            if (process.platform !== 'win32') {
                env.LD_LIBRARY_PATH = `${torLibDir}:${process.env.LD_LIBRARY_PATH || ''}`;
            }

            await this.stopEmbeddedTor();

            let spawnFailed = false;
            let spawnError = null;
            let exitInfo = null;
            let startupLog = '';
            const torRoot = process.platform === 'win32' ? path.resolve(torLibDir, '..') : torLibDir;
            const args = [];
            if (process.platform === 'win32') {
                args.push(
                    '--defaults-torrc', path.join(torRoot, 'fokk-torrc-defaults'),
                    '--GeoIPFile', path.join(torRoot, 'data', 'geoip'),
                    '--GeoIPv6File', path.join(torRoot, 'data', 'geoip6')
                );
            }
            args.push(
                '--SocksPort', `127.0.0.1:${chosenPort}`,
                '--DataDirectory', torDataDir,
                '--ClientOnly', '1',
                '--AvoidDiskWrites', '1',
                '--Log', 'notice stdout'
            );

            // Add regional exit nodes based on active relay mode
            let exitNodesArg = null;
            if (this.activeMode === 'relay_eu') {
                exitNodesArg = '{de},{gb},{fr},{nl},{ch},{se},{es},{it}';
            } else if (this.activeMode === 'relay_am') {
                exitNodesArg = '{us},{ca},{br},{mx}';
            } else if (this.activeMode === 'relay_as') {
                exitNodesArg = '{jp},{sg},{au},{kr},{hk}';
            }
            if (exitNodesArg) {
                args.push('--ExitNodes', exitNodesArg, '--StrictNodes', '0');
            }

            this.torProcess = spawn(torBin, args, { env, cwd: torRoot, detached: false });
            this.torPort = chosenPort;
            this.lastTorMode = this.activeMode;

            const captureStartupLog = chunk => {
                startupLog = `${startupLog}${chunk.toString('utf8')}`.slice(-2_000);
            };
            if (this.torProcess.stdout) this.torProcess.stdout.on('data', captureStartupLog);
            if (this.torProcess.stderr) this.torProcess.stderr.on('data', captureStartupLog);

            this.torProcess.on('error', error => {
                spawnFailed = true;
                spawnError = error;
                this.torProcess = null;
                this.torPort = null;
            });

            this.torProcess.on('exit', (code, signal) => {
                exitInfo = { code, signal };
                this.torProcess = null;
                this.torPort = null;
            });

            for (let i = 0; i < 30; i++) {
                if (spawnFailed) break;
                await new Promise(r => setTimeout(r, 200));
                if (await checkSocks5Listener(chosenPort, '127.0.0.1', 800)) {
                    return chosenPort;
                }
                if (exitInfo) break;
            }

            await this.stopEmbeddedTor();
            if (spawnError) throw new Error(`Could not launch the bundled Tor runtime: ${spawnError.message}`);
            const recentLog = startupLog.trim().split(/\r?\n/).slice(-3).join(' ').slice(-350);
            if (recentLog) throw new Error(`Bundled Tor did not open its SOCKS port. ${recentLog}`);
            if (exitInfo) throw new Error(`Bundled Tor exited before opening its SOCKS port (code ${exitInfo.code ?? 'unknown'}${exitInfo.signal ? `, ${exitInfo.signal}` : ''}).`);
            throw new Error('Bundled Tor did not open its local SOCKS port within six seconds.');
        } catch (error) {
            await this.stopEmbeddedTor();
            throw error;
        }
    }

    async stopEmbeddedTor() {
        const processToStop = this.torProcess;
        this.torProcess = null;
        this.torPort = null;
        if (processToStop) {
            try {
                processToStop.kill('SIGKILL');
            } catch (_) {}
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
            const isMeshRelay = this.activeMode.startsWith('relay_') || this.activeMode.startsWith('country_');
            const isTorMode = this.activeMode === 'tor';
            this.activeMeshNode = null;
            let proxyRules = '';
            let locationName = '';
            let measuredPing = 0;
            let exitIpDisplay = 'Route configured — verify exit IP';

            if (isMeshRelay) {
                await this.refreshManifestIfNeeded();
                const region = PRESET_LOCATIONS[this.activeMode]?.meshRegion || 'AUTO';
                let alive = await this.findAliveMeshNodes(region);
                if (alive.length === 0) {
                    // Self-heal once from live Sentinel feeds if cached nodes did not answer
                    await this.refreshManifestIfNeeded(true);
                    alive = await this.findAliveMeshNodes(region);
                }
                if (alive.length > 0) {
                    await this.stopEmbeddedTor();
                    const best = alive[0];
                    const n = best.node;
                    this.activeMeshNode = n;
                    this.activeHopMode = alive.length >= 2 ? 'DUAL_HOP' : 'SINGLE_HOP';
                    const localPort = await this.startMeshTunnel(region);
                    proxyRules = `http=127.0.0.1:${localPort};https=127.0.0.1:${localPort}`;
                    const countryLabel = COUNTRY_NAMES[n.country] || n.country || 'Global';
                    locationName = n.city ? `${n.city}, ${countryLabel}` : countryLabel;
                    measuredPing = best.latencyMs;
                    exitIpDisplay = `${n.host} (${this.activeHopMode === 'DUAL_HOP' ? 'Dual-Hop' : 'Relay'})`;
                } else {
                    this.stopMeshTunnel();
                    throw new Error('No verified Fokk Mesh relay responded on this network. Sentinel updates the manifest every 6 hours — try again shortly or check firewall rules.');
                }
            } else if (isTorMode) {
                this.stopMeshTunnel();
                const torPort = await this.ensureTorRunning();
                if (torPort) {
                    proxyRules = `socks5://127.0.0.1:${torPort}`;
                    locationName = 'Tor Onion Network';
                } else {
                    throw new Error('The bundled Tor runtime is missing from this desktop build. Routing was not enabled.');
                }
            } else if (this.activeMode === 'custom') {
                this.stopMeshTunnel();
                await this.stopEmbeddedTor();
                proxyRules = this.resolveCustomProxyRules();
                if (!proxyRules) {
                    throw new Error('Enter the address of a running SOCKS5 or HTTP proxy. Custom mode does not start a proxy server.');
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
            this.virtualIp = exitIpDisplay;
            this.ping = measuredPing;
            this.errorMessage = null;

            this.startRouteHealthMonitor();
            this.emitStatus();

            return { success: true, status: this.getStatus() };
        } catch (err) {
            this.state = 'error';
            this.errorMessage = err.message || 'Connection failed';
            this.connectedAt = null;
            this.stopRouteHealthMonitor();
            this.stopMeshTunnel();
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
        this.activeMeshNode = null;
        this.stopRouteHealthMonitor();
        this.currentProxyRules = '';
        this.virtualIp = 'Direct connection (IP not masked)';
        this.virtualCountry = 'Local Direct';
        this.ping = 0;

        // Restore direct connection on all tracked sessions
        await this.applyProxyRules('');
        this.stopMeshTunnel();
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
        if (/^https:\/\//i.test(this.customConfig)) {
            const proxy = new URL(this.customConfig);
            if (!proxy.hostname || !proxy.port) return '';
            return `http=https://${proxy.host};https=https://${proxy.host}`;
        }
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
