const express = require('express');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');

const router = express.Router();
const TERM_LIMIT = 5;
const USER_LIMIT = 8;
const TAG_LIMIT = 8;

function normalizeKeyword(value) {
  return String(value || '').trim().slice(0, 50);
}

function normalizeLikeText(value) {
  return '%' + String(value || '').toLowerCase() + '%';
}

router.get('/suggestions', jwtAuthentication, async (req, res) => {
  const keyword = normalizeKeyword(req.query.keyword);
  const isTagMode = keyword.startsWith('#');
  const text = isTagMode ? keyword.slice(1).trim() : keyword;
  const likeText = normalizeLikeText(text);
  let connection;

  if (!keyword) {
    return res.json({ result: 'success', mode: 'general', suggestions: { terms: [], users: [], tags: [] } });
  }

  try {
    connection = await db.getConnection();

    if (isTagMode) {
      const tagResult = await connection.execute(
        [
          'SELECT TAG',
          'FROM (',
          '  SELECT pt.TAG, COUNT(*) AS USED_COUNT',
          '  FROM POST_TAG pt',
          '  JOIN POSTS p ON p.POST_ID = pt.POST_ID AND p.IS_DELETED = 0',
          '  WHERE LOWER(pt.TAG) LIKE :likeText',
          '  GROUP BY pt.TAG',
          '  ORDER BY USED_COUNT DESC, pt.TAG ASC',
          ')',
          'WHERE ROWNUM <= :tagLimit',
        ].join(' '),
        { likeText, tagLimit: TAG_LIMIT },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const tags = tagResult.rows.map((row) => ({
        type: 'tag',
        label: '#' + row.TAG,
        value: '#' + row.TAG,
      }));

      return res.json({ result: 'success', mode: 'tag', suggestions: { terms: [], users: [], tags } });
    }

    const termResult = await connection.execute(
      [
        'SELECT LABEL, TYPE',
        'FROM (',
        '  SELECT LABEL, TYPE, MAX(SORT_ID) AS SORT_ID',
        '  FROM (',
        "    SELECT w.TITLE AS LABEL, 'work' AS TYPE, w.WORK_ID AS SORT_ID",
        '    FROM WORKS w',
        '    WHERE LOWER(w.TITLE) LIKE :likeText OR LOWER(w.ALIAS) LIKE :likeText',
        '    UNION ALL',
        "    SELECT tk.KEYWORD AS LABEL, 'keyword' AS TYPE, tk.KEYWORD_ID AS SORT_ID",
        '    FROM TREND_KEYWORD tk',
        '    WHERE LOWER(tk.KEYWORD) LIKE :likeText',
        '  )',
        '  GROUP BY LABEL, TYPE',
        '  ORDER BY SORT_ID DESC',
        ')',
        'WHERE ROWNUM <= :termLimit',
      ].join(' '),
      { likeText, termLimit: TERM_LIMIT },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const userResult = await connection.execute(
      [
        'SELECT USER_ID, USERNAME, NICKNAME, DISCRIMINATOR',
        'FROM (',
        '  SELECT u.USER_ID, u.USERNAME, u.NICKNAME, u.DISCRIMINATOR',
        '  FROM USERS u',
        '  WHERE LOWER(u.USERNAME) LIKE :likeText OR LOWER(u.NICKNAME) LIKE :likeText',
        '  ORDER BY u.USER_ID DESC',
        ')',
        'WHERE ROWNUM <= :userLimit',
      ].join(' '),
      { likeText, userLimit: USER_LIMIT },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const terms = termResult.rows.map((row) => ({
      type: String(row.TYPE || 'term').toLowerCase(),
      label: row.LABEL,
      value: row.LABEL,
    }));

    const users = userResult.rows.map((row) => ({
      type: 'user',
      userId: row.USER_ID,
      username: row.USERNAME,
      nickname: row.NICKNAME,
      tag: row.DISCRIMINATOR,
    }));

    return res.json({ result: 'success', mode: 'general', suggestions: { terms, users, tags: [] } });
  } catch (error) {
    console.error('Search suggestion error', error);
    return res.status(500).json({ result: 'fail', message: '추천검색어를 불러오지 못했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;