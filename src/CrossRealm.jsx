// 修正ポイント：接続状態を管理する
const [isConnected, setIsConnected] = useState(false);

useEffect(() => {
  socket.on('connect', () => setIsConnected(true)); // 繋がったらOK
  
  // ...中略...
}, []);

// 表示部分
{!isJoined ? (
  <div>
    <p>{isConnected ? "✅ サーバー接続完了" : "⏳ サーバー起動中...(30秒ほどかかる場合があります)"}</p>
    <input 
      value={roomId} 
      onChange={e => setRoomId(e.target.value)} 
      placeholder="合言葉を決めて入力" 
    />
    <button onClick={() => { 
      if(roomId) {
        socket.emit('join-room', roomId); 
        setIsJoined(true);
      }
    }}>入室する</button>
  </div>
) : (
  <div>
    {/* 2人揃うまではここが出るようにする */}
    {myHand.length === 0 ? (
      <p>対戦相手を待っています...<br/>友人に合言葉「{roomId}」を伝えてください。</p>
    ) : (
      <h2>{isMyTurn ? "あなたの番です！" : "相手の番を待っています..."}</h2>
    )}
    {/* ...以下、カード表示... */}
  </div>
)}
