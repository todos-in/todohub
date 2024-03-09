import { Transform } from 'stream'

export class SplitLineStream extends Transform {
  private lineSoFar?: string

  constructor() {
    super({ objectMode: true })
  }

  _transform(chunk: Buffer, encoding: BufferEncoding | undefined, next: () => void) {
    const lines = this.splitChunkIntoLines((this.lineSoFar || '') + chunk.toString())
    this.lineSoFar = lines.pop()

    for (const line of lines) {
      this.push(line)
    }
    next()
  }

  _flush(done: () => void) {
    this.push(this.lineSoFar || '')
    done()
  }

  private splitChunkIntoLines(chunk: string) {
    return chunk.split(/\r?\n/)
  }
}
