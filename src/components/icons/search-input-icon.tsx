import Svg, { Circle, Path } from "react-native-svg";

import { STATIC_COLORS } from "@/constants/theme";

type SearchInputIconProps = {
  color?: string;
  size?: number;
};

export function SearchInputIcon({
  color = STATIC_COLORS.iconMuted,
  size = 18,
}: SearchInputIconProps) {
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
