// Eidux里能处理的文档有三类来源： 知识库内的文档、外部已有的文档、未保存的新建文档
export type DocOrigin = 'library' | 'external' | 'unsaved';

// 全局文档唯一ID，用于标识一个文档，详细格式见 DocUtils.docId()
export type DocId = string;

// 一个文档
export interface Doc {
  origin: DocOrigin // 文档来源，分为 知识库/外部文件/未保存的新建文档
  title: string     // 文档标题，目录名 或者 带后缀的文件名 或者 其他标题名称
  conversationId?: string  // 关联的 conversation ID（用于 AI 聊天）
  agentId?: string         // 关联的 agent ID
  agentLocked?: boolean    // agent 是否已锁定（有聊天历史后不可更改）
}

// 属于知识库内的文档
export interface LibraryDoc extends Doc {
  origin: 'library'
  libId: string     // 知识库的唯一ID
  docId: DocId      // 文档的唯一ID，即文档在知识库内的相对路径，根路径为 ''
  docPath: string   // 文档的实际文件路径，(包括Library目录文档)
}

// 不属于知识库的外部已有文档
export interface ExternalDoc extends Doc {
  origin: 'external'
  docPath: string   // 文档的实际文件路径，只能是文件路径，不能是目录路径
}

// 未保存的新建文档，是否属于知识库还未确定
// 第一次保存时将会转化为 LibraryDoc 或 ExternalDoc
export interface UnsavedDoc extends Doc {
  origin: 'unsaved'
  tmpId: string     // 临时文档ID
}

// 一个文档集合，key 为 文档唯一ID
export interface Docs {
  [key: string]: Doc;
}

// docSlice 的 state 结构
// docs 为当前所有已打开的文档集合
export interface DocState {
  docs: Docs;
}

export const initialState: DocState = {
  docs: {},
};
