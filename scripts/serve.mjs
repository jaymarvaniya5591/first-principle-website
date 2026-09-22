import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 5592);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    const relative = path.relative(root,file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403).end(); return;
    }
    if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream',
      'Content-Length':info.size,'Cache-Control':'no-store'});
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port,'127.0.0.1', () => console.log(`Preview: http://localhost:${port}`));
