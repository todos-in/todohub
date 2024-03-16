import { Octokit } from 'octokit'
import * as github from '@actions/github'
import { OctokitGetter } from '../interfaces/octokit.js'

export const ActionOctokitGetter: OctokitGetter = (token: string, options: object) => github.getOctokit(token, options) as Octokit

export const PersonalAccessTokenOctokitGetter: OctokitGetter = (token: string, _options: object) => {
  return new Octokit({
    token,
    type: 'token',
    tokenType: 'oauth',
  })
}