import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { STATIC_COLORS } from "@/constants/theme";

type SearchInputIconProps = {
  color?: ColorValue;
  size?: number;
  styleVariant?: "default" | "tab";
};

export function SearchInputIcon({
  color = STATIC_COLORS.iconMuted,
  size = 18,
  styleVariant = "default",
}: SearchInputIconProps) {
  if (styleVariant === "tab") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M17.5 11C17.5 14.5899 14.5899 17.5 11 17.5C7.41015 17.5 4.5 14.5899 4.5 11C4.5 7.41015 7.41015 4.5 11 4.5C14.5899 4.5 17.5 7.41015 17.5 11Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15.5 15.5L19.5 19.5"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.4}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="11"
        cy="11"
        r="6.5"
        stroke={color}
        strokeWidth="1.5"
      />
      <Path
        d="M16 16L20 20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
