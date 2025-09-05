import { TidbClient } from "../../../cmn/db/tidb_client.mjs";
import { MyJsonResp } from '../../../cmn/resp.mjs';

/**
 * GET /progress/timemng
 * 次のタイマー開始時刻を取得
 */
export default async function (request, env, ctx) {
    const tidbCl = new TidbClient(env);

    // 最新のタイマー設定を取得
    const results = await tidbCl.query(`
        SELECT start_time, duration_seconds
        FROM timer_management
        ORDER BY created_at DESC
        LIMIT 1
    `);

    if (results.length === 0) {
        return new MyJsonResp({
            start_time: null,
            duration_seconds: null
        });
    }

    const timer = results[0];
    const startTime = new Date(timer.start_time);

    return new MyJsonResp({
        start_time: startTime.toISOString(),
        duration_seconds: timer.duration_seconds
    });
}
