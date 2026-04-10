import Svg, { Path } from "react-native-svg";

import { STATIC_COLORS } from "@/constants/theme";

type CancelInputIconProps = {
  color?: string;
  size?: number;
};

export function CancelInputIcon({
  color = STATIC_COLORS.black,
  size = 18,
}: CancelInputIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
