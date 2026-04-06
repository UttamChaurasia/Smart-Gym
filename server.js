const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const state = {
  gym: {
    maxCapacity: 120,
    currentCapacity: 44,
    capacityHistory: []
  },
  students: {
    "QR-ADITI-001": {
      id: "stu-1",
      name: "Aditi Sharma",
      email: "aditi@campus.edu",
      points: 32,
      streak: 4,
      lastVisitDate: "2026-04-05",
      isCheckedIn: false
    },
    "QR-RAHUL-002": {
      id: "stu-2",
      name: "Rahul Verma",
      email: "rahul@campus.edu",
      points: 21,
      streak: 2,
      lastVisitDate: "2026-04-05",
      isCheckedIn: false
    },
    "QR-PRIYA-003": {
      id: "stu-3",
      name: "Priya Nair",
      email: "priya@campus.edu",
      points: 40,
      streak: 6,
      lastVisitDate: "2026-04-04",
      isCheckedIn: false
    }
  },
  checkins: [],
  equipment: [
    {
      id: "eq-1",
      equipment_name: "Treadmill 01",
      type: "treadmill",
      status: "available",
      total_hours_used: 178,
      total_miles: 432,
      maintenance_threshold_hours: 200,
      maintenance_threshold_miles: 500
    },
    {
      id: "eq-2",
      equipment_name: "Treadmill 02",
      type: "treadmill",
      status: "maintenance_due",
      total_hours_used: 203,
      total_miles: 509,
      maintenance_threshold_hours: 200,
      maintenance_threshold_miles: 500
    },
    {
      id: "eq-3",
      equipment_name: "Bike A",
      type: "bike",
      status: "available",
      total_hours_used: 121,
      total_miles: 282,
      maintenance_threshold_hours: 210,
      maintenance_threshold_miles: 450
    },
    {
      id: "eq-4",
      equipment_name: "Rower A",
      type: "rower",
      status: "available",
      total_hours_used: 92,
      total_miles: 196,
      maintenance_threshold_hours: 180,
      maintenance_threshold_miles: 400
    }
  ],
  bookings: [],
  bookingWaitlist: [],
  classes: [
    {
      id: "class-1",
      class_name: "Yoga Flow",
      instructor: "Meera",
      max_capacity: 20,
      current_enrolled: 0,
      waitlist_count: 0,
      participants: [],
      waitlist: []
    },
    {
      id: "class-2",
      class_name: "Zumba Burn",
      instructor: "Sana",
      max_capacity: 18,
      current_enrolled: 0,
      waitlist_count: 0,
      participants: [],
      waitlist: []
    }
  ],
  trainers: [
    { id: "tr-1", trainer_name: "Karan", specialization: "strength", bio: "Power and barbell coach", status: "available" },
    { id: "tr-2", trainer_name: "Meera", specialization: "mobility", bio: "Flexibility and posture expert", status: "available" },
    { id: "tr-3", trainer_name: "Sana", specialization: "cardio", bio: "Endurance and conditioning", status: "available" }
  ],
  trainerBookings: [],
  workouts: [],
  events: []
};

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return nowIso().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function hourDemandTarget(hour) {
  if (hour >= 17 && hour < 20) return 102;
  if (hour >= 6 && hour < 9) return 72;
  if (hour >= 20 && hour < 22) return 60;
  if (hour >= 10 && hour < 16) return 46;
  return 30;
}

function recalcCapacity(mode = "auto") {
  const hour = new Date().getHours();
  const target = hourDemandTarget(hour);

  if (mode === "rush") {
    state.gym.currentCapacity = Math.min(state.gym.maxCapacity, state.gym.currentCapacity + 18);
  } else if (mode === "drop") {
    state.gym.currentCapacity = Math.max(6, state.gym.currentCapacity - 14);
  } else {
    const drift = target - state.gym.currentCapacity;
    const noise = Math.round((Math.random() - 0.5) * 9);
    const delta = Math.round(drift * 0.25 + noise);
    state.gym.currentCapacity = Math.max(6, Math.min(state.gym.maxCapacity, state.gym.currentCapacity + delta));
  }

  state.gym.capacityHistory.push({ hour, value: state.gym.currentCapacity, ts: nowIso() });
  if (state.gym.capacityHistory.length > 200) state.gym.capacityHistory.shift();
}

function statusFromCapacity() {
  const pct = (state.gym.currentCapacity / state.gym.maxCapacity) * 100;
  if (pct >= 85) return "overcrowded";
  if (pct >= 65) return "busy";
  return "comfortable";
}

function studentByQr(qrCode) {
  return state.students[qrCode] || null;
}

function updateStreak(student) {
  const t = today();
  const y = yesterday();
  if (student.lastVisitDate === t) return;
  if (student.lastVisitDate === y) student.streak += 1;
  else student.streak = 1;
  student.lastVisitDate = t;
}

function awardPoints(student, points) {
  student.points += points;
  updateStreak(student);
}

function equipmentById(id) {
  return state.equipment.find((e) => e.id === id) || null;
}

function refreshClassCounts(cls) {
  cls.current_enrolled = cls.participants.length;
  cls.waitlist_count = cls.waitlist.length;
}

function maintenanceAlerts() {
  return state.equipment
    .filter(
      (e) =>
        e.total_hours_used >= e.maintenance_threshold_hours ||
        e.total_miles >= e.maintenance_threshold_miles
    )
    .map((e) => ({
      equipment_id: e.id,
      equipment_name: e.equipment_name,
      status: "maintenance_due",
      message: `${e.equipment_name} crossed maintenance threshold.`
    }));
}

function dashboardSummary() {
  const byHour = {};
  state.gym.capacityHistory.forEach((h) => {
    byHour[h.hour] = byHour[h.hour] || [];
    byHour[h.hour].push(h.value);
  });

  const points = Object.entries(byHour).map(([hour, values]) => ({
    hour: Number(hour),
    avg: values.reduce((a, b) => a + b, 0) / values.length
  }));

  if (!points.length) {
    return {
      peakHour: "N/A",
      staffingSuggestion: "2 floor staff + 2 trainers",
      activeCheckins: state.checkins.filter((c) => c.is_active).length
    };
  }

  points.sort((a, b) => b.avg - a.avg);
  const peak = points[0];

  let floor = 2;
  let trainers = 2;
  if (peak.avg >= 90) {
    floor = 5;
    trainers = 4;
  } else if (peak.avg >= 70) {
    floor = 4;
    trainers = 3;
  } else if (peak.avg >= 50) {
    floor = 3;
    trainers = 2;
  }

  return {
    peakHour: `${String(peak.hour).padStart(2, "0")}:00`,
    staffingSuggestion: `${floor} floor staff + ${trainers} trainers`,
    activeCheckins: state.checkins.filter((c) => c.is_active).length
  };
}

function leaderboard() {
  return Object.values(state.students)
    .map((s) => ({
      name: s.name,
      email: s.email,
      points: s.points,
      streak: s.streak,
      workoutCount: state.workouts.filter((w) => w.user_email === s.email).length
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.streak - a.streak;
    });
}

function snapshot() {
  return {
    serverTime: nowIso(),
    gym: {
      ...state.gym,
      status: statusFromCapacity()
    },
    checkins: state.checkins,
    equipment: state.equipment,
    bookings: state.bookings,
    bookingWaitlist: state.bookingWaitlist,
    classes: state.classes,
    trainers: state.trainers,
    trainerBookings: state.trainerBookings,
    workouts: state.workouts.slice(0, 60),
    maintenanceAlerts: maintenanceAlerts(),
    leaderboard: leaderboard(),
    dashboard: dashboardSummary(),
    events: state.events.slice(-35)
  };
}

app.get("/api/state", (req, res) => {
  res.json(snapshot());
});

app.get("/api/qr/sample-codes", (req, res) => {
  const entries = Object.entries(state.students).map(([qrCode, student]) => ({
    qrCode,
    student: {
      name: student.name,
      email: student.email
    }
  }));

  res.json({ entries });
});

app.post("/api/qr/checkin", (req, res) => {
  const qrCode = (req.body?.qrCode || "").trim();
  const action = (req.body?.action || "toggle").trim();

  const student = studentByQr(qrCode);
  if (!student) return res.status(404).json({ error: "Invalid QR code" });

  const active = state.checkins.find((c) => c.user_email === student.email && c.is_active);

  if (action === "checkout" || (action === "toggle" && active)) {
    if (active) {
      active.is_active = false;
      active.check_out_time = nowIso();
    }
    student.isCheckedIn = false;
    state.events.push({ type: "checkout", description: `${student.name} checked out`, ts: nowIso() });
    return res.json({ message: `${student.name} checked out`, student });
  }

  if (!active) {
    state.checkins.unshift({
      id: `chk-${Date.now()}`,
      user_email: student.email,
      user_name: student.name,
      check_in_time: nowIso(),
      is_active: true
    });
  }

  student.isCheckedIn = true;
  awardPoints(student, 2);
  state.events.push({ type: "checkin", description: `${student.name} checked in`, ts: nowIso() });
  return res.json({ message: `${student.name} checked in`, student });
});

app.post("/api/bookings/create", (req, res) => {
  const qrCode = (req.body?.qrCode || "").trim();
  const equipmentId = (req.body?.equipment_id || "").trim();
  const timeSlot = (req.body?.booking_time_slot || "").trim();

  const student = studentByQr(qrCode);
  if (!student) return res.status(404).json({ error: "Invalid QR code" });

  const equipment = equipmentById(equipmentId);
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });

  if (!timeSlot) return res.status(400).json({ error: "Time slot is required" });

  const hasSameSlot = state.bookings.some(
    (b) => b.booked_by_email === student.email && b.booking_time_slot === timeSlot && b.status === "confirmed"
  );
  if (hasSameSlot) {
    return res.status(409).json({ error: "You already have a booking in this slot" });
  }

  const conflicting = state.bookings.find(
    (b) =>
      b.equipment_id === equipment.id &&
      b.booking_time_slot === timeSlot &&
      b.status === "confirmed"
  );

  // Exclusive lock: if booked treadmill exists, no one else can use that treadmill in that slot.
  if (conflicting || equipment.status === "maintenance_due") {
    state.bookingWaitlist.push({
      id: `wait-${Date.now()}`,
      equipment_id: equipment.id,
      equipment_name: equipment.equipment_name,
      booked_by_name: student.name,
      booked_by_email: student.email,
      booking_date: nowIso(),
      booking_time_slot: timeSlot,
      status: "waitlisted"
    });

    return res.status(202).json({ message: `Added to waitlist for ${equipment.equipment_name}` });
  }

  const booking = {
    id: `book-${Date.now()}`,
    equipment_id: equipment.id,
    equipment_name: equipment.equipment_name,
    booked_by_name: student.name,
    booked_by_email: student.email,
    booking_date: nowIso(),
    booking_time_slot: timeSlot,
    status: "confirmed"
  };

  state.bookings.unshift(booking);
  awardPoints(student, 5);
  state.events.push({ type: "booking", description: `${student.name} booked ${equipment.equipment_name} at ${timeSlot}`, ts: nowIso() });

  return res.json({ message: "Booking confirmed", booking });
});

app.post("/api/bookings/release", (req, res) => {
  const bookingId = (req.body?.booking_id || "").trim();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  state.bookings = state.bookings.filter((b) => b.id !== bookingId);

  const next = state.bookingWaitlist.find(
    (w) => w.equipment_id === booking.equipment_id && w.booking_time_slot === booking.booking_time_slot
  );

  if (next) {
    state.bookingWaitlist = state.bookingWaitlist.filter((w) => w.id !== next.id);
    state.bookings.unshift({ ...next, id: `book-${Date.now()}`, status: "confirmed" });
  }

  return res.json({ message: "Booking released" });
});

app.post("/api/iot/session", (req, res) => {
  const qrCode = (req.body?.qrCode || "").trim();
  const equipmentId = (req.body?.equipment_id || "").trim();
  const minutes = Number(req.body?.minutes || 30);

  const student = studentByQr(qrCode);
  if (!student) return res.status(404).json({ error: "Invalid QR code" });

  const equipment = equipmentById(equipmentId);
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });

  const hasBooking = state.bookings.some(
    (b) => b.booked_by_email === student.email && b.equipment_id === equipment.id && b.status === "confirmed"
  );

  if (!hasBooking) {
    return res.status(409).json({ error: "No confirmed booking found for this QR and equipment" });
  }

  const sessionMins = Math.max(5, Math.min(90, minutes));
  equipment.total_hours_used += sessionMins / 60;
  equipment.total_miles += Number((Math.random() * 2.4 + sessionMins / 20).toFixed(2));

  if (
    equipment.total_hours_used >= equipment.maintenance_threshold_hours ||
    equipment.total_miles >= equipment.maintenance_threshold_miles
  ) {
    equipment.status = "maintenance_due";
  }

  awardPoints(student, Math.max(2, Math.round(sessionMins / 10)));

  state.events.push({
    type: "iot",
    description: `${student.name} used ${equipment.equipment_name} for ${sessionMins} minutes`,
    ts: nowIso()
  });

  res.json({ message: "IoT session logged", equipment, student });
});

app.post("/api/equipment/add", (req, res) => {
  const equipment_name = (req.body?.equipment_name || "").trim();
  const type = (req.body?.type || "general").trim().toLowerCase();

  if (!equipment_name) return res.status(400).json({ error: "Equipment name is required" });

  const item = {
    id: `eq-${Date.now()}`,
    equipment_name,
    type,
    status: "available",
    total_hours_used: 0,
    total_miles: 0,
    maintenance_threshold_hours: Number(req.body?.maintenance_threshold_hours || 200),
    maintenance_threshold_miles: Number(req.body?.maintenance_threshold_miles || 500)
  };

  state.equipment.unshift(item);
  res.json({ message: "Equipment added", item });
});

app.post("/api/classes/add", (req, res) => {
  const class_name = (req.body?.class_name || "").trim();
  const instructor = (req.body?.instructor || "").trim();
  const max_capacity = Number(req.body?.max_capacity || 20);

  if (!class_name || !instructor) {
    return res.status(400).json({ error: "Class name and instructor are required" });
  }

  const cls = {
    id: `class-${Date.now()}`,
    class_name,
    instructor,
    max_capacity,
    current_enrolled: 0,
    waitlist_count: 0,
    participants: [],
    waitlist: []
  };

  state.classes.unshift(cls);
  res.json({ message: "Class added", class: cls });
});

app.post("/api/classes/register", (req, res) => {
  const qrCode = (req.body?.qrCode || "").trim();
  const classId = (req.body?.class_id || "").trim();

  const student = studentByQr(qrCode);
  if (!student) return res.status(404).json({ error: "Invalid QR code" });

  const cls = state.classes.find((c) => c.id === classId);
  if (!cls) return res.status(404).json({ error: "Class not found" });

  if (cls.participants.some((p) => p.email === student.email) || cls.waitlist.some((p) => p.email === student.email)) {
    return res.status(409).json({ error: "Already registered or waitlisted" });
  }

  if (cls.participants.length < cls.max_capacity) {
    cls.participants.push({ name: student.name, email: student.email });
    awardPoints(student, 4);
  } else {
    cls.waitlist.push({ name: student.name, email: student.email });
    awardPoints(student, 1);
  }

  refreshClassCounts(cls);
  res.json({ message: "Class registration updated", class: cls });
});

app.post("/api/trainers/add", (req, res) => {
  const trainer_name = (req.body?.trainer_name || "").trim();
  const specialization = (req.body?.specialization || "general").trim().toLowerCase();
  const bio = (req.body?.bio || "").trim();

  if (!trainer_name) return res.status(400).json({ error: "Trainer name is required" });

  const trainer = {
    id: `tr-${Date.now()}`,
    trainer_name,
    specialization,
    bio,
    status: "available"
  };

  state.trainers.unshift(trainer);
  res.json({ message: "Trainer added", trainer });
});

app.post("/api/trainers/book", (req, res) => {
  const qrCode = (req.body?.qrCode || "").trim();
  const trainer_name = (req.body?.trainer_name || "").trim();
  const booking_time_slot = (req.body?.booking_time_slot || "").trim();

  const student = studentByQr(qrCode);
  if (!student) return res.status(404).json({ error: "Invalid QR code" });

  const trainer = state.trainers.find((t) => t.trainer_name === trainer_name);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  const conflict = state.trainerBookings.some(
    (b) => b.trainer_name === trainer_name && b.booking_time_slot === booking_time_slot
  );

  if (conflict) {
    return res.status(409).json({ error: "Trainer already booked in this slot" });
  }

  const booking = {
    id: `tbook-${Date.now()}`,
    trainer_name,
    booked_by_name: student.name,
    booked_by_email: student.email,
    booking_time_slot,
    booking_date: nowIso()
  };

  state.trainerBookings.unshift(booking);
  awardPoints(student, 5);
  res.json({ message: "Trainer booked", booking });
});

app.post("/api/workouts/log", (req, res) => {
  const qrCode = (req.body?.qrCode || "").trim();
  const workout_type = (req.body?.workout_type || "strength").trim().toLowerCase();
  const duration = Number(req.body?.duration || 45);

  const student = studentByQr(qrCode);
  if (!student) return res.status(404).json({ error: "Invalid QR code" });

  const log = {
    id: `wo-${Date.now()}`,
    user_email: student.email,
    user_name: student.name,
    workout_type,
    duration: Math.max(5, Math.min(240, duration)),
    created_at: nowIso()
  };

  state.workouts.unshift(log);
  if (state.workouts.length > 250) state.workouts.pop();

  awardPoints(student, Math.max(2, Math.round(log.duration / 20)));
  res.json({ message: "Workout logged", log });
});

app.post("/api/simulate-capacity", (req, res) => {
  const mode = (req.body?.mode || "auto").trim();
  recalcCapacity(mode);
  res.json({ gym: state.gym, status: statusFromCapacity() });
});

setInterval(() => {
  recalcCapacity("auto");
}, 4500);

setInterval(() => {
  const eq = state.equipment[Math.floor(Math.random() * state.equipment.length)];
  eq.total_hours_used += 0.02;
  eq.total_miles += Number((Math.random() * 0.25).toFixed(2));
  if (
    eq.total_hours_used >= eq.maintenance_threshold_hours ||
    eq.total_miles >= eq.maintenance_threshold_miles
  ) {
    eq.status = "maintenance_due";
  }
}, 3500);

const appRoutes = [
  "/",
  "/bookings",
  "/classes",
  "/equipment",
  "/trainers",
  "/workouts",
  "/leaderboard", "/graphs", "/admin"
];

app.get(appRoutes, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Smart Gym server running at http://localhost:${PORT}`);
});