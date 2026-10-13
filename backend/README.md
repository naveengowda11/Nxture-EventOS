# NXTURE Campus Event Management — Connected Backend

This layer connects the Admin, Student and Faculty dashboards to the same SQLite database.

## Important
Run `npm install` after extracting because this layer adds `multer` for event poster and payment QR uploads.

```bash
cd backend
npm install
node server.js
```

Open:

`http://localhost:5000`

## Connected flow

1. HOD/Admin creates an event.
2. Admin can assign a real faculty account as the responsible faculty coordinator.
3. The event is stored in SQLite and immediately becomes available to students from the same college.
4. Students register from the event card.
5. For paid events, the student sees the uploaded payment QR and submits the payment transaction/UTR reference.
6. The registration, student name, student ID, college email, department, year and payment reference are visible in Admin registrations.
7. The responsible faculty sees only the events assigned to them and their registered students.
8. Faculty can mark attendance and issue a certificate record after attendance is marked.
9. Admin can see attendance and certificate status in the registration records.

## Event media

- Event poster/image: JPG, PNG or WEBP, max 5 MB.
- Paid events require a payment QR image.
- Uploaded files are stored under `uploads/events` and `uploads/payments`.

## Payment note

The current paid-event flow records the student's transaction/UTR reference. It does not claim that the payment was automatically verified by a bank/payment gateway. Payment verification can be added as a separate payment layer later.

## Admin

Create the HOD/Admin account once:

```bash
node create-admin.js
```

## Environment

Create `backend/.env` from `.env.example` and set the JWT secret and email credentials used by the existing student OTP flow.

## Inter-college events and live phases

The current release supports students from colleges other than the organizing college.
Student signup asks for the student's college/institution and accepts a valid email address. Event organizers can choose `My college only`, `Inter-college`, or `Open to all colleges`.

Event creation also supports objectives, prize details, certificate details, participation details, eligibility, rules, and multiple event phases.

For multi-phase events, organizers can update each phase from Manage Event. Publishing a phase result updates the student dashboard and creates an in-app notification for registered participants. Phase dates, status, result details, and an optional result link are stored in SQLite.
