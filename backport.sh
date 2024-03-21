git reset HEAD~1
rm ./backport.sh
git cherry-pick 0eb75595bd2a67b259c9ceb96c3dd1f895877c9c
echo 'Resolve conflicts and force push this branch'
