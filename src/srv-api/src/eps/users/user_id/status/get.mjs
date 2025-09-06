import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError } from "../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../../cmn/resp.mjs";
import { CONF } from "../../../../conf.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const scoreRows = await tidbCl.query(`
        SELECT score_total, score_round_max
        FROM users
        WHERE user_id = ?
        `, [userId]
    );
    if (scoreRows.length === 0) {
        throw new MyNotFoundError('user');
    }
    const { score_total, score_round_max } = scoreRows[0];

    let totalRank = null, roundMaxRank = null;

    if (CONF.RANKING.ENABLE.TOTAL && score_total !== null) {
        const totalRankRows = await tidbCl.query(`
            SELECT COUNT(*) + 1 AS total_rank
            FROM users
            WHERE score_total > ?
            `, [score_total]
        );
        totalRank = totalRankRows[0]?.total_rank ?? null;
    }

    if (CONF.RANKING.ENABLE.ROUND_MAX && score_round_max !== null) {
        const roundMaxRankRows = await tidbCl.query(`
            SELECT COUNT(*) + 1 AS round_max_rank
            FROM users
            WHERE score_round_max > ?
            `, [score_round_max]
        );
        roundMaxRank = roundMaxRankRows[0]?.round_max_rank ?? null;
    }

    // 総ユーザー数を取得
    const totalUsersRows = await tidbCl.query(`
        SELECT COUNT(*) AS total_users
        FROM users
    `);
    const totalUsers = totalUsersRows[0]?.total_users ?? 0;

    // 総ラウンド数を取得（実施された一意のラウンド数）
    const totalRoundsRows = await tidbCl.query(`
        SELECT COUNT(DISTINCT round_id) AS total_rounds
        FROM users_rounds
    `);
    const totalRounds = totalRoundsRows[0]?.total_rounds ?? 0;

    return new MyJsonResp({
        total_score: score_total,
        total_rank: Number(totalRank),
        round_max_score: score_round_max,
        round_max_rank: Number(roundMaxRank),
        total_users: Number(totalUsers),
        total_rounds: Number(totalRounds)
    });
}