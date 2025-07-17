// スコア計算設定
const SCORE_CORRECT = 100;
const SCORE_INCORRECT = -500;

/**
 * ラウンドのスコアを計算
 * @param {TidbClient} tidbCl - データベースクライアント
 * @param {number} roundDbId - users_roundsテーブルのid
 * @returns {Promise<number>} 計算されたスコア
 */
export async function calculateRoundScore(tidbCl, roundDbId) {
    // 回答履歴を時系列順に取得
    const answers = await tidbCl.query(`
        SELECT is_correct
        FROM users_rounds_answers
        WHERE round_id = ?
        ORDER BY q_id ASC`,
        [roundDbId]
    );

    let score = 0;
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;

    for (const answer of answers) {
        if (answer.is_correct === null) {
            // パス: スコアに影響しないが連続判定は切れる
            consecutiveCorrect = 0;
            consecutiveIncorrect = 0;
        } else if (answer.is_correct) {
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

/**
 * 指定されたユーザの全ラウンドのスコアキャッシュを更新
 * @param {TidbClient} tidbCl - データベースクライアント
 * @param {number} roomId - ルームID
 * @param {number} userId - ユーザID
 */
export async function updateUserScoreCache(tidbCl, roomId, userId) {
    // ユーザ情報取得
    const userRows = await tidbCl.query(`
        SELECT id FROM users WHERE room_id = ? AND user_id = ?`,
        [roomId, userId]
    );
    if (userRows.length === 0) {
        throw new Error('User not found');
    }
    const userDbId = userRows[0].id;

    // 対象ユーザの今日の全ラウンドを取得
    const roundRows = await tidbCl.query(`
        SELECT id FROM users_rounds
        WHERE user_id = ?
        AND DATE(created_at) = CURDATE()`,
        [userDbId]
    );

    // 各ラウンドのスコアを計算・更新
    for (const round of roundRows) {
        const roundScore = await calculateRoundScore(tidbCl, round.id);
        await tidbCl.query(`
            UPDATE users_rounds SET score = ? WHERE id = ?`,
            [roundScore, round.id]
        );
    }

    // 今日の累積スコア計算・更新
    const todayScoreRows = await tidbCl.query(`
        SELECT COALESCE(SUM(score), 0) as total_score
        FROM users_rounds
        WHERE user_id = ?
        AND DATE(created_at) = CURDATE()`,
        [userDbId]
    );
    const todayTotalScore = todayScoreRows[0].total_score;

    // 今日の最大ラウンドスコア計算・更新
    const maxRoundScoreRows = await tidbCl.query(`
        SELECT COALESCE(MAX(score), 0) as max_score
        FROM users_rounds
        WHERE user_id = ?
        AND DATE(created_at) = CURDATE()`,
        [userDbId]
    );
    const maxRoundScore = maxRoundScoreRows[0].max_score;

    // usersテーブルのキャッシュ更新
    await tidbCl.query(`
        UPDATE users
        SET score_today_total = ?, score_round_max = ?
        WHERE id = ?`,
        [todayTotalScore, maxRoundScore, userDbId]
    );
}

/**
 * 指定されたラウンドのスコアキャッシュを更新
 * @param {TidbClient} tidbCl - データベースクライアント
 * @param {number} roomId - ルームID
 * @param {number} userId - ユーザID
 * @param {number} roundId - ラウンドID
 */
export async function updateRoundScoreCache(tidbCl, roomId, userId, roundId) {
    // ユーザ情報取得
    const userRows = await tidbCl.query(`
        SELECT id FROM users WHERE room_id = ? AND user_id = ?`,
        [roomId, userId]
    );
    if (userRows.length === 0) {
        throw new Error('User not found');
    }
    const userDbId = userRows[0].id;

    // ラウンド情報取得
    const roundRows = await tidbCl.query(`
        SELECT id FROM users_rounds WHERE user_id = ? AND round_id = ?`,
        [userDbId, roundId]
    );
    if (roundRows.length === 0) {
        throw new Error('Round not found');
    }
    const roundDbId = roundRows[0].id;

    // 1. ラウンドスコア計算・更新
    const roundScore = await calculateRoundScore(tidbCl, roundDbId);
    await tidbCl.query(`
        UPDATE users_rounds SET score = ? WHERE id = ?`,
        [roundScore, roundDbId]
    );

    // 2. 今日の累積スコア計算・更新
    const todayScoreRows = await tidbCl.query(`
        SELECT COALESCE(SUM(score), 0) as total_score
        FROM users_rounds
        WHERE user_id = ?
        AND DATE(created_at) = CURDATE()`,
        [userDbId]
    );
    const todayTotalScore = todayScoreRows[0].total_score;

    // 3. 今日の最大ラウンドスコア計算・更新
    const maxRoundScoreRows = await tidbCl.query(`
        SELECT COALESCE(MAX(score), 0) as max_score
        FROM users_rounds
        WHERE user_id = ?
        AND DATE(created_at) = CURDATE()`,
        [userDbId]
    );
    const maxRoundScore = maxRoundScoreRows[0].max_score;

    // usersテーブルのキャッシュ更新
    await tidbCl.query(`
        UPDATE users
        SET score_today_total = ?, score_round_max = ?
        WHERE id = ?`,
        [todayTotalScore, maxRoundScore, userDbId]
    );
}
