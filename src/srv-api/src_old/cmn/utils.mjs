// スコア計算設定
const SCORE_CORRECT = 100;
const SCORE_INCORRECT = -500;

/**
 * 正解かどうかの配列からスコアを計算する関数
 * @param {Number} initScore
 * @param {Array<Boolean>} ansAry
 * @returns {Number} 計算されたスコア
 */
export function calcScore(initScore, ansAry) {
    let score = initScore || 0;
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;

    for (const ans of ansAry) {
        if (ans === null) {
            // パス: スコアに影響しないが連続判定は切れる
            consecutiveCorrect = 0;
            consecutiveIncorrect = 0;
        } else if (ans) {
            // 正解
            consecutiveIncorrect = 0;
            consecutiveCorrect++;
            score += SCORE_CORRECT * consecutiveCorrect;
        } else {
            // 不正解
            consecutiveCorrect = 0;
            consecutiveIncorrect++;
            score += SCORE_INCORRECT * consecutiveIncorrect;
        }
    }

    return score;
}