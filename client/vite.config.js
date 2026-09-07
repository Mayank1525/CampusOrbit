import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Accept the e2b preview host (and any other) so the live preview works.
    allowedHosts: true,
    cors: true,
    // HMR must reach the dev server over the SAME scheme/port the page was
    // served from. Hardcoding clientPort: 443 works only behind an HTTPS
    // proxy; on a normal `localhost:5173` it makes the HMR socket dial
    // ws://localhost:443, which is refused. Vite then falls back to polling
    // and can force full page reloads -- which silently resets multi-step
    // forms like the onboarding wizard back to step 1.
    // Leaving hmr undefined lets Vite infer the right host/port in both cases.
    hmr: true,
    proxy: {
      // Browser only ever talks to this origin; Vite forwards to Express.
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    // esbuild minification is dramatically lighter on memory than terser and
    // avoids OOM kills on small machines (a 2 GB CI box or a modest laptop).
    minify: 'esbuild',
    target: 'es2020',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
