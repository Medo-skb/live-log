const jwt = require('jsonwebtoken');
require('dotenv').config();

const jwtAuthentication = (req, res, next) => {
  const JWT_SECRET = process.env.jwt_key;
  const authHeader = req.headers.authorization || '';
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: "인증 토큰이 없습니다.",
      isLogin: false,
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('JWT middleware error:', err.message);
    return res.status(403).json({
      message: "유효하지 않은 토큰입니다.",
      isLogin: false,
    });
  }
};

module.exports = jwtAuthentication;
