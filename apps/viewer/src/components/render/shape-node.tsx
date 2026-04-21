import { memo } from 'react';

export const ShapeNode = memo(({ html }: { html: string }) => (
  // react-doctor-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: html }} />
));
