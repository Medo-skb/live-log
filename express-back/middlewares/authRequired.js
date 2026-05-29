const jwt = require('jsonwebtoken');
require('dotenv').config();

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      result: 'fail',
      message: "로그인이 필요합니다.",
    });
  }

  try {
    req.user = jwt.verify(token, process.env.jwt_key);
    return next();
  } catch (error) {
    return res.status(401).json({
      result: 'fail',
      message: "유효하지 않은 로그인 정보입니다.",
    });
  }
}

module.exports = authRequired;
