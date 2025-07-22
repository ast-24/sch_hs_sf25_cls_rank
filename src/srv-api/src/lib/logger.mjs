/**
 * 統一ロギングシステム
 * 責務: ログ出力のみ（レスポンス生成は行わない）
 */

import { APP_CONFIG } from './config.mjs';

/**
 * 環境変数からログレベルを取得
 */
function getLogLevel(env) {
    const envLevel = env?.LOG_LEVEL;
    return APP_CONFIG.logging.levels[envLevel] ?? APP_CONFIG.logging.defaultLevel;
}

/**
 * ログメッセージをフォーマット
 */
function formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const baseMsg = `[${timestamp}] [${level}] ${message}`;
    return data ? `${baseMsg} | ${JSON.stringify(data)}` : baseMsg;
}

/**
 * レベル付きログ出力関数
 */
function log(level, levelNum, message, data, env) {
    if (getLogLevel(env) <= levelNum) {
        const output = level === 'ERROR' ? console.error : console.log;
        output(formatMessage(level, message, data));
    }
}

// 各レベルのログ関数
export const logger = {
    debug: (message, data = null, env = null) =>
        log('DEBUG', APP_CONFIG.logging.levels.DEBUG, message, data, env),

    info: (message, data = null, env = null) =>
        log('INFO', APP_CONFIG.logging.levels.INFO, message, data, env),

    warn: (message, data = null, env = null) =>
        log('WARN', APP_CONFIG.logging.levels.WARN, message, data, env),

    error: (message, data = null, env = null) =>
        log('ERROR', APP_CONFIG.logging.levels.ERROR, message, data, env),

    // 特化型ログ関数
    sql: (sql, params, time, rowCount, env = null) => {
        const cleanSql = sql.replace(/\s+/g, ' ').trim();
        logger.debug('SQL Query', {
            sql: cleanSql,
            params,
            time: `${time}ms`,
            rows: rowCount
        }, env);
    },

    http: (method, url, status, time = null, env = null) => {
        const data = time ? { time: `${time}ms` } : null;
        logger.info(`${method} ${url} -> ${status}`, data, env);
    }
};
