#!/bin/sh

git checkout core-refactor
git branch -D renames
git checkout -b renames

ambr --no-interactive @arso-project/sonar- @arsonar/
ambr --no-interactive @arsonar/tantivy @arso-project/sonar-tantivy
git checkout -f HEAD -- scripts
git add -u
git commit -m "rename: @arso-project/sonar-* to @arsonar/*"

rm -r packages
mkdir packages

git mv sonar-bots/ packages/bots
git mv sonar-cli/ packages/cli
git mv sonar-client/ packages/client
git mv sonar-common/ packages/common
git mv sonar-core/ packages/core
git mv sonar-server/ packages/server
git mv sonar-ui/ packages/ui
git mv sonar-view-relations/ packages/view-relations

git commit -m "rename: move modules into packages/"

ambr --no-interactive "tape */test/*.js" "tape packages/*/test/*.js"

git checkout -f HEAD -- scripts
git add -u
git commit -m "rename: fix test script"
