const express = require('express');
const oracledb = require('oracledb');
const db = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      'SELECT CATEGORY_ID, NAME FROM CATEGORY ORDER BY CATEGORY_ID',
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({
      result: 'success',
      categories: result.rows.map((row) => ({
        categoryId: row.CATEGORY_ID,
        name: row.NAME,
      })),
    });
  } catch (error) {
    console.error('Category list error', error);
    return res.status(500).json({
      result: 'fail',
      message: "카테고리를 불러오는 중 오류가 발생했습니다.",
    });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
