import {
    parseJsonBody,
    validateRoomId,
    validateDisplayName,
    success,
    withErrorHandling,
    withTransaction,
    createDatabaseClient,
    dbQueries,
    logger
} from "../../lib/index.mjs";

export async function handler_users_post(request, env) {
    return await withErrorHandling(async () => {
        // リクエスト解析とバリデーション
        const body = await parseJsonBody(request);
        const roomId = validateRoomId(body.room_id);
        const displayName = validateDisplayName(body.display_name);

        // データベース操作
        const client = createDatabaseClient(env);
        
        // ユーザー登録処理（衝突防止で最大3回試行）
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const userId = await dbQueries.generateUserId(client, roomId);
                const finalDisplayName = displayName || `User ${String(userId).padStart(4, '0')}`;

                await client.query(
                    'INSERT INTO users (user_id, room_id, display_name) VALUES (?, ?, ?)',
                    [userId, roomId, finalDisplayName]
                );

                logger.info('User registered successfully', { userId, roomId }, env);

                return success({
                    user_id: userId,
                    user_name: finalDisplayName
                });
                
            } catch (error) {
                logger.warn(`User registration attempt ${attempt} failed`, { error: error.message }, env);
                
                if (attempt === 3) {
                    throw new Error('Failed to register user after multiple attempts');
                }
                
                // 短時間待機してからリトライ
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        throw new Error('Unexpected error in user registration');
    });
}