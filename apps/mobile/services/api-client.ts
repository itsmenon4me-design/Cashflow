import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  invalidateNativeOfflineEntity,
  withNativeOfflineCache,
} from "./native-offline-cache";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  has_manual_password?: boolean | null;
};

export type NativeSession = {
  id: string;
  user_id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  user_agent: string | null;
  last_activity_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeleteAccountPayload = {
  email: string;
  password?: string;
};

export type NativeNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NativeNotificationPreferences = {
  transactions: boolean;
  budgets: boolean;
  savingGoals: boolean;
  accounts: boolean;
  investments: boolean;
  system: boolean;
};

export type NativeFinanceBotSettings = {
  enabled: boolean;
  personality: "SANTAI" | "TEGAS" | "SAVAGE" | "CUSTOM";
  customStyle?: string;
  budgetThreshold?: number;
  dailyReminderEnabled?: boolean;
  reminderTime1?: string;
  reminderTime2?: string;
};

export type NativeUserSettings = {
  theme: "light" | "dark";
  language: "id" | "en";
  timezone: string | null;
  notification_preferences: NativeNotificationPreferences & {
    financeBot?: NativeFinanceBotSettings;
  };
};

export type NativeCategory = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
};

export type NativeTransaction = {
  id: string;
  category_id: string;
  transaction_type: "INCOME" | "EXPENSE";
  amount_cents: string;
  transaction_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type NativeBudget = {
  id: string;
  category_id: string;
  category_name: string | null;
  currency?: string;
  budget_amount_cents: string;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
};

export type NativeSavingGoal = {
  id: string;
  category_id: string | null;
  currency?: string;
  name: string;
  description: string | null;
  target_amount_cents: string;
  current_amount_cents: string;
  start_date: string;
  target_date: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  created_at: string;
  updated_at: string;
};

export type NativeInvestment = {
  id: string;
  currency?: string;
  investment_type: "Stock" | "Mutual Fund" | "Gold" | "Crypto" | "Bond" | "Deposit" | "Property" | "Other";
  platform: string;
  name: string;
  symbol: string | null;
  quantity: string;
  average_buy_price: string;
  current_price: string;
  invested_amount_cents: string;
  current_value_cents: string;
  profit_loss_cents: string;
  profit_loss_percentage: string;
  purchase_date: string;
  notes: string | null;
  status: "ACTIVE" | "SOLD" | "CLOSED";
  created_at: string;
  updated_at: string;
};

export type NativeAnalyticsOverview = {
  income: string;
  expense: string;
  netCashFlow: string;
  savingRate: number;
  transactions: number;
  comparison: {
    income: number | null;
    expense: number | null;
    netCashFlow: number | null;
    savingRate: number | null;
  };
};

export type NativeDashboardSummary = {
  currency: "IDR";
  total_assets_cents: string;
  total_income_cents: string;
  total_expense_cents: string;
  net_cash_flow_cents: string;
  previous_net_cash_flow_cents: string;
  total_accounts: number;
  total_categories: number;
  total_transactions: number;
  last_updated_at: string | null;
};

export type NativeAnalyticsSpending = {
  avgExpense: string;
  largestExpense: string;
  avgTransaction: string;
  totalTransactions: number;
  incomeTransactions: number;
  expenseTransactions: number;
  byCategory: {
    categoryId: string;
    categoryName: string | null;
    totalAmount: string;
    percentage: number;
    transactionCount: number;
  }[];
};

export type NativeAnalyticsHealth = {
  score: number;
  label: "healthy" | "moderate" | "risk";
  insufficientData?: boolean;
  savingRate: number;
  expenseRatio: number;
  incomeVsExpense: number | null;
  netCashFlow: string;
  cashFlowPositive: boolean;
  spendingConcentration: number;
};

export type NativeTrendPoint = {
  period: string;
  income: string;
  expense: string;
  netCashFlow: string;
};

export type NativeAnalyticsTypeResult = {
  total: string;
  transactionCount: number;
  trend: NativeTrendPoint[];
  categories: {
    categoryId: string;
    categoryName: string | null;
    totalAmount: string;
    percentage: number;
    transactionCount: number;
  }[];
  top: {
    categoryId: string;
    name: string | null;
    total: string;
    percentage: number;
  }[];
  comparison: number | null;
  biggestCategory: string | null;
  biggestCategoryPercentage: number | null;
};

export type NativeReportSummary = {
  month: number;
  year: number;
  summary: {
    income: string;
    expense: string;
    netCashFlow: string;
    transactions: number;
  };
  topExpenseCategories: { categoryId: string; name: string | null; total: string }[];
  topIncomeCategories: { categoryId: string; name: string | null; total: string }[];
};

export type NativeReportCategoryBreakdown = {
  type: "income" | "expense";
  total: string;
  categories: {
    categoryId: string;
    categoryName: string | null;
    totalAmount: string;
    percentage: number;
    transactionCount: number;
  }[];
};

export type NativeReportTrend = {
  type: "daily" | "weekly" | "monthly";
  data: NativeTrendPoint[];
};

export type NativeReportExport = {
  filename: string;
  contentType: string;
  content: string;
  contentEncoding?: "utf-8" | "base64";
};

export type NativeForecast = {
  currency: string;
  horizon: number;
  months: {
    period: string;
    projectedIncomeCents: string;
    projectedExpenseCents: string;
    projectedNetCashflowCents: string;
    projectedEndingBalanceCents: string;
  }[];
  confidence: number;
  basis: {
    monthsUsed: number;
    historyStart: string;
    historyEnd: string;
    totalIncomeCents: string;
    totalExpenseCents: string;
    averageMonthlyIncomeCents: string;
    averageMonthlyExpenseCents: string;
  };
  outliers: { period: string; amountCents: string }[];
  insufficientData: boolean;
};

export type NativeSpendingPrediction = {
  currency: string;
  period: string;
  predictedTotalCents: string;
  confidence: number;
  categories: {
    categoryId: string;
    categoryName: string;
    predictedAmountCents: string;
    confidence: number;
    basedOnMonths: number;
  }[];
  noHistoryCategoryIds: string[];
  otherCents: string;
  insufficientData: boolean;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type LoginResponse = ApiEnvelope<AuthTokens> & {
  user?: AuthUser;
};

type RefreshResponse = ApiEnvelope<AuthTokens>;

function isAuthUser(value: unknown): value is AuthUser {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "full_name" in value &&
    typeof value.full_name === "string" &&
    "username" in value &&
    typeof value.username === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    (!("avatar_url" in value) || typeof value.avatar_url === "string" || value.avatar_url === null) &&
    (!("has_manual_password" in value) || typeof value.has_manual_password === "boolean" || value.has_manual_password === null);
}

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://cashflow-backend-dusky.vercel.app/api/v1"
).replace(/\/+$/, "");
const ACCESS_TOKEN_KEY = "cashflow.auth.access-token";
const REFRESH_TOKEN_KEY = "cashflow.auth.refresh-token";
const AUTH_USER_CACHE_KEY = "cashflow.auth.user";
const DEVICE_ID_KEY = "cashflow.auth.device-id";
const REQUEST_TIMEOUT_MS = 20_000;

let refreshRequest: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function saveAuthTokens(tokens: AuthTokens) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

async function getDeviceId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  const deviceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function saveCachedAuthUser(user: AuthUser) {
  await SecureStore.setItemAsync(AUTH_USER_CACHE_KEY, JSON.stringify(user));
}

export async function readCachedAuthUser(): Promise<AuthUser | null> {
  const serializedUser = await SecureStore.getItemAsync(AUTH_USER_CACHE_KEY);
  if (!serializedUser) return null;

  try {
    const user: unknown = JSON.parse(serializedUser);
    if (isAuthUser(user)) return user;
  } catch (error) {
    console.warn("Could not parse the cached native account profile.", error);
  }

  await SecureStore.deleteItemAsync(AUTH_USER_CACHE_KEY);
  return null;
}

export async function readAuthTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    if (accessToken || refreshToken) await clearAuthTokens();
    return null;
  }
  return { accessToken, refreshToken };
}

export async function clearAuthTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(AUTH_USER_CACHE_KEY),
  ]);
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown, status: number) {
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
      const messages = message.filter((item): item is string => typeof item === "string");
      if (messages.length) return messages.join("\n");
    }
  }
  return `Request failed (${status}).`;
}

async function refreshTokens(): Promise<boolean> {
  if (refreshRequest) return refreshRequest;
  refreshRequest = (async () => {
    const tokens = await readAuthTokens();
    if (!tokens?.refreshToken) {
      await clearAuthTokens();
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await parseResponse(response);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await clearAuthTokens();
        return false;
      }
      throw new ApiError(getErrorMessage(data, response.status), response.status, data);
    }

    const result = data as RefreshResponse;
    if (
      !result.success ||
      !result.data?.accessToken ||
      !result.data.refreshToken
    ) {
      throw new ApiError("The server returned an invalid refresh response.", response.status, data);
    }
    await saveAuthTokens(result.data);
    return true;
  })();

  try {
    return await refreshRequest;
  } finally {
    refreshRequest = null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(options.headers);
  headers.set("X-Device-Id", await getDeviceId());
  if (Platform.OS === "android" || Platform.OS === "ios") {
    headers.set("X-Client-Platform", Platform.OS);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const tokens = await readAuthTokens();
  if (tokens?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await parseResponse(response);
  if (response.status === 401 && retryAfterRefresh && !path.startsWith("/auth/refresh")) {
    if (await refreshTokens()) return request<T>(path, options, false);
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status, data);
  }
  return data as T;
}

function jsonRequest<T>(path: string, method: string, payload?: unknown) {
  return request<T>(path, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

export const authApi = {
  login: (email: string, password: string) =>
    jsonRequest<LoginResponse>("/auth/login", "POST", { email, password }),
  register: (payload: { full_name: string; email: string; password: string }) =>
    jsonRequest<ApiEnvelope<AuthUser> & { verificationEmailSent?: boolean }>(
      "/auth/register",
      "POST",
      payload,
    ),
  sendVerification: (email: string) =>
    jsonRequest<ApiEnvelope<never>>("/auth/email/send-verification", "POST", { email }),
  forgotPassword: (email: string) =>
    jsonRequest<ApiEnvelope<never>>("/auth/email/forgot-password", "POST", { email }),
  resetPassword: (token: string, id: string, newPassword: string) =>
    jsonRequest<ApiEnvelope<never>>("/auth/reset-password", "POST", {
      token,
      id,
      new_password: newPassword,
    }),
  me: () => request<ApiEnvelope<AuthUser>>("/auth/me"),
  updateProfile: (fullName: string) =>
    request<ApiEnvelope<AuthUser>>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ full_name: fullName }),
    }),
  deleteAccount: (payload: DeleteAccountPayload) =>
    jsonRequest<ApiEnvelope<never>>("/users/me/delete-account", "POST", payload),
  oauthUrl: (provider: "google" | "github", redirectUri: string) =>
    request<{ success: boolean; message?: string; url?: string }>(
      `/auth/${provider}?redirectUri=${encodeURIComponent(redirectUri)}`,
    ),
  logout: () => jsonRequest<ApiEnvelope<never>>("/auth/logout", "DELETE"),
};

export const notificationApi = {
  list: async () => {
    const response = await request<{
      success: boolean;
      data: NativeNotification[];
      pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
      };
    }>("/notifications?page=1&limit=100");
    return response;
  },
  markRead: (id: string) =>
    request<ApiEnvelope<NativeNotification>>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    }),
  markAllRead: () =>
    request<ApiEnvelope<{ updatedCount: number }>>("/notifications/read-all", {
      method: "PATCH",
    }),
  remove: (id: string) =>
    request<ApiEnvelope<never>>(`/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  removeAll: () => request<ApiEnvelope<{ deleted: number }>>("/notifications", {
    method: "DELETE",
  }),
};

export const settingsApi = {
  get: () => request<ApiEnvelope<NativeUserSettings>>("/settings"),
  update: (payload: {
    theme?: "light" | "dark";
    language?: "id" | "en";
    timezone?: string;
    notification_preferences?: Partial<NativeNotificationPreferences> & {
      financeBot?: Partial<NativeFinanceBotSettings>;
    };
  }) => jsonRequest<ApiEnvelope<NativeUserSettings>>("/settings", "PATCH", payload),
};

export const nativePushApi = {
  register: (token: string, platform: "android" | "ios") =>
    jsonRequest<ApiEnvelope<never>>("/notifications/push/native-token", "POST", {
      token,
      platform,
    }),
  remove: (token: string) =>
    jsonRequest<ApiEnvelope<never>>("/notifications/push/native-token/remove", "POST", {
      token,
    }),
};

export const sessionApi = {
  async list() {
    const sessions = await request<NativeSession[]>("/auth/sessions");
    if (!Array.isArray(sessions)) {
      throw new ApiError("The server returned an invalid session list.", 500, sessions);
    }
    return sessions;
  },
  revoke: (id: string) =>
    request<ApiEnvelope<never>>(`/auth/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  revokeOthers: () =>
    request<ApiEnvelope<never>>("/auth/sessions", { method: "DELETE" }),
};

function queryPath(path: string, params: Record<string, string | number | undefined>) {
    const query = Object.entries(params)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join("&");
    return query ? `${path}?${query}` : path;
}

function requireData<T>(response: ApiEnvelope<T>, resource: string): T {
    if (!response.success || response.data === undefined || response.data === null) {
      throw new ApiError(`The server returned an invalid ${resource} response.`, 500, response);
    }
    return response.data;
}

export const financeApi = {
    getDashboardSummary: () =>
      request<NativeDashboardSummary>("/dashboard/summary"),
    async listCategories() {
      return withNativeOfflineCache("categories", "list", async () => {
        const response = await request<ApiEnvelope<NativeCategory[]>>("/categories");
        return requireData(response, "categories");
      });
    },
    createCategory: (payload: {
      name: string;
      type: "INCOME" | "EXPENSE";
      icon?: string;
      color?: string;
      description?: string;
    }) => jsonRequest<ApiEnvelope<NativeCategory>>("/categories", "POST", payload)
      .then(async (response) => {
        const category = requireData(response, "category");
        await invalidateNativeOfflineEntity("categories");
        return category;
      }),
    updateCategory: (id: string, payload: {
      name?: string;
      type?: "INCOME" | "EXPENSE";
      icon?: string;
      color?: string;
      description?: string;
    }) => jsonRequest<ApiEnvelope<NativeCategory>>(`/categories/${encodeURIComponent(id)}`, "PATCH", payload)
      .then(async (response) => {
        const category = requireData(response, "category");
        await invalidateNativeOfflineEntity("categories");
        return category;
      }),
    removeCategory: (id: string) =>
      request<ApiEnvelope<never>>(`/categories/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(async (response) => {
          await invalidateNativeOfflineEntity("categories");
          return response;
        }),

    async listTransactions() {
      return withNativeOfflineCache("transactions", "list:all", async () => {
        const result: NativeTransaction[] = [];
        let page = 1;
        let hasNext = true;
        while (hasNext) {
          const response = await request<{
            success: boolean;
            data: NativeTransaction[];
            pagination: { page: number; hasNext: boolean };
          }>(queryPath("/transactions", { page, limit: 100 }));
          if (!response.success || !Array.isArray(response.data) || !response.pagination) {
            throw new ApiError("The server returned an invalid transactions response.", 500, response);
          }
          result.push(...response.data);
          hasNext = response.pagination.hasNext;
          page += 1;
          if (page > 1000) {
            throw new ApiError("The transaction list exceeded the supported pagination limit.", 500, response);
          }
        }
        return result;
      });
    },
    createTransaction: (payload: {
      category_id: string;
      transaction_type: "INCOME" | "EXPENSE";
      amount_cents: number;
      transaction_date: string;
      note?: string;
      reference_number?: string;
    }) => jsonRequest<ApiEnvelope<NativeTransaction>>("/transactions", "POST", payload)
      .then(async (response) => {
        const transaction = requireData(response, "transaction");
        await invalidateNativeOfflineEntity("transactions");
        return transaction;
      }),
    updateTransaction: (id: string, payload: {
      category_id?: string;
      transaction_type?: "INCOME" | "EXPENSE";
      amount_cents?: number;
      transaction_date?: string;
      note?: string;
    }) => jsonRequest<ApiEnvelope<NativeTransaction>>(`/transactions/${encodeURIComponent(id)}`, "PATCH", payload)
      .then(async (response) => {
        const transaction = requireData(response, "transaction");
        await invalidateNativeOfflineEntity("transactions");
        return transaction;
      }),
    removeTransaction: (id: string) =>
      request<ApiEnvelope<never>>(`/transactions/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(async (response) => {
          await invalidateNativeOfflineEntity("transactions");
          return response;
        }),

    async listBudgets() {
      return withNativeOfflineCache("budgets", "list", async () => {
        const response = await request<ApiEnvelope<NativeBudget[]>>("/budgets");
        return requireData(response, "budgets");
      });
    },
    createBudget: (payload: {
      category_id: string;
      budget_amount_cents: number;
      month: number;
      year: number;
    }) => jsonRequest<ApiEnvelope<NativeBudget>>("/budgets", "POST", payload)
      .then(async (response) => {
        const budget = requireData(response, "budget");
        await invalidateNativeOfflineEntity("budgets");
        return budget;
      }),
    updateBudget: (id: string, payload: {
      category_id?: string;
      budget_amount_cents?: number;
      month?: number;
      year?: number;
    }) => jsonRequest<ApiEnvelope<NativeBudget>>(`/budgets/${encodeURIComponent(id)}`, "PATCH", payload)
      .then(async (response) => {
        const budget = requireData(response, "budget");
        await invalidateNativeOfflineEntity("budgets");
        return budget;
      }),
    removeBudget: (id: string) =>
      request<ApiEnvelope<never>>(`/budgets/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(async (response) => {
          await invalidateNativeOfflineEntity("budgets");
          return response;
        }),

    async listSavingGoals() {
      return withNativeOfflineCache("saving-goals", "list", async () => {
        const response = await request<ApiEnvelope<NativeSavingGoal[]>>("/saving-goals");
        return requireData(response, "saving goals");
      });
    },
    createSavingGoal: (payload: {
      name: string;
      category_id?: string;
      description?: string;
      target_amount_cents: number;
      current_amount_cents?: number;
      start_date: string;
      target_date: string;
      status?: NativeSavingGoal["status"];
    }) => jsonRequest<ApiEnvelope<NativeSavingGoal>>("/saving-goals", "POST", payload)
      .then(async (response) => {
        const goal = requireData(response, "saving goal");
        await invalidateNativeOfflineEntity("saving-goals");
        return goal;
      }),
    updateSavingGoal: (id: string, payload: {
      name?: string;
      category_id?: string | null;
      description?: string;
      target_amount_cents?: number;
      current_amount_cents?: number;
      start_date?: string;
      target_date?: string;
      status?: NativeSavingGoal["status"];
    }) => jsonRequest<ApiEnvelope<NativeSavingGoal>>(`/saving-goals/${encodeURIComponent(id)}`, "PATCH", payload)
      .then(async (response) => {
        const goal = requireData(response, "saving goal");
        await invalidateNativeOfflineEntity("saving-goals");
        return goal;
      }),
    removeSavingGoal: (id: string) =>
      request<ApiEnvelope<never>>(`/saving-goals/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(async (response) => {
          await invalidateNativeOfflineEntity("saving-goals");
          return response;
        }),

    async listInvestments() {
      const response = await request<ApiEnvelope<NativeInvestment[]>>("/investments");
      return requireData(response, "investments");
    },
    createInvestment: (payload: {
      investment_type: NativeInvestment["investment_type"];
      platform: string;
      name: string;
      symbol?: string;
      quantity: number;
      average_buy_price: number;
      current_price: number;
      invested_amount_cents?: number;
      notes?: string;
      purchase_date: string;
      status?: NativeInvestment["status"];
    }) => jsonRequest<ApiEnvelope<NativeInvestment>>("/investments", "POST", payload)
      .then((response) => requireData(response, "investment")),
    updateInvestment: (id: string, payload: {
      investment_type?: NativeInvestment["investment_type"];
      platform?: string;
      name?: string;
      symbol?: string | null;
      quantity?: number;
      average_buy_price?: number;
      current_price?: number;
      invested_amount_cents?: number;
      notes?: string | null;
      purchase_date?: string;
      status?: NativeInvestment["status"];
    }) => jsonRequest<ApiEnvelope<NativeInvestment>>(`/investments/${encodeURIComponent(id)}`, "PATCH", payload)
      .then((response) => requireData(response, "investment")),
    removeInvestment: (id: string) =>
      request<ApiEnvelope<never>>(`/investments/${encodeURIComponent(id)}`, { method: "DELETE" }),

    getAnalyticsOverview: (startDate: string, endDate: string) =>
      request<NativeAnalyticsOverview>(queryPath("/analytics/overview", { startDate, endDate })),
    getCashflowTrend: (startDate: string, endDate: string, granularity = "monthly") =>
      request<{ trend: NativeTrendPoint[] }>(queryPath("/analytics/cashflow", { startDate, endDate, granularity })),
    getAnalyticsIncome: (startDate: string, endDate: string, granularity = "monthly") =>
      request<NativeAnalyticsTypeResult>(queryPath("/analytics/income", { startDate, endDate, granularity })),
    getAnalyticsExpenses: (startDate: string, endDate: string, granularity = "monthly") =>
      request<NativeAnalyticsTypeResult>(queryPath("/analytics/expenses", { startDate, endDate, granularity })),
    getAnalyticsSpending: (startDate: string, endDate: string) =>
      request<NativeAnalyticsSpending>(queryPath("/analytics/spending", { startDate, endDate })),
    getFinancialHealth: (startDate: string, endDate: string) =>
      request<NativeAnalyticsHealth>(queryPath("/analytics/financial-health", { startDate, endDate })),
    getInsights: (startDate: string, endDate: string) =>
      request<string[]>(queryPath("/analytics/insights", { startDate, endDate })),
    getReportSummary: (startDate: string, endDate: string) =>
      request<NativeReportSummary>(queryPath("/reports/monthly", { startDate, endDate })),
    getReportCategoryBreakdown: (type: "income" | "expense", startDate: string, endDate: string) =>
      request<NativeReportCategoryBreakdown>(queryPath("/reports/category-breakdown", { type, startDate, endDate })),
    getReportCashflowTrend: (type: "daily" | "weekly" | "monthly", startDate: string, endDate: string) =>
      request<NativeReportTrend>(queryPath("/reports/cashflow-trend", { type, startDate, endDate })),
    getReportExport: (startDate: string, endDate: string) =>
      request<NativeReportExport>(queryPath("/reports/export", {
        type: "monthly",
        format: "xlsx",
        startDate,
        endDate,
      })),
    getForecast: (horizon: number) =>
      request<ApiEnvelope<NativeForecast>>(queryPath("/ai/forecast", { horizon }))
        .then((response) => requireData(response, "forecast")),
    getSpendingPrediction: (horizon: number) =>
      request<ApiEnvelope<NativeSpendingPrediction>>(queryPath("/ai/spending-prediction", { horizon }))
        .then((response) => requireData(response, "spending prediction")),
};

export async function getAuthenticatedUser() {
  const response = await authApi.me();
  if (!response.success || !response.data) {
    throw new ApiError("The server did not return the authenticated user.", 500, response);
  }
  return response.data;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function checkApiConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${API_BASE_URL}/health/live`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timeoutId);
  }
}
