/* hand-analyzer.js - シャンテン数計算・和了判定・待ち解析(副露対応版)
 * 牌は kind(0-33) の枚数配列 counts[34] で扱う。
 * 副露がある場合は meldCount(確定面子数)を渡す。
 * (シャンテン計算は二人打ち版のロジックを副露対応に拡張して再利用) */
window.YM = window.YM || {};

(function () {
  const A = {};

  A.toCounts = function (tiles) {
    const c = new Array(34).fill(0);
    for (const t of tiles) c[t.kind]++;
    return c;
  };

  /* ===== 通常形シャンテン(meldCount = 確定済み面子数) ===== */
  A.shantenStandard = function (countsIn, meldCount) {
    const c = countsIn.slice();
    const m0 = meldCount || 0;
    let best = 8;

    function evalNow(m, t, hasPair) {
      let tt = t;
      if (m + tt > 4) tt = 4 - m;
      const s = 8 - 2 * m - tt - (hasPair ? 1 : 0);
      if (s < best) best = s;
    }

    function walk(i, m, t, hasPair) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) { evalNow(m, t, hasPair); return; }
      const suit = Math.floor(i / 9);
      const num = i % 9;
      if (c[i] >= 3) { c[i] -= 3; walk(i, m + 1, t, hasPair); c[i] += 3; }
      if (suit < 3 && num <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        walk(i, m + 1, t, hasPair);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (c[i] >= 2) {
        c[i] -= 2;
        if (!hasPair) walk(i, m, t, true);
        walk(i, m, t + 1, hasPair);
        c[i] += 2;
      }
      if (suit < 3 && num <= 7 && c[i + 1] > 0) {
        c[i]--; c[i + 1]--; walk(i, m, t + 1, hasPair); c[i]++; c[i + 1]++;
      }
      if (suit < 3 && num <= 6 && c[i + 2] > 0) {
        c[i]--; c[i + 2]--; walk(i, m, t + 1, hasPair); c[i]++; c[i + 2]++;
      }
      const saved = c[i];
      c[i] = 0;
      walk(i + 1, m, t, hasPair);
      c[i] = saved;
    }

    walk(0, m0, 0, false);
    return best;
  };

  /* ===== 七対子シャンテン(門前専用) ===== */
  A.shantenChiitoi = function (counts) {
    let pairs = 0, kinds = 0;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0) kinds++;
      if (counts[i] >= 2) pairs++;
    }
    return 6 - pairs + Math.max(0, 7 - kinds);
  };

  /* ===== 国士無双シャンテン(門前専用) ===== */
  const YAOCHU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  A.YAOCHU = YAOCHU;
  A.shantenKokushi = function (counts) {
    let kinds = 0, hasPair = false;
    for (const k of YAOCHU) {
      if (counts[k] > 0) kinds++;
      if (counts[k] >= 2) hasPair = true;
    }
    return 13 - kinds - (hasPair ? 1 : 0);
  };

  /* ===== 総合シャンテン(-1で和了形) =====
   * meldCountが1以上なら七対子・国士は成立しない */
  A.shanten = function (counts, meldCount) {
    const std = A.shantenStandard(counts, meldCount);
    if (meldCount > 0) return std;
    return Math.min(std, A.shantenChiitoi(counts), A.shantenKokushi(counts));
  };

  A.isWinning = (counts, meldCount) => A.shanten(counts, meldCount) === -1;

  A.isChiitoi = function (counts) {
    let pairs = 0;
    for (let i = 0; i < 34; i++) {
      if (counts[i] === 2) pairs++;
      else if (counts[i] !== 0) return false;
    }
    return pairs === 7;
  };

  A.isKokushi = function (counts) {
    let kinds = 0, hasPair = false, total = 0;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0 && !YAOCHU.includes(i)) return false;
      total += counts[i];
    }
    for (const k of YAOCHU) {
      if (counts[k] > 0) kinds++;
      if (counts[k] === 2) hasPair = true;
      if (counts[k] > 2) return false;
    }
    return total === 14 && kinds === 13 && hasPair;
  };

  /* ===== 待ち牌一覧(手牌13-3n枚+副露n) ===== */
  A.waitingTiles = function (counts13, meldCount) {
    const waits = [];
    for (let k = 0; k < 34; k++) {
      if (counts13[k] >= 4) continue;
      counts13[k]++;
      if (A.shanten(counts13, meldCount) === -1) waits.push(k);
      counts13[k]--;
    }
    return waits;
  };

  A.isTenpai = (counts13, meldCount) => A.shanten(counts13, meldCount) === 0;

  /* ===== 受け入れ枚数 ===== */
  A.ukeire = function (counts13, visibleCounts, meldCount) {
    const base = A.shanten(counts13, meldCount);
    const kinds = [];
    let total = 0;
    for (let k = 0; k < 34; k++) {
      if (counts13[k] >= 4) continue;
      counts13[k]++;
      const s = A.shanten(counts13, meldCount);
      counts13[k]--;
      if (s < base) {
        const left = 4 - (visibleCounts ? visibleCounts[k] : counts13[k]);
        if (left > 0) { kinds.push(k); total += left; }
      }
    }
    return { kinds, total, shanten: base };
  };

  /* ===== 和了形の面子分解(副露分を除いた手牌部分) =====
   * countsIn: 手牌(和了牌込み)のcounts / meldCount: 副露数
   * 戻り値: [{ pair: kind, sets: [{type:'run'|'triplet', tile: kind}] }] */
  A.decompose = function (countsIn, meldCount) {
    const c = countsIn.slice();
    const need = 4 - (meldCount || 0);
    const results = [];
    for (let p = 0; p < 34; p++) {
      if (c[p] < 2) continue;
      c[p] -= 2;
      const sets = [];
      (function walk(i) {
        while (i < 34 && c[i] === 0) i++;
        if (i >= 34) {
          if (sets.length === need) results.push({ pair: p, sets: sets.map(s => ({ ...s })) });
          return;
        }
        if (c[i] >= 3) {
          c[i] -= 3; sets.push({ type: 'triplet', tile: i });
          walk(i);
          sets.pop(); c[i] += 3;
        }
        const suit = Math.floor(i / 9), num = i % 9;
        if (suit < 3 && num <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
          c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ type: 'run', tile: i });
          walk(i);
          sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
        }
      })(0);
      c[p] += 2;
    }
    return results;
  };

  YM.Analyzer = A;
})();
