// news.js
let currentPage = 1;
let currentFilter = "approved";
let currentUserId = null;
let userRole = null;
let currentSearch = "";
let currentCategory = "";
let currentSort = "newest";
let currentHashtag = "";
let currentAuthor = "";

document.addEventListener("DOMContentLoaded", function () {
  checkAuthAndLoad();
  loadCategories();
  loadPopularHashtags();
  loadAuthors();
});

// news.js (фрагмент)
async function checkAuthAndLoad() {
  const token = localStorage.getItem("token");

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.id;

      const res = await fetch("/api/user/role", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        userRole = data.role;

        const moderateBtn = document.getElementById("moderateBtn");
        if (
          moderateBtn &&
          (data.role === "admin" || data.role === "main_admin")
        ) {
          moderateBtn.style.display = "inline-block";
        }
      }

      const likedBtn = document.getElementById("likedNewsBtn");
      const dislikedBtn = document.getElementById("dislikedNewsBtn");
      if (likedBtn) likedBtn.style.display = "inline-block";
      if (dislikedBtn) dislikedBtn.style.display = "inline-block";
    } catch (e) {
      console.log("Ошибка авторизации:", e);
    }
  }

  loadNews(currentFilter);
}

// Загрузка категорий
async function loadCategories() {
  try {
    const res = await fetch("/api/news/categories");
    const categories = await res.json();

    const select = document.getElementById("categoryFilter");
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.slug;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error);
  }
}

// Загрузка популярных хэштегов
async function loadPopularHashtags() {
  try {
    const res = await fetch("/api/news/hashtags/popular?limit=15");
    const hashtags = await res.json();

    const container = document.querySelector(".hashtags-list");
    if (!container) return;

    if (hashtags.length === 0) {
      container.style.display = "none";
      return;
    }

    container.innerHTML = hashtags
      .map(
        (tag) => `
      <span 
        class="hashtag ${currentHashtag === tag.name ? "active" : ""}"
        onclick="searchByHashtag('${tag.name}')"
      >
        #${tag.name}
      </span>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Ошибка загрузки хэштегов:", error);
  }
}

// Обработка поиска
window.handleSearch = function (event) {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(() => {
    currentSearch = event.target.value;
    currentPage = 1;
    loadNews(currentFilter);
  }, 500);
};

// Применение фильтров
window.applyFilters = function () {
  currentCategory = document.getElementById("categoryFilter").value;
  currentSort = document.getElementById("sortFilter").value;
  currentAuthor = document.getElementById("authorFilter").value; // 👈 ВОТ ЭТО ДОБАВЬ

  currentHashtag = "";
  currentPage = 1;
  loadNews(currentFilter);
};

// Поиск по хэштегу
window.searchByHashtag = function (hashtag) {
  if (currentHashtag === hashtag) {
    currentHashtag = ""; // второй клик = сброс
  } else {
    currentHashtag = hashtag;
  }

  currentSearch = "";
  document.getElementById("searchInput").value = "";
  currentPage = 1;

  loadNews(currentFilter);
  loadPopularHashtags();
};
// Обёртка для загрузки новостей с обновлением активной кнопки
window.loadNews = function (status, page = 1) {
  // Обновляем активный класс кнопок
  document
    .querySelectorAll(".filter-btn")
    .forEach((btn) => btn.classList.remove("active"));

  if (status === "approved") {
    const approvedBtn = document.querySelector(
      '.filter-btn[onclick*="approved"]',
    );
    if (approvedBtn) approvedBtn.classList.add("active");
  } else if (status === "liked") {
    const likedBtn = document.getElementById("likedNewsBtn");
    if (likedBtn) likedBtn.classList.add("active");
  } else if (status === "disliked") {
    const dislikedBtn = document.getElementById("dislikedNewsBtn");
    if (dislikedBtn) dislikedBtn.classList.add("active");
  }

  loadNewsInternal(status, page);
};

async function loadAuthors() {
  try {
    const res = await fetch("/api/news/authors");
    const authors = await res.json();

    const select = document.getElementById("authorFilter");

    authors.forEach((author) => {
      const option = document.createElement("option");
      option.value = author.id;
      option.textContent = `${author.fullname} (${author.news_count})`;
      select.appendChild(option);
    });
  } catch (e) {
    console.error("Ошибка загрузки авторов:", e);
  }
}

// Основная функция загрузки новостей
async function loadNewsInternal(status = "approved", page = 1) {
  currentFilter = status;
  currentPage = page;

  const container = document.getElementById("newsContainer");
  container.innerHTML = '<div class="loading">Загрузка новостей...</div>';

  try {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };

    // Строим URL с параметрами
    let url = `/api/news?page=${page}&limit=10&sort=${currentSort}`;

    // Определяем реальный статус для запроса
    let realStatus = status;
    let ratedBy = null;

    if (status === "liked") {
      realStatus = "approved";
      ratedBy = "like";
    } else if (status === "disliked") {
      realStatus = "approved";
      ratedBy = "dislike";
    }

    if (currentAuthor) {
      url += `&author=${currentAuthor}`;
    }

    // Добавляем статус
    if (realStatus !== "all") {
      url += `&status=${realStatus}`;
    }

    if (ratedBy) {
      url += `&rated_by=${ratedBy}`;
    }

    if (currentSearch) {
      url += `&search=${encodeURIComponent(currentSearch)}`;
    }

    if (currentCategory) {
      url += `&category=${currentCategory}`;
    }

    if (currentHashtag) {
      url += `&hashtag=${currentHashtag}`;
    }

    // Для обычных пользователей на вкладке "pending" показываем только их новости
    if (
      userRole !== "admin" &&
      userRole !== "main_admin" &&
      status === "pending" &&
      currentUserId
    ) {
      url += `&author=${currentUserId}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error("Ошибка загрузки");
    }

    const data = await res.json();
    displayNews(data.news);
    displayPagination(data.totalPages, data.page);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML =
      '<p class="error-message">Ошибка загрузки новостей</p>';
  }
}

async function displayNews(news) {
  const container = document.getElementById("newsContainer");

  if (!news.length) {
    container.innerHTML = '<p class="no-news">Новостей пока нет</p>';

    return;
  }

  const enrichedNews = await Promise.all(
    news.map(async (item) => {
      let author = "Неизвестный";

      let likes = 0;
      let dislikes = 0;
      let commentsCount = 0;

      try {
        // автор (как в detail)
        author = item.author_name || item.author_username || "Неизвестный";
      } catch {}

      try {
        // лайки / дизлайки
        const reactRes = await fetch(`/api/news/${item.id}/react`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const react = await reactRes.json();

        likes = react.likes || 0;

        dislikes = react.dislikes || 0;
      } catch {}

      try {
        // комментарии
        const commentsRes = await fetch(`/api/news/${item.id}/comments`);

        const comments = await commentsRes.json();

        commentsCount = countComments(comments);
      } catch {}

      return {
        ...item,

        author,

        likes,

        dislikes,

        commentsCount,
      };
    }),
  );

  container.innerHTML = enrichedNews
    .map((item) => {
      const hashtags = item.hashtags
        ? item.hashtags.split(",").map((t) => t.trim())
        : [];

      return `

        <div class="news-card"
             onclick="
               window.location.href=
               'news-detail.html?id=${item.id}'
             ">

          ${
            item.image
              ? `
                <img
                  src="${item.image}"
                  class="news-image"
                >
              `
              : ""
          }

          <div class="news-content">

            <h3 class="news-title">

              ${escapeHtml(item.title)}

            </h3>

            <p class="news-preview">

              ${escapeHtml(item.content.substring(0, 150))}...

            </p>

            ${
              hashtags.length
                ? `
                  <div class="news-hashtags">

                    ${hashtags
                      .map(
                        (tag) => `

                      <span class="news-hashtag">

                        #${tag}

                      </span>

                    `,
                      )
                      .join("")}

                  </div>
                `
                : ""
            }

            <div class="news-meta">

              <span>

                👤 ${escapeHtml(item.author)}

              </span>

              <span>

                📅 ${formatDate(item.created_at)}

              </span>

              <span>

                👁️ ${item.views || 0}

              </span>

              <span>

                👍 ${item.likes}

              </span>

              <span>

                👎 ${item.dislikes}

              </span>

              <span>

                💬 ${item.commentsCount}

              </span>

            </div>

          </div>

        </div>

      `;
    })
    .join("");
}

function countComments(comments) {
  let total = 0;

  comments.forEach((c) => {
    total++;

    if (c.children && c.children.length) {
      total += countComments(c.children);
    }
  });

  return total;
}

function displayPagination(totalPages, currentPage) {
  const container = document.getElementById("pagination");

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = '<div class="pagination-controls">';

  // Кнопка "Назад"
  if (currentPage > 1) {
    html += `<button class="page-btn" onclick="loadNews('${currentFilter}', ${currentPage - 1})">←</button>`;
  }

  // Номера страниц
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 2 && i <= currentPage + 2)
    ) {
      html += `<button class="page-btn ${i === currentPage ? "active" : ""}" 
                       onclick="loadNews('${currentFilter}', ${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span class="page-dots">...</span>';
    }
  }

  // Кнопка "Вперед"
  if (currentPage < totalPages) {
    html += `<button class="page-btn" onclick="loadNews('${currentFilter}', ${currentPage + 1})">→</button>`;
  }

  html += "</div>";
  container.innerHTML = html;
}

function getStatusText(status) {
  switch (status) {
    case "pending":
      return "На модерации";
    case "approved":
      return "Опубликовано";
    case "rejected":
      return "Отклонено";
    default:
      return status;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
