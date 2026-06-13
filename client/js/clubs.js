// clubs.js
let currentPage = 1;
let currentSort = "popular";
let currentUserId = null;

document.addEventListener("DOMContentLoaded", function () {
  console.log("Страница клубов загружена");
  checkAuth();
  loadRecommendedClubs();
  loadAllClubsSimple();
  setupSearch();
  setupSortFilterSimple();
});

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem("token");
  const createBtn = document.getElementById("createClubBtn");

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.id;
      console.log("Пользователь авторизован, ID:", currentUserId);
      if (createBtn) createBtn.style.display = "inline-block";
    } catch (e) {
      console.error("Ошибка декодирования токена:", e);
      if (createBtn) createBtn.style.display = "none";
    }
  } else {
    console.log("Пользователь не авторизован");
    if (createBtn) createBtn.style.display = "none";
  }
}

// Настройка фильтра сортировки
function setupSortFilterSimple() {
  const sortFilter = document.getElementById("sortFilter");
  if (!sortFilter) return;

  sortFilter.addEventListener("change", function () {
    currentSort = this.value;
    currentPage = 1;
    loadAllClubsSimple();
  });
}

// ============ ПОИСК КЛУБОВ ============
function setupSearch() {
  const searchInput = document.getElementById("clubSearch");
  if (!searchInput) return;

  let searchTimeout;

  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();

    if (query.length < 2) {
      document.getElementById("searchResults").innerHTML = "";
      document.getElementById("searchResults").classList.remove("active");
      return;
    }

    searchTimeout = setTimeout(() => searchClubs(query), 300);
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-box")) {
      const results = document.getElementById("searchResults");
      if (results) results.classList.remove("active");
    }
  });
}

async function searchClubs(query) {
  try {
    const res = await fetch(
      `/api/clubs/search?query=${encodeURIComponent(query)}`,
    );
    if (!res.ok) throw new Error("Ошибка поиска");
    const clubs = await res.json();
    displaySearchResults(clubs);
  } catch (error) {
    console.error("Ошибка поиска:", error);
  }
}

function displaySearchResults(clubs) {
  const container = document.getElementById("searchResults");
  if (!container) return;

  if (!clubs || clubs.length === 0) {
    container.innerHTML = '<div class="no-results">Клубы не найдены</div>';
    container.classList.add("active");
    return;
  }

  container.innerHTML = clubs
    .map((club) => {
      // Нормализуем данные
      const normalizedClub = normalizeClubData(club);

      return `
        <div class="search-result-item" onclick="window.location.href='club.html?club=${normalizedClub.username || ""}'">
            <div class="club-avatar-small">
                ${normalizedClub.avatar ? `<img src="${normalizedClub.avatar}" alt="${normalizedClub.name || ""}">` : "⚽"}
            </div>
            <div class="club-info">
                <div class="club-name">${escapeHtml(normalizedClub.name || "Без названия")}</div>
                <div class="club-username">@${escapeHtml(normalizedClub.username || "unknown")}</div>
                <div class="club-stats">👥 ${normalizedClub.membersCount + 1} подписчиков</div>
            </div>
        </div>
    `;
    })
    .join("");

  container.classList.add("active");
}

// ============ РЕКОМЕНДУЕМЫЕ КЛУБЫ ============
async function loadRecommendedClubs() {
  const container = document.getElementById("recommendedClubs");
  if (!container) return;

  try {
    const res = await fetch("/api/clubs/recommended");
    if (!res.ok) throw new Error("Ошибка загрузки");
    const clubs = await res.json();
    console.log("recommended raw:", clubs);

    if (!clubs || clubs.length === 0) {
      container.innerHTML =
        '<p class="no-data">Пока нет рекомендуемых клубов</p>';
      return;
    }

    // Нормализуем данные для каждого клуба
    const normalizedClubs = clubs.map((club) => normalizeClubData(club));

    container.innerHTML = normalizedClubs
      .map(
        (club) => `
        <div class="club-card" onclick="window.location.href='club.html?club=${club.username}'">
          <div class="club-avatar">
            ${club.avatar ? `<img src="${club.avatar}" alt="${club.name}">` : "⚽"}
          </div>
          <div class="club-info">
            <h3 class="club-name">${escapeHtml(club.name)}</h3>
            <p class="club-username">@${escapeHtml(club.username)}</p>
            <p class="club-description">${escapeHtml(club.description?.substring(0, 60))}${club.description?.length > 60 ? "..." : ""}</p>
            <div class="club-stats">
              <span>👥 ${club.membersCount}</span>
<span>📝 ${club.postsCount} постов</span>
            </div>
          </div>
        </div>
      `,
      )
      .join("");
  } catch (error) {
    console.error("Ошибка загрузки рекомендуемых клубов:", error);
    container.innerHTML =
      '<p class="error-message">Не удалось загрузить рекомендуемые клубы</p>';
  }
}

// ============ ЗАГРУЗКА ВСЕХ КЛУБОВ ============
async function loadAllClubsSimple() {
  const container = document.getElementById("allClubsContainer");
  if (!container) return;

  try {
    console.log(`Загрузка клубов с сортировкой: ${currentSort}`);
    container.innerHTML = '<div class="loading">Загрузка клубов...</div>';

    // Пробуем разные эндпоинты
    let clubs = [];

    // Сначала пробуем /api/clubs/popular
    try {
      const res = await fetch("/api/clubs/popular?limit=100");
      if (res.ok) {
        clubs = await res.json();
      }
    } catch (e) {
      console.log("Не удалось загрузить через popular, пробуем /api/clubs");
    }

    // Если не получилось, пробуем /api/clubs
    if (!clubs || clubs.length === 0) {
      try {
        const res = await fetch("/api/clubs");
        if (res.ok) {
          clubs = await res.json();
        }
      } catch (e) {
        console.log("Не удалось загрузить через clubs");
      }
    }

    console.log("Загружено клубов:", clubs ? clubs.length : 0);

    if (!clubs || clubs.length === 0) {
      container.innerHTML = '<p class="no-data">Клубов пока нет</p>';
      return;
    }

    // Нормализуем все клубы перед сортировкой
    const normalizedClubs = clubs.map((club) => normalizeClubData(club));

    // Сортируем на клиенте
    let sortedClubs = [...normalizedClubs];

    if (currentSort === "name") {
      sortedClubs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (currentSort === "newest") {
      sortedClubs.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );
    } else if (currentSort === "oldest") {
      sortedClubs.sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      );
    } else {
      // popular - по количеству подписчиков
      sortedClubs.sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0));
    }

    displayAllClubsSimple(sortedClubs);
  } catch (error) {
    console.error("Ошибка загрузки клубов:", error);
    container.innerHTML =
      '<p class="error-message">Не удалось загрузить клубы</p>';
  }
}

// ============ ФУНКЦИЯ НОРМАЛИЗАЦИИ ДАННЫХ ============
function normalizeClubData(club) {
  if (!club) return {};

  const normalized = { ...club };

  // 👥 Подписчики
  const membersRaw =
    club.members_count ??
    club.members ??
    club.followers_count ??
    club.followers ??
    club.subscribers_count ??
    club.subscribers ??
    0;

  normalized.membersCount = Number(membersRaw) || 0;

  // 📝 Посты (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ)
  const postsRaw = club.posts_count ?? club.posts ?? club.total_posts ?? 0;

  normalized.postsCount = Number(postsRaw) || 0;

  return normalized;
}

function displayAllClubsSimple(clubs) {
  const container = document.getElementById("allClubsContainer");
  if (!container) return;

  container.innerHTML = clubs
    .map((club) => {
      // Данные уже нормализованы
      return `
        <div class="club-card" onclick="window.location.href='club.html?club=${club.username || ""}'">
            <div class="club-avatar">
                ${club.avatar ? `<img src="${club.avatar}" alt="${club.name || ""}">` : "⚽"}
            </div>
            <div class="club-card-content">
                <h3 class="club-name">${escapeHtml(club.name || "Без названия")}</h3>
                <p class="club-username">@${escapeHtml(club.username || "unknown")}</p>
                ${club.description ? `<p class="club-description">${escapeHtml(club.description.substring(0, 60))}${club.description.length > 60 ? "..." : ""}</p>` : ""}
                <div class="club-stats">
                    <span>👥 ${club.membersCount}</span>
                    <span>📝 ${club.postsCount} постов</span>
                </div>
            </div>
        </div>
    `;
    })
    .join("");
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
