const byId = (id) => document.getElementById(id);
const MANUAL_WANTED_STORAGE_KEY = "agc_manual_wanted_rows";
const CHEMICAL_LIBRARY = [
  { name: "Acetone", formula: "C3H6O" },
  { name: "Ethanol", formula: "C2H6O" },
  { name: "Methanol", formula: "CH4O" },
  { name: "Isopropyl Alcohol", formula: "C3H8O" },
  { name: "Hydrochloric Acid", formula: "HCl" },
  { name: "Sulfuric Acid", formula: "H2SO4" },
  { name: "Nitric Acid", formula: "HNO3" },
  { name: "Sodium Hydroxide", formula: "NaOH" },
  { name: "Potassium Hydroxide", formula: "KOH" },
  { name: "Sodium Chloride", formula: "NaCl" },
  { name: "Potassium Chloride", formula: "KCl" },
  { name: "Ammonia", formula: "NH3" },
  { name: "Hydrogen Peroxide", formula: "H2O2" },
  { name: "Glucose", formula: "C6H12O6" },
  { name: "Acetic Acid", formula: "C2H4O2" }
];

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showModal(id) {
  byId(id).classList.remove("hidden");
}

function hideModal(id) {
  byId(id).classList.add("hidden");
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("agc_user") || "null");
  } catch (_) {
    return null;
  }
}

function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getManualWantedRows() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MANUAL_WANTED_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        date: String(r.date || "").slice(0, 10),
        chemical: String(r.chemical || "").trim(),
        quantity: String(r.quantity || "").trim(),
        price: String(r.price || "").trim(),
        signature: String(r.signature || "").trim()
      }))
      .filter((r) => r.chemical);
  } catch (_) {
    return [];
  }
}

function saveManualWantedRows(rows) {
  localStorage.setItem(MANUAL_WANTED_STORAGE_KEY, JSON.stringify(rows));
}

async function handleLogin(event) {
  if (event) event.preventDefault();
  const payload = {
    email: byId("loginEmail").value.trim(),
    password: byId("loginPass").value.trim()
  };
  try {
    const result = await api("/api/login", { method: "POST", body: JSON.stringify(payload) });
    localStorage.setItem("agc_user", JSON.stringify(result.user));
    window.location.href = "/inventory";
  } catch (error) {
    alert(error.message);
  }
}

function renderCard(c) {
  const percent = c.max_quantity > 0 ? Math.min(100, Math.round((Number(c.quantity) / Number(c.max_quantity)) * 100)) : 0;
  const low = Number(c.quantity) <= Number(c.low_stock_quantity);

  return `
    <article class="chem-card ${low ? "low" : ""}">
      ${low ? '<span class="low-badge" title="Low stock">!</span>' : ""}
      <div class="jar-wrap">
        <div class="jar">
          <div class="liquid" style="height:${percent}%"></div>
        </div>
        <span class="jar-label">${percent}%</span>
      </div>
      <h3>${c.name}</h3>
      <p><strong>Formula:</strong> ${c.formula || "-"}</p>
      <p><strong>Qty:</strong> ${c.quantity} / ${c.max_quantity} ${c.unit || ""}</p>
      <p><strong>Category:</strong> ${c.category || "-"}</p>
      <p><strong>Hazard:</strong> ${c.hazard_info}</p>
      <p><strong>Room:</strong> ${c.room_no}</p>
      <div class="card-actions">
        <button class="btn danger" data-tx="use" data-id="${c.id}" data-name="${c.name}">- Use</button>
        <button class="btn success" data-tx="refill" data-id="${c.id}" data-name="${c.name}">+ Refill</button>
      </div>
      <div class="card-actions secondary">
        <button class="btn" data-edit="${c.id}">Edit</button>
        <button class="btn" data-delete="${c.id}">Delete</button>
      </div>
    </article>
  `;
}

let chemicalCache = [];
let lowStockOnly = false;
let searchTerm = "";
let logsCache = [];
let stockChemicals = [];
let stockRefillsByChemical = new Map();

function applyInventoryFilters() {
  const grid = byId("inventoryGrid");
  if (!grid) return;
  const term = searchTerm.toLowerCase().trim();
  const filtered = chemicalCache.filter((c) => {
    const isLow = Number(c.quantity) <= Number(c.low_stock_quantity);
    if (lowStockOnly && !isLow) return false;
    if (!term) return true;
    const haystack = `${c.name} ${c.formula || ""} ${c.category || ""} ${c.room_no || ""}`.toLowerCase();
    return haystack.includes(term);
  });
  grid.innerHTML = filtered.map(renderCard).join("");
}

async function loadInventory() {
  const grid = byId("inventoryGrid");
  if (!grid) return;

  try {
    const chemicals = await api("/api/chemicals");
    chemicalCache = chemicals;
    applyInventoryFilters();

    const low = chemicals.filter((c) => Number(c.quantity) <= Number(c.low_stock_quantity));
    const badge = byId("lowStockBadge");
    const badgeCount = byId("lowStockCount");
    if (low.length) {
      if (badge) badge.classList.remove("hidden");
      if (badgeCount) badgeCount.textContent = String(low.length);
    } else {
      if (badge) badge.classList.add("hidden");
      if (badgeCount) badgeCount.textContent = "0";
    }
  } catch (error) {
    grid.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

function openChemicalModal(editId = null) {
  const title = byId("chemicalModalTitle");
  const form = byId("chemicalForm");
  form.reset();
  byId("chemicalId").value = "";

  if (editId) {
    const c = chemicalCache.find((x) => x.id === Number(editId));
    if (!c) return;
    title.textContent = "Edit Chemical";
    byId("chemicalId").value = c.id;
    byId("name").value = c.name;
    byId("formula").value = c.formula || "";
    byId("quantity").value = c.quantity;
    byId("max_quantity").value = c.max_quantity;
    byId("low_stock_quantity").value = c.low_stock_quantity;
    byId("category").value = c.category || "";
    byId("unit").value = c.unit || "";
    byId("hazard_info").value = c.hazard_info;
    byId("room_no").value = c.room_no;
    byId("expiry_date").value = c.expiry_date ? String(c.expiry_date).slice(0, 10) : "";
  } else {
    title.textContent = "Add Chemical";
  }

  showModal("chemicalModal");
}

async function submitChemical(event) {
  event.preventDefault();
  const id = byId("chemicalId").value;

  const payload = {
    name: byId("name").value.trim(),
    formula: byId("formula").value.trim(),
    category: byId("category").value.trim(),
    unit: byId("unit").value.trim(),
    quantity: Number(byId("quantity").value),
    max_quantity: Number(byId("max_quantity").value),
    low_stock_quantity: Number(byId("low_stock_quantity").value),
    hazard_info: byId("hazard_info").value,
    room_no: byId("room_no").value.trim(),
    expiry_date: byId("expiry_date").value || null
  };

  try {
    if (id) {
      await api(`/api/chemicals/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/chemicals", { method: "POST", body: JSON.stringify(payload) });
    }
    hideModal("chemicalModal");
    await loadInventory();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteChemical(id) {
  const ok = confirm("Delete this chemical?");
  if (!ok) return;
  try {
    await api(`/api/chemicals/${id}`, { method: "DELETE" });
    await loadInventory();
  } catch (error) {
    alert(error.message);
  }
}

function openTxModal(action, id, name) {
  byId("txForm").reset();
  byId("txChemicalId").value = id;
  byId("txAction").value = action;
  byId("txTitle").textContent = `${action === "use" ? "Use" : "Refill"} - ${name}`;
  const txAmountLabel = byId("txAmountLabel");
  const chemical = chemicalCache.find((item) => item.id === Number(id));
  const unitLabel = chemical && chemical.unit ? String(chemical.unit).trim() : "";
  if (txAmountLabel) {
    txAmountLabel.textContent = unitLabel ? `Quantity (${unitLabel})` : "Quantity";
  }
  const saved = getStoredUser();
  const txUserInput = byId("txUser");
  if (txUserInput) {
    const userLabel = (saved && (saved.name || saved.email)) || "";
    txUserInput.value = userLabel;
    txUserInput.readOnly = true;
  }
  const purposeInput = byId("txPurpose");
  const classInput = byId("txClass");
  const purposeBlock = byId("txPurposeBlock");
  const classBlock = byId("txClassBlock");
  const requiresContext = action === "use";
  if (purposeInput) purposeInput.required = requiresContext;
  if (classInput) classInput.required = requiresContext;
  if (purposeBlock) purposeBlock.classList.toggle("hidden", !requiresContext);
  if (classBlock) classBlock.classList.toggle("hidden", !requiresContext);
  if (!requiresContext) {
    if (purposeInput) purposeInput.value = "";
    if (classInput) classInput.value = "";
  }
  showModal("txModal");
}

async function submitTransaction(event) {
  event.preventDefault();
  const id = byId("txChemicalId").value;
  const storedUser = getStoredUser();
  const storedLabel = storedUser && (storedUser.name || storedUser.email);
  const payload = {
    action: byId("txAction").value,
    amount: Number(byId("txAmount").value),
    user: (storedLabel || byId("txUser").value).trim(),
    purpose: byId("txPurpose").value.trim(),
    class_name: byId("txClass").value.trim()
  };

  if (payload.action === "use" && (!payload.purpose || !payload.class_name)) {
    alert("Purpose and class are required for usage.");
    return;
  }

  try {
    const result = await api(`/api/chemicals/${id}/transaction`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    hideModal("txModal");
    await loadInventory();
    if (result.isLowStock) alert(`Low stock warning: ${result.chemical.name}`);
  } catch (error) {
    alert(error.message);
  }
}

async function loadLogsReport() {
  const body = byId("logsTableBody");
  if (!body) return;
  try {
    const rows = await api("/api/logs");
    logsCache = rows;
    applyLogsFilters();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="7" class="error">${error.message}</td></tr>`;
  }
}

function applyLogsFilters() {
  const body = byId("logsTableBody");
  if (!body) return;
  const fromValue = byId("filterDateFrom")?.value || "";
  const toValue = byId("filterDateTo")?.value || "";
  const classValue = (byId("filterClass")?.value || "").toLowerCase().trim();
  const userValue = (byId("filterUser")?.value || "").toLowerCase().trim();
  const chemicalValue = (byId("filterChemical")?.value || "").toLowerCase().trim();

  const filtered = logsCache.filter((r) => {
    if (fromValue) {
      const rowDate = String(r.date || "").slice(0, 10);
      if (rowDate < fromValue) return false;
    }
    if (toValue) {
      const rowDate = String(r.date || "").slice(0, 10);
      if (rowDate > toValue) return false;
    }
    if (classValue && !String(r.class_name || "").toLowerCase().includes(classValue)) return false;
    if (userValue && !String(r.user || "").toLowerCase().includes(userValue)) return false;
    if (chemicalValue && !String(r.chemical_name || "").toLowerCase().includes(chemicalValue)) return false;
    return true;
  });

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="7">No records match the filters.</td></tr>`;
    return;
  }

  const totalQty = filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalCount = filtered.length;

  body.innerHTML = filtered
    .map(
      (r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.chemical_name}</td>
        <td>${r.action}</td>
        <td>${r.amount} ${escapeHtml(r.unit || "")}</td>
        <td>${r.user}</td>
        <td>${escapeHtml(r.purpose || "-")}</td>
        <td>${escapeHtml(r.class_name || "-")}</td>
      </tr>`
    )
    .join("") +
    `
      <tr>
        <td colspan="1"></td>
        <td><strong>Total chemicals: ${totalCount}</strong></td>
        <td></td>
        <td><strong>${totalQty.toFixed(2)} ${escapeHtml(filtered[0]?.unit || "")}</strong></td>
        <td colspan="3"></td>
      </tr>
    `;
}

async function loadLowStockReport() {
  const body = byId("lowStockTableBody");
  if (!body) return;
  try {
    const rows = await api("/api/reports/low-stock");
    const manualRows = getManualWantedRows();
    if (!rows.length && !manualRows.length) {
      body.innerHTML = '<tr><td colspan="3">No low stock chemicals.</td></tr>';
      return;
    }
    const autoHtml = rows.map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.chemical)}</td>
        <td>${r.quantity} ${escapeHtml(r.unit || "")}</td>
        <td></td>
      </tr>`
    );
    const manualHtml = manualRows.map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.chemical)} (Manual)</td>
        <td>${escapeHtml(r.quantity)}</td>
        <td>${escapeHtml(r.price)}</td>
      </tr>`
    );
    const allRows = rows.concat(manualRows);
    const totalQty = allRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalCount = allRows.length;
    body.innerHTML =
      autoHtml.concat(manualHtml).join("") +
      `
        <tr>
          <td><strong>Total chemicals: ${totalCount}</strong></td>
          <td><strong>${totalQty.toFixed(2)}</strong></td>
          <td></td>
        </tr>
      `;
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" class="error">${error.message}</td></tr>`;
  }
}

function buildRefillIndex(logs) {
  const index = new Map();
  logs
    .filter((l) => l.action === "refill")
    .forEach((l) => {
      const id = Number(l.chemical_id);
      if (!index.has(id)) index.set(id, []);
      index.get(id).push(l);
    });

  for (const [, list] of index) {
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return index;
}

function findLatestRefillInRange(refills, fromValue, toValue) {
  if (!refills || !refills.length) return null;
  for (const refill of refills) {
    const rowDate = String(refill.date || "").slice(0, 10);
    if (fromValue && rowDate < fromValue) continue;
    if (toValue && rowDate > toValue) continue;
    return refill.date;
  }
  return null;
}

function applyInventoryStockFilters() {
  const body = byId("inventoryStockTableBody");
  if (!body) return;
  const fromValue = byId("stockFromDate")?.value || "";
  const toValue = byId("stockToDate")?.value || "";
  const term = searchTerm.toLowerCase().trim();

  const rows = stockChemicals.map((c) => {
    const refills = stockRefillsByChemical.get(Number(c.id)) || [];
    const lastRefill = findLatestRefillInRange(refills, fromValue, toValue);
    return {
      name: c.name,
      formula: c.formula,
      category: c.category,
      quantity: c.quantity,
      unit: c.unit,
      expiry_date: c.expiry_date,
      room_no: c.room_no,
      lastRefill
    };
  });

  const filtered = rows.filter((r) => {
    if (term) {
      const haystack = `${r.name} ${r.formula || ""} ${r.category || ""} ${r.room_no || ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (!fromValue && !toValue) return true;
    return !!r.lastRefill;
  });

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="5">No records match the filters.</td></tr>`;
    return;
  }

  const totalQty = filtered.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const totalCount = filtered.length;
  const unitHint = filtered.find((r) => r.unit)?.unit || "";

  body.innerHTML = filtered
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.quantity} ${escapeHtml(r.unit || "")}</td>
        <td>${r.lastRefill ? fmtDate(r.lastRefill) : "-"}</td>
        <td>${r.expiry_date ? String(r.expiry_date).slice(0, 10) : "-"}</td>
        <td>${escapeHtml(r.room_no || "-")}</td>
      </tr>`
    )
    .join("") +
    `
      <tr>
        <td><strong>Total chemicals: ${totalCount}</strong></td>
        <td><strong>${totalQty.toFixed(2)} ${escapeHtml(unitHint)}</strong></td>
        <td colspan="3"></td>
      </tr>
    `;
}

async function loadInventoryStockReport() {
  const body = byId("inventoryStockTableBody");
  if (!body) return;
  try {
    const [chemicals, logs] = await Promise.all([api("/api/chemicals"), api("/api/logs")]);
    stockChemicals = chemicals;
    stockRefillsByChemical = buildRefillIndex(logs);
    applyInventoryStockFilters();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" class="error">${error.message}</td></tr>`;
  }
}

function printReportCard(cardId, title) {
  const card = byId(cardId);
  if (!card) return;

  const popup = window.open('', '_blank', 'width=1000,height=800');
  if (!popup) {
    alert('Please allow popups to print the report.');
    return;
  }

  const cardHtml = card.outerHTML;
  const now = new Date();
  const printDate = now.toLocaleString();
  const reportCounterKey = "agc_report_no_counter";
  let reportNo = 1;
  try {
    reportNo = Number(localStorage.getItem(reportCounterKey) || "0") + 1;
    localStorage.setItem(reportCounterKey, String(reportNo));
  } catch (_) {
    reportNo = 1;
  }

  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="/css/style.css" />
  <style>
    body { background: #fff; margin: 24px; }
    .site-nav, .site-footer, .toolbar, .no-print { display: none !important; }
    .print-wrap { border: 1px solid #cbd5e1; padding: 18px; border-radius: 12px; }
    .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
    .print-brand { display: flex; align-items: center; gap: 12px; }
    .print-logo { width: 56px; height: 56px; object-fit: contain; }
    .print-title { margin: 0; font-size: 1.15rem; }
    .print-meta { text-align: right; font-size: 0.9rem; color: #334155; }
    .print-address { font-size: 0.82rem; color: #475569; margin-top: 4px; max-width: 420px; }
    .print-divider { height: 1px; background: #e2e8f0; margin: 10px 0 14px; }
    .print-footer { margin-top: 18px; display: flex; justify-content: flex-end; }
    .signature-box { text-align: right; min-width: 220px; }
    .signature-line { border-bottom: 1px solid #111827; margin: 28px 0 6px; }
  </style>
</head>
<body>
  <main class="page reports-page">
    <section class="print-wrap">
      <div class="print-header">
        <div class="print-brand">
          <img src="/assets/agc-logo.png" alt="AGC LAB.CO logo" class="print-logo" />
          <div>
            <div class="brand">AGC LAB.CO</div>
            <div class="hint">Chemical Inventory Management System</div>
            <div class="print-address">Abasaheb Garware College of Arts and Science, Karve Rd, opp. Sahyadri Hospital, Kripali Society, Erandwane, Pune, Maharashtra 411004</div>
          </div>
        </div>
        <div class="print-meta">
          <div><strong>${title}</strong></div>
          <div>Report No: ${reportNo}</div>
          <div>Print Date: ${printDate}</div>
        </div>
      </div>
      <div class="print-divider"></div>
      ${cardHtml}
      <div class="print-footer">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div>Authorized Signature</div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    popup.print();
    popup.close();
  }, 200);
}

function bindReportPrintEvents() {
  const printLogsBtn = byId('printLogsBtn');
  const printLowStockBtn = byId('printLowStockBtn');
  const printInventoryStockBtn = byId('printInventoryStockBtn');
  const addManualWantedBtn = byId("addManualWantedBtn");
  const clearManualWantedBtn = byId("clearManualWantedBtn");
  if (printLogsBtn) {
    printLogsBtn.addEventListener('click', () => printReportCard('logsReportCard', 'Logs Report'));
  }
  if (printLowStockBtn) {
    printLowStockBtn.addEventListener('click', () => printReportCard('lowStockReportCard', 'Low Stock / Wanted Chemicals Report'));
  }
  if (printInventoryStockBtn) {
    printInventoryStockBtn.addEventListener('click', () => printReportCard('inventoryStockReportCard', 'Inventory Stock Report'));
  }
  if (addManualWantedBtn) {
    addManualWantedBtn.addEventListener("click", async () => {
      await openManualWantedModal();
    });
  }
  if (clearManualWantedBtn) {
    clearManualWantedBtn.addEventListener("click", async () => {
      if (!confirm("Clear all manual wanted items?")) return;
      saveManualWantedRows([]);
      await loadLowStockReport();
    });
  }
}

function bindLogsFilterEvents() {
  const inputs = ["filterDateFrom", "filterDateTo", "filterClass", "filterUser", "filterChemical"]
    .map((id) => byId(id))
    .filter(Boolean);
  inputs.forEach((input) => {
    input.addEventListener("input", applyLogsFilters);
    input.addEventListener("change", applyLogsFilters);
  });
}

function bindInventoryReportFilters() {
  const stockInputs = ["stockFromDate", "stockToDate"]
    .map((id) => byId(id))
    .filter(Boolean);
  stockInputs.forEach((input) => {
    input.addEventListener("input", applyInventoryStockFilters);
    input.addEventListener("change", applyInventoryStockFilters);
  });
}

async function openManualWantedModal() {
  const modal = byId("manualWantedModal");
  const select = byId("manualChemicalSelect");
  const form = byId("manualWantedForm");
  const closeBtn = byId("closeManualWantedModal");
  if (!modal || !select || !form) return;

  try {
    const chemicals = await api("/api/chemicals");
    select.innerHTML = chemicals
      .map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`)
      .join("");
  } catch (_) {
    select.innerHTML = `<option value="Unknown">Unknown</option>`;
  }

  form.reset();
  showModal("manualWantedModal");

  if (closeBtn) {
    closeBtn.onclick = () => hideModal("manualWantedModal");
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    const rows = getManualWantedRows();
    rows.push({
      chemical: select.value,
      quantity: byId("manualQuantity")?.value.trim() || "",
      price: byId("manualPrice")?.value.trim() || "",
      signature: byId("manualSignature")?.value.trim() || ""
    });
    saveManualWantedRows(rows);
    hideModal("manualWantedModal");
    await loadLowStockReport();
  };
}
function bindInventoryEvents() {
  const grid = byId("inventoryGrid");
  if (!grid) return;

  byId("openAddModal").addEventListener("click", () => openChemicalModal());
  byId("closeChemicalModal").addEventListener("click", () => hideModal("chemicalModal"));
  byId("closeTxModal").addEventListener("click", () => hideModal("txModal"));
  byId("chemicalForm").addEventListener("submit", submitChemical);
  byId("txForm").addEventListener("submit", submitTransaction);
  const searchInput = byId("chemSearch");
  const nameInput = byId("name");
  const formulaInput = byId("formula");
  const lowStockBadge = byId("lowStockBadge");
  const lowStockCount = byId("lowStockCount");

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value || "";
      applyInventoryFilters();
      applyInventoryStockFilters();
    });
  }
  if (lowStockBadge) {
    lowStockBadge.addEventListener("click", () => {
      lowStockOnly = !lowStockOnly;
      lowStockBadge.classList.toggle("active", lowStockOnly);
      if (lowStockCount) {
        lowStockBadge.innerHTML = lowStockOnly
          ? "All chemicals"
          : `<span id="lowStockCount">${lowStockCount.textContent || "0"}</span> Low stock`;
      } else {
        lowStockBadge.textContent = lowStockOnly ? "All chemicals" : "Low stock";
      }
      applyInventoryFilters();
    });
  }

  if (nameInput && formulaInput) {
    nameInput.addEventListener("input", () => {
      const match = CHEMICAL_LIBRARY.find(
        (item) => item.name.toLowerCase() === nameInput.value.trim().toLowerCase()
      );
      if (match && !formulaInput.value.trim()) {
        formulaInput.value = match.formula;
      }
    });
  }

  grid.addEventListener("click", (event) => {
    const txBtn = event.target.closest("[data-tx]");
    const editBtn = event.target.closest("[data-edit]");
    const deleteBtn = event.target.closest("[data-delete]");

    if (txBtn) {
      openTxModal(txBtn.dataset.tx, txBtn.dataset.id, txBtn.dataset.name);
      return;
    }
    if (editBtn) {
      openChemicalModal(editBtn.dataset.edit);
      return;
    }
    if (deleteBtn) {
      deleteChemical(deleteBtn.dataset.delete);
    }
  });
}

function init() {
  const loginForm = byId("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
    const openSignup = byId("openSignup");
    const openForgot = byId("openForgot");
    const closeSignupModal = byId("closeSignupModal");
    const closeForgotModal = byId("closeForgotModal");
    const signupForm = byId("signupForm");
    const forgotForm = byId("forgotForm");
    const resetForm = byId("resetForm");

    if (openSignup) openSignup.addEventListener("click", () => showModal("signupModal"));
    if (openForgot) openForgot.addEventListener("click", () => showModal("forgotModal"));
    if (closeSignupModal) closeSignupModal.addEventListener("click", () => hideModal("signupModal"));
    if (closeForgotModal) closeForgotModal.addEventListener("click", () => hideModal("forgotModal"));
    if (signupForm) signupForm.addEventListener("submit", handleSignup);
    if (forgotForm) forgotForm.addEventListener("submit", handleForgotPassword);
    if (resetForm) resetForm.addEventListener("submit", handleResetPassword);
    return;
  }

  if (byId("inventoryGrid")) {
    if (!getStoredUser()) {
      window.location.href = "/";
      return;
    }
    initChemicalLibrary();
    bindInventoryEvents();
    bindReportPrintEvents();
    bindInventoryReportFilters();
    loadInventory();
    loadInventoryStockReport();
    return;
  }

  if (byId("logsTableBody")) {
    if (!getStoredUser()) {
      window.location.href = "/";
      return;
    }
    bindReportPrintEvents();
    bindLogsFilterEvents();
    loadLogsReport();
    loadLowStockReport();
  }
}

window.addEventListener("DOMContentLoaded", init);

function initChemicalLibrary() {
  const list = byId("chemicalNameList");
  if (!list) return;
  list.innerHTML = CHEMICAL_LIBRARY.map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join("");
}

async function handleSignup(event) {
  event.preventDefault();
  const payload = {
    name: byId("signupName").value.trim(),
    email: byId("signupEmail").value.trim(),
    password: byId("signupPass").value.trim()
  };
  try {
    const result = await api("/api/signup", { method: "POST", body: JSON.stringify(payload) });
    localStorage.setItem("agc_user", JSON.stringify(result.user));
    hideModal("signupModal");
    window.location.href = "/inventory";
  } catch (error) {
    alert(error.message);
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const email = byId("forgotEmail").value.trim();
  try {
    const result = await api("/api/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    const codeBox = byId("resetCodeBox");
    const resetForm = byId("resetForm");
    if (result.code) {
      codeBox.textContent = `Reset code: ${result.code}`;
      codeBox.classList.remove("hidden");
    } else {
      codeBox.textContent = "If the email exists, a reset code is available.";
      codeBox.classList.remove("hidden");
    }
    resetForm.classList.remove("hidden");
  } catch (error) {
    alert(error.message);
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  const payload = {
    email: byId("forgotEmail").value.trim(),
    code: byId("resetCode").value.trim(),
    new_password: byId("resetPass").value.trim()
  };
  try {
    await api("/api/reset-password", { method: "POST", body: JSON.stringify(payload) });
    alert("Password updated. You can log in now.");
    hideModal("forgotModal");
  } catch (error) {
    alert(error.message);
  }
}
