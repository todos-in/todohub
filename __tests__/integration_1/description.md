* Push to **default branch**
* No existing todohub control issue found (needs to be initiated)
* repo contains
  * contains multiple TODOs
    * in **different formatting** (with/without hashtags/paranthesis)
    * for 3 different issues
    * 1 **stray TODO** without issue reference
  * `.todoignore` file which **ignores one file** with TODO
    * -> TODO which references issue 5 should be ignored
* one feature branch exists
  * **feature branch 2 is ahead of main**
  * -> TODO which references issue 2 should be skipped
