/* animation.js - 演出(カットイン・フラッシュ等) ※二人打ち版から再利用 */
window.YM = window.YM || {};

(function () {
  const An = {};

  function fxLayer() { return document.getElementById('fx-layer'); }
  function announcementLayer() { return document.getElementById('announcement-layer'); }

  function addFx(el, life, target) {
    const layer = target || fxLayer();
    if (!layer) return;
    layer.appendChild(el);
    YM.timers.set(() => { if (el.parentNode) el.parentNode.removeChild(el); }, life);
  }

  /* 大きな文字のカットイン(「立直」「ロン」「ツモ」など) */
  An.banner = function (text, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'fx-banner' + (opts.red ? ' red' : '');
    el.textContent = text;
    if (opts.size) el.style.fontSize = opts.size + 'px';
    addFx(el, opts.life || 1150);
  };

  /* ロン・ツモ・リーチ専用。キャラクターカットインより前面へ大きく表示する。 */
  An.announcement = function (word, opts) {
    opts = opts || {};
    const layer = announcementLayer();
    if (!layer) {
      An.banner(word, { red: true, life: opts.life || 1700, size: 150 });
      return;
    }
    layer.innerHTML = '';
    const el = document.createElement('div');
    el.className = `fx-announcement fx-announcement-${opts.type || 'call'}`;

    const speedLines = document.createElement('div');
    speedLines.className = 'fx-announcement-lines';
    const frame = document.createElement('div');
    frame.className = 'fx-announcement-frame';
    const main = document.createElement('div');
    main.className = 'fx-announcement-word';
    main.textContent = word;
    el.append(speedLines, frame, main);

    if (opts.actor) {
      const actor = document.createElement('div');
      actor.className = 'fx-announcement-actor';
      actor.textContent = opts.actor;
      el.appendChild(actor);
    }
    addFx(el, opts.life || 1700, layer);
  };

  An.flash = function () {
    const el = document.createElement('div');
    el.className = 'fx-flash';
    addFx(el, 520);
  };

  An.redSweep = function () {
    const el = document.createElement('div');
    el.className = 'fx-red-sweep';
    addFx(el, 720);
  };

  An.darken = function (life) {
    const el = document.createElement('div');
    el.className = 'fx-darken';
    addFx(el, life || 1600);
  };

  An.yakumanBg = function (life) {
    const el = document.createElement('div');
    el.className = 'fx-yakuman';
    addFx(el, life || 3000);
  };

  An.clear = function () {
    const layer = fxLayer();
    if (layer) layer.innerHTML = '';
    const cutin = document.getElementById('cutin-layer');
    if (cutin) cutin.innerHTML = '';
    const announcement = announcementLayer();
    if (announcement) announcement.innerHTML = '';
  };

  YM.Animation = An;
})();
