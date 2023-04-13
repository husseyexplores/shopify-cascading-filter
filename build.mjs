import { build } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('vite').BuildOptions[]} */
let builds = [
  {
    lib: {
      entry: path.resolve(__dirname, './src/x-ymm-filter.js'),
      name: '__x_ymm_filter',
      formats: ['es'],
    },
  },
  {
    lib: {
      entry: path.resolve(__dirname, './src/x-product-siblings.js'),
      name: '__x_product_siblings',
      formats: ['es'],
    },
  },
  {
    lib: {
      entry: path.resolve(__dirname, './src/index.js'),
      name: '__x_ymm_filter__x_product_siblings',
      formats: ['es'],
    },
  },
]

builds = [
  ...builds,
  ...builds
    .filter(b => !b.lib.formats.includes('es'))
    .map(x => ({ ...x, minify: true, sourcemap: false })),
]

const ongoingBuilds = builds.map(async buildOpts => {
  /** @type {import('vite').BuildOptions} */

  return build({
    build: {
      outDir: './dist',
      ...buildOpts,
      lib: {
        ...buildOpts.lib,
        fileName: (format, name) =>
          `${name}.${format}${buildOpts.minify ? '.min' : ''}.js`,
        formats: buildOpts.lib.formats ?? ['iife'],
      },
      emptyOutDir: false,
    },
  })
})

Promise.all(ongoingBuilds).then(async () => {
  console.log('\n....DONE.....\n')
})
