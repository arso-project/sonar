import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import replace from 'rollup-plugin-replace'
// import visualizer from 'rollup-plugin-visualizer'
// import autoExternal from 'rollup-plugin-auto-external'
// import nodeBuiltins from 'rollup-plugin-node-builtins'
// import analyze from 'rollup-plugin-analyzer'
// import { terser } from 'rollup-plugin-terser'

const shared = {
  input: 'index.js',
  output: {
    intro: 'const global = window;',
    sourcemap: true
  },
  plugins: [
    json(),
    alias({
      entries: [
        { find: 'stream', replacement: 'streamx' },
        { find: 'readable-stream', replacement: 'streamx' }
        // { find: 'eventsource', replacement: './eventsource.js' }
      ]
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.title': JSON.stringify('browser'),
      'process.env': JSON.stringify({})
    }),
    nodePolyfills(),
    nodeResolve({
      browser: true,
      preferBuiltins: true
      // mainFields: ['browser']
    }),
    commonjs()
    // analyze(),
    // terser(),
    // visualizer({ open: true })
  ]
}

export default [
  {
    ...shared,
    output: {
      ...shared.output,
      file: 'dist/sonar-client.bundle.esm.js',
      format: 'esm'
    }
  },
  {
    ...shared,
    output: {
      ...shared.output,
      file: 'dist/sonar-client.esm.js',
      format: 'esm'
    },
    external: id => !(id.startsWith('.') || id.indexOf('sonar-client') > -1),
    plugins: [
      // autoExternal(),
      ...shared.plugins
    ]
  },
  {
    ...shared,
    output: {
      ...shared.output,
      file: 'dist/sonar-client.bundle.cjs.js',
      format: 'cjs'
    }
  },
  {
    ...shared,
    output: {
      ...shared.output,
      file: 'dist/sonar-client.bundle.iife.js',
      format: 'iife',
      name: 'SonarClient',
      intro: 'const global = window;'
    }
  }
]
