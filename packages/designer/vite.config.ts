import { defineConfig } from 'vite'

// Base relative : le pont sert le concepteur à la racine, sans connaître son chemin.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})
