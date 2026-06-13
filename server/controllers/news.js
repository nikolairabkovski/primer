const newsService = require("../services/news");

class NewsController {
  async getCategories(req, res) {
    try {
      const data = await newsService.getCategories();
      res.json(data);
    } catch {
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }

  async getAuthors(req, res) {
    try {
      const data = await newsService.getAuthors();
      res.json(data);
    } catch {
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }

  async getPopularHashtags(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const data = await newsService.getPopularHashtags(limit);
      res.json(data);
    } catch {
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }

  async createNews(req, res) {
    try {
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const result = await newsService.createNews({
        ...req.body,
        userId: req.userId,
        imageUrl,
      });

      res.json({
        message: "Новость отправлена на модерацию",
        ...result,
      });
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  }

  async getNews(req, res) {
    try {
      const result = await newsService.getNewsList(
        req.query,
        req.headers,
        req.userId,
      );
      res.json(result);
    } catch (e) {
      res
        .status(e.status || 500)
        .json({ error: e.message || "Ошибка сервера" });
    }
  }

  async getById(req, res) {
    try {
      const news = await newsService.getById(req.params.id);
      res.json(news);
    } catch (e) {
      if (e.message === "NOT_FOUND") {
        return res.status(404).json({ error: "Новость не найдена" });
      }
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }
}

module.exports = new NewsController();
