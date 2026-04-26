const STORAGE_KEY = "followUpAppLocalLeadsV1";

const state = {
  leads: [],
  currentView: "todayView",
  selectedLeadId: null
};

const statuses = [
  "New",
  "Contacted",
  "Follow-Up Needed",
  "Appointment Set",
  "Closed",
  "Dead"
];

const $ = (id) => document.getElementById(id);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${month}/${day}/${year}`;
}

function isDue(lead) {
  return lead.followUpDate <= todayISO() && lead.status !== "Closed" && lead.status !== "Dead";
}

function isOverdue(lead) {
  return lead.followUpDate < todayISO() && lead.status !== "Closed" && lead.status !== "Dead";
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function saveLeads() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.leads));
}

function loadLeads() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.leads = [
      {
        id: generateId(),
        name: "Sample Seller",
        phone: "5551234567",
        email: "seller@example.com",
        propertyAddress: "123 Main St, Atlanta, GA",
        status: "Follow-Up Needed",
        followUpDate: todayISO(),
        notes: "This is a sample lead. Delete it after testing.",
        lastCompletedFollowUp: ""
      }
    ];
    saveLeads();
    return;
  }

  try {
    state.leads = JSON.parse(raw);
  } catch {
    state.leads = [];
  }
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  $(viewId).classList.add("active");
  state.currentView = viewId;

  $("todayTab").classList.toggle("active", viewId === "todayView");
  $("leadsTab").classList.toggle("active", viewId === "leadsView");

  render();
}

function render() {
  $("todayText").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });

  renderToday();
  renderLeadList();

  if (state.selectedLeadId) {
    renderDetail(state.selectedLeadId);
  }
}

function leadCardHTML(lead) {
  const dueClass = isOverdue(lead) ? "overdue" : isDue(lead) ? "due-today" : "";
  const dueLabel = isOverdue(lead) ? "Overdue" : isDue(lead) ? "Due Today" : formatDate(lead.followUpDate);

  return `
    <div class="card lead-card" data-id="${lead.id}">
      <div class="lead-title-row">
        <div class="lead-name">${escapeHTML(lead.name || "Unnamed Lead")}</div>
        <span class="${dueClass}">${dueLabel}</span>
      </div>
      <div class="lead-address">${escapeHTML(lead.propertyAddress || "No address entered")}</div>
      <div class="meta-row">
        <span class="status-pill">${escapeHTML(lead.status)}</span>
        <span>${formatDate(lead.followUpDate)}</span>
      </div>
    </div>
  `;
}

function renderToday() {
  const dueLeads = state.leads
    .filter(isDue)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  $("dueCount").textContent = dueLeads.length;

  $("todayList").innerHTML = dueLeads.length
    ? dueLeads.map(leadCardHTML).join("")
    : `<div class="card empty">No follow-ups due. Add a lead or use Test Follow-Up Now.</div>`;

  attachLeadCardClicks("todayList");
}

function renderLeadList() {
  const search = $("searchInput").value.trim().toLowerCase();
  const statusFilter = $("statusFilter").value;

  const filtered = state.leads
    .filter(lead => {
      const haystack = [
        lead.name,
        lead.phone,
        lead.email,
        lead.propertyAddress,
        lead.status,
        lead.notes
      ].join(" ").toLowerCase();

      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = !statusFilter || lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  $("leadList").innerHTML = filtered.length
    ? filtered.map(leadCardHTML).join("")
    : `<div class="card empty">No leads found.</div>`;

  attachLeadCardClicks("leadList");
}

function attachLeadCardClicks(containerId) {
  document.querySelectorAll(`#${containerId} .lead-card`).forEach(card => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
  });
}

function openDetail(id) {
  state.selectedLeadId = id;
  renderDetail(id);
  showView("detailView");
}

function renderDetail(id) {
  const lead = state.leads.find(item => item.id === id);
  if (!lead) return;

  $("detailName").textContent = lead.name || "Lead Detail";

  const cleanPhone = (lead.phone || "").replace(/\D/g, "");
  const callLink = cleanPhone ? `tel:${cleanPhone}` : "#";
  const smsLink = cleanPhone ? `sms:${cleanPhone}` : "#";
  const emailLink = lead.email ? `mailto:${lead.email}` : "#";

  $("detailCard").innerHTML = `
    <div class="detail-field">
      <div class="detail-label">Address</div>
      <div class="detail-value">${escapeHTML(lead.propertyAddress || "Not entered")}</div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Phone</div>
      <div class="detail-value">${escapeHTML(lead.phone || "Not entered")}</div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Email</div>
      <div class="detail-value">${escapeHTML(lead.email || "Not entered")}</div>
    </div>

    <div class="action-grid">
      <a href="${callLink}">Call</a>
      <a href="${smsLink}">Text</a>
      <a href="${emailLink}">Email</a>
    </div>

    <div class="detail-field">
      <div class="detail-label">Status</div>
      <div class="detail-value">${escapeHTML(lead.status)}</div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Follow-Up Date</div>
      <div class="detail-value">${formatDate(lead.followUpDate)}</div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Last Completed</div>
      <div class="detail-value">${lead.lastCompletedFollowUp ? formatDate(lead.lastCompletedFollowUp) : "No completed follow-up yet"}</div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Notes</div>
      <div class="detail-value">${escapeHTML(lead.notes || "No notes yet")}</div>
    </div>

    <div class="detail-actions">
      <button class="complete-btn" onclick="markComplete('${lead.id}')">Mark Complete + Tomorrow</button>
      <button class="warning-btn" onclick="testFollowUpNow('${lead.id}')">Test Follow-Up Now</button>
      <button class="edit-btn" onclick="editLead('${lead.id}')">Edit Lead</button>
      <button class="delete-btn" onclick="deleteLead('${lead.id}')">Delete Lead</button>
    </div>
  `;
}

function openAddForm() {
  $("formTitle").textContent = "Add Lead";
  $("leadForm").reset();
  $("leadId").value = "";
  $("followUpDate").value = todayISO();
  $("status").value = "New";
  showView("formView");
}

function editLead(id) {
  const lead = state.leads.find(item => item.id === id);
  if (!lead) return;

  $("formTitle").textContent = "Edit Lead";
  $("leadId").value = lead.id;
  $("name").value = lead.name || "";
  $("phone").value = lead.phone || "";
  $("email").value = lead.email || "";
  $("propertyAddress").value = lead.propertyAddress || "";
  $("status").value = lead.status || "New";
  $("followUpDate").value = lead.followUpDate || todayISO();
  $("notes").value = lead.notes || "";

  showView("formView");
}

function saveForm(event) {
  event.preventDefault();

  const id = $("leadId").value || generateId();

  const lead = {
    id,
    name: $("name").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    propertyAddress: $("propertyAddress").value.trim(),
    status: $("status").value,
    followUpDate: $("followUpDate").value || todayISO(),
    notes: $("notes").value.trim(),
    lastCompletedFollowUp: ""
  };

  const existingIndex = state.leads.findIndex(item => item.id === id);

  if (existingIndex >= 0) {
    lead.lastCompletedFollowUp = state.leads[existingIndex].lastCompletedFollowUp || "";
    state.leads[existingIndex] = lead;
  } else {
    state.leads.push(lead);
  }

  saveLeads();
  state.selectedLeadId = id;
  showView("detailView");
}

function markComplete(id) {
  const lead = state.leads.find(item => item.id === id);
  if (!lead) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  lead.lastCompletedFollowUp = todayISO();
  lead.followUpDate = tomorrow.toISOString().slice(0, 10);
  lead.status = "Contacted";

  saveLeads();
  renderDetail(id);
  render();
}

function testFollowUpNow(id) {
  const lead = state.leads.find(item => item.id === id);
  if (!lead) return;

  lead.followUpDate = todayISO();
  lead.status = "Follow-Up Needed";

  saveLeads();
  renderDetail(id);
  render();
  alert("Test follow-up triggered. This lead is now due today.");
}

function deleteLead(id) {
  if (!confirm("Delete this lead?")) return;

  state.leads = state.leads.filter(item => item.id !== id);
  saveLeads();
  state.selectedLeadId = null;
  showView("leadsView");
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wireEvents() {
  $("todayTab").addEventListener("click", () => showView("todayView"));
  $("leadsTab").addEventListener("click", () => showView("leadsView"));
  $("addLeadBottomBtn").addEventListener("click", openAddForm);
  $("addLeadTopBtn").addEventListener("click", openAddForm);
  $("cancelFormBtn").addEventListener("click", () => showView("leadsView"));
  $("backToLeadsBtn").addEventListener("click", () => showView("leadsView"));
  $("leadForm").addEventListener("submit", saveForm);
  $("searchInput").addEventListener("input", renderLeadList);
  $("statusFilter").addEventListener("change", renderLeadList);
}

loadLeads();
wireEvents();
$("followUpDate").value = todayISO();
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
