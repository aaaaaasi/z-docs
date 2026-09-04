/**
 * Shared settings helpers: localStorage keys + the workspace accent system.
 *
 * The accent is persisted in localStorage and applied by overriding the theme
 * CSS variables (--primary / --ring / --primary-foreground) inline on
 * documentElement. It is theme-aware: dark mode gets a lightened accent with a
 * dark ink foreground so contrast stays Google-clean in both appearances.
 */

export const USER_STORAGE_KEY = "zdocs-user"
export const ACCENT_STORAGE_KEY = "zdocs-accent"
export const FONT_STORAGE_KEY = "zdocs-default-font"
export const ZOOM_STORAGE_KEY = "zdocs-default-zoom"
/** local mirror of the theme *mode* (light / dark / system) — see useThemeMode */
export const THEME_MODE_STORAGE_KEY = "zdocs-theme-mode"

export interface AccentOption {
  name: string
  hex: string
}

/** Five non-blue accents; Teal is the product default. */
export const ACCENT_OPTIONS: AccentOption[] = [
  { name: "Teal", hex: "#0b6b62" },
  { name: "Forest", hex: "#3f6b35" },
  { name: "Amber", hex: "#a8601a" },
  { name: "Rose", hex: "#a8435a" },
  { name: "Plum", hex: "#7a4a8a" },
]

export const DEFAULT_ACCENT_HEX = "#0b6b62"

export function readStoredAccent(): string | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(ACCENT_STORAGE_KEY)
    return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null
  } catch {
    return null
  }
}

/* ------------------------------ color helpers ------------------------------ */

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb
}

function rgbToHex(rgb: Rgb): string {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("")
}

/** Dark ink the accent is tinted toward for dark-mode foreground text. */
const DARK_INK: Rgb = [22, 20, 17]

/**
 * Apply the workspace accent by overriding theme CSS vars on documentElement.
 * No-op on the server. Light mode: raw hex + white foreground. Dark mode:
 * accent lightened 45% toward white with a dark tinted-ink foreground.
 */
export function applyAccent(hex: string): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  const rgb = hexToRgb(hex)
  const style = root.style
  if (root.classList.contains("dark")) {
    const lightened = rgbToHex(mix(rgb, [255, 255, 255], 0.45))
    style.setProperty("--primary", lightened)
    style.setProperty("--ring", lightened)
    style.setProperty("--primary-foreground", rgbToHex(mix(rgb, DARK_INK, 0.85)))
  } else {
    style.setProperty("--primary", hex)
    style.setProperty("--ring", hex)
    style.setProperty("--primary-foreground", "#ffffff")
  }
}

/** Remove the inline overrides (restore the stylesheet theme). */
export function clearAccent(): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style
  style.removeProperty("--primary")
  style.removeProperty("--ring")
  style.removeProperty("--primary-foreground")
}

/** Persist the accent choice and apply it immediately. */
export function saveAccent(hex: string): void {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, hex)
  } catch {
    // storage unavailable — still apply for this session
  }
  applyAccent(hex)
}
