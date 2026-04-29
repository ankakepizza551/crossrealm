@echo off
title Cross Realm Local Server
echo ==========================================
echo   Cross Realm Local Server Starter
echo ==========================================
echo.
echo [1] サーバーを起動
echo [2] フロントエンドをビルドしてから起動
echo [3] ポート3000をリセット (エラー EADDRINUSE の場合)
echo.
set /p choice="選択してください (1, 2, 3): "

if "%choice%"=="1" (
    echo.
    echo サーバーを起動しています...
    node index.js
) else if "%choice%"=="2" (
    echo.
    echo フロントエンドをビルドしています...
    call npm run build
    echo.
    echo サーバーを起動しています...
    node index.js
) else if "%choice%"=="3" (
    echo.
    echo ポート3000を使用中のプロセスを探しています...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
        echo PID: %%a を終了しています...
        taskkill /F /PID %%a
    )
    echo リセットが完了しました。再度起動を試してください。
) else (
    echo 無効な選択です。
)

pause
