# Todohub: Manages the TODOs you won't

* Helps establishing good TODO practices (tag them with an issue number!)
* Adds tagged TODOs into their respective issues and makes sure they won't be forgotten
* Helps manage untagged TODOs that are left in your code

---

[![Self](https://github.com/todos-in/todohub/actions/workflows/todohub.yml/badge.svg)](https://github.com/todos-in/todohub/actions/workflows/todohub.yml)
[![Tests](https://github.com/todos-in/todohub/actions/workflows/test.yml/badge.svg)](https://github.com/todos-in/todohub/actions/workflows/test.yml)
[![Check build](https://github.com/todos-in/todohub/actions/workflows/check-dist.yml/badge.svg)](https://github.com/todos-in/todohub/actions/workflows/check-dist.yml)
[![Coverage](./badges/coverage.svg)](./coverage)

---

## Usage

### Use as a github action:

* Set up the workflow by adding a file `.github/workflows/todohub.yml`:
```
name: Todohub Workflow
on: [push, pull_request]

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  todohub-job:
    runs-on: ubuntu-latest
    steps:
      - name: Todohub
        id: todohub
        uses: todos-in/todohub@main
```

## Eslint Plugin

This Project contains an eslint plugin help you manage local TODOs in your codebase. To use it, install:
```
npm i --save-dev eslint-plugin-todohub
```

> [!NOTE]
> This documentation shows how to config eslint using an `.eslintrc.yml` config file.
> There are multiple ways to config eslint, please refer to [eslint](https://eslint.org/docs/latest/use/configure/) to find the suitable configuration for your project.

Add `todohub` to your eslint plugins section, and enable the recommended rule set:
```
//.eslintrc.yml
[...]
plugins:
   - todohub

extends:
  - plugin:todohub/recommended
[...]
```
<details>

<summary>Advanced Configuration</summary>

The plugin features two rules, which can also be configured individually:
1. `todohub/no-todos-without-issue-ref`: Hints towards All Todos in codebase which do not have an issue number reference (such as `TODO #1`). Keeps track of potentially lost Todos. (Recommended to turn on, and set to `error`)
1.  `todohub/current-feature-branch-issues`: Checks if you are in a feature branch currently and hints towards all open TODOs referencing the current feature branch. Useful to keep track of what you are currently working on. (Recommended to set to `warn`)

```
//.eslintrc.yml
rules:
  {
    'todohub/no-todos-without-issue-ref': 'error',
    'todohub/current-feature-branch-issues': 'warn',
   ...
  }
```

</details>

## Development & Testing
1. :hammer_and_wrench: Installing

   ```bash
   npm install
   ```

1. :building_construction: Building

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Testing

   ```bash
   $ npm run test
   ```


## Publishing a New Release

This project includes a helper script, [`script/release`](./script/release)
designed to streamline the process of tagging and pushing new releases for
GitHub Actions.

GitHub Actions allows users to select a specific version of the action to use,
based on release tags. This script simplifies this process by performing the
following steps:

1. **Retrieving the latest release tag:** The script starts by fetching the most
   recent release tag by looking at the local data available in your repository.
1. **Prompting for a new release tag:** The user is then prompted to enter a new
   release tag. To assist with this, the script displays the latest release tag
   and provides a regular expression to validate the format of the new tag.
1. **Tagging the new release:** Once a valid new tag is entered, the script tags
   the new release.
1. **Pushing the new tag to the remote:** Finally, the script pushes the new tag
   to the remote repository. From here, you will need to create a new release in
   GitHub and users can easily reference the new tag in their workflows.
