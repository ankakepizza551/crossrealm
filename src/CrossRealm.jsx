import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// ★ここを自分のRenderのURLに書き換えてください
const socket = io('https://crossrealm-server.onrender.com');

const REALMS = {
  GEAR:    { id: 'gear',    name: '歯車', color: '#B8860B' },
  ICEAGE:  { id: 'iceage',  name: '氷河期', color: '#ADD8E6' },
  FOUNTAIN:{ id: 'fountain',name: '噴水', color: '#00BFFF' },
  BATTERY: { id: 'battery', name: 'バッテリー', color: '#FFFF00' },
  MACHINE: { id: 'machine', name: '機械', color: '#00FF7F' },
  ARCHIVE: { id: 'archive', name: '古文書', color: '#DEB887' },
  PLANET:  { id: 'planet',  name: '惑星', color: '#FFFACD' },
  RUINS:   { id: 'ruins',   name: '廃墟', color: '#696969' }
};

const CrossRealm = () => {
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [fieldCard, setFieldCard] = useState({ realm: 'GEAR', number: 5 });
  const [myHand, setMyHand] = useState([
    { id: 1, realm: 'GEAR', number: 3 },
    { id: 2, realm: 'ICEAGE', number: 7 },
    { id: 3, realm: 'PLANET', number: 0 },
    { id: 4, realm: 'FOUNTAIN', number: 2 },
    { id: 5, realm: 'BATTERY', number: 8 },
  ]);

  useEffect(() => {
    socket.on('opponent-played', (newCard) => {
      setFieldCard(newCard);
    });
    return () => socket.off('opponent-played');
  }, []);

  const joinRoom = () => {
    if (roomId !== '') {
      socket.emit('join-room', roomId);
      setIsJoined(true);
    }
  };

  const playCard = (card) => {
    setFieldCard(card);
    setMyHand(myHand.filter(c => c.id !== card.id));
    socket.emit('play-card', { roomId, card });
  };

  return (
    <div style={{ backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Cross Realm Online</h1>

      {!isJoined ? (
        <div style={{ marginTop: '50px', padding: '30px', border: '1px solid #444', borderRadius: '15px', backgroundColor: '#222', display: 'inline-block' }}>
          <h3>対戦ロビー</h3>
          <input
            type="text"
            placeholder="合言葉を入力"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ padding: '12px', fontSize: '16px', borderRadius: '5px', border: 'none', width: '200px', marginBottom: '20px' }}
          />
          <br />
          <button 
            onClick={joinRoom}
            style={{ padding: '12px 40px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}
          >
            入室する
          </button>
        </div>
      ) : (
        <div>
          <p>ルームID: <strong>{roomId}</strong></p>
          <div style={{ margin: '40px 0' }}>
            <h3>場のカード</h3>
            <div style={{
              margin: '0 auto', width: '120px', height: '180px',
              backgroundColor: REALMS[fieldCard.realm.toUpperCase()].color,
              borderRadius: '12px', border: '4px solid #fff',
              color: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold'
            }}>
              <div style={{ fontSize: '1.2em' }}>{REALMS[fieldCard.realm.toUpperCase()].name}</div>
              <div style={{ fontSize: '3.5em' }}>{fieldCard.number}</div>
            </div>
          </div>

          <div style={{ marginTop: '50px' }}>
            <p>あなたの手札（クリックで出す）</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {myHand.map(card => (
                <div
                  key={card.id}
                  onClick={() => playCard(card)}
                  style={{
                    width: '80px', height: '120px', cursor: 'pointer',
                    backgroundColor: REALMS[card.realm.toUpperCase()].color,
                    borderRadius: '8px', color: '#000',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.5)', transition: 'transform 0.2s'
                  }}
                >
                  <b style={{ fontSize: '0.9em' }}>{REALMS[card.realm.toUpperCase()].name}</b>
                  <span style={{ fontSize: '2em' }}>{card.number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossRealm;
