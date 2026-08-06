import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

type HashOptions = Parameters<typeof argon2.hash>[1];
// unify the options shape used across hash/verify/needsRehash
type ArgonOptions = HashOptions & {
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
  version?: number;
};

@Injectable()
export class PasswordService {
  // Argon2id default options
  private readonly options: ArgonOptions = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  };

  async hashPassword(plain: string): Promise<string> {
    const h = await argon2.hash(plain, this.options);
    return typeof h === 'string' ? h : String(h);
  }

  private isThenable<T>(value: unknown): value is PromiseLike<T> {
    return !!value && typeof (value as { then?: unknown }).then === 'function';
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      const res = argon2.verify(hash, plain, this.options);
      if (this.isThenable<boolean>(res)) return await res;
      return Boolean(res as boolean);
    } catch {
      return false;
    }
  }

  async needsRehash(hash: string): Promise<boolean> {
    try {
      const res = argon2.needsRehash(hash, this.options);
      if (this.isThenable<boolean>(res)) return await res;
      return Boolean(res);
    } catch {
      return false;
    }
  }
}
