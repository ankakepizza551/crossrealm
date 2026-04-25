// ... 既存のコードの冒頭部分 ...

// CPUを追加する処理
socket.on('add-cpu', (data) => {
  const room = rooms[data.roomId];
  if (room && room.status === 'waiting' && room.players.length < 4) {
    const cpuId = `CPU_${Math.random().toString(36).substr(2, 9)}`;
    const cpuPlayer = {
      id: cpuId,
      name: `CPU_${room.players.length}`,
      hand: [],
      handCount: 0,
      isBot: true // ボットフラグ
    };
    room.players.push(cpuPlayer);
    emitUpdate(data.roomId);
  }
});

// ボットの思考ロジック（簡易版）
function handleBotAction(roomId, cpuId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== cpuId) return;

  const bot = room.players[room.turnIndex];
  
  // 出せるカードを探すロジック（簡略化のためクライアント側の canPlay 相当をサーバーでも判定）
  const playableCards = bot.hand.filter(card => {
    // ドロー攻撃を受けている時
    if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
    
    const field = room.fieldCard.realm;
    const h = card.realm;
    if (h === 'PLANET' || h === 'RUINS') return true;
    if (field === 'PLANET' || field === 'RUINS') return true;
    if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
    
    // サイクル判定
    const cycle = { GEAR:['GEAR','ICEAGE'], ICEAGE:['FOUNTAIN','BATTERY'], FOUNTAIN:['FOUNTAIN','BATTERY'], 
                    BATTERY:['MACHINE','ARCHIVE'], MACHINE:['MACHINE','ARCHIVE'], ARCHIVE:['GEAR','ICEAGE'] };
    return cycle[field]?.includes(h);
  });

  // 1.5秒の「思考時間」を演出して行動
  setTimeout(() => {
    if (playableCards.length > 0) {
      // 優先順位: 特殊カード(S) > 通常カード
      const targetCard = playableCards.find(c => c.isSpecial) || playableCards[0];
      
      // ワイルドカードの場合は次のサイクル属性をランダムに選択
      let chosenRealm = undefined;
      if (targetCard.realm === 'PLANET' || targetCard.realm === 'RUINS' || (targetCard.realm === 'FOUNTAIN' && targetCard.isSpecial)) {
        chosenRealm = ['GEAR', 'FOUNTAIN', 'MACHINE'][Math.floor(Math.random() * 3)];
      }
      
      // カードをプレイ（既存の play-card ロジックを流用）
      // ... (ここにカードプレイの内部処理を記述)
    } else {
      // 出せるカードがないならドロー（既存の draw-card ロジックを流用）
      // ... (ここにドローの内部処理を記述)
    }
    emitUpdate(roomId);
  }, 1500);
}

// emitUpdate内で現在のターンがボットなら思考を開始させる
function emitUpdate(roomId) {
  const room = rooms[roomId];
  io.to(roomId).emit('update-game', room);
  
  const currentPlayer = room.players[room.turnIndex];
  if (room.status === 'playing' && currentPlayer && currentPlayer.isBot) {
    handleBotAction(roomId, currentPlayer.id);
  }
}
