const form = document.getElementById("login-form");
const roleInput = document.getElementById("role");
const roleOptions = document.querySelectorAll(".role-option");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailError = document.getElementById("email-error");
const passwordError = document.getElementById("password-error");
const formMessage = document.getElementById("form-message");
const passwordToggle = document.getElementById("password-toggle");
const forgotPassword = document.getElementById("forgot-password");
const otpBox = document.getElementById("login-otp-box");
const otpInput = document.getElementById("login-otp");
const verifyOtpButton = document.getElementById("verify-login-otp");
const resendOtpButton = document.getElementById("resend-login-otp");
const otpMessage = document.getElementById("login-otp-message");
const otpTimer = document.getElementById("login-otp-timer");

let otpRequested = false;
let otpTimerId = null;

roleOptions.forEach((option) => {
  option.addEventListener("click", () => {
    roleOptions.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });
    option.classList.add("active");
    option.setAttribute("aria-selected", "true");
    roleInput.value = option.dataset.role;
    resetOtp();
    clearMessage();
  });
});

passwordToggle.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  passwordToggle.textContent = isPassword ? "Hide" : "Show";
});

function clearErrors() {
  emailError.textContent = "";
  passwordError.textContent = "";
  emailInput.classList.remove("invalid");
  passwordInput.classList.remove("invalid");
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.classList.remove("success");
}

function collegeEmailValid(email) {
  if (roleInput.value === "student") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email);
  }
  if (roleInput.value === "faculty") {
    return /^[^\s@]+@atme\.edu\.in$/i.test(email);
  }
  return true;
}

function validateForm() {
  clearErrors();
  clearMessage();
  let valid = true;
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    emailError.textContent = "College email is required.";
    emailInput.classList.add("invalid");
    valid = false;
  } else if (roleInput.value !== "admin" && !collegeEmailValid(email)) {
    emailError.textContent = roleInput.value === "student"
      ? "Enter a valid email address."
      : "Use your official faculty email ending with @atme.edu.in.";
    emailInput.classList.add("invalid");
    valid = false;
  }

  if (!passwordInput.value) {
    passwordError.textContent = "Password is required.";
    passwordInput.classList.add("invalid");
    valid = false;
  }

  return valid;
}

function resetOtp() {
  otpRequested = false;
  otpBox.hidden = true;
  otpInput.value = "";
  otpInput.disabled = false;
  verifyOtpButton.disabled = false;
  resendOtpButton.disabled = false;
  otpMessage.textContent = "";
  otpTimer.textContent = "";
  if (otpTimerId) clearInterval(otpTimerId);
}

function startTimer(seconds) {
  if (otpTimerId) clearInterval(otpTimerId);
  let remaining = seconds;
  const tick = () => {
    otpTimer.textContent = remaining > 0
      ? `Expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
      : "OTP expired";
    if (remaining <= 0) {
      clearInterval(otpTimerId);
      otpRequested = false;
    }
    remaining--;
  };
  tick();
  otpTimerId = setInterval(tick, 1000);
}

async function requestLoginOtp() {
  const response = await fetch("/api/auth/login/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailInput.value.trim().toLowerCase(),
      password: passwordInput.value,
      role: roleInput.value
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to send login OTP.");
  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  const role = roleInput.value;
  const submitButton = form.querySelector(".submit-button");

  // Admin and faculty accounts are created/activated by the college admin and use password login.
  if (role === "admin" || role === "faculty") {
    submitButton.disabled = true;
    submitButton.querySelector("span:first-child").textContent = "Signing in...";
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.value.trim().toLowerCase(),
          password: passwordInput.value,
          role
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to sign in.");
      localStorage.setItem("nxture_token", data.token);
      localStorage.setItem("nxture_user", JSON.stringify(data.user));
      window.location.href = data.redirect || "admin-dashboard.html";
    } catch (error) {
      formMessage.textContent = error.message;
      submitButton.disabled = false;
      submitButton.querySelector("span:first-child").textContent = "Sign In";
    }
    return;
  }

  if (otpRequested) {
    otpInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span:first-child").textContent = "Sending OTP...";

  try {
    const data = await requestLoginOtp();
    otpRequested = true;
    otpBox.hidden = false;
    otpMessage.textContent = data.message;
    otpMessage.className = "otp-message success";
    startTimer(data.expiresIn || 300);
    submitButton.disabled = false;
    submitButton.querySelector("span:first-child").textContent = "OTP Sent — Enter OTP";
    otpInput.focus();
  } catch (error) {
    formMessage.textContent = error.message;
    submitButton.disabled = false;
    submitButton.querySelector("span:first-child").textContent = "Sign In";
  }
});

async function verifyLoginOtp() {
  const otp = otpInput.value.trim();
  if (!/^\d{6}$/.test(otp)) {
    otpMessage.textContent = "Enter the 6-digit OTP.";
    otpMessage.className = "otp-message error";
    return;
  }

  verifyOtpButton.disabled = true;
  verifyOtpButton.textContent = "Verifying...";

  try {
    const response = await fetch("/api/auth/login/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value.trim().toLowerCase(),
        password: passwordInput.value,
        otp,
        role: roleInput.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Invalid OTP.");

    localStorage.setItem("nxture_token", data.token);
    localStorage.setItem("nxture_user", JSON.stringify(data.user));
    window.location.href = data.redirect;
  } catch (error) {
    otpMessage.textContent = error.message;
    otpMessage.className = "otp-message error";
    verifyOtpButton.disabled = false;
  } finally {
    verifyOtpButton.textContent = "Verify & Sign In";
  }
}

verifyOtpButton.addEventListener("click", verifyLoginOtp);

resendOtpButton.addEventListener("click", async () => {
  resendOtpButton.disabled = true;
  try {
    const data = await requestLoginOtp();
    otpRequested = true;
    otpMessage.textContent = data.message;
    otpMessage.className = "otp-message success";
    startTimer(data.expiresIn || 300);
    otpInput.value = "";
    otpInput.focus();
  } catch (error) {
    otpMessage.textContent = error.message;
    otpMessage.className = "otp-message error";
  } finally {
    resendOtpButton.disabled = false;
  }
});

forgotPassword.addEventListener("click", (event) => {
  event.preventDefault();
  clearErrors();
  formMessage.textContent = "Password recovery will be connected to the authentication service.";
});
