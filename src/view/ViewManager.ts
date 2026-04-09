import { Logger } from "@lib/logast.js";

interface TreeViewMethods {
  focus?: () => void;
  makeNodeVisible?: (nodeId: string) => void;
  // collapseAll?: () => void;
}

interface EditorViewMethods {
  focus?: () => void;
  // save?: () => void;
  // undo?: () => void;
  // redo?: () => void;
}

// 不同类型的 View 支持的方法集合
export interface ViewTypeMap {
  TreeView: TreeViewMethods;
  EditorView: EditorViewMethods;
}

// 一个视图
export type View<T extends keyof ViewTypeMap = keyof ViewTypeMap> = {
  type: T;
  id: string;
  methods: ViewTypeMap[T];
};

export type ViewCreatedCallback = (type: string, id: string) => void;

// 视图管理器
export class ViewManager {
  // Key = type + '.' + id, Value = View。
  // id必须在type范围内唯一，由调用者解释其实际含义。
  private views: Map<string, View> = new Map();

  // 等待视图创建完成的一次性回调
  private viewCreatedCallback: ViewCreatedCallback | null = null;

  requestViewCreatedCallbackOnce(callback: ViewCreatedCallback) {
    this.viewCreatedCallback = callback;
  }

  // 视图被创建后注册
  onCreated<T extends keyof ViewTypeMap>(type: T, id: string, methods: ViewTypeMap[T]) {
    const key = type + '.' + id;
    Logger.debug('ViewManager', `onCreated: View created: ${key}`);
    if (this.views.has(key)) {
      Logger.warn('ViewManager', `onCreated: View already exists: ${key}`);
      return;
    }
    this.views.set(key, { type, id, methods });

    // 如果有等待的事件回调，调用它
    if (this.viewCreatedCallback) {
      this.viewCreatedCallback(type, id);
      this.viewCreatedCallback = null;
    }
  }

  // 视图被销毁前注销
  onDestroyed(type: string, id: string) {
    const key = type + '.' + id;
    Logger.debug('ViewManager', `onDestroyed: View destroyed: ${key}`);
    if (!this.views.has(key)) {
      Logger.warn('ViewManager', `onDestroyed: View not found: ${key}`);
      return;
    }
    this.views.delete(key);
  }

  // 获取某个类型的指定ID的视图
  getView<T extends keyof ViewTypeMap>(type: T, id: string): View<T> | undefined {
    const key = String(type) + '.' + id; // Explicitly convert `type` to a string
    return this.views.get(key) as View<T> | undefined;
  }

  // 调用某个视图的方法
  callMethod<T extends keyof ViewTypeMap, K extends keyof ViewTypeMap[T]>(
    type: T,
    id: string,
    method: K,
    ...args: ViewTypeMap[T][K] extends (...args: any) => any ? Parameters<ViewTypeMap[T][K]> : never
  ): ViewTypeMap[T][K] extends (...args: any) => any ? ReturnType<ViewTypeMap[T][K]> : undefined {
    const view = this.getView(type, id);
    if (!view) {
      Logger.warn('ViewManager', `callMethod: View not found: ${String(type)}.${id}`); // Convert `type` to string
      return undefined as any;
    }
    const fn = view.methods[method];
    if (typeof fn === "function") {
      return fn(...args) as any;
    }
    Logger.warn('ViewManager', `callMethod: Method not found: ${String(method)}`); // Convert `method` to string
    return undefined as any;
  }

  // 获取全部视图，可指定特定类型
  getAllViews<T extends keyof ViewTypeMap>(type: T): View<T>[]
  getAllViews(): View[]
  getAllViews(type?: keyof ViewTypeMap): View[] {
    const result: View[] = [];
    for (const view of this.views.values()) {
      if (!type || view.type === type)
        result.push(view);
    }
    return result;
  }
}

