import { TidbClient } from "../../../cmn/db/tidb_client.mjs";
import { MyJsonResp } from '../../../cmn/resp.mjs';

/**
 * DELETE /progress/timemng
 * タイマーを中止
 */
export default async function (request, env, ctx) {
    const tidbCl = new TidbClient(env);

    // タイマー設定をクリア
    await tidbCl.query('DELETE FROM timer_management');

    return new MyJsonResp({ success: true });
}
