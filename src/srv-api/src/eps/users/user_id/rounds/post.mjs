import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { MyValidationError, MyNotFoundError, MyFatalError } from "../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../../cmn/resp.mjs";
import { CONF } from "../../../../conf.mjs";
import { updateUserScore } from "../../../../cmn/db/update_user_score.mjs";

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
        if (typeof roomId !== 'number' || roomId <= 0 || !Number.isInteger(roomId)) {
            throw new MyValidationError('Invalid Room ID');
        }
        if (roomId < CONF.VALIDATION_RULES.ROOM_ID.MIN || CONF.VALIDATION_RULES.ROOM_ID.MAX < roomId) {
            throw new MyValidationError(`Room ID must be between ${CONF.VALIDATION_RULES.ROOM_ID.MIN} and ${CONF.VALIDATION_RULES.ROOM_ID.MAX}`);
        }
    }

    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    return await tidbCl.execInTx(async (tidbCl) => {
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
        {
            // スコア計算のため、更新対象のround_idを取得
            const unfinishedRoundRows = await tidbCl.query(`
                SELECT round_id
                FROM users_rounds
                WHERE user_id = ? AND finished_at IS NULL
                `, [userDbId]
            );
            const unfinishedRoundIds = unfinishedRoundRows.map(row => row.round_id);

            // 未終了ラウンドのfinished_atを更新
            await tidbCl.query(`
                UPDATE users_rounds
                SET finished_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND finished_at IS NULL
                `, [userDbId]
            );

            // 強制終了されたラウンドのスコアを計算・適用
            if (unfinishedRoundIds.length) {
                await updateUserScore(tidbCl, userDbId, unfinishedRoundIds);
            }
        }

        for (let i = 0; i < 3; i++) {
            try {
                const maxRoundRows = await tidbCl.query(`
                    SELECT COALESCE(MAX(round_id), 0) + 1 AS next_round_id
                    FROM users_rounds
                    WHERE user_id = ?
                    `, [userDbId]
                );
                const nextRoundId = maxRoundRows[0].next_round_id;

                // ラウンド開始
                await tidbCl.query(`
                    INSERT INTO users_rounds (user_id, round_id, room_id)
                    VALUES (?, ?, ?)
                    `, [userDbId, nextRoundId, roomId]
                );

                return new MyJsonResp({
                    round_id: nextRoundId
                });
            } catch (error) {
                if (i === 2) {
                    throw error;
                }
            }
        }

        throw new MyFatalError('Failed to create round after multiple attempts');
    });
}
