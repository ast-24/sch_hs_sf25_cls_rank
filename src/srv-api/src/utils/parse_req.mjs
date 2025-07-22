// このファイルは非推奨です。新しいバリデーションユーティリティを使用してください。
// import { getUserIdFromRequest, getRoundIdFromRequest } from './validation.mjs';

export function getUserIdFromReq(request) {
    let userId = request.params?.user_id;
    if (!userId) {
        return new Response('User ID is required', { status: 400 });
    }
    userId = parseInt(userId);
    if (isNaN(userId)) {
        return new Response('Invalid User ID', { status: 400 });
    }
    if (typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
        return new Response('Invalid User ID', { status: 400 });
    }
    return userId;
}

export function getRoundIdFromReq(request) {
    let roundId = request.params?.round_id;
    if (!roundId) {
        return new Response('Round ID is required', { status: 400 });
    }
    roundId = parseInt(roundId);
    if (isNaN(roundId)) {
        return new Response('Invalid Round ID', { status: 400 });
    }
    if (typeof roundId !== 'number' || roundId <= 0 || !Number.isInteger(roundId)) {
        return new Response('Invalid Round ID', { status: 400 });
    }
    return roundId;
}