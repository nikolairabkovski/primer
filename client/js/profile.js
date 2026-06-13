// profile.js
const token = localStorage.getItem("token");

if (!token) {
  alert("Сначала войдите в систему");
  window.location.href = "login.html";
}

let payload = null;
let userId = null;

try {
  payload = JSON.parse(atob(token.split(".")[1]));
  userId = payload.id;
} catch (e) {
  console.error("Ошибка токена:", e);
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

async function loadProfile() {
  try {
    // Загружаем данные пользователя
    const userRes = await fetch(`/api/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      throw new Error("Ошибка загрузки профиля");
    }

    const user = await userRes.json();

    // Заполняем информацию
    document.getElementById("fullname").textContent =
      user.fullname || "Не указано";
    document.getElementById("username").textContent =
      user.username || "Не указано";
    document.getElementById("email").textContent = user.email || "Не указано";
    document.getElementById("city").textContent = user.city || "Не указано";
    document.getElementById("birthdate").textContent =
      user.birthdate || "Не указано";
    document.getElementById("club").textContent = user.club || "Не указано";
    document.getElementById("bio").textContent =
      user.bio || "Информация отсутствует";
    document.getElementById("role").textContent = getRoleName(
      user.role || "user",
    );

    // Заполняем боковую панель
    document.getElementById("profileFullname").textContent =
      user.fullname || user.username;
    document.getElementById("profileUsername").textContent =
      `@${user.username || "unknown"}`;

    if (user.avatar) {
      const avatarImg = document.getElementById("profileAvatar");
      avatarImg.innerHTML = `<img src="${user.avatar}" alt="Avatar">`;
    }

    // Загружаем статистику
    await loadUserStats();

    // Загружаем подписки на клубы
    await loadUserClubSubscriptions();

    // Загружаем список друзей
    await loadUserFriends();

    // Загружаем новости пользователя
    await loadUserNews();
  } catch (error) {
    console.error("Ошибка:", error);
    document.querySelector(".profile-main").innerHTML =
      '<p class="error">Ошибка загрузки профиля</p>';
  }
}

async function loadUserStats() {
  try {
    // Загружаем количество клубов (подписок)
    const clubsRes = await fetch(`/api/user/subscriptions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (clubsRes.ok) {
      const subscriptions = await clubsRes.json();
      const clubsCount = subscriptions.length || 0;
      document.getElementById("clubsCount").textContent = clubsCount;
      // Обновляем текст подписи
      const clubsLabel = document.querySelector("#clubsCount + .stat-label");
      if (clubsLabel) {
        clubsLabel.textContent = getDeclension(
          clubsCount,
          "Клуб",
          "Клуба",
          "Клубов",
        );
      }
    } else {
      document.getElementById("clubsCount").textContent = "0";
      const clubsLabel = document.querySelector("#clubsCount + .stat-label");
      if (clubsLabel) clubsLabel.textContent = "Клубов";
    }

    // Загружаем количество друзей
    const friendsRes = await fetch(`/api/friends`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (friendsRes.ok) {
      const friends = await friendsRes.json();
      const friendsCount = friends.length || 0;
      document.getElementById("friendsCount").textContent = friendsCount;
      // Обновляем текст подписи
      const friendsLabel = document.querySelector(
        "#friendsCount + .stat-label",
      );
      if (friendsLabel) {
        friendsLabel.textContent = getDeclension(
          friendsCount,
          "Друг",
          "Друга",
          "Друзей",
        );
      }
    } else {
      document.getElementById("friendsCount").textContent = "0";
      const friendsLabel = document.querySelector(
        "#friendsCount + .stat-label",
      );
      if (friendsLabel) friendsLabel.textContent = "Друзей";
    }

    // Убираем посты и рейтинг
    const postsCountElem = document.getElementById("postsCount");
    const ratingElem = document.getElementById("rating");
    if (postsCountElem && postsCountElem.parentElement) {
      postsCountElem.parentElement.style.display = "none";
    }
    if (ratingElem && ratingElem.parentElement) {
      ratingElem.parentElement.style.display = "none";
    }
  } catch (error) {
    console.error("Ошибка загрузки статистики:", error);
    document.getElementById("clubsCount").textContent = "0";
    document.getElementById("friendsCount").textContent = "0";
  }
}

// Функция для склонения слов
function getDeclension(number, one, two, five) {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) {
    return five;
  }
  n %= 10;
  if (n === 1) {
    return one;
  }
  if (n >= 2 && n <= 4) {
    return two;
  }
  return five;
}

async function loadUserClubSubscriptions() {
  try {
    const res = await fetch(`/api/user/subscriptions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const subscriptions = await res.json();
      displayClubSubscriptions(subscriptions);
    } else {
      displayClubSubscriptions([]);
    }
  } catch (error) {
    console.error("Ошибка загрузки подписок на клубы:", error);
    displayClubSubscriptions([]);
  }
}

function displayClubSubscriptions(subscriptions) {
  const clubsSection = document.getElementById("userClubSubscriptions");
  if (!clubsSection) {
    createClubSubscriptionsSection();
  }

  const clubsContainer = document.getElementById("clubsList");
  if (clubsContainer) {
    if (subscriptions && subscriptions.length > 0) {
      clubsContainer.innerHTML = subscriptions
        .map((sub) => {
          const membersCount = sub.members_count || 0;
          const postsCount = sub.posts_count || 0;

          // Нормализуем данные клуба для единообразия
          const normalizedClub = normalizeClubData(sub);

          return `
        <div class="club-subscription-item" onclick="window.location.href='club.html?club=${encodeURIComponent(normalizedClub.username)}'">
          <div class="club-avatar-mini">${normalizedClub.avatar ? `<img src="${normalizedClub.avatar}" alt="${escapeHtml(normalizedClub.name)}">` : "⚽"}</div>
          <div class="club-info">
            <div class="club-name">${escapeHtml(normalizedClub.name)}</div>
            <div class="club-role" data-role="${sub.role}">${getClubMemberRole(sub.role)}</div>
            <div class="club-meta">
              <span>👥 ${membersCount} ${getDeclension(membersCount, "участник", "участника", "участников")}</span>
              <span>📝 ${postsCount} ${getDeclension(postsCount, "пост", "поста", "постов")}</span>
            </div>
          </div>
        </div>
      `;
        })
        .join("");
    } else {
      clubsContainer.innerHTML =
        '<div class="empty-state">Пока не подписан ни на один клуб</div>';
    }
  }
}

// Функция нормализации данных клуба (как в clubs.js)
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

  // 📝 Посты
  const postsRaw = club.posts_count ?? club.posts ?? club.total_posts ?? 0;
  normalized.postsCount = Number(postsRaw) || 0;

  // Username для перехода
  normalized.username =
    club.username || club.name?.toLowerCase().replace(/\s+/g, "_") || "unknown";

  return normalized;
}

function getClubMemberRole(role) {
  const roles = {
    member: "Участник",
    moderator: "Модератор",
    admin: "Администратор",
    creator: "Создатель",
  };
  return roles[role] || role;
}

function createClubSubscriptionsSection() {
  const profileMain = document.querySelector(".profile-main");
  const statsSection = document.querySelector(".profile-section:first-child");

  const clubsSection = document.createElement("section");
  clubsSection.className = "profile-section";
  clubsSection.id = "userClubSubscriptions";
  clubsSection.innerHTML = `
    <h2>⚽ Мои клубы</h2>
    <div class="subscriptions-list">
      <div id="clubsList" class="clubs-list"></div>
    </div>
  `;

  if (statsSection && statsSection.nextSibling) {
    profileMain.insertBefore(clubsSection, statsSection.nextSibling);
  } else {
    profileMain.appendChild(clubsSection);
  }
}

async function loadUserFriends() {
  try {
    const res = await fetch(`/api/friends`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const friends = await res.json();
      displayUserFriends(friends);
    } else {
      displayUserFriends([]);
    }
  } catch (error) {
    console.error("Ошибка загрузки друзей:", error);
    displayUserFriends([]);
  }
}

function displayUserFriends(friends) {
  const friendsSection = document.getElementById("userFriends");
  if (!friendsSection) {
    createFriendsSection();
  }

  const friendsContainer = document.getElementById("friendsList");
  if (friendsContainer) {
    if (friends && friends.length > 0) {
      friendsContainer.innerHTML = friends
        .map(
          (friend) => `
        <div class="friend-item" onclick="window.location.href='profile.html?id=${friend.id}'">
          <div class="friend-avatar">${friend.avatar ? `<img src="${friend.avatar}" alt="${escapeHtml(friend.fullname || friend.username)}">` : "👤"}</div>
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(friend.fullname || friend.username)}</div>
            <div class="friend-username">@${escapeHtml(friend.username)}</div>
            <div class="friend-status ${friend.is_online ? "online" : "offline"}">
              ${friend.is_online ? "🟢 В сети" : "⚫ Не в сети"}
            </div>
          </div>
        </div>
      `,
        )
        .join("");
    } else {
      friendsContainer.innerHTML =
        '<div class="empty-state">Пока нет друзей</div>';
    }
  }
}

function createFriendsSection() {
  const profileMain = document.querySelector(".profile-main");
  const clubsSection = document.getElementById("userClubSubscriptions");

  const friendsSection = document.createElement("section");
  friendsSection.className = "profile-section";
  friendsSection.id = "userFriends";
  friendsSection.innerHTML = `
    <h2>👥 Мои друзья</h2>
    <div id="friendsList" class="friends-list"></div>
  `;

  if (clubsSection && clubsSection.nextSibling) {
    profileMain.insertBefore(friendsSection, clubsSection.nextSibling);
  } else if (clubsSection) {
    profileMain.insertBefore(friendsSection, clubsSection.nextSibling);
  } else {
    profileMain.appendChild(friendsSection);
  }
}

async function loadUserNews() {
  try {
    const res = await fetch(`/api/news?author=${userId}&status=all&limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      displayUserNews(data.news || []);
    } else {
      displayUserNews([]);
    }
  } catch (error) {
    console.error("Ошибка загрузки новостей пользователя:", error);
    displayUserNews([]);
  }
}

function displayUserNews(news) {
  const newsSection = document.getElementById("userNews");
  if (!newsSection) {
    createNewsSection();
  }

  const newsCount = document.getElementById("userNewsCount");
  const newsContainer = document.getElementById("userNewsList");

  if (newsCount) {
    newsCount.textContent = news.length;
  }

  if (newsContainer) {
    if (news && news.length > 0) {
      newsContainer.innerHTML = news
        .slice(0, 5)
        .map((article) => {
          const viewsCount = article.views || 0;
          const likesCount = article.likes_count || 0;
          const commentsCount = article.comments_count || 0;

          return `
        <div class="news-item" onclick="window.location.href='news-detail.html?id=${article.id}'">
          <div class="news-image-mini">
            ${article.image ? `<img src="${article.image}" alt="${escapeHtml(article.title)}">` : "📰"}
          </div>
          <div class="news-info">
            <div class="news-title">${escapeHtml(article.title)}</div>
            <div class="news-preview">${escapeHtml(article.content.substring(0, 100))}${article.content.length > 100 ? "..." : ""}</div>
            <div class="news-meta">
              <span class="news-status status-${article.status}">${getNewsStatus(article.status)}</span>
              <span class="news-date">📅 ${formatDate(article.created_at)}</span>
              <span class="news-views">👁️ ${viewsCount} ${getDeclension(viewsCount, "просмотр", "просмотра", "просмотров")}</span>
              <span class="news-likes">❤️ ${likesCount} ${getDeclension(likesCount, "лайк", "лайка", "лайков")}</span>
              <span class="news-comments">💬 ${commentsCount} ${getDeclension(commentsCount, "комментарий", "комментария", "комментариев")}</span>
            </div>
          </div>
        </div>
      `;
        })
        .join("");

      if (news.length > 5) {
        newsContainer.innerHTML += `
          <div class="show-more">
            <a href="my-news.html">Показать все новости (${news.length})</a>
          </div>
        `;
      }
    } else {
      newsContainer.innerHTML =
        '<div class="empty-state">Пользователь пока не создал ни одной новости</div>';
    }
  }
}

function createNewsSection() {
  const profileMain = document.querySelector(".profile-main");
  const friendsSection = document.getElementById("userFriends");

  const newsSection = document.createElement("section");
  newsSection.className = "profile-section";
  newsSection.id = "userNews";
  newsSection.innerHTML = `
    <h2>📰 Мои новости <span id="userNewsCount" class="news-count">0</span></h2>
    <div id="userNewsList" class="news-list"></div>
  `;

  if (friendsSection && friendsSection.nextSibling) {
    profileMain.insertBefore(newsSection, friendsSection.nextSibling);
  } else if (friendsSection) {
    profileMain.insertBefore(newsSection, friendsSection.nextSibling);
  } else {
    profileMain.appendChild(newsSection);
  }
}

function getNewsStatus(status) {
  const statuses = {
    pending: "На модерации",
    published: "Опубликовано",
    approved: "Опубликовано",
    rejected: "Отклонено",
  };
  return statuses[status] || status;
}

function formatDate(dateString) {
  if (!dateString) return "Не указано";
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getRoleName(role) {
  const roles = {
    main_admin: "Главный администратор",
    admin: "Администратор",
    user: "Пользователь",
    moderator: "Модератор",
  };
  return roles[role] || role;
}

// Функция выхода
window.logout = function () {
  document.getElementById("logoutModal").style.display = "block";
};

window.confirmLogout = function () {
  localStorage.removeItem("token");
  window.location.href = "index.html";
};

window.closeLogoutModal = function () {
  document.getElementById("logoutModal").style.display = "none";
};

// Закрытие модального окна по клику вне его
window.onclick = function (event) {
  const modal = document.getElementById("logoutModal");
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

// Загружаем профиль
loadProfile();
