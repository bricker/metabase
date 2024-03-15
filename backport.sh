git reset HEAD~1
rm ./backport.sh
git cherry-pick 5b72f4d4eb0e9650f5013b0cb682ef4f7b3cfde0
echo 'Resolve conflicts and force push this branch'
