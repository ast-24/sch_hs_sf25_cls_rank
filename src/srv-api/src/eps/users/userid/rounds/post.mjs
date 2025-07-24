import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { MyValidationError } from "../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../../cmn/resp.mjs";

export default async function (request, env) {
    let roomId;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        roomId = body.room_id;
        if (!roomId) {
            throw new MyValidationError('Room ID is required');
        }
        if (typeof roomId !== 'number' || roomId < 0 || !Number.isInteger(roomId)) {
            throw new MyValidationError('Invalid Room ID');
        }
        if (roomId < ROOM_ID_MIN || ROOM_ID_MAX < roomId) {
            throw new MyValidationError(`Room ID must be between ${ROOM_ID_MIN} and ${ROOM_ID_MAX}`);
        }
    }

    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    let nextRoundId;

    await tidbCl.execInTx(async (tidbCl) => {
        const userRows = await tidbCl.query(`
            SELECT id
            FROM users
            WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            throw new MyNotFoundError('user');
        }
        const userDbId = userRows[0].id;

        // 未終了ラウンドがあればfinished_atを現在時刻で更新
        await tidbCl.query(`
            UPDATE users_rounds
            SET finished_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND finished_at IS NULL
            `, [userDbId]
        );

        const maxRoundRows = await tidbCl.query(`
            SELECT MAX(round_id) AS max_round_id
            FROM users_rounds
            WHERE user_id = ?`,
            [userDbId]
        );
        nextRoundId = (maxRoundRows[0]?.max_round_id ?? 0) + 1;

        // ラウンド開始
        await tidbCl.query(`
            INSERT INTO users_rounds (user_id, round_id, room_id)
            VALUES (?, ?, ?)`,
            [userDbId, nextRoundId, roomId]
        );
    });

    return new MyJsonResp({
        round_id: nextRoundId
    });
}
