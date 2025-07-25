import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../../cmn/resp.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const userRows = await tidbCl.query(`
        SELECT id FROM users WHERE user_id = ?
        `, [userId]
    );
    if (userRows.length === 0) {
        throw new MyNotFoundError('user');
    }
    const userDbId = userRows[0].id;

    const roundRows = await tidbCl.query(`
        SELECT ur.round_id, ur.room_id, ur.finished_at, ur.created_at
        FROM users_rounds ur
        WHERE ur.user_id = ?
        ORDER BY ur.created_at ASC
        `, [userDbId]
    );

    const rounds = {};
    for (const round of roundRows) {
        rounds[round.round_id] = {
            room_id: round.room_id,
            finished_at: round.finished_at,
            started_at: round.created_at
        };
    }

    return new MyJsonResp(rounds);
}
