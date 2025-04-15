# github-actions
Holds shared github actions used by Evolv

## To update
1. We need to merge the node_modules because of the way actions work.
```
cd ./cherry-picker/node_modules
git add -A -f .
cd ../../get-refs/node_modules
git add -A -f .
cd ../../most-recent-tag/node_modules
git add -A -f .
cd ../../semver-bump-tag/node_modules
git add -A -f .
cd ../../set-variables/node_modules
git add -A -f .
``` 

2. Test the changes
One option is to push the branch, then point a github actions file at that branch

3. Commit the changes
Commit, merge, pull latest master

4. Replace the latest tag
```
git tag -d latest
git push origin --delete tag latest
git tag latest
git push --tags
```
