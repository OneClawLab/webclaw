import { Logger } from '@lib/logast.js'
import { k18, t, hkt } from '@lib/i18n.js';
import { defineCommand } from '@editor/commands/registry.js'
import { aiStatus, streamChat } from '@renderer/client/ai.js'
import { getAppDispatch, getState } from '@state/storeHolder.js'
import { combineWriters, DocAppender, EditorSectionWriter } from '@editor/DocAppender.js'
import { Command, EditorView } from '@codemirror/view'

import { tabActions } from '@state/slices/tab/slice.js'
import { ChatSectionUtils, headerQ } from '@editor/ChatSectionUtils.js'
import { isWhitespace } from '@lib/utils.js'
import { preparePrompt } from '@ai/common/Prompt.js'
import { toast } from '@lib/renderer/dialog.js'
import { theDocManager } from '@editor/DocManager.js'

////////////////////////////////////////////////////////////////////////////////
/// 用户按键盘 Mod+Enter 或 代码调 dispatchEditorCommand('editor/ai/ask') 最终都触发 handleCtrlEnter 函数
////////////////////////////////////////////////////////////////////////////////

// 一个 我们的 EditorCommand，主要用于绑定工具栏按钮
defineCommand<{void}>({
  id: 'editor/ai/ask',
  title: k18('ai.commands.askAi'),
  description: k18('ai.commands.askAiDesc'),
  icon: 'MessageCircleQuestionMark',
  shortcut: 'Mod+Enter', // 与 keymap 中的绑定保持一致

  run(view, args): boolean {
    handleAskAI(view);
    return true;
  },
  isActive: (state) => false,
  isEnabled: (state) => true,
});

// 一个 EditorView 的 Command，主要用于绑定到 EditorView 的 keymap 上。
// 当用户按了 Mod+Enter 时触发。
export const onAskAI: Command = (view: EditorView) => {
  handleAskAI(view);
  return true; // 告诉 CM 该命令已被处理，阻止触发默认行为(比如整出一个换行）
}

// 当用户按下 Mod+Enter时，具体行为依场景不同。
// 可能有：
// 1. 插入一个新的空Q段落。
// 2. 引用选中的文本并插入Q段落，等待用户补充输入。
// 3. 使用文末Q段落内容作为prompt向AI提问并流式获取回答写入一个A段落。
async function handleAskAI(view: EditorView) {
  // 取得文档中最后一个问答段落的情况
  const lastChatSection = ChatSectionUtils.getLastChatSection(view.state);

  // 取得当前选区范围
  const selectionFrom = Math.min(view.state.selection.main.head, view.state.selection.main.anchor);
  const selectionTo = Math.max(view.state.selection.main.head, view.state.selection.main.anchor);

  // 选区为空的情况
  if (selectionFrom === selectionTo) {
    // 如果 整个文档 还没有 chat section
    if (lastChatSection.type === 'invalid') {
      const textBefore = view.state.sliceDoc(0, selectionFrom);
      const textAfter = view.state.sliceDoc(selectionFrom);

      // 如果光标在 所有非空白文本 之前，则在文档开头插入一个空的 question chat section
      if (isWhitespace(textBefore)) {
        DocAppender.insert(view, headerQ, 0); // 插入在文档最开头
        DocAppender.setSelection(view, headerQ.length, headerQ.length, true);  // 光标移动到新插入段落末尾
        if (textAfter > textBefore) // 文档不全是空白
          toast.show(t('ai.hints.toast.emptyDocBefore'), 'hint');
        else // 文档全是空白
          toast.show(t('ai.hints.toast.emptyDocAfter'), 'hint');
      // 如果光标在 所有非空白文本 之后，则在文档末尾插入一个空的 question chat section
      } else if (isWhitespace(textAfter)) {
        DocAppender.beginChatSection(view, 'question', true, true); // 光标移动到新插入段落末尾
        toast.show(t('ai.hints.toast.emptyDocAfter'), 'hint');
      // 否则，光标在某个非空白文本的中间，啥也别干，提示一下用户
      } else {
        toast.show(t('ai.hints.toast.emptyDocMiddle', { ModEnter: hkt('Mod+Enter') }), 'hint');
      }
    // 如果 最后一个 chat section 是 answner, 则在文档末尾插入一个新的 question chat section
    } else if (lastChatSection.type === 'answer') {
      DocAppender.beginChatSection(view, 'question', true, true); // 光标移动到新插入段落末尾
      toast.show(t('ai.hints.toast.emptyDocAfter'), 'hint');
    // 如果 最后一个 chat section 是 question, 则尝试 使用该 question 作为 prompt 向 AI 提问
    } else { // lastChatSection.type === 'question'
      if (lastChatSection.textFrom >= lastChatSection.textTo) {
        toast.show(t('ai.hints.toast.emptyDocAfter'), 'hint');
      } else {
        // 开始发起 向AI提问 的流程
        const prompt = view.state.sliceDoc(lastChatSection.textFrom, lastChatSection.textTo);
        const promptStart = lastChatSection.textFrom;
        await doAskAI(view, prompt, promptStart);
      }
    }
  // 选区不为空的情况
  } else {
    // 如果 文档末尾没有 question chat section, 则插入一个新的 question chat section
    if (lastChatSection.type !== 'question') {
      const prompt = '> ' + view.state.sliceDoc(selectionFrom, selectionTo);
      DocAppender.beginChatSection(view, 'question');
      // 把选区内容作为 prompt 插入到 文档末尾的 question chat section 之中, 并把光标移动到文末
      DocAppender.append(view, prompt, true, true);   // 光标移动到文档末尾
      toast.show(t('ai.hints.toast.alreadyQuoted'), 'hint');
    // 如果 文档末尾有 question chat section, 则把当前选区拷贝(引用)到 文档末尾
    } else { // lastChatSection.type === 'question'
      const prompt = '> ' + view.state.sliceDoc(selectionFrom, selectionTo);
      // 把选区内容作为 prompt 追加到 文档末尾的 question chat section 之中, 并把光标移动到文末
      DocAppender.append(view, '\n' + prompt, true, true); // 光标移动到文档末尾
      toast.show(t('ai.hints.toast.alreadyQuoted'), 'hint');
    }
    // 无论如何，选区内容都被引用到文档末尾的 question chat section 了，用户可以继续编辑补充内容
    // 如果用户想直接使用该 question chat section 向 AI 提问，可以再按一次 Mod+Enter
  }
};

// 使用 userPrompt 向 AI 提问，并把流式回答写入到 EditorView 中
async function doAskAI(view: EditorView, userPrompt: string, promptStart: number) : Promise<boolean> {
  const appState = getState();
  const dispatch = getAppDispatch();

  // 取得当前 EditorView 对应的 TabId(就是ViewId) 和 DocId
  const tabId = theDocManager.getViewId(view); if (!tabId) return false;
  const tab = appState.tab.tabs.find(t => t.id === tabId); if (!tab) return false;
  const docId = tab.docId;

  // 取得用户 ID 和会话 ID
  const userId = appState.user.userId;
  const conversationId = docId;

  // 把用户输入解析并预处理为 PreparedPrompt
  const prompt = await preparePrompt(userPrompt);

  // 取得要使用的 front agent 名称
  // 如果本次输入指定了 +raw 修饰命令，则强制使用 raw agent
  // 否则使用文档关联的 agentId
  const doc = appState.doc.docs[docId];
  const agentName = prompt.raw ? 'raw' : (doc?.agentId || 'admin');

  // 获取当前Tab链接的Tab对应的EditorView，用来转发AI输出成为对方的输入
  let linkedEditor: { tabId: string, view: EditorView } | null = null;
  {
    const linkedTabs = appState.tab.tabs.filter(
      tab => tab.meta?.linkTo?.peerViewId === tabId || tab.meta?.linkedBy?.peerViewId === tabId);
    if (linkedTabs.length > 0) {
      const linkedTab = linkedTabs[0]; // 目前我们只支持一个链接，所以最多只有一个
      const linkedEditorView = theDocManager.getEditorView(linkedTab.id);
      if (linkedEditorView)
        linkedEditor = { tabId: linkedTab.id, view: linkedEditorView };
    } 
  }

  // 把 Editor 设置成 autoScroll 以及 editing 模式
  {
    // 本Editor
    DocAppender.autoScroll(tabId, true);
    dispatch(tabActions.markTabEditing({ tabId, editing: true }));

    // 链接的Editor
    if (linkedEditor) {
      DocAppender.autoScroll(linkedEditor.tabId, true);
      dispatch(tabActions.markTabEditing({ tabId: linkedEditor.tabId, editing: true }));
    }
  }

  // 输出 chat section header
  {
    // 本Editor: 输出一个 `answner` chat section header
    DocAppender.beginChatSection(view, 'answer', false, false);
    // 链接的Editor: 输出一个 `question` chat section header
    if (linkedEditor)
      DocAppender.beginChatSection(linkedEditor.view, 'question', false, false);
  }

  // 设置光标位置和滚动位置
  {
    // 本Editor: 设置光标到 chat section header 的结束位置
    DocAppender.setSelection(view, view.state.doc.length, view.state.doc.length, false);
    // 本Editor: 滚动到让整个 prompt 和 answer 可见，如果不能完整显示，则优先保证尾部(answner 开头部分)可见。
    DocAppender.scrollToVisible(view, promptStart, view.state.doc.length, false);

    // 链接的Editor
    if (linkedEditor) {
      // 链接的Editor: 设置光标到 chat section header 的结束位置
      DocAppender.setSelection(linkedEditor.view, linkedEditor.view.state.doc.length, linkedEditor.view.state.doc.length, false);
      // 链接的Editor: 滚动到让整个 prompt 可见
      DocAppender.scrollToVisible(linkedEditor.view, linkedEditor.view.state.doc.length, linkedEditor.view.state.doc.length, false);
    }
  }

  // 准备 用于接收流式输出的 Writers。
  // debug 模式下:
  //   progress采用追加模式
  //   多一个 log writer 用于记录日志
  let writers;
  const progressMode = appState.settings.progressMode;
  if (progressMode === 'verbose')
    writers = await DocAppender.writer3(view, true);  // debug 模式
  else
    writers = await DocAppender.writer2(view, false); // normal 模式

  // 链接的Editor 的 writers, 只需要 output writer 即可
  let linkedWriter;
  if (linkedEditor)
    linkedWriter = DocAppender.writer(linkedEditor.view);

  // 组合多个 output writer 为一个
  writers.output = linkedWriter ? combineWriters(writers.output, linkedWriter) : writers.output;

  // 调用 streamChat 流式获取回答并写入编辑器
  try {
    if (!(await aiStatus())) {
      const outputWriter = writers.output as EditorSectionWriter;
      outputWriter.write(t('ai.hints.document.unconfigured', { link: '@kb/system/README.md' }));
    } else {
      await streamChat(userId, conversationId, agentName, prompt, writers);
    }
  } catch(error) {
    toast.show(`Error in AI chat: ${(error as Error).message}`, 'error');
  } finally { // 关闭收尾工作
    // 输出 chat section footer，关闭 autoScroll 以及 editing 状态
    DocAppender.endChatSection(view);
    DocAppender.autoScroll(tabId!, false);
    dispatch(tabActions.markTabEditing({ tabId: tabId!, editing: false }));

    // 链接的Editor
    if (linkedEditor) {
      DocAppender.endChatSection(linkedEditor.view);
      DocAppender.autoScroll(linkedEditor.tabId, false);
      dispatch(tabActions.markTabEditing({ tabId: linkedEditor.tabId, editing: false }));
    }

    // 本Editor: 非链接时，自动插入一个新的空的 question chat section，方便用户继续提问
    if (!linkedEditor)
      DocAppender.beginChatSection(view, 'question', false, false);
  }
  return true;
}

