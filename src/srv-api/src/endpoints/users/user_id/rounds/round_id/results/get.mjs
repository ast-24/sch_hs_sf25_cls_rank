import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_rounds_round_id_results_get(request, env) {
    let userId, roundId;
    {
        userId = request.user_id;
        if (!userId) {
            return new Response('User ID is required', { status: 400 });
        }
        userId = parseInt(userId);
        if (isNaN(userId)) {
            return new Response('Invalid User ID', { status: 400 });
        }
        if (typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
            return new Response('Invalid User ID', { status: 400 });
        }

        roundId = request.round_id;
        if (!roundId) {
            return new Response('Round ID is required', { status: 400 });
        }
        roundId = parseInt(roundId);
        if (isNaN(roundId)) {
            return new Response('Invalid Round ID', { status: 400 });
        }
        if (typeof roundId !== 'number' || roundId <= 0 || !Number.isInteger(roundId)) {
            return new Response('Invalid Round ID', { status: 400 });
        }
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }

        const ansRows = await tidbCl.query(`
            SELECT ura.q_id, ura.is_correct, ura.timestamp
            FROM users_rounds_answers ura
            WHERE ura.round_id = (
                SELECT ur.id FROM users_rounds ur
                WHERE ur.user_id = (
                    SELECT id FROM users WHERE user_id = ?
                ) AND ur.round_id = ?
            )
            `, [userId, roundId]
        );

        const results = {};
        for (const ans of ansRows) {
            results[ans.q_id] = {
                is_correct: ans.is_correct === null ? null : !!ans.is_correct,
                timestamp: ans.timestamp
            };
        }

        return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
