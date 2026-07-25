/* album-ui.js - 和了アルバムの一覧・詳細画面
 * 既存の牌描画(YM.UI.tileEl)で保存データから和了を再現する。 */
window.YM = window.YM || {};

(function () {
  const U = {};
  const $id = id => document.getElementById(id);
  const St = () => YM.Storage;
  const A = () => YM.Album;

  let currentId = null;

  /* ===== 一覧 ===== */
  U.buildList = function () {
    const grid = $id('album-grid');
    const empty = $id('album-empty');
    const count = $id('album-count');
    if (!grid) return;

    const list = St().albumList();
    grid.innerHTML = '';

    if (count) {
      count.textContent = `${list.length} / ${St().ALBUM_LIMIT}`;
    }

    if (!list.length) {
      grid.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      return;
    }
    grid.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');

    list.forEach(entry => grid.appendChild(makeCard(entry)));
  };

  function makeCard(entry) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'album-card';
    card.dataset.id = entry.id;

    // 手牌プレビュー(先頭のみ。牌が多い場合は省略)
    const preview = document.createElement('div');
    preview.className = 'album-card-tiles';
    const kinds = (entry.handTiles || []).slice(0, 8);
    kinds.forEach(k => preview.appendChild(YM.UI.tileEl(k, { small: true })));
    if (entry.winTile != null) {
      const w = YM.UI.tileEl(entry.winTile, { small: true });
      w.classList.add('album-win-tile');
      preview.appendChild(w);
    }
    card.appendChild(preview);

    const info = document.createElement('div');
    info.className = 'album-card-info';

    const line1 = document.createElement('div');
    line1.className = 'album-card-line';
    line1.innerHTML =
      `<span class="album-round">${escapeHtml(entry.roundName || '')}</span>` +
      `<span class="album-type">${entry.winType === 'tsumo' ? 'ツモ' : 'ロン'}</span>` +
      `<span class="album-date">${escapeHtml(A().formatDateShort(entry.savedAt))}</span>`;
    info.appendChild(line1);

    const line2 = document.createElement('div');
    line2.className = 'album-card-line';
    const rank = entry.yakuman ? '役満' : (entry.rank || '');
    const fuHan = entry.yakuman ? '' : `${entry.fu}符${entry.han}翻`;
    line2.innerHTML =
      `<span class="album-yaku">${escapeHtml(A().primaryYaku(entry.yakuList) || '—')}</span>` +
      (rank ? `<span class="album-rank">${rank}</span>` : '') +
      (fuHan ? `<span class="album-fuhan">${fuHan}</span>` : '') +
      `<span class="album-points">${entry.gainedPoints > 0 ? '+' : ''}${entry.gainedPoints}点</span>`;
    info.appendChild(line2);

    if ((entry.firstBadges || []).length) {
      const badges = document.createElement('div');
      badges.className = 'album-card-badges';
      entry.firstBadges.forEach(id => {
        const b = document.createElement('span');
        b.className = 'album-badge';
        b.textContent = St().firstLabel(id);
        badges.appendChild(b);
      });
      info.appendChild(badges);
    }

    card.appendChild(info);
    card.addEventListener('click', () => {
      YM.Audio.se('select');
      U.showDetail(entry.id);
    });
    return card;
  }

  /* ===== 詳細 ===== */
  U.showDetail = function (id) {
    const entry = St().albumGet(id);
    if (!entry) return;
    currentId = id;

    $id('album-detail-title').textContent =
      `${entry.roundName || ''}  ${entry.winType === 'tsumo' ? 'ツモ和了' : 'ロン和了'}`;
    $id('album-detail-date').textContent =
      `保存日時 ${A().formatDate(entry.savedAt)}`;

    // 手牌 + 副露 + 和了牌
    const handEl = $id('album-detail-hand');
    handEl.innerHTML = '';
    (entry.handTiles || []).forEach(k => handEl.appendChild(YM.UI.tileEl(k, { small: true })));
    (entry.melds || []).forEach(m => {
      const gap = document.createElement('div');
      gap.className = 'result-meld-gap';
      handEl.appendChild(gap);
      const kinds = m.type === 'ankan'
        ? [null, m.tile, m.tile, null]
        : (m.tiles || []);
      kinds.forEach(k => {
        handEl.appendChild(k == null
          ? YM.UI.tileEl(0, { small: true, back: true })
          : YM.UI.tileEl(k, { small: true }));
      });
    });
    if (entry.winTile != null) {
      const w = YM.UI.tileEl(entry.winTile, { small: true });
      w.classList.add('album-win-tile');
      w.style.marginLeft = '10px';
      handEl.appendChild(w);
    }

    // ドラ・裏ドラ
    const doraEl = $id('album-detail-dora');
    doraEl.innerHTML = '';
    appendTileRow(doraEl, 'ドラ表示', entry.doraIndicators);
    appendTileRow(doraEl, '裏ドラ表示', entry.uraDoraIndicators);

    // 役一覧
    const yakuEl = $id('album-detail-yaku');
    yakuEl.innerHTML = '';
    (entry.yakuList || []).forEach(y => {
      const row = document.createElement('div');
      row.className = 'yaku-row';
      row.innerHTML = `<span>${escapeHtml(y.name)}</span><span>${y.han >= 13 ? '役満' : y.han + '翻'}</span>`;
      yakuEl.appendChild(row);
    });
    if (entry.doraCount > 0) addSimpleRow(yakuEl, 'ドラ', `${entry.doraCount}翻`);
    if (entry.uraCount > 0) addSimpleRow(yakuEl, '裏ドラ', `${entry.uraCount}翻`);

    // 得点
    const rank = entry.yakuman ? '役満' : (entry.rank || '');
    const fuHan = entry.yakuman ? '役満' : `${entry.fu}符${entry.han}翻`;
    $id('album-detail-score').innerHTML =
      (rank ? `<span class="score-rank">${rank}</span>` : '') +
      `${fuHan}  ${entry.gainedPoints > 0 ? '+' : ''}${entry.gainedPoints}点`;

    // 対戦相手
    const opp = (entry.opponents || []).map(o => o.name).filter(Boolean).join(' / ');
    $id('album-detail-players').textContent =
      `${entry.playerName || 'あなた'}${entry.isDealer ? '(親)' : '(子)'}` +
      (opp ? `  ・  対戦相手 ${opp}` : '');

    // はじめてバッジ
    const badgeEl = $id('album-detail-badges');
    badgeEl.innerHTML = '';
    if ((entry.firstBadges || []).length) {
      entry.firstBadges.forEach(id2 => {
        const b = document.createElement('span');
        b.className = 'album-badge';
        b.textContent = St().firstLabel(id2);
        badgeEl.appendChild(b);
      });
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }

    hideConfirm();
    setDetailMessage('');
    $id('album-detail').classList.remove('hidden');
    $id('album-list-view').classList.add('hidden');
  };

  function appendTileRow(parent, label, kinds) {
    if (!kinds || !kinds.length) return;
    const row = document.createElement('div');
    row.className = 'album-dora-row';
    const lb = document.createElement('span');
    lb.className = 'album-dora-label';
    lb.textContent = label;
    row.appendChild(lb);
    kinds.forEach(k => row.appendChild(YM.UI.tileEl(k, { small: true })));
    parent.appendChild(row);
  }

  function addSimpleRow(parent, name, value) {
    const row = document.createElement('div');
    row.className = 'yaku-row';
    row.innerHTML = `<span>${name}</span><span>${value}</span>`;
    parent.appendChild(row);
  }

  U.backToList = function () {
    currentId = null;
    hideConfirm();
    $id('album-detail').classList.add('hidden');
    $id('album-list-view').classList.remove('hidden');
    U.buildList();
  };

  /* ===== 削除 ===== */
  function hideConfirm() {
    const c = $id('album-delete-confirm');
    if (c) c.classList.add('hidden');
  }

  U.askDelete = function () {
    const c = $id('album-delete-confirm');
    if (c) c.classList.remove('hidden');
  };

  U.cancelDelete = hideConfirm;

  U.confirmDelete = function () {
    if (!currentId) return;
    St().albumRemove(currentId);
    YM.Audio.se('select');
    U.backToList();
  };

  /* ===== PNG 書き出し ===== */
  U.exportPng = async function () {
    const entry = currentId ? St().albumGet(currentId) : null;
    if (!entry) return;
    setDetailMessage('画像を作成しています…');
    try {
      const ok = await A().downloadPng(entry);
      setDetailMessage(ok ? 'PNG画像を書き出しました' : '画像を書き出せませんでした');
    } catch (e) {
      setDetailMessage('画像を書き出せませんでした');
    }
    setTimeout(() => setDetailMessage(''), 2600);
  };

  function setDetailMessage(msg) {
    const el = $id('album-detail-message');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  /* ===== 画面を開く ===== */
  U.open = function () {
    currentId = null;
    hideConfirm();
    $id('album-detail').classList.add('hidden');
    $id('album-list-view').classList.remove('hidden');
    U.buildList();
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  YM.AlbumUI = U;
})();
