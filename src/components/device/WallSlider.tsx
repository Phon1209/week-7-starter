import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

interface Props {
  value: number;
  noun: string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

/** Wall plate holding a 0–100 slider. Only onCommit (release) should write. */
export function WallSlider({ value, noun, onChange, onCommit }: Props) {
  return (
    <View style={styles.plate}>
      <View style={styles.screws}>
        <View style={styles.screw} />
        <Text style={styles.value} testID="slider-value">
          {value}%
        </Text>
        <View style={styles.screw} />
      </View>
      <Slider
        testID="wall-slider"
        accessibilityLabel={`${noun} level`}
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={(v) => onChange(Math.round(v))}
        onSlidingComplete={(v) => onCommit(Math.round(v))}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.switchOff}
        thumbTintColor={colors.ink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  screws: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screw: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.switchOff },
  value: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 22 },
  slider: { width: '100%', height: 40 },
});
