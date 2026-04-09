import { Logger } from "@lib/logast.js";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view"
import { dispatchAppCommand, dispatchCommand } from "@commands/registry.js";
import { headerA, headerQ } from "./ChatSectionUtils.js";
import { theAppEventBus } from "@event/app.js";
import { theDocManager } from "./DocManager.js";
import { getAppDispatch } from "@state/storeHolder.js";
import { tabActions } from "@state/slices/tab/slice.js";

// 一个用于向 EditorView 追加内容的可写流 Writer
export class EditorSectionWriter {
  private writer?: WritableStreamDefaultWriter<string>;
  private stream: WritableStream<string>;

  constructor(private impl: {
    write(chunk: string): void;
    finalize?(status: 'ok' | 'fail', error?: string): Promise<void>;
  }) {
    this.stream = new WritableStream<string>({
      write: async (chunk) => { 
        try {
          this.impl.write(chunk);
        } catch (error) {
          Logger.error('EditorSectionWriter', 'Error writing chunk:', error);
          throw error;
        }
      },
    });
  }

  async write(chunk: string) {
    if (!this.writer)
      this.writer = this.stream.getWriter();
    await this.writer.write(chunk);
  }

  // 关闭这个流，根据 status 选择性地保留或丢弃内容
  async finalize(status: 'ok' | 'fail', error?: string): Promise<void> {
    await this.impl.finalize?.(status, error);
    // 我们的流应该不需要显示关闭和释放锁
    // if (this.writer) {
    //   await this.writer.close();
    //   this.writer.releaseLock();
    //   this.writer = undefined;
    // }
  }
}

// 基于指定EditorView，创建一个可写流，写入的内容会追加到末尾
export function editorWriter(view: EditorView): EditorSectionWriter {
  const write = (chunk: string) => {
    // Logger.debug('editorWriter', 'Writing chunk to editor:', chunk);
    const end = view.state.doc.length;
    view.dispatch({ changes: { from: end, insert: chunk } });
  };

  return new EditorSectionWriter({
    write,
    async finalize(status: 'ok' | 'fail', error?: string): Promise<void> {
      if (status === 'fail') {
        const finalMsg = `\n**Error:** ${error}\n`;
        write(finalMsg);
      }
      return Promise.resolve();
    },
  });
}

// 基于指定EditorView，在文档末尾创建两个可写流，第一个在前，第二个在后。
// 第一个用于 progress 输出，默认会替换该位置的上一个进度文本。
//   注：debug 模式下会改为追加模式，便于观察历史进度。
// 第二个用于 追加真正的输出文本，这个文本会不断追加到文档末尾。
// 注: 两个 writer 可以交错调用，但不能同时并发调用。(renderer本身是单线程的因此没啥问题)
function editorWriterWithProgress(view: EditorView, debug: boolean): 
  { progress: EditorSectionWriter, output: EditorSectionWriter } 
{
  // 准备两个 块区域，分别用于 progress 文本 和 output 文本 的写入。

  // # Progress 区域
  const PROGRESS_HEADER = '# Progress\n';
  const progressSectionStart = view.state.doc.length;  // 区块标题开始位置
  view.dispatch({ changes: { from: progressSectionStart, to: progressSectionStart, insert: PROGRESS_HEADER } });
  const progressTextStart = progressSectionStart + PROGRESS_HEADER.length; // 区块文本开始位置
  let progressTextEnd = progressTextStart;      // 记录变化区块文本结束位置

  // # Output 区域
  const OUTPUT_HEADER = '\n# Output\n'; // 前面加个换行以始终和 progress 区域有个空行分隔
  view.dispatch({ changes: { from: view.state.doc.length, insert: OUTPUT_HEADER } });

  /// 创建两个区块的 Writer

  const startTime = Date.now();
  const progressWriter = new EditorSectionWriter({
    write(chunk) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fullChunk = `+${elapsed}s ${chunk}`;

      // Logger.debug('editorWriter', 'Writing chunk to editor (progress):', fullChunk);

      if (debug) { // Debug 实现：每次都是追加到 progress 文本末尾
        view.dispatch({ changes: { from: progressTextEnd, to: progressTextEnd, insert: fullChunk } });
        progressTextEnd += fullChunk.length;
      } else {     // Production 实现：每次都是替换上一次的 progress 文本
        view.dispatch({ changes: { from: progressTextStart, to: progressTextEnd, insert: fullChunk } });
        progressTextEnd = progressTextStart + fullChunk.length;
      }
    },
    async finalize(status: 'ok' | 'fail', error?: string): Promise<void> {
      if (status === 'fail') {
        const finalMsg = `\n**Error:** ${error}\n`;
        view.dispatch({ changes: { from: progressTextEnd, to: progressTextEnd, insert: finalMsg } });
        progressTextEnd += finalMsg.length;
      } else {
        // 成功时，如果不是 debug 模式，则清除 整个 progress 区域(连同标题一起)
        if (!debug) {
          view.dispatch({ changes: { from: progressSectionStart, to: progressTextEnd, insert: '' } });
          progressTextEnd = progressSectionStart;
        }
      }
      return Promise.resolve();
    },
  });

  const outputWriter = new EditorSectionWriter({
    write(chunk) {
      // Logger.debug('editorWriter', 'Writing chunk to editor (output):', chunk);
      // 每次都是追加到文档末尾
      const end = view.state.doc.length;
      view.dispatch({ changes: { from: end, insert: chunk } });
    },
    async finalize(status: 'ok' | 'fail', error?: string): Promise<void> {
      if (status === 'fail') {
        const finalMsg = `\n**Error:** ${error}\n`;
        const end = view.state.doc.length;
        view.dispatch({ changes: { from: end, insert: finalMsg } });
      } else {
        // 成功时，如果不是 debug 模式，删除整个 output 标题行
        // 从 progressTextEnd 之后开始，防止误删 progress 区域的内容，性能也更好
        if (!debug) {
          const outputText = view.state.doc.sliceString(progressTextEnd);
          const index = outputText.indexOf(OUTPUT_HEADER); // 理论上来讲，应该返回0才对
          if (index !== -1) {
            const from = progressTextEnd + index;
            const to = from + OUTPUT_HEADER.length;
            view.dispatch({ changes: { from, to, insert: '' } });
          }
        }
      }
      return Promise.resolve();
    },
  });

  return { progress: progressWriter, output: outputWriter };
}

// 创建三个可写流，分别用于 progress, output, log 写入:
//   基于指定EditorView，在文档末尾创建两个可写流，分别用于 progress, output。
//   除此之外，会新开一个 Tab 来显示 log 内容。
async function editorWriterWithProgressAndLog(view: EditorView, debug: boolean)
: Promise<{ 
    progress: EditorSectionWriter; 
    output: EditorSectionWriter; 
    log: EditorSectionWriter;
  }>
{
  const { progress, output } = editorWriterWithProgress(view, debug);
  const log = await prepareNewTabAsWriter('agent-run-log.md', '# Agent Run Log\n');
  return { progress, output, log };
}

// 准备一个新的编辑器Tab，用于显示指定内容，并返回该Tab对应的 Writer
// title: Tab标题
// initialContent: 初始内容
// 返回: 可写流 Writer
// 注: 缺省并不会切换到该Tab，如有需要请自行切换。
export async function prepareNewTabAsWriter(title?: string, initialContent?: string)
  : Promise<EditorSectionWriter> 
{
  const promise = new Promise<EditorSectionWriter>((resolve, reject) => {
    // 先准备好在(下一个即将打开的)新的编辑器Tab中显示内容
    theAppEventBus.once('editor:created', ({ docId, tabId }) => {
      const view = theDocManager.getEditorView(tabId);
      if (!view) {
        const errorMsg = `Failed to find editor view for tabId: ${tabId}`;
        Logger.error('dump', errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      if (initialContent)
        DocAppender.append(view, initialContent);

      const dispatch = getAppDispatch();
      dispatch(tabActions.markTabDirty({ tabId, dirty: false }));

      const writer = editorWriter(view);
      resolve(writer);
    });
  });

  // 打开一个新的编辑器Tab来显示指定内容
  dispatchCommand('tab/new', { title, switchTo: false, switchFocus: false, ignoreDirty: true });
  return promise;
}

// 组合多个 EditorSectionWriter，返回一个新的 EditorSectionWriter
// 写入的内容会被分发到所有子 Writer 中
export function combineWriters(...writers: EditorSectionWriter[]): EditorSectionWriter {
  if (writers.length === 0)
    throw new Error('combineWriters requires at least one writer.');
  // 优化：只有一个 writer 时，直接返回该 writer
  if (writers.length === 1)
    return writers[0];

  return new EditorSectionWriter({
    write(chunk: string) {
      for (const writer of writers)
        writer.write(chunk);
    },
    async finalize(status: 'ok' | 'fail', error?: string): Promise<void> {
      for (const writer of writers)
        await writer.finalize(status, error);
    }
  });
}

// 提供一些便捷的方法，向文档末尾追加内容
export const DocAppender = {
  // 替换文本, 可选：是否将光标移动到新文本的末尾，或滚动到新文本的末尾
  replace(view: EditorView, from: number, to: number, text: string, moveCursorToEnd: boolean = false, scrollToEnd: boolean = false) {
    const end = from + text.length;

    if (moveCursorToEnd) {
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: end },
      });
    } else {
      view.dispatch({
        changes: { from, to, insert: text },
      });
    }

    if (scrollToEnd)
      this.scrollToVisible(view, end);
  },
  
  // 追加文本到文档末尾
  append(view: EditorView, text: string, moveCursorToEnd: boolean = false, scrollToEnd: boolean = false) {
    return this.replace(view, view.state.doc.length, view.state.doc.length, text, moveCursorToEnd, scrollToEnd);
  },

  // 插入文本到指定位置
  insert(view: EditorView, text: string, pos: number, moveCursorToEnd: boolean = false, scrollToEnd: boolean = false) {
    return this.replace(view, pos, pos, text);
  },

  // 返回一个可写流 (output)，写入的内容会追加到文档末尾
  writer(view: EditorView): 
    EditorSectionWriter 
  {
    return editorWriter(view);
  },

  // 返回两个可写流，第一个用于 progress 输出，第二个用于真正的输出文本
  async writer2(view: EditorView, debug: boolean = false): Promise<{ 
    progress: EditorSectionWriter; 
    output: EditorSectionWriter; 
  }> {
    return editorWriterWithProgress(view, debug);
  },

  // 返回三个可写流，分别用于 progress, output, log 写入
  async writer3(view: EditorView, debug: boolean = false): Promise<{ 
    progress: EditorSectionWriter; 
    output: EditorSectionWriter; 
    log: EditorSectionWriter;
  }> {
    return await editorWriterWithProgressAndLog(view, debug);
  },

  // 开始一个 ChatSection 段落。
  // Chat Section 段落 的首行为 headerQ 或 headerA。
  // Chat Section 段落前的空白处理规则：
  // 1. 如果前面没有非空文字，删除前面最多3行的空白字符。
  // 2. 如果前面有非空文字，保证前面有一个空行。
  beginChatSection(view: EditorView, type: 'question' | 'answer', moveCursorToEnd: boolean = false, scrollToEnd: boolean = false) {
    const textTo = findTrailingTextTo(view.state, 3);
    this.replace(view, textTo, view.state.doc.length, '\n\n', false, false);
    this.append(view, type === 'question' ? headerQ : headerA, moveCursorToEnd, scrollToEnd);
  },
  // 结束一个 ChatSection 段落，保证后面至少有一个空行
  endChatSection(view: EditorView, moveCursorToEnd: boolean = false, scrollToEnd: boolean = false) {
    const textTo = findTrailingTextTo(view.state, 3);
    this.replace(view, textTo, view.state.doc.length, '\n\n', moveCursorToEnd, scrollToEnd);
  },

  // 添加一个完整的带内容的 ChatSection 段落
  appendChatSection(view: EditorView, type: 'question' | 'answer', content: string, moveCursorToEnd: boolean = false, scrollToEnd: boolean = false) {
    this.beginChatSection(view, type, false, false);
    this.append(view, content, false, false);
    this.endChatSection(view, moveCursorToEnd, scrollToEnd);
  },

  // 设置选区（但不自动滚动ViewPort）
  setSelection(view: EditorView, anchor: number, head?: number, scrollIntoView: boolean = false) {
    view.dispatch({ selection: { anchor, head: head ?? anchor } });
    if (scrollIntoView) { this.scrollToVisible(view, anchor, head); }
  },

  // 开始自动滚动模式，但会保证当前选区是可见的
  autoScroll(tabId: string, enable: boolean) {
    dispatchAppCommand('tab/scroll/auto', { tabId, autoScroll: enable});
  },

  // 尽量最少滚动量，确保保证指定范围可见, 如果范围太大，则优先保证 指定边界 (top或bottom) 可见
  scrollToVisible(view: EditorView, from: number, to?: number, preferTop: boolean = true) {
    to = to ?? from; // 默认 to = from
    // Logger.debug('scrollToVisible', `Scrolling to make range [${from}, ${to}) visible.`);
    // const lineFrom = view.state.doc.lineAt(from);
    // const lineTo = view.state.doc.lineAt(to);
    // Logger.debug('scrollToVisible', `  from line ${lineFrom.number} to line ${lineTo.number}.`);

    const scrollDOM = view.scrollDOM;
    const clientHeight = scrollDOM.clientHeight;

    const expectedTop = view.lineBlockAt(from).top;
    const expectedBottom = view.lineBlockAt(to).bottom;
    const rangeHeight = expectedBottom - expectedTop;

    // 如果整个区间已经完全可见，直接返回
    if (expectedTop >= scrollDOM.scrollTop && expectedBottom <= scrollDOM.scrollTop + clientHeight)
      return;

    let newScrollTop;

    // 区间比视口小：可以完整显示，此时选择滚动量最小的方案
    if (rangeHeight <= clientHeight) {
      if (expectedTop < scrollDOM.scrollTop)  // 上方溢出：把 from 行置顶
        newScrollTop = expectedTop;
      else                                    // 下方溢出：把 to 行置底
        newScrollTop = expectedBottom - clientHeight;
    // 区间比视口大：无法完整显示，优先保证指定边界可见
    } else {
      if (preferTop)
        newScrollTop = expectedTop;
      else
        newScrollTop = expectedBottom - clientHeight;
    }

    // 限制 scrollTop 不超出范围
    if (newScrollTop < 0)
      newScrollTop = 0;

    if (scrollDOM.scrollTop !== newScrollTop)
      scrollDOM.scrollTo({ top: newScrollTop, behavior: "smooth" });
  }
};

// 从文末向上最多统计 upto 行，
// 找到最后一个非空字符之后的位置；
// 若未找到，则返回这些行的起始位置。
export function findTrailingTextTo(state: EditorState, uptoLines: number): number {
  const doc = state.doc;
  const total = doc.lines;
  if (total === 0) return 0;
  const startLine = Math.max(1, total - uptoLines + 1);

  // 从最后一行往上扫描
  for (let i = total; i >= startLine; i--) {
    const line = doc.line(i);
    const text = line.text;
    if (text.trim() === '') continue;         // 整行空白，继续往上
    return line.from + text.trimEnd().length; // 返回该行最后一个非空字符的下一个位置
  }

  // 全部为空，返回倒数 upto 行的起始位置
  return doc.line(startLine).from;
}
