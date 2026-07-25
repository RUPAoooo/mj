/* dialogue.js - セリフ選択(直前と同じセリフを繰り返さない) */
window.YM = window.YM || {};

(function () {
  const D = {};
  const lastIndex = {};

  /* charId のセリフ集から situation のセリフを1つ選ぶ */
  D.pick = function (charId, situation) {
    charId = YM.resolveCharacterId(charId);
    const generic = {
      opening: [{ expr: 'normal', text: 'よろしくお願いします。' }],
      idle: [{ expr: 'normal', text: 'いい勝負になりそうですね。' }],
      thinking: [{ expr: 'thinking', text: '……少し考えます。' }],
      cpuWin: [{ expr: 'normal', text: 'いただきました。' }],
      cpuDealIn: [{ expr: 'normal', text: 'これは参りました。' }],
      playerTsumo: [{ expr: 'normal', text: 'お見事です。' }],
      bigWin: [{ expr: 'bigWin', text: '大きく決まりました！' }],
      bigLoss: [{ expr: 'bigLoss', text: 'これは痛いですね……。' }],
      special: [{ expr: 'special', text: '特別なお祝いをしましょう。' }]
    };
    const table = (YM.DIALOGUES[charId] || {})[situation] || generic[situation];
    if (!table || table.length === 0) return null;
    let idx = Math.floor(Math.random() * table.length);
    const key = charId + ':' + situation;
    if (table.length > 1 && idx === lastIndex[key]) {
      idx = (idx + 1) % table.length;
    }
    lastIndex[key] = idx;
    return table[idx];
  };

  YM.Dialogue = D;
})();
