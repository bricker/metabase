git reset HEAD~1
rm ./backport.sh
git cherry-pick 918878ebd266a821b71d7194138cc6daa2fd4271
echo 'Resolve conflicts and force push this branch'
