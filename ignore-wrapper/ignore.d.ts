declare class Ignore {
  add(pattern: string): Ignore
  ignores(path: string): boolean;
}

declare function ignoreWrapper(): Ignore

export {ignoreWrapper, Ignore};