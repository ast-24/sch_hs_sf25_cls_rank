import { TidbClient } from "../../cmn/db/tidb_client.mjs";
import { MyValidationError, MyFatalError } from "../../cmn/errors.mjs";
import { MyJsonResp } from "../../cmn/resp.mjs";
import { CONF } from "../../conf.mjs";

export default async function (request, env) {
    let roomId, displayName;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        roomId = body.room_id;
        displayName = body.display_name;
        if (!roomId) {
            throw new MyValidationError('Room ID is required');
        }
        if (typeof roomId !== 'number' || roomId <= 0 || !Number.isInteger(roomId)) {
            throw new MyValidationError('Invalid Room ID');
        }
        if (roomId < CONF.VALIDATION_RULES.ROOM_ID.MIN || CONF.VALIDATION_RULES.ROOM_ID.MAX < roomId) {
            throw new MyValidationError(`Room ID must be between ${CONF.VALIDATION_RULES.ROOM_ID.MIN} and ${CONF.VALIDATION_RULES.ROOM_ID.MAX}`);
        }
        if (displayName && typeof displayName !== 'string') {
            throw new MyValidationError(`Display Name must be a string`);
        }
        displayName = displayName?.trim?.();
        if (displayName && CONF.VALIDATION_RULES.USER_DISPLAY_NAME.MAX_LENGTH < displayName.length) {
            throw new MyValidationError(`Display Name must be at most ${CONF.VALIDATION_RULES.USER_DISPLAY_NAME.MAX_LENGTH} characters`);
        }
    }

    const tidbCl = new TidbClient(env);

    // 1ルーム1スタッフだが念の為、衝突防止で3回トライ
    for (let i = 0; i < 3; i++) {
        try {
            const rows = await tidbCl.query(`
                SELECT COALESCE(MAX(user_id), ?) + 1 AS next_user_id
                FROM users
                WHERE room_id = ?
                `, [roomId * 1000, roomId]
            );
            const nextUserId = rows[0].next_user_id;
            displayName = displayName || `Player ${String(nextUserId).padStart(4, '0')}`;

            await tidbCl.query(`
                INSERT INTO users (user_id, room_id, display_name) VALUES (?, ?, ?)
                `, [nextUserId, roomId, displayName]
            );

            return new MyJsonResp({
                user_id: nextUserId,
                display_name: displayName,
            });
        } catch (error) {
            if (i == 2) {
                throw error;
            }
        }
    }

    throw new MyFatalError("Failed to create user after retries");
}