// utils/helpers.js
const db = require("../config/db");

// Обновление времени последнего визита
const updateLastSeen = (userId) => {
  if (!userId) return;
  db.run(
    `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
    (err) => {
      if (err) console.error("Ошибка обновления last_seen:", err.message);
    },
  );
};

module.exports = {
  updateLastSeen,
};
