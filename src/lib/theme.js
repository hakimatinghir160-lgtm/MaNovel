// System-level theme management with automatic dark mode sync.
const THEME_KEY = "app_theme"; // 'light' | 'dark' | 'system'

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function getSystemDark() {
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getEffectiveTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return getSystemDark() ? "dark" : "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
}

export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  applyTheme(theme === "system" ? (getSystemDark() ? "dark" : "light") : theme);
}

export function getThemePreference() {
  return getStoredTheme() || "system";
}

// Initialize theme as early as possible and keep it in sync with the OS.
export function initTheme() {
  applyTheme(getEffectiveTheme());
  if (typeof window === "undefined" || !window.matchMedia) return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    const stored = getStoredTheme();
    if (stored !== "light" && stored !== "dark") {
      applyTheme(getSystemDark() ? "dark" : "light");
    }
  };
  if (mq.addEventListener) {
    mq.addEventListener("change", handler);
  } else if (mq.addListener) {
    mq.addListener(handler);
  }
}