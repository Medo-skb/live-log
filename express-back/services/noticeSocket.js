const oracledb = require('oracledb');
const { emitToUser } = require('../socket');

function mapNoticeRow(row) {
  return {
    noticeId: row.NOTIFICATION_ID,
    type: row.NOTIFICATION_TYPE,
    targetType: row.TARGET_TYPE,
    targetId: row.TARGET_ID,
    isRead: row.IS_READ === 1,
    createdAt: row.CREATED_AT,
    sender: row.SENDER_ID ? {
      userId: row.SENDER_ID,
      username: row.SENDER_USERNAME,
      nickname: row.SENDER_NICKNAME,
    } : null,
    targetPost: row.TARGET_POST_ID ? {
      postId: row.TARGET_POST_ID,
      username: row.TARGET_POST_USERNAME,
    } : null,
  };
}

async function getLatestNoticePayload(connection, { receiverId, senderId, type, targetType, targetId }) {
  if (!receiverId || !senderId || !type) return null;

  const result = await connection.execute(
    `
      SELECT
        n.NOTIFICATION_ID,
        n.NOTIFICATION_TYPE,
        n.TARGET_TYPE,
        n.TARGET_ID,
        n.IS_READ,
        TO_CHAR(n.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT,
        s.USER_ID AS SENDER_ID,
        s.USERNAME AS SENDER_USERNAME,
        s.NICKNAME AS SENDER_NICKNAME,
        tp.POST_ID AS TARGET_POST_ID,
        tu.USERNAME AS TARGET_POST_USERNAME
      FROM NOTICE n
      LEFT JOIN USERS s ON s.USER_ID = n.SENDER_ID
      LEFT JOIN POSTS tp ON n.TARGET_TYPE = 'POST' AND tp.POST_ID = n.TARGET_ID AND tp.IS_DELETED = 0
      LEFT JOIN USERS tu ON tu.USER_ID = tp.USER_ID
      WHERE n.RECEIVER_ID = :receiverId
        AND n.SENDER_ID = :senderId
        AND n.NOTIFICATION_TYPE = :type
        AND NVL(n.TARGET_TYPE, 'NONE') = NVL(:targetType, 'NONE')
        AND NVL(n.TARGET_ID, -1) = NVL(:targetId, -1)
      ORDER BY n.NOTIFICATION_ID DESC
      FETCH FIRST 1 ROW ONLY
    `,
    { receiverId, senderId, type, targetType, targetId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  const notice = result.rows[0] ? mapNoticeRow(result.rows[0]) : null;
  if (!notice) return null;

  const unreadResult = await connection.execute(
    'SELECT COUNT(*) AS UNREAD_COUNT FROM NOTICE WHERE RECEIVER_ID = :receiverId AND IS_READ = 0',
    { receiverId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return {
    notice,
    unreadCount: unreadResult.rows[0]?.UNREAD_COUNT || 0,
  };
}

async function emitNoticeCreated(connection, noticeLookup) {
  if (!noticeLookup?.receiverId) return;

  try {
    const payload = await getLatestNoticePayload(connection, noticeLookup);
    if (payload) {
      emitToUser(noticeLookup.receiverId, 'notice:new', payload);
    }
  } catch (error) {
    console.error('Notice socket emit error', error);
  }
}

module.exports = {
  emitNoticeCreated,
};
