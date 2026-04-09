// 一个知识库就是一个目录，类似于VSCode/Obsidian的工作区

// LibMeta: 知识库的元信息
export interface LibMeta {
  id: string;           // 全局唯一ID  
  name: string;         // 显示名称，TODO最好也是唯一的，因为需要用户 @引用时靠此名称指定知识库，如 @kb/知识库名称/...
  description?: string; // 描述
  createdAt: number;    // 创建时间戳
  updatedAt: number;    // 更新时间戳
}

// LibModel: 一个完整的知识库 由两部分组成： 元信息 + 根路径
export interface LibModel {
  path: string;          // 知识库的根路径
  meta: LibMeta;         // 知识库的元信息，保存在根路径下的 .library.json 文件中
}
