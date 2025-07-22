import { createTidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq, getRoundIdFromReq } from "../../../../../../utils/parse_req.mjs";

export async function handler_users_user_id_rounds_round_id_results_get(request, env) {
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
            SELECT ur.id
            FROM users_rounds ur
            JOIN users u ON ur.user_id = u.id
            WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]
        );
        if (userRows.length === 0) {
            return new Response('User or round not found', { status: 404 });
        }

        const roundDbId = userRows[0].id;
        const ansRows = await tidbCl.query(`
            SELECT ura.answer_id, ura.is_correct, ura.timestamp
            FROM users_rounds_answers ura
            JOIN users_rounds ur ON ura.round_id = ur.id
            WHERE ur.id = ?;
        `, [roundDbId]
        );

        const results = {};
        for (const ans of ansRows) {
            results[ans.answer_id] = {
                is_correct:
                    ans.is_correct === null
                        ? null
                        : !!ans.is_correct, // 0/1 で返ってくるため
                timestamp: ans.timestamp
            };
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
