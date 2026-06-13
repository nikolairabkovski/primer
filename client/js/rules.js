// rules.js
document.addEventListener("DOMContentLoaded", function () {
  // Инициализация AOS
  AOS.init({
    duration: 800,
    once: true,
    offset: 100,
  });

  // Отслеживание прогресса чтения
  trackReadingProgress();

  // Подсветка активного пункта навигации
  highlightNavOnScroll();

  // Кнопка "Наверх"
  setupScrollTop();

  // Плавный скролл к якорям
  setupSmoothScroll();
});

// Отслеживание прогресса чтения
function trackReadingProgress() {
  const progressBar = document.getElementById("readingProgress");

  window.addEventListener("scroll", () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    const progress = (scrollTop / scrollHeight) * 100;

    progressBar.style.width = progress + "%";
  });
}

// Подсветка активного пункта навигации
function highlightNavOnScroll() {
  const sections = document.querySelectorAll(".rules-section");
  const navButtons = document.querySelectorAll(".nav-btn");

  window.addEventListener("scroll", () => {
    let current = "";

    sections.forEach((section) => {
      const sectionTop = section.offsetTop - 150;
      const sectionBottom = sectionTop + section.offsetHeight;

      if (pageYOffset >= sectionTop && pageYOffset < sectionBottom) {
        current = section.getAttribute("id");
      }
    });

    navButtons.forEach((btn) => {
      btn.classList.remove("active");
      if (btn.getAttribute("onclick")?.includes(current)) {
        btn.classList.add("active");
      }
    });
  });
}

// Скролл к секции
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  const offset = 100;
  const sectionPosition = section.offsetTop - offset;

  window.scrollTo({
    top: sectionPosition,
    behavior: "smooth",
  });
}

// Кнопка "Наверх"
function setupScrollTop() {
  const scrollBtn = document.getElementById("scrollTop");

  window.addEventListener("scroll", () => {
    if (window.pageYOffset > 300) {
      scrollBtn.classList.add("show");
    } else {
      scrollBtn.classList.remove("show");
    }
  });
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// Плавный скролл для всех якорей
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
}

// Принятие правил
function acceptRules() {
  // Показываем уведомление
  showNotification(
    "Спасибо! Вы подтвердили ознакомление с правилами.",
    "success",
  );

  // Сохраняем в localStorage
  localStorage.setItem("rules_accepted", "true");
  localStorage.setItem("rules_accepted_date", new Date().toISOString());
}

// Показать уведомление
function showNotification(message, type = "info") {
  // Создаем элемент уведомления
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === "success" ? "check-circle" : "info-circle"}"></i>
    <span>${message}</span>
  `;

  // Добавляем стили для уведомления
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === "success" ? "linear-gradient(135deg, #28a745, #20c997)" : "linear-gradient(135deg, #17a2b8, #3498db)"};
    color: white;
    border-radius: 50px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 9999;
    animation: slideInRight 0.3s ease;
  `;

  document.body.appendChild(notification);

  // Удаляем через 3 секунды
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Экспорт функций
window.scrollToSection = scrollToSection;
window.scrollToTop = scrollToTop;
window.acceptRules = acceptRules;
