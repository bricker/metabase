git reset HEAD~1
rm ./backport.sh
git cherry-pick caa50d98c604fd7ca4b24e8abcddc1ed59a927d5
echo 'Resolve conflicts and force push this branch'
