import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv, defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
  const environment = loadEnv(mode, workspaceRoot, ['API_', 'WEB_']);
  const host = process.env.API_HOST || environment.API_HOST || '127.0.0.1';
  const port = process.env.API_PORT || environment.API_PORT || '3001';
  const webPort = Number(process.env.WEB_PORT || environment.WEB_PORT || '5173');

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: webPort,
      strictPort: true,
      proxy: { '/api': { target: `http://${host}:${port}` } },
    },
  };
});
