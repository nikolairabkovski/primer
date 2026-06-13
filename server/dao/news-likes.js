const db = require("../config/db");

class NewsLikesDAO {
  // добавить лайк/дизлайк
  addReaction({ newsId, userId, type }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO news_likes (news_id, user_id, type)
         VALUES (?, ?, ?)
         ON CONFLICT(news_id, user_id)
         DO UPDATE SET type = excluded.type, created_at = CURRENT_TIMESTAMP`,
        [newsId, userId, type],
        function (err) {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }

  // удалить реакцию
  removeReaction(newsId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM news_likes WHERE news_id = ? AND user_id = ?`,
        [newsId, userId],
        function (err) {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }

  // получить все реакции для новости (с подсчетом)
  getReactionsByNews(newsId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
           SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END) as likes,
           SUM(CASE WHEN type = 'dislike' THEN 1 ELSE 0 END) as dislikes
         FROM news_likes
         WHERE news_id = ?`,
        [newsId],
        (err, row) => {
          if (err) return reject(err);
          resolve({
            likes: row?.likes || 0,
            dislikes: row?.dislikes || 0,
          });
        },
      );
    });
  }

  // получить ВСЕ записи (если вдруг нужно список пользователей)
  getAllByNews(newsId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM news_likes WHERE news_id = ?`,
        [newsId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  }

  // получить МОЮ реакцию для новости
  getUserReaction(newsId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM news_likes 
         WHERE news_id = ? AND user_id = ?`,
        [newsId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        },
      );
    });
  }
}

module.exports = new NewsLikesDAO();
