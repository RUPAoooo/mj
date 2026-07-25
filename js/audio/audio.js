/* audio.js - Web Audio APIによる簡易効果音
 * 音声ファイルを assets/audio/ に置いて差し替えられるよう、
 * se(name) の入口を一本化してある。BGMは未実装(フックのみ)。 */
window.YM = window.YM || {};

(function () {
  const AU = {};
  let ctx = null;
  let master = null;
  let enabled = false;
  let bgmPlayer = null;
  let bgmSource = '';
  let bgmRequested = false;
  const BGM_VOLUME_SCALE = 0.5;

  AU.settings = { bgm: true, se: true, volume: 60 };

  // 初回のユーザー操作後に呼ぶ(自動再生制限対策)
  AU.unlock = function () {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.connect(ctx.destination);
      AU.applyVolume();
      enabled = true;
    } catch (e) {
      enabled = false;
    }
  };

  AU.applyVolume = function () {
    const normalized = Math.max(0, Math.min(100, Number(AU.settings.volume) || 0)) / 100;
    if (master) master.gain.value = normalized * 0.5;
    if (bgmPlayer) {
      bgmPlayer.volume = normalized * BGM_VOLUME_SCALE;
      bgmPlayer.dataset.volume = String(bgmPlayer.volume);
    }
    if (typeof applyGameBgmVolumes === 'function') applyGameBgmVolumes();
  };

  function ensureBgmPlayer() {
    if (bgmPlayer) return bgmPlayer;
    bgmPlayer = document.createElement('audio');
    bgmPlayer.id = 'ym-main-bgm';
    bgmPlayer.hidden = true;
    bgmPlayer.loop = true;
    bgmPlayer.preload = 'auto';
    bgmPlayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bgmPlayer);
    AU.applyVolume();
    return bgmPlayer;
  }

  AU.playBgm = function (src) {
    if (!src) return Promise.resolve(false);
    const player = ensureBgmPlayer();
    const absoluteSrc = new URL(src, document.baseURI).href;
    bgmRequested = true;

    if (bgmSource !== absoluteSrc) {
      player.pause();
      player.src = src;
      player.currentTime = 0;
      player.load();
      bgmSource = absoluteSrc;
    }

    AU.applyVolume();
    if (!AU.settings.bgm) {
      player.pause();
      return Promise.resolve(false);
    }
    return player.play().then(() => true).catch(() => false);
  };

  AU.stopBgm = function (forgetSource, keepGameBgm) {
    bgmRequested = false;
    if (!keepGameBgm && AU.stopGameBgm) AU.stopGameBgm();
    if (!bgmPlayer) return;
    bgmPlayer.pause();
    bgmPlayer.currentTime = 0;
    if (forgetSource !== false) {
      bgmPlayer.removeAttribute('src');
      bgmPlayer.load();
      bgmSource = '';
    }
  };

  AU.syncBgm = function () {
    AU.applyVolume();
    if (AU.syncGameBgm) AU.syncGameBgm();
    if (!bgmPlayer || !bgmRequested || !bgmSource) return;
    if (AU.settings.bgm) bgmPlayer.play().catch(() => {});
    else bgmPlayer.pause();
  };

  AU.getBgmState = function () {
    return {
      source: bgmSource,
      requested: bgmRequested,
      paused: bgmPlayer ? bgmPlayer.paused : true,
      loop: bgmPlayer ? bgmPlayer.loop : false,
      volume: bgmPlayer ? bgmPlayer.volume : 0
    };
  };

  /* ===== 対局中BGM(添付曲をランダム再生・クロスフェード) =====
   * ・assets/audio/bgm1〜4.mp3 をシャッフル順で連続再生する。
   * ・曲の頭はフェードイン、終わり際は次の曲へクロスフェードして
   *   つなぎ目が自然に聞こえるようにする。
   * ・音量設定/BGM ON/OFF は既存の settings と連動する。 */
  const GAME_BGM_TRACKS = [
    'assets/audio/bgm1.mp3',
    'assets/audio/bgm2.mp3',
    'assets/audio/bgm3.mp3',
    'assets/audio/bgm4.mp3'
  ];
  const GAME_BGM_FADE_SEC = 2.6;   // クロスフェード時間
  const GAME_BGM_TICK_MS = 60;

  let gameBgm = null; // { players:[a,b], active, queue:[], fading, timer }

  function gameBgmBaseVolume() {
    const normalized = Math.max(0, Math.min(100, Number(AU.settings.volume) || 0)) / 100;
    return normalized * BGM_VOLUME_SCALE;
  }

  function makeGameBgmPlayer(tag) {
    const el = document.createElement('audio');
    el.id = `ym-game-bgm-${tag}`;
    el.hidden = true;
    el.preload = 'auto';
    el.loop = false;
    el.setAttribute('aria-hidden', 'true');
    el.dataset.fade = '0';       // 0〜1 のフェード係数
    document.body.appendChild(el);
    return el;
  }

  function ensureGameBgm() {
    if (gameBgm) return gameBgm;
    gameBgm = {
      players: [makeGameBgmPlayer('a'), makeGameBgmPlayer('b')],
      active: 0,
      queue: [],
      fading: false,
      timer: null
    };
    return gameBgm;
  }

  function refillGameBgmQueue(excludeSrc) {
    const order = GAME_BGM_TRACKS.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // 直前の曲と同じ曲が続かないよう先頭だけ調整
    if (excludeSrc && order.length > 1 && excludeSrc.endsWith(order[0].split('/').pop())) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
  }

  function applyGameBgmVolumes() {
    if (!gameBgm) return;
    const base = gameBgmBaseVolume();
    gameBgm.players.forEach(p => {
      p.volume = Math.max(0, Math.min(1, base * (parseFloat(p.dataset.fade) || 0)));
    });
  }

  function startGameBgmTrack(playerIndex, fadeIn) {
    const g = ensureGameBgm();
    if (g.queue.length === 0) {
      const current = g.players[g.active] ? g.players[g.active].currentSrc : '';
      g.queue = refillGameBgmQueue(current);
    }
    const src = g.queue.shift();
    const p = g.players[playerIndex];
    p.src = src;
    p.currentTime = 0;
    p.dataset.fade = fadeIn ? '0' : '1';
    applyGameBgmVolumes();
    if (AU.settings.bgm) p.play().catch(() => {});
  }

  function gameBgmTick() {
    const g = gameBgm;
    if (!g) return;
    const cur = g.players[g.active];
    const other = g.players[1 - g.active];
    const step = (GAME_BGM_TICK_MS / 1000) / GAME_BGM_FADE_SEC;

    // フェードイン中の曲を持ち上げる
    [cur, other].forEach(p => {
      const target = p === cur ? 1 : 0;
      let f = parseFloat(p.dataset.fade) || 0;
      if (p === cur && f < 1) f = Math.min(1, f + step);
      if (p === other && !g.fading && f > 0) f = Math.max(0, f - step);
      p.dataset.fade = String(f);
    });

    // 曲の終わり際 → 次の曲へクロスフェード開始
    if (!g.fading && cur.duration && isFinite(cur.duration) &&
        cur.duration - cur.currentTime <= GAME_BGM_FADE_SEC) {
      g.fading = true;
      g.active = 1 - g.active;
      startGameBgmTrack(g.active, true);
    }

    // クロスフェード進行: 旧トラックを下げ、消えたら停止
    if (g.fading) {
      const old = g.players[1 - g.active];
      let of = parseFloat(old.dataset.fade) || 0;
      of = Math.max(0, of - step);
      old.dataset.fade = String(of);
      if (of <= 0) {
        old.pause();
        old.removeAttribute('src');
        old.load();
        g.fading = false;
      }
    }

    // 再生が止まったまま終端に達した場合の保険(タブ復帰など)
    if (cur.ended) {
      g.active = 1 - g.active;
      startGameBgmTrack(g.active, true);
    }

    applyGameBgmVolumes();
  }

  AU.playGameBgm = function () {
    // 準備画面のループBGMは止めて対局用プレイリストに切り替える
    AU.stopBgm(true, true);
    const g = ensureGameBgm();
    if (g.timer) clearInterval(g.timer);
    g.players.forEach(p => { p.pause(); p.dataset.fade = '0'; });
    g.queue = refillGameBgmQueue('');
    g.fading = false;
    g.active = 0;
    startGameBgmTrack(0, true); // フェードインで開始
    g.timer = setInterval(gameBgmTick, GAME_BGM_TICK_MS);
  };

  AU.stopGameBgm = function () {
    if (!gameBgm) return;
    if (gameBgm.timer) clearInterval(gameBgm.timer);
    gameBgm.timer = null;
    gameBgm.fading = false;
    gameBgm.players.forEach(p => {
      p.pause();
      p.removeAttribute('src');
      p.load();
      p.dataset.fade = '0';
    });
  };

  AU.syncGameBgm = function () {
    if (!gameBgm || !gameBgm.timer) return;
    const cur = gameBgm.players[gameBgm.active];
    if (AU.settings.bgm) { if (cur.src) cur.play().catch(() => {}); }
    else gameBgm.players.forEach(p => p.pause());
    applyGameBgmVolumes();
  };

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!enabled || !AU.settings.se) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol || 0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, delay) {
    if (!enabled || !AU.settings.se) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.2;
    src.connect(g).connect(master);
    src.start(t0);
  }

  const SE = {
    select:  () => tone(880, 0.05, 'square', 0.10),
    discard: () => { noise(0.06, 0.25); tone(220, 0.06, 'triangle', 0.2); },
    draw:    () => tone(660, 0.04, 'triangle', 0.10),
    decide:  () => { tone(660, 0.06, 'square', 0.12); tone(990, 0.08, 'square', 0.12, 0.06); },
    riichi:  () => { tone(440, 0.1, 'sawtooth', 0.16); tone(660, 0.12, 'sawtooth', 0.16, 0.1); tone(880, 0.2, 'sawtooth', 0.14, 0.2); },
    ron:     () => { tone(330, 0.12, 'sawtooth', 0.2); tone(220, 0.3, 'sawtooth', 0.2, 0.12); },
    tsumo:   () => { tone(523, 0.1, 'square', 0.15); tone(659, 0.1, 'square', 0.15, 0.1); tone(784, 0.2, 'square', 0.15, 0.2); },
    win:     () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.14, i * 0.13)); },
    lose:    () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'triangle', 0.16, i * 0.16)); },
    event:   () => { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.22, 'sine', 0.16, i * 0.15)); }
  };

  AU.se = function (name) {
    if (SE[name]) SE[name]();
  };

  YM.Audio = AU;
})();
