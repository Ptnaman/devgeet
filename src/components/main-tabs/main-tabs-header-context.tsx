import { createContext, useContext } from "react";

import { type MainTabName } from "@/constants/main-tabs";

type MainTabsHeaderContextType = {
  reportScrollOffset: (tabName: MainTabName, offsetY: number) => void;
};

export const MainTabsHeaderContext = createContext<
  MainTabsHeaderContextType | undefined
>(undefined);

export function useOptionalMainTabsHeader() {
  return useContext(MainTabsHeaderContext);
}
