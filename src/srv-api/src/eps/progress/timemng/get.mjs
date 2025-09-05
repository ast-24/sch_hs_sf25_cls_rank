import { getTidbClient } from '../../../cmn/db/tidb_client.mjs';

/**
 * GET /progress/timemng
 * 次のタイマー開始時刻を取得
 */
export default async function (request, env, ctx) {
    const tidb = await getTidbClient(env);

    try {
        // 最新のタイマー設定を取得
        const results = await tidb.execute(`
            SELECT start_time, duration_seconds
            FROM timer_management
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (results.rows.length === 0) {
            return {
                start_time: null,
                duration_seconds: null
            };
        }

        const timer = results.rows[0];
        const startTime = new Date(timer.start_time);

        return {
            start_time: startTime.toISOString(),
            duration_seconds: timer.duration_seconds
        };
    } finally {
        await tidb.close();
    }
}
