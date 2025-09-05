import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { MyValidationError } from '../../../cmn/errors.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

/**
 * POST /progress/ready
 * 部屋の準備完了状態をセット
 */
export default async function (request, env, ctx) {
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
        if (roomId < 1 || roomId > 255) {
            throw new MyValidationError('Room ID must be between 1 and 255');
        }
    }

    const tidbCl = new TidbClient(env);

    // 部屋の準備完了状態を設定（UPSERT）
    await tidbCl.query(`
        INSERT INTO room_ready_status (room_id, is_ready)
        VALUES (?, TRUE)
        ON DUPLICATE KEY UPDATE 
            is_ready = TRUE,
            updated_at = CURRENT_TIMESTAMP
    `, [roomId]);

    return new MyJsonResp({ success: true });
}
