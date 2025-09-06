import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { updateUserScore } from '../../../cmn/db/update_user_score.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    console.log('[DEBUG] Starting user score cache update');

    // すべてのユーザを取得
    const allUsers = await tidbCl.query(`
        SELECT id as user_id
        FROM users
        ORDER BY id
    `);

    console.log(`[DEBUG] Found ${allUsers.length} users in total`);
    console.log(`[DEBUG] First few users:`, allUsers.slice(0, 3));

    // 各ユーザのラウンド番号（round_id）を取得
    const usersWithRounds = await tidbCl.query(`
        SELECT user_id, round_id
        FROM users_rounds
        ORDER BY user_id, round_id
    `);

    console.log(`[DEBUG] Found ${usersWithRounds.length} user-round combinations`);
    console.log(`[DEBUG] First few user-rounds:`, usersWithRounds.slice(0, 3));

    // ユーザごとにラウンド番号をグループ化
    const userRounds = {};
    // まず全ユーザを空の配列で初期化
    for (const user of allUsers) {
        userRounds[user.user_id] = [];
    }
    // ラウンドデータがあるユーザの配列を埋める
    for (const row of usersWithRounds) {
        if (userRounds[row.user_id]) {
            userRounds[row.user_id].push(row.round_id);
        }
    }

    console.log(`[DEBUG] Grouped user rounds for ${Object.keys(userRounds).length} users`);
    console.log(`[DEBUG] First few grouped entries:`, Object.entries(userRounds).slice(0, 3));

    let processedUsers = 0;
    let successfulUsers = 0;
    let failedUsers = 0;
    const errors = [];

    // 各ユーザのスコアキャッシュを更新
    for (const [userDbId, roundIds] of Object.entries(userRounds)) {
        console.log(`[DEBUG] Processing user ${userDbId} with rounds:`, roundIds);
        try {
            // ラウンドIDが存在する場合のみ更新処理を実行
            if (roundIds.length > 0) {
                console.log(`[DEBUG] Calling updateUserScore for user ${userDbId}`);
                await updateUserScore(tidbCl, parseInt(userDbId), roundIds);
                console.log(`[DEBUG] Successfully updated user ${userDbId}`);
                successfulUsers++;
            } else {
                console.log(`[DEBUG] User ${userDbId} has no rounds, skipping`);
                // ラウンドが存在しないユーザも成功とみなす
                successfulUsers++;
            }
            processedUsers++;
        } catch (error) {
            console.error(`[ERROR] Failed to update user score for user ${userDbId}:`, error);
            console.error(`[ERROR] Error details:`, {
                message: error.message,
                detail: error.detail,
                stack: error.stack
            });
            processedUsers++;
            failedUsers++;
            errors.push({
                userId: userDbId,
                error: error.message || error.toString()
            });
            // エラーが発生してもcontinueして他のユーザを処理
        }
    }

    console.log(`[DEBUG] Final results: processed=${processedUsers}, successful=${successfulUsers}, failed=${failedUsers}`);
    console.log(`[DEBUG] Errors:`, errors);

    return new MyJsonResp({
        message: 'User score cache update completed',
        processedUsers,
        successfulUsers,
        failedUsers,
        totalUsers: Object.keys(userRounds).length,
        errors: errors.slice(0, 10) // 最初の10個のエラーのみ返す
    });
}
