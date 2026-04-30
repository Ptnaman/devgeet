import Svg, { Circle, Path } from "react-native-svg";

import { STATIC_COLORS } from "@/constants/theme";

type HelpQuestionIconProps = {
  color?: string;
  size?: number;
};

export function HelpQuestionIcon({
  color = STATIC_COLORS.iconMuted,
  size = 20,
}: HelpQuestionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.6} />
      <Path
        d="M9.75 9.5C9.75 8.11929 10.8693 7 12.25 7C13.6307 7 14.75 8.11929 14.75 9.5C14.75 10.6187 14.1442 11.2778 13.4602 11.8176C12.7694 12.3627 12 12.8836 12 14"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Circle cx="12" cy="16.75" r="1" fill={color} />
    </Svg>
  );
}
