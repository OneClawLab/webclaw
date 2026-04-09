import { Logger } from "@lib/logast.js";
import { EditorView, Decoration } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

/**
 * Height Matcher - 通用的高度匹配工具
 * 
 * 这个工具用于在 CodeMirror 编辑器中实现 raw 模式和 render 模式之间的高度一致性。
 * 通过二分查找算法，自动计算出最合适的字体大小和行高，使得文本内容在不同模式下
 * 占用相同的垂直空间，避免模式切换时的跳动。
 * 
 * ## 核心功能
 * 
 * - 🎯 **精确匹配**：使用两阶段二分查找算法，快速找到最佳字体大小和行高组合
 * - 📏 **处理折行**：正确处理长文本的自动折行，确保宽度一致时的高度匹配
 * - 🔧 **高度可配置**：支持自定义字体范围、行高范围、容差等参数
 * - 📊 **详细日志**：可选的详细日志输出，方便调试和性能分析
 * - ⚡ **高性能**：通过二分查找，通常在 10-20 次迭代内即可找到最佳值
 * 
 * ## 使用场景
 * 
 * ### 1. CodeMirror Widget 的 Raw/Render 模式切换
 * 
 * 当你的 widget 需要在两种模式之间切换时：
 * - **Render 模式**：显示渲染后的内容（如表格、图片等）
 * - **Raw 模式**：显示原始的 markdown 语法，允许编辑
 * 
 * 为了避免切换时的高度跳动，需要调整 raw 模式的字体大小，使其高度与 render 模式一致。
 * 
 * ### 2. 表格扩展（Table Extension）
 * 
 * 表格在 render 模式下显示为 HTML 表格，在 raw 模式下显示为 markdown 语法。
 * 当表格内容很多导致折行时，需要精确计算字体大小以保持高度一致。
 * 
 * ### 3. 其他可能的应用
 * 
 * - 图片扩展（当 markdown 语法很长时）
 * - 代码块扩展
 * - 任何需要在不同渲染模式间切换的内容
 * 
 * ## 工作原理
 * 
 * ### 两阶段二分查找算法
 * 
 * 1. **第一阶段：查找字体大小**
 *    - 固定行高为 1.4（默认值）
 *    - 在指定范围内（默认 4-20px）二分查找最佳字体大小
 *    - 目标：使测量高度尽可能接近目标高度
 * 
 * 2. **第二阶段：微调行高**
 *    - 固定第一阶段找到的字体大小
 *    - 在指定范围内（默认 1.0-2.0）二分查找最佳行高
 *    - 目标：进一步减小误差，达到容差范围内
 * 
 * ### 测量方式
 * 
 * 1. 创建隐藏的 DOM 容器（position: absolute, visibility: hidden）
 * 2. 设置与目标容器相同的宽度，确保折行行为一致
 * 3. 按行分割内容，每行创建独立的 div 元素
 * 4. 使用 `pre-wrap` 允许折行，模拟 CodeMirror 的行为
 * 5. 应用测试的字体大小和行高，测量实际高度
 * 6. 根据测量结果调整搜索范围，继续迭代
 * 7. 找到最佳值后清理测量容器
 * 
 * ## 性能考虑
 * 
 * - **时间复杂度**：O(log n)，其中 n 是搜索范围
 * - **典型迭代次数**：10-20 次（每阶段）
 * - **DOM 操作**：仅创建一次测量容器，重复使用
 * - **内存占用**：测量完成后立即清理 DOM 元素
 */

/**
 * 字体样式配置
 * 
 * 描述字体大小和行高的组合
 */
export interface FontStyle {
  /** 字体大小（px） */
  fontSize: number;
  /** 行高（无单位，相对于字体大小的倍数，如 1.4 表示行高为字体大小的 1.4 倍） */
  lineHeight: number;
}

/**
 * 高度匹配选项
 * 
 * 配置高度匹配算法的各项参数。所有可选参数都有合理的默认值。
 */
export interface HeightMatchOptions {
  /** 
   * 目标高度（px）- 必填
   * 
   * 这是你希望内容达到的高度，通常是 render 模式下测量的实际高度。
   * 在 CodeMirror 中，建议使用 lineBlockAt 方法测量：
   * 
   * @example
   * ```typescript
   * const startBlock = view.lineBlockAt(from);
   * const endBlock = view.lineBlockAt(to);
   * const targetHeight = endBlock.bottom - startBlock.top;
   * ```
   */
  targetHeight: number;
  
  /** 
   * 要测量的文本内容 - 必填
   * 
   * 需要调整字体大小的原始文本，通常是 markdown 语法。
   * 支持多行文本，会自动按换行符分割。
   * 
   * @example "| col1 | col2 |\n| --- | --- |\n| data1 | data2 |"
   */
  content: string;
  
  /** 
   * 容器宽度（px）- 必填
   * 
   * 用于正确处理文本折行。必须与实际渲染容器的宽度一致。
   * 在 CodeMirror 中建议使用：
   * 
   * @example
   * ```typescript
   * const containerWidth = view.contentDOM.getBoundingClientRect().width;
   * ```
   */
  containerWidth: number;
  
  /** 
   * 字体族 - 可选
   * 
   * CSS font-family 属性值，应该与编辑器使用的字体一致。
   * 
   * @default '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"'
   */
  fontFamily?: string;
  
  /** 
   * 字体大小搜索范围 - 可选
   * 
   * 定义二分查找的字体大小范围（px）
   * 
   * @default { min: 4, max: 20 }
   */
  fontSizeRange?: { min: number; max: number };
  
  /** 
   * 行高搜索范围 - 可选
   * 
   * 定义二分查找的行高范围（无单位，相对于字体大小）
   * 
   * @default { min: 1.0, max: 2.0 }
   */
  lineHeightRange?: { min: number; max: number };
  
  /** 
   * 允许的误差（px）- 可选
   * 
   * 当测量高度与目标高度的差值小于此值时，认为找到了满意的结果。
   * 较小的容差会增加迭代次数，但结果更精确。
   * 
   * @default 0.5
   */
  tolerance?: number;
  
  /** 
   * 最大迭代次数 - 可选
   * 
   * 每个阶段的最大迭代次数，防止算法陷入无限循环。
   * 
   * @default 50
   */
  maxIterations?: number;
  
  /** 
   * 是否启用详细日志 - 可选
   * 
   * 启用后会输出每次迭代的详细信息。
   * 建议在开发和调试时启用，生产环境关闭。
   * 
   * @default false
   */
  verbose?: boolean;
  
  /** 
   * 日志标识符 - 可选
   * 
   * 用于在日志中区分不同的匹配任务。
   * 
   * @default "content"
   * @example "table-123" 或 "image-456"
   */
  logId?: string;
}

/**
 * 高度匹配结果
 * 
 * 包含算法找到的最佳字体样式和匹配质量信息
 */
export interface HeightMatchResult {
  /** 
   * 最佳字体大小（px）
   * 
   * 应用此字体大小后，内容高度最接近目标高度。
   * 可以直接用于 CSS 的 font-size 属性。
   */
  fontSize: number;
  
  /** 
   * 最佳行高（无单位）
   * 
   * 应用此行高后，内容高度最接近目标高度。
   * 可以直接用于 CSS 的 line-height 属性。
   */
  lineHeight: number;
  
  /** 
   * 最终测量的高度（px）
   * 
   * 使用最佳字体大小和行高后，实际测量的内容高度。
   * 用于验证匹配效果。
   */
  measuredHeight: number;
  
  /** 
   * 与目标高度的差值（px）
   * 
   * = measuredHeight - targetHeight
   * 
   * - 正值：测量高度大于目标高度
   * - 负值：测量高度小于目标高度
   * - 绝对值越小表示匹配越精确
   */
  difference: number;
  
  /** 
   * 是否在容差范围内
   * 
   * true 表示 |difference| <= tolerance，
   * 可以认为找到了满意的匹配结果。
   */
  withinTolerance: boolean;
}

/**
 * 内部函数：通用的高度匹配工具（异步版本）
 * 
 * 给定一段文本和目标高度，通过两阶段二分查找算法找到最合适的字体大小和行高。
 * 
 * @internal 此函数仅供内部使用，外部应使用 computeAndApplyHeight
 */
async function matchHeightWithFontSize(
  options: HeightMatchOptions
): Promise<HeightMatchResult> {
  const {
    targetHeight,
    content,
    containerWidth,
    fontFamily = '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"',
    fontSizeRange = { min: 4, max: 20 },
    lineHeightRange = { min: 1.0, max: 2.0 },
    tolerance = 0.5,  // 降低容差到 0.5px，提高精度
    maxIterations = 50,  // 增加最大迭代次数，确保找到最佳值
    verbose = false,
    logId = "content"
  } = options;

  // 创建测量容器，尽可能模拟 CodeMirror 的渲染环境
  const measureContainer = document.createElement("div");
  measureContainer.style.position = "absolute";
  measureContainer.style.visibility = "hidden";
  measureContainer.style.left = "-9999px";
  measureContainer.style.top = "-9999px";
  measureContainer.style.width = `${containerWidth}px`;
  measureContainer.style.boxSizing = "border-box";
  measureContainer.style.fontFamily = fontFamily;
  // 添加 CodeMirror 相关的样式以确保测量准确
  measureContainer.style.lineHeight = "normal"; // 初始行高
  measureContainer.style.letterSpacing = "normal";
  measureContainer.style.wordSpacing = "normal";
  document.body.appendChild(measureContainer);

  // 按行分割内容，每行创建一个div
  const lines = content.split('\n');
  const lineDivs: HTMLDivElement[] = [];

  for (const lineText of lines) {
    const lineDiv = document.createElement("div")
    lineDiv.style.whiteSpace = "pre-wrap";
    lineDiv.style.wordWrap = "break-word";
    lineDiv.style.overflowWrap = "break-word";
    lineDiv.style.margin = "0";
    lineDiv.style.padding = "0";
    lineDiv.style.border = "0"; // 确保没有边框
    lineDiv.style.width = "100%";
    lineDiv.style.boxSizing = "border-box";
    lineDiv.style.verticalAlign = "baseline"; // 与 CodeMirror 一致
    lineDiv.textContent = lineText || " "; // 空行用空格占位
    measureContainer.appendChild(lineDiv);
    lineDivs.push(lineDiv);
  }

  // 测试默认字体
  if (verbose) {
    lineDivs.forEach(div => {
      div.style.fontSize = "14px";
      div.style.lineHeight = "1.4";
    });
    const defaultHeight = measureContainer.getBoundingClientRect().height;
    const ratio = targetHeight / defaultHeight;
    Logger.debug(`[${logId}] Default (14px, 1.4) height = ${defaultHeight.toFixed(2)}px, target = ${targetHeight.toFixed(2)}px, ratio = ${ratio.toFixed(3)}`);
  }

  let bestFontSize = 14;
  let bestLineHeight = 1.4;
  let bestDiff = Infinity;

  // 第一阶段：二分查找字体大小（固定行高）
  let minFontSize = fontSizeRange.min;
  let maxFontSize = fontSizeRange.max;

  if (verbose) {
    Logger.debug(`[${logId}] Phase 1 - Finding best font size (lineHeight fixed at 1.4)`);
  }

  for (let iteration = 0; iteration < maxIterations; iteration+0.1) {
    const testFontSize = (minFontSize + maxFontSize) / 2;

    lineDivs.forEach(div => {
      div.style.fontSize = `${testFontSize}px`;
      div.style.lineHeight = `1.4`;
    });

    const measuredHeight = measureContainer.getBoundingClientRect().height;
    const diff = measuredHeight - targetHeight;
    const absDiff = Math.abs(diff);

    if (absDiff < bestDiff) {
      bestDiff = absDiff;
      bestFontSize = testFontSize;
      bestLineHeight = 1.4;
    }

    if (verbose && iteration % 5 === 0) {
      Logger.debug(`  [${logId}] Iter ${iteration}: fontSize=${testFontSize.toFixed(2)}px, measured=${measuredHeight.toFixed(2)}px, diff=${diff.toFixed(2)}px`);
    }

    if (absDiff < tolerance) {
      if (verbose) {
        Logger.debug(`  [${logId}] Match found at iteration ${iteration}: fontSize=${testFontSize.toFixed(2)}px, diff=${diff.toFixed(2)}px`);
      }
      break;
    }

    if (measuredHeight < targetHeight) {
      minFontSize = testFontSize;
    } else {
      maxFontSize = testFontSize;
    }

    if (maxFontSize - minFontSize < 0.01) {
      if (verbose) {
        Logger.debug(`  [${logId}] Range too small, stopping at fontSize=${bestFontSize.toFixed(2)}px`);
      }
      break;
    }
  }

  if (verbose) {
    Logger.debug(`[${logId}] Phase 1 result - fontSize=${bestFontSize.toFixed(2)}px, diff=${bestDiff.toFixed(2)}px`);
  }

  // 第二阶段：微调行高（固定字体大小）
  if (bestDiff > tolerance) {
    let minLineHeight = lineHeightRange.min;
    let maxLineHeight = lineHeightRange.max;

    if (verbose) {
      Logger.debug(`[${logId}] Phase 2 - Fine-tuning line height (fontSize fixed at ${bestFontSize.toFixed(2)}px)`);
    }

    for (let iteration = 0; iteration < maxIterations; iteration+0.1) {
      const testLineHeight = (minLineHeight + maxLineHeight) / 2;

      lineDivs.forEach(div => {
        div.style.fontSize = `${bestFontSize}px`;
        div.style.lineHeight = `${testLineHeight}`;
      });

      const measuredHeight = measureContainer.getBoundingClientRect().height;
      const diff = measuredHeight - targetHeight;
      const absDiff = Math.abs(diff);

      if (absDiff < bestDiff) {
        bestDiff = absDiff;
        bestLineHeight = testLineHeight;
      }

      if (verbose && iteration % 5 === 0) {
        Logger.debug(`  [${logId}] Iter ${iteration}: lineHeight=${testLineHeight.toFixed(3)}, measured=${measuredHeight.toFixed(2)}px, diff=${diff.toFixed(2)}px`);
      }

      if (absDiff < tolerance) {
        if (verbose) {
          Logger.debug(`  [${logId}] Match found at iteration ${iteration}: lineHeight=${testLineHeight.toFixed(3)}, diff=${diff.toFixed(2)}px`);
        }
        break;
      }

      if (measuredHeight < targetHeight) {
        minLineHeight = testLineHeight;
      } else {
        maxLineHeight = testLineHeight;
      }

      if (maxLineHeight - minLineHeight < 0.001) {
        if (verbose) {
          Logger.debug(`  [${logId}] Range too small, stopping at lineHeight=${bestLineHeight.toFixed(3)}`);
        }
        break;
      }
    }

    if (verbose) {
      Logger.debug(`[${logId}] Phase 2 result - lineHeight=${bestLineHeight.toFixed(3)}, diff=${bestDiff.toFixed(2)}px`);
    }
  }

  // 最终验证
  lineDivs.forEach(div => {
    div.style.fontSize = `${bestFontSize}px`;
    div.style.lineHeight = `${bestLineHeight}`;
  });
  const finalHeight = measureContainer.getBoundingClientRect().height;
  const finalDiff = Math.abs(finalHeight - targetHeight);

  // 清理测量容器
  document.body.removeChild(measureContainer);

  if (verbose) {
    Logger.debug(`[${logId}] FINAL - fontSize=${bestFontSize.toFixed(2)}px, lineHeight=${bestLineHeight.toFixed(3)}, finalHeight=${finalHeight.toFixed(2)}px, target=${targetHeight.toFixed(2)}px, diff=${finalDiff.toFixed(2)}px`);
  }

  return {
    fontSize: bestFontSize,
    lineHeight: bestLineHeight,
    measuredHeight: finalHeight,
    difference: finalDiff,
    withinTolerance: finalDiff <= tolerance
  };
}

/**
 * 同步版本的高度匹配工具
 * 
 * 与 {@link matchHeightWithFontSize} 功能完全相同，但是同步执行，立即返回结果。
 * 
 * ## ⚠️ 重要警告
 * 
 * **不推荐使用此函数**，因为：
 * 
 * 1. **阻塞主线程**：同步执行会阻塞 JavaScript 主线程，导致页面无响应
 * 2. **影响性能**：在处理多个内容时无法并行执行
 * 3. **用户体验差**：可能导致页面卡顿，特别是在处理大量内容时
 * 
 * ## 何时使用
 * 
 * 仅在以下极少数情况下考虑使用：
 * 
 * - 必须在同步上下文中执行（无法使用 async/await）
 * - 内容非常简单，处理时间可以忽略不计
 * - 已经确认不会影响用户体验
 * 
 * ## 推荐做法
 * 
 * 优先使用异步版本 {@link matchHeightWithFontSize}：
 * 
 * ```typescript
 * // ✅ 推荐：使用异步版本
 * setTimeout(async () => {
 *   const result = await matchHeightWithFontSize({
 *     targetHeight: 100,
 *     content: "...",
 *     containerWidth: 800
 *   });
 *   // 使用结果
 * }, 0);
 * 
 * // ❌ 不推荐：使用同步版本
 * const result = matchHeightWithFontSizeSync({
 *   targetHeight: 100,
 *   content: "...",
 *   containerWidth: 800
 * });
 * ```
 * 
/**
 * 计算高度信息
 * 
 * 这是一个高层次的抽象函数，封装了高度匹配的完整流程：
 * 1. 测量 render 模式的高度
 * 2. 调用 heightMatcher 计算字体大小和行高
 * 3. 返回高度信息供后续使用
 * 
 * ## 使用场景
 * 
 * 当你需要在 render 和 raw 模式之间切换时，调用这个函数计算高度信息，
 * 然后使用 applyHeightStyleToLines 应用样式。
 * 
 * ## 参数
 * 
 * @param view - CodeMirror 编辑器视图
 * @param from - 内容的起始位置
 * @param to - 内容的结束位置
 * @param content - 要匹配的文本内容
 * @param options - 可选的配置项
 * 
 * ## 返回值
 * 
 * 返回高度信息对象，包含：
 * - renderHeight: render 模式下测量的实际高度（px）
 * - rawFontSize: raw 模式应该使用的字体大小（px）
 * - rawLineHeight: raw 模式应该使用的行高（无单位）
 * 
 * ## 示例
 * 
 * ```typescript
 * // 计算高度信息
 * const heightInfo = await computeHeightInfo(view, from, to, markdown, {
 *   verbose: true,
 *   logId: 'table-123'
 * });
 * 
 * // 使用高度信息
 * console.log(heightInfo.renderHeight);  // 150.5
 * console.log(heightInfo.rawFontSize);   // 11.2
 * console.log(heightInfo.rawLineHeight); // 1.35
 * 
 * // 应用样式（通过 applyHeightStyleToLines）
 * applyHeightStyleToLines(builder, view, from, to, heightInfo);
 * ```
 * 
 * @example 在 Widget 中使用
 * ```typescript
 * // 在点击事件中
 * const heightInfo = await computeHeightInfo(
 *   this.view,
 *   this.from,
 *   this.to,
 *   this.markdown,
 *   { verbose: true, logId: `table-${this.key}` }
 * );
 * 
 * // 保存高度信息到 StateField
 * view.dispatch({
 *   effects: setHeightEffect.of({ key: this.key, heightInfo })
 * });
 * ```
 */
export async function computeHeightInfo(
  view: EditorView,
  from: number,
  to: number,
  content: string,
  options?: {
    fontFamily?: string;
    fontSizeRange?: { min: number; max: number };
    lineHeightRange?: { min: number; max: number };
    tolerance?: number;
    maxIterations?: number;
    verbose?: boolean;
    logId?: string;
  }
): Promise<{
  renderHeight: number;
  rawFontSize: number;
  rawLineHeight: number;
}> {
  // 测量 render 模式的高度
  const startBlock = view.lineBlockAt(from);
  const endBlock = view.lineBlockAt(to);
  const renderHeight = endBlock.bottom - startBlock.top;
  
  if (renderHeight <= 0) {
    throw new Error(`Invalid render height: ${renderHeight}`);
  }
  
  // 获取容器宽度
  const containerWidth = view.contentDOM.getBoundingClientRect().width;
  
  // 调用 heightMatcher 计算最佳字体大小和行高
  const result = await matchHeightWithFontSize({
    targetHeight: renderHeight,
    content,
    containerWidth,
    fontFamily: options?.fontFamily,
    fontSizeRange: options?.fontSizeRange,
    lineHeightRange: options?.lineHeightRange,
    tolerance: options?.tolerance,
    maxIterations: options?.maxIterations,
    verbose: options?.verbose,
    logId: options?.logId
  });
  
  return {
    renderHeight,
    rawFontSize: result.fontSize,
    rawLineHeight: result.lineHeight
  };
}

/**
 * 为指定范围的行应用高度匹配样式
 * 
 * 这个函数将高度信息转换为 CodeMirror Decoration，并添加到 builder 中。
 * 它会为指定范围内的每一行添加 line decoration，应用计算出的字体大小和行高。
 * 
 * ## 功能特性
 * 
 * - **自动应用样式**：根据高度信息为每一行添加 line decoration
 * - **Fallback 机制**：如果没有高度信息，使用默认的小字体样式
 * - **详细日志**：可选的日志输出，方便调试
 * 
 * ## 使用场景
 * 
 * 当你需要在 raw 模式下应用高度匹配样式时，调用此函数。
 * 通常在 StateField 的 decoration 生成函数中使用。
 * 
 * ## 参数
 * 
 * @param builder - RangeSetBuilder 实例，用于构建 decoration set
 * @param view - EditorView 实例
 * @param from - 起始位置（字符偏移量）
 * @param to - 结束位置（字符偏移量）
 * @param heightInfo - 高度信息对象（可选），包含 rawFontSize、rawLineHeight 和 renderHeight
 * @param options - 可选配置
 * @param options.logId - 日志标识符，用于区分不同的内容
 * @param options.verbose - 是否输出详细日志
 * 
 * ## 示例
 * 
 * ```typescript
 * function computeDecorations(view: EditorView, heightMap: Map<string, HeightInfo>) {
 *   const builder = new RangeSetBuilder<Decoration>();
 *   
 *   for (const [key, info] of heightMap) {
 *     const { from, to } = info;
 *     const heightInfo = heightMap.get(key);
 *     applyHeightStyleToLines(builder, view, from, to, heightInfo, {
 *       logId: key,
 *       verbose: true
 *     });
 *   }
 *   
 *   return builder.finish();
 * }
 * ```
 * 
 * @example 在 table extension 中使用
 * ```typescript
 * if (st === "raw") {
 *   const heightInfo = heightMap.get(t.key);
 *   applyHeightStyleToLines(builder, view, t.from, t.to, heightInfo, {
 *     logId: `Table ${t.key}`,
 *     verbose: true
 *   });
 * }
 * ```
 */
export function applyHeightStyleToLines(
  builder: RangeSetBuilder<Decoration>,
  view: EditorView,
  from: number,
  to: number,
  heightInfo?: {
    rawFontSize: number;
    rawLineHeight: number;
    renderHeight?: number;
  },
  options?: {
    logId?: string;
    verbose?: boolean;
  }
): void {
  const doc = view.state.doc;
  const startLine = doc.lineAt(from).number;
  const endLine = doc.lineAt(to).number;
  const logId = options?.logId ?? "content";
  const verbose = options?.verbose ?? false;
  
  if (heightInfo) {
    // 使用计算出的高度信息应用样式
    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const line = doc.line(lineNum);
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          attributes: {
            style: `font-size: ${heightInfo.rawFontSize}px; line-height: ${heightInfo.rawLineHeight};`
          }
        })
      );
    }
    
    if (verbose) {
      // 计算 raw 模式的实际高度
      const startBlock = view.lineBlockAt(from);
      const endBlock = view.lineBlockAt(to);
      const rawHeight = endBlock.bottom - startBlock.top;
      
      const heightStr = heightInfo.renderHeight 
        ? `, target=${heightInfo.renderHeight.toFixed(2)}px, raw=${rawHeight.toFixed(2)}px, diff=${(rawHeight - heightInfo.renderHeight).toFixed(2)}px`
        : `, raw=${rawHeight.toFixed(2)}px`;
      Logger.debug(`${logId}: Applying raw mode styles - fontSize=${heightInfo.rawFontSize.toFixed(2)}px, lineHeight=${heightInfo.rawLineHeight.toFixed(3)}${heightStr}`);
    }
  } else {
    // Fallback：使用默认的较小字体
    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const line = doc.line(lineNum);
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          attributes: {
            style: `font-size: 11px; line-height: 1.2;`
          }
        })
      );
    }
    
    if (verbose) {
      Logger.debug(`${logId}: No height info available, using default small font size`);
    }
  }
}

/**
 * 同步版本的高度信息计算
 * 
 * @deprecated 建议使用异步版本 {@link computeHeightInfo}
 */
export function computeHeightInfoSync(
  view: EditorView,
  from: number,
  to: number,
  content: string,
  options?: {
    fontFamily?: string;
    fontSizeRange?: { min: number; max: number };
    lineHeightRange?: { min: number; max: number };
    tolerance?: number;
    maxIterations?: number;
    verbose?: boolean;
    logId?: string;
  }
): {
  renderHeight: number;
  rawFontSize: number;
  rawLineHeight: number;
} {
  const startBlock = view.lineBlockAt(from);
  const endBlock = view.lineBlockAt(to);
  const renderHeight = endBlock.bottom - startBlock.top;
  
  if (renderHeight <= 0) {
    throw new Error(`Invalid render height: ${renderHeight}`);
  }
  
  const containerWidth = view.contentDOM.getBoundingClientRect().width;
  
  const result = matchHeightWithFontSizeSync({
    targetHeight: renderHeight,
    content,
    containerWidth,
    fontFamily: options?.fontFamily,
    fontSizeRange: options?.fontSizeRange,
    lineHeightRange: options?.lineHeightRange,
    tolerance: options?.tolerance,
    maxIterations: options?.maxIterations,
    verbose: options?.verbose,
    logId: options?.logId
  });
  
  return {
    renderHeight,
    rawFontSize: result.fontSize,
    rawLineHeight: result.lineHeight
  };
}

/**
 * 内部函数：同步版本的高度匹配工具
 * 
 * @internal 此函数仅供内部使用
 * @deprecated 建议使用异步版本
 */
function matchHeightWithFontSizeSync(
  options: HeightMatchOptions
): HeightMatchResult {
  // 直接执行同步版本
  const {
    targetHeight,
    content,
    containerWidth,
    fontFamily = '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"',
    fontSizeRange = { min: 4, max: 20 },
    lineHeightRange = { min: 1.0, max: 2.0 },
    tolerance = 0.5,  // 降低容差到 0.5px，提高精度
    maxIterations = 50,  // 增加最大迭代次数，确保找到最佳值
    verbose = false,
    logId = "content"
  } = options;

  const measureContainer = document.createElement("div");
  measureContainer.style.position = "absolute";
  measureContainer.style.visibility = "hidden";
  measureContainer.style.left = "-9999px";
  measureContainer.style.top = "-9999px";
  measureContainer.style.width = `${containerWidth}px`;
  measureContainer.style.boxSizing = "border-box";
  measureContainer.style.fontFamily = fontFamily;
  // 添加 CodeMirror 相关的样式以确保测量准确
  measureContainer.style.lineHeight = "normal";
  measureContainer.style.letterSpacing = "normal";
  measureContainer.style.wordSpacing = "normal";
  document.body.appendChild(measureContainer);

  const lines = content.split('\n');
  const lineDivs: HTMLDivElement[] = [];

  for (const lineText of lines) {
    const lineDiv = document.createElement("div");
    lineDiv.style.whiteSpace = "pre-wrap";
    lineDiv.style.wordWrap = "break-word";
    lineDiv.style.overflowWrap = "break-word";
    lineDiv.style.margin = "0";
    lineDiv.style.padding = "0";
    lineDiv.style.border = "0";
    lineDiv.style.width = "100%";
    lineDiv.style.boxSizing = "border-box";
    lineDiv.style.verticalAlign = "baseline";
    lineDiv.textContent = lineText || " ";
    measureContainer.appendChild(lineDiv);
    lineDivs.push(lineDiv);
  }

  let bestFontSize = 14;
  let bestLineHeight = 1.4;
  let bestDiff = Infinity;

  // 第一阶段
  let minFontSize = fontSizeRange.min;
  let maxFontSize = fontSizeRange.max;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const testFontSize = (minFontSize + maxFontSize) / 2;

    lineDivs.forEach(div => {
      div.style.fontSize = `${testFontSize}px`;
      div.style.lineHeight = `1.4`;
    });

    const measuredHeight = measureContainer.getBoundingClientRect().height;
    const diff = measuredHeight - targetHeight;
    const absDiff = Math.abs(diff);

    if (absDiff < bestDiff) {
      bestDiff = absDiff;
      bestFontSize = testFontSize;
      bestLineHeight = 1.4;
    }

    if (absDiff < tolerance) break;

    if (measuredHeight < targetHeight) {
      minFontSize = testFontSize;
    } else {
      maxFontSize = testFontSize;
    }

    if (maxFontSize - minFontSize < 0.01) break;
  }

  // 第二阶段
  if (bestDiff > tolerance) {
    let minLineHeight = lineHeightRange.min;
    let maxLineHeight = lineHeightRange.max;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const testLineHeight = (minLineHeight + maxLineHeight) / 2;

      lineDivs.forEach(div => {
        div.style.fontSize = `${bestFontSize}px`;
        div.style.lineHeight = `${testLineHeight}`;
      });

      const measuredHeight = measureContainer.getBoundingClientRect().height;
      const diff = measuredHeight - targetHeight;
      const absDiff = Math.abs(diff);

      if (absDiff < bestDiff) {
        bestDiff = absDiff;
        bestLineHeight = testLineHeight;
      }

      if (absDiff < tolerance) break;

      if (measuredHeight < targetHeight) {
        minLineHeight = testLineHeight;
      } else {
        maxLineHeight = testLineHeight;
      }

      if (maxLineHeight - minLineHeight < 0.001) break;
    }
  }

  // 最终验证
  lineDivs.forEach(div => {
    div.style.fontSize = `${bestFontSize}px`;
    div.style.lineHeight = `${bestLineHeight}`;
  });
  const finalHeight = measureContainer.getBoundingClientRect().height;
  const finalDiff = Math.abs(finalHeight - targetHeight);

  document.body.removeChild(measureContainer);

  return {
    fontSize: bestFontSize,
    lineHeight: bestLineHeight,
    measuredHeight: finalHeight,
    difference: finalDiff,
    withinTolerance: finalDiff <= tolerance
  };
}
