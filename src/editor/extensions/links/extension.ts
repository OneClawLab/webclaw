import { refLinkHighlighter, refLinkClickHandler } from "./refLink.js";
import { urlLinkHighlighter, urlLinkClickHandler } from "./urlLink.js";

export const linkHighlighters = [
  refLinkHighlighter,
  urlLinkHighlighter,
];

export const linkClickHandlers = [
  refLinkClickHandler,
  urlLinkClickHandler,
];
