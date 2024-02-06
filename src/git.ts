import * as git from 'isomorphic-git'
import * as fs from 'fs'

type gitDefaults = {
  fs: git.CallbackFsClient | git.PromiseFsClient
  dir: string
}

export class Git {
  private dir: string
  private fs: git.CallbackFsClient | git.PromiseFsClient

  constructor(dir: string) {
    this.dir = dir
    this.fs = fs
  }

  private getDefaults<T>(parameters: T): T & gitDefaults {
    const defaults = { dir: this.dir, fs: this.fs }
    return Object.assign(defaults, parameters)
  }

  async getFileChanges(commitHashA: string, commitHashB: string) {
    const map: git.WalkerMap = async (filepath, [A, B]) => {
      // ignore directories
      if (filepath === '.') {
        return
      }
      if (
        !A ||
        !B ||
        (await A.type()) === 'tree' ||
        (await B.type()) === 'tree'
      ) {
        return
      }

      // generate ids
      const aOid = await A.oid()
      const bOid = await B.oid()

      // determine modification type
      let type = 'equal'
      if (aOid !== bOid) {
        type = 'modify'
      }
      if (aOid === undefined) {
        type = 'add'
      }
      if (bOid === undefined) {
        type = 'remove'
      }

      return {
        path: `/${filepath}`,
        type: type
      }
    }

    return git.walk(
      this.getDefaults({
        trees: [git.TREE({ ref: commitHashA }), git.TREE({ ref: commitHashB })],
        map
      })
    )
  }
}
