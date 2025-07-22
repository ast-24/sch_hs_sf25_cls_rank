import { createTidbClient } from "../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq } from "../../../../utils/parse_req.mjs";

export async function handler_users_user_id_results_get(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
        const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }
        const userDbId = userRows[0].id;

        const ansRows = await tidbCl.query(`
            SELECT ur.round_id, ura.answer_id, ura.is_correct, ura.timestamp
            FROM users_rounds ur
            LEFT JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = ?
            ORDER BY ur.id, ura.answer_id
            `, [userDbId]
        );

        const results = {};
        for (const row of ansRows) {
            if (!results[row.round_id]) results[row.round_id] = {};
            if (row.answer_id !== null) {
                results[row.round_id][row.answer_id] = {
                    is_correct: row.is_correct,
                    timestamp: row.timestamp
                };
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}