// 简易 Markdown 解析器
// 目前只能处理章节结构
// 会忽略第一个章节之前的内容

export interface MarkdownSection {
  level: number;
  title: string;
  content: string[];
  children: MarkdownSection[];
}

export function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split(/\r?\n/);
  const root: MarkdownSection = { level: 0, title: 'ROOT', content: [], children: [] };
  const stack: MarkdownSection[] = [root];
  let inCodeBlock = false;
  let codeBlockMarker = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 检查是否是 fenced code block 的开始或结束
    const fenceMatch = /^(`{3,})/.exec(trimmedLine);
    if (fenceMatch) {
      if (!inCodeBlock) { // 开始 code block
        inCodeBlock = true;
        codeBlockMarker = fenceMatch[1];
        const current = stack[stack.length - 1];
        current.content.push(line);
      } else if (fenceMatch[1].length >= codeBlockMarker.length && 
                 fenceMatch[1].startsWith(codeBlockMarker.charAt(0).repeat(codeBlockMarker.length))) {
        // 结束 code block - 检查标记长度
        inCodeBlock = false;
        codeBlockMarker = '';
        const current = stack[stack.length - 1];
        current.content.push(line);
      } else { // 长度不足的围栏标记，当作代码内容处理
        const current = stack[stack.length - 1];
        current.content.push(line);
      }
    } else if (inCodeBlock) {
      // 在 code block 内部，直接添加到内容中，不解析标题
      const current = stack[stack.length - 1];
      current.content.push(line);
    } else {
      // 不在 code block 内，正常解析
      const headingMatch = /^(#+)\s*(.*)$/.exec(trimmedLine);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        const section: MarkdownSection = { level, title, content: [], children: [] };

        // 找到最近的比自己层级小的父节点
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        const parent = stack[stack.length - 1];
        parent.children.push(section);
        stack.push(section);
      } else {
        // 普通内容归入当前章节
        const current = stack[stack.length - 1];
        if (line.trim() !== '' || current.content.length > 0) {
          current.content.push(line);
        }
      }
    }
  }

  return root.children;
}

type FrontMatter = Record<string, string>

// 解析 Markdown 文档中的 YAML Front Matter
export function parseYamlFrontMatter(markdown: string): {
  frontMatter: FrontMatter
  content: string
} {
  const lines = markdown.split(/\r?\n/)

  if (lines[0] !== '---') {
    return { frontMatter: {}, content: markdown }
  }

  const fm: FrontMatter = {}
  let i = 1

  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line === '---') break
    if (!line.trim()) continue

    const idx = line.indexOf(':')
    if (idx === -1) continue

    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    fm[key] = value
  }

  const content = lines.slice(i + 1).join('\n').trim()
  return { frontMatter: fm, content }
}
