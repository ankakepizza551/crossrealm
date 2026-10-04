// カードを「特殊カード」の見た目（DRAW 2 / REVERSE / LIMIT WILD の帯と金枠）で描くか。
// 変異済みの WILD（wasPlanet 等）を選んだ属性で描くとき（forceRealRealm）は特殊カードではない。
// そこで WILD フラグを特殊扱いすると、クロスフェード中だけ DRAW 2 / REVERSE が見えてしまう。
export const isSpecialFace = (card, forceRealRealm) =>
  Boolean(card.isSpecial || (!forceRealRealm && (card.wasPlanet || card.wasRuins || card.wasFountain)));
