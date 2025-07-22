import { createTidbClient } from "../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq } from "../../../../utils/parse_req.mjs";

export async function handler_users_user_id_status_get(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
        const scoreRows = await tidbCl.query(`
            SELECT score_today_total, score_round_max
            FROM users
            WHERE user_id = ?
            `, [userId]
        );
        if (scoreRows.length === 0) {
            return new Response('User score not found', { status: 404 });
        }
        const { score_today_total, score_round_max } = scoreRows[0];

        const todayRankRows = await tidbCl.query(`
            SELECT COUNT(*) + 1 AS rank
            FROM users
            WHERE score_today_total > ?
            `, [score_today_total]
        );
        const roundMaxRankRows = await tidbCl.query(`
            SELECT COUNT(*) + 1 AS rank
            FROM users
            WHERE score_round_max > ?
            `, [score_round_max]
        );

        const result = {
            today_total: score_today_total,
            today_total_rank: todayRankRows[0]?.rank ?? null,
            round_max: score_round_max,
            round_max_rank: roundMaxRankRows[0]?.rank ?? null
        };

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}