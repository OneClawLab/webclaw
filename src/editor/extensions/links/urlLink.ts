import { createLinkClickHandler, createLinkHighlighter, REGEX_LINK_BODY, type LinkSupportSpec } from "./base.js";

const URL_LINK_PREFIX = String.raw`https?:\/\/`;
export const URL_LINK_REGEX = new RegExp(`${URL_LINK_PREFIX}${REGEX_LINK_BODY}`, "gu");

const URL_LINK_CLASS = "cm-urlLink";

export const URL_LINK_SPEC: LinkSupportSpec = {
  regex: URL_LINK_REGEX,
  className: URL_LINK_CLASS,
};

export const urlLinkHighlighter = createLinkHighlighter(URL_LINK_SPEC);

export const urlLinkClickHandler = createLinkClickHandler({
  spec: URL_LINK_SPEC,
  commandId: "system/openInBrowser",
  requireModKey: true,
});
