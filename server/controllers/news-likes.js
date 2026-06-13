// controllers/newsLikesController.js
const newsLikesService = require("../services/news-likes");

class NewsLikesController {
  async react(req, res) {
    try {
      const userId = req.userId; // предполагается middleware auth
      const { newsId } = req.params;
      const { type } = req.body;

      const result = await newsLikesService.react({
        newsId: Number(newsId),
        userId,
        type,
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async remove(req, res) {
    try {
      const userId = req.userId;
      const { newsId } = req.params;

      const result = await newsLikesService.remove(Number(newsId), userId);

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getSummary(req, res) {
    try {
      const userId = req.user?.id || null;
      const { newsId } = req.params;

      const result = await newsLikesService.getSummary(Number(newsId), userId);

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getMyReaction(req, res) {
    try {
      const userId = req.userId; // может быть не авторизован
      const { newsId } = req.params;

      const reaction = await newsLikesService.getMyReaction(
        Number(newsId),
        userId,
      );

      res.json({
        myReaction: reaction, // 'like' | 'dislike' | null
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new NewsLikesController();
