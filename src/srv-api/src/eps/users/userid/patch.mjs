import { getUserIdFromReq } from "../../../utils/parse_req.mjs";
import { createTidbClient } from "../../../cmn/tidb_cl.mjs";
import { USER_DISPLAY_NAME_MAX_LENGTH } from "../../../conf.mjs";

export async function handler_users_user_id_patch(request, env) {
    let newDisplayName;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return new Response('Invalid JSON body', { status: 400 });
        }
        newDisplayName = body.display_name;
        if (newDisplayName && typeof newDisplayName !== 'string') {
            return new Response(`Display Name must be a string`, { status: 400 });
        }
        newDisplayName = newDisplayName?.trim?.();
        if (newDisplayName && USER_DISPLAY_NAME_MAX_LENGTH < newDisplayName.length) {
            return new Response(`Display Name must be at most ${USER_DISPLAY_NAME_MAX_LENGTH} characters`, { status: 400 });
        }
    }

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

        newDisplayName = newDisplayName || `User ${String(userId).padStart(4, '0')}`;

        await tidbCl.query(`
            UPDATE users SET display_name = ? WHERE user_id = ?
            `, [newDisplayName, userId]
        );

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}