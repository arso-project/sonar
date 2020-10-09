#!/usr/bin/env sh

# dev-link.sh
#
# link main packages globally with yarn

# this links all bins to 
# $HOME/.yarn/bin, which
# which likely is in your $PATH.
# if not, add it to your .bashrc or .zshrc
for PACKAGE in sonar-client sonar-ui sonar-server sonar-core
do
  cd $PACKAGE
  yarn link
  cd ..
done
