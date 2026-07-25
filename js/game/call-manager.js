/* call-manager.js - 打牌に対するロン・ポン・カン・チーの受付と優先順位解決
 * 優先順位: ロン > ポン・カン > チー。
 * 複数ロンは構造上すべて収集するが、現状は頭ハネ(打牌者から見て下家優先)で
 * 1人のみ和了とする(README参照)。 */
window.YM = window.YM || {};

(function () {
  const C = YM.CONST;
  const A = () => YM.Analyzer;
  const GS = () => YM.GameState;
  const W = () => YM.Wall;
  const UI = () => YM.UI;
  const G = () => YM.Game.G;

  const Calls = {};

  /* ===== 打牌後の鳴き受付 ===== */
  Calls.collect = function (discarder, tile, opts) {
    const g = G();
    if (g.phase === C.PHASE.ENDED) return;
    opts = opts || {};
    const kind = tile.kind;
    const houtei = W().liveCount(g.wall) === 0;

    const options = []; // [{player, ron, pon, minkan, chiVariants}]
    for (const i of YM.seat.orderFrom(discarder)) {
      const p = g.players[i];
      const o = { player: i, ron: null, pon: false, minkan: false, chiVariants: [] };

      // ロン(フリテンでない・役がある)
      o.ron = checkRon(g, i, kind, { houtei });

      // 鳴き(河底の打牌には不可・リーチ中は不可)
      if (!houtei && !p.isRiichi) {
        const counts = A().toCounts(p.hand);
        if (counts[kind] >= 2) o.pon = true;
        if (counts[kind] === 3 && W().liveCount(g.wall) > 0 && g.wall.rinshanUsed < 4) o.minkan = true;
        // チーは上家の捨て牌のみ
        if (i === YM.seat.next(discarder) && kind < 27) {
          o.chiVariants = chiVariantsFor(counts, kind);
        }
      }

      if (o.ron || o.pon || o.minkan || o.chiVariants.length > 0) options.push(o);
    }

    if (options.length === 0) {
      finishNoCall(discarder);
      return;
    }

    g.pendingCalls = {
      mode: 'discard',
      discarder, tile,
      options,
      decisions: {},   // playerIndex -> {type:'ron'|'pon'|'kan'|'chi'|'pass', chi}
      houtei
    };

    // CPUは即決定
    let humanNeeded = false;
    for (const o of options) {
      const p = g.players[o.player];
      if (p.isHuman && !g.devAutoPlay) { humanNeeded = true; continue; }
      const brain = YM.CPU.brainFor(p);
      g.pendingCalls.decisions[o.player] = brain.decideCall(g, o.player, tile, o);
    }

    if (humanNeeded) {
      g.phase = C.PHASE.CALLS;
      UI().renderGame(g); // ロン/ポン/チー/パスボタンを表示
    } else {
      // CPUのみ: 少し間を置いて解決
      YM.timers.set(() => Calls.resolve(), 250);
    }
  };

  function checkRon(g, idx, kind, flags) {
    const p = g.players[idx];
    if (!p.waits.includes(kind)) return null;
    if (p.isFuriten || p.temporaryFuriten) return null;
    const ctx = GS().ctxFor(g, idx, {
      tsumo: false,
      houtei: !!flags.houtei,
      chankan: !!flags.chankan
    });
    return YM.Yaku.canWin(A().toCounts(p.hand), p.melds, kind, ctx);
  }

  /* チーの組み合わせ候補([最小kind]で表す) */
  function chiVariantsFor(counts, kind) {
    const n = kind % 9;
    const v = [];
    if (n >= 2 && counts[kind - 2] > 0 && counts[kind - 1] > 0) v.push(kind - 2);
    if (n >= 1 && n <= 7 && counts[kind - 1] > 0 && counts[kind + 1] > 0) v.push(kind - 1);
    if (n <= 6 && counts[kind + 1] > 0 && counts[kind + 2] > 0) v.push(kind);
    return v;
  }

  /* ===== 人間の鳴き操作 ===== */
  Calls.onHumanDecision = function (decision) {
    const g = G();
    if (!g.pendingCalls || g.busy) return;
    const pc = g.pendingCalls;
    const myOption = pc.options.find(o => o.player === 0);
    if (!myOption) return;

    // 妥当性チェック
    if (decision.type === 'ron' && !myOption.ron) return;
    if (decision.type === 'pon' && !myOption.pon) return;
    if (decision.type === 'kan' && !myOption.minkan) return;
    if (decision.type === 'chi') {
      if (myOption.chiVariants.length === 0) return;
      if (decision.chi == null) {
        if (myOption.chiVariants.length === 1) decision.chi = myOption.chiVariants[0];
        else { UI().showChiSelect(myOption.chiVariants, pc.tile.kind); return; }
      }
    }
    YM.Audio.se('decide');
    UI().hideChiSelect();
    pc.decisions[0] = decision;
    Calls.resolve();
  };

  /* ===== 優先順位の解決 ===== */
  Calls.resolve = function () {
    const g = G();
    const pc = g.pendingCalls;
    if (!pc) return;
    g.pendingCalls = null;
    g.phase = C.PHASE.ANIM;
    UI().renderGame(g);

    const order = YM.seat.orderFrom(pc.discarder);
    const dec = i => pc.decisions[i] || { type: 'pass' };

    // 1) ロン(頭ハネ: 下家側優先)。複数ロンの情報は rons に保持
    const rons = order.filter(i => dec(i).type === 'ron')
      .map(i => ({ player: i, res: pc.options.find(o => o.player === i).ron }));
    if (rons.length > 0) {
      applyPassFuriten(g, pc, rons.map(r => r.player));
      establishRiichiIfPending(g, pc.discarder, false); // ロンされたらリーチ不成立(供託なし)
      const winner = rons[0];
      YM.Result.win(winner.player, {
        tsumo: false,
        winTile: pc.tile,
        res: winner.res,
        loser: pc.discarder,
        allRons: rons
      });
      return;
    }

    // 2) ポン・カン
    for (const i of order) {
      const d = dec(i);
      if (d.type === 'pon' || d.type === 'kan') {
        applyPassFuriten(g, pc, [i]);
        establishRiichiIfPending(g, pc.discarder, true);
        execPonKan(g, i, pc, d.type === 'kan');
        return;
      }
    }

    // 3) チー
    for (const i of order) {
      const d = dec(i);
      if (d.type === 'chi') {
        applyPassFuriten(g, pc, [i]);
        establishRiichiIfPending(g, pc.discarder, true);
        execChi(g, i, pc, d.chi);
        return;
      }
    }

    // 鳴きなし
    applyPassFuriten(g, pc, []);
    finishNoCallAfterPending(g, pc);
  };

  /* 待ち牌を見逃したプレイヤーへ同巡内フリテンを付与 */
  function applyPassFuriten(g, pc, actedPlayers) {
    const kind = pc.tile.kind;
    for (const i of YM.seat.orderFrom(pc.discarder)) {
      if (actedPlayers.includes(i)) continue;
      const p = g.players[i];
      if (p.waits.includes(kind)) {
        p.temporaryFuriten = true;
        if (p.isRiichi) {
          p.riichiMissedRon = true; // リーチ後見逃しは永続フリテン
          GS().updateWaits(g, i);
        }
      }
    }
  }

  /* 打牌者のリーチ成立処理 */
  function establishRiichiIfPending(g, idx, establish) {
    const p = g.players[idx];
    if (!p.riichiPending) return;
    p.riichiPending = false;
    if (establish) {
      p.isRiichi = true;
      p.score -= C.RIICHI_COST;
      g.riichiSticks++;
      p.ippatsuEligible = true;
      p.riichiHistoryIndex = g.discardHistory.length;
      GS().log(g, idx, 'リーチ成立');
    }
    // 不成立(ロンされた)の場合は供託を払わない
  }

  function finishNoCall(discarder) {
    const g = G();
    establishRiichiOnNoCall(g, discarder);
    proceedNext(g, discarder);
  }

  function finishNoCallAfterPending(g, pc) {
    establishRiichiOnNoCall(g, pc.discarder);
    proceedNext(g, pc.discarder);
  }

  function establishRiichiOnNoCall(g, discarder) {
    establishRiichiIfPending(g, discarder, true);
  }

  function proceedNext(g, discarder) {
    if (g.phase === C.PHASE.ENDED) return;
    UI().renderGame(g);
    const wasRiichi = g.players[discarder].discards.length > 0 &&
      g.players[discarder].discards[g.players[discarder].discards.length - 1].riichiDecl;
    YM.timers.set(() => YM.Turn.beginTurn(YM.seat.next(discarder)), wasRiichi ? 900 : 350);
  }

  /* ===== 鳴きの実行 ===== */
  function takeDiscardTile(g, discarder) {
    const p = g.players[discarder];
    const entry = p.discards[p.discards.length - 1];
    entry.called = true;
    return entry.tile;
  }

  function execPonKan(g, caller, pc, isKan) {
    const p = g.players[caller];
    const kind = pc.tile.kind;
    const called = takeDiscardTile(g, pc.discarder);
    const need = isKan ? 3 : 2;
    const tiles = [called];
    for (let i = p.hand.length - 1; i >= 0 && tiles.length <= need; i--) {
      if (p.hand[i].kind === kind) tiles.push(p.hand.splice(i, 1)[0]);
    }
    p.melds.push({ type: isKan ? 'minkan' : 'pon', tile: kind, tiles, from: pc.discarder, calledTile: called });
    YM.Turn.clearAllIppatsu(g);
    GS().updateWaits(g, caller);
    GS().log(g, caller, `${isKan ? '明槓' : 'ポン'}: ${YM.Tiles.nameOf(kind)}`);
    YM.Audio.se('decide');
    YM.Animation.banner(isKan ? 'カン' : 'ポン');
    UI().renderGame(g);

    if (isKan) {
      W().revealDora(g.wall);
      YM.timers.set(() => YM.Turn.beginTurn(caller, { rinshan: true }), 700);
    } else {
      YM.timers.set(() => beginCallerDiscard(g, caller), 600);
    }
  }

  function execChi(g, caller, pc, baseKind) {
    const p = g.players[caller];
    const kind = pc.tile.kind;
    const called = takeDiscardTile(g, pc.discarder);
    const tiles = [];
    for (let k = baseKind; k < baseKind + 3; k++) {
      if (k === kind) { tiles.push(called); continue; }
      const hi = p.hand.findIndex(t => t.kind === k);
      tiles.push(p.hand.splice(hi, 1)[0]);
    }
    p.melds.push({ type: 'chi', tile: baseKind, tiles, from: pc.discarder, calledTile: called });
    YM.Turn.clearAllIppatsu(g);
    GS().updateWaits(g, caller);
    GS().log(g, caller, `チー: ${YM.Tiles.nameOf(kind)}`);
    YM.Audio.se('decide');
    YM.Animation.banner('チー');
    UI().renderGame(g);
    YM.timers.set(() => beginCallerDiscard(g, caller), 600);
  }

  /* 鳴いた後の打牌(ツモなし) */
  function beginCallerDiscard(g, caller) {
    if (g.phase === C.PHASE.ENDED) return;
    const p = g.players[caller];
    g.currentPlayerIndex = caller;
    p.temporaryFuriten = false;

    if (p.isHuman && !g.devAutoPlay) {
      g.phase = C.PHASE.HUMAN_TURN;
      g.humanOptions = { tsumo: null, riichiKinds: [], ankanKinds: [], kakanKinds: [], afterCall: true };
      UI().renderGame(g);
    } else {
      g.phase = C.PHASE.CPU_TURN;
      UI().renderGame(g);
      YM.timers.set(() => {
        const brain = YM.CPU.brainFor(p);
        const kind = brain.decideDiscardAfterCall(g, caller);
        YM.Turn.discardByKind(caller, kind, false);
      }, 400 + Math.random() * 400);
    }
  }

  /* ===== 槍槓 ===== */
  Calls.collectChankan = function (kakanner, kind, onNone) {
    const g = G();
    const ronners = [];
    let humanCan = false;
    for (const i of YM.seat.orderFrom(kakanner)) {
      const res = checkRon(g, i, kind, { chankan: true });
      if (!res) continue;
      const p = g.players[i];
      if (p.isHuman && !g.devAutoPlay) { humanCan = true; ronners.push({ player: i, res, human: true }); }
      else ronners.push({ player: i, res, human: false }); // CPUは槍槓を必ずロン
    }

    if (ronners.length === 0) { onNone(); return; }

    if (humanCan) {
      g.pendingCalls = {
        mode: 'chankan',
        discarder: kakanner,
        tile: { kind, id: -1 },
        options: [{ player: 0, ron: ronners.find(r => r.player === 0).res, pon: false, minkan: false, chiVariants: [] }],
        decisions: {},
        onNone: () => {
          // 見逃し: フリテン
          const p = g.players[0];
          p.temporaryFuriten = true;
          if (p.isRiichi) { p.riichiMissedRon = true; GS().updateWaits(g, 0); }
          onNone();
        },
        chankanRonners: ronners
      };
      g.phase = C.PHASE.CALLS;
      UI().renderGame(g);
      return;
    }

    const w = ronners[0];
    YM.Result.win(w.player, { tsumo: false, winTile: { kind, id: -1 }, res: w.res, loser: kakanner, chankan: true });
  };

  /* 槍槓時の人間の決定 */
  Calls.onHumanChankan = function (doRon) {
    const g = G();
    const pc = g.pendingCalls;
    if (!pc || pc.mode !== 'chankan') return;
    g.pendingCalls = null;
    g.phase = C.PHASE.ANIM;
    if (doRon) {
      const res = pc.options[0].ron;
      YM.Result.win(0, { tsumo: false, winTile: pc.tile, res, loser: pc.discarder, chankan: true });
    } else {
      const cpuRon = (pc.chankanRonners || []).find(r => !r.human);
      if (cpuRon) {
        YM.Result.win(cpuRon.player, { tsumo: false, winTile: pc.tile, res: cpuRon.res, loser: pc.discarder, chankan: true });
      } else {
        pc.onNone();
      }
    }
  };

  /* 人間のパス(鳴き見送り) */
  Calls.onHumanPass = function () {
    const g = G();
    if (!g.pendingCalls) return;
    if (g.pendingCalls.mode === 'chankan') { Calls.onHumanChankan(false); return; }
    YM.Audio.se('select');
    UI().hideChiSelect();
    g.pendingCalls.decisions[0] = { type: 'pass' };
    Calls.resolve();
  };

  YM.Calls = Calls;
})();
