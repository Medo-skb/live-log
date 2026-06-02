const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');

const router = express.Router();
const MAX_TAG_COUNT = 10;
const MAX_TITLE_LENGTH = 255;
const MAX_PROGRESS_LENGTH = 100;
const MAX_CONTENT_LENGTH = 4000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const MEDIA_LIMITS = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 30 * 1024 * 1024,
};
const uploadDir = path.join(__dirname, '..', 'uploads', 'posts');

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
      callback(null, safeName);
    },
  }),
  limits: {
    fileSize: MEDIA_LIMITS.VIDEO,
  },
  fileFilter: (_req, file, callback) => {
    if (getMediaType(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('\uc0ac\uc9c4, \ub3d9\uc601\uc0c1 \ud30c\uc77c\ub9cc \uc5c5\ub85c\ub4dc\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.'));
  },
});

function getMediaType(mimetype) {
  if (String(mimetype || '').startsWith('image/')) return 'IMAGE';
  if (String(mimetype || '').startsWith('video/')) return 'VIDEO';
  return '';
}

function deleteUploadedFiles(files) {
  (files || []).forEach((file) => {
    fs.unlink(file.path, (error) => {
      if (error) console.error('Upload cleanup error', error);
    });
  });
}

function deleteStoredMediaFiles(fileUrls) {
  (fileUrls || []).forEach((fileUrl) => {
    if (!String(fileUrl || '').startsWith('/uploads/posts/')) return;

    const filePath = path.join(__dirname, '..', String(fileUrl).replace('/uploads/', 'uploads/'));
    fs.unlink(filePath, (error) => {
      if (error && error.code !== 'ENOENT') console.error('Post media cleanup error', error);
    });
  });
}

function formatFileSize(bytes) {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  if (size < 1024 * 1024) return Math.ceil(size / 1024) + ' KB';

  return (size / 1024 / 1024).toFixed(1) + ' MB';
}

function validateUploadedFiles(files) {
  for (const file of files || []) {
    const mediaType = getMediaType(file.mimetype);
    const limit = MEDIA_LIMITS[mediaType];

    if (!mediaType || !limit) {
      return '\uc0ac\uc9c4, \ub3d9\uc601\uc0c1 \ud30c\uc77c\ub9cc \uc5c5\ub85c\ub4dc\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.';
    }

    if (file.size > limit) {
      const limitMb = Math.floor(limit / 1024 / 1024);
      const label = mediaType === 'IMAGE' ? '\uc0ac\uc9c4' : '\ub3d9\uc601\uc0c1';
      return label + ' \ud30c\uc77c\uc740 ' + limitMb + 'MB\uae4c\uc9c0 \uc5c5\ub85c\ub4dc\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \uc120\ud0dd\ud55c \ud30c\uc77c: ' + file.originalname + ' (' + formatFileSize(file.size) + ')';
    }
  }

  return '';
}

function uploadMedia(req, res, next) {
  upload.array('mediaFiles')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (req.files) deleteUploadedFiles(req.files);

    const message = error instanceof multer.MulterError
      ? '\ucca8\ubd80\ud30c\uc77c \uc6a9\ub7c9\uc744 \ud655\uc778\ud574\uc8fc\uc138\uc694.'
      : error.message;

    res.status(400).json({
      result: 'fail',
      message,
    });
  });
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizePositiveInteger(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeLimit(value) {
  const limit = normalizePositiveInteger(value) || DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function extractTags(content, rawTags) {
  const tagSet = new Set();
  const sourceTags = Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [];

  sourceTags.forEach((tag) => {
    const cleanTag = String(tag || '').replace(/^#/, '').trim();
    if (cleanTag) tagSet.add(cleanTag.slice(0, 100));
  });

  const matches = String(content || '').match(/#[\p{L}\p{N}_-]+/gu) || [];
  matches.forEach((tag) => {
    const cleanTag = tag.replace(/^#/, '').trim();
    if (cleanTag) tagSet.add(cleanTag.slice(0, 100));
  });

  return [...tagSet].slice(0, MAX_TAG_COUNT);
}

function detectSpoiler(content, isSpoiler) {
  if (Number(isSpoiler) === 1 || isSpoiler === true) return 1;

  const spoilerKeywords = ['\uc8fd', '\uc0ac\ub9dd', '\ubc94\uc778', '\uacb0\ub9d0', '\ubc18\uc804', '\uc2a4\ud3ec'];
  return spoilerKeywords.some((keyword) => String(content || '').includes(keyword)) ? 1 : 0;
}

function mapPostRow(row) {
  return {
    postId: row.POST_ID,
    categoryId: row.CATEGORY_ID,
    categoryName: row.CATEGORY_NAME,
    workTitle: row.WORK_TITLE,
    progress: row.PROGRESS,
    content: row.CONTENT,
    isSpoiler: row.IS_SPOILER === 1,
    quotePostId: row.QUOTE_POST_ID,
    createdAt: row.CREATED_AT,
    user: {
      userId: row.USER_ID,
      username: row.USERNAME,
      nickname: row.NICKNAME,
      tag: row.DISCRIMINATOR,
    },
    tags: row.TAGS ? row.TAGS.split(',').filter(Boolean) : [],
    media: row.MEDIA_FILES
      ? row.MEDIA_FILES.split('|').filter(Boolean).map((item) => {
        const [mediaId, mediaType, ...urlParts] = item.split(':');
        return {
          mediaId: Number(mediaId),
          mediaType,
          fileUrl: urlParts.join(':'),
        };
      })
      : [],
    counts: {
      comments: row.COMMENT_COUNT || 0,
      reposts: row.REPOST_COUNT || 0,
      likes: row.LIKE_COUNT || 0,
      bookmarks: row.BOOKMARK_COUNT || 0,
    },
    liked: row.LIKED_BY_ME === 1,
    reposted: row.REPOSTED_BY_ME === 1,
    bookmarked: row.BOOKMARKED_BY_ME === 1,
    quotePost: row.QUOTE_POST_ID ? {
      postId: row.QUOTE_POST_ID,
      categoryId: row.QUOTE_CATEGORY_ID,
      categoryName: row.QUOTE_CATEGORY_NAME,
      workTitle: row.QUOTE_WORK_TITLE,
      progress: row.QUOTE_PROGRESS,
      content: row.QUOTE_CONTENT,
      createdAt: row.QUOTE_CREATED_AT,
      user: {
        userId: row.QUOTE_USER_ID,
        username: row.QUOTE_USERNAME,
        nickname: row.QUOTE_NICKNAME,
      },
    } : null,
  };
}

function getPostSelectSql(whereClause) {
  return `
    SELECT * FROM (
      SELECT
        p.POST_ID,
        p.USER_ID,
        u.USERNAME,
        u.NICKNAME,
        u.DISCRIMINATOR,
        c.CATEGORY_ID,
        c.NAME AS CATEGORY_NAME,
        w.TITLE AS WORK_TITLE,
        p.PROGRESS,
        p.CONTENT,
        p.IS_SPOILER,
        p.QUOTE_POST_ID,
        qp.USER_ID AS QUOTE_USER_ID,
        qu.USERNAME AS QUOTE_USERNAME,
        qu.NICKNAME AS QUOTE_NICKNAME,
        qc.CATEGORY_ID AS QUOTE_CATEGORY_ID,
        qc.NAME AS QUOTE_CATEGORY_NAME,
        qw.TITLE AS QUOTE_WORK_TITLE,
        qp.PROGRESS AS QUOTE_PROGRESS,
        qp.CONTENT AS QUOTE_CONTENT,
        TO_CHAR(qp.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS QUOTE_CREATED_AT,
        TO_CHAR(p.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT,
        (SELECT COUNT(*) FROM POSTS child WHERE child.PARENT_POST_ID = p.POST_ID) AS COMMENT_COUNT,
        (SELECT COUNT(*) FROM REPOST r WHERE r.POST_ID = p.POST_ID) AS REPOST_COUNT,
        (SELECT COUNT(*) FROM POST_LIKE pl WHERE pl.POST_ID = p.POST_ID) AS LIKE_COUNT,
        (SELECT COUNT(*) FROM POST_BOOKMARK pb WHERE pb.POST_ID = p.POST_ID) AS BOOKMARK_COUNT,
        CASE WHEN EXISTS (SELECT 1 FROM POST_LIKE pl WHERE pl.POST_ID = p.POST_ID AND pl.USER_ID = :viewerId) THEN 1 ELSE 0 END AS LIKED_BY_ME,
        CASE WHEN EXISTS (SELECT 1 FROM REPOST r WHERE r.POST_ID = p.POST_ID AND r.USER_ID = :viewerId) THEN 1 ELSE 0 END AS REPOSTED_BY_ME,
        CASE WHEN EXISTS (SELECT 1 FROM POST_BOOKMARK pb WHERE pb.POST_ID = p.POST_ID AND pb.USER_ID = :viewerId) THEN 1 ELSE 0 END AS BOOKMARKED_BY_ME,
        (SELECT LISTAGG(pt.TAG, ',') WITHIN GROUP (ORDER BY pt.TAG) FROM POST_TAG pt WHERE pt.POST_ID = p.POST_ID) AS TAGS,
        (SELECT LISTAGG(pm.MEDIA_ID || ':' || pm.MEDIA_TYPE || ':' || pm.FILE_URL, '|') WITHIN GROUP (ORDER BY pm.ORDER_IDX) FROM POST_MEDIA pm WHERE pm.POST_ID = p.POST_ID) AS MEDIA_FILES
      FROM POSTS p
      JOIN USERS u ON u.USER_ID = p.USER_ID
      JOIN WORKS w ON w.WORK_ID = p.WORK_ID
      JOIN CATEGORY c ON c.CATEGORY_ID = w.CATEGORY_ID
      LEFT JOIN POSTS qp ON qp.POST_ID = p.QUOTE_POST_ID
      LEFT JOIN USERS qu ON qu.USER_ID = qp.USER_ID
      LEFT JOIN WORKS qw ON qw.WORK_ID = qp.WORK_ID
      LEFT JOIN CATEGORY qc ON qc.CATEGORY_ID = qw.CATEGORY_ID
      ${whereClause}
      ORDER BY p.POST_ID DESC
    )
    WHERE ROWNUM <= :fetchLimit
  `;
}

function buildPostFilters({ categoryId, cursor, afterPostId }) {
  const filters = ['p.PARENT_POST_ID IS NULL'];
  const binds = {};

  if (categoryId) {
    filters.push('c.CATEGORY_ID = :categoryId');
    binds.categoryId = categoryId;
  }

  if (afterPostId) {
    filters.push('p.POST_ID > :afterPostId');
    binds.afterPostId = afterPostId;
  } else if (cursor) {
    filters.push('p.POST_ID < :cursor');
    binds.cursor = cursor;
  }

  return {
    binds,
    whereClause: filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '',
  };
}

async function selectPostById(connection, postId, viewerId) {
  const result = await connection.execute(
    getPostSelectSql('WHERE p.POST_ID = :postId'),
    { postId, viewerId, fetchLimit: 1 },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0] ? mapPostRow(result.rows[0]) : null;
}

async function findOrCreateWork(connection, categoryId, title) {
  const found = await connection.execute(
    `
      SELECT WORK_ID
      FROM WORKS
      WHERE CATEGORY_ID = :categoryId AND TITLE = :title
    `,
    { categoryId, title },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  if (found.rows.length > 0) return found.rows[0].WORK_ID;

  try {
    const inserted = await connection.execute(
      `
        INSERT INTO WORKS (CATEGORY_ID, TITLE)
        VALUES (:categoryId, :title)
        RETURNING WORK_ID INTO :workId
      `,
      {
        categoryId,
        title,
        workId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    return inserted.outBinds.workId[0];
  } catch (error) {
    if (error.errorNum !== 1) throw error;

    const duplicated = await connection.execute(
      `
        SELECT WORK_ID
        FROM WORKS
        WHERE CATEGORY_ID = :categoryId AND TITLE = :title
      `,
      { categoryId, title },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (duplicated.rows.length > 0) return duplicated.rows[0].WORK_ID;
    throw error;
  }
}

async function countPostRelation(connection, tableName, postId) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS TOTAL_COUNT FROM ${tableName} WHERE POST_ID = :postId`,
    [postId],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0]?.TOTAL_COUNT || 0;
}

async function postExists(connection, postId) {
  const result = await connection.execute(
    'SELECT POST_ID FROM POSTS WHERE POST_ID = :postId',
    [postId],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows.length > 0;
}

async function togglePostRelation(connection, tableName, userId, postId) {
  const found = await connection.execute(
    `SELECT POST_ID FROM ${tableName} WHERE USER_ID = :userId AND POST_ID = :postId`,
    { userId, postId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  if (found.rows.length > 0) {
    await connection.execute(
      `DELETE FROM ${tableName} WHERE USER_ID = :userId AND POST_ID = :postId`,
      { userId, postId }
    );
    return false;
  }

  await connection.execute(
    `INSERT INTO ${tableName} (USER_ID, POST_ID) VALUES (:userId, :postId)`,
    { userId, postId }
  );
  return true;
}

async function countNewPosts(connection, { categoryId, afterPostId }) {
  if (!afterPostId) return 0;

  const filters = ['p.PARENT_POST_ID IS NULL', 'p.POST_ID > :afterPostId'];
  const binds = { afterPostId };

  if (categoryId) {
    filters.push('c.CATEGORY_ID = :categoryId');
    binds.categoryId = categoryId;
  }

  const result = await connection.execute(
    `
      SELECT COUNT(*) AS NEW_COUNT
      FROM POSTS p
      JOIN WORKS w ON w.WORK_ID = p.WORK_ID
      JOIN CATEGORY c ON c.CATEGORY_ID = w.CATEGORY_ID
      WHERE ${filters.join(' AND ')}
    `,
    binds,
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0]?.NEW_COUNT || 0;
}

router.get('/', jwtAuthentication, async (req, res) => {
  const categoryId = normalizePositiveInteger(req.query.categoryId);
  const cursor = normalizePositiveInteger(req.query.cursor);
  const afterPostId = normalizePositiveInteger(req.query.afterPostId);
  const limit = normalizeLimit(req.query.limit);
  let connection;

  try {
    connection = await db.getConnection();
    const { binds, whereClause } = buildPostFilters({ categoryId, cursor, afterPostId });
    const result = await connection.execute(
      getPostSelectSql(whereClause),
      { ...binds, viewerId: req.user.userId, fetchLimit: limit + 1 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows.slice(0, limit);
    const posts = rows.map(mapPostRow);
    const lastPost = posts[posts.length - 1];
    const newCount = await countNewPosts(connection, { categoryId, afterPostId });

    return res.json({
      result: 'success',
      posts,
      nextCursor: result.rows.length > limit && lastPost ? lastPost.postId : null,
      hasMore: result.rows.length > limit,
      newCount,
    });
  } catch (error) {
    console.error('Post list error', error);
    return res.status(500).json({
      result: 'fail',
      message: '\uac8c\uc2dc\uae00 \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.',
    });
  } finally {
    if (connection) await connection.close();
  }
});

router.post('/', jwtAuthentication, uploadMedia, async (req, res) => {
  const categoryId = normalizePositiveInteger(req.body.categoryId);
  const workTitle = normalizeText(req.body.workTitle, MAX_TITLE_LENGTH);
  const progress = normalizeText(req.body.progress, MAX_PROGRESS_LENGTH);
  let content = normalizeText(req.body.content, MAX_CONTENT_LENGTH);
  const tags = extractTags(content, req.body.tags);
  const isSpoiler = detectSpoiler(content, req.body.isSpoiler);
  const quotePostId = normalizePositiveInteger(req.body.quotePostId);
  const mediaError = validateUploadedFiles(req.files);
  let connection;

  if (mediaError) {
    deleteUploadedFiles(req.files);
    return res.status(400).json({
      result: 'fail',
      message: mediaError,
    });
  }

  const hasUploadedMedia = Array.isArray(req.files) && req.files.length > 0;
  const canCreateMediaOnlyQuote = quotePostId && hasUploadedMedia;

  if (!categoryId || isEmpty(workTitle) || isEmpty(progress) || (!canCreateMediaOnlyQuote && isEmpty(content))) {
    deleteUploadedFiles(req.files);
    return res.status(400).json({
      result: 'fail',
      message: '\uce74\ud14c\uace0\ub9ac, \uc791\ud488\uba85, \uc9c4\ub3c4, \ub0b4\uc6a9\uc744 \ubaa8\ub450 \uc785\ub825\ud574\uc8fc\uc138\uc694.',
    });
  }

  if (canCreateMediaOnlyQuote && isEmpty(content)) {
    content = ' ';
  }

  try {
    connection = await db.getConnection();

    const categoryCheck = await connection.execute(
      'SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_ID = :categoryId',
      [categoryId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (categoryCheck.rows.length === 0) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({
        result: 'fail',
        message: '\uc874\uc7ac\ud558\uc9c0 \uc54a\ub294 \uce74\ud14c\uace0\ub9ac\uc785\ub2c8\ub2e4.',
      });
    }

    if (quotePostId) {
      const quoteCheck = await connection.execute(
        'SELECT POST_ID FROM POSTS WHERE POST_ID = :quotePostId',
        [quotePostId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (quoteCheck.rows.length === 0) {
        deleteUploadedFiles(req.files);
        return res.status(400).json({
          result: 'fail',
          message: '인용할 게시글이 존재하지 않습니다.',
        });
      }
    }

    const workId = await findOrCreateWork(connection, categoryId, workTitle);
    const inserted = await connection.execute(
      `
        INSERT INTO POSTS (
          USER_ID,
          WORK_ID,
          RAW_TITLE,
          PROGRESS,
          CONTENT,
          IS_SPOILER,
          QUOTE_POST_ID
        ) VALUES (
          :userId,
          :workId,
          :rawTitle,
          :progress,
          :content,
          :isSpoiler,
          :quotePostId
        )
        RETURNING POST_ID INTO :postId
      `,
      {
        userId: req.user.userId,
        workId,
        rawTitle: workTitle,
        progress,
        content,
        isSpoiler,
        quotePostId,
        postId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    const postId = inserted.outBinds.postId[0];

    if (tags.length > 0) {
      await connection.executeMany(
        'INSERT INTO POST_TAG (POST_ID, TAG) VALUES (:postId, :tag)',
        tags.map((tag) => ({ postId, tag }))
      );
    }

    if (req.files && req.files.length > 0) {
      await connection.executeMany(
        'INSERT INTO POST_MEDIA (POST_ID, FILE_URL, MEDIA_TYPE, ORDER_IDX) VALUES (:postId, :fileUrl, :mediaType, :orderIdx)',
        req.files.map((file, index) => ({
          postId,
          fileUrl: '/uploads/posts/' + file.filename,
          mediaType: getMediaType(file.mimetype),
          orderIdx: index + 1,
        }))
      );
    }

    await connection.commit();
    const post = await selectPostById(connection, postId, req.user.userId);

    return res.status(201).json({
      result: 'success',
      message: '\uac8c\uc2dc\uae00\uc774 \ub4f1\ub85d\ub418\uc5c8\uc2b5\ub2c8\ub2e4.',
      post,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    deleteUploadedFiles(req.files);
    console.error('Post create error', error);
    return res.status(500).json({
      result: 'fail',
      message: '\uac8c\uc2dc\uae00 \ub4f1\ub85d \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.',
    });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/bookmarks', jwtAuthentication, async (req, res) => {
  const cursor = normalizePositiveInteger(req.query.cursor);
  const limit = normalizeLimit(req.query.limit);
  let connection;

  try {
    connection = await db.getConnection();

    const filters = ['p.PARENT_POST_ID IS NULL'];
    const binds = { viewerId: req.user.userId };

    if (cursor) {
      filters.push('p.POST_ID < :cursor');
      binds.cursor = cursor;
    }

    const result = await connection.execute(
      getPostSelectSql('JOIN POST_BOOKMARK current_bookmark ON current_bookmark.POST_ID = p.POST_ID AND current_bookmark.USER_ID = :viewerId WHERE ' + filters.join(' AND ')),
      { ...binds, fetchLimit: limit + 1 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows.slice(0, limit);
    const posts = rows.map(mapPostRow);
    const lastPost = posts[posts.length - 1];

    return res.json({
      result: 'success',
      posts,
      nextCursor: result.rows.length > limit && lastPost ? lastPost.postId : null,
      hasMore: result.rows.length > limit,
    });
  } catch (error) {
    console.error('Bookmark list error', error);
    return res.status(500).json({ result: 'fail', message: '북마크 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/:postId', jwtAuthentication, async (req, res) => {
  const postId = normalizePositiveInteger(req.params.postId);
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '게시글 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();
    const post = await selectPostById(connection, postId, req.user.userId);

    if (!post) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 게시글입니다.' });
    }

    return res.json({ result: 'success', post });
  } catch (error) {
    console.error('Post detail error', error);
    return res.status(500).json({ result: 'fail', message: '게시글을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/:postId/comments', jwtAuthentication, async (req, res) => {
  const parentPostId = normalizePositiveInteger(req.params.postId);
  const cursor = normalizePositiveInteger(req.query.cursor);
  const limit = normalizeLimit(req.query.limit);
  let connection;

  if (!parentPostId) {
    return res.status(400).json({ result: 'fail', message: '게시글 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();

    const filters = ['p.PARENT_POST_ID = :parentPostId'];
    const binds = { parentPostId };

    if (cursor) {
      filters.push('p.POST_ID < :cursor');
      binds.cursor = cursor;
    }

    const result = await connection.execute(
      getPostSelectSql('WHERE ' + filters.join(' AND ')),
      { ...binds, viewerId: req.user.userId, fetchLimit: limit + 1 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows.slice(0, limit);
    const comments = rows.map(mapPostRow);
    const lastComment = comments[comments.length - 1];

    return res.json({
      result: 'success',
      comments,
      nextCursor: result.rows.length > limit && lastComment ? lastComment.postId : null,
      hasMore: result.rows.length > limit,
    });
  } catch (error) {
    console.error('Comment list error', error);
    return res.status(500).json({ result: 'fail', message: '댓글 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.post('/:postId/comments', jwtAuthentication, async (req, res) => {
  const parentPostId = normalizePositiveInteger(req.params.postId);
  const content = normalizeText(req.body.content, MAX_CONTENT_LENGTH);
  const isSpoiler = detectSpoiler(content, req.body.isSpoiler);
  const tags = extractTags(content, req.body.tags);
  let connection;

  if (!parentPostId || isEmpty(content)) {
    return res.status(400).json({ result: 'fail', message: '댓글 내용을 입력해주세요.' });
  }

  try {
    connection = await db.getConnection();

    const parentResult = await connection.execute(
      'SELECT POST_ID, WORK_ID, PROGRESS FROM POSTS WHERE POST_ID = :parentPostId',
      [parentPostId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (parentResult.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 게시글입니다.' });
    }

    const parentPost = parentResult.rows[0];
    const inserted = await connection.execute(
      `
        INSERT INTO POSTS (
          USER_ID,
          WORK_ID,
          RAW_TITLE,
          PROGRESS,
          CONTENT,
          IS_SPOILER,
          PARENT_POST_ID
        ) VALUES (
          :userId,
          :workId,
          NULL,
          :progress,
          :content,
          :isSpoiler,
          :parentPostId
        )
        RETURNING POST_ID INTO :postId
      `,
      {
        userId: req.user.userId,
        workId: parentPost.WORK_ID,
        progress: parentPost.PROGRESS,
        content,
        isSpoiler,
        parentPostId,
        postId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    const postId = inserted.outBinds.postId[0];

    if (tags.length > 0) {
      await connection.executeMany(
        'INSERT INTO POST_TAG (POST_ID, TAG) VALUES (:postId, :tag)',
        tags.map((tag) => ({ postId, tag }))
      );
    }

    await connection.commit();
    const comment = await selectPostById(connection, postId, req.user.userId);

    return res.status(201).json({ result: 'success', message: '댓글이 등록되었습니다.', comment });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Comment create error', error);
    return res.status(500).json({ result: 'fail', message: '댓글 등록 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

async function handleRelationToggle(req, res, tableName, stateKey, countKey) {
  const postId = normalizePositiveInteger(req.params.postId);
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '게시글 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();

    if (!(await postExists(connection, postId))) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 게시글입니다.' });
    }

    const enabled = await togglePostRelation(connection, tableName, req.user.userId, postId);
    const count = await countPostRelation(connection, tableName, postId);
    await connection.commit();

    return res.json({
      result: 'success',
      [stateKey]: enabled,
      count,
      counts: { [countKey]: count },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Post relation toggle error', error);
    return res.status(500).json({ result: 'fail', message: '요청 처리 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
}

router.post('/:postId/likes', jwtAuthentication, (req, res) => handleRelationToggle(req, res, 'POST_LIKE', 'liked', 'likes'));
router.post('/:postId/reposts', jwtAuthentication, (req, res) => handleRelationToggle(req, res, 'REPOST', 'reposted', 'reposts'));
router.post('/:postId/bookmarks', jwtAuthentication, (req, res) => handleRelationToggle(req, res, 'POST_BOOKMARK', 'bookmarked', 'bookmarks'));

router.patch('/:postId', jwtAuthentication, async (req, res) => {
  const postId = normalizePositiveInteger(req.params.postId);
  const categoryId = normalizePositiveInteger(req.body.categoryId);
  const workTitle = normalizeText(req.body.workTitle, MAX_TITLE_LENGTH);
  const progress = normalizeText(req.body.progress, MAX_PROGRESS_LENGTH);
  const content = normalizeText(req.body.content, MAX_CONTENT_LENGTH);
  const tags = extractTags(content, req.body.tags);
  const isSpoiler = detectSpoiler(content, req.body.isSpoiler);
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '\uac8c\uc2dc\uae00 \uc815\ubcf4\uac00 \uc62c\ubc14\ub974\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.' });
  }

  if (!categoryId || isEmpty(workTitle) || isEmpty(progress) || isEmpty(content)) {
    return res.status(400).json({ result: 'fail', message: '\uce74\ud14c\uace0\ub9ac, \uc791\ud488\uba85, \uc9c4\ub3c4, \ub0b4\uc6a9\uc744 \ubaa8\ub450 \uc785\ub825\ud574\uc8fc\uc138\uc694.' });
  }

  try {
    connection = await db.getConnection();

    const postCheck = await connection.execute(
      'SELECT USER_ID FROM POSTS WHERE POST_ID = :postId',
      [postId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '\uc874\uc7ac\ud558\uc9c0 \uc54a\ub294 \uac8c\uc2dc\uae00\uc785\ub2c8\ub2e4.' });
    }

    if (postCheck.rows[0].USER_ID !== req.user.userId) {
      return res.status(403).json({ result: 'fail', message: '\ubcf8\uc778\uc774 \uc791\uc131\ud55c \uac8c\uc2dc\uae00\ub9cc \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.' });
    }

    const categoryCheck = await connection.execute(
      'SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_ID = :categoryId',
      [categoryId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ result: 'fail', message: '\uc874\uc7ac\ud558\uc9c0 \uc54a\ub294 \uce74\ud14c\uace0\ub9ac\uc785\ub2c8\ub2e4.' });
    }

    const workId = await findOrCreateWork(connection, categoryId, workTitle);

    await connection.execute(
      `
        UPDATE POSTS
        SET WORK_ID = :workId,
            RAW_TITLE = :rawTitle,
            PROGRESS = :progress,
            CONTENT = :content,
            IS_SPOILER = :isSpoiler
        WHERE POST_ID = :postId
      `,
      {
        workId,
        rawTitle: workTitle,
        progress,
        content,
        isSpoiler,
        postId,
      }
    );

    await connection.execute('DELETE FROM POST_TAG WHERE POST_ID = :postId', [postId]);

    if (tags.length > 0) {
      await connection.executeMany(
        'INSERT INTO POST_TAG (POST_ID, TAG) VALUES (:postId, :tag)',
        tags.map((tag) => ({ postId, tag }))
      );
    }

    await connection.commit();
    const post = await selectPostById(connection, postId, req.user.userId);

    return res.json({ result: 'success', message: '\uac8c\uc2dc\uae00\uc774 \uc218\uc815\ub418\uc5c8\uc2b5\ub2c8\ub2e4.', post });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Post update error', error);
    return res.status(500).json({ result: 'fail', message: '\uac8c\uc2dc\uae00 \uc218\uc815 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.delete('/:postId', jwtAuthentication, async (req, res) => {
  const postId = normalizePositiveInteger(req.params.postId);
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '\uac8c\uc2dc\uae00 \uc815\ubcf4\uac00 \uc62c\ubc14\ub974\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.' });
  }

  try {
    connection = await db.getConnection();

    const postCheck = await connection.execute(
      'SELECT USER_ID FROM POSTS WHERE POST_ID = :postId',
      [postId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '\uc874\uc7ac\ud558\uc9c0 \uc54a\ub294 \uac8c\uc2dc\uae00\uc785\ub2c8\ub2e4.' });
    }

    if (postCheck.rows[0].USER_ID !== req.user.userId) {
      return res.status(403).json({ result: 'fail', message: '\ubcf8\uc778\uc774 \uc791\uc131\ud55c \uac8c\uc2dc\uae00\ub9cc \uc0ad\uc81c\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.' });
    }

    const mediaResult = await connection.execute(
      'SELECT FILE_URL FROM POST_MEDIA WHERE POST_ID = :postId',
      [postId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const fileUrls = mediaResult.rows.map((row) => row.FILE_URL);

    await connection.execute('DELETE FROM POSTS WHERE POST_ID = :postId', [postId]);
    await connection.commit();
    deleteStoredMediaFiles(fileUrls);

    return res.json({ result: 'success', message: '\uac8c\uc2dc\uae00\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Post delete error', error);
    return res.status(500).json({ result: 'fail', message: '\uac8c\uc2dc\uae00 \uc0ad\uc81c \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.' });
  } finally {
    if (connection) await connection.close();
  }
});
module.exports = router;

