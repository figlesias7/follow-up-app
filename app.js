const SUPABASE_URL = "https://bkmrcmwmupnfcjequjlm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbXJjbXdtdXBuZmNqZXF1amxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzc0NjIsImV4cCI6MjA5Mjc1MzQ2Mn0.3T4cc9b-fgyQvpACHof_v03cV7hNM2BwlIOBp3gnnDY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const state = { leads: [], currentView: "todayView", selectedLeadId: null };
const $ = (id) => document.getElementById(id);

function todayISO(){ return new Date().toISOString().slice(0,10); }
function formatDate(d){ if(!d)return ""; const [y,m,day]=d.split("-"); return `${m}/${day}/${y}`; }
function isDue(l){ return l.followUpDate <= todayISO() && l.status !== "Closed" && l.status !== "Dead"; }
function isOverdue(l){ return l.followUpDate < todayISO() && l.status !== "Closed" && l.status !== "Dead"; }
function generateId(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

function dbToLead(row){
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    propertyAddress: row.property_address || "",
    status: row.status || "New",
    followUpDate: row.follow_up_date || todayISO(),
    notes: row.notes || "",
    lastCompletedFollowUp: row.last_completed_follow_up || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function leadToDB(lead){
  return {
    id: lead.id,
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    property_address: lead.propertyAddress || "",
    status: lead.status || "New",
    follow_up_date: lead.followUpDate || todayISO(),
    notes: lead.notes || "",
    last_completed_follow_up: lead.lastCompletedFollowUp || null,
    updated_at: new Date().toISOString()
  };
}

async function loadLeads(){
  const { data, error } = await supabase.from("leads").select("*").order("follow_up_date", { ascending: true });
  if(error){ console.error("Load error:", error); alert("Could not load leads from Supabase. " + error.message); return; }
  state.leads = (data || []).map(dbToLead);
  render();
}

async function saveLeadToDB(lead){
  const { error } = await supabase.from("leads").upsert(leadToDB(lead));
  if(error){ console.error("Save error:", error); alert("Could not save lead to Supabase. " + error.message); return false; }
  return true;
}

async function deleteLeadFromDB(id){
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if(error){ console.error("Delete error:", error); alert("Could not delete lead from Supabase. " + error.message); return false; }
  return true;
}

function showView(viewId){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const view = $(viewId);
  if(!view){ alert("Missing view: " + viewId); return; }
  view.classList.add("active");
  state.currentView = viewId;
  $("todayTab").classList.toggle("active", viewId === "todayView");
  $("leadsTab").classList.toggle("active", viewId === "leadsView");
  $("toolsTab").classList.toggle("active", viewId === "toolsView");
  render();
}

function render(){
  $("todayText").textContent = new Date().toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
  renderToday();
  renderLeadList();
  if(state.selectedLeadId && state.currentView === "detailView"){ renderDetail(state.selectedLeadId); }
}

function escapeHTML(value){
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function leadCardHTML(lead){
  const dueClass = isOverdue(lead) ? "overdue" : isDue(lead) ? "due-today" : "";
  const dueLabel = isOverdue(lead) ? "Overdue" : isDue(lead) ? "Due Today" : formatDate(lead.followUpDate);
  return `<div class="card lead-card" data-id="${lead.id}">
    <div class="lead-title-row"><div class="lead-name">${escapeHTML(lead.name || "Unnamed Lead")}</div><span class="${dueClass}">${dueLabel}</span></div>
    <div class="lead-address">${escapeHTML(lead.propertyAddress || "No address entered")}</div>
    <div class="meta-row"><span class="status-pill">${escapeHTML(lead.status)}</span><span>${formatDate(lead.followUpDate)}</span></div>
  </div>`;
}

function attachLeadCardClicks(containerId){
  document.querySelectorAll(`#${containerId} .lead-card`).forEach(card => card.addEventListener("click", () => openDetail(card.dataset.id)));
}

function renderToday(){
  const dueLeads = state.leads.filter(isDue).sort((a,b) => a.followUpDate.localeCompare(b.followUpDate));
  $("dueCount").textContent = dueLeads.length;
  $("todayList").innerHTML = dueLeads.length ? dueLeads.map(leadCardHTML).join("") : `<div class="card empty">No follow-ups due. Add a lead or use Test Follow-Up Now.</div>`;
  attachLeadCardClicks("todayList");
}

function renderLeadList(){
  const search = $("searchInput").value.trim().toLowerCase();
  const statusFilter = $("statusFilter").value;
  const filtered = state.leads.filter(lead => {
    const haystack = [lead.name, lead.phone, lead.email, lead.propertyAddress, lead.status, lead.notes].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) && (!statusFilter || lead.status === statusFilter);
  }).sort((a,b) => a.followUpDate.localeCompare(b.followUpDate));
  $("leadList").innerHTML = filtered.length ? filtered.map(leadCardHTML).join("") : `<div class="card empty">No leads found.</div>`;
  attachLeadCardClicks("leadList");
}

function openDetail(id){
  state.selectedLeadId = id;
  renderDetail(id);
  showView("detailView");
}

function renderDetail(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;
  $("detailName").textContent = lead.name || "Lead Detail";
  const cleanPhone = (lead.phone || "").replace(/\D/g, "");
  const callLink = cleanPhone ? `tel:${cleanPhone}` : "#";
  const smsLink = cleanPhone ? `sms:${cleanPhone}` : "#";
  const emailLink = lead.email ? `mailto:${lead.email}` : "#";
  $("detailCard").innerHTML = `
    <div class="detail-field"><div class="detail-label">Address</div><div class="detail-value">${escapeHTML(lead.propertyAddress || "Not entered")}</div></div>
    <div class="detail-field"><div class="detail-label">Phone</div><div class="detail-value">${escapeHTML(lead.phone || "Not entered")}</div></div>
    <div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${escapeHTML(lead.email || "Not entered")}</div></div>
    <div class="action-grid"><a href="${callLink}">Call</a><a href="${smsLink}">Text</a><a href="${emailLink}">Email</a></div>
    <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${escapeHTML(lead.status)}</div></div>
    <div class="detail-field"><div class="detail-label">Follow-Up Date</div><div class="detail-value">${formatDate(lead.followUpDate)}</div></div>
    <div class="detail-field"><div class="detail-label">Last Completed</div><div class="detail-value">${lead.lastCompletedFollowUp ? formatDate(lead.lastCompletedFollowUp) : "No completed follow-up yet"}</div></div>
    <div class="detail-field"><div class="detail-label">Notes</div><div class="detail-value">${escapeHTML(lead.notes || "No notes yet")}</div></div>
    <div class="detail-actions">
      <button class="complete-btn" onclick="markComplete('${lead.id}')" type="button">Mark Complete + Tomorrow</button>
      <button class="warning-btn" onclick="testFollowUpNow('${lead.id}')" type="button">Test Follow-Up Now</button>
      <button class="edit-btn" onclick="editLead('${lead.id}')" type="button">Edit Lead</button>
      <button class="delete-btn" onclick="deleteLead('${lead.id}')" type="button">Delete Lead</button>
    </div>`;
}

function openAddForm(){
  $("formTitle").textContent = "Add Lead";
  $("leadForm").reset();
  $("leadId").value = "";
  $("followUpDate").value = todayISO();
  $("status").value = "New";
  showView("formView");
}

function editLead(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;
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

async function saveForm(event){
  event.preventDefault();
  const id = $("leadId").value || generateId();
  const existingIndex = state.leads.findIndex(item => item.id === id);
  const oldLead = existingIndex >= 0 ? state.leads[existingIndex] : null;
  const lead = {
    id,
    name: $("name").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    propertyAddress: $("propertyAddress").value.trim(),
    status: $("status").value,
    followUpDate: $("followUpDate").value || todayISO(),
    notes: $("notes").value.trim(),
    lastCompletedFollowUp: oldLead?.lastCompletedFollowUp || "",
    createdAt: oldLead?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const saved = await saveLeadToDB(lead);
  if(!saved) return;
  await loadLeads();
  state.selectedLeadId = id;
  showView("detailView");
}

async function markComplete(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  lead.lastCompletedFollowUp = todayISO();
  lead.followUpDate = tomorrow.toISOString().slice(0, 10);
  lead.status = "Contacted";
  lead.updatedAt = new Date().toISOString();
  const saved = await saveLeadToDB(lead);
  if(!saved) return;
  await loadLeads();
  state.selectedLeadId = id;
  showView("detailView");
}

async function testFollowUpNow(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;
  lead.followUpDate = todayISO();
  lead.status = "Follow-Up Needed";
  lead.updatedAt = new Date().toISOString();
  const saved = await saveLeadToDB(lead);
  if(!saved) return;
  await loadLeads();
  state.selectedLeadId = id;
  showView("detailView");
  alert("Test follow-up triggered. This lead is now due today.");
}

async function deleteLead(id){
  if(!confirm("Delete this lead?")) return;
  const deleted = await deleteLeadFromDB(id);
  if(!deleted) return;
  state.leads = state.leads.filter(item => item.id !== id);
  state.selectedLeadId = null;
  showView("leadsView");
}

function csvEscape(value){
  const str = String(value ?? "");
  return /[",\n\r]/.test(str) ? `"${str.replaceAll('"','""')}"` : str;
}

function exportCSV(){
  const headers = ["id","name","phone","email","propertyAddress","status","followUpDate","lastCompletedFollowUp","createdAt","updatedAt","notes"];
  const rows = state.leads.map(lead => headers.map(header => csvEscape(lead[header])).join(","));
  downloadTextFile([headers.join(","), ...rows].join("\n"), `follow-up-leads-${todayISO()}.csv`, "text/csv");
}

function exportJSON(){
  const payload = { app:"Follow Up App", version:"supabase-v2", exportedAt:new Date().toISOString(), leads:state.leads };
  downloadTextFile(JSON.stringify(payload, null, 2), `follow-up-backup-${todayISO()}.json`, "application/json");
}

function downloadTextFile(content, filename, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCSV(text){
  const rows = [];
  let current = [], field = "", inQuotes = false;
  for(let i=0; i<text.length; i++){
    const char = text[i], next = text[i+1];
    if(char === '"' && inQuotes && next === '"'){ field += '"'; i++; }
    else if(char === '"'){ inQuotes = !inQuotes; }
    else if(char === "," && !inQuotes){ current.push(field); field = ""; }
    else if((char === "\n" || char === "\r") && !inQuotes){
      if(char === "\r" && next === "\n") i++;
      current.push(field); rows.push(current); current = []; field = "";
    } else { field += char; }
  }
  current.push(field); rows.push(current);
  return rows.filter(row => row.some(cell => cell.trim() !== ""));
}

async function importFile(){
  const file = $("importFileInput").files[0];
  if(!file){ alert("Choose a CSV or JSON backup first."); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      let importedLeads = [];
      if(file.name.toLowerCase().endsWith(".json")){
        const parsed = JSON.parse(reader.result);
        importedLeads = Array.isArray(parsed) ? parsed : parsed.leads || [];
      } else {
        const rows = parseCSV(reader.result);
        const headers = rows.shift().map(header => header.trim());
        importedLeads = rows.map(row => {
          const item = {};
          headers.forEach((header, index) => { item[header] = row[index] || ""; });
          return item;
        });
      }
      const normalized = importedLeads.map(lead => ({
        id: lead.id || generateId(),
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        propertyAddress: lead.propertyAddress || lead.property_address || "",
        status: lead.status || "New",
        followUpDate: lead.followUpDate || lead.follow_up_date || todayISO(),
        notes: lead.notes || "",
        lastCompletedFollowUp: lead.lastCompletedFollowUp || lead.last_completed_follow_up || "",
        createdAt: lead.createdAt || lead.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      for(const lead of normalized){
        const saved = await saveLeadToDB(lead);
        if(!saved) return;
      }
      await loadLeads();
      alert(`Import complete. Imported ${normalized.length} lead(s).`);
      showView("leadsView");
    } catch(error){
      console.error(error);
      alert("Import failed. Make sure the file is a valid backup CSV or JSON.");
    }
  };
  reader.readAsText(file);
}

async function clearAllLeads(){
  if(!confirm("This deletes every lead from the shared Supabase database. Export a backup first. Continue?")) return;
  const { error } = await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if(error){ console.error("Clear error:", error); alert("Could not clear leads from Supabase. " + error.message); return; }
  state.leads = [];
  state.selectedLeadId = null;
  render();
  showView("todayView");
}

function wireEvents(){
  const requiredIds = ["todayTab","leadsTab","toolsTab","addLeadBottomBtn","addLeadTopBtn","cancelFormBtn","backToLeadsBtn","leadForm","searchInput","statusFilter","exportCsvBtn","exportJsonBtn","importBtn","clearAllBtn","refreshBtn"];
  const missing = requiredIds.filter(id => !$(id));
  if(missing.length){ alert("Your index.html is not the matching version. Missing: " + missing.join(", ")); return; }

  $("todayTab").addEventListener("click", () => showView("todayView"));
  $("leadsTab").addEventListener("click", () => showView("leadsView"));
  $("toolsTab").addEventListener("click", () => showView("toolsView"));
  $("addLeadBottomBtn").addEventListener("click", openAddForm);
  $("addLeadTopBtn").addEventListener("click", openAddForm);
  $("cancelFormBtn").addEventListener("click", () => showView("leadsView"));
  $("backToLeadsBtn").addEventListener("click", () => showView("leadsView"));
  $("leadForm").addEventListener("submit", saveForm);
  $("searchInput").addEventListener("input", renderLeadList);
  $("statusFilter").addEventListener("change", renderLeadList);
  $("exportCsvBtn").addEventListener("click", exportCSV);
  $("exportJsonBtn").addEventListener("click", exportJSON);
  $("importBtn").addEventListener("click", importFile);
  $("clearAllBtn").addEventListener("click", clearAllLeads);
  $("refreshBtn").addEventListener("click", loadLeads);
}

wireEvents();
$("followUpDate").value = todayISO();
loadLeads();

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
