// chat.js
document.addEventListener("DOMContentLoaded", function () {
  console.log("Страница чата загружена");
  initChat();
});

function initChat() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Не авторизован. Перенаправление на страницу входа.");
    window.location.href = "login.html";
    return;
  }

  // Получаем ID пользователя из URL
  const urlParams = new URLSearchParams(window.location.search);
  const chatUserId = urlParams.get("userId");

  if (!chatUserId) {
    document.getElementById("chatHeader").innerHTML = `
      <div class="chat-user-info">
        <div class="chat-user-details">
          <h2>Выберите собеседника</h2>
        </div>
      </div>
    `;
    return;
  }

  // Сохраняем ID собеседника
  window.currentChatUserId = chatUserId;

  // Загружаем информацию о собеседнике
  loadUserInfo(chatUserId);

  // Загружаем историю сообщений
  loadChatHistory(chatUserId);

  // Настраиваем обработчики событий
  setupEventListeners();

  // Устанавливаем периодическое обновление (каждые 3 секунды)
  window.chatRefreshInterval = setInterval(() => {
    if (window.currentChatUserId) {
      loadChatHistory(window.currentChatUserId);
    }
  }, 3000);
}

function setupEventListeners() {
  // Обработка нажатия Enter для отправки
  const messageInput = document.getElementById("messageInput");
  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Обработка выбора фото
  const photoInput = document.getElementById("photoInput");
  if (photoInput) {
    photoInput.addEventListener("change", function () {
      const sendPhotoBtn = document.getElementById("sendPhotoBtn");
      if (this.files.length > 0) {
        sendPhotoBtn.style.display = "inline-block";
        // Показываем название файла
        console.log("Выбран файл:", this.files[0].name);
      } else {
        sendPhotoBtn.style.display = "none";
      }
    });
  }
}

// Загрузка информации о пользователе
async function loadUserInfo(userId) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Ошибка загрузки информации");
    }

    const user = await res.json();

    document.getElementById("chatHeader").innerHTML = `
      <div class="chat-user-info">
        <div class="chat-user-avatar">
          ${user.avatar ? `<img src="${user.avatar}" alt="avatar">` : "👤"}
        </div>
        <div class="chat-user-details">
          <h2>${user.fullname || user.username}</h2>
          <p class="user-email">${user.email}</p>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Ошибка загрузки информации:", error);
    document.getElementById("chatHeader").innerHTML = `
      <div class="chat-user-info">
        <div class="chat-user-details">
          <h2>Пользователь</h2>
        </div>
      </div>
    `;
  }
}

// Загрузка истории чата
async function loadChatHistory(userId) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/chat/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    if (!res.ok) {
      throw new Error(`Ошибка HTTP: ${res.status}`);
    }

    const messages = await res.json();
    displayMessages(messages);
  } catch (error) {
    console.error("Ошибка загрузки сообщений:", error);

    const container = document.getElementById("messagesContainer");
    if (container) {
      container.innerHTML = `<p class="error-message">Ошибка загрузки: ${error.message}</p>`;
    }
  }
}

// Отображение сообщений
function displayMessages(messages) {
  const container = document.getElementById("messagesContainer");
  if (!container) return;

  // Получаем ID текущего пользователя из токена
  let currentUserId = null;
  try {
    const token = localStorage.getItem("token");
    const payload = JSON.parse(atob(token.split(".")[1]));
    currentUserId = payload.id;
  } catch (e) {
    console.error("Ошибка получения ID пользователя");
  }

  if (messages.length === 0) {
    container.innerHTML =
      '<p class="no-messages">Нет сообщений. Напишите первое сообщение!</p>';
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      // Проверяем, является ли сообщение фото
      const isPhoto = msg.message && msg.message.startsWith("[Фото]");
      const photoUrl = isPhoto ? msg.message.replace("[Фото] ", "") : null;

      // Определяем, отправлено ли сообщение текущим пользователем
      const isOutgoing = msg.sender_id == currentUserId;

      return `
      <div class="message ${isOutgoing ? "outgoing" : "incoming"}">
        <div class="message-content">
          ${
            isPhoto
              ? `<img src="${photoUrl}" class="message-photo" alt="photo" onclick="window.open('${photoUrl}', '_blank')">`
              : `<div class="message-text">${escapeHtml(msg.message || "")}</div>`
          }
          <div class="message-time">
            ${formatTime(msg.created_at)}
            ${isOutgoing && msg.is_read ? '<span class="read-status">✓✓</span>' : ""}
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // Прокручиваем вниз
  container.scrollTop = container.scrollHeight;
}

// Отправка текстового сообщения
window.sendMessage = async function () {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  const token = localStorage.getItem("token");

  if (!message || !window.currentChatUserId) {
    alert("Введите сообщение");
    return;
  }

  if (!token) {
    alert("Токен не найден");
    window.location.href = "login.html";
    return;
  }

  // Блокируем кнопку на время отправки
  const sendBtn = document.querySelector(".btn-send");
  sendBtn.disabled = true;
  sendBtn.textContent = "Отправка...";

  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receiverId: window.currentChatUserId,
        message: message,
      }),
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка отправки");
    }

    // Очищаем поле ввода
    input.value = "";

    // Добавляем сообщение в историю (оптимистичное обновление)
    const messagesContainer = document.getElementById("messagesContainer");
    const newMessage = document.createElement("div");
    newMessage.className = "message outgoing";
    newMessage.innerHTML = `
      <div class="message-content">
        <div class="message-text">${escapeHtml(message)}</div>
        <div class="message-time">Только что</div>
      </div>
    `;
    messagesContainer.appendChild(newMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Обновляем историю через секунду (чтобы получить прочитанные статусы)
    setTimeout(() => {
      if (window.currentChatUserId) {
        loadChatHistory(window.currentChatUserId);
      }
    }, 1000);
  } catch (error) {
    console.error("Ошибка отправки:", error);
    alert("Ошибка отправки: " + error.message);
  } finally {
    // Разблокируем кнопку
    sendBtn.disabled = false;
    sendBtn.textContent = "Отправить";
  }
};

// Отправка фото
window.sendPhoto = async function () {
  const fileInput = document.getElementById("photoInput");
  const file = fileInput.files[0];
  const token = localStorage.getItem("token");
  const sendPhotoBtn = document.getElementById("sendPhotoBtn");

  if (!file) {
    alert("Выберите фото");
    return;
  }

  // Проверка размера файла (макс 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("Файл слишком большой. Максимальный размер 5MB");
    return;
  }

  if (!window.currentChatUserId) {
    alert("Не выбран собеседник");
    return;
  }

  if (!token) {
    alert("Токен не найден");
    window.location.href = "login.html";
    return;
  }

  // Блокируем кнопку
  sendPhotoBtn.disabled = true;
  sendPhotoBtn.textContent = "Отправка...";

  const formData = new FormData();
  formData.append("photo", file);
  formData.append("receiverId", window.currentChatUserId);

  try {
    const res = await fetch("/api/chat/send-photo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка отправки фото");
    }

    // Очищаем input и скрываем кнопку отправки фото
    fileInput.value = "";
    sendPhotoBtn.style.display = "none";

    // Добавляем фото в историю
    const messagesContainer = document.getElementById("messagesContainer");
    const newMessage = document.createElement("div");
    newMessage.className = "message outgoing";
    newMessage.innerHTML = `
      <div class="message-content">
        <img src="${data.photoUrl}" class="message-photo" alt="photo" onclick="window.open('${data.photoUrl}', '_blank')">
        <div class="message-time">Только что</div>
      </div>
    `;
    messagesContainer.appendChild(newMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Обновляем историю через секунду
    setTimeout(() => {
      if (window.currentChatUserId) {
        loadChatHistory(window.currentChatUserId);
      }
    }, 1000);
  } catch (error) {
    console.error("Ошибка отправки фото:", error);
    alert("Ошибка отправки фото: " + error.message);
  } finally {
    // Разблокируем кнопку
    sendPhotoBtn.disabled = false;
    sendPhotoBtn.textContent = "Отправить фото";
  }
};

// Форматирование времени
function formatTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return "Только что";
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} мин назад`;
  } else if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

// Экранирование HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Очистка при уходе со страницы
window.addEventListener("beforeunload", function () {
  if (window.chatRefreshInterval) {
    clearInterval(window.chatRefreshInterval);
  }
});
