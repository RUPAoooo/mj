/* game-state.js - ゲーム状態の一元管理(4人麻雀版)
 * DOMを状態として使わない。UIは常にこの状態から描画する。 */
window.YM = window.YM || {};

/* ===== タイマー一元管理(画面遷移時に必ず破棄する) =====
 * 「対局にもどる」用に一時停止(pause)/再開(resume)に対応する。
 * pause 中は保留中のタイマーの残り時間を保存して実タイマーを止め、
 * resume 時に残り時間で再登録する。これにより、タイトル画面を見ている間は
 * CPU思考・自動ツモ・結果画面の自動遷移などがいっさい進まない。 */
YM.timers = {
  list: [],       // { id, fn, ms, startedAt } 実行待ちの実タイマー
  paused: false,
  frozen: [],     // 一時停止中に退避したタイマー { fn, remaining }

  set(fn, ms) {
    ms = ms || 0;
    if (this.paused) {
      // 一時停止中に登録された処理は、再開まで実行しない
      this.frozen.push({ fn, remaining: ms });
      return null;
    }
    const rec = { id: 0, fn, ms, startedAt: Date.now() };
    rec.id = setTimeout(() => {
      this.list = this.list.filter(x => x.id !== rec.id);
      fn();
    }, ms);
    this.list.push(rec);
    return rec.id;
  },

  clearAll() {
    this.list.forEach(rec => clearTimeout(rec.id));
    this.list = [];
    this.frozen = [];
  },

  /* 保留中の実タイマーを止め、残り時間を frozen に退避する。 */
  pause() {
    if (this.paused) return;   // 二重停止を防ぐ
    this.paused = true;
    const now = Date.now();
    this.list.forEach(rec => {
      clearTimeout(rec.id);
      const remaining = Math.max(0, rec.ms - (now - rec.startedAt));
      this.frozen.push({ fn: rec.fn, remaining });
    });
    this.list = [];
  },

  /* 退避したタイマーを残り時間で再登録する(二重登録しない)。 */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    const frozen = this.frozen;
    this.frozen = [];
    frozen.forEach(f => this.set(f.fn, f.remaining));
  }
};

(function () {
  const A = () => YM.Analyzer;
  const C = YM.CONST;

  const GS = {};

  function newPlayer(id, name, isHuman, characterId, cpuProfile) {
    return {
      id,                    // 0-3(席順。0=下=人間、1=右、2=上、3=左)
      name,
      isHuman,
      characterId,
      cpuProfile,            // 'offense' | 'balance' | 'defense' | null
      seatWind: 27,          // 局開始時に更新
      score: C.START_SCORE,
      hand: [],              // 手牌(ツモ牌除く)
      drawnTile: null,
      discards: [],          // 河 [{tile, riichiDecl, tsumogiri, called}]
      melds: [],             // 副露 [{type, tile, tiles, from, calledTile}]
      isRiichi: false,
      riichiPending: false,  // 宣言牌が通るまでの仮状態
      riichiTurn: -1,        // リーチ宣言時の自分の捨て牌数
      isFuriten: false,      // 永続フリテン(自分の河 or リーチ後見逃し)
      temporaryFuriten: false, // 同巡内フリテン(次の自分のツモで解除)
      ippatsuEligible: false,
      hasDiscarded: false,
      waits: []              // 現在の待ち牌キャッシュ
    };
  }

  /* ゲーム全体の状態 */
  GS.create = function (selectedCharacterIds) {
    const selected = YM.normalizeCharacterSelection(selectedCharacterIds);
    if (selected.length !== 3) {
      throw new Error('GameState requires exactly three valid character IDs.');
    }
    const cpuPlayers = selected.map((characterId, offset) => {
      const ch = YM.characterForId(characterId);
      if (!ch) throw new Error(`Unknown character ID: ${characterId}`);
      return newPlayer(offset + 1, ch.name, false, ch.id, ch.playStyle || 'balance');
    });
    const profile = YM.Storage && YM.Storage.data.playerProfile;
    const playerName = profile && typeof profile.name === 'string' && profile.name.trim()
      ? profile.name.trim().slice(0, 12) : 'あなた';
    return {
      roundWind: C.EAST,
      handNumber: 1,          // 東n局
      roundsCompleted: 0,     // 終了した局数(0の間は順位を表示しない)
      dealerIndex: 0,
      startingDealerIndex: null,
      currentPlayerIndex: 0,
      turnNumber: 0,
      honba: 0,
      riichiSticks: 0,        // 供託(本)
      wall: null,             // YM.Wall.build() の戻り値
      lastDiscard: null,      // {tile, player}
      lastDiscardPlayer: -1,
      phase: C.PHASE.IDLE,
      result: null,
      pendingCalls: null,     // 鳴き判定待ちの状態(call-manager管理)
      selectedCharacterIds: selected.slice(),
      players: [newPlayer(0, playerName, true, null, null), ...cpuPlayers],
      // UI用の一時状態
      selectedIndex: -1,
      riichiMode: false,
      riichiValidKinds: [],
      humanOptions: null,     // {tsumo, riichi, ankanKinds, kakanKinds}
      busy: false,
      // DEV
      devShowHands: false,
      devAutoPlay: false,
      devForcedDiscard: {},   // {playerIndex: kind} 次の打牌を強制
      cpuLog: [],
      gameOver: false,
      dialogueState: {
        totalTurns: 0,
        thinkingTarget: 1 + Math.floor(Math.random() * 2),
        thinkingShown: 0,
        nextThinkingTurn: 24 + Math.floor(Math.random() * 42),
        lastAmbientTurn: -20,
        liliSmokingShown: false,
        liliSmokingTurn: 48 + Math.floor(Math.random() * 38)
      }
    };
  };

  /* ===== ヘルパー ===== */
  GS.sortHand = function (hand) {
    hand.sort((a, b) => a.kind - b.kind || a.id - b.id);
  };

  GS.seatWindOf = function (G, idx) {
    return YM.seat.windOf(idx, G.dealerIndex);
  };

  GS.isDealer = (G, idx) => idx === G.dealerIndex;

  /* 役判定に渡す共通コンテキスト */
  GS.ctxFor = function (G, idx, flags) {
    const p = G.players[idx];
    return Object.assign({
      tsumo: false,
      riichi: p.isRiichi,
      ippatsu: p.isRiichi && p.ippatsuEligible,
      rinshan: false, haitei: false, houtei: false, chankan: false,
      seatWind: p.seatWind,
      roundWind: G.roundWind,
      doraKinds: YM.Wall.doraKinds(G.wall)
    }, flags || {});
  };

  /* あるプレイヤーから見えている牌のcounts(受け入れ計算用) */
  GS.visibleCounts = function (G, idx) {
    const c = new Array(34).fill(0);
    const add = t => { if (t) c[t.kind]++; };
    const p = G.players[idx];
    p.hand.forEach(add);
    add(p.drawnTile);
    for (const q of G.players) {
      q.discards.forEach(d => add(d.tile));
      for (const m of q.melds) m.tiles.forEach(add);
    }
    G.wall.doraIndicators.forEach(add);
    return c;
  };

  /* 待ち牌キャッシュとフリテンの更新(手牌13枚時に呼ぶ) */
  GS.updateWaits = function (G, idx) {
    const p = G.players[idx];
    const counts = A().toCounts(p.hand);
    p.waits = A().waitingTiles(counts, p.melds.length);
    // 自分の河に待ち牌があれば永続フリテン
    const riverFuriten = p.waits.some(w => p.discards.some(d => d.tile.kind === w));
    // リーチ後見逃しフリテンは riichiMissedRon フラグで別管理
    p.isFuriten = riverFuriten || !!p.riichiMissedRon;
  };

  /* 全体の点数順位(1-4)。同点は起家に近い方が上位 */
  GS.ranks = function (G) {
    const order = G.players.map((p, i) => ({ i, score: p.score }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const ranks = new Array(4);
    order.forEach((o, r) => { ranks[o.i] = r + 1; });
    return ranks;
  };

  GS.log = function (G, idx, text) {
    G.cpuLog.push(`[${G.turnNumber}] ${G.players[idx].name}: ${text}`);
    if (G.cpuLog.length > 200) G.cpuLog.splice(0, G.cpuLog.length - 200);
  };

  YM.GameState = GS;
})();
