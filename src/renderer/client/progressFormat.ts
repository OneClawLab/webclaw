/**
 * Progress frame → Markdown 格式化
 * 供 streamChat 和 FrameRouter 共用
 */

import type { ProgressFrame } from '@lib/webui-protocol/index.js'

export const LINE_MAX = 120
export const MULTILINE_MAX_LINES = 5

export function truncateMd(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen) + `…(+${s.length - maxLen})`
}

export function renderValue(text: string): string {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
  if (lines.length <= 1) {
    const line = lines[0] ?? ''
    return '`' + truncateMd(line, LINE_MAX) + '`'
  }
  const shown = lines.slice(0, MULTILINE_MAX_LINES)
  const omitted = lines.length - MULTILINE_MAX_LINES
  const body = shown
    .map(l => l.length > LINE_MAX ? l.slice(0, LINE_MAX) + `…(+${l.length - LINE_MAX})` : l)
    .join('\n')
  return '````\n' + body + (omitted > 0 ? `\n…(+${omitted} lines)` : '') + '\n````'
}

export function renderToolCall(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    return `▶ \`${truncateMd(JSON.stringify(data), LINE_MAX)}\``
  }
  const d = data as Record<string, unknown>
  const name = typeof d['name'] === 'string' ? d['name'] : 'unknown'
  const args = (typeof d['arguments'] === 'object' && d['arguments'] !== null)
    ? d['arguments'] as Record<string, unknown>
    : {}

  switch (name) {
    case 'bash_exec': {
      const comment = typeof args['comment'] === 'string' ? args['comment'].trim() : ''
      const command = typeof args['command'] === 'string' ? args['command'].trim() : ''
      const cwd = typeof args['cwd'] === 'string' ? args['cwd'] : ''
      const parts: string[] = []
      if (cwd) parts.push(`\`${cwd}\``)
      if (command) parts.push(renderValue(command))
      const label = comment || 'bash_exec'
      return `▶ **${label}**${parts.length ? '  \n' + parts.join('  \n') : ''}`
    }
    case 'send_message': {
      const target = typeof args['target'] === 'string' ? args['target'] : ''
      const content = typeof args['content'] === 'string' ? args['content'].trim() : ''
      return `▶ **send_message** → \`${target}\`${content ? '  \n' + renderValue(content) : ''}`
    }
    case 'create_agent_task': {
      const subtasks = Array.isArray(args['subtasks']) ? args['subtasks'] as Array<Record<string, unknown>> : []
      const waitAll = args['wait_all'] === true
      const lines = [`▶ **create_agent_task** (${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}, wait_all=${waitAll})`]
      for (const st of subtasks) {
        const worker = typeof st['worker'] === 'string' ? st['worker'] : '?'
        const instr = typeof st['instruction'] === 'string' ? truncateMd(st['instruction'].trim(), LINE_MAX) : ''
        lines.push(`  - \`${worker}\`: ${instr}`)
      }
      return lines.join('  \n')
    }
    case 'cancel_agent_task': {
      const taskId = typeof args['task_id'] === 'string' ? args['task_id'] : '?'
      return `▶ **cancel_agent_task** \`${taskId}\``
    }
    case 'steer_agent_task': {
      const taskId = typeof args['task_id'] === 'string' ? args['task_id'] : '?'
      const worker = typeof args['worker'] === 'string' ? args['worker'] : '?'
      const newInstr = typeof args['new_instruction'] === 'string' ? args['new_instruction'].trim() : ''
      return `▶ **steer_agent_task** \`${taskId}\` → \`${worker}\`${newInstr ? '  \n' + renderValue(newInstr) : ''}`
    }
    case 'spawn_adhoc_task': {
      const instruction = typeof args['instruction'] === 'string' ? args['instruction'].trim() : ''
      return `▶ **spawn_adhoc_task**${instruction ? '  \n' + renderValue(instruction) : ''}`
    }
    default:
      return `▶ **${name}** \`${truncateMd(JSON.stringify(args), LINE_MAX)}\``
  }
}

export function renderToolResult(name: string, data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    return `✓ \`${truncateMd(JSON.stringify(data), LINE_MAX)}\``
  }
  const d = data as Record<string, unknown>

  switch (name) {
    case 'bash_exec': {
      const exitCode = d['exitCode'] !== undefined ? d['exitCode'] : d['exit_code']
      const stdout = typeof d['stdout'] === 'string' ? d['stdout'].trim() : ''
      const stderr = typeof d['stderr'] === 'string' ? d['stderr'].trim() : ''
      const errMsg = typeof d['error'] === 'string' ? d['error'] : ''
      const isSuccess = exitCode === 0 || exitCode === undefined
      const icon = isSuccess ? '✓' : '✗'
      const content = errMsg || [stdout, stderr].filter(Boolean).join('\n').trim()
      if (!content) return `${icon} *(no output)*`
      return `${icon} ${renderValue(content)}`
    }
    case 'send_message': {
      const status = typeof d['status'] === 'string' ? d['status'] : ''
      const target = typeof d['target'] === 'string' ? ` → \`${d['target']}\`` : ''
      const isOk = status === 'delivered' || status === 'ok'
      return `${isOk ? '✓' : '✗'} **${status}**${target}`
    }
    case 'create_agent_task': {
      const taskId = typeof d['task_id'] === 'string' ? d['task_id'] : '?'
      const status = typeof d['status'] === 'string' ? d['status'] : ''
      return `✓ task \`${taskId}\` (${status})`
    }
    case 'cancel_agent_task': {
      const cancelled = d['cancelled'] === true
      return `${cancelled ? '✓' : '✗'} task ${cancelled ? 'cancelled' : 'cancel failed'}`
    }
    case 'steer_agent_task': {
      const steered = d['steered'] === true
      const msg = typeof d['message'] === 'string' ? `: ${d['message']}` : ''
      return `${steered ? '✓' : '✗'} ${steered ? 'steered' : 'steer failed'}${msg}`
    }
    case 'spawn_adhoc_task': {
      const content = typeof d['result'] === 'string' ? d['result'].trim() : ''
      if (!content) return `✓ *(no output)*`
      return `✓ ${renderValue(content)}`
    }
    default: {
      const errMsg = typeof d['error'] === 'string' ? d['error'] : ''
      const isSuccess = !errMsg
      const content = errMsg || truncateMd(JSON.stringify(d), LINE_MAX)
      return `${isSuccess ? '✓' : '✗'} \`${content}\``
    }
  }
}

/**
 * 将 progress frame 格式化为 Markdown 字符串。
 * 返回 null 表示该帧不需要写入文档（由其他地方处理或忽略）。
 */
export function formatProgress(pf: ProgressFrame): string | null {
  switch (pf.kind) {
    case 'thinking':
      return null
    case 'tool_call': {
      try {
        return renderToolCall(JSON.parse(pf.text))
      } catch {
        return `▶ \`${truncateMd(pf.text, LINE_MAX)}\``
      }
    }
    case 'tool_result': {
      try {
        const envelope = JSON.parse(pf.text) as { tool_name: string; tool_result: unknown }
        return renderToolResult(envelope.tool_name, envelope.tool_result)
      } catch {
        return `✓ \`${truncateMd(pf.text, LINE_MAX)}\``
      }
    }
    // ctx_usage / compact_* 由调用方处理
    case 'ctx_usage':
    case 'compact_start':
    case 'compact_end':
      return null
    default:
      return `[${pf.kind}] ${truncateMd(pf.text, LINE_MAX)}`
  }
}
