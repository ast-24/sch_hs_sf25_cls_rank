/**
 * APIレスポンス生成
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * 成功レスポンス生成
 */
export function success(data = null, status = 200) {
    if (data === null) {
        return new Response(null, { status, headers: JSON_HEADERS });
    }
    return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/**
 * エラーレスポンス生成
 */
export function error(message, status, code = null) {
    const body = { error: message };
    if (code) body.code = code;
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * 特化型エラーレスポンス
 */
export const errorTypes = {
    validation: (message) => error(message, 400, 'VALIDATION_ERROR'),
    notFound: (resource = 'Resource') => error(`${resource} not found`, 404, 'NOT_FOUND'),
    conflict: (message) => error(message, 409, 'CONFLICT'),
    database: () => error('Database Error', 500, 'DATABASE_ERROR'),
    internal: () => error('Internal Server Error', 500, 'INTERNAL_ERROR')
};
