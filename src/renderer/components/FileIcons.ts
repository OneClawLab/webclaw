// 根据文件名/扩展名选择图标 和颜色
export const getFileIcon = (fileName: string): { icon: string, color: string } => {
  const lower = (fileName || '').toLowerCase().trim();

  // dotfiles / special names
  if (lower.endsWith('.json')) return { icon: 'Braces', color: 'orange' };
  if (lower === 'readme' || lower.startsWith('readme.')) return { icon: 'Info', color: 'blue' };
  if (lower === 'license' || lower.startsWith('license.')) return { icon: 'Copyright', color: 'gray' };

  const ext = lower.includes('.') ? lower.split('.').pop()! : '';

  // markdown / text
  if (['md', 'mdx', 'txt', 'log', 'rst'].includes(ext)) return { icon: 'ArrowDownToLine', color: 'blue' };

  // code
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'cts', 'mts'].includes(ext)) return { icon: 'Code', color: 'orange' };
  if (['py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'swift'].includes(ext)) return { icon: 'Code', color: 'blue' };
  if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(ext)) return { icon: 'CodeXml', color: 'orange' };
  if (['yml', 'yaml', 'toml', 'ini', 'conf', 'cfg'].includes(ext)) return { icon: 'CodeXml', color: 'orange' };
  if (['sh', 'bat', 'cmd', 'zsh'].includes(ext)) return { icon: 'Ampersand', color: 'green' };

  // data / db
  if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) return { icon: 'FileSpreadsheet', color: 'blue' };

  // media
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return { icon: 'FileImage', color: 'brown' };
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'mid', 'amr'].includes(ext)) return { icon: 'FileAudio', color: 'purple' };
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return { icon: 'FileVideo', color: 'red' };

  // archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return { icon: 'FileArchive', color: 'orange' };

  return { icon: 'File', color: 'gray' };
};
