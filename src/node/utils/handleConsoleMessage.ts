export function handleConsoleMessage(event: Electron.WebContentsConsoleMessageEventParams) {
    // 噪声日志关键词黑名单
    const blacklist = [
        'Autofill.enable',
        'Autofill.setAddresses',
        'sandboxed_renderer.bundle.js',
        'js2c/sandbox_bundle',
        'favicon.ico',
        'DevTools failed to load',
        'object null is not iterable'
    ];

    const { level, message, lineNumber, sourceId } = event;

    // 命中黑名单时跳过打印
    if (blacklist.some(keyword => message.includes(keyword) || sourceId.includes(keyword))) {
        return;
    }

    const levelChar = level.charAt(0).toUpperCase();
    console.log(`[WEB]-${levelChar}-${message} @${sourceId}:${lineNumber}`);
}
