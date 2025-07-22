/**
 * データベース操作関数
 * 責務: 共通的なDB操作クエリ
 */

import { errorTypes } from './response.mjs';

/**
 * ユーザー取得
 */
export async function findUser(client, userId) {
  const rows = await client.query(
    'SELECT id, user_id, room_id, display_name FROM users WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
}

/**
 * ユーザー存在確認（エラー付き）
 */
export async function requireUser(client, userId) {
  const user = await findUser(client, userId);
  if (!user) {
    throw errorTypes.notFound('User');
  }
  return user;
}

/**
 * ユーザーラウンド取得
 */
export async function findUserRound(client, userId, roundId) {
  const rows = await client.query(`
    SELECT ur.id, ur.user_id, ur.round_id, ur.room_id, ur.finished_at, ur.score
    FROM users u
    JOIN users_rounds ur ON u.id = ur.user_id
    WHERE u.user_id = ? AND ur.round_id = ?
  `, [userId, roundId]);
  return rows[0] || null;
}

/**
 * ユーザーラウンド存在確認（エラー付き）
 */
export async function requireUserRound(client, userId, roundId) {
  const round = await findUserRound(client, userId, roundId);
  if (!round) {
    throw errorTypes.notFound('Round');
  }
  return round;
}

/**
 * 新しいユーザーID生成
 */
export async function generateUserId(client, roomId) {
  const rows = await client.query(
    'SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?',
    [roomId]
  );
  return (rows[0]?.max_user_id ?? roomId * 1000) + 1;
}

/**
 * 次のラウンドID生成
 */
export async function generateRoundId(client, userDbId) {
  const rows = await client.query(
    'SELECT MAX(round_id) AS max_round_id FROM users_rounds WHERE user_id = ?',
    [userDbId]
  );
  return (rows[0]?.max_round_id ?? 0) + 1;
}
