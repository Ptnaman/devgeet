import Svg, { Path } from "react-native-svg";

import { STATIC_COLORS } from "@/constants/theme";

type ViewOnIconProps = {
  color?: string;
  size?: number;
};

export function ViewOnIcon({
  color = STATIC_COLORS.iconMuted,
  size = 20,
}: ViewOnIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12C4.5 7.8 8 5.7 12 5.7C16 5.7 19.5 7.8 22 12C19.5 16.2 16 18.3 12 18.3C8 18.3 4.5 16.2 2 12Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 14.7C13.4912 14.7 14.7 13.4912 14.7 12C14.7 10.5088 13.4912 9.3 12 9.3C10.5088 9.3 9.3 10.5088 9.3 12C9.3 13.4912 10.5088 14.7 12 14.7Z"
        stroke={color}
        strokeWidth={1.8}
      />
    </Svg>
  );
}
