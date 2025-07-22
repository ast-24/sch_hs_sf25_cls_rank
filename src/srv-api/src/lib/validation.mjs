/**
 * 入力バリデーション
 * 責務: 入力値の検証とエラーレスポンス生成
 */

import { APP_CONFIG } from './config.mjs';
import { errorTypes } from './response.mjs';

/**
 * JSONボディ解析
 */
export async function parseJsonBody(request) {
    try {
        return await request.json();
    } catch {
        throw errorTypes.validation('Invalid JSON body');
    }
}

/**
 * ルームIDバリデーション
 */
export function validateRoomId(roomId) {
    if (roomId == null) {
        throw errorTypes.validation('Room ID is required');
    }

    if (!Number.isInteger(roomId) || roomId < 0) {
        throw errorTypes.validation('Invalid Room ID');
    }

    if (roomId < APP_CONFIG.room.idMin || roomId > APP_CONFIG.room.idMax) {
        throw errorTypes.validation(
            `Room ID must be between ${APP_CONFIG.room.idMin} and ${APP_CONFIG.room.idMax}`
        );
    }

    return roomId;
}

/**
 * 表示名バリデーション
 */
export function validateDisplayName(displayName) {
    if (displayName == null) return null;

    if (typeof displayName !== 'string') {
        throw errorTypes.validation('Display Name must be a string');
    }

    const trimmed = displayName.trim();
    if (trimmed.length > APP_CONFIG.user.displayNameMaxLength) {
        throw errorTypes.validation(
            `Display Name must be at most ${APP_CONFIG.user.displayNameMaxLength} characters`
        );
    }

    return trimmed || null;
}

/**
 * URLパラメータからID取得
 */
export function getIdFromParams(request, paramName, displayName) {
    const value = request.params?.[paramName];
    if (!value) {
        throw errorTypes.validation(`${displayName} is required`);
    }

    const id = parseInt(value);
    if (isNaN(id) || id <= 0) {
        throw errorTypes.validation(`Invalid ${displayName}`);
    }

    return id;
}

export const getIds = {
    user: (request) => getIdFromParams(request, 'user_id', 'User ID'),
    round: (request) => getIdFromParams(request, 'round_id', 'Round ID')
};

/**
 * ランキングタイプバリデーション
 */
export function validateRankingTypes(typeParam) {
    if (!typeParam) {
        throw errorTypes.validation('Missing type parameter');
    }

    const types = typeParam.split(',').map(t => t.trim()).filter(Boolean);
    const validTypes = APP_CONFIG.ranking.validTypes;
    const unknownTypes = types.filter(type => !validTypes.includes(type));

    if (unknownTypes.length) {
        throw errorTypes.validation(`Unknown ranking type(s): ${unknownTypes.join(',')}`);
    }

    return types;
}

/**
 * Boolean値バリデーション（null許可）
 */
export function validateBoolean(value, fieldName) {
    if (value == null) return null;
    if (typeof value !== 'boolean') {
        throw errorTypes.validation(`${fieldName} must be a boolean or null`);
    }
    return value;
}
