import type { PaginationMeta } from '../interfaces/api-response.interface';

export class PaginationHelper {
  static buildMeta(page = 1, limit = 10, total = 0): PaginationMeta {
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      page,
      limit,
      total,
      totalPages,
    };
  }
}
