import { TidbClient } from "../../../cmn/db/tidb_client.mjs";
import { MyJsonResp } from '../../../cmn/resp.mjs';

/**
 * GET /progress/ready
 * 現在の準備完了状態を取得
 */
export default async function (request, env, ctx) {
    const tidbCl = new TidbClient(env);

    // 全部屋の準備完了状態を取得
    const results = await tidbCl.query(`
        SELECT room_id, is_ready
        FROM room_ready_status
        ORDER BY room_id
    `);

    // レスポンス形式: { room_1: true, room_2: false, ... }
    const readyStatus = {};
    for (const row of results) {
        readyStatus[`room_${row.room_id}`] = row.is_ready === 1;
    }

    return new MyJsonResp({ ready_status: readyStatus });
}
