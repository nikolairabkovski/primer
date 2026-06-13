// routes/admin.js
const express = require("express");
const db = require("../config/db");
const {
  verifyToken,
  checkAdmin,
  checkMainAdmin,
} = require("../middleware/auth");
const { uploadNewsImage } = require("../config/multer");

const router = express.Router();

// ============ Модерация новостей ============
router.get("/api/moderate/news", verifyToken, checkAdmin, (req, res) => {
  db.all(
    `SELECT n.*, u.fullname as author_name, u.username as author_username
     FROM news n
     JOIN users u ON n.author_id = u.id
     WHERE n.status = 'pending'
     ORDER BY n.created_at ASC`,
    [],
    (err, news) => {
      if (err) {
        console.error("Ошибка получения новостей на модерацию:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(news || []);
    },
  );
});

router.put("/api/moderate/news/:id", verifyToken, checkAdmin, (req, res) => {
  const newsId = req.params.id;
  const { status } = req.body; // 'approved' или 'rejected'
  if (!["approved", "rejected"].includes(status))
    return res.status(400).json({ message: "Неверный статус" });

  const publishedAt = status === "approved" ? "CURRENT_TIMESTAMP" : "NULL";
  db.run(
    `UPDATE news 
     SET status = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP,
         published_at = ${publishedAt}
     WHERE id = ?`,
    [status, req.userId, newsId],
    function (err) {
      if (err) {
        console.error("Ошибка модерации:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      res.json({
        message:
          status === "approved" ? "Новость опубликована" : "Новость отклонена",
      });
    },
  );
});

// ============ Управление пользователями (админ) ============
// Получить всех пользователей
router.get("/api/admin/users", verifyToken, checkAdmin, (req, res) => {
  db.all(
    `SELECT id, fullname, nickname, username, email, role, city, birthdate, club, bio, avatar, is_online,
            (SELECT COUNT(*) FROM support_tickets WHERE user_id = users.id) as tickets_count
     FROM users
     ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Ошибка получения пользователей:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(rows || []);
    },
  );
});

// Получить пользователя по ID
router.get("/api/admin/users/:id", verifyToken, checkAdmin, (req, res) => {
  const userId = req.params.id;
  db.get(
    `SELECT id, fullname, nickname, username, email, role, city, birthdate, club, bio, avatar, is_online
     FROM users WHERE id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error("Ошибка получения пользователя:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!user)
        return res.status(404).json({ error: "Пользователь не найден" });
      res.json(user);
    },
  );
});

// Обновить пользователя (админ)
router.put("/api/admin/users/:id", verifyToken, checkAdmin, (req, res) => {
  const targetUserId = req.params.id;
  const { fullname, nickname, username, email, city, birthdate, club, bio } =
    req.body;

  // Проверка прав: админ не может редактировать главного админа
  const proceed = (callback) => {
    if (req.userRole === "admin") {
      db.get(
        `SELECT role FROM users WHERE id = ?`,
        [targetUserId],
        (err, user) => {
          if (err || !user)
            return res.status(404).json({ error: "Пользователь не найден" });
          if (user.role === "main_admin")
            return res
              .status(403)
              .json({ error: "Админ не может редактировать главного админа" });
          callback();
        },
      );
    } else {
      callback();
    }
  };

  proceed(() => {
    db.run(
      `UPDATE users 
       SET fullname = ?, nickname = ?, username = ?, email = ?, 
           city = ?, birthdate = ?, club = ?, bio = ?
       WHERE id = ?`,
      [
        fullname || "",
        nickname || "",
        username || "",
        email || "",
        city || "",
        birthdate || "",
        club || "",
        bio || "",
        targetUserId,
      ],
      function (err) {
        if (err) {
          console.error("Ошибка обновления пользователя:", err.message);
          if (err.message.includes("UNIQUE")) {
            return res
              .status(400)
              .json({ message: "Username или email уже используются" });
          }
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({ message: "Данные пользователя обновлены" });
      },
    );
  });
});

// Изменить роль (только main_admin)
router.put(
  "/api/admin/users/:id/role",
  verifyToken,
  checkMainAdmin,
  (req, res) => {
    const targetUserId = req.params.id;
    const { role } = req.body; // 'user', 'admin'
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "Недопустимая роль" });

    db.get(
      `SELECT role FROM users WHERE id = ?`,
      [targetUserId],
      (err, user) => {
        if (err || !user)
          return res.status(404).json({ error: "Пользователь не найден" });
        if (user.role === "main_admin")
          return res
            .status(403)
            .json({ error: "Нельзя изменить роль главного админа" });

        db.run(
          `UPDATE users SET role = ? WHERE id = ?`,
          [role, targetUserId],
          function (err) {
            if (err) {
              console.error("Ошибка обновления роли:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({
              message: `Роль пользователя изменена на ${role}`,
              newRole: role,
            });
          },
        );
      },
    );
  },
);

// Удалить пользователя (только main_admin)
router.delete(
  "/api/admin/users/:id",
  verifyToken,
  checkMainAdmin,
  (req, res) => {
    const targetUserId = req.params.id;
    if (targetUserId == req.userId)
      return res.status(400).json({ error: "Нельзя удалить самого себя" });

    db.get(
      `SELECT role FROM users WHERE id = ?`,
      [targetUserId],
      (err, user) => {
        if (err || !user)
          return res.status(404).json({ error: "Пользователь не найден" });
        if (user.role === "main_admin")
          return res
            .status(403)
            .json({ error: "Нельзя удалить главного админа" });

        db.run(
          `DELETE FROM users WHERE id = ?`,
          [targetUserId],
          function (err) {
            if (err) {
              console.error("Ошибка удаления пользователя:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({ message: "Пользователь удален" });
          },
        );
      },
    );
  },
);

// ============ Управление новостями (админ) ============
router.get("/api/admin/news", verifyToken, checkAdmin, (req, res) => {
  const { status = "all" } = req.query;
  let query = `
    SELECT n.*, 
           u.fullname as author_name, u.username as author_username,
           (SELECT COUNT(*) FROM news_comments WHERE news_id = n.id) as comments_count,
           (SELECT COUNT(*) FROM news_likes WHERE news_id = n.id AND type = 'like') as likes_count,
           (SELECT COUNT(*) FROM news_likes WHERE news_id = n.id AND type = 'dislike') as dislikes_count
    FROM news n
    JOIN users u ON n.author_id = u.id
  `;
  const params = [];
  if (status !== "all") {
    query += ` WHERE n.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY n.created_at DESC`;
  db.all(query, params, (err, news) => {
    if (err) {
      console.error("Ошибка получения новостей:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json(news || []);
  });
});

router.put(
  "/api/admin/news/:id",
  verifyToken,
  checkAdmin,
  uploadNewsImage.single("image"),
  (req, res) => {
    const newsId = req.params.id;
    const { title, content } = req.body;
    if (!title || !content)
      return res.status(400).json({ message: "Заголовок и текст обязательны" });

    let query = `UPDATE news SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP`;
    const params = [title, content];
    if (req.file) {
      const imageUrl = `/uploads/${req.file.filename}`;
      query += `, image = ?`;
      params.push(imageUrl);
    }
    query += ` WHERE id = ?`;
    params.push(newsId);

    db.run(query, params, function (err) {
      if (err) {
        console.error("Ошибка обновления новости:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      res.json({ message: "Новость обновлена", changes: this.changes });
    });
  },
);

router.delete("/api/admin/news/:id", verifyToken, checkAdmin, (req, res) => {
  const newsId = req.params.id;
  db.run(`DELETE FROM news WHERE id = ?`, [newsId], function (err) {
    if (err) {
      console.error("Ошибка удаления новости:", err.message);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
    res.json({ message: "Новость удалена", deleted: this.changes });
  });
});

router.put(
  "/api/admin/news/:id/status",
  verifyToken,
  checkAdmin,
  (req, res) => {
    const newsId = req.params.id;
    const { status } = req.body; // 'pending', 'approved', 'rejected'
    if (!["pending", "approved", "rejected"].includes(status))
      return res.status(400).json({ message: "Неверный статус" });

    const publishedAt = status === "approved" ? "CURRENT_TIMESTAMP" : "NULL";
    db.run(
      `UPDATE news 
     SET status = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP,
         published_at = ${publishedAt}
     WHERE id = ?`,
      [status, req.userId, newsId],
      function (err) {
        if (err) {
          console.error("Ошибка обновления статуса:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({ message: `Статус изменен на ${status}`, status });
      },
    );
  },
);

// ============ Управление комментариями (админ) ============
router.get("/api/admin/comments", verifyToken, checkAdmin, (req, res) => {
  const { status = "all" } = req.query;
  let query = `
    SELECT c.*, 
           u.fullname as user_name, u.username as user_username, u.email as user_email,
           n.title as news_title, n.id as news_id
    FROM news_comments c
    JOIN users u ON c.user_id = u.id
    JOIN news n ON c.news_id = n.id
  `;
  const params = [];
  if (status !== "all") {
    query += ` WHERE c.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY c.created_at DESC`;
  db.all(query, params, (err, comments) => {
    if (err) {
      console.error("Ошибка получения комментариев:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json(comments || []);
  });
});

router.post(
  "/api/admin/comments/:id/reply",
  verifyToken,
  checkAdmin,
  (req, res) => {
    const commentId = req.params.id;
    const { reply } = req.body;
    if (!reply || reply.trim() === "")
      return res.status(400).json({ message: "Ответ не может быть пустым" });

    db.get(
      `SELECT c.*, n.id as news_id FROM news_comments c JOIN news n ON c.news_id = n.id WHERE c.id = ?`,
      [commentId],
      (err, comment) => {
        if (err) {
          console.error("Ошибка получения комментария:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        if (!comment)
          return res.status(404).json({ error: "Комментарий не найден" });

        db.run(
          `INSERT INTO news_comments (news_id, user_id, content, parent_id, is_admin_reply) 
       VALUES (?, ?, ?, ?, 1)`,
          [comment.news_id, req.userId, reply.trim(), commentId],
          function (err) {
            if (err) {
              console.error("Ошибка создания ответа:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            db.run(
              `UPDATE news_comments SET has_admin_reply = 1 WHERE id = ?`,
              [commentId],
            );
            res.json({ message: "Ответ добавлен", replyId: this.lastID });
          },
        );
      },
    );
  },
);

router.delete(
  "/api/admin/comments/:id",
  verifyToken,
  checkAdmin,
  (req, res) => {
    const commentId = req.params.id;
    db.run(
      `DELETE FROM news_comments WHERE id = ?`,
      [commentId],
      function (err) {
        if (err) {
          console.error("Ошибка удаления комментария:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({ message: "Комментарий удален", deleted: this.changes });
      },
    );
  },
);

router.put(
  "/api/admin/comments/:id/toggle",
  verifyToken,
  checkAdmin,
  (req, res) => {
    const commentId = req.params.id;
    db.get(
      `SELECT is_hidden FROM news_comments WHERE id = ?`,
      [commentId],
      (err, comment) => {
        if (err) {
          console.error("Ошибка получения комментария:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        const newStatus = comment.is_hidden ? 0 : 1;
        db.run(
          `UPDATE news_comments SET is_hidden = ? WHERE id = ?`,
          [newStatus, commentId],
          function (err) {
            if (err) {
              console.error("Ошибка обновления комментария:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({
              message: newStatus ? "Комментарий скрыт" : "Комментарий показан",
              is_hidden: newStatus,
            });
          },
        );
      },
    );
  },
);

// ============ Управление обращениями техподдержки (админ) ============
router.get(
  "/api/admin/support/tickets",
  verifyToken,
  checkAdmin,
  (req, res) => {
    const { status = "all" } = req.query;
    let query = `
    SELECT t.*, u.fullname as user_name, u.username as user_username, u.email as user_email,
           (SELECT COUNT(*) FROM support_replies WHERE ticket_id = t.id) as replies_count
    FROM support_tickets t
    JOIN users u ON t.user_id = u.id
  `;
    const params = [];
    if (status !== "all") {
      query += ` WHERE t.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY 
    CASE t.priority 
      WHEN 'high' THEN 1 
      WHEN 'medium' THEN 2 
      WHEN 'low' THEN 3 
    END, t.created_at ASC`;
    db.all(query, params, (err, tickets) => {
      if (err) {
        console.error("Ошибка получения обращений:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(tickets || []);
    });
  },
);

router.put(
  "/api/admin/support/tickets/:id/status",
  verifyToken,
  checkAdmin,
  (req, res) => {
    const ticketId = req.params.id;
    const { status } = req.body; // 'open', 'in_progress', 'closed'
    if (!["open", "in_progress", "closed"].includes(status))
      return res.status(400).json({ message: "Неверный статус" });

    const closedAt = status === "closed" ? "CURRENT_TIMESTAMP" : "NULL";
    db.run(
      `UPDATE support_tickets 
     SET status = ?, updated_at = CURRENT_TIMESTAMP, closed_at = ${closedAt}
     WHERE id = ?`,
      [status, ticketId],
      function (err) {
        if (err) {
          console.error("Ошибка обновления статуса:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({ message: `Статус изменен на ${status}` });
      },
    );
  },
);

module.exports = router;
