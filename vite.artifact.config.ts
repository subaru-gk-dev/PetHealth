import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build (no service worker) used to publish the app as a
// self-contained HTML page for trying it on a phone before hosting exists.
export default defineConfig({
  define: { 'import.meta.env.VITE_NO_SW': 'true', 'import.meta.env.VITE_SINGLE_FILE': 'true' },
  plugins: [preact(), viteSingleFile()],
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
  },
});
