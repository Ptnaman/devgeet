import Svg, { Path } from "react-native-svg";

type ArrowRightIconProps = {
  color: string;
  size: number;
};

export function ArrowRightIcon({ color, size }: ArrowRightIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5L15.5 12L9 19"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
