// routes/friends.js
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.post("/api/friends/request", verifyToken, (req, res) => {
  const { friendId } = req.body;
  const userId = req.userId;

  if (!friendId || userId == friendId) {
    return res.status(400).json({ message: "Некорректный ID пользователя" });
  }

  db.get(`SELECT id FROM users WHERE id = ?`, [friendId], (err, user) => {
    if (err) {
      console.error("Ошибка проверки пользователя:", err.message);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
    if (!user)
      return res.status(404).json({ message: "Пользователь не найден" });

    db.get(
      `SELECT * FROM friends 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId],
      (err, existing) => {
        if (err) {
          console.error("Ошибка проверки существующей заявки:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        if (existing) {
          if (existing.status === "accepted")
            return res.status(400).json({ message: "Вы уже друзья" });
          if (existing.status === "pending")
            return res.status(400).json({ message: "Заявка уже отправлена" });
        }

        db.run(
          `INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')`,
          [userId, friendId],
          function (err) {
            if (err) {
              console.error("Ошибка создания заявки:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({ message: "Заявка в друзья отправлена" });
          },
        );
      },
    );
  });
});

router.put("/api/friends/accept/:requestId", verifyToken, (req, res) => {
  const requestId = req.params.requestId;
  db.get(
    `SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = 'pending'`,
    [requestId, req.userId],
    (err, request) => {
      if (err) {
        console.error("Ошибка проверки заявки:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      if (!request)
        return res.status(404).json({ message: "Заявка не найдена" });

      db.run(
        `UPDATE friends SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [requestId],
        function (err) {
          if (err) {
            console.error("Ошибка принятия заявки:", err.message);
            return res.status(500).json({ message: "Ошибка сервера" });
          }
          res.json({ message: "Заявка принята" });
        },
      );
    },
  );
});

router.put("/api/friends/reject/:requestId", verifyToken, (req, res) => {
  const requestId = req.params.requestId;
  db.run(
    `UPDATE friends SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND friend_id = ? AND status = 'pending'`,
    [requestId, req.userId],
    function (err) {
      if (err) {
        console.error("Ошибка отклонения заявки:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      if (this.changes === 0)
        return res.status(404).json({ message: "Заявка не найдена" });
      res.json({ message: "Заявка отклонена" });
    },
  );
});

router.delete("/api/friends/:friendId", verifyToken, (req, res) => {
  const friendId = req.params.friendId;
  const userId = req.userId;
  db.run(
    `DELETE FROM friends 
     WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
    [userId, friendId, friendId, userId],
    function (err) {
      if (err) {
        console.error("Ошибка удаления из друзей:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      if (this.changes === 0)
        return res.status(404).json({ message: "Друг не найден" });
      res.json({ message: "Пользователь удален из друзей" });
    },
  );
});

router.get("/api/friends", verifyToken, (req, res) => {
  const userId = req.userId;
  db.all(
    `SELECT u.id, u.fullname, u.nickname, u.username, u.email, u.avatar, u.city, u.club, u.is_online,
            f.created_at
     FROM friends f
     JOIN users u ON (CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END) = u.id
     WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
     ORDER BY u.fullname`,
    [userId, userId, userId],
    (err, friends) => {
      if (err) {
        console.error("Ошибка получения друзей:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(friends || []);
    },
  );
});

router.get("/api/friends/requests/incoming", verifyToken, (req, res) => {
  db.all(
    `SELECT f.id as request_id, u.id, u.fullname, u.nickname, u.username, u.avatar, u.city, u.club, u.is_online,
            f.created_at
     FROM friends f
     JOIN users u ON f.user_id = u.id
     WHERE f.friend_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [req.userId],
    (err, requests) => {
      if (err) {
        console.error("Ошибка получения заявок:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(requests || []);
    },
  );
});

router.get("/api/friends/requests/outgoing", verifyToken, (req, res) => {
  db.all(
    `SELECT f.id as request_id, u.id, u.fullname, u.nickname, u.username, u.avatar, u.city, u.club, u.is_online,
            f.created_at
     FROM friends f
     JOIN users u ON f.friend_id = u.id
     WHERE f.user_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [req.userId],
    (err, requests) => {
      if (err) {
        console.error("Ошибка получения заявок:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(requests || []);
    },
  );
});

module.exports = router;
