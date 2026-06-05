const express = require('express');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');

const router = express.Router();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function normalizePositiveInteger(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeLimit(value) {
  const limit = normalizePositiveInteger(value) || DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

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

router.get('/', jwtAuthentication, async (req, res) => {
  const cursor = normalizePositiveInteger(req.query.cursor);
  const limit = normalizeLimit(req.query.limit);
  let connection;

  try {
    connection = await db.getConnection();
    const filters = ['n.RECEIVER_ID = :viewerId'];
    const binds = { viewerId: req.user.userId };

    if (cursor) {
      filters.push('n.NOTIFICATION_ID < :cursor');
      binds.cursor = cursor;
    }

    const result = await connection.execute(
      `
        SELECT * FROM (
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
          WHERE ${filters.join(' AND ')}
          ORDER BY n.NOTIFICATION_ID DESC
        )
        WHERE ROWNUM <= :fetchLimit
      `,
      { ...binds, fetchLimit: limit + 1 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows.slice(0, limit);
    const notices = rows.map(mapNoticeRow);
    const lastNotice = notices[notices.length - 1];
    const unreadResult = await connection.execute(
      'SELECT COUNT(*) AS UNREAD_COUNT FROM NOTICE WHERE RECEIVER_ID = :viewerId AND IS_READ = 0',
      { viewerId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({
      result: 'success',
      notices,
      unreadCount: unreadResult.rows[0]?.UNREAD_COUNT || 0,
      nextCursor: result.rows.length > limit && lastNotice ? lastNotice.noticeId : null,
      hasMore: result.rows.length > limit,
    });
  } catch (error) {
    console.error('Notice list error', error);
    return res.status(500).json({ result: 'fail', message: '?? ??? ???? ? ??? ??????.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/unread-count', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      'SELECT COUNT(*) AS UNREAD_COUNT FROM NOTICE WHERE RECEIVER_ID = :viewerId AND IS_READ = 0',
      { viewerId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({ result: 'success', unreadCount: result.rows[0]?.UNREAD_COUNT || 0 });
  } catch (error) {
    console.error('Notice unread count error', error);
    return res.status(500).json({ result: 'fail', message: '?? ?? ?? ?? ???? ?????.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.patch('/read-all', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.execute(
      'UPDATE NOTICE SET IS_READ = 1 WHERE RECEIVER_ID = :viewerId AND IS_READ = 0',
      { viewerId: req.user.userId }
    );
    await connection.commit();

    return res.json({ result: 'success', unreadCount: 0 });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Notice read all error', error);
    return res.status(500).json({ result: 'fail', message: '?? ?? ?? ? ??? ??????.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.patch('/:noticeId/read', jwtAuthentication, async (req, res) => {
  const noticeId = normalizePositiveInteger(req.params.noticeId);
  let connection;

  if (!noticeId) {
    return res.status(400).json({ result: 'fail', message: '?? ??? ???? ????.' });
  }

  try {
    connection = await db.getConnection();
    await connection.execute(
      'UPDATE NOTICE SET IS_READ = 1 WHERE NOTIFICATION_ID = :noticeId AND RECEIVER_ID = :viewerId',
      { noticeId, viewerId: req.user.userId }
    );
    await connection.commit();

    return res.json({ result: 'success' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Notice read error', error);
    return res.status(500).json({ result: 'fail', message: '?? ?? ?? ? ??? ??????.' });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
