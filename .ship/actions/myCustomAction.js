// @ts-check
import { defineAction } from '../../src/core/define-action.js';

// export default defineAction(async ({ log }) => {
//   log('hello from myCustomAction!');
// });

export default defineAction({
  run: async ({ log }) => {
    throw new Error('Test error!');
  },
  onError: async ({ error, log }) => {
    log(`Error: ${error}`);
  },
});
