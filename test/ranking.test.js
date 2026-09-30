const test = require('node:test');
const assert = require('node:assert/strict');
const { checkGameOver, ranking } = require('../index.js');

test.before(() => assert.equal(ranking.init(':memory:'), true));

const card = (realm) => ({ id: Math.random().toString(36).slice(2), realm, isSpecial: false });
// players[0] が人間、残りはCPU
const room = (hands, extra = {}) => ({
  id: 'TEST_RANK',
  fieldCard: card('GEAR'),
  logs: [],
  matchCount: 1,
  maxMatches: 5,
  isSeriesFinished: false,
  lastPlayWasWild: false,
  players: hands.map((h, i) => ({ id: `p${i}`, name: i === 0 ? 'Human' : `Bot${i}`, isBot: i > 0, handCount: h, isEliminated: false, score: 0 })),
  ...extra,
});

test('ランキングは点数の高い順、期間で絞れる', () => {
  ranking.addRecord({ mode: 'series', name: 'A', score: 10 });
  ranking.addRecord({ mode: 'series', name: 'B', score: 30 });
  ranking.addRecord({ mode: 'series', name: 'C', score: -5 });
  const rows = ranking.getRanking('series', 'all');
  assert.deepEqual(rows.map(r => r.name), ['B', 'A', 'C']);
  assert.equal(ranking.getRanking('series', 'day').length, 3);
  assert.deepEqual(ranking.getRanking('streak', 'all'), []);
  assert.deepEqual(ranking.getRanking('bogus', 'all'), []);
});

test('連勝が同数ならポイント合計が多い方が上位、0連勝は記録しない', () => {
  ranking.addRecord({ mode: 'streak', name: 'X', score: 3, extra: 20 });
  ranking.addRecord({ mode: 'streak', name: 'Y', score: 3, extra: 40 });
  ranking.addRecord({ mode: 'streak', name: 'Z', score: 0 });
  assert.deepEqual(ranking.getRanking('streak', 'all').map(r => r.name), ['Y', 'X']);
});

test('シリーズ終了時に人間プレイヤーだけがスコア登録される', () => {
  const r = room([0, 2], { matchCount: 5 });
  checkGameOver(r);
  assert.equal(r.isSeriesFinished, true);
  const rows = ranking.getRanking('series', 'all').filter(x => x.name === 'Human' || x.name === 'Bot1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Human');
  assert.equal(rows[0].cpuCount, 1);
});

test('連勝モード: 勝てば継続、負けたらその連勝数で終了・登録', () => {
  const r = room([0, 3], { mode: 'streak', maxMatches: null });
  checkGameOver(r);
  assert.equal(r.streak, 1);
  assert.equal(r.isSeriesFinished, false);

  r.status = 'playing';
  r.players.forEach((p, i) => { p.handCount = i === 0 ? 4 : 0; p.isEliminated = false; });
  checkGameOver(r);
  assert.equal(r.isSeriesFinished, true);
  const row = ranking.getRanking('streak', 'all').find(x => x.name === 'Human');
  assert.equal(row.score, 1);
  assert.equal(row.cpuCount, 1);
});

test('連勝モード: 1試合目で負けたら記録なし、二重登録もされない', () => {
  const before = ranking.getRanking('streak', 'all').length;
  const r = room([4, 0], { mode: 'streak', maxMatches: null });
  checkGameOver(r);
  assert.equal(r.isSeriesFinished, true);
  assert.equal(ranking.getRanking('streak', 'all').length, before);

  const r2 = room([0, 3], { mode: 'streak', maxMatches: null, streak: 2 });
  checkGameOver(r2); // streak=3 で継続
  r2.players[0].handCount = 4; r2.players[1].handCount = 0;
  checkGameOver(r2);
  const n = ranking.getRanking('streak', 'all').length;
  assert.equal(n, before + 1);
});
