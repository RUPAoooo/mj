/* album.js - 和了アルバム用のデータ生成・はじめてシリーズ判定・PNG書き出し
 *
 * 保存処理はここに集約する(重複実装しない)。
 * 画像は localStorage に保存せず、和了内容を JSON として保存して
 * アルバム画面で既存の牌描画システムを使って再現する。 */
window.YM = window.YM || {};

(function () {
  const A = {};
  const St = () => YM.Storage;

  /* ===== 共通ヘルパー ===== */

  A.rankLabel = function (han, fu, yakuman) {
    return YM.Scoring.rankName(han, fu, yakuman) || '';
  };

  /* 主な役(最も翻の高いもの)を1つ返す。表示用。 */
  A.primaryYaku = function (yakuList) {
    if (!yakuList || !yakuList.length) return '';
    const sorted = yakuList.slice().sort((a, b) => (b.han || 0) - (a.han || 0));
    return sorted[0].name || '';
  };

  function hasYaku(yakuList, name) {
    return (yakuList || []).some(y => y.name === name);
  }

  /* ===== はじめてシリーズの判定 =====
   * プレイヤー本人(index 0)の和了のみを対象にする。
   * ctx: { han, fu, yakuman, yakuList, isDealer } */
  A.detectFirsts = function (ctx) {
    const ids = ['firstWin'];
    const rank = A.rankLabel(ctx.han, ctx.fu, ctx.yakuman);

    if (ctx.yakuman || ctx.han >= 13) ids.push('firstYakuman');
    else if (ctx.han >= 11) ids.push('firstSanbaiman');
    else if (ctx.han >= 8) ids.push('firstBaiman');
    else if (ctx.han >= 6) ids.push('firstHaneman');
    else if (rank === '満貫') ids.push('firstMangan');

    // 親の満貫以上(親満以上)
    if (ctx.isDealer && (rank === '満貫' || ctx.han >= 6 || ctx.yakuman)) {
      ids.push('firstDealerMangan');
    }

    if (hasYaku(ctx.yakuList, '立直') && hasYaku(ctx.yakuList, '一発')) ids.push('firstIppatsu');
    if (hasYaku(ctx.yakuList, '七対子')) ids.push('firstChiitoitsu');
    if (hasYaku(ctx.yakuList, '清一色')) ids.push('firstChinitsu');

    return ids;
  };

  /* ===== 保存用データの生成 =====
   * win 情報から、アルバム再現に必要な情報だけを JSON 化しやすい形で組み立てる。
   * 牌は kind(数値)で保存し、既存の YM.UI.tileEl() で再描画できる形式にする。 */
  A.buildEntry = function (src) {
    const g = src.game;
    const p = g.players[src.winnerIdx];
    const now = new Date();

    const melds = (p.melds || []).map(m => ({
      type: m.type,
      tile: m.tile,
      tiles: (m.tiles || []).map(t => t.kind),
      from: m.from != null ? m.from : null,
      calledTile: m.calledTile ? m.calledTile.kind : null
    }));

    const opponents = g.players
      .filter((q, i) => i !== src.winnerIdx)
      .map(q => ({ name: q.name, characterId: q.characterId || null }));

    return {
      /* 同じ和了を二重保存しないための一意ID(局・巡目・手牌から決まる) */
      id: src.entryId,
      savedAt: now.toISOString(),
      playedAt: (g.startedAt || now.toISOString()),

      // 局の情報
      roundName: A.handName(g),
      honba: g.honba || 0,
      riichiSticks: src.stickCount || 0,

      // 和了の形式
      winType: src.tsumo ? 'tsumo' : 'ron',
      isDealer: !!src.isDealer,

      // プレイヤー
      playerName: p.name,
      playerAvatar: (St().data.playerProfile && St().data.playerProfile.avatar) || '',
      opponents,

      // 牌
      handTiles: (p.hand || []).map(t => t.kind),
      winTile: src.winKind,
      melds,
      doraIndicators: (src.doraIndicators || []).slice(),
      uraDoraIndicators: (src.uraDoraIndicators || []).slice(),

      // 点数
      yakuList: (src.yakuList || []).map(y => ({ name: y.name, han: y.han })),
      doraCount: src.doraCount || 0,
      uraCount: src.uraCount || 0,
      han: src.han,
      fu: src.fu,
      yakuman: !!src.yakuman,
      rank: A.rankLabel(src.han, src.fu, src.yakuman),
      basePoints: YM.Scoring.basePoints(src.han, src.fu, src.yakuman),
      gainedPoints: src.gainedPoints || 0,
      payText: src.payText || '',

      // はじめてシリーズのバッジ(この和了で新規達成したもの)
      firstBadges: (src.firstBadges || []).slice(),

      // キャラクターの台詞(あれば)
      comment: src.comment || ''
    };
  };

  /* 局名: 東一局 など */
  A.handName = function (g) {
    const winds = { 0: '東', 1: '南', 2: '西', 3: '北' };
    const wind = winds[g.roundWind] != null ? winds[g.roundWind]
      : (g.roundWind === YM.CONST.SOUTH ? '南' : '東');
    const nums = ['一', '二', '三', '四'];
    const n = nums[(g.handNumber || 1) - 1] || (g.handNumber || 1);
    return `${wind}${n}局`;
  };

  /* 同一和了を識別するID。局・本場・和了牌・手牌から決まるので
   * 同じ和了結果画面から何度押しても同じIDになる。 */
  A.makeEntryId = function (g, winnerIdx, winKind) {
    const p = g.players[winnerIdx];
    const hand = (p.hand || []).map(t => t.kind).join('.');
    const melds = (p.melds || []).map(m => (m.tiles || []).map(t => t.kind).join('-')).join('_');
    return [
      'agari',
      g.roundWind, g.handNumber, g.honba,
      winnerIdx, winKind, hand, melds
    ].join(':');
  };

  /* ===== 日付表示 ===== */
  A.formatDate = function (iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch (e) { return ''; }
  };

  A.formatDateShort = function (iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
    } catch (e) { return ''; }
  };

  /* ===== PNG 書き出し =====
   * 外部ライブラリを使わず Canvas に直接描画する。
   * 牌は assets/tiles/faces の PNG をそのまま描く。 */
  /* faceImg() は既にパス込みの文字列を返す */
  const TILE_SRC = kind => YM.Tiles.faceImg(kind);

  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /* entry から 1 枚の PNG を生成して blob URL を返す */
  A.renderPng = async function (entry) {
    const W = 1000;
    const H = 620;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 背景(深い黒地に赤の差し色 = 既存デザイン)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a120c');
    bg.addColorStop(1, '#0a0806');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, 0, 10, W / 2, 0, W * 0.7);
    glow.addColorStop(0, 'rgba(110, 26, 38, 0.34)');
    glow.addColorStop(1, 'rgba(110, 26, 38, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 320);

    // 外枠(真鍮)
    ctx.strokeStyle = 'rgba(176, 141, 74, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16.5, 16.5, W - 33, H - 33);
    ctx.strokeStyle = 'rgba(176, 141, 74, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(24.5, 24.5, W - 49, H - 49);

    // タイトル
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(205, 184, 145, 0.8)';
    ctx.font = 'bold 15px serif';
    ctx.fillText('Y O I M A C H I   M A H J O N G   C L U B', W / 2, 62);
    ctx.fillStyle = '#e6cf96';
    ctx.font = 'bold 30px serif';
    ctx.fillText('宵待ち麻雀倶楽部', W / 2, 100);

    // 区切り線
    ctx.strokeStyle = 'rgba(176, 141, 74, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 170, 116);
    ctx.lineTo(W / 2 + 170, 116);
    ctx.stroke();

    // 局名・和了種別
    ctx.fillStyle = '#ece5d3';
    ctx.font = '20px serif';
    const kindText = entry.winType === 'tsumo' ? 'ツモ和了' : 'ロン和了';
    ctx.fillText(`${entry.roundName}  ${entry.honba > 0 ? entry.honba + '本場  ' : ''}${kindText}`, W / 2, 150);

    // 牌の描画
    const TW = 46, TH = Math.round(TW * 315 / 192), GAP = 3;
    const handKinds = (entry.handTiles || []).slice();
    const meldKinds = [];
    (entry.melds || []).forEach(m => {
      meldKinds.push(null); // 面子の区切り
      (m.tiles || []).forEach(k => meldKinds.push(k));
    });

    const rowItems = handKinds.map(k => ({ kind: k }))
      .concat(entry.winTile != null ? [{ kind: entry.winTile, win: true }] : [])
      .concat(meldKinds.map(k => (k === null ? { gap: true } : { kind: k })));

    const totalW = rowItems.reduce((s, it) => s + (it.gap ? 14 : TW + GAP), 0) - GAP;
    let x = Math.max(40, (W - totalW) / 2);
    const y = 190;

    const uniq = Array.from(new Set(rowItems.filter(it => it.kind != null).map(it => it.kind)));
    const imgs = {};
    await Promise.all(uniq.map(async k => { imgs[k] = await loadImage(TILE_SRC(k)); }));

    for (const it of rowItems) {
      if (it.gap) { x += 14; continue; }
      const img = imgs[it.kind];
      if (img) ctx.drawImage(img, x, y, TW, TH);
      else {
        ctx.fillStyle = '#ece3ca';
        ctx.fillRect(x, y, TW, TH);
      }
      if (it.win) {
        ctx.strokeStyle = '#a03040';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 1.5, y - 1.5, TW + 3, TH + 3);
        ctx.fillStyle = '#e2a0ac';
        ctx.font = '13px serif';
        ctx.fillText('和了牌', x + TW / 2, y + TH + 20);
      }
      x += TW + GAP;
    }

    // ドラ表示
    let dy = y + TH + 46;
    ctx.textAlign = 'left';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(205, 184, 145, 0.8)';
    const doraText = (entry.doraIndicators || []).map(k => YM.Tiles.nameOf(k)).join(' ');
    const uraText = (entry.uraDoraIndicators || []).map(k => YM.Tiles.nameOf(k)).join(' ');
    if (doraText) { ctx.fillText(`ドラ表示  ${doraText}`, 60, dy); dy += 24; }
    if (uraText) { ctx.fillText(`裏ドラ表示  ${uraText}`, 60, dy); dy += 24; }

    // 役一覧(左列)
    ctx.fillStyle = '#d8d0bf';
    ctx.font = '16px sans-serif';
    let yy = Math.max(dy + 10, y + TH + 80);
    const yakuStart = yy;
    (entry.yakuList || []).forEach(yk => {
      ctx.textAlign = 'left';
      ctx.fillText(yk.name, 60, yy);
      ctx.textAlign = 'right';
      ctx.fillText(yk.han >= 13 ? '役満' : `${yk.han}翻`, 430, yy);
      yy += 25;
    });
    if (entry.doraCount > 0) {
      ctx.textAlign = 'left';
      ctx.fillText('ドラ', 60, yy);
      ctx.textAlign = 'right';
      ctx.fillText(`${entry.doraCount}翻`, 430, yy);
      yy += 25;
    }

    // 点数(右列)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e6cf96';
    ctx.font = 'bold 34px serif';
    const rankText = entry.yakuman ? '役満' : (entry.rank || '');
    if (rankText) ctx.fillText(rankText, W - 60, yakuStart + 10);
    ctx.font = 'bold 26px serif';
    ctx.fillStyle = '#ece5d3';
    const fuHan = entry.yakuman ? '' : `${entry.fu}符 ${entry.han}翻`;
    if (fuHan) ctx.fillText(fuHan, W - 60, yakuStart + 48);
    ctx.font = 'bold 30px serif';
    ctx.fillStyle = '#e6cf96';
    ctx.fillText(`${entry.gainedPoints > 0 ? '+' : ''}${entry.gainedPoints} 点`, W - 60, yakuStart + 90);

    // はじめてバッジ
    if ((entry.firstBadges || []).length) {
      let bx = 60;
      const by = H - 78;
      ctx.font = '13px sans-serif';
      entry.firstBadges.forEach(id => {
        const label = St().firstLabel(id);
        const w = ctx.measureText(label).width + 26;
        ctx.fillStyle = 'rgba(110, 26, 38, 0.55)';
        ctx.strokeStyle = 'rgba(230, 207, 150, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(bx, by, w, 26, 3) : ctx.rect(bx, by, w, 26);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e6cf96';
        ctx.textAlign = 'center';
        ctx.fillText(label, bx + w / 2, by + 17);
        bx += w + 8;
      });
    }

    // 保存日
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(205, 184, 145, 0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText(A.formatDate(entry.savedAt), W - 60, H - 44);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  };

  /* PNG をダウンロードさせる */
  A.downloadPng = async function (entry) {
    const blob = await A.renderPng(entry);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yoimachi-agari-${A.formatDateShort(entry.savedAt).replace(/\//g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  };

  YM.Album = A;
})();
