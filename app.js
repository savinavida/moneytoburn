(() => {
  "use strict";

  const form = document.querySelector("#budget-form");
  const categories = [
    { key: "transport", label: "Самолёты, ноги, поезда", technical: "Транспорт", color: "#f36d3d" },
    { key: "stay", label: "Крыша над головой", technical: "Проживание", color: "#2d7560" },
    { key: "food", label: "Пища жизни и кофеёк", technical: "Питание", color: "#d7a52d" },
    { key: "fun", label: "Вау и тыц-тыц", technical: "Развлечения и экскурсии", color: "#6f75bb" },
    { key: "other", label: "Мелочи, без которых, ну, никак", technical: "Прочее", color: "#a99b82" }
  ];
  const state = Object.fromEntries(categories.map(({ key }) => [key, { mode: "quick", quick: "", items: [] }]));
  let lastCalculation = null;
  let toastTimer;

  const money = value => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const euro = value => `${money(value)} €`;
  const $ = selector => document.querySelector(selector);
  const plural = (number, one, few, many) => {
    const n = Math.abs(number) % 100, last = n % 10;
    if (n > 10 && n < 20) return many;
    if (last > 1 && last < 5) return few;
    return last === 1 ? one : many;
  };
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function activeCategoryTotal(key) {
    const category = state[key];
    return category.mode === "quick" ? (category.quick === "" ? 0 : Number(category.quick)) : category.items.reduce((sum, item) => sum + item.amount, 0);
  }

  function renderCategory(key) {
    const card = document.querySelector(`[data-category="${key}"]`);
    const category = state[key];
    card.querySelectorAll(".mode-btn").forEach(button => {
      const active = button.dataset.mode === category.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    card.querySelector(".quick-entry").hidden = category.mode !== "quick";
    card.querySelector(".detail-entry").hidden = category.mode !== "detail";
    const quickInput = card.querySelector(`[data-quick="${key}"]`);
    if (quickInput.value !== category.quick) quickInput.value = category.quick;
    card.querySelector(".mode-status").textContent = category.mode === "quick"
      ? (category.items.length ? "Быстрый ввод активен. Подробный список сохранён, но сейчас не входит в расчёт." : "Одна сумма на всю категорию — быстро и без лишней математики.")
      : "Суммируются только позиции ниже. Быстрая сумма сохранена отдельно и не учитывается.";
    card.querySelector(`[data-total="${key}"]`).textContent = euro(activeCategoryTotal(key));
    card.querySelector(`[data-detail-total="${key}"]`).textContent = euro(category.items.reduce((sum, item) => sum + item.amount, 0));
    const list = card.querySelector(`[data-list="${key}"]`);
    if (!category.items.length) {
      list.innerHTML = '<p class="empty-items">Пока пусто. Добавь первую статью расходов — или оставь так.</p>';
    } else {
      list.innerHTML = category.items.map(item => `<div class="expense-item" data-item-id="${item.id}"><input class="item-name" type="text" maxlength="180" value="${escapeHTML(item.name)}" aria-label="Название расхода"><span class="item-amount-wrap"><input class="item-amount" type="number" step="0.01" value="${item.amount}" aria-label="Сумма расхода"><span>€</span></span><button class="delete-item" type="button" aria-label="Удалить ${escapeHTML(item.name)}">×</button></div>`).join("");
    }
  }

  function renderAllCategories() { categories.forEach(({ key }) => renderCategory(key)); }

  function showFieldError(name, message) {
    const input = document.querySelector(`#${name}`);
    const error = document.querySelector(`[data-error="${name}"]`);
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
  }
  function clearErrors() {
    document.querySelectorAll("[aria-invalid='true']").forEach(input => input.removeAttribute("aria-invalid"));
    document.querySelectorAll(".field-error").forEach(node => node.textContent = "");
    $("#form-error").textContent = "";
  }

  function readTrip() {
    clearErrors();
    const peopleField = $("#people"), daysField = $("#days"), nightsField = $("#nights");
    const people = Number(peopleField.value), days = Number(daysField.value), nights = nightsField.value.trim() === "" ? 0 : Number(nightsField.value);
    let valid = true;
    if (peopleField.value.trim() === "" || !Number.isFinite(people) || !Number.isInteger(people) || people <= 0 || people > 10000) {
      showFieldError("people", "Эй, сколько искателей приключений? Укажи целое число больше нуля."); valid = false;
    }
    if (daysField.value.trim() === "" || !Number.isFinite(days) || !Number.isInteger(days) || days <= 0 || days > 3650) {
      showFieldError("days", "Кажется, ты забыл дни. Нужно целое число от 1 до 3650."); valid = false;
    }
    if (nightsField.value.trim() !== "" && (!Number.isFinite(nights) || !Number.isInteger(nights) || nights < 0 || nights > 3650)) {
      showFieldError("nights", "Ночей может быть от нуля до 3650 — без дробей."); valid = false;
    }
    if (!valid) {
      $("#form-error").textContent = "Проверь данные поездки — и снова в путь!";
      document.querySelector("[aria-invalid='true']")?.focus();
      return null;
    }
    return { people, days, nights };
  }

  function readActiveCosts() {
    const costs = [];
    for (const category of categories) {
      const amount = activeCategoryTotal(category.key);
      if (!Number.isFinite(amount) || Math.abs(amount) > 1e12 || (state[category.key].mode === "quick" && amount < 0)) {
        $("#form-error").textContent = state[category.key].mode === "quick" && amount < 0
          ? `В категории «${category.technical}» быстрый ввод не принимает минус. Для возврата переключись на «По пунктам».`
          : `Похоже, в категории «${category.technical}» затесалось слишком большое или некорректное число.`;
        return null;
      }
      costs.push({ ...category, amount });
    }
    return costs;
  }

  function renderResults(trip, costs) {
    const total = costs.reduce((sum, category) => sum + category.amount, 0);
    const perPerson = total / trip.people;
    const perDay = total / trip.days;
    const shares = costs.map(category => ({ ...category, share: total === 0 ? 0 : category.amount / total * 100 }));
    $("#total").innerHTML = `${money(total)} <span>€</span>`;
    $("#per-person").textContent = euro(perPerson);
    $("#per-day").textContent = euro(perDay);
    $("#chart-total").textContent = euro(total);
    $("#trip-summary").textContent = `${trip.people} ${plural(trip.people, "путешественник", "путешественника", "путешественников")} · ${trip.days} ${plural(trip.days, "день", "дня", "дней")} · ${trip.nights} ${plural(trip.nights, "ночь", "ночи", "ночей")}`;
    const positiveTotal = costs.reduce((sum, category) => sum + Math.max(0, category.amount), 0);
    const positiveShares = costs.map(category => ({ ...category, share: positiveTotal ? Math.max(0, category.amount) / positiveTotal * 100 : 0 }));
    let position = 0;
    const gradient = positiveTotal ? positiveShares.map(category => {
      const start = position; position += category.share;
      return `${category.color} ${start}% ${position}%`;
    }).join(", ") : "#e9e5dc 0% 100%";
    $("#donut").style.background = `conic-gradient(${gradient})`;
    $(".chart-note").textContent = costs.some(category => category.amount < 0) ? "диаграмма положительных трат" : "доли от общего";
    $("#donut").setAttribute("aria-label", `Распределение положительных расходов: ${positiveShares.map(category => `${category.technical} ${money(category.share)} процентов`).join(", ")}`);
    $("#legend").innerHTML = shares.map(category => `<li><span class="legend-dot" style="--cat:${category.color}"></span><span>${category.technical}</span><b>${money(category.share)}%</b></li>`).join("");
    const message = gameMessage(total, perPerson, perDay, trip, costs);
    $("#game-message-text").textContent = message;
    $("#game-message").hidden = false;
    $("#export-actions").hidden = false;
    $("#results").classList.remove("results-updated");
    requestAnimationFrame(() => $("#results").classList.add("results-updated"));
    lastCalculation = { trip, costs: costs.map(category => ({ ...category, items: state[category.key].items.map(item => ({ ...item })) , mode: state[category.key].mode })), total, perPerson, perDay, tripName: $("#trip-name").value.trim() };
  }

  function gameMessage(total, perPerson, perDay, trip, costs) {
    const allZero = costs.every(category => category.amount === 0);
    const hasNegative = costs.some(category => category.amount < 0);
    const perPersonPerDay = perPerson / trip.days;

    if (allZero) return "Бесплатное приключение? Ты точно знаешь какой-то секрет!";
    if (hasNegative) return "Возвраты учтены — вот это финансовая смекалка путешественника!";

    if (perPersonPerDay < 20) return "Лёгкий багаж для кошелька. Пусть приключения будут щедрыми на впечатления!";
    if (perPersonPerDay < 100) return "План выглядит бодро: бюджет при деле, а приключения уже маячат на горизонте.";
    if (perPersonPerDay < 300) return "План с размахом! Проверь, всё ли учтено, и можно паковать чемодан.";
    if (perPersonPerDay >= 300) return "Ого, маршрут с размахом! Кажется, приключение готовит немало красивых моментов.";

  return "Все цифры на месте. Ветер попутный — пора строить маршрут!";
}

  function calculate(event) {
    event?.preventDefault();
    const trip = readTrip();
    if (!trip) return;
    const costs = readActiveCosts();
    if (!costs) return;
    renderResults(trip, costs);
    renderAllCategories();
  }

  function showToast(message) {
    const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function makeReceiptHTML(data) {
    const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date());
    const detail = data.costs.map(category => {
      const items = category.items.length ? `<ul>${category.items.map(item => `<li><span>${escapeHTML(item.name)}</span><b>${euro(item.amount)}</b></li>`).join("")}</ul>${category.mode === "quick" ? '<p class="receipt-mode-note">Список сохранён, но в расчёт не включён: активен быстрый ввод</p>' : ""}` : `<p class="receipt-mode-note">${category.mode === "quick" ? "Быстрый ввод" : "Подробный ввод без отдельных позиций"}</p>`;
      return `<section class="receipt-category"><div class="receipt-category-head"><h3>${escapeHTML(category.label)} <small>${escapeHTML(category.technical)}</small></h3><strong>${euro(category.amount)}</strong></div>${items}</section>`;
    }).join("");
    const joke = gameMessage(data.total, data.perPerson, data.perDay, data.trip, data.costs);
    return `<div class="receipt-paper"><div class="receipt-topline">✳ ПУТЕВОЙ ДОКУМЕНТ № ${String(Date.now()).slice(-6)} ✳</div><div class="receipt-brand">Деньги <em>на ветер</em></div><p class="receipt-slogan"><span>Прикинь заранее, что и почём в твоём приключении!</span><em>Ведь только тогда будет так красиво и не больно.</em></p><div class="receipt-rule">✈ · · · · · · · · · · · · · · · · · · · · ✈</div><h1>Чек путешественника</h1>${data.tripName ? `<h2 class="receipt-trip-name">${escapeHTML(data.tripName)}</h2>` : ""}<p class="receipt-meta">${data.trip.people} ${plural(data.trip.people, "путешественник", "путешественника", "путешественников")} · ${data.trip.days} ${plural(data.trip.days, "день", "дня", "дней")} · ${data.trip.nights} ${plural(data.trip.nights, "ночь", "ночи", "ночей")}</p>${detail}<div class="receipt-total"><span>ИТОГО ПРИКЛЮЧЕНИЕ</span><strong>${euro(data.total)}</strong></div><div class="receipt-stats"><div><span>На одного</span><b>${euro(data.perPerson)}</b></div><div><span>За день</span><b>${euro(data.perDay)}</b></div></div><p class="receipt-joke">✳ ${escapeHTML(joke)}</p><div class="receipt-bottom"><span>Сформировано ${date}</span><b>ДЕНЬГИ НА ВЕТЕР © 2026</b><span>СМЕЛЕЕ МЕЧТАЙ. УМНЕЕ СЧИТАЙ.</span></div></div>`;
  }

  function exportPDF() {
    if (!lastCalculation) return showToast("Сначала рассчитай бюджет — чек сам себя не напечатает!");
    const printArea = $("#receipt-print");
    printArea.innerHTML = makeReceiptHTML(lastCalculation);
    document.body.classList.add("printing-receipt");
    window.print();
    document.body.classList.remove("printing-receipt");
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/); let line = "";
    const flush = () => { if (line) { ctx.fillText(line, x, y); y += lineHeight; line = ""; } };
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        flush();
        let fragment = "";
        for (const character of Array.from(word)) {
          const candidate = fragment + character;
          if (ctx.measureText(candidate).width > maxWidth && fragment) { line = fragment; flush(); fragment = character; }
          else fragment = candidate;
        }
        line = fragment;
        flush();
        continue;
      }
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { flush(); line = word; }
      else line = test;
    }
    flush();
    return y;
  }

  async function exportPNG() {
    if (!lastCalculation) return showToast("Сначала рассчитай бюджет — потом забирай памятный чек!");
    const data = lastCalculation, scale = 2, width = 760, pad = 58;
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date());
    const rows = [];
    for (const category of data.costs) {
      rows.push({ type: "category", label: category.label, technical: category.technical, amount: category.amount });
      if (category.items.length) {
        category.items.forEach(item => rows.push({ type: "item", label: item.name, amount: item.amount }));
        if (category.mode === "quick") rows.push({ type: "note", label: "Список сохранён, но не включён: активен быстрый ввод", amount: null });
      }
    }
    const contentWidth = width - pad * 2;
    ctx.font = "500 20px Arial";
    let height = 520;
    rows.forEach(row => { const text = row.type === "category" ? row.label : `— ${row.label}`; const lines = Math.max(1, Math.ceil(ctx.measureText(text).width / (contentWidth - 160))); height += row.type === "category" ? 68 + (lines - 1) * 26 : 38 + (lines - 1) * 25; });
    height += 320;
    canvas.width = width * scale; canvas.height = height * scale; ctx.scale(scale, scale);
    ctx.fillStyle = "#f4efe5"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fffefa"; ctx.fillRect(24, 24, width - 48, height - 48);
    ctx.strokeStyle = "#d9cdb8"; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.strokeRect(38, 38, width - 76, height - 76); ctx.setLineDash([]);
    let y = 90;
    ctx.textAlign = "center"; ctx.fillStyle = "#f36d3d"; ctx.font = "700 14px Arial"; ctx.fillText("✳  ПУТЕВОЙ ДОКУМЕНТ  ✳", width / 2, y); y += 54;
    ctx.fillStyle = "#20251f"; ctx.font = "800 43px Arial"; ctx.fillText("Деньги на ветер", width / 2, y); y += 34;
    ctx.fillStyle = "#254d3c"; ctx.font = "italic 17px Georgia"; ctx.fillText("Прикинь заранее, что и почём в твоём приключении!", width / 2, y); y += 25;
    ctx.fillStyle = "#77796e"; ctx.font = "italic 16px Georgia"; ctx.fillText("Ведь только тогда будет так красиво и не больно.", width / 2, y); y += 45;
    ctx.strokeStyle = "#e4dfd4"; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke(); y += 42;
    ctx.fillStyle = "#20251f"; ctx.font = "800 29px Arial"; ctx.fillText("Чек путешественника", width / 2, y); y += 32;
    if (data.tripName) { ctx.font = "600 20px Arial"; y = wrapCanvasText(ctx, data.tripName, width / 2, y, contentWidth, 26) + 4; }
    ctx.fillStyle = "#77796e"; ctx.font = "16px Arial"; ctx.fillText(`${data.trip.people} чел.  ·  ${data.trip.days} дней  ·  ${data.trip.nights} ночей`, width / 2, y); y += 44;
    for (const row of rows) {
      const isCat = row.type === "category", isNote = row.type === "note";
      ctx.textAlign = "left"; ctx.fillStyle = isCat ? "#254d3c" : isNote ? "#99998e" : "#77796e"; ctx.font = isCat ? "700 19px Arial" : isNote ? "italic 13px Arial" : "16px Arial";
      const labelX = isCat ? pad : pad + 18; const maxLabel = isNote ? contentWidth - 20 : contentWidth - 155;
      const beforeY = y; y = wrapCanvasText(ctx, isCat ? row.label : isNote ? row.label : `· ${row.label}`, labelX, y, maxLabel, isNote ? 20 : 25);
      if (!isNote) { ctx.textAlign = "right"; ctx.fillStyle = "#20251f"; ctx.font = isCat ? "700 19px Arial" : "16px Arial"; ctx.fillText(euro(row.amount), width - pad, beforeY); }
      y = Math.max(y, beforeY + 27); if (isCat) { y += 4; ctx.strokeStyle = "#eee8dd"; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke(); y += 15; } else y += 7;
    }
    y += 20; ctx.fillStyle = "#254d3c"; ctx.fillRect(pad, y, contentWidth, 112);
    ctx.textAlign = "left"; ctx.fillStyle = "#c5d1c8"; ctx.font = "700 13px Arial"; ctx.fillText("ИТОГО ПРИКЛЮЧЕНИЕ", pad + 20, y + 30);
    ctx.textAlign = "right"; ctx.fillStyle = "#f3c65b"; ctx.font = "800 37px Arial"; ctx.fillText(euro(data.total), width - pad - 20, y + 76); y += 137;
    ctx.textAlign = "left"; ctx.fillStyle = "#20251f"; ctx.font = "700 17px Arial"; ctx.fillText(`На одного: ${euro(data.perPerson)}`, pad, y); ctx.textAlign = "right"; ctx.fillText(`За день: ${euro(data.perDay)}`, width - pad, y); y += 43;
    ctx.textAlign = "center"; ctx.fillStyle = "#254d3c"; ctx.font = "italic 17px Georgia"; wrapCanvasText(ctx, gameMessage(data.total, data.perPerson, data.perDay, data.trip, data.costs), width / 2, y, contentWidth, 24); y += 60;
    ctx.fillStyle = "#99998e"; ctx.font = "13px Arial"; ctx.fillText(`Сформировано ${date}  ·  ДЕНЬГИ НА ВЕТЕР © 2026`, width / 2, height - 70);
    const link = document.createElement("a"); link.download = "chek-puteshestvennika.png"; link.href = canvas.toDataURL("image/png"); link.click();
    showToast("Чек в PNG готов. Пусть останется на память!");
  }

  function resetAll() {
    if (!window.confirm("Сбросить всё приключение? Введённые данные и позиции расходов исчезнут.")) return;
    $("#people").value = "2"; $("#days").value = "7"; $("#nights").value = "6";
    $("#trip-name").value = "";
    for (const { key } of categories) state[key] = { mode: "quick", quick: "", items: [] };
    lastCalculation = null; clearErrors(); renderAllCategories();
    $("#total").innerHTML = `0,00 <span>€</span>`; $("#per-person").textContent = "0,00 €"; $("#per-day").textContent = "0,00 €"; $("#chart-total").textContent = "0,00 €";
    $("#trip-summary").textContent = "Укажи параметры нового путешествия";
    $("#donut").style.background = "conic-gradient(#e9e5dc 0% 100%)"; $(".chart-note").textContent = "доли от общего"; $("#legend").innerHTML = categories.map(category => `<li><span class="legend-dot" style="--cat:${category.color}"></span><span>${category.technical}</span><b>0,00%</b></li>`).join("");
    $("#game-message").hidden = true; $("#export-actions").hidden = true; $("#results").classList.remove("results-updated");
    document.querySelectorAll("[data-total]").forEach(node => node.textContent = "0,00 €");
    showToast("Чистый лист! Куда отправимся теперь?");
  }

  form.addEventListener("click", event => {
    const modeButton = event.target.closest(".mode-btn");
    if (modeButton) {
      const card = modeButton.closest(".cost-card"), key = card.dataset.category;
      state[key].mode = modeButton.dataset.mode;
      renderCategory(key); calculate();
    }
  });
  form.addEventListener("input", event => {
    const quickInput = event.target.closest("[data-quick]");
    if (quickInput) { state[quickInput.dataset.quick].quick = quickInput.value; renderCategory(quickInput.dataset.quick); calculate(); }
    if (["people", "days", "nights"].includes(event.target.id)) { event.target.removeAttribute("aria-invalid"); if (event.target.value.trim() !== "") calculate(); }
  });


  form.addEventListener("submit", event => {
    const addForm = event.target.closest(".add-item-form");
    if (!addForm) { calculate(event); return; }
    event.preventDefault();
    const key = addForm.dataset.add, nameInput = addForm.querySelector('input[type="text"]'), amountInput = addForm.querySelector('input[type="number"]');
    const name = nameInput.value.trim(), rawAmount = amountInput.value.trim(), amount = Number(rawAmount);
    if (!name) { showToast("Дай расходу имя — хотя бы короткое!"); nameInput.focus(); return; }
    if (!rawAmount || !Number.isFinite(amount) || Math.abs(amount) > 1e12) { showToast("Проверь сумму: нужно корректное число в евро."); amountInput.focus(); return; }
    state[key].items.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, amount });
    addForm.reset(); renderCategory(key); calculate();
  });
  form.addEventListener("change", event => {
    const row = event.target.closest(".expense-item"); if (!row) return;
    const card = row.closest(".cost-card"), key = card.dataset.category, item = state[key].items.find(entry => entry.id === row.dataset.itemId);
    if (!item) return;
    if (event.target.classList.contains("item-name")) { const value = event.target.value.trim(); if (value) item.name = value; else { event.target.value = item.name; showToast("Название не должно быть пустым."); } }
    if (event.target.classList.contains("item-amount")) {
      const value = event.target.value.trim() === "" ? NaN : Number(event.target.value);
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) { event.target.value = item.amount; showToast("Сумма должна быть числом. Возвраты можно вводить со знаком минус."); return; }
      item.amount = value;
    }
    renderCategory(key); calculate();
  });
  form.addEventListener("click", event => {
    const deleteButton = event.target.closest(".delete-item"); if (!deleteButton) return;
    const row = deleteButton.closest(".expense-item"), key = row.closest(".cost-card").dataset.category;
    state[key].items = state[key].items.filter(item => item.id !== row.dataset.itemId);
    renderCategory(key); calculate();
  });

  $("#calculate-button").addEventListener("click", calculate);
  $("#reset-button").addEventListener("click", resetAll);
  $("#pdf-button").addEventListener("click", exportPDF);
  $("#png-button").addEventListener("click", exportPNG);
  renderAllCategories();
  $("#legend").innerHTML = categories.map(category => `<li><span class="legend-dot" style="--cat:${category.color}"></span><span>${category.technical}</span><b>0,00%</b></li>`).join("");
})();
