import type { ChallengeFlag } from '@prisma/client';

export interface JudgeResult {
  correct: boolean;
  /** 命中的是第几个 flag，多个 flag 的题会用到 */
  matchedIndex: number;
}

/**
 * flag 判定。一道题可以配多个 flag，任意命中一个就算做出来。
 *
 * STATIC  —— 完全匹配（大小写按 flag 自己的设置）
 * REGEX   —— 正则匹配，flag 字段存的是正则
 * DYNAMIC —— 每队一份，提交时先和自己实例里的 flag 比
 */
export function judgeFlag(
  submitted: string,
  flags: ChallengeFlag[],
  dynamicFlag?: string | null,
): JudgeResult {
  const input = submitted.trim();
  if (!input) return { correct: false, matchedIndex: -1 };

  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index]!;
    const expected = flag.caseSensitive ? flag.flag : flag.flag.toLowerCase();
    const actual = flag.caseSensitive ? input : input.toLowerCase();

    if (flag.type === 'REGEX') {
      try {
        if (new RegExp(flag.flag, flag.caseSensitive ? '' : 'i').test(input)) {
          return { correct: true, matchedIndex: index };
        }
      } catch {
        // 正则写错了就当不匹配，不让它把接口打挂
      }
      continue;
    }

    if (flag.type === 'DYNAMIC') {
      if (dynamicFlag && dynamicFlag === input) return { correct: true, matchedIndex: index };
      continue;
    }

    if (expected === actual) return { correct: true, matchedIndex: index };
  }

  // 实例旗标兜底：题目没配 DYNAMIC flag 但确实起了容器
  if (dynamicFlag && dynamicFlag === input) {
    return { correct: true, matchedIndex: -1 };
  }
  return { correct: false, matchedIndex: -1 };
}

/** 生成一个随机 flag，支持 {random} {team} {round} 占位符 */
export function renderFlagTemplate(
  template: string,
  context: { team?: string | number | bigint; round?: string | number | bigint; length?: number },
): string {
  const length = context.length ?? 24;
  const random = randomHex(length);
  return template
    .replace(/\{random\}/g, random)
    .replace(/\{team\}/g, context.team === undefined ? '' : String(context.team))
    .replace(/\{round\}/g, context.round === undefined ? '' : String(context.round));
}

function randomHex(length: number): string {
  const alphabet = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** 校验 flag 格式是否合法（正则题要能编译通过） */
export function validateFlag(flag: string, type: string): string | null {
  if (!flag.trim()) return 'flag 不能为空';
  if (type === 'REGEX') {
    try {
      new RegExp(flag);
    } catch (err) {
      return `正则不合法：${(err as Error).message}`;
    }
  }
  return null;
}
