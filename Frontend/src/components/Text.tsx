import React from 'react';
import { StyleSheet, Text as RNText, TextProps } from 'react-native';

const WEIGHT_MAP: Record<string, string> = {
  '100': 'Poppins_100Thin',
  '200': 'Poppins_200ExtraLight',
  '300': 'Poppins_300Light',
  '400': 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  '800': 'Poppins_800ExtraBold',
  '900': 'Poppins_900Black',
  normal: 'Poppins_400Regular',
  bold: 'Poppins_700Bold',
};

export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weight = String(flat.fontWeight ?? 'normal');
  const fontFamily = WEIGHT_MAP[weight] ?? 'Poppins_400Regular';
  return <RNText style={[style, { fontFamily }]} {...props} />;
}
