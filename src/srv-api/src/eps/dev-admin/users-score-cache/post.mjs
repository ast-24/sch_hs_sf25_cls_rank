import { TidbClient } from '../../../cmn/db/tidb_client.mjs';
import { updateUserScore } from '../../../cmn/db/update_user_score.mjs';
import { MyJsonResp } from '../../../cmn/resp.mjs';

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    console.log('[DEBUG] Starting user score cache update');

    // URLパラメータから修復モードかどうかを判定
    const url = new URL(request.url);
    const cleanupOrphaned = url.searchParams.get('cleanup_orphaned') === 'true';

    if (cleanupOrphaned) {
        console.log('[DEBUG] Cleanup mode enabled - will remove orphaned records');

        // 孤立したレコードを削除
        const deleteResult = await tidbCl.query(`
            DELETE ur FROM users_rounds ur
            LEFT JOIN users u ON ur.user_id = u.id
            WHERE u.id IS NULL
        `);

        console.log(`[INFO] Cleaned up ${deleteResult.affectedRows || 0} orphaned records from users_rounds`);

        // users_rounds_answers の孤立レコードも削除
        const deleteAnswersResult = await tidbCl.query(`
            DELETE ura FROM users_rounds_answers ura
            LEFT JOIN users_rounds ur ON ura.round_id = ur.id
            WHERE ur.id IS NULL
        `);

        console.log(`[INFO] Cleaned up ${deleteAnswersResult.affectedRows || 0} orphaned records from users_rounds_answers`);
    }

    // すべてのユーザを取得
    const allUsers = await tidbCl.query(`
        SELECT id
        FROM users
        ORDER BY id
    `);

    console.log(`[DEBUG] Found ${allUsers.length} users in total`);
    console.log(`[DEBUG] First few users:`, allUsers.slice(0, 3));

    // 各ユーザのラウンド番号（round_id）を取得
    // 存在するユーザーのみを対象とするためにJOINを使用
    const usersWithRounds = await tidbCl.query(`
        SELECT ur.user_id, ur.round_id
        FROM users_rounds ur
        INNER JOIN users u ON ur.user_id = u.id
        ORDER BY ur.user_id, ur.round_id
    `);

    console.log(`[DEBUG] Found ${usersWithRounds.length} user-round combinations`);
    console.log(`[DEBUG] First few user-rounds:`, usersWithRounds.slice(0, 3));

    // データ整合性チェック: users_rounds.user_id が users.id に存在するかチェック
    const validationQuery = await tidbCl.query(`
        SELECT ur.user_id, COUNT(*) as round_count
        FROM users_rounds ur
        LEFT JOIN users u ON ur.user_id = u.id
        WHERE u.id IS NULL
        GROUP BY ur.user_id
        ORDER BY ur.user_id
        LIMIT 10
    `);

    if (validationQuery.length > 0) {
        console.log(`[WARNING] Found ${validationQuery.length} orphaned user_ids in users_rounds:`, validationQuery);

        // 孤立したレコードの総数も取得
        const orphanedCountRes = await tidbCl.query(`
            SELECT COUNT(*) as orphaned_count
            FROM users_rounds ur
            LEFT JOIN users u ON ur.user_id = u.id
            WHERE u.id IS NULL
        `);

        console.log(`[WARNING] Total orphaned records in users_rounds: ${orphanedCountRes[0].orphaned_count}`);
    }

    // ユーザごとにラウンド番号をグループ化
    const userRounds = {};
    // まず全ユーザを空の配列で初期化
    for (const user of allUsers) {
        userRounds[user.id] = [];
    }
    // ラウンドデータがあるユーザの配列を埋める
    for (const row of usersWithRounds) {
        // users テーブルに存在するユーザーのみ処理する
        if (userRounds[row.user_id] !== undefined) {
            userRounds[row.user_id].push(row.round_id);
        } else {
            console.log(`[WARNING] Skipping orphaned user_id ${row.user_id} from users_rounds`);
        }
    }

    console.log(`[DEBUG] Grouped user rounds for ${Object.keys(userRounds).length} users`);
    console.log(`[DEBUG] First few grouped entries:`, Object.entries(userRounds).slice(0, 3));

    let processedUsers = 0;
    let successfulUsers = 0;
    let failedUsers = 0;
    let skippedUsers = 0;
    const errors = [];

    // 各ユーザのスコアキャッシュを更新
    for (const [userDbIdStr, roundIds] of Object.entries(userRounds)) {
        // 大きな数値の場合、parseIntで精度が失われる可能性があるため文字列を使用
        const userDbId = userDbIdStr;
        console.log(`[DEBUG] Processing user ${userDbId} with rounds:`, roundIds);
        try {
            // ラウンドIDが存在する場合のみ更新処理を実行
            if (roundIds.length > 0) {
                // 事前にユーザーの存在確認を行う
                const userExistsCheck = await tidbCl.query(`
                    SELECT id FROM users WHERE id = ?
                `, [userDbId]);

                if (userExistsCheck.length === 0) {
                    console.log(`[WARNING] User ${userDbId} not found in users table, skipping`);
                    skippedUsers++;
                    processedUsers++;
                    continue;
                }

                console.log(`[DEBUG] Calling updateUserScore for user ${userDbId}`);
                await updateUserScore(tidbCl, userDbId, roundIds);
                console.log(`[DEBUG] Successfully updated user ${userDbId}`);
                successfulUsers++;
            } else {
                console.log(`[DEBUG] User ${userDbId} has no rounds, skipping`);
                // ラウンドが存在しないユーザも成功とみなす
                skippedUsers++;
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
                userId: userDbIdStr,
                error: error.message || error.toString()
            });
            // エラーが発生してもcontinueして他のユーザを処理
        }
    }

    console.log(`[DEBUG] Final results: processed=${processedUsers}, successful=${successfulUsers}, failed=${failedUsers}, skipped=${skippedUsers}`);
    console.log(`[DEBUG] Errors:`, errors);

    return new MyJsonResp({
        message: 'User score cache update completed',
        processedUsers,
        successfulUsers,
        failedUsers,
        skippedUsers,
        totalUsers: Object.keys(userRounds).length,
        errors: errors.slice(0, 10) // 最初の10個のエラーのみ返す
    });
}
