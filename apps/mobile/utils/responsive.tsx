import { useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions } from "react-native";
import type { TextProps, TextStyle } from "react-native";

export const RESPONSIVE_REFERENCE_WIDTH = 375;
export const RESPONSIVE_MIN_SCALE = 0.85;
export const RESPONSIVE_MAX_SCALE = 1.3;
export const MAX_CONTENT_WIDTH = 640;
export const MAX_FONT_SIZE_MULTIPLIER = 1.2;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSizes = {
  small: 12,
  normal: 14,
  body: 16,
  large: 20,
  title: 24,
} as const;

export function useResponsive() {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const ratio = Math.min(
      RESPONSIVE_MAX_SCALE,
      Math.max(RESPONSIVE_MIN_SCALE, width / RESPONSIVE_REFERENCE_WIDTH),
    );
    const scale = (size: number) => size * ratio;
    const moderateScale = (size: number, factor = 0.5) =>
      size + (scale(size) - size) * factor;

    return { scale, moderateScale };
  }, [width]);
}

export function ResponsiveText(props: TextProps) {
  const { moderateScale } = useResponsive();
  const flattenedStyle = StyleSheet.flatten(props.style) as TextStyle | undefined;

  return (
    <Text
      {...props}
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      style={[
        props.style,
        flattenedStyle?.fontSize === undefined
          ? undefined
          : { fontSize: moderateScale(flattenedStyle.fontSize) },
        flattenedStyle?.lineHeight === undefined
          ? undefined
          : { lineHeight: moderateScale(flattenedStyle.lineHeight) },
      ]}
    />
  );
}
