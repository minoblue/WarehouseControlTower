import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 8080 },
  preview: { port: 8080 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('@carbon')) return 'carbon';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          if (id.includes('@tanstack') || id.includes('socket.io')) return 'data';
          return undefined;
        },
      },
    },
  },
});
