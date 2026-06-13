// auth.js

// Авторизация
async function login(event) {
  event.preventDefault();
  console.log("Функция login вызвана");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const data = { email, password };

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    console.log("Ответ сервера:", result);

    if (res.ok) {
      // Сохраняем токен
      localStorage.setItem("token", result.token);

      // ПРОВЕРЯЕМ, ЧТО ТОКЕН СОХРАНИЛСЯ
      const savedToken = localStorage.getItem("token");
      console.log(
        "Токен сохранен в localStorage:",
        savedToken ? "✅ ДА" : "❌ НЕТ",
      );

      if (savedToken) {
        console.log(
          "Первые 20 символов токена:",
          savedToken.substring(0, 20) + "...",
        );
        alert("Вы успешно вошли в систему");
        window.location.href = "index.html";
      } else {
        alert("Ошибка: токен не сохранился в localStorage");
      }
    } else {
      alert(result.message || "Ошибка входа");
    }
  } catch (error) {
    console.error("Ошибка при входе:", error);
    alert("Ошибка соединения с сервером");
  }
}

// Регистрация
async function register(event) {
  event.preventDefault();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    alert("Пароли не совпадают");
    return;
  }

  const data = {
    fullname: document.getElementById("fullname").value,
    nickname: document.getElementById("nickname").value,
    username: document.getElementById("username").value,
    email: document.getElementById("email").value,
    password: password,
  };

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    console.log("Ответ сервера регистрации:", result);
    alert(result.message);

    if (res.ok) {
      window.location.href = "login.html";
    }
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    alert("Ошибка соединения с сервером");
  }
}

// Функция выхода
function logout() {
  localStorage.removeItem("token");
  console.log("Токен удален");
  window.location.href = "index.html";
}

// Делаем функции глобальными
window.login = login;
window.register = register;
window.logout = logout;
