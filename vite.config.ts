import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to remove crossorigin attribute for Electron compatibility
const removeCrossorigin = () => {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html: string) {
      return html
        .replace(/crossorigin="anonymous"/g, '')
        .replace(/crossorigin='anonymous'/g, '')
        .replace(/crossorigin/g, '');
    }
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), removeCrossorigin()],
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          input: path.resolve(__dirname, 'index.html'),
          external: ['child_process', 'util', 'fs', 'path'],
          output: {
            // Remove crossorigin attribute for Electron file:// protocol compatibility
            assetFileNames: 'assets/[name]-[hash][extname]',
            entryFileNames: 'assets/[name]-[hash].js',
          }
        },
      },
      optimizeDeps: {
        exclude: ['child_process', 'util']
      }
    };
});
