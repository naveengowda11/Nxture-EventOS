const state = { events: [], registrations: [], students: [], faculty: [], analytics: { statusCounts: [], categoryCounts: [], paymentCounts: [], monthlyEventCounts: [], eventCategoryCounts: [] }, editingEventId: null };

const sections = document.querySelectorAll(".admin-section");
const navItems = document.querySelectorAll(".nav-item");
const pageTitle = document.getElementById("page-title");
const sidebar = document.getElementById("admin-sidebar");
const toast = document.getElementById("toast");

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("nxture_user") || "null");
  } catch {
    return null;
  }
}

function displayName(user) {
  const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return name || "College Admin";
}

function initials(user) {
  const first = (user?.firstName || "").trim();
  const last = (user?.lastName || "").trim();
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "A";
}

function renderAdminUser(user) {
  document.getElementById("admin-name").textContent = displayName(user);
  document.getElementById("admin-college").textContent = user?.college || "College information unavailable";
  document.getElementById("admin-avatar").textContent = initials(user);
}

function showSection(id, updateHash = true) {
  const target = document.getElementById(id) ? id : "overview";

  sections.forEach((section) => {
    section.classList.toggle("active-section", section.id === target);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === target);
  });

  const titles = {
    overview: "Overview",
    events: "Events",
    "create-event": "Create Event",
    registrations: "Registrations",
    students: "Students",
    faculty: "Faculty"
  };

  pageTitle.textContent = titles[target] || "Overview";

  if (updateHash) {
    history.replaceState(null, "", `#${target}`);
  }

  sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    showSection(item.dataset.section);
  });
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.go));
});

document.getElementById("mobile-menu").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.getElementById("logout-button").addEventListener("click", () => {
  localStorage.removeItem("nxture_token");
  localStorage.removeItem("nxture_user");
  window.location.href = "login.html";
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function updateOverview() {
  const now = new Date();
  const upcoming = state.events.filter((event) => event.date && new Date(event.date) >= now).length;

  document.getElementById("total-events").textContent = state.events.length;
  document.getElementById("total-registrations").textContent = state.registrations.length;
  document.getElementById("total-students").textContent = state.students.length;
  document.getElementById("upcoming-events").textContent = upcoming;
  document.getElementById("total-attendance").textContent = state.analytics.attendanceCount ?? 0;
  document.getElementById("total-certificates").textContent = state.analytics.certificateCount ?? 0;
  document.getElementById("event-record-count").textContent = `${state.events.length} record${state.events.length === 1 ? "" : "s"}`;
  document.getElementById("registration-record-count").textContent = `${state.registrations.length} record${state.registrations.length === 1 ? "" : "s"}`;
  document.getElementById("student-record-count").textContent = `${state.students.length} record${state.students.length === 1 ? "" : "s"}`;
  document.getElementById("faculty-record-count").textContent = `${state.faculty.length} record${state.faculty.length === 1 ? "" : "s"}`;
}

function renderAnalytics() {
  const monthlyEl = document.getElementById("monthly-event-chart");
  const eventCategoryEl = document.getElementById("event-category-chart");
  const monthly = state.analytics.monthlyEventCounts || [];
  const categories = state.analytics.eventCategoryCounts || [];
  const monthlyMax = Math.max(1, ...monthly.map(x => Number(x.count || 0)));
  const categoryMax = Math.max(1, ...categories.map(x => Number(x.count || 0)));
  monthlyEl.innerHTML = monthly.length ? `<div class="chart-bars">${monthly.map(item => { const count=Number(item.count||0); const h=Math.max(3, Math.round((count/monthlyMax)*100)); return `<div class="chart-bar-item"><div class="chart-bar-value">${count}</div><div class="chart-bar-track"><span style="height:${h}%"></span></div><div class="chart-bar-label">${escapeHtml(item.label)}</div></div>`; }).join('')}</div>` : emptyMarkup("—", "No event data", "Create events to see yearly activity.");
  eventCategoryEl.innerHTML = categories.length ? `<div class="chart-bars category-chart">${categories.map(item => { const count=Number(item.count||0); const h=Math.max(3, Math.round((count/categoryMax)*100)); return `<div class="chart-bar-item"><div class="chart-bar-value">${count}</div><div class="chart-bar-track"><span style="height:${h}%"></span></div><div class="chart-bar-label">${escapeHtml(item.label||'Other')}</div></div>`; }).join('')}</div>` : emptyMarkup("—", "No events yet", "Create events to see the category breakdown.");

  const statusEl = document.getElementById("event-status-analytics");
  const categoryEl = document.getElementById("category-analytics");
  const paymentEl = document.getElementById("payment-analytics");
  if (!statusEl || !categoryEl || !paymentEl) return;
  const statusLabels = { published: "Published", live: "Live", completed: "Completed", cancelled: "Cancelled", archived: "Archived" };
  const paymentLabels = { submitted: "Pending verification", verified: "Verified", rejected: "Rejected", not_required: "Not required" };
  const maxCategory = Math.max(1, ...state.analytics.categoryCounts.map(x => Number(x.registrations || 0)));
  statusEl.innerHTML = state.analytics.statusCounts.length ? state.analytics.statusCounts.map(item => `<div class="analytics-row"><span>${escapeHtml(statusLabels[item.status] || item.status)}</span><strong>${Number(item.count || 0)}</strong></div>`).join("") : emptyMarkup("—", "No event data", "Create events to see lifecycle analytics.");
  categoryEl.innerHTML = state.analytics.categoryCounts.length ? state.analytics.categoryCounts.map(item => { const count=Number(item.registrations||0); const width=Math.round((count/maxCategory)*100); return `<div class="analytics-row analytics-bar-row"><div><span>${escapeHtml(item.category || "Other")}</span><small>${Number(item.events||0)} event${Number(item.events||0)===1?"":"s"}</small></div><strong>${count}</strong><div class="analytics-bar"><span style="width:${width}%"></span></div></div>`; }).join("") : emptyMarkup("—", "No registration data", "Student registrations will appear here.");
  paymentEl.innerHTML = state.analytics.paymentCounts.length ? state.analytics.paymentCounts.map(item => `<div class="analytics-row"><span>${escapeHtml(paymentLabels[item.status] || item.status || "Unknown")}</span><strong>${Number(item.count || 0)}</strong></div>`).join("") : emptyMarkup("—", "No paid registrations", "Paid-event payment records will appear here.");
}

function emptyMarkup(icon, title, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${title}</strong><p>${text}</p></div>`;
}

function renderRecentEvents() {
  const container = document.getElementById("recent-events");

  if (!state.events.length) {
    container.innerHTML = emptyMarkup("+", "No events available", "Create an event to start building your campus event records.");
    return;
  }

  const events = [...state.events]
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
    .slice(0, 5);

  container.innerHTML = `
    <table class="table">
      <thead><tr><th>EVENT</th><th>CATEGORY</th><th>DATE</th><th>REGISTRATIONS</th></tr></thead>
      <tbody>
        ${events.map(event => `
          <tr>
            <td><strong>${escapeHtml(event.title || "Untitled event")}</strong></td>
            <td><span class="badge">${escapeHtml(event.category || "other")}</span></td>
            <td>${formatDate(event.date)}</td>
            <td>${Number(event.registrationCount || 0)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderEvents() {
  const container = document.getElementById("events-table");
  const search = document.getElementById("event-search").value.trim().toLowerCase();
  const category = document.getElementById("event-category").value;
  const events = state.events.filter(event => {
    const searchable = [event.title,event.description,event.category,event.venue,event.responsibleFacultyName].filter(Boolean).join(" ").toLowerCase();
    return (!search || searchable.includes(search)) && (category === "all" || String(event.category || "").toLowerCase() === category);
  });
  if (!events.length) { container.innerHTML = emptyMarkup("▦", "No events available", "Events created through this dashboard will appear here."); return; }
  container.innerHTML = `<table class="table"><thead><tr><th>EVENT</th><th>CATEGORY</th><th>DATE</th><th>STATUS</th><th>FACULTY</th><th>REGISTRATIONS</th><th>ACTION</th></tr></thead><tbody>${events.map(event => `
    <tr><td><div style="display:flex;align-items:center;gap:10px">${event.imageUrl ? `<img class="event-thumb" src="${escapeHtml(event.imageUrl)}" alt="">` : ""}<strong>${escapeHtml(event.title || "Untitled event")}</strong></div></td>
    <td><span class="badge">${escapeHtml(event.category || "other")}</span> ${event.isPaid ? `<span class="payment-pill paid">₹${escapeHtml(event.registrationFee)}</span>` : `<span class="payment-pill">Free</span>`}</td>
    <td>${formatDate(event.date)}</td><td><span class="badge status-${escapeHtml(String(event.status || "published").toLowerCase())}">${escapeHtml(event.status || "published")}</span></td><td>${escapeHtml(event.responsibleFacultyName || "Not assigned")}</td><td>${Number(event.registrationCount || 0)}${event.capacity ? ` / ${event.capacity}` : ""}</td>
    <td><button class="action-button manage-event" data-event-id="${escapeHtml(String(event.id))}">Manage</button></td></tr>`).join("")}</tbody></table>`;
  container.querySelectorAll(".manage-event").forEach(button => button.addEventListener("click", () => openManageEvent(button.dataset.eventId)));
}

function populateFacultySelect(selected = "") {
  const select = document.getElementById("event-faculty");
  if (!select) return;
  select.innerHTML = `<option value="">No faculty assigned</option>` + state.faculty.map(f => `<option value="${escapeHtml(String(f.id))}" ${String(f.id) === String(selected) ? "selected" : ""}>${escapeHtml(`${f.firstName || ""} ${f.lastName || ""}`.trim())} — ${escapeHtml(f.department || "")}</option>`).join("");
}

function openManageEvent(id) {
  const event = state.events.find(item => String(item.id) === String(id));
  if (!event) return;
  document.getElementById("manage-event-title").textContent = event.title || "Event";
  document.getElementById("manage-event-meta").textContent = `${formatDate(event.date)} • ${event.venue || "Venue unavailable"} • ${Number(event.registrationCount || 0)} registrations`;
  const statusSelect = document.getElementById("manage-event-status");
  const transitions = { published:["live","cancelled","archived"], live:["completed","cancelled"], completed:["archived"], cancelled:["archived"], archived:[] };
  const current = String(event.status || "published").toLowerCase();
  statusSelect.innerHTML = `<option value="${escapeHtml(current)}">${escapeHtml(current)} (current)</option>` + (transitions[current] || []).map(status => `<option value="${status}">${status}</option>`).join("");
  document.getElementById("update-event-status-button").onclick = async () => {
    const next = statusSelect.value;
    if (next === current) { showToast("Choose a new status first."); return; }
    if (!confirm(`Change this event from ${current} to ${next}?`)) return;
    try {
      const response = await fetch(`/api/admin/events/${event.id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("nxture_token")}`}, body:JSON.stringify({status:next}) });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.message || "Unable to update event status.");
      closeManageEvent(); await loadAdminData(); showToast(data.message || "Event status updated.");
    } catch(error) { showToast(error.message); }
  };
  document.getElementById("manage-event-modal").hidden = false;
  document.getElementById("edit-event-button").onclick = () => { closeManageEvent(); beginEditEvent(event); };
  document.getElementById("delete-event-button").onclick = async () => {
    if (!confirm(`Delete “${event.title}”? This will also remove its registrations, attendance and certificates.`)) return;
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("nxture_token")}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to delete event.");
      closeManageEvent(); await loadAdminData(); showToast(data.message || "Event deleted.");
    } catch (error) { showToast(error.message); }
  };
}
function closeManageEvent() { document.getElementById("manage-event-modal").hidden = true; }
function beginEditEvent(event) {
  state.editingEventId = event.id; showSection("create-event");
  document.getElementById("event-title").value = event.title || "";
  document.getElementById("event-category-input").value = event.category || "";
  document.getElementById("event-description").value = event.description || "";
  document.getElementById("event-date").value = event.date || ""; document.getElementById("event-time").value = event.time || ""; document.getElementById("event-venue").value = event.venue || "";
  document.getElementById("event-capacity").value = event.capacity ?? ""; document.getElementById("registration-start").value = event.registrationStart || ""; document.getElementById("registration-end").value = event.registrationEnd || "";
  document.getElementById("event-paid").checked = Boolean(event.isPaid); document.getElementById("event-fee").value = event.registrationFee || ""; togglePaymentFields(); populateFacultySelect(event.responsibleFacultyId);
  document.getElementById("create-event-submit").querySelector("span:first-child").textContent = "Update Event";
}
function resetEventEditor() {
  state.editingEventId = null; document.getElementById("event-form").reset(); populateFacultySelect(); togglePaymentFields(); document.getElementById("create-event-submit").querySelector("span:first-child").textContent = "Create Event";
}
function togglePaymentFields() {
  const paid = document.getElementById("event-paid").checked; document.getElementById("fee-field").hidden = !paid; document.getElementById("qr-field").hidden = !paid;
}

function renderRegistrations() {
  const container = document.getElementById("registrations-table");
  if (!state.registrations.length) { container.innerHTML = emptyMarkup("✓", "No registrations available", "Student registrations will appear here after students register for your events."); return; }
  const eventFilter = document.getElementById("registration-event-filter").value;
  const registrations = state.registrations.filter(reg => eventFilter === "all" || String(reg.eventId) === eventFilter);
  if (!registrations.length) { container.innerHTML = emptyMarkup("✓", "No matching registrations", "There are no registrations for the selected event."); return; }
  container.innerHTML = `<table class="table"><thead><tr><th>STUDENT</th><th>COLLEGE</th><th>STUDENT ID</th><th>EMAIL</th><th>EVENT</th><th>PAYMENT</th><th>ATTENDANCE</th><th>CERTIFICATE</th></tr></thead><tbody>${registrations.map(reg => {
    const paymentStatus = String(reg.paymentStatus || "pending").toLowerCase();
    const paymentAction = reg.isPaid && paymentStatus === "submitted"
      ? `<div style="display:flex;gap:6px;margin-top:6px"><button class="action-button payment-action" data-id="${escapeHtml(String(reg.id))}" data-action="verify">Verify</button><button class="action-button payment-action" data-id="${escapeHtml(String(reg.id))}" data-action="reject">Reject</button></div>`
      : "";
    return `<tr><td><strong>${escapeHtml(reg.studentName || "—")}</strong><br><small>${escapeHtml(reg.department || "")} • ${escapeHtml(reg.year || "")} Year</small></td><td><strong>${escapeHtml(reg.studentCollege || "—")}</strong></td><td>${escapeHtml(reg.studentCode || "—")}</td><td>${escapeHtml(reg.studentEmail || "—")}</td><td>${escapeHtml(reg.eventTitle || "—")}</td><td>${reg.isPaid ? `${escapeHtml(reg.paymentReference || "Not submitted")}<br><span class="badge">${escapeHtml(paymentStatus)}</span>${paymentAction}` : "Free"}</td><td><span class="badge">${reg.attended ? "Present" : "Not marked"}</span></td><td><span class="badge">${reg.certificateIssued ? "Issued" : "Not issued"}</span></td></tr>`;
  }).join("")}</tbody></table>`;
  container.querySelectorAll(".payment-action").forEach(button => button.addEventListener("click", () => updatePaymentStatus(button.dataset.id, button.dataset.action)));
}

async function updatePaymentStatus(registrationId, action) {
  const actionText = action === "verify" ? "verify" : "reject";
  if (!confirm(`Are you sure you want to ${actionText} this payment?`)) return;
  try {
    const response = await fetch(`/api/admin/registrations/${registrationId}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("nxture_token")}` },
      body: JSON.stringify({ action })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to update payment.");
    await loadAdminData();
    showToast(data.message || "Payment status updated.");
    if (data.emailSent === false) showToast("Payment updated, but the email could not be sent. Check EMAIL_USER and EMAIL_PASS.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderFaculty() {
  const container = document.getElementById("faculty-table");
  const search = document.getElementById("faculty-search").value.trim().toLowerCase();

  const faculty = state.faculty.filter(member => {
    const text = [member.firstName, member.lastName, member.email, member.department, member.designation]
      .filter(Boolean).join(" ").toLowerCase();
    return !search || text.includes(search);
  });

  if (!faculty.length) {
    container.innerHTML = emptyMarkup("◉", "No faculty accounts available", "Faculty accounts created by the college admin will appear here.");
    return;
  }

  container.innerHTML = `
    <table class="table">
      <thead><tr><th>NAME</th><th>EMAIL</th><th>DEPARTMENT</th><th>DESIGNATION</th><th>STATUS</th></tr></thead>
      <tbody>
        ${faculty.map(member => `
          <tr>
            <td><strong>${escapeHtml(`${member.firstName || ""} ${member.lastName || ""}`.trim() || "—")}</strong></td>
            <td>${escapeHtml(member.email || "—")}</td>
            <td>${escapeHtml(member.department || "—")}</td>
            <td>${escapeHtml(member.designation || "—")}</td>
            <td><span class="badge">${member.emailVerified ? "Active" : "Inactive"}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderStudents() {
  const container = document.getElementById("students-table");
  const search = document.getElementById("student-search").value.trim().toLowerCase();

  const students = state.students.filter(student => {
    const text = [
      student.firstName, student.lastName, student.email,
      student.studentId, student.department
    ].filter(Boolean).join(" ").toLowerCase();

    return !search || text.includes(search);
  });

  if (!students.length) {
    container.innerHTML = emptyMarkup("○", "No student records available", "Students who belong to your college will appear here.");
    return;
  }

  container.innerHTML = `
    <table class="table">
      <thead><tr><th>NAME</th><th>STUDENT ID</th><th>EMAIL</th><th>DEPARTMENT</th><th>YEAR</th></tr></thead>
      <tbody>
        ${students.map(student => `
          <tr>
            <td>${escapeHtml(`${student.firstName || ""} ${student.lastName || ""}`.trim() || "—")}</td>
            <td>${escapeHtml(student.studentId || "—")}</td>
            <td>${escapeHtml(student.email || "—")}</td>
            <td>${escapeHtml(student.department || "—")}</td>
            <td>${escapeHtml(student.year || "—")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function populateRegistrationEvents() {
  const select = document.getElementById("registration-event-filter");
  select.innerHTML = `<option value="all">All events</option>` +
    state.events.map(event =>
      `<option value="${escapeHtml(String(event.id))}">${escapeHtml(event.title || "Untitled event")}</option>`
    ).join("");
}

async function loadAdminData() {
  const token = localStorage.getItem("nxture_token");

  if (!token) {
    updateOverview();
    renderRecentEvents();
    renderEvents();
    renderRegistrations();
    renderStudents();
    renderFaculty();
    renderAnalytics();
    return;
  }

  try {
    const response = await fetch("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Unable to load admin data.");

    const data = await response.json();

    state.events = Array.isArray(data.events) ? data.events : [];
    state.registrations = Array.isArray(data.registrations) ? data.registrations : [];
    state.students = Array.isArray(data.students) ? data.students : [];
    state.faculty = Array.isArray(data.faculty) ? data.faculty : [];
    state.analytics = { ...(data.analytics || {}), monthlyEventCounts: data.analytics?.monthlyEventCounts || [], eventCategoryCounts: data.analytics?.eventCategoryCounts || [], attendanceCount: Number(data.attendanceCount || 0), certificateCount: Number(data.certificateCount || 0) };

    updateOverview();
    renderAnalytics();
    renderRecentEvents();
    renderEvents();
    populateRegistrationEvents();
    renderRegistrations();
    renderStudents();
    renderFaculty();
    populateFacultySelect();
  } catch {
    state.events = [];
    state.registrations = [];
    state.students = [];
    state.faculty = [];
    state.analytics = { statusCounts: [], categoryCounts: [], paymentCounts: [], monthlyEventCounts: [], eventCategoryCounts: [], attendanceCount: 0, certificateCount: 0 };

    updateOverview();
    renderAnalytics();
    renderRecentEvents();
    renderEvents();
    populateRegistrationEvents();
    renderRegistrations();
    renderStudents();
    renderFaculty();
    populateFacultySelect();
  }
}

document.getElementById("event-search").addEventListener("input", renderEvents);
document.getElementById("event-category").addEventListener("change", renderEvents);
document.getElementById("registration-event-filter").addEventListener("change", renderRegistrations);
document.getElementById("student-search").addEventListener("input", renderStudents);
document.getElementById("faculty-search").addEventListener("input", renderFaculty);

document.getElementById("faculty-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const message = document.getElementById("faculty-form-message");
  const submit = document.getElementById("create-faculty-submit");
  document.querySelectorAll("#faculty-form .error").forEach(item => item.textContent = "");
  document.querySelectorAll("#faculty-form input").forEach(item => item.classList.remove("invalid"));
  message.textContent = "";
  message.classList.remove("success");

  const fields = {
    firstName: document.getElementById("faculty-first-name"),
    lastName: document.getElementById("faculty-last-name"),
    email: document.getElementById("faculty-email"),
    department: document.getElementById("faculty-department"),
    designation: document.getElementById("faculty-designation"),
    password: document.getElementById("faculty-password")
  };
  let valid = true;
  const required = [
    ["firstName", "First name is required."],
    ["lastName", "Last name is required."],
    ["email", "Faculty email is required."],
    ["department", "Department is required."],
    ["designation", "Designation is required."],
    ["password", "Initial password is required."]
  ];
  required.forEach(([key, text]) => {
    if (!fields[key].value.trim()) {
      fields[key].classList.add("invalid");
      document.getElementById(`faculty-${key.replace("firstName","first-name").replace("lastName","last-name")}-error`).textContent = text;
      valid = false;
    }
  });
  if (!valid) return;
  if (!/^[^\s@]+@atme\.edu\.in$/i.test(fields.email.value.trim())) {
    fields.email.classList.add("invalid");
    document.getElementById("faculty-email-error").textContent = "Use the official faculty email ending with @atme.edu.in.";
    return;
  }
  if (fields.password.value.length < 8) {
    fields.password.classList.add("invalid");
    document.getElementById("faculty-password-error").textContent = "Initial password must be at least 8 characters.";
    return;
  }

  submit.disabled = true;
  submit.querySelector("span:first-child").textContent = "Creating...";
  try {
    const token = localStorage.getItem("nxture_token");
    const response = await fetch("/api/admin/faculty", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        firstName: fields.firstName.value.trim(),
        lastName: fields.lastName.value.trim(),
        email: fields.email.value.trim().toLowerCase(),
        department: fields.department.value.trim(),
        designation: fields.designation.value.trim(),
        password: fields.password.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to create faculty account.");
    message.textContent = data.message || "Faculty account created successfully.";
    message.classList.add("success");
    form.reset();
    await loadAdminData();
  } catch (error) {
    message.textContent = error.message === "Failed to fetch" ? "Faculty service is not connected yet." : error.message;
  } finally {
    submit.disabled = false;
    submit.querySelector("span:first-child").textContent = "Create Faculty Account";
  }
});

document.getElementById("event-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, message = document.getElementById("event-form-message"), submit = document.getElementById("create-event-submit");
  const fields = { title:document.getElementById("event-title"), category:document.getElementById("event-category-input"), description:document.getElementById("event-description"), date:document.getElementById("event-date"), time:document.getElementById("event-time"), venue:document.getElementById("event-venue"), capacity:document.getElementById("event-capacity"), registrationStart:document.getElementById("registration-start"), registrationEnd:document.getElementById("registration-end") };
  const required = [["title","Event title is required."],["category","Select an event category."],["description","Event description is required."],["date","Event date is required."],["time","Event time is required."],["venue","Event venue is required."]];
  document.querySelectorAll("#event-form .error").forEach(x=>x.textContent=""); let valid=true; required.forEach(([key,text])=>{if(!fields[key].value.trim()){fields[key].classList.add("invalid"); const err=document.getElementById(`${key}-error`); if(err) err.textContent=text; valid=false;}}); if(!valid)return;
  const paid=document.getElementById("event-paid").checked, fee=document.getElementById("event-fee").value, image=document.getElementById("event-image").files[0], qr=document.getElementById("payment-qr").files[0];
  if(paid && (!fee || Number(fee)<=0)){message.textContent="Enter a valid registration fee for a paid event.";return;}
  if(paid && !state.editingEventId && !qr){message.textContent="Upload the payment QR image for a paid event.";return;}
  const formData=new FormData(); formData.append("title",fields.title.value.trim()); formData.append("category",fields.category.value); formData.append("description",fields.description.value.trim()); formData.append("date",fields.date.value); formData.append("time",fields.time.value); formData.append("venue",fields.venue.value.trim()); formData.append("capacity",fields.capacity.value); formData.append("registrationStart",fields.registrationStart.value); formData.append("registrationEnd",fields.registrationEnd.value); formData.append("isPaid",paid); formData.append("registrationFee",paid?fee:"0"); formData.append("responsibleFacultyId",document.getElementById("event-faculty").value); if(image)formData.append("eventImage",image); if(qr)formData.append("paymentQr",qr);
  submit.disabled=true; submit.querySelector("span:first-child").textContent=state.editingEventId?"Updating...":"Creating...";
  try{const token=localStorage.getItem("nxture_token"), url=state.editingEventId?`/api/admin/events/${state.editingEventId}`:"/api/admin/events", response=await fetch(url,{method:state.editingEventId?"PUT":"POST",headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:formData}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Unable to save event.");message.textContent=data.message||"Event saved successfully.";message.classList.add("success");resetEventEditor();await loadAdminData();showSection("events");}catch(error){message.textContent=error.message;}finally{submit.disabled=false;submit.querySelector("span:first-child").textContent="Create Event";}
});

document.getElementById("event-paid").addEventListener("change",togglePaymentFields);
document.getElementById("close-manage-modal").addEventListener("click",closeManageEvent);
document.getElementById("manage-event-modal").addEventListener("click",e=>{if(e.target.id==="manage-event-modal")closeManageEvent();});
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

const adminUser = getStoredUser();
renderAdminUser(adminUser);

const initialSection = window.location.hash.replace("#", "");
showSection(initialSection || "overview", false);
togglePaymentFields();
populateFacultySelect();
loadAdminData();
