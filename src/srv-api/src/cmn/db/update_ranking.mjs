import {
    RANKING_TODAY_TOTAL_COUNT_LIMIT,
    RANKING_ROUND_COUNT_LIMIT,
    RANKING_ROUND_MAX_COUNT_LIMIT,
    RANKING_ROUND_LATEST_BORDER_MIN
} from '../conf.mjs';

/*
struct target {
    todayTotal: boolean,
    round: boolean,
    roundMax: boolean,
    roundLatest: boolean
}
*/

export async function updateRanking(
    tidbCl,
    target
) {
    await tidbCl.execInTxOptional(
        async (tidbCl) => {
            if (target.todayTotal) {
                await updateTodayTotalRanking(tidbCl);
                await updateRankingUpdatedTime(tidbCl, 'today_total');
            }
            if (target.round) {
                await updateRoundRanking(tidbCl);
                await updateRankingUpdatedTime(tidbCl, 'round');
            }
            if (target.roundMax) {
                await updateRoundMaxRanking(tidbCl);
                await updateRankingUpdatedTime(tidbCl, 'round_max');
            }
            if (target.roundLatest) {
                await updateRoundLatestRanking(tidbCl);
                await updateRankingUpdatedTime(tidbCl, 'round_latest');
            }
        }
    );
}

/**
 * 今日の累積スコアランキングキャッシュを更新
 */
async function updateTodayTotalRanking(tidbCl) {
    await tidbCl.query(`
        INSERT INTO rankings_cache_today_total (user_id, score, user_pub_id, user_display_name)
        SELECT
            u.id,
            u.score_today_total,
            u.user_id,
            u.display_name
        FROM users u
        WHERE u.score_today_total IS NOT NULL
        ORDER BY u.score_today_total DESC
        LIMIT ?
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            user_pub_id = VALUES(user_pub_id),
            user_display_name = VALUES(user_display_name)
    `, [RANKING_TODAY_TOTAL_COUNT_LIMIT]);

    await tidbCl.query(`
        DELETE FROM rankings_cache_today_total
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM rankings_cache_today_total
                ORDER BY score DESC
                LIMIT ?
            ) as top_records
        )
    `, [RANKING_TODAY_TOTAL_COUNT_LIMIT]);
}

/**
 * 単一ラウンド最大スコアランキングキャッシュを更新
 */
async function updateRoundMaxRanking(tidbCl) {
    await tidbCl.query(`
        INSERT INTO rankings_cache_round_max (user_id, score, user_pub_id, user_display_name)
        SELECT
            u.id,
            u.score_round_max,
            u.user_id,
            u.display_name
        FROM users u
        WHERE u.score_round_max IS NOT NULL
        ORDER BY u.score_round_max DESC
        LIMIT ?
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            user_pub_id = VALUES(user_pub_id),
            user_display_name = VALUES(user_display_name)
    `, [RANKING_ROUND_MAX_COUNT_LIMIT]);

    await tidbCl.query(`
        DELETE FROM rankings_cache_round_max
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM rankings_cache_round_max
                ORDER BY score DESC
                LIMIT ?
            ) as top_records
        )
    `, [RANKING_ROUND_MAX_COUNT_LIMIT]);
}

/**
 * 単一ラウンドスコアランキングキャッシュを更新
 */
async function updateRoundRanking(tidbCl) {
    await tidbCl.query(`
        INSERT INTO rankings_cache_round (round_id, score, user_pub_id, user_display_name)
        SELECT
            ur.id,
            ur.score,
            u.user_id,
            u.display_name
        FROM users_rounds ur
        JOIN users u ON ur.user_id = u.id
        WHERE ur.score IS NOT NULL
        ORDER BY ur.score DESC
        LIMIT ?
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            user_pub_id = VALUES(user_pub_id),
            user_display_name = VALUES(user_display_name)
    `, [RANKING_ROUND_COUNT_LIMIT]);

    await tidbCl.query(`
        DELETE FROM rankings_cache_round
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM rankings_cache_round
                ORDER BY score DESC
                LIMIT ?
            ) as top_records
        )
    `, [RANKING_ROUND_COUNT_LIMIT]);
}

/**
 * 最新ラウンドランキングキャッシュを更新
 */
async function updateRoundLatestRanking(tidbCl) {
    // 既存データを全削除（ルーム数が減る可能性があるため）
    await tidbCl.query(`DELETE FROM rankings_cache_round_latest`);

    // 各ルームの最新ラウンド（かつRANKING_ROUND_LATEST_BORDER_MIN分以内に終了）を取得してキャッシュに挿入
    // 各ルームにつき最大1レコードのみ保存される
    await tidbCl.query(`
        WITH latest_rounds AS (
            SELECT
                ur.*,
                ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY finished_at DESC) as rn
            FROM users_rounds ur
            WHERE finished_at IS NOT NULL
                AND finished_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        )
        INSERT INTO rankings_cache_round_latest (room_id, finished_at, round_id, score, user_pub_id, user_display_name)
        SELECT
            ur.room_id,
            ur.finished_at,
            ur.id,
            ur.score,
            u.user_id,
            u.display_name
        FROM latest_rounds ur
        JOIN users u ON ur.user_id = u.id
        WHERE ur.rn = 1 AND ur.score IS NOT NULL
    `, [RANKING_ROUND_LATEST_BORDER_MIN]);
}

/**
 * ランキング更新時刻を更新
 */
async function updateRankingUpdatedTime(tidbCl, rankingType) {
    await tidbCl.query(`
        INSERT INTO rankings_cache_updated (ranking_type, ranking_updated_at)
        VALUES (?, NOW())
        ON DUPLICATE KEY UPDATE
        ranking_updated_at = NOW()
    `, [rankingType]);
}