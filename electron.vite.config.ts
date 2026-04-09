import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const mode = process.env.EIDUX_MODE;

const alias = [
  { find: '@ai', replacement: resolve('src/ai') },
  { find: '@node', replacement: resolve('src/node') },  
  { find: '@http', replacement: resolve('src/http') },

  { find: '@renderer', replacement: resolve('src/renderer') },
  { find: '@hack', replacement: resolve('src/hack') },
  { find: '@state', replacement: resolve('src/state') },
  { find: '@event', replacement: resolve('src/event') },
  { find: '@view', replacement: resolve('src/view') },
  { find: '@editor', replacement: resolve('src/editor') },
  { find: '@commands', replacement: resolve('src/commands') },
  { find: '@hotkeys', replacement: resolve('src/hotkeys') },
  { find: '@library', replacement: resolve('src/library') },

  { find: '@lib', replacement: resolve('src/lib') },

  { find: '@', replacement: resolve('src') },
];

const isRelease = mode === 'release'

const terserOptions = isRelease
  ? {
      mangle: true,
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    }
  : undefined

export default defineConfig({
  main: {
    esbuild: { legalComments: 'none' },
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      sourcemap: isRelease ? false : true,
      minify: isRelease ? 'terser' : false,
      terserOptions,
      rollupOptions: {
        input: { index: 'src/node/main.ts' },
        output: { entryFileNames: 'index.js' },
      },
    },
  },

  preload: {
    esbuild: { legalComments: 'none' },
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      sourcemap: isRelease ? false : true,
      minify: isRelease ? 'terser' : false,
      terserOptions,
      rollupOptions: {
        input: { index: 'src/node/preload.ts' },
        output: { entryFileNames: 'index.js' },
      },
    },
  },

  renderer: {
    esbuild: { legalComments: 'none' },
    resolve: { alias },
    plugins: [
      react(),
      tailwindcss(),
      isRelease &&
        visualizer({
          filename: 'dist/package.stats.html',
          open: false,
          gzipSize: true,
          brotliSize: false,
        }),
    ].filter(Boolean),
    build: {
      sourcemap: isRelease ? false : true,
      minify: isRelease ? 'terser' : false,
      terserOptions,
      rollupOptions: {
        input: { index: 'src/renderer/index.html' },
      },
    },
  },
})
