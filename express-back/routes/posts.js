const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');
const { emitNoticeCreated } = require('../services/noticeSocket');
const { analyzePostContent } = require('../services/aiAnalysis');

const router = express.Router();
const MAX_TAG_COUNT = 10;
const MAX_TITLE_LENGTH = 255;
const MAX_PROGRESS_LENGTH = 100;
const MAX_CONTENT_LENGTH = 4000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const POPULAR_POST_MIN_SCORE = 3;
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
      const originalName = normalizeUploadOriginalName(file.originalname || '');
      const ext = path.extname(originalName).toLowerCase();
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

    callback(new Error('사진, 동영상 파일만 업로드할 수 있습니다.'));
  },
});

function getMediaType(mimetype) {
  if (String(mimetype || '').startsWith('image/')) return 'IMAGE';
  if (String(mimetype || '').startsWith('video/')) return 'VIDEO';
  return '';
}

function normalizeUploadOriginalName(originalName) {
  const safeBaseName = path.basename(String(originalName || 'file')) || 'file';
  const looksLikeLatin1Mojibake = /[-ÿ]/.test(safeBaseName);

  if (!looksLikeLatin1Mojibake) return safeBaseName;

  const decodedName = Buffer.from(safeBaseName, 'latin1').toString('utf8');
  return decodedName && !decodedName.includes('�') ? decodedName : safeBaseName;
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
      return '사진, 동영상 파일만 업로드할 수 있습니다.';
    }

    if (file.size > limit) {
      const limitMb = Math.floor(limit / 1024 / 1024);
      const label = mediaType === 'IMAGE' ? '사진' : '동영상';
      return label + ' 파일은 ' + limitMb + 'MB까지 업로드할 수 있습니다. 선택한 파일: ' + normalizeUploadOriginalName(file.originalname) + ' (' + formatFileSize(file.size) + ')';
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
      ? '첨부파일 용량을 확인해주세요.'
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

function mergeTags(...tagGroups) {
  const tagSet = new Map();

  tagGroups.flat().forEach((tag) => {
    const cleanTag = String(tag || '').replace(/^#/, '').trim().slice(0, 100);
    const key = cleanTag.toLowerCase();
    if (cleanTag && !tagSet.has(key)) tagSet.set(key, cleanTag);
  });

  return [...tagSet.values()].slice(0, MAX_TAG_COUNT);
}

async function saveAiAnalysisLog(connection, postId, analysis) {
  if (!connection || !postId || !analysis) return;

  try {
    await connection.execute(
      `
        INSERT INTO AI_ANALYSIS_LOG (
          POST_ID,
          IS_SPOILER,
          CONFIDENCE,
          RECOMMENDED_TAGS,
          MODEL_NAME
        ) VALUES (
          :postId,
          :isSpoiler,
          :confidence,
          :recommendedTags,
          :modelName
        )
      `,
      {
        postId,
        isSpoiler: analysis.isSpoiler ? 1 : 0,
        confidence: Number(analysis.confidence) || 0,
        recommendedTags: mergeTags(analysis.tags).join(',').slice(0, 500),
        modelName: String((analysis.provider || 'ai') + ':' + (analysis.model || 'unknown')).slice(0, 100),
      }
    );
  } catch (error) {
    console.error('AI analysis log save error', error);
  }
}

function detectSpoiler(content, isSpoiler) {
  if (Number(isSpoiler) === 1 || isSpoiler === true) return 1;

  const spoilerKeywords = ['죽', '사망', '범인', '결말', '반전', '스포'];
  return spoilerKeywords.some((keyword) => String(content || '').includes(keyword)) ? 1 : 0;
}

function parseMediaFiles(value) {
  return value
    ? value.split('|').filter(Boolean).map((item) => {
      const [mediaId, mediaType, ...urlParts] = item.split(':');
      return { mediaId: Number(mediaId), mediaType, fileUrl: urlParts.join(':') };
    })
    : [];
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
      profileImageUrl: row.PROFILE_IMAGE_URL || '',
    },
    tags: row.TAGS ? row.TAGS.split(',').filter(Boolean) : [],
    media: parseMediaFiles(row.MEDIA_FILES),
    counts: {
      comments: row.COMMENT_COUNT || 0,
      reposts: row.REPOST_COUNT || 0,
      likes: row.LIKE_COUNT || 0,
      bookmarks: row.BOOKMARK_COUNT || 0,
    },
    timelineId: row.TIMELINE_ID || 'post-' + row.POST_ID,
    timelineAt: row.TIMELINE_AT || row.CREATED_AT,
    repostedBy: row.REPOST_USER_ID ? {
      userId: row.REPOST_USER_ID,
      username: row.REPOST_USERNAME,
      nickname: row.REPOST_NICKNAME,
    } : null,
    liked: row.LIKED_BY_ME === 1,
    reposted: row.REPOSTED_BY_ME === 1,
    bookmarked: row.BOOKMARKED_BY_ME === 1,
    quotePost: row.QUOTE_POST_ID && row.QUOTE_USER_ID ? {
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
        profileImageUrl: row.QUOTE_PROFILE_IMAGE_URL || '',
      },
      media: parseMediaFiles(row.QUOTE_MEDIA_FILES),
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
        u.PROFILE_IMAGE_URL,
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
        qu.PROFILE_IMAGE_URL AS QUOTE_PROFILE_IMAGE_URL,
        qc.CATEGORY_ID AS QUOTE_CATEGORY_ID,
        qc.NAME AS QUOTE_CATEGORY_NAME,
        qw.TITLE AS QUOTE_WORK_TITLE,
        qp.PROGRESS AS QUOTE_PROGRESS,
        qp.CONTENT AS QUOTE_CONTENT,
        TO_CHAR(qp.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS QUOTE_CREATED_AT,
        (SELECT LISTAGG(qpm.MEDIA_ID || ':' || qpm.MEDIA_TYPE || ':' || qpm.FILE_PATH, '|') WITHIN GROUP (ORDER BY qpm.ORDER_IDX) FROM POST_MEDIA qpm WHERE qpm.POST_ID = qp.POST_ID) AS QUOTE_MEDIA_FILES,
        TO_CHAR(p.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT,
        'post-' || p.POST_ID AS TIMELINE_ID,
        TO_CHAR(p.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS TIMELINE_AT,
        NULL AS REPOST_USER_ID,
        NULL AS REPOST_USERNAME,
        NULL AS REPOST_NICKNAME,
        (SELECT COUNT(*) FROM POSTS child WHERE child.PARENT_POST_ID = p.POST_ID AND child.IS_DELETED = 0) AS COMMENT_COUNT,
        (SELECT COUNT(*) FROM REPOST r WHERE r.POST_ID = p.POST_ID) AS REPOST_COUNT,
        (SELECT COUNT(*) FROM POST_LIKE pl WHERE pl.POST_ID = p.POST_ID) AS LIKE_COUNT,
        (SELECT COUNT(*) FROM POST_BOOKMARK pb WHERE pb.POST_ID = p.POST_ID) AS BOOKMARK_COUNT,
        CASE WHEN EXISTS (SELECT 1 FROM POST_LIKE pl WHERE pl.POST_ID = p.POST_ID AND pl.USER_ID = :viewerId) THEN 1 ELSE 0 END AS LIKED_BY_ME,
        CASE WHEN EXISTS (SELECT 1 FROM REPOST r WHERE r.POST_ID = p.POST_ID AND r.USER_ID = :viewerId) THEN 1 ELSE 0 END AS REPOSTED_BY_ME,
        CASE WHEN EXISTS (SELECT 1 FROM POST_BOOKMARK pb WHERE pb.POST_ID = p.POST_ID AND pb.USER_ID = :viewerId) THEN 1 ELSE 0 END AS BOOKMARKED_BY_ME,
        (SELECT LISTAGG(pt.TAG, ',') WITHIN GROUP (ORDER BY pt.TAG) FROM POST_TAG pt WHERE pt.POST_ID = p.POST_ID) AS TAGS,
        (SELECT LISTAGG(pm.MEDIA_ID || ':' || pm.MEDIA_TYPE || ':' || pm.FILE_PATH, '|') WITHIN GROUP (ORDER BY pm.ORDER_IDX) FROM POST_MEDIA pm WHERE pm.POST_ID = p.POST_ID) AS MEDIA_FILES
      FROM POSTS p
      JOIN USERS u ON u.USER_ID = p.USER_ID
      JOIN WORKS w ON w.WORK_ID = p.WORK_ID
      JOIN CATEGORY c ON c.CATEGORY_ID = w.CATEGORY_ID
      LEFT JOIN POSTS qp ON qp.POST_ID = p.QUOTE_POST_ID AND qp.IS_DELETED = 0
      LEFT JOIN USERS qu ON qu.USER_ID = qp.USER_ID
      LEFT JOIN WORKS qw ON qw.WORK_ID = qp.WORK_ID
      LEFT JOIN CATEGORY qc ON qc.CATEGORY_ID = qw.CATEGORY_ID
      ${whereClause}
      ORDER BY p.POST_ID DESC
    )
    WHERE ROWNUM <= :fetchLimit
  `;
}

function buildPostFilters({ categoryId, cursor, afterPostId, username, search, viewerId }) {
  const filters = ['p.PARENT_POST_ID IS NULL', 'p.IS_DELETED = 0'];
  const binds = {};

  if (!username && !search && viewerId) {
    filters.push(`(
      p.USER_ID = :postNetworkViewerId
      OR EXISTS (
        SELECT 1 FROM FOLLOWS viewer_following
        WHERE viewer_following.FOLLOWER_ID = :postNetworkViewerId
          AND viewer_following.FOLLOWING_ID = p.USER_ID
      )
      OR (
        (SELECT COUNT(*) FROM POST_LIKE popular_like WHERE popular_like.POST_ID = p.POST_ID)
        + (SELECT COUNT(*) FROM REPOST popular_repost WHERE popular_repost.POST_ID = p.POST_ID)
        + (SELECT COUNT(*) FROM POSTS popular_comment WHERE popular_comment.PARENT_POST_ID = p.POST_ID AND popular_comment.IS_DELETED = 0)
      ) >= :popularPostMinScore
    )`);
    binds.postNetworkViewerId = viewerId;
    binds.popularPostMinScore = POPULAR_POST_MIN_SCORE;
  }

  if (categoryId) {
    filters.push('c.CATEGORY_ID = :categoryId');
    binds.categoryId = categoryId;
  }

  if (username) {
    filters.push('u.USERNAME = :username');
    binds.username = username;
  }

  if (search) {
    const normalizedSearch = search.toLowerCase();

    if (normalizedSearch.startsWith('#')) {
      filters.push(`EXISTS (
        SELECT 1 FROM POST_TAG pt
        WHERE pt.POST_ID = p.POST_ID AND LOWER(pt.TAG) = :tagSearch
      )`);
      binds.tagSearch = normalizedSearch.replace(/^#/, '').trim();
    } else {
      filters.push(`(
        LOWER(w.TITLE) LIKE :searchText
        OR LOWER(w.ALIAS) LIKE :searchText
        OR LOWER(u.USERNAME) LIKE :searchText
        OR LOWER(u.NICKNAME) LIKE :searchText
        OR LOWER(p.CONTENT) LIKE :searchText
        OR EXISTS (
          SELECT 1 FROM POST_TAG pt
          WHERE pt.POST_ID = p.POST_ID AND LOWER(pt.TAG) LIKE :searchText
        )
      )`);
      binds.searchText = '%' + normalizedSearch + '%';
    }
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
    getPostSelectSql('WHERE p.POST_ID = :postId AND p.IS_DELETED = 0'),
    { postId, viewerId, fetchLimit: 1 },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0] ? mapPostRow(result.rows[0]) : null;
}


function getRepostSelectSql(whereClause) {
  return `
    SELECT * FROM (
      SELECT
        p.POST_ID,
        p.USER_ID,
        u.USERNAME,
        u.NICKNAME,
        u.DISCRIMINATOR,
        u.PROFILE_IMAGE_URL,
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
        qu.PROFILE_IMAGE_URL AS QUOTE_PROFILE_IMAGE_URL,
        qc.CATEGORY_ID AS QUOTE_CATEGORY_ID,
        qc.NAME AS QUOTE_CATEGORY_NAME,
        qw.TITLE AS QUOTE_WORK_TITLE,
        qp.PROGRESS AS QUOTE_PROGRESS,
        qp.CONTENT AS QUOTE_CONTENT,
        TO_CHAR(qp.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS QUOTE_CREATED_AT,
        (SELECT LISTAGG(qpm.MEDIA_ID || ':' || qpm.MEDIA_TYPE || ':' || qpm.FILE_PATH, '|') WITHIN GROUP (ORDER BY qpm.ORDER_IDX) FROM POST_MEDIA qpm WHERE qpm.POST_ID = qp.POST_ID) AS QUOTE_MEDIA_FILES,
        TO_CHAR(p.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT,
        'repost-' || r.REPOST_ID AS TIMELINE_ID,
        TO_CHAR(r.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS TIMELINE_AT,
        ru.USER_ID AS REPOST_USER_ID,
        ru.USERNAME AS REPOST_USERNAME,
        ru.NICKNAME AS REPOST_NICKNAME,
        (SELECT COUNT(*) FROM POSTS child WHERE child.PARENT_POST_ID = p.POST_ID AND child.IS_DELETED = 0) AS COMMENT_COUNT,
        (SELECT COUNT(*) FROM REPOST count_repost WHERE count_repost.POST_ID = p.POST_ID) AS REPOST_COUNT,
        (SELECT COUNT(*) FROM POST_LIKE pl WHERE pl.POST_ID = p.POST_ID) AS LIKE_COUNT,
        (SELECT COUNT(*) FROM POST_BOOKMARK pb WHERE pb.POST_ID = p.POST_ID) AS BOOKMARK_COUNT,
        CASE WHEN EXISTS (SELECT 1 FROM POST_LIKE pl WHERE pl.POST_ID = p.POST_ID AND pl.USER_ID = :viewerId) THEN 1 ELSE 0 END AS LIKED_BY_ME,
        CASE WHEN EXISTS (SELECT 1 FROM REPOST viewer_repost WHERE viewer_repost.POST_ID = p.POST_ID AND viewer_repost.USER_ID = :viewerId) THEN 1 ELSE 0 END AS REPOSTED_BY_ME,
        CASE WHEN EXISTS (SELECT 1 FROM POST_BOOKMARK pb WHERE pb.POST_ID = p.POST_ID AND pb.USER_ID = :viewerId) THEN 1 ELSE 0 END AS BOOKMARKED_BY_ME,
        (SELECT LISTAGG(pt.TAG, ',') WITHIN GROUP (ORDER BY pt.TAG) FROM POST_TAG pt WHERE pt.POST_ID = p.POST_ID) AS TAGS,
        (SELECT LISTAGG(pm.MEDIA_ID || ':' || pm.MEDIA_TYPE || ':' || pm.FILE_PATH, '|') WITHIN GROUP (ORDER BY pm.ORDER_IDX) FROM POST_MEDIA pm WHERE pm.POST_ID = p.POST_ID) AS MEDIA_FILES
      FROM REPOST r
      JOIN POSTS p ON p.POST_ID = r.POST_ID
      JOIN USERS ru ON ru.USER_ID = r.USER_ID
      JOIN USERS u ON u.USER_ID = p.USER_ID
      JOIN WORKS w ON w.WORK_ID = p.WORK_ID
      JOIN CATEGORY c ON c.CATEGORY_ID = w.CATEGORY_ID
      LEFT JOIN POSTS qp ON qp.POST_ID = p.QUOTE_POST_ID AND qp.IS_DELETED = 0
      LEFT JOIN USERS qu ON qu.USER_ID = qp.USER_ID
      LEFT JOIN WORKS qw ON qw.WORK_ID = qp.WORK_ID
      LEFT JOIN CATEGORY qc ON qc.CATEGORY_ID = qw.CATEGORY_ID
      ${whereClause}
      ORDER BY r.REPOST_ID DESC
    )
    WHERE ROWNUM <= :fetchLimit
  `;
}

function buildRepostFilters({ categoryId, cursor, afterPostId, username, search, viewerId }) {
  const filters = ['p.PARENT_POST_ID IS NULL', 'p.IS_DELETED = 0'];
  const binds = {};

  if (!username && !search && viewerId) {
    filters.push(`(
      r.USER_ID = :networkViewerId
      OR EXISTS (
        SELECT 1 FROM FOLLOWS viewer_following
        WHERE viewer_following.FOLLOWER_ID = :networkViewerId
          AND viewer_following.FOLLOWING_ID = r.USER_ID
      )
      OR EXISTS (
        SELECT 1 FROM FOLLOWS viewer_follower
        WHERE viewer_follower.FOLLOWER_ID = r.USER_ID
          AND viewer_follower.FOLLOWING_ID = :networkViewerId
      )
    )`);
    binds.networkViewerId = viewerId;
  }

  if (categoryId) {
    filters.push('c.CATEGORY_ID = :categoryId');
    binds.categoryId = categoryId;
  }

  if (username) {
    filters.push('ru.USERNAME = :username');
    binds.username = username;
  }

  if (search) {
    const normalizedSearch = search.toLowerCase();

    if (normalizedSearch.startsWith('#')) {
      filters.push(`EXISTS (
        SELECT 1 FROM POST_TAG pt
        WHERE pt.POST_ID = p.POST_ID AND LOWER(pt.TAG) = :tagSearch
      )`);
      binds.tagSearch = normalizedSearch.replace(/^#/, '').trim();
    } else {
      filters.push(`(
        LOWER(w.TITLE) LIKE :searchText
        OR LOWER(w.ALIAS) LIKE :searchText
        OR LOWER(u.USERNAME) LIKE :searchText
        OR LOWER(u.NICKNAME) LIKE :searchText
        OR LOWER(ru.USERNAME) LIKE :searchText
        OR LOWER(ru.NICKNAME) LIKE :searchText
        OR LOWER(p.CONTENT) LIKE :searchText
        OR EXISTS (
          SELECT 1 FROM POST_TAG pt
          WHERE pt.POST_ID = p.POST_ID AND LOWER(pt.TAG) LIKE :searchText
        )
      )`);
      binds.searchText = '%' + normalizedSearch + '%';
    }
  }

  if (afterPostId) {
    filters.push('r.REPOST_ID > :afterPostId');
    binds.afterPostId = afterPostId;
  } else if (cursor) {
    filters.push('r.REPOST_ID < :cursor');
    binds.cursor = cursor;
  }

  return {
    binds,
    whereClause: filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '',
  };
}

function parseTimelineTime(value) {
  const date = new Date(String(value || '').replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getTimelineSortNumber(post) {
  return Number(String(post.timelineId || '').split('-')[1]) || Number(post.postId) || 0;
}

function sortTimelinePosts(posts) {
  return posts.sort((a, b) => {
    const timeDiff = parseTimelineTime(b.timelineAt) - parseTimelineTime(a.timelineAt);
    if (timeDiff !== 0) return timeDiff;
    return getTimelineSortNumber(b) - getTimelineSortNumber(a);
  });
}

async function createNotice(connection, { receiverId, senderId, type, targetType, targetId, allowDuplicate = false }) {
  if (!receiverId || !senderId || Number(receiverId) === Number(senderId)) return null;

  const noticeLookup = { receiverId, senderId, type, targetType, targetId };

  if (allowDuplicate) {
    const inserted = await connection.execute(
      `
        INSERT INTO NOTICE (RECEIVER_ID, SENDER_ID, NOTIFICATION_TYPE, TARGET_TYPE, TARGET_ID)
        VALUES (:receiverId, :senderId, :type, :targetType, :targetId)
      `,
      { receiverId, senderId, type, targetType, targetId }
    );

    return inserted.rowsAffected > 0 ? noticeLookup : null;
  }

  const inserted = await connection.execute(
    `
      INSERT INTO NOTICE (RECEIVER_ID, SENDER_ID, NOTIFICATION_TYPE, TARGET_TYPE, TARGET_ID)
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

  return inserted.rowsAffected > 0 ? noticeLookup : null;
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

async function countPostReposts(connection, postId) {
  return countPostRelation(connection, 'REPOST', postId);
}

async function findPostOwnerId(connection, postId) {
  const result = await connection.execute(
    'SELECT USER_ID FROM POSTS WHERE POST_ID = :postId AND IS_DELETED = 0',
    [postId],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0]?.USER_ID || null;
}

async function postExists(connection, postId) {
  const result = await connection.execute(
    'SELECT POST_ID FROM POSTS WHERE POST_ID = :postId AND IS_DELETED = 0',
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

async function countNewPosts(connection, { categoryId, afterPostId, username, search, viewerId }) {
  if (!afterPostId) return 0;

  // 목록 조회와 동일한 필터 빌더를 사용하여 권한/가시성이 있는 포스트만 카운트합니다.
  const { binds, whereClause } = buildPostFilters({ categoryId, afterPostId, username, search, viewerId });

  const result = await connection.execute(
    `
      SELECT COUNT(*) AS NEW_COUNT
      FROM POSTS p
      JOIN USERS u ON u.USER_ID = p.USER_ID
      JOIN WORKS w ON w.WORK_ID = p.WORK_ID
      JOIN CATEGORY c ON c.CATEGORY_ID = w.CATEGORY_ID
      ${whereClause}
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
  const username = normalizeText(req.query.username, 50);
  const search = normalizeText(req.query.search, 100);
  let connection;

  try {
    connection = await db.getConnection();
    const { binds, whereClause } = buildPostFilters({ categoryId, cursor, afterPostId, username, search, viewerId: req.user.userId });
    const repostFilter = buildRepostFilters({ categoryId, cursor, afterPostId, username, search, viewerId: req.user.userId });
    const [postResult, repostResult] = await Promise.all([
      connection.execute(
        getPostSelectSql(whereClause),
        { ...binds, viewerId: req.user.userId, fetchLimit: limit + 1 },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      ),
      connection.execute(
        getRepostSelectSql(repostFilter.whereClause),
        { ...repostFilter.binds, viewerId: req.user.userId, fetchLimit: limit + 1 },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      ),
    ]);

    const timelinePosts = sortTimelinePosts([
      ...postResult.rows.map(mapPostRow),
      ...repostResult.rows.map(mapPostRow),
    ]);
    const posts = timelinePosts.slice(0, limit);
    const lastPost = posts[posts.length - 1];
    const hasMore = timelinePosts.length > limit || postResult.rows.length > limit || repostResult.rows.length > limit;
    const newCount = await countNewPosts(connection, { categoryId, afterPostId, username, search, viewerId: req.user.userId });

    return res.json({
      result: 'success',
      posts,
      nextCursor: hasMore && lastPost ? getTimelineSortNumber(lastPost) : null,
      hasMore,
      newCount,
    });
  } catch (error) {
    console.error('Post list error', error);
    return res.status(500).json({
      result: 'fail',
      message: '게시글 목록을 불러오는 중 오류가 발생했습니다.',
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
  let tags = [];
  let isSpoiler = 0;
  let aiAnalysis = null;
  const quotePostId = normalizePositiveInteger(req.body.quotePostId);
  const mediaError = validateUploadedFiles(req.files);
  let connection;
  let quotePostOwnerId = null;

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
      message: '카테고리, 작품명, 진도, 내용을 모두 입력해주세요.',
    });
  }

  if (canCreateMediaOnlyQuote && isEmpty(content)) {
    content = ' ';
  }

  try {
    connection = await db.getConnection();

    const categoryCheck = await connection.execute(
      'SELECT CATEGORY_ID, NAME FROM CATEGORY WHERE CATEGORY_ID = :categoryId',
      [categoryId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (categoryCheck.rows.length === 0) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({
        result: 'fail',
        message: '존재하지 않는 카테고리입니다.',
      });
    }

    if (quotePostId) {
      const quoteCheck = await connection.execute(
        'SELECT POST_ID, USER_ID FROM POSTS WHERE POST_ID = :quotePostId AND IS_DELETED = 0',
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
    
      quotePostOwnerId = quoteCheck.rows[0].USER_ID;
    }

    const categoryName = categoryCheck.rows[0].NAME || '';
    aiAnalysis = await analyzePostContent({ categoryName, workTitle, progress, content });
    isSpoiler = aiAnalysis.isSpoiler ? 1 : 0;
    tags = extractTags(content, req.body.tags);

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
        `
          INSERT INTO POST_MEDIA (
            POST_ID,
            FILE_PATH,
            FILE_NAME,
            ORIGIN_NAME,
            FILE_SIZE,
            FILE_EXT,
            MIME_TYPE,
            MEDIA_TYPE,
            ORDER_IDX
          ) VALUES (
            :postId,
            :filePath,
            :fileName,
            :originName,
            :fileSize,
            :fileExt,
            :mimeType,
            :mediaType,
            :orderIdx
          )
        `,
        req.files.map((file, index) => {
          const originalName = normalizeUploadOriginalName(file.originalname || file.filename || '');
          const fileExt = path.extname(originalName || file.filename || '').replace(/^\./, '').toLowerCase().slice(0, 20);

          return {
            postId,
            filePath: '/uploads/posts/' + file.filename,
            fileName: String(file.filename || '').slice(0, 200),
            originName: String(originalName || file.filename || '').slice(0, 200),
            fileSize: Number(file.size) || 0,
            fileExt: fileExt || 'unknown',
            mimeType: String(file.mimetype || '').slice(0, 100),
            mediaType: getMediaType(file.mimetype),
            orderIdx: index + 1,
          };
        })
      );
    }

    await saveAiAnalysisLog(connection, postId, aiAnalysis);

    const noticeLookup = quotePostOwnerId ? await createNotice(connection, {
      receiverId: quotePostOwnerId,
      senderId: req.user.userId,
      type: 'QUOTE',
      targetType: 'POST',
      targetId: postId,
      allowDuplicate: true,
    }) : null;

    await connection.commit();
    await emitNoticeCreated(connection, noticeLookup);
    const post = await selectPostById(connection, postId, req.user.userId);

    return res.status(201).json({
      result: 'success',
      message: '게시글이 등록되었습니다.',
      post,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    deleteUploadedFiles(req.files);
    console.error('Post create error', error);
    return res.status(500).json({
      result: 'fail',
      message: '게시글 등록 중 오류가 발생했습니다.',
    });
  } finally {
    if (connection) await connection.close();
  }
});

router.get('/liked', jwtAuthentication, async (req, res) => {
  const cursor = normalizePositiveInteger(req.query.cursor);
  const limit = normalizeLimit(req.query.limit);
  const username = normalizeText(req.query.username, 50);
  let connection;

  try {
    connection = await db.getConnection();

    const filters = ['p.PARENT_POST_ID IS NULL', 'p.IS_DELETED = 0'];
    const binds = { viewerId: req.user.userId };

    if (username) {
      filters.push('liked_user.USERNAME = :username');
      binds.username = username;
    } else {
      filters.push('liked_user.USER_ID = :viewerId');
    }

    if (cursor) {
      filters.push('p.POST_ID < :cursor');
      binds.cursor = cursor;
    }

    const result = await connection.execute(
      getPostSelectSql('JOIN POST_LIKE current_like ON current_like.POST_ID = p.POST_ID JOIN USERS liked_user ON liked_user.USER_ID = current_like.USER_ID WHERE ' + filters.join(' AND ')),
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
    console.error('Liked post list error', error);
    return res.status(500).json({ result: 'fail', message: '좋아요한 게시글을 불러오는 중 오류가 발생했습니다.' });
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

    const filters = ['p.PARENT_POST_ID IS NULL', 'p.IS_DELETED = 0'];
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


router.post('/:postId/reports', jwtAuthentication, async (req, res) => {
  const postId = normalizePositiveInteger(req.params.postId);
  const reason = normalizeText(req.body.reason, 500) || '부적절한 내용';
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '게시글 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();

    const postResult = await connection.execute(
      'SELECT POST_ID FROM POSTS WHERE POST_ID = :postId AND IS_DELETED = 0',
      { postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 게시글입니다.' });
    }

    await connection.execute(
      'INSERT INTO REPORT (REPORTER_ID, TARGET_POST_ID, REASON) VALUES (:reporterId, :postId, :reason)',
      { reporterId: req.user.userId, postId, reason }
    );
    await connection.commit();

    return res.status(201).json({ result: 'success', message: '신고가 접수되었습니다.' });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.errorNum === 1) {
      return res.status(409).json({ result: 'fail', message: '이미 신고한 게시글입니다.' });
    }
    console.error('Post report error', error);
    return res.status(500).json({ result: 'fail', message: '신고 처리 중 서버 오류가 발생했습니다.' });
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

    const filters = ['p.PARENT_POST_ID = :parentPostId', 'p.IS_DELETED = 0'];
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
      'SELECT POST_ID, USER_ID, WORK_ID, PROGRESS FROM POSTS WHERE POST_ID = :parentPostId AND IS_DELETED = 0',
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

    const noticeLookup = await createNotice(connection, {
      receiverId: parentPost.USER_ID,
      senderId: req.user.userId,
      type: 'COMMENT',
      targetType: 'POST',
      targetId: parentPostId,
      allowDuplicate: true,
    });

    await connection.commit();
    await emitNoticeCreated(connection, noticeLookup);
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
    const count = tableName === 'REPOST'
      ? await countPostReposts(connection, postId)
      : await countPostRelation(connection, tableName, postId);

    let noticeLookup = null;

    if (enabled && (tableName === 'POST_LIKE' || tableName === 'REPOST')) {
      const ownerId = await findPostOwnerId(connection, postId);
      noticeLookup = await createNotice(connection, {
        receiverId: ownerId,
        senderId: req.user.userId,
        type: tableName === 'POST_LIKE' ? 'LIKE' : 'REPOST',
        targetType: 'POST',
        targetId: postId,
      });
    }

    await connection.commit();
    await emitNoticeCreated(connection, noticeLookup);

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
  let tags = [];
  let isSpoiler = 0;
  let aiAnalysis = null;
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '게시글 정보가 올바르지 않습니다.' });
  }

  if (!categoryId || isEmpty(workTitle) || isEmpty(progress) || isEmpty(content)) {
    return res.status(400).json({ result: 'fail', message: '카테고리, 작품명, 진도, 내용을 모두 입력해주세요.' });
  }

  try {
    connection = await db.getConnection();

    const postCheck = await connection.execute(
      'SELECT USER_ID FROM POSTS WHERE POST_ID = :postId AND IS_DELETED = 0',
      [postId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 게시글입니다.' });
    }

    if (postCheck.rows[0].USER_ID !== req.user.userId) {
      return res.status(403).json({ result: 'fail', message: '본인이 작성한 게시글만 수정할 수 있습니다.' });
    }

    const categoryCheck = await connection.execute(
      'SELECT CATEGORY_ID, NAME FROM CATEGORY WHERE CATEGORY_ID = :categoryId',
      [categoryId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ result: 'fail', message: '존재하지 않는 카테고리입니다.' });
    }

    const categoryName = categoryCheck.rows[0].NAME || '';
    aiAnalysis = await analyzePostContent({ categoryName, workTitle, progress, content });
    isSpoiler = aiAnalysis.isSpoiler ? 1 : 0;
    tags = extractTags(content, req.body.tags);

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
          AND IS_DELETED = 0
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

    await saveAiAnalysisLog(connection, postId, aiAnalysis);

    await connection.commit();
    const post = await selectPostById(connection, postId, req.user.userId);

    return res.json({ result: 'success', message: '게시글이 수정되었습니다.', post });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Post update error', error);
    return res.status(500).json({ result: 'fail', message: '게시글 수정 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.delete('/:postId', jwtAuthentication, async (req, res) => {
  const postId = normalizePositiveInteger(req.params.postId);
  let connection;

  if (!postId) {
    return res.status(400).json({ result: 'fail', message: '게시글 정보가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();

    const postCheck = await connection.execute(
      'SELECT USER_ID FROM POSTS WHERE POST_ID = :postId AND IS_DELETED = 0',
      [postId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '존재하지 않는 게시글입니다.' });
    }

    if (postCheck.rows[0].USER_ID !== req.user.userId) {
      return res.status(403).json({ result: 'fail', message: '본인이 작성한 게시글만 삭제할 수 있습니다.' });
    }

    await connection.execute(
      `
        UPDATE POSTS
        SET IS_DELETED = 1,
            DELETED_AT = CURRENT_TIMESTAMP
        WHERE POST_ID = :postId
          AND IS_DELETED = 0
      `,
      { postId }
    );
    await connection.commit();

    return res.json({ result: 'success', message: '게시글이 삭제되었습니다.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Post delete error', error);
    return res.status(500).json({ result: 'fail', message: '게시글 삭제 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});
module.exports = router;
