import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = `http://127.0.0.1:${process.argv[2] || process.env.REVIEW_API_PORT || '5001'}`;
const server = await createServer({ root, server: { host: '127.0.0.1', port: Number(process.argv[3] || process.env.REVIEW_WEB_PORT || 5177),
  strictPort: true, open: false, proxy: { '/api': { target, changeOrigin: true }, '/uploads': { target, changeOrigin: true } } } });
await server.listen();
server.printUrls();
