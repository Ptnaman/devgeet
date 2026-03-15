import Svg, { Path } from "react-native-svg";

type FavoriteTabIconProps = {
  color: string;
  filled?: boolean;
  size: number;
};

export function FavoriteTabIcon({
  color,
  filled = false,
  size,
}: FavoriteTabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.5C12 20.5 2 14.5 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 14.5 12 20.5 12 20.5Z"
        fill={filled ? color : "none"}
        stroke={filled ? "none" : color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
