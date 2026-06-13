const newsCommentsDAO = require("../dao/news_comments");

class NewsCommentsService {
  // дерево комментариев
  async getCommentsTree(newsId) {
    if (!newsId) {
      throw new Error("newsId is required");
    }

    return await newsCommentsDAO.getCommentsTreeByNews(newsId);
  }

  // комментарий к новости
  async addComment({ newsId, userId, content }) {
    if (!content || !content.trim()) {
      throw new Error("Comment content is empty");
    }

    return await newsCommentsDAO.addComment({
      newsId,
      userId,
      content: content.trim(),
    });
  }

  // ответ на комментарий
  async replyToComment({ newsId, userId, parentId, content, isAdminReply }) {
    if (!content || !content.trim()) {
      throw new Error("Reply content is empty");
    }

    if (!parentId) {
      throw new Error("parentId is required");
    }

    return await newsCommentsDAO.replyToComment({
      newsId,
      userId,
      parentId,
      content: content.trim(),
      isAdminReply,
    });
  }

  // удалить комментарий (soft delete)
  async deleteComment(commentId) {
    if (!commentId) {
      throw new Error("commentId is required");
    }

    return await newsCommentsDAO.deleteComment(commentId);
  }

  // полное удаление
  async hardDeleteComment(commentId) {
    if (!commentId) {
      throw new Error("commentId is required");
    }

    return await newsCommentsDAO.hardDeleteComment(commentId);
  }
}

module.exports = new NewsCommentsService();
