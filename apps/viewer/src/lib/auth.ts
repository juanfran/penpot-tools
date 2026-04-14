import { createClientOnlyFn } from '@tanstack/react-start';

const STORAGE_KEY = 'API_KEY';

export const getApiKey = createClientOnlyFn(() => {
  return localStorage.getItem(STORAGE_KEY);
});

export const setApiKey = createClientOnlyFn((key: string) => {
  localStorage.setItem(STORAGE_KEY, key);
});

export const removeApiKey = createClientOnlyFn(() => {
  localStorage.removeItem(STORAGE_KEY);
});
