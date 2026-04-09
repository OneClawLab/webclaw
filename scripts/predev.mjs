// npm run dev 前会自动执行的脚本
// npm 命名约定: preXXX 脚本会在 XXX 脚本前执行

import { execSync } from "node:child_process";

// --- Windows specific settings ---
if (process.platform === "win32") {
  try {
    // 让 console 出输出的中文不乱码
    execSync("chcp 65001", { stdio: "inherit" });
  } catch (err) {
    console.error(err);
  }
}
