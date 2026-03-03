import { useEffect } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../theme/colors';

const MESSAGES = {
  boost:        'あなたの応援が届きました',
  backstage:    '制作への想いが届きました',
  participate:  'あなたの想いが深く届きました',
  message:      'メッセージが届きました',
  liked:        'あなたのいいねが記録されました',
  shared:       '共有が記録されました',
};

const EMOJIS = {
  boost: '⚡',
  backstage: '🎨',
  participate: '🌟',
  message: '💌',
  liked: '❤️',
  shared: '🚀',
};

export default function ContributionReceipt({ visible, type = 'boost', onDismiss }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    if (visible) {
      opacity.value = withSequence(
        withTiming(1, { duration: 280 }),
        withDelay(1500, withTiming(0, { duration: 280 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        }))
      );
      translateY.value = withSequence(
        withTiming(0, { duration: 280 }),
        withDelay(1500, withTiming(-20, { duration: 280 }))
      );
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[styles.receipt, animStyle]}>
          <Text style={styles.emoji}>{EMOJIS[type] || '✨'}</Text>
          <Text style={styles.message}>{MESSAGES[type] || MESSAGES.boost}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  receipt: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 260,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 14,
  },
  message: {
    fontSize: 16,
    color: Colors.foreground,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
});
