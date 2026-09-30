const test = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');
const { server, io, rooms } = require('../index.js');

test('1人でプレイ: CPU追加後の start-game で試合が始まる', async (t) => {
  await new Promise(resolve => server.listen(0, resolve));
  const client = ioClient(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
  t.after(() => {
    client.close();
    for (const rid in rooms) clearTimeout(rooms[rid].turnTimer);
    io.close();
  });

  const playing = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('試合が開始されなかった')), 5000);
    client.on('update-game', (state) => {
      if (state.status === 'playing') { clearTimeout(timer); resolve(state); }
    });
  });

  // App.jsx の startSolo と同じ順序で送る
  const roomId = 'SOLO_TEST01';
  client.emit('join-room', { roomId, playerName: 'Tester' });
  for (let i = 0; i < 3; i++) client.emit('add-cpu', { roomId });
  client.emit('start-game', { roomId });

  const state = await playing;
  assert.equal(state.players.length, 4);
  assert.equal(state.players.filter(p => p.isBot).length, 3);
});
