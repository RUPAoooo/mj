/* main.js - 起動処理と画面間の配線(4人麻雀版) */
window.YM = window.YM || {};

/* 完成時は false にするとDEVボタンが消える */
/* 公開版では false。開発用のDEVボタン・パネルを通常画面から見えなくする。
 * 開発時に使う場合のみ true に戻す(コードは残してある)。 */
const DEBUG_MODE = false;

(function () {
  const $id = id => document.getElementById(id);
  const UI = () => YM.UI;
  const AU = () => YM.Audio;
  const St = () => YM.Storage;

  const Main = {};
  const PREP_BGM = 'assets/audio/mainbgm.mp3';
  let characterSelection = null;
  let selectedAvatar = '';
  const prepTouchedSettings = new Set();

  /* 進行中の対局があるか(「対局にもどる」の表示条件) */
  function hasActiveGame() {
    const g = YM.Game && YM.Game.G;
    return !!(g && !g.gameOver && g.phase !== YM.CONST.PHASE.IDLE && Main._activeGame);
  }

  /* 対局を一時停止してタイトルへ。対局状態は破棄しない。
   * source: 'ingame'(対局中のタイトルへ) の場合のみ復帰可能にする。 */
  Main.goTitle = function (opts) {
    opts = opts || {};
    const g = YM.Game && YM.Game.G;
    const preserve = opts.preserve && g && !g.gameOver &&
      g.phase !== YM.CONST.PHASE.IDLE;

    if (preserve) {
      // === 対局を一時停止して保持する ===
      Main._activeGame = true;
      YM.timers.pause();                 // 保留中の処理を凍結(CPU思考・自動遷移など)
      AU().stopGameBgm && AU().stopGameBgm();
      AU().stopBgm(true, true);          // 対局BGMを止める(タイトルBGMへ)
      // 対局画面のDOMとゲーム状態は保持したまま、画面だけ切り替える
      // (overlay類も現在の表示状態のまま残す)
      persistActiveGame();               // localStorage へ退避(可能な範囲で)
    } else {
      // === 対局を終了してタイトルへ ===
      endActiveGame();
    }

    refreshContinue();
    UI().showScreen('title');
  };

  /* タイトルから対局へ復帰する。状態は一切変更しない。 */
  Main.returnToGame = function () {
    if (!hasActiveGame()) return;
    AU().unlock();
    AU().se('select');
    UI().showScreen('game');
    // 対局用BGMを再開(二重再生しない)
    if (AU().playGameBgm) AU().playGameBgm();
    YM.timers.resume();                  // 凍結していた処理を残り時間で再開
  };

  /* 対局を完全に終了する(状態・タイマー・一時停止フラグを解除)。 */
  function endActiveGame() {
    YM.timers.clearAll();
    YM.timers.paused = false;
    YM.Animation.clear();
    if (YM.Round && YM.Round.resetTransientView) YM.Round.resetTransientView();
    $id('result-overlay').classList.add('hidden');
    $id('final-overlay').classList.add('hidden');
    $id('game-menu').classList.add('hidden');
    Main._activeGame = false;
    clearPersistedActiveGame();
    AU().stopGameBgm && AU().stopGameBgm();
    AU().stopBgm(true);
  }
  Main.endActiveGame = endActiveGame;

  /* 進行中対局の localStorage 退避(同一ページ内復帰が主目的)。
   * 完全復元が保証できないため、ここでは軽量なフラグのみを保存し、
   * 実際の状態は同一ページ内では YM.Game.G のメモリ上の値をそのまま使う。 */
  function persistActiveGame() {
    try {
      St().data.activeGame = { exists: true, pausedAtTitle: true, savedAt: new Date().toISOString() };
      St().save();
    } catch (e) { /* 保存できなくても対局復帰(同一ページ内)には影響しない */ }
  }

  function clearPersistedActiveGame() {
    try {
      if (St().data.activeGame) { St().data.activeGame = null; St().save(); }
    } catch (e) { /* no-op */ }
  }

  function refreshContinue() {
    // 「対局にもどる」は進行中の対局があるときだけ表示する。
    const btn = $id('btn-continue');
    if (!btn) return;
    if (hasActiveGame()) {
      btn.classList.remove('hidden');
      btn.disabled = false;
    } else {
      btn.classList.add('hidden');
      btn.disabled = true;
    }
  }

  /* GAME START: 進行中の対局があれば確認してから新規対局へ進む。 */
  function onGameStartClick() {
    if (hasActiveGame()) {
      openStartConfirm();
      return;
    }
    startGame();
  }

  function openStartConfirm() {
    AU().se('select');
    const box = $id('start-confirm');
    if (box) box.classList.remove('hidden');
  }

  function closeStartConfirm() {
    const box = $id('start-confirm');
    if (box) box.classList.add('hidden');
  }

  function startGame() {
    AU().unlock();
    AU().se('decide');
    // 新しい対局を始めるので、進行中の対局があれば破棄する。
    if (Main._activeGame) Main.endActiveGame();
    resetPrepInteractionState();
    const savedSelection = YM.normalizeCharacterSelection(St().data.selectedCharacters);
    characterSelection = YM.CharacterUI.buildCharacterSelect(savedSelection);
    refreshProfileUI(false);
    refreshPrepSettingsUI();
    updatePrepReady();
    UI().showScreen('character-select');
    AU().playBgm(PREP_BGM);
  }

  function confirmCharacters() {
    const selected = YM.normalizeCharacterSelection(
      characterSelection ? characterSelection.getSelected() : []
    );
    const name = $id('player-name').value.trim();
    if (!name) {
      $id('profile-error').textContent = 'プレイヤー名を入力してください。';
      $id('player-name').focus();
      return;
    }
    if (!selectedAvatar) {
      $id('profile-error').textContent = 'アバターを1つ選んでください。';
      return;
    }
    if (selected.length !== 3) return;
    St().data.playerProfile = { name: name.slice(0, 12), avatar: selectedAvatar };
    St().data.selectedCharacters = selected;
    St().save();
    AU().se('decide');
    Main._activeGame = true;
    YM.Round.startGame(selected);
  }

  /* ===== GAME START準備画面 ===== */
  function refreshProfileUI(clearAvatar) {
    const profile = St().data.playerProfile || { name: '', avatar: '' };
    $id('player-name').value = profile.name || '';
    selectedAvatar = clearAvatar ? '' : (profile.avatar || '');
    renderAvatarSelection();
    $id('profile-error').textContent = '';
  }

  function renderAvatarSelection() {
    document.querySelectorAll('.prep-avatar').forEach(btn => {
      const active = btn.dataset.avatar === selectedAvatar;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-checked', String(active));
      btn.tabIndex = active || !selectedAvatar ? 0 : -1;
    });
  }

  function updatePrepReady(showNameError) {
    const name = $id('player-name').value.trim();
    const opponents = characterSelection ? characterSelection.getSelected() : [];
    const ready = !!name && !!selectedAvatar && opponents.length === 3;
    const button = $id('btn-confirm-characters');
    button.disabled = !ready;
    button.classList.toggle('ready', ready);
    if (showNameError && !name) $id('profile-error').textContent = 'プレイヤー名を入力してください。';
    else if (name) $id('profile-error').textContent = '';
  }

  function refreshPrepSettingsUI() {
    if (!$id('prep-volume')) return;
    const s = St().data.settings;
    const setOption = (id, selected, key) => {
      const el = $id(id);
      const touched = prepTouchedSettings.has(key);
      el.classList.toggle('selected', touched && selected);
      el.classList.toggle('touched', touched);
      el.setAttribute('aria-pressed', String(selected));
    };
    setOption('prep-bgm-on', s.bgm, 'bgm');
    setOption('prep-bgm-off', !s.bgm, 'bgm');
    setOption('prep-se-on', s.se, 'se');
    setOption('prep-se-off', !s.se, 'se');
    $id('prep-volume').value = s.volume;
    $id('prep-volume-value').value = `${s.volume}%`;
    $id('prep-volume-value').textContent = `${s.volume}%`;
    document.querySelector('.prep-stage').classList.toggle('volume-touched', prepTouchedSettings.has('volume'));
  }

  function resetPrepInteractionState() {
    prepTouchedSettings.clear();
    const stage = document.querySelector('.prep-stage');
    if (stage) stage.classList.remove('volume-touched');
  }

  /* ===== データ管理(バックアップ / 初期化) ===== */

  function showDataMessage(msg, isError) {
    const el = $id('data-message');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', !!isError);
    el.classList.toggle('hidden', !msg);
    clearTimeout(showDataMessage._t);
    if (msg) showDataMessage._t = setTimeout(() => el.classList.add('hidden'), 4200);
  }

  /* 保存データを JSON ファイルとして書き出す */
  function exportBackup() {
    try {
      const json = St().exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = St().backupFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showDataMessage('バックアップを書き出しました');
      return true;
    } catch (e) {
      showDataMessage('バックアップを書き出せませんでした', true);
      return false;
    }
  }

  /* 初期化・読み込みの共通確認ダイアログ */
  function openDataConfirm(opts) {
    const box = $id('data-confirm');
    if (!box) return;
    $id('data-confirm-title').textContent = opts.title || '';
    $id('data-confirm-text').textContent = opts.text || '';
    const warn = $id('data-confirm-warn');
    warn.textContent = opts.warn || '';
    warn.classList.toggle('hidden', !opts.warn);
    $id('data-confirm-backup-note').classList.toggle('hidden', !opts.showBackup);
    $id('data-confirm-export').classList.toggle('hidden', !opts.showBackup);
    $id('data-confirm-yes').textContent = opts.okLabel || '削除する';
    $id('data-confirm-yes').onclick = () => {
      closeDataConfirm();
      if (opts.onOk) opts.onOk();
    };
    box.classList.remove('hidden');
  }

  function closeDataConfirm() {
    const box = $id('data-confirm');
    if (box) box.classList.add('hidden');
  }

  /* 初期化後に画面を安全に作り直す */
  function refreshAfterDataChange() {
    if (YM.Round && YM.Round.resetTransientView) YM.Round.resetTransientView();
    applyAudioSettings();
    resetPrepInteractionState();
    refreshSettingsUI();
    refreshProfileUI();
    characterSelection = YM.CharacterUI.buildCharacterSelect(St().data.selectedCharacters || []);
    updatePrepReady();
    refreshContinue();
  }

  function resetScope(scope) {
    const ok = St().resetScope(scope);
    refreshAfterDataChange();
    showDataMessage(ok ? '初期化しました' :
      '記録を保存できませんでした。ブラウザの保存容量を確認してください', !ok);
  }

  /* 設定のみ初期化 */
  function askResetSettings() {
    const activeWarn = hasActiveGame()
      ? '進行中の対局があります。設定を初期化すると、現在の対局も終了します。' : '';
    openDataConfirm({
      title: '設定のみ初期化',
      text: 'プレイヤー名、アバター、対戦相手の選択、音量などの設定を初期化します。戦績・はじめて記録・和了アルバムは残ります。',
      warn: activeWarn,
      okLabel: '初期化する',
      onOk: () => {
        if (Main._activeGame) Main.endActiveGame();
        resetScope('settings');
      }
    });
  }

  /* 記録のみ初期化 */
  function askResetRecords() {
    openDataConfirm({
      title: '記録のみ初期化',
      text: '対局回数、順位、戦績を初期化します。プレイヤー名・アバター・音量などの設定は残ります。',
      warn: '和了アルバムとはじめて記録も削除されます。この操作は元に戻せません。' +
        (hasActiveGame() ? '進行中の対局も終了します。' : ''),
      showBackup: true,
      onOk: () => {
        if (Main._activeGame) Main.endActiveGame();
        resetScope('records');
      }
    });
  }

  /* すべて初期化 */
  function resetSaveData() {
    openDataConfirm({
      title: 'すべてのデータを初期化',
      text: '設定・戦績・はじめて記録・和了アルバムを含む、すべての保存データを削除して初回起動時の状態に戻します。',
      warn: '和了アルバムとはじめて記録も削除されます。この操作は元に戻せません。' +
        (hasActiveGame() ? '進行中の対局も終了します。' : ''),
      showBackup: true,
      onOk: () => {
        if (Main._activeGame) Main.endActiveGame();
        resetScope('all');
      }
    });
  }

  /* バックアップ読み込み */
  function importBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      openDataConfirm({
        title: 'バックアップを読み込む',
        text: 'バックアップデータを読み込むと、現在の記録と設定が上書きされます。よろしいですか？',
        okLabel: '読み込む',
        onOk: () => {
          const res = St().importData(text);
          if (res.ok) {
            refreshAfterDataChange();
            showDataMessage('バックアップを読み込みました');
          } else if (res.reason === 'format') {
            showDataMessage('このファイルは宵待ち麻雀倶楽部のバックアップデータではありません', true);
          } else if (res.reason === 'storage') {
            showDataMessage('記録を保存できませんでした。ブラウザの保存容量を確認してください', true);
          } else {
            showDataMessage('バックアップファイルを読み込めませんでした', true);
          }
        }
      });
    };
    reader.onerror = () => showDataMessage('バックアップファイルを読み込めませんでした', true);
    reader.readAsText(file);
  }

  function wirePrepScreen() {
    $id('player-name').addEventListener('input', e => {
      St().data.playerProfile.name = e.target.value.slice(0, 12);
      St().save();
      updatePrepReady(false);
    });
    $id('player-name').addEventListener('blur', () => {
      St().data.playerProfile.name = $id('player-name').value.trim().slice(0, 12);
      $id('player-name').value = St().data.playerProfile.name;
      St().save();
      updatePrepReady(true);
    });
    document.querySelectorAll('.prep-avatar').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedAvatar = btn.dataset.avatar;
        St().data.playerProfile.avatar = selectedAvatar;
        St().save();
        renderAvatarSelection();
        updatePrepReady();
        AU().se('select');
      });
      btn.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const buttons = Array.from(document.querySelectorAll('.prep-avatar'));
        const current = buttons.indexOf(btn);
        const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -3 : 3;
        buttons[(current + delta + buttons.length) % buttons.length].focus();
      });
    });
    document.addEventListener('ym:opponents-changed', e => {
      St().data.selectedCharacters = YM.normalizeCharacterSelection(e.detail);
      St().save();
      updatePrepReady();
    });

    const setAudio = (key, value) => {
      prepTouchedSettings.add(key);
      St().data.settings[key] = value;
      St().save();
      applyAudioSettings();
      refreshSettingsUI();
      AU().se('select');
    };
    $id('prep-bgm-on').addEventListener('click', () => setAudio('bgm', true));
    $id('prep-bgm-off').addEventListener('click', () => setAudio('bgm', false));
    $id('prep-se-on').addEventListener('click', () => setAudio('se', true));
    $id('prep-se-off').addEventListener('click', () => setAudio('se', false));
    const revealVolume = () => {
      prepTouchedSettings.add('volume');
      refreshPrepSettingsUI();
    };
    $id('prep-volume').addEventListener('pointerdown', revealVolume);
    $id('prep-volume').addEventListener('focus', revealVolume);
    $id('prep-volume').addEventListener('input', e => {
      prepTouchedSettings.add('volume');
      St().data.settings.volume = parseInt(e.target.value, 10);
      St().save();
      applyAudioSettings();
      refreshSettingsUI();
    });
    $id('prep-reset').addEventListener('click', resetSaveData);
  }

  /* ===== 設定画面 ===== */
  function refreshSettingsUI() {
    const s = St().data.settings;
    $id('set-bgm').textContent = s.bgm ? 'ON' : 'OFF';
    $id('set-bgm').classList.toggle('off', !s.bgm);
    $id('set-se').textContent = s.se ? 'ON' : 'OFF';
    $id('set-se').classList.toggle('off', !s.se);
    $id('set-volume').value = s.volume;
    $id('set-volume-val').textContent = s.volume;
    if ($id('set-discard')) {
      $id('set-discard').textContent = s.discard === 'single' ? '1クリック' : '2クリック';
      $id('set-discard').classList.toggle('off', s.discard === 'single');
    }
    refreshPrepSettingsUI();
  }

  function applyAudioSettings() {
    const s = St().data.settings;
    AU().settings.bgm = s.bgm;
    AU().settings.se = s.se;
    AU().settings.volume = s.volume;
    AU().applyVolume();
    AU().syncBgm();
  }

  let settingsReturn = 'title';

  function wireSettings() {
    $id('set-bgm').addEventListener('click', () => {
      St().data.settings.bgm = !St().data.settings.bgm;
      St().save(); applyAudioSettings(); refreshSettingsUI(); AU().se('select');
    });
    $id('set-se').addEventListener('click', () => {
      St().data.settings.se = !St().data.settings.se;
      St().save(); applyAudioSettings(); refreshSettingsUI(); AU().se('select');
    });
    $id('set-volume').addEventListener('input', e => {
      St().data.settings.volume = parseInt(e.target.value, 10);
      St().save(); applyAudioSettings();
      $id('set-volume-val').textContent = e.target.value;
    });
    if ($id('set-discard')) {
      $id('set-discard').addEventListener('click', () => {
        const s = St().data.settings;
        s.discard = s.discard === 'single' ? 'double' : 'single';
        St().save(); refreshSettingsUI(); AU().se('select');
      });
    }
    $id('set-reset').addEventListener('click', resetSaveData);
    $id('set-reset-settings').addEventListener('click', () => { AU().se('select'); askResetSettings(); });
    $id('set-reset-records').addEventListener('click', () => { AU().se('select'); askResetRecords(); });
    $id('set-export').addEventListener('click', () => { AU().se('select'); exportBackup(); });
    $id('set-import').addEventListener('click', () => { AU().se('select'); $id('set-import-file').click(); });
    $id('set-import-file').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      importBackupFile(file);
    });
    $id('data-confirm-no').addEventListener('click', () => { AU().se('select'); closeDataConfirm(); });
    $id('data-confirm-export').addEventListener('click', () => { AU().se('select'); exportBackup(); });
  }

  /* ===== スマホ判定 ===== */
  function checkMobile() {
    const small = Math.max(window.innerWidth, window.innerHeight) < 900 ||
      (window.innerWidth < 700);
    $id('mobile-block').classList.toggle('hidden', !small);
  }

  /* ===== 起動 ===== */
  document.addEventListener('DOMContentLoaded', () => {
    St().load();
    applyAudioSettings();
    wirePrepScreen();
    wireSettings();
    refreshSettingsUI();
    refreshContinue();
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // タイトルメニュー
    $id('btn-start').addEventListener('click', onGameStartClick);
    $id('btn-random-characters').addEventListener('click', () => { AU().se('select'); characterSelection.randomize(); });
    $id('btn-confirm-characters').addEventListener('click', confirmCharacters);
    $id('btn-character-back').addEventListener('click', () => { AU().se('select'); Main.goTitle(); });
    $id('btn-howto').addEventListener('click', () => { AU().unlock(); AU().se('select'); settingsReturn = 'title'; UI().showScreen('howto'); });
    $id('btn-prep-howto').addEventListener('click', () => { AU().se('select'); settingsReturn = 'character-select'; UI().showScreen('howto'); });
    $id('btn-settings').addEventListener('click', () => {
      AU().unlock(); AU().se('select');
      settingsReturn = 'title';
      UI().showScreen('settings');
    });
    $id('btn-gallery').addEventListener('click', () => {
      AU().unlock(); AU().se('select');
      YM.AlbumUI.open();
      UI().showScreen('gallery');
    });
    $id('btn-credit').addEventListener('click', () => { AU().unlock(); AU().se('select'); UI().showScreen('credit'); });

    // 「もどる」共通
    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => {
        AU().se('select');
        // 確認ダイアログが開いていたら閉じるだけにする(誤って画面遷移しない)
        const dc = $id('data-confirm');
        if (dc && !dc.classList.contains('hidden')) {
          closeDataConfirm();
          return;
        }
        const returnToGame = settingsReturn === 'game' || settingsReturn === 'game-direct';
        UI().showScreen(returnToGame ? 'game' : settingsReturn === 'character-select' ? 'character-select' : 'title');
        if (settingsReturn === 'game') $id('game-menu').classList.remove('hidden');
        settingsReturn = 'title';
        refreshContinue();
      });
    });

    // 和了アルバム
    $id('album-back-list').addEventListener('click', () => {
      AU().se('select'); YM.AlbumUI.backToList();
    });
    $id('album-delete').addEventListener('click', () => {
      AU().se('select'); YM.AlbumUI.askDelete();
    });
    $id('album-delete-no').addEventListener('click', () => {
      AU().se('select'); YM.AlbumUI.cancelDelete();
    });
    $id('album-delete-yes').addEventListener('click', () => YM.AlbumUI.confirmDelete());
    $id('album-export-png').addEventListener('click', () => {
      AU().se('select'); YM.AlbumUI.exportPng();
    });

    // 対局中の操作ボタン
    $id('btn-riichi').addEventListener('click', () => YM.Turn.onRiichiButton());
    $id('btn-tsumo').addEventListener('click', () => YM.Turn.onTsumoButton());
    $id('btn-kan').addEventListener('click', () => {
      const g = YM.Game.G;
      const pending = g && g.phase === 'calls' && g.pendingCalls;
      const myCall = pending && pending.options && pending.options.find(option => option.player === 0);
      if (myCall && myCall.minkan) YM.Calls.onHumanDecision({ type: 'kan' });
      else YM.Turn.onKanButton();
    });
    $id('btn-ron').addEventListener('click', () => {
      const g = YM.Game.G;
      if (g && g.pendingCalls && g.pendingCalls.mode === 'chankan') YM.Calls.onHumanChankan(true);
      else YM.Calls.onHumanDecision({ type: 'ron' });
    });
    $id('btn-pon').addEventListener('click', () => YM.Calls.onHumanDecision({ type: 'pon' }));
    $id('btn-minkan').addEventListener('click', () => YM.Calls.onHumanDecision({ type: 'kan' }));
    $id('btn-chi').addEventListener('click', () => YM.Calls.onHumanDecision({ type: 'chi' }));
    $id('game-frame').addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, .tile, input, label, a, #table-player-cards, .overlay, #oyakime-layer, #start-greeting-layer, #chi-select')) return;

      const g = YM.Game.G;
      if (!g || g.busy) return;
      if (g.riichiMode) {
        YM.Turn.onRiichiButton();
        return;
      }
      if (g.phase === YM.CONST.PHASE.CALLS && g.pendingCalls) {
        const myCall = g.pendingCalls.options && g.pendingCalls.options.find(option => option.player === 0);
        if (myCall) {
          YM.UI.hideChiSelect();
          YM.Calls.onHumanPass();
        }
        return;
      }
      if (g.phase === YM.CONST.PHASE.HUMAN_TURN && g.players[0].isRiichi && g.humanOptions && g.humanOptions.tsumo) {
        YM.Turn.onPassTsumo();
      }
    });

    $id('btn-table-title').addEventListener('click', () => {
      AU().se('select');
      Main.goTitle({ preserve: true });
    });
    $id('btn-table-settings').addEventListener('click', () => {
      AU().se('select');
      settingsReturn = 'game-direct';
      $id('game-menu').classList.add('hidden');
      UI().showScreen('settings');
    });
    $id('chi-select-cancel').addEventListener('click', () => {
      UI().hideChiSelect();
    });

    // ゲーム内メニュー
    $id('gm-resume').addEventListener('click', () => {
      AU().se('select');
      $id('game-menu').classList.add('hidden');
    });
    $id('gm-settings').addEventListener('click', () => {
      AU().se('select');
      settingsReturn = 'game';
      $id('game-menu').classList.add('hidden');
      UI().showScreen('settings');
    });
    $id('gm-title').addEventListener('click', () => {
      AU().se('select');
      $id('game-menu').classList.add('hidden');
      Main.goTitle({ preserve: true });
    });

    // 勝利イベント後の選択肢
    $id('ev-rematch').addEventListener('click', () => { AU().se('decide'); Main.endActiveGame(); YM.Round.startGame(); });
    $id('ev-title').addEventListener('click', () => Main.goTitle());

    // 「対局にもどる」
    $id('btn-continue').addEventListener('click', () => {
      if (!hasActiveGame()) return;
      Main.returnToGame();
    });

    // GAME START 確認ダイアログ(進行中の対局がある場合)
    $id('start-confirm-new').addEventListener('click', () => {
      AU().se('decide');
      closeStartConfirm();
      Main.endActiveGame();
      startGame();
    });
    $id('start-confirm-return').addEventListener('click', () => {
      AU().se('select');
      closeStartConfirm();
      Main.returnToGame();
    });
    $id('start-confirm-cancel').addEventListener('click', () => {
      AU().se('select');
      closeStartConfirm();
    });

    // DEVパネル
    if (!DEBUG_MODE) {
      $id('dev-toggle').style.display = 'none';
      const devPanel = $id('dev-panel');
      if (devPanel) devPanel.classList.add('hidden');
    } else {
      YM.Dev.wire();
    }

    UI().showScreen('title');
  });

  YM.Main = Main;
})();
