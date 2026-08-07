import { createContext } from 'react';

export interface AppContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const defaultAppContext: AppContextType = {
  sidebarOpen: false,
  toggleSidebar: () => undefined,
};

export const AppContext = createContext<AppContextType>(defaultAppContext);
