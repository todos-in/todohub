import * as core from '@actions/core'
import * as github from '@actions/github'
import Repo from './github-repo.js'
import { getCached } from './cache.js'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  core.info(JSON.stringify(process.env));
  core.info(JSON.stringify(github.context));

  const context = github.context;
  const githubToken = core.getInput('token');
  const ref = github.context.ref;
  const branchName = github.context.ref.split('/').pop() || '';
  const featureBranchRegex = /^(?<featureBranch>[0-9]+)-.*/;
  const featureBranchNumber = branchName.match(featureBranchRegex)?.[0];
  const isFeatureBranch = featureBranchNumber !== undefined;

  // TODO check what happens for deleted branches?
  const commitSha = context.sha;

  const repo = new Repo(githubToken, context.repo.owner, context.repo.repo);

  const cachedState = await getCached(context.repo.owner, context.repo.repo);
  if (!cachedState) {
    const mainState = await repo.downloadTarball(commitSha);
    core.info(JSON.stringify(mainState));
  }

  try {

    // const git = new Git(process.cwd())
    // const githubSha = core.getInput('GITHUB_SHA')
    // const githubRef = core.getInput('GITHUB_REF')
    // const changes = await git.getFileChanges(`c251b72921dc4b2539c719cdf601747d670c17c3`, `046947fc365048be81222b4eb2e5ac802b51aba1`)

    // const changes = await git.getFileChanges(`c251b72921dc4b2539c719cdf601747d670c17c3`, githubSha)

    await new Promise((resolve) => setTimeout(resolve, 6000));
    // const newIssue = await repo.createIssue('Test issue', 'Test issue body');

    // core.debug(newIssue.data.url)

    // core.setOutput('new-issue', newIssue.data.url)
  } catch (error) {
    // if (error instanceof Error) core.setFailed(error.message)
    // else core.setFailed('Something bad happened')
  }
}
