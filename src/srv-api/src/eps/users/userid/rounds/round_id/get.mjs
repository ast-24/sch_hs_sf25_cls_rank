import { createTidbClient } from "../../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq, getRoundIdFromReq } from "../../../../../utils/parse_req.mjs";

export async function handler_users_user_id_rounds_round_id_get(request, env) {
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
        const roundRows = await tidbCl.query(`
            SELECT ur.room_id, ur.finished_at, ur.created_at
            FROM users u
            JOIN users_rounds ur ON u.id = ur.user_id
            WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]
        );
        if (roundRows.length === 0) {
            return new Response('User or Round not found', { status: 404 });
        }

        return new Response(JSON.stringify({
            room_id: roundRows[0].room_id,
            started_at: roundRows[0].created_at,
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
