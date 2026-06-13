// routes/newsLikesRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/news-likes");
const { verifyToken } = require("../middleware/auth");

// лайк / дизлайк (toggle)
router.post("/api/news/:newsId/react", verifyToken, controller.react);

// убрать реакцию
router.delete("/api/news/:newsId/react", verifyToken, controller.remove);

// получить статистику + мою реакцию
router.get("/api/news/:newsId/react", controller.getSummary);

router.get("/api/news/:newsId/my", verifyToken, controller.getMyReaction);

module.exports = router;
