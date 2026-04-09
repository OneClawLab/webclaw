import { getGroupedSlashCommands, SlashCommand } from "@ai/common/SlashCommands.js";
import { Completion } from "@codemirror/autocomplete";

/**
 * 是否允许显示 Slash Command 的“详情信息（info）对话框”。
 *
 * CodeMirror 的 autocomplete 在某些主题/配置下：
 * - 当当前选中项存在 `info` 字段时，会自动弹出一个详情面板/对话框。
 * - 这会打断输入体验（过于繁琐），因此默认关闭。
 *
 * true  => 为 Completion 填充 info（可能触发自动弹出详情）
 * false => 不提供 info（不弹出详情，列表更简洁）
 */
const ALLOW_INFO_DIALOG = false;

/**
 * 生成 Slash Command 的自动完成列表（CodeMirror Completion[]）。
 */
export function getCompletions(): Completion[] {
  /**
   * 获取分组后的 slash commands：
   * 期望结构类似：[ { group: "xxx", commands: Map<string, SlashCommand> } , ... ]
   */
  const groups = getGroupedSlashCommands();
  if (!groups?.length) return [];

  /**
   * 将 SlashCommand 转换为 CodeMirror Completion 的工厂函数（支持闭包携带分组信息）。
   *
   * @param groupName - 分组名称，用于 Completion.section.name 展示
   * @param rank - 分组排序权重；数字越小越靠前（这里按 groups 原有顺序）
   * @returns (command) => Completion
   */
  const toCompletion =
    (groupName: string, rank: number) =>
    (command: SlashCommand): Completion => ({
      // label：用于匹配用户输入的字符串，也是候选项的主要标识符。
      label: command.id,
      // displayLabel：显示在候选菜单中的文本。
      displayLabel: `${command.id} ${command.title}`,
      // detail：候选项右侧或副标题区域的简要说明（取 description）。
      detail: command.description,
      // type： 候选类型，用于决定 UI 图标/样式（如 "keyword"、"function"、"command" 等）。
      type: "command",
      // info：更详细的文档说明。
      // 注意：一旦提供 info，CodeMirror 可能会在选中该项时自动打开详情面板。
      // 为了减少打扰，默认通过 ALLOW_INFO_DIALOG 控制是否提供。
      info: ALLOW_INFO_DIALOG ? command.documentation : undefined,
      // apply：用户选择该项后插入到编辑器中的文本。
      // 这里插入 `${command.id} ` 并额外加一个空格，方便用户继续输入别的东西。
      apply: `${command.id} `,
      // section：用于对候选项进行“分组展示”和“分组排序”。
      section: { name: groupName || "unknown", rank },
    });

  /**
   * 将分组结构拍平成 Completion[]：
   * - 使用 flatMap：每个 group 产出一个 Completion[]
   * - commands 是 Map：取 values() 转为数组后逐个映射为 Completion
   * - groupIndex 作为 rank，保持与 groups 中的顺序一致
   */
  return groups.flatMap(({ group, commands }, groupIndex) =>
    [...commands.values()].map(toCompletion(group, groupIndex)),
  );
}
