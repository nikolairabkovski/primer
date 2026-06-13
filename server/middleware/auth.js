// middleware/auth.js
const jwt = require("jsonwebtoken");
const { SECRET } = require("../config/constants");
const db = require("../config/db");

// Проверка JWT токена
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Токен истек" });
    }
    return res.status(401).json({ error: "Недействительный токен" });
  }
};

// Проверка прав администратора (admin или main_admin)
const checkAdmin = (req, res, next) => {
  if (!req.userRole || !["admin", "main_admin"].includes(req.userRole)) {
    return res
      .status(403)
      .json({ error: "Доступ запрещен. Требуются права администратора" });
  }
  next();
};

// Проверка прав главного администратора
const checkMainAdmin = (req, res, next) => {
  if (req.userRole !== "main_admin") {
    return res
      .status(403)
      .json({ error: "Только главный админ может выполнить это действие" });
  }
  next();
};

// Проверка прав модератора клуба (creator, admin, moderator)
const checkClubModerator =
  (clubIdParam = "clubId") =>
  (req, res, next) => {
    const clubId = req.params[clubIdParam];
    if (!clubId) return res.status(400).json({ error: "Не указан ID клуба" });

    db.get(
      `SELECT role FROM club_members WHERE club_id = ? AND user_id = ?`,
      [clubId, req.userId],
      (err, member) => {
        if (
          err ||
          !member ||
          !["creator", "admin", "moderator"].includes(member.role)
        ) {
          return res.status(403).json({ error: "Недостаточно прав" });
        }
        next();
      },
    );
  };

module.exports = {
  verifyToken,
  checkAdmin,
  checkMainAdmin,
  checkClubModerator,
};
