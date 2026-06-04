const express = require('express');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');

const router = express.Router();

function normalizeUsername(value) {
  return String(value || '').trim().slice(0, 50);
}

function normalizeNickname(value) {
  return String(value || '').trim().slice(0, 20);
}

async function findUserByUsername(connection, username, viewerId) {
  const result = await connection.execute(
    `
      SELECT
        u.USER_ID,
        u.USERNAME,
        u.NICKNAME,
        u.DISCRIMINATOR,
        TO_CHAR(u.CREATED_AT, 'YYYY-MM-DD') AS CREATED_AT,
        (SELECT COUNT(*) FROM POSTS p WHERE p.USER_ID = u.USER_ID AND p.PARENT_POST_ID IS NULL AND p.IS_DELETED = 0) AS POST_COUNT,
        (SELECT COUNT(*) FROM FOLLOWS f WHERE f.FOLLOWING_ID = u.USER_ID) AS FOLLOWER_COUNT,
        (SELECT COUNT(*) FROM FOLLOWS f WHERE f.FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT,
        CASE WHEN EXISTS (
          SELECT 1 FROM FOLLOWS f
          WHERE f.FOLLOWER_ID = :viewerId AND f.FOLLOWING_ID = u.USER_ID
        ) THEN 1 ELSE 0 END AS FOLLOWED_BY_ME
      FROM USERS u
      WHERE u.USERNAME = :username
    `,
    { username, viewerId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    userId: row.USER_ID,
    username: row.USERNAME,
    nickname: row.NICKNAME,
    tag: row.DISCRIMINATOR,
    createdAt: row.CREATED_AT,
    isMe: Number(row.USER_ID) === Number(viewerId),
    followedByMe: row.FOLLOWED_BY_ME === 1,
    counts: {
      posts: row.POST_COUNT || 0,
      followers: row.FOLLOWER_COUNT || 0,
      following: row.FOLLOWING_COUNT || 0,
    },
  };
}

router.get('/:username', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const profile = await findUserByUsername(connection, username, req.user.userId);

    if (!profile) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    return res.json({ result: 'success', profile });
  } catch (error) {
    console.error('Profile load error', error);
    return res.status(500).json({ result: 'fail', message: '프로필 정보를 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.patch('/:username', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const nickname = normalizeNickname(req.body.nickname);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ result: 'fail', message: '닉네임은 2~20자로 입력해주세요.' });
  }

  try {
    connection = await db.getConnection();
    const profile = await findUserByUsername(connection, username, req.user.userId);

    if (!profile) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    if (!profile.isMe) {
      return res.status(403).json({ result: 'fail', message: '다른 사용자의 프로필은 수정할 수 없습니다.' });
    }

    await connection.execute(
      'UPDATE USERS SET NICKNAME = :nickname WHERE USER_ID = :userId',
      { nickname, userId: profile.userId }
    );
    await connection.commit();

    const updatedProfile = await findUserByUsername(connection, username, req.user.userId);
    return res.json({ result: 'success', profile: updatedProfile });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Profile update error', error);
    return res.status(500).json({ result: 'fail', message: '프로필 수정 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.post('/:username/follow', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const profile = await findUserByUsername(connection, username, req.user.userId);

    if (!profile) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    if (profile.isMe) {
      return res.status(400).json({ result: 'fail', message: '본인은 팔로우할 수 없습니다.' });
    }

    const found = await connection.execute(
      'SELECT FOLLOWER_ID FROM FOLLOWS WHERE FOLLOWER_ID = :viewerId AND FOLLOWING_ID = :targetUserId',
      { viewerId: req.user.userId, targetUserId: profile.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let following;

    if (found.rows.length > 0) {
      await connection.execute(
        'DELETE FROM FOLLOWS WHERE FOLLOWER_ID = :viewerId AND FOLLOWING_ID = :targetUserId',
        { viewerId: req.user.userId, targetUserId: profile.userId }
      );
      following = false;
    } else {
      await connection.execute(
        'INSERT INTO FOLLOWS (FOLLOWER_ID, FOLLOWING_ID) VALUES (:viewerId, :targetUserId)',
        { viewerId: req.user.userId, targetUserId: profile.userId }
      );
      following = true;
    }

    await connection.commit();

    const updatedProfile = await findUserByUsername(connection, username, req.user.userId);
    return res.json({ result: 'success', following, profile: updatedProfile });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Follow toggle error', error);
    return res.status(500).json({ result: 'fail', message: '팔로우 처리 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/:username/:type', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const type = String(req.params.type || '').trim();
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  if (!['following', 'followers'].includes(type)) {
    return res.status(400).json({ result: 'fail', message: '목록 유형이 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const profile = await findUserByUsername(connection, username, req.user.userId);

    if (!profile) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    const isFollowingList = type === 'following';
    const joinCondition = isFollowingList
      ? 'f.FOLLOWING_ID = u.USER_ID'
      : 'f.FOLLOWER_ID = u.USER_ID';
    const ownerCondition = isFollowingList
      ? 'f.FOLLOWER_ID = :targetUserId'
      : 'f.FOLLOWING_ID = :targetUserId';

    const result = await connection.execute(
              'SELECT ' +
        'u.USER_ID, u.USERNAME, u.NICKNAME, u.DISCRIMINATOR, ' +
        'CASE WHEN EXISTS (SELECT 1 FROM FOLLOWS viewer_follow WHERE viewer_follow.FOLLOWER_ID = :viewerId AND viewer_follow.FOLLOWING_ID = u.USER_ID) THEN 1 ELSE 0 END AS FOLLOWED_BY_ME ' +
        'FROM FOLLOWS f ' +
        'JOIN USERS u ON ' + joinCondition + ' ' +
        'WHERE ' + ownerCondition + ' ' +
        'ORDER BY f.CREATED_AT DESC',
      { targetUserId: profile.userId, viewerId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const users = result.rows.map((row) => ({
      userId: row.USER_ID,
      username: row.USERNAME,
      nickname: row.NICKNAME,
      tag: row.DISCRIMINATOR,
      followedByMe: row.FOLLOWED_BY_ME === 1,
    }));

    return res.json({ result: 'success', profile, users });
  } catch (error) {
    console.error('Connection list load error', error);
    return res.status(500).json({ result: 'fail', message: '관계 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;