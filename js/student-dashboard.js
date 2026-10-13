let currentEvent = null;

const state = {
  user: null,
  events: [],
  registrations: [],
  attendance: [],
  certificates: [],
  notifications: []
};

const elements = {
  userName: document.getElementById("user-name"),
  userCollege: document.getElementById("user-college"),
  welcomeName: document.getElementById("welcome-name"),
  userAvatar: document.getElementById("user-avatar"),
  profileAvatar: document.getElementById("profile-avatar"),
  profileName: document.getElementById("profile-name"),
  profileEmail: document.getElementById("profile-email"),
  profileStudentId: document.getElementById("profile-student-id"),
  profileDepartment: document.getElementById("profile-department"),
  profileYear: document.getElementById("profile-year"),
  registeredCount: document.getElementById("registered-count"),
  upcomingCount: document.getElementById("upcoming-count"),
  attendedCount: document.getElementById("attended-count"),
  certificateCount: document.getElementById("certificate-count"),
  registrationBadge: document.getElementById("registration-badge"),
  notificationCount: document.getElementById("notification-count"),
  eventsGrid: document.getElementById("events-grid"),
  search: document.getElementById("event-search"),
  filter: document.getElementById("event-filter"),
  toast: document.getElementById("toast")
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("nxture_user") || "null");
  } catch {
    return null;
  }
}

function initials(user) {
  const first = (user?.firstName || "").trim();
  const last = (user?.lastName || "").trim();

  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }

  return "S";
}

function displayName(user) {
  const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return name || "Student";
}

function renderUser(user) {
  const name = displayName(user);
  const college = user?.college || "College information unavailable";

  elements.userName.textContent = name;
  elements.welcomeName.textContent = user?.firstName || "Student";
  elements.userCollege.textContent = college;
  elements.userAvatar.textContent = initials(user);
  elements.profileAvatar.textContent = initials(user);
  elements.profileName.textContent = name;
  elements.profileEmail.textContent = user?.email || "Email unavailable";
  elements.profileStudentId.textContent = user?.studentId || "—";
  elements.profileDepartment.textContent = user?.department || "—";
  elements.profileYear.textContent = user?.year ? `${user.year}${user.year === 1 ? "st" : user.year === 2 ? "nd" : user.year === 3 ? "rd" : "th"} Year` : "—";
}

function renderStats() {
  const registered = state.registrations.length;
  const attended = state.attendance.length;
  const certificates = state.certificates.length;

  // Upcoming events are based on real event data returned by the backend.
  // With no backend data, this remains zero instead of inventing events.
  const upcoming = state.events.filter((event) => {
    if (!event?.date) return false;
    return new Date(event.date) >= new Date();
  }).length;

  elements.registeredCount.textContent = registered;
  elements.upcomingCount.textContent = upcoming;
  elements.attendedCount.textContent = attended;
  elements.certificateCount.textContent = certificates;
  elements.registrationBadge.textContent = registered;
  elements.notificationCount.textContent = String(state.notifications.filter(n => !n.readAt).length);
}

function renderEvents() {
  const searchTerm = elements.search.value.trim().toLowerCase();
  const filter = elements.filter.value;
  const filtered = state.events.filter(event => {
    const searchable=[event.title,event.description,event.category,event.venue,event.responsibleFacultyName].filter(Boolean).join(" ").toLowerCase();
    return (!searchTerm || searchable.includes(searchTerm)) && (filter === "all" || String(event.category||"").toLowerCase() === filter);
  });
  if (!filtered.length) { elements.eventsGrid.innerHTML=`<div class="empty-state"><div class="empty-state-icon">+</div><h4>No upcoming events</h4><p>Events available to you, including inter-college events, will appear here once they are published.</p></div>`; return; }
  elements.eventsGrid.innerHTML=filtered.map(event=>`<article class="event-card">${event.imageUrl?`<img class="event-poster" src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.title||"Event")}">`:""}<div class="event-card-top"><span class="event-category">${escapeHtml(event.category||"Event")}</span><span class="event-date">${formatDate(event.date)}</span></div><div style="font-size:12px;color:#6d7b76;margin-top:5px">${escapeHtml(event.college||"Organizer")} · ${escapeHtml(String(event.participationType||"college").toLowerCase().replaceAll("-","_")==="inter_college"?"Inter-college":String(event.participationType||"college").toLowerCase().replaceAll("-","_")==="open"?"Open to all colleges":"College event")}</div><h4>${escapeHtml(event.title||"Untitled event")}</h4><p>${escapeHtml(event.description||"No event description available.")}</p><div class="event-meta"><span>⌖ ${escapeHtml(event.venue||"Venue unavailable")}</span><span>◷ ${escapeHtml(event.time||"Time unavailable")}</span></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0">${event.isPaid?`<span class="paid-tag">₹${escapeHtml(event.registrationFee)} registration</span>`:`<span class="paid-tag" style="background:#eef7f4;color:#16796b">Free</span>`}<span style="font-size:12px;color:#778681">${Number(event.registrationCount||0)}${event.capacity?` / ${event.capacity}`:""} registered</span></div><button class="event-register" data-event-id="${escapeHtml(String(event.id))}">View & Register →</button></article>`).join("");
  elements.eventsGrid.querySelectorAll(".event-register").forEach(button=>button.addEventListener("click",()=>openEventModal(button.dataset.eventId)));
}

function renderStudentPhases(phases){const phaseBox=document.getElementById("student-modal-phase-list");if(!phases.length){phaseBox.innerHTML='<div class="phase-empty">The organizer has not added phase information yet.</div>';return;}phaseBox.innerHTML=phases.map((phase,i)=>{const dates=[phase.startDate?escapeHtml(formatDate(phase.startDate)):"",phase.endDate?escapeHtml(formatDate(phase.endDate)):""].filter(Boolean).join(" → ");const result=phase.resultPublished?`<div class="phase-result"><strong>${escapeHtml(phase.resultTitle||"Result published")}</strong><p>${escapeHtml(phase.resultDetails||"")}</p>${phase.resultUrl?"<a href=\""+escapeHtml(phase.resultUrl)+"\" target=\"_blank\" rel=\"noopener\">Open result →</a>":""}</div>`:"";return `<div class="student-phase"><div class="phase-dot">${i+1}</div><div><h4>${escapeHtml(phase.phaseName||("Phase "+(i+1)))} <span class="phase-status">${escapeHtml(phase.status||"upcoming")}</span></h4><p>${escapeHtml(phase.description||"")}</p><small>${dates}</small>${result}</div></div>`;}).join("");}

function openEventModal(id){
  const event=state.events.find(item=>String(item.id)===String(id)); if(!event)return;
  currentEvent=event; document.getElementById("student-modal-title").textContent=event.title||"Event"; document.getElementById("student-modal-category").textContent=event.category||"Event"; document.getElementById("student-modal-description").textContent=event.description||"";
  const image=document.getElementById("student-modal-image"); if(event.imageUrl){image.src=event.imageUrl;image.hidden=false;}else{image.hidden=true;image.removeAttribute("src");}
  const participationType=String(event.participationType||"college").toLowerCase().replaceAll("-","_"); const reach=participationType==="inter_college"?"Inter-college":participationType==="open"?"Open to all colleges":"Organizing college only";
  document.getElementById("student-modal-meta").innerHTML=`<span><strong>Organizer</strong><br>${escapeHtml(event.college||"—")}</span><span><strong>Participation</strong><br>${escapeHtml(reach)}</span><span><strong>Date</strong><br>${escapeHtml(formatDate(event.date))}</span><span><strong>Time</strong><br>${escapeHtml(event.time||"—")}</span><span><strong>Venue</strong><br>${escapeHtml(event.venue||"—")}</span><span><strong>Responsible faculty</strong><br>${escapeHtml(event.responsibleFacultyName||"—")}</span>`;
  const info=[[
    "Objectives",event.objectives],["Prize details",event.prizes],["Certificate details",event.certificateDetails],["Participation details",event.participationDetails],["Eligibility",event.eligibility],["Rules & guidelines",event.rules]
  ].filter(x=>x[1]);
  document.getElementById("student-modal-info").innerHTML=info.length?info.map(([title,text])=>`<div class="event-info-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p></div>`).join(""):"";
  renderStudentPhases(Array.isArray(event.phases)?event.phases:[]);
  const paymentBox=document.getElementById("student-payment-box"), ref=document.getElementById("student-payment-reference"), qr=document.getElementById("student-payment-qr");
  ref.value=""; document.getElementById("student-modal-message").textContent="";
  if(event.isPaid){paymentBox.hidden=false;document.getElementById("student-payment-fee").textContent=`Registration fee: ₹${event.registrationFee}`;qr.src=event.paymentQrUrl||"";qr.hidden=!event.paymentQrUrl;}else paymentBox.hidden=true;
  document.getElementById("student-event-modal").hidden=false;
}
function closeEventModal(){document.getElementById("student-event-modal").hidden=true;currentEvent=null;}
async function registerCurrentEvent(){
  if(!currentEvent)return; const message=document.getElementById("student-modal-message"),button=document.getElementById("student-modal-register"), ref=document.getElementById("student-payment-reference");
  const body={}; if(currentEvent.isPaid){body.paymentReference=ref.value.trim();if(!body.paymentReference){message.textContent="Enter the payment transaction/UTR reference after paying.";return;}}
  button.disabled=true; message.textContent="Submitting registration...";
  try{const response=await fetch(`/api/student/events/${currentEvent.id}/register`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("nxture_token")}`},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Unable to register.");message.textContent=data.message||"Registration successful.";await loadDashboardData();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}
}

function renderRegistrations(){
  const box=document.getElementById("registration-empty");
  if(!state.registrations.length){box.innerHTML=`<div class="empty-state-icon">✓</div><h4>No registrations yet</h4><p>Your event registrations, payment status and updates will appear here.</p>`;return;}
  box.innerHTML=state.registrations.map(reg=>{
    const paymentStatus=String(reg.paymentStatus||"not_required").toLowerCase();
    const paymentLabel=paymentStatus==="verified"?"Payment Verified":paymentStatus==="rejected"?"Payment Rejected":paymentStatus==="submitted"?"Payment Pending":"";
    const publishedPhases=(reg.phases||[]).filter(p=>p.resultPublished);const latestPhase=publishedPhases[publishedPhases.length-1];
    return `<div class="registration-row"><div class="registration-row-main"><div><strong>${escapeHtml(reg.eventTitle||"Event")}</strong><span class="registration-status">${escapeHtml(reg.status||"registered")}</span>${reg.isPaid&&paymentLabel?`<span class="registration-status">${escapeHtml(paymentLabel)}</span>`:""}</div><p>${escapeHtml(reg.organizerCollege||"")} · ${escapeHtml(formatDate(reg.date))} • ${escapeHtml(reg.time||"")} • ${escapeHtml(reg.venue||"")}</p>${reg.isPaid?`<small>Payment reference: ${escapeHtml(reg.paymentReference||"Pending")}</small>`:""}${latestPhase?`<div class="phase-result" style="margin-top:8px"><strong>${escapeHtml(latestPhase.phaseName)} update:</strong> ${escapeHtml(latestPhase.resultTitle||"Result published")}</div>`:""}</div><button class="qr-button" type="button" data-registration-id="${escapeHtml(String(reg.id))}" ${(!reg.qrImage||(reg.isPaid&&String(reg.paymentStatus||"").toLowerCase()!=="verified"))?'disabled':''}>${reg.isPaid&&String(reg.paymentStatus||"").toLowerCase()!=="verified"?'QR after payment verification':'Show QR'}</button></div>`;
  }).join("");
  box.querySelectorAll(".qr-button").forEach(button=>button.addEventListener("click",()=>openRegistrationQr(button.dataset.registrationId)));
}

function openRegistrationQr(id){
  const reg=state.registrations.find(item=>String(item.id)===String(id));
  if(!reg||!reg.qrImage)return;
  document.getElementById("student-qr-title").textContent=reg.eventTitle||"Event Registration";
  document.getElementById("student-registration-qr").src=reg.qrImage;
  document.getElementById("student-qr-id").textContent=`Registration ID: NXT-${reg.id}`;
  document.getElementById("student-qr-modal").hidden=false;
}

function closeRegistrationQr(){document.getElementById("student-qr-modal").hidden=true;}

function renderCertificates(){
  const box=document.getElementById("student-certificates-list");
  if(!box)return;
  if(!state.certificates.length){box.innerHTML=`<div class="empty-state"><div class="empty-state-icon">◇</div><h4>No certificates yet</h4><p>Certificates issued after attendance will appear here.</p></div>`;return;}
  box.innerHTML=state.certificates.map(c=>`<div class="registration-row"><div class="registration-row-main"><div><strong>${escapeHtml(c.eventTitle||"Event")}</strong><span class="registration-status">Issued</span></div><p>Issued: ${escapeHtml(formatDate(c.issuedAt))}</p><small>Certificate ID: NXT-${escapeHtml(String(c.verificationCode||c.id||"").toUpperCase())}</small></div><div style="display:flex;gap:8px;align-items:center">${c.certificateUrl?`<a class="qr-button" href="${escapeHtml(c.certificateUrl)}" target="_blank" rel="noopener">Download</a>`:""}${c.verificationCode?`<a class="qr-button" href="certificate-verify.html?code=${encodeURIComponent(c.verificationCode)}" target="_blank" rel="noopener">Verify</a>`:""}</div></div>`).join("");
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2800);
}

async function loadDashboardData() {
  const token = localStorage.getItem("nxture_token");

  /*
    These endpoints are the fixed contracts for the backend layer.
    The dashboard never creates local fake event/registration data.
  */
  if (!token) {
    // The frontend can still be previewed without authentication.
    // Once backend auth is active, this route will be protected by the server.
    renderStats();
    renderEvents();
    renderRegistrations();
    renderCertificates();
    return;
  }

  try {
    const response = await fetch("/api/student/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Unable to load dashboard data.");
    }

    const data = await response.json();

    state.events = Array.isArray(data.events) ? data.events : [];
    state.registrations = Array.isArray(data.registrations) ? data.registrations : [];
    state.attendance = Array.isArray(data.attendance) ? data.attendance : [];
    state.certificates = Array.isArray(data.certificates) ? data.certificates : [];
    state.notifications = Array.isArray(data.notifications) ? data.notifications : [];

    renderStats();
    renderEvents();
    renderRegistrations();
    renderCertificates();
  } catch {
    // Keep zero/empty values. Never replace unavailable data with dummy data.
    state.events = [];
    state.registrations = [];
    state.attendance = [];
    state.certificates = [];
    state.notifications = [];
    renderStats();
    renderEvents();
    renderRegistrations();
    renderCertificates();
  }
}

document.getElementById("student-modal-close").addEventListener("click",closeEventModal);
document.getElementById("student-modal-cancel").addEventListener("click",closeEventModal);
document.getElementById("student-modal-register").addEventListener("click",registerCurrentEvent);
document.getElementById("student-event-modal").addEventListener("click",e=>{if(e.target.id==="student-event-modal")closeEventModal();});
document.getElementById("student-qr-close").addEventListener("click",closeRegistrationQr);
document.getElementById("student-qr-close-action").addEventListener("click",closeRegistrationQr);
document.getElementById("student-qr-modal").addEventListener("click",e=>{if(e.target.id==="student-qr-modal")closeRegistrationQr();});

document.getElementById("logout-button").addEventListener("click", () => {
  localStorage.removeItem("nxture_token");
  localStorage.removeItem("nxture_user");
  window.location.href = "login.html";
});

function renderNotifications() {
  let panel = document.getElementById("notifications-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "notifications-panel";
    panel.style.cssText = "position:fixed;right:24px;top:78px;width:min(380px,calc(100vw - 32px));max-height:70vh;overflow:auto;background:#fff;border:1px solid #dfe9e6;border-radius:16px;box-shadow:0 18px 50px rgba(20,50,45,.16);z-index:1000;padding:16px;";
    document.body.appendChild(panel);
  }
  if (!state.notifications.length) {
    panel.innerHTML = '<strong>Notifications</strong><div style="padding:28px 4px;color:#75837f;text-align:center">No notifications yet.</div>';
  } else {
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><strong>Notifications</strong><button id="mark-all-notifications" style="border:0;background:none;color:#16796b;cursor:pointer">Mark all read</button></div>' + state.notifications.map(n => `<div data-notification-id="${escapeHtml(String(n.id))}" style="padding:12px 2px;border-bottom:1px solid #edf2f0;${n.readAt ? '' : 'background:#f4faf8;'}"><strong>${escapeHtml(n.title)}</strong><p style="margin:5px 0;color:#65746f;font-size:13px">${escapeHtml(n.message)}</p><small style="color:#899590">${escapeHtml(new Date(n.createdAt).toLocaleString('en-IN'))}</small></div>`).join('');
    panel.querySelectorAll('[data-notification-id]').forEach(item => item.addEventListener('click', async () => {
      const id = item.dataset.notificationId;
      await fetch('/api/student/notifications/read',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('nxture_token')}`},body:JSON.stringify({id})});
      const n = state.notifications.find(x => String(x.id) === id); if (n) n.readAt = new Date().toISOString();
      renderStats(); renderNotifications();
    }));
    const mark = document.getElementById('mark-all-notifications');
    if (mark) mark.addEventListener('click', async () => {
      await fetch('/api/student/notifications/read',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('nxture_token')}`},body:'{}'});
      state.notifications.forEach(n => n.readAt = new Date().toISOString());
      renderStats(); renderNotifications();
    });
  }
  panel.hidden = !panel.hidden;
}

document.getElementById("notification-button").addEventListener("click", renderNotifications);

document.getElementById("profile-action").addEventListener("click", () => {
  document.getElementById("profile").scrollIntoView({ behavior: "smooth" });
});

elements.search.addEventListener("input", renderEvents);
elements.filter.addEventListener("change", renderEvents);

const mobileMenu = document.getElementById("mobile-menu");
const sidebar = document.getElementById("sidebar");

mobileMenu.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

sidebar.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    sidebar.classList.remove("open");
  });
});

state.user = getStoredUser();
renderUser(state.user);
renderStats();
renderEvents();
renderRegistrations();
loadDashboardData();
window.setInterval(loadDashboardData, 15000);


function initAiAssistant(){
  const open=document.getElementById('ai-assistant-open');
  const close=document.getElementById('ai-assistant-close');
  const panel=document.getElementById('ai-assistant-panel');
  const form=document.getElementById('ai-assistant-form');
  const input=document.getElementById('ai-assistant-input');
  const messages=document.getElementById('ai-assistant-messages');
  if(!open||!close||!panel||!form||!input||!messages)return;
  const addMessage=(text,type)=>{const div=document.createElement('div');div.className=`ai-message ${type==='user'?'ai-user':'ai-bot'}`;div.textContent=text;messages.appendChild(div);messages.scrollTop=messages.scrollHeight;return div;};
  open.addEventListener('click',()=>{panel.hidden=false;input.focus();});
  close.addEventListener('click',()=>{panel.hidden=true;});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const query=input.value.trim(); if(!query)return;
    addMessage(query,'user'); input.value=''; input.disabled=true; form.querySelector('button').disabled=true;
    const thinking=addMessage('Checking the information published on NXTURE...','bot');
    try{
      const response=await fetch('/api/student/ai-assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('nxture_token')}`},body:JSON.stringify({query})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||'Unable to answer right now.');
      thinking.textContent=data.answer||'I could not find that information in the website data.';
    }catch(error){thinking.textContent=error.message||'Unable to answer right now.';}
    finally{input.disabled=false;form.querySelector('button').disabled=false;input.focus();}
  });
}

document.addEventListener('DOMContentLoaded',initAiAssistant);
