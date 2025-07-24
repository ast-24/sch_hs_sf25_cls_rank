import { createTidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq, getRoundIdFromReq } from "../../../../../../utils/parse_req.mjs";

export async function handler_users_user_id_rounds_round_id_answers_post(request, env) {
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

    let isCorrect;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return new Response('Invalid JSON body', { status: 400 });
        }
        isCorrect = body.is_correct;
        if (isCorrect !== null && isCorrect !== undefined && typeof isCorrect !== 'boolean') {
            return new Response('is_correct must be a boolean or null', { status: 400 });
        }
    }

    try {
        const roundRows = await tidbCl.query(`
            SELECT ur.id, ur.finished_at
            FROM users u
            JOIN users_rounds ur ON u.id = ur.user_id
            WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]
        );
        if (!roundRows || roundRows.length === 0) {
            return new Response('User or Round not found', { status: 404 });
        }
        if (roundRows[0].finished_at !== null) {
            return new Response('Round already finished', { status: 409 });
        }

        const roundDbId = roundRows[0].id;
        await tidbCl.query(`
            INSERT INTO users_rounds_answers (round_id, answer_id, is_correct, timestamp)
            SELECT ?, COALESCE(MAX(answer_id), 0) + 1, ?, NOW()
            FROM users_rounds_answers WHERE round_id = ?`,
            [roundDbId, isCorrect, roundDbId]
        );

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}