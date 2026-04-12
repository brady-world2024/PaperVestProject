import { env } from './env';
import {
  createPapervestApiClient,
  type ApiAuthHandlers,
} from '@papervest/api-client';

export const papervestApiClient = createPapervestApiClient({
  baseUrl: env.apiBaseUrl,
});

export function configureApiClient(handlers: ApiAuthHandlers) {
  papervestApiClient.setAuthHandlers(handlers);
}

export const getApiErrorMessage = papervestApiClient.getApiErrorMessage;
