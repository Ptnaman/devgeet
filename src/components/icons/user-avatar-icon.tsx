import Svg, { Path } from "react-native-svg";

type UserAvatarIconProps = {
  color: string;
  size: number;
};

export function UserAvatarIcon({ color, size }: UserAvatarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12C14.4853 12 16.5 9.98528 16.5 7.5C16.5 5.01472 14.4853 3 12 3C9.51472 3 7.5 5.01472 7.5 7.5C7.5 9.98528 9.51472 12 12 12Z"
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M4 20C4.8 16.8 7.7 14.5 12 14.5C16.3 14.5 19.2 16.8 20 20"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}
