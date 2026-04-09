import { path } from "@lib/path.js";
import fs from "fs";

// 广度优先遍历指定目录，列出所有子目录和文件的相对路径。
// 返回的子目录 后面都有 / 结尾，文件没有。
export function walkDirBFS(root: string, type: 'file' | 'directory' | 'both' = 'both', recursive?: boolean): string[] {
  const queue: string[] = [root];
  const items: string[] = [];

  while (queue.length > 0) {
    const dir = queue.shift()!;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        items.push(relative + '/');
        queue.push(full);
      }
      else if (entry.isFile())
        items.push(relative);
    }

    // 非递归时，只处理一层目录
    if (!recursive) break;
  }

  // 根据类型过滤结果
  if (type === 'file')
    return items.filter(item => !item.endsWith('/'));
  else if (type === 'directory')
    return items.filter(item => item.endsWith('/'));
  else
    return items;
}
