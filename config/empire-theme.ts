/**
 * EmpiRE-Compass inspired theme colors
 * Based on https://github.com/okarras/EmpiRE-Compass
 * Primary: coral/salmon (#e86161 light, #ff7b7b dark)
 * Secondary: blue (#1e88e5 light, #64b5f6 dark)
 * Background: #f5f5f5 light, #0a1929 dark (deep navy)
 */

// Coral/salmon scale - EmpiRE-Compass primary
const empirePrimary = {
  50: "#fef2f2",
  100: "#fee2e2",
  200: "#fecaca",
  300: "#fca5a5",
  400: "#f87171",
  500: "#e86161", // EmpiRE light primary
  600: "#dc2626",
  700: "#b13737", // EmpiRE light primary dark
  800: "#991b1b",
  900: "#7f1d1d",
  DEFAULT: "#e86161",
  foreground: "#ffffff",
};

// Blue scale - EmpiRE-Compass secondary
const empireSecondary = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#64b5f6", // EmpiRE dark secondary
  500: "#1e88e5", // EmpiRE light secondary
  600: "#005cb2",
  700: "#004493",
  800: "#002e62",
  900: "#001731",
  DEFAULT: "#1e88e5",
  foreground: "#ffffff",
};

export const empireThemeLight = {
  layout: {
    radius: {
      small: "8px",
      medium: "8px",
      large: "8px",
    },
  },
  colors: {
    background: { DEFAULT: "#f5f5f5" },
    foreground: { DEFAULT: "rgba(0, 0, 0, 0.87)" },
    primary: empirePrimary,
    secondary: empireSecondary,
    content1: { DEFAULT: "#ffffff", foreground: "rgba(0, 0, 0, 0.87)" },
    content2: { DEFAULT: "#f5f5f5", foreground: "rgba(0, 0, 0, 0.6)" },
    content3: { DEFAULT: "#e5e5e5", foreground: "rgba(0, 0, 0, 0.6)" },
    content4: { DEFAULT: "#d4d4d4", foreground: "rgba(0, 0, 0, 0.6)" },
    divider: { DEFAULT: "rgba(0, 0, 0, 0.12)" },
    focus: { DEFAULT: "#1e88e5" },
  },
};

export const empireThemeDark = {
  layout: {
    radius: {
      small: "8px",
      medium: "8px",
      large: "8px",
    },
  },
  colors: {
    background: { DEFAULT: "#0a1929" },
    foreground: { DEFAULT: "#ffffff" },
    primary: {
      ...empirePrimary,
      500: "#ff7b7b",
      DEFAULT: "#ff7b7b",
      foreground: "#ffffff",
    },
    secondary: {
      ...empireSecondary,
      400: "#64b5f6",
      500: "#64b5f6",
      DEFAULT: "#64b5f6",
      foreground: "#ffffff",
    },
    content1: { DEFAULT: "#0f2744", foreground: "#ffffff" },
    content2: { DEFAULT: "#0a1929", foreground: "rgba(255, 255, 255, 0.7)" },
    content3: { DEFAULT: "#132f4c", foreground: "rgba(255, 255, 255, 0.7)" },
    content4: { DEFAULT: "#1a3a5c", foreground: "rgba(255, 255, 255, 0.7)" },
    divider: { DEFAULT: "rgba(255, 255, 255, 0.12)" },
    focus: { DEFAULT: "#64b5f6" },
  },
};
