/**
 * roomid-userid(4桁パディング)形式の文字列を分解
 * @param {string} userIdRaw 例: "1234-0056"
 * @returns {{ roomId: number, userId: number }}
 * @throws {Error} フォーマット不正時
 */
export function parseRoomUserId(userIdRaw) {
    if (!userIdRaw) throw new Error("User ID is required");
    const parts = userIdRaw.split('-');
    if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d{4}$/.test(parts[1])) {
        throw new Error("Invalid user_id format: " + userIdRaw);
    }
    return {
        roomId: parseInt(parts[0], 10),
        userId: parseInt(parts[1], 10)
    };
}

/**
 * roomId, userIdからroomid-userid(4桁パディング)形式の文字列を生成
 * @param {number} roomId
 * @param {number} userId
 * @returns {string} 例: "1234-0056"
 */
export function formatRoomUserId(roomId, userId) {
    return `${roomId}-${String(userId).padStart(4, '0')}`;
}
