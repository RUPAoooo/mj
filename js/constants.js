/* constants.js - 4人麻雀版の共通定数 */
window.YM = window.YM || {};

YM.CONST = {
  // 牌kind
  EAST: 27, SOUTH: 28, WEST: 29, NORTH: 30,
  HAKU: 31, HATSU: 32, CHUN: 33,

  // プレイヤー数と席
  PLAYER_COUNT: 4,
  SEAT_NAMES: ['bottom', 'right', 'top', 'left'], // index順(反時計回り=巡目順)
  WIND_NAMES: ['東', '南', '西', '北'],

  // ルール設定
  START_SCORE: 25000,
  RETURN_SCORE: 30000,   // 返し点(最終結果のポイント換算に使用)
  MAX_HAND: 4,           // 東風戦: 東一局〜東四局
  RIICHI_COST: 1000,
  NOTEN_PENALTY_TOTAL: 3000,
  HONBA_VALUE: 300,      // ロン・ツモ合計の本場加算
  DEAD_WALL: 14,
  MAX_DORA_INDICATORS: 5,
  RIICHI_MIN_WALL: 4,    // 山がこれ未満だとリーチ不可

  // フェーズ
  PHASE: {
    IDLE: 'idle',
    DEALING: 'dealing',
    HUMAN_TURN: 'human-turn',
    CPU_TURN: 'cpu-turn',
    CALLS: 'calls',
    ANIM: 'anim',
    ENDED: 'ended'
  }
};

/* 席回りヘルパー */
YM.seat = {
  next: i => (i + 1) % 4,          // 下家(次の手番)
  prev: i => (i + 3) % 4,          // 上家(チー元)
  across: i => (i + 2) % 4,
  // dealerIndexから見た自風(kind値: 東27〜北30)
  windOf: (playerIndex, dealerIndex) => 27 + ((playerIndex - dealerIndex + 4) % 4),
  // 打牌者からの席順(頭ハネ・ポン優先順位に使用)
  orderFrom: from => [ (from + 1) % 4, (from + 2) % 4, (from + 3) % 4 ]
};
