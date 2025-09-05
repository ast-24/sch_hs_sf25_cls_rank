import { MyBadRequestError } from '../../../cmn/errors.mjs';
import { getTidbClient } from '../../../cmn/db/tidb_client.mjs';

/**
 * DELETE /progress/ready
 * 部屋の準備完了状態を解除
 */
export default async function(request, env, ctx) {
    const body = await request.json();
    const { room_id } = body;

    // バリデーション
    if (!room_id || typeof room_id !== 'number' || room_id < 1 || room_id > 255) {
        throw new MyBadRequestError('Invalid room_id');
    }

    const tidb = await getTidbClient(env);

    try {
        // 部屋の準備完了状態を解除
        const result = await tidb.execute(`
            UPDATE room_ready_status 
            SET is_ready = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE room_id = ?
        `, [room_id]);

        return { success: true };
    } finally {
        await tidb.close();
    }
}
