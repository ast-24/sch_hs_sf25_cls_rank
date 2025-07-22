/**
 * リクエストバリデーションユーティリティ
 */

import { ROOM_ID_MIN, ROOM_ID_MAX, USER_DISPLAY_NAME_MAX_LENGTH } from '../conf.mjs';
import { createValidationErrorResponse } from './response.mjs';

/**
 * JSONボディをパースし、バリデーションエラーがあればResponseオブジェクトを返す
 * @param {Request} request 
 * @returns {Promise<Object|Response>}
 */
export async function parseAndValidateJsonBody(request) {
    try {
        return await request.json();
    } catch (error) {
        return createValidationErrorResponse('Invalid JSON body');
    }
}

/**
 * ルームIDのバリデーション
 * @param {*} roomId 
 * @returns {number|Response}
 */
export function validateRoomId(roomId) {
    if (roomId === undefined || roomId === null) {
        return createValidationErrorResponse('Room ID is required');
    }
    
    if (typeof roomId !== 'number' || !Number.isInteger(roomId) || roomId < 0) {
        return createValidationErrorResponse('Invalid Room ID');
    }
    
    if (roomId < ROOM_ID_MIN || roomId > ROOM_ID_MAX) {
        return createValidationErrorResponse(`Room ID must be between ${ROOM_ID_MIN} and ${ROOM_ID_MAX}`);
    }
    
    return roomId;
}

/**
 * ユーザー表示名のバリデーション
 * @param {*} displayName 
 * @returns {string|null|Response}
 */
export function validateDisplayName(displayName) {
    if (displayName === undefined || displayName === null) {
        return null;
    }
    
    if (typeof displayName !== 'string') {
        return createValidationErrorResponse('Display Name must be a string');
    }
    
    const trimmed = displayName.trim();
    if (trimmed.length > USER_DISPLAY_NAME_MAX_LENGTH) {
        return createValidationErrorResponse(`Display Name must be at most ${USER_DISPLAY_NAME_MAX_LENGTH} characters`);
    }
    
    return trimmed || null;
}

/**
 * URLパラメータからユーザーIDを取得・バリデーション
 * @param {Request} request 
 * @returns {number|Response}
 */
export function getUserIdFromRequest(request) {
    const userIdStr = request.params?.user_id;
    if (!userIdStr) {
        return createValidationErrorResponse('User ID is required');
    }
    
    const userId = parseInt(userIdStr);
    if (isNaN(userId) || userId <= 0 || !Number.isInteger(userId)) {
        return createValidationErrorResponse('Invalid User ID');
    }
    
    return userId;
}

/**
 * URLパラメータからラウンドIDを取得・バリデーション
 * @param {Request} request 
 * @returns {number|Response}
 */
export function getRoundIdFromRequest(request) {
    const roundIdStr = request.params?.round_id;
    if (!roundIdStr) {
        return createValidationErrorResponse('Round ID is required');
    }
    
    const roundId = parseInt(roundIdStr);
    if (isNaN(roundId) || roundId <= 0 || !Number.isInteger(roundId)) {
        return createValidationErrorResponse('Invalid Round ID');
    }
    
    return roundId;
}

/**
 * boolean値のバリデーション（null許可）
 * @param {*} value 
 * @param {string} fieldName 
 * @returns {boolean|null|Response}
 */
export function validateNullableBoolean(value, fieldName) {
    if (value === null || value === undefined) {
        return null;
    }
    
    if (typeof value !== 'boolean') {
        return createValidationErrorResponse(`${fieldName} must be a boolean or null`);
    }
    
    return value;
}

/**
 * ランキングタイプのバリデーション
 * @param {string} typeParam 
 * @returns {string[]|Response}
 */
export function validateRankingTypes(typeParam) {
    const validTypes = ['today_total', 'round_max', 'round', 'round_latest'];
    
    if (!typeParam) {
        return createValidationErrorResponse('Missing type parameter');
    }
    
    const types = typeParam.split(',').map(t => t.trim()).filter(Boolean);
    const unknownTypes = types.filter(type => !validTypes.includes(type));
    
    if (unknownTypes.length) {
        return createValidationErrorResponse(`Unknown ranking type(s): ${unknownTypes.join(',')}`);
    }
    
    return types;
}
