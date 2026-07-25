/* result-manager.js - 和了処理・点数移動・結果表示 */
window.YM = window.YM || {};

(function () {
  const C = YM.CONST;
  const GS = () => YM.GameState;
  const UI = () => YM.UI;
  const G = () => YM.Game.G;

  const Result = {};

  /* ===== 和了 =====
   * opts: { tsumo, winTile, res, loser, chankan, allRons } */
  Result.win = function (winnerIdx, opts) {
    const g = G();
    if (g.phase === C.PHASE.ENDED) return;
    g.phase = C.PHASE.ENDED;
    g.busy = true;
    YM.timers.clearAll();

    const p = g.players[winnerIdx];
    const res = opts.res;
    const isDealer = GS().isDealer(g, winnerIdx);
    const S = YM.Scoring;

    /* --- 裏ドラ ---
     * リーチをかけて和了した場合のみ、王牌の裏ドラ表示牌をめくる。
     * 役満のときは加算しない(既存のドラの扱いに合わせる)。 */
    let uraIndicators = [];
    let uraCount = 0;
    if (p.isRiichi && !res.yakuman && g.wall) {
      try {
        uraIndicators = YM.Wall.uraDoraIndicators(g.wall).map(t => t.kind);
        const uraKinds = YM.Wall.uraDoraKinds(g.wall);
        const counts = {};
        p.hand.forEach(t => { counts[t.kind] = (counts[t.kind] || 0) + 1; });
        (p.melds || []).forEach(m => (m.tiles || []).forEach(t => {
          counts[t.kind] = (counts[t.kind] || 0) + 1;
        }));
        /* 和了牌は p.hand に含まれない(ロンは相手の捨て牌、ツモは drawnTile)
         * ため、ここで1枚加える。 */
        if (opts.winTile && opts.winTile.kind != null) {
          const wk = opts.winTile.kind;
          const inHand = p.hand.some(t => t.id === opts.winTile.id);
          if (!inHand) counts[wk] = (counts[wk] || 0) + 1;
        }
        for (const uk of uraKinds) uraCount += counts[uk] || 0;
        if (uraCount > 0) {
          res.han += uraCount;
          res.uraCount = uraCount;
        }
      } catch (e) {
        uraIndicators = [];
        uraCount = 0;
      }
    }

    const deltas = [0, 0, 0, 0];
    let payText = '';

    if (opts.tsumo) {
      const pay = S.tsumoPayment(res.han, res.fu, isDealer, res.yakuman);
      if (isDealer) {
        for (let i = 0; i < 4; i++) {
          if (i === winnerIdx) continue;
          deltas[i] -= pay.each + g.honba * 100;
        }
        payText = `${pay.each + g.honba * 100} オール`;
      } else {
        for (let i = 0; i < 4; i++) {
          if (i === winnerIdx) continue;
          const base = GS().isDealer(g, i) ? pay.dealer : pay.other;
          deltas[i] -= base + g.honba * 100;
        }
        payText = `${pay.other + g.honba * 100} / ${pay.dealer + g.honba * 100}`;
      }
      deltas[winnerIdx] = -deltas.reduce((s, d) => s + d, 0);
    } else {
      const pay = S.ronPayment(res.han, res.fu, isDealer, res.yakuman);
      const total = pay.total + g.honba * C.HONBA_VALUE;
      deltas[opts.loser] -= total;
      deltas[winnerIdx] += total;
      payText = `${total}`;
    }

    // 供託
    const stickCount = g.riichiSticks;
    const stickBonus = g.riichiSticks * C.RIICHI_COST;
    deltas[winnerIdx] += stickBonus;
    g.riichiSticks = 0;

    for (let i = 0; i < 4; i++) g.players[i].score += deltas[i];

    // 演出
    YM.Audio.se(opts.tsumo ? 'tsumo' : 'ron');
    YM.Animation.darken(1800);
    YM.Animation.announcement(opts.chankan ? '槍槓' : opts.tsumo ? 'ツモ' : 'ロン', {
      type: opts.tsumo ? 'tsumo' : 'ron',
      actor: p.name,
      life: 1800
    });
    if (res.yakuman) YM.Animation.yakumanBg(2600);
    else if (res.han >= 6) YM.Animation.flash();

    // 添付仕様の勝敗イベント。跳満以上は大勝/大敗、ツモ負けはCPUからランダム反応。
    const isBig = res.yakuman || res.han >= 6;
    let eventPlayer = null;
    let eventSituation = null;
    if (winnerIdx === 0) {
      const cpuPlayers = g.players.filter(q => !q.isHuman);
      const loserChar = opts.loser != null ? g.players[opts.loser] : null;
      if (res.yakuman) {
        eventPlayer = cpuPlayers.find(q => q.characterId === 'ayano') || cpuPlayers[Math.floor(Math.random() * cpuPlayers.length)];
        eventSituation = 'special';
      } else if (loserChar && !loserChar.isHuman) {
        eventPlayer = loserChar;
        eventSituation = isBig ? 'bigLoss' : 'cpuDealIn';
      } else {
        eventPlayer = cpuPlayers[Math.floor(Math.random() * cpuPlayers.length)];
        eventSituation = 'playerTsumo';
      }
    } else {
      const loserChar = opts.loser != null ? g.players[opts.loser] : null;
      if (loserChar && !loserChar.isHuman) {
        eventPlayer = loserChar;
        eventSituation = isBig ? 'bigLoss' : 'cpuDealIn';
      } else {
        eventPlayer = p;
        eventSituation = isBig ? 'bigWin' : 'cpuWin';
      }
    }
    if (eventPlayer) {
      YM.timers.set(() => {
        YM.CharacterUI.cutin(eventPlayer.characterId, eventSituation, {
          speaker: eventPlayer.id,
          banner: isBig ? (eventSituation === 'bigLoss' ? '痛恨の放銃' : '大物手') : null,
          life: 2200
        });
      }, 1350);
    }

    UI().renderGame(g);

    const rank = YM.Scoring.rankName(res.han, res.fu, res.yakuman);
    const winnerName = p.name;

    /* --- 和了アルバム / はじめてシリーズ ---
     * プレイヤー本人(index 0)の和了のみが対象。CPU の和了では何もしない。
     * はじめての達成はカメラ保存の有無に関わらず自動保存する。 */
    let albumEntry = null;
    let newFirsts = [];
    if (winnerIdx === 0 && YM.Album) {
      try {
        const firstCtx = {
          han: res.han, fu: res.fu, yakuman: res.yakuman,
          yakuList: res.yakuList, isDealer
        };
        const candidateIds = YM.Album.detectFirsts(firstCtx);
        newFirsts = YM.Storage.recordFirsts(candidateIds, {
          date: new Date().toISOString(),
          handName: YM.Album.handName(g),
          yaku: YM.Album.primaryYaku(res.yakuList),
          score: deltas[winnerIdx]
        });
        albumEntry = YM.Album.buildEntry({
          game: g,
          winnerIdx,
          tsumo: !!opts.tsumo,
          isDealer,
          entryId: YM.Album.makeEntryId(g, winnerIdx, opts.winTile.kind),
          winKind: opts.winTile.kind,
          yakuList: res.yakuList,
          doraCount: res.doraCount,
          han: res.han,
          fu: res.fu,
          yakuman: res.yakuman,
          gainedPoints: deltas[winnerIdx],
          payText,
          stickCount,
          doraIndicators: (g.wall && g.wall.doraIndicators || []).map(t => t.kind),
          uraDoraIndicators: uraIndicators,
          uraCount,
          firstBadges: newFirsts
        });
      } catch (e) {
        // アルバム関連の失敗で対局進行を止めない
        albumEntry = null;
        newFirsts = [];
      }
    }

    YM.timers.set(() => {
      YM.ResultUI.showWin({
        winnerIdx,
        banner: `${winnerName} の${opts.tsumo ? 'ツモ' : 'ロン'}和了`,
        handTiles: p.hand.map(t => t.kind),
        melds: p.melds,
        winKind: opts.winTile.kind,
        yakuList: res.yakuList,
        doraCount: res.doraCount,
        uraCount,
        uraIndicators,
        han: res.han,
        fu: res.fu,
        yakuman: res.yakuman,
        rank,
        payText,
        deltas,
        albumEntry,
        newFirsts,
        onNext: () => {
          YM.Round.advance({ ryuukyoku: false, dealerWon: isDealer });
        }
      });
      YM.Audio.se(winnerIdx === 0 ? 'win' : 'lose');
    }, eventPlayer ? 3750 : 2100);
  };

  YM.Result = Result;
})();
