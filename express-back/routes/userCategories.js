const express = require('express');
const oracledb = require('oracledb');
const db = require('../db');
const jwtAuthentication = require('../auth');

const router = express.Router();
const MAX_CATEGORY_COUNT = 5;

function normalizeCategoryIds(categoryIds) {
  if (!Array.isArray(categoryIds)) return [];

  return [...new Set(categoryIds.map(Number))]
    .filter((categoryId) => Number.isInteger(categoryId) && categoryId > 0);
}

async function selectUserCategories(connection, userId) {
  const result = await connection.execute(
    'SELECT c.CATEGORY_ID, c.NAME FROM USER_CATEGORY uc JOIN CATEGORY c ON c.CATEGORY_ID = uc.CATEGORY_ID WHERE uc.USER_ID = :userId ORDER BY c.CATEGORY_ID',
    [userId],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows.map((row) => ({
    categoryId: row.CATEGORY_ID,
    name: row.NAME,
  }));
}

router.get('/', jwtAuthentication, async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    const categories = await selectUserCategories(connection, req.user.userId);

    return res.json({
      result: 'success',
      categories,
    });
  } catch (error) {
    console.error('User category get error', error);
    return res.status(500).json({
      result: 'fail',
      message: "관심 카테고리를 불러오는 중 오류가 발생했습니다.",
    });
  } finally {
    if (connection) await connection.close();
  }
});

router.put('/', jwtAuthentication, async (req, res) => {
  const categoryIds = normalizeCategoryIds(req.body.categoryIds);
  let connection;

  if (categoryIds.length === 0) {
    return res.status(400).json({
      result: 'fail',
      message: "관심 카테고리를 1개 이상 선택해주세요.",
    });
  }

  if (categoryIds.length > MAX_CATEGORY_COUNT) {
    return res.status(400).json({
      result: 'fail',
      message: "관심 카테고리는 최대 5개까지 선택할 수 있습니다.",
    });
  }

  try {
    connection = await db.getConnection();
    const bindNames = categoryIds.map((_, index) => ':id' + index).join(', ');
    const bindValues = Object.fromEntries(categoryIds.map((categoryId, index) => ['id' + index, categoryId]));

    const categoryCheck = await connection.execute(
      'SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_ID IN (' + bindNames + ')',
      bindValues,
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (categoryCheck.rows.length !== categoryIds.length) {
      return res.status(400).json({
        result: 'fail',
        message: "존재하지 않는 카테고리가 포함되어 있습니다.",
      });
    }

    await connection.execute(
      'DELETE FROM USER_CATEGORY WHERE USER_ID = :userId',
      [req.user.userId]
    );

    await connection.executeMany(
      'INSERT INTO USER_CATEGORY (USER_ID, CATEGORY_ID) VALUES (:userId, :categoryId)',
      categoryIds.map((categoryId) => ({ userId: req.user.userId, categoryId }))
    );

    await connection.commit();
    const categories = await selectUserCategories(connection, req.user.userId);

    return res.json({
      result: 'success',
      message: "관심 카테고리가 저장되었습니다.",
      categories,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('User category update error', error);
    return res.status(500).json({
      result: 'fail',
      message: "관심 카테고리 저장 중 오류가 발생했습니다.",
    });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
