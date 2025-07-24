import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError } from "../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../../cmn/resp.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const scoreRows = await tidbCl.query(`
        SELECT score_today_total, score_round_max
        FROM users
        WHERE user_id = ?
        `, [userId]
    );
    if (scoreRows.length === 0) {
        throw new MyNotFoundError('user');
    }
    const { score_today_total, score_round_max } = scoreRows[0];

    let todayRank = null, roundMaxRank = null;

    if (score_today_total !== null) {
        const todayRankRows = await tidbCl.query(`
            SELECT COUNT(*) + 1 AS rank
            FROM users
            WHERE score_today_total > ?
            `, [score_today_total]
        );
        todayRank = todayRankRows[0]?.rank ?? null;
    }

    if (score_round_max !== null) {
        const roundMaxRankRows = await tidbCl.query(`
            SELECT COUNT(*) + 1 AS rank
            FROM users
            WHERE score_round_max > ?
            `, [score_round_max]
        );
        roundMaxRank = roundMaxRankRows[0]?.rank ?? null;
    }

    return new MyJsonResp({
        today_total: score_today_total,
        today_total_rank: todayRank,
        round_max: score_round_max,
        round_max_rank: roundMaxRank
    });
}