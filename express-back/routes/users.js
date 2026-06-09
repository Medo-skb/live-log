const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');
const { emitNoticeCreated } = require('../services/noticeSocket');

const router = express.Router();
const userUploadDir = path.join(__dirname, '..', 'uploads', 'users');

fs.mkdirSync(userUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, userUploadDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(normalizeUploadOriginalName(file.originalname || '')).toLowerCase();
      callback(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      callback(null, true);
      return;
    }
    callback(new Error('이미지 파일만 업로드할 수 있습니다.'));
  },
});

function normalizeUploadOriginalName(originalName) {
  const safeBaseName = path.basename(String(originalName || 'file')) || 'file';
  const looksLikeLatin1Mojibake = /[\u0080-\u00ff]/.test(safeBaseName);
  if (!looksLikeLatin1Mojibake) return safeBaseName;
  const decodedName = Buffer.from(safeBaseName, 'latin1').toString('utf8');
  return decodedName && !decodedName.includes('?') ? decodedName : safeBaseName;
}

function uploadProfileMedia(req, res, next) {
  upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'bannerImage', maxCount: 1 }])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    return res.status(400).json({ result: 'fail', message: error.message || '파일 업로드 중 오류가 발생했습니다.' });
  });
}

function getUploadedFile(req, fieldName) {
  return req.files && req.files[fieldName] && req.files[fieldName][0] ? req.files[fieldName][0] : null;
}

function mapUserFile(file) {
  if (!file) return null;
  const originalName = normalizeUploadOriginalName(file.originalname || 'file');
  return {
    fileUrl: '/uploads/users/' + file.filename,
    fileName: file.filename,
    originName: originalName,
    fileSize: file.size,
    fileExt: path.extname(originalName).replace(/^\./, '').toLowerCase(),
  };
}

async function insertUserMedia(connection, userId, file, role) {
  const info = mapUserFile(file);
  if (!info) return null;
  await connection.execute(
    `
      INSERT INTO USER_MEDIA (
        USER_ID, FILE_URL, FILE_NAME, ORIGIN_NAME, FILE_SIZE, FILE_EXT, MEDIA_ROLE
      ) VALUES (
        :userId, :fileUrl, :fileName, :originName, :fileSize, :fileExt, :mediaRole
      )
    `,
    { userId, ...info, mediaRole: role }
  );
  return info.fileUrl;
}

function normalizeUsername(value) {
  return String(value || '').trim().slice(0, 50);
}

function normalizeNickname(value) {
  return String(value || '').trim().slice(0, 20);
}

function normalizeBio(value) {
  return String(value || '').trim().slice(0, 500);
}

function mapRecommendedUserRow(row) {
  return {
    userId: row.USER_ID,
    username: row.USERNAME,
    nickname: row.NICKNAME,
    tag: row.DISCRIMINATOR,
    profileImageUrl: row.PROFILE_IMAGE_URL || '',
    followedByMe: row.FOLLOWED_BY_ME === 1,
    role: row.ROLE || 'USER',
    counts: {
      posts: row.POST_COUNT || 0,
      followers: row.FOLLOWER_COUNT || 0,
      mutualCategories: row.MUTUAL_CATEGORY_COUNT || 0,
    },
  };
}

async function createNotice(connection, { receiverId, senderId, type, targetType, targetId }) {
  if (!receiverId || !senderId || Number(receiverId) === Number(senderId)) return null;

  const inserted = await connection.execute(
    `
      INSERT INTO NOTICE (
        RECEIVER_ID,
        SENDER_ID,
        NOTIFICATION_TYPE,
        TARGET_TYPE,
        TARGET_ID
      )
      SELECT :receiverId, :senderId, :type, :targetType, :targetId
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM NOTICE n
        WHERE n.RECEIVER_ID = :receiverId
          AND n.SENDER_ID = :senderId
          AND n.NOTIFICATION_TYPE = :type
          AND NVL(n.TARGET_TYPE, 'NONE') = NVL(:targetType, 'NONE')
          AND NVL(n.TARGET_ID, -1) = NVL(:targetId, -1)
      )
    `,
    { receiverId, senderId, type, targetType, targetId }
  );

  return inserted.rowsAffected > 0 ? { receiverId, senderId, type, targetType, targetId } : null;
}

async function findUserByUsername(connection, username, viewerId) {
  const result = await connection.execute(
    `
      SELECT
        u.USER_ID,
        u.USERNAME,
        u.NICKNAME,
        u.DISCRIMINATOR,
        u.BIO,
        u.PROFILE_IMAGE_URL,
        u.BANNER_IMAGE_URL,
        u.ROLE,
        u.SPOILER_FILTER,
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
        AND u.ROLE <> 'ADMIN'
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
    bio: row.BIO || '',
    profileImageUrl: row.PROFILE_IMAGE_URL || '',
    bannerImageUrl: row.BANNER_IMAGE_URL || '',
    role: row.ROLE || 'USER',
    spoilerFilter: row.SPOILER_FILTER === 0 ? 0 : 1,
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


router.get('/recommendations', jwtAuthentication, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 20);
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `
        SELECT * FROM (
          SELECT
            u.USER_ID,
            u.USERNAME,
            u.NICKNAME,
            u.DISCRIMINATOR,
            u.PROFILE_IMAGE_URL,
            (SELECT COUNT(*) FROM POSTS p WHERE p.USER_ID = u.USER_ID AND p.PARENT_POST_ID IS NULL AND p.IS_DELETED = 0) AS POST_COUNT,
            (SELECT COUNT(*) FROM FOLLOWS f WHERE f.FOLLOWING_ID = u.USER_ID) AS FOLLOWER_COUNT,
            CASE WHEN EXISTS (
              SELECT 1 FROM FOLLOWS f
              WHERE f.FOLLOWER_ID = :viewerId AND f.FOLLOWING_ID = u.USER_ID
            ) THEN 1 ELSE 0 END AS FOLLOWED_BY_ME,
            (
              SELECT COUNT(*)
              FROM USER_CATEGORY viewer_category
              JOIN USER_CATEGORY target_category ON target_category.CATEGORY_ID = viewer_category.CATEGORY_ID
              WHERE viewer_category.USER_ID = :viewerId
                AND target_category.USER_ID = u.USER_ID
            ) AS MUTUAL_CATEGORY_COUNT
          FROM USERS u
          WHERE u.USER_ID <> :viewerId
            AND u.ROLE <> 'ADMIN'
            AND NOT EXISTS (
              SELECT 1 FROM FOLLOWS f
              WHERE f.FOLLOWER_ID = :viewerId AND f.FOLLOWING_ID = u.USER_ID
            )
            AND NOT EXISTS (
              SELECT 1 FROM USER_BLOCK ub
              WHERE (ub.BLOCKER_ID = :viewerId AND ub.BLOCKED_ID = u.USER_ID)
                 OR (ub.BLOCKER_ID = u.USER_ID AND ub.BLOCKED_ID = :viewerId)
            )
          ORDER BY MUTUAL_CATEGORY_COUNT DESC, FOLLOWER_COUNT DESC, POST_COUNT DESC, u.CREATED_AT DESC
        )
        WHERE ROWNUM <= :limit
      `,
      { viewerId: req.user.userId, limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({
      result: 'success',
      users: result.rows.map(mapRecommendedUserRow),
    });
  } catch (error) {
    console.error('Recommended user load error', error);
    return res.status(500).json({ result: 'fail', message: '추천 사용자를 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/search', jwtAuthentication, async (req, res) => {
  const keyword = String(req.query.keyword || '').trim();
  const limit = Math.min(Number(req.query.limit) || 10, 20);
  let connection;

  if (keyword.length < 1) {
    return res.json({ result: 'success', users: [] });
  }

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `
        SELECT * FROM (
          SELECT
            u.USER_ID,
            u.USERNAME,
            u.NICKNAME,
            u.DISCRIMINATOR,
            u.PROFILE_IMAGE_URL,
            (SELECT COUNT(*) FROM POSTS p WHERE p.USER_ID = u.USER_ID AND p.PARENT_POST_ID IS NULL AND p.IS_DELETED = 0) AS POST_COUNT,
            (SELECT COUNT(*) FROM FOLLOWS f WHERE f.FOLLOWING_ID = u.USER_ID) AS FOLLOWER_COUNT,
            CASE WHEN EXISTS (
              SELECT 1 FROM FOLLOWS f
              WHERE f.FOLLOWER_ID = :viewerId AND f.FOLLOWING_ID = u.USER_ID
            ) THEN 1 ELSE 0 END AS FOLLOWED_BY_ME,
            (
              SELECT COUNT(*)
              FROM USER_CATEGORY viewer_category
              JOIN USER_CATEGORY target_category ON target_category.CATEGORY_ID = viewer_category.CATEGORY_ID
              WHERE viewer_category.USER_ID = :viewerId
                AND target_category.USER_ID = u.USER_ID
            ) AS MUTUAL_CATEGORY_COUNT
          FROM USERS u
          WHERE u.USER_ID <> :viewerId
            AND u.ROLE <> 'ADMIN'
            AND (
              LOWER(u.USERNAME) LIKE LOWER(:searchKeyword)
              OR LOWER(u.NICKNAME) LIKE LOWER(:searchKeyword)
            )
            AND NOT EXISTS (
              SELECT 1 FROM USER_BLOCK ub
              WHERE (ub.BLOCKER_ID = :viewerId AND ub.BLOCKED_ID = u.USER_ID)
                 OR (ub.BLOCKER_ID = u.USER_ID AND ub.BLOCKED_ID = :viewerId)
            )
          ORDER BY
            CASE
              WHEN LOWER(u.USERNAME) = LOWER(:exactKeyword) THEN 1
              WHEN LOWER(u.NICKNAME) = LOWER(:exactKeyword) THEN 2
              WHEN LOWER(u.USERNAME) LIKE LOWER(:prefixKeyword) THEN 3
              WHEN LOWER(u.NICKNAME) LIKE LOWER(:prefixKeyword) THEN 4
              ELSE 5
            END,
            FOLLOWER_COUNT DESC,
            POST_COUNT DESC,
            u.CREATED_AT DESC
        )
        WHERE ROWNUM <= :limit
      `,
      {
        viewerId: req.user.userId,
        searchKeyword: '%' + keyword + '%',
        prefixKeyword: keyword + '%',
        exactKeyword: keyword,
        limit,
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({
      result: 'success',
      users: result.rows.map(mapRecommendedUserRow),
    });
  } catch (error) {
    console.error('User search error', error);
    return res.status(500).json({ result: 'fail', message: '사용자 검색 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/me/settings', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `
        SELECT USER_ID, USERNAME, NICKNAME, SPOILER_FILTER
        FROM USERS
        WHERE USER_ID = :userId
      `,
      { userId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '사용자 정보를 찾을 수 없습니다.' });
    }

    const row = result.rows[0];
    return res.json({
      result: 'success',
      settings: {
        username: row.USERNAME,
        nickname: row.NICKNAME,
        spoilerFilter: row.SPOILER_FILTER === 0 ? 0 : 1,
      },
    });
  } catch (error) {
    console.error('User settings load error', error);
    return res.status(500).json({ result: 'fail', message: '설정을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.patch('/me/settings', jwtAuthentication, async (req, res) => {
  const spoilerFilter = Number(req.body.spoilerFilter) === 0 ? 0 : 1;
  let connection;

  try {
    connection = await db.getConnection();

    await connection.execute(
      'UPDATE USERS SET SPOILER_FILTER = :spoilerFilter WHERE USER_ID = :userId',
      { spoilerFilter, userId: req.user.userId }
    );
    await connection.commit();

    return res.json({
      result: 'success',
      message: '콘텐츠 설정이 저장되었습니다.',
      settings: { spoilerFilter },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('User settings update error', error);
    return res.status(500).json({ result: 'fail', message: '설정 저장 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/me/blocks', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `
        SELECT
          u.USER_ID,
          u.USERNAME,
          u.NICKNAME,
          u.DISCRIMINATOR,
          u.PROFILE_IMAGE_URL,
          ub.CREATED_AT
        FROM USER_BLOCK ub
        JOIN USERS u ON u.USER_ID = ub.BLOCKED_ID
        WHERE ub.BLOCKER_ID = :viewerId
          AND u.ROLE <> 'ADMIN'
        ORDER BY ub.CREATED_AT DESC
      `,
      { viewerId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({
      result: 'success',
      users: result.rows.map((row) => ({
        userId: row.USER_ID,
        username: row.USERNAME,
        nickname: row.NICKNAME,
        tag: row.DISCRIMINATOR,
        profileImageUrl: row.PROFILE_IMAGE_URL || '',
        blockedAt: row.CREATED_AT,
      })),
    });
  } catch (error) {
    console.error('Blocked user load error', error);
    return res.status(500).json({ result: 'fail', message: '차단 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.delete('/me/blocks/:username', jwtAuthentication, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  let connection;

  if (!username) {
    return res.status(400).json({ result: 'fail', message: '사용자 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();

    const target = await connection.execute(
      "SELECT USER_ID, USERNAME, NICKNAME, DISCRIMINATOR FROM USERS WHERE USERNAME = :username AND ROLE <> 'ADMIN'",
      { username },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 사용자입니다.' });
    }

    await connection.execute(
      'DELETE FROM USER_BLOCK WHERE BLOCKER_ID = :viewerId AND BLOCKED_ID = :blockedId',
      { viewerId: req.user.userId, blockedId: target.rows[0].USER_ID }
    );
    await connection.commit();

    return res.json({ result: 'success', message: '차단을 해제했습니다.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Blocked user delete error', error);
    return res.status(500).json({ result: 'fail', message: '차단 해제 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});
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

router.patch('/:username', jwtAuthentication, uploadProfileMedia, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const nickname = normalizeNickname(req.body.nickname);
  const bio = normalizeBio(req.body.bio);
  const profileImage = getUploadedFile(req, 'profileImage');
  const bannerImage = getUploadedFile(req, 'bannerImage');
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
      `
        UPDATE USERS
        SET NICKNAME = :nickname,
            BIO = :bio,
            PROFILE_IMAGE_URL = NVL(:profileImageUrl, PROFILE_IMAGE_URL),
            BANNER_IMAGE_URL = NVL(:bannerImageUrl, BANNER_IMAGE_URL)
        WHERE USER_ID = :userId
      `,
      {
        nickname,
        bio,
        profileImageUrl: profileImage ? '/uploads/users/' + profileImage.filename : null,
        bannerImageUrl: bannerImage ? '/uploads/users/' + bannerImage.filename : null,
        userId: profile.userId,
      }
    );

    await insertUserMedia(connection, profile.userId, profileImage, 'PROFILE');
    await insertUserMedia(connection, profile.userId, bannerImage, 'BANNER');
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

    if (String(profile.role || '').toUpperCase() === 'ADMIN') {
      return res.status(403).json({ result: 'fail', message: '관리자 계정은 팔로우할 수 없습니다.' });
    }

    const found = await connection.execute(
      'SELECT FOLLOWER_ID FROM FOLLOWS WHERE FOLLOWER_ID = :viewerId AND FOLLOWING_ID = :targetUserId',
      { viewerId: req.user.userId, targetUserId: profile.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let following;
    let noticeLookup = null;

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
      noticeLookup = await createNotice(connection, {
        receiverId: profile.userId,
        senderId: req.user.userId,
        type: 'FOLLOW',
        targetType: 'USER',
        targetId: req.user.userId,
      });
      following = true;
    }

    await connection.commit();
    await emitNoticeCreated(connection, noticeLookup);

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
        'u.USER_ID, u.USERNAME, u.NICKNAME, u.DISCRIMINATOR, u.PROFILE_IMAGE_URL, ' +
        'CASE WHEN EXISTS (SELECT 1 FROM FOLLOWS viewer_follow WHERE viewer_follow.FOLLOWER_ID = :viewerId AND viewer_follow.FOLLOWING_ID = u.USER_ID) THEN 1 ELSE 0 END AS FOLLOWED_BY_ME ' +
        'FROM FOLLOWS f ' +
        'JOIN USERS u ON ' + joinCondition + ' ' +
        'WHERE ' + ownerCondition + " AND u.ROLE <> 'ADMIN' " +
        'ORDER BY f.CREATED_AT DESC',
      { targetUserId: profile.userId, viewerId: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const users = result.rows.map((row) => ({
      userId: row.USER_ID,
      username: row.USERNAME,
      nickname: row.NICKNAME,
      tag: row.DISCRIMINATOR,
      profileImageUrl: row.PROFILE_IMAGE_URL || '',
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
