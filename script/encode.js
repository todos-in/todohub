#!/usr/bin/env node

import { gzipSync } from 'node:zlib'
import { Buffer } from 'node:buffer'

if (process.argv.length <= 2) {
  throw new Error('Needs exactly one argument (JSON formatted string) to encode.')
}
const decoded = process.argv[2]

// Only to check if input is valid json
const parsedAndStringified = JSON.stringify(JSON.parse(decoded))

const zipped = gzipSync(Buffer.from(parsedAndStringified, 'utf-8'))
const b64Encoded = zipped.toString('base64')

console.info('✅ Sucessfully encoded: ')
console.info(b64Encoded)
