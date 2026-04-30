import Svg, { Path } from "react-native-svg";

type BackArrowIconProps = {
  color: string;
  size: number;
};

export function BackArrowIcon({ color, size }: BackArrowIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z"
        fill={color}
      />
    </Svg>
  );
}
