import { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { appTheme } from '../../theme';

type Props = {
  height: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({ height, width = '100%', style }: Props) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          height,
          width,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: appTheme.colors.skeleton,
    borderRadius: appTheme.radius.sm,
  },
});
