import { createPapervestApiClient } from '@papervest/api-client';

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const webApi = createPapervestApiClient({
  baseUrl,
  authTransport: 'cookie',
});
