/* yaku.js - 役判定(4人麻雀・副露対応版)
 * evaluate(input) -> { valid, yakuList, han, fu, yakuman, doraCount }
 * input: {
 *   concealedCounts,  // 副露を除いた手牌+和了牌の counts[34]
 *   melds,            // [{type:'chi'|'pon'|'minkan'|'ankan'|'kakan', tile, from}]
 *   winKind, tsumo,
 *   riichi, ippatsu, rinshan, haitei, houtei, chankan,
 *   seatWind, roundWind, doraKinds
 * }
 * 面子分解×待ち取りの全パターンを評価し、(役満>翻>符)が最大の解釈を返す。 */
window.YM = window.YM || {};

(function () {
  const A = () => YM.Analyzer;
  const T = () => YM.Tiles;
  const C = YM.CONST;
  const Y = {};

  const GREEN = [19, 20, 21, 23, 25, 32]; // 2,3,4,6,8索+發

  /* 副露 -> 面子表現 */
  function meldToSet(m) {
    if (m.type === 'chi') return { type: 'run', tile: m.tile, open: true, kan: false, concealed: false };
    if (m.type === 'pon') return { type: 'triplet', tile: m.tile, open: true, kan: false, concealed: false };
    if (m.type === 'ankan') return { type: 'triplet', tile: m.tile, open: false, kan: true, concealed: true };
    return { type: 'triplet', tile: m.tile, open: true, kan: true, concealed: false }; // minkan/kakan
  }

  /* 副露込みの全牌counts(ドラ・断么九・染め手判定用) */
  function wholeCounts(concealedCounts, melds) {
    const c = concealedCounts.slice();
    for (const m of melds) {
      if (m.type === 'chi') { c[m.tile]++; c[m.tile + 1]++; c[m.tile + 2]++; }
      else if (m.type === 'pon') c[m.tile] += 3;
      else c[m.tile] += 4;
    }
    return c;
  }

  function wholeChecks(counts) {
    let hasHonor = false, allYaochu = true, anyYaochu = false, allHonor = true, allTerminal = true, allGreen = true;
    const suits = new Set();
    for (let k = 0; k < 34; k++) {
      if (counts[k] === 0) continue;
      if (k >= 27) { hasHonor = true; allTerminal = false; }
      else {
        suits.add(Math.floor(k / 9));
        allHonor = false;
        if (k % 9 !== 0 && k % 9 !== 8) allTerminal = false;
      }
      if (T().isYaochu(k)) anyYaochu = true; else allYaochu = false;
      if (!GREEN.includes(k)) allGreen = false;
    }
    return { hasHonor, suitCount: suits.size, allYaochu, tanyao: !anyYaochu, allHonor, allTerminal, allGreen };
  }

  function isYakuhaiKind(k, ctx) {
    return k >= C.HAKU || k === ctx.seatWind || k === ctx.roundWind;
  }

  /* 待ち取りの一覧を返す(どの面子/雀頭で和了牌を使ったか) */
  function waitAssignments(decomp, winKind) {
    const list = [];
    if (decomp.pair === winKind) list.push({ waitType: 'tanki', setIndex: -1 });
    decomp.sets.forEach((s, i) => {
      if (s.type === 'triplet') {
        if (s.tile === winKind) list.push({ waitType: 'shanpon', setIndex: i });
      } else {
        const a = s.tile, n = a % 9;
        if (winKind === a) list.push({ waitType: n === 6 ? 'penchan' : 'ryanmen', setIndex: i });
        else if (winKind === a + 2) list.push({ waitType: n === 0 ? 'penchan' : 'ryanmen', setIndex: i });
        else if (winKind === a + 1) list.push({ waitType: 'kanchan', setIndex: i });
      }
    });
    return list;
  }

  /* 1つの解釈(分解+待ち取り)を評価する */
  function evaluateAssignment(decomp, assign, input, whole, meldSets) {
    const menzen = input.melds.every(m => m.type === 'ankan');
    // 手牌部分の面子(和了牌でロン完成した刻子は明刻扱い)
    const handSets = decomp.sets.map((s, i) => ({
      type: s.type, tile: s.tile, open: false, kan: false,
      concealed: !(!input.tsumo && assign.waitType === 'shanpon' && assign.setIndex === i)
    }));
    const allSets = handSets.concat(meldSets);
    const pair = decomp.pair;

    const triplets = allSets.filter(s => s.type === 'triplet');
    const runs = allSets.filter(s => s.type === 'run');
    const concealedTriplets = triplets.filter(s => s.concealed);
    const kans = allSets.filter(s => s.kan);

    /* --- 役満 --- */
    const yakumanList = [];
    if (triplets.length === 4 && concealedTriplets.length === 4) yakumanList.push({ name: assign.waitType === 'tanki' ? '四暗刻単騎' : '四暗刻', han: 13 });
    if ([C.HAKU, C.HATSU, C.CHUN].every(d => triplets.some(s => s.tile === d))) yakumanList.push({ name: '大三元', han: 13 });
    if (whole.allHonor) yakumanList.push({ name: '字一色', han: 13 });
    if (whole.allTerminal) yakumanList.push({ name: '清老頭', han: 13 });
    if (whole.allGreen) yakumanList.push({ name: '緑一色', han: 13 });
    if (kans.length === 4) yakumanList.push({ name: '四槓子', han: 13 });
    const windTris = [27, 28, 29, 30].filter(w => triplets.some(s => s.tile === w));
    if (windTris.length === 4) yakumanList.push({ name: '大四喜', han: 13 });
    else if (windTris.length === 3 && pair >= 27 && pair <= 30) yakumanList.push({ name: '小四喜', han: 13 });

    if (yakumanList.length > 0) {
      // 複数役満は最初の1つのみ採用(シングル役満。README参照)
      return { yakuList: [yakumanList[0]], han: 13, fu: 30, yakuman: true };
    }

    /* --- 通常役 --- */
    const list = [];
    if (input.riichi) list.push({ name: '立直', han: 1 });
    if (input.ippatsu) list.push({ name: '一発', han: 1 });
    if (input.tsumo && menzen) list.push({ name: '門前清自摸和', han: 1 });
    if (input.rinshan) list.push({ name: '嶺上開花', han: 1 });
    if (input.chankan) list.push({ name: '槍槓', han: 1 });
    if (input.haitei && input.tsumo) list.push({ name: '海底摸月', han: 1 });
    if (input.houtei && !input.tsumo) list.push({ name: '河底撈魚', han: 1 });

    let pinfu = false;
    if (menzen && input.melds.length === 0 && runs.length === 4 &&
        !isYakuhaiKind(pair, input) && assign.waitType === 'ryanmen') {
      pinfu = true;
      list.push({ name: '平和', han: 1 });
    }
    if (whole.tanyao) list.push({ name: '断么九', han: 1 });

    if (menzen) {
      const runCount = {};
      handSets.filter(s => s.type === 'run').forEach(s => { runCount[s.tile] = (runCount[s.tile] || 0) + 1; });
      const dupPairs = Object.values(runCount).reduce((n, v) => n + Math.floor(v / 2), 0);
      if (dupPairs >= 2) list.push({ name: '二盃口', han: 3 });
      else if (dupPairs === 1) list.push({ name: '一盃口', han: 1 });
    }

    for (const s of triplets) {
      if (s.tile === C.HAKU) list.push({ name: '役牌 白', han: 1 });
      if (s.tile === C.HATSU) list.push({ name: '役牌 發', han: 1 });
      if (s.tile === C.CHUN) list.push({ name: '役牌 中', han: 1 });
      if (s.tile === input.roundWind) list.push({ name: '場風 ' + T().nameOf(s.tile), han: 1 });
      if (s.tile === input.seatWind && s.tile !== input.roundWind) list.push({ name: '自風 ' + T().nameOf(s.tile), han: 1 });
      if (s.tile === input.seatWind && s.tile === input.roundWind) list.push({ name: '自風 ' + T().nameOf(s.tile), han: 1 }); // ダブ東等
    }

    if (triplets.length === 4) list.push({ name: '対々和', han: 2 });
    if (concealedTriplets.length >= 3) list.push({ name: '三暗刻', han: 2 });
    if (kans.length >= 3 && kans.length < 4) list.push({ name: '三槓子', han: 2 });

    const dragonTris = [C.HAKU, C.HATSU, C.CHUN].filter(d => triplets.some(s => s.tile === d));
    if (dragonTris.length === 2 && pair >= C.HAKU) list.push({ name: '小三元', han: 2 });

    if (whole.allYaochu) list.push({ name: '混老頭', han: 2 });
    else {
      // チャンタ・純チャン(順子を1つ以上含む)
      const everySetYaochu = allSets.every(s =>
        s.type === 'triplet' ? T().isYaochu(s.tile) : (s.tile % 9 === 0 || s.tile % 9 === 6));
      if (everySetYaochu && T().isYaochu(pair) && runs.length > 0) {
        if (whole.hasHonor) list.push({ name: '混全帯么九', han: menzen ? 2 : 1 });
        else list.push({ name: '純全帯么九', han: menzen ? 3 : 2 });
      }
    }

    // 一気通貫
    for (let suit = 0; suit < 3; suit++) {
      const base = suit * 9;
      if ([base, base + 3, base + 6].every(t => runs.some(r => r.tile === t))) {
        list.push({ name: '一気通貫', han: menzen ? 2 : 1 });
        break;
      }
    }
    // 三色同順
    for (let n = 0; n <= 6; n++) {
      if ([n, n + 9, n + 18].every(t => runs.some(r => r.tile === t))) {
        list.push({ name: '三色同順', han: menzen ? 2 : 1 });
        break;
      }
    }
    // 三色同刻
    for (let n = 0; n <= 8; n++) {
      if ([n, n + 9, n + 18].every(t => triplets.some(r => r.tile === t))) {
        list.push({ name: '三色同刻', han: 2 });
        break;
      }
    }

    if (whole.suitCount === 1 && whole.hasHonor) list.push({ name: '混一色', han: menzen ? 3 : 2 });
    if (whole.suitCount === 1 && !whole.hasHonor) list.push({ name: '清一色', han: menzen ? 6 : 5 });

    const han = list.reduce((s, y) => s + y.han, 0);
    const fu = YM.Fu.compute({
      sets: allSets, pair, waitType: assign.waitType,
      tsumo: input.tsumo, menzen, pinfu, chiitoi: false,
      seatWind: input.seatWind, roundWind: input.roundWind
    });
    return { yakuList: list, han, fu, yakuman: false };
  }

  Y.evaluate = function (input) {
    const melds = input.melds || [];
    const meldSets = melds.map(meldToSet);
    const whole = wholeChecks(wholeCounts(input.concealedCounts, melds));
    const menzen = melds.every(m => m.type === 'ankan');
    const candidates = [];

    /* --- 国士無双 --- */
    if (melds.length === 0 && A().isKokushi(input.concealedCounts)) {
      candidates.push({ yakuList: [{ name: '国士無双', han: 13 }], han: 13, fu: 30, yakuman: true });
    }

    /* --- 七対子 --- */
    if (melds.length === 0 && A().isChiitoi(input.concealedCounts)) {
      const list = [{ name: '七対子', han: 2 }];
      if (input.riichi) list.unshift({ name: '立直', han: 1 });
      if (input.ippatsu) list.push({ name: '一発', han: 1 });
      if (input.tsumo) list.push({ name: '門前清自摸和', han: 1 });
      if (input.haitei && input.tsumo) list.push({ name: '海底摸月', han: 1 });
      if (input.houtei && !input.tsumo) list.push({ name: '河底撈魚', han: 1 });
      if (whole.tanyao) list.push({ name: '断么九', han: 1 });
      if (whole.allYaochu) list.push({ name: '混老頭', han: 2 });
      if (whole.allHonor) { candidates.push({ yakuList: [{ name: '字一色', han: 13 }], han: 13, fu: 25, yakuman: true }); }
      if (whole.suitCount === 1 && whole.hasHonor) list.push({ name: '混一色', han: 3 });
      if (whole.suitCount === 1 && !whole.hasHonor) list.push({ name: '清一色', han: 6 });
      candidates.push({ yakuList: list, han: list.reduce((s, y) => s + y.han, 0), fu: 25, yakuman: false });
    }

    /* --- 通常形 --- */
    const meldCount = melds.length;
    const decomps = A().decompose(input.concealedCounts, meldCount);
    for (const d of decomps) {
      for (const assign of waitAssignments(d, input.winKind)) {
        candidates.push(evaluateAssignment(d, assign, { ...input, melds }, whole, meldSets));
      }
    }

    if (candidates.length === 0) return { valid: false, yakuList: [], han: 0, fu: 0, yakuman: false, doraCount: 0 };

    // 役満 > 翻 > 符 の順で最良を選ぶ
    candidates.sort((a, b) =>
      (b.yakuman - a.yakuman) || (b.han - a.han) || (b.fu - a.fu));
    const best = candidates[0];
    const valid = best.yakuList.length > 0 && best.han > 0;

    // ドラ(役ではない)
    let doraCount = 0;
    if (valid && !best.yakuman && input.doraKinds) {
      const wc = wholeCounts(input.concealedCounts, melds);
      for (const dk of input.doraKinds) doraCount += wc[dk] || 0;
    }

    return {
      valid,
      yakuList: best.yakuList,
      han: best.han + doraCount,
      baseHan: best.han,
      fu: best.fu,
      yakuman: best.yakuman,
      doraCount,
      menzen
    };
  };

  /* ロン可能かの判定(13枚手牌+副露に対して) */
  Y.canWin = function (concealedCounts13, melds, winKind, ctx) {
    if (concealedCounts13[winKind] >= 4) return null;
    const c = concealedCounts13.slice();
    c[winKind]++;
    if (!A().isWinning(c, (melds || []).length)) return null;
    const res = Y.evaluate({ ...ctx, concealedCounts: c, melds: melds || [], winKind });
    return res.valid ? res : null;
  };

  YM.Yaku = Y;
})();
