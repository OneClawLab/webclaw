/**
 * 解析后的表格结构：
 * - rows：二维数组，每个元素是一个单元格文本，包含所有的行（包含分隔行，如果存在）和列（补齐到最大列数）
 * - hasHeader：是否存在表头（markdown table 的分隔行在第 2 行时认为第 1 行为表头）
 *              如果 hasHeader 为 true，则 rows[1] 是分隔行。
 * - cellSpans：与 rows 对齐，每个 cell 在传入 markdown 字符串中的 [from,to)（相对 markdown 起点）
 */
export type ParsedTable = {
  rows: string[][];
  hasHeader: boolean;
  cellSpans: Array<Array<{ from: number; to: number }>>;
};

/**
 * Not a full markdown parser; tuned for CM's markdown "Table" node content.
 */
export function parseMarkdownTable(markdown: string): ParsedTable {
  const src = markdown.replace(/\r\n?/g, "\n");

  // 保留原行文本（不 trim），用于 offset 计算
  const lines = src.split("\n");

  const unescapeCellText = (s: string): string => {
    return s.replace(/\\\|/g, "|").replace(/\\\\/g, "\\");
  };

  const isLooseSeparatorRow = (line: string): boolean => {
    const s = line.trim();
    if (!s.startsWith("|") || !s.endsWith("|")) return false;
    const inner = s.slice(1, -1);
    return inner.includes("-");
  };

  const trimSpan = (line: string, from: number, to: number): { from: number; to: number } => {
    while (from < to && (line[from] === " " || line[from] === "\t")) from++;
    while (to > from && (line[to - 1] === " " || line[to - 1] === "\t")) to--;
    return { from, to };
  };

  const splitRowWithSpans = (
    line: string,
    lineStartInDoc: number
  ): { cells: string[]; spans: Array<{ from: number; to: number }> } => {
    // 注意：这里不对 line 做 trim，否则 spans 会漂
    const s = line;

    // 找到“内容区”：[contentStart, contentEnd)
    // 按你的旧逻辑：允许首尾有 '|'
    let contentStart = 0;
    let contentEnd = s.length;

    // 仅在真正以 '|' 开始/结束时去掉，不做 trim
    if (s.startsWith("|")) contentStart++;
    if (s.endsWith("|")) contentEnd--;

    const cells: string[] = [];
    const spans: Array<{ from: number; to: number }> = [];

    let curTextStart = contentStart; // 当前 cell 内容起点（含空格）
    let escaped = false;

    for (let i = contentStart; i < contentEnd; i++) {
      const ch = s[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "|") {
        // 当前 cell: [curTextStart, i)
        const t = trimSpan(s, curTextStart, i);
        const rawCell = s.slice(curTextStart, i);
        const cellText = unescapeCellText(rawCell.trim());

        cells.push(cellText);
        spans.push({ from: lineStartInDoc + t.from, to: lineStartInDoc + t.to });

        curTextStart = i + 1;
      }
    }

    // last cell: [curTextStart, contentEnd)
    {
      const t = trimSpan(s, curTextStart, contentEnd);
      const rawCell = s.slice(curTextStart, contentEnd);
      const cellText = unescapeCellText(rawCell.trim());

      cells.push(cellText);
      spans.push({ from: lineStartInDoc + t.from, to: lineStartInDoc + t.to });
    }

    return { cells, spans };
  };

  const rows: string[][] = [];
  const cellSpans: Array<Array<{ from: number; to: number }>> = [];

  let separator = "";
  let hasHeader = false;

  // 遍历时维护每行起始 offset（相对 src 起点）
  let offset = 0;
  let logicalLineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;

    // offset 增量：行长 + '\n'（最后一行可能没有 '\n'，但 split 后我们视为没有）
    offset += line.length + 1;

    // 跳过空行告诉：原实现 filter(l=>l.length>0)，但那会破坏行号/offset
    // 这里选择：空行直接 continue（但仍占 offset）
    if (line.trim().length === 0) continue;

    // header separator 判定只对“非空行序号”的第二行
    if (logicalLineIndex === 1 && isLooseSeparatorRow(line)) {
      if (rows.length === 1) {
        separator = line;
        hasHeader = true;
      }

      // 分隔行也解析出来（便于位置映射保持与原文一致）
      const { cells, spans } = splitRowWithSpans(line, lineStart);
      rows.push(cells);
      cellSpans.push(spans);

      logicalLineIndex++;
      continue;
    }

    const { cells, spans } = splitRowWithSpans(line, lineStart);
    rows.push(cells);
    cellSpans.push(spans);

    logicalLineIndex++;
  }

  // Normalize column count (pad to max) —— spans 也要一起 pad（用空跨度）
  let maxCols = 0;
  for (const r of rows) maxCols = Math.max(maxCols, r.length);

  for (let r = 0; r < rows.length; r++) {
    while (rows[r].length < maxCols) rows[r].push("");
    while (cellSpans[r].length < maxCols) {
      // 对于补齐的空 cell，给一个 0 长度 span（点击这种 cell 时你可以选择 fallback）
      const last = cellSpans[r][cellSpans[r].length - 1] ?? { from: 0, to: 0 };
      cellSpans[r].push({ from: last.to, to: last.to });
    }
  }

  return { rows, hasHeader: hasHeader && rows.length > 0, cellSpans };
}


// -------------------- Inline markdown (very small) renderer --------------------
// 目的：TableWidget 渲染态保留 cell 内常见 inline marks 的"效果"。
// 注意：这不是完整 markdown inline 解析器，只覆盖常用格式。
export function renderInlineMarkdownToDOM(doc: Document, text: string): DocumentFragment {
  const frag = doc.createDocumentFragment();

  // A tiny tokenizer with a few patterns, processed left-to-right.
  // Order matters: code first to avoid parsing inside code.
  const patterns: Array<{
    type: "code" | "bold" | "italic" | "del" | "link" | "br";
    re: RegExp;
  }> = [
    { type: "code", re: /`([^`]+)`/g },
    { type: "bold", re: /\*\*([^*]+)\*\*/g },
    { type: "del", re: /~~([^~]+)~~/g },
    // italic: *text* or _text_ (simple, non-greedy)
    { type: "italic", re: /(?:\*([^*\n]+)\*|_([^_\n]+)_)/g },
    // link: [text](url) (very small)
    { type: "link", re: /\[([^\]]+)\]\(([^)]+)\)/g },
    // br: <br> or <br/> or <br />
    { type: "br", re: /<br\s*\/?>/gi },
  ];

  // Find the earliest next match among all patterns each iteration.
  let i = 0;
  while (i < text.length) {
    let best:
      | { type: (typeof patterns)[number]["type"]; start: number; end: number; groups: string[] }
      | null = null;

    for (const p of patterns) {
      p.re.lastIndex = i;
      const m = p.re.exec(text);
      if (!m) continue;
      const start = m.index;
      const end = m.index + m[0].length;
      const groups = m.slice(1);
      if (!best || start < best.start) best = { type: p.type, start, end, groups };
    }

    if (!best) {
      frag.appendChild(doc.createTextNode(text.slice(i)));
      break;
    }

    if (best.start > i) {
      frag.appendChild(doc.createTextNode(text.slice(i, best.start)));
    }

    switch (best.type) {
      case "code": {
        const code = doc.createElement("code");
        code.className = "cm-md-im-code";
        code.textContent = best.groups[0] ?? "";
        frag.appendChild(code);
        break;
      }
      case "bold": {
        const strong = doc.createElement("strong");
        strong.className = "cm-md-im-strong";
        strong.textContent = best.groups[0] ?? "";
        frag.appendChild(strong);
        break;
      }
      case "del": {
        const del = doc.createElement("del");
        del.className = "cm-md-im-del";
        del.textContent = best.groups[0] ?? "";
        frag.appendChild(del);
        break;
      }
      case "italic": {
        const em = doc.createElement("em");
        em.className = "cm-md-im-em";
        em.textContent = (best.groups[0] ?? best.groups[1] ?? "");
        frag.appendChild(em);
        break;
      }
      case "link": {
        const label = best.groups[0] ?? "";
        const hrefRaw = best.groups[1] ?? "";
        const href = safeLinkHref(hrefRaw);
        if (href) {
          const a = doc.createElement("a");
          a.className = "cm-md-im-link";
          a.textContent = label;
          a.href = href;
          a.rel = "noopener noreferrer";
          a.target = "_blank";
          frag.appendChild(a);
        } else {
          // unsafe href => render as plain text
          frag.appendChild(doc.createTextNode(`[${label}](${hrefRaw})`));
        }
        break;
      }
      case "br": {
        const br = doc.createElement("br");
        frag.appendChild(br);
        break;
      }
    }

    i = best.end;
  }

  return frag;
}

// 返回一个安全的 link href，或 null（不安全）
function safeLinkHref(href: string): string | null {
  const s = href.trim();
  // allow relative, hash, http(s), mailto
  if (s.startsWith("#") || s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return s;
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) return s;
  return null;
}
