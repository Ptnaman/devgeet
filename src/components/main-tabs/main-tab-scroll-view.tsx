import { useCallback, type ReactNode } from "react";
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

import { useOptionalMainTabsHeader } from "@/components/main-tabs/main-tabs-header-context";
import { type MainTabName } from "@/constants/main-tabs";

type MainTabScrollViewProps = Omit<ScrollViewProps, "children"> & {
  children: ReactNode;
  tabName: MainTabName;
};

const DEFAULT_SCROLL_EVENT_THROTTLE = 16;

export function MainTabScrollView({
  children,
  onScroll,
  scrollEventThrottle,
  tabName,
  ...props
}: MainTabScrollViewProps) {
  const mainTabsHeader = useOptionalMainTabsHeader();

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      mainTabsHeader?.reportScrollOffset(tabName, event.nativeEvent.contentOffset.y);
      onScroll?.(event);
    },
    [mainTabsHeader, onScroll, tabName],
  );

  return (
    <ScrollView
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? DEFAULT_SCROLL_EVENT_THROTTLE}
    >
      {children}
    </ScrollView>
  );
}
