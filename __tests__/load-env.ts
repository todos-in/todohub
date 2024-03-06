import fs from 'node:fs'
import path from 'node:path'

export const load = (file?: string, additionalEnv?: Record<string, string>) => {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, file || './.test.env.json'), 'utf8')
    const parsedFile = JSON.parse(envFile) as Record<string, string>
  
    for (const [key, value] of Object.entries(parsedFile)) {
      process.env[key] = value
    }
    for (const [key, value] of Object.entries(additionalEnv || {})) {
      process.env[key] = value
    }
  } catch (err) {
    console.warn('Could not set environment variables')
  }

}
