import crypto from 'node:crypto';

/**
 * TOTP（RFC 6238）两步验证。用 Node 内置 crypto 实现，不引第三方库。
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const PERIOD = 30;
const WINDOW = 1;

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
}

export function verifyTotp(secret: string | null | undefined, code: string | null | undefined): boolean {
  if (!secret || !code) return false;
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    if (generateCode(secret, counter + offset) === normalized) return true;
  }
  return false;
}

export function generateCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

function base32Encode(data: Buffer): string {
  let result = '';
  let buffer = 0;
  let bitsLeft = 0;
  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      result += ALPHABET[(buffer >> (bitsLeft - 5)) & 0x1f];
      bitsLeft -= 5;
    }
  }
  if (bitsLeft > 0) result += ALPHABET[(buffer << (5 - bitsLeft)) & 0x1f];
  return result;
}

function base32Decode(secret: string): Buffer {
  const normalized = secret.replace(/=|\s/g, '').toUpperCase();
  const out = Buffer.alloc(Math.floor((normalized.length * 5) / 8));
  let buffer = 0;
  let bitsLeft = 0;
  let index = 0;
  for (const char of normalized) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`非法的 Base32 字符: ${char}`);
    buffer = (buffer << 5) | value;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      out[index++] = (buffer >> (bitsLeft - 8)) & 0xff;
      bitsLeft -= 8;
    }
  }
  return out;
}
