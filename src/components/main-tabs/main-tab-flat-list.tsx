import { type Ref, useCallback } from "react";
import {
  FlatList,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { useOptionalMainTabsHeader } from "@/components/main-tabs/main-tabs-header-context";
import {
  DEFAULT_LIST_INITIAL_NUM_TO_RENDER,
  DEFAULT_LIST_MAX_TO_RENDER_PER_BATCH,
  DEFAULT_LIST_REMOVE_CLIPPED_SUBVIEWS,
  DEFAULT_LIST_UPDATE_BATCHING_PERIOD,
  DEFAULT_LIST_WINDOW_SIZE,
} from "@/constants/list-performance";
import { type MainTabName } from "@/constants/main-tabs";

type MainTabFlatListProps<ItemT> = Omit<FlatListProps<ItemT>, "onScroll"> & {
  listRef?: Ref<FlatList<ItemT>>;
  tabName: MainTabName;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const DEFAULT_SCROLL_EVENT_THROTTLE = 16;

export function MainTabFlatList<ItemT>({
  initialNumToRender,
  listRef,
  maxToRenderPerBatch,
  onScroll,
  removeClippedSubviews,
  scrollEventThrottle,
  tabName,
  updateCellsBatchingPeriod,
  windowSize,
  ...props
}: MainTabFlatListProps<ItemT>) {
  const mainTabsHeader = useOptionalMainTabsHeader();

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      mainTabsHeader?.reportScrollOffset(tabName, event.nativeEvent.contentOffset.y);
      onScroll?.(event);
    },
    [mainTabsHeader, onScroll, tabName],
  );

  return (
    <FlatList
      {...props}
      ref={listRef}
      initialNumToRender={initialNumToRender ?? DEFAULT_LIST_INITIAL_NUM_TO_RENDER}
      maxToRenderPerBatch={maxToRenderPerBatch ?? DEFAULT_LIST_MAX_TO_RENDER_PER_BATCH}
      onScroll={handleScroll}
      removeClippedSubviews={
        removeClippedSubviews ?? DEFAULT_LIST_REMOVE_CLIPPED_SUBVIEWS
      }
      scrollEventThrottle={scrollEventThrottle ?? DEFAULT_SCROLL_EVENT_THROTTLE}
      updateCellsBatchingPeriod={
        updateCellsBatchingPeriod ?? DEFAULT_LIST_UPDATE_BATCHING_PERIOD
      }
      windowSize={windowSize ?? DEFAULT_LIST_WINDOW_SIZE}
    />
  );
}
