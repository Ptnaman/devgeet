import Svg, { Path } from "react-native-svg";

type FavoriteActionIconProps = {
  accentColor?: string;
  accentUnderlayColor?: string;
  color: string;
  filled?: boolean;
  fillColor?: string;
  size: number;
};

const FILLED_HEART_PATH =
  "M12 20.5C12 20.5 2 14.5 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 14.5 12 20.5 12 20.5Z";

export function FavoriteActionIcon({
  accentColor = "#FFFFFF",
  accentUnderlayColor,
  color,
  filled = false,
  fillColor,
  size,
}: FavoriteActionIconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={FILLED_HEART_PATH} fill={fillColor ?? color} />
        <Path
          d="M13 20.3025C12.1525 20.6505 11.1746 20.5389 10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 9.12591 21.9448 9.56214 21.8425 10"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {accentUnderlayColor ? (
          <Path
            d="M14 17C14 17 15 17 16 19C16 19 19.1765 14 22 13"
            stroke={accentUnderlayColor}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <Path
          d="M14 17C14 17 15 17 16 19C16 19 19.1765 14 22 13"
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
        d="M13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 9.78274 21.6486 10.9014 21.0775 12"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 16H17.5M17.5 16H21M17.5 16V12.5M17.5 16V19.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
      />
    </Svg>
  );
}
