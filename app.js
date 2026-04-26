const SUPABASE_URL = "https://bkmrcmwmupnfcjequjlm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbXJjbXdtdXBuZmNqZXF1amxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzc0NjIsImV4cCI6MjA5Mjc1MzQ2Mn0.3T4cc9b-fgyQvpACHof_v03cV7hNM2BwlIOBp3gnnDY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  leads: [],
  currentView: "todayView",
  selectedLeadId: null
};

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
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

function dbToLead(row) {
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    propertyAddress: row.property_address || "",
    status: row.status || "New",
    followUpDate: row.follow_up_date || todayISO(),
    notes: row.notes || "",
    lastCompletedFollowUp: row.last_completed_follow_up || ""
  };
}

function leadToDB(lead) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    property_address: lead.propertyAddress,
    status: lead.status,
    follow_up_date: lead.followUpDate,
    notes: lead.notes,
    last_completed_follow_up: lead.lastCompletedFollowUp,
    updated_at: new Date().toISOString()
  };
}

async function loadLeads() {
  const { data, error } = await supabase.from("leads").select("*");

  if (error) {
    console.error(error);
    alert("Supabase connection failed");
    return;
  }

  state.leads = data.map(dbToLead);
  render();
}

async function saveLead(lead) {
  await supabase.from("leads").upsert(leadToDB(lead));
}

async function deleteLead(id) {
  await supabase.from("leads").delete().eq("id", id);
  state.leads = state.leads.filter(l => l.id !== id);
  render();
}

function render() {
  renderToday();
  renderLeads();
}

function renderToday() {
  const due = state.leads.filter(isDue);
  document.getElementById("todayList").innerHTML =
    due.map(l => `<div>${l.name} - ${l.followUpDate}</div>`).join("");
}

function renderLeads() {
  document.getElementById("leadList").innerHTML =
    state.leads.map(l => `<div>${l.name}</div>`).join("");
}

async function addLead() {
  const lead = {
    id: generateId(),
    name: "Test Lead",
    phone: "",
    email: "",
    propertyAddress: "",
    status: "New",
    followUpDate: todayISO(),
    notes: "",
    lastCompletedFollowUp: ""
  };

  await saveLead(lead);
  await loadLeads();
}

loadLeads();