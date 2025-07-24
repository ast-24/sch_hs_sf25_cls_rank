/**
 * 統一されたロギングユーティリティ
 */

import { LOG_LEVEL, DEFAULT_LOG_LEVEL } from '../conf.mjs';

/**
 * 現在のログレベルを取得（環境変数から）
 * @param {Object} env - 環境変数
 * @returns {number}
 */
function getCurrentLogLevel(env) {
    const envLogLevel = env?.LOG_LEVEL;
    if (envLogLevel && LOG_LEVEL[envLogLevel] !== undefined) {
        return LOG_LEVEL[envLogLevel];
    }
    return DEFAULT_LOG_LEVEL;
}

/**
 * ログメッセージをフォーマット
 * @param {string} level - ログレベル
 * @param {string} message - メッセージ
 * @param {any} data - 追加データ（オプション）
 * @returns {string}
 */
function formatLogMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;

    if (data !== null && data !== undefined) {
        return `${baseMessage} | Data: ${JSON.stringify(data)}`;
    }

    return baseMessage;
}

/**
 * デバッグログ
 * @param {string} message
 * @param {any} data
 * @param {Object} env
 */
export function logDebug(message, data = null, env = null) {
    if (getCurrentLogLevel(env) <= LOG_LEVEL.DEBUG) {
        console.log(formatLogMessage('DEBUG', message, data));
    }
}

/**
 * 情報ログ
 * @param {string} message
 * @param {any} data
 * @param {Object} env
 */
export function logInfo(message, data = null, env = null) {
    if (getCurrentLogLevel(env) <= LOG_LEVEL.INFO) {
        console.log(formatLogMessage('INFO', message, data));
    }
}

/**
 * 警告ログ
 * @param {string} message
 * @param {any} data
 * @param {Object} env
 */
export function logWarn(message, data = null, env = null) {
    if (getCurrentLogLevel(env) <= LOG_LEVEL.WARN) {
        console.warn(formatLogMessage('WARN', message, data));
    }
}

/**
 * エラーログ
 * @param {string} message
 * @param {Error|any} error
 * @param {Object} env
 */
export function logError(message, error = null, env = null) {
    if (getCurrentLogLevel(env) <= LOG_LEVEL.ERROR) {
        const errorData = error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error;
        console.error(formatLogMessage('ERROR', message, errorData));
    }
}

/**
 * SQLクエリログ
 * @param {string} sql
 * @param {Array} params
 * @param {number} executionTime
 * @param {number} resultCount
 * @param {Object} env
 */
export function logSqlQuery(sql, params, executionTime, resultCount, env = null) {
    if (getCurrentLogLevel(env) <= LOG_LEVEL.DEBUG) {
        const cleanSql = sql.replace(/\s+/g, ' ').trim();
        logDebug('SQL Query executed', {
            sql: cleanSql,
            params,
            executionTime: `${executionTime}ms`,
            resultCount
        }, env);
    }
}

/**
 * HTTP リクエストログ
 * @param {string} method
 * @param {string} url
 * @param {Object} env
 */
export function logHttpRequest(method, url, env = null) {
    logInfo(`HTTP Request: ${method} ${url}`, null, env);
}

/**
 * HTTP レスポンスログ
 * @param {number} status
 * @param {number} processingTime
 * @param {Object} env
 */
export function logHttpResponse(status, processingTime = null, env = null) {
    const data = processingTime ? { processingTime: `${processingTime}ms` } : null;
    logInfo(`HTTP Response: ${status}`, data, env);
}
