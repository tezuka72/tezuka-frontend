import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../theme/colors';

// heatLevel: 0.0〜1.0  数値は表示しない
// size: リングの直径(px)
export default function HeatRing({ heatLevel = 0.5, size = 72 }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  // heatLevelに応じてボーダーカラーを決定（静的）
  const getBorderColor = () => {
    if (heatLevel < 0.25) return Colors.indigo;
    if (heatLevel < 0.5)  return Colors.violet;
    if (heatLevel < 0.75) return Colors.rose;
    return Colors.primary;
  };

  const borderWidth = Math.round(2 + heatLevel * 4);
  const innerSize = size - borderWidth * 2 - 4;
  const baseOpacity = 0.35 + heatLevel * 0.55;

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: baseOpacity * (0.8 + 0.2 * pulse.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: getBorderColor(),
          },
          pulseStyle,
        ]}
      />
      <View
        style={[
          styles.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  inner: {
    backgroundColor: Colors.background,
  },
});
