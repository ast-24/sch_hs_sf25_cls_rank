import { TidbClient } from "../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError, MyValidationError } from "../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../cmn/resp.mjs";
import { updateUserScore } from "../../../../../cmn/db/update_user_score.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);
    const roundId = getRoundIdFromReq(request);

    let finished;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        finished = body.finished;
        if (typeof finished !== 'boolean') {
            throw new MyValidationError('Invalid finished status');
        }
    }


    const tidbCl = new TidbClient(env);

    await tidbCl.execInTx(async (tidbCl) => {
        const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            throw new MyNotFoundError('user');
        }
        const userDbId = userRows[0].id;

        await tidbCl.query(`
            UPDATE users_rounds ur
            JOIN users u ON ur.user_id = u.id
            SET ur.finished_at = ${finished ? 'NOW()' : 'NULL'}
            WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]
        );

        await updateUserScore(tidbCl, userDbId);
    });

    return new MyJsonResp();
}