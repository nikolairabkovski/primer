// support.js
let currentUserRole = null;
let currentUserId = null;

document.addEventListener("DOMContentLoaded", async function () {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }

  // Получаем информацию о пользователе
  await loadUserInfo();
  loadMyTickets();
});

// Загрузка информации о пользователе
async function loadUserInfo() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/user/role", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      currentUserRole = data.role;

      // Декодируем токен для получения ID
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.id;
    }
  } catch (error) {
    console.error("Ошибка загрузки информации о пользователе:", error);
  }
}

// Функция для отображения выбранных файлов
window.updateFileNames = function (input) {
  const container = document.getElementById("file-names");
  if (input.files && input.files.length > 0) {
    const fileNames = Array.from(input.files)
      .map((f) => f.name)
      .join(", ");
    container.innerHTML = `<span class="file-name">📷 ${fileNames}</span>`;
  } else {
    container.innerHTML =
      '<span class="file-name-placeholder">Файлы не выбраны</span>';
  }
};

// Функция для загрузки фото на сервер
async function uploadPhotos(files) {
  if (!files || files.length === 0) return [];

  const token = localStorage.getItem("token");
  const formData = new FormData();

  for (let i = 0; i < files.length; i++) {
    formData.append("photos", files[i]);
  }

  try {
    console.log("📤 Загрузка фото...");
    const res = await fetch("/api/upload/temp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || "Ошибка загрузки фото");
    }

    const data = await res.json();
    console.log("✅ Фото загружены:", data);
    return data.fileIds || data.files || [];
  } catch (error) {
    console.error("❌ Ошибка загрузки фото:", error);
    throw error;
  }
}

// Создание обращения с фото
window.createTicket = async function (event) {
  event.preventDefault();

  const token = localStorage.getItem("token");
  const subject = document.getElementById("subject").value.trim();
  const message = document.getElementById("message").value.trim();
  const priority = document.getElementById("priority").value;
  const photoFiles = document.getElementById("photos").files;

  if (!subject || !message) {
    alert("Заполните все поля");
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Загрузка фото...";
  submitBtn.disabled = true;

  try {
    let photoIds = [];

    // Сначала загружаем фото, если они есть
    if (photoFiles.length > 0) {
      submitBtn.textContent = "Загрузка фото...";
      photoIds = await uploadPhotos(photoFiles);
    }

    submitBtn.textContent = "Создание обращения...";

    console.log("📤 Отправка запроса на создание обращения", {
      subject,
      message,
      priority,
      photoIds,
    });

    // Отправляем данные обращения как JSON
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject,
        message,
        priority,
        photos: photoIds, // Отправляем ID загруженных фото
      }),
    });

    // Проверяем Content-Type ответа
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error("❌ Ответ не JSON:", text.substring(0, 200));
      throw new Error("Сервер вернул неверный формат данных");
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || data.message || `Ошибка HTTP: ${res.status}`,
      );
    }

    alert("✅ Обращение создано");
    document.getElementById("ticketForm").reset();
    document.getElementById("file-names").innerHTML =
      '<span class="file-name-placeholder">Файлы не выбраны</span>';
    loadMyTickets();
  } catch (error) {
    console.error("❌ Ошибка:", error);
    alert("Ошибка: " + error.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
};

// Загрузка моих обращений
async function loadMyTickets() {
  const container = document.getElementById("myTicketsList");

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/support/my-tickets", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
      }
      throw new Error("Ошибка загрузки");
    }

    const tickets = await res.json();
    displayMyTickets(tickets);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки обращений</p>';
  }
}

function displayMyTickets(tickets) {
  const container = document.getElementById("myTicketsList");

  if (tickets.length === 0) {
    container.innerHTML = '<p class="no-tickets">У вас пока нет обращений</p>';
    return;
  }

  container.innerHTML = tickets
    .map(
      (ticket) => `
        <div class="ticket-item" onclick="viewTicket(${ticket.id})">
            <div class="ticket-header">
                <span class="ticket-subject">${escapeHtml(ticket.subject)}</span>
                <span class="ticket-status status-${ticket.status}">${getStatusText(ticket.status)}</span>
            </div>
            <div class="ticket-meta">
                <span class="ticket-priority priority-${ticket.priority}">${getPriorityText(ticket.priority)}</span>
                <span class="ticket-date">${formatDate(ticket.created_at)}</span>
                <span class="ticket-replies">💬 ${ticket.replies_count || 0}</span>
                ${ticket.has_photos ? '<span class="ticket-photos">📷</span>' : ""}
            </div>
        </div>
    `,
    )
    .join("");
}

// Просмотр обращения
window.viewTicket = async function (ticketId) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 403) {
        alert("У вас нет доступа к этому обращению");
        return;
      }
      throw new Error("Ошибка загрузки");
    }

    const data = await res.json();
    showTicketModal(data);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    alert("Ошибка загрузки обращения");
  }
};

function showTicketModal(data) {
  const modal = document.getElementById("ticketModal");
  const container = document.getElementById("ticketDetails");

  // Функция для отображения фотографий
  const renderPhotos = (photos) => {
    if (!photos || photos.length === 0) return "";
    return `
      <div class="ticket-photos-grid">
        ${photos
          .map(
            (photo) => `
          <div class="ticket-photo-item">
            <img src="${photo}" alt="Фото" onclick="window.open('${photo}')">
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  };

  // Определяем, может ли пользователь отвечать (автор или админ)
  const canReply =
    data.ticket.user_id === currentUserId ||
    currentUserRole === "admin" ||
    currentUserRole === "main_admin";

  container.innerHTML = `
    <div class="ticket-full">
      <div class="ticket-header">
        <h3>${escapeHtml(data.ticket.subject)}</h3>
        <div class="ticket-status-bar">
          <span class="ticket-status status-${data.ticket.status}">${getStatusText(data.ticket.status)}</span>
          <span class="ticket-priority priority-${data.ticket.priority}">${getPriorityText(data.ticket.priority)}</span>
        </div>
      </div>
      
      <div class="ticket-user-info">
        <p>👤 <strong>От:</strong> ${data.ticket.user_name || data.ticket.user_username} (${data.ticket.user_email})</p>
        <p>📅 <strong>Создано:</strong> ${formatDateTime(data.ticket.created_at)}</p>
      </div>
      
      <div class="ticket-message">
        <p>${escapeHtml(data.ticket.message).replace(/\n/g, "<br>")}</p>
        ${renderPhotos(data.ticket.photos)}
      </div>
      
      <div class="ticket-replies">
        <h4>📨 Ответы (${data.replies.length})</h4>
        ${data.replies.length === 0 ? '<p class="no-replies">Пока нет ответов</p>' : ""}
        ${data.replies
          .map(
            (reply) => `
          <div class="reply ${reply.is_admin ? "admin-reply" : ""}">
            <div class="reply-header">
              <span class="reply-author">${reply.user_name || reply.user_username}</span>
              <span class="reply-date">${formatDateTime(reply.created_at)}</span>
              ${reply.is_admin ? '<span class="admin-badge">👑 Админ</span>' : ""}
            </div>
            <div class="reply-content">
              <p>${escapeHtml(reply.message).replace(/\n/g, "<br>")}</p>
              ${renderPhotos(reply.photos)}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
      
      ${
        canReply && data.ticket.status !== "closed"
          ? `
        <div class="ticket-reply-form">
          <h4>✍️ Написать ответ</h4>
          <textarea id="ticketReply" rows="3" placeholder="Введите ответ..."></textarea>
          
          <div class="file-input-wrapper">
            <input
              type="file"
              id="replyPhotos"
              accept="image/*"
              multiple
              onchange="updateReplyFileNames(this)"
            />
            <label for="replyPhotos" class="file-label">
              Прикрепить фото
            </label>
            <div id="reply-file-names" class="file-names">
              <span class="file-name-placeholder">Файлы не выбраны</span>
            </div>
          </div>
          
          <div class="reply-actions">
            <button onclick="sendUserReply(${data.ticket.id})" class="btn-submit">Отправить ответ</button>
            ${
              currentUserRole === "admin" || currentUserRole === "main_admin"
                ? `
              <button onclick="closeTicket(${data.ticket.id})" class="btn-close-ticket">🔒 Закрыть обращение</button>
            `
                : ""
            }
          </div>
        </div>
      `
          : data.ticket.status === "closed"
            ? `
        <div class="ticket-closed-message">
          <p>🔒 Обращение закрыто</p>
        </div>
      `
            : ""
      }
    </div>
  `;

  modal.style.display = "block";
}

// Обновление имен файлов для ответа
window.updateReplyFileNames = function (input) {
  const container = document.getElementById("reply-file-names");
  if (input.files && input.files.length > 0) {
    const fileNames = Array.from(input.files)
      .map((f) => f.name)
      .join(", ");
    container.innerHTML = `<span class="file-name">📷 ${fileNames}</span>`;
  } else {
    container.innerHTML =
      '<span class="file-name-placeholder">Файлы не выбраны</span>';
  }
};

// Отправка ответа с фото
window.sendUserReply = async function (ticketId) {
  const message = document.getElementById("ticketReply").value.trim();
  const photoFiles = document.getElementById("replyPhotos")?.files;

  if (!message) {
    alert("Введите ответ");
    return;
  }

  const replyBtn = document.querySelector("#ticketModal .btn-submit");
  const originalText = replyBtn.textContent;
  replyBtn.textContent = "Загрузка фото...";
  replyBtn.disabled = true;

  try {
    let photoIds = [];

    // Сначала загружаем фото, если они есть
    if (photoFiles && photoFiles.length > 0) {
      replyBtn.textContent = "Загрузка фото...";
      photoIds = await uploadPhotos(photoFiles);
    }

    replyBtn.textContent = "Отправка ответа...";

    const token = localStorage.getItem("token");
    const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        photos: photoIds,
      }),
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error("❌ Ответ не JSON:", text.substring(0, 200));
      throw new Error("Сервер вернул неверный формат данных");
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || "Ошибка");
    }

    alert("✅ Ответ отправлен");
    closeTicketModal();
    loadMyTickets();
  } catch (error) {
    console.error("❌ Ошибка:", error);
    alert("Ошибка: " + error.message);
  } finally {
    replyBtn.textContent = originalText;
    replyBtn.disabled = false;
  }
};

// Закрыть обращение (для админов)
window.closeTicket = async function (ticketId) {
  if (!confirm("Вы уверены, что хотите закрыть это обращение?")) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "closed" }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || "Ошибка");
    }

    alert("✅ Обращение закрыто");
    closeTicketModal();
    loadMyTickets();
  } catch (error) {
    console.error("❌ Ошибка:", error);
    alert("Ошибка: " + error.message);
  }
};

window.closeTicketModal = function () {
  document.getElementById("ticketModal").style.display = "none";
};

// Вспомогательные функции
function getStatusText(status) {
  const statuses = {
    open: "Открыто",
    in_progress: "В работе",
    closed: "Закрыто",
  };
  return statuses[status] || status;
}

function getPriorityText(priority) {
  const priorities = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
  };
  return priorities[priority] || priority;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString("ru-RU", {
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
