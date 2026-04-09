import { Logger } from "@lib/logast.js";
import { View, ViewManager, ViewTypeMap } from "./ViewManager.js";

// 管理焦点视图
export class FocusManager {
  // 获得焦点的视图ID，按顺序排列，最后一个是当前焦点，可能包含重复。
  private focusStack: string[] = [];

  constructor(private viewManager: ViewManager) {}

  // 某个视图获得焦点后主动汇报
  onFocused(type: string, id: string) {
    const key = type + '.' + id;
    if (!this.viewManager.getView(type as keyof ViewTypeMap, id)) {
      Logger.warn('FocusManager', `onFocused: View not found: ${key}`);
      return;
    }
    if (this.focusStack.length === 0 || this.focusStack[this.focusStack.length - 1] !== key) {
      this.focusStack.push(key);
    }
  }

  // 主动设置某个视图为焦点
  setFocus(type: string, id: string): boolean {
    const view = this.viewManager.getView(type as keyof ViewTypeMap, id);
    // 如果View不存在(可能是正在被创建)，注册一个等待回调，当视图创建后再设置焦点
    if (!view) {
      this.viewManager.requestViewCreatedCallbackOnce((_type, _id) => {
        if (_type === type && _id === id) { // 确认是我们等待的视图
          Logger.debug('FocusManager', `setFocus: Pending focus request fulfilled for view: ${type}.${id}`);
          this.setFocus(type, id);
        }
      });
      return false;
    }
    return FocusManager.setFocusToView(view!);
  }

  // 恢复焦点到当前焦点视图(其实是最后一个获得过焦点的视图)
  // 一般用于某些命令执行时抢夺了焦点，完成后需要重新聚焦回去
  restoreFocus(): boolean {
    let view: View | undefined = this.getCurrentFocusedView();

    // 如果还没有焦点视图，按照预定策略选择一个

    // 优先选择最后一个有过焦点的编辑器视图
    if (!view) {
      const viewId = this.getLastFocusedViewId('EditorView');
      if (viewId)
        view = this.viewManager.getView('EditorView', viewId);
    }

    // 其次选择最后一个有过焦点的树视图
    if (!view) {
      const viewId = this.getLastFocusedViewId('TreeView');
      if (viewId)
        view = this.viewManager.getView('TreeView', viewId);
    }

    // 最后选择第一个编辑器视图或树视图
    if (!view) {
      const allEditorViews = this.viewManager.getAllViews('EditorView');
      if (allEditorViews.length > 0)
        view = allEditorViews[0];
      const allTreeViews = this.viewManager.getAllViews('TreeView');
      if (allTreeViews.length > 0)
        view = allTreeViews[0];
    }

    return view ? FocusManager.setFocusToView(view) : false;
  }

  static setFocusToView(view: View): boolean {
    if (!view) {
      Logger.warn('FocusManager', 'setFocusToView: No view to focus');
      return false;
    }
    if (!view.methods.focus) {
      Logger.warn('FocusManager', `setFocusToView: View has no focus method: ${view.type}.${view.id}`);
      return false;
    }
    // 调用 View的 focus 方法设置焦点，无需要 调用 onFocused，视图随后会自动汇报
    view.methods.focus();
    return true;
  }

  // 移除焦点栈中已被销毁的视图
  _removeInvalidViews() {
    this.focusStack = this.focusStack.filter(key => {
      const [type, id] = key.split('.');
      const view = this.viewManager.getView(type as keyof ViewTypeMap, id);
      return !!view;
    });
  }

  // 获取当前焦点视图
  getCurrentFocusedView(): View | undefined {
    this._removeInvalidViews();
    if (this.focusStack.length === 0)
      return undefined;

    const key = this.focusStack[this.focusStack.length - 1];
    const [type, id] = key.split('.');
    const view = this.viewManager.getView(type as keyof ViewTypeMap, id);
    return view;
  }

  // 获取最后一个获得焦点的指定类型视图ID，可选排除某些ID
  getLastFocusedViewId(type: string, excludes?: string[]): string | undefined {
    this._removeInvalidViews();
    if (this.focusStack.length === 0)
      return undefined;

    const typedFocusStack = this.focusStack.filter(key => key.startsWith(type + '.'));  
    while (typedFocusStack.length > 0) {
      const key = typedFocusStack.pop()!;
      const [_, id] = key.split('.');

      if (excludes && excludes.includes(id)) {
        continue;
      }

      return id;
    }
    return undefined;
  }

  // 调试用
  _getFocusStack(): string[] {
    return this.focusStack;
  }
}
