const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");
const multer = require("multer");
const crypto = require("crypto");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-before-deployment";
const frontendRoot = path.resolve(__dirname, "..");
const uploadRoot = path.join(frontendRoot, "uploads");
const eventUploadDir = path.join(uploadRoot, "events");
const paymentUploadDir = path.join(uploadRoot, "payments");
const certificateDir = path.join(uploadRoot, "certificates");
[eventUploadDir, paymentUploadDir, certificateDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));
const db = new sqlite3.Database(path.join(__dirname, "nxture.db"));
const COLLEGE_NAME = "ATME College of Engineering";
const OTP_MINUTES = 5;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadRoot));
app.use(express.static(frontendRoot));

const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (e) { e ? reject(e) : resolve({ id: this.lastID, changes: this.changes }); }));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (e, row) => e ? reject(e) : resolve(row)));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows)));

function createToken(user) { return jwt.sign({ id: user.id, role: user.role, college: user.college }, JWT_SECRET, { expiresIn: "7d" }); }
function studentEmailValid(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email); }
function facultyEmailValid(email) { return /^[^\s@]+@atme\.edu\.in$/i.test(email); }
function collegeEmailValid(email, role) { return role === "student" ? studentEmailValid(email) : role === "faculty" ? facultyEmailValid(email) : false; }
function generateOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function otpHash(otp) { return bcrypt.hashSync(otp, 10); }
function otpHtml(otp, role) { const who = role === "faculty" ? "Faculty" : "Student"; return `<div style="font-family:Arial,sans-serif;background:#f4f7f6;padding:32px"><div style="max-width:560px;margin:auto;background:white;border-radius:18px;padding:32px;border:1px solid #e5ebe8"><h2 style="color:#153d35">NXTURE Campus Event OS</h2><p>College ${who} email verification</p><div style="margin:24px 0;padding:18px;text-align:center;background:#eef7f4;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;color:#16796b">${otp}</div><p>This OTP expires in ${OTP_MINUTES} minutes. Do not share it.</p></div></div>`; }
async function sendOtpEmail(email, role, otp) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new Error("Email service is not configured. Add EMAIL_USER and EMAIL_PASS to backend/.env.");
  const transporter = nodemailer.createTransport({ service: process.env.EMAIL_SERVICE || "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  await transporter.sendMail({ from: `NXTURE Campus Event OS <${process.env.EMAIL_USER}>`, to: email, subject: "NXTURE College Email Verification OTP", html: otpHtml(otp, role) });
}

async function sendRegistrationSuccessEmail({ email, studentName, eventTitle, organizerCollege, participationType, isPaid, paymentReference }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new Error("Email service is not configured. Add EMAIL_USER and EMAIL_PASS to backend/.env.");
  const transporter = nodemailer.createTransport({ service: process.env.EMAIL_SERVICE || "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const participationLabel = participationType === "inter_college" ? "Inter-college" : participationType === "open" ? "Open to all colleges" : "Organizing college only";
  const paymentLine = isPaid ? `<p><strong>Payment status:</strong> Pending verification${paymentReference ? ` (Reference: ${paymentReference})` : ""}</p>` : `<p><strong>Payment:</strong> Free event</p>`;
  const html = `<div style="font-family:Arial,sans-serif;background:#f4f7f6;padding:32px"><div style="max-width:600px;margin:auto;background:white;border-radius:18px;padding:32px;border:1px solid #e5ebe8"><h2 style="color:#153d35">NXTURE Campus Event OS</h2><h3>Event Registration Successful</h3><p>Hello ${studentName || "Student"},</p><p>Your registration for <strong>${eventTitle}</strong> has been successfully recorded on NXTURE.</p><div style="background:#eef7f4;border-radius:12px;padding:18px;margin:20px 0"><p><strong>Event:</strong> ${eventTitle}</p><p><strong>Organizer:</strong> ${organizerCollege || "—"}</p><p><strong>Participation:</strong> ${participationLabel}</p>${paymentLine}</div><p>You can view the event, updates, phase results and your registration QR from your NXTURE dashboard.</p><p>Regards,<br><strong>Team NXTURE</strong></p></div></div>`;
  await transporter.sendMail({ from: `NXTURE Campus Event OS <${process.env.EMAIL_USER}>`, to: email, subject: `Registration Successful – ${eventTitle}`, html });
}
async function sendPaymentStatusEmail({ email, studentName, eventTitle, paymentReference, status, fee }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new Error("Email service is not configured. Add EMAIL_USER and EMAIL_PASS to backend/.env.");
  const transporter = nodemailer.createTransport({ service: process.env.EMAIL_SERVICE || "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const verified = status === "verified";
  const subject = verified ? `Payment Verified – ${eventTitle}` : `Payment Rejected – ${eventTitle}`;
  const heading = verified ? "Payment Verified" : "Payment Rejected";
  const message = verified
    ? "Your payment has been successfully verified and your event registration is confirmed."
    : "Your payment could not be verified. Please contact the event team if you believe this was a mistake.";
  const html = `<div style="font-family:Arial,sans-serif;background:#f4f7f6;padding:32px"><div style="max-width:600px;margin:auto;background:white;border-radius:18px;padding:32px;border:1px solid #e5ebe8"><h2 style="color:#153d35">NXTURE Campus Event OS</h2><h3>${heading}</h3><p>Hello ${studentName || "Student"},</p><p>${message}</p><div style="background:#eef7f4;border-radius:12px;padding:18px;margin:20px 0"><p><strong>Event:</strong> ${eventTitle}</p><p><strong>Payment reference:</strong> ${paymentReference || "—"}</p><p><strong>Amount:</strong> ₹${fee ?? "—"}</p><p><strong>Payment status:</strong> ${verified ? "Verified" : "Rejected"}</p></div><p>Regards,<br><strong>Team NXTURE</strong></p></div></div>`;
  await transporter.sendMail({ from: `NXTURE Campus Event OS <${process.env.EMAIL_USER}>`, to: email, subject, html });
}
async function saveOtp(email, role, otp, expiresAt) {
  const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
  const hash = otpHash(otp);
  if (existing) await run("UPDATE users SET otp_hash=?,otp_expires_at=?,otp_attempts=0,role=? WHERE id=?", [hash, expiresAt, role, existing.id]);
  else await run(`INSERT INTO users(first_name,last_name,email,college,password_hash,role,email_verified,otp_hash,otp_expires_at,otp_attempts) VALUES('Pending','User',?,?,? ,?,0,?,?,0)`, [email, COLLEGE_NAME, "PENDING", role, hash, expiresAt]);
}
async function verifyOtp(email, otp) {
  const user = await get("SELECT id,otp_hash,otp_expires_at,otp_attempts FROM users WHERE email=?", [email]);
  if (!user || !user.otp_hash) return { ok: false, message: "Request a new OTP first." };
  if (new Date(user.otp_expires_at).getTime() < Date.now()) { await run("UPDATE users SET otp_hash=NULL,otp_expires_at=NULL,otp_attempts=0 WHERE id=?", [user.id]); return { ok: false, message: "OTP has expired. Request a new OTP." }; }
  if (user.otp_attempts >= 5) return { ok: false, message: "Too many incorrect attempts. Request a new OTP." };
  if (!bcrypt.compareSync(String(otp), user.otp_hash)) { await run("UPDATE users SET otp_attempts=otp_attempts+1 WHERE id=?", [user.id]); return { ok: false, message: "Invalid OTP." }; }
  await run("UPDATE users SET email_verified=1,otp_hash=NULL,otp_expires_at=NULL,otp_attempts=0 WHERE id=?", [user.id]);
  return { ok: true };
}
function auth(requiredRole) {
  return async (req, res, next) => {
    const token = (req.headers.authorization || "").startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (requiredRole && decoded.role !== requiredRole) return res.status(403).json({ message: "You do not have permission for this resource." });
      const user = await get("SELECT id,first_name,last_name,email,student_id,college,department,year,designation,role FROM users WHERE id=?", [decoded.id]);
      if (!user) return res.status(401).json({ message: "User account no longer exists." });
      req.user = user; next();
    } catch { res.status(401).json({ message: "Invalid or expired session." }); }
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === "paymentQr" ? paymentUploadDir : eventUploadDir),
  filename: (req, file, cb) => {
    const safe = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,9)}${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new Error("Only JPG, PNG or WEBP images are allowed."));
    cb(null, true);
  }
});

async function initDatabase() {
  await run("PRAGMA foreign_keys = ON");
  const existing = await get("SELECT name,sql FROM sqlite_master WHERE type='table' AND name='users'");
  if (!existing) {
    await run(`CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,first_name TEXT NOT NULL,last_name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,student_id TEXT UNIQUE,college TEXT NOT NULL,department TEXT,year INTEGER,designation TEXT,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('student','faculty','admin')),email_verified INTEGER NOT NULL DEFAULT 0,otp_hash TEXT,otp_expires_at TEXT,otp_attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  } else {
    const cols = await all("PRAGMA table_info(users)"); const names = cols.map(c => c.name);
    for (const [name,type] of [["designation","TEXT"],["email_verified","INTEGER NOT NULL DEFAULT 0"],["otp_hash","TEXT"],["otp_expires_at","TEXT"],["otp_attempts","INTEGER NOT NULL DEFAULT 0"]]) if (!names.includes(name)) await run(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    if (existing.sql && existing.sql.includes("CHECK(role IN ('student', 'admin'))")) {
      await run(`CREATE TABLE users_new(id INTEGER PRIMARY KEY AUTOINCREMENT,first_name TEXT NOT NULL,last_name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,student_id TEXT UNIQUE,college TEXT NOT NULL,department TEXT,year INTEGER,designation TEXT,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('student','faculty','admin')),email_verified INTEGER NOT NULL DEFAULT 0,otp_hash TEXT,otp_expires_at TEXT,otp_attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await run(`INSERT INTO users_new(id,first_name,last_name,email,student_id,college,department,year,password_hash,role,created_at,designation,email_verified,otp_hash,otp_expires_at,otp_attempts) SELECT id,first_name,last_name,email,student_id,college,department,year,password_hash,role,created_at,designation,email_verified,otp_hash,otp_expires_at,otp_attempts FROM users`);
      await run("DROP TABLE users"); await run("ALTER TABLE users_new RENAME TO users");
    }
  }
  const eventTable = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='events'");
  if (!eventTable) await run(`CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,college TEXT NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,date TEXT NOT NULL,time TEXT NOT NULL,venue TEXT NOT NULL,capacity INTEGER,registration_start TEXT,registration_end TEXT,image_url TEXT,is_paid INTEGER NOT NULL DEFAULT 0,registration_fee REAL NOT NULL DEFAULT 0,payment_qr_url TEXT,responsible_faculty_id INTEGER,status TEXT NOT NULL DEFAULT 'published',created_by INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(id),FOREIGN KEY(responsible_faculty_id) REFERENCES users(id))`);
  else {
    const cols = await all("PRAGMA table_info(events)"); const names = cols.map(c => c.name);
    for (const [name,type] of [["image_url","TEXT"],["is_paid","INTEGER NOT NULL DEFAULT 0"],["registration_fee","REAL NOT NULL DEFAULT 0"],["payment_qr_url","TEXT"],["responsible_faculty_id","INTEGER"],["status","TEXT NOT NULL DEFAULT 'published'"]]) if (!names.includes(name)) await run(`ALTER TABLE events ADD COLUMN ${name} ${type}`);
  }
  await run(`CREATE TABLE IF NOT EXISTS registrations(id INTEGER PRIMARY KEY AUTOINCREMENT,event_id INTEGER NOT NULL,student_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'registered',payment_reference TEXT,payment_status TEXT NOT NULL DEFAULT 'not_required',qr_token TEXT UNIQUE,registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(event_id,student_id),FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE)`);
  const regCols = await all("PRAGMA table_info(registrations)"); const regNames = regCols.map(c=>c.name);
  for (const [name,type] of [["payment_reference","TEXT"],["payment_status","TEXT NOT NULL DEFAULT 'not_required'"],["qr_token","TEXT"]]) if(!regNames.includes(name)) await run(`ALTER TABLE registrations ADD COLUMN ${name} ${type}`);
  const missingQr = await all("SELECT id FROM registrations WHERE qr_token IS NULL OR TRIM(qr_token)=''");
  for (const row of missingQr) await run("UPDATE registrations SET qr_token=? WHERE id=?", [crypto.randomBytes(24).toString("hex"), row.id]);
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_qr_token ON registrations(qr_token)");
  await run(`CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY AUTOINCREMENT,event_id INTEGER NOT NULL,student_id INTEGER NOT NULL,attended_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(event_id,student_id),FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await run(`CREATE TABLE IF NOT EXISTS certificates(id INTEGER PRIMARY KEY AUTOINCREMENT,event_id INTEGER NOT NULL,student_id INTEGER NOT NULL,certificate_url TEXT,verification_code TEXT UNIQUE,issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(event_id,student_id),FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE)`);
  const certCols = await all("PRAGMA table_info(certificates)"); const certNames = certCols.map(c=>c.name);
  if (!certNames.includes("verification_code")) await run("ALTER TABLE certificates ADD COLUMN verification_code TEXT");
  const missingCertCodes = await all("SELECT id FROM certificates WHERE verification_code IS NULL OR TRIM(verification_code)=''");
  for (const row of missingCertCodes) await run("UPDATE certificates SET verification_code=? WHERE id=?", [crypto.randomBytes(12).toString("hex"), row.id]);
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_verification_code ON certificates(verification_code)");
  await run(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'info',event_id INTEGER,read_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE)`);
  await run(`CREATE TABLE IF NOT EXISTS colleges(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,short_name TEXT,domain TEXT,city TEXT,state TEXT,verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await run("INSERT OR IGNORE INTO colleges(name,short_name,city,state,verified) VALUES(?,?,?,?,1)",[COLLEGE_NAME,"ATME","Mysore","Karnataka"]);
  const eventCols = await all("PRAGMA table_info(events)"); const eventNames = eventCols.map(c=>c.name);
  for (const [name,type] of [["participation_type","TEXT NOT NULL DEFAULT 'college'"],["objectives","TEXT"],["prizes","TEXT"],["certificate_details","TEXT"],["participation_details","TEXT"],["rules","TEXT"],["eligibility","TEXT"]]) if(!eventNames.includes(name)) await run(`ALTER TABLE events ADD COLUMN ${name} ${type}`);
  await run(`CREATE TABLE IF NOT EXISTS event_phases(id INTEGER PRIMARY KEY AUTOINCREMENT,event_id INTEGER NOT NULL,phase_number INTEGER NOT NULL,phase_name TEXT NOT NULL,description TEXT,start_date TEXT,end_date TEXT,status TEXT NOT NULL DEFAULT 'upcoming',result_published INTEGER NOT NULL DEFAULT 0,result_title TEXT,result_details TEXT,result_url TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(event_id,phase_number),FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE)`);
  await run("UPDATE users SET college=? WHERE college IS NULL OR TRIM(college)=''", [COLLEGE_NAME]);
  await run("INSERT OR IGNORE INTO colleges(name,verified) SELECT DISTINCT college,1 FROM users WHERE college IS NOT NULL AND TRIM(college)<>?", [COLLEGE_NAME]);
  await run("UPDATE events SET participation_type=COALESCE(NULLIF(participation_type,''),'college') WHERE participation_type IS NULL OR TRIM(participation_type)=''");
}

// ---------------- AUTH ----------------
app.post("/api/auth/send-otp", async (req,res)=>{try{const email=String(req.body.email||"").trim().toLowerCase(),role=req.body.role;if(!email||!["student","faculty"].includes(role))return res.status(400).json({message:"Email and account type are required."});if(!collegeEmailValid(email,role))return res.status(400).json({message:role==="student"?"Enter a valid email address.":"Use your official faculty email ending with @atme.edu.in"});const existing=await get("SELECT id,email_verified FROM users WHERE email=?",[email]);if(existing&&existing.email_verified===1)return res.status(409).json({message:"This email is already registered. Please sign in."});const otp=generateOtp(),expiresAt=new Date(Date.now()+OTP_MINUTES*60000).toISOString();await sendOtpEmail(email,role,otp);await saveOtp(email,role,otp,expiresAt);res.json({message:"OTP sent successfully. Check your college email.",expiresIn:OTP_MINUTES*60});}catch(e){console.error(e);res.status(500).json({message:e.message||"Unable to send OTP."});}});
app.post("/api/auth/verify-otp",async(req,res)=>{try{const email=String(req.body.email||"").trim().toLowerCase(),otp=String(req.body.otp||""),role=req.body.role;if(!email||!/^[0-9]{6}$/.test(otp)||!["student","faculty"].includes(role)||!collegeEmailValid(email,role))return res.status(400).json({message:"Invalid college email, account type or OTP."});const result=await verifyOtp(email,otp);if(!result.ok)return res.status(400).json({message:result.message});await run("UPDATE users SET role=? WHERE email=?",[role,email]);res.json({message:"College email verified successfully.",verified:true});}catch(e){console.error(e);res.status(500).json({message:"Unable to verify OTP."});}});
app.post("/api/auth/register",async(req,res)=>{try{const {firstName,lastName,email,role,studentId,department,year,designation,password,college}=req.body;const normalizedEmail=String(email||"").trim().toLowerCase();if(!firstName||!lastName||!normalizedEmail||!role||!department||!password)return res.status(400).json({message:"All required fields must be provided."});if(!["student","faculty"].includes(role))return res.status(400).json({message:"Invalid account type."});if(!collegeEmailValid(normalizedEmail,role))return res.status(400).json({message:"Use your official college email for this account type."});if(password.length<8)return res.status(400).json({message:"Password must contain at least 8 characters."});if(role==="student"&&(!studentId||!year))return res.status(400).json({message:"Student ID and year are required for student accounts."});if(role==="faculty"&&!designation)return res.status(400).json({message:"Designation is required for faculty accounts."});const user=await get("SELECT id,email_verified,role FROM users WHERE email=?",[normalizedEmail]);if(!user||user.email_verified!==1||user.role!==role)return res.status(403).json({message:"Verify your college email with OTP before creating the account."});if(role==="student"){const dup=await get("SELECT id FROM users WHERE student_id=? AND college=? AND id!=?",[String(studentId).trim(),String(college||"").trim(),user.id]);if(dup)return res.status(409).json({message:"This student ID is already registered for that college."});}const hash=await bcrypt.hash(password,12);await run(`UPDATE users SET first_name=?,last_name=?,student_id=?,college=?,department=?,year=?,designation=?,password_hash=? WHERE id=?`,[String(firstName).trim(),String(lastName).trim(),role==="student"?String(studentId).trim():null,role==="student"?String(college||"").trim()||COLLEGE_NAME:COLLEGE_NAME,String(department).trim(),role==="student"?Number(year):null,role==="faculty"?String(designation).trim():null,hash,user.id]);const saved=await get("SELECT id,first_name AS firstName,last_name AS lastName,email,student_id AS studentId,college,department,year,designation,role FROM users WHERE id=?",[user.id]);res.status(201).json({message:"Account created successfully.",token:createToken(saved),user:saved,redirect:role==="faculty"?"faculty-dashboard.html":"student-dashboard.html"});}catch(e){console.error(e);res.status(500).json({message:"Unable to create account."});}});
app.post("/api/auth/login/request-otp",async(req,res)=>{try{const email=String(req.body.email||"").trim().toLowerCase(),password=req.body.password,role=req.body.role;if(!email||!password||!["student","faculty"].includes(role))return res.status(400).json({message:"College email, password and account type are required."});if(!collegeEmailValid(email,role))return res.status(400).json({message:"Use your official college email for this account type."});const user=await get("SELECT id,password_hash,email_verified FROM users WHERE email=? AND role=?",[email,role]);if(!user||user.email_verified!==1)return res.status(401).json({message:"Account not found or college email is not verified."});if(!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({message:"Invalid email or password."});const otp=generateOtp(),expiresAt=new Date(Date.now()+OTP_MINUTES*60000).toISOString();await sendOtpEmail(email,role,otp);await run("UPDATE users SET otp_hash=?,otp_expires_at=?,otp_attempts=0 WHERE id=?",[otpHash(otp),expiresAt,user.id]);res.json({message:"Login OTP sent to your college email.",expiresIn:OTP_MINUTES*60});}catch(e){console.error(e);res.status(500).json({message:e.message||"Unable to send login OTP."});}});
app.post("/api/auth/login/verify-otp",async(req,res)=>{try{const email=String(req.body.email||"").trim().toLowerCase(),password=req.body.password,otp=String(req.body.otp||""),role=req.body.role;if(!email||!password||!/^[0-9]{6}$/.test(otp)||!["student","faculty"].includes(role))return res.status(400).json({message:"Email, password, OTP and account type are required."});const user=await get("SELECT id,first_name AS firstName,last_name AS lastName,email,student_id AS studentId,college,department,year,designation,password_hash,role,email_verified FROM users WHERE email=? AND role=?",[email,role]);if(!user||user.email_verified!==1)return res.status(401).json({message:"Account not found or college email is not verified."});if(!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({message:"Invalid email or password."});const result=await verifyOtp(email,otp);if(!result.ok)return res.status(400).json({message:result.message});delete user.password_hash;delete user.email_verified;res.json({message:"Login successful.",token:createToken(user),user,redirect:role==="faculty"?"faculty-dashboard.html":"student-dashboard.html"});}catch(e){console.error(e);res.status(500).json({message:"Unable to complete login."});}});
app.post("/api/auth/login",async(req,res)=>{try{const {email,password,role}=req.body;if(!["admin","faculty"].includes(role))return res.status(400).json({message:"Student accounts must use college email OTP login."});const normalizedEmail=String(email||"").trim().toLowerCase();if(role==="faculty"&&!facultyEmailValid(normalizedEmail))return res.status(400).json({message:"Use the official faculty email ending with @atme.edu.in."});const user=await get("SELECT id,first_name AS firstName,last_name AS lastName,email,student_id AS studentId,college,department,year,designation,password_hash,role,email_verified FROM users WHERE email=? AND role=?",[normalizedEmail,role]);if(!user||!(await bcrypt.compare(password||"",user.password_hash)))return res.status(401).json({message:"Invalid email or password."});if(role==="faculty"&&user.email_verified!==1)return res.status(403).json({message:"This faculty account has not been activated by the college admin."});delete user.password_hash;delete user.email_verified;res.json({message:"Login successful.",token:createToken(user),user,redirect:role==="faculty"?"faculty-dashboard.html":"admin-dashboard.html"});}catch(e){console.error(e);res.status(500).json({message:"Unable to log in."});}});

// ---------------- ADMIN ----------------
app.get("/api/admin/faculty",auth("admin"),async(req,res)=>{try{const faculty=await all(`SELECT id,first_name AS firstName,last_name AS lastName,email,department,designation,created_at AS createdAt,email_verified AS emailVerified FROM users WHERE college=? AND role='faculty' ORDER BY first_name,last_name`,[req.user.college]);res.json({faculty});}catch(e){console.error(e);res.status(500).json({message:"Unable to load faculty accounts."});}});
app.post("/api/admin/faculty",auth("admin"),async(req,res)=>{try{const {firstName,lastName,email,department,designation,password}=req.body;const normalizedEmail=String(email||"").trim().toLowerCase();if(!firstName||!lastName||!normalizedEmail||!department||!designation||!password)return res.status(400).json({message:"Name, email, department, designation and initial password are required."});if(!facultyEmailValid(normalizedEmail))return res.status(400).json({message:"Faculty email must end with @atme.edu.in."});if(String(password).length<8)return res.status(400).json({message:"Initial password must be at least 8 characters."});if(await get("SELECT id FROM users WHERE email=?",[normalizedEmail]))return res.status(409).json({message:"An account with this email already exists."});const passwordHash=await bcrypt.hash(String(password),12);const result=await run(`INSERT INTO users(first_name,last_name,email,college,department,designation,password_hash,role,email_verified) VALUES(?,?,?,?,?,?,?,'faculty',1)`,[String(firstName).trim(),String(lastName).trim(),normalizedEmail,req.user.college,String(department).trim(),String(designation).trim(),passwordHash]);const faculty=await get(`SELECT id,first_name AS firstName,last_name AS lastName,email,department,designation,created_at AS createdAt,email_verified AS emailVerified FROM users WHERE id=?`,[result.id]);res.status(201).json({message:"Faculty account created successfully.",faculty});}catch(e){console.error(e);res.status(500).json({message:"Unable to create faculty account."});}});

function eventSelect(extra="") { return `SELECT e.id,e.college,e.title,e.category,e.description,e.date,e.time,e.venue,e.capacity,e.registration_start AS registrationStart,e.registration_end AS registrationEnd,e.image_url AS imageUrl,e.is_paid AS isPaid,e.registration_fee AS registrationFee,e.payment_qr_url AS paymentQrUrl,e.responsible_faculty_id AS responsibleFacultyId,e.status,e.participation_type AS participationType,e.objectives,e.prizes,e.certificate_details AS certificateDetails,e.participation_details AS participationDetails,e.rules,e.eligibility,e.created_by AS createdBy,e.created_at AS createdAt,COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id),0) AS registrationCount,(SELECT first_name||' '||last_name FROM users f WHERE f.id=e.responsible_faculty_id) AS responsibleFacultyName ${extra} FROM events e`; }
async function getEvent(id){ return get(`${eventSelect()} WHERE e.id=?`,[id]); }
function eventPayload(req){ const body=req.body||{}; let phases=[]; try{ phases=body.phases ? (typeof body.phases === "string" ? JSON.parse(body.phases) : body.phases) : []; }catch{ phases=[]; } return {title:String(body.title||"").trim(),category:String(body.category||"").trim(),description:String(body.description||"").trim(),date:String(body.date||"").trim(),time:String(body.time||"").trim(),venue:String(body.venue||"").trim(),capacity:body.capacity===""||body.capacity==null?null:Number(body.capacity),registrationStart:body.registrationStart||null,registrationEnd:body.registrationEnd||null,isPaid:body.isPaid==="true"||body.isPaid===true||body.isPaid===1?1:0,registrationFee:body.registrationFee===""||body.registrationFee==null?0:Number(body.registrationFee),responsibleFacultyId:body.responsibleFacultyId?Number(body.responsibleFacultyId):null,participationType:["college","inter_college","open"].includes(String(body.participationType||"college"))?String(body.participationType||"college"):"college",objectives:String(body.objectives||"").trim(),prizes:String(body.prizes||"").trim(),certificateDetails:String(body.certificateDetails||"").trim(),participationDetails:String(body.participationDetails||"").trim(),rules:String(body.rules||"").trim(),eligibility:String(body.eligibility||"").trim(),phases:Array.isArray(phases)?phases:[]}; }
async function syncEventPhases(eventId, phases=[]){await run("DELETE FROM event_phases WHERE event_id=?",[eventId]);for(const phase of phases){await run(`INSERT INTO event_phases(event_id,phase_number,phase_name,description,start_date,end_date,status,result_published,result_title,result_details,result_url,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,[eventId,phase.phaseNumber,phase.phaseName,phase.description,phase.startDate,phase.endDate,phase.status,phase.resultPublished?1:0,phase.resultTitle,phase.resultDetails,phase.resultUrl]);}}
async function notifyEligibleStudents(eventId,title,category){const event=await getEvent(eventId);if(!event)return;let sql=`SELECT id FROM users WHERE role='student'`;let params=[];if(event.participationType==='college'){sql+=` AND college=?`;params.push(event.college);}const students=await all(sql,params);for(const student of students)await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[student.id,"New event: "+title,`A new ${category} event is available on NXTURE.` ,"event",eventId]);}
async function getEventPhases(eventId){return all(`SELECT id,event_id AS eventId,phase_number AS phaseNumber,phase_name AS phaseName,description,start_date AS startDate,end_date AS endDate,status,result_published AS resultPublished,result_title AS resultTitle,result_details AS resultDetails,result_url AS resultUrl,updated_at AS updatedAt FROM event_phases WHERE event_id=? ORDER BY phase_number`,[eventId]);}
async function validateEventPayload(p,college){if(!p.title||!p.category||!p.description||!p.date||!p.time||!p.venue)throw new Error("Title, category, description, date, time and venue are required.");if(p.capacity!==null&&(!Number.isInteger(p.capacity)||p.capacity<1))throw new Error("Participant limit must be a positive number.");if(p.isPaid&&(!Number.isFinite(p.registrationFee)||p.registrationFee<=0))throw new Error("Paid events need a registration fee greater than zero.");if(p.responsibleFacultyId){const f=await get("SELECT id FROM users WHERE id=? AND college=? AND role='faculty'",[p.responsibleFacultyId,college]);if(!f)throw new Error("Selected responsible faculty member is not valid for this college.");}p.phases=p.phases.filter((x,i)=>x&&String(x.phaseName||x.name||"").trim()).map((x,i)=>({phaseNumber:i+1,phaseName:String(x.phaseName||x.name||`Phase ${i+1}`).trim(),description:String(x.description||"").trim(),startDate:x.startDate||null,endDate:x.endDate||null,status:["upcoming","active","completed"].includes(x.status)?x.status:"upcoming",resultPublished:Boolean(x.resultPublished),resultTitle:String(x.resultTitle||"").trim(),resultDetails:String(x.resultDetails||"").trim(),resultUrl:String(x.resultUrl||"").trim()}));}
app.get("/api/admin/dashboard",auth("admin"),async(req,res)=>{try{const events=await all(`${eventSelect()} WHERE e.college=? ORDER BY datetime(e.created_at) DESC`,[req.user.college]);const registrations=await all(`SELECT r.id,r.event_id AS eventId,r.student_id AS studentId,r.status,r.payment_reference AS paymentReference,r.payment_status AS paymentStatus,r.registered_at AS registeredAt,e.title AS eventTitle,e.is_paid AS isPaid,e.registration_fee AS registrationFee,(u.first_name||' '||u.last_name) AS studentName,u.student_id AS studentCode,u.email AS studentEmail,u.college AS studentCollege,u.department,u.year,CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS attended,CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS certificateIssued,c.certificate_url AS certificateUrl,c.verification_code AS verificationCode FROM registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.student_id LEFT JOIN attendance a ON a.event_id=r.event_id AND a.student_id=r.student_id LEFT JOIN certificates c ON c.event_id=r.event_id AND c.student_id=r.student_id WHERE e.college=? ORDER BY r.registered_at DESC`,[req.user.college]);const students=await all(`SELECT id,first_name AS firstName,last_name AS lastName,email,student_id AS studentId,department,year,created_at AS createdAt FROM users WHERE college=? AND role='student' ORDER BY first_name,last_name`,[req.user.college]);const faculty=await all(`SELECT id,first_name AS firstName,last_name AS lastName,email,department,designation,created_at AS createdAt,email_verified AS emailVerified FROM users WHERE college=? AND role='faculty' ORDER BY first_name,last_name`,[req.user.college]);const attendance=await all(`SELECT COUNT(*) AS count FROM attendance a JOIN events e ON e.id=a.event_id WHERE e.college=?`,[req.user.college]);const certificates=await all(`SELECT COUNT(*) AS count FROM certificates c JOIN events e ON e.id=c.event_id WHERE e.college=?`,[req.user.college]);
const statusCounts=await all(`SELECT COALESCE(status,'published') AS status,COUNT(*) AS count FROM events WHERE college=? GROUP BY COALESCE(status,'published')`,[req.user.college]);
const categoryCounts=await all(`SELECT category,COUNT(*) AS events,COALESCE(SUM(registrationCount),0) AS registrations FROM (${eventSelect()}) q WHERE college=? GROUP BY category ORDER BY events DESC`,[req.user.college]);
const paymentCounts=await all(`SELECT payment_status AS status,COUNT(*) AS count FROM registrations r JOIN events e ON e.id=r.event_id WHERE e.college=? AND e.is_paid=1 GROUP BY payment_status`,[req.user.college]);
const currentYear=new Date().getFullYear();
const monthlyRows=await all(`SELECT strftime('%m',e.date) AS month,COUNT(*) AS count FROM events e WHERE e.college=? AND strftime('%Y',e.date)=? GROUP BY strftime('%m',e.date) ORDER BY month`,[req.user.college,String(currentYear)]);
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthlyEventCounts=monthNames.map((label,i)=>({label,count:Number(monthlyRows.find(x=>Number(x.month)===i+1)?.count||0)}));
const eventCategoryRows=await all(`SELECT COALESCE(category,'Other') AS label,COUNT(*) AS count FROM events WHERE college=? GROUP BY COALESCE(category,'Other') ORDER BY count DESC`,[req.user.college]);
const eventCategoryCounts=eventCategoryRows.map(x=>({label:x.label,count:Number(x.count||0)}));
res.json({events,registrations,students,faculty,attendanceCount:Number(attendance[0]?.count||0),certificateCount:Number(certificates[0]?.count||0),analytics:{statusCounts,categoryCounts,paymentCounts,monthlyEventCounts,eventCategoryCounts}});}catch(e){console.error(e);res.status(500).json({message:"Unable to load admin dashboard."});}});
app.post("/api/admin/registrations/:registrationId/payment",auth("admin"),async(req,res)=>{try{
  const action=String(req.body.action||"").trim().toLowerCase();
  if(!["verify","reject"].includes(action))return res.status(400).json({message:"Choose verify or reject."});
  const reg=await get(`SELECT r.id,r.event_id AS eventId,r.student_id AS studentId,r.payment_reference AS paymentReference,r.payment_status AS paymentStatus,e.title AS eventTitle,e.registration_fee AS registrationFee,e.is_paid AS isPaid,(u.first_name||' '||u.last_name) AS studentName,u.email AS studentEmail FROM registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.student_id WHERE r.id=? AND e.college=?`,[req.params.registrationId,req.user.college]);
  if(!reg)return res.status(404).json({message:"Registration not found."});
  if(!reg.isPaid)return res.status(400).json({message:"This registration does not require payment verification."});
  if(!reg.paymentReference)return res.status(400).json({message:"No payment reference was submitted."});
  const nextStatus=action==="verify"?"verified":"rejected";
  await run("UPDATE registrations SET payment_status=? WHERE id=?",[nextStatus,reg.id]);
  const title=action==="verify"?"Payment verified":"Payment rejected";
  const message=action==="verify"?`Your payment for ${reg.eventTitle} has been verified. Your registration is confirmed.`:`Your payment for ${reg.eventTitle} was rejected. Please contact the event team if you need help.`;
  await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[reg.studentId,title,message,"payment",reg.eventId]);
  let emailSent=true; let emailError="";
  try{await sendPaymentStatusEmail({email:reg.studentEmail,studentName:reg.studentName,eventTitle:reg.eventTitle,paymentReference:reg.paymentReference,status:nextStatus,fee:reg.registrationFee});}catch(emailErr){emailSent=false;emailError=emailErr.message||"Unable to send payment email.";console.error(emailErr);}
  res.json({message:action==="verify"?"Payment verified successfully.":"Payment rejected successfully.",paymentStatus:nextStatus,emailSent,emailError:emailSent?undefined:emailError});
}catch(e){console.error(e);res.status(500).json({message:e.message||"Unable to update payment status."});}});

app.post("/api/admin/events",auth("admin"),upload.fields([{name:"eventImage",maxCount:1},{name:"paymentQr",maxCount:1}]),async(req,res)=>{try{const p=eventPayload(req);await validateEventPayload(p,req.user.college);const image=req.files?.eventImage?.[0]?`/uploads/events/${req.files.eventImage[0].filename}`:null;const qr=req.files?.paymentQr?.[0]?`/uploads/payments/${req.files.paymentQr[0].filename}`:null;if(p.isPaid&&!qr)return res.status(400).json({message:"Upload a payment QR image for a paid event."});const result=await run(`INSERT INTO events(college,title,category,description,date,time,venue,capacity,registration_start,registration_end,image_url,is_paid,registration_fee,payment_qr_url,responsible_faculty_id,status,participation_type,objectives,prizes,certificate_details,participation_details,rules,eligibility,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[req.user.college,p.title,p.category,p.description,p.date,p.time,p.venue,p.capacity,p.registrationStart,p.registrationEnd,image,p.isPaid,p.registrationFee,p.isPaid?qr:null,p.responsibleFacultyId,'published',p.participationType,p.objectives,p.prizes,p.certificateDetails,p.participationDetails,p.rules,p.eligibility,req.user.id]);await syncEventPhases(result.id,p.phases);await notifyEligibleStudents(result.id,p.title,p.category);res.status(201).json({message:"Event created successfully.",event:await getEvent(result.id)});}catch(e){console.error(e);res.status(500).json({message:e.message||"Unable to create event."});}});
app.put("/api/admin/events/:id",auth("admin"),upload.fields([{name:"eventImage",maxCount:1},{name:"paymentQr",maxCount:1}]),async(req,res)=>{try{const current=await getEvent(req.params.id);if(!current||current.college!==req.user.college)return res.status(404).json({message:"Event not found."});const p=eventPayload(req);await validateEventPayload(p,req.user.college);const image=req.files?.eventImage?.[0]?`/uploads/events/${req.files.eventImage[0].filename}`:current.imageUrl;const qr=req.files?.paymentQr?.[0]?`/uploads/payments/${req.files.paymentQr[0].filename}`:current.paymentQrUrl;if(p.isPaid&&!qr)return res.status(400).json({message:"Upload a payment QR image for a paid event."});await run(`UPDATE events SET title=?,category=?,description=?,date=?,time=?,venue=?,capacity=?,registration_start=?,registration_end=?,image_url=?,is_paid=?,registration_fee=?,payment_qr_url=?,responsible_faculty_id=?,participation_type=?,objectives=?,prizes=?,certificate_details=?,participation_details=?,rules=?,eligibility=? WHERE id=? AND college=?`,[p.title,p.category,p.description,p.date,p.time,p.venue,p.capacity,p.registrationStart,p.registrationEnd,image,p.isPaid,p.registrationFee,p.isPaid?qr:null,p.responsibleFacultyId,p.participationType,p.objectives,p.prizes,p.certificateDetails,p.participationDetails,p.rules,p.eligibility,req.params.id,req.user.college]);await syncEventPhases(req.params.id,p.phases);res.json({message:"Event updated successfully.",event:await getEvent(req.params.id)});}catch(e){console.error(e);res.status(500).json({message:e.message||"Unable to update event."});}});
app.get("/api/admin/events/:id/phases",auth("admin"),async(req,res)=>{try{const event=await getEvent(req.params.id);if(!event||event.college!==req.user.college)return res.status(404).json({message:"Event not found."});res.json({phases:await getEventPhases(event.id)});}catch(e){res.status(500).json({message:"Unable to load phases."});}});
app.put("/api/admin/events/:id/phases",auth("admin"),async(req,res)=>{try{const event=await getEvent(req.params.id);if(!event||event.college!==req.user.college)return res.status(404).json({message:"Event not found."});const phases=Array.isArray(req.body.phases)?req.body.phases:[];const normalized=phases.map((x,i)=>({phaseNumber:i+1,phaseName:String(x.phaseName||`Phase ${i+1}`).trim(),description:String(x.description||"").trim(),startDate:x.startDate||null,endDate:x.endDate||null,status:["upcoming","active","completed"].includes(x.status)?x.status:"upcoming",resultPublished:Boolean(x.resultPublished),resultTitle:String(x.resultTitle||"").trim(),resultDetails:String(x.resultDetails||"").trim(),resultUrl:String(x.resultUrl||"").trim()}));const before=await getEventPhases(event.id);await syncEventPhases(event.id,normalized);for(const phase of normalized.filter(x=>x.resultPublished)){const oldPhase=before.find(x=>Number(x.phaseNumber)===Number(phase.phaseNumber));if(!oldPhase||!oldPhase.resultPublished){const students=await all(`SELECT DISTINCT student_id AS studentId FROM registrations WHERE event_id=?`,[event.id]);for(const st of students)await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[st.studentId,`${phase.phaseName} result published`,phase.resultTitle||`${phase.phaseName} result is now available.`,"phase_result",event.id]);}}res.json({message:"Event phases updated.",phases:await getEventPhases(event.id)});}catch(e){console.error(e);res.status(500).json({message:"Unable to update event phases."});}});
app.patch("/api/admin/events/:id/phases/:phaseId/result",auth("admin"),async(req,res)=>{try{const event=await getEvent(req.params.id);if(!event||event.college!==req.user.college)return res.status(404).json({message:"Event not found."});const phase=await get("SELECT * FROM event_phases WHERE id=? AND event_id=?",[req.params.phaseId,event.id]);if(!phase)return res.status(404).json({message:"Phase not found."});const published=req.body.published!==false;await run(`UPDATE event_phases SET result_published=?,result_title=?,result_details=?,result_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[published?1:0,String(req.body.resultTitle||phase.result_title||"").trim(),String(req.body.resultDetails||phase.result_details||"").trim(),String(req.body.resultUrl||phase.result_url||"").trim(),published?"completed":phase.status,phase.id]);if(published&&!phase.result_published){const students=await all(`SELECT DISTINCT student_id AS studentId FROM registrations WHERE event_id=?`,[event.id]);for(const st of students)await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[st.studentId,`${phase.phase_name} result published`,String(req.body.resultTitle||phase.result_title||`${phase.phase_name} result is now available.`),"phase_result",event.id]);}res.json({message:published?"Phase result published successfully.":"Phase result hidden.",phase:(await getEventPhases(event.id)).find(x=>x.id===phase.id)});}catch(e){console.error(e);res.status(500).json({message:"Unable to update phase result."});}});
app.patch("/api/admin/events/:id/status",auth("admin"),async(req,res)=>{try{
  const next=String(req.body.status||"").trim().toLowerCase();
  const allowed=["published","live","completed","cancelled","archived"];
  if(!allowed.includes(next))return res.status(400).json({message:"Invalid event status."});
  const event=await get("SELECT id,title,status,college FROM events WHERE id=? AND college=?",[req.params.id,req.user.college]);
  if(!event)return res.status(404).json({message:"Event not found."});
  const current=String(event.status||"published").toLowerCase();
  const transitions={published:["live","cancelled","archived"],live:["completed","cancelled"],completed:["archived"],cancelled:["archived"],archived:[]};
  if(current!==next && !(transitions[current]||[]).includes(next))return res.status(409).json({message:`Cannot change event from ${current} to ${next}.`});
  await run("UPDATE events SET status=? WHERE id=? AND college=?",[next,event.id,req.user.college]);
  if(["live","completed","cancelled"].includes(next)){
    const message=next==="live"?`${event.title} is now live.`:next==="completed"?`${event.title} has been marked completed.`:`${event.title} has been cancelled.`;
    await run("INSERT INTO notifications(student_id,title,message,type,event_id) SELECT r.student_id,?,?,?,? FROM registrations r WHERE r.event_id=?",[`Event ${next}`,message,"event",event.id,event.id]);
  }
  res.json({message:`Event status changed to ${next}.`,event:await getEvent(event.id)});
}catch(e){console.error(e);res.status(500).json({message:"Unable to update event status."});}});

app.delete("/api/admin/events/:id",auth("admin"),async(req,res)=>{try{const event=await getEvent(req.params.id);if(!event||event.college!==req.user.college)return res.status(404).json({message:"Event not found."});await run("DELETE FROM events WHERE id=? AND college=?",[req.params.id,req.user.college]);res.json({message:"Event deleted successfully."});}catch(e){console.error(e);res.status(500).json({message:"Unable to delete event."});}});

// ---------------- STUDENT ----------------
app.get("/api/student/dashboard",auth("student"),async(req,res)=>{try{let events=await all(`${eventSelect()} WHERE COALESCE(e.status,'published') IN ('published','live') AND (LOWER(REPLACE(COALESCE(e.participation_type,'college'),'-','_')) IN ('inter_college','open') OR e.college=?) ORDER BY datetime(e.date || ' ' || e.time) ASC`,[req.user.college]);events=await Promise.all(events.map(async event=>({...event,phases:await getEventPhases(event.id)})));let registrations=await all(`SELECT r.id,r.event_id AS eventId,r.status,r.payment_reference AS paymentReference,r.payment_status AS paymentStatus,r.qr_token AS qrToken,r.registered_at AS registeredAt,e.title AS eventTitle,e.college AS organizerCollege,e.participation_type AS participationType,e.objectives,e.prizes,e.certificate_details AS certificateDetails,e.participation_details AS participationDetails,e.rules,e.eligibility,e.date,e.time,e.venue,e.image_url AS imageUrl,e.is_paid AS isPaid,e.registration_fee AS registrationFee,e.payment_qr_url AS paymentQrUrl FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.student_id=? ORDER BY r.registered_at DESC`,[req.user.id]);
    registrations=await Promise.all(registrations.map(async r=>({...r,qrPayload:`NXTURE-REG:${r.qrToken}`,qrImage:await QRCode.toDataURL(`NXTURE-REG:${r.qrToken}`,{width:360,margin:2,errorCorrectionLevel:"M"}),phases:await getEventPhases(r.eventId)})));const attendance=await all(`SELECT a.id,a.event_id AS eventId,a.attended_at AS attendedAt,e.title AS eventTitle FROM attendance a JOIN events e ON e.id=a.event_id WHERE a.student_id=?`,[req.user.id]);const certificates=await all(`SELECT c.id,c.event_id AS eventId,c.certificate_url AS certificateUrl,c.issued_at AS issuedAt,e.title AS eventTitle FROM certificates c JOIN events e ON e.id=c.event_id WHERE c.student_id=?`,[req.user.id]);const notifications=await all(`SELECT id,title,message,type,event_id AS eventId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE student_id=? ORDER BY datetime(created_at) DESC LIMIT 30`,[req.user.id]);const unreadNotifications=await get(`SELECT COUNT(*) AS count FROM notifications WHERE student_id=? AND read_at IS NULL`,[req.user.id]);res.json({events,registrations,attendance,certificates,notifications,unreadNotifications:Number(unreadNotifications?.count||0)});}catch(e){console.error(e);res.status(500).json({message:"Unable to load student dashboard."});}});
app.post("/api/student/events/:eventId/register",auth("student"),async(req,res)=>{try{const event=await getEvent(req.params.eventId);if(!event)return res.status(404).json({message:"Event not found."});if(!["published","live"].includes(String(event.status||"published").toLowerCase()))return res.status(409).json({message:"Registration is not available for this event."});const now=Date.now();if(event.registrationStart&&new Date(event.registrationStart).getTime()>now)return res.status(409).json({message:"Registration has not opened yet."});if(event.registrationEnd&&new Date(event.registrationEnd).getTime()<now)return res.status(409).json({message:"Registration has closed."});const participationType=String(event.participationType||"college").toLowerCase().replace(/-/g,"_");if(participationType==="college"&&String(event.college)!==String(req.user.college))return res.status(403).json({message:"This event is only open to students of the organizing college."});if(event.capacity!==null&&event.registrationCount>=event.capacity)return res.status(409).json({message:"This event has reached its participant limit."});const paymentReference=String(req.body.paymentReference||"").trim();if(event.isPaid&&!paymentReference)return res.status(400).json({message:"Enter the payment transaction/UTR reference after paying."});const qrToken=crypto.randomBytes(24).toString("hex");
    await run("INSERT INTO registrations(event_id,student_id,payment_reference,payment_status,qr_token) VALUES(?,?,?,?,?)",[event.id,req.user.id,event.isPaid?paymentReference:null,event.isPaid?"submitted":"not_required",qrToken]);await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[req.user.id,"Registration successful",`Your registration for ${event.title} has been recorded${event.isPaid?". Payment reference submitted for verification.":"."}`,"registration",event.id]);let emailSent=true;try{await sendRegistrationSuccessEmail({email:req.user.email,studentName:`${req.user.firstName||""} ${req.user.lastName||""}`.trim(),eventTitle:event.title,organizerCollege:event.college,participationType,isPaid:event.isPaid,paymentReference:event.isPaid?paymentReference:null});}catch(emailErr){emailSent=false;console.error("Registration email failed:",emailErr);}res.status(201).json({message:event.isPaid?"Registration submitted with payment reference.":"Registration successful.",emailSent});}catch(e){if(String(e.message).includes("UNIQUE"))return res.status(409).json({message:"You are already registered for this event."});console.error(e);res.status(500).json({message:"Unable to register for the event."});}});

// ---------------- FACULTY ----------------
app.get("/api/faculty/dashboard",auth("faculty"),async(req,res)=>{try{const events=await all(`${eventSelect()} WHERE e.college=? AND e.responsible_faculty_id=? ORDER BY datetime(e.date||' '||e.time) ASC`,[COLLEGE_NAME,req.user.id]);const registrations=await all(`SELECT r.id,r.event_id AS eventId,r.student_id AS studentId,r.status,r.payment_reference AS paymentReference,r.payment_status AS paymentStatus,r.registered_at AS registeredAt,e.title AS eventTitle,(u.first_name||' '||u.last_name) AS studentName,u.student_id AS studentCode,u.email AS studentEmail,u.college AS studentCollege,u.department,u.year,CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS attended,CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS certificateIssued,c.certificate_url AS certificateUrl,c.verification_code AS verificationCode FROM registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.student_id LEFT JOIN attendance a ON a.event_id=r.event_id AND a.student_id=r.student_id LEFT JOIN certificates c ON c.event_id=r.event_id AND c.student_id=r.student_id WHERE e.college=? AND e.responsible_faculty_id=? ORDER BY r.registered_at DESC`,[COLLEGE_NAME,req.user.id]);res.json({events,registrations});}catch(e){console.error(e);res.status(500).json({message:"Unable to load faculty dashboard."});}});
app.post("/api/faculty/events/:eventId/attendance",auth("faculty"),async(req,res)=>{try{const event=await get("SELECT id FROM events WHERE id=? AND college=? AND responsible_faculty_id=?",[req.params.eventId,COLLEGE_NAME,req.user.id]);if(!event)return res.status(404).json({message:"This event is not assigned to you."});const studentId=Number(req.body.studentId);const attended=Boolean(req.body.attended);const reg=await get("SELECT id FROM registrations WHERE event_id=? AND student_id=?",[event.id,studentId]);if(!reg)return res.status(404).json({message:"Student is not registered for this event."});if(attended)await run("INSERT OR IGNORE INTO attendance(event_id,student_id) VALUES(?,?)",[event.id,studentId]);else await run("DELETE FROM attendance WHERE event_id=? AND student_id=?",[event.id,studentId]);res.json({message:attended?"Attendance marked.":"Attendance removed."});}catch(e){console.error(e);res.status(500).json({message:"Unable to update attendance."});}});
app.post("/api/faculty/scan-qr",auth("faculty"),async(req,res)=>{try{const raw=String(req.body.qrData||"").trim();const prefix="NXTURE-REG:";if(!raw.startsWith(prefix))return res.status(400).json({message:"This is not a valid NXTURE event registration QR."});const token=raw.slice(prefix.length).trim();if(!/^[a-f0-9]{48}$/i.test(token))return res.status(400).json({message:"Invalid registration QR."});const record=await get(`SELECT r.id,r.event_id AS eventId,r.student_id AS studentId,r.status,r.payment_status AS paymentStatus,e.title AS eventTitle,e.date,e.time,e.venue,e.is_paid AS isPaid,e.responsible_faculty_id AS responsibleFacultyId,(u.first_name||' '||u.last_name) AS studentName,u.student_id AS studentCode,u.email AS studentEmail FROM registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.student_id WHERE r.qr_token=? AND e.college=?`,[token,COLLEGE_NAME]);if(!record)return res.status(404).json({message:"Registration QR not found."});if(Number(record.responsibleFacultyId)!==Number(req.user.id))return res.status(403).json({message:"This event is not assigned to you."});if(Number(record.isPaid)===1 && record.paymentStatus!=="verified")return res.status(403).json({message:"Payment is not verified for this registration yet."});const existing=await get("SELECT id,attended_at AS attendedAt FROM attendance WHERE event_id=? AND student_id=?",[record.eventId,record.studentId]);if(existing)return res.status(409).json({message:`Attendance already marked for ${record.studentName}.`,alreadyMarked:true,student:record});await run("INSERT INTO attendance(event_id,student_id) VALUES(?,?)",[record.eventId,record.studentId]);await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[record.studentId,"Attendance confirmed",`Your attendance for ${record.eventTitle} has been marked successfully.` ,"attendance",record.eventId]);res.json({message:`Attendance marked for ${record.studentName}.`,student:record,attendedAt:new Date().toISOString()});}catch(e){console.error(e);res.status(500).json({message:"Unable to process QR attendance."});}});
app.post("/api/faculty/events/:eventId/certificate",auth("faculty"),async(req,res)=>{try{
  const event=await get("SELECT * FROM events WHERE id=? AND college=? AND responsible_faculty_id=?",[req.params.eventId,COLLEGE_NAME,req.user.id]);
  if(!event)return res.status(404).json({message:"This event is not assigned to you."});
  const studentId=Number(req.body.studentId);
  const attendance=await get("SELECT id,attended_at AS attendedAt FROM attendance WHERE event_id=? AND student_id=?",[event.id,studentId]);
  if(!attendance)return res.status(400).json({message:"Mark attendance before issuing a certificate."});
  const student=await get("SELECT id,first_name AS firstName,last_name AS lastName,email,student_id AS studentId,department,year FROM users WHERE id=? AND role='student'",[studentId]);
  if(!student)return res.status(404).json({message:"Student not found."});
  let cert=await get("SELECT * FROM certificates WHERE event_id=? AND student_id=?",[event.id,studentId]);
  const verificationCode=cert?.verification_code || crypto.randomBytes(12).toString("hex");
  const verifyUrl=`${process.env.PUBLIC_URL||`http://localhost:${PORT}`}/certificate-verify.html?code=${verificationCode}`;
  const pdfName=`certificate-${event.id}-${studentId}-${verificationCode}.pdf`;
  const pdfPath=path.join(certificateDir,pdfName);
  const doc=new PDFDocument({size:"A4",margin:50});
  const qrBuffer=await QRCode.toBuffer(verifyUrl,{width:180,margin:2,errorCorrectionLevel:"M"});
  const stream=fs.createWriteStream(pdfPath);
  doc.pipe(stream);
  doc.fontSize(13).fillColor("#16796b").text("NXTURE",{align:"center"});
  doc.moveDown(1.8);
  doc.fontSize(30).fillColor("#173a35").text("CERTIFICATE OF PARTICIPATION",{align:"center"});
  doc.moveDown(1.2);
  doc.fontSize(14).fillColor("#71817d").text("This certificate is proudly presented to",{align:"center"});
  doc.moveDown(.7);
  doc.fontSize(27).fillColor("#173a35").text(`${student.firstName} ${student.lastName}`,{align:"center"});
  doc.moveDown(.7);
  doc.fontSize(13).fillColor("#4d5f5b").text(`Student ID: ${student.studentId||"—"}   |   ${student.department||"—"}`,{align:"center"});
  doc.moveDown(1.4);
  doc.fontSize(14).text("for successfully participating in",{align:"center"});
  doc.moveDown(.6);
  doc.fontSize(22).fillColor("#16796b").text(event.title,{align:"center"});
  doc.moveDown(.7);
  doc.fontSize(12).fillColor("#71817d").text(`${event.category} • ${event.date} • ${event.venue}`,{align:"center"});
  doc.moveDown(2);
  doc.fontSize(11).fillColor("#71817d").text(`Issued: ${new Date().toLocaleDateString("en-IN")}  |  Certificate ID: NXT-${verificationCode.toUpperCase()}`,{align:"center"});
  doc.image(qrBuffer, {fit:[120,120],align:"center"});
  doc.fontSize(9).fillColor("#71817d").text("Scan the QR code to verify this certificate.",{align:"center"});
  doc.end();
  await new Promise((resolve,reject)=>{stream.on("finish",resolve);stream.on("error",reject);});
  const url=`/uploads/certificates/${pdfName}`;
  if(cert){await run("UPDATE certificates SET certificate_url=?,verification_code=? WHERE id=?",[url,verificationCode,cert.id]);}else{const result=await run("INSERT INTO certificates(event_id,student_id,certificate_url,verification_code) VALUES(?,?,?,?)",[event.id,studentId,url,verificationCode]);cert={id:result.id};}
  await run(`INSERT INTO notifications(student_id,title,message,type,event_id) VALUES(?,?,?,?,?)`,[studentId,"Certificate available",`Your certificate for ${event.title} is ready to download and verify.` ,"certificate",event.id]);
  res.json({message:"Certificate issued successfully.",certificate:{id:cert.id,certificateUrl:url,verificationCode,verifyUrl}});
}catch(e){console.error(e);res.status(500).json({message:"Unable to issue certificate."});}});


app.get("/api/certificates/verify/:code",async(req,res)=>{try{const code=String(req.params.code||"").trim().toLowerCase();const cert=await get(`SELECT c.id,c.certificate_url AS certificateUrl,c.verification_code AS verificationCode,c.issued_at AS issuedAt,e.title AS eventTitle,e.category,e.date,e.venue,(u.first_name||' '||u.last_name) AS studentName,u.student_id AS studentId,u.department FROM certificates c JOIN events e ON e.id=c.event_id JOIN users u ON u.id=c.student_id WHERE lower(c.verification_code)=?`,[code]);if(!cert)return res.status(404).json({valid:false,message:"Certificate not found."});res.json({valid:true,certificate:cert});}catch(e){console.error(e);res.status(500).json({valid:false,message:"Unable to verify certificate."});}});

app.get("/api/student/notifications",auth("student"),async(req,res)=>{try{const notifications=await all(`SELECT id,title,message,type,event_id AS eventId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE student_id=? ORDER BY datetime(created_at) DESC LIMIT 50`,[req.user.id]);const unread=notifications.filter(n=>!n.readAt).length;res.json({notifications,unread});}catch(e){console.error(e);res.status(500).json({message:"Unable to load notifications."});}});
app.post("/api/student/notifications/read",auth("student"),async(req,res)=>{try{if(req.body.id){await run("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND student_id=?",[Number(req.body.id),req.user.id]);}else{await run("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE student_id=? AND read_at IS NULL",[req.user.id]);}res.json({message:"Notifications updated."});}catch(e){console.error(e);res.status(500).json({message:"Unable to update notifications."});}});


function aiTokens(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9@.\s-]/g, ' ').split(/\s+/).filter(Boolean);
}
function aiScore(query, text) {
  const q = [...new Set(aiTokens(query))].filter(t => t.length > 2);
  const hay = String(text || '').toLowerCase();
  if (!q.length) return 0;
  let score = 0;
  for (const token of q) {
    if (hay.includes(token)) score += token.length >= 6 ? 2 : 1;
  }
  return score;
}
function aiClean(value) {
  return String(value || '').trim();
}
function aiDate(value) {
  if (!value) return 'not provided';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
}
function aiFindEvent(query, events) {
  const ranked = events.map(e => ({ event:e, score:aiScore(query, [e.title,e.category,e.description,e.college,e.venue].join(' ')) }))
    .sort((a,b)=>b.score-a.score);
  return ranked[0] && ranked[0].score > 0 ? ranked[0].event : null;
}
function aiFieldQuestion(query) {
  const q=String(query||'').toLowerCase();
  if (/prize|reward|winner|cash|amount/.test(q)) return 'prizes';
  if (/objective|purpose|aim|goal/.test(q)) return 'objectives';
  if (/certificate|participation certificate/.test(q)) return 'certificateDetails';
  if (/eligib|who can|eligible/.test(q)) return 'eligibility';
  if (/rule|guideline|regulation/.test(q)) return 'rules';
  if (/participat|team size|team|who can join/.test(q)) return 'participationDetails';
  if (/fee|price|cost|registration amount|how much/.test(q)) return 'registrationFee';
  if (/venue|where|location/.test(q)) return 'venue';
  if (/date|when is|when will|scheduled/.test(q)) return 'date';
  if (/time|timing|starts|start time/.test(q)) return 'time';
  if (/faculty|coordinator|organizer|organized by/.test(q)) return 'organizer';
  if (/phase|round|stage|result|shortlist|selected/.test(q)) return 'phases';
  return null;
}
function aiAnswerForEvent(query,event,phases) {
  const field=aiFieldQuestion(query);
  if (!event) return null;
  if (field==='prizes') return aiClean(event.prizes) ? `For ${event.title}, the prize details are:\n${event.prizes}` : `I couldn't find prize details published for ${event.title} yet.`;
  if (field==='objectives') return aiClean(event.objectives) ? `The objectives of ${event.title} are:\n${event.objectives}` : `Objectives have not been published for ${event.title} yet.`;
  if (field==='certificateDetails') return aiClean(event.certificateDetails) ? `Certificate information for ${event.title}:\n${event.certificateDetails}` : `Certificate details have not been published for ${event.title} yet.`;
  if (field==='eligibility') return aiClean(event.eligibility) ? `Eligibility for ${event.title}:\n${event.eligibility}` : `Eligibility information has not been published for ${event.title} yet.`;
  if (field==='rules') return aiClean(event.rules) ? `The rules for ${event.title} are:\n${event.rules}` : `Rules and guidelines have not been published for ${event.title} yet.`;
  if (field==='participationDetails') return aiClean(event.participationDetails) ? `Participation details for ${event.title}:\n${event.participationDetails}` : `Participation details have not been published for ${event.title} yet.`;
  if (field==='registrationFee') return Number(event.isPaid) ? `The registration fee for ${event.title} is ₹${event.registrationFee ?? 'not specified'}.` : `${event.title} is a free event, so there is no registration fee.`;
  if (field==='venue') return `${event.title} is scheduled at ${event.venue || 'a venue that has not been published yet'}.`;
  if (field==='date') return `${event.title} is scheduled for ${aiDate(event.date)}.`;
  if (field==='time') return `${event.title} is scheduled at ${event.time || 'a time that has not been published yet'}.`;
  if (field==='organizer') return `${event.title} is organized by ${event.college || 'the organizing college listed on NXTURE'}. Responsible faculty: ${event.responsibleFacultyName || 'not published'}.`;
  if (field==='phases') {
    if (!phases.length) return `No phase or round information has been published for ${event.title} yet.`;
    return `${event.title} has ${phases.length} phase${phases.length===1?'':'s'}:\n` + phases.map(p => {
      let line=`Phase ${p.phaseNumber}: ${p.phaseName} — ${p.status}`;
      if (p.startDate || p.endDate) line += ` (${p.startDate ? aiDate(p.startDate) : ''}${p.endDate ? ` to ${aiDate(p.endDate)}` : ''})`;
      if (p.resultPublished) line += `\nResult: ${p.resultTitle || 'Result published'}${p.resultDetails ? ` — ${p.resultDetails}` : ''}`;
      return line;
    }).join('\n');
  }
  return `${event.title}\nOrganizer: ${event.college || 'not published'}\nParticipation: ${event.participationType === 'inter_college' ? 'Inter-college' : event.participationType === 'open' ? 'Open to all colleges' : 'Organizing college only'}\nDate: ${aiDate(event.date)}\nTime: ${event.time || 'not published'}\nVenue: ${event.venue || 'not published'}\nRegistration: ${Number(event.isPaid) ? `₹${event.registrationFee ?? 'not specified'}` : 'Free'}\nStatus: ${event.status || 'published'}`;
}


async function handleAiAssistant(req, res) {
  try {
    const query = String(req.body.query || '').trim();
    if (!query) return res.status(400).json({message:'Ask me a question about information available on NXTURE.'});
    if (query.length > 500) return res.status(400).json({message:'Please keep your question below 500 characters.'});

    const role = req.user.role;
    let events = [];
    let registrations = [];
    let scopeLabel = '';

    if (role === 'student') {
      events = await all(`${eventSelect()} WHERE COALESCE(e.status,'published') IN ('published','live','completed') AND (e.participation_type='inter_college' OR e.participation_type='open' OR e.college=?) ORDER BY datetime(e.date||' '||e.time) ASC`, [req.user.college]);
      registrations = await all(`SELECT r.id,r.event_id AS eventId,r.status,r.payment_status AS paymentStatus,e.title AS eventTitle,e.date,e.time,e.venue,e.is_paid AS isPaid,e.registration_fee AS registrationFee,e.college AS organizerCollege FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.student_id=? ORDER BY r.registered_at DESC`, [req.user.id]);
      scopeLabel = 'events available to you';
    } else if (role === 'faculty') {
      events = await all(`${eventSelect()} WHERE e.responsible_faculty_id=? ORDER BY datetime(e.date||' '||e.time) ASC`, [req.user.id]);
      scopeLabel = 'events assigned to you';
    } else if (role === 'admin') {
      events = await all(`${eventSelect()} WHERE e.college=? ORDER BY datetime(e.date||' '||e.time) ASC`, [COLLEGE_NAME]);
      scopeLabel = 'events organized by your college';
    }

    const q = query.toLowerCase();

    if (/^(what events|which events|show events|available events|upcoming events|list events)/.test(q)) {
      const upcoming = events.filter(e => ['published','live'].includes(String(e.status || 'published'))).slice(0, 10);
      const answer = upcoming.length
        ? `Here are the current ${scopeLabel}:\n${upcoming.map(e => `• ${e.title} — ${aiDate(e.date)} — ${e.venue || 'Venue not published'}`).join('\n')}`
        : `There are no current ${scopeLabel} right now.`;
      return res.json({answer, grounded:true});
    }

    if (role === 'student' && /my registration|my registrations|registered event|did i register|my payment|payment status/.test(q)) {
      if (!registrations.length) return res.json({answer:'You do not have any event registrations yet.',grounded:true});
      const answer = `Your current registrations:\n${registrations.map(r => `• ${r.eventTitle} — ${r.status || 'registered'}${Number(r.isPaid) ? ` — Payment: ${r.paymentStatus || 'pending'}` : ''}`).join('\n')}`;
      return res.json({answer,grounded:true});
    }

    const countQuestion = /(how many|number of|count|total).*(student|participant|registration|attendance|attended|certificate|payment)/.test(q)
      || /(student|participant|registration|attendance|attended|certificate|payment).*(how many|number|count|total)/.test(q);
    if ((role === 'admin' || role === 'faculty') && countQuestion) {
      const event = aiFindEvent(query, events);
      if (event) {
        const counts = await get(`SELECT
          (SELECT COUNT(*) FROM registrations WHERE event_id=?) AS registrations,
          (SELECT COUNT(*) FROM attendance WHERE event_id=?) AS attendance,
          (SELECT COUNT(*) FROM certificates WHERE event_id=?) AS certificates,
          (SELECT COUNT(*) FROM registrations WHERE event_id=? AND payment_status='verified') AS verifiedPayments,
          (SELECT COUNT(*) FROM registrations WHERE event_id=? AND payment_status='pending') AS pendingPayments,
          (SELECT COUNT(*) FROM registrations WHERE event_id=? AND payment_status='rejected') AS rejectedPayments`, [event.id,event.id,event.id,event.id,event.id,event.id]);
        if (/attendance|attended/.test(q)) return res.json({answer:`${event.title} has ${counts.attendance || 0} attendance record${Number(counts.attendance) === 1 ? '' : 's'} out of ${event.registrationCount || 0} registration${Number(event.registrationCount) === 1 ? '' : 's'}.`,grounded:true,eventId:event.id,eventTitle:event.title});
        if (/certificate/.test(q)) return res.json({answer:`${event.title} has ${counts.certificates || 0} certificate${Number(counts.certificates) === 1 ? '' : 's'} issued.`,grounded:true,eventId:event.id,eventTitle:event.title});
        if (/payment/.test(q)) return res.json({answer:`For ${event.title}: ${counts.verifiedPayments || 0} verified, ${counts.pendingPayments || 0} pending, and ${counts.rejectedPayments || 0} rejected payment record${Number(counts.verifiedPayments)+Number(counts.pendingPayments)+Number(counts.rejectedPayments) === 1 ? '' : 's'}.`,grounded:true,eventId:event.id,eventTitle:event.title});
        return res.json({answer:`${event.title} currently has ${event.registrationCount || 0} registration${Number(event.registrationCount) === 1 ? '' : 's'}.`,grounded:true,eventId:event.id,eventTitle:event.title});
      }
      if (/all|overall|total/.test(q)) {
        const counts = await get(`SELECT
          (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id=r.event_id WHERE e.college=?) AS registrations,
          (SELECT COUNT(*) FROM attendance a JOIN events e ON e.id=a.event_id WHERE e.college=?) AS attendance,
          (SELECT COUNT(*) FROM certificates c JOIN events e ON e.id=c.event_id WHERE e.college=?) AS certificates`, [COLLEGE_NAME,COLLEGE_NAME,COLLEGE_NAME]);
        if (/attendance|attended/.test(q)) return res.json({answer:`Across your college's events, there are ${counts.attendance || 0} attendance records.`,grounded:true});
        if (/certificate/.test(q)) return res.json({answer:`Across your college's events, ${counts.certificates || 0} certificates have been issued.`,grounded:true});
        return res.json({answer:`Across your college's events, there are ${counts.registrations || 0} registrations.`,grounded:true});
      }
    }

    const event = aiFindEvent(query, events);
    if (event) {
      const phases = await getEventPhases(event.id);
      const answer = aiAnswerForEvent(query,event,phases);
      return res.json({answer,grounded:true,eventId:event.id,eventTitle:event.title});
    }

    if (/hello|hi|hey|help|what can you do/.test(q)) {
      const intro = role === 'admin'
        ? 'Hi! I am the NXTURE AI Assistant for Admin. Ask me about events, registrations, participant counts, attendance, certificates, payments, phases, results, or college event information.'
        : role === 'faculty'
          ? 'Hi! I am the NXTURE AI Assistant for Faculty. Ask me about your assigned events, participant counts, attendance, certificates, payments, phases, results, or event information.'
          : 'Hi! I am the NXTURE AI Assistant for Students. Ask me about events, dates, venues, objectives, prizes, certificates, eligibility, rules, registration fees, phases, published results, or your registrations.';
      return res.json({answer:intro,grounded:true});
    }

    return res.json({answer:'I could not find that information in the NXTURE website data currently available to you. I do not want to guess or invent an answer. Try mentioning the event name or ask about its date, venue, prizes, rules, eligibility, phases, results, registrations, attendance, or certificates.',grounded:false});
  } catch (e) {
    console.error(e);
    res.status(500).json({message:'The AI assistant could not process your question right now.'});
  }
}

app.post('/api/ai-assistant', auth(), handleAiAssistant);
app.post('/api/student/ai-assistant', auth('student'), handleAiAssistant);

app.get("/api/health",(req,res)=>res.json({status:"ok",database:"sqlite",otpAuth:true}));
app.get("/",(req,res)=>res.sendFile(path.join(frontendRoot,"index.html")));

initDatabase().then(()=>app.listen(PORT,()=>console.log(`NXTURE server running at http://localhost:${PORT}`))).catch(e=>{console.error("Database initialization failed:",e);process.exit(1);});
