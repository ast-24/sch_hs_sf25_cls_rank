import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError } from "../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";

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

    const ansRows = await tidbCl.query(`
            SELECT ur.round_id, ura.answer_id, ura.is_correct, ura.timestamp
            FROM users_rounds ur
            LEFT JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = ?
            ORDER BY ur.id, ura.answer_id
            `, [userDbId]
    );

    const results = {};
    for (const row of ansRows) {
        if (!results[row.round_id]) results[row.round_id] = {};
        if (row.answer_id !== null) {
            results[row.round_id][row.answer_id] = {
                is_correct: row.is_correct,
                timestamp: row.timestamp
            };
        }
    }

    return new MyJsonResp(results);
}