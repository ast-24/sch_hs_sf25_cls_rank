import { getTidbClient } from '../../../cmn/db/tidb_client.mjs';

/**
 * DELETE /progress/timemng
 * タイマーを中止
 */
export default async function(request, env, ctx) {
    const tidb = await getTidbClient(env);

    try {
        // タイマー設定をクリア
        await tidb.execute('DELETE FROM timer_management');

        return { success: true };
    } finally {
        await tidb.close();
    }
}
