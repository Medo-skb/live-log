const express = require('express');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
require('dotenv').config();

const router = express.Router();
const JWT_KEY = process.env.jwt_key;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const VERIFY_EXPIRES_MS = parseInt(process.env.EMAIL_VERIFY_EXPIRY_MIN) * 60 * 1000;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL;
const NICKNAME_PATTERN = /^[\p{L}\p{N}]+$/u;

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.USER_ID,
      username: user.USERNAME,
      email: user.EMAIL,
      nickname: user.NICKNAME,
      discriminator: user.DISCRIMINATOR
    },
    JWT_KEY,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function createVerifyToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  return { token, tokenHash };
}

function getVerifyUrl(userId, token) {
  return `${API_PUBLIC_URL}/auth/verify-email?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

function createMailTransport() {
  if (isEmpty(process.env.EMAIL_USER) || isEmpty(process.env.EMAIL_PASS)) {
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendVerifyEmail(email, username, verifyUrl) {
  const transporter = createMailTransport();

  if (!transporter) {
    console.log('[DEV] 이메일 인증 링크:', verifyUrl);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '[Live-Log] 이메일 인증을 완료해주세요',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #15201c;">
          <h2>Live-Log 이메일 인증</h2>
          <p>${username}님, 아래 버튼을 눌러 이메일 인증을 완료해주세요.</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#1f6f5b;color:#ffffff;text-decoration:none;border-radius:6px;">이메일 인증하기</a></p>
          <p>이 링크는 30분 동안만 유효합니다.</p>
        </div>
      `
    });

    return true;
  } catch (error) {
    console.error('Email send error', error);
    console.log('[DEV] 이메일 인증 링크:', verifyUrl);
    return false;
  }
}

async function getUserCategories(connection, userId) {
  const result = await connection.execute(
    'SELECT c.CATEGORY_ID, c.NAME FROM USER_CATEGORY uc JOIN CATEGORY c ON c.CATEGORY_ID = uc.CATEGORY_ID WHERE uc.USER_ID = :userId ORDER BY c.CATEGORY_ID',
    [userId],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows.map((row) => ({
    categoryId: row.CATEGORY_ID,
    name: row.NAME
  }));
}

async function findUserByEmail(connection, email) {
  const result = await connection.execute(
    `
      SELECT USER_ID, USERNAME, NICKNAME, DISCRIMINATOR, PASSWORD_HASH, EMAIL, EMAIL_VERIFIED
      FROM USERS
      WHERE EMAIL = :email
    `,
    [email],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows[0];
}

async function createGoogleUsername(connection, email) {
  const emailName = email.split('@')[0].replace(/[^A-Za-z0-9_]/g, '_');
  const base = (emailName || 'google_user').slice(0, 20);

  for (let i = 0; i < 20; i += 1) {
    const suffix = i === 0 ? '' : String(i + 1);
    const username = i === 0 ? base : `${base.slice(0, 20 - suffix.length)}${suffix}`;
    const result = await connection.execute(
      `
        SELECT USERNAME
        FROM USERS
        WHERE USERNAME = :username
      `,
      [username],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) return username;
  }

  return ('google' + Date.now()).slice(0, 20);
}

router.post('/register', async (req, res) => {
  let { username, nickname, email, password } = req.body;
  let connection;

  if (isEmpty(username) || isEmpty(nickname) || isEmpty(email) || isEmpty(password)) {
    return res.status(400).json({
      result: 'fail',
      message: '아이디, 닉네임, 이메일, 비밀번호를 모두 입력해주세요.'
    });
  }

  if (!NICKNAME_PATTERN.test(nickname)) {
    return res.status(400).json({
      result: 'fail',
      message: '닉네임에는 공백이나 특수문자를 사용할 수 없습니다.'
    });
  }

  if (/\s/.test(password)) {
    return res.status(400).json({
      result: 'fail',
      message: '비밀번호에는 공백을 포함할 수 없습니다.'
    });
  }

  username = username.trim();
  email = email.trim().toLowerCase();

  try {
    connection = await db.getConnection();

    const duplicateResult = await connection.execute(
      `
        SELECT USERNAME, EMAIL
        FROM USERS
        WHERE USERNAME = :username OR EMAIL = :email
      `,
      [username, email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({
        result: 'fail',
        message: '이미 사용 중인 아이디 또는 이메일입니다.'
      });
    }

    // 서버에서 해시해야 원문 비밀번호가 DB에 저장되지 않습니다.
    const hashPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const { token, tokenHash } = createVerifyToken();
    const expiresAt = new Date(Date.now() + VERIFY_EXPIRES_MS);

    // 랜덤 4자리 태그 생성 및 중복 체크 (간단한 버전)
    let discriminator;
    let isTagUnique = false;
    while (!isTagUnique) {
      discriminator = Math.floor(1000 + Math.random() * 9000).toString();
      const tagCheck = await connection.execute(
        `SELECT 1 FROM USERS WHERE NICKNAME = :nickname AND DISCRIMINATOR = :discriminator`,
        [nickname, discriminator]
      );
      if (tagCheck.rows.length === 0) isTagUnique = true;
    }

    const result = await connection.execute(
      `
        INSERT INTO USERS (
          USERNAME,
          NICKNAME,
          DISCRIMINATOR,
          PASSWORD_HASH,
          EMAIL,
          EMAIL_VERIFIED,
          EMAIL_VERIFY_TOKEN_HASH,
          EMAIL_VERIFY_EXPIRES_AT
        ) VALUES (
          :username,
          :nickname,
          :discriminator,
          :hashPassword,
          :email,
          0,
          :tokenHash,
          :expiresAt
        )
        RETURNING USER_ID INTO :userId
      `,
      {
        username,
        nickname,
        discriminator,
        hashPassword,
        email,
        tokenHash,
        expiresAt,
        userId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    const userId = result.outBinds.userId[0];
    const verifyUrl = getVerifyUrl(userId, token);
    const isMailSent = await sendVerifyEmail(email, username, verifyUrl);

    return res.status(201).json({
      result: 'success',
      message: isMailSent
        ? '회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.'
        : '회원가입이 완료되었습니다. 개발 환경 인증 링크가 서버 콘솔에 출력되었습니다.'
    });
  } catch (error) {
    console.error('Register error', error);
    return res.status(500).json({
      result: 'fail',
      message: '회원가입 처리 중 서버 오류가 발생했습니다.'
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get('/verify-email', async (req, res) => {
  const userId = Number(req.query.userId);
  const token = req.query.token;
  let connection;

  if (!Number.isInteger(userId) || userId <= 0 || isEmpty(token)) {
    return res.status(400).send('잘못된 이메일 인증 요청입니다.');
  }

  try {
    connection = await db.getConnection();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await connection.execute(
      `
        SELECT USER_ID, EMAIL_VERIFIED, EMAIL_VERIFY_TOKEN_HASH, EMAIL_VERIFY_EXPIRES_AT
        FROM USERS
        WHERE USER_ID = :userId
      `,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).send('존재하지 않는 사용자입니다.');
    }

    if (user.EMAIL_VERIFIED === 1) {
      return res.send('이미 이메일 인증이 완료된 계정입니다. 로그인해주세요.');
    }

    if (!user.EMAIL_VERIFY_TOKEN_HASH || user.EMAIL_VERIFY_TOKEN_HASH !== tokenHash) {
      return res.status(400).send('유효하지 않은 인증 링크입니다.');
    }

    if (!user.EMAIL_VERIFY_EXPIRES_AT || new Date(user.EMAIL_VERIFY_EXPIRES_AT).getTime() < Date.now()) {
      return res.status(410).send('인증 링크가 만료되었습니다. 다시 회원가입하거나 인증 메일 재발송을 요청해주세요.');
    }

    await connection.execute(
      `
        UPDATE USERS
        SET EMAIL_VERIFIED = 1,
            EMAIL_VERIFY_TOKEN_HASH = NULL,
            EMAIL_VERIFY_EXPIRES_AT = NULL
        WHERE USER_ID = :userId
      `,
      [userId],
      { autoCommit: true }
    );

    return res.send('이메일 인증이 완료되었습니다. Live-Log 로그인 화면으로 돌아가 로그인해주세요.');
  } catch (error) {
    console.error('Email verify error', error);
    return res.status(500).send('이메일 인증 처리 중 서버 오류가 발생했습니다.');
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let connection;

  if (isEmpty(username) || isEmpty(password)) {
    return res.status(400).json({
      result: 'fail',
      message: '아이디와 비밀번호를 입력해주세요.'
    });
  }

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `
        SELECT USER_ID, USERNAME, NICKNAME, DISCRIMINATOR, PASSWORD_HASH, EMAIL, EMAIL_VERIFIED
        FROM USERS
        WHERE USERNAME = :username
      `,
      [username.trim()],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        result: 'fail',
        message: '아이디 또는 비밀번호를 확인해주세요.'
      });
    }

    const user = result.rows[0];
    const isMatched = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (!isMatched) {
      return res.status(401).json({
        result: 'fail',
        message: '아이디 또는 비밀번호를 확인해주세요.'
      });
    }

    if (!JWT_KEY) {
      return res.status(500).json({
        result: 'fail',
        message: 'JWT 설정이 누락되었습니다.'
      });
    }

    if (user.EMAIL_VERIFIED !== 1) {
      return res.json({
        result: 'email_required',
        message: '이메일 인증 후 메인 페이지에 진입할 수 있습니다.',
        emailVerificationRequired: true,
        user: {
          userId: user.USER_ID,
          username: user.USERNAME,
          email: user.EMAIL,
          nickname: user.NICKNAME,
          discriminator: user.DISCRIMINATOR
        }
      });
    }

    // JWT는 서버 비밀키로 서명해야 하므로 로그인 성공 시점에 백엔드에서 발급합니다.
    const token = createToken(user);
    const userCategories = await getUserCategories(connection, user.USER_ID);

    return res.json({
      result: 'success',
      message: '로그인되었습니다.',
      token,
      user: {
        userId: user.USER_ID,
        username: user.USERNAME,
        email: user.EMAIL,
        nickname: user.NICKNAME,
        discriminator: user.DISCRIMINATOR,
        categories: userCategories
      }
    });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({
      result: 'fail',
      message: '로그인 처리 중 서버 오류가 발생했습니다.'
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  let connection;

  if (isEmpty(credential)) {
    return res.status(400).json({
      result: 'fail',
      message: 'Google 인증 정보가 없습니다.'
    });
  }

  if (!googleClient || !GOOGLE_CLIENT_ID) {
    return res.status(500).json({
      result: 'fail',
      message: 'Google Client ID 설정이 누락되었습니다.'
    });
  }

  if (!JWT_KEY) {
    return res.status(500).json({
      result: 'fail',
      message: 'JWT 설정이 누락되었습니다.'
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();

    if (!email || payload.email_verified !== true) {
      return res.status(401).json({
        result: 'fail',
        message: '검증되지 않은 Google 이메일입니다.'
      });
    }

    connection = await db.getConnection();
    let user = await findUserByEmail(connection, email);

    if (!user) {
      const username = await createGoogleUsername(connection, email);
      const nickname = payload.name || 'Google User'; // 구글 프로필 이름을 닉네임으로 사용
      const hashPassword = await bcrypt.hash(`GOOGLE_LOGIN_${payload.sub}`, SALT_ROUNDS);

      // 구글 사용자용 태그 생성
      let discriminator;
      let isTagUnique = false;
      while (!isTagUnique) {
        discriminator = Math.floor(1000 + Math.random() * 9000).toString();
        const tagCheck = await connection.execute(
          `SELECT 1 FROM USERS WHERE NICKNAME = :nickname AND DISCRIMINATOR = :discriminator`,
          [nickname, discriminator]
        );
        if (tagCheck.rows.length === 0) isTagUnique = true;
      }

      const insertResult = await connection.execute(
        `
          INSERT INTO USERS (
            USERNAME,
            NICKNAME,
            DISCRIMINATOR,
            PASSWORD_HASH,
            EMAIL,
            EMAIL_VERIFIED
          ) VALUES (
            :username,
            :nickname,
            :discriminator,
            :hashPassword,
            :email,
            1
          )
          RETURNING USER_ID INTO :userId
        `,
        {
          username,
          nickname,
          discriminator,
          hashPassword,
          email,
          userId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );

      user = {
        USER_ID: insertResult.outBinds.userId[0],
        USERNAME: username,
        NICKNAME: nickname,
        DISCRIMINATOR: discriminator,
        EMAIL: email,
        EMAIL_VERIFIED: 1
      };
    }

    const token = createToken(user);
    const googleUserCategories = await getUserCategories(connection, user.USER_ID);

    return res.json({
      result: 'success',
      message: 'Google 계정으로 로그인되었습니다.',
      token,
      user: {
        userId: user.USER_ID,
        username: user.USERNAME,
        email: user.EMAIL,
        nickname: user.NICKNAME,
        discriminator: user.DISCRIMINATOR,
        categories: googleUserCategories
      }
    });
  } catch (error) {
    console.error('Google login error', error);
    return res.status(401).json({
      result: 'fail',
      message: 'Google 로그인 검증에 실패했습니다.'
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;
