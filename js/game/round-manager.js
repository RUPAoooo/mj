/* round-manager.js - 対局(東風戦)と局のライフサイクル管理 */
window.YM = window.YM || {};

(function () {
  const C = YM.CONST;
  const GS = () => YM.GameState;
  const W = () => YM.Wall;
  const A = () => YM.Analyzer;
  const UI = () => YM.UI;

  const Game = { G: null };
  const Round = {};

  /* 新しい対局を始める前に、前対局の一時表示を必ず片付ける。 */
  Round.resetTransientView = function () {
    const hideIds = [
      'oyakime-layer', 'start-greeting-layer', 'game-menu', 'chi-select',
      'result-overlay', 'final-overlay'
    ];
    hideIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    ['fx-layer', 'cutin-layer', 'announcement-layer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.replaceChildren();
    });
    document.querySelectorAll('.info-card.oya-picked').forEach(el => el.classList.remove('oya-picked'));
    const roll = document.getElementById('oyakime-roll');
    if (roll) {
      roll.onclick = null;
      roll.classList.add('hidden');
      roll.disabled = true;
    }
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) gameScreen.classList.remove('is-pass-ready');
  };

  /* ===== 対局開始 ===== */
  Round.startGame = function (selectedCharacterIds) {
    YM.timers.clearAll();
    YM.Animation.clear();
    Round.resetTransientView();
    // (9) 対局用BGM(添付曲をランダム再生・クロスフェード)を開始
    if (YM.Audio && YM.Audio.playGameBgm) YM.Audio.playGameBgm();
    const requestedIds = selectedCharacterIds != null
      ? selectedCharacterIds
      : (Game.G && Game.G.selectedCharacterIds) ||
        (YM.Storage && YM.Storage.data.selectedCharacters) ||
        YM.defaultCharacterSelection;
    let ids = YM.normalizeCharacterSelection(requestedIds);
    if (ids.length !== 3) {
      console.warn('Invalid character selection; using the complete default trio.', requestedIds);
      ids = YM.defaultCharacterSelection.slice();
    }
    if (YM.Storage) {
      YM.Storage.data.selectedCharacters = ids.slice();
      YM.Storage.save();
    }
    Game.G = GS().create(ids);
    const G = Game.G;
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) {
      gameScreen.dataset.selectedCharacterIds = G.selectedCharacterIds.join(',');
      G.players.slice(1).forEach((player, index) => {
        const seat = index + 1;
        gameScreen.dataset[`seat${seat}CharacterId`] = player.characterId;
        gameScreen.dataset[`seat${seat}CpuProfile`] = player.cpuProfile;
      });
    }
    G.handNumber = 1;
    G.dealerIndex = 0;
    UI().showScreen('game');      // 卓を表示(山牌生成・配牌は親決め後)
    UI().resetGameTable(G);       // 前対局の手牌・河・表示状態を残さない
    // 親決めイベント → 決定した親で局を開始
    Round.oyakime(function (dealerIndex) {
      G.dealerIndex = dealerIndex;
      G.startingDealerIndex = dealerIndex;
      Round.startRound(true);
    });
  };

  /* ===== 親決め(二度振り・卓上サイコロ演出) ===== */
  Round.oyakime = function (onDone) {
    const G = Game.G;
    const $ = id => document.getElementById(id);
    const layer = $('oyakime-layer');
    const btn = $('oyakime-roll');
    const msg = $('oyakime-msg');
    const dice = [$('oya-die-0'), $('oya-die-1')];
    const cubes = dice.map(d => d.querySelector('.oya-die-cube'));
    const lifts = dice.map(d => d.querySelector('.oya-die-lift'));
    const shadows = dice.map(d => d.querySelector('.oya-die-shadow'));
    const nameOf = i => G.players[i].name;
    const d6 = () => 1 + Math.floor(Math.random() * 6);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clearPick = () => document.querySelectorAll('.info-card.oya-picked').forEach(e => e.classList.remove('oya-picked'));
    const pick = i => { clearPick(); const c = $('card-' + i); if (c) c.classList.add('oya-picked'); };

    let stage = 1;        // 1:仮親決め / 2:本親決め
    let busy = false;
    const faceLayout = {
      1: [4], 2: [1, 7], 3: [1, 4, 7], 4: [1, 2, 6, 7],
      5: [1, 2, 4, 6, 7], 6: [1, 2, 3, 5, 6, 7]
    };
    const sides = [['front', 1], ['back', 6], ['right', 3], ['left', 4], ['top', 2], ['bottom', 5]];
    cubes.forEach(cube => {
      cube.replaceChildren(...sides.map(([side, value]) => {
        const face = document.createElement('div');
        face.className = 'oya-die-face';
        face.dataset.side = side;
        face.dataset.value = value;
        face.append(...faceLayout[value].map(pos => {
          const pip = document.createElement('i');
          pip.className = `oya-pip p${pos}${value === 1 ? ' red' : ''}`;
          return pip;
        }));
        return face;
      }));
    });

    // 席ごとの投げ込み開始位置(卓中央基準の相対px)。k=0/1で2個をずらす
    function startOffset(seat, k) {
      const j = rnd(-24, 24) + (k ? 28 : -28);
      if (seat === 0) return [j, rnd(210, 250)];        // 下(自分)→上へ
      if (seat === 2) return [j, -rnd(210, 250)];       // 上CPU→下へ
      if (seat === 3) return [-rnd(230, 270), j];       // 左CPU→右へ
      return [rnd(230, 270), j];                        // 右CPU(1)→左へ
    }
    // 停止位置: 中央プレートの左右に着地(2個をずらす)
    function endOffset(k) {
      return [k ? rnd(52, 118) : -rnd(52, 118), rnd(-26, 62)];
    }
    const finalRotation = value => ({
      1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180]
    }[value]);
    function animateDie(k, start, end, value) {
      const d = dice[k], cube = cubes[k], lift = lifts[k], shadow = shadows[k];
      const duration = k ? 1540 : 1460;
      const [fx, fy] = finalRotation(value);
      const turns = k ? [4, -5, 4] : [-5, 4, -3];
      const stopZ = (Math.random() < .5 ? -1 : 1) * rnd(12, 38);
      const started = performance.now();
      d.style.opacity = '1';
      function frame(now) {
        const t = Math.min(1, (now - started) / duration);
        const travel = 1 - Math.pow(1 - t, 3);
        const x = start[0] + (end[0] - start[0]) * travel + Math.sin(t * Math.PI * 3 + k) * (1 - t) * 8;
        const y = start[1] + (end[1] - start[1]) * travel;
        let height;
        if (t < .58) height = Math.sin(t / .58 * Math.PI) * (k ? 82 : 96);
        else if (t < .82) height = Math.abs(Math.sin((t - .58) / .24 * Math.PI)) * (k ? 25 : 31);
        else height = Math.abs(Math.sin((t - .82) / .18 * Math.PI * 2)) * 7 * (1 - t) / .18;
        const settle = 1 - Math.pow(1 - t, 2);
        const rx = turns[0] * 360 * (1 - Math.pow(1 - t, 1.7)) + fx * settle;
        const ry = turns[1] * 360 * (1 - Math.pow(1 - t, 1.65)) + fy * settle;
        const rz = turns[2] * 360 * (1 - Math.pow(1 - t, 1.6)) + stopZ * settle;
        d.style.transform = `translate(-50%,-50%) translate(${x}px,${y - height}px)`;
        lift.style.transform = 'rotateX(12deg) rotateY(8deg)';
        cube.style.transform = `rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
        shadow.style.transform = `translateY(${height}px) scale(${1 + height / 75},${1 + height / 150})`;
        shadow.style.opacity = String(Math.max(.16, .72 - height / 145));
        if (t < 1) requestAnimationFrame(frame);
        else {
          lift.style.transform = 'rotateX(12deg) rotateY(8deg)';
          cube.style.transform = `rotateZ(${stopZ}deg) rotateX(${fx}deg) rotateY(${fy}deg)`;
          shadow.style.transform = 'scale(1)';
          shadow.style.opacity = '.72';
        }
      }
      requestAnimationFrame(frame);
    }

    layer.classList.remove('hidden');
    dice.forEach(d => { d.style.opacity = '0'; });
    clearPick();
    msg.textContent = 'サイコロを振って親を決めます';
    btn.textContent = 'サイコロを振る';
    btn.classList.remove('hidden');
    btn.disabled = false;

    function rollDice(roller) {
      busy = true;
      btn.classList.add('hidden');       // 抽選中はボタンを隠す(連打防止)
      clearPick();
      YM.Audio.se('decide');
      const starts = [0, 1].map(k => startOffset(roller, k));
      const ends = [0, 1].map(k => endOffset(k));
      const d1 = d6(), d2 = d6(), total = d1 + d2;
      animateDie(0, starts[0], ends[0], d1);
      animateDie(1, starts[1], ends[1], d2);
      // 停止・出目確定
      YM.timers.set(function () {
        const target = (roller + total - 1) % 4;   // 既存の親決め計算は維持
        pick(target);
        if (stage === 1) {
          stage = 2;
          if (target !== 0) {
            // 仮親が自分以外: CPUが自動で2回目を振る
            msg.textContent = `合計${total}　${nameOf(target)}が仮親。${nameOf(target)}がサイコロを振ります`;
            YM.timers.set(() => rollDice(target), 1000);
          } else {
            // 仮親が自分: 2回目のボタンを表示して入力を待つ
            msg.textContent = `合計${total}　あなたが仮親。もう一度振ってください`;
            btn.textContent = 'もう一度サイコロを振る';
            btn.classList.remove('hidden');
            btn.disabled = false;
            busy = false;
          }
        } else {
          // 本親決定
          YM.Audio.se('win');
          msg.textContent = `合計${total}　${nameOf(target)}が東家・親に決まりました`;
          YM.timers.set(function () {
            clearPick();
            layer.classList.add('hidden');
            dice.forEach(d => { d.style.opacity = '0'; });
            btn.onclick = null;
            onDone(target);        // 2度目の結果のみを親としてゲームへ
          }, 1500);
        }
      }, 1600);
    }

    btn.onclick = () => { if (!busy) rollDice(0); };  // 人間の投骰は自分(席0)から
  };

  /* ===== 局の開始 ===== */
  Round.startRound = function (isFirst) {
    const G = Game.G;
    YM.timers.clearAll();
    YM.Animation.clear();

    G.wall = W().build();
    const hands = W().deal(G.wall);

    for (let i = 0; i < 4; i++) {
      const p = G.players[i];
      p.hand = hands[i];
      GS().sortHand(p.hand);
      p.drawnTile = null;
      p.discards = [];
      p.melds = [];
      p.isRiichi = false;
      p.riichiPending = false;
      p.riichiTurn = -1;
      p.isFuriten = false;
      p.temporaryFuriten = false;
      p.riichiMissedRon = false;
      p.ippatsuEligible = false;
      p.hasDiscarded = false;
      p.seatWind = GS().seatWindOf(G, i);
      p.waits = [];
      GS().updateWaits(G, i);
    }

    G.currentPlayerIndex = G.dealerIndex;
    G.turnNumber = 0;
    G.lastDiscard = null;
    G.lastDiscardPlayer = -1;
    G.pendingCalls = null;
    G.result = null;
    G.selectedIndex = -1;
    G.riichiMode = false;
    G.riichiValidKinds = [];
    G.humanOptions = null;
    G.busy = false;
    G.discardHistory = [];
    G.phase = C.PHASE.ANIM;

    UI().renderGame(G);
    if (isFirst) {
      YM.CharacterUI.showOpening(G, () => YM.Turn.beginTurn(G.dealerIndex));
    } else {
      YM.timers.set(() => YM.Turn.beginTurn(G.dealerIndex), 900);
    }
  };

  /* ===== 流局 ===== */
  Round.ryuukyoku = function () {
    const G = Game.G;
    if (G.phase === C.PHASE.ENDED) return;
    G.phase = C.PHASE.ENDED;
    G.busy = true;

    const tenpai = G.players.map(p =>
      A().isTenpai(A().toCounts(p.hand), p.melds.length));
    const nTen = tenpai.filter(Boolean).length;

    // ノーテン罰符
    const deltas = [0, 0, 0, 0];
    if (nTen > 0 && nTen < 4) {
      const gain = C.NOTEN_PENALTY_TOTAL / nTen;
      const pay = C.NOTEN_PENALTY_TOTAL / (4 - nTen);
      for (let i = 0; i < 4; i++) {
        deltas[i] = tenpai[i] ? gain : -pay;
        G.players[i].score += deltas[i];
      }
    }

    YM.Animation.banner('流 局');
    YM.Audio.se('lose');
    UI().renderGame(G);

    YM.timers.set(() => {
      YM.ResultUI.showRyuukyoku({
        tenpai, deltas,
        onNext: () => Round.advance({ ryuukyoku: true, dealerTenpai: tenpai[G.dealerIndex] })
      });
    }, 1300);
  };

  /* ===== 局の終了処理(連荘・親流れ・終局判定) =====
   * opts: { ryuukyoku, dealerTenpai, dealerWon } */
  Round.advance = function (opts) {
    const G = Game.G;
    YM.timers.clearAll();

    // (8) 1局終わるごとに加算。0の間は順位を出さない。
    G.roundsCompleted = (G.roundsCompleted || 0) + 1;

    // 飛び判定
    if (G.players.some(p => p.score < 0)) {
      Round.finishGame('tobi');
      return;
    }

    let renchan = false;
    if (opts.ryuukyoku) {
      G.honba++;
      renchan = !!opts.dealerTenpai;
    } else if (opts.dealerWon) {
      G.honba++;
      renchan = true;
    } else {
      G.honba = 0;
    }

    if (!renchan) {
      G.handNumber++;
      if (G.handNumber > C.MAX_HAND) {
        Round.finishGame('complete');
        return;
      }
      G.dealerIndex = (G.handNumber - 1) % 4;
    }

    Round.startRound(false);
  };

  /* ===== 対局終了(最終結果) ===== */
  Round.finishGame = function (reason) {
    const G = Game.G;
    G.phase = C.PHASE.ENDED;
    G.gameOver = true;
    YM.timers.clearAll();
    YM.timers.paused = false;
    // 対局が正常終了したので「対局にもどる」の対象から外す。
    if (YM.Main) YM.Main._activeGame = false;
    try {
      if (YM.Storage.data.activeGame) { YM.Storage.data.activeGame = null; YM.Storage.save(); }
    } catch (e) { /* no-op */ }
    YM.ResultUI.showFinal(reason);
  };

  YM.Game = Game;
  YM.Round = Round;
})();
