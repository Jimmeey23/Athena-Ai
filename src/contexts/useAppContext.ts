import { useContext } from 'react';
import { AppContext } from './app-context-core';

export const useAppContext = () => useContext(AppContext);
