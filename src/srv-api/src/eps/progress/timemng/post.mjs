import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { MyValidationError } from '../../../cmn/errors.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

/**
 * POST /progress/timemng
 * タイマー開始時刻をセット
 */
export default async function (request, env, ctx) {
    let durationSeconds;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        durationSeconds = body.duration_seconds;
        if (!durationSeconds) {
            throw new MyValidationError('Duration seconds is required');
        }
        if (typeof durationSeconds !== 'number' || durationSeconds <= 0 || !Number.isInteger(durationSeconds)) {
            throw new MyValidationError('Invalid duration seconds');
        }
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

    const tidbCl = new TidbClient(env);

    // 既存のタイマー設定をクリア
    await tidbCl.query('DELETE FROM timer_management');

    // 新しいタイマー設定を挿入
    await tidbCl.query(`
        INSERT INTO timer_management (start_time, duration_seconds)
        VALUES (?, ?)
    `, [startTime.toISOString().slice(0, 19).replace('T', ' '), durationSeconds]);

    // 全部屋の準備状態をクリア
    await tidbCl.query('UPDATE room_ready_status SET is_ready = FALSE');

    return new MyJsonResp({
        start_time: startTime.toISOString(),
        duration_seconds: durationSeconds
    });
}
