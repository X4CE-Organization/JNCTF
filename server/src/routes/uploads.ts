import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploader, publicUrl, sha256File } from '../lib/storage.js';
import { audit } from '../lib/audit.js';

export const uploadRouter = Router();

/** 通用附件上传，返回 URL 与哈希 */
uploadRouter.post(
  '/file',
  requireAuth,
  uploader('challenge').single('file'),
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const file = req.file;
    if (!file) throw ApiError.badRequest('请选择文件');
    const url = publicUrl(file);
    const attachment = await prisma.attachment.create({
      data: {
        filename: file.originalname,
        path: file.path,
        url,
        contentType: file.mimetype,
        size: BigInt(file.size),
        sha256: sha256File(file.path),
        userId: actor.id,
        scope: 'challenge',
      },
    });
    await audit(req, actor, 'upload.file', 'attachment', attachment.id, file.originalname);
    return ok(
      res,
      {
        id: attachment.id,
        url,
        filename: file.originalname,
        size: file.size,
        sha256: attachment.sha256,
        contentType: file.mimetype,
      },
      201,
    );
  }),
);

/** 头像：限制为图片 */
uploadRouter.post(
  '/avatar',
  requireAuth,
  uploader('avatar').single('file'),
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const file = req.file;
    if (!file) throw ApiError.badRequest('请选择图片');
    const url = publicUrl(file);
    await prisma.attachment.create({
      data: {
        filename: file.originalname,
        path: file.path,
        url,
        contentType: file.mimetype,
        size: BigInt(file.size),
        sha256: sha256File(file.path),
        userId: actor.id,
        scope: 'avatar',
      },
    });
    return ok(res, { url }, 201);
  }),
);

/** 题面 / 公告里插入的图片 */
uploadRouter.post(
  '/image',
  requireAuth,
  uploader('banner').single('file'),
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const file = req.file;
    if (!file) throw ApiError.badRequest('请选择图片');
    const url = publicUrl(file);
    await prisma.attachment.create({
      data: {
        filename: file.originalname,
        path: file.path,
        url,
        contentType: file.mimetype,
        size: BigInt(file.size),
        userId: actor.id,
        scope: 'banner',
      },
    });
    return ok(res, { url }, 201);
  }),
);

/** 批量上传题目附件（一次最多 20 个） */
uploadRouter.post(
  '/files',
  requireAuth,
  uploader('challenge').array('files', 20),
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw ApiError.badRequest('请选择文件');
    const items = [];
    for (const file of files) {
      const url = publicUrl(file);
      const attachment = await prisma.attachment.create({
        data: {
          filename: file.originalname,
          path: file.path,
          url,
          contentType: file.mimetype,
          size: BigInt(file.size),
          sha256: sha256File(file.path),
          userId: actor.id,
          scope: 'challenge',
        },
      });
      items.push({ id: attachment.id, url, filename: file.originalname, size: file.size, sha256: attachment.sha256 });
    }
    await audit(req, actor, 'upload.files', 'attachment', null, `${items.length} 个文件`);
    return ok(res, { items }, 201);
  }),
);
