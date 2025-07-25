import { MyNotFoundError } from "../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../cmn/resp.mjs";
import { TidbClient } from "../../../cmn/db/tidb_client.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const rows = await tidbCl.query(`
            SELECT display_name, created_at
            FROM users
            WHERE user_id = ?
            `, [userId]
    );
    if (rows.length === 0) {
        throw new MyNotFoundError('user');
    }

    return new MyJsonResp({
        display_name: rows[0].display_name,
        registered_at: rows[0].created_at
    });
}