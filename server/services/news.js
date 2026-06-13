const newsDAO = require("../dao/news");
const { verifyToken } = require("../middleware/auth");
class NewsService {
  async getCategories() {
    return newsDAO.getCategories();
  }

  async getPopularHashtags(limit) {
    return newsDAO.getPopularHashtags(limit);
  }

  async getAuthors() {
    return newsDAO.getAuthors();
  }

  async createNews(data) {
    const { title, content, category_id, hashtags, userId, imageUrl } = data;

    if (!title || !content) {
      throw new Error("Заголовок и текст обязательны");
    }
    if (!category_id) {
      throw new Error("Выберите категорию");
    }

    await newsDAO.beginTransaction();

    try {
      const newsId = await newsDAO.createNews({
        title,
        content,
        imageUrl,
        userId,
      });

      await newsDAO.addCategory(newsId, category_id);

      if (hashtags) {
        const list = hashtags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        for (let tag of list) {
          if (tag.startsWith("#")) tag = tag.slice(1);
          const hashtagId = await newsDAO.addHashtag(tag);
          await newsDAO.linkHashtag(newsId, hashtagId);
        }
      }

      await newsDAO.commit();
      return { newsId };
    } catch (e) {
      await newsDAO.rollback();
      throw e;
    }
  }

  async getById(id) {
    try {
      const news = await newsDAO.getById(id);

      if (!news) {
        throw new Error("NOT_FOUND");
      }

      // Преобразуем строки categories и hashtags обратно в массивы
      if (news.categories) {
        news.categories = news.categories.split(",");
      } else {
        news.categories = [];
      }

      if (news.hashtags) {
        news.hashtags = news.hashtags.split(",");
      } else {
        news.hashtags = [];
      }

      // Увеличиваем счетчик просмотров
      newsDAO.incrementViews(id);

      return news;
    } catch (error) {
      if (error.message === "NOT_FOUND") {
        throw error;
      }
      console.error("Error in getById service:", error);
      throw new Error("DATABASE_ERROR");
    }
  }

  async getNewsList(queryParams, headers, userId) {
    const {
      status = "approved",
      page = 1,
      limit = 10,
      rated_by,
      search,
      category,
      hashtag,
      sort,
      author,
    } = queryParams;

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    const joins = [];

    // 🔍 ПОИСК
    if (search) {
      conditions.push("(n.title LIKE ? OR n.content LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    // 📂 КАТЕГОРИЯ
    if (category) {
      joins.push("INNER JOIN news_to_categories nc ON n.id = nc.news_id");
      joins.push("INNER JOIN news_categories c ON nc.category_id = c.id");

      conditions.push("c.slug = ?");
      params.push(category);
    }

    // 🔥 ХЭШТЕГ
    if (hashtag) {
      joins.push("INNER JOIN news_to_hashtags nh ON n.id = nh.news_id");
      joins.push("INNER JOIN news_hashtags h ON nh.hashtag_id = h.id");

      conditions.push("h.slug = ?");
      params.push(hashtag);
    }

    // 👤 ФИЛЬТР ПО АВТОРУ
    if (author) {
      conditions.push("n.author_id = ?");
      params.push(author);
    }

    // 👍 ФИЛЬТР ПО ЛАЙКАМ
    if (rated_by) {
      if (!["like", "dislike"].includes(rated_by)) {
        throw new Error("Неверный тип оценки");
      }

      joins.push("INNER JOIN news_likes nl ON n.id = nl.news_id");

      conditions.push("nl.user_id = ?");
      params.push(userId);

      conditions.push("nl.type = ?");
      params.push(rated_by);

      // только опубликованные
      conditions.push("n.status = ?");
      params.push("approved");
    } else {
      // обычный статус
      if (status !== "all") {
        conditions.push("n.status = ?");
        params.push(status);
      }
    }

    let query = `
  SELECT DISTINCT 
    n.*, 
    u.fullname as author_name,
    u.username as author_username
  FROM news n
  JOIN users u ON u.id = n.author_id
`;
    query += " " + joins.join(" ");

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // 🔽 СОРТИРОВКА
    let orderBy = "n.created_at DESC";

    switch (sort) {
      case "oldest":
        orderBy = "n.created_at ASC";
        break;
      case "popular":
        orderBy = "n.views DESC";
        break;
      case "most_commented":
        orderBy = `(SELECT COUNT(*) FROM news_comments c WHERE c.news_id = n.id) DESC`;
        break;
      case "most_liked":
        orderBy = `(SELECT COUNT(*) FROM news_likes l WHERE l.news_id = n.id AND l.type='like') DESC`;
        break;
      case "most_disliked":
        orderBy = `(SELECT COUNT(*) FROM news_likes l WHERE l.news_id = n.id AND l.type='dislike') DESC`;
        break;
    }

    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const news = await newsDAO.getNews(query, params);

    // COUNT
    let countQuery = `
  SELECT COUNT(DISTINCT n.id) as total 
  FROM news n
  JOIN users u ON u.id = n.author_id
`;
    countQuery += " " + joins.join(" ");

    if (conditions.length) {
      countQuery += " WHERE " + conditions.join(" AND ");
    }

    const countParams = params.slice(0, -2);
    const total = await newsDAO.getCount(countQuery, countParams);

    return {
      news,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }
}

module.exports = new NewsService();
