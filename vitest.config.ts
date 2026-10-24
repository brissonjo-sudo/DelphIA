import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // *.spec.ts : tests Vitest du mod, que « claude plugin test » (qui exécute tous les *.test.ts) ne doit pas voir.
    include: ['packages/*/test/**/*.test.ts', 'packages/mod/test/**/*.spec.ts'],
  },
})
