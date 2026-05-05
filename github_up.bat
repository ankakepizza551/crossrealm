@echo off
setlocal enabledelayedexpansion

:: ======================================================================
:: 設定エリア
:: ======================================================================
set "SRC_DIR=J:\制作データ\ツール\crossrealm_test"
set "DEST_DIR=J:\制作データ\ツール\crossrealm"
set "BK_BASE_DIR=J:\制作データ\ツール\crossrealm_bk"

:: 実行時にコミットメッセージを入力させる（何も入力せずEnterを押した場合は自動メッセージ）
set /p COMMIT_MSG="今回のコミットメッセージを入力してください: "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=自動コミット: %date% %time%"

:: バックアップフォルダの作成
if not exist "%BK_BASE_DIR%" mkdir "%BK_BASE_DIR%"

:: タイムスタンプ取得 (ファイル名に使用)
for /f "usebackq tokens=*" %%i in (`powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set "TIMESTAMP=%%i"

echo ======================================================================
echo [1/4] 実行前バックアップを作成中 (crossrealm -^> crossrealm_bk)
echo ======================================================================
powershell -Command "$files = Get-ChildItem '%DEST_DIR%' | Where-Object { $_.Name -ne 'node_modules' -and $_.Name -ne '.git' }; if ($files) { $files | Compress-Archive -DestinationPath '%BK_BASE_DIR%\crossrealm_pre_%TIMESTAMP%.zip' -Force } else { Write-Host 'No files found to backup.' }"

echo.
echo ======================================================================
echo [2/4] テスト環境でビルドを実行し、本番環境へ同期します
echo ======================================================================
cd /d "%SRC_DIR%"
call npx vite build --config vite.config.js

:: /E を /MIR に変更し、テスト環境で削除されたファイルも同期先に反映させる
robocopy "%SRC_DIR%" "%DEST_DIR%" /MIR /XD node_modules .git .backups old scratch

echo.
echo ======================================================================
echo [3/4] GitHubへプッシュします
echo ======================================================================
cd /d "%DEST_DIR%"
git add .
:: 直書きではなく、入力した変数を使うように変更
git commit -m "%COMMIT_MSG%"
git pull --no-edit origin main
git push origin main

echo.
echo ======================================================================
echo [4/4] 実行後バックアップを作成中 (crossrealm -^> crossrealm_bk)
echo ======================================================================
powershell -Command "$files = Get-ChildItem '%DEST_DIR%' | Where-Object { $_.Name -ne 'node_modules' -and $_.Name -ne '.git' }; if ($files) { $files | Compress-Archive -DestinationPath '%BK_BASE_DIR%\crossrealm_post_%TIMESTAMP%.zip' -Force } else { Write-Host 'No files found to backup.' }"

echo.
echo ======================================================================
echo 全工程が完了しました。
echo バックアップ先: %BK_BASE_DIR%
echo ======================================================================
pause