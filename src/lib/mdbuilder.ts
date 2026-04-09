// 简单的 markdown 文档生成器。

type Text = string;
type Node = Text | Heading | List | Table | FencedCode;

type Heading = {
  level: number;
  title: string;
  children: Node[];
};

type List = Node[];

type Table = {
  headers: string[];
  rows: string[][];
};

type FencedCode = {
  lang: string;
  code: string;
};

export type SaveFileAsync = (fullPath: string, content: string) => Promise<void>;

class Builder {
  private readonly path: string;
  private readonly root: Heading;
  private readonly node: Heading;
  private readonly saveFileAsync?: SaveFileAsync;

  // path & root: 文件路径 & 根节点
  // node: 当前节点，用于添加子节点
  // saveFileAsync: 可选的异步保存函数，如果提供了，则可以调用 save() 方法保存文件，否则只能调用 asString() 获取字符串内容
  constructor(path: string, root: Heading, node: Heading, saveFileAsync?: SaveFileAsync) {
    this.path = path;
    this.root = root;
    this.node = node;
    this.saveFileAsync = saveFileAsync;
  }

  heading(title: string): Builder {
    const node: Heading = { level: this.node.level + 1, title, children: [] };
    this.node.children.push(node);
    return new Builder(this.path, this.root, node, this.saveFileAsync);
  }

  text(text: string): Builder {
    this.node.children.push(text);
    return this;
  }

  list(items: string[]): Builder {
    const list: List = items;
    this.node.children.push(list);
    return this;
  }

  table(headers: string[], rows: string[][]): Builder {
    const table: Table = { headers, rows };
    this.node.children.push(table);
    return this;
  }

  code(data: any, lang = "json"): Builder {
    const code: FencedCode = { lang, code: JSON.stringify(data, null, 2) };
    this.node.children.push(code);
    return this;
  }

  // 输出 markdown 字符串
  private render(node: Node): string {
    if (typeof node === "string") {    // text
      return node + "\n";
    } else if ("title" in node) {      // heading 
      const level = node.level;
      let out = `${"#".repeat(level)} ${node.title}\n`;
      for (const child of node.children) {
        out += this.render(child);
      }
      return out;// + "\n";
    } else if (Array.isArray(node)) {  // list
      return node.map(item => `- ${item}`).join("\n");// + "\n";
    } else if ("headers" in node) {    // table
      const sep = node.headers.map(() => "---");
      let out = `| ${node.headers.join(" | ")} |\n`;
      out += `| ${sep.join(" | ")} |\n`;
      for (const row of node.rows) {
        out += `| ${row.join(" | ")} |\n`;
      }
      return out;// + "\n";
    } else if ("lang" in node) {        // fenced code
      return '```' + `${node.lang}\n${node.code}\n` + '```\n';
    }
    return "";
  }

  // 保存到文件，返回完整路径
  // 无论当前 Builder 是哪个对象，保存的都是整个根节点。
  // unescapeCrlfs: true 表示把内容中的 \r\n 转换成真实的回车换行
  async save(unescapeCrlfs: boolean = true): Promise<void> {
    if (!this.saveFileAsync)
      throw new Error("No saveFileAsync function provided.");
    const content = unescapeCrlfs
      ? this.asString().replace(/\\r|\\n/g, m => (m === '\\r' ? '\r' : '\n'))
      : this.asString();
    return this.saveFileAsync(this.path, content);
  }

  // 把当前文档以字符串返回
  asString() {
    const header =
      `---\ntitle: ${this.root.title}\ncreated: ${new Date().toLocaleString()}\n---\n\n`;

    let body = '';
    this.root.children.map(child => {
      body += this.render(child);
    });

    return (header + body).trim() + '\n';
  }
}

export { Builder as MarkdownBuilder };
