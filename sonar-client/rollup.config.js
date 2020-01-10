import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import nodeBuiltins from 'rollup-plugin-node-builtins'
import json from '@rollup/plugin-json'
// import analyze from 'rollup-plugin-analyzer'
import { terser } from 'rollup-plugin-terser'

const shared = {
  input: 'index.js',
  output: {
    file: 'dist/sonar-client.esm.js',
    format: 'esm'
  },
  plugins: [
    commonjs(),
    json(),
    nodeResolve({ preferBuiltins: true, mainFields: ['browser'] }),
    nodeBuiltins(),
    // analyze(),
    terser()
  ]
}

export default [
  {
    ...shared,
    output: {
      file: 'dist/sonar-client.esm.js',
      format: 'esm'
    }
  },
  {
    ...shared,
    output: {
      file: 'dist/sonar-client.cjs.js',
      format: 'cjs'
    }
  },
  {
    ...shared,
    output: {
      file: 'dist/sonar-client.iife.js',
      format: 'iife',
      name: 'SonarClient'
    }
  }
]
