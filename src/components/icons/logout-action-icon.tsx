import Svg, { Path } from "react-native-svg";

type LogoutActionIconProps = {
  color: string;
  size: number;
};

export function LogoutActionIcon({ color, size }: LogoutActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 7.5V5.5C10 4.11929 11.1193 3 12.5 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21H12.5C11.1193 21 10 19.8807 10 18.5V16.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 12H4"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 8.5L4 12L7.5 15.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
