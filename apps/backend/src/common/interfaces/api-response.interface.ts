export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiResponse<TData = unknown, TMeta = PaginationMeta> {
  success: boolean;
  message: string;
  data: TData;
  meta: TMeta;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors: string[];
}
