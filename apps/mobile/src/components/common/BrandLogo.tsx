import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const logoSource = require('../../../assets/papervest-logo.png');

export function BrandLogo({ size = 120, style }: BrandLogoProps) {
  return (
    <View style={[styles.frame, { width: size, height: size }, style]}>
      <Image source={logoSource} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#18222B',
    shadowColor: '#172231',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
