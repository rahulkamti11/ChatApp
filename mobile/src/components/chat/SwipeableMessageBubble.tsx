import React, { useRef } from 'react';
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
} from 'react-native';
import { CornerUpLeft } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface SwipeableMessageBubbleProps {
  children: React.ReactNode;
  onSwipeReply?: () => void;
  disabled?: boolean;
}

export function SwipeableMessageBubble({
  children,
  onSwipeReply,
  disabled = false,
}: SwipeableMessageBubbleProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const replyTriggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled || !onSwipeReply) return false;
        // Only trigger horizontal right swipes
        return gestureState.dx > 10 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_, gestureState) => {
        if (disabled) return;
        if (gestureState.dx > 0) {
          // Clamp between 0 and 65
          const clampedX = Math.min(gestureState.dx, 65);
          pan.setValue(clampedX);

          if (clampedX >= 40 && !replyTriggeredRef.current) {
            replyTriggeredRef.current = true;
            if (onSwipeReply) {
              onSwipeReply();
            }
          }
        }
      },
      onPanResponderRelease: () => {
        replyTriggeredRef.current = false;
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 7,
        }).start();
      },
      onPanResponderTerminate: () => {
        replyTriggeredRef.current = false;
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const iconOpacity = pan.interpolate({
    inputRange: [0, 20, 40],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  const iconScale = pan.interpolate({
    inputRange: [0, 20, 40],
    outputRange: [0.5, 0.8, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Reply Icon Indicator behind the bubble on the left */}
      <Animated.View
        style={[
          styles.replyIconContainer,
          {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <View style={styles.replyIconCircle}>
          <CornerUpLeft size={16} color="#FFFFFF" />
        </View>
      </Animated.View>

      {/* Swipeable Message Bubble */}
      <Animated.View
        style={{ transform: [{ translateX: pan }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  replyIconContainer: {
    position: 'absolute',
    left: 4,
    top: '30%',
    zIndex: -1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
