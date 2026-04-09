/**
 * Table Extension for CodeMirror
 * 
 * 这个扩展为 CodeMirror 编辑器提供 Markdown 表格的增强渲染和编辑功能。
 * 
 * ## 核心功能
 * 
 * 1. **双模式渲染**
 *    - Render 模式：显示为美观的 HTML 表格
 *    - Raw 模式：显示原始 Markdown 语法，允许编辑
 * 
 * 2. **智能模式切换**
 *    - 光标进入表格 → 自动切换到 Raw 模式
 *    - 光标离开表格 → 自动切换回 Render 模式
 *    - 点击表格 → 切换到 Raw 模式并定位光标
 * 
 * 3. **高度一致性**
 *    - 使用 heightMatcher 工具确保 Raw 和 Render 模式高度一致
 *    - 避免模式切换时的页面跳动
 * 
 * 4. **键盘导航**
 *    - 左右箭头键快速跳转到表格开始/结束
 * 
 * ## 架构设计
 * 
 * 采用 CodeMirror 推荐的分层架构：
 * 
 * - **数据层**：3 个 StateFields（tableIndexField, tableStatusField, tableHeightField）
 * - **显示层**：1 个 Decoration Field（tableDecoField）
 * - **交互层**：1 个 Keymap（tableNavigationKeymap）
 * - **逻辑层**：1 个 ViewPlugin（tableVP）
 * 
 * @module table/extension
 */

import { Assert, Logger } from "@lib/logast.js";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { rafChain } from "@editor/RafChain.js"
import { ParsedTable, parseMarkdownTable, renderInlineMarkdownToDOM } from "./tableParser.js";
import { computeHeightInfo, applyHeightStyleToLines } from "../heightMatcher.js";

// ==================== 类型定义 ====================

/**
 * 表格唯一标识符
 * 
 * 为每个表格生成稳定的 key，用于在不同的 StateFields 之间关联同一个表格。
 * 
 * **生成规则：** `${from}-${to}`
 * - from: 表格在文档中的起始位置
 * - to: 表格在文档中的结束位置
 * 
 * **生命周期：**
 * - 文档未改变时，key 保持稳定
 * - 文档改变后，会重建 index，key 可能会变化（这是预期行为）
 * 
 * **用途：**
 * - tableStatusField 中存储表格的 Raw/Render 状态
 * - tableHeightField 中存储表格的高度信息
 * - 在不同的 Field 之间关联同一个表格
 */
type TableKey = string;

/**
 * 表格条目
 * 
 * 存储单个表格的基本信息。
 */
type TableEntry = {
  /** 表格的唯一标识符 */
  key: TableKey;
  /** 表格在文档中的起始位置（字符偏移量） */
  from: number;
  /** 表格在文档中的结束位置（字符偏移量） */
  to: number;
  /** 表格的原始 Markdown 语法文本 */
  markdown: string;
};

/**
 * 表格索引
 * 
 * 存储文档中所有表格的列表。
 * 
 * **特点：**
 * - 表格按 from 位置升序排列，便于快速查找
 * - 只在文档改变或视口改变时重建
 * - 只索引视口附近的表格（±2000 字符），避免全文扫描
 */
type TableIndex = {
  /** 表格列表，按 from 升序排列 */
  tables: TableEntry[];
};

/**
 * 表格状态
 * 
 * 表格的显示模式。
 * 
 * - **raw**: 显示原始 Markdown 语法，允许编辑
 * - **rendered**: 显示为 HTML 表格，不可编辑
 */
type TableStatus = "raw" | "rendered";

/**
 * 表格状态映射
 * 
 * 存储每个表格的当前状态。
 * 
 * **默认行为：**
 * - 如果 key 不存在于 Map 中，默认为 "rendered"
 * - 只有明确设置为 "raw" 的表格才会以 Raw 模式显示
 */
type TableStatusMap = Map<TableKey, TableStatus>;

/**
 * 表格高度信息
 * 
 * 存储表格在 Render 模式下的实际高度，以及为了保持高度一致，
 * Raw 模式应该使用的字体大小和行高。
 */
type TableHeightInfo = {
  /** Render 模式下测量的实际高度（px） */
  renderHeight: number;
  /** Raw 模式应该使用的字体大小（px），由 heightMatcher 计算 */
  rawFontSize: number;
  /** Raw 模式应该使用的行高（无单位），由 heightMatcher 计算 */
  rawLineHeight: number;
};

/**
 * 表格高度映射
 * 
 * 临时存储当前会话中计算的高度信息。
 * 每次切换到 raw 模式时重新计算。
 */
type TableHeightMap = Map<TableKey, TableHeightInfo>;

// ==================== 工具函数 ====================

/**
 * 生成表格的唯一标识符
 * 
 * @param from - 表格起始位置
 * @param to - 表格结束位置
 * @returns 表格的唯一 key
 * 
 * @example
 * ```typescript
 * const key = makeTableKey(100, 200); // "100-200"
 * ```
 */
function makeTableKey(from: number, to: number): TableKey {
  return `${from}-${to}`;
}

/**
 * 构建表格索引
 * 
 * 扫描文档中的所有表格，构建索引。为了性能考虑，只扫描视口附近的区域。
 * 
 * **扫描范围：**
 * - 视口前后各 2000 字符
 * - 避免全文扫描，提高性能
 * 
 * **工作原理：**
 * 1. 获取语法树（syntaxTree）
 * 2. 遍历语法树，查找 "Table" 节点
 * 3. 提取每个表格的位置和内容
 * 4. 按位置排序
 * 
 * @param view - CodeMirror 编辑器视图
 * @returns 表格索引
 */
function buildTableIndex(view: EditorView): TableIndex {
  const { state } = view;
  const doc = state.doc;

  const tables: TableEntry[] = [];

  // 只扫描 viewport 附近，避免每次 rebuildIndex 全文遍历
  const marginChars = 2000;
  const from = Math.max(0, view.viewport.from - marginChars);
  const to = Math.min(doc.length, view.viewport.to + marginChars);

  syntaxTree(state).iterate({
    from, to,
    enter: node => {
      if (node.name !== "Table") return;
      const { from, to } = node;
      const markdown = doc.sliceString(from, to);
      //Logger.debug(`Table found: [${from}, ${to}) ${markdown.split("\n")[0]}...`);
      tables.push({ key: makeTableKey(from, to), from, to, markdown });
    }
  });

  tables.sort((a, b) => a.from - b.from);
  return { tables };
}

/**
 * 判断 caret 是否“在 table 内部 或 上下相邻行”：
 * - inside：from <= pos <= to
 * - touching by line：pos 所在行 == tableStartLine-1 或 tableEndLine+1
 */
function caretHitsOrTouchesTable(view: EditorView, pos: number, table: TableEntry): boolean {
  const doc = view.state.doc;
  if (pos >= table.from && pos <= table.to) return true;

  const cursorLine = doc.lineAt(pos).number;
  const startLine = doc.lineAt(table.from).number;
  const endLine = doc.lineAt(table.to).number;

  return cursorLine === startLine - 1 || cursorLine === endLine + 1;  
}

/**
 * 找到“caret 命中或紧贴”的 table（优先最近）。
 * 最近的定义：到 [from,to] 区间的距离最小；相同则取更靠前。
 */
function findNearestHitOrTouchTable(view: EditorView, pos: number, index: TableIndex): TableEntry | null {
  Assert.notNull(view);  
  let best: TableEntry | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const t of index.tables) {
    if (!caretHitsOrTouchesTable(view, pos, t)) continue;

    // dist=0 表示在区间内；否则是到端点的距离
    const dist = pos < t.from ? (t.from - pos) : (pos > t.to ? (pos - t.to) : 0);
    if (dist < bestDist || (dist === bestDist && best && t.from < best.from)) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

/* =========================
 * Keyboard Navigation
 * ========================= */

/**
 * 处理向左箭头键：如果光标在表格范围内，跳到表格开始
 */
function handleArrowLeft(view: EditorView): boolean {
  const index = view.state.field(tableIndexField);
  const statusMap = view.state.field(tableStatusField);
  const selection = view.state.selection.main;
  const cursorPos = selection.head;

  for (const table of index.tables) {
    const st = statusMap.get(table.key) ?? "rendered";
    if (st === "raw") continue;

    if (cursorPos > table.from && cursorPos <= table.to) {
      view.dispatch({
        selection: { anchor: table.from },
        scrollIntoView: true
      });
      return true;
    }
  }

  return false;
}

/**
 * 处理向右箭头键：如果光标在表格范围内，跳到表格结束
 */
function handleArrowRight(view: EditorView): boolean {
  const index = view.state.field(tableIndexField);
  const statusMap = view.state.field(tableStatusField);
  const selection = view.state.selection.main;
  const cursorPos = selection.head;

  for (const table of index.tables) {
    const st = statusMap.get(table.key) ?? "rendered";
    if (st === "raw") continue;

    if (cursorPos >= table.from && cursorPos < table.to) {
      view.dispatch({
        selection: { anchor: table.to },
        scrollIntoView: true
      });
      return true;
    }
  }

  return false;
}

const tableNavigationKeymap = keymap.of([
  {
    key: "ArrowLeft",
    run: handleArrowLeft
  },
  {
    key: "ArrowRight",
    run: handleArrowRight
  }
]);

/**
 * 根据索引、状态和高度信息生成表格装饰器
 * 
 * 这是 Decoration 生成的核心函数，根据表格的状态决定如何显示。
 * 
 * ## 显示规则
 * 
 * ### Render 模式（默认）
 * 
 * - 使用 `Decoration.replace()` 替换整个表格语法
 * - 插入 TableWidget 显示 HTML 表格
 * - 只在视口内渲染（性能优化）
 * 
 * ### Raw 模式
 * 
 * - 使用 `Decoration.line()` 为每一行添加样式
 * - 应用高度信息中的字体大小和行高
 * - 确保高度与 Render 模式一致
 * 
 * @param view - CodeMirror 编辑器视图
 * @param index - 表格索引
 * @param statusMap - 表格状态映射
 * @param heightMap - 表格高度映射
 * @returns 装饰器集合
 */
function computeTableDecorationsFromIndex(
  view: EditorView, 
  index: TableIndex, 
  statusMap: TableStatusMap,
  heightMap: TableHeightMap
): DecorationSet {
  Assert.notNull(view);
  const builder = new RangeSetBuilder<Decoration>();

  const vpFrom = view.viewport.from;
  const vpTo = view.viewport.to;

  // 只对 viewport 内的 tables produce decorations
  for (const t of index.tables) {
    if (t.to < vpFrom || t.from > vpTo) continue;

    const st = statusMap.get(t.key) ?? "rendered";
    
    if (st === "raw") {
      // raw模式：使用 heightMatcher 提供的函数为表格的每一行添加line装饰
      const heightInfo = heightMap.get(t.key);
      applyHeightStyleToLines(builder, view, t.from, t.to, heightInfo, {
        logId: `Table ${t.key}`,
        verbose: true
      });
    } else {
      // rendered模式：使用 replace 装饰，用 widget 替换整个表格语法
      builder.add(
        t.from,
        t.to,
        Decoration.replace({
          widget: new TableWidget(t.markdown, t.from, t.to, view, t.key)
        })
      );
    }
  }

  return builder.finish();
}

// ==================== State 管理：数据层 ====================
//
// 这部分定义了 3 个 StateFields 和 1 个 Decoration Field，
// 它们构成了 Table Extension 的数据层。
//
// ## 架构说明
//
// StateField 是 CodeMirror 中存储状态的标准方式。每个 StateField：
// - 存储特定类型的数据
// - 通过 Effect 更新
// - 不可变（每次更新创建新对象）
// - 可以被其他扩展访问
//
// ## 数据流
//
// ```
// tableVP (ViewPlugin)
//     ↓ dispatch(effects)
// StateFields 更新
//     ↓ 新的 state
// computeTableDecorationsFromIndex
//     ↓ 新的 decorations
// 重新渲染
// ```
//

/**
 * tableIndexField - 表格索引字段
 * 
 * 存储文档中所有表格的列表。
 * 
 * **更新时机：**
 * - 文档改变时（docChanged）
 * - 视口改变时（viewportChanged）
 * - 语法树未就绪时
 * 
 * **更新方式：**
 * - tableVP 调用 buildTableIndex() 构建新索引
 * - dispatch setTableIndexEffect
 * - 这个 field 接收 effect 并更新
 * 
 * **用途：**
 * - 快速查找文档中的所有表格
 * - 判断光标是否在表格内
 * - 生成 decorations
 */
const tableIndexField = StateField.define<TableIndex>({
  create(state) { return { tables: [] }; },
  update(value, tr) {
    for (const e of tr.effects) { if (e.is(setTableIndexEffect)) return e.value; }
    return value;
  }
});

const setTableIndexEffect = StateEffect.define<TableIndex>();

/**
 * tableStatusField - 表格状态字段
 * 
 * 存储每个表格的显示模式（Raw/Render）。
 * 
 * **默认行为：**
 * - 如果 key 不在 Map 中，默认为 "rendered"
 * - 只有明确设置为 "raw" 的表格才会以 Raw 模式显示
 * 
 * **更新时机：**
 * - 光标移动时（selectionSet）
 * - 用户点击表格时
 * - 文档改变后清理无效的表格
 * 
 * **更新规则：**
 * - 光标在表格内或紧邻 → 设置为 "raw"
 * - 光标离开表格 → 恢复为 "rendered"
 * - 只有当前命中的表格为 "raw"，其他全部为 "rendered"
 * 
 * **清理机制：**
 * - 文档改变后，删除不存在的表格的状态
 * - 避免内存泄漏
 */
const clearTableStatusEffect = StateEffect.define<void>();
const tableStatusField = StateField.define<TableStatusMap>({
  create() { return new Map(); },
  update(value, tr) {
    let next = value;

    // 允许外部强制清空（用于 docChanged/selectionSet 后重置，避免 key 漂移导致抖动）
    for (const e of tr.effects) {
      if (e.is(clearTableStatusEffect)) {
        next = new Map();
        break;
      }
    }

    // docChanged 后，旧 key 集合可能失效；做一次清理（可选但推荐）
    let newIndex: TableIndex | null = null;
    for (const e of tr.effects) {
      if (e.is(setTableIndexEffect)) newIndex = e.value;
    }
    if (newIndex) {
      const alive = new Set(newIndex.tables.map(t => t.key));
      let changed = false;
      for (const k of next.keys()) {
        if (!alive.has(k)) {
          if (!changed) next = new Map(next);
          changed = true;
          next.delete(k);
        }
      }
    }

    for (const e of tr.effects) {
      if (e.is(setTableStatusEffect)) {
        const { key, status } = e.value;
        const cur = next.get(key);
        if (cur === status) continue;
        if (next === value) next = new Map(next);
        next.set(key, status);
      } else if (e.is(setManyTableStatusEffect)) {
        if (next === value) next = new Map(next);
        for (const { key, status } of e.value) next.set(key, status);
      }
    }
    return next;
  }
});

const setTableStatusEffect = StateEffect.define<{ key: TableKey; status: TableStatus }>();
const setManyTableStatusEffect = StateEffect.define<Array<{ key: TableKey; status: TableStatus }>>();

/**
 * tableHeightField - 表格高度字段
 * 
 * 临时存储当前会话中计算的高度信息。
 * 每次切换到 raw 模式时重新计算并更新。
 */
const setTableHeightEffect = StateEffect.define<{ key: TableKey; heightInfo: TableHeightInfo }>();

const tableHeightField = StateField.define<TableHeightMap>({
  create() { return new Map(); },
  update(value, tr) {
    let next = value;
    
    // 更新高度信息
    for (const e of tr.effects) {
      if (e.is(setTableHeightEffect)) {
        if (next === value) next = new Map(next);
        next.set(e.value.key, e.value.heightInfo);
      }
    }
    
    return next;
  }
});

// 5) decorations field：仍由 effect 写入（避免在 field.update 里依赖 view.viewport）
const setTableDecosEffect = StateEffect.define<DecorationSet>();

const tableDecoField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco: DecorationSet, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) { if (e.is(setTableDecosEffect)) return e.value; }
    return deco;
  },
  provide: f => EditorView.decorations.from(f)
});

/**
 * ViewPlugin：
 * - docChanged：重建 index；并按“默认 rendered”保持（statusMap 不需要填默认）
 * - selectionSet：只根据 caret 更新 相关 table status（最多影响：旧命中 + 新命中 的两个 table）
 * - viewportChanged：只重建 decorations
 * - 鼠标点击 widget：先把对应 table 设为 raw；下一帧 move caret（通过 widget 发 effect）
 */
const tableVP = ViewPlugin.fromClass(
  class {
    initialized = false;
    view: EditorView;
    updating = false;

    // 记录上次 rebuildIndex 时的语法树可用状态
    lastSyntaxTreeReady = false;

    constructor(view: EditorView) {
      this.view = view;
    }

    update(update: ViewUpdate) {
      Assert.notNull(update.view);
      this.view = update.view;

      if (this.updating) return;

      rafChain().then(async () => {
        try {
          this.updating = true;

          const effects: StateEffect<any>[] = [];
          let index = this.view.state.field(tableIndexField);
          let statusMap = this.view.state.field(tableStatusField);
          let heightMap = this.view.state.field(tableHeightField);

          // 重建 TableIndex 的时机：第一次/docChanged/viewportChanged/上次重建时viewport对应的语法树不全ready
          const needRebuildIndex = !this.initialized || update.docChanged || update.viewportChanged || !this.lastSyntaxTreeReady;
          if (needRebuildIndex) {
            this.initialized = true;
            ensureSyntaxTree(this.view.state, this.view.viewport.to, 50); // 稍微等待一下语法树，避免闪烁
            this.lastSyntaxTreeReady = syntaxTreeAvailable(this.view.state, this.view.viewport.to);
            index = buildTableIndex(this.view);
            effects.push(setTableIndexEffect.of(index));
          }

          // 更新 TableStatus 的时机：TableIndex变了/光标位置变了/文档变了
          const needUpdateStatus = needRebuildIndex || update.selectionSet || update.docChanged;
          if (needUpdateStatus) {
            const caret = this.view.state.selection.main.head;
            const hit = findNearestHitOrTouchTable(this.view, caret, index);
            if (hit) {
              Logger.debug(`TableVP: caret at ${caret} hits/touches table [${hit.from},${hit.to}]`);
              
              // 每次都重新计算高度信息，确保准确性
              Logger.debug(`TableVP: Computing height for table ${hit.key} (cursor movement)`);
              try {
                const heightInfo = await computeHeightInfo(
                  this.view,
                  hit.from,
                  hit.to,
                  hit.markdown,
                  {
                    verbose: true,
                    logId: `table-${hit.key}`
                  }
                );
                
                // 更新 heightMap（用于后续的 decoration 生成）
                heightMap = new Map(heightMap);
                heightMap.set(hit.key, heightInfo);
                effects.push(setTableHeightEffect.of({ key: hit.key, heightInfo }));
                
                Logger.debug(`TableVP: Height computed for table ${hit.key} - fontSize=${heightInfo.rawFontSize.toFixed(2)}px, lineHeight=${heightInfo.rawLineHeight.toFixed(3)}`);
              } catch (error) {
                Logger.error(`TableVP: Failed to compute height for table ${hit.key}`, error);
                // 即使失败也继续，使用默认字体
              }
            }

            // 规则：只让“当前命中/紧贴”的 table 为 raw，其它一律恢复 rendered
            // 由于默认是 rendered（status 缺省 => rendered），因此这里用空 Map 表示“全部 rendered”
            const nextStatusMap = new Map<TableKey, TableStatus>();
            if (hit) nextStatusMap.set(hit.key, "raw");

            statusMap = nextStatusMap;
            effects.push(
              setManyTableStatusEffect.of(
                Array.from(statusMap.entries()).map(([key, status]) => ({ key, status }))
              )
            );
          }

          const needRebuildDecos = needRebuildIndex || needUpdateStatus || update.viewportChanged;
          if (needRebuildDecos) {
            const deco = computeTableDecorationsFromIndex(this.view, index, statusMap, heightMap);
            effects.push(setTableDecosEffect.of(deco));
          }

          if (effects.length) this.view.dispatch({ effects });
        } finally {
          this.updating = false;
        }
      });
    }
  }
);

/**
 * TableWidget - 表格渲染 Widget
 * 
 * 这个 Widget 负责在 Render 模式下显示 HTML 表格。
 * 
 * ## 职责
 * 
 * 1. **渲染表格**：将 Markdown 语法转换为 HTML <table>
 * 2. **计算字体**：调用 heightMatcher 计算 Raw 模式的字体大小
 * 3. **处理交互**：响应鼠标点击，切换到 Raw 模式
 */
class TableWidget extends WidgetType {
  private parsed?: ParsedTable;
  private view: EditorView;
  private tableKey: TableKey;

  constructor(
    private markdown: string,
    private from: number,
    private to: number,
    view: EditorView,
    tableKey: TableKey
  ) {
    super();
    this.view = view;
    this.tableKey = tableKey;
  }

  eq(other: TableWidget): boolean {
    return other.markdown === this.markdown && other.from === this.from && other.to === this.to;
  }

  private ensureParsed(): ParsedTable {
    if (!this.parsed) this.parsed = parseMarkdownTable(this.markdown);
    return this.parsed;
  }

  toDOM(view: EditorView): HTMLElement {
    Assert.notNull(view);
    const cmView = view;

    const wrapper = document.createElement("div");
    wrapper.className = "cm-md-table-wrapper";

    const table = document.createElement("table");
    table.className = "cm-md-table";
    table.setAttribute("contenteditable", "false");

    // 填充表格内容，给每个 cell 加上 行号和列号属性
    // 约定：data-row/data-col 存 parsed.rows 的真实下标（包含分隔行）；分隔行不渲染
    const { rows, hasHeader } = this.ensureParsed();

    for (let i = 0; i < rows.length; i++) {
      // 跳过分隔行（渲染不需要）
      if (hasHeader && i === 1) continue;

      const tr = document.createElement("tr");
      const isHeaderRow = hasHeader && i === 0;

      for (let j = 0; j < rows[i].length; j++) {
        const cell = rows[i][j];
        const el = document.createElement(isHeaderRow ? "th" : "td");

        // 存真实行列号（i/j 直接对应 parsed.rows / parsed.cellSpans）
        el.setAttribute("data-row", String(i));
        el.setAttribute("data-col", String(j));

        el.appendChild(renderInlineMarkdownToDOM(document, cell));
        tr.appendChild(el);
      }

      table.appendChild(tr);
    }

    wrapper.appendChild(table);

    // ==================== 鼠标点击处理 ====================
    wrapper.addEventListener("mousedown", async (e) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const cmView = view;

      let approxPos = this.from;
      const td = (e.target as HTMLElement).closest("td, th");
      if (td) {
        const row = Number(td.getAttribute("data-row") ?? "0");
        const col = Number(td.getAttribute("data-col") ?? "0");

        const parsed = this.ensureParsed();
        const span = parsed.cellSpans?.[row]?.[col];

        if (span) {
          const cellFrom = this.from + span.from;
          const cellTo = this.from + span.to;

          const rect = td.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.min(Math.max(clickX / Math.max(rect.width, 1), 0), 1);

          approxPos = cellFrom + Math.floor(ratio * (cellTo - cellFrom));
          Logger.debug(`TableWidget click cell[${row},${col}] cellFrom=${cellFrom} cellTo=${cellTo} approxPos=${approxPos}`);
        } else {
          approxPos = this.from;
          Logger.debug(`TableWidget click cell[${row},${col}] span missing; fallback to table.from`);
        }
      }

      const inside = Math.min(Math.max(approxPos, 0), cmView.state.doc.length);
      const key = makeTableKey(this.from, this.to);

      // ==================== Height Matcher 集成 ====================
      // 每次切换到 raw 模式时都计算高度信息
      Logger.debug(`Table ${this.tableKey}: Computing height on click (render → raw transition)`);
      
      try {
        // 计算高度信息
        const heightInfo = await computeHeightInfo(
          this.view,
          this.from,
          this.to,
          this.markdown,
          {
            verbose: true,
            logId: `table-${this.tableKey}`
          }
        );
        
        // 保存高度信息到 StateField，然后切换到 raw 模式
        cmView.dispatch({
          effects: [
            setTableHeightEffect.of({
              key: this.tableKey,
              heightInfo: heightInfo
            }),
            setTableStatusEffect.of({ key, status: "raw" })
          ],
          selection: { anchor: inside }
        });
        
        Logger.debug(`Table ${this.tableKey}: Height computed - fontSize=${heightInfo.rawFontSize.toFixed(2)}px, lineHeight=${heightInfo.rawLineHeight.toFixed(3)}`);
      } catch (error) {
        Logger.error(`Table ${this.tableKey}: Failed to compute height`, error);
        
        // 即使计算失败，也切换到 raw 模式（使用默认字体）
        cmView.dispatch({
          effects: setTableStatusEffect.of({ key, status: "raw" }),
          selection: { anchor: inside }
        });
      }
    });

    return wrapper;
  }

  ignoreEvent(_event: Event): boolean {
    return false;
  }
}

// ==================== 导出 Extension ====================
//
// Table Extension 由 5 个组件组成，每个组件都有特定的职责。
//
// ## 组件说明
//
// 1. **tableIndexField** (StateField)
//    - 存储文档中所有表格的列表
//    - 按位置排序，便于快速查找
//
// 2. **tableStatusField** (StateField)
//    - 存储每个表格的显示模式（Raw/Render）
//    - 根据光标位置自动切换
//
// 3. **tableDecoField** (StateField + Decoration)
//    - 存储和提供装饰器
//    - Render 模式：显示 HTML 表格 Widget
//    - Raw 模式：应用字体大小和行高样式
//
// 4. **tableNavigationKeymap** (Keymap)
//    - 处理键盘导航
//    - 左右箭头键快速跳转
//
// 5. **tableVP** (ViewPlugin)
//    - 协调所有组件
//    - 响应文档、选区、视口变化
//    - 触发索引重建、状态更新、装饰器重建
//
// ## Height Matcher 集成流程
//
// ```
// 1. tableVP 检测到表格
//        ↓
// 2. 创建 TableWidget (Render 模式)
//        ↓
// 3. Widget.toDOM() 渲染 HTML 表格
//        ↓
// 4. 用户点击表格
//        ↓
// 5. 检查 TableWidget.heightCache
//        ↓
// 6. 调用 computeAndApplyHeight
//        ↓
// 7. 保存结果到 TableWidget.heightCache
//        ↓
// 8. tableVP 更新 tableStatusField 为 "raw"
//        ↓
// 9. computeTableDecorationsFromIndex 读取 TableWidget.heightCache
//        ↓
// 10. 为每一行添加 line decoration
//        ↓
// 11. 应用字体大小和行高
//        ↓
// 12. Raw 模式高度 = Render 模式高度 ✓
// ```
//
// ## 使用方式
//
// ```typescript
// import { tableExtension } from "./extensions/table/extension";
//
// const state = EditorState.create({
//   extensions: [
//     ...tableExtension  // 展开数组，注册所有组件
//   ]
// });
// ```
//

export const tableExtension = [
  tableIndexField,
  tableStatusField,
  tableHeightField,
  tableDecoField,
  tableNavigationKeymap,
  tableVP
];
