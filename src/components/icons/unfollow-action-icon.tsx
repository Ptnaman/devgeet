import Svg, { Path, Rect } from "react-native-svg";

type UnfollowActionIconProps = {
  color: string;
  size: number;
};

export function UnfollowActionIcon({ color, size }: UnfollowActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.9 4.2C11.0574 4.2 12.8062 5.94878 12.8062 8.10625C12.8062 10.2637 11.0574 12.0125 8.9 12.0125C6.74253 12.0125 4.99375 10.2637 4.99375 8.10625C4.99375 5.94878 6.74253 4.2 8.9 4.2Z"
        fill={color}
      />
      <Path
        d="M3.85 18.5969C4.9664 15.6664 6.82543 14.225 8.9 14.225C10.9746 14.225 12.8336 15.6664 13.95 18.5969C14.1532 19.1305 13.765 19.7 13.194 19.7H4.60602C4.03499 19.7 3.64676 19.1305 3.85 18.5969Z"
        fill={color}
      />
      <Rect x="14.6" y="10.95" width="6.9" height="2.1" rx="1.05" fill={color} />
    </Svg>
  );
}
