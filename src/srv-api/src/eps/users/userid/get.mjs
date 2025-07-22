import { createTidbClient } from "../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq } from "../../../utils/parse_req.mjs";

export async function handler_users_user_id_get(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
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
            registered_at: rows[0].created_at
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}