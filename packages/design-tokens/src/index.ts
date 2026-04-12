export const colors = {
  background: '#F6F3EC',
  backgroundAccent: '#ECE5D8',
  surface: '#FFFFFF',
  surfaceMuted: '#F3EEE4',
  surfaceStrong: '#16324A',
  textPrimary: '#112235',
  textSecondary: '#5E6D78',
  textInverse: '#FFFDF8',
  accent: '#0F8B8D',
  accentSoft: '#D5F1EC',
  positive: '#1E9E62',
  positiveSoft: '#DFF6E8',
  negative: '#C25A44',
  negativeSoft: '#FDE5DE',
  warning: '#C9861A',
  border: '#E3DCCA',
  skeleton: '#E9E1D2',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const typography = {
  display: 32,
  title: 24,
  heading: 18,
  body: 15,
  caption: 13,
  micro: 11,
};

export const shadows = {
  card: {
    shadowColor: '#0F1E2A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
};

export const appTheme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
};

export const webThemeVariables = {
  '--pv-color-background': colors.background,
  '--pv-color-background-accent': colors.backgroundAccent,
  '--pv-color-surface': colors.surface,
  '--pv-color-surface-muted': colors.surfaceMuted,
  '--pv-color-surface-strong': colors.surfaceStrong,
  '--pv-color-text-primary': colors.textPrimary,
  '--pv-color-text-secondary': colors.textSecondary,
  '--pv-color-text-inverse': colors.textInverse,
  '--pv-color-accent': colors.accent,
  '--pv-color-accent-soft': colors.accentSoft,
  '--pv-color-positive': colors.positive,
  '--pv-color-positive-soft': colors.positiveSoft,
  '--pv-color-negative': colors.negative,
  '--pv-color-negative-soft': colors.negativeSoft,
  '--pv-color-warning': colors.warning,
  '--pv-color-border': colors.border,
  '--pv-color-skeleton': colors.skeleton,
  '--pv-radius-sm': `${radius.sm}px`,
  '--pv-radius-md': `${radius.md}px`,
  '--pv-radius-lg': `${radius.lg}px`,
  '--pv-space-xs': `${spacing.xs}px`,
  '--pv-space-sm': `${spacing.sm}px`,
  '--pv-space-md': `${spacing.md}px`,
  '--pv-space-lg': `${spacing.lg}px`,
  '--pv-space-xl': `${spacing.xl}px`,
  '--pv-space-xxl': `${spacing.xxl}px`,
  '--pv-font-display': `${typography.display}px`,
  '--pv-font-title': `${typography.title}px`,
  '--pv-font-heading': `${typography.heading}px`,
  '--pv-font-body': `${typography.body}px`,
  '--pv-font-caption': `${typography.caption}px`,
  '--pv-font-micro': `${typography.micro}px`,
} as const;
