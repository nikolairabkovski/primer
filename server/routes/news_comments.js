const Router = require("express");
const router = new Router();

const newsCommentsController = require("../controllers/news_comments");
const { verifyToken } = require("../middleware/auth");

// дерево комментариев
router.get("/api/news/:newsId/comments", newsCommentsController.getComments);

// комментарий
router.post(
  "/api/news/:newsId/comments",
  verifyToken,
  newsCommentsController.addComment,
);

// ответ на комментарий
router.post(
  "/api/news/:newsId/comments/:commentId/reply",
  verifyToken,
  newsCommentsController.replyToComment,
);

// удалить комментарий
router.delete(
  "/api/comments/:id",
  verifyToken,
  newsCommentsController.deleteComment,
);

module.exports = router;
