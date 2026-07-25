/* render.js - 対局画面の描画(4人麻雀版)
 * ゲーム状態(YM.Game.G)から一方向に描画する。DOMを状態として使わない。 */
window.YM = window.YM || {};

(function () {
  const UI = {};
  const $id = id => document.getElementById(id);
  const C = YM.CONST;
  const GS = () => YM.GameState;
  const TABLE_PORTRAITS = Object.freeze({
    ayano: 'assets/characters/ayano00.png',
    lili: 'assets/characters/lili00.png',
    masked: 'assets/characters/nazo00.png',
    tanabe: 'assets/characters/tanabe00.png',
    tome: 'assets/characters/tome00.png',
    mofuzo: 'assets/characters/chipon00.png'
  });

  /* ===== 画面切替 ===== */
  UI.showScreen = function (name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $id('screen-' + name);
    if (el) el.classList.add('active');
    // 画面遷移のたびに確認ダイアログを閉じる(前の画面の開きっぱなしを防ぐ)。
    ['data-confirm', 'start-confirm'].forEach(id => {
      const d = document.getElementById(id);
      if (d) d.classList.add('hidden');
    });
  };

  /* ===== 牌要素 ===== */
  UI.tileEl = function (kind, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'tile';
    if (opts.back) {
      el.classList.add('back');
    } else {
      const imgSrc = YM.Tiles.faceImg(kind);
      if (imgSrc) {
        // 数牌: 切り出しPNGを表示。読み込み失敗時はSVGへフォールバック
        el.classList.add('img-tile');
        const im = document.createElement('img');
        im.className = 'tile-img';
        im.src = imgSrc;
        im.alt = YM.Tiles.nameOf(kind);
        im.draggable = false;
        im.onerror = () => {
          el.classList.remove('img-tile');
          el.innerHTML = YM.Tiles.faceSVG(kind);
        };
        el.appendChild(im);
      } else {
        // 字牌: 従来のSVG表示
        el.innerHTML = YM.Tiles.faceSVG(kind);
      }
    }
    if (opts.small) el.classList.add('small');
    if (opts.mini) el.classList.add('mini');
    if (opts.cpu) el.classList.add('cpu');
    if (opts.vback) el.classList.add('vback');
    if (opts.classes) opts.classes.forEach(c => el.classList.add(c));
    return el;
  };

  /* ===== メイン描画 ===== */
  UI.renderGame = function (G) {
    renderCenterPlate(G);
    for (let i = 0; i < 4; i++) {
      renderHand(G, i);
      renderMelds(G, i);
      renderRiver(G, i);
      renderInfoCard(G, i);
    }
    renderButtons(G);
    renderGuide(G);
  };

  /* 親決め前の新規卓を空の状態で描き直し、前対局の表示を残さない。 */
  UI.resetGameTable = function (G) {
    [
      'player-hand', 'player-tsumo',
      'hand-1', 'hand-2', 'hand-3',
      'river-0', 'river-1', 'river-2', 'river-3',
      'melds-0', 'melds-1', 'melds-2', 'melds-3',
      'plate-dora'
    ].forEach(id => {
      const el = $id(id);
      if (el) el.replaceChildren();
    });
    $id('plate-kyoku').textContent = '東一局';
    $id('plate-honba').textContent = '0本場';
    $id('plate-sticks').textContent = '供託 0';
    $id('plate-wall').textContent = '山 --';
    for (let i = 0; i < 4; i++) {
      const arrow = $id(`turn-arrow-${i}`);
      if (arrow) {
        arrow.classList.remove('active');
        arrow.textContent = YM.CONST.WIND_NAMES[(i - G.dealerIndex + 4) % 4];
      }
      renderInfoCard(G, i);
    }
    renderButtons(G);
    renderGuide(G);
  };

  /* --- 中央プレート --- */
  function renderCenterPlate(G) {
    const kyokuKanji = ['一', '二', '三', '四'][G.handNumber - 1] || G.handNumber;
    $id('plate-kyoku').textContent = `東${kyokuKanji}局`;
    $id('plate-honba').textContent = `${G.honba}本場`;
    $id('plate-sticks').textContent = `供託 ${G.riichiSticks}`;
    $id('plate-wall').textContent = `山 ${YM.Wall.liveCount(G.wall)}`;

    const doraEl = $id('plate-dora');
    doraEl.innerHTML = '';
    G.wall.doraIndicators.forEach(t => {
      doraEl.appendChild(UI.tileEl(t.kind, { mini: true }));
    });

    // 手番マーカー(東南西北の位置表示)
    for (let i = 0; i < 4; i++) {
      const arrow = $id(`turn-arrow-${i}`);
      if (!arrow) continue;
      arrow.classList.toggle('active', G.currentPlayerIndex === i && G.phase !== C.PHASE.ENDED);
      arrow.textContent = YM.CONST.WIND_NAMES[(i - G.dealerIndex + 4) % 4];
    }
  }

  /* --- 手牌 --- */
  function renderHand(G, i) {
    const p = G.players[i];
    if (i === 0) {
      renderPlayerHand(G);
      return;
    }
    const el = $id(`hand-${i}`);
    el.innerHTML = '';
    const count = p.hand.length + (p.drawnTile ? 1 : 0);
    const vertical = (i === 1 || i === 3);
    if (G.devShowHands) {
      // DEV手牌公開: 縦置きCPUも表向きミニ牌で見せる
      p.hand.forEach(t => el.appendChild(UI.tileEl(t.kind, { cpu: true })));
      if (p.drawnTile) {
        const d = UI.tileEl(p.drawnTile.kind, { cpu: true });
        d.classList.add('drawn-gap');
        el.appendChild(d);
      }
    } else {
      for (let n = 0; n < count; n++) {
        el.appendChild(UI.tileEl(0, vertical ? { back: true, vback: true } : { back: true, cpu: true }));
      }
    }
  }

  function renderPlayerHand(G) {
    const p = G.players[0];
    const handEl = $id('player-hand');
    handEl.innerHTML = '';
    const interactive = G.phase === C.PHASE.HUMAN_TURN && !G.busy;
    p.hand.forEach((t, i) => {
      const el = UI.tileEl(t.kind);
      if (G.selectedIndex === i) el.classList.add('selected');
      if (G.riichiMode) {
        if (G.riichiValidKinds.includes(t.kind)) el.classList.add('riichi-ok');
        else el.classList.add('disabled');
      }
      if (p.isRiichi && interactive) el.classList.add('disabled');
      if (interactive) el.addEventListener('click', () => YM.Turn.onTileClick(i));
      handEl.appendChild(el);
    });
    const tsumoEl = $id('player-tsumo');
    tsumoEl.innerHTML = '';
    if (p.drawnTile) {
      const el = UI.tileEl(p.drawnTile.kind, { classes: ['drawn-in'] });
      if (G.selectedIndex === 'drawn') el.classList.add('selected');
      if (G.riichiMode && !G.riichiValidKinds.includes(p.drawnTile.kind)) el.classList.add('disabled');
      if (interactive) el.addEventListener('click', () => YM.Turn.onTileClick('drawn'));
      tsumoEl.appendChild(el);
    }
  }

  /* --- 副露 --- */
  function orderedMeldTiles(m, callerIndex) {
    const tiles = m.tiles.slice();
    if (!m.calledTile || m.from == null) return { tiles, source: '' };

    const calledIndex = tiles.findIndex(t => t.id === m.calledTile.id);
    if (calledIndex < 0) return { tiles, source: '' };

    const [called] = tiles.splice(calledIndex, 1);
    const relation = (m.from - callerIndex + 4) % 4;
    let source = '';
    let insertAt = calledIndex;

    if (relation === 3) {
      source = 'kamicha';
      insertAt = 0;
    } else if (relation === 1) {
      source = 'shimocha';
      insertAt = tiles.length;
    } else if (relation === 2) {
      source = 'toimen';
      insertAt = Math.floor(tiles.length / 2);
    }

    tiles.splice(insertAt, 0, called);
    return { tiles, source };
  }

  function renderMelds(G, i) {
    const el = $id(`melds-${i}`);
    el.innerHTML = '';
    for (const m of G.players[i].melds) {
      const group = document.createElement('div');
      group.className = 'meld-group';
      if (m.type === 'ankan') {
        // 暗槓は両端伏せ
        group.appendChild(UI.tileEl(0, { back: true, mini: true }));
        group.appendChild(UI.tileEl(m.tile, { mini: true }));
        group.appendChild(UI.tileEl(m.tile, { mini: true }));
        group.appendChild(UI.tileEl(0, { back: true, mini: true }));
      } else {
        const ordered = orderedMeldTiles(m, i);
        if (ordered.source) {
          group.classList.add(`call-from-${ordered.source}`);
          group.dataset.callSource = ordered.source;
        }
        ordered.tiles.forEach(t => {
          const opts = { mini: true, classes: [] };
          if (m.calledTile && t.id === m.calledTile.id) opts.classes.push('called-tile');
          group.appendChild(UI.tileEl(t.kind, opts));
        });
      }
      el.appendChild(group);
    }
  }

  /* --- 河 ---
   * 6枚ごとに「段」(.river-row)へまとめる。段ごとに独立してプレーヤーの
   * 左から詰めるので、リーチの横倒し牌があってもその段だけが広がり、
   * 他の段に隙間ができない。19枚目以降は3段目に続けて置く。 */
  function renderRiver(G, i) {
    const el = $id(`river-${i}`);
    el.innerHTML = '';
    const p = G.players[i];
    let row = null;
    p.discards.forEach((d, n) => {
      if (n % 6 === 0 && n < 18) {
        row = document.createElement('div');
        row.className = `river-row r${n / 6 + 1}`;
        el.appendChild(row);
      }
      const opts = { mini: true, classes: [] };
      if (d.riichiDecl) opts.classes.push('riichi-decl');
      if (d.called) opts.classes.push('called-out');
      if (n === p.discards.length - 1 && G.lastDiscardPlayer === i && !d.called) opts.classes.push('last-discard');
      row.appendChild(UI.tileEl(d.tile.kind, opts));
    });
  }

  /* --- 情報カード --- */
  function renderInfoCard(G, i) {
    const p = G.players[i];
    const card = $id(`card-${i}`);
    if (!card) return;
    card.dataset.characterId = p.isHuman ? 'player' : p.characterId;
    card.dataset.cpuProfile = p.cpuProfile || '';
    const ranks = GS().ranks(G);
    card.classList.toggle('active', G.currentPlayerIndex === i && G.phase !== C.PHASE.ENDED);
    card.classList.toggle('riichi', p.isRiichi || p.riichiPending);

    // 対局カードは選択キャラクターの専用透過立ち絵を使用する。
    // 自分だけは既存のプロフィールアバターをそのまま引き継ぐ。
    const face = $id(`card-face-${i}`);
    const faceKey = p.isHuman
      ? `human:${YM.Storage.data.playerProfile && YM.Storage.data.playerProfile.avatar || ''}`
      : String(p.characterId);
    if (face && face.dataset.char !== faceKey) {
      face.dataset.char = faceKey;
      const portrait = !p.isHuman && TABLE_PORTRAITS[p.characterId];
      face.innerHTML = portrait
        ? `<img class="table-character-portrait" src="${portrait}" alt="${p.name}" draggable="false">`
        : YM.CharacterUI.faceIconHTML(p.characterId);
    }

    $id(`card-name-${i}`).textContent = p.name;
    $id(`card-score-${i}`).textContent = p.score;
    const rankEl = $id(`card-rank-${i}`);
    rankEl.textContent = `${ranks[i]}位`;
    // (8) 開局直後は順位を出さず、1局終わってから表示する。
    rankEl.classList.toggle('hidden', !(G.roundsCompleted > 0));
    $id(`card-wind-${i}`).textContent = YM.Tiles.nameOf(p.seatWind);
    $id(`card-dealer-${i}`).classList.toggle('hidden', !GS().isDealer(G, i));
    $id(`card-riichi-${i}`).classList.toggle('hidden', !(p.isRiichi || p.riichiPending));
    // (2) 起家マークはカード内ではなく卓上(#table-chicha-N)に表示する。
    const tableChicha = $id(`table-chicha-${i}`);
    if (tableChicha) {
      const isStartingDealer = Number.isInteger(G.startingDealerIndex) && G.startingDealerIndex === i;
      tableChicha.classList.toggle('hidden', !isStartingDealer);
      tableChicha.src = G.roundWind === C.SOUTH
        ? 'assets/ui/seat/chicha-south.png'
        : 'assets/ui/seat/chicha-east.png';
    }
  }

  /* --- 操作ボタン --- */
  function renderButtons(G) {
    const show = (id, on, glow) => {
      const el = $id(id);
      el.classList.toggle('hidden', !on);
      el.classList.toggle('glow', !!glow);
    };
    const setAction = (id, available, label) => {
      const el = $id(id);
      const enabled = !!available;
      el.classList.remove('hidden');
      el.classList.toggle('is-available', enabled);
      el.classList.toggle('glow', enabled);
      el.disabled = !enabled;
      el.setAttribute('aria-disabled', String(!enabled));
      el.setAttribute('aria-label', enabled ? label : `${label}（現在は選択できません）`);
    };
    const o = G.humanOptions;
    const humanTurn = G.phase === C.PHASE.HUMAN_TURN && !G.busy;
    const pc = G.pendingCalls;
    const calling = G.phase === C.PHASE.CALLS && pc;
    const myCall = calling ? pc.options.find(x => x.player === 0) : null;

    const canTsumo = humanTurn && o && !!o.tsumo;
    const canRiichi = !!G.riichiMode || (humanTurn && o && o.riichiKinds && o.riichiKinds.length > 0 && !G.players[0].isRiichi);
    const canKan = (humanTurn && o && ((o.ankanKinds && o.ankanKinds.length > 0) || (o.kakanKinds && o.kakanKinds.length > 0))) ||
      (calling && myCall && !!myCall.minkan);
    const canRon = calling && myCall && !!myCall.ron;
    const canPon = calling && myCall && !!myCall.pon && pc.mode === 'discard';
    const canChi = calling && myCall && myCall.chiVariants && myCall.chiVariants.length > 0;

    setAction('btn-tsumo', canTsumo, 'ツモ');
    setAction('btn-riichi', canRiichi, G.riichiMode ? 'リーチ選択をやめる' : 'リーチ');
    $id('btn-riichi').textContent = G.riichiMode ? 'やめる' : 'リーチ';
    $id('btn-riichi').classList.toggle('is-cancel', !!G.riichiMode);
    setAction('btn-kan', canKan, 'カン');
    setAction('btn-ron', canRon, 'ロン');
    setAction('btn-pon', canPon, 'ポン');
    setAction('btn-chi', canChi, 'チー');
    show('btn-minkan', false, false);
    const canPass = !!(
      G.riichiMode ||
      (calling && myCall) ||
      (humanTurn && o && !!o.tsumo && G.players[0].isRiichi)
    );
    const gameScreen = $id('screen-game');
    if (gameScreen) gameScreen.classList.toggle('is-pass-ready', canPass);
  }

  function renderGuide(G) {
    let text = '';
    const p = G.players[G.currentPlayerIndex];
    if (G.phase === C.PHASE.HUMAN_TURN) {
      if (G.riichiMode) text = '光っている牌を選んでリーチ宣言';
      else if (G.players[0].isRiichi) text = 'リーチ中は自動で進みます';
      else if (G.humanOptions && G.humanOptions.afterCall) text = '鳴いた後の捨て牌を選んでください';
      else text = '牌をクリックで選択、もう一度クリックで捨てる';
    } else if (G.phase === C.PHASE.CALLS) {
      text = '鳴きますか？　ボタン以外をクリックでパス';
    } else if (G.phase === C.PHASE.CPU_TURN && p && !p.isHuman) {
      text = `${p.name} が考えています……`;
    }
    $id('info-guide').textContent = text;
  }

  /* ===== チー候補の選択UI ===== */
  UI.showChiSelect = function (variants, calledKind) {
    const box = $id('chi-select');
    const list = $id('chi-select-list');
    list.innerHTML = '';
    variants.forEach(base => {
      const btn = document.createElement('button');
      btn.className = 'chi-option';
      for (let k = base; k < base + 3; k++) {
        const t = UI.tileEl(k, { small: true });
        if (k === calledKind) t.classList.add('called-tile');
        btn.appendChild(t);
      }
      btn.addEventListener('click', () => {
        YM.Calls.onHumanDecision({ type: 'chi', chi: base });
      });
      list.appendChild(btn);
    });
    box.classList.remove('hidden');
  };

  UI.hideChiSelect = function () {
    const box = $id('chi-select');
    if (box) box.classList.add('hidden');
  };

  YM.UI = UI;
})();
