import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// サーバーのURL（開発時はlocalhost、公開後はRender等のURL）
const socket = io('http://localhost:3000');

const REALMS = {
  GEAR:    { id: 'gear',    name: '歯車', color: '#B8860B', next: 'ICEAGE' },
  ICEAGE:  { id: 'iceage',  name: '氷河期', color: '#ADD8E6', transition: ['gear', 'fountain'] },
  FOUNTAIN:{ id: 'fountain',name: '噴水', color: '#00BFFF', next: 'BATTERY' },
  BATTERY: { id: 'battery', name: 'バッテリー', color: '#FFFF00', transition: ['fountain', 'machine'] },
  MACHINE: { id: 'machine', name: '機械', color: '#00FF7F', next: 'ARCHIVE' },
  ARCHIVE: { id: 'archive', name: '古文書', color: '#DEB887', transition: ['machine', 'gear'] },
  PLANET:  { id: 'planet',  name: '惑星', color: '#FFFACD', isWild: true },
  RUINS:   { id: 'ruins',   name: '廃墟', color: '#696969', isWild: true }
};

const CrossRealm = () => {
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [fieldCard, setFieldCard] = useState({ realm: 'gear', number: 5 });
  const [myHand, setMyHand] = useState([
    { id: 101, realm: 'gear', number: 0, label: 'ドロー2' },
    { id: 102, realm: 'iceage', number: 9, label: '氷河期' },
    { id: 103, realm: 'planet', number: 10, label: '惑星' },
    { id: 104, realm: 'machine', number: 7, label: 'リバース' }
  ]);

  // --- 通信イベントの設定 ---
  useEffect(() => {
    // 相手がカードを出した時に更新
    socket.on('opponent-played', (newCard) => {
      setFieldCard(newCard);
      // ここでDTMで作った「カードを置くSE」を鳴らす
    });

    return () => {
      socket.off('opponent-played');
    };
  }, []);

  // --- 入室処理 ---
  const joinRoom = () => {
    if (roomId) {
      socket.emit('join-room', roomId);
      setIsJoined(true);
    }
  };

  // --- 出せるか判定ロジック ---
  const canPlay = (card) => {
    // 惑星・廃墟などのワイルドカード
    if (REALMS[card.realm.toUpperCase()].isWild) return true;

    // 遷移カード（氷河期・バッテリー・古文書）の判定
    const config = REALMS[card.realm.toUpperCase()];
    if (config.transition) {
      return fieldCard.realm === config.transition[0]; // 元の属性が合っていればOK
    }

    // 通常：属性一致 or 数字一致
    return card.realm === fieldCard.realm || card.number === fieldCard.number;
  };

  // --- カードを出す実行 ---
  const playCard = (card) => {
    if (!canPlay(card)) {
      alert("そのカードは今は出せません！");
      return;
    }

    let nextCard = { ...card };
    // 遷移カードの場合、場を強制的に次の属性に変える
    const config = REALMS[card.realm.toUpperCase()];
    if (config.transition) {
      nextCard.realm = config.transition[1];
    }

    // 自分の画面を更新
    setFieldCard(nextCard);
    setMyHand(myHand.filter(c => c.id !== card.id));

    // 相手の画面を更新するために送信
    socket.emit('play-card', { roomId, card: nextCard });
  };

  // --- UI: 入室画面 ---
  if (!isJoined) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', backgroundColor: '#121212', color: '#eee', height: '100vh' }}>
        <h2>Cross Realm - オンライン接続 -</h2>
        <input 
          style={{ padding: '10px', borderRadius: '5px', border: 'none' }}
          placeholder="合言葉を入力" 
          value={roomId} 
          onChange={(e) => setRoomId(e.target.value)} 
        />
        <button onClick={joinRoom} style={{ padding: '10px 20px', marginLeft: '10px', cursor: 'pointer' }}>入室</button>
      </div>
    );
  }

  // --- UI: メインゲーム画面 ---
  return (
    <div style={{ backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Room: {roomId}</span>
        <span>残り手札: {myHand.length}</span>
      </header>

      <main style={{ textAlign: 'center', marginTop: '50px' }}>
        <p>場の世界</p>
        <div style={{
          display: 'inline-block', width: '120px', height: '180px',
          backgroundColor: REALMS[fieldCard.realm.toUpperCase()].color,
          borderRadius: '12px', border: '3px solid #fff',
          color: '#000', fontWeight: 'bold', paddingTop: '40px'
        }}>
          <div style={{ fontSize: '1.2em' }}>{REALMS[fieldCard.realm.toUpperCase()].name}</div>
          <div style={{ fontSize: '3em' }}>{fieldCard.number}</div>
        </div>
      </main>

      <footer style={{ position: 'fixed', bottom: '20px', width: '100%', left: 0, textAlign: 'center' }}>
        <p>あなたの手札</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {myHand.map(card => (
            <div
              key={card.id}
              onClick={() => playCard(card)}
              style={{
                width: '70px', height: '100px', cursor: 'pointer',
                backgroundColor: REALMS[card.realm.toUpperCase()].color,
                borderRadius: '8px', color: '#000', fontSize: '0.8em',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                boxShadow: canPlay(card) ? '0 0 10px #fff' : 'none',
                opacity: canPlay(card) ? 1 : 0.5
              }}
            >
              <b>{REALMS[card.realm.toUpperCase()].name}</b>
              <span style={{ fontSize: '1.5em' }}>{card.number}</span>
              <small>{card.label}</small>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default CrossRealm;
