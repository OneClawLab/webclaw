/// 知识库相关的类型定义

// 知识库的元数据
export interface LibMeta {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

// 单个知识库的状态结构
export interface Library {
  libPath?: string            // 知识库的路径, POSIX格式
  status: 'empty' | 'loading' | 'ready' | 'saving' | 'closing'
  meta?: LibMeta              // 当前打开的知识库的元数据
  _error?: string             // 最近一次操作的错误信息
  _dirty?: boolean            // Library的Dirty指其内容变化未保存到磁盘
}

// 所有(属于当前workspace的)知识库的集合
export interface Libs {
  [key: string]: Library
}

// libSlice 的 state 结构
export interface LibState {
  libs: Libs
}

export const initialState: LibState = {
  libs: {},
}
