import { autocompletion } from "@codemirror/autocomplete";
import { cmdCompletionSource } from "./commands/source.js";
import { refCompletionSource } from "./references/source.js";

// 这个是注册到 CodeMirror 中的扩展。
// autocompletion 的 override 最好放在一个地方集中注册，防止在交互上产生冲突。
export function autoCompletion() {
  return [
    autocompletion({
      override: [
        cmdCompletionSource,
        refCompletionSource,
      ],
      activateOnTyping: true,     // 打字时是否自动匹配并弹出菜单，而不是等待按什么特别的热键才尝试匹配和弹出。
      activateOnCompletion: () => true, // 选择之后是否再次弹出并试图继续匹配。
      activateOnTypingDelay: 300, // 连续打字时延迟一点再弹出(如果之前有新的输入则被打断)。
      interactionDelay: 100,      // 菜单弹出后的无响应间隔，避免误操作。
      selectOnOpen: true,         // 是否自动选中第一个命令
      maxRenderedOptions: 30,     // 最大列表长度。
      defaultKeymap: false,       // 此处禁用，因为我们要外部显式绑定按键，以便不和Editor的Tab/Enter冲突。
      icons: true,
      filterStrict: false,
      closeOnBlur: false,         // 编辑器失焦时是否自动关闭弹出的菜单。TODO 暂改成 false 方便调试。
    }),
  ];
}
