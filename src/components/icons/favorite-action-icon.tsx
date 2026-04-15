import Svg, { Path } from "react-native-svg";

import { STATIC_COLORS } from "@/constants/theme";

type FavoriteActionIconProps = {
  accentColor?: string;
  accentUnderlayColor?: string;
  color: string;
  filled?: boolean;
  fillColor?: string;
  size: number;
};

const BOOKMARK_PATH =
  "M16.8199 2H7.17995C5.04995 2 3.31995 3.74 3.31995 5.86V19.95C3.31995 21.75 4.60995 22.51 6.18995 21.64L11.0699 18.93C11.5899 18.64 12.4299 18.64 12.9399 18.93L17.8199 21.64C19.3999 22.52 20.6899 21.76 20.6899 19.95V5.86C20.6799 3.74 18.9499 2 16.8199 2Z";
const BOOKMARK_CHECK_PATH =
  "M9 11.3333C9 11.3333 9.875 11.3333 10.75 13C10.75 13 13.5294 8.83333 16 8";
const BOOKMARK_PLUS_HORIZONTAL_PATH = "M14.5 10.6499H9.5";
const BOOKMARK_PLUS_VERTICAL_PATH = "M12 8.20996V13.21";

export function FavoriteActionIcon({
  accentColor = STATIC_COLORS.white,
  accentUnderlayColor,
  color,
  filled = false,
  fillColor,
  size,
}: FavoriteActionIconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={BOOKMARK_PATH} fill={fillColor ?? color} opacity={0.4} />
        <Path
          d={BOOKMARK_PATH}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {accentUnderlayColor ? (
          <Path
            d={BOOKMARK_CHECK_PATH}
            stroke={accentUnderlayColor}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <Path
          d={BOOKMARK_CHECK_PATH}
          stroke={accentColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={BOOKMARK_PATH}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={BOOKMARK_PLUS_HORIZONTAL_PATH}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={BOOKMARK_PLUS_VERTICAL_PATH}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
