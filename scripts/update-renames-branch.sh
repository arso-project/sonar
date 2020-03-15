#!/bin/sh
# this script auto-updates the "renames" branch on top of development.
#
# after running use 
#   git push -f origin renames` 
# to force push the updated branch
#
# needs amber (https://github.com/dalance/amber)

git checkout development
git branch -D renames
git checkout -b renames

# rename sonar-dat to sonar-core
git mv sonar-dat/ sonar-core/
ambr --no-interactive sonar-dat sonar-core sonar-*
git checkout -f HEAD -- scripts
git add -u .
git commit -m "rename sonar-dat to sonar-core"

# rename island to group
ambr --no-interactive island group .
ambr --no-interactive Island Group .
git checkout -f HEAD -- scripts
git mv sonar-cli/bin/island.js sonar-cli/bin/group.js
git mv sonar-core/lib/island.js sonar-core/lib/group.js
git mv sonar-ui/src/pages/Islands.js sonar-ui/src/Groups.js
git add -u .
git commit -m "rename island to group"
