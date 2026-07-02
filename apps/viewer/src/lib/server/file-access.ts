import { createServerFn } from '@tanstack/react-start';
import z from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getFileAccesses, markFileAccessed } from './viewer-db';

export const recordFileAccessFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
      teamId: z.string().optional(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    return markFileAccessed(data.fileId, data.teamId);
  });

export const getFileAccessesFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileIds: z.array(z.uuid()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    return getFileAccesses(data.fileIds);
  });
