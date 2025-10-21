document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("list") || document.body;
  const nowEl = document.getElementById("now");
  const fFrom = document.getElementById("f_from");
  const fTo = document.getElementById("f_to");
  const fLimit = document.getElementById("f_limit");
  const apply = document.getElementById("apply");

  const fmtNow = () =>
    new Date().toLocaleString("de-AT", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  nowEl.textContent = fmtNow();
  setInterval(() => (nowEl.textContent = fmtNow()), 30000);

  // По умолчанию: последние 2 дня (вчера..сегодня)
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const toISO = (d) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  if (!fFrom.value) fFrom.value = toISO(yest);
  if (!fTo.value) fTo.value = toISO(today);

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

  async function loadAndRender() {
    listEl.innerHTML = '<p class="meta">Lade…</p>';
    try {
      const from = fFrom.value || "";
      const to = fTo.value || "";
      const limit = Number(fLimit.value) || 50;

      // Получаем СРАЗУ с фильтрами по дате (сервер срежет лишнее)
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
        .map((r) => {
          const ts = asDate(r.timestamp) || asDate(r.report_date);
          // На старых строках shift мог быть ISO — маскируем
          const shift =
            typeof r.shift === "string" && /T\d{2}:\d{2}/.test(r.shift)
              ? "—"
              : r.shift || "—";
          const km = safeNum(r.total_km).toFixed(1);
          return `
            <article class="card" role="listitem" aria-label="Report">
              <h3>${r.driver_name || "—"} • ${shift} • Route ${
            r.route || "—"
          }</h3>
              <div class="meta">${fmtAT(ts)}</div>
              <div class="row"><span>Gesamtstrecke</span><strong>${km} km</strong></div>
              ${
                r.sequence_names
                  ? `<div class="meta" style="margin-top:8px">${r.sequence_names}</div>`
                  : ""
              }
            </article>
          `;
        })
        .join("");
    } catch (e) {
      console.error("recent error:", e);
      listEl.innerHTML = '<p style="color:#b00">Fehler beim Laden</p>';
    }
  }

  apply.addEventListener("click", loadAndRender);

  // Первая загрузка
  loadAndRender();
});
