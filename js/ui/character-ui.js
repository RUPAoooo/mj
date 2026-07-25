/* character-ui.js - 情報カード・開始挨拶・イベントカットイン */
window.YM = window.YM || {};

(function () {
  const CU = {};
  const $id = id => document.getElementById(id);
  const failedImg = new Set();

  /* ポートレートを要素へ描画(画像 > SVG > イニシャル) */
  CU.setPortraitInto = function (el, charId, expr) {
    const canonicalId = YM.resolveCharacterId(charId);
    const ch = YM.characterForId(canonicalId);
    el.innerHTML = '';
    if (canonicalId) el.dataset.characterId = canonicalId;
    else delete el.dataset.characterId;
    if (!ch) return;
    if (ch.placeholder || !ch.images || !ch.images.normal) {
      el.innerHTML = monogram(ch);
      return;
    }
    const file = ch.images[expr] || ch.images.normal;
    if (!file) { el.innerHTML = YM.characterArt(expr); return; }
    const url = ch.imgBase + file;
    if (failedImg.has(url)) { el.innerHTML = YM.characterArt(expr); return; }
    const img = new Image();
    img.alt = ch.name;
    img.className = 'character-image';
    img.onload = () => { el.innerHTML = ''; el.appendChild(img); };
    img.onerror = () => { failedImg.add(url); el.innerHTML = YM.characterArt(expr); };
    img.src = url;
  };

  /* 仮キャラ用: 上品なイニシャルのモノグラム */
  function monogram(ch) {
    return `<div class="monogram" style="--accent:${ch.accent || '#b08d4a'}">
      <span>${ch.initial || '?'}</span>
    </div>`;
  }
  CU.monogram = monogram;

  CU.buildCharacterSelect = function (initialIds) {
    const grid = $id('character-grid');
    let selected = YM.normalizeCharacterSelection(initialIds);
    const cards = Array.from(grid.querySelectorAll('.prep-opponent'));

    cards.forEach(card => {
      const id = YM.resolveCharacterId(card.dataset.characterId);
      if (!id) throw new Error(`Invalid preparation card character ID: ${card.dataset.characterId}`);
      card.dataset.characterId = id;
    });

    function renderSelection() {
      cards.forEach(card => {
        const isSelected = selected.includes(card.dataset.characterId);
        card.classList.toggle('selected', isSelected);
        card.setAttribute('aria-pressed', String(isSelected));
      });
      $id('selection-count').textContent = `${selected.length} / 3`;
      document.dispatchEvent(new CustomEvent('ym:opponents-changed', { detail: selected.slice() }));
    }

    cards.forEach(card => {
      card.onclick = () => {
        const id = YM.resolveCharacterId(card.dataset.characterId);
        const pos = selected.indexOf(id);
        if (pos >= 0) selected.splice(pos, 1);
        else if (selected.length < 3) selected.push(id);
        renderSelection();
      };
    });
    renderSelection();
    return {
      getSelected: () => selected.slice(),
      randomize() {
        const ids = YM.CHARACTER_ORDER.slice();
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        selected = ids.slice(0, 3);
        renderSelection();
      }
    };
  };

  /* 顔アイコン(情報カード用) */
  CU.faceIconHTML = function (charId) {
    const ch = YM.characterForId(charId);
    if (!ch) {
      const avatar = YM.Storage && YM.Storage.data.playerProfile
        ? YM.Storage.data.playerProfile.avatar : '';
      return avatar
        // 対局カードでは背景を透過させた -table.png を使う（CPUの *00.png と同じ扱い）。
        // 選択画面(prep)側は高解像度の元画像 avatar-N.png をそのまま使うため、
        // ここでの差し替えは対局中の立ち絵にのみ影響する。
        ? `<div class="face-icon human player-avatar ${avatar}" aria-label="プレイヤーのアバター"><img class="player-avatar-image" src="assets/ui/avatars/${avatar}-table.png" alt="" draggable="false"></div>`
        : '<div class="face-icon human">私</div>';
    }
    if (ch.placeholder || !ch.images || !ch.images.normal) {
      return `<div class="face-icon" style="--accent:${ch.accent}">${ch.initial}</div>`;
    }
    return `<div class="face-icon img"><img src="${ch.imgBase}${ch.images.normal}" alt="${ch.name}"
      onerror="this.parentNode.innerHTML='${ch.shortName[0]}'"></div>`;
  };

  /* ===== 大きな立ち絵カットイン =====
   * situation: dialogues.js のキー。 opts: {banner, speaker(席index), life} */
  CU.cutin = function (charId, situation, opts) {
    opts = opts || {};
    const layer = $id('cutin-layer');
    if (!layer) return;
    charId = YM.resolveCharacterId(charId);
    const d = YM.Dialogue.pick(charId, situation);
    const ch = YM.characterForId(charId);
    if (!d && !opts.banner) return;

    const effect = opts.effect || CU.effectFor(charId, situation);
    const el = document.createElement('div');
    el.className = `cutin cutin-${situation}${effect ? ` effect-${effect}` : ''}`;
    if (charId) el.dataset.characterId = charId;
    const shade = document.createElement('div');
    shade.className = 'cutin-shade';
    el.appendChild(shade);
    if (effect) {
      const fx = document.createElement('div');
      fx.className = 'cutin-event-fx';
      const particleCount = effect === 'petals' ? 38 : effect === 'smoke' ? 14 : 18;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('i');
        if (effect === 'petals') {
          particle.style.setProperty('--x', `${Math.random() * 100}%`);
          particle.style.setProperty('--size', `${8 + Math.random() * 11}px`);
          particle.style.setProperty('--duration', `${3.2 + Math.random() * 3.6}s`);
          particle.style.setProperty('--delay', `${-Math.random() * 6}s`);
          particle.style.setProperty('--drift-a', `${-55 + Math.random() * 110}px`);
          particle.style.setProperty('--drift-b', `${-90 + Math.random() * 180}px`);
          particle.style.setProperty('--drift-c', `${-125 + Math.random() * 250}px`);
          particle.style.setProperty('--flutter', `${.65 + Math.random() * 1.1}s`);
          particle.style.setProperty('--turn', `${300 + Math.random() * 620}deg`);
          particle.style.setProperty('--alpha', `${.48 + Math.random() * .42}`);
        } else if (effect === 'smoke') {
          particle.style.setProperty('--x', `${33 + Math.random() * 8}%`);
          particle.style.setProperty('--y', `${50 + Math.random() * 8}%`);
          particle.style.setProperty('--size', `${22 + Math.random() * 34}px`);
          particle.style.setProperty('--duration', `${3.6 + Math.random() * 2.8}s`);
          particle.style.setProperty('--delay', `${-Math.random() * 5}s`);
          particle.style.setProperty('--drift', `${75 + Math.random() * 170}px`);
          particle.style.setProperty('--rise', `${-150 - Math.random() * 150}px`);
        }
        fx.appendChild(particle);
      }
      el.appendChild(fx);
    }
    const panel = document.createElement('div');
    panel.className = 'cutin-panel';
    const portrait = document.createElement('div');
    portrait.className = 'cutin-portrait';
    if (ch) CU.setPortraitInto(portrait, charId, d ? d.expr : 'normal');
    const box = document.createElement('div');
    box.className = 'cutin-box';
    box.innerHTML =
      (opts.banner ? `<div class="cutin-banner">${opts.banner}</div>` : '') +
      (ch ? `<div class="cutin-name">${ch.name}</div>` : '') +
      (d ? `<div class="cutin-line">${d.text}</div>` : '');
    panel.appendChild(portrait);
    panel.appendChild(box);
    el.appendChild(panel);
    layer.innerHTML = '';
    layer.appendChild(el);
    YM.timers.set(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (opts.onEnd) opts.onEnd();
    }, opts.life || 2600);

    // 情報カードの吹き出しにも反映
    if (d && opts.speaker != null) CU.sayOnCard(opts.speaker, d.text);
  };

  CU.isShowing = function () {
    const layer = $id('cutin-layer');
    return !!(layer && layer.firstElementChild);
  };

  CU.effectFor = function (charId, situation) {
    if (charId === 'masked' && situation === 'bigLoss') return 'lightning';
    if (charId === 'masked' && (situation === 'bigWin' || situation === 'cpuWin')) return 'petals';
    if ((charId === 'tanabe' || charId === 'tome') && situation === 'bigWin') return 'buzz';
    if (charId === 'lili' && situation === 'smoking') return 'smoke';
    if (situation === 'special') return 'sparkle';
    return '';
  };

  /* 添付レイアウト: 対局開始時は選択した3人を横並びで紹介する。 */
  CU.showOpening = function (game, onDone) {
    const layer = $id('start-greeting-layer');
    const cards = $id('start-greeting-cards');
    cards.innerHTML = '';
    game.players.filter(p => !p.isHuman).forEach((player, order) => {
      const ch = YM.CHARACTERS[player.characterId];
      const d = YM.Dialogue.pick(player.characterId, 'opening');
      const card = document.createElement('article');
      card.className = 'start-greeting-card';
      card.dataset.characterId = player.characterId;
      card.dataset.cpuProfile = player.cpuProfile;
      card.style.setProperty('--delay', `${order * 120}ms`);
      const portrait = document.createElement('div');
      portrait.className = 'start-greeting-portrait';
      CU.setPortraitInto(portrait, player.characterId, d ? d.expr : 'opening');
      const seatLabel = ['右席', '対面', '左席'][order];
      const copy = document.createElement('div');
      copy.className = 'start-greeting-copy';
      copy.innerHTML = `<span>${seatLabel}</span><strong>${ch.name}</strong><p>${d ? d.text : 'よろしくお願いします。'}</p>`;
      card.append(portrait, copy);
      cards.appendChild(card);
    });
    const close = $id('start-greeting-close');
    close.onclick = () => {
      YM.Audio.se('decide');
      layer.classList.add('hidden');
      close.onclick = null;
      onDone();
    };
    layer.classList.remove('hidden');
  };

  /* 半荘相当で1～2回。CPUの思考を4秒止め、専用表情とセリフを出す。 */
  CU.maybeThinking = function (game, seatIdx, onDone) {
    const state = game.dialogueState;
    const player = game.players[seatIdx];
    if (!state || player.isHuman || state.thinkingShown >= state.thinkingTarget ||
        state.totalTurns < state.nextThinkingTurn || CU.isShowing()) return false;
    state.thinkingShown++;
    state.nextThinkingTurn += 70 + Math.floor(Math.random() * 55);
    CU.cutin(player.characterId, 'thinking', {
      speaker: seatIdx,
      banner: '思案中…',
      life: 4000,
      onEnd: onDone
    });
    return true;
  };

  /* リリが参加している対局では、中盤の本人の手番に一度だけ一服する。 */
  CU.maybeLiliSmoking = function (game, seatIdx, onDone) {
    const state = game.dialogueState;
    const player = game.players[seatIdx];
    if (!state || !player || player.characterId !== 'lili' || state.liliSmokingShown ||
        state.totalTurns < state.liliSmokingTurn || CU.isShowing()) return false;
    state.liliSmokingShown = true;
    state.lastAmbientTurn = state.totalTurns;
    CU.cutin('lili', 'smoking', {
      speaker: seatIdx,
      banner: 'SMOKE BREAK',
      effect: 'smoke',
      life: 4800,
      onEnd: onDone
    });
    return true;
  };

  CU.maybeAmbient = function (game, seatIdx) {
    const state = game.dialogueState;
    if (!state || CU.isShowing() || state.totalTurns - state.lastAmbientTurn < 12 || Math.random() > 0.055) return;
    const player = game.players[seatIdx];
    if (!player || player.isHuman) return;
    state.lastAmbientTurn = state.totalTurns;
    // special は役満成立時専用。通常進行中のランダム会話には混ぜない。
    CU.cutin(player.characterId, 'idle', { speaker: seatIdx, life: 2400 });
  };

  /* 情報カードの短いセリフ */
  CU.sayOnCard = function (seatIdx, text) {
    const el = $id(`card-line-${seatIdx}`);
    if (!el) return;
    el.textContent = text;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  };

  /* ===== 勝利イベントシーン(綾乃・二人打ち版から再利用) ===== */
  CU.runEvent = function (charId, lines, onFinish) {
    YM.UI.showScreen('event');
    const textEl = $id('event-text');
    const nameEl = $id('event-name');
    const charEl = $id('event-char');
    const choices = $id('event-choices');
    choices.classList.add('hidden');
    let idx = 0;

    function showLine() {
      const L = lines[idx];
      CU.setPortraitInto(charEl, charId, L.expr);
      nameEl.style.visibility = L.narration ? 'hidden' : 'visible';
      textEl.textContent = L.line;
      $id('event-next-mark').style.display = idx < lines.length - 1 ? '' : 'none';
    }

    function advance() {
      if (idx < lines.length - 1) {
        idx++;
        YM.Audio.se('select');
        showLine();
      } else {
        $id('event-textbox').onclick = null;
        onFinish();
      }
    }

    $id('event-textbox').onclick = advance;
    showLine();
  };

  CU.showEventChoices = function () {
    $id('event-choices').classList.remove('hidden');
  };

  /* ===== ギャラリー(綾乃のみ・再利用) ===== */
  const GALLERY_ITEMS = [
    { id: 'normal', label: '綾乃/通常', expr: 'normal', free: true },
    { id: 'smile', label: '綾乃/微笑', expr: 'smile', free: true },
    { id: 'surprised', label: '綾乃/驚き', expr: 'surprised', free: true },
    { id: 'annoyed', label: '綾乃/不満', expr: 'annoyed', free: true },
    { id: 'blush', label: '綾乃/照れ', expr: 'blush', free: true },
    { id: 'defeat01', label: '綾乃/敗北', expr: 'defeat01', unlock: 'event01' },
    { id: 'defeat02', label: '綾乃/動揺', expr: 'defeat02', unlock: 'event01' },
    { id: 'event01', label: '勝利イベント', expr: 'event01', unlock: 'event01' }
  ];

  CU.buildGallery = function () {
    const grid = $id('gallery-grid');
    grid.innerHTML = '';
    const unlocked = YM.Storage.data.unlockedEvents;
    GALLERY_ITEMS.forEach(item => {
      const cell = document.createElement('div');
      cell.className = 'gallery-item';
      const isOpen = item.free || unlocked.includes(item.unlock);
      if (isOpen) {
        CU.setPortraitInto(cell, 'ayano', item.expr);
        const label = document.createElement('div');
        label.className = 'g-label';
        label.textContent = item.label;
        cell.appendChild(label);
        cell.addEventListener('click', () => {
          YM.Audio.se('decide');
          CU.setPortraitInto($id('gallery-viewer-img'), 'ayano', item.expr);
          $id('gallery-viewer').classList.remove('hidden');
        });
      } else {
        cell.classList.add('locked');
        cell.innerHTML = '<div class="lock-mark">🔒</div>';
        const label = document.createElement('div');
        label.className = 'g-label';
        label.textContent = '? ? ?';
        cell.appendChild(label);
      }
      grid.appendChild(cell);
    });
  };

  YM.CharacterUI = CU;
})();
