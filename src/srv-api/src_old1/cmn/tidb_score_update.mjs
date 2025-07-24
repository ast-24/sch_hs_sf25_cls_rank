import { calcScore } from "./utils.mjs";

// > これに続いて全体ランクのキャッシュ更新も走らせなければならない
// ただし上位に入った場合のみ

/**
 * 指定されたユーザの全ラウンドのスコアキャッシュを更新
 * @param {TidbClient} tidbCl - データベースクライアント
 * @param {number} userId - ユーザID
 */
export async function updateUserScoreCache(tidbCl, userId) {
    // ユーザ情報取得
    const userRows = await tidbCl.query(`
        SELECT id FROM users WHERE user_id = ?
        `, [userId]
    );
    if (userRows.length === 0) {
        throw new Error('User not found');
    }
    const userDbId = userRows[0].id;

    // 各ラウンドのスコアを計算・更新
    {
        const roundRows = await tidbCl.query(`
            SELECT id FROM users_rounds
            WHERE user_id = ?
            `, [userDbId]
        );

        for (const round of roundRows) {
            const answers = await tidbCl.query(`
                SELECT is_correct
                FROM users_rounds_answers
                WHERE round_id = ?
                ORDER BY q_id ASC
                `, [round.id]
            );
            const roundScore = calcScore(0, answers.map(a => a.is_correct));
            await tidbCl.query(`
            UPDATE users_rounds SET score = ? WHERE id = ?
            `, [roundScore, round.id]
            );
        }
    }

    // 累積スコア・最大スコアを更新
    await tidbCl.query(`
        UPDATE users
        SET score_today_total = (
                SELECT COALESCE(SUM(score), 0)
                FROM users_rounds WHERE user_id = ?
            ),
            score_round_max = (
                SELECT COALESCE(MAX(score), 0)
                FROM users_rounds WHERE user_id = ?
            )
        WHERE id = ?
    `, [userDbId, userDbId, userDbId]);
}

/**
 * 指定されたラウンドのスコアキャッシュを更新
 * @param {TidbClient} tidbCl - データベースクライアント
 * @param {number} userId - ユーザID
 * @param {number} roundId - ラウンドID
 */
export async function updateRoundScoreCache(tidbCl, userId, roundId) {
    // ユーザ情報取得
    const userRows = await tidbCl.query(`
        SELECT id FROM users WHERE user_id = ? `,
        [userId]
    );
    if (userRows.length === 0) {
        throw new Error('User not found');
    }
    const userDbId = userRows[0].id;

    // ラウンド情報を取得
    const answers = await tidbCl.query(`
        SELECT ur.id as round_id, ura.is_correct
        FROM users_rounds ur
        LEFT JOIN users_rounds_answers ura ON ur.id = ura.round_id
        WHERE ur.user_id = ? AND ur.round_id = ?
        ORDER BY ura.q_id ASC
    `, [userDbId, roundId]);
    if (answers.length === 0 || !answers[0].round_id) {
        throw new Error('Round not found');
    }
    const roundDbId = answers[0].round_id;

    // 1. ラウンドスコア計算・更新
    const roundScore = calcScore(0, answers.map(a => a.is_correct));
    await tidbCl.query(`
        UPDATE users_rounds SET score = ? WHERE id = ?
        `, [roundScore, roundDbId]
    );

    // 累積スコア・最大スコアを更新
    await tidbCl.query(`
        UPDATE users
        SET score_today_total = (
                SELECT COALESCE(SUM(score), 0)
                FROM users_rounds WHERE user_id = ?
            ),
            score_round_max = (
                SELECT COALESCE(MAX(score), 0)
                FROM users_rounds WHERE user_id = ?
            )
        WHERE id = ?
    `, [userDbId, userDbId, userDbId]);
}