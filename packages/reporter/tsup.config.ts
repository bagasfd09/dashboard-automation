import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    playwright: 'src/playwright.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  target: 'node18',
  splitting: false,
  sourcemap: false,
  treeshake: true,
});
