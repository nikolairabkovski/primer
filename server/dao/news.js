const db = require("../config/db");

class NewsDAO {
  getCategories() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM news_categories ORDER BY name`, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getPopularHashtags(limit) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT h.*, COUNT(nh.news_id) as news_count
         FROM news_hashtags h
         LEFT JOIN news_to_hashtags nh ON h.id = nh.hashtag_id
         GROUP BY h.id
         ORDER BY news_count DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  }

  beginTransaction() {
    return new Promise((resolve, reject) => {
      db.run("BEGIN TRANSACTION", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  commit() {
    return new Promise((resolve, reject) => {
      db.run("COMMIT", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  rollback() {
    return new Promise((resolve) => {
      db.run("ROLLBACK", () => resolve());
    });
  }

  createNews({ title, content, imageUrl, userId }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO news (title, content, image, author_id, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [title, content, imageUrl, userId],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        },
      );
    });
  }

  addCategory(newsId, categoryId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO news_to_categories (news_id, category_id) VALUES (?, ?)`,
        [newsId, categoryId],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  async addHashtag(tag) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO news_hashtags (name, slug) VALUES (?, ?)`,
        [tag, tag],
        (err) => {
          if (err) return reject(err);

          db.get(
            `SELECT id FROM news_hashtags WHERE slug = ?`,
            [tag],
            (err, row) => {
              if (err || !row) return reject(err || new Error("Not found"));
              resolve(row.id);
            },
          );
        },
      );
    });
  }

  linkHashtag(newsId, hashtagId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO news_to_hashtags (news_id, hashtag_id) VALUES (?, ?)`,
        [newsId, hashtagId],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  getNews(query, params) {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getCount(query, params) {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) return reject(err);
        resolve(row?.total || 0);
      });
    });
  }

  getById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `
      SELECT 
        n.*, 
        u.fullname as author_name,

        GROUP_CONCAT(DISTINCT c.name) as categories,
        GROUP_CONCAT(DISTINCT h.name) as hashtags

      FROM news n

      JOIN users u ON n.author_id = u.id

      LEFT JOIN news_to_categories nc ON n.id = nc.news_id
      LEFT JOIN news_categories c ON nc.category_id = c.id

      LEFT JOIN news_to_hashtags nh ON n.id = nh.news_id
      LEFT JOIN news_hashtags h ON nh.hashtag_id = h.id

      WHERE n.id = ?

      GROUP BY n.id
      `,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        },
      );
    });
  }

  getAuthors() {
    return new Promise((resolve, reject) => {
      db.all(
        `
      SELECT 
        u.id, 
        u.fullname,
        COUNT(n.id) as news_count
      FROM news n
      JOIN users u ON u.id = n.author_id
      WHERE n.status = 'approved'
      GROUP BY u.id
      ORDER BY news_count DESC
      `,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  }

  getComments(newsId) {
    return new Promise((resolve, reject) => {
      db.all(
        `
      SELECT 
        c.*,
        u.fullname as user_name,
        u.username as user_username

      FROM news_comments c

      JOIN users u ON c.user_id = u.id

      WHERE c.news_id = ?

      ORDER BY c.created_at ASC
      `,
        [newsId],
        (err, rows) => {
          if (err) return reject(err);

          console.log("📦 COMMENTS FROM DB:", rows); // 👈 проверка

          resolve(rows || []);
        },
      );
    });
  }

  incrementViews(id) {
    db.run(`UPDATE news SET views = views + 1 WHERE id = ?`, [id]);
  }
}

module.exports = new NewsDAO();
