// サーバー側 (index.js) の主要な変更点
// handlePlayerAction 内でドボン時に status = 'finished' にするのではなく、
// player.isEliminated = true に設定し、生存者が1人になったら終了するようにします。

function nextTurn(room, skip = false) {
  const step = room.isReversed ? -1 : 1;
  const count = skip ? 2 : 1;
  
  // 生存しているプレイヤー（isEliminatedでない）が見つかるまでスキップを繰り返す
  let nextIdx = room.turnIndex;
  for (let i = 0; i < room.players.length; i++) {
    nextIdx = (nextIdx + step + room.players.length) % room.players.length;
    if (!room.players[nextIdx].isEliminated) {
      room.turnIndex = nextIdx;
      break;
    }
  }
}

// ドロー後のチェック
if (player.hand.length >= 10) {
    player.isEliminated = true;
    room.logs.push({ id: Math.random(), text: `警告: ${player.name} が臨界突破。戦線から脱落しました。` });
    
    // 生存者確認
    const survivors = room.players.filter(p => !p.isEliminated);
    if (survivors.length <= 1) {
        room.status = 'finished';
        room.logs.push({ id: Math.random(), text: `ミッション終了。生存者: ${survivors[0]?.name || 'なし'}` });
    } else {
        nextTurn(room);
    }
}
