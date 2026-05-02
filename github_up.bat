cd /d J:\制作データ\ツール\crossrealm_test
pause
call npx vite build --config vite.config.js
xcopy /S /E /Y J:\制作データ\ツール\crossrealm_test J:\制作データ\ツール\crossrealm
cd /d J:\制作データ\ツール\crossrealm
git add .
git commit -m "レイアウト調整、サイクル図仕様調整、プレイヤーHUB使用調整"
git pull origin main
git push --force origin main
echo "アップロード完了"
pause