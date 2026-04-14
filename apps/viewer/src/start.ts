import { createStart } from '@tanstack/react-start';

export const startInstance = createStart(() => ({
  defaultSsr: false, // disable SSR because we are using localStorage as auth mechanism, which is not available on the server
}));
