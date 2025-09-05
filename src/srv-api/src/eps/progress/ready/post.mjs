import { MyBadRequestError } from '../../../cmn/errors.mjs';
import { getTidbClient } from '../../../cmn/db/tidb_client.mjs';

/**
 * POST /progress/ready
 * 部屋の準備完了状態をセット
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
        // 部屋の準備完了状態を設定（UPSERT）
        await tidb.execute(`
            INSERT INTO room_ready_status (room_id, is_ready)
            VALUES (?, TRUE)
            ON DUPLICATE KEY UPDATE 
                is_ready = TRUE,
                updated_at = CURRENT_TIMESTAMP
        `, [room_id]);

        return { success: true };
    } finally {
        await tidb.close();
    }
}
