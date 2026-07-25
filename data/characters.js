/* characters.js - 6人のキャラクター定義と表情・イベント画像対応表 */
window.YM = window.YM || {};

YM.CHARACTERS = {
  ayano: {
    id: 'ayano',
    name: '神楽坂綾乃',
    shortName: '綾乃',
    age: 36,
    job: '銀座の一流クラブのホステス',
    playStyle: 'offense',
    playStyleLabel: '攻撃・高打点型',
    favoriteYaku: '清一色',
    difficulty: 4,
    description: '大人の余裕と染め手で卓を揺さぶる。',
    accent: '#8f263c',
    imgBase: 'assets/characters/ayano/',
    images: {
      normal: 'normal.png', thinking: 'thinking.png', win: 'win.png',
      cpuWin: 'win.png', bigWin: 'bigWin.png', lose: 'lose.png',
      cpuDealIn: 'lose.png', playerTsumo: 'lose.png', bigLoss: 'lose.png',
      drink: 'drink.png', special: 'special.png', opening: 'normal.png',
      smile: 'win.png', surprised: 'thinking.png', annoyed: 'lose.png',
      blush: 'special.png', defeat01: 'lose.png', defeat02: 'lose.png', event01: 'special.png'
    }
  },
  lili: {
    id: 'lili', name: '有栖川リリ', shortName: 'リリ', age: 32,
    job: 'デイトレーダー兼動画配信者', playStyle: 'balance', playStyleLabel: '効率・特殊手型',
    favoriteYaku: '七対子', difficulty: 3, description: '確率と牌効率に厳しい理詰めの配信者。',
    initial: '莉',
    accent: '#c96f94',
    imgBase: 'assets/characters/lili/',
    images: {
      normal: 'normal.png', thinking: 'thinking.png', win: 'win.png',
      cpuWin: 'win.png', bigWin: 'pizza.png', lose: 'lose.png',
      cpuDealIn: 'lose.png', playerTsumo: 'lose.png', bigLoss: 'lose.png',
      smoke: 'smoke.png', pizza: 'pizza.png', stocks: 'stocks.png',
      stream: 'stream.png', special: 'stream.png', opening: 'normal.png'
    }
  },
  masked: {
    id: 'masked', name: '謎の覆面', shortName: '覆面', age: null,
    job: '正体不明の常連客', playStyle: 'offense', playStyleLabel: '強気・変則型',
    favoriteYaku: '天和', difficulty: 5, description: '運命を信じ、極端な大物手へ向かう無口な雀士。',
    initial: '謎', accent: '#72509a', imgBase: 'assets/characters/masked/',
    images: {
      normal: 'normal.png', thinking: 'thinking.png', win: 'bigWin.png',
      cpuWin: 'bigWin.png', bigWin: 'bigWin.png', lose: 'lose.png',
      cpuDealIn: 'lose.png', playerTsumo: 'lose.png', bigLoss: 'bigLoss.png',
      special: 'bigWin.png', opening: 'normal.png'
    }
  },
  mofuzo: {
    id: 'mofuzo', name: 'ちいぽん', shortName: 'ちいぽん', age: 20,
    job: '雀荘に住み着く猫', playStyle: 'offense', playStyleLabel: '鳴き・気分屋型',
    favoriteYaku: '対々和', difficulty: 2, description: '人間の麻雀を見続け、肉球で牌を切る普通の老猫。',
    initial: '猫', accent: '#a67c52', imgBase: 'assets/characters/mofuzo/',
    images: {
      normal: 'normal.png', thinking: 'normal.png', win: 'win.png',
      cpuWin: 'win.png', bigWin: 'win.png', lose: 'lose.png',
      cpuDealIn: 'lose.png', playerTsumo: 'lose.png', bigLoss: 'lose.png',
      treat: 'treat.png', special: 'treat.png', opening: 'normal.png'
    }
  },
  tanabe: {
    id: 'tanabe', name: '田辺一', shortName: '田辺', age: 31,
    job: '強度近視の会社員', playStyle: 'balance', playStyleLabel: '門前・覚醒型',
    favoriteYaku: '一気通貫', difficulty: 3, description: '順子を大切にする門前派。勝つほど視界も冴える。',
    initial: '一', accent: '#49637c', imgBase: 'assets/characters/tanabe/',
    images: {
      normal: 'normal.png', thinking: 'thinking.png', win: 'win.png',
      cpuWin: 'win.png', bigWin: 'bigWin.png', lose: 'lose.png',
      cpuDealIn: 'lose.png', playerTsumo: 'lose.png', bigLoss: 'lose.png',
      special: 'bigWin.png', opening: 'normal.png'
    }
  },
  tome: {
    id: 'tome', name: '梅沢トメ', shortName: 'トメ', age: null,
    job: '雀荘の名物常連', playStyle: 'defense', playStyleLabel: '守備・実戦型',
    favoriteYaku: '断么九・対々和', difficulty: 4, description: '和やかな笑顔で危険牌をかわす、年季の入った実戦派。',
    initial: 'ト', accent: '#8c4a3d', imgBase: 'assets/characters/tome/',
    images: {
      normal: 'normal.png', thinking: 'thinking.png', win: 'win.png',
      cpuWin: 'win.png', bigWin: 'bigWin.png', lose: 'lose.png',
      cpuDealIn: 'lose.png', playerTsumo: 'lose.png', bigLoss: 'lose.png',
      treat: 'treat.png', special: 'treat.png', opening: 'normal.png'
    }
  }
};

YM.CHARACTER_ORDER = ['ayano', 'lili', 'masked', 'tanabe', 'tome', 'mofuzo'];
YM.CHARACTER_ID_ALIASES = Object.freeze({
  ayanokagurazaka: 'ayano',
  kagurazakaayano: 'ayano',
  '神楽坂綾乃': 'ayano',
  liliarisugawa: 'lili',
  arisugawalili: 'lili',
  '有栖川リリ': 'lili',
  '謎の覆面': 'masked',
  tanabehajime: 'tanabe',
  '田辺一': 'tanabe',
  umezawatome: 'tome',
  '梅沢トメ': 'tome',
  chiipon: 'mofuzo',
  'ちいぽん': 'mofuzo',
  cpu_a: 'lili',
  cpu_b: 'tome'
});

YM.resolveCharacterId = function (value) {
  if (Number.isInteger(value)) return YM.CHARACTER_ORDER[value] || null;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return YM.CHARACTER_ORDER[Number(raw)] || null;
  const id = YM.CHARACTER_ID_ALIASES[raw] || raw;
  return YM.CHARACTER_ORDER.includes(id) ? id : null;
};

YM.normalizeCharacterSelection = function (values) {
  if (!Array.isArray(values)) return [];
  const normalized = [];
  values.forEach(value => {
    const id = YM.resolveCharacterId(value);
    if (id && !normalized.includes(id)) normalized.push(id);
  });
  return normalized.slice(0, 3);
};

YM.characterForId = function (value) {
  const id = YM.resolveCharacterId(value);
  return id ? YM.CHARACTERS[id] : null;
};

YM.characterList = function () {
  return YM.CHARACTER_ORDER.map(id => YM.CHARACTERS[id]).filter(Boolean);
};
YM.defaultCharacterSelection = ['lili', 'ayano', 'tome'];

/* 旧IDを参照する古いセーブデータ向けの互換定義 */
YM.CHARACTERS.cpu_a = YM.CHARACTERS.lili;
YM.CHARACTERS.cpu_b = YM.CHARACTERS.tome;

/* ===== SVG仮ポートレート ===== */
(function () {
  const HAIR = '#20243d';
  const HAIR_HI = '#3a4066';
  const SKIN = '#f4d9c4';
  const SKIN_SHADOW = '#e0b89e';
  const DRESS = '#8c1830';
  const DRESS_DARK = '#5c0f20';
  const JACKET = '#241d33';
  const IRIS = '#6b2a3d';
  const LIP = '#b4485a';
  const GOLD = '#d8b24a';

  function eye(cx, cy, type) {
    switch (type) {
      case 'closedSmile':
        return `<path d="M${cx - 11},${cy} Q${cx},${cy + 7} ${cx + 11},${cy}" fill="none" stroke="#3a2430" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'surprised':
        return `
          <ellipse cx="${cx}" cy="${cy}" rx="10" ry="9" fill="#fff" stroke="#3a2430" stroke-width="1.6"/>
          <circle cx="${cx}" cy="${cy + 1}" r="5.6" fill="${IRIS}"/>
          <circle cx="${cx - 2}" cy="${cy - 1.5}" r="1.8" fill="#fff"/>
          <path d="M${cx - 11},${cy - 8} Q${cx},${cy - 13} ${cx + 11},${cy - 8}" fill="none" stroke="#3a2430" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'halfLid':
        return `
          <path d="M${cx - 11},${cy - 2} L${cx + 11},${cy - 2} L${cx + 10},${cy + 4} Q${cx},${cy + 8} ${cx - 10},${cy + 4} Z" fill="#fff" stroke="none"/>
          <circle cx="${cx}" cy="${cy + 2}" r="5.4" fill="${IRIS}"/>
          <rect x="${cx - 11}" y="${cy - 9}" width="22" height="7" fill="${SKIN}"/>
          <path d="M${cx - 11},${cy - 2} L${cx + 11},${cy - 2}" stroke="#3a2430" stroke-width="2.8" stroke-linecap="round"/>`;
      case 'lookAway':
        return `
          <path d="M${cx - 11},${cy - 4} Q${cx},${cy - 9} ${cx + 11},${cy - 4} L${cx + 10},${cy + 4} Q${cx},${cy + 8} ${cx - 10},${cy + 4} Z" fill="#fff"/>
          <circle cx="${cx + 4}" cy="${cy + 1}" r="5.2" fill="${IRIS}"/>
          <circle cx="${cx + 2.4}" cy="${cy - 1}" r="1.5" fill="#fff"/>
          <path d="M${cx - 11},${cy - 4} Q${cx},${cy - 9} ${cx + 11},${cy - 4}" fill="none" stroke="#3a2430" stroke-width="2.8" stroke-linecap="round"/>`;
      case 'soft':
        return `
          <path d="M${cx - 11},${cy - 3} Q${cx},${cy - 8} ${cx + 11},${cy - 3} L${cx + 10},${cy + 2} Q${cx},${cy + 6} ${cx - 10},${cy + 2} Z" fill="#fff"/>
          <circle cx="${cx}" cy="${cy}" r="5.4" fill="${IRIS}"/>
          <circle cx="${cx - 2}" cy="${cy - 2}" r="1.6" fill="#fff"/>
          <path d="M${cx - 11},${cy - 3} Q${cx},${cy - 8} ${cx + 11},${cy - 3}" fill="none" stroke="#3a2430" stroke-width="2.8" stroke-linecap="round"/>
          <path d="M${cx - 9},${cy + 5} Q${cx},${cy + 8} ${cx + 9},${cy + 5}" fill="none" stroke="${SKIN_SHADOW}" stroke-width="1.4"/>`;
      default: // open
        return `
          <path d="M${cx - 11},${cy - 4} Q${cx},${cy - 10} ${cx + 11},${cy - 4} L${cx + 10},${cy + 4} Q${cx},${cy + 8} ${cx - 10},${cy + 4} Z" fill="#fff"/>
          <circle cx="${cx}" cy="${cy}" r="5.6" fill="${IRIS}"/>
          <circle cx="${cx - 2}" cy="${cy - 2}" r="1.8" fill="#fff"/>
          <path d="M${cx - 11},${cy - 4} Q${cx},${cy - 10} ${cx + 11},${cy - 4}" fill="none" stroke="#3a2430" stroke-width="2.8" stroke-linecap="round"/>`;
    }
  }

  function brow(cx, cy, type) {
    switch (type) {
      case 'high':
        return `<path d="M${cx - 12},${cy - 4} Q${cx},${cy - 10} ${cx + 12},${cy - 5}" fill="none" stroke="#2c2030" stroke-width="2.4" stroke-linecap="round"/>`;
      case 'worried': {
        const dir = cx < 160 ? 1 : -1;
        return `<path d="M${cx - 12 * dir},${cy - 2} Q${cx},${cy - 5} ${cx + 12 * dir},${cy + 3}" fill="none" stroke="#2c2030" stroke-width="2.4" stroke-linecap="round"/>`;
      }
      case 'angry': {
        const dir = cx < 160 ? 1 : -1;
        return `<path d="M${cx - 12 * dir},${cy - 5} Q${cx},${cy - 4} ${cx + 12 * dir},${cy + 1}" fill="none" stroke="#2c2030" stroke-width="2.6" stroke-linecap="round"/>`;
      }
      default:
        return `<path d="M${cx - 12},${cy} Q${cx},${cy - 6} ${cx + 12},${cy - 1}" fill="none" stroke="#2c2030" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }

  function mouth(type) {
    const x = 160, y = 188;
    switch (type) {
      case 'smileOpen':
        return `<path d="M${x - 9},${y - 2} Q${x},${y + 8} ${x + 9},${y - 2} Q${x},${y + 2} ${x - 9},${y - 2} Z" fill="${LIP}"/>`;
      case 'o':
        return `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="6" fill="#7e2231"/><ellipse cx="${x}" cy="${y}" rx="4.5" ry="6" fill="none" stroke="${LIP}" stroke-width="1.4"/>`;
      case 'pout':
        return `<path d="M${x - 7},${y + 1} Q${x},${y - 3} ${x + 7},${y + 1}" fill="none" stroke="${LIP}" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'small':
        return `<path d="M${x - 6},${y} Q${x},${y + 3} ${x + 6},${y}" fill="none" stroke="${LIP}" stroke-width="2.4" stroke-linecap="round"/>`;
      case 'talk':
        return `<path d="M${x - 6},${y - 1} Q${x},${y + 6} ${x + 6},${y - 1} Z" fill="#7e2231" stroke="${LIP}" stroke-width="1.2"/>`;
      default: // smile
        return `<path d="M${x - 8},${y - 1} Q${x},${y + 5} ${x + 8},${y - 1}" fill="none" stroke="${LIP}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
  }

  function blushMarks(level) {
    if (!level) return '';
    const op = level === 2 ? 0.6 : 0.38;
    return `
      <ellipse cx="124" cy="174" rx="11" ry="5" fill="#f08a8a" opacity="${op}"/>
      <ellipse cx="196" cy="174" rx="11" ry="5" fill="#f08a8a" opacity="${op}"/>`;
  }

  /* expr: normal / smile / surprised / annoyed / blush / defeat01 / defeat02 / event01 */
  YM.characterArt = function (expr) {
    const E = {
      normal:    { eye: 'open',        brow: 'calm',    mouth: 'small',     blush: 0, outfit: 'jacket' },
      smile:     { eye: 'closedSmile', brow: 'calm',    mouth: 'smileOpen', blush: 0, outfit: 'jacket' },
      surprised: { eye: 'surprised',   brow: 'high',    mouth: 'o',         blush: 0, outfit: 'jacket' },
      annoyed:   { eye: 'halfLid',     brow: 'angry',   mouth: 'pout',      blush: 0, outfit: 'jacket' },
      blush:     { eye: 'open',        brow: 'worried', mouth: 'small',     blush: 1, outfit: 'jacket' },
      defeat01:  { eye: 'lookAway',    brow: 'worried', mouth: 'pout',      blush: 1, outfit: 'jacket' },
      defeat02:  { eye: 'open',        brow: 'worried', mouth: 'talk',      blush: 2, outfit: 'jacket' },
      event01:   { eye: 'soft',        brow: 'calm',    mouth: 'smile',     blush: 1, outfit: 'dress' }
    }[expr] || { eye: 'open', brow: 'calm', mouth: 'small', blush: 0, outfit: 'jacket' };

    const isEvent = E.outfit === 'dress';

    // 髪(後ろ) イベント時は髪をほどいて広がりを大きく
    const hairBack = isEvent
      ? `<path d="M160,26 C96,26 66,84 72,150 C76,214 40,270 30,340 L24,440 L296,440 L290,340 C280,270 244,214 248,150 C254,84 224,26 160,26 Z" fill="${HAIR}"/>
         <path d="M70,200 C56,270 44,330 40,420 L60,420 C62,330 74,268 86,214 Z" fill="${HAIR_HI}" opacity="0.35"/>
         <path d="M250,200 C264,270 274,330 278,420 L258,420 C256,330 246,268 236,214 Z" fill="${HAIR_HI}" opacity="0.35"/>`
      : `<path d="M160,26 C102,26 78,80 82,144 C84,204 66,262 60,340 L56,440 L264,440 L258,340 C252,262 236,204 238,144 C242,80 218,26 160,26 Z" fill="${HAIR}"/>
         <path d="M84,190 C74,260 66,330 64,420 L80,420 C82,330 90,262 98,206 Z" fill="${HAIR_HI}" opacity="0.3"/>`;

    // 肩・胸元(素肌部分)
    const torsoSkin = `
      <path d="M96,440 L100,318 C108,282 128,258 146,244 L146,214 L174,214 L174,244 C192,258 212,282 220,318 L224,440 Z" fill="${SKIN}"/>
      <path d="M146,232 C150,246 170,246 174,232 L174,214 L146,214 Z" fill="${SKIN_SHADOW}" opacity="0.55"/>
      <path d="M138,266 Q150,274 158,266 M182,266 Q170,274 162,266" fill="none" stroke="${SKIN_SHADOW}" stroke-width="1.6" stroke-linecap="round"/>`;

    // ドレス(深紅)
    const dress = isEvent
      ? `<path d="M92,440 L98,330 C106,304 128,288 160,286 C192,288 214,304 222,330 L228,440 Z" fill="${DRESS}"/>
         <path d="M98,330 C120,318 200,318 222,330 L222,342 C198,330 122,330 98,342 Z" fill="${DRESS_DARK}" opacity="0.7"/>
         <path d="M120,360 L116,440 M200,360 L204,440" stroke="${DRESS_DARK}" stroke-width="2" opacity="0.6"/>`
      : `<path d="M96,440 L102,326 C112,300 132,286 160,284 C188,286 208,300 218,326 L224,440 Z" fill="${DRESS}"/>
         <path d="M124,340 L120,440 M196,340 L200,440" stroke="${DRESS_DARK}" stroke-width="2" opacity="0.6"/>`;

    // ジャケット/ショール(通常時のみ)
    const jacket = isEvent ? '' : `
      <path d="M78,440 L88,320 C94,282 116,262 142,252 L136,300 C122,330 112,380 108,440 Z" fill="${JACKET}"/>
      <path d="M242,440 L232,320 C226,282 204,262 178,252 L184,300 C198,330 208,380 212,440 Z" fill="${JACKET}"/>
      <path d="M142,252 L136,300 M178,252 L184,300" stroke="#161226" stroke-width="2"/>`;

    // ネックレス
    const necklace = `
      <path d="M148,244 Q160,258 172,244" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
      <circle cx="160" cy="258" r="3" fill="${GOLD}"/>`;

    // 顔
    const face = `
      <ellipse cx="160" cy="150" rx="52" ry="58" fill="${SKIN}"/>
      <path d="M108,150 C110,190 132,212 160,214 C188,212 210,190 212,150 L212,168 C208,200 188,216 160,218 C132,216 112,200 108,168 Z" fill="${SKIN_SHADOW}" opacity="0.25"/>
      <ellipse cx="106" cy="152" rx="7" ry="10" fill="${SKIN}"/>
      <ellipse cx="214" cy="152" rx="7" ry="10" fill="${SKIN}"/>
      <circle cx="106" cy="166" r="3" fill="${GOLD}"/>
      <circle cx="214" cy="166" r="3" fill="${GOLD}"/>`;

    // 前髪
    const bangs = `
      <path d="M160,60 C118,60 100,88 102,126 C112,104 122,98 132,110 C140,96 152,92 160,92 C168,92 180,96 188,110 C198,98 208,104 218,126 C220,88 202,60 160,60 Z" fill="${HAIR}"/>
      <path d="M104,112 C96,146 98,184 106,212 L116,206 C108,178 108,146 114,116 Z" fill="${HAIR}"/>
      <path d="M216,112 C224,146 222,184 214,212 L204,206 C212,178 212,146 206,116 Z" fill="${HAIR}"/>
      <path d="M132,110 C140,96 152,92 160,92 C150,94 142,102 138,114 Z" fill="${HAIR_HI}" opacity="0.4"/>`;

    // イベント時に肩へ落ちる髪
    const hairFront = isEvent ? `
      <path d="M112,200 C104,250 96,300 100,360 L114,356 C110,300 116,252 122,212 Z" fill="${HAIR}"/>
      <path d="M208,200 C216,250 224,300 220,360 L206,356 C210,300 204,252 198,212 Z" fill="${HAIR}"/>` : '';

    const nose = `<path d="M159,166 Q162,170 159,173" fill="none" stroke="${SKIN_SHADOW}" stroke-width="1.6" stroke-linecap="round"/>`;
    const mole = `<circle cx="198" cy="167" r="1.4" fill="#5a3040"/>`;

    return `<svg viewBox="0 0 320 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="神楽坂綾乃">
      ${hairBack}
      ${torsoSkin}
      ${dress}
      ${jacket}
      ${necklace}
      ${face}
      ${blushMarks(E.blush)}
      ${brow(136, 132, E.brow)}
      ${brow(184, 132, E.brow)}
      ${eye(136, 152, E.eye)}
      ${eye(184, 152, E.eye)}
      ${nose}
      ${mouth(E.mouth)}
      ${mole}
      ${bangs}
      ${hairFront}
    </svg>`;
  };
})();
