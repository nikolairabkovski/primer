// routes/clubs.js
const express = require("express");
const db = require("../config/db");
const { verifyToken, checkClubModerator } = require("../middleware/auth");
const { uploadClubAvatar, uploadNewsImage } = require("../config/multer");

const router = express.Router();

// ============ Базовые эндпоинты клубов ============
router.get("/api/clubs/popular", (req, res) => {
  const limit = parseInt(req.query.limit) || 3;
  db.all(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
            (SELECT COUNT(*) FROM club_posts WHERE club_id = c.id) as posts_count
     FROM clubs c
     ORDER BY members_count DESC, posts_count DESC
     LIMIT ?`,
    [limit],
    (err, clubs) => {
      if (err) {
        console.error("Ошибка получения популярных клубов:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(clubs || []);
    },
  );
});

// ВСЕ КЛУБЫ С ПАГИНАЦИЕЙ (для админки)
router.get("/api/clubs/all", (req, res) => {
  const { page = 1, limit = 12, sort = "popular" } = req.query;
  const offset = (page - 1) * limit;
  let orderBy = "";
  let query = `
    SELECT c.*, 
           (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
           (SELECT COUNT(*) FROM club_posts WHERE club_id = c.id) as posts_count
    FROM clubs c
  `;
  switch (sort) {
    case "newest":
      orderBy = "c.created_at DESC";
      break;
    case "oldest":
      orderBy = "c.created_at ASC";
      break;
    case "name":
      orderBy = "c.name ASC";
      break;
    default:
      orderBy = "members_count DESC, c.created_at DESC";
  }
  query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  db.all(query, [parseInt(limit), parseInt(offset)], (err, clubs) => {
    if (err) {
      console.error("Ошибка получения всех клубов:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    db.get(`SELECT COUNT(*) as total FROM clubs`, [], (err, count) => {
      if (err) return res.json({ clubs: clubs || [], total: 0 });
      res.json({
        clubs: clubs || [],
        total: count.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count.total / limit),
      });
    });
  });
});

router.get("/api/clubs/search", (req, res) => {
  const { query } = req.query;
  if (!query || query.length < 2) return res.json([]);
  db.all(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
            (SELECT COUNT(*) FROM club_followers WHERE club_id = c.id) as followers_count
     FROM clubs c
     WHERE c.name LIKE ? OR c.username LIKE ?
     LIMIT 20`,
    [`%${query}%`, `%${query}%`],
    (err, clubs) => {
      if (err) {
        console.error("Ошибка поиска клубов:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(clubs || []);
    },
  );
});

router.get("/api/clubs/recommended", (req, res) => {
  db.all(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
            (SELECT COUNT(*) FROM club_posts WHERE club_id = c.id) as posts_count
     FROM clubs c
     ORDER BY RANDOM()
     LIMIT 3`,
    [],
    (err, clubs) => {
      if (err) {
        console.error("Ошибка получения рекомендуемых клубов:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(clubs || []);
    },
  );
});

router.get("/api/clubs/check-username", (req, res) => {
  const { username } = req.query;
  if (!username || username.length < 3)
    return res.json({ available: false, message: "Слишком короткий username" });
  db.get(`SELECT id FROM clubs WHERE username = ?`, [username], (err, club) => {
    if (err) {
      console.error("Ошибка проверки username:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json({ available: !club, username });
  });
});

router.get("/api/clubs/:username", (req, res) => {
  const username = req.params.username;
  db.get(
    `SELECT c.*, 
            u.fullname as creator_name, u.username as creator_username,
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
            (SELECT COUNT(*) FROM club_followers WHERE club_id = c.id) as followers_count,
            (SELECT COUNT(*) FROM club_posts WHERE club_id = c.id) as posts_count
     FROM clubs c
     JOIN users u ON c.creator_id = u.id
     WHERE c.username = ?`,
    [username],
    (err, club) => {
      if (err) {
        console.error("Ошибка получения клуба:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!club) return res.status(404).json({ error: "Клуб не найден" });
      res.json(club);
    },
  );
});

// Информация о клубе с ролью пользователя
router.get("/api/clubs/:id/info", verifyToken, (req, res) => {
  const clubId = req.params.id;
  db.get(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
            (SELECT COUNT(*) FROM club_followers WHERE club_id = c.id) as followers_count
     FROM clubs c
     WHERE c.id = ?`,
    [clubId],
    (err, club) => {
      if (err) {
        console.error("Ошибка получения информации о клубе:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!club) return res.status(404).json({ error: "Клуб не найден" });

      // Получаем роль пользователя в клубе
      db.get(
        `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
        [clubId, req.userId],
        (err, member) => {
          let userRole = null;
          let isMember = false;
          if (!err && member) {
            userRole = member.role;
            isMember = true;
          }
          db.get(
            `SELECT * FROM club_followers WHERE club_id = ? AND user_id = ?`,
            [clubId, req.userId],
            (err, follower) => {
              const isFollower = !!follower;
              res.json({ ...club, userRole, isMember, isFollower });
            },
          );
        },
      );
    },
  );
});

// Создание клуба
router.post("/api/clubs", verifyToken, (req, res) => {
  uploadClubAvatar.single("avatar")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const {
      name,
      username,
      description,
      city,
      stadium,
      founded_year,
      website,
      is_private,
    } = req.body;
    if (!name || !username)
      return res
        .status(400)
        .json({ message: "Название и username обязательны" });

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message:
          "Username может содержать только латинские буквы, цифры и подчеркивание",
      });
    }

    db.get(
      `SELECT id FROM clubs WHERE username = ?`,
      [username],
      (err, existing) => {
        if (err) {
          console.error("Ошибка проверки username:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        if (existing)
          return res
            .status(400)
            .json({ message: "Клуб с таким username уже существует" });

        const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;
        db.run(
          `INSERT INTO clubs (name, username, description, avatar, creator_id, city, stadium, founded_year, website, is_private)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            username,
            description || "",
            avatarUrl,
            req.userId,
            city || "",
            stadium || "",
            founded_year || null,
            website || "",
            is_private === "true" ? 1 : 0,
          ],
          function (err) {
            if (err) {
              console.error("Ошибка создания клуба:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            const clubId = this.lastID;
            db.run(
              `INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, 'creator')`,
              [clubId, req.userId],
            );
            res.json({ message: "Клуб успешно создан", clubId, username });
          },
        );
      },
    );
  });
});

// Обновление клуба
router.put(
  "/api/clubs/:clubId",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    uploadClubAvatar.single("avatar")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      const {
        name,
        description,
        city,
        stadium,
        founded_year,
        website,
        is_private,
      } = req.body;

      let query = `UPDATE clubs SET 
      name = ?, description = ?, city = ?, stadium = ?, 
      founded_year = ?, website = ?, is_private = ?, updated_at = CURRENT_TIMESTAMP`;
      const params = [
        name || "",
        description || "",
        city || "",
        stadium || "",
        founded_year || null,
        website || "",
        is_private ? 1 : 0,
      ];

      if (req.file) {
        const avatarUrl = `/uploads/${req.file.filename}`;
        query += `, avatar = ?`;
        params.push(avatarUrl);
      }
      query += ` WHERE id = ?`;
      params.push(clubId);

      db.run(query, params, function (err) {
        if (err) {
          console.error("Ошибка обновления клуба:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({ message: "Информация о клубе обновлена" });
      });
    });
  },
);

router.delete("/api/clubs/:clubId", verifyToken, (req, res) => {
  const clubId = req.params.clubId;
  db.get(
    `SELECT role FROM club_members WHERE club_id = ? AND user_id = ? AND role = 'creator'`,
    [clubId, req.userId],
    (err, member) => {
      if (err || !member)
        return res
          .status(403)
          .json({ error: "Только создатель может удалить клуб" });
      db.run(`DELETE FROM clubs WHERE id = ?`, [clubId], function (err) {
        if (err) {
          console.error("Ошибка удаления клуба:", err.message);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        res.json({ message: "Клуб удален" });
      });
    },
  );
});

// Получить все клубы с пагинацией
router.get("/api/clubs/all", (req, res) => {
  const { page = 1, limit = 12, sort = "popular" } = req.query;
  const offset = (page - 1) * limit;
  let orderBy = "";
  let query = `
    SELECT c.*, 
           (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
           (SELECT COUNT(*) FROM club_posts WHERE club_id = c.id) as posts_count
    FROM clubs c
  `;
  switch (sort) {
    case "newest":
      orderBy = "c.created_at DESC";
      break;
    case "oldest":
      orderBy = "c.created_at ASC";
      break;
    case "name":
      orderBy = "c.name ASC";
      break;
    default:
      orderBy = "members_count DESC, c.created_at DESC";
  }
  query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  db.all(query, [parseInt(limit), parseInt(offset)], (err, clubs) => {
    if (err) {
      console.error("Ошибка получения всех клубов:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    db.get(`SELECT COUNT(*) as total FROM clubs`, [], (err, count) => {
      if (err) return res.json({ clubs: clubs || [], total: 0 });
      res.json({
        clubs: clubs || [],
        total: count.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count.total / limit),
      });
    });
  });
});

// ============ Посты в клубе ============
router.get("/api/clubs/:clubId/posts", (req, res) => {
  const clubId = req.params.clubId;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  db.all(
    `SELECT p.*, 
            u.fullname as author_name, u.username as author_username, u.avatar as author_avatar,
            (SELECT COUNT(*) FROM club_post_likes WHERE post_id = p.id AND type = 'like') as likes_count,
            (SELECT COUNT(*) FROM club_post_likes WHERE post_id = p.id AND type = 'dislike') as dislikes_count,
            (SELECT COUNT(*) FROM club_post_comments WHERE post_id = p.id) as comments_count
     FROM club_posts p
     JOIN users u ON p.author_id = u.id
     WHERE p.club_id = ?
     ORDER BY p.pinned DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [clubId, parseInt(limit), parseInt(offset)],
    (err, posts) => {
      if (err) {
        console.error("Ошибка получения постов клуба:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      db.get(
        `SELECT COUNT(*) as total FROM club_posts WHERE club_id = ?`,
        [clubId],
        (err, count) => {
          res.json({
            posts: posts || [],
            total: count.total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count.total / limit),
          });
        },
      );
    },
  );
});

router.post("/api/clubs/:clubId/posts", verifyToken, (req, res) => {
  const clubId = req.params.clubId;
  uploadNewsImage.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { content } = req.body;
    if (!content)
      return res.status(400).json({ message: "Текст поста обязателен" });

    db.get(
      `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, member) => {
        if (err || !member)
          return res
            .status(403)
            .json({ error: "Только участники клуба могут создавать посты" });
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        db.run(
          `INSERT INTO club_posts (club_id, author_id, content, image) VALUES (?, ?, ?, ?)`,
          [clubId, req.userId, content, imageUrl],
          function (err) {
            if (err) {
              console.error("Ошибка создания поста:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({ message: "Пост создан", postId: this.lastID });
          },
        );
      },
    );
  });
});

router.put("/api/clubs/posts/:postId/pin", verifyToken, (req, res) => {
  const postId = req.params.postId;
  const { pinned } = req.body;
  db.get(
    `SELECT p.*, c.id as club_id FROM club_posts p JOIN clubs c ON p.club_id = c.id WHERE p.id = ?`,
    [postId],
    (err, post) => {
      if (err || !post)
        return res.status(404).json({ error: "Пост не найден" });
      db.get(
        `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
        [post.club_id, req.userId],
        (err, member) => {
          if (
            err ||
            !member ||
            !["creator", "admin", "moderator"].includes(member.role)
          )
            return res.status(403).json({ error: "Недостаточно прав" });
          db.run(
            `UPDATE club_posts SET pinned = ? WHERE id = ?`,
            [pinned ? 1 : 0, postId],
            function (err) {
              if (err) {
                console.error("Ошибка обновления пина:", err.message);
                return res.status(500).json({ message: "Ошибка сервера" });
              }
              res.json({
                message: pinned ? "Пост закреплен" : "Пост откреплен",
              });
            },
          );
        },
      );
    },
  );
});

router.delete("/api/clubs/posts/:postId", verifyToken, (req, res) => {
  const postId = req.params.postId;
  db.get(
    `SELECT p.*, c.id as club_id FROM club_posts p JOIN clubs c ON p.club_id = c.id WHERE p.id = ?`,
    [postId],
    (err, post) => {
      if (err || !post)
        return res.status(404).json({ error: "Пост не найден" });

      const deletePost = () => {
        db.run(`DELETE FROM club_posts WHERE id = ?`, [postId], function (err) {
          if (err) {
            console.error("Ошибка удаления поста:", err.message);
            return res.status(500).json({ message: "Ошибка сервера" });
          }
          res.json({ message: "Пост удален" });
        });
      };

      if (post.author_id == req.userId) {
        deletePost();
      } else {
        db.get(
          `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
          [post.club_id, req.userId],
          (err, member) => {
            if (
              err ||
              !member ||
              !["creator", "admin", "moderator"].includes(member.role)
            )
              return res.status(403).json({ error: "Недостаточно прав" });
            deletePost();
          },
        );
      }
    },
  );
});

router.post("/api/clubs/posts/:postId/like", verifyToken, (req, res) => {
  const postId = req.params.postId;
  const { type } = req.body;
  if (!["like", "dislike"].includes(type))
    return res.status(400).json({ message: "Неверный тип" });

  db.get(
    `SELECT * FROM club_post_likes WHERE post_id = ? AND user_id = ?`,
    [postId, req.userId],
    (err, existing) => {
      if (err) {
        console.error("Ошибка проверки лайка:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      if (existing) {
        if (existing.type === type) {
          db.run(
            `DELETE FROM club_post_likes WHERE post_id = ? AND user_id = ?`,
            [postId, req.userId],
            (err) => {
              if (err) {
                console.error("Ошибка удаления оценки:", err.message);
                return res.status(500).json({ message: "Ошибка сервера" });
              }
              res.json({ message: "Оценка удалена", action: "removed" });
            },
          );
        } else {
          db.run(
            `UPDATE club_post_likes SET type = ? WHERE post_id = ? AND user_id = ?`,
            [type, postId, req.userId],
            (err) => {
              if (err) {
                console.error("Ошибка обновления оценки:", err.message);
                return res.status(500).json({ message: "Ошибка сервера" });
              }
              res.json({ message: "Оценка изменена", action: "updated", type });
            },
          );
        }
      } else {
        db.run(
          `INSERT INTO club_post_likes (post_id, user_id, type) VALUES (?, ?, ?)`,
          [postId, req.userId, type],
          (err) => {
            if (err) {
              console.error("Ошибка создания оценки:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({ message: "Оценка добавлена", action: "added", type });
          },
        );
      }
    },
  );
});

// Комментарии к постам клуба
router.get("/api/clubs/posts/:postId/comments", (req, res) => {
  const postId = req.params.postId;
  db.all(
    `SELECT c.*, u.fullname as user_name, u.username as user_username, u.avatar as user_avatar
     FROM club_post_comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [postId],
    (err, comments) => {
      if (err) {
        console.error("Ошибка получения комментариев:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(comments || []);
    },
  );
});

router.post("/api/clubs/posts/:postId/comments", verifyToken, (req, res) => {
  const postId = req.params.postId;
  const { content } = req.body;
  if (!content || content.trim() === "")
    return res
      .status(400)
      .json({ message: "Комментарий не может быть пустым" });

  db.run(
    `INSERT INTO club_post_comments (post_id, user_id, content) VALUES (?, ?, ?)`,
    [postId, req.userId, content.trim()],
    function (err) {
      if (err) {
        console.error("Ошибка добавления комментария:", err.message);
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      db.get(
        `SELECT c.*, u.fullname as user_name, u.username as user_username, u.avatar as user_avatar
       FROM club_post_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
        [this.lastID],
        (err, comment) => {
          if (err)
            return res.json({
              message: "Комментарий добавлен",
              id: this.lastID,
            });
          res.json({ message: "Комментарий добавлен", comment });
        },
      );
    },
  );
});

// ============ Подписка на клуб ============
router.post("/api/clubs/:clubId/subscribe", verifyToken, (req, res) => {
  const clubId = req.params.clubId;
  db.get(`SELECT id FROM clubs WHERE id = ?`, [clubId], (err, club) => {
    if (err || !club) return res.status(404).json({ error: "Клуб не найден" });
    db.get(
      `SELECT id FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, existing) => {
        if (existing)
          return res
            .status(400)
            .json({ error: "Вы уже подписаны на этот клуб" });
        db.run(
          `INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES (?, ?, 'member', CURRENT_TIMESTAMP)`,
          [clubId, req.userId],
          function (err) {
            if (err) {
              console.error("Ошибка при подписке:", err.message);
              return res.status(500).json({ error: "Ошибка при подписке" });
            }
            db.run(
              `INSERT OR IGNORE INTO club_followers (club_id, user_id) VALUES (?, ?)`,
              [clubId, req.userId],
            );
            res.json({
              message: "Вы успешно подписались на клуб",
              isSubscribed: true,
            });
          },
        );
      },
    );
  });
});

router.delete("/api/clubs/:clubId/unsubscribe", verifyToken, (req, res) => {
  const clubId = req.params.clubId;
  db.get(
    `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
    [clubId, req.userId],
    (err, member) => {
      if (err || !member)
        return res.status(404).json({ error: "Вы не подписаны на этот клуб" });
      if (member.role === "creator")
        return res
          .status(400)
          .json({ error: "Создатель не может отписаться от клуба" });
      db.run(
        `DELETE FROM club_members WHERE club_id = ? AND user_id = ?`,
        [clubId, req.userId],
        function (err) {
          if (err) {
            console.error("Ошибка при отписке:", err.message);
            return res.status(500).json({ error: "Ошибка при отписке" });
          }
          db.run(
            `DELETE FROM club_followers WHERE club_id = ? AND user_id = ?`,
            [clubId, req.userId],
          );
          res.json({ message: "Вы успешно отписались от клуба" });
        },
      );
    },
  );
});

router.get("/api/user/subscriptions", verifyToken, (req, res) => {
  db.all(
    `SELECT c.*, 
            cm.role,
            cm.joined_at as subscribed_at,
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as members_count,
            (SELECT COUNT(*) FROM club_posts WHERE club_id = c.id) as posts_count
     FROM club_members cm
     JOIN clubs c ON cm.club_id = c.id
     WHERE cm.user_id = ?
     ORDER BY cm.joined_at DESC`,
    [req.userId],
    (err, subscriptions) => {
      if (err) {
        console.error("Ошибка получения подписок:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(subscriptions || []);
    },
  );
});

router.get("/api/clubs/:clubId/subscribers", (req, res) => {
  const clubId = req.params.clubId;
  db.all(
    `SELECT u.id, u.fullname, u.username, u.avatar, u.is_online,
           cm.role, cm.joined_at as subscribed_at,
           cm.banned_until, cm.ban_reason,
           cm.comment_banned_until, cm.comment_ban_reason,
           (SELECT COUNT(*) FROM club_posts WHERE author_id = u.id AND club_id = ?) as user_posts_count
    FROM club_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.club_id = ?
    ORDER BY 
      CASE cm.role 
        WHEN 'creator' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'moderator' THEN 3
        ELSE 4
      END, 
      cm.joined_at DESC`,
    [clubId, clubId],
    (err, subscribers) => {
      if (err) {
        console.error("Ошибка получения подписчиков:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(subscribers || []);
    },
  );
});

router.get(
  "/api/clubs/:clubId/subscription-status",
  verifyToken,
  (req, res) => {
    const clubId = req.params.clubId;
    db.get(
      `SELECT role, joined_at FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, member) => {
        if (err) {
          console.error("Ошибка проверки подписки:", err.message);
          return res.status(500).json({ error: "Ошибка сервера" });
        }
        res.json({
          isSubscribed: !!member,
          role: member ? member.role : null,
          subscribedAt: member ? member.joined_at : null,
        });
      },
    );
  },
);

// ============ Управление участниками клуба (роли, баны) ============
router.get("/api/clubs/:clubId/members", (req, res) => {
  const clubId = req.params.clubId;
  db.all(
    `SELECT u.id, u.fullname, u.username, u.avatar, u.is_online,
            cm.role, cm.joined_at,
            cm.banned_until, cm.ban_reason,
            cm.comment_banned_until, cm.comment_ban_reason
     FROM club_members cm
     JOIN users u ON cm.user_id = u.id
     WHERE cm.club_id = ?
     ORDER BY 
       CASE cm.role 
         WHEN 'creator' THEN 1
         WHEN 'admin' THEN 2
         WHEN 'moderator' THEN 3
         ELSE 4
       END, u.fullname`,
    [clubId],
    (err, members) => {
      if (err) {
        console.error("Ошибка получения участников:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(members || []);
    },
  );
});

router.put(
  "/api/clubs/:clubId/members/:userId/role",
  verifyToken,
  (req, res) => {
    const clubId = req.params.clubId;
    const targetUserId = req.params.userId;
    const { role } = req.body;
    if (!["member", "moderator", "admin"].includes(role))
      return res.status(400).json({ message: "Недопустимая роль" });

    db.get(
      `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, currentMember) => {
        if (
          err ||
          !currentMember ||
          !["creator", "admin"].includes(currentMember.role)
        )
          return res.status(403).json({ error: "Недостаточно прав" });
        db.get(
          `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
          [clubId, targetUserId],
          (err, targetMember) => {
            if (err || !targetMember)
              return res.status(404).json({ error: "Пользователь не найден" });
            if (targetMember.role === "creator")
              return res
                .status(403)
                .json({ error: "Нельзя изменить роль создателя" });
            if (currentMember.role === "admin" && targetMember.role === "admin")
              return res
                .status(403)
                .json({ error: "Админ не может изменять роль другого админа" });
            db.run(
              `UPDATE club_members SET role = ? WHERE club_id = ? AND user_id = ?`,
              [role, clubId, targetUserId],
              function (err) {
                if (err) {
                  console.error("Ошибка обновления роли:", err.message);
                  return res.status(500).json({ message: "Ошибка сервера" });
                }
                res.json({ message: "Роль изменена" });
              },
            );
          },
        );
      },
    );
  },
);

router.post(
  "/api/clubs/:clubId/members/:userId/ban",
  verifyToken,
  (req, res) => {
    const clubId = req.params.clubId;
    const targetUserId = req.params.userId;
    const { duration, reason } = req.body;

    db.get(
      `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, currentMember) => {
        if (
          err ||
          !currentMember ||
          !["creator", "admin", "moderator"].includes(currentMember.role)
        )
          return res.status(403).json({ error: "Недостаточно прав" });
        db.get(
          `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
          [clubId, targetUserId],
          (err, targetMember) => {
            if (err || !targetMember)
              return res.status(404).json({ error: "Пользователь не найден" });
            if (targetMember.role === "creator")
              return res
                .status(403)
                .json({ error: "Нельзя забанить создателя" });

            let bannedUntil = null;
            if (duration !== "permanent") {
              const days = parseInt(duration);
              bannedUntil = new Date();
              bannedUntil.setDate(bannedUntil.getDate() + days);
            }
            db.run(
              `UPDATE club_members 
         SET banned_until = ?, ban_reason = ?, banned_by = ?, banned_at = CURRENT_TIMESTAMP
         WHERE club_id = ? AND user_id = ?`,
              [bannedUntil, reason, req.userId, clubId, targetUserId],
              function (err) {
                if (err) {
                  console.error("Ошибка бана пользователя:", err.message);
                  return res.status(500).json({ error: "Ошибка сервера" });
                }
                res.json({ message: "Пользователь забанен" });
              },
            );
          },
        );
      },
    );
  },
);

router.post(
  "/api/clubs/:clubId/members/:userId/ban-comment",
  verifyToken,
  (req, res) => {
    const clubId = req.params.clubId;
    const targetUserId = req.params.userId;
    const { duration, reason } = req.body;

    db.get(
      `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, currentMember) => {
        if (
          err ||
          !currentMember ||
          !["creator", "admin", "moderator"].includes(currentMember.role)
        )
          return res.status(403).json({ error: "Недостаточно прав" });
        db.get(
          `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
          [clubId, targetUserId],
          (err, targetMember) => {
            if (err || !targetMember)
              return res.status(404).json({ error: "Пользователь не найден" });
            if (targetMember.role === "creator")
              return res
                .status(403)
                .json({ error: "Нельзя забанить создателя" });

            let bannedUntil = null;
            if (duration !== "permanent") {
              const days = parseInt(duration);
              bannedUntil = new Date();
              bannedUntil.setDate(bannedUntil.getDate() + days);
            }
            db.run(
              `UPDATE club_members 
         SET comment_banned_until = ?, comment_ban_reason = ?, comment_banned_by = ?, comment_banned_at = CURRENT_TIMESTAMP
         WHERE club_id = ? AND user_id = ?`,
              [bannedUntil, reason, req.userId, clubId, targetUserId],
              function (err) {
                if (err) {
                  console.error("Ошибка бана комментариев:", err.message);
                  return res.status(500).json({ error: "Ошибка сервера" });
                }
                res.json({
                  message: "Пользователь заблокирован в комментариях",
                });
              },
            );
          },
        );
      },
    );
  },
);

// ============ Заявки на вступление в закрытый клуб ============
router.get(
  "/api/clubs/:clubId/requests",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    db.all(
      `SELECT r.*, u.fullname, u.username, u.avatar, u.email
     FROM club_requests r
     JOIN users u ON r.user_id = u.id
     WHERE r.club_id = ? AND r.status = 'pending'
     ORDER BY r.created_at ASC`,
      [clubId],
      (err, requests) => {
        if (err) {
          console.error("Ошибка получения заявок:", err.message);
          return res.status(500).json({ error: "Ошибка сервера" });
        }
        res.json(requests || []);
      },
    );
  },
);

router.put(
  "/api/clubs/:clubId/requests/:requestId",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    const requestId = req.params.requestId;
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ message: "Неверный статус" });

    db.get(
      `SELECT * FROM club_requests WHERE id = ? AND club_id = ?`,
      [requestId, clubId],
      (err, request) => {
        if (err || !request)
          return res.status(404).json({ error: "Заявка не найдена" });
        db.run(
          `UPDATE club_requests SET status = ?, handled_at = CURRENT_TIMESTAMP, handled_by = ? WHERE id = ?`,
          [status, req.userId, requestId],
          function (err) {
            if (err) {
              console.error("Ошибка обновления заявки:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            if (status === "approved") {
              db.run(
                `INSERT INTO club_followers (club_id, user_id) VALUES (?, ?)`,
                [clubId, request.user_id],
              );
            }
            res.json({
              message:
                status === "approved" ? "Заявка одобрена" : "Заявка отклонена",
            });
          },
        );
      },
    );
  },
);

// ============ Предложение постов ============
router.post(
  "/api/clubs/:clubId/propose-post",
  verifyToken,
  uploadNewsImage.single("image"),
  (req, res) => {
    const clubId = req.params.clubId;
    const { content } = req.body;
    if (!content || content.trim() === "")
      return res.status(400).json({ message: "Текст поста обязателен" });

    db.get(
      `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, member) => {
        if (err || !member)
          return res
            .status(403)
            .json({ error: "Только подписчики могут предлагать посты" });
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        db.run(
          `INSERT INTO club_post_proposals (club_id, user_id, content, image, status) 
       VALUES (?, ?, ?, ?, 'pending')`,
          [clubId, req.userId, content, imageUrl],
          function (err) {
            if (err) {
              console.error("Ошибка создания предложения:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            res.json({
              message: "Пост отправлен на модерацию",
              proposalId: this.lastID,
            });
          },
        );
      },
    );
  },
);

router.get(
  "/api/clubs/:clubId/post-proposals",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    const { status = "pending" } = req.query;
    db.all(
      `SELECT p.*, u.fullname as user_name, u.username as user_username, u.avatar as user_avatar
     FROM club_post_proposals p
     JOIN users u ON p.user_id = u.id
     WHERE p.club_id = ? AND p.status = ?
     ORDER BY p.created_at DESC`,
      [clubId, status],
      (err, proposals) => {
        if (err) {
          console.error("Ошибка получения предложений:", err.message);
          return res.status(500).json({ error: "Ошибка сервера" });
        }
        res.json(proposals || []);
      },
    );
  },
);

router.put(
  "/api/clubs/:clubId/post-proposals/:proposalId",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    const proposalId = req.params.proposalId;
    const { status, comment } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ message: "Неверный статус" });

    db.get(
      `SELECT * FROM club_post_proposals WHERE id = ? AND club_id = ?`,
      [proposalId, clubId],
      (err, proposal) => {
        if (err || !proposal)
          return res.status(404).json({ error: "Предложение не найдено" });
        db.run(
          `UPDATE club_post_proposals 
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, review_comment = ?
       WHERE id = ?`,
          [status, req.userId, comment || null, proposalId],
          function (err) {
            if (err) {
              console.error("Ошибка обновления статуса:", err.message);
              return res.status(500).json({ message: "Ошибка сервера" });
            }
            if (status === "approved") {
              db.run(
                `INSERT INTO club_posts (club_id, author_id, content, image, created_at) 
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [clubId, proposal.user_id, proposal.content, proposal.image],
              );
            }
            res.json({
              message:
                status === "approved"
                  ? "Пост одобрен и опубликован"
                  : "Пост отклонен",
            });
          },
        );
      },
    );
  },
);

router.get("/api/user/post-proposals", verifyToken, (req, res) => {
  db.all(
    `SELECT p.*, c.name as club_name, c.username as club_username, c.avatar as club_avatar
     FROM club_post_proposals p
     JOIN clubs c ON p.club_id = c.id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [req.userId],
    (err, proposals) => {
      if (err) {
        console.error("Ошибка получения предложений:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(proposals || []);
    },
  );
});

// ============ УПРАВЛЕНИЕ ИГРОКАМИ ============
router.get("/api/clubs/:clubId/players", verifyToken, (req, res) => {
  const clubId = req.params.clubId;
  db.all(
    `SELECT * FROM club_players WHERE club_id = ? ORDER BY number ASC, name ASC`,
    [clubId],
    (err, players) => {
      if (err) {
        console.error("Ошибка получения игроков:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(players || []);
    },
  );
});

router.post(
  "/api/clubs/:clubId/players",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    const { name, number, position, photo } = req.body;
    if (!name) return res.status(400).json({ error: "Имя игрока обязательно" });
    db.run(
      `INSERT INTO club_players (club_id, name, number, position, photo) VALUES (?, ?, ?, ?, ?)`,
      [clubId, name, number || null, position || null, photo || null],
      function (err) {
        if (err) {
          console.error("Ошибка добавления игрока:", err.message);
          return res.status(500).json({ error: "Ошибка сервера" });
        }
        res.json({ id: this.lastID, message: "Игрок добавлен" });
      },
    );
  },
);

router.delete("/api/clubs/players/:playerId", verifyToken, (req, res) => {
  const playerId = req.params.playerId;
  db.run(`DELETE FROM club_players WHERE id = ?`, [playerId], function (err) {
    if (err) {
      console.error("Ошибка удаления игрока:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json({ message: "Игрок удалён" });
  });
});

// ============ УПРАВЛЕНИЕ МАТЧАМИ ============
router.get("/api/clubs/:clubId/matches", (req, res) => {
  const clubId = req.params.clubId;
  db.all(
    `SELECT * FROM club_matches WHERE club_id = ? ORDER BY match_time DESC`,
    [clubId],
    (err, matches) => {
      if (err) {
        console.error("Ошибка получения матчей:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(matches || []);
    },
  );
});

router.get("/api/clubs/:clubId/matches/next", (req, res) => {
  const clubId = req.params.clubId;
  db.get(
    `SELECT * FROM club_matches 
     WHERE club_id = ? AND status = 'scheduled' AND datetime(match_time) > datetime('now')
     ORDER BY match_time ASC LIMIT 1`,
    [clubId],
    (err, match) => {
      if (err) {
        console.error("Ошибка получения следующего матча:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!match)
        return res.status(404).json({ error: "Нет запланированных матчей" });
      res.json(match);
    },
  );
});

router.get("/api/clubs/:clubId/matches/last", (req, res) => {
  const clubId = req.params.clubId;
  db.get(
    `SELECT * FROM club_matches 
     WHERE club_id = ? AND status = 'finished'
     ORDER BY match_time DESC LIMIT 1`,
    [clubId],
    (err, match) => {
      if (err) {
        console.error("Ошибка получения последнего матча:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      if (!match)
        return res.status(404).json({ error: "Нет завершённых матчей" });
      res.json(match);
    },
  );
});

router.get("/api/clubs/matches/:matchId", (req, res) => {
  const matchId = req.params.matchId;
  db.get(`SELECT * FROM club_matches WHERE id = ?`, [matchId], (err, match) => {
    if (err || !match) return res.status(404).json({ error: "Матч не найден" });
    res.json(match);
  });
});

router.post(
  "/api/clubs/:clubId/matches",
  verifyToken,
  checkClubModerator("clubId"),
  (req, res) => {
    const clubId = req.params.clubId;
    const { opponent, match_time, venue, is_home, status, score } = req.body;
    if (!opponent || !match_time)
      return res.status(400).json({ error: "Соперник и время обязательны" });
    db.run(
      `INSERT INTO club_matches (club_id, opponent, match_time, venue, is_home, status, score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        opponent,
        match_time,
        venue || "home",
        is_home ? 1 : 0,
        status || "scheduled",
        score || null,
      ],
      function (err) {
        if (err) {
          console.error("Ошибка создания матча:", err.message);
          return res.status(500).json({ error: "Ошибка сервера" });
        }
        res.json({ id: this.lastID, message: "Матч создан" });
      },
    );
  },
);

router.put("/api/clubs/matches/:matchId", verifyToken, (req, res) => {
  const matchId = req.params.matchId;
  const { opponent, match_time, venue, is_home, status, score } = req.body;
  db.run(
    `UPDATE club_matches SET 
      opponent = ?, match_time = ?, venue = ?, is_home = ?, status = ?, score = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      opponent,
      match_time,
      venue,
      is_home ? 1 : 0,
      status,
      score || null,
      matchId,
    ],
    function (err) {
      if (err) {
        console.error("Ошибка обновления матча:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json({ message: "Матч обновлён" });
    },
  );
});

router.delete("/api/clubs/matches/:matchId", verifyToken, (req, res) => {
  const matchId = req.params.matchId;
  db.run(`DELETE FROM club_matches WHERE id = ?`, [matchId], function (err) {
    if (err) {
      console.error("Ошибка удаления матча:", err.message);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    res.json({ message: "Матч удалён" });
  });
});

// ============ СОСТАВ И СТАТИСТИКА МАТЧА ============
router.get("/api/clubs/matches/:matchId/lineup", (req, res) => {
  const matchId = req.params.matchId;
  db.all(
    `SELECT ml.*, p.name, p.number, p.position as default_position
     FROM match_lineups ml
     JOIN club_players p ON ml.player_id = p.id
     WHERE ml.match_id = ?
     ORDER BY ml.is_starter DESC, ml.position, p.number`,
    [matchId],
    (err, lineup) => {
      if (err) {
        console.error("Ошибка получения состава:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(lineup || []);
    },
  );
});

router.post(
  "/api/clubs/matches/:matchId/lineup",
  verifyToken,
  async (req, res) => {
    const matchId = req.params.matchId;
    const { lineup } = req.body; // массив объектов { player_id, is_starter, position, minute_in, goals, assists, yellow_cards, red_cards }
    if (!Array.isArray(lineup))
      return res.status(400).json({ error: "Неверный формат" });

    try {
      // Удаляем старый состав
      await new Promise((resolve, reject) => {
        db.run(
          `DELETE FROM match_lineups WHERE match_id = ?`,
          [matchId],
          (err) => (err ? reject(err) : resolve()),
        );
      });
      // Вставляем новый
      const stmt = db.prepare(`
      INSERT INTO match_lineups (match_id, player_id, is_starter, position, minute_in, goals, assists, yellow_cards, red_cards)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
      for (const p of lineup) {
        await new Promise((resolve, reject) => {
          stmt.run(
            [
              matchId,
              p.player_id,
              p.is_starter ? 1 : 0,
              p.position,
              p.minute_in || null,
              p.goals || 0,
              p.assists || 0,
              p.yellow_cards || 0,
              p.red_cards || 0,
            ],
            (err) => (err ? reject(err) : resolve()),
          );
        });
      }
      stmt.finalize();
      res.json({ message: "Состав сохранён" });
    } catch (err) {
      console.error("Ошибка сохранения состава:", err.message);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

router.get("/api/clubs/matches/:matchId/stats", (req, res) => {
  const matchId = req.params.matchId;
  db.get(
    `SELECT * FROM match_stats WHERE match_id = ?`,
    [matchId],
    (err, stats) => {
      if (err) {
        console.error("Ошибка получения статистики:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json(stats || {});
    },
  );
});

router.post("/api/clubs/matches/:matchId/stats", verifyToken, (req, res) => {
  const matchId = req.params.matchId;
  const {
    possession,
    shots,
    shots_on_target,
    corners,
    fouls,
    yellow_cards,
    red_cards,
    offsides,
  } = req.body;
  db.run(
    `INSERT OR REPLACE INTO match_stats (match_id, possession, shots, shots_on_target, corners, fouls, yellow_cards, red_cards, offsides)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      matchId,
      possession || 0,
      shots || 0,
      shots_on_target || 0,
      corners || 0,
      fouls || 0,
      yellow_cards || 0,
      red_cards || 0,
      offsides || 0,
    ],
    (err) => {
      if (err) {
        console.error("Ошибка сохранения статистики:", err.message);
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json({ message: "Статистика сохранена" });
    },
  );
});

router.put(
  "/api/clubs/matches/:matchId/finalize",
  verifyToken,
  async (req, res) => {
    const matchId = req.params.matchId;
    // Обновляем статус матча на finished
    db.run(
      `UPDATE club_matches SET status = 'finished', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [matchId],
      function (err) {
        if (err) {
          console.error("Ошибка завершения матча:", err.message);
          return res.status(500).json({ error: "Ошибка сервера" });
        }
        res.json({ message: "Матч завершён" });
      },
    );
  },
);

module.exports = router;
