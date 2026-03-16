import { defineAction } from '../define-action.js';

// eslint-disable-next-line @typescript-eslint/require-await
export default defineAction(async ({ log, params }) => {
  log(String(params['message'] ?? ''));
});
