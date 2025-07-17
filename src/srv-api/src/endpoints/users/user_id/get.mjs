import { TidbClient } from "../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../cmn/useridconv.mjs";

export async function handler_users_user_id_get(request, env, ctx) {
    let roomId, userId;
    try {
        ({ roomId, userId } = parseRoomUserId(request.user_id));
    } catch (e) {
        console.error("[ERROR]", e.message);
        return new Response(e.message, { status: 400 });
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        const rows = await tidbCl.query(
            `SELECT * FROM users WHERE room_id = ? AND user_id = ?`,
            [roomId, userId]
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