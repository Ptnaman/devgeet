import Svg, { Path, Rect } from "react-native-svg";

type BookmarkMenuIconProps = {
  active?: boolean;
  color: string;
  size: number;
};

const BOOKMARK_PATH =
  "M16.8199 2H7.17995C5.04995 2 3.31995 3.74 3.31995 5.86V19.95C3.31995 21.75 4.60995 22.51 6.18995 21.64L11.0699 18.93C11.5899 18.64 12.4299 18.64 12.9399 18.93L17.8199 21.64C19.3999 22.52 20.6899 21.76 20.6899 19.95V5.86C20.6799 3.74 18.9499 2 16.8199 2Z";

export function BookmarkMenuIcon({
  active = false,
  color,
  size,
}: BookmarkMenuIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={BOOKMARK_PATH} fill={color} opacity={active ? 1 : 0.9} />
      {active ? (
        <Rect x="8.2" y="11.05" width="7.6" height="1.9" rx="0.95" fill="#FFFFFF" />
      ) : (
        <>
          <Rect x="8.2" y="11.05" width="7.6" height="1.9" rx="0.95" fill="#FFFFFF" />
          <Rect x="11.05" y="8.2" width="1.9" height="7.6" rx="0.95" fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}
