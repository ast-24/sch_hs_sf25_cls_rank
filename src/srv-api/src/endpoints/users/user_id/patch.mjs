import { TidbClient } from "../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_patch(request, env) {
    let userId, newDisplayName;
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

        const body = await request.json();
        newDisplayName = body.display_name;
        if (newDisplayName && (typeof newDisplayName !== 'string' || newDisplayName.length > 20)) {
            return new Response('Invalid display name', { status: 400 });
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
        // まずユーザ存在チェック
        const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }

        // 存在すればUPDATE
        await tidbCl.query(
            `UPDATE users SET display_name = ? WHERE user_id = ?`,
            [newDisplayName || `User ${String(userId).padStart(4, '0')}`, userId]
        );

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}