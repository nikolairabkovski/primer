document.addEventListener("DOMContentLoaded", function () {
  // Инициализация AOS анимаций
  AOS.init({
    duration: 800,
    once: true,
    offset: 100,
  });

  // Плавная прокрутка для якорных ссылок
  setupSmoothScroll();

  // Подсветка активного раздела при прокрутке
  setupActiveNavHighlight();

  // Обработчик кнопки "Наверх"
  setupBackToTop();
});

// Плавная прокрутка к разделам
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      // Игнорируем пустые якоря и #
      if (href === "#" || !href) return;

      const targetElement = document.querySelector(href);
      if (targetElement) {
        e.preventDefault();

        // Плавная прокрутка
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });

        // Добавляем смещение для учета фиксированной шапки
        setTimeout(() => {
          const headerHeight = document.querySelector("header").offsetHeight;
          const targetPosition =
            targetElement.getBoundingClientRect().top +
            window.pageYOffset -
            headerHeight -
            30;
          window.scrollTo({
            top: targetPosition,
            behavior: "smooth",
          });
        }, 10);
      }
    });
  });
}

// Подсветка активного раздела в навигации
function setupActiveNavHighlight() {
  const sections = document.querySelectorAll(".policy-section");
  const navLinks = document.querySelectorAll(".nav-item");

  function highlightNavOnScroll() {
    let currentSectionId = "";

    sections.forEach((section) => {
      const sectionTop = section.getBoundingClientRect().top;
      const sectionHeight = section.offsetHeight;
      const headerHeight = document.querySelector("header").offsetHeight;

      // Проверяем, находится ли секция в видимой области
      if (
        sectionTop <= headerHeight + 150 &&
        sectionTop + sectionHeight > headerHeight + 150
      ) {
        currentSectionId = section.getAttribute("id");
      }
    });

    // Обновляем активный класс
    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${currentSectionId}`) {
        link.classList.add("active");
        link.style.color = "var(--primary-color)";
        link.style.borderColor = "var(--primary-color)";
        link.style.background = "rgba(26, 95, 122, 0.05)";
      } else {
        link.style.color = "";
        link.style.borderColor = "";
        link.style.background = "";
      }
    });
  }

  // Слушаем событие прокрутки
  window.addEventListener("scroll", highlightNavOnScroll);

  // Вызываем сразу для начального состояния
  setTimeout(highlightNavOnScroll, 300);
}

// Кнопка "Наверх"
function setupBackToTop() {
  // Создаем кнопку
  const backToTopBtn = document.createElement("button");
  backToTopBtn.id = "backToTop";
  backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  backToTopBtn.title = "Наверх";
  document.body.appendChild(backToTopBtn);

  // Стили для кнопки
  backToTopBtn.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transform: translateY(20px);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Показываем/скрываем кнопку при прокрутке
  window.addEventListener("scroll", function () {
    if (window.pageYOffset > 500) {
      backToTopBtn.style.opacity = "1";
      backToTopBtn.style.visibility = "visible";
      backToTopBtn.style.transform = "translateY(0)";
    } else {
      backToTopBtn.style.opacity = "0";
      backToTopBtn.style.visibility = "hidden";
      backToTopBtn.style.transform = "translateY(20px)";
    }
  });

  // Прокрутка наверх при клике
  backToTopBtn.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  // Эффект при наведении
  backToTopBtn.addEventListener("mouseenter", function () {
    this.style.transform = "translateY(-5px) scale(1.1)";
  });

  backToTopBtn.addEventListener("mouseleave", function () {
    if (window.pageYOffset > 500) {
      this.style.transform = "translateY(0) scale(1)";
    }
  });
}

// Копирование email адреса в буфер обмена
document.addEventListener("click", function (e) {
  if (
    e.target.closest(".contact-card") &&
    e.target.closest(".contact-card").querySelector(".contact-info p")
  ) {
    const emailElement = e.target
      .closest(".contact-card")
      .querySelector(".contact-info p");
    const email = emailElement.textContent.trim();

    // Проверяем, является ли текст email адресом
    if (email.includes("@")) {
      // Не мешаем обычному переходу по ссылке mailto
      if (!e.target.closest("a")) return;

      // Показываем подсказку о копировании
      showToast("Email скопирован: " + email, "success");
    }
  }
});

// Функция для показа всплывающих уведомлений
function showToast(message, type = "info") {
  // Удаляем предыдущее уведомление, если есть
  const existingToast = document.querySelector(".custom-toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Создаем уведомление
  const toast = document.createElement("div");
  toast.className = `custom-toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Стили для уведомления
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 30px;
    background: white;
    padding: 15px 25px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 2000;
    font-weight: 500;
    animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 2.7s forwards;
    border-left: 4px solid var(--success-color);
  `;

  // Удаляем через 3 секунды
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

// Добавляем анимации для уведомлений
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleSheet);
