// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: {
        'x-ymm-filter': resolve(__dirname, './src/x-ymm-filter.js'),
        // 'x-product-siblings': resolve(__dirname, './src/x-product-siblings.js'),
      },
      formats: [],
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      output: {
        // Since we publish our ./src folder, there's no point
        // in bloating sourcemaps with another copy of it.
        sourcemapExcludeSources: true,
      },
    },
    sourcemap: true,
    // Reduce bloat from legacy polyfills.
    // target: 'es6',
    // Leave minification up to applications.
    minify: false,
  },
})
