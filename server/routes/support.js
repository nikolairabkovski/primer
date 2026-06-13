const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Создать обращение
router.post("/api/support/tickets", verifyToken, (req, res) => {
  const { subject, message, priority = "medium", photos = [] } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ message: "Заполните все поля" });
  }

  const photosJson = JSON.stringify(photos);

  db.run(
    `INSERT INTO support_tickets (user_id, subject, message, priority, photos) VALUES (?, ?, ?, ?, ?)`,
    [req.userId, subject, message, priority, photosJson],
    function (err) {
      if (err) {
        console.error("Ошибка создания обращения:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      res.json({
        message: "Обращение создано",
        ticketId: this.lastID,
        photos,
      });
    },
  );
});

// Получить обращения текущего пользователя
router.get("/api/support/my-tickets", verifyToken, (req, res) => {
  db.all(
    `SELECT t.*, 
            (SELECT COUNT(*) FROM support_replies WHERE ticket_id = t.id) as replies_count,
            CASE WHEN t.photos IS NOT NULL AND t.photos != '[]' THEN 1 ELSE 0 END as has_photos
     FROM support_tickets t
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC`,
    [req.userId],
    (err, tickets) => {
      if (err) {
        console.error("Ошибка получения обращений:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      // Парсим JSON-поле photos
      tickets = (tickets || []).map((ticket) => {
        try {
          ticket.photos = ticket.photos ? JSON.parse(ticket.photos) : [];
        } catch (e) {
          ticket.photos = [];
        }
        return ticket;
      });
      res.json(tickets);
    },
  );
});

// Получить детали обращения (с ответами)
router.get("/api/support/tickets/:id", verifyToken, (req, res) => {
  const ticketId = req.params.id;
  db.get(
    `SELECT t.*, u.fullname as user_name, u.username as user_username, u.email as user_email
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     WHERE t.id = ?`,
    [ticketId],
    (err, ticket) => {
      if (err) {
        console.error("Ошибка получения обращения:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!ticket)
        return res.status(404).json({ error: "Обращение не найдено" });

      try {
        ticket.photos = ticket.photos ? JSON.parse(ticket.photos) : [];
      } catch (e) {
        ticket.photos = [];
      }

      // Проверка прав: автор или админ
      db.get(
        `SELECT role FROM users WHERE id = ?`,
        [req.userId],
        (err, user) => {
          if (err) return res.status(500).json({ error: "Ошибка сервера" });
          const isAdmin = user && ["admin", "main_admin"].includes(user.role);
          if (ticket.user_id != req.userId && !isAdmin) {
            return res
              .status(403)
              .json({ error: "Нет доступа к этому обращению" });
          }

          db.all(
            `SELECT r.*, u.fullname as user_name, u.username as user_username, u.role as user_role
           FROM support_replies r
           JOIN users u ON r.user_id = u.id
           WHERE r.ticket_id = ?
           ORDER BY r.created_at ASC`,
            [ticketId],
            (err, replies) => {
              if (err) {
                console.error("Ошибка получения ответов:", err.message);
                return res.status(500).json({ error: "Ошибка сервера" });
              }
              replies = (replies || []).map((reply) => {
                try {
                  reply.photos = reply.photos ? JSON.parse(reply.photos) : [];
                } catch (e) {
                  reply.photos = [];
                }
                return reply;
              });
              res.json({ ticket, replies });
            },
          );
        },
      );
    },
  );
});

// Ответить на обращение
router.post("/api/support/tickets/:id/reply", verifyToken, (req, res) => {
  const ticketId = req.params.id;
  const { message, photos = [] } = req.body;

  if (!message || message.trim() === "") {
    return res.status(400).json({ message: "Сообщение не может быть пустым" });
  }

  const photosJson = JSON.stringify(photos);

  db.get(
    `SELECT t.*, u.role as user_role 
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     WHERE t.id = ?`,
    [ticketId],
    (err, ticket) => {
      if (err) {
        console.error("Ошибка проверки тикета:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      if (!ticket)
        return res.status(404).json({ error: "Обращение не найдено" });

      db.get(
        `SELECT role FROM users WHERE id = ?`,
        [req.userId],
        (err, user) => {
          if (err) return res.status(500).json({ message: "Ошибка сервера" });
          const isAdmin = user && ["admin", "main_admin"].includes(user.role);
          const isAuthor = ticket.user_id == req.userId;
          if (!isAuthor && !isAdmin) {
            return res
              .status(403)
              .json({ error: "Нет права отвечать на это обращение" });
          }

          const isAdminReply = isAdmin;
          db.run(
            `INSERT INTO support_replies (ticket_id, user_id, message, is_admin, photos) VALUES (?, ?, ?, ?, ?)`,
            [
              ticketId,
              req.userId,
              message.trim(),
              isAdminReply ? 1 : 0,
              photosJson,
            ],
            function (err) {
              if (err) {
                console.error("Ошибка добавления ответа:", err.message);
                return res.status(500).json({ message: "Ошибка сервера" });
              }
              if (isAdminReply && ticket.status === "open") {
                db.run(
                  `UPDATE support_tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [ticketId],
                );
              }
              res.json({
                message: "Ответ добавлен",
                replyId: this.lastID,
                photos,
              });
            },
          );
        },
      );
    },
  );
});

module.exports = router;
