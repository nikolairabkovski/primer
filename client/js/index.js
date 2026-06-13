// index.js
let currentUserRole = null;
let currentUserId = null;

document.addEventListener("DOMContentLoaded", function () {
  console.log("Страница загружена, проверяем авторизацию...");

  // Загружаем данные только если элементы существуют
  if (document.getElementById("popularClubsContainer")) {
    loadPopularClubs();
  }

  if (document.getElementById("latestNewsContainer")) {
    loadLatestNews();
  }

  checkAuthStatus();
  setupNavigation();
});

// Настройка навигационного меню
function setupNavigation() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
    }
  });
}

// Загрузка популярных клубов
async function loadPopularClubs() {
  const container = document.getElementById("popularClubsContainer");
  if (!container) {
    console.log("Элемент popularClubsContainer не найден");
    return;
  }

  try {
    const res = await fetch("/api/clubs/popular?limit=3");

    if (!res.ok) {
      throw new Error(`Ошибка HTTP: ${res.status}`);
    }

    const clubs = await res.json();
    displayPopularClubs(clubs);
  } catch (error) {
    console.error("Ошибка загрузки популярных клубов:", error);
    if (container) {
      container.innerHTML =
        '<p class="error-message">Не удалось загрузить клубы</p>';
    }
  }
}

// Отображение популярных клубов
function displayPopularClubs(clubs) {
  const container = document.getElementById("popularClubsContainer");
  if (!container) return;

  if (!clubs || clubs.length === 0) {
    container.innerHTML = '<p class="no-data">Пока нет клубов</p>';
    return;
  }

  container.innerHTML = clubs
    .map(
      (club) => `
    <div class="club-card" onclick="window.location.href='club.html?club=${club.username}'">
      <div class="club-avatar">
        ${club.avatar ? `<img src="${club.avatar}" alt="${club.name}">` : "⚽"}
      </div>
      <div class="club-info">
        <h3 class="club-name">${escapeHtml(club.name)}</h3>
        <p class="club-username">@${escapeHtml(club.username)}</p>
        <p class="club-description">${escapeHtml(club.description?.substring(0, 60))}...</p>
        <div class="club-stats">
          <span>👥 ${club.members_count || 0}</span>
          <span>📝 ${club.posts_count ?? "..."}</span>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

// Загрузка последних новостей
async function loadLatestNews() {
  const container = document.getElementById("latestNewsContainer");
  if (!container) {
    console.log("Элемент latestNewsContainer не найден");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch("/api/news?status=approved&page=1&limit=3", {
      headers,
    });

    if (!res.ok) {
      throw new Error(`Ошибка HTTP: ${res.status}`);
    }

    const data = await res.json();
    displayLatestNews(data.news || []);
  } catch (error) {
    console.error("Ошибка загрузки новостей:", error);
    if (container) {
      container.innerHTML =
        '<p class="error-message">Не удалось загрузить новости</p>';
    }
  }
}

// Отображение последних новостей
async function displayLatestNews(news) {
  const container = document.getElementById("latestNewsContainer");

  if (!container) return;

  if (!news.length) {
    container.innerHTML = "Нет новостей";
    return;
  }

  const enrichedNews = await Promise.all(
    news.map(async (item) => {
      // лайки
      let likes = 0;
      let dislikes = 0;

      try {
        const r = await fetch(`/api/news/${item.id}/react`);
        const react = await r.json();

        likes = react.likes || 0;
        dislikes = react.dislikes || 0;
      } catch {}

      // комментарии
      const commentsCount = await getCommentsCount(item.id);

      return {
        ...item,
        likes,
        dislikes,
        commentsCount,
      };
    }),
  );

  container.innerHTML = enrichedNews
    .map(
      (item) => `

    <div class="news-card"
         onclick="window.location.href='news-detail.html?id=${item.id}'">

      ${item.image ? `<img src="${item.image}" class="news-card-image">` : ""}

      <div class="news-card-content">

        <h3>
          ${escapeHtml(item.title)}
        </h3>

        <p>
          ${escapeHtml(item.content.substring(0, 120))}...
        </p>

        <div class="news-card-meta">

          <span>📅 ${formatDate(item.created_at)}</span>

          <span>👍 ${item.likes}</span>

          <span>👎 ${item.dislikes}</span>

          <span>💬 ${item.commentsCount}</span>

          <span>👁️ ${item.views || 0}</span>

        </div>

      </div>

    </div>

  `,
    )
    .join("");
}
// Проверка статуса авторизации
async function checkAuthStatus() {
  const token = localStorage.getItem("token");
  console.log("Токен в localStorage:", token ? "✅ Есть" : "❌ Нет");

  const authSection = document.getElementById("auth-section");
  const contentSection = document.getElementById("content-section");
  const quickActionsSection = document.getElementById("quickActionsSection");
  const guestSection = document.getElementById("guestSection");
  const adminNavItem = document.getElementById("adminNavItem");
  const quickActions = document.getElementById("quickActions");

  if (!authSection) {
    console.error("Элемент auth-section не найден!");
    return;
  }

  if (token) {
    try {
      const tokenParts = token.split(".");
      if (tokenParts.length !== 3) {
        throw new Error("Неверный формат токена");
      }

      const payload = JSON.parse(atob(tokenParts[1]));
      currentUserId = payload.id;
      console.log("✅ Токен валидный, пользователь ID:", payload.id);

      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired) {
        console.log("❌ Токен истек");
        localStorage.removeItem("token");
        showUnauthorizedContent(
          authSection,
          contentSection,
          quickActionsSection,
          guestSection,
          adminNavItem,
        );
      } else {
        // Получаем роль пользователя
        await loadUserRole(token);

        // Показываем админ-панель в навигации для админов
        if (
          adminNavItem &&
          (currentUserRole === "admin" || currentUserRole === "main_admin")
        ) {
          adminNavItem.style.display = "inline-block";
        }

        await loadUserData(
          payload.id,
          authSection,
          contentSection,
          quickActionsSection,
          guestSection,
          quickActions,
        );
      }
    } catch (err) {
      console.error("❌ Ошибка при проверке токена:", err);
      localStorage.removeItem("token");
      showUnauthorizedContent(
        authSection,
        contentSection,
        quickActionsSection,
        guestSection,
        adminNavItem,
      );
    }
  } else {
    console.log("❌ Пользователь не авторизован");
    showUnauthorizedContent(
      authSection,
      contentSection,
      quickActionsSection,
      guestSection,
      adminNavItem,
    );
  }
}

// Загрузка роли пользователя
async function loadUserRole(token) {
  try {
    const res = await fetch("/api/user/role", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      currentUserRole = data.role;
      console.log("Роль пользователя:", currentUserRole);
    }
  } catch (error) {
    console.error("Ошибка загрузки роли:", error);
  }
}

// Загрузка данных пользователя
async function loadUserData(
  userId,
  authSection,
  contentSection,
  quickActionsSection,
  guestSection,
  quickActions,
) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Не удалось загрузить данные пользователя");
    }

    const user = await res.json();
    console.log("Данные пользователя загружены:", user);

    showAuthorizedContent(
      authSection,
      contentSection,
      quickActionsSection,
      guestSection,
      quickActions,
      user,
    );
  } catch (err) {
    console.error("Ошибка загрузки данных:", err);
    showAuthorizedSimple(
      authSection,
      contentSection,
      quickActionsSection,
      guestSection,
      quickActions,
    );
  }
}

// Отображение контента для авторизованных пользователей
function showAuthorizedContent(
  authSection,
  contentSection,
  quickActionsSection,
  guestSection,
  quickActions,
  user,
) {
  // Скрываем гостевой блок
  if (guestSection) guestSection.style.display = "none";

  // Показываем блок быстрых действий
  if (quickActionsSection) quickActionsSection.style.display = "block";

  if (authSection) {
    authSection.innerHTML = `
      <div class="auth-links">
        <span class="welcome-message">👋 ${user.fullname || user.username || "Пользователь"}!</span>
        <div class="auth-buttons">
          <a href="profile.html" class="btn-profile">Профиль</a>
          <button onclick="logout()" class="btn-logout">Выйти</button>
        </div>
      </div>
    `;
  }

  // Заполняем быстрые действия
  if (quickActions) {
    quickActions.innerHTML = getQuickActions(user);
  }

  if (contentSection) {
    contentSection.innerHTML = `
      <div class="authorized-content">
        <h3>Личный кабинет</h3>
        <div class="user-info">
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Роль:</strong> ${user.role === "admin" ? "Администратор" : "Пользователь"}</p>
          ${user.city ? `<p><strong>Город:</strong> ${user.city}</p>` : ""}
          ${user.club ? `<p><strong>Любимый клуб:</strong> ${user.club}</p>` : ""}
        </div>
      </div>
    `;
  }
}

// Быстрые действия в зависимости от роли
function getQuickActions(user) {
  const actions = [
    { url: "profile.html", icon: "👤", text: "Мой профиль" },
    { url: "edit-profile.html", icon: "✏️", text: "Редактировать" },
    { url: "friends.html", icon: "👥", text: "Друзья" },
    { url: "clubs.html", icon: "⚽", text: "Клубы" },
    { url: "news.html", icon: "📰", text: "Новости" },
    { url: "create-news.html", icon: "➕", text: "Создать новость" },
    { url: "create-club.html", icon: "🏆", text: "Создать клуб" },
    { url: "support.html", icon: "🆘", text: "Поддержка" },
  ];

  // Добавляем админ-панель для админов
  if (user.role === "admin" || user.role === "main_admin") {
    actions.push({ url: "admin.html", icon: "⚙️", text: "Админ-панель" });
  }

  return actions
    .map(
      (action) => `
    <a href="${action.url}" class="action-card">
      <span class="action-icon">${action.icon}</span>
      <span class="action-text">${action.text}</span>
    </a>
  `,
    )
    .join("");
}

// Упрощенная версия для авторизованных (при ошибке загрузки)
function showAuthorizedSimple(
  authSection,
  contentSection,
  quickActionsSection,
  guestSection,
  quickActions,
) {
  // Скрываем гостевой блок
  if (guestSection) guestSection.style.display = "none";

  // Показываем блок быстрых действий
  if (quickActionsSection) quickActionsSection.style.display = "block";

  if (authSection) {
    authSection.innerHTML = `
      <div class="auth-links">
        <span class="welcome-message">👋 Добро пожаловать!</span>
        <div class="auth-buttons">
          <a href="profile.html" class="btn-profile">Профиль</a>
          <button onclick="logout()" class="btn-logout">Выйти</button>
        </div>
      </div>
    `;
  }

  // Базовые быстрые действия
  if (quickActions) {
    quickActions.innerHTML = `
      <a href="profile.html" class="action-card">
        <span class="action-icon">👤</span>
        <span class="action-text">Профиль</span>
      </a>
      <a href="friends.html" class="action-card">
        <span class="action-icon">👥</span>
        <span class="action-text">Друзья</span>
      </a>
      <a href="news.html" class="action-card">
        <span class="action-icon">📰</span>
        <span class="action-text">Новости</span>
      </a>
      <a href="clubs.html" class="action-card">
        <span class="action-icon">⚽</span>
        <span class="action-text">Клубы</span>
      </a>
    `;
  }

  if (contentSection) {
    contentSection.innerHTML = `
      <div class="authorized-content">
        <h3>Личный кабинет</h3>
        <p>Добро пожаловать на портал!</p>
      </div>
    `;
  }
}

// Отображение контента для неавторизованных
function showUnauthorizedContent(
  authSection,
  contentSection,
  quickActionsSection,
  guestSection,
  adminNavItem,
) {
  // Скрываем блок быстрых действий
  if (quickActionsSection) quickActionsSection.style.display = "none";

  // Показываем гостевой блок
  if (guestSection) guestSection.style.display = "block";

  // Скрываем админ-панель в навигации
  if (adminNavItem) adminNavItem.style.display = "none";

  if (authSection) {
    authSection.innerHTML = `
      <div class="auth-links">
        <a href="login.html" class="btn-login">Вход</a>
        <a href="register.html" class="btn-register">Регистрация</a>
      </div>
    `;
  }

  if (contentSection) {
    contentSection.innerHTML = `
      <div class="unauthorized-content">
        <h3>Добро пожаловать на футбольный портал!</h3>
        <p>Для доступа к полному функционалу сайта, пожалуйста, авторизуйтесь или зарегистрируйтесь.</p>
        
        <div class="features">
          <h4>Что вы получите после регистрации:</h4>
          <ul>
            <li>✓ Создание личного профиля</li>
            <li>✓ Просмотр информации о других пользователях</li>
            <li>✓ Возможность указать любимый футбольный клуб</li>
            <li>✓ Общение с единомышленниками</li>
            <li>✓ Чтение и создание новостей</li>
            <li>✓ Создание и участие в клубах</li>
          </ul>
        </div>
        
        <div class="cta-buttons">
          <a href="register.html" class="btn-large">Зарегистрироваться</a>
          <a href="login.html" class="btn-large">Войти</a>
        </div>
      </div>
    `;
  }
}

async function getCommentsCount(newsId) {
  try {
    const res = await fetch(`/api/news/${newsId}/comments`);
    const comments = await res.json();

    // считаем все комментарии включая ответы
    function countAll(arr) {
      let total = 0;

      arr.forEach((c) => {
        total++;

        if (c.children && c.children.length) {
          total += countAll(c.children);
        }
      });

      return total;
    }

    return countAll(comments);
  } catch {
    return 0;
  }
}

// Функция выхода
window.logout = function () {
  console.log("Выход из системы");
  localStorage.removeItem("token");
  window.location.href = "index.html";
};

// Форматирование даты
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Экранирование HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
