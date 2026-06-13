// friends.js
const token = localStorage.getItem("token");

if (!token) {
  alert("Не авторизован. Перенаправление на страницу входа.");
  window.location.href = "login.html";
}

let currentUserId = null;

try {
  const payload = JSON.parse(atob(token.split(".")[1]));
  currentUserId = payload.id;
} catch (err) {
  console.error("Ошибка парсинга токена:", err);
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// Поиск пользователей
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

let searchTimeout;

searchInput.addEventListener("input", function () {
  clearTimeout(searchTimeout);
  const query = this.value.trim();

  if (query.length < 2) {
    searchResults.innerHTML = "";
    searchResults.classList.remove("active");
    return;
  }

  searchTimeout = setTimeout(() => {
    searchUsers(query);
  }, 300);
});

async function searchUsers(query) {
  try {
    const res = await fetch(
      `/api/users/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
      }
      throw new Error("Ошибка поиска");
    }

    const users = await res.json();
    displaySearchResults(users);
  } catch (error) {
    console.error("Ошибка поиска:", error);
  }
}

function displaySearchResults(users) {
  if (users.length === 0) {
    searchResults.innerHTML = '<div class="no-results">Ничего не найдено</div>';
    searchResults.classList.add("active");
    return;
  }

  searchResults.innerHTML = users
    .map(
      (user) => `
    <div class="search-result-item">
      <div class="user-info">
        <div class="user-name">${user.fullname || user.username}</div>
        <div class="user-nickname">@${user.nickname || user.username}</div>
        ${user.city ? `<div class="user-city">${user.city}</div>` : ""}
      </div>
      <button onclick="sendFriendRequest(${user.id})" class="btn-add-friend">
        Добавить в друзья
      </button>
    </div>
  `,
    )
    .join("");

  searchResults.classList.add("active");
}

// Отправка заявки в друзья
window.sendFriendRequest = async function (friendId) {
  try {
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friendId }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка отправки заявки");
    }

    alert(data.message);
    searchResults.innerHTML = "";
    searchResults.classList.remove("active");
    searchInput.value = "";

    // Обновляем списки
    loadOutgoingRequests();
  } catch (error) {
    alert(error.message);
  }
};

// Загрузка друзей
async function loadFriends() {
  try {
    const res = await fetch("/api/friends", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
      }
      throw new Error("Ошибка загрузки друзей");
    }

    const friends = await res.json();
    displayFriends(friends);
  } catch (error) {
    console.error("Ошибка загрузки друзей:", error);
  }
}

function displayFriends(friends) {
  const container = document.getElementById("friendsList");

  if (friends.length === 0) {
    container.innerHTML = '<p class="no-data">У вас пока нет друзей</p>';
    return;
  }

  container.innerHTML = friends
    .map(
      (friend) => `
    <div class="user-card">
      <div class="user-avatar">
        ${friend.avatar ? `<img src="${friend.avatar}" alt="avatar">` : "👤"}
        <span class="online-dot ${friend.is_online ? "online" : "offline"}"></span>
      </div>
      <div class="user-details">
        <h3>${friend.fullname || "Без имени"}</h3>
        <p class="username">@${friend.nickname || friend.username}</p>
        ${friend.city ? `<p class="city">📍 ${friend.city}</p>` : ""}
        ${friend.club ? `<p class="club">⚽ ${friend.club}</p>` : ""}
        <p class="status">${friend.is_online ? "🟢 В сети" : "⚫ Не в сети"}</p>
      </div>
      <div class="user-actions">
        <button onclick="openChat(${friend.id})" class="btn-chat">💬 Чат</button>
        <button onclick="removeFriend(${friend.id})" class="btn-remove">❌ Удалить</button>
      </div>
    </div>
  `,
    )
    .join("");
}

// Добавьте функции форматирования:

function formatLastSeen(timestamp) {
  if (!timestamp) return "никогда не был(а)";

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return "online";
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `был(а) ${minutes} ${getMinutesWord(minutes)} назад`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `был(а) ${hours} ${getHoursWord(hours)} назад`;
  } else {
    return `был(а) ${date.toLocaleDateString("ru-RU")}`;
  }
}

function getMinutesWord(minutes) {
  if (minutes % 10 === 1 && minutes % 100 !== 11) return "минуту";
  if (
    minutes % 10 >= 2 &&
    minutes % 10 <= 4 &&
    (minutes % 100 < 10 || minutes % 100 >= 20)
  )
    return "минуты";
  return "минут";
}

function getHoursWord(hours) {
  if (hours % 10 === 1 && hours % 100 !== 11) return "час";
  if (
    hours % 10 >= 2 &&
    hours % 10 <= 4 &&
    (hours % 100 < 10 || hours % 100 >= 20)
  )
    return "часа";
  return "часов";
}

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return "offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 60000 ? "online" : "offline";
}

// Функция открытия чата
window.openChat = function (userId) {
  window.location.href = `chat.html?userId=${userId}`;
};

// Загрузка входящих заявок
async function loadIncomingRequests() {
  try {
    const res = await fetch("/api/friends/requests/incoming", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Ошибка загрузки заявок");
    }

    const requests = await res.json();
    displayIncomingRequests(requests);

    // Обновляем счетчик
    document.getElementById("incomingCount").textContent = requests.length;
  } catch (error) {
    console.error("Ошибка загрузки входящих заявок:", error);
  }
}

function displayIncomingRequests(requests) {
  const container = document.getElementById("incomingRequests");

  if (requests.length === 0) {
    container.innerHTML = '<p class="no-data">Нет входящих заявок</p>';
    return;
  }

  container.innerHTML = requests
    .map(
      (request) => `
    <div class="user-card request-card">
      <div class="user-avatar">
        ${request.avatar ? `<img src="${request.avatar}" alt="avatar">` : "👤"}
      </div>
      <div class="user-details">
        <h3>${request.fullname || "Без имени"}</h3>
        <p class="username">@${request.nickname || request.username}</p>
        <p class="request-date">Заявка от: ${new Date(request.created_at).toLocaleDateString()}</p>
      </div>
      <div class="user-actions">
        <button onclick="acceptRequest(${request.request_id})" class="btn-accept">✅ Принять</button>
        <button onclick="rejectRequest(${request.request_id})" class="btn-reject">❌ Отклонить</button>
      </div>
    </div>
  `,
    )
    .join("");
}

// Загрузка исходящих заявок
async function loadOutgoingRequests() {
  try {
    const res = await fetch("/api/friends/requests/outgoing", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Ошибка загрузки заявок");
    }

    const requests = await res.json();
    displayOutgoingRequests(requests);

    // Обновляем счетчик
    document.getElementById("outgoingCount").textContent = requests.length;
  } catch (error) {
    console.error("Ошибка загрузки исходящих заявок:", error);
  }
}

function displayOutgoingRequests(requests) {
  const container = document.getElementById("outgoingRequests");

  if (requests.length === 0) {
    container.innerHTML = '<p class="no-data">Нет исходящих заявок</p>';
    return;
  }

  container.innerHTML = requests
    .map(
      (request) => `
    <div class="user-card request-card">
      <div class="user-avatar">
        ${request.avatar ? `<img src="${request.avatar}" alt="avatar">` : "👤"}
      </div>
      <div class="user-details">
        <h3>${request.fullname || "Без имени"}</h3>
        <p class="username">@${request.nickname || request.username}</p>
        <p class="request-date">Отправлено: ${new Date(request.created_at).toLocaleDateString()}</p>
      </div>
      <div class="user-actions">
        <span class="status-pending">Ожидает ответа</span>
      </div>
    </div>
  `,
    )
    .join("");
}

// Принять заявку
window.acceptRequest = async function (requestId) {
  try {
    const res = await fetch(`/api/friends/accept/${requestId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка принятия заявки");
    }

    alert(data.message);
    loadIncomingRequests();
    loadFriends();
  } catch (error) {
    alert(error.message);
  }
};

// Отклонить заявку
window.rejectRequest = async function (requestId) {
  try {
    const res = await fetch(`/api/friends/reject/${requestId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка отклонения заявки");
    }

    alert(data.message);
    loadIncomingRequests();
  } catch (error) {
    alert(error.message);
  }
};

// Удалить из друзей
window.removeFriend = async function (friendId) {
  if (!confirm("Вы уверены, что хотите удалить пользователя из друзей?")) {
    return;
  }

  try {
    const res = await fetch(`/api/friends/${friendId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка удаления из друзей");
    }

    alert(data.message);
    loadFriends();
  } catch (error) {
    alert(error.message);
  }
};

// Просмотр профиля
window.viewProfile = function (userId) {
  window.location.href = `profile.html?id=${userId}`;
};

// Переключение вкладок
window.showTab = function (tabName) {
  // Скрываем все вкладки
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Убираем активный класс у всех кнопок
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Показываем выбранную вкладку
  document.getElementById(`${tabName}Tab`).classList.add("active");

  // Активируем кнопку
  event.target.classList.add("active");

  // Загружаем данные для вкладки
  if (tabName === "friends") {
    loadFriends();
  } else if (tabName === "incoming") {
    loadIncomingRequests();
  } else if (tabName === "outgoing") {
    loadOutgoingRequests();
  }
};

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  loadFriends();
  loadIncomingRequests();
  loadOutgoingRequests();
});

// Закрытие результатов поиска при клике вне
document.addEventListener("click", function (event) {
  if (!event.target.closest(".search-box")) {
    searchResults.classList.remove("active");
  }
});
