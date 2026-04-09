import { path } from "@lib/path.js";
import fs from 'fs'
import crypto from "crypto";

// 生成指定文件的签名字符串，用于检测文件内容是否变化。
export function snapshotFileSignature(filePath: string): string {
  const stat = fs.statSync(filePath);
  return `${stat.size}-${stat.mtimeMs}-${stat.ctimeMs}`;
}

// 生成指定目录的签名字符串，用于检测目录内容是否变化: 子目录/子文件/文件内容的各种变化。
export function snapshotDirSignature(dirPath: string): string {
  const hash = crypto.createHash("sha1");

  function walk(p: string) {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(p, e.name);
      const stat = fs.statSync(full);

      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile()) {
        // 文件路径 + 大小 + 修改时间
        hash.update(full);
        hash.update(String(stat.size));
        hash.update(String(stat.mtimeMs));
      }
    }
  }

  walk(dirPath);
  return hash.digest("hex");
}
