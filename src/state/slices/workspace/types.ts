export interface WorkspaceState {
  id: string                  // 暂时不需要，当支持多个工作区时再用
  libPaths: string[]          // 属于当前工作区的库的根路径的列表
}

export const initialState: WorkspaceState = {
  id: 'default',
  libPaths: []
}
