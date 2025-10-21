/* ===== api.js — надёжные обёртки для Apps Script JSON API (кэш, SWR, дедуп) ===== */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxpGn11PT70usKYe0xE7S28FlwNIrJhXXEzaeK022VPZx7RObBEMvjq4ghpewnRyPGa/exec";
const API_SECRET = "102030";
window.GAS_URL = window.GAS_URL || GAS_URL;

/* ----------------------------- Внутренние утилиты ----------------------------- */

// Ключ кэша — стабильно и безопасно (как querystring)
function makeKey(obj) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    usp.append(k, v == null ? "" : String(v));
  }
  return usp.toString();
}

const nowMs = () => Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Решаем, стоит ли ретраить ошибку
function isRetriableError(err, status) {
  if (err?.name === "AbortError") return true;
  if (
    err?.message &&
    /NetworkError|Failed to fetch|Load failed/i.test(err.message)
  )
    return true;
  // 5xx — да, 4xx — нет
  if (typeof status === "number") return status >= 500 && status < 600;
  return false;
}

/* ---------- Универсальный fetch с таймаутом и (опц.) ретраями ---------- */
async function fetchJSON(
  url,
  options = {},
  { retries = 1, timeoutMs = 8000, backoffBaseMs = 300 } = {}
) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal,
        cache: "no-store",
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const e = new Error(`Non-JSON response (HTTP ${res.status})`);
        e.status = res.status;
        throw e;
      }

      if (!res.ok || data?.ok === false) {
        const e = new Error(data?.error || `HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const status = err?.status;
      if (attempt === retries || !isRetriableError(err, status)) throw err;
      const delay = Math.round(
        backoffBaseMs * (attempt + 1) * (1 + Math.random())
      );
      await sleep(delay);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error("Unknown fetch error");
}

/* ------------------------------- Базовые вызовы ---------------------------- */

async function apiGet(params, { retries = 1, timeoutMs = 8000 } = {}) {
  const u = new URL(GAS_URL);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set("secret", API_SECRET);
  u.searchParams.set("_ts", Date.now()); // анти-кэш
  return fetchJSON(u.toString(), { method: "GET" }, { retries, timeoutMs });
}

async function apiPost(body, { retries = 1, timeoutMs = 10000 } = {}) {
  const u = new URL(GAS_URL);
  u.searchParams.set("_ts", Date.now());
  const form = new URLSearchParams({ ...(body || {}), secret: API_SECRET });
  return fetchJSON(
    u.toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: form,
    },
    { retries, timeoutMs }
  );
}

/* ---------------------- Клиентский кэш + дедупликация ---------------------- */

const _memCache = new Map();
const _inFlight = new Map();

const isFresh = (entry) => entry && nowMs() - entry.ts < entry.ttl;

/** Возвращает из кэша; если просрочен — ходит в сеть; при swr=true обновляет фоновой перезагрузкой.
 */
async function cachedGet(
  params,
  ttlMs,
  { swr = true, retries = 1, timeoutMs = 8000 } = {}
) {
  const key = makeKey(params);
  const cached = _memCache.get(key);

  // fresh → вернуть и (опц.) тихо обновить
  if (isFresh(cached)) {
    if (swr) {
      apiGet(params, { retries, timeoutMs })
        .then((fresh) => {
          _memCache.set(key, { ts: nowMs(), ttl: ttlMs, data: fresh });
        })
        .catch(() => {});
    }
    return cached.data;
  }

  // если уже летит такой же запрос — ждём его
  if (_inFlight.has(key)) {
    try {
      return await _inFlight.get(key);
    } finally {
    }
  }

  // новый запрос
  const p = apiGet(params, { retries, timeoutMs })
    .then((data) => {
      _memCache.set(key, { ts: nowMs(), ttl: ttlMs, data });
      return data;
    })
    .finally(() => _inFlight.delete(key));

  _inFlight.set(key, p);
  return p;
}

function cacheInvalidate(prefixObjOrString) {
  const prefix =
    typeof prefixObjOrString === "string"
      ? prefixObjOrString
      : makeKey(prefixObjOrString || {});
  for (const k of _memCache.keys()) {
    if (k.startsWith(prefix)) _memCache.delete(k);
  }
}
function _cacheDeleteByPrefix(prefix) {
  for (const k of _memCache.keys()) {
    if (k.startsWith(prefix)) _memCache.delete(k);
  }
}

/* ---------------------------- High-level функции --------------------------- */

const TTL = {
  getData: 240_000, // 4 мин локально (чуть меньше, чем на сервере)
  recent: 90_000, // 1.5 мин
};

/** Загрузка данных для маршрута: points, dist, drivers, pointNameById
 */
async function loadData(route) {
  const r = String(route || "1");
  const data = await cachedGet({ fn: "getData", route: r }, TTL.getData, {
    retries: 0,
    timeoutMs: 8000,
    swr: true,
  });

  const other = r === "1" ? "2" : "1";
  cachedGet({ fn: "getData", route: other }, TTL.getData, {
    retries: 0,
    swr: true,
  }).catch(() => {});
  return data;
}

/** Последние отправки по маршруту
 */
async function loadRecent(route, limit = 4) {
  const r = String(route || "");
  const l = String(limit);
  const resp = await cachedGet(
    { fn: "recent", route: r, limit: l },
    TTL.recent,
    {
      retries: 0,
      timeoutMs: 6000,
      swr: true,
    }
  );
  const items = resp?.items;
  return Array.isArray(items) ? items : [];
}

/** Сохранение отчёта (POST doPost submit)
 */
async function saveSubmission(payload) {
  const seq = payload?.sequence || [];
  const sequence = Array.isArray(seq) ? seq.join(">") : String(seq || "");

  const res = await apiPost(
    {
      route: payload.route,
      sequence,
      totalKm: String(payload.totalKm || "0"),
      driverId: payload.driverId || "",
      driverName: payload.driverName || "",
      shift: payload.shift || "",
      reportDate: payload.reportDate || "",
    },
    { retries: 0, timeoutMs: 12000 }
  );

  if (!res || res.ok === false) {
    throw new Error(res?.error || "submit failed");
  }

  // Инвалидация recent для маршрута (в т.ч. разных лимитов)
  const r = String(payload.route || "");
  for (const k of _memCache.keys()) {
    if (
      k.startsWith("fn=recent&") &&
      k.includes(`&route=${String(payload.route || "")}`)
    ) {
      _memCache.delete(k);
    }
  }

  return res.saved;
}

async function ping() {
  try {
    const ok = await apiGet({ fn: "ping" }, { retries: 0, timeoutMs: 4000 });
    return !!ok?.pong;
  } catch {
    return false;
  }
}

setInterval(() => {
  ping().catch(() => {});
}, 240_000);

/* ---------------------------- Экспорт в глобал ----------------------------- */

window.loadData = loadData;
window.loadRecent = loadRecent;
window.saveSubmission = saveSubmission;
window.ping = ping;

window.api = { loadData, loadRecent, saveSubmission, ping, cacheInvalidate };

window.API = window.API || {};

API.getRecentSubmissions = async function getRecentSubmissions(params = {}) {
  const route = String(params.route || "");
  const limit = String(params.limit || 50);

  const resp = await cachedGet({ fn: "recent", route, limit }, TTL.recent, {
    retries: 0,
    timeoutMs: 6000,
    swr: true,
  });

  return Array.isArray(resp?.items) ? resp.items : [];
};

API.getDrivers = async function getDrivers() {
  if (typeof google !== "undefined" && google.script && google.script.run) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getDrivers();
    });
  }

  const url = (window.GAS_URL || "").trim();
  if (!url) return [];
  const res = await fetch(`${url}?fn=getDrivers`);
  if (!res.ok) return [];
  return res.json();
};
