// theme.js — независимая инициализация и синхронизация темы на всех страницах
(function () {
  const html = document.documentElement;
  const STORAGE_KEY = "theme";

  function resolveInitialTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    // fallback по системной теме
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(t) {
    html.dataset.theme = t === "light" ? "light" : "dark";
    // если на странице есть кнопка — обновим её состояние/иконку
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute(
        "aria-pressed",
        html.dataset.theme === "dark" ? "false" : "true"
      );
      btn.textContent = html.dataset.theme === "light" ? "☀️" : "🌙";
    }
  }

  // 1) Стартовое применение темы
  applyTheme(resolveInitialTheme());

  // 2) Если есть кнопка — навешиваем обработчик
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = html.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  });

  // 3) Синхронизация между вкладками
  window.addEventListener("storage", (e) => {
    if (
      e.key === STORAGE_KEY &&
      (e.newValue === "light" || e.newValue === "dark")
    ) {
      applyTheme(e.newValue);
    }
  });
})();
