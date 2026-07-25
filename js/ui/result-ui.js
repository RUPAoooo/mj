/* result-ui.js - 和了・流局・最終結果の表示 */
window.YM = window.YM || {};

(function () {
  const R = {};
  const $id = id => document.getElementById(id);
  const G = () => YM.Game.G;

  /* ===== 和了結果 ===== */
  R.showWin = function (opts) {
    const ov = $id('result-overlay');
    $id('result-banner').textContent = opts.banner || '';

    // 手牌+副露+和了牌
    const handEl = $id('result-hand');
    handEl.innerHTML = '';
    (opts.handTiles || []).forEach(k => handEl.appendChild(YM.UI.tileEl(k, { small: true })));
    (opts.melds || []).forEach(m => {
      const spacer = document.createElement('div');
      spacer.className = 'result-meld-gap';
      handEl.appendChild(spacer);
      const tiles = m.type === 'ankan'
        ? [null, m.tile, m.tile, null]
        : m.tiles.map(t => t.kind);
      tiles.forEach(k => {
        handEl.appendChild(k == null
          ? YM.UI.tileEl(0, { small: true, back: true })
          : YM.UI.tileEl(k, { small: true }));
      });
    });
    if (opts.winKind != null) {
      const w = YM.UI.tileEl(opts.winKind, { small: true });
      w.style.marginLeft = '10px';
      w.style.outline = '2px solid var(--crimson)';
      handEl.appendChild(w);
    }

    // 役リスト
    const listEl = $id('result-yaku-list');
    listEl.innerHTML = '';
    (opts.yakuList || []).forEach((y, i) => {
      const row = document.createElement('div');
      row.className = 'yaku-row';
      row.style.animationDelay = (0.25 + i * 0.25) + 's';
      row.innerHTML = `<span>${y.name}</span><span>${y.han >= 13 ? '役満' : y.han + '翻'}</span>`;
      listEl.appendChild(row);
    });
    if (opts.doraCount > 0) {
      const row = document.createElement('div');
      row.className = 'yaku-row';
      row.style.animationDelay = (0.25 + (opts.yakuList || []).length * 0.25) + 's';
      row.innerHTML = `<span>ドラ</span><span>${opts.doraCount}翻</span>`;
      listEl.appendChild(row);
    }
    if (opts.uraCount > 0) {
      const row = document.createElement('div');
      row.className = 'yaku-row';
      row.style.animationDelay = (0.3 + (opts.yakuList || []).length * 0.25) + 's';
      row.innerHTML = `<span>裏ドラ</span><span>${opts.uraCount}翻</span>`;
      listEl.appendChild(row);
    }

    // 点数表示
    const rankTag = opts.rank ? `<span class="score-rank">${opts.rank}</span>` : '';
    const fuHan = opts.yakuman ? '役満' : `${opts.fu}符${opts.han}翻`;
    $id('result-score').innerHTML = `${rankTag}${fuHan}  ${opts.payText}点`;

    // 4人の点数変動
    renderDeltas($id('result-deltas'), opts.deltas);

    // はじめてシリーズのバッジ / カメラ保存ボタン
    renderNewRecords(opts.newFirsts);
    setupAlbumButton(opts.albumEntry);

    $id('result-next').onclick = () => {
      ov.classList.add('hidden');
      if (opts.onNext) opts.onNext();
    };
    ov.classList.remove('hidden');
  };

  /* ===== NEW RECORD(はじめてシリーズ)のバッジ =====
   * 和了結果画面内の小さな帯として表示する。同時達成はすべて並べる。 */
  function renderNewRecords(ids) {
    const el = $id('result-records');
    if (!el) return;
    el.innerHTML = '';
    if (!ids || !ids.length) { el.classList.add('hidden'); return; }
    const label = document.createElement('span');
    label.className = 'record-label';
    label.textContent = 'NEW RECORD';
    el.appendChild(label);
    ids.forEach(id => {
      const b = document.createElement('span');
      b.className = 'record-badge';
      b.textContent = YM.Storage.firstLabel(id);
      el.appendChild(b);
    });
    el.classList.remove('hidden');
  }

  /* ===== カメラ(アルバム保存)ボタン =====
   * プレイヤー本人の和了のみ表示。CPU の和了では非表示。 */
  function setupAlbumButton(entry) {
    const btn = $id('result-album-btn');
    const toast = $id('result-toast');
    if (!btn) return;
    if (toast) { toast.classList.add('hidden'); toast.textContent = ''; }

    if (!entry) { btn.classList.add('hidden'); return; }
    btn.classList.remove('hidden');

    const alreadySaved = YM.Storage.albumHas(entry.id);
    setAlbumButtonState(btn, alreadySaved ? 'saved' : 'idle');

    btn.onclick = () => {
      if (btn.dataset.state === 'saved') return;   // 二重保存させない
      const res = YM.Storage.albumAdd(entry);
      if (res.ok) {
        YM.Audio.se('select');
        setAlbumButtonState(btn, 'saved');
        showToast('和了アルバムに保存しました');
      } else if (res.reason === 'duplicate') {
        setAlbumButtonState(btn, 'saved');
        showToast('この和了は保存済みです');
      } else if (res.reason === 'full') {
        showToast('和了アルバムがいっぱいです。不要な記録を削除してから保存してください', true);
      } else {
        showToast('記録を保存できませんでした。ブラウザの保存容量を確認してください', true);
      }
    };
  }

  function setAlbumButtonState(btn, state) {
    btn.dataset.state = state;
    const saved = state === 'saved';
    btn.classList.toggle('is-saved', saved);
    btn.disabled = saved;
    btn.setAttribute('aria-label', saved ? 'この和了は保存済みです' : 'この和了を和了アルバムに保存');
    const text = btn.querySelector('.album-btn-text');
    if (text) text.textContent = saved ? '保存済み' : 'ALBUM';
  }

  function showToast(message, isError) {
    const toast = $id('result-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('hidden'), 2600);
  }

  /* ===== 流局結果 ===== */
  R.showRyuukyoku = function (opts) {
    const ov = $id('result-overlay');
    $id('result-banner').textContent = '流 局';
    $id('result-hand').innerHTML = '';
    const listEl = $id('result-yaku-list');
    listEl.innerHTML = '';
    const g = G();
    g.players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'yaku-row';
      row.style.animationDelay = (0.2 + i * 0.15) + 's';
      row.innerHTML = `<span>${p.name}</span><span>${opts.tenpai[i] ? 'テンパイ' : 'ノーテン'}</span>`;
      listEl.appendChild(row);
    });
    $id('result-score').textContent = 'ノーテン罰符';
    renderDeltas($id('result-deltas'), opts.deltas);
    // 流局ではアルバム保存も NEW RECORD も出さない
    renderNewRecords(null);
    setupAlbumButton(null);
    $id('result-next').onclick = () => {
      ov.classList.add('hidden');
      if (opts.onNext) opts.onNext();
    };
    ov.classList.remove('hidden');
  };

  function renderDeltas(el, deltas) {
    el.innerHTML = '';
    if (!deltas) return;
    const g = G();
    g.players.forEach((p, i) => {
      const d = deltas[i];
      const row = document.createElement('div');
      row.className = 'delta-row';
      row.innerHTML = `<span>${p.name}</span>` +
        `<span class="${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d > 0 ? '+' : ''}${d}</span>` +
        `<span>${p.score}</span>`;
      el.appendChild(row);
    });
  }

  /* ===== 最終結果(順位) ===== */
  R.showFinal = function (reason) {
    const g = G();
    const St = YM.Storage;
    const ranks = YM.GameState.ranks(g);
    const order = g.players.map((p, i) => ({ p, i, rank: ranks[i] }))
      .sort((a, b) => a.rank - b.rank);

    const ov = $id('final-overlay');
    $id('final-title').textContent = reason === 'tobi' ? '飛び終了' : '東風戦 終了';
    const listEl = $id('final-ranking');
    listEl.innerHTML = '';
    order.forEach(o => {
      const pt = (o.p.score - YM.CONST.RETURN_SCORE) / 1000;
      const row = document.createElement('div');
      row.className = 'final-row' + (o.i === 0 ? ' me' : '');
      row.innerHTML =
        `<span class="final-rank">${o.rank}位</span>` +
        `<span class="final-name">${o.p.name}</span>` +
        `<span class="final-score">${o.p.score}点</span>` +
        `<span class="final-pt">${pt >= 0 ? '+' : ''}${pt.toFixed(1)}pt</span>`;
      listEl.appendChild(row);
    });

    St.data.gamesPlayed++;
    const playerWon = ranks[0] === 1;
    if (playerWon) {
      St.data.wins++;
      St.data.intimacy++;
      St.unlockEvent('event01');
    }
    St.save();

    const ayanoAtTable = YM.Game.G.players.some(p => p.characterId === 'ayano');
    $id('final-event').classList.toggle('hidden', !playerWon || !ayanoAtTable);
    $id('final-event').onclick = () => {
      YM.Audio.se('event');
      $id('final-overlay').classList.add('hidden');
      const lines = YM.DIALOGUES.ayano.event01;
      YM.CharacterUI.runEvent('ayano', lines, () => {
        YM.CharacterUI.showEventChoices();
      });
    };
    $id('final-rematch').onclick = () => {
      $id('final-overlay').classList.add('hidden');
      YM.Audio.se('decide');
      YM.Round.startGame();
    };
    $id('final-title-btn').onclick = () => {
      $id('final-overlay').classList.add('hidden');
      YM.Main.goTitle();
    };

    YM.Audio.se(playerWon ? 'win' : 'lose');
    ov.classList.remove('hidden');
  };

  YM.ResultUI = R;
})();
