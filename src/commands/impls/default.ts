import { k18 } from '@lib/i18n.js';
import { defineCommand, defineCommandGroup } from '@commands/registry.js'

defineCommandGroup({
  id: 'default',
  title: k18('commands.default.title'),
  commands: []
});

defineCommandGroup({
  id: 'runtime',
  title: k18('commands.runtime.title'),
  commands: []
});

// AppCommand 定义规范：
// - id: 唯一标识符，通常使用命名空间格式，如 'namespace/target/verb'
// - title: 显示名称,用于 UI 中展示
// - group: 可选，命令分组标识符，用于组织命令
// - run: 执行函数，接收参数 args
// - description: 可选，命令描述

//------------------------------------------------------------------

defineCommand({
  id: 'echo',
  group: 'default',
  title: k18('commands.default.commands.echo'),
  run(args: { msg: string }) {
    alert('Echo: ' + args.msg);
  },
});
