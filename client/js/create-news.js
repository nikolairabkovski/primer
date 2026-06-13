// create-news.js
document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Необходимо авторизоваться для создания новостей");
    window.location.href = "login.html";
    return;
  }

  loadCategories();
  document
    .getElementById("createNewsForm")
    .addEventListener("submit", createNews);
});

async function loadCategories() {
  try {
    const res = await fetch("/api/news/categories");
    const categories = await res.json();

    const select = document.getElementById("category");
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error);
  }
}

window.updateFileName = function (input) {
  const fileName = document.getElementById("file-name");
  if (input.files && input.files[0]) {
    fileName.textContent = input.files[0].name;
  } else {
    fileName.textContent = "Файл не выбран";
  }
};

async function createNews(event) {
  event.preventDefault();

  const token = localStorage.getItem("token");
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;
  const categoryId = document.getElementById("category").value;
  const hashtags = document.getElementById("hashtags").value;
  const imageFile = document.getElementById("image").files[0];

  if (!categoryId) {
    alert("Выберите категорию");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  formData.append("category_id", categoryId);

  if (hashtags) {
    formData.append("hashtags", hashtags);
  }

  if (imageFile) {
    formData.append("image", imageFile);
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Отправка...";
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/news", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Ошибка создания новости");
    }

    alert("Новость успешно отправлена на модерацию!");
    window.location.href = "news.html";
  } catch (error) {
    console.error("Ошибка:", error);
    alert("Ошибка: " + error.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}
