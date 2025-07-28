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

    return new MyJsonResp({
        total: score_total,
        total_rank: totalRank,
        round_max: score_round_max,
        round_max_rank: roundMaxRank
    });
}