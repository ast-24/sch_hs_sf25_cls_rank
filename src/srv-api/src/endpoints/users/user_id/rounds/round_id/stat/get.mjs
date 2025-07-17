import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_rounds_round_id_stat_get(request, env, ctx) {
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

        const statRows = await tidbCl.query(`
            SELECT ur.score,
                (
                    SELECT COUNT(*) FROM users_rounds WHERE score > ur.score
                ) + 1 AS user_rank
            FROM users_rounds ur
            WHERE ur.user_id = (
                SELECT id FROM users WHERE user_id = ?
            ) AND ur.round_id = ?
            LIMIT 1
            `, [userId, roundId]
        );

        return new Response(JSON.stringify({
            score: statRows[0]?.score ?? null,
            rank: statRows[0]?.user_rank != null ? Number(statRows[0].user_rank) : null
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
