/* dev-panel.js - 4人麻雀確認用のDEV機能
 * 通常プレイでは右下の小さなDEVボタンからのみ開く。 */
window.YM = window.YM || {};

(function () {
  const $id = id => document.getElementById(id);
  const A = () => YM.Analyzer;
  const G = () => YM.Game.G;
  const D = {};

  let fabId = 900;
  function fabricate(kinds) {
    return kinds.map(k => ({ kind: k, id: fabId++ }));
  }

  function inGame() {
    const g = G();
    if (!g || g.phase === 'ended' || g.gameOver) { alert('対局中のみ使用できます'); return null; }
    return g;
  }

  function refresh(g) {
    for (let i = 0; i < 4; i++) YM.GameState.updateWaits(g, i);
    YM.Turn.recomputeHumanOptions();
    YM.UI.renderGame(g);
  }

  /* プレイヤーをテンパイにする(123m456m789m123p + 5s待ち形) */
  D.tenpai = function (idx) {
    const g = inGame(); if (!g) return;
    idx = idx == null ? 0 : idx;
    const p = g.players[idx];
    p.melds = [];
    p.hand = fabricate([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
    YM.GameState.sortHand(p.hand);
    refresh(g);
  };

  /* プレイヤーをツモ可能にする(次の自分のツモが和了牌になる) */
  D.winnable = function () {
    const g = inGame(); if (!g) return;
    D.tenpai(0);
    // 手番が回るまでに他家が引く枚数を考慮して和了牌を山へ差し込む
    const cur = g.currentPlayerIndex;
    let ahead = (0 - cur + 4) % 4;
    if (ahead === 0 && g.players[0].drawnTile) ahead = 4; // 打牌後に一周
    const pos = Math.max(0, ahead === 0 ? 0 : ahead - (g.players[cur].drawnTile ? 1 : 0));
    if (g.wall.live.length > pos) g.wall.live[pos] = { kind: 13, id: fabId++ };
    refresh(g);
  };

  /* 任意のCPUへ振り込ませる(プレイヤーをテンパイにし、そのCPUに待ち牌を強制打牌) */
  D.dealIn = function (cpuIdx) {
    const g = inGame(); if (!g) return;
    D.tenpai(0);
    YM.GameState.updateWaits(g, 0);
    const wait = g.players[0].waits[0];
    if (wait == null) return;
    g.devForcedDiscard[cpuIdx] = wait;
    // そのCPUの手に待ち牌を仕込む
    const p = g.players[cpuIdx];
    if (p.hand.length > 0) p.hand[0] = { kind: wait, id: fabId++ };
    YM.GameState.sortHand(p.hand);
    refresh(g);
  };

  /* リーチ可能状態を作る */
  D.riichiReady = function () {
    D.tenpai(0);
    const g = G(); if (!g) return;
    const p = g.players[0];
    p.isRiichi = false; p.riichiPending = false; p.riichiMissedRon = false;
    if (p.score < 1000) p.score = 1000;
    refresh(g);
  };

  /* チー可能状態(上家=左CPUに3mを強制打牌させ、手に1m2mを持たせる) */
  D.chiReady = function () {
    const g = inGame(); if (!g) return;
    const p = g.players[0];
    p.hand[0] = { kind: 0, id: fabId++ };
    p.hand[1] = { kind: 1, id: fabId++ };
    YM.GameState.sortHand(p.hand);
    const kamicha = 3;
    g.devForcedDiscard[kamicha] = 2;
    const cp = g.players[kamicha];
    if (cp.hand.length > 0) cp.hand[0] = { kind: 2, id: fabId++ };
    refresh(g);
  };

  /* ポン可能状態(任意の他家に白を強制打牌させ、手に白2枚) */
  D.ponReady = function () {
    const g = inGame(); if (!g) return;
    const HAKU = 31;
    const p = g.players[0];
    p.hand[0] = { kind: HAKU, id: fabId++ };
    p.hand[1] = { kind: HAKU, id: fabId++ };
    YM.GameState.sortHand(p.hand);
    const target = 2;
    g.devForcedDiscard[target] = HAKU;
    const cp = g.players[target];
    if (cp.hand.length > 0) cp.hand[0] = { kind: HAKU, id: fabId++ };
    refresh(g);
  };

  /* カン可能状態(手に發3枚+他家に發を強制打牌 → 明槓/暗槓の確認) */
  D.kanReady = function () {
    const g = inGame(); if (!g) return;
    const HATSU = 32;
    const p = g.players[0];
    p.hand[0] = { kind: HATSU, id: fabId++ };
    p.hand[1] = { kind: HATSU, id: fabId++ };
    p.hand[2] = { kind: HATSU, id: fabId++ };
    YM.GameState.sortHand(p.hand);
    const target = 2;
    g.devForcedDiscard[target] = HATSU;
    const cp = g.players[target];
    if (cp.hand.length > 0) cp.hand[0] = { kind: HATSU, id: fabId++ };
    refresh(g);
  };

  /* 流局直前へ(山残り5枚) */
  D.nearRyuukyoku = function () {
    const g = inGame(); if (!g) return;
    if (g.wall.live.length > 5) g.wall.live.splice(0, g.wall.live.length - 5);
    refresh(g);
  };

  /* 東四局へ移動 */
  D.gotoEast4 = function () {
    const g = inGame(); if (!g) return;
    g.handNumber = 4;
    g.dealerIndex = 3;
    YM.Round.startRound(false);
  };

  /* 点数変更 */
  D.editScores = function () {
    const g = inGame(); if (!g) return;
    for (let i = 0; i < 4; i++) {
      const v = prompt(`${g.players[i].name} の点数`, g.players[i].score);
      if (v != null && !isNaN(parseInt(v, 10))) g.players[i].score = parseInt(v, 10);
    }
    refresh(g);
  };

  /* 親変更 */
  D.rotateDealer = function () {
    const g = inGame(); if (!g) return;
    g.dealerIndex = (g.dealerIndex + 1) % 4;
    YM.Round.startRound(false);
  };

  /* 供託・本場変更 */
  D.editHonba = function () {
    const g = inGame(); if (!g) return;
    const h = prompt('本場', g.honba);
    if (h != null && !isNaN(parseInt(h, 10))) g.honba = parseInt(h, 10);
    const s = prompt('供託(本)', g.riichiSticks);
    if (s != null && !isNaN(parseInt(s, 10))) g.riichiSticks = parseInt(s, 10);
    refresh(g);
  };

  /* CPU手牌の公開切替 */
  D.toggleHands = function () {
    const g = inGame(); if (!g) return;
    g.devShowHands = !g.devShowHands;
    refresh(g);
  };

  /* CPU思考ログ */
  D.showLog = function () {
    const g = G(); if (!g) return;
    const el = $id('dev-log');
    el.classList.toggle('hidden');
    el.textContent = g.cpuLog.slice(-60).join('\n') || '(ログなし)';
    el.scrollTop = el.scrollHeight;
  };

  /* 全自動プレイ(進行テスト用) */
  D.toggleAutoPlay = function () {
    const g = inGame(); if (!g) return;
    g.devAutoPlay = !g.devAutoPlay;
    alert('オートプレイ: ' + (g.devAutoPlay ? 'ON' : 'OFF'));
    // 手番待ちで止まっている場合は流す
    if (g.devAutoPlay && g.phase === 'human-turn') {
      YM.Turn.cpuTakeTurn(0, g.humanOptions || { tsumo: null, riichiKinds: [], ankanKinds: [], kakanKinds: [] });
    } else if (g.devAutoPlay && g.phase === 'calls' && g.pendingCalls) {
      YM.Calls.onHumanPass();
    }
  };

  /* パネルの配線 */
  D.wire = function () {
    $id('dev-toggle').addEventListener('click', () => {
      $id('dev-panel').classList.toggle('hidden');
    });
    const actions = {
      hands: D.toggleHands,
      tenpai0: () => D.tenpai(0),
      tenpai1: () => D.tenpai(1),
      tenpai2: () => D.tenpai(2),
      tenpai3: () => D.tenpai(3),
      winnable: D.winnable,
      dealin1: () => D.dealIn(1),
      dealin2: () => D.dealIn(2),
      dealin3: () => D.dealIn(3),
      riichi: D.riichiReady,
      chi: D.chiReady,
      pon: D.ponReady,
      kan: D.kanReady,
      ryuukyoku: D.nearRyuukyoku,
      east4: D.gotoEast4,
      scores: D.editScores,
      dealer: D.rotateDealer,
      honba: D.editHonba,
      log: D.showLog,
      auto: D.toggleAutoPlay
    };
    document.querySelectorAll('#dev-panel button[data-dev]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fn = actions[btn.dataset.dev];
        if (fn) fn();
      });
    });
  };

  YM.Dev = D;
})();
