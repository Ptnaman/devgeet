import { Platform } from "react-native";

export const DEFAULT_LIST_INITIAL_NUM_TO_RENDER = 8;
export const DEFAULT_LIST_MAX_TO_RENDER_PER_BATCH = 8;
export const DEFAULT_LIST_WINDOW_SIZE = 7;
export const DEFAULT_LIST_UPDATE_BATCHING_PERIOD = 50;
export const DEFAULT_LIST_REMOVE_CLIPPED_SUBVIEWS = Platform.OS === "android";
