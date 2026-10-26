import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';

const W = 180;
const H = 210;
const GLASS = 'M90 72 C62 72 46 94 46 116 C46 136 60 148 70 160 L70 172 L110 172 L110 160 C120 148 134 136 134 116 C134 94 118 72 90 72 Z';

function Glass({ fill }: { fill: string }) {
  return (
    <>
      <Path d={GLASS} fill={fill} stroke={colors.ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M80 160 L80 128 L86 120 L94 128 L100 120 L100 160" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" />
    </>
  );
}

/** Hanging bulb whose glow opacity (0–1) animates over 300ms. */
export function Bulb({ glow }: { glow: number }) {
  const opacity = useSharedValue(glow);
  useEffect(() => {
    opacity.value = withTiming(glow, { duration: 300 });
  }, [glow, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.wrap} testID="bulb" accessibilityLabel={`Bulb glow ${Math.round(glow * 100)}%`}>
      <Animated.View style={[StyleSheet.absoluteFill, animated]} pointerEvents="none">
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.9} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={90} cy={118} r={88} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Line x1={90} y1={0} x2={90} y2={48} stroke={colors.ink} strokeWidth={3} />
        <Rect x={76} y={48} width={28} height={24} rx={4} fill={colors.ink} />
        <Glass fill={colors.white} />
        <Rect x={72} y={172} width={36} height={14} rx={3} fill={colors.inkMuted} />
        <Rect x={78} y={186} width={24} height={8} rx={3} fill={colors.ink} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, animated]} pointerEvents="none">
        <Svg width={W} height={H}>
          <Glass fill={colors.accent} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: H, alignSelf: 'center' },
});
