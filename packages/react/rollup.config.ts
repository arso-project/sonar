import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import nodeGlobals from 'rollup-plugin-node-globals'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import replace from 'rollup-plugin-replace'
import autoExternal from 'rollup-plugin-auto-external'
// import cjs from "rollup-plugin-cjs-es";
// import babel from "@rollup/plugin-babel"
// import esbuild from 'rollup-plugin-esbuild'
// import visualizer from 'rollup-plugin-visualizer'
// import nodeBuiltins from 'rollup-plugin-node-builtins'
// import analyze from 'rollup-plugin-analyzer'
import { terser } from 'rollup-plugin-terser'

const extensions = ['.js', '.ts']

const shared = {
  input: 'index.js',
  output: {
    intro: `
      const global = window;
      // const process = {
        // nextTick: cb => new Promise(() => cb && cb())
      // }
    `,
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
    nodeResolve({
      extensions,
      browser: true,
      preferBuiltins: true,
      mainFields: ['browser']
    }),
    commonjs(),
    nodePolyfills({}),
    nodeGlobals()
    // nodeGlobals(),
    // nodeBuiltins(),
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
      file: 'dist/es/bundle.js',
      format: 'esm'
    },
    plugins: [
      ...shared.plugins,
      autoExternal({
        builtins: false,
        dependencies: false,
        peerDependencies: true
      })
      // terser()
    ]
  },
  {
    ...shared,
    output: {
      ...shared.output,
      file: 'dist/es/index.js',
      format: 'esm'
    },
    plugins: [autoExternal(), ...shared.plugins]
  }
  // {
  //   ...shared,
  //   output: {
  //     ...shared.output,
  //     file: 'dist/cjs/bundle.js',
  //     format: 'cjs'
  //   }
  // },
  // {
  //   ...shared,
  //   output: {
  //     ...shared.output,
  //     file: 'dist/iife/sonar.js',
  //     format: 'iife',
  //     name: 'SonarClient',
  //     intro: 'const global = window;'
  //   }
  // }
]
