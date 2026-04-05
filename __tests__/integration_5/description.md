* Push to **default branch**
* **Existing todohub control issue** with id 200
  * contains pre, mid and post tag text
  * contains datatag with several existing TODOs for issue #5
* repo contains
  * seven files with one or two TODOs each, all referencing issue #5
  * no `.todoignore`
* Tests **reconciliation of changed TODOs** (stages changes):
  * **Exact match**: TODO unchanged in same file and line → preserved with original `foundInCommit`
  * **Similarity match (text changed)**: TODO text slightly modified → updated, `foundInCommit` preserved
  * **Similarity match (file renamed)**: TODO moved to a different file → updated, `foundInCommit` preserved
  * **Similarity match (line moved)**: TODO moved to a different line in same file → updated, `foundInCommit` preserved
  * **Removed TODO**: TODO no longer in repo → marked as done with `doneInCommit`
  * **Too-much-altered TODO**: TODO text changed beyond recognition → old marked done, new added as fresh
  * **Brand new TODOs**: TODOs not in previous state → added with current `foundInCommit`
  * **Previously done TODO**: Already-done TODO preserved in output
  * **Ambiguous similar TODOs (best-match removal)**: Multiple similar TODOs existed; one was removed, others slightly changed → best match for the removed one is found and marked as done, while the others are updated with `foundInCommit` preserved
