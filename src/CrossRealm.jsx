import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('https://crossrealm-server.onrender.com');

const REALMS = {
  GEAR:    { name: '歯車', color: '#B8860B' },
  ICEAGE:  { name: '氷河期', color: '#ADD8E6' },
  FOUNTAIN:{ name: '噴水', color: '#00BFFF' },
  BATTERY: { name: 'バッテリー', color: '#FFFF00' },
  MACHINE: { name: '機械', color: '#00FF7F' },
  ARCHIVE: { name: '古文書', color: '#DEB887' },
  PLANET:  { name: '惑星', color: '#FFFACD', isWild: true },
  RUINS:   { name: '廃墟', color: '#696969', isWild: true }
};

const CrossRealm = () => {
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [fieldCard, setFieldCard] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [isMyTurn, setIsMyTurn] = useState(false);

  useEffect(() => {
    socket.on('init-game', (data) => {
      setMyHand(data.hand);
      setFieldCard(data.fieldCard);
      setIsMyTurn(data.isMyTurn);
    });

    socket.on('update-game', (data) => {
      setFieldCard(data.fieldCard);
      setIsMyTurn(socket.id === data.currentTurnPlayerId);
    });

    return () => {
      socket.off('init-game');
      socket.off('update-game');
    };
  }, []);

  // ★ルール判定ロジック
  const canPlay = (card) => {
    if (!isMyTurn) return false;
    if (card.realm === 'PLANET' || card.realm === 'RUINS') return true; // ワイルドカード
    if (card.realm === fieldCard.realm) return true; // 属性一致
    if (card.number === fieldCard.number) return true; // 数字一致
    return false;
  };

  const playCard = (card) => {
    if (!canPlay(card)) return alert("そのカードは出せません！");
    
    setMyHand(myHand.filter(c => c.id !== card.id));
    socket.emit('play-card', { roomId, card });
    setIsMyTurn(false);
  };

  // ... (JSX部分は元のコードをベースに、isMyTurnの表示やcanPlayによるスタイルの変化を追加)
  return (
    <div style={{ backgroundColor: '#1a1a1a', minHeight: '100vh', color: 'white', textAlign: 'center' }}>
      <h1>Cross Realm Online</h1>
      {!isJoined ? (
        <div>
           <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="合言葉" />
           <button onClick={() => { socket.emit('join-room', roomId); setIsJoined(true); }}>入室</button>
        </div>
      ) : (
        <div>
          <h2>{isMyTurn ? "あなたの番です！" : "相手の番を待っています..."}</h2>
          {fieldCard && (
            <div style={{ background: REALMS[fieldCard.realm].color, width: 100, height: 150, margin: 'auto', color: '#000' }}>
              {REALMS[fieldCard.realm].name}<br />{fieldCard.number}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 50 }}>
            {myHand.map(card => (
              <div 
                key={card.id} 
                onClick={() => playCard(card)}
                style={{ 
                  background: REALMS[card.realm].color, 
                  opacity: canPlay(card) ? 1 : 0.5, 
                  cursor: canPlay(card) ? 'pointer' : 'not-allowed',
                  width: 80, height: 120, margin: 5, color: '#000'
                }}
              >
                {REALMS[card.realm].name}<br />{card.number}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossRealm;

