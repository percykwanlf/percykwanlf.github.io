const nav = document.getElementById("site-nav");
const toggle = document.querySelector(".menu-toggle");
const themeToggle = document.getElementById("theme-toggle");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle?.setAttribute("aria-expanded", "false");
  });
});

const THEME_KEY = "lfk_theme";

const applyTheme = (theme) => {
  const normalized = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", normalized);

  if (themeToggle) {
    const isLight = normalized === "light";
    themeToggle.setAttribute("aria-pressed", String(isLight));
    themeToggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
    themeToggle.textContent = isLight ? "Light" : "Dark";
  }
};

const initTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
    return;
  }

  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(prefersLight ? "light" : "dark");
};

initTheme();

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

const setActiveLink = () => {
  const offset = window.scrollY + 140;
  let currentId = "";

  for (const section of sections) {
    if (section.offsetTop <= offset) {
      currentId = section.id;
    }
  }

  navLinks.forEach((link) => {
    const id = link.getAttribute("href").slice(1);
    link.classList.toggle("active", id === currentId);
  });
};

window.addEventListener("scroll", setActiveLink);
window.addEventListener("load", setActiveLink);

const year = document.getElementById("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}
