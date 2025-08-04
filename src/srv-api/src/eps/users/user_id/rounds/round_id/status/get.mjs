import { TidbClient } from "../../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError } from "../../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../../cmn/resp.mjs";
import { calcScore } from "../../../../../../cmn/calc_score.mjs";
import { CONF } from "../../../../../../conf.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);
    const roundId = getRoundIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const userRows = await tidbCl.query(`
        SELECT ur.id, ur.finished_at, ur.score
        FROM users_rounds ur
        JOIN users u ON ur.user_id = u.id
        WHERE u.user_id = ? AND ur.round_id = ?
        `, [userId, roundId]
    );
    if (userRows.length === 0) {
        throw new MyNotFoundError('user or round');
    }

    const { id: roundDbId, finished_at, score } = userRows[0];
    let result = {};

    if (finished_at) {
        // finished: スコアはそのまま、ランクを計算

        let roundRank = null;
        if (CONF.RANKING.ENABLE.ROUND && score !== null) {
            const rankRows = await tidbCl.query(`
                SELECT COUNT(*) + 1 AS round_rank
                FROM users_rounds
                WHERE score > ?
                `, [score]
            );
            roundRank = rankRows[0]?.round_rank ?? null;
        }
        result = {
            finished: true,
            score,
            rank: Number(roundRank)
        };
    } else {
        // 未finished: answersからスコア計算、ランクはnull

        const ansRows = await tidbCl.query(`
            SELECT is_correct
            FROM users_rounds_answers
            WHERE round_id = ?
            ORDER BY answer_id ASC
            `, [roundDbId]
        );
        // is_correct: true/false/null
        const ansAry = ansRows.map(r => r.is_correct);
        const calcScoreVal = calcScore(0, ansAry);
        result = {
            finished: false,
            score: calcScoreVal,
            rank: null
        };
    }

    return new MyJsonResp(result);
}
