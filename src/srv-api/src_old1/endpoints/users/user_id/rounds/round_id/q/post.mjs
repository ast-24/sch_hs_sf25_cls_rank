import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_rounds_round_id_q_post(request, env) {
    let userId, roundId, isCorrect;
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

        const body = await request.json();
        isCorrect = body.is_correct;
        if (isCorrect !== null && isCorrect !== undefined && typeof isCorrect !== 'boolean') {
            return new Response('is_correct must be a boolean or null', { status: 400 });
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
            SELECT ur.id, ur.finished_at
            FROM users u
            JOIN users_rounds ur ON u.id = ur.user_id
            WHERE u.user_id = ? AND ur.round_id = ?`,
            [userId, roundId]
        );
        if (!roundRows || roundRows.length === 0) {
            return new Response('User or Round not found', { status: 404 });
        }
        if (roundRows[0].finished_at !== null) {
            return new Response('Round already finished', { status: 409 });
        }

        const roundDbId = roundRows[0].id;
        await tidbCl.query(`
            INSERT INTO users_rounds_answers (round_id, q_id, is_correct, timestamp)
            SELECT ?, COALESCE(MAX(q_id), 0) + 1, ?, NOW()
            FROM users_rounds_answers WHERE round_id = ?`,
            [roundDbId, isCorrect, roundDbId]
        );

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}