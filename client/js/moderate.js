// moderate.js
document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }

  // Проверяем права доступа
  checkAccessAndLoad();
});

async function checkAccessAndLoad() {
  try {
    const token = localStorage.getItem("token");
    const payload = JSON.parse(atob(token.split(".")[1]));

    // Проверяем роль через API
    const res = await fetch("/api/user/role", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!data.isAdmin) {
      alert("У вас нет прав доступа к этой странице");
      window.location.href = "news.html";
      return;
    }

    loadPendingNews();
  } catch (error) {
    console.error("Ошибка проверки прав:", error);
    window.location.href = "news.html";
  }
}

async function loadPendingNews() {
  const container = document.getElementById("moderateContainer");

  try {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/moderate/news", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Ошибка загрузки");
    }

    const news = await res.json();
    displayPendingNews(news);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML =
      '<p class="error-message">Ошибка загрузки новостей</p>';
  }
}

function displayPendingNews(news) {
  const container = document.getElementById("moderateContainer");

  if (news.length === 0) {
    container.innerHTML = '<p class="no-news">Нет новостей на модерацию</p>';
    return;
  }

  container.innerHTML = news
    .map(
      (item) => `
        <div class="moderate-card">
            <h3 class="news-title">${escapeHtml(item.title)}</h3>
            <div class="news-meta">
                <span class="news-author">👤 ${item.author_name || item.author_username}</span>
                <span class="news-date">📅 ${formatDate(item.created_at)}</span>
            </div>
            ${item.image ? `<img src="${item.image}" class="news-preview-image" alt="preview">` : ""}
            <p class="news-content">${escapeHtml(item.content.substring(0, 200))}...</p>
            <div class="moderate-actions">
                <button class="btn-approve" onclick="moderateNews(${item.id}, 'approved')">✅ Одобрить</button>
                <button class="btn-reject" onclick="moderateNews(${item.id}, 'rejected')">❌ Отклонить</button>
            </div>
        </div>
    `,
    )
    .join("");
}

async function moderateNews(newsId, status) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`/api/moderate/news/${newsId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка");
    }

    alert(data.message);
    loadPendingNews(); // Перезагружаем список
  } catch (error) {
    console.error("Ошибка:", error);
    alert("Ошибка модерации");
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Делаем функции глобальными
window.moderateNews = moderateNews;
