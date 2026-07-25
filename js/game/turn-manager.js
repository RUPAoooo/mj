/* turn-manager.js - ツモ・打牌・カン・リーチのターン進行
 * 1局のメインループ: beginTurn -> (人間入力 or CPU思考) -> performDiscard -> call-manager -> beginTurn(次家) */
window.YM = window.YM || {};

(function () {
  const C = YM.CONST;
  const A = () => YM.Analyzer;
  const GS = () => YM.GameState;
  const W = () => YM.Wall;
  const UI = () => YM.UI;
  const G = () => YM.Game.G;

  const Turn = {};

  /* ===== 手番開始(ツモ) ===== */
  Turn.beginTurn = function (idx, opts) {
    const g = G();
    opts = opts || {};
    if (!g || g.phase === C.PHASE.ENDED) return;

    if (!opts.rinshan && !W().canDraw(g.wall)) {
      YM.Round.ryuukyoku();
      return;
    }

    const p = g.players[idx];
    p.temporaryFuriten = false;
    g.currentPlayerIndex = idx;
    g.turnNumber++;
    if (g.dialogueState) g.dialogueState.totalTurns++;
    g.selectedIndex = -1;
    g.riichiMode = false;

    let tile;
    if (opts.rinshan) {
      tile = W().drawRinshan(g.wall);
      if (!tile) { YM.Round.ryuukyoku(); return; }
    } else {
      tile = W().draw(g.wall);
    }
    p.drawnTile = tile;
    g.lastDrawWasRinshan = !!opts.rinshan;
    g.isHaiteiDraw = !opts.rinshan && W().liveCount(g.wall) === 0;

    const options = computeOptions(g, idx);
    g.humanOptions = p.isHuman ? options : null;

    if (p.isHuman && !g.devAutoPlay) {
      YM.Audio.se('draw');
      g.phase = C.PHASE.HUMAN_TURN;
      UI().renderGame(g);
      // リーチ中で選択肢がなければ自動ツモ切り
      if (p.isRiichi && !options.tsumo && options.ankanKinds.length === 0) {
        g.phase = C.PHASE.ANIM;
        UI().renderGame(g);
        YM.timers.set(() => {
          g.phase = C.PHASE.HUMAN_TURN;
          Turn.discardDrawn(idx);
        }, 650);
      }
    } else {
      g.phase = C.PHASE.CPU_TURN;
      UI().renderGame(g);
      const delay = p.isHuman ? 300 : 500 + Math.random() * 600;
      const takeTurn = () => cpuTakeTurn(idx, options);
      if (!p.isHuman && YM.CharacterUI.maybeLiliSmoking(g, idx, takeTurn)) return;
      if (!p.isHuman && YM.CharacterUI.maybeThinking(g, idx, takeTurn)) return;
      if (!p.isHuman) YM.CharacterUI.maybeAmbient(g, idx);
      YM.timers.set(takeTurn, delay);
    }
  };

  /* ツモ後の選択肢(ツモ和了・リーチ・カン)を計算 */
  function computeOptions(g, idx) {
    const p = g.players[idx];
    const counts14 = A().toCounts(p.hand.concat(p.drawnTile ? [p.drawnTile] : []));
    const meldCount = p.melds.length;
    const opt = { tsumo: null, riichiKinds: [], ankanKinds: [], kakanKinds: [] };

    // ツモ和了
    if (A().isWinning(counts14, meldCount)) {
      const res = YM.Yaku.evaluate(Object.assign(
        GS().ctxFor(g, idx, { tsumo: true, rinshan: g.lastDrawWasRinshan, haitei: g.isHaiteiDraw }),
        { concealedCounts: counts14, melds: p.melds, winKind: p.drawnTile.kind }
      ));
      if (res.valid) opt.tsumo = res;
    }

    // カン(山が残っていて嶺上が残っている場合のみ)
    if (W().liveCount(g.wall) > 0 && g.wall.rinshanUsed < 4) {
      for (let k = 0; k < 34; k++) {
        if (counts14[k] === 4) {
          if (p.isRiichi) {
            // リーチ中は待ちが変わらない暗槓のみ(ツモ牌の暗槓に限る)
            if (p.drawnTile.kind !== k) continue;
            if (!ankanKeepsWaits(p, k)) continue;
          }
          opt.ankanKinds.push(k);
        }
      }
      if (!p.isRiichi) {
        for (const m of p.melds) {
          if (m.type === 'pon' && counts14[m.tile] >= 1) opt.kakanKinds.push(m.tile);
        }
      }
    }

    // リーチ(門前・1000点以上・山残り)
    const menzen = p.melds.every(m => m.type === 'ankan');
    if (!p.isRiichi && menzen && p.score >= C.RIICHI_COST &&
        W().liveCount(g.wall) >= C.RIICHI_MIN_WALL) {
      for (let k = 0; k < 34; k++) {
        if (counts14[k] === 0) continue;
        counts14[k]--;
        if (A().shanten(counts14, meldCount) === 0) opt.riichiKinds.push(k);
        counts14[k]++;
      }
    }
    return opt;
  }

  /* DEV等から選択肢を再計算する用 */
  Turn.recomputeHumanOptions = function () {
    const g = G();
    if (g && g.phase === C.PHASE.HUMAN_TURN && g.currentPlayerIndex === 0 &&
        !(g.humanOptions && g.humanOptions.afterCall)) {
      g.humanOptions = computeOptions(g, 0);
    }
  };

  /* リーチ中の暗槓が待ちを変えないか */
  function ankanKeepsWaits(p, kind) {
    const before = p.waits.slice().sort().join(',');
    const counts = A().toCounts(p.hand); // 13枚(ツモ牌のkindが3枚含まれる)
    if (counts[kind] !== 3) return false;
    counts[kind] = 0;
    const after = A().waitingTiles(counts, p.melds.length + 1).sort().join(',');
    return before === after;
  }

  /* ===== 人間の操作 ===== */
  Turn.onTileClick = function (index) {
    const g = G();
    if (g.phase !== C.PHASE.HUMAN_TURN || g.busy) return;
    const p = g.players[0];
    if (p.isRiichi && !g.humanOptions) return;
    if (p.isRiichi && index !== 'drawn') return; // リーチ中は手出し不可
    const tile = index === 'drawn' ? p.drawnTile : p.hand[index];
    if (!tile) return;
    // リーチ中にツモ和了可能な状態でツモ切り → 見逃し扱い
    if (p.isRiichi && index === 'drawn' && g.humanOptions && g.humanOptions.tsumo) {
      Turn.onPassTsumo();
      return;
    }
    if (g.riichiMode && !g.riichiValidKinds.includes(tile.kind)) return;
    // 設定「打牌操作」: 1クリック=即打牌 / 2クリック=選択→確認(既定)
    const singleClick = YM.Storage && YM.Storage.data &&
      YM.Storage.data.settings && YM.Storage.data.settings.discard === 'single';
    if (singleClick || g.selectedIndex === index) {
      if (index === 'drawn') Turn.discardDrawn(0, g.riichiMode);
      else Turn.discardFromHand(0, index, g.riichiMode);
    } else {
      g.selectedIndex = index;
      YM.Audio.se('select');
      UI().renderGame(g);
    }
  };

  Turn.onRiichiButton = function () {
    const g = G();
    if (g.phase !== C.PHASE.HUMAN_TURN || g.busy) return;
    const p = g.players[0];
    if (p.isRiichi || !g.humanOptions || g.humanOptions.riichiKinds.length === 0) return;
    YM.Audio.se('decide');
    g.riichiMode = !g.riichiMode;
    g.riichiValidKinds = g.humanOptions.riichiKinds;
    g.selectedIndex = -1;
    UI().renderGame(g);
  };

  Turn.onTsumoButton = function () {
    const g = G();
    if (g.phase !== C.PHASE.HUMAN_TURN || g.busy) return;
    if (!g.humanOptions || !g.humanOptions.tsumo) return;
    YM.Result.win(0, {
      tsumo: true,
      winTile: g.players[0].drawnTile,
      res: g.humanOptions.tsumo
    });
  };

  Turn.onKanButton = function () {
    const g = G();
    if (g.phase !== C.PHASE.HUMAN_TURN || g.busy || !g.humanOptions) return;
    const o = g.humanOptions;
    // 候補が複数ある場合は先頭を採用(通常は1つ)
    if (o.ankanKinds.length > 0) Turn.performAnkan(0, o.ankanKinds[0]);
    else if (o.kakanKinds.length > 0) Turn.performKakan(0, o.kakanKinds[0]);
  };

  /* リーチ中のツモ見逃し(パス) */
  Turn.onPassTsumo = function () {
    const g = G();
    if (g.phase !== C.PHASE.HUMAN_TURN || g.busy) return;
    const p = g.players[0];
    if (!p.isRiichi || !g.humanOptions || !g.humanOptions.tsumo) return;
    p.riichiMissedRon = true; // 以後ロン不可(フリテン)
    g.humanOptions.tsumo = null;
    Turn.discardDrawn(0);
  };

  /* ===== 打牌 ===== */
  Turn.discardDrawn = function (idx, declareRiichi) {
    const g = G();
    const p = g.players[idx];
    if (!p.drawnTile) return;
    const tile = p.drawnTile;
    p.drawnTile = null;
    performDiscard(idx, tile, { riichi: declareRiichi, tsumogiri: true });
  };

  Turn.discardFromHand = function (idx, handIndex, declareRiichi) {
    const g = G();
    const p = g.players[idx];
    const tile = p.hand.splice(handIndex, 1)[0];
    if (p.drawnTile) { p.hand.push(p.drawnTile); p.drawnTile = null; }
    GS().sortHand(p.hand);
    performDiscard(idx, tile, { riichi: declareRiichi, tsumogiri: false });
  };

  /* CPU用: kind指定で打牌 */
  Turn.discardByKind = function (idx, kind, declareRiichi) {
    const g = G();
    const p = g.players[idx];
    if (p.drawnTile && p.drawnTile.kind === kind) {
      Turn.discardDrawn(idx, declareRiichi);
      return;
    }
    const hi = p.hand.findIndex(t => t.kind === kind);
    if (hi < 0) { Turn.discardDrawn(idx, declareRiichi); return; }
    Turn.discardFromHand(idx, hi, declareRiichi);
  };

  function performDiscard(idx, tile, opts) {
    const g = G();
    const p = g.players[idx];
    if (g.busy) return;
    g.busy = true;
    g.phase = C.PHASE.ANIM;

    const entry = { tile, riichiDecl: !!opts.riichi, tsumogiri: !!opts.tsumogiri, called: false };
    p.discards.push(entry);
    p.hasDiscarded = true;
    g.lastDiscard = { tile, player: idx };
    g.lastDiscardPlayer = idx;
    g.discardHistory.push({ kind: tile.kind, player: idx });

    if (opts.riichi) {
      p.riichiPending = true;
      p.riichiTurn = p.discards.length - 1;
      YM.Audio.se('riichi');
      YM.Animation.announcement('リーチ', {
        type: 'riichi',
        actor: idx === 0 ? 'あなた' : p.name,
        life: 1700
      });
      YM.Animation.redSweep();
      YM.CharacterUI.cutin(p.characterId, idx === 0 ? 'playerRiichi' : 'cpuRiichi', { banner: null, speaker: idx });
    } else if (p.isRiichi) {
      // リーチ後の打牌で一発消滅
      p.ippatsuEligible = false;
    }

    g.selectedIndex = -1;
    g.riichiMode = false;
    g.humanOptions = null;
    GS().updateWaits(g, idx);
    YM.Audio.se('discard');
    UI().renderGame(g);

    g.busy = false;
    YM.Calls.collect(idx, tile, { riichiDeclared: !!opts.riichi });
  }

  /* ===== CPU手番 ===== */
  function cpuTakeTurn(idx, options) {
    const g = G();
    if (g.phase === C.PHASE.ENDED) return;
    const p = g.players[idx];

    // DEV: 強制打牌
    const forced = g.devForcedDiscard[idx];
    if (forced != null) {
      const counts = A().toCounts(p.hand.concat(p.drawnTile ? [p.drawnTile] : []));
      if (counts[forced] > 0) {
        delete g.devForcedDiscard[idx];
        GS().log(g, idx, `DEV強制打牌: ${YM.Tiles.nameOf(forced)}`);
        Turn.discardByKind(idx, forced, false);
        return;
      }
    }

    const brain = YM.CPU.brainFor(p);
    const action = brain.decideTurn(g, idx, options);

    switch (action.type) {
      case 'tsumo':
        YM.Result.win(idx, { tsumo: true, winTile: p.drawnTile, res: options.tsumo });
        return;
      case 'ankan':
        Turn.performAnkan(idx, action.kind);
        return;
      case 'kakan':
        Turn.performKakan(idx, action.kind);
        return;
      case 'riichi':
        Turn.discardByKind(idx, action.kind, true);
        return;
      default:
        Turn.discardByKind(idx, action.kind, false);
    }
  }
  Turn.cpuTakeTurn = cpuTakeTurn;

  /* ===== カン ===== */
  Turn.performAnkan = function (idx, kind) {
    const g = G();
    const p = g.players[idx];
    // ツモ牌を手に合流させてから4枚抜く
    if (p.drawnTile) { p.hand.push(p.drawnTile); p.drawnTile = null; }
    const tiles = [];
    for (let i = p.hand.length - 1; i >= 0; i--) {
      if (p.hand[i].kind === kind) tiles.push(p.hand.splice(i, 1)[0]);
    }
    GS().sortHand(p.hand);
    p.melds.push({ type: 'ankan', tile: kind, tiles, from: null });
    clearAllIppatsu(g);
    W().revealDora(g.wall);
    YM.Audio.se('decide');
    YM.Animation.banner('カン');
    GS().log(g, idx, `暗槓: ${YM.Tiles.nameOf(kind)}`);
    UI().renderGame(g);
    YM.timers.set(() => Turn.beginTurn(idx, { rinshan: true }), 700);
  };

  Turn.performKakan = function (idx, kind) {
    const g = G();
    const p = g.players[idx];
    if (p.drawnTile) { p.hand.push(p.drawnTile); p.drawnTile = null; }
    const hi = p.hand.findIndex(t => t.kind === kind);
    const added = p.hand.splice(hi, 1)[0];
    GS().sortHand(p.hand);
    const meld = p.melds.find(m => m.type === 'pon' && m.tile === kind);
    meld.type = 'kakan';
    meld.tiles.push(added);
    clearAllIppatsu(g);
    YM.Audio.se('decide');
    YM.Animation.banner('カン');
    GS().log(g, idx, `加槓: ${YM.Tiles.nameOf(kind)}`);
    UI().renderGame(g);
    // 槍槓判定 → なければ嶺上ツモ
    YM.Calls.collectChankan(idx, kind, () => {
      W().revealDora(g.wall);
      UI().renderGame(g);
      YM.timers.set(() => Turn.beginTurn(idx, { rinshan: true }), 500);
    });
  };

  function clearAllIppatsu(g) {
    g.players.forEach(q => { q.ippatsuEligible = false; });
  }
  Turn.clearAllIppatsu = clearAllIppatsu;

  YM.Turn = Turn;
})();
