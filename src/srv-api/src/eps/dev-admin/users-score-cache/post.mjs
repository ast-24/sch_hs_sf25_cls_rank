import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { updateUserScore } from '../../../cmn/db/update_user_score.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    // すべてのユーザとそのラウンドIDを取得
    const usersWithRounds = await tidbCl.query(`
        SELECT u.id as user_id, ur.round_id
        FROM users u
        LEFT JOIN users_rounds ur ON u.id = ur.user_id
        WHERE u.id IS NOT NULL
        ORDER BY u.id
    `);

    // ユーザごとにラウンドIDをグループ化
    const userRounds = {};
    for (const row of usersWithRounds) {
        if (!userRounds[row.user_id]) {
            userRounds[row.user_id] = [];
        }
        if (row.round_id !== null) {
            userRounds[row.user_id].push(row.round_id);
        }
    }

    let processedUsers = 0;
    let updatedUsers = 0;

    // 各ユーザのスコアキャッシュを更新
    for (const [userDbId, roundIds] of Object.entries(userRounds)) {
        try {
            await updateUserScore(tidbCl, parseInt(userDbId), roundIds);
            processedUsers++;
            updatedUsers++; // updateUserScoreは変更があった場合のみ更新するが、ここでは処理したユーザ数としてカウント
        } catch (error) {
            console.error(`Failed to update user score for user ${userDbId}:`, error);
            processedUsers++;
            // エラーが発生してもcontinueして他のユーザを処理
        }
    }

    return new MyJsonResp({
        message: 'User score cache update completed',
        processedUsers,
        updatedUsers,
        totalUsers: Object.keys(userRounds).length
    });
}
