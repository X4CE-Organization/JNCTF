import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { config } from './config.js';

/**
 * 首次启动准备最小可用数据：超级管理员 + 题目分类。
 * 已经有数据就什么都不做，不会覆盖已有内容。
 */
export async function ensureSeed(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.create({
      data: {
        username: config.init.username,
        email: config.init.email,
        passwordHash: await bcrypt.hash(config.init.password, 10),
        displayName: config.init.username,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    logger.warn(`已创建超级管理员「${config.init.username}」，请登录后立刻修改密码`);
  }

  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    await prisma.category.createMany({
      data: [
        { name: 'Web', slug: 'web', description: 'Web 安全', icon: 'globe', color: '#3b82f6', sortOrder: 1 },
        { name: 'Pwn', slug: 'pwn', description: '二进制漏洞利用', icon: 'cpu', color: '#ef4444', sortOrder: 2 },
        { name: 'Reverse', slug: 'reverse', description: '逆向工程', icon: 'search', color: '#a855f7', sortOrder: 3 },
        { name: 'Crypto', slug: 'crypto', description: '密码学', icon: 'key', color: '#f59e0b', sortOrder: 4 },
        { name: 'Misc', slug: 'misc', description: '杂项', icon: 'sparkles', color: '#22c55e', sortOrder: 5 },
        { name: 'Forensics', slug: 'forensics', description: '取证分析', icon: 'file', color: '#06b6d4', sortOrder: 6 },
        { name: 'Blockchain', slug: 'blockchain', description: '区块链', icon: 'link', color: '#8b5cf6', sortOrder: 7 },
        { name: 'AWD', slug: 'awd', description: '攻防对抗', icon: 'shield', color: '#f43f5e', sortOrder: 8 },
      ],
    });
    logger.info('已初始化 8 个题目分类');
  }
}
