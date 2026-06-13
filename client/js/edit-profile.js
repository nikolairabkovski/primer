// edit-profile.js
const token = localStorage.getItem("token");

if (!token) {
  alert("Не авторизован. Перенаправление на страницу входа.");
  window.location.href = "login.html";
}

let userId = null;

try {
  const payload = JSON.parse(atob(token.split(".")[1]));
  userId = payload.id;
  console.log("ID пользователя:", userId);
} catch (err) {
  console.error("Ошибка парсинга токена:", err);
  alert("Ошибка авторизации");
  window.location.href = "login.html";
}

async function loadProfile() {
  try {
    console.log("Загрузка профиля пользователя ID:", userId);

    const res = await fetch(`/api/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Пользователь не найден");
      }
      const errorData = await res.json();
      throw new Error(errorData.message || `Ошибка HTTP: ${res.status}`);
    }

    const user = await res.json();
    console.log("Данные профиля:", user);

    // Заполняем форму
    document.getElementById("fullname").value = user.fullname || "";
    document.getElementById("username").value = user.username || "";
    document.getElementById("email").value = user.email || "";
    document.getElementById("city").value = user.city || "";
    document.getElementById("birthdate").value = user.birthdate || "";
    document.getElementById("club").value = user.club || "";
    document.getElementById("bio").value = user.bio || "";
  } catch (error) {
    console.error("Ошибка загрузки профиля:", error);
    alert("Не удалось загрузить данные профиля: " + error.message);
  }
}

// Загружаем профиль при загрузке страницы
document.addEventListener("DOMContentLoaded", loadProfile);

// Обработчик отправки формы
document
  .getElementById("editForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    // Показываем индикатор загрузки
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Сохранение...";

    try {
      const data = {
        fullname: document.getElementById("fullname").value,
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        city: document.getElementById("city").value,
        birthdate: document.getElementById("birthdate").value,
        club: document.getElementById("club").value,
        bio: document.getElementById("bio").value,
      };

      console.log("Отправка данных:", data);

      const res = await fetch(`/api/profile/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      console.log("Ответ сервера:", result);

      if (!res.ok) {
        throw new Error(result.message || `Ошибка HTTP: ${res.status}`);
      }

      alert(result.message || "Профиль успешно обновлен");
      window.location.href = "profile.html";
    } catch (error) {
      console.error("Ошибка при сохранении:", error);
      alert("Не удалось сохранить изменения: " + error.message);
    } finally {
      // Восстанавливаем кнопку
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
