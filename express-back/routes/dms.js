const express = require('express');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');
const { emitToUser } = require('../socket');

const router = express.Router();
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MAX_CONTENT_LENGTH = 2000;

function normalizePositiveInteger(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeLimit(value) {
  const limit = normalizePositiveInteger(value) || DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function normalizeUsername(value) {
  return String(value || '').trim().slice(0, 50);
}

function normalizeContent(value) {
  return String(value || '').trim().slice(0, MAX_CONTENT_LENGTH);
}

function mapUserRow(row, prefix = '') {
  return {
    userId: row[prefix + 'USER_ID'],
    username: row[prefix + 'USERNAME'],
    nickname: row[prefix + 'NICKNAME'],
  };
}

function mapMessageRow(row) {
  return {
    messageId: row.MESSAGE_ID,
    senderId: row.SENDER_ID,
    receiverId: row.RECEIVER_ID,
    content: row.CONTENT,
    isRead: row.IS_READ === 1,
    createdAt: row.CREATED_AT,
  };
}

async function findUserByUsername(connection, username) {
  const result = await connection.execute(
    `
      SELECT USER_ID, USERNAME, NICKNAME
      FROM USERS
      WHERE USERNAME = :username
    `,
    { username },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function getUserById(connection, userId) {
  const result = await connection.execute(
    `
      SELECT USER_ID, USERNAME, NICKNAME
      FROM USERS
      WHERE USER_ID = :userId
    `,
    { userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function getUnreadDmCount(connection, userId) {
  const result = await connection.execute(
    'SELECT COUNT(*) AS UNREAD_COUNT FROM DM WHERE RECEIVER_ID = :userId AND IS_READ = 0',
    { userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0]?.UNREAD_COUNT || 0;
}

async function assertMessageAllowed(connection, viewerId, targetUserId) {
  if (Number(viewerId) === Number(targetUserId)) {
    return { allowed: false, status: 400, message: '차단 관계에서는 메시지를 보낼 수 없습니다.' };
  }

  const blocked = await connection.execute(
    `
      SELECT 1
      FROM USER_BLOCK ub
      WHERE (ub.BLOCKER_ID = :viewerId AND ub.BLOCKED_ID = :targetUserId)
         OR (ub.BLOCKER_ID = :targetUserId AND ub.BLOCKED_ID = :viewerId)
      FETCH FIRST 1 ROW ONLY
    `,
    { viewerId, targetUserId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  if (blocked.rows.length > 0) {
    return { allowed: false, status: 403, message: '차단 관계에서는 메시지를 보낼 수 없습니다.' };
  }

  return { allowed: true };
}


router.get('/unread-count', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    const unreadCount = await getUnreadDmCount(connection, req.user.userId);
    return res.json({ result: 'success', unreadCount });
  } catch (error) {
    console.error('DM unread count error', error);
    return res.status(500).json({ result: 'fail', message: '안 읽은 메시지 수를 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.delete('/messages/:messageId', jwtAuthentication, async (req, res) => {
  const messageId = normalizePositiveInteger(req.params.messageId);
  let connection;

  if (!messageId) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const found = await connection.execute(
      `
        SELECT MESSAGE_ID, SENDER_ID, RECEIVER_ID
        FROM DM
        WHERE MESSAGE_ID = :messageId
      `,
      { messageId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const message = found.rows[0];

    if (!message) {
      return res.status(404).json({ result: 'fail', message: '메시지를 찾을 수 없습니다.' });
    }

    if (Number(message.SENDER_ID) !== Number(req.user.userId)) {
      return res.status(403).json({ result: 'fail', message: '내가 보낸 메시지만 삭제할 수 있습니다.' });
    }

    await connection.execute(
      'DELETE FROM DM WHERE MESSAGE_ID = :messageId AND SENDER_ID = :viewerId',
      { messageId, viewerId: req.user.userId }
    );
    await connection.commit();

    emitToUser(message.RECEIVER_ID, 'dm:delete', { messageId });
    emitToUser(message.SENDER_ID, 'dm:delete', { messageId });

    return res.json({ result: 'success', messageId });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('DM delete error', error);
    return res.status(500).json({ result: 'fail', message: '메시지 삭제 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/conversations', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      `
        SELECT
          other_user.USER_ID,
          other_user.USERNAME,
          other_user.NICKNAME,
          last_dm.MESSAGE_ID,
          last_dm.CONTENT,
          TO_CHAR(last_dm.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT,
          last_dm.SENDER_ID,
          last_dm.RECEIVER_ID,
          last_dm.IS_READ,
          (
            SELECT COUNT(*)
            FROM DM unread_dm
            WHERE unread_dm.SENDER_ID = other_user.USER_ID
              AND unread_dm.RECEIVER_ID = :viewerId
              AND unread_dm.IS_READ = 0
          ) AS UNREAD_COUNT
        FROM USERS other_user
        JOIN DM last_dm ON last_dm.MESSAGE_ID = (
          SELECT MAX(dm2.MESSAGE_ID)
          FROM DM dm2
          WHERE (dm2.SENDER_ID = :viewerId AND dm2.RECEIVER_ID = other_user.USER_ID)
             OR (dm2.SENDER_ID = other_user.USER_ID AND dm2.RECEIVER_ID = :viewerId)
        )
        WHERE other_user.USER_ID <> :viewerId
          AND NOT EXISTS (
            SELECT 1 FROM USER_BLOCK ub
            WHERE (ub.BLOCKER_ID = :viewerId AND ub.BLOCKED_ID = other_user.USER_ID)
               OR (ub.BLOCKER_ID = other_user.USER_ID AND ub.BLOCKED_ID = :viewerId)
          )
        ORDER BY last_dm.MESSAGE_ID DESC
      `,
      { viewerId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const conversations = result.rows.map((row) => ({
      user: mapUserRow(row),
      lastMessage: {
        messageId: row.MESSAGE_ID,
        content: row.CONTENT,
        senderId: row.SENDER_ID,
        receiverId: row.RECEIVER_ID,
        isRead: row.IS_READ === 1,
        createdAt: row.CREATED_AT,
      },
      unreadCount: row.UNREAD_COUNT || 0,
    }));

    return res.json({ result: 'success', conversations });
  } catch (error) {
    console.error('DM conversation list error', error);
    return res.status(500).json({ result: 'fail', message: '대화 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});


router.patch('/:username/read', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const targetUser = await findUserByUsername(connection, username);

    if (!targetUser) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    const updated = await connection.execute(
      'UPDATE DM SET IS_READ = 1 WHERE SENDER_ID = :targetUserId AND RECEIVER_ID = :viewerId AND IS_READ = 0',
      { targetUserId: targetUser.userId, viewerId: req.user.userId }
    );
    await connection.commit();

    const unreadCount = await getUnreadDmCount(connection, req.user.userId);

    if (updated.rowsAffected > 0) {
      emitToUser(targetUser.userId, 'dm:read', {
        readerId: req.user.userId,
        conversationUser: {
          userId: req.user.userId,
          username: req.user.username,
          nickname: req.user.nickname || req.user.username,
        },
      });
      emitToUser(req.user.userId, 'dm:unread-count', { unreadCount });
    }

    return res.json({ result: 'success', unreadCount });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('DM read error', error);
    return res.status(500).json({ result: 'fail', message: '메시지 읽음 처리 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.post('/:username/block', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const targetUser = await findUserByUsername(connection, username);

    if (!targetUser) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    if (Number(targetUser.userId) === Number(req.user.userId)) {
      return res.status(400).json({ result: 'fail', message: '자기 자신은 차단할 수 없습니다.' });
    }

    await connection.execute(
      `
        INSERT INTO USER_BLOCK (BLOCKER_ID, BLOCKED_ID)
        SELECT :viewerId, :targetUserId
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM USER_BLOCK
          WHERE BLOCKER_ID = :viewerId AND BLOCKED_ID = :targetUserId
        )
      `,
      { viewerId: req.user.userId, targetUserId: targetUser.userId }
    );
    await connection.commit();

    emitToUser(targetUser.userId, 'dm:block', { blockerId: req.user.userId });

    return res.json({ result: 'success', blocked: true, user: targetUser });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('DM block error', error);
    return res.status(500).json({ result: 'fail', message: '메시지 삭제 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/:username/messages', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const cursor = normalizePositiveInteger(req.query.cursor);
  const limit = normalizeLimit(req.query.limit);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const targetUser = await findUserByUsername(connection, username);

    if (!targetUser) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    const permission = await assertMessageAllowed(connection, req.user.userId, targetUser.userId);
    if (!permission.allowed) {
      return res.status(permission.status).json({ result: 'fail', message: permission.message });
    }

    const filters = [
      '((dm.SENDER_ID = :viewerId AND dm.RECEIVER_ID = :targetUserId) OR (dm.SENDER_ID = :targetUserId AND dm.RECEIVER_ID = :viewerId))',
    ];
    const binds = { viewerId: req.user.userId, targetUserId: targetUser.userId };

    if (cursor) {
      filters.push('dm.MESSAGE_ID < :cursor');
      binds.cursor = cursor;
    }

    const result = await connection.execute(
      `
        SELECT * FROM (
          SELECT
            dm.MESSAGE_ID,
            dm.SENDER_ID,
            dm.RECEIVER_ID,
            dm.CONTENT,
            dm.IS_READ,
            TO_CHAR(dm.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT
          FROM DM dm
          WHERE ${filters.join(' AND ')}
          ORDER BY dm.MESSAGE_ID DESC
        )
        WHERE ROWNUM <= :fetchLimit
      `,
      { ...binds, fetchLimit: limit + 1 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const readUpdated = await connection.execute(
      'UPDATE DM SET IS_READ = 1 WHERE SENDER_ID = :targetUserId AND RECEIVER_ID = :viewerId AND IS_READ = 0',
      { targetUserId: targetUser.userId, viewerId: req.user.userId }
    );
    await connection.commit();

    if (readUpdated.rowsAffected > 0) {
      const unreadCount = await getUnreadDmCount(connection, req.user.userId);
      emitToUser(targetUser.userId, 'dm:read', {
        readerId: req.user.userId,
        conversationUser: {
          userId: req.user.userId,
          username: req.user.username,
          nickname: req.user.nickname || req.user.username,
        },
      });
      emitToUser(req.user.userId, 'dm:unread-count', { unreadCount });
    }

    const rows = result.rows.slice(0, limit);
    const messages = rows.map(mapMessageRow).reverse();
    const oldestMessage = messages[0];

    return res.json({
      result: 'success',
      user: targetUser,
      messages,
      nextCursor: result.rows.length > limit && oldestMessage ? oldestMessage.messageId : null,
      hasMore: result.rows.length > limit,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('DM message list error', error);
    return res.status(500).json({ result: 'fail', message: '메시지 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.post('/:username/messages', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const content = normalizeContent(req.body.content);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  if (!content) {
    return res.status(400).json({ result: 'fail', message: '메시지를 입력해주세요.' });
  }

  try {
    connection = await db.getConnection();
    const targetUser = await findUserByUsername(connection, username);

    if (!targetUser) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    const permission = await assertMessageAllowed(connection, req.user.userId, targetUser.userId);
    if (!permission.allowed) {
      return res.status(permission.status).json({ result: 'fail', message: permission.message });
    }

    const inserted = await connection.execute(
      `
        INSERT INTO DM (SENDER_ID, RECEIVER_ID, CONTENT)
        VALUES (:senderId, :receiverId, :content)
        RETURNING MESSAGE_ID INTO :messageId
      `,
      {
        senderId: req.user.userId,
        receiverId: targetUser.userId,
        content,
        messageId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    const messageId = inserted.outBinds.messageId[0];
    const messageResult = await connection.execute(
      `
        SELECT
          dm.MESSAGE_ID,
          dm.SENDER_ID,
          dm.RECEIVER_ID,
          dm.CONTENT,
          dm.IS_READ,
          TO_CHAR(dm.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT
        FROM DM dm
        WHERE dm.MESSAGE_ID = :messageId
      `,
      { messageId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    await connection.commit();

    const senderUser = {
      userId: req.user.userId,
      username: req.user.username,
      nickname: req.user.nickname || req.user.username,
    };
    const message = mapMessageRow(messageResult.rows[0]);
    const receiverUnreadCount = await getUnreadDmCount(connection, targetUser.userId);
    const receiverPayload = { message, conversationUser: senderUser, unreadCount: receiverUnreadCount };
    const senderPayload = { message, conversationUser: targetUser };

    emitToUser(targetUser.userId, 'dm:new', receiverPayload);
    emitToUser(targetUser.userId, 'dm:unread-count', { unreadCount: receiverUnreadCount });
    emitToUser(req.user.userId, 'dm:new', senderPayload);

    return res.status(201).json({ result: 'success', message, user: targetUser });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('DM send error', error);
    return res.status(500).json({ result: 'fail', message: '메시지 전송 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
