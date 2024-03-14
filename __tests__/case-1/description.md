### Test case 1: Basic test

* Push to default branch
* No todohub control issue found (needs to be initiated)
* includes .todoignore file which ignores one file with todos
  * issue 5 should be ignored
* contains multiple TODOs
  * in different formatting
  * for 3 different issues
  * stray TODOs
* one feature branch exists
  * feature branch 2 is ahead of main, so issue 2 should be skipped
