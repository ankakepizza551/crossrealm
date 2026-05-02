cd /d J:\制作データ\ツール\crossrealm_test
call npx vite build --config vite.config.js

:: node_modules と .git フォルダを除外して、distやソースコードをすべて上書きコピー
robocopy J:\制作データ\ツール\crossrealm_test J:\制作データ\ツール\crossrealm /E /XD node_modules .git

cd /d J:\制作データ\ツール\crossrealm
git add .
git commit -m "演出系処理競合修正"
git pull --no-edit origin main
git push origin main

echo アップロード完了
pause