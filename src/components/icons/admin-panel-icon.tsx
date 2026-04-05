import Svg, { Path } from "react-native-svg";

type AdminPanelIconProps = {
  color: string;
  size: number;
};

export function AdminPanelIcon({ color, size }: AdminPanelIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6C4 4.89543 4.89543 4 6 4H10C11.1046 4 12 4.89543 12 6V10C12 11.1046 11.1046 12 10 12H6C4.89543 12 4 11.1046 4 10V6Z"
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M12 14C12 12.8954 12.8954 12 14 12H18C19.1046 12 20 12.8954 20 14V18C20 19.1046 19.1046 20 18 20H14C12.8954 20 12 19.1046 12 18V14Z"
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M4 16C4 13.7909 5.79086 12 8 12C10.2091 12 12 13.7909 12 16V18C12 19.1046 11.1046 20 10 20H6C4.89543 20 4 19.1046 4 18V16Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 6C12 4.89543 12.8954 4 14 4H18C19.1046 4 20 4.89543 20 6V8C20 10.2091 18.2091 12 16 12C13.7909 12 12 10.2091 12 8V6Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
