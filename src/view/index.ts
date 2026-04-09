import { FocusManager } from "./FocusManager.js";
import { ViewManager } from "./ViewManager.js";

export const theViewManager = new ViewManager();
export const theFocusManager = new FocusManager(theViewManager);
