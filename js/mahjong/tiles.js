/* tiles.js - 牌の定義とSVG描画(高級ラウンジ牌 / 四人打ち版)
 * 牌種(kind): 0-8 萬子1-9 / 9-17 筒子1-9 / 18-26 索子1-9 / 27-33 字牌(東南西北白發中)
 * 牌オブジェクト: { kind, id } (idは0-135の通し番号)
 *
 * 【重要】牌データ構造(kind / id)は変更しない。faceSVG(kind) の戻り値のみ刷新。
 * 牌面は viewBox 0 0 48 66 のインラインSVGで生成する(34種+白の無地)。
 * SVGはページに直接埋め込むため、読み込んだ明朝体Webフォントをそのまま使える。 */
window.YM = window.YM || {};

(function () {
  const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const HONOR_KANJI = ['東', '南', '西', '北', '白', '發', '中'];

  const T = {};

  T.suitOf = k => (k < 9 ? 'm' : k < 18 ? 'p' : k < 27 ? 's' : 'z');
  T.numOf = k => (k < 27 ? (k % 9) + 1 : k - 26); // 字牌は1-7
  T.isHonor = k => k >= 27;
  T.isTerminal = k => !T.isHonor(k) && (T.numOf(k) === 1 || T.numOf(k) === 9);
  T.isYaochu = k => T.isHonor(k) || T.isTerminal(k);

  T.nameOf = function (k) {
    if (k >= 27) return HONOR_KANJI[k - 27];
    const n = T.numOf(k);
    const s = T.suitOf(k);
    return KANJI_NUM[n - 1] + (s === 'm' ? '萬' : s === 'p' ? '筒' : '索');
  };

  T.doraFromIndicator = function (k) {
    if (k < 27) {
      const base = Math.floor(k / 9) * 9;
      return base + ((k - base + 1) % 9);
    }
    if (k <= 30) return 27 + ((k - 27 + 1) % 4); // 東南西北
    return 31 + ((k - 31 + 1) % 3);              // 白發中
  };

  /* ===== 牌34種の切り出し画像パス =====
   * 一覧シートから切り出したPNG(assets/tiles/faces/)へマッピングする。
   * kind: 0-8 萬子(m1-9) / 9-17 筒子(p1-9) / 18-26 索子(s1-9)
   *       27-33 字牌(z1-7: 東南西北白發中)
   * 読み込み失敗時は呼び出し側でSVG(faceSVG)へフォールバックする。 */
  T.IMG_BASE = 'assets/tiles/faces/';
  T.faceImg = function (kind) {
    const n = T.numOf(kind);              // 数牌1-9 / 字牌1-7
    if (kind >= 27) return T.IMG_BASE + 'z' + n + '.png';  // 字牌
    return T.IMG_BASE + T.suitOf(kind) + n + '.png';       // 萬筒索
  };

  /* ===== 伝統的な牌色(彩度を抑えた深い色) ===== */
  const INK = '#2b2622';    // 深い墨色(純黒にしない)
  const RED = '#9c2b26';    // 落ち着いた深い朱
  const GREEN = '#1f5b34';  // 暗めの伝統的な緑
  const INDIGO = '#213a63'; // 濃い藍
  const CREAM = '#f4ecd6';  // 牌面のアイボリー(図柄の抜き部分)
  const FONT = "'Shippori Mincho B1','Hiragino Mincho ProN','Yu Mincho',serif";

  /* ===== 筒子:同心円のコイン ===== */
  function pinCoin(cx, cy, r) {
    const g = (rr, col) => `<circle cx="${cx}" cy="${cy}" r="${rr.toFixed(2)}" fill="${col}"/>`;
    return (
      g(r, INDIGO) +
      g(r * 0.80, CREAM) +
      g(r * 0.62, GREEN) +
      g(r * 0.44, CREAM) +
      g(r * 0.24, RED) +
      // 上辺の淡いハイライト
      `<path d="M${cx - r * 0.6},${cy - r * 0.55} A${r},${r} 0 0 1 ${cx + r * 0.6},${cy - r * 0.55}"
        fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="${(r * 0.10).toFixed(2)}" stroke-linecap="round"/>`
    );
  }

  // 一筒:中央の大きな装飾コイン
  function pinOne() {
    const cx = 24, cy = 33, r = 15;
    let dots = '';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      const dx = cx + Math.cos(a) * (r * 0.66);
      const dy = cy + Math.sin(a) * (r * 0.66);
      dots += `<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="1.5" fill="${RED}"/>`;
    }
    return (
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INDIGO}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="${CREAM}"/>` +
      dots +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="${GREEN}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.38}" fill="${CREAM}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="${RED}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.09}" fill="${CREAM}"/>`
    );
  }

  const PIN_LAYOUT = {
    2: { r: 10, pts: [[24, 20], [24, 46]] },
    3: { r: 9,  pts: [[14, 17], [24, 33], [34, 49]] },
    4: { r: 9,  pts: [[15, 20], [33, 20], [15, 46], [33, 46]] },
    5: { r: 8.5, pts: [[15, 18], [33, 18], [24, 33], [15, 48], [33, 48]] },
    6: { r: 8,  pts: [[15, 17], [33, 17], [15, 33], [33, 33], [15, 49], [33, 49]] },
    7: { r: 7,  pts: [[12, 15], [24, 15], [36, 15], [16, 36], [32, 36], [16, 52], [32, 52]] },
    8: { r: 6,  pts: [[16, 13], [32, 13], [16, 27], [32, 27], [16, 41], [32, 41], [16, 55], [32, 55]] },
    9: { r: 7,  pts: [[13, 19], [24, 19], [35, 19], [13, 33], [24, 33], [35, 33], [13, 47], [24, 47], [35, 47]] }
  };

  /* ===== 索子:竹の節 ===== */
  function bamboo(cx, cy, h) {
    const w = 6.4;
    const x = cx - w / 2, y = cy - h / 2;
    const mid = cy;
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.2" fill="${GREEN}"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.2" fill="none" stroke="#123f24" stroke-width="0.9"/>` +
      // 節のくびれ
      `<line x1="${x + 0.6}" y1="${mid}" x2="${x + w - 0.6}" y2="${mid}" stroke="#123f24" stroke-width="1"/>` +
      // 縦のハイライト
      `<line x1="${cx - 1.4}" y1="${y + 2}" x2="${cx - 1.4}" y2="${y + h - 2}" stroke="rgba(255,255,255,0.28)" stroke-width="1.1" stroke-linecap="round"/>`
    );
  }

  // 五索の中央を朱系にする竹
  function bambooRed(cx, cy, h) {
    const w = 6.4;
    const x = cx - w / 2, y = cy - h / 2;
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.2" fill="${RED}"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.2" fill="none" stroke="#6f1a17" stroke-width="0.9"/>` +
      `<line x1="${x + 0.6}" y1="${cy}" x2="${x + w - 0.6}" y2="${cy}" stroke="#6f1a17" stroke-width="1"/>` +
      `<line x1="${cx - 1.4}" y1="${y + 2}" x2="${cx - 1.4}" y2="${y + h - 2}" stroke="rgba(255,255,255,0.28)" stroke-width="1.1" stroke-linecap="round"/>`
    );
  }

  const SOU_LAYOUT = {
    2: { h: 24, pts: [[24, 21], [24, 45]] },
    3: { h: 22, pts: [[24, 17], [15, 47], [33, 47]] },
    4: { h: 22, pts: [[16, 18], [32, 18], [16, 48], [32, 48]] },
    5: { h: 20, pts: [[15, 18], [33, 18], [24, 33], [15, 48], [33, 48]] },
    6: { h: 22, pts: [[14, 18], [24, 18], [34, 18], [14, 48], [24, 48], [34, 48]] },
    7: { h: 15, pts: [[24, 14], [14, 33], [24, 33], [34, 33], [14, 52], [24, 52], [34, 52]] },
    8: { h: 15, pts: [[14, 14], [24, 14], [34, 14], [19, 33], [29, 33], [14, 52], [24, 52], [34, 52]] },
    9: { h: 15, pts: [[14, 15], [24, 15], [34, 15], [14, 33], [24, 33], [34, 33], [14, 51], [24, 51], [34, 51]] }
  };

  // 一索:竹に止まる鳥(孔雀風)
  function souOne() {
    return (
      // 止まり木の竹
      `<rect x="20.5" y="46" width="7" height="15" rx="3" fill="${GREEN}"/>` +
      `<line x1="21.4" y1="53" x2="26.6" y2="53" stroke="#123f24" stroke-width="0.9"/>` +
      // 尾羽
      `<path d="M24,40 C18,46 15,53 15,60 L19,60 C20,54 22,49 25,45 Z" fill="${GREEN}"/>` +
      `<path d="M24,40 C30,46 33,53 33,60 L29,60 C28,54 26,49 23,45 Z" fill="#2b6d42"/>` +
      // 胴
      `<ellipse cx="24" cy="34" rx="9" ry="11.5" fill="${GREEN}"/>` +
      `<path d="M24,23 C18,25 16,32 18,40 C20,44 28,44 30,40 C32,32 30,25 24,23 Z" fill="#2b6d42"/>` +
      // 羽の線
      `<path d="M20,30 Q24,33 28,30 M20,36 Q24,39 28,36" fill="none" stroke="#123f24" stroke-width="0.8"/>` +
      // 頭
      `<circle cx="24" cy="18" r="6.4" fill="${RED}"/>` +
      // 冠羽
      `<path d="M24,12 L22.5,7 M24,12 L25.5,7 M24,12 L24,6" stroke="${RED}" stroke-width="1.3" stroke-linecap="round"/>` +
      // くちばし
      `<path d="M18.5,18 L13,16.5 L18.5,21 Z" fill="#cf9a3a"/>` +
      // 目
      `<circle cx="25" cy="17" r="1.5" fill="#fff"/>` +
      `<circle cx="25" cy="17" r="0.8" fill="${INK}"/>`
    );
  }

  /* ===== 牌面SVGの生成 ===== */
  T.faceSVG = function (kind) {
    const s = T.suitOf(kind);
    const n = T.numOf(kind);
    let inner = '';

    if (s === 'm') {
      inner =
        `<text x="24" y="31" text-anchor="middle" font-size="27" font-family="${FONT}" font-weight="700" fill="${INK}">${KANJI_NUM[n - 1]}</text>` +
        `<text x="24" y="59" text-anchor="middle" font-size="25" font-family="${FONT}" font-weight="800" fill="${RED}">萬</text>`;
    } else if (s === 'p') {
      if (n === 1) inner = pinOne();
      else {
        const L = PIN_LAYOUT[n];
        inner = L.pts.map(p => pinCoin(p[0], p[1], L.r)).join('');
      }
    } else if (s === 's') {
      if (n === 1) inner = souOne();
      else {
        const L = SOU_LAYOUT[n];
        inner = L.pts.map((p, i) =>
          (n === 5 && i === 2) ? bambooRed(p[0], p[1], L.h) : bamboo(p[0], p[1], L.h)
        ).join('');
      }
    } else {
      const h = n - 1; // 0東 1南 2西 3北 4白 5發 6中
      if (h === 4) {
        // 白:完全な無地(枠・文字・模様を一切入れない)
        inner = '';
      } else {
        const col = h === 5 ? GREEN : h === 6 ? RED : INK;
        inner = `<text x="24" y="45" text-anchor="middle" font-size="34" font-family="${FONT}" font-weight="800" fill="${col}">${HONOR_KANJI[h]}</text>`;
      }
    }

    return `<svg viewBox="0 0 48 66" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="${T.nameOf(kind)}">${inner}</svg>`;
  };

  YM.Tiles = T;
})();
