/* cpu-base.js - CPU思考の共通基盤
 * 各性格(offense/balance/defense)はプロファイル値と一部フックだけを差し替える。
 * brainFor(player) で該当プロファイルの思考オブジェクトを返す。 */
window.YM = window.YM || {};

(function () {
  const A = () => YM.Analyzer;
  const T = () => YM.Tiles;
  const GS = () => YM.GameState;
  const C = YM.CONST;

  const CPU = {};
  const profiles = {};
  CPU.registerProfile = function (name, profile) { profiles[name] = profile; };

  CPU.brainFor = function (player) {
    const prof = profiles[player.cpuProfile] || profiles.balance;
    return makeBrain(prof);
  };

  /* ===== 共通ヘルパー ===== */

  function isIsolated(counts, k) {
    if (counts[k] >= 2) return false;
    if (k >= 27) return true;
    const num = k % 9;
    for (let d = -2; d <= 2; d++) {
      if (d === 0) continue;
      const n = num + d;
      if (n < 0 || n > 8) continue;
      if (counts[k + d] > 0) return false;
    }
    return true;
  }
  CPU.isIsolated = isIsolated;

  /* 脅威(リーチ者・仕掛けの濃い相手)の一覧 */
  CPU.threats = function (G, selfIdx) {
    const list = [];
    for (let i = 0; i < 4; i++) {
      if (i === selfIdx) continue;
      const p = G.players[i];
      if (p.isRiichi || p.riichiPending) list.push({ idx: i, level: 2 });
      else if (p.melds.filter(m => m.type !== 'ankan').length >= 2) list.push({ idx: i, level: 1 });
    }
    return list;
  };

  /* 最善打牌候補: シャンテン最小 → 受け入れ最大 → 孤立字牌/端牌優先処理
   * keepDoraWeight: ドラを手放しにくくする重み(バランス型用) */
  CPU.bestDiscard = function (G, counts14, meldCount, visibleCounts, turnCount, keepDoraWeight) {
    const doraKinds = YM.Wall.doraKinds(G.wall);
    const candidates = [];
    for (let k = 0; k < 34; k++) {
      if (counts14[k] === 0) continue;
      counts14[k]--;
      const uk = A().ukeire(counts14, visibleCounts, meldCount);
      counts14[k]++;
      candidates.push({ kind: k, shanten: uk.shanten, ukeire: uk.total });
    }
    const minSh = Math.min(...candidates.map(c => c.shanten));
    const pool = candidates.filter(c => c.shanten === minSh);

    function priority(k) {
      let p = 0;
      if (turnCount <= 6) {
        if (k >= 27 && isIsolated(counts14, k)) p += 3;
        else if (T().isTerminal(k) && isIsolated(counts14, k)) p += 2;
      } else if (k >= 27 && isIsolated(counts14, k)) p += 1;
      if (keepDoraWeight && doraKinds.includes(k)) p -= keepDoraWeight;
      return p;
    }

    pool.sort((a, b) => {
      const pa = priority(a.kind), pb = priority(b.kind);
      if (b.ukeire !== a.ukeire) return b.ukeire - a.ukeire;
      return pb - pa;
    });
    return pool[0];
  };

  /* リーチ宣言牌の候補(テンパイを保つ打牌の中で受け入れ最大) */
  CPU.riichiDiscard = function (counts14, meldCount, riichiKinds, visibleCounts) {
    let best = null, bestUke = -1;
    for (const k of riichiKinds) {
      counts14[k]--;
      const waits = A().waitingTiles(counts14, meldCount);
      let uke = 0;
      for (const w of waits) uke += 4 - (visibleCounts ? visibleCounts[w] : 0);
      counts14[k]++;
      if (uke > bestUke) { bestUke = uke; best = k; }
    }
    return best;
  };

  /* 鳴いた後の手に役が見込めるか(食い下がり判断の簡易評価) */
  CPU.openYakuPotential = function (G, idx, counts, melds) {
    const p = G.players[idx];
    const ctxSeat = p.seatWind, ctxRound = G.roundWind;
    // 役牌の刻子(既存の副露含む)
    for (const m of melds) {
      if (m.type !== 'chi' && (m.tile >= C.HAKU || m.tile === ctxSeat || m.tile === ctxRound)) return true;
    }
    for (let k = C.HAKU; k <= C.CHUN; k++) if (counts[k] >= 2) return true;
    if (counts[ctxSeat] >= 2 || counts[ctxRound] >= 2) return true;
    // 断么九が狙えるか(么九牌が少ない)
    let yaochu = 0, total = 0;
    const suitCount = new Set();
    let honors = 0;
    for (let k = 0; k < 34; k++) {
      total += counts[k];
      if (T().isYaochu(k)) yaochu += counts[k];
      if (k >= 27) honors += counts[k];
      else if (counts[k] > 0) suitCount.add(Math.floor(k / 9));
    }
    for (const m of melds) {
      if (m.tile < 27) suitCount.add(Math.floor(m.tile / 9));
    }
    if (yaochu <= 2 && melds.every(m => m.type === 'chi' ? (m.tile % 9 > 0 && m.tile % 9 < 6) : !T().isYaochu(m.tile))) return true;
    // 染め手
    if (suitCount.size === 1) return true;
    // 対々和形
    let pairs = 0;
    for (let k = 0; k < 34; k++) if (counts[k] >= 2) pairs++;
    if (pairs >= 3 && melds.every(m => m.type !== 'chi')) return true;
    return false;
  };

  /* 鳴き後のシャンテン(1枚打牌後の最良値) */
  CPU.shantenAfterCall = function (countsAfterTake, meldCountAfter) {
    let best = 9;
    for (let k = 0; k < 34; k++) {
      if (countsAfterTake[k] === 0) continue;
      countsAfterTake[k]--;
      best = Math.min(best, A().shanten(countsAfterTake, meldCountAfter));
      countsAfterTake[k]++;
    }
    return best;
  };

  /* ===== 思考オブジェクト生成 ===== */
  function makeBrain(prof) {
    const brain = {};

    /* 手番の意思決定 */
    brain.decideTurn = function (G, idx, options) {
      const p = G.players[idx];
      const counts14 = A().toCounts(p.hand.concat(p.drawnTile ? [p.drawnTile] : []));
      const meldCount = p.melds.length;
      const visible = GS().visibleCounts(G, idx);
      const turnCount = p.discards.length + 1;
      const threats = CPU.threats(G, idx);

      // 1) ツモ和了は常に取る
      if (options.tsumo) {
        GS().log(G, idx, `ツモ和了 (${options.tsumo.han}翻)`);
        return { type: 'tsumo' };
      }

      // 2) リーチ中はツモ切り(暗槓は見送り=安全優先)
      if (p.isRiichi) return { type: 'discard', kind: p.drawnTile.kind };

      // 3) 暗槓・加槓(脅威がないときのみ)
      if (threats.length === 0 && Math.random() < prof.kanRate) {
        for (const k of options.ankanKinds) {
          // カンしてもシャンテンが悪化しないか
          const c = counts14.slice();
          c[k] = 0;
          if (A().shanten(c, meldCount + 1) <= A().shanten(counts14, meldCount)) {
            GS().log(G, idx, `暗槓を選択: ${T().nameOf(k)}`);
            return { type: 'ankan', kind: k };
          }
        }
        if (options.kakanKinds.length > 0) {
          GS().log(G, idx, `加槓を選択: ${T().nameOf(options.kakanKinds[0])}`);
          return { type: 'kakan', kind: options.kakanKinds[0] };
        }
      }

      // 4) 守備判断
      const off = CPU.bestDiscard(G, counts14, meldCount, visible, turnCount, prof.keepDoraWeight);
      if (threats.length > 0) {
        const fold = prof.shouldFold(G, idx, off.shanten, threats);
        if (fold) {
          const safe = YM.Danger.safestKind(G, counts14, threats.map(t => t.idx), visible);
          GS().log(G, idx, `降り: ${T().nameOf(safe.kind)} (危険度${safe.danger})`);
          return { type: 'discard', kind: safe.kind };
        }
        GS().log(G, idx, `押し (シャンテン${off.shanten})`);
      }

      // 5) リーチ判断
      if (options.riichiKinds.length > 0 && Math.random() < prof.riichiRate(G, idx, threats)) {
        const k = CPU.riichiDiscard(counts14, meldCount, options.riichiKinds, visible);
        GS().log(G, idx, `リーチ宣言: ${T().nameOf(k)}切り`);
        return { type: 'riichi', kind: k };
      }

      // 6) 通常打牌
      return { type: 'discard', kind: off.kind };
    };

    /* 他家の打牌への反応 */
    brain.decideCall = function (G, idx, tile, option) {
      const p = G.players[idx];
      const kind = tile.kind;

      // ロンは常に取る
      if (option.ron) {
        GS().log(G, idx, `ロン (${option.ron.han}翻)`);
        return { type: 'ron' };
      }

      const threats = CPU.threats(G, idx).filter(t => t.idx !== G.lastDiscardPlayer);
      if (threats.some(t => t.level === 2) && !prof.callWhileThreat) {
        return { type: 'pass' };
      }

      const counts13 = A().toCounts(p.hand);
      const meldCount = p.melds.length;
      const currentShanten = A().shanten(counts13, meldCount);
      const isYakuhai = kind >= C.HAKU || kind === p.seatWind || kind === G.roundWind;

      // ポン・明槓
      if (option.pon || option.minkan) {
        const after = counts13.slice();
        after[kind] -= 2;
        const shAfter = CPU.shantenAfterCall(after, meldCount + 1);
        const improves = shAfter < currentShanten;
        if (isYakuhai && prof.callYakuhai(currentShanten) && improves) {
          GS().log(G, idx, `役牌ポン: ${T().nameOf(kind)}`);
          return { type: option.minkan && prof.daiminkan ? 'kan' : 'pon' };
        }
        if (improves && shAfter <= prof.callShantenMax &&
            CPU.openYakuPotential(G, idx, after, p.melds.concat([{ type: 'pon', tile: kind }]))) {
          GS().log(G, idx, `ポン: ${T().nameOf(kind)} (${currentShanten}→${shAfter})`);
          return { type: 'pon' };
        }
      }

      // チー
      if (option.chiVariants.length > 0 && prof.chiEnabled) {
        let best = null, bestSh = currentShanten;
        for (const base of option.chiVariants) {
          const after = counts13.slice();
          for (let k = base; k < base + 3; k++) if (k !== kind) after[k]--;
          const shAfter = CPU.shantenAfterCall(after, meldCount + 1);
          if (shAfter < bestSh &&
              CPU.openYakuPotential(G, idx, after, p.melds.concat([{ type: 'chi', tile: base }]))) {
            bestSh = shAfter;
            best = base;
          }
        }
        if (best != null && bestSh <= prof.callShantenMax && Math.random() < prof.chiRate) {
          GS().log(G, idx, `チー: ${T().nameOf(kind)} (→${bestSh})`);
          return { type: 'chi', chi: best };
        }
      }

      return { type: 'pass' };
    };

    /* 鳴いた直後の打牌 */
    brain.decideDiscardAfterCall = function (G, idx) {
      const p = G.players[idx];
      const counts = A().toCounts(p.hand);
      const visible = GS().visibleCounts(G, idx);
      const threats = CPU.threats(G, idx);
      if (threats.length > 0 && prof.shouldFold(G, idx, A().shanten(counts, p.melds.length), threats)) {
        return YM.Danger.safestKind(G, counts, threats.map(t => t.idx), visible).kind;
      }
      return CPU.bestDiscard(G, counts, p.melds.length, visible, p.discards.length + 1, prof.keepDoraWeight).kind;
    };

    return brain;
  }

  YM.CPU = CPU;
})();
