import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const environmentPath = fileURLToPath(new URL('../../.env', import.meta.url));
  // Read shared server settings without changing Vite's NODE_ENV or build mode.
  const environment = existsSync(environmentPath)
    ? parseEnv(readFileSync(environmentPath, 'utf8'))
    : {};
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
