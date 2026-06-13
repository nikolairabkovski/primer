// news-detail.js
let currentNewsId = null;
let currentUserId = null;
let react = null;
const token = localStorage.getItem("token");

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  currentNewsId = urlParams.get("id");

  if (!currentNewsId) {
    window.location.href = "news.html";
    return;
  }

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.id;
      document.getElementById("commentForm").style.display = "block";
    } catch (e) {
      console.log("Не авторизован");
    }
  }

  loadNewsDetail();
  loadComments();
});

async function loadNewsDetail() {
  try {
    const res = await fetch(`/api/news/${currentNewsId}`);

    // Проверяем статус ответа
    if (!res.ok) {
      throw new Error(`Ошибка загрузки новости: ${res.status}`);
    }

    const news = await res.json();

    // Проверяем, что новость содержит author_id
    if (!news.author_id) {
      console.error("Новость не содержит author_id:", news);
      displayError("Не удалось получить информацию об авторе новости.");
      return;
    }

    // Загружаем данные автора
    let user = {};
    try {
      const userRes = await fetch(`/api/profile/${news.author_id}`);
      if (userRes.ok) {
        user = await userRes.json();
      } else {
        console.warn(`Ошибка загрузки профиля: ${userRes.status}`);
        user = { fullname: "Неизвестный автор", username: "unknown" };
      }
    } catch (error) {
      console.error("Ошибка запроса профиля:", error);
      user = { fullname: "Неизвестный автор", username: "unknown" };
    }

    // Загружаем мою реакцию (если авторизован)
    let myReactionData = { myReaction: null, likes: 0, dislikes: 0 };
    if (token) {
      try {
        const myReactionRes = await fetch(`/api/news/${currentNewsId}/react`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (myReactionRes.ok) {
          myReactionData = await myReactionRes.json();
        } else {
          console.warn(`Ошибка загрузки реакции: ${myReactionRes.status}`);
        }
      } catch (error) {
        console.error("Ошибка загрузки реакции:", error);
      }
    }

    react = myReactionData.myReaction;

    displayNewsDetail(
      news,
      myReactionData.likes || 0,
      myReactionData.dislikes || 0,
      user,
    );
  } catch (error) {
    console.error("Ошибка загрузки новости:", error);
    displayError("Не удалось загрузить новость. Попробуйте позже.");
  }
}

function displayError(message) {
  const container = document.getElementById("newsDetail");
  if (container) {
    container.innerHTML = `<div class="error-message" style="color: red; padding: 20px; text-align: center;">⚠️ ${escapeHtml(message)}</div>`;
  }
}

function displayNewsDetail(news, likes, dislikes, author) {
  const container = document.getElementById("newsDetail");

  if (!container) return;

  const hashtags = Array.isArray(news.hashtags) ? news.hashtags : [];
  const categories = Array.isArray(news.categories) ? news.categories : [];

  container.innerHTML = `
    <h2 class="news-title">${escapeHtml(news.title)}</h2>
    
    <div class="news-meta">
      <span class="news-author">👤 ${escapeHtml(author.fullname || author.username || "Неизвестный автор")}</span>
      <span class="news-date">📅 ${formatDate(news.created_at)}</span>
      <span class="news-views">👁️ ${news.views || 0}</span>
    </div>
    
    ${
      categories.length > 0
        ? `
      <div class="news-categories">
        ${categories.map((cat) => `<span class="news-category">${escapeHtml(cat)}</span>`).join("")}
      </div>
    `
        : ""
    }
    
    ${
      hashtags.length > 0
        ? `
      <div class="news-hashtags">
        ${hashtags.map((tag) => `<span class="news-hashtag">#${escapeHtml(tag)}</span>`).join("")}
      </div>
    `
        : ""
    }
    
    ${news.image ? `<img src="${escapeHtml(news.image)}" class="news-full-image" alt="${escapeHtml(news.title)}">` : ""}
    
    <div class="news-full-content">
      ${escapeHtml(news.content).replace(/\n/g, "<br>")}
    </div>
    
    <div class="news-actions">
      <button class="like-btn" onclick="window.handleLike('like')">
        👍 ${likes || 0}
      </button>
      
      <button class="dislike-btn" onclick="window.handleLike('dislike')">
        👎 ${dislikes || 0}
      </button>
    </div>
    
    <div class="author-info">
      <h4>Об авторе</h4>
      <p>${escapeHtml(author.fullname || "Нет информации")}</p>
      ${author.city ? `<p>📍 ${escapeHtml(author.city)}</p>` : ""}
    </div>
    
    <div class="report-problem">
      <a href="support.html?subject=Жалоба на новость ${news.id} - ${encodeURIComponent(news.title)}">
        сообщить о проблеме
      </a>
    </div>
  `;
}

async function handleLike(type) {
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }

  try {
    let res = null;

    if (react == type) {
      res = await fetch(`/api/news/${currentNewsId}/react`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      res = await fetch(`/api/news/${currentNewsId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Ошибка реакции");
    }

    await loadNewsDetail();
  } catch (error) {
    console.error("Ошибка реакции:", error);
    alert(error.message || "Ошибка реакции. Попробуйте позже.");
  }
}

async function loadComments() {
  try {
    const res = await fetch(`/api/news/${currentNewsId}/comments`);

    if (!res.ok) {
      throw new Error(`Ошибка загрузки комментариев: ${res.status}`);
    }

    const comments = await res.json();

    console.log("💬 COMMENTS FROM API:", comments);

    // Собираем все user_id (включая вложенные)
    const userIds = new Set();

    function collectUsers(list) {
      if (!list || !Array.isArray(list)) return;

      list.forEach((c) => {
        if (c.user_id) {
          userIds.add(c.user_id);
        }
        if (c.children && c.children.length) {
          collectUsers(c.children);
        }
      });
    }

    collectUsers(comments);

    console.log("🆔 USER IDS:", [...userIds]);

    // Загружаем всех пользователей с обработкой ошибок
    const usersMap = {};

    await Promise.all(
      [...userIds].map(async (id) => {
        try {
          const res = await fetch(`/api/profile/${id}`);
          if (res.ok) {
            usersMap[id] = await res.json();
          } else {
            console.warn(
              `Не удалось загрузить пользователя ${id}: ${res.status}`,
            );
            usersMap[id] = {
              fullname: "Неизвестный пользователь",
              username: "unknown",
            };
          }
        } catch (e) {
          console.error("Ошибка запроса профиля:", id, e);
          usersMap[id] = { fullname: "Ошибка загрузки", username: "error" };
        }
      }),
    );

    console.log("👤 USERS MAP:", usersMap);

    // Передаём usersMap для отображения
    displayComments(comments, usersMap);

    const commentsCountElement = document.getElementById("commentsCount");
    if (commentsCountElement) {
      commentsCountElement.textContent = countComments(comments);
    }
  } catch (error) {
    console.error("Ошибка загрузки комментариев:", error);
    const container = document.getElementById("commentsContainer");
    if (container) {
      container.innerHTML =
        '<p class="error-message" style="color: red;">❌ Не удалось загрузить комментарии</p>';
    }
  }
}

function displayComments(comments, usersMap) {
  const container = document.getElementById("commentsContainer");

  if (!container) return;

  if (!comments || !comments.length) {
    container.innerHTML = '<p class="no-comments">Комментариев нет</p>';
    return;
  }

  container.innerHTML = renderCommentsTree(comments, usersMap);
}

function renderCommentsTree(comments, usersMap, level = 0) {
  if (!comments || !Array.isArray(comments)) return "";

  return comments
    .map((comment) => {
      // Пропускаем скрытые комментарии
      if (comment.is_hidden) return "";

      console.log("🧩 COMMENT ITEM:", comment);

      // Получаем пользователя, если нет — fallback
      const user = usersMap[comment.user_id] || {
        fullname: "Пользователь удален",
        username: "deleted",
      };
      const username = user.fullname || user.username || "Пользователь";

      return `
      <div class="comment" style="margin-left:${Math.min(level * 20, 100)}px">
        <div class="comment-header">
          <span class="comment-author">
            👤 ${escapeHtml(username)}
          </span>

          ${
            comment.is_admin_reply
              ? `<span class="admin-badge" style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Администратор</span>`
              : ""
          }

          <span class="comment-date">
            ${formatDate(comment.created_at)}
          </span>
        </div>

        <div class="comment-content">
          ${escapeHtml(comment.content)}
        </div>

        ${
          token
            ? `
            <button
              class="reply-btn"
              onclick="window.showReplyForm(${comment.id})"
              style="margin-top: 8px; padding: 4px 12px; cursor: pointer;"
            >
              💬 Ответить
            </button>
          `
            : ""
        }

        <div id="replyForm-${comment.id}"></div>

        ${
          comment.children && comment.children.length
            ? renderCommentsTree(comment.children, usersMap, level + 1)
            : ""
        }
      </div>
      `;
    })
    .join("");
}

function showReplyForm(commentId) {
  const container = document.getElementById(`replyForm-${commentId}`);

  if (!container) return;

  // Проверяем, не открыта ли уже форма
  if (container.querySelector(".reply-form")) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="reply-form" style="margin-top: 10px;">
      <textarea 
        class="reply-input" 
        placeholder="Ваш ответ..." 
        id="replyInput-${commentId}"
        rows="3"
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
      ></textarea>
      <div class="reply-form-actions" style="margin-top: 8px;">
        <button type="button" class="reply-cancel" style="margin-right: 8px; padding: 4px 12px; cursor: pointer;">Отмена</button>
        <button type="button" class="reply-submit" style="padding: 4px 12px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px;">Ответить</button>
      </div>
    </div>
  `;

  const cancelBtn = container.querySelector(".reply-cancel");
  const submitBtn = container.querySelector(".reply-submit");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      container.innerHTML = "";
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      sendReply(commentId);
    });
  }
}

async function sendReply(parentId) {
  const inputElement = document.getElementById(`replyInput-${parentId}`);

  if (!inputElement) {
    console.error("Input element not found");
    return;
  }

  const content = inputElement.value.trim();

  if (!content) {
    alert("Введите текст ответа");
    return;
  }

  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(
      `/api/news/${currentNewsId}/comments/${parentId}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Ошибка отправки ответа");
    }

    // Очищаем форму
    const container = document.getElementById(`replyForm-${parentId}`);
    if (container) {
      container.innerHTML = "";
    }

    // Перезагружаем комментарии
    await loadComments();
  } catch (error) {
    console.error("Ошибка ответа:", error);
    alert(error.message || "Ошибка отправки ответа. Попробуйте позже.");
  }
}

async function addComment() {
  if (!token) {
    alert("Авторизуйтесь, чтобы оставить комментарий");
    window.location.href = "login.html";
    return;
  }

  const contentElement = document.getElementById("commentContent");
  if (!contentElement) return;

  const content = contentElement.value.trim();

  if (!content) {
    alert("Введите текст комментария");
    return;
  }

  try {
    const res = await fetch(`/api/news/${currentNewsId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Ошибка отправки комментария");
    }

    // Очищаем поле ввода
    contentElement.value = "";

    // Перезагружаем комментарии
    await loadComments();

    // Прокручиваем к комментариям
    const commentsSection = document.getElementById("commentsSection");
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    console.error("Ошибка комментария:", error);
    alert(error.message || "Ошибка отправки комментария. Попробуйте позже.");
  }
}

function countComments(comments) {
  if (!comments || !Array.isArray(comments)) return 0;

  let count = 0;

  comments.forEach((c) => {
    if (!c.is_hidden) {
      count++;
      if (c.children && c.children.length) {
        count += countComments(c.children);
      }
    }
  });

  return count;
}

function formatDate(dateString) {
  if (!dateString) return "Дата неизвестна";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Дата неизвестна";

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Ошибка форматирования даты:", error);
    return "Дата неизвестна";
  }
}

function escapeHtml(text) {
  if (!text) return "";

  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Экспортируем функции в глобальную область видимости
window.handleLike = handleLike;
window.addComment = addComment;
window.showReplyForm = showReplyForm;
window.sendReply = sendReply;
