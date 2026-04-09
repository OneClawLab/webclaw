
// ai 相关的 client/server之间的流式输出的 event 格式定义，底层为http response 流上的JSONL格式。

declare type StreamEventSchema =
  // 输出类事件，表示模型输出的内容, 包括中间思考和最终输出
  // 中间思考将来是用户可见的，但可能一开始折叠起来
  // 最终输出是用户直接看到的内容
  { type: 'output'; event: 'thinking' | 'final'; data: { delta: string } } |
  // 进度类事件，表示当前处理到了哪个步骤
  // 这类事件用于前端展示进度，输出结束后会自动消失
  // message 建议简单清晰，方便用户了解当前进度
  { type: 'progress'; event: string; data: { message: string } } |
  // 错误类事件，表示处理过程中出现的错误
  // 这类事件用于前端展示错误信息，通常会终止整个流程
  // 错误信息一般会酌情显示给用户，以便用户知道发生了什么问题
  // message 应该简单清晰描述错误原因
  { type: 'error'; event: string; data: { message: string } } | 
  // 详细的日志类事件，表示一些调试信息
  // 比上述两类事件更为详细，一般只在调试模式下输出
  // 这类事件用于开发者调试问题，通常不会显示给最终用户
  // event 将被用做section的title，message 应该详细完整，格式美观，方便排查问题
  { type: 'log'; event: string; data: { message: string } };

declare type AiStatus = 'unconfigured' | 'ready' | 'error' // AI服务的状态
