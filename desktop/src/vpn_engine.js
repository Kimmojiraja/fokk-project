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
        setupTip: 'Starts the bundled Tor client and routes this browser through its local SOCKS port.'
    },
    'relay_auto': {
        id: 'relay_auto',
        name: 'Fokk Smart Relay (Optimal)',
        badge: 'Zero-Drop Relay',
        protocol: 'Split-Trust SOCKS5',
        description: 'Automatic high-speed oblivious relay routing across 40+ global country locations.',
        region: 'Global Optimal',
        color: '#00E5FF',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>',
        setupTip: 'Connects through the high-reliability multi-country Fokk Relay network.'
    },
    'relay_eu': {
        id: 'relay_eu',
        name: 'Europe Cluster (40+ Locations)',
        badge: 'EU Pro Egress',
        protocol: 'Split-Trust SOCKS5',
        description: 'Dedicated high-speed privacy routing across Germany, UK, Netherlands, France, and Nordic exits.',
        region: 'Europe (Frankfurt / London / Amsterdam)',
        color: '#38BDF8',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>',
        setupTip: 'Routes browser requests through verified European high-speed privacy nodes.'
    },
    'relay_am': {
        id: 'relay_am',
        name: 'Americas Cluster (40+ Locations)',
        badge: 'Americas Pro Egress',
        protocol: 'Split-Trust SOCKS5',
        description: 'Dedicated high-speed privacy routing across United States, Canada, and Latin American exits.',
        region: 'Americas (New York / Miami / Toronto)',
        color: '#34D399',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>',
        setupTip: 'Routes browser requests through verified Americas high-speed privacy nodes.'
    },
    'relay_as': {
        id: 'relay_as',
        name: 'Asia & Pacific Cluster (40+ Locations)',
        badge: 'APAC Pro Egress',
        protocol: 'Split-Trust SOCKS5',
        description: 'Dedicated high-speed privacy routing across Singapore, Japan, Hong Kong, and Australia exits.',
        region: 'Asia & Pacific (Singapore / Tokyo / Hong Kong)',
        color: '#F59E0B',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>',
        setupTip: 'Routes browser requests through verified Asia-Pacific high-speed privacy nodes.'
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
        this.torPort = null;
        this.lastTorMode = null;
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
            const isTorBased = this.activeMode === 'tor' || this.activeMode.startsWith('relay_');
            if (!isTorBased) await this.stopEmbeddedTor();
            let proxyRules = '';
            let locationName = '';

            if (isTorBased) {
                const torPort = await this.ensureTorRunning();
                if (torPort) {
                    proxyRules = `socks5://127.0.0.1:${torPort}`;
                    locationName = PRESET_LOCATIONS[this.activeMode]?.name || 'Fokk Relay Network';
                } else {
                    throw new Error('The bundled Tor runtime is missing from this desktop build. Routing was not enabled.');
                }
            } else if (this.activeMode === 'custom') {
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
