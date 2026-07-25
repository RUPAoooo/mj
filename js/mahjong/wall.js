/* wall.js - 山牌の生成・洗牌・配牌・王牌管理(4人麻雀版)
 * 王牌14枚を分離して管理する。
 * - ドラ表示牌: 王牌内の所定位置から順にめくる(最大5枚)
 * - 嶺上牌: 王牌から4枚まで。嶺上ツモのたびに生き山の末尾を王牌へ補充する
 * 赤牌は未実装だが、tileオブジェクトに red フラグを足すだけで拡張できる構造。 */
window.YM = window.YM || {};

(function () {
  const W = {};
  const DEAD = 14;
  W.DEAD_WALL = DEAD;

  // 136枚を生成して洗牌
  W.buildTiles = function () {
    const tiles = [];
    let id = 0;
    for (let kind = 0; kind < 34; kind++) {
      for (let c = 0; c < 4; c++) tiles.push({ kind, id: id++ });
    }
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  };

  /* 山を作る。戻り値:
   * { live: [], dead: [], doraIndicators: [], rinshanUsed: 0 } */
  W.build = function () {
    const tiles = W.buildTiles();
    const dead = tiles.splice(tiles.length - DEAD, DEAD);
    const wall = {
      live: tiles,          // ツモ山(先頭からツモる)
      dead,                 // 王牌14枚
      doraIndicators: [],   // めくったドラ表示牌
      rinshanUsed: 0
    };
    W.revealDora(wall);     // 1枚目のドラ表示
    return wall;
  };

  /* 配牌: 4人へ13枚ずつ。親は手番開始時の第一ツモで14枚になる */
  W.deal = function (wall) {
    const hands = [[], [], [], []];
    // 実際の麻雀と同じく4枚ずつ×3回+1枚
    for (let round = 0; round < 3; round++) {
      for (let p = 0; p < 4; p++) hands[p].push(...wall.live.splice(0, 4));
    }
    for (let p = 0; p < 4; p++) hands[p].push(wall.live.shift());
    return hands;
  };

  W.canDraw = wall => wall.live.length > 0;
  W.liveCount = wall => wall.live.length;

  W.draw = function (wall) {
    if (!W.canDraw(wall)) return null;
    return wall.live.shift();
  };

  /* 嶺上牌をツモる。生き山の末尾1枚を王牌へ移し、山の総数を保つ */
  W.drawRinshan = function (wall) {
    if (wall.rinshanUsed >= 4 || wall.dead.length === 0) return null;
    const tile = wall.dead.shift();
    wall.rinshanUsed++;
    if (wall.live.length > 0) {
      wall.dead.push(wall.live.pop()); // 海底が1枚ずれる
    }
    return tile;
  };

  /* ドラ表示牌を1枚追加でめくる(槓のたびに呼ぶ) */
  W.revealDora = function (wall) {
    if (wall.doraIndicators.length >= YM.CONST.MAX_DORA_INDICATORS) return null;
    // 王牌の末尾側から順に表示牌とする
    const idx = wall.dead.length - 1 - wall.doraIndicators.length;
    if (idx < 0) return null;
    const t = wall.dead[idx];
    wall.doraIndicators.push(t);
    return t;
  };

  W.doraKinds = function (wall) {
    return wall.doraIndicators.map(t => YM.Tiles.doraFromIndicator(t.kind));
  };

  /* 裏ドラ表示牌。
   * 王牌ではドラ表示牌のすぐ下(内側)の段が裏ドラ表示牌にあたる。
   * この実装では dead を1列とみなしているため、表向きの表示牌が
   * 末尾から順に使われるのに対し、その1つ内側の牌を裏として対応づける。
   * めくったドラ表示牌と同じ枚数(槓ドラぶんも含む)を返す。 */
  W.uraDoraIndicators = function (wall) {
    const out = [];
    for (let i = 0; i < wall.doraIndicators.length; i++) {
      const idx = wall.dead.length - 1 - YM.CONST.MAX_DORA_INDICATORS - i;
      if (idx < 0) break;
      out.push(wall.dead[idx]);
    }
    return out;
  };

  W.uraDoraKinds = function (wall) {
    return W.uraDoraIndicators(wall).map(t => YM.Tiles.doraFromIndicator(t.kind));
  };

  YM.Wall = W;
})();
