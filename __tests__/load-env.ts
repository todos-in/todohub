import fs from 'node:fs'
import { assertError } from 'src/error.js'

export const load = (file: string, additionalEnv?: Record<string, string>) => {
  try {
    const envFile = fs.readFileSync(file, 'utf8')
    const parsedFile = JSON.parse(envFile) as Record<string, string>
  
    for (const [key, value] of Object.entries(parsedFile)) {
      process.env[key] = value
    }
    for (const [key, value] of Object.entries(additionalEnv || {})) {
      process.env[key] = value
    }
  } catch (err) {
    assertError(err)
    console.warn('Could not set environment variables: ' + err.message)
  }
}
