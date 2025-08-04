import http from 'http';
import https from 'https';
import { readFile, createReadStream, existsSync, statSync } from 'fs';
import { extname, join, dirname, resolve } from 'path';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);

const PORT = 8080;
const API_SERVER_URL = 'https://api-skijnjrank.ast24.dev';

const currentDir = dirname(fileURLToPath(import.meta.url));
const WWW_DIR = resolve(currentDir, '../../src/srv-www');

const getAllIPs = () => {
    const ips = ['localhost'];
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
};

const IPS = getAllIPs();

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const serveFile = async (filePath, res, origin) => {
    const ext = extname(filePath);
    const type = mimeTypes[ext] || 'application/octet-stream';

    if (['.html', '.css', '.mjs'].includes(ext)) {
        try {
            let data = await readFileAsync(filePath, 'utf8');
            const fileDir = dirname(filePath).replace(/\\/g, '/');
            data = data
                .replace(/\{\{WWW_ORIGIN\}\}/g, origin)
                .replace(/\{\{API_ORIGIN\}\}/g, `${origin}/api`);
            res.writeHead(200, { 'Content-Type': type });
            res.end(data);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to read file');
        }
    } else {
        const stream = createReadStream(filePath);
        res.writeHead(200, { 'Content-Type': type });
        stream.pipe(res);
        stream.on('error', () => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to read file');
        });
    }
};

// APIプロキシ機能
const proxyAPIRequest = async (req, res) => {
    const url = new URL(req.url.replace('/api', ''), API_SERVER_URL);

    const options = {
        method: req.method,
        headers: {
            ...req.headers,
            host: url.host,
        },
    };

    const requestModule = url.protocol === 'https:' ? https : http;
    const proxyReq = requestModule.request(url, options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error' }));
    });

    // リクエストボディをプロキシに転送
    req.pipe(proxyReq);
};

const server = http.createServer(async (req, res) => {
    const reqPath = decodeURIComponent(req.url.split('?')[0]);

    // APIリクエストの場合はプロキシする
    if (reqPath.startsWith('/api')) {
        await proxyAPIRequest(req, res);
        return;
    }

    let filePath = join(WWW_DIR, reqPath);

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, 'index.html');
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
    }

    // リクエストからオリジンを抽出
    const origin = req.headers.origin || `http://${req.headers.host}`;

    await serveFile(filePath, res, origin);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SPA server running at:`);
    console.log(`  Local:   http://localhost:${PORT}`);
    for (const ip of IPS) {
        if (ip !== 'localhost') {
            console.log(`  Network: http://${ip}:${PORT}`);
        }
    }
});
