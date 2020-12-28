#!/usr/bin/env node

const p = require('path')
const fs = require('fs')
const { loadTypesFromDir } = require('../lib/util')

const dir = p.join(__dirname, '../types')
const specs = loadTypesFromDir(dir)
const serialized = JSON.stringify(specs, null, 2)
const buildPath = p.join(__dirname, '../lib/types.json')
fs.writeFileSync(buildPath, serialized)
console.log('Written ' + buildPath)
