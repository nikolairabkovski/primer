// users.js
let currentUserRole = null;
let currentUserId = null;

async function loadUsers() {
  try {
    console.log("Загрузка пользователей...");

    // Проверяем роль текущего пользователя
    await checkUserRole();

    const res = await fetch("/api/users");

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(
        `HTTP ошибка ${res.status}: ${errorData.error || res.statusText}`,
      );
    }

    const users = await res.json();
    console.log("Получены данные:", users);

    if (!Array.isArray(users)) {
      console.error("Сервер вернул не массив:", users);
      showError("Получены некорректные данные от сервера");
      return;
    }

    const table = document.querySelector("#usersTable tbody");
    if (!table) {
      console.error("Таблица не найдена в DOM");
      return;
    }

    if (users.length === 0) {
      table.innerHTML =
        '<tr><td colspan="11" style="text-align: center;">Нет пользователей для отображения</td></tr>';
      return;
    }

    table.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("tr");

      // Добавляем класс для выделения текущего пользователя
      if (user.id == currentUserId) {
        row.classList.add("current-user");
      }

      // Формируем кнопки действий в зависимости от роли
      let actionsHtml = "";

      if (
        currentUserRole === "main_admin" &&
        user.id != currentUserId &&
        user.role !== "main_admin"
      ) {
        actionsHtml = `
          <select class="role-select" onchange="changeUserRole(${user.id}, this.value)">
            <option value="user" ${user.role === "user" ? "selected" : ""}>Пользователь</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Админ</option>
          </select>
        `;
      } else if (
        currentUserRole === "admin" &&
        user.id != currentUserId &&
        user.role !== "main_admin" &&
        user.role !== "admin"
      ) {
        actionsHtml = `
          <button class="btn-edit" onclick="editUser(${user.id})">✏️ Ред.</button>
        `;
      } else if (user.id == currentUserId) {
        actionsHtml = '<span class="badge-current">Это вы</span>';
      }

      row.innerHTML = `
        <td>${escapeHtml(user.id || "")}</td>
        <td class="editable" data-field="fullname" data-id="${user.id}">${escapeHtml(user.fullname || "-")}</td>
        <td class="editable" data-field="nickname" data-id="${user.id}">${escapeHtml(user.nickname || "-")}</td>
        <td class="editable" data-field="username" data-id="${user.id}">${escapeHtml(user.username || "-")}</td>
        <td class="editable" data-field="email" data-id="${user.id}">${escapeHtml(user.email || "-")}</td>
        <td>
          ${escapeHtml(user.role || "-")}
          ${actionsHtml ? "<br>" + actionsHtml : ""}
        </td>
        <td class="editable" data-field="city" data-id="${user.id}">${escapeHtml(user.city || "-")}</td>
        <td class="editable" data-field="birthdate" data-id="${user.id}">${escapeHtml(user.birthdate || "-")}</td>
        <td class="editable" data-field="club" data-id="${user.id}">${escapeHtml(user.club || "-")}</td>
        <td class="editable" data-field="bio" data-id="${user.id}">${escapeHtml(user.bio ? user.bio.substring(0, 50) + (user.bio.length > 50 ? "..." : "") : "-")}</td>
      `;

      table.appendChild(row);
    });

    // Добавляем обработчики для редактируемых полей (только для админов)
    if (currentUserRole === "admin" || currentUserRole === "main_admin") {
      addEditableListeners();
    }
  } catch (error) {
    console.error("Ошибка при загрузке пользователей:", error);
    showError("Не удалось загрузить список пользователей: " + error.message);
  }
}

// Проверка роли текущего пользователя
async function checkUserRole() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    // Получаем ID из токена
    const payload = JSON.parse(atob(token.split(".")[1]));
    currentUserId = payload.id;

    const res = await fetch("/api/user/role", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Не удалось проверить роль");
    }

    const data = await res.json();
    currentUserRole = data.role;

    console.log("Текущая роль:", currentUserRole);

    // Добавляем кнопку модерации для админов
    if (data.isAdmin) {
      const header = document.querySelector("h2");
      if (header) {
        const moderateBtn = document.createElement("a");
        moderateBtn.href = "moderate.html";
        moderateBtn.className = "btn-moderate";
        moderateBtn.textContent = "🛡️ Модерация новостей";
        moderateBtn.style.marginLeft = "20px";
        header.appendChild(moderateBtn);
      }
    }
  } catch (error) {
    console.error("Ошибка проверки роли:", error);
  }
}

// Изменение роли пользователя (только для главного админа)
window.changeUserRole = async function (userId, newRole) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Не авторизован");
    return;
  }

  if (!confirm(`Изменить роль пользователя на "${newRole}"?`)) {
    return;
  }

  try {
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
      throw new Error(data.error || data.message || "Ошибка изменения роли");
    }

    alert(data.message);
    loadUsers(); // Перезагружаем список
  } catch (error) {
    console.error("Ошибка:", error);
    alert("Ошибка: " + error.message);
  }
};

// Редактирование пользователя (для админов)
window.editUser = function (userId) {
  // Сохраняем ID пользователя в localStorage и переходим на страницу редактирования
  localStorage.setItem("editUserId", userId);
  window.location.href = "admin-edit-user.html";
};

// Добавление обработчиков для редактируемых полей
function addEditableListeners() {
  document.querySelectorAll(".editable").forEach((cell) => {
    cell.addEventListener("dblclick", function () {
      if (this.querySelector("input")) return; // Уже редактируется

      const currentValue = this.textContent.trim();
      const field = this.dataset.field;
      const userId = this.dataset.id;

      // Не даем редактировать главного админа обычным админам
      if (currentUserRole === "admin") {
        // Проверяем, не главный ли это админ
        const roleCell =
          this.parentElement.querySelector("td:nth-child(6)").textContent;
        if (roleCell.includes("main_admin")) {
          alert("Вы не можете редактировать главного админа");
          return;
        }
      }

      const input = document.createElement("input");
      input.type = "text";
      input.value = currentValue === "-" ? "" : currentValue;
      input.className = "edit-input";

      input.addEventListener("blur", () =>
        saveEdit(userId, field, input.value, cell),
      );
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          saveEdit(userId, field, input.value, cell);
        }
      });

      this.textContent = "";
      this.appendChild(input);
      input.focus();
    });
  });
}

// Сохранение отредактированного поля
async function saveEdit(userId, field, value, cell) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Не авторизован");
    window.location.href = "login.html";
    return;
  }

  try {
    // Получаем текущие данные пользователя
    const userRes = await fetch(`/api/profile/${userId}`);
    const user = await userRes.json();

    // Обновляем конкретное поле
    user[field] = value;

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(user),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка сохранения");
    }

    // Обновляем отображение
    cell.textContent = value || "-";
  } catch (error) {
    console.error("Ошибка сохранения:", error);
    alert("Ошибка: " + error.message);
    cell.textContent = cell.querySelector("input")?.value || "-";
  }
}

// Функция для экранирования HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Функция для показа ошибок
function showError(message) {
  const table = document.querySelector("#usersTable tbody");
  if (table) {
    table.innerHTML = `<tr><td colspan="11" style="color: red; text-align: center;">${escapeHtml(message)}</td></tr>`;
  }
  alert(message);
}

// Загружаем пользователей при загрузке страницы
document.addEventListener("DOMContentLoaded", loadUsers);
