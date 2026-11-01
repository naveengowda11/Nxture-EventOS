# NXTURE — Campus Event OS

**One platform to discover, organize, and manage campus events.**

NXTURE is a web-based Campus Event Operating System built to bring college event activities into one place. Students can discover events, register, follow event updates, and track attendance and certificates. Faculty and administrators use dedicated dashboards to publish events, manage participants, coordinate attendance, and review event activity.

Initially configured for **ATME College of Engineering**, the platform also supports events with different participation scopes, including college-only, inter-college, and open events.

---

## Table of Contents

- [Highlights](#highlights)
- [User Roles](#user-roles)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Variables](#environment-variables)
- [Creating the First Admin](#creating-the-first-admin)
- [Application Workflows](#application-workflows)
- [API Overview](#api-overview)
- [Important Notes and Current Limitations](#important-notes-and-current-limitations)
- [Contributors](#contributors)
- [Support](#support)

## Highlights

### Student portal

- Create a student account with email OTP verification.
- Sign in using the account authentication flow.
- View a personalized dashboard and profile.
- Browse published events and search/filter event listings.
- View event descriptions, dates, times, venue, organizer, participation scope, eligibility, rules, objectives, prizes, and phases when supplied.
- Register for events that are available to the student.
- Review registration and payment-reference status.
- Track attendance, certificates, and in-app notifications.
- View event phase updates and published results.
- Use the NXTURE AI Assistant to ask questions based on information available in the application.

### Event management

- Create, edit, update the status of, and delete events.
- Categorize events such as hackathons, workshops, quizzes, seminars, competitions, and other activities.
- Add event posters and payment QR images.
- Configure event date, time, venue, capacity, registration period, fee, eligibility, rules, and participation details.
- Select the event's participation scope:
  - **College only** — participants from the organizing college.
  - **Inter-college** — participants from other colleges can register.
  - **Open** — open participation.
- Add multiple phases for multi-stage events.
- Publish phase updates and results for registered participants.

### Faculty dashboard

- View assigned event information.
- View registered participants.
- Record event attendance.
- Process QR-based attendance check-ins.
- Issue certificate records for participants after attendance is recorded.

### Admin dashboard

- View platform and event information.
- Create and manage faculty accounts.
- Assign responsible faculty to events.
- Manage event records and event status.
- Review registrations and participant information.
- Review submitted payment references and update payment status.
- View student and faculty records.

### QR attendance and certificates

- QR-based check-in support through the faculty workflow.
- Certificate record creation through the faculty workflow.
- PDF certificate generation using the backend's PDF library.
- Public certificate verification page at `certificate-verify.html`.
- Certificate verification using a unique verification code.

### Notifications and AI assistant

- In-app student notifications.
- Notifications for published event phase/results updates.
- AI Assistant endpoints for student and admin interfaces, designed to answer based on information available in NXTURE.

## User Roles

| Role | Responsibilities |
|---|---|
| **Student** | Discover events, register, view event updates, check registration and payment-reference status, and access attendance/certificate information. |
| **Faculty** | View assigned event data, review participants, mark attendance, and issue certificates through the faculty dashboard. |
| **Admin** | Manage faculty accounts, create and manage events, review registrations, and administer payment-reference status. |

Protected backend routes use authentication and role checks to restrict access to the relevant operations.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite |
| Authentication | JSON Web Tokens (JWT), bcryptjs, email OTP |
| Email | Nodemailer |
| File uploads | Multer |
| QR code generation | qrcode |
| PDF generation | PDFKit |

The Express server serves both the frontend files and backend API. The current frontend does not require a separate framework build step.

## Project Structure

```text
Nxture-EventOS/
├── index.html
├── login.html
├── signup.html
├── student-dashboard.html
├── faculty-dashboard.html
├── admin-dashboard.html
├── certificate-verify.html
├── css/
│   ├── style.css
│   ├── login.css
│   ├── signup.css
│   ├── student-dashboard.css
│   └── admin-dashboard.css
├── js/
│   ├── script.js
│   ├── login.js
│   ├── signup.js
│   ├── student-dashboard.js
│   └── admin-dashboard.js
└── backend/
    ├── package.json
    ├── server.js
    ├── create-admin.js
    ├── README.md
    └── nxture.db
```

The backend uses `backend/nxture.db` as its SQLite database. Uploaded event media and related assets are stored under the project-level `uploads/` directory at runtime.

## Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) (LTS version recommended)
- npm (included with Node.js)
- [Git](https://git-scm.com/)

Verify your installation:

```bash
node --version
npm --version
git --version
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/naveengowda11/Nxture-EventOS.git
cd Nxture-EventOS
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a file named `.env` inside the `backend/` directory. See [Environment Variables](#environment-variables) below.

### 4. Create the initial admin account

Run the admin creation script from inside the `backend/` directory:

```bash
node create-admin.js
```

Enter the requested admin details when prompted.

### 5. Start the application

From the `backend/` directory:

```bash
npm start
```

The development script runs the same server:

```bash
npm run dev
```

### 6. Open the application

Visit:

```text
http://localhost:5000
```

The Express backend serves the landing page and the application routes from the same origin.

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
JWT_SECRET=replace_with_a_long_random_secret
EMAIL_SERVICE=gmail
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password
```

| Variable | Description |
|---|---|
| `PORT` | Express server port. Defaults to `5000`. |
| `JWT_SECRET` | Secret used to sign JWT authentication tokens. Use a long, random, private value. |
| `EMAIL_SERVICE` | Nodemailer email service. The backend defaults to Gmail when this is not set. |
| `EMAIL_USER` | Email account used to send OTP and application emails. |
| `EMAIL_PASS` | Email account app password or configured email credential. |

Email credentials are required for the email OTP workflows. For Gmail, use an app password where applicable. Never commit `.env` or publish email credentials.

## Creating the First Admin

The repository includes an interactive script:

```bash
cd backend
node create-admin.js
```

The script asks for the administrator's first name, last name, email, college, and password. The password must contain at least eight characters and is hashed before it is stored.

Keep the admin credentials private. Do not put real passwords in source code, screenshots, issue reports, or this README.

## Application Workflows

### Student account registration

1. Open the signup page and choose the student account type.
2. Enter the requested student and college information.
3. Request an OTP to the email address.
4. Verify the OTP.
5. Complete account creation and sign in.

### Event creation and publication

1. An administrator signs in to the admin dashboard.
2. The administrator creates an event and supplies its actual information.
3. The event can include a category, poster, date, time, venue, capacity, participation scope, eligibility, rules, prizes, fee, and registration window.
4. Organizers can configure phases for multi-stage events.
5. Students see events made available to their account according to the event's participation scope.

### Event registration and payment reference

1. A student opens an event and reviews its details.
2. The student submits the registration.
3. For a paid event, the event page can display the organizer's payment QR.
4. After making the payment externally, the student submits the transaction/UTR reference.
5. The submitted reference and payment status can be reviewed by the administrator.

### Attendance and certificate issuance

1. Faculty opens the assigned event and participant information.
2. Attendance is marked through the faculty dashboard, including the QR scan/check-in flow.
3. Faculty can issue a certificate record after attendance is recorded.
4. A certificate can be checked through the public verification page using its verification code.

### Event phases and results

1. An organizer adds event phases, such as preliminary, evaluation, and final rounds.
2. Phase status and details can be updated through event management.
3. When results are published, registered students can view the update through the student dashboard and in-app notifications.

## API Overview

The backend exposes REST-style endpoints under `/api`.

| Area | Routes |
|---|---|
| Authentication | `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/register`, `POST /api/auth/login/request-otp`, `POST /api/auth/login/verify-otp`, `POST /api/auth/login` |
| Admin | `GET /api/admin/dashboard`, `GET/POST /api/admin/faculty`, `POST /api/admin/events`, `PUT /api/admin/events/:id`, `PATCH /api/admin/events/:id/status`, `DELETE /api/admin/events/:id` |
| Registrations and payments | `POST /api/student/events/:eventId/register`, `POST /api/admin/registrations/:registrationId/payment` |
| Event phases | `GET/PUT /api/admin/events/:id/phases`, `PATCH /api/admin/events/:id/phases/:phaseId/result` |
| Student | `GET /api/student/dashboard`, `GET /api/student/notifications`, `POST /api/student/notifications/read` |
| Faculty | `GET /api/faculty/dashboard`, `POST /api/faculty/events/:eventId/attendance`, `POST /api/faculty/scan-qr`, `POST /api/faculty/events/:eventId/certificate` |
| Certificates | `GET /api/certificates/verify/:code` |
| Assistant | `POST /api/ai-assistant`, `POST /api/student/ai-assistant` |
| Health check | `GET /api/health` |

For request payloads, validation rules, and authorization requirements, refer to the route handlers in `backend/server.js`.

## Important Notes and Current Limitations

- **Payment gateway:** Paid-event registration currently supports displaying an organizer-provided payment QR and recording the student's transaction/UTR reference. This is not an integrated payment gateway, and the application does not automatically confirm bank transactions. An administrator reviews and updates the payment status.
- **Email delivery:** OTP and application emails depend on valid email settings in `backend/.env`.
- **AI assistant:** The in-app assistant is designed to answer questions using information available in the NXTURE application. Its responses depend on the backend implementation and any configured AI service. It should not be described as an unrestricted general-purpose AI model.
- **Database:** SQLite is used by the current version. For deployment, ensure the database file is stored on persistent storage and backed up regularly.
- **Uploads:** The backend creates upload directories at runtime. A deployment environment must allow file writes and preserve uploaded files.
- **Production deployment:** Before public production use, configure a strong JWT secret, enable HTTPS, protect email credentials, review upload validation and rate limiting, and establish database/file backups.

## Contributors

### Naveen Kumar B
**Co-Developer** · Computer Science & Engineering (Data Science), Third Year  
ATME College of Engineering

### Yashwin Gowda K
**Co-Developer** · Computer Science & Engineering (Data Science), Third Year  
ATME College of Engineering

Both contributors have equal involvement in product planning, UI/UX design, frontend development, backend development, database design, integration, and testing.

## Support

For project-related queries:

**Email:** [help.nexture@gmail.com](mailto:help.nexture@gmail.com)

## Repository

[github.com/naveengowda11/Nxture-EventOS](https://github.com/naveengowda11/Nxture-EventOS)
