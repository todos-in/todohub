import { Octokit } from 'octokit'

export type OctokitGetter = (token: string, options: object) => Octokit
