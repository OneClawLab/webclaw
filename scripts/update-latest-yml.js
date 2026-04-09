// 构建过程的辅助脚本：
//   更新 latest.yml 文件中的 url 和 path 字段，添加指定前缀
//   这样上传到服务器后，自动更新链接就能正确指向新版本的位置

import fs from 'fs';

// 获取命令行参数
// process.argv[0] 是 node 路径
// process.argv[1] 是脚本路径
// process.argv[2] 是第一个自定义参数 (latest.yml)
// process.argv[3] 是第二个自定义参数 (prefix)
const [latestYmlPath, prefix] = process.argv.slice(2);

if (!latestYmlPath || !prefix) {
  console.error('用法: node update-latest.js <latest.yml路径> <前缀>');
  console.error('示例: node update-latest.js "./dist/latest.yml" "../../v1.0.13/win/"');
  process.exit(1);
}

try {
  // 检查文件是否存在
  if (!fs.existsSync(latestYmlPath)) {
    console.error(`错误: 文件未找到 -> ${latestYmlPath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(latestYmlPath, 'utf8');

  /**
   * 正则解析：
   * ^             : 行首
   * (.*?\b(?:url|path):\s+) : 第一组。匹配 key 之前的所有字符（空格、-等）以及 url: 或 path: 
   * ([^/].*)      : 第二组。匹配路径内容，且排除掉已经以 / 开头的情况
   */
  const regex = /^((?:.*?\b)(?:url|path):\s+)([^/].*)/gm;

  const updatedContent = content.replace(regex, (match, p1, p2) => {
    // 如果路径已经是完整地址 (http)，则不处理
    if (p2.startsWith('http'))
      return match;
    // 拼接前缀
    return `${p1}${prefix}${p2}`;
  });

  fs.writeFileSync(latestYmlPath, updatedContent, 'utf8');
  console.log(`✅ 成功更新: ${latestYmlPath}`);
  console.log(`🚀 已添加前缀: ${prefix}`);

} catch (err) {
  console.error('❌ 处理文件时出错:', err.message);
  process.exit(1);
}
