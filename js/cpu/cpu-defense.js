/* cpu-defense.js - 守備型CPU(右家・仮キャラB)
 * 安全牌を重視し、リーチが入るとすぐ降りる。無理な鳴きをしない。
 * 順位状況(自分がトップに近いか)を多少考慮する。 */
window.YM = window.YM || {};

(function () {
  YM.CPU.registerProfile('defense', {
    kanRate: 0.3,
    keepDoraWeight: 1,
    chiEnabled: false,              // チーはしない
    chiRate: 0,
    daiminkan: false,
    callWhileThreat: false,
    callShantenMax: 1,
    callYakuhai: shanten => shanten <= 1,  // 役牌もテンパイ間近のみ

    riichiRate(G, idx, threats) {
      if (threats.length > 0) return 0.25;
      // トップ目なら安全策でリーチ率を下げる
      const rank = YM.GameState.ranks(G)[idx];
      return rank === 1 ? 0.5 : 0.7;
    },

    /* 降り判断: テンパイでも6割降りる。それ以外はベタオリ */
    shouldFold(G, idx, shanten, threats) {
      const rank = YM.GameState.ranks(G)[idx];
      if (shanten <= 0) {
        // ラス目のときだけ少し押す
        return Math.random() < (rank === 4 ? 0.35 : 0.6);
      }
      return true;
    }
  });
})();
