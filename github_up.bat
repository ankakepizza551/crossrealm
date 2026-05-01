cd /d J:\制作データ\ツール\crossrealm_test
pause
npx vite build --config vite.config.js
pause
xcopy /S /E /Y J:\制作データ\ツール\crossrealm_test J:\制作データ\ツール\crossrealm
cd /d J:\制作データ\ツール\crossrealm
pause
git add .
git commit -m "レイアウト調整、サイクル図仕様調整、プレイヤーHUB使用調整"
git pull origin main
git push --force origin main
pause