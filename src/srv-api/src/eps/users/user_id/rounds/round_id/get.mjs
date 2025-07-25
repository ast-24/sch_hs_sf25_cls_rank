import { TidbClient } from "../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError } from "../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../cmn/resp.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);
    const roundId = getRoundIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const roundRows = await tidbCl.query(`
        SELECT ur.room_id, ur.finished_at, ur.created_at
        FROM users u
        JOIN users_rounds ur ON u.id = ur.user_id
        WHERE u.user_id = ? AND ur.round_id = ?
        `, [userId, roundId]
    );
    if (roundRows.length === 0) {
        throw new MyNotFoundError('user or round');
    }

    return new MyJsonResp({
        room_id: roundRows[0].room_id,
        started_at: roundRows[0].created_at,
        finished_at: roundRows[0].finished_at
    });
}
