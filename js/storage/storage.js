/* storage.js - localStorageによるセーブ管理(4人麻雀版)
 * 二人打ち版とはキーを分けている(共存可能)。
 *
 * 保存データは単一のオブジェクトに統合し、saveVersion で管理する。
 * 読み込み時は必ず defaults() とマージするため、旧バージョンの保存データに
 * 新しい項目が無くてもエラーにならず初期値が補完される。 */
window.YM = window.YM || {};

(function () {
  /* localStorage のキーはここで一元管理する。 */
  const KEY = 'yoimachi_mahjong_4p_save_v1';
  const SAVE_VERSION = 3;
  const ALBUM_LIMIT = 30;

  const VALID_AVATARS = [
    'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6',
    'avatar-7', 'avatar-8', 'avatar-9', 'avatar-10', 'avatar-11'
  ];
  const St = {};

  St.KEY = KEY;
  St.SAVE_VERSION = SAVE_VERSION;
  St.ALBUM_LIMIT = ALBUM_LIMIT;

  /* 「はじめてシリーズ」の定義。順序は表示順。 */
  const FIRST_DEFS = [
    { id: 'firstWin', label: 'はじめての和了' },
    { id: 'firstMangan', label: 'はじめての満貫' },
    { id: 'firstHaneman', label: 'はじめての跳満' },
    { id: 'firstBaiman', label: 'はじめての倍満' },
    { id: 'firstSanbaiman', label: 'はじめての三倍満' },
    { id: 'firstYakuman', label: 'はじめての役満' },
    { id: 'firstDealerMangan', label: 'はじめての親満以上' },
    { id: 'firstIppatsu', label: 'はじめてのリーチ一発' },
    { id: 'firstChiitoitsu', label: 'はじめての七対子' },
    { id: 'firstChinitsu', label: 'はじめての清一色' }
  ];
  St.FIRST_DEFS = FIRST_DEFS;
  St.firstLabel = function (id) {
    const def = FIRST_DEFS.find(d => d.id === id);
    return def ? def.label : id;
  };

  /* 設定系(「設定のみ初期化」で消える範囲) */
  function defaultSettingsGroup() {
    return {
      selectedCharacters: [],
      playerProfile: { name: '', avatar: '' },
      settings: { bgm: true, se: true, volume: 60, discard: 'double' }
    };
  }

  /* 記録系(「記録のみ初期化」で消える範囲) */
  function defaultRecordsGroup() {
    return {
      wins: 0,           // 1位回数
      gamesPlayed: 0,
      intimacy: 0,
      unlockedEvents: [],
      firstAchievements: {},  // { [id]: { date, handName, yaku, score } }
      agariAlbum: []
    };
  }

  function defaults() {
    return Object.assign(
      { saveVersion: SAVE_VERSION },
      defaultSettingsGroup(),
      defaultRecordsGroup()
    );
  }

  St.defaults = defaults;
  St.data = defaults();

  /* 保存できなかったときに UI から拾えるようにする。 */
  St.lastError = null;
  St.available = true;

  /* --- 正規化: 旧データ・壊れたデータでも安全に起動できるようにする --- */
  function normalize(data) {
    const base = defaults();
    const d = Object.assign(base, data || {});

    if (!Array.isArray(d.unlockedEvents)) d.unlockedEvents = [];

    // キャラ選択は旧キー名からも拾う
    const src = data || {};
    const legacySelection = Array.isArray(src.selectedCharacters) ? src.selectedCharacters
      : Array.isArray(src.selectedCharacterIds) ? src.selectedCharacterIds
      : Array.isArray(src.selectedCharacterIndices) ? src.selectedCharacterIndices
      : Array.isArray(src.selectedCharacterIndexes) ? src.selectedCharacterIndexes
      : [];
    d.selectedCharacters = YM.normalizeCharacterSelection(legacySelection);

    if (typeof d.intimacy !== 'number' || !isFinite(d.intimacy)) d.intimacy = 0;
    if (typeof d.wins !== 'number' || !isFinite(d.wins)) d.wins = 0;
    if (typeof d.gamesPlayed !== 'number' || !isFinite(d.gamesPlayed)) d.gamesPlayed = 0;

    d.settings = Object.assign(defaultSettingsGroup().settings, d.settings || {});
    d.settings.bgm = d.settings.bgm !== false;
    d.settings.se = d.settings.se !== false;
    const volume = Number(d.settings.volume);
    d.settings.volume = Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : 60;
    d.settings.discard = d.settings.discard === 'single' ? 'single' : 'double';

    d.playerProfile = Object.assign(defaultSettingsGroup().playerProfile, d.playerProfile || {});
    d.playerProfile.name = typeof d.playerProfile.name === 'string'
      ? d.playerProfile.name.trim().slice(0, 12) : '';
    if (!VALID_AVATARS.includes(d.playerProfile.avatar)) d.playerProfile.avatar = '';

    // 新項目: 旧データには存在しないので初期値を補完する
    if (!d.firstAchievements || typeof d.firstAchievements !== 'object' ||
        Array.isArray(d.firstAchievements)) {
      d.firstAchievements = {};
    }
    if (!Array.isArray(d.agariAlbum)) d.agariAlbum = [];
    d.agariAlbum = d.agariAlbum.filter(e => e && typeof e === 'object' && e.id);

    // 進行中対局フラグ。バックアップ取り込み時は対局を復元しない
    // (完全復元を保証できないため、軽量フラグのみ扱う)。
    d.activeGame = (d.activeGame && typeof d.activeGame === 'object') ? d.activeGame : null;

    d.saveVersion = SAVE_VERSION;
    return d;
  }
  St.normalize = normalize;

  St.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { St.data = defaults(); return St.data; }
      St.data = normalize(JSON.parse(raw));
      St.save();
    } catch (e) {
      // 壊れた保存データでもゲームは起動させる
      St.data = defaults();
      St.lastError = e;
    }
    return St.data;
  };

  /* 保存に失敗しても例外を投げず false を返す(呼び出し側で案内を出す)。 */
  St.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(St.data));
      St.lastError = null;
      St.available = true;
      return true;
    } catch (e) {
      St.lastError = e;
      St.available = false;
      return false;
    }
  };

  St.hasSave = function () {
    return St.data.gamesPlayed > 0 || St.data.intimacy > 0 || St.data.unlockedEvents.length > 0;
  };

  St.unlockEvent = function (id) {
    if (!St.data.unlockedEvents.includes(id)) {
      St.data.unlockedEvents.push(id);
      St.save();
    }
  };

  /* ===== 初期化(範囲を選べる) =====
   * 'settings' 設定のみ / 'records' 記録のみ / 'all' すべて */
  St.resetScope = function (scope) {
    if (scope === 'settings') {
      Object.assign(St.data, defaultSettingsGroup());
      return St.save();
    }
    if (scope === 'records') {
      Object.assign(St.data, defaultRecordsGroup());
      return St.save();
    }
    // all
    St.data = defaults();
    try { localStorage.removeItem(KEY); } catch (e) { St.lastError = e; }
    return St.save();
  };

  /* 旧APIの互換(全初期化) */
  St.reset = function () { return St.resetScope('all'); };

  /* ===== はじめてシリーズ =====
   * すでに達成済みの id は無視し、新規達成分だけを配列で返す。
   * カメラ保存の有無に関わらず自動保存する。 */
  St.recordFirsts = function (ids, info) {
    const gained = [];
    (ids || []).forEach(id => {
      if (St.data.firstAchievements[id]) return;
      St.data.firstAchievements[id] = {
        date: (info && info.date) || new Date().toISOString(),
        handName: (info && info.handName) || '',
        yaku: (info && info.yaku) || '',
        score: (info && info.score) != null ? info.score : 0
      };
      gained.push(id);
    });
    if (gained.length) St.save();
    return gained;
  };

  St.hasFirst = function (id) { return !!St.data.firstAchievements[id]; };

  /* ===== 和了アルバム ===== */
  St.albumCount = function () { return St.data.agariAlbum.length; };
  St.albumIsFull = function () { return St.data.agariAlbum.length >= ALBUM_LIMIT; };
  St.albumHas = function (id) { return St.data.agariAlbum.some(e => e.id === id); };
  St.albumGet = function (id) { return St.data.agariAlbum.find(e => e.id === id) || null; };

  /* 新しい順に返す */
  St.albumList = function () {
    return St.data.agariAlbum.slice().sort((a, b) =>
      String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  };

  /* 保存結果: { ok, reason } reason は 'full' | 'duplicate' | 'storage' */
  St.albumAdd = function (entry) {
    if (!entry || !entry.id) return { ok: false, reason: 'invalid' };
    if (St.albumHas(entry.id)) return { ok: false, reason: 'duplicate' };
    if (St.albumIsFull()) return { ok: false, reason: 'full' };
    St.data.agariAlbum.push(entry);
    if (!St.save()) {
      // 容量不足などで書き込めなかった場合はメモリ上も戻す
      St.data.agariAlbum = St.data.agariAlbum.filter(e => e.id !== entry.id);
      return { ok: false, reason: 'storage' };
    }
    return { ok: true };
  };

  St.albumRemove = function (id) {
    const before = St.data.agariAlbum.length;
    St.data.agariAlbum = St.data.agariAlbum.filter(e => e.id !== id);
    if (St.data.agariAlbum.length === before) return false;
    St.save();
    return true;
  };

  /* ===== バックアップ ===== */
  St.exportData = function () {
    // 進行中の対局(activeGame)は完全復元を保証できないため
    // JSONバックアップには含めない(不完全な対局で壊れるのを防ぐ)。
    const copy = Object.assign({}, St.data);
    delete copy.activeGame;
    return JSON.stringify(Object.assign(copy, {
      saveVersion: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'yoimachi-mahjong-4p'
    }), null, 2);
  };

  St.backupFileName = function () {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `yoimachi-mahjong-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
  };

  /* 妥当性チェック: このゲームの保存データらしいかを判定する。 */
  St.looksLikeBackup = function (obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    if (obj.app === 'yoimachi-mahjong-4p') return true;
    // app 名が無い旧バックアップでも、特徴的なキーが揃っていれば受け入れる
    const keys = ['saveVersion', 'playerProfile', 'settings', 'gamesPlayed', 'agariAlbum'];
    return keys.filter(k => Object.prototype.hasOwnProperty.call(obj, k)).length >= 2;
  };

  /* 取り込み: 不正な JSON の場合は既存データを一切変更しない。
   * 戻り値: { ok:true } または { ok:false, reason:'format'|'parse'|'storage' } */
  St.importData = function (text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, reason: 'parse' };
    }
    if (!St.looksLikeBackup(parsed)) return { ok: false, reason: 'format' };

    let normalized;
    try {
      normalized = normalize(parsed);
    } catch (e) {
      return { ok: false, reason: 'format' };
    }

    const backup = St.data;
    St.data = normalized;
    if (!St.save()) {
      St.data = backup;   // 書き込めなければ元に戻す
      return { ok: false, reason: 'storage' };
    }
    return { ok: true };
  };

  YM.Storage = St;
})();
