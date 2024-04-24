import { fileURLToPath } from 'url'
import path from 'node:path'

export function dirname(url: string | URL) {
  const filename = fileURLToPath(url)
  return path.dirname(filename)
}

export function relativeFilePath(url: string | URL, ...pathSegments: string[]) {
  return path.join(dirname(url), ...pathSegments)
}