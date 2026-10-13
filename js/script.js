const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const currentYear = document.getElementById("current-year");
if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

// These values intentionally start at zero.
// Later, the backend will replace them with real database values.
const platformData = {
  events: 0,
  registrations: 0,
  participants: 0
};

document.getElementById("preview-events").textContent = platformData.events;
document.getElementById("preview-registrations").textContent = platformData.registrations;
document.getElementById("preview-participants").textContent = platformData.participants;
