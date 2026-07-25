/* cpu-balance.js - バランス型CPU(上家・神楽坂 綾乃)
 * 速度と打点の両方を見る。ドラを大切にし、状況に応じて鳴く。 */
window.YM = window.YM || {};

(function () {
  YM.CPU.registerProfile('balance', {
    kanRate: 0.6,
    keepDoraWeight: 2,              // ドラは手放しにくい
    chiEnabled: true,
    chiRate: 0.45,
    daiminkan: false,
    callWhileThreat: false,
    callShantenMax: 2,
    callYakuhai: shanten => shanten <= 3,

    riichiRate: (G, idx, threats) => threats.length > 0 ? 0.55 : 0.82,

    /* 降り判断: テンパイなら7割押し。それ以外は危険度を見て降りる */
    shouldFold(G, idx, shanten, threats) {
      if (shanten <= 0) return Math.random() < 0.3;
      if (shanten === 1) return Math.random() < 0.65;
      return true;
    }
  });
})();
