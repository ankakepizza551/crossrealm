const { spawn, execSync } = require('child_process');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

console.log('==========================================');
console.log('   Cross Realm Local Server Launcher');
console.log('==========================================');
console.log('');
console.log('[1] サーバーのみ起動 (ビルド済み環境)');
console.log('[2] フロントエンドをビルドしてから起動');
console.log('[3] 開発モードで起動 (Backend + Frontend 同時起動/スマホテスト用)');
console.log('[4] ポート3000をリセット (エラー EADDRINUSE の場合)');
console.log('');

rl.question('選択してください (1, 2, 3, 4): ', (choice) => {
    if (choice === '1') {
        console.log('\nサーバーを起動しています...');
        spawn('node', ['index.js'], { stdio: 'inherit', shell: true });
    } else if (choice === '2') {
        console.log('\nフロントエンドをビルドしています...');
        execSync('npm run build', { stdio: 'inherit', shell: true });
        console.log('\nサーバーを起動しています...');
        spawn('node', ['index.js'], { stdio: 'inherit', shell: true });
    } else if (choice === '3') {
        const ip = getLocalIP();
        console.log('\n=== ローカルIPアドレスの確認 ===');
        console.log(`PCのIPアドレス: ${ip}`);
        console.log(`スマホからアクセスする場合: http://${ip}:5173`);
        console.log('==============================\n');
        console.log('開発モードを起動します。');
        console.log('※バックエンド(3000)とフロントエンド(5173)が別窓で開きます。\n');
        
        // 別窓で起動 (Windows)
        spawn('cmd', ['/c', 'start', 'node', 'index.js'], { stdio: 'inherit', shell: true });
        spawn('cmd', ['/c', 'start', 'npm', 'run', 'dev', '--', '--host'], { stdio: 'inherit', shell: true });
        
        console.log('起動コマンドを送信しました。別ウィンドウを確認してください。');
        setTimeout(() => process.exit(), 2000);
    } else if (choice === '4') {
        console.log('\nポート3000を使用中のプロセスを探しています...');
        try {
            const output = execSync('netstat -aon | findstr :3000 | findstr LISTENING', { encoding: 'utf8' });
            const pid = output.trim().split(/\s+/).pop();
            console.log(`PID: ${pid} を終了しています...`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'inherit', shell: true });
            console.log('リセットが完了しました。再度起動を試してください。');
        } catch (e) {
            console.log('ポート3000を使用中のプロセスは見つかりませんでした。');
        }
        setTimeout(() => process.exit(), 2000);
    } else {
        console.log('無効な選択です。');
        process.exit();
    }
});
