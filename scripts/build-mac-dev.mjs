#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ROOT = process.cwd();
const BUILD_DIR = path.join(ROOT, 'dist');
const APP_NAME = 'Eidux';
const APP_VERSION = '0.1.0';
const APP_PATH = path.join(BUILD_DIR, `mac-arm64/${APP_NAME}.app`);

/**
 * Step 1: 清理旧构建
 */
console.log('Cleaning previous build...');
if (fs.existsSync(BUILD_DIR)) {
  execSync(`rm -rf ${BUILD_DIR}`, { stdio: 'inherit' });
}

/**
 * Step 2: 构建 Electron 应用
 */
console.log('Building Electron app...');
execSync(`npx electron-builder --mac --config electron-builder.config.mjs`, { stdio: 'inherit' });

/**
 * Step 3: 自签名应用（探索阶段，无需 Apple 账号）
 */
console.log('Signing app (self-sign)...');
execSync(`codesign --deep --force --sign - "${APP_PATH}"`, { stdio: 'inherit' });

/**
 * Step 4: 生成 blockmap（electron-builder 会自动生成 ZIP + blockmap）
 * 重新打包 ZIP 输出
 */
console.log('Generating ZIP + blockmap...');
execSync(`npx electron-builder --mac --config electron-builder.config.mjs --publish never`, { stdio: 'inherit' });

console.log('\n✅ Mac dev build complete!');
console.log(`DMG + ZIP output at: ${BUILD_DIR}`);
console.log(`Run ${APP_PATH} to test locally (may show Gatekeeper warning).`);
