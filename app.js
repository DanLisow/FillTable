// ─── Config ────────────────────────────────────────────────────────────────
const DATA_URL = "./data.json"; // путь к JSON со списками
const WEBHOOK_URL = "https://indulgently-iridescent-katydid.cloudpub.ru/webhook/ab50b882-dd5e-4968-b903-966c7c0cdf47";
const HISTORY_KEY = "task_history";
const MAX_HISTORY = 50;

// ─── Telegram WebApp ────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// ─── State ───────────────────────────────────────────────────────────────────
let listsData = {};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initTimePicker();
  setDefaultDate();
  await loadData();
  renderHistory();

  document.getElementById("task-form").addEventListener("submit", onSubmit);
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => {
        c.classList.add("hidden");
        c.classList.remove("active");
      });
      btn.classList.add("active");
      const content = document.getElementById("tab-" + tab);
      content.classList.remove("hidden");
      content.classList.add("active");
      if (tab === "history") renderHistory();
    });
  });
}

// ─── Date & Time ──────────────────────────────────────────────────────────────
function setDefaultDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  document.getElementById("date").value = `${y}-${m}-${d}`;
}

function initTimePicker() {
  const hours = document.getElementById("time-hours");
  const minutes = document.getElementById("time-minutes");
  const now = new Date();

  for (let h = 0; h < 24; h++) {
    const opt = document.createElement("option");
    opt.value = String(h).padStart(2, "0");
    opt.textContent = String(h).padStart(2, "0");
    if (h === now.getHours()) opt.selected = true;
    hours.appendChild(opt);
  }
  for (let m = 0; m < 60; m += 5) {
    const opt = document.createElement("option");
    opt.value = String(m).padStart(2, "0");
    opt.textContent = String(m).padStart(2, "0");
    if (m === (Math.round(now.getMinutes() / 5) * 5) % 60) opt.selected = true;
    minutes.appendChild(opt);
  }
}

// ─── Load data ────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(DATA_URL + "?t=" + Date.now());
    listsData = await res.json();
  } catch {
    showToast("Не удалось загрузить списки", true);
    listsData = {};
  }

  const fieldMap = {
    "ss-project": { key: "projects", name: "project" },
    "ss-executor": { key: "executors", name: "executor" },
    "ss-lpr": { key: "lpr", name: "lpr" },
    "ss-position": { key: "positions", name: "position" },
    "ss-task_type": { key: "task_types", name: "task_type" },
    "ss-stage": { key: "stages", name: "stage" },
  };

  Object.entries(fieldMap).forEach(([id, { key, name }]) => {
    initSearchableSelect(id, listsData[key] || [], name);
  });
}

// ─── Searchable Select ────────────────────────────────────────────────────────
function initSearchableSelect(containerId, options, fieldName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const input = container.querySelector(".ss-input");
  const hidden = container.querySelector('input[type="hidden"]');
  const dropdown = container.querySelector(".ss-dropdown");

  let focusedIndex = -1;

  function renderOptions(filter = "") {
    const filtered = options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()));
    dropdown.innerHTML = "";
    focusedIndex = -1;

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="ss-no-results">Ничего не найдено</div>';
      return;
    }
    filtered.forEach((opt, i) => {
      const div = document.createElement("div");
      div.className = "ss-option" + (opt === hidden.value ? " selected" : "");
      div.textContent = opt;
      div.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectOption(opt);
      });
      dropdown.appendChild(div);
    });
  }

  function selectOption(val) {
    input.value = val;
    hidden.value = val;
    dropdown.classList.add("hidden");
    input.blur();
  }

  function openDropdown() {
    renderOptions(input.value);
    dropdown.classList.remove("hidden");
  }

  input.addEventListener("focus", () => openDropdown());
  input.addEventListener("input", () => {
    hidden.value = "";
    renderOptions(input.value);
    dropdown.classList.remove("hidden");
  });

  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".ss-option");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
      updateFocus(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      updateFocus(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && items[focusedIndex]) {
        selectOption(items[focusedIndex].textContent);
      }
    } else if (e.key === "Escape") {
      dropdown.classList.add("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.add("hidden");
      // если текст не совпадает с выбранным — сбросить
      if (input.value !== hidden.value) {
        input.value = hidden.value;
      }
    }
  });

  function updateFocus(items) {
    items.forEach((el, i) => el.classList.toggle("focused", i === focusedIndex));
    if (items[focusedIndex]) {
      items[focusedIndex].scrollIntoView({ block: "nearest" });
    }
  }
}

// ─── Collect form data ────────────────────────────────────────────────────────
function collectForm() {
  const hours = document.getElementById("time-hours").value;
  const minutes = document.getElementById("time-minutes").value;

  return {
    date: document.getElementById("date").value,
    time: `${hours}:${minutes}`,
    project: document.querySelector('#ss-project input[type="hidden"]').value,
    executor: document.querySelector('#ss-executor input[type="hidden"]').value,
    lpr: document.querySelector('#ss-lpr input[type="hidden"]').value,
    position: document.querySelector('#ss-position input[type="hidden"]').value,
    task_type: document.querySelector('#ss-task_type input[type="hidden"]').value,
    stage: document.querySelector('#ss-stage input[type="hidden"]').value,
    task_name: document.getElementById("task_name").value.trim(),
    task_description: document.getElementById("task_description").value.trim(),
  };
}

// ─── Fill form (for copy) ─────────────────────────────────────────────────────
function fillForm(data) {
  document.getElementById("date").value = data.date || "";

  if (data.time) {
    const [h, m] = data.time.split(":");
    document.getElementById("time-hours").value = h;
    document.getElementById("time-minutes").value = m;
  }

  const ssFields = ["project", "executor", "lpr", "position", "task_type", "stage"];
  ssFields.forEach((name) => {
    const idMap = {
      project: "ss-project",
      executor: "ss-executor",
      lpr: "ss-lpr",
      position: "ss-position",
      task_type: "ss-task_type",
      stage: "ss-stage",
    };
    const container = document.getElementById(idMap[name]);
    if (!container) return;
    const input = container.querySelector(".ss-input");
    const hidden = container.querySelector('input[type="hidden"]');
    input.value = data[name] || "";
    hidden.value = data[name] || "";
  });

  document.getElementById("task_name").value = data.task_name || "";
  document.getElementById("task_description").value = data.task_description || "";
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit(e) {
  e.preventDefault();
  const data = collectForm();

  if (!data.task_name) {
    showToast("Введите название задачи", true);
    return;
  }

  const btn = document.querySelector(".btn-submit");
  btn.disabled = true;
  btn.textContent = "Отправляю...";

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    saveToHistory(data);
    showToast("Запись добавлена!");
    e.target.reset();
    setDefaultDate();
    // сбросить searchable selects
    document.querySelectorAll(".searchable-select .ss-input").forEach((i) => (i.value = ""));
    document.querySelectorAll('.searchable-select input[type="hidden"]').forEach((i) => (i.value = ""));
  } catch (err) {
    showToast("Ошибка отправки. Проверь подключение.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Отправить";
  }
}

// ─── History ──────────────────────────────────────────────────────────────────
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveToHistory(data) {
  const history = getHistory();
  history.unshift({ ...data, _id: Date.now() });
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function deleteFromHistory(id) {
  const history = getHistory().filter((r) => r._id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  const history = getHistory();

  list.innerHTML = "";

  if (history.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  history.forEach((record) => {
    const card = document.createElement("div");
    card.className = "history-card";

    const badges = [record.project, record.executor, record.position, record.task_type, record.stage].filter(Boolean);

    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-title">${escHtml(record.task_name || "—")}</div>
        <div class="history-card-date">${escHtml(record.date || "")} ${escHtml(record.time || "")}</div>
      </div>
      ${badges.length ? `<div class="history-card-meta">${badges.map((b) => `<span class="badge">${escHtml(b)}</span>`).join("")}</div>` : ""}
      ${record.task_description ? `<div class="history-card-desc">${escHtml(record.task_description)}</div>` : ""}
      <div class="history-card-actions">
        <button class="btn-copy" data-id="${record._id}">Копировать в форму</button>
        <button class="btn-delete" data-id="${record._id}">✕</button>
      </div>
    `;

    card.querySelector(".btn-copy").addEventListener("click", () => {
      fillForm(record);
      // переключиться на форму
      document.querySelector('[data-tab="form"]').click();
      showToast("Запись скопирована в форму");
    });

    card.querySelector(".btn-delete").addEventListener("click", () => {
      deleteFromHistory(record._id);
    });

    list.appendChild(card);
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
