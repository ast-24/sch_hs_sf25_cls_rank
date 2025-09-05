import { TidbClient } from "../../cmn/db/tidb_client.mjs";
import { MyJsonResp, MyResp } from "../../cmn/resp.mjs";

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    const rows = await tidbCl.query(`
        SELECT ranking_type, ranking_updated_at
        FROM rankings_cache_updated
    `);

    // タイマー情報を取得
    let timerInfo = null;
    try {
        const timerRows = await tidbCl.query(`
            SELECT start_time, duration_seconds
            FROM timer_management
            ORDER BY created_at DESC
            LIMIT 1
        `);
        if (timerRows.length > 0) {
            timerInfo = timerRows[0];
        }
    } catch (e) {
        // タイマー情報の取得に失敗してもヘッダー表示は継続
    }

    const headers = new Headers();
    for (const row of rows) {
        let updatedAt = row.ranking_updated_at;
        
        // round_latestの場合、タイマー終了30秒前より前に更新されている場合は現在時刻を使用
        if (row.ranking_type === 'round_latest' && timerInfo && timerInfo.start_time && timerInfo.duration_seconds) {
            const startTime = new Date(timerInfo.start_time);
            const endTime = new Date(startTime.getTime() + (timerInfo.duration_seconds * 1000));
            const filterTime = new Date(endTime.getTime() - (30 * 1000)); // 30秒前
            const lastUpdated = new Date(row.ranking_updated_at);
            
            if (lastUpdated < filterTime) {
                updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
            }
        }
        
        headers.set(
            `X-Ranking-Last-Modified-${row.ranking_type.replaceAll('_', '-').toUpperCase()}`,
            updatedAt
        );
    }

    headers.set(
        'Access-Control-Expose-Headers',
        Array.from(headers.keys()).join(', ')
    );

    return new MyResp('ok', { status: 200, headers });
}
