import { MyNotFoundError, MyValidationError } from "../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../cmn/req/get_user_id.mjs";
import { TidbClient } from "../../../cmn/db/tidb_client.mjs";
import { MyJsonResp } from "../../../cmn/resp.mjs";
import { CONF } from "../../../conf.mjs";

export default async function (request, env) {
    let newDisplayName;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        newDisplayName = body.display_name;
        if (newDisplayName && typeof newDisplayName !== 'string') {
            throw new MyValidationError(`Display Name must be a string`);
        }
        newDisplayName = newDisplayName?.trim?.();
        if (newDisplayName && CONF.VALIDATION_RULES.USER_DISPLAY_NAME.MAX_LENGTH < newDisplayName.length) {
            throw new MyValidationError(`Display Name must be at most ${CONF.VALIDATION_RULES.USER_DISPLAY_NAME.MAX_LENGTH} characters`);
        }
    }

    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
    );
    if (userRows.length === 0) {
        throw new MyNotFoundError('user');
    }

    newDisplayName = newDisplayName || `User ${String(userId).padStart(4, '0')}`;

    await tidbCl.query(`
            UPDATE users SET display_name = ? WHERE user_id = ?
            `, [newDisplayName, userId]
    );

    return new MyJsonResp();
}