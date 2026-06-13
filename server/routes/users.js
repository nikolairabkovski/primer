// routes/users.js
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const { updateLastSeen } = require("../utils/helpers");

const router = express.Router();

// Статус онлайн
router.post("/api/user/online", verifyToken, (req, res) => {
  db.run(`UPDATE users SET is_online = 1 WHERE id = ?`, [req.userId], (err) => {
    if (err) {
      console.error("Ошибка установки статуса онлайн:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json({ success: true });
  });
});

router.post("/api/user/offline", verifyToken, (req, res) => {
  db.run(`UPDATE users SET is_online = 0 WHERE id = ?`, [req.userId], (err) => {
    if (err) {
      console.error("Ошибка установки статуса офлайн:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json({ success: true });
  });
});

router.get("/api/user/status/:userId", (req, res) => {
  const userId = req.params.userId;
  db.get(`SELECT is_online FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      console.error("Ошибка получения статуса:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    res.json({ is_online: user.is_online === 1 });
  });
});

// Получение всех пользователей
router.get("/api/users", (req, res) => {
  db.all(
    `SELECT id, fullname, nickname, username, email, role, city, birthdate, club, bio, avatar, is_online
     FROM users ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Ошибка получения пользователей:", err.message);
        return res
          .status(500)
          .json({ error: "Ошибка сервера при получении пользователей" });
      }
      res.json(rows || []);
    },
  );
});

// Профиль
router.get("/api/profile/:id", (req, res) => {
  const id = req.params.id;
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Некорректный ID пользователя" });
  }
  db.get(
    `SELECT id, fullname, nickname, username, email, bio, city, birthdate, club, avatar, role, is_online
     FROM users WHERE id = ?`,
    [id],
    (err, user) => {
      if (err) {
        console.error("Ошибка получения профиля:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!user)
        return res.status(404).json({ error: "Пользователь не найден" });
      res.json(user);
    },
  );
});

// Обновление профиля
router.put("/api/profile/:id", verifyToken, (req, res) => {
  const id = req.params.id;
  const { fullname, username, email, city, birthdate, club, bio } = req.body;

  if (req.userId != id) {
    return res
      .status(403)
      .json({ message: "Нет прав для редактирования этого профиля" });
  }

  db.get(`SELECT id FROM users WHERE id = ?`, [id], (err, user) => {
    if (err) {
      console.error("Ошибка при проверке пользователя:", err.message);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
    if (!user)
      return res.status(404).json({ message: "Пользователь не найден" });

    db.run(
      `UPDATE users 
       SET fullname = ?, username = ?, email = ?, city = ?, birthdate = ?, club = ?, bio = ?
       WHERE id = ?`,
      [
        fullname || "",
        username || "",
        email || "",
        city || "",
        birthdate || "",
        club || "",
        bio || "",
        id,
      ],
      function (err) {
        if (err) {
          console.error("Ошибка при обновлении профиля:", err.message);
          if (err.message.includes("UNIQUE")) {
            return res
              .status(400)
              .json({ message: "Username или email уже используются" });
          }
          return res
            .status(500)
            .json({ message: "Ошибка сервера при обновлении" });
        }
        res.json({ message: "Профиль успешно обновлен" });
      },
    );
  });
});

// Поиск пользователей
router.get("/api/users/search", verifyToken, (req, res) => {
  const { query } = req.query;
  if (!query || query.length < 2) return res.json([]);

  db.all(
    `SELECT id, fullname, nickname, username, email, avatar, city, club, is_online
     FROM users 
     WHERE (username LIKE ? OR nickname LIKE ? OR fullname LIKE ?) 
     AND id != ?
     LIMIT 20`,
    [`%${query}%`, `%${query}%`, `%${query}%`, req.userId],
    (err, users) => {
      if (err) {
        console.error("Ошибка поиска пользователей:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(users || []);
    },
  );
});

// Получить роль текущего пользователя
router.get("/api/user/role", verifyToken, (req, res) => {
  db.get(`SELECT role FROM users WHERE id = ?`, [req.userId], (err, user) => {
    if (err) {
      console.error("Ошибка получения роли:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json({
      role: user.role,
      isAdmin: user.role === "admin" || user.role === "main_admin",
      isMainAdmin: user.role === "main_admin",
    });
  });
});

module.exports = router;
