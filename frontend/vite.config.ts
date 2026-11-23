/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT ?? 5173),
      // Same-origin in dev: the browser talks to /api, Vite forwards to Nest.
      // This keeps the httpOnly SameSite=Strict auth cookie working without CORS.
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // css:false blanks every .css id, including the ?raw import theme.test.ts reads.
      css: { include: /\.css\?raw$/ },
      restoreMocks: true,
    },
  };
});
