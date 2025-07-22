import { createTidbClient } from "../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq } from "../../../../utils/parse_req.mjs";

export async function handler_users_user_id_rounds_get(request, env) {
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

        const roundRows = await tidbCl.query(`
            SELECT ur.round_id, ur.room_id, ur.finished_at, ur.created_at
            FROM users_rounds ur
            WHERE ur.user_id = ?
            ORDER BY ur.created_at ASC`,
            [userDbId]
        );

        const rounds = {};
        for (const round of roundRows) {
            rounds[round.round_id] = {
                room_id: round.room_id,
                finished_at: round.finished_at,
                started_at: round.created_at
            };
        }

        return new Response(JSON.stringify(rounds), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
