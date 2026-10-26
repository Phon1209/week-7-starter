import Svg, { Line } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** Single-side dashed borders render inconsistently across platforms, so draw the line. */
export function DashedDivider() {
  return (
    <Svg width="100%" height={2}>
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={colors.cardBorder} strokeWidth={1.5} strokeDasharray="5 5" />
    </Svg>
  );
}
