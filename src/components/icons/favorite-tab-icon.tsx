import Svg, { Path } from "react-native-svg";

type FavoriteTabIconProps = {
  color: string;
  filled?: boolean;
  size: number;
};

const BOOKMARK_PATH =
  "M16.8199 2H7.17995C5.04995 2 3.31995 3.74 3.31995 5.86V19.95C3.31995 21.75 4.60995 22.51 6.18995 21.64L11.0699 18.93C11.5899 18.64 12.4299 18.64 12.9399 18.93L17.8199 21.64C19.3999 22.52 20.6899 21.76 20.6899 19.95V5.86C20.6799 3.74 18.9499 2 16.8199 2Z";
export function FavoriteTabIcon({
  color,
  filled = false,
  size,
}: FavoriteTabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? <Path d={BOOKMARK_PATH} fill={color} /> : null}
      <Path
        d={BOOKMARK_PATH}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
