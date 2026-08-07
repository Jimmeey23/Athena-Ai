import { useContext } from 'react';
import { BackendAuthContext } from './backend-auth-core';

export const useBackendAuth = () => {
  const context = useContext(BackendAuthContext);
  if (!context) throw new Error('useBackendAuth must be used within BackendAuthProvider');
  return context;
};
