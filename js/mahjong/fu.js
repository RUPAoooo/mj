/* fu.js - 符計算(4人麻雀版)
 * compute({sets, pair, waitType, tsumo, menzen, pinfu, chiitoi, seatWind, roundWind}) -> 符(切り上げ済み)
 * sets: [{type:'run'|'triplet', tile, open, kan, concealed}]
 * waitType: 'ryanmen'|'kanchan'|'penchan'|'shanpon'|'tanki' */
window.YM = window.YM || {};

(function () {
  const T = () => YM.Tiles;
  const C = YM.CONST;
  const F = {};

  F.compute = function (opts) {
    if (opts.chiitoi) return 25;

    // 平和は固定符
    if (opts.pinfu) return opts.tsumo ? 20 : 30;

    let fu = 20;
    if (opts.menzen && !opts.tsumo) fu += 10;  // 門前ロン加符
    if (opts.tsumo) fu += 2;                    // ツモ符

    // 待ち符
    if (opts.waitType === 'kanchan' || opts.waitType === 'penchan' || opts.waitType === 'tanki') fu += 2;

    // 雀頭符(連風牌は+4)
    const p = opts.pair;
    if (p >= C.HAKU) fu += 2;
    if (p === opts.seatWind) fu += 2;
    if (p === opts.roundWind) fu += 2;

    // 面子符
    for (const s of opts.sets) {
      if (s.type !== 'triplet') continue;
      let v = 2;
      if (s.concealed) v *= 2;
      if (T().isYaochu(s.tile)) v *= 2;
      if (s.kan) v *= 4;
      fu += v;
    }

    // 喰い平和形(副露のみ・加符なしのロン20符)は30符扱い
    if (fu === 20 && !opts.tsumo) fu = 30;

    return Math.ceil(fu / 10) * 10;
  };

  YM.Fu = F;
})();
