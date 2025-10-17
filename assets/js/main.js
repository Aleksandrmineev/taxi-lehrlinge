// ===== main.js — инициализация, загрузка данных, события UI =====

// лёгкий debounce для resize и т.п.
function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

// Токен загрузки для защиты от гонок (быстрые клики по сегментам)
let _loadToken = 0;

document.addEventListener("DOMContentLoaded", () => {
  const App = (window.App = window.App || {});

  // Глобальные форматтеры/состояние/DOM
  App.nf =
    App.nf || new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 });
  App.state = { dist: {}, points: [], drivers: [], route: "1" };

  App.dom = {
    list: document.getElementById("list"),
    total: document.getElementById("total"),
    seg1: document.getElementById("seg1"),
    seg2: document.getElementById("seg2"),
    drvSel: document.getElementById("driver"),
    shiftSel: document.getElementById("shift"),
    saveBtn: document.getElementById("save"),
    nowEl: document.getElementById("now"),
    confirmBox: document.getElementById("confirm"),
    dateEl: document.getElementById("reportDate"),
    btnSelectAll: document.getElementById("selectAll"),
    btnClearAll: document.getElementById("clearAll"),
    // НЕТ themeBtn — темой управляет только theme.js
  };

  // ========== Базовая инициализация UI ==========
  // НЕТ App.initThemeToggle() — темой управляет только theme.js
  if (typeof App.setReportDateToday === "function") App.setReportDateToday();

  // Часы: тикаем только на видимой вкладке
  const tick = () => typeof App.tickNow === "function" && App.tickNow();
  let clockId = setInterval(tick, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(clockId);
    } else {
      tick();
      clockId = setInterval(tick, 30_000);
    }
  });
  tick();

  // Отступ под «bottom»
  if (typeof App.setFooterSafe === "function") {
    App.setFooterSafe();
    window.addEventListener("resize", debounce(App.setFooterSafe, 150), {
      passive: true,
    });
  }

  // ========== Маршруты: сегменты ==========
  const setRouteActive = (r) => {
    App.dom.seg1?.setAttribute("aria-pressed", r === "1" ? "true" : "false");
    App.dom.seg2?.setAttribute("aria-pressed", r === "2" ? "true" : "false");
  };

  App.dom.seg1?.addEventListener("click", () => {
    if (App.state.route !== "1") load("1");
  });
  App.dom.seg2?.addEventListener("click", () => {
    if (App.state.route !== "2") load("2");
  });

  // ========== Выбрать/снять всё ==========
  App.dom.btnSelectAll &&
    (App.dom.btnSelectAll.onclick = () => {
      const boxes = App.dom.list?.querySelectorAll(".chk");
      if (!boxes || !boxes.length) return;
      requestAnimationFrame(() => {
        boxes.forEach((c) => {
          if (!c.checked) {
            c.checked = true;
            c.dispatchEvent(new Event("change"));
          }
        });
      });
    });

  App.dom.btnClearAll &&
    (App.dom.btnClearAll.onclick = () => {
      const boxes = App.dom.list?.querySelectorAll(".chk");
      if (!boxes || !boxes.length) return;
      requestAnimationFrame(() => {
        boxes.forEach((c) => {
          if (c.checked) {
            c.checked = false;
            c.dispatchEvent(new Event("change"));
          }
        });
      });
    });

  // ========== Загрузка данных (только getData) ==========
  async function load(r) {
    const route = String(r || "1");
    App.state.route = route;
    setRouteActive(route);

    const myToken = ++_loadToken; // защита от гонок
    if (App.dom.seg1) App.dom.seg1.disabled = true;
    if (App.dom.seg2) App.dom.seg2.disabled = true;

    try {
      const res = await window.loadData(route); // из api.js

      if (myToken !== _loadToken) return; // устаревший ответ

      // Приводим state
      const points = Array.isArray(res?.points) ? res.points : [];
      const dist = res?.dist && typeof res.dist === "object" ? res.dist : {};
      const drivers = Array.isArray(res?.drivers) ? res.drivers : [];

      App.state.points = points;
      App.state.dist = dist;
      App.state.drivers = drivers;

      // Рендерим
      if (typeof App.renderDrivers === "function") App.renderDrivers();
      if (typeof App.render === "function") App.render();
    } catch (err) {
      console.error("load() error:", err);
      const box = App.dom.confirmBox;
      const msg = err && err.message ? err.message : String(err);
      if (box) {
        box.hidden = false;
        box.style.display = "";
        box.classList.remove("ok");
        box.classList.add("sidebar__box", "err");
        box.textContent = `Fehler beim Laden der Daten: ${msg}`;
        setTimeout(() => (box.hidden = true), 3500);
      } else {
        alert(`Fehler beim Laden der Daten: ${msg}`);
      }
    } finally {
      if (myToken === _loadToken) {
        if (App.dom.seg1) App.dom.seg1.disabled = false;
        if (App.dom.seg2) App.dom.seg2.disabled = false;
      }
    }
  }

  // ========== Сохранение ==========
  App.dom.saveBtn &&
    (App.dom.saveBtn.onclick = async () => {
      const seq = typeof App.currentSeq === "function" ? App.currentSeq() : [];
      const km = typeof App.calcTotal === "function" ? App.calcTotal(seq) : 0;

      const drvId = App.dom.drvSel?.value || "";
      const drvName =
        App.dom.drvSel?.selectedOptions?.[0]?.textContent?.trim() || "";
      const shift = App.dom.shiftSel?.value || "";
      const reportDate = App.dom.dateEl?.value || ""; // YYYY-MM-DD

      const btn = App.dom.saveBtn;
      const prevText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Speichere…";

      try {
        const saved = await window.saveSubmission({
          route: App.state.route,
          sequence: seq,
          totalKm: km,
          driverId: drvId,
          driverName: drvName,
          shift,
          reportDate,
        });

        // UI-обратная связь на кнопке
        btn.textContent = "Gespeichert ✓";
        setTimeout(() => {
          btn.textContent = prevText;
          btn.disabled = false;
        }, 900);

        // Показать карточку подтверждения (из function.js)
        if (typeof App.renderConfirmation === "function") {
          App.renderConfirmation({
            timestamp: saved?.timestamp || Date.now(),
            route: App.state.route,
            driver_name: drvName,
            shift,
            total_km: km,
            sequence: Array.isArray(seq) ? seq.join(">") : String(seq || ""),
          });
        }
      } catch (e) {
        console.error("SUBMIT FAIL:", e);
        btn.textContent = prevText;
        btn.disabled = false;

        const box = App.dom.confirmBox;
        if (box) {
          box.hidden = false;
          box.style.display = "";
          box.classList.remove("ok");
          box.classList.add("sidebar__box", "err");
          box.textContent = "Fehler beim Speichern";
          setTimeout(() => (box.hidden = true), 3500);
        } else {
          alert("Fehler beim Speichern");
        }
      }
    });

  // Первый запуск
  load("1");
});
