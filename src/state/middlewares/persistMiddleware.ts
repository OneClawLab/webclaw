import { Logger, Assert } from "@lib/logast.js";

import { AppMiddleware } from '@state/middlewares/middleware.js'
import { selectPersistentState, savePersistentStateIfChanged } from "@state/persistent.js";

/**
 * A Redux middleware that persists the workspace state to storage.
 * It debounces the save operation to avoid excessive writes.
 *
 * @param store - The Redux store object.
 * @returns A function that takes the next middleware in the chain.
 */
const persistMiddleware: AppMiddleware = (api) => (next) => (action) => {
  // Logger.debug('persistMW', 'Dispatching:', action);

  const result = next(action)

  const stateToBeSaved = selectPersistentState(api.getState());
  // Logger.debug('persistMW', 'stateToBeSaved:', stateToBeSaved);
  savePersistentStateIfChanged(stateToBeSaved);

  // Logger.debug('persistMW', 'Next state:', api.getState());
  return result
}

export default persistMiddleware;
