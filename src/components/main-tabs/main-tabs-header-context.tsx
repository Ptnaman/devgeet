import { createContext, useContext } from "react";

import { type MainTabName } from "@/constants/main-tabs";

type MainTabsHeaderContextType = {
  reportScrollOffset: (tabName: MainTabName, offsetY: number) => void;
  setHeaderHidden: (tabName: MainTabName, hidden: boolean) => void;
  setTabBarHidden: (tabName: MainTabName, hidden: boolean) => void;
};

export const MainTabsHeaderContext = createContext<
  MainTabsHeaderContextType | undefined
>(undefined);

export function useOptionalMainTabsHeader() {
  return useContext(MainTabsHeaderContext);
}
