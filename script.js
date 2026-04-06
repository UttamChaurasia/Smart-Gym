const routes = ["/", "/bookings", "/classes", "/equipment", "/trainers", "/workouts", "/leaderboard", "/graphs", "/admin"];
const AUTH_KEY = "smartgym_auth_v1";
const DEMO_EMAIL = "admin@campus.edu";
const DEMO_PASSWORD = "123456";

const el = {
  loginScreen: document.getElementById("loginScreen"),
  appRoot: document.getElementById("appRoot"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),

  sidebarNav: document.getElementById("sidebarNav"),
  scanQrBtn: document.getElementById("scanQrBtn"),
  myQrBtn: document.getElementById("myQrBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  capacityFill: document.getElementById("capacityFill"),
  capacityText: document.getElementById("capacityText"),
  capacityStatus: document.getElementById("capacityStatus"),
  maintenanceList: document.getElementById("maintenanceList"),
  eventsList: document.getElementById("eventsList"),

  openBookingPanel: document.getElementById("openBookingPanel"),
  bookingPanel: document.getElementById("bookingPanel"),
  bookingForm: document.getElementById("bookingForm"),
  bookingEquipment: document.getElementById("bookingEquipment"),
  bookingSlot: document.getElementById("bookingSlot"),
  bookingQrLabel: document.getElementById("bookingQrLabel"),
  bookingsContent: document.getElementById("bookingsContent"),

  openClassPanel: document.getElementById("openClassPanel"),
  classPanel: document.getElementById("classPanel"),
  addClassForm: document.getElementById("addClassForm"),
  className: document.getElementById("className"),
  classInstructor: document.getElementById("classInstructor"),
  classCapacity: document.getElementById("classCapacity"),
  classRegisterForm: document.getElementById("classRegisterForm"),
  classSelect: document.getElementById("classSelect"),
  classQrLabel: document.getElementById("classQrLabel"),
  classesContent: document.getElementById("classesContent"),

  openEquipmentPanel: document.getElementById("openEquipmentPanel"),
  equipmentPanel: document.getElementById("equipmentPanel"),
  addEquipmentForm: document.getElementById("addEquipmentForm"),
  equipName: document.getElementById("equipName"),
  equipType: document.getElementById("equipType"),
  equipmentSearch: document.getElementById("equipmentSearch"),
  equipmentTypeFilter: document.getElementById("equipmentTypeFilter"),
  iotForm: document.getElementById("iotForm"),
  iotEquipment: document.getElementById("iotEquipment"),
  iotMinutes: document.getElementById("iotMinutes"),
  iotQrLabel: document.getElementById("iotQrLabel"),
  equipmentGrid: document.getElementById("equipmentGrid"),

  openTrainerPanel: document.getElementById("openTrainerPanel"),
  trainerPanel: document.getElementById("trainerPanel"),
  addTrainerForm: document.getElementById("addTrainerForm"),
  trainerName: document.getElementById("trainerName"),
  trainerSpec: document.getElementById("trainerSpec"),
  trainerBookingForm: document.getElementById("trainerBookingForm"),
  trainerSelect: document.getElementById("trainerSelect"),
  trainerSlot: document.getElementById("trainerSlot"),
  trainerQrLabel: document.getElementById("trainerQrLabel"),
  trainerBookings: document.getElementById("trainerBookings"),

  openWorkoutPanel: document.getElementById("openWorkoutPanel"),
  workoutPanel: document.getElementById("workoutPanel"),
  workoutForm: document.getElementById("workoutForm"),
  workoutType: document.getElementById("workoutType"),
  workoutDuration: document.getElementById("workoutDuration"),
  workoutQrLabel: document.getElementById("workoutQrLabel"),
  workoutList: document.getElementById("workoutList"),

  leaderboardList: document.getElementById("leaderboardList"),
  barsContainer: document.getElementById("barsContainer"),

  adminPeak: document.getElementById("adminPeak"),
  adminStaff: document.getElementById("adminStaff"),
  adminCheckins: document.getElementById("adminCheckins"),

  scanModal: document.getElementById("scanModal"),
  closeScanModal: document.getElementById("closeScanModal"),
  scannerVideo: document.getElementById("scannerVideo"),
  scanStatus: document.getElementById("scanStatus"),

  myQrModal: document.getElementById("myQrModal"),
  closeMyQrModal: document.getElementById("closeMyQrModal"),
  myQrSelect: document.getElementById("myQrSelect"),
  qrCanvasWrap: document.getElementById("qrCanvasWrap"),
  myQrText: document.getElementById("myQrText")
};

let state = null;
let qrEntries = [];
let cameraStream = null;
let scanLoop = null;
let scanTarget = "checkin";

const selectedQr = {
  booking: "",
  class: "",
  iot: "",
  trainer: "",
  workout: ""
};

function fmtTime(date) {
  return new Date(date).toLocaleString();
}

function slotOptions(count = 8) {
  const slots = [];
  const base = new Date();
  base.setMinutes(0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    slots.push(new Date(base.getTime() + i * 3600000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }
  return slots;
}

function toast(msg) {
  alert(msg);
}

function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

function setAuthenticated(flag) {
  localStorage.setItem(AUTH_KEY, flag ? "1" : "0");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showView(path) {
  const current = routes.includes(path) ? path : "/";
  document.querySelectorAll(".page-view").forEach((v) => v.classList.add("hidden"));
  const id = current === "/" ? "dashboard" : current.slice(1);
  const view = document.getElementById(`view-${id}`);
  if (view) view.classList.remove("hidden");

  document.querySelectorAll("#sidebarNav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-route") === current);
  });
}

function navigate(path) {
  history.pushState({}, "", path);
  showView(path);
}

function setQrLabel(target, value) {
  const safe = value || "No QR selected";
  if (target === "booking") el.bookingQrLabel.textContent = safe;
  if (target === "class") el.classQrLabel.textContent = safe;
  if (target === "iot") el.iotQrLabel.textContent = safe;
  if (target === "trainer") el.trainerQrLabel.textContent = safe;
  if (target === "workout") el.workoutQrLabel.textContent = safe;
}

function requireQr(target) {
  const code = selectedQr[target];
  if (!code) {
    toast("Please scan QR first.");
    return null;
  }
  return code;
}

function renderDashboard() {
  const gym = state.gym;
  const pct = Math.round((gym.currentCapacity / gym.maxCapacity) * 100);
  el.capacityFill.style.width = `${pct}%`;
  el.capacityText.textContent = `${gym.currentCapacity} / ${gym.maxCapacity}`;
  el.capacityStatus.textContent = gym.status;

  el.maintenanceList.innerHTML = state.maintenanceAlerts.length
    ? state.maintenanceAlerts.map((m) => `<li>${m.equipment_name}: ${m.message}</li>`).join("")
    : "<li>No maintenance alerts.</li>";

  el.eventsList.innerHTML = state.events.length
    ? state.events.slice().reverse().slice(0, 10).map((e) => `<li>${fmtTime(e.ts)} - ${e.description}</li>`).join("")
    : "<li>No activity yet.</li>";
}

function renderBookings() {
  el.bookingEquipment.innerHTML = state.equipment.map((eq) => `<option value="${eq.id}">${eq.equipment_name}</option>`).join("");
  el.iotEquipment.innerHTML = state.equipment.map((eq) => `<option value="${eq.id}">${eq.equipment_name}</option>`).join("");

  if (!state.bookings.length && !state.bookingWaitlist.length) {
    el.bookingsContent.innerHTML = '<div class="empty"><div><div class="icon">📅</div><h3>No Bookings Yet</h3><p>Book high-demand equipment to guarantee your spot.</p></div></div>';
    return;
  }

  const confirmed = state.bookings.length
    ? state.bookings.map((b) => `<li>${b.booking_time_slot} - ${b.booked_by_name} -> ${b.equipment_name} <button class="btn light" data-release="${b.id}">Release</button></li>`).join("")
    : "<li>No confirmed bookings.</li>";

  const waitlist = state.bookingWaitlist.length
    ? state.bookingWaitlist.map((w) => `<li>${w.booking_time_slot} - ${w.booked_by_name} waiting for ${w.equipment_name}</li>`).join("")
    : "<li>No waitlist.</li>";

  el.bookingsContent.innerHTML = `<h3>Confirmed Bookings</h3><ul class="list">${confirmed}</ul><h3>Waitlist</h3><ul class="list">${waitlist}</ul>`;

  el.bookingsContent.querySelectorAll("button[data-release]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api("/api/bookings/release", { method: "POST", body: JSON.stringify({ booking_id: btn.getAttribute("data-release") }) });
        await refresh();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function renderClasses() {
  el.classSelect.innerHTML = state.classes.map((c) => `<option value="${c.id}">${c.class_name}</option>`).join("");

  if (!state.classes.length) {
    el.classesContent.innerHTML = '<div class="empty"><div><div class="icon">🎓</div><h3>No Classes Available</h3><p>Add group fitness classes to get started.</p></div></div>';
    return;
  }

  el.classesContent.innerHTML = state.classes.map((c) => `
    <div class="equipment-item">
      <div class="equipment-top">
        <h3>${c.class_name}</h3>
        <span class="status-pill ${c.current_enrolled >= c.max_capacity ? "busy" : "available"}">${c.current_enrolled}/${c.max_capacity}</span>
      </div>
      <p class="muted">Instructor: ${c.instructor}</p>
      <p class="muted">Waitlist: ${c.waitlist_count}</p>
    </div>
  `).join("");
}

function renderEquipment() {
  const query = el.equipmentSearch.value.trim().toLowerCase();
  const type = el.equipmentTypeFilter.value;

  const filtered = state.equipment.filter((eq) => {
    const byType = type === "all" ? true : eq.type === type;
    const bySearch = query ? eq.equipment_name.toLowerCase().includes(query) : true;
    return byType && bySearch;
  });

  if (!filtered.length) {
    el.equipmentGrid.innerHTML = '<article class="card">No equipment found.</article>';
    return;
  }

  el.equipmentGrid.innerHTML = filtered.map((eq) => {
    const usagePct = eq.maintenance_threshold_hours ? Math.min(100, Math.round((eq.total_hours_used / eq.maintenance_threshold_hours) * 100)) : 0;
    return `
      <article class="equipment-item">
        <div class="equipment-top">
          <h3>${eq.equipment_name}</h3>
          <span class="status-pill ${eq.status}">${eq.status}</span>
        </div>
        <p class="muted">${eq.type} · Zone A · Cardio</p>
        <p class="muted">Usage (${eq.total_hours_used.toFixed(1)}h) ${usagePct}%</p>
        <div class="progress"><div style="width:${usagePct}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderTrainers() {
  el.trainerSelect.innerHTML = state.trainers.map((t) => `<option value="${t.trainer_name}">${t.trainer_name}</option>`).join("");
  el.trainerBookings.innerHTML = state.trainerBookings.length
    ? state.trainerBookings.map((b) => `<li>${b.booking_time_slot} - ${b.booked_by_name} with ${b.trainer_name}</li>`).join("")
    : "<li>No trainer bookings yet.</li>";
}

function renderWorkouts() {
  el.workoutList.innerHTML = state.workouts.length
    ? state.workouts.map((w) => `<li>${fmtTime(w.created_at)} - ${w.user_name} | ${w.workout_type} | ${w.duration} mins</li>`).join("")
    : "<li>No workouts logged.</li>";
}

function renderLeaderboard() {
  el.leaderboardList.innerHTML = state.leaderboard.length
    ? state.leaderboard
        .map(
          (u, i) => `
        <div class="leaderboard-row">
          <span class="leaderboard-rank">${String(i + 1).padStart(2, "0")}</span>
          <span>${u.name}</span>
          <span>${u.points}</span>
          <span>${u.streak}</span>
          <span>${u.workoutCount ?? 0}</span>
        </div>
      `
        )
        .join("")
    : `<div class="leaderboard-row"><span class="leaderboard-rank">--</span><span>No ranking data</span><span>-</span><span>-</span><span>-</span></div>`;
}

function averageByHour() {
  const map = {};
  state.gym.capacityHistory.forEach((h) => {
    map[h.hour] = map[h.hour] || [];
    map[h.hour].push(h.value);
  });

  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const profile = {
    6: 8,
    7: 14,
    8: 22,
    9: 30,
    10: 12,
    11: 18,
    12: 34,
    13: 40,
    14: 28,
    15: 24,
    16: 36,
    17: 85,
    18: 92,
    19: 88,
    20: 65,
    21: 30
  };

  return hours.map((hour) => {
    const vals = map[hour] || [];
    const fromHistory = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : profile[hour];
    const base = profile[hour];
    let value = Math.round((fromHistory + base) / 2);

    // Enforce peak window from 5 PM to 8 PM (17:00-20:59).
    if (hour >= 17 && hour <= 20) {
      value = Math.max(value, base);
    }

    return { hour, value };
  });
}

function hourLabel(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}${suffix}`;
}

function renderGraph() {
  const points = averageByHour();
  el.barsContainer.innerHTML = points.map((p) => {
    const h = Math.max(8, Math.min(100, p.value));
    const color = p.value >= 60 ? "var(--high)" : p.value >= 30 ? "var(--med)" : "var(--low)";
    return `<div class="bar-col"><div class="bar" style="height:${h * 2.4}px;background:${color}"></div><div class="bar-label">${hourLabel(p.hour)}</div></div>`;
  }).join("");
}

function renderAdmin() {
  el.adminPeak.textContent = state.dashboard.peakHour;
  el.adminStaff.textContent = state.dashboard.staffingSuggestion;
  el.adminCheckins.textContent = String(state.dashboard.activeCheckins);
}

function renderAll() {
  renderDashboard();
  renderBookings();
  renderClasses();
  renderEquipment();
  renderTrainers();
  renderWorkouts();
  renderLeaderboard();
  renderGraph();
  renderAdmin();
}

async function refresh() {
  state = await api("/api/state");
  renderAll();
}

async function loadQrEntries() {
  const data = await api("/api/qr/sample-codes");
  qrEntries = data.entries;
  el.myQrSelect.innerHTML = qrEntries.map((q) => `<option value="${q.qrCode}">${q.student.name}</option>`).join("");
  drawMyQr();
}

function drawMyQr() {
  const qrCode = el.myQrSelect.value;
  const selected = qrEntries.find((x) => x.qrCode === qrCode);
  el.qrCanvasWrap.innerHTML = "";
  if (!window.QRCode) {
    el.qrCanvasWrap.textContent = "QR library failed to load.";
    return;
  }

  new window.QRCode(el.qrCanvasWrap, {
    text: qrCode,
    width: 200,
    height: 200,
    colorDark: "#0b1b3a",
    colorLight: "#ffffff"
  });

  el.myQrText.textContent = selected ? `${selected.student.name} - ${qrCode}` : qrCode;
}

async function processScannedCode(code) {
  if (scanTarget === "checkin") {
    el.scanStatus.textContent = `Detected: ${code}. Checking in...`;
    try {
      const result = await api("/api/qr/checkin", { method: "POST", body: JSON.stringify({ qrCode: code, action: "toggle" }) });
      toast(result.message);
      await refresh();
    } catch (err) {
      el.scanStatus.textContent = err.message;
      return;
    }
  } else {
    selectedQr[scanTarget] = code;
    setQrLabel(scanTarget, `Selected: ${code}`);
    toast(`QR selected for ${scanTarget}`);
  }

  stopCameraScan();
  el.scanModal.classList.add("hidden");
}

async function startCameraScan(target) {
  scanTarget = target;

  if (!navigator.mediaDevices?.getUserMedia) {
    el.scanStatus.textContent = "Camera access is not supported in this browser.";
    return;
  }

  if (!window.BarcodeDetector) {
    el.scanStatus.textContent = "BarcodeDetector not supported. Use Chrome/Edge for camera QR scanning.";
    return;
  }

  const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
  cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  el.scannerVideo.srcObject = cameraStream;
  el.scanStatus.textContent = "Scanning... point camera at QR code.";

  scanLoop = setInterval(async () => {
    try {
      const codes = await detector.detect(el.scannerVideo);
      if (codes && codes.length) {
        const raw = codes[0].rawValue;
        if (raw) await processScannedCode(raw.trim());
      }
    } catch {
      // keep scanning
    }
  }, 320);
}

function stopCameraScan() {
  if (scanLoop) {
    clearInterval(scanLoop);
    scanLoop = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }

  el.scannerVideo.srcObject = null;
}

function bindRouter() {
  document.querySelectorAll("#sidebarNav a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.getAttribute("data-route"));
    });
  });

  window.addEventListener("popstate", () => {
    showView(location.pathname);
  });
}

function bindActions() {
  el.bookingSlot.innerHTML = slotOptions(8).map((s) => `<option value="${s}">${s}</option>`).join("");
  el.trainerSlot.innerHTML = slotOptions(6).map((s) => `<option value="${s}">${s}</option>`).join("");

  el.openBookingPanel.addEventListener("click", () => el.bookingPanel.classList.toggle("hidden"));
  el.openClassPanel.addEventListener("click", () => el.classPanel.classList.toggle("hidden"));
  el.openEquipmentPanel.addEventListener("click", () => el.equipmentPanel.classList.toggle("hidden"));
  el.openTrainerPanel.addEventListener("click", () => el.trainerPanel.classList.toggle("hidden"));
  el.openWorkoutPanel.addEventListener("click", () => el.workoutPanel.classList.toggle("hidden"));

  el.scanQrBtn.addEventListener("click", async () => {
    el.scanModal.classList.remove("hidden");
    await startCameraScan("checkin");
  });

  document.querySelectorAll(".scan-target").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = btn.getAttribute("data-target");
      el.scanModal.classList.remove("hidden");
      await startCameraScan(target);
    });
  });

  document.querySelectorAll(".enter-code-target").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      const code = prompt("Enter QR code value (example: QR-ADITI-001):", selectedQr[target] || "");
      if (!code) return;
      selectedQr[target] = code.trim();
      setQrLabel(target, `Selected: ${selectedQr[target]}`);
      toast(`Code set for ${target}`);
    });
  });

  el.closeScanModal.addEventListener("click", () => {
    stopCameraScan();
    el.scanModal.classList.add("hidden");
    el.scanStatus.textContent = "Scanner stopped.";
  });

  el.myQrBtn.addEventListener("click", () => {
    el.myQrModal.classList.remove("hidden");
    drawMyQr();
  });

  el.closeMyQrModal.addEventListener("click", () => {
    el.myQrModal.classList.add("hidden");
  });

  el.myQrSelect.addEventListener("change", drawMyQr);

  el.logoutBtn.addEventListener("click", () => {
    setAuthenticated(false);
    location.reload();
  });

  el.equipmentSearch.addEventListener("input", renderEquipment);
  el.equipmentTypeFilter.addEventListener("change", renderEquipment);

  el.bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const qrCode = requireQr("booking");
    if (!qrCode) return;

    try {
      const result = await api("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({ qrCode, equipment_id: el.bookingEquipment.value, booking_time_slot: el.bookingSlot.value })
      });
      toast(result.message);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.addClassForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/classes/add", {
        method: "POST",
        body: JSON.stringify({ class_name: el.className.value.trim(), instructor: el.classInstructor.value.trim(), max_capacity: Number(el.classCapacity.value) })
      });
      el.className.value = "";
      el.classInstructor.value = "";
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.classRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const qrCode = requireQr("class");
    if (!qrCode) return;

    try {
      const result = await api("/api/classes/register", {
        method: "POST",
        body: JSON.stringify({ qrCode, class_id: el.classSelect.value })
      });
      toast(result.message);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.addEquipmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/equipment/add", {
        method: "POST",
        body: JSON.stringify({ equipment_name: el.equipName.value.trim(), type: el.equipType.value.trim().toLowerCase() })
      });
      el.equipName.value = "";
      el.equipType.value = "";
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.iotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const qrCode = requireQr("iot");
    if (!qrCode) return;

    try {
      const result = await api("/api/iot/session", {
        method: "POST",
        body: JSON.stringify({ qrCode, equipment_id: el.iotEquipment.value, minutes: Number(el.iotMinutes.value) })
      });
      toast(result.message);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.addTrainerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/trainers/add", {
        method: "POST",
        body: JSON.stringify({ trainer_name: el.trainerName.value.trim(), specialization: el.trainerSpec.value.trim().toLowerCase() })
      });
      el.trainerName.value = "";
      el.trainerSpec.value = "";
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.trainerBookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const qrCode = requireQr("trainer");
    if (!qrCode) return;

    try {
      const result = await api("/api/trainers/book", {
        method: "POST",
        body: JSON.stringify({ qrCode, trainer_name: el.trainerSelect.value, booking_time_slot: el.trainerSlot.value })
      });
      toast(result.message);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.workoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const qrCode = requireQr("workout");
    if (!qrCode) return;

    try {
      const result = await api("/api/workouts/log", {
        method: "POST",
        body: JSON.stringify({ qrCode, workout_type: el.workoutType.value.toLowerCase(), duration: Number(el.workoutDuration.value) })
      });
      toast(result.message);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });
}

function bindAuth() {
  el.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = el.loginEmail.value.trim().toLowerCase();
    const password = el.loginPassword.value;

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      setAuthenticated(true);
      el.loginError.textContent = "";
      startApp();
      return;
    }

    el.loginError.textContent = "Invalid email or password.";
  });
}

async function startApp() {
  el.loginScreen.classList.add("hidden");
  el.appRoot.classList.remove("hidden");

  if (!el.appRoot.dataset.started) {
    bindRouter();
    bindActions();
    el.appRoot.dataset.started = "1";
  }

  showView(location.pathname);
  await loadQrEntries();
  await refresh();
}

async function bootstrap() {
  bindAuth();

  if (isAuthenticated()) {
    await startApp();
  }

  setInterval(async () => {
    if (!isAuthenticated() || !state) return;
    await refresh();
  }, 5000);
}

bootstrap().catch((err) => {
  console.error(err);
  alert("Unable to start app. Ensure backend is running with npm start.");
});
