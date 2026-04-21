import { memo } from 'react';

export const ShapeNode = memo(({ html }: { html: string }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} />
));
