// winston based logger.
//  can be used in the main process of Electron app.
//  output to both console and file.
//    log files are stored in a 'logs' directory at the root of the application.
//  support structured JSON format / error stack traces / custom formatting.

import winston from 'winston'
import { format } from 'winston'
import chalk from 'chalk'

import { existsSync, mkdirSync, unlinkSync } from 'fs'
import path from 'path'

import { MESSAGE, SPLAT } from 'triple-beam'
import stringify from 'safe-stable-stringify'

let Logger: winston.Logger = null as any;

import { PATH_LOGS } from '@lib/paths.js';
import { app } from 'electron/main'

export function initLogger() {
  if (Logger) return;

  const logDir = PATH_LOGS();
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${app.name}.log`);

  const timestampFormat = winston.format.timestamp({
    format: () => new Date().toLocaleTimeString(),
  });

  const ourFormat = format(info => {
    // console.log(info);

    // discard the timestamp, label, level, message, splat properties
    const { timestamp, label, level, message, ...meta } = info;

    const splatSymbol = info[SPLAT];
    const splatStr = stringify(splatSymbol) ?? '';

    // convert level to one uppercase letter
    const levelChar = info.level.charAt(0).toUpperCase();

    if (splatStr.length > 0) {
      info[MESSAGE] = `${info.timestamp}-${levelChar}-${info.message} ${splatStr}`;
    } else {
      info[MESSAGE] = `${info.timestamp}-${levelChar}-${info.message}`;
    }

    return info;
  });

  chalk.level = 3; // 设置 chalk 的颜色级别，3 是最高级别，支持所有颜色

  const LOG_COLORS: Record<string, { bg: [number, number, number], fg: [number, number, number] }> = {
    debug:    { bg: [238, 238, 238], fg: [0, 0, 0] },       // 黑字 + 亮灰背景
    info:     { bg: [0, 95, 215],    fg: [255, 255, 255] }, // 白字 + 亮蓝色背景
    warn:     { bg: [255, 255, 175], fg: [0, 0, 0] },       // 黑字 + 亮黄色背景
    error:    { bg: [135, 95, 175],  fg: [255, 255, 255] }, // 白字 + 紫色背景
    critical: { bg: [175, 0, 0],     fg: [255, 255, 255] }, // 白字 + 红色背景
    special:  { bg: [175, 215, 95],  fg: [0, 0, 0] }        // 黑字 + 亮绿色背景
  }

  function colorize(level: string, msg: string): string {
    const color = LOG_COLORS[level.toLowerCase()]
    if (!color) return msg
    return chalk.bgRgb(...color.bg).rgb(...color.fg)(msg)
  }

  const ourColorizedFormat = format(info => {
    // discard the timestamp, label, level, message, splat properties
    const { timestamp, label, level, message, ...meta } = info;

    const splatSymbol = info[SPLAT];
    const splatStr = stringify(splatSymbol) ?? '';

    // convert level to one uppercase letter
    const levelChar = info.level.charAt(0).toUpperCase();

    if (splatStr.length > 0) {
      info[MESSAGE] = colorize(level, `${info.timestamp}-${levelChar}-${info.message} ${splatStr}`);
    } else {
      info[MESSAGE] = colorize(level, `${info.timestamp}-${levelChar}-${info.message}`);
    }

    return info;
  });

  // remove old log file
  try {
    unlinkSync(logFile);
  }catch {}

  // 文件输出结构化 JSON
  const fileTransport = new winston.transports.File({
    filename: logFile,
    level: 'debug',
    handleExceptions: true,
    handleRejections: true,

    format: format.combine(
      timestampFormat,
      ourFormat(),
      format.errors({ stack: true })
    )
  });

  // 控制台输出
  const consoleTransport = new winston.transports.Console({
    forceConsole: true,
    level: 'debug',
    handleExceptions: true,
    handleRejections: true,

    format: format.combine(
      timestampFormat,
      ourColorizedFormat(),
      format.errors({ stack: true })
    )
  });

  Logger = winston.createLogger({
    level: 'debug',
    transports: [ fileTransport, consoleTransport ],
    exitOnError: false, // do not exit on handled exceptions
  });

  Logger.on('error', (err) => {
    console.error('node.logger ERROR:', err)
  });

  // 用初始化好的 Logger 记录第一条日志，表示初始化完成
  Logger.info('(Node/Main) Logger initialized', { logFile });
}

export { Logger };
