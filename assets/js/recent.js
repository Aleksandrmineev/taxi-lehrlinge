// assets/js/recent.js
document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("list") || document.body;
  const nowEl = document.getElementById("now");
  const fFrom = document.getElementById("f_from");
  const fTo = document.getElementById("f_to");
  const fLimit = document.getElementById("f_limit");
  const apply = document.getElementById("apply");

  /* ===== часы вверху ===== */
  const fmtNow = () =>
    new Date().toLocaleString("de-AT", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  if (nowEl) {
    nowEl.textContent = fmtNow();
    setInterval(() => (nowEl.textContent = fmtNow()), 30000);
  }

  /* ===== по умолчанию: последние 2 дня ===== */
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const toISO = (d) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  if (!fFrom.value) fFrom.value = toISO(yest);
  if (!fTo.value) fTo.value = toISO(today);

  /* ===== хелперы ===== */
  const safeNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
    return 0;
  };
  const asDate = (v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return new Date(v);
    const n = Number(v);
    if (!Number.isNaN(n)) return new Date(n);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };
  const fmtAT = (d) =>
    d
      ? d.toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" })
      : "—";
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Универсальная нормализация маршрута (поддержка \n, ">", " - ")
  function normalizeSeq(v) {
    if (v == null) return "";
    const text = String(v).replace(/\r\n?/g, "\n").trim();
    if (text.includes("\n")) return text; // уже новый формат
    return text
      .split(/(?:\s*>\s*|\s*-\s*)+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
  }

  /* ===== загрузка и рендер ===== */
  async function loadAndRender() {
    listEl.innerHTML = '<p class="meta">Lade…</p>';
    try {
      const from = fFrom.value || "";
      const to = fTo.value || "";
      const limit = Number(fLimit.value) || 50;

      const items = await API.getRecentSubmissions({
        from,
        to,
        limit,
        route: "",
      });

      if (!Array.isArray(items) || items.length === 0) {
        listEl.innerHTML = '<p style="opacity:.7">Keine Einträge</p>';
        return;
      }

      listEl.innerHTML = items
        .map((r, idx) => {
          try {
            const ts = asDate(r.timestamp) || asDate(r.report_date);
            const km = safeNum(r.total_km).toFixed(1); // стабильный вариант

            // shift берём как есть
            const shiftText =
              typeof r.shift === "string" || typeof r.shift === "number"
                ? String(r.shift).trim()
                : "";
            const shiftPart = shiftText ? ` • ${esc(shiftText)}` : "";

            // километры — сразу после shift
            const kmPart = ` • ${esc(km)} km`;

            // sequence_names: перенос на новые строки
            let seqBlock = "";
            if (r.sequence_names) {
              const text = normalizeSeq(r.sequence_names);
              if (text) {
                seqBlock = `<div class="meta" style="margin-top:8px; white-space:pre-line;">${esc(
                  text
                )}</div>`;
              }
            }

            return `
              <article class="card" role="listitem" aria-label="Report">
                <h3>${esc(r.driver_name || "—")} • Route ${esc(
              r.route || "—"
            )}${shiftPart}${kmPart}</h3>
                <div class="meta" style="border-bottom:1px solid rgba(0,0,0,0.15);padding-bottom:4px;margin-bottom:8px;">${fmtAT(
                  ts
                )}</div>
                ${seqBlock}
              </article>
            `;
          } catch (itemErr) {
            console.error("Render item failed at index", idx, itemErr, r);
            // Если одна карточка сломалась — пропускаем её, но не рвём весь список
            return "";
          }
        })
        .join("");
    } catch (e) {
      console.error("recent error:", e);
      listEl.innerHTML = '<p style="color:#b00">Fehler beim Laden</p>';
    }
  }

  apply.addEventListener("click", loadAndRender);

  // первая загрузка
  loadAndRender();
});
