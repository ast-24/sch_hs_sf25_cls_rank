import { createTidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq, getRoundIdFromReq } from "../../../../../../utils/parse_req.mjs";
const { calcScore } = await import('../../../../../../cmn/calc_score.mjs');

export async function handler_users_user_id_rounds_round_id_status_get(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    const roundId = getRoundIdFromReq(request);
    if (roundId instanceof Response) {
        return roundId;
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
        const userRows = await tidbCl.query(`
            SELECT ur.id, ur.finished_at, ur.score
            FROM users_rounds ur
            JOIN users u ON ur.user_id = u.id
            WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]
        );
        if (userRows.length === 0) {
            return new Response('User or round not found', { status: 404 });
        }

        const { id: roundDbId, finished_at, score } = userRows[0];
        let result = {};

        if (finished_at) {
            // finished: スコアはそのまま、ランクを計算
            // ランク: 同じround_id内でscore降順で何位か
            const rankRows = await tidbCl.query(`
                SELECT COUNT(*) + 1 AS rank
                FROM users_rounds
                WHERE round_id = ? AND score > ?
                `, [roundId, score]
            );
            result = {
                finished: true,
                score,
                rank: rankRows[0]?.rank ?? null
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

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
