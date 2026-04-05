import { type ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

import { type MainTabName } from "@/constants/main-tabs";

type MainTabScrollViewProps = Omit<ScrollViewProps, "children"> & {
  children: ReactNode;
  tabName: MainTabName;
};

export function MainTabScrollView({
  children,
  tabName: _tabName,
  ...props
}: MainTabScrollViewProps) {
  return <ScrollView {...props}>{children}</ScrollView>;
}
