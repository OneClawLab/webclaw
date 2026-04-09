import { Logger } from "@lib/logast.js"
import type { UserPrompt } from "@ai/common/Prompt.js";
import { EditorSectionWriter } from "@editor/DocAppender.js";
import { getState } from "@state/storeHolder.js";
import type { ServerFrame, ProgressFrame } from "@lib/webui-protocol/index.js";

export type AiStatus = 'connected' | 'unconfigured' | 'disconnected'

// Returns xgw connection status from Redux connection slice
export async function aiStatus(): Promise<AiStatus> {
  const state = getState();
  const status = state.connection.status;
  if (status === 'authenticated') return 'connected';
  if (status === 'disconnected') return 'disconnected';
  return 'unconfigured';
}

// Returns available agents from Redux agent slice
export async function listAgents(): Promise<string[]> {
  const state = getState();
  return state.agent.availableAgents;
}

// streamChat: sends message via window.xgw and listens for frame events
// Maps frame types to writer areas:
//   stream_chunk → output writer (append text)
//   stream_end → finalize all writers
//   progress(thinking/tool_call/tool_result) → progress writer
//   progress(ctx_usage/compact_start/compact_end) → progress writer (status bar)
//   error → progress writer (error format)
export async function streamChat(
  userId: string,
  sessionId: string,  // this is the conversationId
  agentName: string,
  prompt: UserPrompt,
  writers: {
    output: EditorSectionWriter
    progress?: EditorSectionWriter,
    log?: EditorSectionWriter,
  }
): Promise<void> {
  const conversationId = sessionId;

  return new Promise<void>((resolve, reject) => {
    let done = false;

    const frameHandler = async (frame: ServerFrame) => {
      if (done) return;

      // Only handle frames for this conversation
      if ('conversation_id' in frame && frame.conversation_id !== conversationId) return;

      try {
        if (frame.type === 'stream_chunk') {
          await writers.output.write(frame.text);
        } else if (frame.type === 'stream_end') {
          done = true;
          await writers.output.finalize('ok');
          if (writers.progress) await writers.progress.finalize('ok');
          resolve();
        } else if (frame.type === 'progress') {
          const pf = frame as ProgressFrame;
          if (writers.progress) {
            await writers.progress.write(`[${pf.kind}] ${pf.text}\n`);
          }
        } else if (frame.type === 'error') {
          done = true;
          const errMsg = frame.message;
          if (writers.progress) {
            await writers.progress.write(`> **Error:** ${errMsg}\n`);
            await writers.progress.finalize('fail', errMsg);
          }
          await writers.output.finalize('fail', errMsg);
          resolve(); // resolve not reject, error is shown in document
        }
      } catch (err) {
        Logger.error('streamChat', 'Error handling frame:', err);
      }
    };

    // Register frame listener
    window.xgw.onFrame(frameHandler);

    // Send the message
    window.xgw.sendMessage(conversationId, prompt.text).catch((err: Error) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });
  });
}
