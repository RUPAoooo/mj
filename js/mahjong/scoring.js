/* scoring.js - 点数計算(4人麻雀版)
 * 符×翻から基本点を計算し、親子・ロン/ツモの支払いを算出する。
 * 基本点 = 符 × 2^(2+翻)。満貫以上は固定値。100点単位に切り上げ。 */
window.YM = window.YM || {};

(function () {
  const S = {};

  const ceil100 = x => Math.ceil(x / 100) * 100;

  /* 基本点(子ロン=×4、親ロン=×6の元になる値) */
  S.basePoints = function (han, fu, yakuman) {
    if (yakuman || han >= 13) return 8000;   // 役満
    if (han >= 11) return 6000;              // 三倍満
    if (han >= 8) return 4000;               // 倍満
    if (han >= 6) return 3000;               // 跳満
    if (han >= 5) return 2000;               // 満貫
    const base = fu * Math.pow(2, 2 + han);
    return Math.min(base, 2000);             // 3〜4翻の高符は満貫止め
  };

  S.rankName = function (han, fu, yakuman) {
    if (yakuman || han >= 13) return '役満';
    if (han >= 11) return '三倍満';
    if (han >= 8) return '倍満';
    if (han >= 6) return '跳満';
    if (han >= 5) return '満貫';
    if (han >= 3 && S.basePoints(han, fu, false) >= 2000) return '満貫';
    return '';
  };

  /* ロンの支払い { total } */
  S.ronPayment = function (han, fu, isDealer, yakuman) {
    const base = S.basePoints(han, fu, yakuman);
    return { total: ceil100(base * (isDealer ? 6 : 4)) };
  };

  /* ツモの支払い
   * 親ツモ: { each } 子3人が均等払い
   * 子ツモ: { dealer, other } 親が2倍払い */
  S.tsumoPayment = function (han, fu, isDealer, yakuman) {
    const base = S.basePoints(han, fu, yakuman);
    if (isDealer) {
      const each = ceil100(base * 2);
      return { each, total: each * 3 };
    }
    const dealer = ceil100(base * 2);
    const other = ceil100(base);
    return { dealer, other, total: dealer + other * 2 };
  };

  YM.Scoring = S;
})();
