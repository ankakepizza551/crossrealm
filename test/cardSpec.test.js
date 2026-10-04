const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/cardSpec.mjs');

test('変異済みWILDを選んだ属性で描くとき（モーフ後半）は特殊カード扱いにしない', async () => {
  const { isSpecialFace } = await load();
  for (const flag of ['wasPlanet', 'wasRuins', 'wasFountain']) {
    for (const realm of ['GEAR', 'MACHINE']) {
      const mutated = { realm, isSpecial: false, [flag]: true };
      assert.equal(isSpecialFace(mutated, true), false, `${flag} → ${realm} は DRAW 2 / REVERSE を出さない`);
    }
  }
});

test('WILDとして着地している間（モーフ前半）は従来どおり特殊の見た目', async () => {
  const { isSpecialFace } = await load();
  assert.equal(isSpecialFace({ realm: 'PLANET', isSpecial: true, wasPlanet: true }, false), true);
  assert.equal(isSpecialFace({ realm: 'GEAR', isSpecial: false, wasPlanet: true }, false), true);
});

test('本物の特殊カードはどちらの描画でも特殊', async () => {
  const { isSpecialFace } = await load();
  assert.equal(isSpecialFace({ realm: 'GEAR', isSpecial: true }, true), true);
  assert.equal(isSpecialFace({ realm: 'MACHINE', isSpecial: true }, false), true);
  assert.equal(isSpecialFace({ realm: 'GEAR', isSpecial: false }, false), false);
});
