import { createMiddleware } from '@tanstack/react-start';
import { getTokenFromCookie } from '../auth';
import { redirect } from '@tanstack/react-router';

export const authMiddleware = createMiddleware().server(({ next }) => {
  const token = getTokenFromCookie();

  if (!token) {
    throw redirect({ to: '/login' });
  }

  return next({
    context: { token },
  });
});
