#!/usr/bin/env node

import { gunzipSync } from 'node:zlib'
import { Buffer } from 'node:buffer'

if (process.argv.length <= 2) {
  throw new Error('Needs exactly one argument (gzipped and b64 encoded string) to decode.')
}
const encoded = process.argv[2]

const b64Decoded = Buffer.from(encoded, 'base64')
const unzipped = gunzipSync(b64Decoded)
const parsed = JSON.parse(unzipped.toString('utf-8'))

console.info('✅ Sucessfully decoded: ')
console.info(JSON.stringify(parsed, null, 2))
