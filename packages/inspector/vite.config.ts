import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 6274, strictPort: true,
    proxy: { '/mcp': 'http://127.0.0.1:3001', '/health': 'http://127.0.0.1:3001', '/bench': 'http://127.0.0.1:3001', '/fixtures': 'http://127.0.0.1:3001' },
  },
});
