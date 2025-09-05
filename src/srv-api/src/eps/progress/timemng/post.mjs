import { MyBadRequestError } from '../../../cmn/errors.mjs';
import { getTidbClient } from '../../../cmn/db/tidb_client.mjs';

/**
 * POST /progress/timemng
 * タイマー開始時刻をセット
 */
export default async function (request, env, ctx) {
    const body = await request.json();
    const { duration_seconds } = body;

    // バリデーション
    if (!duration_seconds || typeof duration_seconds !== 'number' || duration_seconds < 1) {
        throw new MyBadRequestError('Invalid duration_seconds');
    }

    // 現在時刻から次の10秒刻みの時刻を計算（+10秒後）
    const now = new Date();
    const currentSeconds = now.getSeconds();
    const nextTenSecondMark = Math.ceil((currentSeconds + 1) / 10) * 10;

    const startTime = new Date(now);
    startTime.setSeconds(nextTenSecondMark + 10, 0); // +10秒後の10秒刻みの時刻

    // 60秒を超える場合は分を繰り上げ
    if (startTime.getSeconds() >= 60) {
        startTime.setMinutes(startTime.getMinutes() + 1);
        startTime.setSeconds(0, 0);
    }

    const tidb = await getTidbClient(env);

    try {
        // 既存のタイマー設定をクリア
        await tidb.execute('DELETE FROM timer_management');

        // 新しいタイマー設定を挿入
        await tidb.execute(`
            INSERT INTO timer_management (start_time, duration_seconds)
            VALUES (?, ?)
        `, [startTime.toISOString().slice(0, 19).replace('T', ' '), duration_seconds]);

        // 全部屋の準備状態をクリア
        await tidb.execute('UPDATE room_ready_status SET is_ready = FALSE');

        return {
            start_time: startTime.toISOString(),
            duration_seconds: duration_seconds
        };
    } finally {
        await tidb.close();
    }
}
