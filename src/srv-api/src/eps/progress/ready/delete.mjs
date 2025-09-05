import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { MyValidationError } from '../../../cmn/errors.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

/**
 * DELETE /progress/ready
 * 部屋の準備完了状態を解除
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

    // 部屋の準備完了状態を解除
    await tidbCl.query(`
        UPDATE room_ready_status 
        SET is_ready = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE room_id = ?
    `, [roomId]);

    return new MyJsonResp({ success: true });
}
