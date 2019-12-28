## Release docs

How to make a release and publish on npm:

1) Run all tests from the repo root:
   `npm run test`
2) Run all tests again
3) Delete all `package-lock.json` files: (see [^1])
   `rm sonar-*/package-lock.json`
4) Use lerna publish:
   `lerna publish major|minor|patch`

That should be it!

[^1]: We don't want to have them in the repo at the moment (this should change maybe once things stabilize, but for now its more of a hazzle) - however, lerna wants to add the files should they be there which doesnt work if they're in the .gitgnore file.
