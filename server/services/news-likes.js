// services/newsLikesService.js
const { raw } = require("express");
const newsLikesDAO = require("../dao/news-likes");

class NewsLikesService {
  async react({ newsId, userId, type }) {
    if (!["like", "dislike"].includes(type)) {
      throw new Error("Invalid reaction type");
    }

    const existing = await newsLikesDAO.getUserReaction(newsId, userId);

    // toggle логика
    if (!existing) {
      await newsLikesDAO.addReaction({ newsId, userId, type });
    } else if (existing.type === type) {
      await newsLikesDAO.removeReaction(newsId, userId);
    } else {
      await newsLikesDAO.addReaction({ newsId, userId, type });
    }

    return this.getSummary(newsId, userId);
  }

  async remove(newsId, userId) {
    await newsLikesDAO.removeReaction(newsId, userId);
    return this.getSummary(newsId, userId);
  }

  async getSummary(newsId, userId) {
    const [counts, userReaction] = await Promise.all([
      newsLikesDAO.getReactionsByNews(newsId),
      newsLikesDAO.getUserReaction(newsId, userId),
    ]);

    return {
      ...counts,
      myReaction: userReaction?.type || null,
    };
  }

  async getMyReaction(newsId, userId) {
    console.log("getmyreaction", newsId, userId);
    if (!userId) return null;

    const reaction = await newsLikesDAO.getUserReaction(newsId, userId);

    console.log(reaction);

    return reaction?.type || null; // 'like' | 'dislike' | null
  }
}

module.exports = new NewsLikesService();
