import { TidbClient } from "../../../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_rounds_round_id_get(request, env) {
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
        const roundRows = await tidbCl.query(`
            SELECT room_id, finished_at
            FROM users_rounds
            WHERE user_id = (
                SELECT id FROM users WHERE user_id = ?
            ) AND round_id = ?`,
            [userId, roundId]
        );
        if (roundRows.length === 0) {
            return new Response('Round not found', { status: 404 });
        }

        return new Response(JSON.stringify({
            room_id: roundRows[0].room_id,
            finished_at: roundRows[0].finished_at
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
