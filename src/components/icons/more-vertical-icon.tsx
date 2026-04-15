import Svg, { Circle } from "react-native-svg";

type MoreVerticalIconProps = {
  color: string;
  size: number;
};

export function MoreVerticalIcon({ color, size }: MoreVerticalIconProps) {
  const radius = 1.5;
  const centerX = 12;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={centerX} cy={6.5} r={radius} fill={color} />
      <Circle cx={centerX} cy={12} r={radius} fill={color} />
      <Circle cx={centerX} cy={17.5} r={radius} fill={color} />
    </Svg>
  );
}
