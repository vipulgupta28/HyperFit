import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const B = 32;

export function AppLoader() {
  const phase = useRef(new Animated.Value(0)).current;
  const morph = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Accelerate into collision, decelerate out — physics feel
    Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 650, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 950, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Independent shape morph (non-native — drives borderRadius)
    Animated.loop(
      Animated.sequence([
        Animated.timing(morph, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(morph, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
  }, [phase, morph]);

  // Blob centers travel from ±26 (separated) to ±14 (touching)
  const x1 = phase.interpolate({ inputRange: [0, 1], outputRange: [-26, -14] });
  const x2 = phase.interpolate({ inputRange: [0, 1], outputRange: [26, 14] });

  // Stretch while moving, compress on impact, expand perpendicularly
  const sX = phase.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1.0, 1.1, 0.63] });
  const sY = phase.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1.0, 0.92, 1.44] });

  // Organic shape — two poles cycling at different rates per blob
  const rA = morph.interpolate({ inputRange: [0, 1], outputRange: [B * 0.52, B * 0.22] });
  const rB = morph.interpolate({ inputRange: [0, 1], outputRange: [B * 0.22, B * 0.52] });

  return (
    <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      {/* Blob 1 — moves right into collision */}
      <Animated.View style={{ position: 'absolute', transform: [{ translateX: x1 }, { scaleX: sX }, { scaleY: sY }] }}>
        <Animated.View style={{
          width: B, height: B, backgroundColor: '#FFFFFF',
          borderTopLeftRadius: rA, borderTopRightRadius: rB,
          borderBottomRightRadius: rA, borderBottomLeftRadius: rB,
        }} />
      </Animated.View>
      {/* Blob 2 — moves left into collision */}
      <Animated.View style={{ position: 'absolute', transform: [{ translateX: x2 }, { scaleX: sX }, { scaleY: sY }] }}>
        <Animated.View style={{
          width: B, height: B, backgroundColor: '#FFFFFF',
          borderTopLeftRadius: rB, borderTopRightRadius: rA,
          borderBottomRightRadius: rB, borderBottomLeftRadius: rA,
        }} />
      </Animated.View>
    </View>
  );
}
