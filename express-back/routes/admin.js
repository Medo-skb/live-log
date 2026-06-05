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

function normalizeStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  return ['PENDING', 'PROCESSED'].includes(status) ? status : '';
}

function requireAdmin(req, res, next) {
  if (String(req.user?.role || '').toUpperCase() !== 'ADMIN') {
    return res.status(403).json({ result: 'fail', message: '관리자 권한이 없습니다.' });
  }

  return next();
}

function mapReportRow(row) {
  return {
    reportId: row.REPORT_ID,
    reason: row.REASON,
    status: row.STATUS,
    createdAt: row.CREATED_AT,
    reporter: {
      userId: row.REPORTER_ID,
      username: row.REPORTER_USERNAME,
      nickname: row.REPORTER_NICKNAME,
    },
    post: {
      postId: row.TARGET_POST_ID,
      content: row.POST_CONTENT,
      isDeleted: row.POST_IS_DELETED === 1,
      createdAt: row.POST_CREATED_AT,
      user: {
        userId: row.POST_USER_ID,
        username: row.POST_USERNAME,
        nickname: row.POST_NICKNAME,
      },
      categoryName: row.CATEGORY_NAME,
      workTitle: row.WORK_TITLE,
      progress: row.PROGRESS,
    },
  };
}

router.use(jwtAuthentication, requireAdmin);

router.get('/reports', async (req, res) => {
  const cursor = normalizePositiveInteger(req.query.cursor);
  const limit = normalizeLimit(req.query.limit);
  const status = normalizeStatus(req.query.status);
  let connection;

  try {
    connection = await db.getConnection();
    const filters = [];
    const binds = {};

    if (status) {
      filters.push('r.STATUS = :status');
      binds.status = status;
    }

    if (cursor) {
      filters.push('r.REPORT_ID < :cursor');
      binds.cursor = cursor;
    }

    const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
    const result = await connection.execute(
      `
        SELECT * FROM (
          SELECT
            r.REPORT_ID,
            r.REPORTER_ID,
            reporter.USERNAME AS REPORTER_USERNAME,
            reporter.NICKNAME AS REPORTER_NICKNAME,
            r.TARGET_POST_ID,
            r.REASON,
            r.STATUS,
            TO_CHAR(r.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS CREATED_AT,
            p.USER_ID AS POST_USER_ID,
            post_user.USERNAME AS POST_USERNAME,
            post_user.NICKNAME AS POST_NICKNAME,
            p.CONTENT AS POST_CONTENT,
            p.IS_DELETED AS POST_IS_DELETED,
            TO_CHAR(p.CREATED_AT, 'YYYY-MM-DD HH24:MI') AS POST_CREATED_AT,
            c.NAME AS CATEGORY_NAME,
            w.TITLE AS WORK_TITLE,
            p.PROGRESS
          FROM REPORT r
          JOIN USERS reporter ON reporter.USER_ID = r.REPORTER_ID
          JOIN POSTS p ON p.POST_ID = r.TARGET_POST_ID
          JOIN USERS post_user ON post_user.USER_ID = p.USER_ID
          JOIN WORKS w ON w.WORK_ID = p.WORK_ID
          JOIN CATEGORY c ON c.CATEGORY_ID = w.CATEGORY_ID
          ${whereClause}
          ORDER BY r.REPORT_ID DESC
        )
        WHERE ROWNUM <= :fetchLimit
      `,
      { ...binds, fetchLimit: limit + 1 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows.slice(0, limit);
    const reports = rows.map(mapReportRow);
    const lastReport = reports[reports.length - 1];

    return res.json({
      result: 'success',
      reports,
      nextCursor: result.rows.length > limit && lastReport ? lastReport.reportId : null,
      hasMore: result.rows.length > limit,
    });
  } catch (error) {
    console.error('Admin report list error', error);
    return res.status(500).json({ result: 'fail', message: '신고 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

router.patch('/reports/:reportId', async (req, res) => {
  const reportId = normalizePositiveInteger(req.params.reportId);
  const status = normalizeStatus(req.body.status) || 'PROCESSED';
  const hidePost = req.body.hidePost === true || req.body.hidePost === 1 || req.body.hidePost === '1';
  let connection;

  if (!reportId) {
    return res.status(400).json({ result: 'fail', message: '신고 ID가 올바르지 않습니다.' });
  }

  try {
    connection = await db.getConnection();

    const reportResult = await connection.execute(
      'SELECT TARGET_POST_ID FROM REPORT WHERE REPORT_ID = :reportId',
      { reportId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ result: 'fail', message: '신고를 찾을 수 없습니다.' });
    }

    await connection.execute(
      'UPDATE REPORT SET STATUS = :status WHERE REPORT_ID = :reportId',
      { status, reportId }
    );

    if (hidePost) {
      await connection.execute(
        `
          UPDATE POSTS
          SET IS_DELETED = 1,
              DELETED_AT = NVL(DELETED_AT, CURRENT_TIMESTAMP)
          WHERE POST_ID = :postId
            AND IS_DELETED = 0
        `,
        { postId: reportResult.rows[0].TARGET_POST_ID }
      );
    }

    await connection.commit();

    return res.json({ result: 'success', message: '처리가 완료되었습니다.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Admin report update error', error);
    return res.status(500).json({ result: 'fail', message: '처리 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
