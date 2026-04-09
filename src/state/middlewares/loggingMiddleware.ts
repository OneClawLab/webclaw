import { Logger, Assert } from "@lib/logast.js";
import { AppMiddleware } from "@state/middlewares/middleware.js";

/**
 * A Redux middleware that logs actions and state changes.
 * It logs the action being dispatched and the next state after the action is processed.
 *
 * @param api - The Redux API object containing `getState`.
 * @param next - The next middleware in the chain.
 * @param action - The action being dispatched.
 * @returns A function that takes the next middleware in the chain.
 */
const loggingMiddleware: AppMiddleware = (api) => (next) => (action) => {
  // Logger.debug('loggingMW', `Dispatching: ${(action as any)['type'] as string}`, action);
  const result = next(action);
  // Logger.debug('loggingMW', 'Next state:', api.getState());
  return result;
};

export default loggingMiddleware;
