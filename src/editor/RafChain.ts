type RafStep = () => void | Promise<void>;

// A simple requestAnimationFrame chain executor
// Usage:
//   rafChain()
//     .then(() => { ... })
//     .then(async () => { await ... })
//     ...
// 会保证每一步都在下一个 animation frame 执行。
// 可以通过 cancel() 方法取消后续步骤的执行。
//
// 适用场景：
//   CodeMirror 在 view update 不允许再触发 一次 view update，
//   但我们却常常需要这样，因此用链式来分帧处理。
// RAF = Request Animation Frame
class RafChain {
  private queue: RafStep[] = [];
  private running = false;
  private cancelled = false;

  then(step: RafStep): this {
    this.queue.push(step);
    if (!this.running) this.runNext();
    return this;
  }

  cancel() {
    this.cancelled = true;
    this.queue.length = 0;
  }

  private runNext() {
    if (this.cancelled) return;
    const step = this.queue.shift();
    if (!step) {
      this.running = false;
      return;
    }

    this.running = true;
    requestAnimationFrame(async () => {
      if (this.cancelled) return;

      try {
        await step();
      } finally {
        this.runNext();
      }
    });
  }
}

// 创建并返回一个新的 raf 链
export function rafChain() {
  return new RafChain();
}
