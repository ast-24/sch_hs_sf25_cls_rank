/**
 * 統一されたAPIレスポンス生成ユーティリティ
 */

/**
 * 成功レスポンスを生成
 * @param {*} data - レスポンスデータ
 * @param {number} status - HTTPステータスコード（デフォルト: 200）
 * @returns {Response}
 */
export function createSuccessResponse(data = null, status = 200) {
    const headers = { 'Content-Type': 'application/json' };

    if (data === null) {
        return new Response(null, { status, headers });
    }

    return new Response(JSON.stringify(data), { status, headers });
}

/**
 * エラーレスポンスを生成
 * @param {string} message - エラーメッセージ
 * @param {number} status - HTTPステータスコード
 * @param {string|null} code - エラーコード（オプション）
 * @returns {Response}
 */
export function createErrorResponse(message, status, code = null) {
    const errorData = { error: message };
    if (code) {
        errorData.code = code;
    }

    return new Response(JSON.stringify(errorData), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * バリデーションエラーレスポンスを生成
 * @param {string} message - エラーメッセージ
 * @returns {Response}
 */
export function createValidationErrorResponse(message) {
    return createErrorResponse(message, 400, 'VALIDATION_ERROR');
}

/**
 * データベースエラーレスポンスを生成
 * @param {Error} error - エラーオブジェクト
 * @returns {Response}
 */
export function createDatabaseErrorResponse(error) {
    console.error('[ERROR] Database error:', error);
    return createErrorResponse('Database Error', 500, 'DATABASE_ERROR');
}

/**
 * 内部サーバーエラーレスポンスを生成
 * @param {Error} error - エラーオブジェクト
 * @returns {Response}
 */
export function createInternalErrorResponse(error) {
    console.error('[ERROR] Internal server error:', error);
    return createErrorResponse('Internal Server Error', 500, 'INTERNAL_ERROR');
}

/**
 * 存在しないリソースエラーレスポンスを生成
 * @param {string} resource - リソース名
 * @returns {Response}
 */
export function createNotFoundResponse(resource = 'Resource') {
    return createErrorResponse(`${resource} not found`, 404, 'NOT_FOUND');
}

/**
 * 競合エラーレスポンスを生成
 * @param {string} message - エラーメッセージ
 * @returns {Response}
 */
export function createConflictResponse(message) {
    return createErrorResponse(message, 409, 'CONFLICT');
}
