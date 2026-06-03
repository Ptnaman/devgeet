import Svg, { Circle, Path } from "react-native-svg";

type NotificationBellIconProps = {
  color: string;
  size: number;
  filled?: boolean;
  fillColor?: string;
  showAlertDot?: boolean;
  alertDotColor?: string;
  alertDotStrokeColor?: string;
  styleVariant?: "default" | "tab";
};

export function NotificationBellIcon({
  color,
  fillColor = "none",
  filled = false,
  size,
  showAlertDot = false,
  alertDotColor = "#FF3B30",
  alertDotStrokeColor = "#FFFFFF",
  styleVariant = "default",
}: NotificationBellIconProps) {
  const isTabVariant = styleVariant === "tab";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.2311 18H4.76887C3.79195 18 3 17.208 3 16.2311C3 15.762 3.18636 15.3121 3.51809 14.9803L5 13.4984V9.5C5 5.63401 8.13401 2.5 12 2.5C15.866 2.5 19 5.634 19 9.5V13.4984L20.4819 14.9803C20.8136 15.3121 21 15.762 21 16.2311C21 17.208 20.208 18 19.2311 18Z"
        fill={filled ? fillColor : "none"}
        fillOpacity={filled ? 0.18 : 0}
      />
      <Path
        d="M15.5 18C15.5 19.933 13.933 21.5 12 21.5C10.067 21.5 8.5 19.933 8.5 18"
        opacity={filled ? 1 : isTabVariant ? 0.4 : 0.78}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.2311 18H4.76887C3.79195 18 3 17.208 3 16.2311C3 15.762 3.18636 15.3121 3.51809 14.9803L5 13.4984V9.5C5 5.63401 8.13401 2.5 12 2.5C15.866 2.5 19 5.634 19 9.5V13.4984L20.4819 14.9803C20.8136 15.3121 21 15.762 21 16.2311C21 17.208 20.208 18 19.2311 18Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showAlertDot ? (
        <Circle
          cx={isTabVariant ? 18 : 18.5}
          cy={isTabVariant ? 6 : 5.5}
          r={isTabVariant ? 3.1 : 6.2}
          fill={alertDotColor}
          stroke={alertDotStrokeColor}
          strokeWidth={isTabVariant ? 1.5 : 1.6}
        />
      ) : null}
    </Svg>
  );
}
