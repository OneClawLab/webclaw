import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { dispatchAppCommand } from "@commands/registry.js";
import { OS } from "@lib/env.js";

export type LinkSupportSpec = {
  /** 用于 matchAll 的全局正则（建议带 /gu） */
  regex: RegExp;
  /** Decoration class */
  className: string;
};

// 链接主体部分的宽松匹配（不含协议前缀），末尾标点/包裹符由通用层剔除
export const REGEX_LINK_BODY = `[^\\s<>"'\`,，]+`;

// 仅处理“末尾不应该属于链接”的常见标点（不包含 )]} 这种括号类，交给 bracket trim）
const DEFAULT_TRAILING_PUNCTUATION = /[\\*~=`":：'’“”.,，。．!?！？、;；…]/u;

function escapeRegExpLiteral(text: string): string {
  // 把字符串按“字面量”用于 RegExp（转义所有正则元字符）
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureGlobalRegex(re: RegExp): RegExp {
  // matchAll 要求 /g；同时尽量保留原 flags（含 u/i/m/s 等）
  if (re.global) return re;
  return new RegExp(re.source, re.flags + "g");
}

function toStatelessTestRegex(re: RegExp): RegExp {
  // 避免 /g 或 /y 导致 test() 受 lastIndex 影响
  if (!re.global && !re.sticky) return re;

  const flags = re.flags.replace("g", "").replace("y", "");
  return new RegExp(re.source, flags);
}

/**
 * 仅剔除“多余的”闭合括号：
 * - 支持 () [] {} 
 * - 只在 close 数量 > open 数量 且字符串末尾确实是 close 时才剔除
 * 这样既能处理 Markdown 的 ...https://a.com/x) 也不会破坏 URL 内成对括号。
 */
function trimExtraClosingBrackets(s: string): string {
  let out = s;

  const pairs: Array<[open: string, close: string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
    // 全角括号/方括号：用于中文输入法或中文排版场景
    ["（", "）"],
    ["【", "】"],
  ];

  for (const [open, close] of pairs) {
    const reOpen = new RegExp(escapeRegExpLiteral(open), "g");
    const reClose = new RegExp(escapeRegExpLiteral(close), "g");
    const opens = (out.match(reOpen) ?? []).length;
    const closes = (out.match(reClose) ?? []).length;

    let extra = closes - opens;
    while (extra > 0 && out.endsWith(close)) {
      out = out.slice(0, -1);
      extra--;
    }
  }

  return out;
}

/**
 * 末尾裁剪：按顺序做三件事
 * 1) 剔除末尾常见标点（逗号、句号、引号等）
 * 2) 剔除包裹符（比如 <https://a.com> 的 >）
 * 3) 剔除“多余的”右括号/右方括号/右花括号（Markdown 包裹常见）
 */
function trimLinkTail(link: string, trailingPunctuation: RegExp): string {
  let out = link;

  const trailingTest = toStatelessTestRegex(trailingPunctuation);

  // 1) 标点：可连续剔除
  while (out.length > 0 && trailingTest.test(out.charAt(out.length - 1))) {
    out = out.slice(0, -1);
  }

  // 2) 包裹符：常见于 <...> 或引号包裹
  // 注意：这里仅做“末尾”剔除，不影响链接内部字符
  while (out.length > 0) {
    const last = out.charAt(out.length - 1);
    if (last === ">" || last === "）" || last === "】") {
      // 全角右括号/右方括号也常用于中文输入法包裹
      out = out.slice(0, -1);
      continue;
    }
    break;
  }

  // 3) 多余右括号：只剔除“多余的”（含半角/全角）
  out = trimExtraClosingBrackets(out);

  return out;
}

/**
 * 在给定 `text` 片段中查找链接并回调。
 * 各种坐标均为文档坐标。
 * - `text`：被扫描的文本片段（可以是整篇文档字符串，也可以是 doc 的子串）。
 * - `textFrom`：`text[0]` 在父坐标系中的起始位置。
 * - `limitFrom/limitTo`：基于文档坐标系的过滤范围；仅回调完全落在该范围内的链接。
 * - `start/end`：文档坐标系下的半开区间 `[start, end)`（`end` 不包含）。
 * - `link`：已经做过末尾裁剪（标点/包裹符/多余右括号）后的最终链接文本；
 */
export function findLinksInRange(
  spec: LinkSupportSpec,
  text: string,
  textFrom: number,
  callback: (link: string, start: number, end: number) => void,
  limitFrom: number = textFrom,
  limitTo: number = textFrom + text.length,
): void {
  const trailing = DEFAULT_TRAILING_PUNCTUATION;
  const re = ensureGlobalRegex(spec.regex);

  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const localStart = m.index ?? 0;

    const link = trimLinkTail(raw, trailing);
    if (link.length === 0) continue;

    const start = textFrom + localStart;
    const end = start + link.length;

    // 仅回调完全落在 [limitFrom, limitTo] 内的链接
    if (start >= limitFrom && end <= limitTo) callback(link, start, end);
  }
}

export function createLinkHighlighter(spec: LinkSupportSpec) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const docText = view.state.doc.toString();

        findLinksInRange(spec, docText, 0, (_link, start, end) => {
          builder.add(start, end, Decoration.mark({ class: spec.className }));
        }, 0, docText.length);

        return builder.finish();
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged)
          this.decorations = this.buildDecorations(update.view);
      }
    },
    { decorations: v => v.decorations }
  );
}

export function createLinkClickHandler(opts: {
  spec: LinkSupportSpec;
  commandId: string;
  /** 点击位置前后取多少字符做局部扫描 */
  scanRadius?: number;
  /** 是否要求 Mod 键 */
  requireModKey?: boolean;
}) {
  const scanRadius = opts.scanRadius ?? 256;
  const requireModKey = opts.requireModKey ?? true;

  return EditorView.domEventHandlers({
    click(event, view) {
      if (requireModKey) {
        // macOS 用 Command键，Windows/Linux 用 Ctrl键
        if (OS === "macos" && !event.metaKey) return;
        if (OS === "windows" && !event.ctrlKey) return;
        if (OS === "linux" && !event.ctrlKey) return;
      }

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return;

      const from = Math.max(0, pos - scanRadius);
      const to = Math.min(view.state.doc.length, pos + scanRadius);
      const text = view.state.doc.sliceString(from, to);

      let handled = false;

      // 扫描 from/to 范围内的链接，查找包含 pos 的链接，并触发命令
      findLinksInRange(opts.spec, text, from, (link, start, end) => {
        if (handled) return;

        // 如果点击 pos 落在链接范围内 [start, end)，则触发命令
        if (pos >= start && pos < end) {
          handled = true;
          dispatchAppCommand(opts.commandId, { link });

          event.preventDefault();
          event.stopPropagation();
        }
      }, from, to);
    },
  });
}