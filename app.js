const SUPABASE_URL = "https://bkmrcmwmupnfcjequjlm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbXJjbXdtdXBuZmNqZXF1amxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzc0NjIsImV4cCI6MjA5Mjc1MzQ2Mn0.3T4cc9b-fgyQvpACHof_v03cV7hNM2BwlIOBp3gnnDY";

let supabaseClient = null;
const state = { leads: [], currentView: "todayView", selectedLeadId: null };
const $ = (id) => document.getElementById(id);

const NOTIFICATION_PREF_KEY = "followUpNotificationsEnabled";
const NOTIFICATION_SENT_KEY_PREFIX = "followUpNotificationSent:";

let notificationRegistration = null;

function isNotificationSupported() {
  return "Notification" in window;
}

function notificationsEnabled() {
  return localStorage.getItem(NOTIFICATION_PREF_KEY) === "true" && isNotificationSupported() && Notification.permission === "granted";
}

function updateNotificationStatus() {
  const el = $("notificationStatusText");
  if (!el) return;

  if (!isNotificationSupported()) {
    el.textContent = "Notifications are not supported in this browser.";
    return;
  }

  if (Notification.permission === "granted") {
    el.textContent = "Notifications are enabled on this device.";
  } else if (Notification.permission === "denied") {
    el.textContent = "Notifications are blocked. Change browser or phone settings to allow them.";
  } else {
    el.textContent = "Notifications are not enabled yet.";
  }
}

async function registerNotificationWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    notificationRegistration = await navigator.serviceWorker.register("notification-sw.js?v=6");
    return notificationRegistration;
  } catch (error) {
    console.warn("Notification worker registration failed:", error);
    return null;
  }
}

async function enableNotifications() {
  if (!isNotificationSupported()) {
    alert("Notifications are not supported in this browser.");
    updateNotificationStatus();
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    localStorage.setItem(NOTIFICATION_PREF_KEY, "true");
    await registerNotificationWorker();
    updateNotificationStatus();
    alert("Notifications enabled for this device.");
    checkDueNotifications(true);
  } else {
    localStorage.setItem(NOTIFICATION_PREF_KEY, "false");
    updateNotificationStatus();
    alert("Notifications were not enabled.");
  }
}

async function showFollowUpNotification(title, body) {
  if (!notificationsEnabled()) return;

  try {
    if (notificationRegistration && notificationRegistration.showNotification) {
      await notificationRegistration.showNotification(title, {
        body,
        tag: "follow-up-reminder",
        renotify: true,
        icon: "icon-192.png",
        badge: "icon-192.png"
      });
      return;
    }

    new Notification(title, {
      body,
      tag: "follow-up-reminder"
    });
  } catch (error) {
    console.warn("Notification failed:", error);
  }
}

function notificationSentKey(lead) {
  return `${NOTIFICATION_SENT_KEY_PREFIX}${todayISO()}:${lead.id}`;
}

function wasNotificationSentToday(lead) {
  return localStorage.getItem(notificationSentKey(lead)) === "true";
}

function markNotificationSentToday(lead) {
  localStorage.setItem(notificationSentKey(lead), "true");
}

async function testNotification() {
  if (!notificationsEnabled()) {
    await enableNotifications();
    if (!notificationsEnabled()) return;
  }

  await showFollowUpNotification("Follow Up test", "If you see this, notifications are working on this device.");
}

async function checkDueNotifications(force = false) {
  if (!notificationsEnabled()) {
    updateNotificationStatus();
    return;
  }

  const dueLeads = state.leads.filter(isDue);

  if (!dueLeads.length) {
    if (force) {
      await showFollowUpNotification("No follow-ups due", "You are clear right now.");
    }
    return;
  }

  const unnotified = dueLeads.filter(lead => force || !wasNotificationSentToday(lead));

  if (!unnotified.length) return;

  const first = unnotified[0];
  const extraCount = dueLeads.length - 1;
  const title = dueLeads.length === 1 ? "Follow-up due" : `${dueLeads.length} follow-ups due`;
  const body = `${first.name || "Unnamed Lead"}${extraCount > 0 ? ` and ${extraCount} more` : ""}`;

  await showFollowUpNotification(title, body);

  unnotified.forEach(markNotificationSentToday);
}


const CADENCE_RULES = {
  "Attorney": { days: [0, 14, 30], repeatEvery: 45 },
  "Buyer": { days: [0, 3, 7, 14, 30], repeatEvery: 30 },
  "Contractor": { days: [0, 7, 30], repeatEvery: 45 },
  "Private Lender": { days: [0, 7, 21, 45], repeatEvery: 45 },
  "Realtor": { days: [0, 3, 7, 14, 30], repeatEvery: 30 },
  "Seller Lead": { days: [0, 1, 2, 4, 7, 14, 21, 30], repeatEvery: 30 },
  "Title Company": { days: [0, 14, 30], repeatEvery: 45 },
  "Wholesaler": { days: [0, 7, 14, 30], repeatEvery: 45 }
};

function getCadenceRule(contactType) {
  return CADENCE_RULES[contactType] || CADENCE_RULES["Seller Lead"];
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function getNextFollowUpFromCadence(lead) {
  const contactType = lead.contactType || lead.status || "Seller Lead";
  const rule = getCadenceRule(contactType);
  const currentStep = Number.isFinite(Number(lead.cadenceStep)) ? Number(lead.cadenceStep) : 0;
  const currentCadenceDay = rule.days[Math.min(currentStep, rule.days.length - 1)] || 0;
  const nextStep = currentStep + 1;

  if (nextStep < rule.days.length) {
    const nextCadenceDay = rule.days[nextStep];
    const intervalDays = Math.max(1, nextCadenceDay - currentCadenceDay);
    return {
      followUpDate: addDaysISO(intervalDays),
      cadenceStep: nextStep,
      cadenceLabel: `Next step: day ${nextCadenceDay}`
    };
  }

  return {
    followUpDate: addDaysISO(rule.repeatEvery),
    cadenceStep: nextStep,
    cadenceLabel: `Repeating every ${rule.repeatEvery} days`
  };
}


document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  if (!window.supabase) {
    alert("Supabase library did not load. Check internet connection or CDN access.");
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  wireEvents();
  registerNotificationWorker();
  updateNotificationStatus();
  $("followUpDate").value = todayISO();
  loadLeads();
}

function todayISO(){ return new Date().toISOString().slice(0,10); }
function formatDate(d){ if(!d)return ""; const [y,m,day]=d.split("-"); return `${m}/${day}/${y}`; }
function isDue(l){ return l.followUpDate <= todayISO() && l.status !== "Closed" && l.status !== "Dead"; }
function isOverdue(l){ return l.followUpDate < todayISO() && l.status !== "Closed" && l.status !== "Dead"; }
function generateId(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function escapeHTML(value){ return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function dbToLead(row){
  return { id:row.id, name:row.name||"", phone:row.phone||"", email:row.email||"", propertyAddress:row.property_address||"", contactType:row.contact_type || row.status || "Seller Lead", status:row.contact_type || row.status || "Seller Lead", followUpDate:row.follow_up_date||todayISO(), notes:row.notes||"", lastCompletedFollowUp:row.last_completed_follow_up||"", createdAt:row.created_at||"", updatedAt:row.updated_at||"", cadenceStep:row.cadence_step ?? 0 };
}

function leadToDB(lead){
  return { id:lead.id, name:lead.name||"", phone:lead.phone||"", email:lead.email||"", property_address:lead.propertyAddress||"", contact_type:lead.contactType || lead.status || "Seller Lead", status:lead.contactType || lead.status || "Seller Lead", follow_up_date:lead.followUpDate||todayISO(), notes:lead.notes||"", last_completed_follow_up:lead.lastCompletedFollowUp||null, updated_at:new Date().toISOString(), cadence_step:Number.isFinite(Number(lead.cadenceStep)) ? Number(lead.cadenceStep) : 0 };
}

async function loadLeads(){
  const { data, error } = await supabaseClient.from("leads").select("*").order("follow_up_date", { ascending:true });
  if(error){ alert("Could not load leads: " + error.message); console.error(error); return; }
  state.leads = (data || []).map(dbToLead);
  render();
  checkDueNotifications(false);
}

async function saveLeadToDB(lead){
  const { error } = await supabaseClient.from("leads").upsert(leadToDB(lead));
  if(error){ alert("Could not save lead: " + error.message); console.error(error); return false; }
  return true;
}

async function deleteLeadFromDB(id){
  const { error } = await supabaseClient.from("leads").delete().eq("id", id);
  if(error){ alert("Could not delete lead: " + error.message); console.error(error); return false; }
  return true;
}

function showView(viewId){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $(viewId).classList.add("active");
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
  if(state.selectedLeadId && state.currentView === "detailView") renderDetail(state.selectedLeadId);
}

function leadCardHTML(lead){
  const dueClass = isOverdue(lead) ? "overdue" : isDue(lead) ? "due-today" : "";
  const dueLabel = isOverdue(lead) ? "Overdue" : isDue(lead) ? "Due Today" : formatDate(lead.followUpDate);
  return `<div class="card lead-card" data-id="${lead.id}"><div class="lead-title-row"><div class="lead-name">${escapeHTML(lead.name || "Unnamed Lead")}</div><span class="${dueClass}">${dueLabel}</span></div><div class="lead-address">${escapeHTML(lead.propertyAddress || "No address entered")}</div><div class="meta-row"><span class="status-pill">${escapeHTML(lead.contactType || lead.status)}</span><span>${formatDate(lead.followUpDate)}</span></div></div>`;
}

function renderToday(){
  const dueLeads = state.leads.filter(isDue).sort((a,b)=>a.followUpDate.localeCompare(b.followUpDate));
  $("dueCount").textContent = dueLeads.length;
  $("todayList").innerHTML = dueLeads.length ? dueLeads.map(leadCardHTML).join("") : `<div class="card empty">No follow-ups due. Add a lead or use Test Follow-Up Now.</div>`;
  attachLeadCardClicks("todayList");
}

function renderLeadList(){
  const search = $("searchInput").value.trim().toLowerCase();
  const contactTypeFilter = $("statusFilter").value;
  const filtered = state.leads.filter(lead => {
    const haystack = [lead.name, lead.phone, lead.email, lead.propertyAddress, lead.contactType, lead.status, lead.notes].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) && (!contactTypeFilter || (lead.contactType || lead.status) === contactTypeFilter);
  }).sort((a,b)=>a.followUpDate.localeCompare(b.followUpDate));
  $("leadList").innerHTML = filtered.length ? filtered.map(leadCardHTML).join("") : `<div class="card empty">No leads found.</div>`;
  attachLeadCardClicks("leadList");
}

function attachLeadCardClicks(containerId){
  document.querySelectorAll(`#${containerId} .lead-card`).forEach(card => card.addEventListener("click", () => openDetail(card.dataset.id)));
}

function openDetail(id){ state.selectedLeadId = id; renderDetail(id); showView("detailView"); }

function renderDetail(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;
  $("detailName").textContent = lead.name || "Lead Detail";
  const cleanPhone = (lead.phone || "").replace(/\D/g, "");
  $("detailCard").innerHTML = `<div class="detail-field"><div class="detail-label">Address</div><div class="detail-value">${escapeHTML(lead.propertyAddress || "Not entered")}</div></div><div class="detail-field"><div class="detail-label">Phone</div><div class="detail-value">${escapeHTML(lead.phone || "Not entered")}</div></div><div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${escapeHTML(lead.email || "Not entered")}</div></div><div class="action-grid"><a href="${cleanPhone ? `tel:${cleanPhone}` : "#"}">Call</a><a href="${cleanPhone ? `sms:${cleanPhone}` : "#"}">Text</a><a href="${lead.email ? `mailto:${lead.email}` : "#"}">Email</a></div><div class="detail-field"><div class="detail-label">Contact Type</div><div class="detail-value">${escapeHTML(lead.contactType || lead.status)}</div></div><div class="detail-field"><div class="detail-label">Follow-Up Date</div><div class="detail-value">${formatDate(lead.followUpDate)}</div></div><div class="detail-field"><div class="detail-label">Cadence Step</div><div class="detail-value">${Number(lead.cadenceStep || 0) + 1}</div></div><div class="detail-field"><div class="detail-label">Last Completed</div><div class="detail-value">${lead.lastCompletedFollowUp ? formatDate(lead.lastCompletedFollowUp) : "No completed follow-up yet"}</div></div><div class="detail-field"><div class="detail-label">Notes</div><div class="detail-value">${escapeHTML(lead.notes || "No notes yet")}</div></div><div class="detail-actions"><button class="complete-btn" onclick="markComplete('${lead.id}')" type="button">Mark Complete + Tomorrow</button><button class="warning-btn" onclick="testFollowUpNow('${lead.id}')" type="button">Test Follow-Up Now</button><button class="edit-btn" onclick="editLead('${lead.id}')" type="button">Edit Lead</button><button class="delete-btn" onclick="deleteLead('${lead.id}')" type="button">Delete Lead</button></div>`;
}

function openAddForm(){
  $("formTitle").textContent = "Add Lead";
  $("leadForm").reset();
  $("leadId").value = "";
  $("followUpDate").value = todayISO();
  $("contactType").value = "Seller Lead";
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
  $("contactType").value = lead.contactType || lead.status || "Seller Lead";
  $("followUpDate").value = lead.followUpDate || todayISO();
  $("notes").value = lead.notes || "";
  showView("formView");
}

async function saveForm(event){
  event.preventDefault();
  const id = $("leadId").value || generateId();
  const oldLead = state.leads.find(item => item.id === id);
  const lead = { id, name:$("name").value.trim(), phone:$("phone").value.trim(), email:$("email").value.trim(), propertyAddress:$("propertyAddress").value.trim(), contactType:$("contactType").value, status:$("contactType").value, followUpDate:$("followUpDate").value || todayISO(), notes:$("notes").value.trim(), lastCompletedFollowUp:oldLead?.lastCompletedFollowUp || "", createdAt:oldLead?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString(), cadenceStep:oldLead?.cadenceStep ?? 0 };
  const saved = await saveLeadToDB(lead);
  if(!saved) return;
  await loadLeads();
  state.selectedLeadId = id;
  showView("detailView");
}

async function markComplete(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;

  const next = getNextFollowUpFromCadence(lead);

  lead.lastCompletedFollowUp = todayISO();
  lead.followUpDate = next.followUpDate;
  lead.cadenceStep = next.cadenceStep;

  const saved = await saveLeadToDB(lead);
  if(!saved) return;

  await loadLeads();
  state.selectedLeadId = id;
  showView("detailView");
  alert(`Follow-up completed. ${next.cadenceLabel}. Next follow-up: ${formatDate(next.followUpDate)}.`);
}

async function testFollowUpNow(id){
  const lead = state.leads.find(item => item.id === id);
  if(!lead) return;

  lead.followUpDate = todayISO();
  lead.cadenceStep = 0;

  const saved = await saveLeadToDB(lead);
  if(!saved) return;

  await loadLeads();
  state.selectedLeadId = id;
  showView("detailView");
  alert("Test follow-up triggered. This lead is now due today and cadence step was reset to 1.");
}

async function deleteLead(id){
  if(!confirm("Delete this lead?")) return;
  const deleted = await deleteLeadFromDB(id);
  if(!deleted) return;
  state.selectedLeadId = null;
  await loadLeads();
  showView("leadsView");
}

function csvEscape(value){ const str = String(value ?? ""); return /[",\n\r]/.test(str) ? `"${str.replaceAll('"','""')}"` : str; }
function downloadTextFile(content, filename, type){ const blob = new Blob([content],{type}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
function exportCSV(){ const headers=["id","name","phone","email","propertyAddress","contactType","status","followUpDate","lastCompletedFollowUp","createdAt","updatedAt","cadenceStep","notes"]; const rows=state.leads.map(lead=>headers.map(h=>csvEscape(lead[h])).join(",")); downloadTextFile([headers.join(","),...rows].join("\n"),`follow-up-leads-${todayISO()}.csv`,"text/csv"); }
function exportJSON(){ downloadTextFile(JSON.stringify({app:"Follow Up App",version:"supabase-nocache",exportedAt:new Date().toISOString(),leads:state.leads},null,2),`follow-up-backup-${todayISO()}.json`,"application/json"); }

function parseCSV(text){
  const rows=[]; let current=[], field="", inQuotes=false;
  for(let i=0;i<text.length;i++){ const char=text[i], next=text[i+1]; if(char==='"'&&inQuotes&&next==='"'){field+='"';i++;} else if(char==='"'){inQuotes=!inQuotes;} else if(char===","&&!inQuotes){current.push(field);field="";} else if((char==="\n"||char==="\r")&&!inQuotes){ if(char==="\r"&&next==="\n") i++; current.push(field); rows.push(current); current=[]; field=""; } else field+=char; }
  current.push(field); rows.push(current); return rows.filter(row=>row.some(cell=>cell.trim()!==""));
}

async function importFile(){
  const file = $("importFileInput").files[0];
  if(!file){ alert("Choose a CSV or JSON backup first."); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      let importedLeads=[];
      if(file.name.toLowerCase().endsWith(".json")){ const parsed=JSON.parse(reader.result); importedLeads=Array.isArray(parsed)?parsed:parsed.leads||[]; }
      else { const rows=parseCSV(reader.result); const headers=rows.shift().map(h=>h.trim()); importedLeads=rows.map(row=>{ const item={}; headers.forEach((h,i)=>item[h]=row[i]||""); return item; }); }
      for(const item of importedLeads){
        const lead = { id:item.id||generateId(), name:item.name||"", phone:item.phone||"", email:item.email||"", propertyAddress:item.propertyAddress||item.property_address||"", contactType:item.contactType||item.contact_type||item.status||"Seller Lead", status:item.contactType||item.contact_type||item.status||"Seller Lead", followUpDate:item.followUpDate||item.follow_up_date||todayISO(), notes:item.notes||"", lastCompletedFollowUp:item.lastCompletedFollowUp||item.last_completed_follow_up||"", cadenceStep:item.cadenceStep||item.cadence_step||0 };
        const saved = await saveLeadToDB(lead); if(!saved) return;
      }
      await loadLeads(); alert(`Import complete. Imported ${importedLeads.length} lead(s).`); showView("leadsView");
    } catch(error){ console.error(error); alert("Import failed. Make sure the file is valid."); }
  };
  reader.readAsText(file);
}

async function clearAllLeads(){
  if(!confirm("This deletes every lead from Supabase. Continue?")) return;
  const { error } = await supabaseClient.from("leads").delete().neq("id","00000000-0000-0000-0000-000000000000");
  if(error){ alert("Could not clear leads: " + error.message); return; }
  await loadLeads(); showView("todayView");
}

function wireEvents(){
  const ids=["todayTab","leadsTab","toolsTab","addLeadBottomBtn","addLeadTopBtn","cancelFormBtn","backToLeadsBtn","leadForm","contactType","searchInput","statusFilter","exportCsvBtn","exportJsonBtn","importBtn","clearAllBtn","refreshBtn","enableNotificationsBtn","testNotificationBtn","checkNotificationsBtn"];
  const missing=ids.filter(id=>!$(id));
  if(missing.length){ alert("Missing HTML elements: " + missing.join(", ")); return; }
  $("todayTab").onclick=()=>showView("todayView");
  $("leadsTab").onclick=()=>showView("leadsView");
  $("toolsTab").onclick=()=>showView("toolsView");
  $("addLeadBottomBtn").onclick=openAddForm;
  $("addLeadTopBtn").onclick=openAddForm;
  $("cancelFormBtn").onclick=()=>showView("leadsView");
  $("backToLeadsBtn").onclick=()=>showView("leadsView");
  $("leadForm").onsubmit=saveForm;
  $("searchInput").oninput=renderLeadList;
  $("statusFilter").onchange=renderLeadList;
  $("exportCsvBtn").onclick=exportCSV;
  $("exportJsonBtn").onclick=exportJSON;
  $("importBtn").onclick=importFile;
  $("clearAllBtn").onclick=clearAllLeads;
  $("refreshBtn").onclick=loadLeads;
  $("enableNotificationsBtn").onclick=enableNotifications;
  $("testNotificationBtn").onclick=testNotification;
  $("checkNotificationsBtn").onclick=()=>checkDueNotifications(true);
}


setInterval(() => {
  if (state.leads && state.leads.length) {
    checkDueNotifications(false);
  }
}, 15 * 60 * 1000);
