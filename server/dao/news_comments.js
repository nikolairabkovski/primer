const db = require("../config/db");

class NewsCommentsDAO {
  // получить все комментарии к новости в виде дерева
  getCommentsTreeByNews(newsId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM news_comments
         WHERE news_id = ?
         ORDER BY created_at ASC`,
        [newsId],
        (err, rows) => {
          if (err) return reject(err);

          // создаем map
          const map = {};
          rows.forEach((c) => {
            map[c.id] = {
              ...c,
              children: [],
            };
          });

          // строим дерево
          const tree = [];
          rows.forEach((c) => {
            if (c.parent_id) {
              if (map[c.parent_id]) {
                map[c.parent_id].children.push(map[c.id]);
              }
            } else {
              tree.push(map[c.id]);
            }
          });

          resolve(tree);
        },
      );
    });
  }

  // добавить комментарий к новости
  addComment({ newsId, userId, content }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO news_comments (news_id, user_id, content)
         VALUES (?, ?, ?)`,
        [newsId, userId, content],
        function (err) {
          if (err) return reject(err);

          resolve({
            id: this.lastID,
            newsId,
            userId,
            content,
          });
        },
      );
    });
  }

  // ответить на комментарий
  replyToComment({ newsId, userId, parentId, content, isAdminReply = 0 }) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // добавляем ответ
        db.run(
          `INSERT INTO news_comments 
           (news_id, user_id, parent_id, content, is_admin_reply)
           VALUES (?, ?, ?, ?, ?)`,
          [newsId, userId, parentId, content, isAdminReply],
          function (err) {
            if (err) return reject(err);

            const replyId = this.lastID;

            // если ответ админа — отмечаем родителя
            if (isAdminReply) {
              db.run(
                `UPDATE news_comments
                 SET has_admin_reply = 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [parentId],
              );
            }

            resolve({
              id: replyId,
              newsId,
              userId,
              parentId,
              content,
              isAdminReply,
            });
          },
        );
      });
    });
  }

  // удалить комментарий
  // можно мягко скрывать через is_hidden
  deleteComment(commentId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE news_comments
         SET is_hidden = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [commentId],
        function (err) {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }

  // полное удаление (если нужно)
  hardDeleteComment(commentId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM news_comments WHERE id = ?`,
        [commentId],
        function (err) {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }
}

module.exports = new NewsCommentsDAO();
