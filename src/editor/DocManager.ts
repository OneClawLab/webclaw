import { Logger } from "@lib/logast.js"
import { EditorState, Transaction } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { DocId } from "@state/slices/doc/types.js"

// 管理打开的文档对应的 CodeMirror EditorViews
// docId 为全局文档ID， 详见 state/slices/doc/types.ts
class DocManager {
  // docId -> viewId(tabId) -> EditorView
  private views = new Map<DocId, Map<string, EditorView>>()

  // 当ChatEditor创建时调用
  onCreated(docId: DocId, viewId: string, view: EditorView) {
    if (!this.views.has(docId))
      this.views.set(docId, new Map())
    this.views.get(docId)!.set(viewId, view)
  }

  // 当ChatEditor销毁时调用
  onDestroyed(docId: DocId, viewId: string, view: EditorView) {
    this.views.get(docId)?.delete(viewId)
    if (this.views.get(docId)?.size === 0)
      this.views.delete(docId)
  }

  // 获取某个文档的所有views
  getEditorViews(docId: DocId): EditorView[] {
    return Array.from(this.views.get(docId)?.values() ?? [])
  }

  // 获取某个文档的某个view的EditorView
  getEditorView(viewId: string): EditorView | null {
    for (const views of this.views.values()) {
      if (views.has(viewId))
        return views.get(viewId)!;
    }
    return null;
  }

  // 通过 EditorView 获取其 viewId
  getViewId(view: EditorView): string | null {
    for (const [docId, views] of this.views.entries()) {
      for (const [viewId, v] of views.entries()) {
        if (v === view)
          return viewId;
      }
    }
    return null;
  }

  // 通过 viewId 获取其对应的 docId
  getDocId(viewIdOrView: string | EditorView): DocId | null {
    const viewId = typeof viewIdOrView === 'string' ? viewIdOrView : this.getViewId(viewIdOrView);
    if (!viewId) return null;
    for (const [docId, views] of this.views.entries()) {
      if (views.has(viewId))
        return docId;
    }
    return null;
  }

  // 获取某个文档的所有EditorStates
  getEditorStates(docId: DocId): EditorState[] {
    const views = this.views.get(docId);
    if (!views)
      return [];
    return Array.from(views.values()).map(view => view.state);
  }

  // 获取某个文档的某个view的EditorState
  getEditorState(viewId: string): EditorState | null {
    const view = this.getEditorView(viewId);
    if (!view)
      return null;
    return view.state;
  }

  // 当切换Library时，清除所有views
  clearViews() {
    this.views.clear();
  }

  // 当sourceView处理完事务更新时调用，以便将更新同步到别的同一 docId 的 EditorViews。
  onTransactionsApplied(docId: DocId, sourceView: EditorView, trs: readonly Transaction[]) {
    for (const view of this.views.get(docId)?.values() ?? []) {
      if (view === sourceView) continue;

      // 调整该view的最终的selection, 保持语义不变
      let selection = view.state.selection;
      trs.forEach(tr => { 
        try {
          selection = selection.map(tr.changes);
          const newTrSpec = { changes: tr.changes, effects: tr.effects, selection };
          const newTr = view.state.update(newTrSpec);
          view.update([newTr]);
        } catch (err) {
          // 可能在文档被Reload后，文档内容已经不匹配，导致映射失败
          Logger.warn('DocManager', `Failed to map selection for docId: ${docId}`, err);
        }
      });
    }
  }

  // 当某个文档的 docId 变更时调用，以便更新管理的 views
  updateDocId(oldDocId: DocId, newDocId: DocId) {
    const views = this.views.get(oldDocId);
    if (views) {
      this.views.set(newDocId, views);
      this.views.delete(oldDocId);
    }
  }
}

export const theDocManager = new DocManager();
