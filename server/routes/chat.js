// routes/chat.js
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const { updateLastSeen } = require("../utils/helpers");
const { uploadChatPhoto } = require("../config/multer"); // нужно настроить

const router = express.Router();

router.get("/api/chat/:userId", verifyToken, (req, res) => {
  const otherUserId = req.params.userId;
  const currentUserId = req.userId;
  updateLastSeen(currentUserId);

  db.all(
    `SELECT m.*, 
            u1.fullname as sender_name, u1.username as sender_username
     FROM messages m
     JOIN users u1 ON m.sender_id = u1.id
     WHERE (m.sender_id = ? AND m.receiver_id = ?) 
        OR (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC`,
    [currentUserId, otherUserId, otherUserId, currentUserId],
    (err, messages) => {
      if (err) {
        console.error("Ошибка получения сообщений:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }

      db.run(
        `UPDATE messages SET is_read = 1 
         WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
        [otherUserId, currentUserId],
      );

      res.json(messages || []);
    },
  );
});

router.post("/api/chat/send", verifyToken, (req, res) => {
  const { receiverId, message } = req.body;
  if (!receiverId || !message || message.trim() === "") {
    return res.status(400).json({ message: "Некорректные данные" });
  }
  const senderId = req.userId;
  updateLastSeen(senderId);

  db.run(
    `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`,
    [senderId, receiverId, message.trim()],
    function (err) {
      if (err) {
        console.error("Ошибка сохранения сообщения:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      res.json({
        message: "Сообщение отправлено",
        messageId: this.lastID,
        created_at: new Date().toISOString(),
      });
    },
  );
});

router.get("/api/chats", verifyToken, (req, res) => {
  const userId = req.userId;
  const query = `
    WITH conversations AS (
      SELECT DISTINCT 
        CASE 
          WHEN sender_id = ? THEN receiver_id 
          ELSE sender_id 
        END as other_user_id
      FROM messages 
      WHERE sender_id = ? OR receiver_id = ?
    )
    SELECT 
      u.id, 
      u.fullname, 
      u.username, 
      u.nickname, 
      u.avatar,
      u.is_online,
      (
        SELECT message 
        FROM messages 
        WHERE (sender_id = ? AND receiver_id = u.id) 
           OR (sender_id = u.id AND receiver_id = ?)
        ORDER BY created_at DESC 
        LIMIT 1
      ) as last_message,
      (
        SELECT created_at 
        FROM messages 
        WHERE (sender_id = ? AND receiver_id = u.id) 
           OR (sender_id = u.id AND receiver_id = ?)
        ORDER BY created_at DESC 
        LIMIT 1
      ) as last_message_time,
      (
        SELECT COUNT(*) 
        FROM messages 
        WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0
      ) as unread_count
    FROM conversations c
    JOIN users u ON c.other_user_id = u.id
    ORDER BY last_message_time DESC NULLS LAST
  `;
  db.all(
    query,
    [userId, userId, userId, userId, userId, userId, userId, userId],
    (err, chats) => {
      if (err) {
        console.error("Ошибка получения чатов:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(chats || []);
    },
  );
});

// Отправка фото в чат
router.post(
  "/api/chat/send-photo",
  verifyToken,
  uploadChatPhoto.single("photo"),
  (req, res) => {
    const { receiverId } = req.body;
    if (!receiverId)
      return res.status(400).json({ message: "Некорректные данные" });
    if (!req.file)
      return res.status(400).json({ message: "Фото не загружено" });

    const photoUrl = `/uploads/chat/${req.file.filename}`;
    const message = `[Фото] ${photoUrl}`;
    db.run(
      `INSERT INTO messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, 0)`,
      [req.userId, receiverId, message],
      function (err) {
        if (err) {
          console.error("Ошибка сохранения сообщения с фото:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({
          message: "Фото отправлено",
          messageId: this.lastID,
          photoUrl,
          created_at: new Date().toISOString(),
        });
      },
    );
  },
);

module.exports = router;
