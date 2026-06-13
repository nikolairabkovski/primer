// admin.js
let currentUserRole = null;
let clubsData = []; // для хранения списка клубов
let expandedClub = null; // ID текущего развёрнутого клуба
document.addEventListener("DOMContentLoaded", function () {
  checkAdminAccess();
});

async function checkAdminAccess() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Не авторизован");
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch("/api/user/role", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Ошибка проверки прав");
    }

    const data = await res.json();

    if (!data.isAdmin) {
      alert("У вас нет прав доступа к этой странице");
      window.location.href = "index.html";
      return;
    }

    currentUserRole = data.role;

    // Загружаем данные для всех вкладок
    loadUsers();
    loadAllNews();
    loadPendingNews();
    loadComments();
    loadSupportTickets();
  } catch (error) {
    console.error("Ошибка:", error);
    window.location.href = "index.html";
  }
}

// Переключение вкладок
window.showTab = function (tabName) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.getElementById(tabName + "Tab").classList.add("active");
  event.target.classList.add("active");

  // Загружаем данные для вкладки
  if (tabName === "users") loadUsers();
  if (tabName === "allnews") loadAllNews();
  if (tabName === "pendingnews") loadPendingNews();
  if (tabName === "comments") loadComments();
  if (tabName === "support") loadSupportTickets();
  if (tabName === "clubs") loadClubs();
};

// ============ УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ============
async function loadUsers() {
  const container = document.getElementById("usersList");

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка загрузки");

    const users = await res.json();
    displayUsers(users);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки пользователей</p>';
  }
}

function displayUsers(users) {
  const container = document.getElementById("usersList");

  if (users.length === 0) {
    container.innerHTML = '<p class="no-data">Нет пользователей</p>';
    return;
  }

  container.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>ФИО</th>
                    <th>Никнейм</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Город</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${users
                  .map(
                    (user) => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${escapeHtml(user.fullname || "-")}</td>
                        <td>${escapeHtml(user.nickname || "-")}</td>
                        <td>${escapeHtml(user.username)}</td>
                        <td>${escapeHtml(user.email)}</td>
                        <td>
                            <span class="role-badge role-${user.role}">${user.role}</span>
                            ${
                              currentUserRole === "main_admin" &&
                              user.role !== "main_admin"
                                ? `
                                <select class="role-select" onchange="changeUserRole(${user.id}, this.value)">
                                    <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
                                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
                                </select>
                            `
                                : ""
                            }
                        </td>
                        <td>${escapeHtml(user.city || "-")}</td>
                        <td>
                            <button onclick="editUser(${user.id})" class="btn-edit">✏️</button>
                            ${
                              currentUserRole === "main_admin" &&
                              user.role !== "main_admin"
                                ? `
                                <button onclick="deleteUser(${user.id})" class="btn-delete">🗑️</button>
                            `
                                : ""
                            }
                        </td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    `;
}

window.changeUserRole = async function (userId, newRole) {
  if (!confirm("Изменить роль пользователя?")) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: newRole }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert(data.message);
    loadUsers();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.editUser = async function (userId) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const user = await res.json();
    showUserEditModal(user);
  } catch (error) {
    alert("Ошибка загрузки данных пользователя");
  }
};

window.deleteUser = async function (userId) {
  if (
    !confirm(
      "Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.",
    )
  ) {
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert("Пользователь удален");
    loadUsers();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

function showUserEditModal(user) {
  const modal = document.getElementById("userModal");
  const form = document.getElementById("userEditForm");

  form.innerHTML = `
        <form onsubmit="saveUserChanges(${user.id}, event)">
            <div class="form-group">
                <label>ФИО</label>
                <input type="text" id="editFullname" value="${escapeHtml(user.fullname || "")}">
            </div>
            <div class="form-group">
                <label>Никнейм</label>
                <input type="text" id="editNickname" value="${escapeHtml(user.nickname || "")}">
            </div>
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="editUsername" value="${escapeHtml(user.username)}" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="editEmail" value="${escapeHtml(user.email)}" required>
            </div>
            <div class="form-group">
                <label>Город</label>
                <input type="text" id="editCity" value="${escapeHtml(user.city || "")}">
            </div>
            <div class="form-group">
                <label>Дата рождения</label>
                <input type="date" id="editBirthdate" value="${user.birthdate || ""}">
            </div>
            <div class="form-group">
                <label>Любимый клуб</label>
                <input type="text" id="editClub" value="${escapeHtml(user.club || "")}">
            </div>
            <div class="form-group">
                <label>О себе</label>
                <textarea id="editBio" rows="3">${escapeHtml(user.bio || "")}</textarea>
            </div>
            <button type="submit" class="btn-submit">Сохранить</button>
        </form>
    `;

  modal.style.display = "block";
}

window.saveUserChanges = async function (userId, event) {
  event.preventDefault();

  const data = {
    fullname: document.getElementById("editFullname").value,
    nickname: document.getElementById("editNickname").value,
    username: document.getElementById("editUsername").value,
    email: document.getElementById("editEmail").value,
    city: document.getElementById("editCity").value,
    birthdate: document.getElementById("editBirthdate").value,
    club: document.getElementById("editClub").value,
    bio: document.getElementById("editBio").value,
  };

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || "Ошибка");
    }

    alert("Данные сохранены");
    closeUserModal();
    loadUsers();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.closeUserModal = function () {
  document.getElementById("userModal").style.display = "none";
};

// ============ УПРАВЛЕНИЕ КОММЕНТАРИЯМИ ============
async function loadComments() {
  const container = document.getElementById("commentsList");

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/comments", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка загрузки");

    const comments = await res.json();
    displayComments(comments);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки комментариев</p>';
  }
}

function displayComments(comments) {
  const container = document.getElementById("commentsList");

  if (comments.length === 0) {
    container.innerHTML = '<p class="no-data">Нет комментариев</p>';
    return;
  }

  container.innerHTML = comments
    .map(
      (comment) => `
        <div class="comment-card ${comment.is_hidden ? "hidden-comment" : ""}">
            <div class="comment-header">
                <span class="comment-user">👤 ${comment.user_name || comment.user_username}</span>
                <span class="comment-news">📰 ${escapeHtml(comment.news_title?.substring(0, 50))}...</span>
                <span class="comment-date">${formatDateTime(comment.created_at)}</span>
            </div>
            <div class="comment-content">
                ${escapeHtml(comment.content)}
                ${comment.parent_id ? '<span class="reply-badge">Ответ</span>' : ""}
                ${comment.is_admin_reply ? '<span class="admin-badge">Админ</span>' : ""}
                ${comment.has_admin_reply ? '<span class="replied-badge">Есть ответ</span>' : ""}
            </div>
            <div class="comment-actions">
                <button onclick="toggleCommentVisibility(${comment.id}, ${comment.is_hidden})" 
                        class="btn-toggle ${comment.is_hidden ? "btn-show" : "btn-hide"}">
                    ${comment.is_hidden ? "👁️ Показать" : "👁️ Скрыть"}
                </button>
                <button onclick="replyToComment(${comment.id}, '${escapeHtml(comment.content)}')" 
                        class="btn-reply">
                    💬 Ответить
                </button>
                <button onclick="deleteComment(${comment.id})" class="btn-delete">
                    🗑️ Удалить
                </button>
            </div>
            <div id="reply-form-${comment.id}" class="reply-form" style="display: none;">
                <textarea id="reply-${comment.id}" rows="3" placeholder="Введите ответ..."></textarea>
                <button onclick="sendCommentReply(${comment.id})" class="btn-submit">Отправить ответ</button>
                <button onclick="cancelReply(${comment.id})" class="btn-cancel">Отмена</button>
            </div>
        </div>
    `,
    )
    .join("");
}

window.toggleCommentVisibility = async function (commentId, currentStatus) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/comments/${commentId}/toggle`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert(data.message);
    loadComments();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.replyToComment = function (commentId, commentText) {
  document.querySelectorAll(".reply-form").forEach((form) => {
    form.style.display = "none";
  });

  const form = document.getElementById(`reply-form-${commentId}`);
  form.style.display = "block";

  // Показываем оригинальный комментарий
  console.log("Ответ на комментарий:", commentText);
};

window.sendCommentReply = async function (commentId) {
  const reply = document.getElementById(`reply-${commentId}`).value.trim();

  if (!reply) {
    alert("Введите ответ");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/comments/${commentId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reply }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert("Ответ отправлен");
    document.getElementById(`reply-form-${commentId}`).style.display = "none";
    loadComments();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.deleteComment = async function (commentId) {
  if (!confirm("Вы уверены, что хотите удалить этот комментарий?")) {
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert("Комментарий удален");
    loadComments();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.cancelReply = function (commentId) {
  document.getElementById(`reply-form-${commentId}`).style.display = "none";
  document.getElementById(`reply-${commentId}`).value = "";
};

// ============ УПРАВЛЕНИЕ НОВОСТЯМИ ============
async function loadAllNews() {
  const container = document.getElementById("allNewsList");
  const status = document.getElementById("newsStatusFilter")?.value || "all";

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/news?status=${status}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка загрузки");

    const news = await res.json();
    displayAllNews(news);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки новостей</p>';
  }
}

function displayAllNews(news) {
  const container = document.getElementById("allNewsList");

  if (news.length === 0) {
    container.innerHTML = '<p class="no-data">Нет новостей</p>';
    return;
  }

  container.innerHTML = news
    .map(
      (item) => `
        <div class="news-card-admin">
            <div class="news-header">
                <h3>${escapeHtml(item.title)}</h3>
                <span class="status-badge status-${item.status}">${getStatusText(item.status)}</span>
            </div>
            <div class="news-meta">
                <span class="news-author">👤 ${item.author_name || item.author_username}</span>
                <span class="news-date">📅 ${formatDateTime(item.created_at)}</span>
                <span class="news-views">👁️ ${item.views || 0}</span>
                <span class="news-likes">👍 ${item.likes_count || 0}</span>
                <span class="news-dislikes">👎 ${item.dislikes_count || 0}</span>
                <span class="news-comments">💬 ${item.comments_count || 0}</span>
            </div>
            ${item.image ? `<img src="${item.image}" class="news-preview">` : ""}
            <div class="news-preview-content">
                ${escapeHtml(item.content.substring(0, 150))}...
            </div>
            <div class="news-actions">
                <button onclick="editNews(${item.id})" class="btn-edit">✏️ Редактировать</button>
                <button onclick="changeNewsStatus(${item.id})" class="btn-status">📊 Статус</button>
                <button onclick="deleteNews(${item.id})" class="btn-delete">🗑️ Удалить</button>
                <a href="news-detail.html?id=${item.id}" target="_blank" class="btn-view">👁️ Просмотр</a>
            </div>
            <div id="edit-form-${item.id}" class="edit-news-form" style="display: none;">
                <h4>Редактирование новости</h4>
                <input type="text" id="edit-title-${item.id}" value="${escapeHtml(item.title)}" placeholder="Заголовок">
                <textarea id="edit-content-${item.id}" rows="5">${escapeHtml(item.content)}</textarea>
                <input type="file" id="edit-image-${item.id}" accept="image/*">
                <div class="edit-actions">
                    <button onclick="saveNewsEdit(${item.id})" class="btn-save">💾 Сохранить</button>
                    <button onclick="cancelNewsEdit(${item.id})" class="btn-cancel">Отмена</button>
                </div>
            </div>
            <div id="status-form-${item.id}" class="status-form" style="display: none;">
                <select id="status-select-${item.id}">
                    <option value="pending" ${item.status === "pending" ? "selected" : ""}>На модерации</option>
                    <option value="approved" ${item.status === "approved" ? "selected" : ""}>Опубликовано</option>
                    <option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Отклонено</option>
                </select>
                <button onclick="saveNewsStatus(${item.id})" class="btn-save">Сохранить</button>
                <button onclick="cancelNewsStatus(${item.id})" class="btn-cancel">Отмена</button>
            </div>
        </div>
    `,
    )
    .join("");
}

async function loadPendingNews() {
  const container = document.getElementById("pendingNewsList");

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/moderate/news", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка загрузки");

    const news = await res.json();
    displayPendingNews(news);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки новостей</p>';
  }
}

function displayPendingNews(news) {
  const container = document.getElementById("pendingNewsList");

  if (news.length === 0) {
    container.innerHTML = '<p class="no-data">Нет новостей на модерацию</p>';
    return;
  }

  container.innerHTML = news
    .map(
      (item) => `
        <div class="moderate-card">
            <h3>${escapeHtml(item.title)}</h3>
            <p class="news-meta">Автор: ${item.author_name || item.author_username} | ${formatDate(item.created_at)}</p>
            ${item.image ? `<img src="${item.image}" class="news-preview">` : ""}
            <p class="news-content">${escapeHtml(item.content.substring(0, 200))}...</p>
            <div class="moderate-actions">
                <button onclick="moderateNews(${item.id}, 'approved')" class="btn-approve">✅ Одобрить</button>
                <button onclick="moderateNews(${item.id}, 'rejected')" class="btn-reject">❌ Отклонить</button>
                <a href="news-detail.html?id=${item.id}" target="_blank" class="btn-view">👁️ Просмотр</a>
            </div>
        </div>
    `,
    )
    .join("");
}

window.editNews = function (newsId) {
  document.querySelectorAll(".edit-news-form, .status-form").forEach((form) => {
    form.style.display = "none";
  });

  document.getElementById(`edit-form-${newsId}`).style.display = "block";
};

window.saveNewsEdit = async function (newsId) {
  const title = document.getElementById(`edit-title-${newsId}`).value.trim();
  const content = document
    .getElementById(`edit-content-${newsId}`)
    .value.trim();
  const imageFile = document.getElementById(`edit-image-${newsId}`).files[0];

  if (!title || !content) {
    alert("Заголовок и текст обязательны");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  if (imageFile) {
    formData.append("image", imageFile);
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/news/${newsId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка");
    }

    alert("Новость обновлена");
    document.getElementById(`edit-form-${newsId}`).style.display = "none";
    loadAllNews();
    loadPendingNews();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.changeNewsStatus = function (newsId) {
  document.querySelectorAll(".edit-news-form, .status-form").forEach((form) => {
    form.style.display = "none";
  });

  document.getElementById(`status-form-${newsId}`).style.display = "block";
};

window.saveNewsStatus = async function (newsId) {
  const status = document.getElementById(`status-select-${newsId}`).value;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/news/${newsId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert(data.message);
    document.getElementById(`status-form-${newsId}`).style.display = "none";
    loadAllNews();
    loadPendingNews();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.deleteNews = async function (newsId) {
  if (!confirm("Вы уверены, что хотите удалить эту новость?")) {
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/news/${newsId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert("Новость удалена");
    loadAllNews();
    loadPendingNews();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.moderateNews = async function (newsId, status) {
  try {
    const token = localStorage.getItem("token");
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
      throw new Error(data.error || "Ошибка");
    }

    alert(data.message);
    loadPendingNews();
    loadAllNews();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.cancelNewsEdit = function (newsId) {
  document.getElementById(`edit-form-${newsId}`).style.display = "none";
};

window.cancelNewsStatus = function (newsId) {
  document.getElementById(`status-form-${newsId}`).style.display = "none";
};

// ============ ТЕХПОДДЕРЖКА ============
async function loadSupportTickets() {
  const container = document.getElementById("supportTickets");
  const status = document.getElementById("supportStatusFilter")?.value || "all";

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/support/tickets?status=${status}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка загрузки");

    const tickets = await res.json();
    displaySupportTickets(tickets);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки обращений</p>';
  }
}

function displaySupportTickets(tickets) {
  const container = document.getElementById("supportTickets");

  if (tickets.length === 0) {
    container.innerHTML = '<p class="no-data">Нет обращений</p>';
    return;
  }

  container.innerHTML = tickets
    .map(
      (ticket) => `
        <div class="ticket-card" onclick="viewTicket(${ticket.id})">
            <div class="ticket-header">
                <span class="ticket-id">#${ticket.id}</span>
                <span class="ticket-status status-${ticket.status}">${getStatusText(ticket.status)}</span>
                <span class="ticket-priority priority-${ticket.priority}">${getPriorityText(ticket.priority)}</span>
            </div>
            <div class="ticket-subject">${escapeHtml(ticket.subject)}</div>
            <div class="ticket-meta">
                <span class="ticket-user">👤 ${ticket.user_name || ticket.user_username}</span>
                <span class="ticket-date">📅 ${formatDate(ticket.created_at)}</span>
                <span class="ticket-replies">💬 ${ticket.replies_count || 0}</span>
            </div>
        </div>
    `,
    )
    .join("");
}

window.viewTicket = async function (ticketId) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка загрузки");

    const data = await res.json();
    showTicketModal(data);
  } catch (error) {
    alert("Ошибка загрузки обращения");
  }
};

function showTicketModal(data) {
  const modal = document.getElementById("ticketModal");
  const container = document.getElementById("ticketDetails");

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
                <p>От: ${data.ticket.user_name || data.ticket.user_username} (${data.ticket.user_email})</p>
                <p>Создано: ${formatDateTime(data.ticket.created_at)}</p>
            </div>
            
            <div class="ticket-message">
                <p>${escapeHtml(data.ticket.message)}</p>
            </div>
            
            <div class="ticket-replies">
                <h4>Ответы (${data.replies.length})</h4>
                ${data.replies
                  .map(
                    (reply) => `
                    <div class="reply ${reply.is_admin ? "admin-reply" : ""}">
                        <div class="reply-header">
                            <span class="reply-author">${reply.user_name || reply.user_username}</span>
                            <span class="reply-date">${formatDateTime(reply.created_at)}</span>
                            ${reply.is_admin ? '<span class="admin-badge">Админ</span>' : ""}
                        </div>
                        <div class="reply-content">${escapeHtml(reply.message)}</div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
            
            <div class="ticket-reply-form">
                <h4>Ответить</h4>
                <textarea id="ticketReply" rows="3" placeholder="Введите ответ..."></textarea>
                <div class="ticket-actions">
                    <button onclick="sendTicketReply(${data.ticket.id})" class="btn-submit">Отправить</button>
                    ${
                      currentUserRole === "main_admin" ||
                      currentUserRole === "admin"
                        ? `
                        <select id="ticketStatus" class="status-select">
                            <option value="open" ${data.ticket.status === "open" ? "selected" : ""}>Открыто</option>
                            <option value="in_progress" ${data.ticket.status === "in_progress" ? "selected" : ""}>В работе</option>
                            <option value="closed" ${data.ticket.status === "closed" ? "selected" : ""}>Закрыто</option>
                        </select>
                        <button onclick="updateTicketStatus(${data.ticket.id})" class="btn-update">Обновить статус</button>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `;

  modal.style.display = "block";
}

window.sendTicketReply = async function (ticketId) {
  const message = document.getElementById("ticketReply").value.trim();

  if (!message) {
    alert("Введите ответ");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert("Ответ отправлен");
    closeTicketModal();
    loadSupportTickets();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.updateTicketStatus = async function (ticketId) {
  const status = document.getElementById("ticketStatus").value;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка");
    }

    alert("Статус обновлен");
    closeTicketModal();
    loadSupportTickets();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.closeTicketModal = function () {
  document.getElementById("ticketModal").style.display = "none";
};

// ============ УПРАВЛЕНИЕ КЛУБАМИ ============
async function loadClubs() {
  const container = document.getElementById("clubsList");
  if (!container) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/clubs/all?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка загрузки клубов");

    const data = await res.json();
    // Если ответ приходит как { clubs: [], total, ... } – берём clubs
    clubsData = data.clubs || data || [];
    // Если data – это массив (старая версия), то оставляем как есть

    if (clubsData.length === 0) {
      container.innerHTML = '<p class="no-data">Нет клубов</p>';
      return;
    }

    renderClubs(clubsData);
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки клубов</p>';
  }
}

function renderClubs(clubs) {
  const container = document.getElementById("clubsList");
  if (!container) return;

  container.innerHTML = clubs
    .map(
      (club) => `
    <div class="club-card" data-club-id="${club.id}">
      <div class="club-summary" onclick="toggleClubDetails(${club.id})">
        <div class="club-avatar">
          ${club.avatar ? `<img src="${club.avatar}" alt="${escapeHtml(club.name)}">` : "⚽"}
        </div>
        <div class="club-info">
          <div class="club-name">${escapeHtml(club.name)}</div>
          <div class="club-username">@${escapeHtml(club.username)}</div>
          <div class="club-stats">
            👥 Подписчиков: <span id="members-count-${club.id}">${club.members_count || 0}</span>
            📄 Постов: <span id="posts-count-${club.id}">${club.posts_count || 0}</span>
          </div>
        </div>
        <button class="club-expand-btn" id="expand-btn-${club.id}">▼</button>
      </div>
      <div id="club-details-${club.id}" class="club-details">
        <div class="detail-section">
          <h4>👥 Подписчики</h4>
          <div id="members-list-${club.id}" class="members-grid">
            <div class="loading-small">Загрузка...</div>
          </div>
        </div>
        <div class="detail-section">
          <h4>📄 Посты</h4>
          <div id="posts-list-${club.id}" class="posts-grid">
            <div class="loading-small">Загрузка...</div>
          </div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

window.toggleClubDetails = async function (clubId) {
  const detailsDiv = document.getElementById(`club-details-${clubId}`);
  const expandBtn = document.getElementById(`expand-btn-${clubId}`);

  if (detailsDiv.classList.contains("open")) {
    detailsDiv.classList.remove("open");
    expandBtn.classList.remove("open");
    return;
  }

  // Закрываем предыдущий открытый клуб (если нужно)
  if (expandedClub && expandedClub !== clubId) {
    const prevDetails = document.getElementById(`club-details-${expandedClub}`);
    if (prevDetails) {
      prevDetails.classList.remove("open");
      const prevBtn = document.getElementById(`expand-btn-${expandedClub}`);
      if (prevBtn) prevBtn.classList.remove("open");
    }
  }

  detailsDiv.classList.add("open");
  expandBtn.classList.add("open");
  expandedClub = clubId;

  // Загружаем подписчиков, если ещё не загружены
  const membersContainer = document.getElementById(`members-list-${clubId}`);
  if (membersContainer && membersContainer.innerHTML.includes("Загрузка...")) {
    await loadClubMembers(clubId);
  }

  // Загружаем посты, если ещё не загружены
  const postsContainer = document.getElementById(`posts-list-${clubId}`);
  if (postsContainer && postsContainer.innerHTML.includes("Загрузка...")) {
    await loadClubPosts(clubId);
  }
};

async function loadClubMembers(clubId) {
  const container = document.getElementById(`members-list-${clubId}`);
  if (!container) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/clubs/${clubId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка загрузки подписчиков");

    const members = await res.json();

    if (!members || members.length === 0) {
      container.innerHTML = '<p class="no-data">Нет подписчиков</p>';
      return;
    }

    container.innerHTML = members
      .map(
        (member) => `
      <div class="member-item">
        <div class="member-header">
          <div class="member-avatar">
            ${member.avatar ? `<img src="${member.avatar}">` : "👤"}
          </div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(member.fullname || "Без имени")}</div>
            <div class="member-username">@${escapeHtml(member.username)}</div>
          </div>
          <div class="member-role role-${member.role || "member"}">
            ${getRoleName(member.role)}
          </div>
        </div>
        ${member.banned_until ? `<div class="member-ban">🚫 Забанен до ${new Date(member.banned_until).toLocaleDateString()}</div>` : ""}
        ${member.comment_banned_until ? `<div class="member-comment-ban">💬 Комментарии заблокированы до ${new Date(member.comment_banned_until).toLocaleDateString()}</div>` : ""}
      </div>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки подписчиков</p>';
  }
}

async function loadClubPosts(clubId) {
  const container = document.getElementById(`posts-list-${clubId}`);
  if (!container) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/clubs/${clubId}/posts?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка загрузки постов");

    const data = await res.json();
    const posts = data.posts || [];

    if (posts.length === 0) {
      container.innerHTML = '<p class="no-data">Нет постов</p>';
      return;
    }

    container.innerHTML = posts
      .map(
        (post) => `
      <div class="post-item">
        <div class="post-header">
          <span>📅 ${formatDate(post.created_at)}</span>
          ${post.pinned ? '<span class="pinned-badge">📌 Закреплено</span>' : ""}
        </div>
        <div class="post-content">
          ${escapeHtml(post.content.substring(0, 150))}${post.content.length > 150 ? "..." : ""}
        </div>
        <div class="post-stats">
          <span> ${post.likes_count || 0}</span>
          <span> ${post.dislikes_count || 0}</span>
          <span> ${post.comments_count || 0}</span>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Ошибка:", error);
    container.innerHTML = '<p class="error">Ошибка загрузки постов</p>';
  }
}

window.filterClubs = function () {
  const searchTerm = document.getElementById("clubSearch").value.toLowerCase();
  if (!searchTerm) {
    renderClubs(clubsData);
    return;
  }
  const filtered = clubsData.filter(
    (club) =>
      club.name.toLowerCase().includes(searchTerm) ||
      club.username.toLowerCase().includes(searchTerm),
  );
  renderClubs(filtered);
};

function getRoleName(role) {
  const roles = {
    creator: "Создатель",
    admin: "Админ",
    moderator: "Модератор",
    member: "Подписчик",
  };
  return roles[role] || "Подписчик";
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function getStatusText(status) {
  const statuses = {
    open: "Открыто",
    in_progress: "В работе",
    closed: "Закрыто",
    pending: "На модерации",
    approved: "Опубликовано",
    rejected: "Отклонено",
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
  return new Date(dateString).toLocaleDateString("ru-RU");
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString("ru-RU");
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "index.html";
}
