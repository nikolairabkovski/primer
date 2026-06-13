// faq.js
document.addEventListener("DOMContentLoaded", function () {
  // Инициализация AOS (анимации)
  AOS.init({
    duration: 800,
    once: true,
    offset: 100,
  });

  // Инициализация поиска
  setupSearch();

  // Установка счетчика вопросов
  updateQuestionCount();
});

// Переключение FAQ
function toggleFaq(element) {
  const faqItem = element.closest(".faq-item");
  const isActive = faqItem.classList.contains("active");

  // Закрываем все открытые FAQ
  if (!isActive) {
    document.querySelectorAll(".faq-item.active").forEach((item) => {
      item.classList.remove("active");
    });
  }

  // Переключаем текущий
  faqItem.classList.toggle("active");
}

// Фильтрация по категориям
function filterByCategory(category) {
  // Обновляем активную кнопку
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

  // Получаем все элементы FAQ
  const faqItems = document.querySelectorAll(".faq-item");
  const categorySections = document.querySelectorAll(".faq-category-section");

  if (category === "all") {
    // Показываем все секции и все вопросы
    categorySections.forEach((section) => {
      section.style.display = "block";
    });
    faqItems.forEach((item) => {
      item.style.display = "block";
    });
  } else {
    // Скрываем все секции
    categorySections.forEach((section) => {
      section.style.display = "none";
    });

    // Показываем выбранную секцию
    document.getElementById(category).style.display = "block";
  }

  // Обновляем счетчик видимых вопросов
  updateVisibleCount();
}

// Настройка поиска
function setupSearch() {
  const searchInput = document.getElementById("faqSearch");
  let searchTimeout;

  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = this.value.toLowerCase().trim();
      searchFaq(query);
    }, 300);
  });
}

// Поиск по FAQ
function searchFaq(query) {
  const faqItems = document.querySelectorAll(".faq-item");
  const categorySections = document.querySelectorAll(".faq-category-section");
  let visibleCount = 0;

  if (query === "") {
    // Если поиск пустой, показываем все
    faqItems.forEach((item) => {
      item.style.display = "block";
    });
    categorySections.forEach((section) => {
      section.style.display = "block";
    });
    visibleCount = faqItems.length;
  } else {
    // Скрываем все секции
    categorySections.forEach((section) => {
      section.style.display = "none";
    });

    // Ищем по вопросам и ответам
    faqItems.forEach((item) => {
      const question = item
        .querySelector(".question-text")
        .textContent.toLowerCase();
      const answer = item
        .querySelector(".faq-answer")
        .textContent.toLowerCase();
      const category = item.dataset.category;

      if (question.includes(query) || answer.includes(query)) {
        item.style.display = "block";
        visibleCount++;

        // Показываем секцию этой категории
        document.getElementById(category).style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  // Обновляем счетчик
  document.getElementById("totalQuestions").textContent = visibleCount;

  // Если ничего не найдено
  if (visibleCount === 0) {
    showNoResults();
  }
}

// Показать сообщение "ничего не найдено"
function showNoResults() {
  const container = document.querySelector(".faq-list");
  let noResults = document.getElementById("no-results");

  if (!noResults) {
    noResults = document.createElement("div");
    noResults.id = "no-results";
    noResults.className = "no-results";
    noResults.innerHTML = `
      <i class="fas fa-search"></i>
      <h3>Ничего не найдено</h3>
      <p>Попробуйте изменить поисковый запрос</p>
    `;
    container.appendChild(noResults);
  }

  noResults.style.display = "block";
}

// Обновление счетчика вопросов
function updateQuestionCount() {
  const totalQuestions = document.querySelectorAll(".faq-item").length;
  document.getElementById("totalQuestions").textContent = totalQuestions;
}

// Обновление счетчика видимых вопросов
function updateVisibleCount() {
  const visibleItems = document.querySelectorAll(
    '.faq-item[style="display: block;"]',
  ).length;
  document.getElementById("totalQuestions").textContent =
    visibleItems || document.querySelectorAll(".faq-item").length;
}

// Экспорт функций в глобальную область
window.toggleFaq = toggleFaq;
window.filterByCategory = filterByCategory;
