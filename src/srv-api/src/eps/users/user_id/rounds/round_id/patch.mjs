import { TidbClient } from "../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError, MyValidationError, MyConflictError } from "../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../cmn/resp.mjs";
import { updateUserScore } from "../../../../../cmn/db/update_user_score.mjs";

export default async function (request, env) {
    const [userId, roundId, body] = await Promise.all([
        Promise.resolve(getUserIdFromReq(request)),
        Promise.resolve(getRoundIdFromReq(request)),
        request.json().catch(() => { throw new MyValidationError('Invalid JSON body'); })
    ]);

    const finished = body.finished;
    if (typeof finished !== 'boolean') {
        throw new MyValidationError('Invalid finished status');
    }

    const tidbCl = new TidbClient(env);

    const rows = await tidbCl.query(`
        SELECT u.id as user_db_id, ur.finished_at, ur.id as users_rounds_id
        FROM users u
        JOIN users_rounds ur ON u.id = ur.user_id
        WHERE u.user_id = ? AND ur.round_id = ?
        `, [userId, roundId]
    );
    if (rows.length === 0) {
        throw new MyNotFoundError('user or round');
    }

    if ((rows[0].finished_at !== null) === finished) {
        throw new MyConflictError('round status');
    }

    const userDbId = rows[0].user_db_id;
    const usersRoundsId = rows[0].users_rounds_id;

    await tidbCl.execInTx(async (tidbCl) => {
        await tidbCl.query(`
            UPDATE users_rounds
            SET finished_at = ${finished ? 'NOW()' : 'NULL'}
            WHERE id = ?
            `, [usersRoundsId]
        );

        await updateUserScore(tidbCl, userDbId, [roundId]);
    });

    return new MyJsonResp();
}