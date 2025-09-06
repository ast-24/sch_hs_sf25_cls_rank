import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { updateUserScore } from '../../../cmn/db/update_user_score.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    // すべてのユーザを取得
    const allUsers = await tidbCl.query(`
        SELECT id as user_id
        FROM users
        ORDER BY id
    `);

    // 各ユーザのラウンド番号（round_id）を取得
    const usersWithRounds = await tidbCl.query(`
        SELECT user_id, round_id
        FROM users_rounds
        ORDER BY user_id, round_id
    `);

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

    let processedUsers = 0;
    let successfulUsers = 0;
    let failedUsers = 0;
    const errors = [];

    // 各ユーザのスコアキャッシュを更新
    for (const [userDbId, roundIds] of Object.entries(userRounds)) {
        try {
            // ラウンドIDが存在する場合のみ更新処理を実行
            if (roundIds.length > 0) {
                await updateUserScore(tidbCl, parseInt(userDbId), roundIds);
                successfulUsers++;
            } else {
                // ラウンドが存在しないユーザも成功とみなす
                successfulUsers++;
            }
            processedUsers++;
        } catch (error) {
            console.error(`Failed to update user score for user ${userDbId}:`, error);
            processedUsers++;
            failedUsers++;
            errors.push({
                userId: userDbId,
                error: error.message || error.toString()
            });
            // エラーが発生してもcontinueして他のユーザを処理
        }
    }

    return new MyJsonResp({
        message: 'User score cache update completed',
        processedUsers,
        successfulUsers,
        failedUsers,
        totalUsers: Object.keys(userRounds).length,
        errors: errors.slice(0, 10) // 最初の10個のエラーのみ返す
    });
}
