import { TidbClient } from "../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_get(request, env) {
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
        const rows = await tidbCl.query(`
            SELECT * FROM users WHERE user_id = ?
            `, [userId]
        );
        if (rows.length === 0) {
            return new Response('User not found', { status: 404 });
        }

        return new Response(JSON.stringify({
            display_name: rows[0].display_name,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}