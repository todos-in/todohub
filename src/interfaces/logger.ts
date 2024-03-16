export interface Logger {
  debug: (log: string) => void
  info: (log: string) => void
  warning: (log: string) => void
  error: (log: string | Error) => void
  startGroup: (name: string) => void
  endGroup: () => void
}
