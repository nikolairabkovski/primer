const newsCommentsService = require("../services/news_comments");

class NewsCommentsController {
  // GET /api/news/:newsId/comments
  async getComments(req, res) {
    try {
      const { newsId } = req.params;

      const comments = await newsCommentsService.getCommentsTree(newsId);

      res.json(comments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  }

  // POST /api/news/:newsId/comments
  async addComment(req, res) {
    try {
      const { newsId } = req.params;
      const { content } = req.body;

      const userId = req.userId; // предполагается middleware авторизации

      const comment = await newsCommentsService.addComment({
        newsId,
        userId,
        content,
      });

      res.status(201).json(comment);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message });
    }
  }

  // POST /api/news/:newsId/comments/:commentId/reply
  async replyToComment(req, res) {
    try {
      const { newsId, commentId } = req.params;
      const { content } = req.body;
      const userId = req.userId;

      console.log(newsId, commentId, content, userId);

      const reply = await newsCommentsService.replyToComment({
        newsId,
        userId,
        parentId: commentId,
        content,
        isAdminReply: req.userRole === "admin" ? 1 : 0,
      });

      res.status(201).json(reply);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message });
    }
  }

  // DELETE /api/comments/:id
  async deleteComment(req, res) {
    try {
      const { id } = req.params;

      await newsCommentsService.deleteComment(id);

      res.json({
        message: "Comment deleted",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  }
}

module.exports = new NewsCommentsController();
