import { createMiddleware } from '@tanstack/react-start';
import { getTokenFromCookie } from '../auth';

export const authMiddleware = createMiddleware().server(({ next }) => {
  const token = getTokenFromCookie();

  if (!token) {
    throw redirect({ to: '/login' });
  }

  return next({
    context: { token },
  });
});
function redirect(arg0: { to: string }) {
  throw new Error('Function not implemented.');
}
