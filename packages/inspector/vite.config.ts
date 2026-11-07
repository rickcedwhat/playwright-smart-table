import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const port = Number(process.env.MCP_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MCP_PORT');
const target = `http://127.0.0.1:${port}`;
export default defineConfig({
  define: { __MCP_ORIGIN__: JSON.stringify(target) },
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 6274, strictPort: true,
    proxy: { '/mcp': target, '/health': target, '/bench': target, '/fixtures': target },
  },
});
