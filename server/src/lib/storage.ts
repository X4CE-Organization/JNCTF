import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { ApiError } from './errors.js';

/** 允许上传的扩展名，按用途分组 */
export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  avatar: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  challenge: [
    'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2',
    'txt', 'md', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp',
    'py', 'js', 'ts', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'rb', 'php', 'sh',
    'elf', 'exe', 'apk', 'so', 'dll', 'class', 'jar', 'wasm', 'bin', 'out',
    'pcap', 'pcapng', 'cap', 'raw', 'img', 'iso', 'db', 'sqlite',
    'mp3', 'wav', 'mp4', 'mpv',
  ],
  banner: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  writeup: ['md', 'txt', 'pdf', 'zip'],
  other: ['txt', 'md', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'pdf'],
};

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(scope: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const now = new Date();
      const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dir = path.join(config.uploadDir, scope, sub);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });
}

function fileFilter(scope: string) {
  return (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    const allowed = ALLOWED_EXTENSIONS[scope] ?? ALLOWED_EXTENSIONS.other!;
    if (!allowed.includes(ext)) {
      cb(ApiError.badRequest(`不允许上传 .${ext} 类型的文件`));
      return;
    }
    cb(null, true);
  };
}

/** 按用途生成 multer 中间件：头像 4MB，题目附件 100MB */
export function uploader(scope: keyof typeof ALLOWED_EXTENSIONS) {
  const isImage = scope === 'avatar' || scope === 'banner';
  const maxMb = isImage ? Math.max(1, Math.min(10, config.maxUploadMb)) : config.maxUploadMb;
  return multer({
    storage: makeStorage(scope),
    fileFilter: fileFilter(scope),
    limits: { fileSize: maxMb * 1024 * 1024, files: 20 },
  });
}

/** 把 multer 存下来的文件转成前端能访问的 URL */
export function publicUrl(file: Express.Multer.File): string {
  const relative = path.relative(config.uploadDir, file.path).split(path.sep).join('/');
  return `/uploads/${relative}`;
}

export function sha256File(filePath: string): string | null {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}
