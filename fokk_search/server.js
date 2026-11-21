const http = require('http');
const path = require('path');
const fs = require('fs');
const { aggregateSearch, fetchSuggestions } = require('./aggregator');

const PORT = process.env.PORT || 4040;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function serveStatic(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(data);
    });
}

const server = http.createServer(async (req, res) => {
    // Enable CORS for local testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const pathname = parsedUrl.pathname;

        // 1. API: Search
        if (pathname === '/api/search') {
            const rawQ = parsedUrl.searchParams.get('q') || '';
            const q = rawQ.replace(/\+/g, ' ').trim();
            const cat = (parsedUrl.searchParams.get('category') || 'all').toLowerCase();
            try {
                const results = await aggregateSearch(q, cat);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(results));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Search failed', details: err.message }));
            }
            return;
        }

        // 2. API: Autocomplete Suggestions
        if (pathname === '/api/suggest') {
            const rawQ = parsedUrl.searchParams.get('q') || '';
            const q = rawQ.replace(/\+/g, ' ').trim();
            try {
                const suggestions = await fetchSuggestions(q);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(suggestions));
            } catch (_) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify([]));
            }
            return;
        }

        // 3. Main HTML Route
        if (pathname === '/' || pathname === '/index.html' || pathname === '/search') {
            serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
            return;
        }

        // 4. Static Files
        const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
        if (safePath.startsWith(PUBLIC_DIR) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
            serveStatic(res, safePath);
            return;
        }

        // Fallback
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
    }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`========================================================`);
    console.log(`           FOKK SEARCH - META SEARCH ENGINE             `);
    console.log(`   Private, Zero-Tracking, Zero-Ad Meta Search Engine  `);
    console.log(`   Running locally at: http://localhost:${PORT}        `);
    console.log(`========================================================`);
});

// Graceful termination
process.on('SIGINT', () => {
    console.log('\nStopping Fokk Search Server...');
    server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
