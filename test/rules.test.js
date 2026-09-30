const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeck, canPlay, nextTurn, checkGameOver, filterName } = require('../index.js');

const card = (realm, isSpecial = false) => ({ id: Math.random().toString(36).slice(2), realm, isSpecial });
const fieldRoom = (realm, extra = {}) => ({ fieldCard: card(realm), nextDrawAmount: 1, ...extra });

test('デッキは固定54枚の構成', () => {
  const deck = createDeck();
  assert.equal(deck.length, 54);
  const count = (realm, special) => deck.filter(c => c.realm === realm && (special === undefined || c.isSpecial === special)).length;
  for (const r of ['GEAR', 'MACHINE', 'FOUNTAIN']) {
    assert.equal(count(r, false), 7, `${r} 通常`);
    assert.equal(count(r, true), 2, `${r} 特殊`);
  }
  for (const r of ['ICEAGE', 'BATTERY', 'ARCHIVE']) assert.equal(count(r), 7, r);
  for (const r of ['PLANET', 'RUINS']) assert.equal(count(r), 3, r);
  assert.equal(new Set(deck.map(c => c.id)).size, 54, 'IDが重複しない');
});

test('属性の循環サイクル', () => {
  const allowed = {
    GEAR: ['GEAR', 'ICEAGE'],
    ICEAGE: ['FOUNTAIN', 'BATTERY'],
    FOUNTAIN: ['FOUNTAIN', 'BATTERY'],
    BATTERY: ['MACHINE', 'ARCHIVE'],
    MACHINE: ['MACHINE', 'ARCHIVE'],
    ARCHIVE: ['GEAR', 'ICEAGE'],
  };
  const realms = Object.keys(allowed);
  for (const field of realms) {
    for (const hand of realms) {
      assert.equal(canPlay(fieldRoom(field), card(hand)), allowed[field].includes(hand), `場=${field} 手札=${hand}`);
    }
  }
});

test('遷移カード（氷河期・電池・古文書）は同じカードに重ねられない', () => {
  for (const r of ['ICEAGE', 'BATTERY', 'ARCHIVE']) {
    assert.equal(canPlay(fieldRoom(r), card(r)), false, r);
  }
});

test('純粋WILDはいつでも出せ、WILDの場には何でも出せる', () => {
  for (const field of ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE']) {
    assert.equal(canPlay(fieldRoom(field), card('PLANET')), true);
    assert.equal(canPlay(fieldRoom(field), card('RUINS')), true);
  }
  assert.equal(canPlay(fieldRoom('PLANET'), card('BATTERY')), true);
  assert.equal(canPlay(fieldRoom('RUINS'), card('ARCHIVE')), true);
});

test('噴水(S)は場が氷河期か噴水のときだけ出せる', () => {
  const fountainS = card('FOUNTAIN', true);
  assert.equal(canPlay(fieldRoom('ICEAGE'), fountainS), true);
  assert.equal(canPlay(fieldRoom('FOUNTAIN'), fountainS), true);
  for (const field of ['GEAR', 'BATTERY', 'MACHINE', 'ARCHIVE']) {
    assert.equal(canPlay(fieldRoom(field), fountainS), false, field);
  }
});

test('ドロー攻撃中は歯車(S)しか出せない', () => {
  const room = fieldRoom('GEAR', { nextDrawAmount: 2 });
  assert.equal(canPlay(room, card('GEAR', true)), true);
  assert.equal(canPlay(room, card('GEAR')), false);
  assert.equal(canPlay(room, card('PLANET')), false);
  assert.equal(canPlay(room, card('ICEAGE')), false);
});

// nextTurn はタイマーを rooms[room.id] に対して張るので、rooms に登録しない ID を使う
const turnRoom = (n, extra = {}) => ({
  id: 'TEST_TURN',
  turnIndex: 0,
  isReversed: false,
  players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, isEliminated: false })),
  ...extra,
});

test('ターンは時計回り、REVERSE中は反時計回りに進む', () => {
  const room = turnRoom(4);
  nextTurn(room);
  assert.equal(room.turnIndex, 1);
  assert.equal(room.currentTurnPlayerId, 'p1');

  room.isReversed = true;
  nextTurn(room);
  nextTurn(room);
  assert.equal(room.turnIndex, 3);
});

test('脱落者はターンを飛ばされる', () => {
  const room = turnRoom(4);
  room.players[1].isEliminated = true;
  room.players[2].isEliminated = true;
  nextTurn(room);
  assert.equal(room.turnIndex, 3);
});

test('skip指定（2人戦のREVERSE）で自分のターンに戻る', () => {
  const room = turnRoom(2);
  nextTurn(room, true);
  assert.equal(room.turnIndex, 0);
});

const scoreRoom = (hands, fieldCard = card('GEAR'), extra = {}) => ({
  id: 'TEST_SCORE',
  fieldCard,
  logs: [],
  matchCount: 1,
  maxMatches: 5,
  isSeriesFinished: false,
  lastPlayWasWild: false,
  players: hands.map((h, i) => ({ id: `p${i}`, name: `P${i}`, handCount: h, isEliminated: false, score: 0 })),
  ...extra,
});

test('誰も上がっていなければ試合は続く', () => {
  const room = scoreRoom([3, 4, 5]);
  assert.equal(checkGameOver(room), false);
  assert.equal(room.matchCount, 1);
});

test('勝者は他プレイヤーの手札合計を獲得する', () => {
  const room = scoreRoom([0, 4, 5]);
  assert.equal(checkGameOver(room), true);
  assert.equal(room.status, 'finished');
  assert.equal(room.players[0].score, 9);
  assert.equal(room.players[0].finishBonus, false);
  assert.equal(room.matchCount, 2);
});

test('惑星・廃墟で上がるとスコアが1.2倍（切り上げ）', () => {
  const planetField = { ...card('GEAR'), wasPlanet: true };
  const room = scoreRoom([0, 4, 5], planetField, { lastPlayWasWild: true });
  checkGameOver(room);
  assert.equal(room.players[0].score, Math.ceil(9 * 1.2));
  assert.equal(room.players[0].finishBonus, true);
});

test('噴水(S)の限定WILDで上がってもボーナスは付かない', () => {
  const room = scoreRoom([0, 4, 5], card('FOUNTAIN', true));
  checkGameOver(room);
  assert.equal(room.players[0].score, 9);
  assert.equal(room.players[0].finishBonus, false);
});

test('2連勝以上で+3pt、負けた側の連勝はリセット', () => {
  const room = scoreRoom([0, 2, 3]);
  room.players[0].consecutiveWins = 1;
  room.players[1].consecutiveWins = 3;
  checkGameOver(room);
  assert.equal(room.players[0].score, 5 + 3);
  assert.equal(room.players[0].consecutiveWins, 2);
  assert.equal(room.players[1].consecutiveWins, 0);
});

test('5マッチ目の終了でシリーズ終了', () => {
  const room = scoreRoom([0, 2], card('GEAR'), { matchCount: 5 });
  checkGameOver(room);
  assert.equal(room.isSeriesFinished, true);
});

test('プレイヤー名のフィルタ', () => {
  assert.equal(filterName(''), 'Pilot');
  assert.equal(filterName('   '), 'Pilot');
  assert.equal(filterName('ABCDEFGHIJKLMN'), 'ABCDEFGHIJ');
  assert.equal(filterName('Ka​el'), 'Kael');
  assert.equal(filterName('ナチス'), 'Pilot');
});
