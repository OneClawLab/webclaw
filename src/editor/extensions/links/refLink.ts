import { createLinkClickHandler, createLinkHighlighter, REGEX_LINK_BODY, type LinkSupportSpec } from "./base.js";

const REF_LINK_PREFIX = String.raw`@`;
export const REF_LINK_REGEX = new RegExp(`${REF_LINK_PREFIX}${REGEX_LINK_BODY}`, "gu");

const REF_LINK_CLASS = "cm-refLink";

export const REF_LINK_SPEC: LinkSupportSpec = {
  regex: REF_LINK_REGEX,
  className: REF_LINK_CLASS,
};

export const refLinkHighlighter = createLinkHighlighter(REF_LINK_SPEC);

export const refLinkClickHandler = createLinkClickHandler({
  spec: REF_LINK_SPEC,
  commandId: "tab/open/eidux-link",
  requireModKey: true,
});
