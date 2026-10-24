import { defineConfig } from 'vite'
import delphia from '@vite-plugin-delphia/vite-plugin'

// Conventions Tauri 2 : port fixe (devUrl), échec si occupé, pas d'effacement du terminal.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  plugins: [delphia()],
})
