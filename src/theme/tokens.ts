export const colors = {
  bg: '#FFF1C7',
  card: '#FFFBEF',
  cardBorder: '#F3E3B0',
  chip: '#E3E6F3',
  ink: '#1F2340',
  inkMuted: '#6B6F86',
  accent: '#FFC83D',
  live: '#22A06B',
  saving: '#E0A100',
  offline: '#9A9CAB',
  error: '#D64545',
  white: '#FFFFFF',
  switchOff: '#C9CBD6',
} as const;

export const radius = { panel: 20, tile: 14, pill: 999 } as const;

/** Inter families loaded in the root layout; RN falls back to the system font until then. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/** Purple, pink, green, blue, orange, teal — indexed by avatarColorIndex(uid). */
export const avatarPalette = ['#8B5CF6', '#EC4899', '#22A06B', '#3B82F6', '#F97316', '#14B8A6'] as const;

export const breakpoints = { tablet: 700, deviceRow: 900, desktop: 1000 } as const;

export function headlineSize(width: number): number {
  return width >= breakpoints.tablet ? 56 : 48;
}

export const sectionLabel = {
  fontSize: 12,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: colors.inkMuted,
  fontFamily: fonts.bold,
} as const;

export const tokens = { colors, radius, fonts, avatarPalette, breakpoints, sectionLabel } as const;
