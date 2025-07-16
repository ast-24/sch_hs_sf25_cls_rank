import http from 'http';
import { readFile, createReadStream, existsSync, statSync } from 'fs';
import { extname, join, dirname, resolve } from 'path';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);

const PORT = 8080;
const currentDir = dirname(fileURLToPath(import.meta.url));
const ASS_DIR = resolve(currentDir, '../../src/srv-www-ass');
const SRF_DIR = resolve(currentDir, '../../src/srv-www-srf');

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
                .replace(/\{\{ASS_ORIGIN\}\}/g, origin)
                .replace(/\{\{SRF_ORIGIN\}\}/g, origin)
                .replace(/\{\{API_ORIGIN\}\}/g, '');
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

const server = http.createServer(async (req, res) => {
    const reqPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = join(SRF_DIR, reqPath);

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        filePath = join(ASS_DIR, reqPath);
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
            filePath = join(SRF_DIR, 'index.html');
        }
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
