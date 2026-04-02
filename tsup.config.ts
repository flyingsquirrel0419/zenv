import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'adapters/node': 'src/adapters/node.ts',
    'adapters/nextjs': 'src/adapters/nextjs.ts',
    'adapters/vite': 'src/adapters/vite.ts',
    'adapters/nestjs': 'src/adapters/nestjs.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
});
