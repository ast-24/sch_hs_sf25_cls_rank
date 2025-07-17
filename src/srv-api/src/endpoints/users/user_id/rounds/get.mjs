import { TidbClient } from "../../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_rounds_get(request, env) {
    let userId;
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

        const roundRows = await tidbCl.query(`
            SELECT ur.round_id, ur.room_id, ur.finished_at
            FROM users_rounds ur
            WHERE ur.user_id = (
                SELECT id FROM users WHERE user_id = ?
            )
            ORDER BY ur.created_at ASC`,
            [userId]
        );

        const rounds = {};
        for (const round of roundRows) {
            rounds[round.round_id] = {
                room_id: round.room_id,
                finished_at: round.finished_at
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
