import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// サーバーのURL（ご自身のRenderのURLに合わせて変更してください）
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
    // 初回入室時のデータ受信
    socket.on('init-game', (data) => {
      setMyHand(data.hand);
      setFieldCard(data.fieldCard);
      setIsMyTurn(data.isMyTurn);
    });

    // 誰かがカードを出した時の更新受信
    socket.on('update-game', (data) => {
      setFieldCard(data.fieldCard);
      // サーバーから送られてくる「現在のターンプレイヤーID」と自分のIDを比較
      setIsMyTurn(socket.id === data.currentTurnPlayerId);
    });

    return () => {
      socket.off('init-game');
      socket.off('update-game');
    };
  }, []);

  // カードが出せるかどうかの判定ロジック
  const canPlay = (card) => {
    if (!isMyTurn || !fieldCard) return false;
    
    // 出すカードまたは場のカードがワイルド属性なら出せる
    if (REALMS[card.realm].isWild || REALMS[fieldCard.realm].isWild) return true;
    
    // 属性（色）または数字が一致していれば出せる
    return card.realm === fieldCard.realm || card.number === fieldCard.number;
  };

  const playCard = (card) => {
    if (!canPlay(card)) return;

    // 手札から出すカードを除く
    const newHand = myHand.filter(c => c.id !== card.id);
    setMyHand(newHand);

    // サーバーへカードを提出
    socket.emit('play-card', {
      roomId: roomId,
      card: card
    });
  };

  return (
    <div style={{ 
      backgroundColor: '#1a1a1a', 
      minHeight: '100vh', 
      color: 'white', 
      textAlign: 'center',
      fontFamily: 'sans-serif',
      padding: '20px'
    }}>
      <h1>Cross Realm Online</h1>

      {!isJoined ? (
        <div style={{ marginTop: '50px' }}>
          <input 
            style={{ padding: '10px', borderRadius: '5px', border: 'none' }}
            value={roomId} 
            onChange={e => setRoomId(e.target.value)} 
            placeholder="合言葉を入力" 
          />
          <button 
            style={{ padding: '10px 20px', marginLeft: '10px', cursor: 'pointer' }}
            onClick={() => { 
              if (roomId) {
                socket.emit('join-room', roomId); 
                setIsJoined(true); 
              }
            }}
          >
            入室
          </button>
        </div>
      ) : (
        <div>
          <div style={{ 
            padding: '10px', 
            background: isMyTurn ? '#00FF7F' : '#333', 
            color: isMyTurn ? '#000' : '#fff',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}>
            {isMyTurn ? "あなたの番です！" : "相手の番を待っています..."}
          </div>

          {fieldCard && (
            <div>
              <p>場のカード</p>
              <div style={{ 
                background: REALMS[fieldCard.realm].color, 
                width: 100, height: 150, 
                margin: 'auto', 
                color: '#000',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                border: '4px solid white'
              }}>
                <span style={{ fontSize: '0.8em' }}>{REALMS[fieldCard.realm].name}</span>
                <span style={{ fontSize: '2.5em', fontWeight: 'bold' }}>{fieldCard.number}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '50px' }}>
            {myHand.map(card => (
              <div 
                key={card.id} 
                onClick={() => playCard(card)}
                style={{ 
                  background: REALMS[card.realm].color, 
                  opacity: canPlay(card) ? 1 : 0.4, 
                  cursor: canPlay(card) ? 'pointer' : 'not-allowed',
                  width: 80, height: 120,
                  color: '#000',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  transition: 'transform 0.2s',
                  border: '1px solid #000'
                }}
                onMouseEnter={(e) => canPlay(card) && (e.currentTarget.style.transform = 'translateY(-10px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span style={{ fontSize: '0.7em' }}>{REALMS[card.realm].name}</span>
                <span style={{ fontSize: '1.5em', fontWeight: 'bold' }}>{card.number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossRealm;
