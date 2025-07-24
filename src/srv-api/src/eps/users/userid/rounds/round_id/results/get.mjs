import { TidbClient } from "../../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError } from "../../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../../cmn/resp.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);
    const roundId = getRoundIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const userRows = await tidbCl.query(`
        SELECT ur.id
        FROM users_rounds ur
        JOIN users u ON ur.user_id = u.id
        WHERE u.user_id = ? AND ur.round_id = ?
        `, [userId, roundId]
    );
    if (userRows.length === 0) {
        throw new MyNotFoundError('user or round');
    }

    const roundDbId = userRows[0].id;
    const ansRows = await tidbCl.query(`
        SELECT ura.answer_id, ura.is_correct, ura.timestamp
        FROM users_rounds_answers ura
        JOIN users_rounds ur ON ura.round_id = ur.id
        WHERE ur.id = ?;
    `, [roundDbId]
    );

    const results = {};
    for (const ans of ansRows) {
        results[ans.answer_id] = {
            is_correct:
                ans.is_correct === null
                    ? null
                    : !!ans.is_correct, // 0/1 で返ってくるため
            timestamp: ans.timestamp
        };
    }

    return new MyJsonResp(results);
}
