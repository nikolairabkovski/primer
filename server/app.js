// app.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const { PORT, UPLOAD_LIMIT } = require("./config/constants");
const db = require("./config/db");
const uploadRoutes = require("./routes/upload");

// Подключаем роуты
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const friendRoutes = require("./routes/friends");
const chatRoutes = require("./routes/chat");
const newsRoutes = require("./routes/news");
const adminRoutes = require("./routes/admin");
const supportRoutes = require("./routes/support");
const clubRoutes = require("./routes/clubs");
const newsReact = require("./routes/news-likes");
const newsComment = require("./routes/news_comments");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: UPLOAD_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: UPLOAD_LIMIT }));
app.use(express.static(path.join(__dirname, "../client")));

// Подключение маршрутов
app.use(authRoutes);
app.use(userRoutes);
app.use(friendRoutes);
app.use(chatRoutes);
app.use(newsRoutes);
app.use(adminRoutes);
app.use(supportRoutes);
app.use(clubRoutes);
app.use(uploadRoutes);
app.use(newsReact);
app.use(newsComment);

// Проверка подключения к БД при старте (можно вынести в server.js)
db.get("SELECT 1", (err) => {
  if (err) {
    console.error("Ошибка подключения к базе данных:", err.message);
    process.exit(1);
  } else {
    console.log("Соединение с базой данных установлено");
  }
});

module.exports = app;
