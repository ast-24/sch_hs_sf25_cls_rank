import { TidbClient } from "../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../cmn/useridconv.mjs";

export async function handler_users_user_id_patch(request, env, ctx) {
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

    const body = await request.json();
    if (!body.display_name) {
        return new Response('Display name is required', { status: 400 });
    }

    try {
        // まずユーザ存在チェック
        const userRows = await tidbCl.query(
            `SELECT id FROM users WHERE room_id = ? AND user_id = ?`,
            [roomId, userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }

        // 存在すればUPDATE
        await tidbCl.query(
            `UPDATE users SET display_name = ? WHERE room_id = ? AND user_id = ?`,
            [body.display_name, roomId, userId]
        );
        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}