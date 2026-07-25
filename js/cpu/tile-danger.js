/* tile-danger.js - 捨て牌の危険度評価
 * リーチ者・仕掛けの入った相手に対する放銃危険度を 0(安全)〜30(危険) で返す。 */
window.YM = window.YM || {};

(function () {
  const D = {};

  /* threatIdx に対する kind の危険度 */
  D.dangerOf = function (G, kind, threatIdx, visibleCounts) {
    const threat = G.players[threatIdx];

    // 現物(相手の河)
    if (threat.discards.some(d => d.tile.kind === kind)) return 0;

    // リーチ後に全員が通した牌も現物扱い
    if (threat.isRiichi && threat.riichiHistoryIndex != null) {
      for (let i = threat.riichiHistoryIndex; i < G.discardHistory.length; i++) {
        if (G.discardHistory[i].kind === kind) return 0;
      }
    }

    const seen = visibleCounts ? visibleCounts[kind] : 0;

    // 字牌: 見えている枚数が多いほど安全
    if (kind >= 27) {
      if (seen >= 3) return 1;
      if (seen >= 2) return 4;
      return 8;
    }

    const n = kind % 9; // 0-8
    // スジ判定(現物の±3)
    const base = Math.floor(kind / 9) * 9;
    const isGenbutsu = k => threat.discards.some(d => d.tile.kind === k);
    let suji = false;
    if (n <= 5 && isGenbutsu(kind + 3)) suji = true;
    if (n >= 3 && isGenbutsu(kind - 3)) suji = true;
    // 1・9はスジで大幅に安全、4-6は両スジ必要
    if (n === 0 || n === 8) return suji ? 3 : 10;
    if (n === 1 || n === 7) return suji ? 6 : 14;
    if (n === 2 || n === 6) return suji ? 8 : 18;
    // 4,5,6
    const bothSuji = (n >= 3 && n <= 5) && isGenbutsu(base + n - 3) && isGenbutsu(base + n + 3);
    return bothSuji ? 10 : 22;
  };

  /* 全脅威に対する最大危険度 */
  D.maxDanger = function (G, kind, threatIdxs, visibleCounts) {
    let d = 0;
    for (const t of threatIdxs) d = Math.max(d, D.dangerOf(G, kind, t, visibleCounts));
    return d;
  };

  /* 手牌countsから最も安全な打牌を選ぶ */
  D.safestKind = function (G, counts, threatIdxs, visibleCounts) {
    let best = null, bestDanger = Infinity;
    for (let k = 0; k < 34; k++) {
      if (counts[k] === 0) continue;
      const d = D.maxDanger(G, k, threatIdxs, visibleCounts);
      if (d < bestDanger) { bestDanger = d; best = k; }
    }
    return { kind: best, danger: bestDanger };
  };

  YM.Danger = D;
})();
