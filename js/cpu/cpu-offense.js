/* cpu-offense.js - 攻撃型CPU(左家・仮キャラA)
 * シャンテンと速度を最優先。鳴きに積極的で、リーチに対しても比較的押す。 */
window.YM = window.YM || {};

(function () {
  YM.CPU.registerProfile('offense', {
    kanRate: 0.85,
    keepDoraWeight: 0,
    chiEnabled: true,
    chiRate: 0.8,
    daiminkan: true,
    callWhileThreat: true,          // リーチが入っていても鳴く
    callShantenMax: 3,
    callYakuhai: shanten => true,   // 役牌は常に鳴く

    riichiRate: (G, idx, threats) => threats.length > 0 ? 0.75 : 0.92,

    /* 降り判断: テンパイなら9割押し。1シャンテンでも半分押す */
    shouldFold(G, idx, shanten, threats) {
      if (shanten <= 0) return Math.random() < 0.1;
      if (shanten === 1) return Math.random() < 0.45;
      return true;
    }
  });
})();
