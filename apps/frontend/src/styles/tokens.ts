export const colors = {
  primary: "#020202",
  accent: "#B2D5E5",
  background: "#020202",
  surface: "#161616",
  border: "#262626",
  text: {
    primary: "#FFFFFF",
    secondary: "#A1A1AA",
  },
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  muted: "#171717",
} as const;

export const typography = {
  heading1: "48px",
  heading2: "36px",
  heading3: "30px",
  heading4: "24px",
  body: "16px",
  small: "14px",
  caption: "12px",
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const spacing = {
  4: "4px",
  8: "8px",
  12: "12px",
  16: "16px",
  20: "20px",
  24: "24px",
  32: "32px",
  40: "40px",
  48: "48px",
  64: "64px",
  80: "80px",
  96: "96px",
} as const;

export const radius = {
  small: "8px",
  medium: "12px",
  large: "16px",
  extraLarge: "24px",
} as const;

export const shadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.06)",
  md: "0 4px 12px -2px rgb(0 0 0 / 0.4)",
  lg: "0 12px 32px -8px rgb(0 0 0 / 0.5)",
} as const;

export const zIndex = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
} as const;

export const transition = {
  fast: "150ms",
  base: "200ms",
  slow: "300ms",
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export const iconSizes = {
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

export const animationDuration = {
  hover: "150ms",
  fade: "200ms",
  slide: "200ms",
  scale: "200ms",
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  zIndex,
  transition,
  iconSizes,
  animationDuration,
} as const;

export type Tokens = typeof tokens;