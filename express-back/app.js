const express = require('express');
const cors = require('cors');
const path = require('path');
const oracledb = require('oracledb');

// router
const sampleRouter = require("./routes/sample");
const authRouter = require("./routes/auth");
const categoriesRouter = require("./routes/categories");
const userCategoriesRouter = require("./routes/userCategories");
const usersRouter = require("./routes/users");
const postsRouter = require("./routes/posts");
const searchRouter = require("./routes/search");

const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ejs 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '.')); // .은 경로
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use("/sample", sampleRouter);
app.use("/auth", authRouter);
app.use("/categories", categoriesRouter);
app.use("/users/me/categories", userCategoriesRouter);
app.use("/users", usersRouter);
app.use("/posts", postsRouter);
app.use("/search", searchRouter);

async function startServer() {
  try {
    await db.init();
    console.log('Successfully connected to Oracle database');

    app.listen(3010, () => {
      console.log('Server is running on port 3010');
    });

  } catch (err) {
    console.error('Error connecting to Oracle database. Server not started.', err);
    process.exit(1); // DB 연결 실패 시 프로세스 종료 (선택 사항)
  }
}

startServer();




