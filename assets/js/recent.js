// assets/js/recent.js
document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("list") || document.body;
  const nowEl = document.getElementById("now");
  const fFrom = document.getElementById("f_from");
  const fTo = document.getElementById("f_to");
  const fLimit = document.getElementById("f_limit");
  const fRoute = document.getElementById("f_route"); // 🔹 новый фильтр
  const apply = document.getElementById("apply");

  /* ===== часы ===== */
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

  /* ===== helpers ===== */
  const safeNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
    return 0;
  };
  const asDate = (v) => {
    if (v == null || v === "") return null;
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    const n = Number(v);
    if (!Number.isNaN(n)) return new Date(n);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  function normalizeSeq(v) {
    if (v == null) return "";
    const text = String(v).replace(/\r\n?/g, "\n").trim();
    if (text.includes("\n")) return text;
    return text
      .split(/(?:\s*>\s*|\s*-\s*)+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
  }

  const shiftRank = (s) => {
    const t = String(s || "").toLowerCase();
    if (t.startsWith("nach")) return 0;
    if (t.startsWith("fr")) return 1;
    return 2;
  };

  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  /* ===== загрузка и рендер ===== */
  async function loadAndRender() {
    listEl.innerHTML = '<p class="meta">Lade…</p>';
    try {
      const from = fFrom.value || "";
      const to = fTo.value || "";
      const limit = Number(fLimit.value) || 50;
      const routeFilter = fRoute?.value || ""; // 🔹 выбранный маршрут

      const items = await API.getRecentSubmissions({
        from,
        to,
        limit,
        route: routeFilter || "",
      });

      const fromD = from ? startOfDay(asDate(from)) : null;
      const toD = to ? endOfDay(asDate(to)) : null;
      const dateOf = (r) => asDate(r.report_date) || asDate(r.timestamp);

      const rows = (Array.isArray(items) ? items : [])
        .filter((r) => {
          const d = dateOf(r);
          if (!d) return false;
          if (fromD && d < fromD) return false;
          if (toD && d > toD) return false;
          if (routeFilter && String(r.route) !== String(routeFilter))
            return false; // 🔹 фильтр по Route
          return true;
        })
        .sort((a, b) => {
          const da = dateOf(a),
            db = dateOf(b);
          if (db - da !== 0) return db - da;
          const sr = shiftRank(a.shift) - shiftRank(b.shift);
          if (sr !== 0) return sr;
          const ra = Number(a.route) || 9999,
            rb = Number(b.route) || 9999;
          return ra - rb;
        })
        .slice(0, limit);

      if (!rows.length) {
        listEl.innerHTML = '<p style="opacity:.7">Keine Einträge</p>';
        return;
      }

      listEl.innerHTML = rows
        .map((r, idx) => {
          try {
            const repDate = dateOf(r);
            const dateStr = repDate ? repDate.toLocaleDateString("de-AT") : "—";
            const shiftText = (r.shift ?? "").toString().trim();
            const km = safeNum(r.total_km).toFixed(1);
            const routeTxt = (r.route ?? "—").toString().trim();

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
                <h3>№ ${esc(r.row_num)} • ${esc(dateStr)} • ${esc(
              shiftText || "—"
            )} • Route ${esc(routeTxt)}</h3>
                <div class="meta" style="border-bottom:1px solid rgba(0,0,0,0.15);padding-bottom:4px;margin-bottom:8px;">
                  ${esc(r.driver_name || "—")} • ${esc(km)} km
                </div>
                ${seqBlock}
              </article>
            `;
          } catch (err) {
            console.error("Render item failed at index", idx, err, r);
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
  loadAndRender();
});
