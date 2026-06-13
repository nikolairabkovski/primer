// create-club.js
document.addEventListener("DOMContentLoaded", function () {
  console.log("Страница создания клуба загружена");

  const token = localStorage.getItem("token");

  if (!token) {
    alert("Необходимо авторизоваться для создания клуба");
    window.location.href = "login.html";
    return;
  }

  // Проверяем валидность токена
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    console.log("✅ Токен валидный, пользователь ID:", payload.id);

    if (payload.exp * 1000 < Date.now()) {
      throw new Error("Токен истек");
    }
  } catch (err) {
    console.error("❌ Ошибка токена:", err);
    localStorage.removeItem("token");
    alert("Сессия истекла. Войдите снова.");
    window.location.href = "login.html";
    return;
  }

  const form = document.getElementById("createClubForm");
  if (form) {
    form.addEventListener("submit", createClub);
    console.log("✅ Форма найдена, обработчик добавлен");
  } else {
    console.error("❌ Форма createClubForm не найдена");
  }

  // Добавляем обработчики для интерактивности
  setupFormHandlers();
});

function setupFormHandlers() {
  // Счетчик символов для описания
  const description = document.getElementById("description");
  const counter = document.getElementById("description-counter");

  if (description && counter) {
    description.addEventListener("input", function () {
      const remaining = 1000 - this.value.length;
      counter.textContent = remaining;
      counter.style.color = remaining < 100 ? "#f44336" : "#888";
    });
  }

  // Проверка доступности username
  const username = document.getElementById("username");
  const usernameStatus = document.getElementById("username-status");

  if (username && usernameStatus) {
    let timeout;
    username.addEventListener("input", function () {
      clearTimeout(timeout);
      const value = this.value;

      // Обновляем пример ссылки
      const exampleLink = document.getElementById("example-link");
      if (exampleLink) {
        exampleLink.textContent = `club.html?club=${value || "username"}`;
      }

      if (value.length < 3) {
        usernameStatus.textContent = "Минимум 3 символа";
        usernameStatus.className = "input-status";
        return;
      }

      timeout = setTimeout(() => checkUsername(value), 500);
    });
  }

  // Превью изображения
  const avatar = document.getElementById("avatar");
  if (avatar) {
    avatar.addEventListener("change", handleFileSelect);
  }

  // Drag and drop
  const fileWrapper = document.querySelector(".file-input-wrapper");
  if (fileWrapper) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      fileWrapper.addEventListener(eventName, preventDefaults, false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      fileWrapper.addEventListener(eventName, highlight, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      fileWrapper.addEventListener(eventName, unhighlight, false);
    });

    fileWrapper.addEventListener("drop", handleDrop, false);
  }
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  document.querySelector(".file-input-wrapper").classList.add("highlight");
}

function unhighlight() {
  document.querySelector(".file-input-wrapper").classList.remove("highlight");
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  const input = document.getElementById("avatar");
  input.files = files;
  handleFileSelect({ target: input });
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  const placeholder = document.getElementById("file-placeholder");
  const preview = document.getElementById("file-preview");
  const previewImg = document.getElementById("preview-image");

  if (file && file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      placeholder.style.display = "none";
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
}

window.removeFile = function () {
  const input = document.getElementById("avatar");
  const placeholder = document.getElementById("file-placeholder");
  const preview = document.getElementById("file-preview");

  input.value = "";
  placeholder.style.display = "flex";
  preview.style.display = "none";
};

async function checkUsername(username) {
  const status = document.getElementById("username-status");

  try {
    const res = await fetch(`/api/clubs/check-username?username=${username}`);
    const data = await res.json();

    if (data.available) {
      status.textContent = "✅ Username доступен";
      status.className = "input-status available";
    } else {
      status.textContent = "❌ Username уже занят";
      status.className = "input-status taken";
    }
  } catch (error) {
    console.error("Ошибка проверки username:", error);
  }
}

async function createClub(event) {
  event.preventDefault();
  console.log("Функция createClub вызвана");

  const token = localStorage.getItem("token");
  const submitBtn = document.getElementById("submit-btn");

  // Проверка на пустые обязательные поля
  const name = document.getElementById("name").value;
  const username = document.getElementById("username").value;

  if (!name || !username) {
    alert("Заполните все обязательные поля");
    return;
  }

  // Проверка формата username
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    alert(
      "Username может содержать только латинские буквы, цифры и подчеркивание",
    );
    return;
  }

  const formData = new FormData(event.target);

  // Добавляем is_private как строку
  const isPrivate = document.getElementById("is_private").checked;
  formData.set("is_private", isPrivate ? "true" : "false");

  // Блокируем кнопку
  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<span class="btn-icon">⏳</span><span class="btn-text">Создание...</span>';

  try {
    console.log("Отправка запроса на /api/clubs");

    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    console.log("Статус ответа:", res.status);

    let data;
    const contentType = res.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
      console.log("Ответ сервера:", data);
    } else {
      const text = await res.text();
      console.error("❌ Ответ не JSON:", text.substring(0, 200));
      throw new Error("Сервер вернул неверный формат данных");
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || "Ошибка создания клуба");
    }

    alert("✅ Клуб успешно создан!");
    window.location.href = `club.html?club=${data.username}`;
  } catch (error) {
    console.error("❌ Ошибка:", error);
    alert("Ошибка: " + error.message);

    // Разблокируем кнопку
    submitBtn.disabled = false;
    submitBtn.innerHTML =
      '<span class="btn-icon">⚽</span><span class="btn-text">Создать клуб</span>';
  }
}
