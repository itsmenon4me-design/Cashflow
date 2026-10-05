import { StatusBar } from "expo-status-bar";
import { isRunningInExpoGo } from "expo";
import { createContext, Fragment, memo, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type * as NotificationsModule from "expo-notifications";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Animated,
  Alert,
  BackHandler,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable as NativePressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type ListRenderItemInfo,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityGlyphIcons, MaterialCommunityIcons } from "./NativeIcon";
import * as Linking from "expo-linking";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthScreen } from "./AuthScreen";
import { translateMobileText, type MobileLanguage } from "./mobile-locale";
import {
  ApiError,
  authApi,
  clearAuthTokens,
  checkApiConnectivity,
  getAuthenticatedUser,
  nativePushApi,
  notificationApi,
  readCachedAuthUser,
  readAuthTokens,
  saveCachedAuthUser,
  saveAuthTokens,
  financeApi,
  sessionApi,
  settingsApi,
  setUnauthorizedHandler,
  type AuthUser,
  type DeleteAccountPayload,
  type NativeCategory,
  type NativeAnalyticsHealth,
  type NativeAnalyticsOverview,
  type NativeAnalyticsSpending,
  type NativeAnalyticsTypeResult,
  type NativeBudget,
  type NativeDashboardSummary,
  type NativeForecast,
  type NativeReportCategoryBreakdown,
  type NativeReportSummary,
  type NativeSpendingPrediction,
  type NativeSession,
  type NativeTransaction,
  type NativeTrendPoint,
  type NativeUserSettings,
} from "./services/api-client";
import { saveNativeReportExport } from "./services/report-export";
import {
  NativeTransactionSyncQueue,
  type NativeTransactionDraft,
  type NativeTransactionPayload,
  type NativeTransactionSyncRecord,
} from "./services/native-transaction-sync";
import {
  clearNativeOfflineCache,
  setNativeOfflineCacheScope,
} from "./services/native-offline-cache";

type RouteKey =
  | "dashboard"
  | "incomes"
  | "expenses"
  | "transactions"
  | "categories"
  | "budgets"
  | "goals"
  | "investments"
  | "forecast"
  | "reports"
  | "analytics"
  | "notifications"
  | "audit"
  | "settings"
  | "profile";
type Palette = (typeof themes)[keyof typeof themes];
type AuthStatus = "loading" | "signedOut" | "authenticated" | "error";
type NativeSettingsPatch = Parameters<typeof settingsApi.update>[0];

type DemoTransaction = NativeTransactionDraft & {
  id: string;
  status: "completed";
  syncState?: "pending" | "failed";
};
type TransactionFieldErrors = { date?: string; category?: string; amount?: string };
type DemoNotification = { id: string; title: string; message: string; createdAt: string; isRead: boolean };
type SessionDialogState =
  | { kind: "single"; session: NativeSession; device: string }
  | { kind: "others" }
  | { kind: "error"; title: string; description: string };
type DashboardSnapshot = {
  overview: NativeDashboardSummary | null;
  cashflowTrend: NativeTrendPoint[];
  insights: string[];
};
type NativeToast = { id: number; message: string; tone: "success" | "error" | "info" };
const getTransactionAmount = (transaction: { amount: string }) => Number(transaction.amount.replace(/[^\d]/g, ""));
type NewDemoTransaction = NativeTransactionDraft;
type DemoTransactionsContextValue = {
  transactions: DemoTransaction[];
  rawTransactions: NativeTransaction[];
  categories: DemoCategory[];
  financeLoading: boolean;
  financeError: string | null;
  financeRevision: number;
  invalidateFinancialSnapshots: () => void;
  notifications: DemoNotification[];
  notificationError: boolean;
  addTransaction: (transaction: NewDemoTransaction) => Promise<void>;
  updateTransaction: (id: string, transaction: NewDemoTransaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  refreshFinanceData: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  removeAllNotifications: () => void;
  retryNotificationLoad: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  showToast: (message: string, tone?: NativeToast["tone"]) => void;
};
const DemoTransactionsContext = createContext<DemoTransactionsContextValue | null>(null);
const MobileLanguageContext = createContext<MobileLanguage>("id");
const BackendOfflineContext = createContext(true);
const LANGUAGE_STORAGE_KEY = "cashflow.language";
const NATIVE_PUSH_TOKEN_STORAGE_KEY = "cashflow.native.push-token";
const NATIVE_PENDING_TRANSACTION_PREFIX = "native-pending-";
const dashboardSnapshots = new Map<string, DashboardSnapshot>();
const reportSnapshots = new Map<string, NativeReportPageData>();
const analyticsSnapshots = new Map<string, NativeAnalyticsPageData>();
const forecastSnapshots = new Map<string, NativeForecastPageData>();
const budgetSnapshots = new Map<string, DemoBudget[]>();
const goalSnapshots = new Map<string, DemoGoal[]>();
const investmentSnapshots = new Map<string, DemoInvestment[]>();

function clearFinancialSnapshots(userId: string) {
  dashboardSnapshots.delete(userId);
  reportSnapshots.forEach((_snapshot, key) => {
    if (key.startsWith(`${userId}:`)) reportSnapshots.delete(key);
  });
  analyticsSnapshots.forEach((_snapshot, key) => {
    if (key.startsWith(`${userId}:`)) analyticsSnapshots.delete(key);
  });
  forecastSnapshots.forEach((_snapshot, key) => {
    if (key.startsWith(`${userId}:`)) forecastSnapshots.delete(key);
  });
  budgetSnapshots.delete(userId);
  goalSnapshots.delete(userId);
  investmentSnapshots.delete(userId);
}

function withPendingTransactionSync(
  transactions: DemoTransaction[],
  records: NativeTransactionSyncRecord[],
): DemoTransaction[] {
  const recordsByEntity = new Map(records.map((record) => [record.entityId, record]));
  const serverTransactions = transactions
    .filter((transaction) =>
      !transaction.id.startsWith(NATIVE_PENDING_TRANSACTION_PREFIX)
      || recordsByEntity.get(transaction.id)?.action === "create",
    )
    .map((transaction) => {
      const record = recordsByEntity.get(transaction.id);
      if (!record) {
        const cleanTransaction = { ...transaction };
        delete cleanTransaction.syncState;
        return cleanTransaction;
      }
      return { ...transaction, syncState: record.failed ? "failed" as const : "pending" as const };
    });
  const localCreates = records
    .filter((record) =>
      record.action === "create"
      && record.draft
      && !serverTransactions.some((transaction) => transaction.id === record.entityId),
    )
    .map((record) => ({
      ...record.draft!,
      id: record.entityId,
      status: "completed" as const,
      syncState: record.failed ? "failed" as const : "pending" as const,
    }));
  return [...serverTransactions, ...localCreates].sort((left, right) =>
    right.dateISO.localeCompare(left.dateISO) || right.date.localeCompare(left.date),
  );
}

function isRetryableTransactionMutationError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  if (!(error instanceof Error)) return false;
  return error instanceof TypeError
    || error.name === "AbortError"
    || error.name === "TimeoutError"
    || error instanceof SyntaxError;
}

// Expo Go has no remote push support, so load the notification module only in native builds.
const Notifications: typeof NotificationsModule | null = isRunningInExpoGo()
  ? null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require("expo-notifications");
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
type DemoCategory = { id: string; name: string; label: string; type: "INCOME" | "EXPENSE"; description?: string; isSystem: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; color?: string };
type DemoBudget = { id: string; category: string; categoryId?: string; amount: number; spent: number; month: number; year: number };
type DemoGoal = { id: string; name: string; description: string; target: number; current: number; startDate: string; targetDate: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED"; category: string; categoryId?: string };
type DemoInvestment = { id: string; type: "Stock" | "Mutual Fund" | "Gold" | "Crypto" | "Bond" | "Deposit" | "Property" | "Other"; platform: string; name: string; symbol: string; quantity: number; averageBuyPrice: number; currentPrice: number; invested: number; currentValue: number; purchaseDate: string; notes: string; status: "ACTIVE" | "SOLD" | "CLOSED" };
type TransientDismissHandler = () => boolean;
const TransientDismissContext = createContext<(handler: TransientDismissHandler) => () => void>(() => () => {});
type TransientPopupRect = { left: number; top: number; right: number; bottom: number };
const TransientPopupRegionContext = createContext((_id: string, _rect: TransientPopupRect | null) => {});
const TransientPopupOutsideTouchContext = createContext((_x: number, _y: number) => {});
const TransientPopupDismissAllContext = createContext(() => {});

function Text({ children, ...props }: TextProps) {
  const language = useContext(MobileLanguageContext);
  const localizedChildren = localizeTextChildren(children, language);
  return <NativeText {...props}>{localizedChildren}</NativeText>;
}

function RawText(props: TextProps) {
  return <NativeText {...props} />;
}

function localizeTextChildren(children: ReactNode, language: MobileLanguage): ReactNode {
  if (!Array.isArray(children)) {
    return typeof children === "string" ? translateMobileText(children, language) : children;
  }

  const localized: ReactNode[] = [];
  let text = "";
  const flushText = () => {
    if (text) localized.push(translateMobileText(text, language));
    text = "";
  };

  children.forEach((child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += child;
    } else {
      flushText();
      localized.push(localizeTextChildren(child, language));
    }
  });
  flushText();
  return localized;
}

function TextInput({ placeholder, accessibilityLabel, ...props }: TextInputProps) {
  const language = useContext(MobileLanguageContext);
  return (
    <NativeTextInput
      {...props}
      placeholder={placeholder ? translateMobileText(placeholder, language) : placeholder}
      accessibilityLabel={accessibilityLabel ? translateMobileText(accessibilityLabel, language) : accessibilityLabel}
    />
  );
}

function formatGroupedInput(value: string, separator: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function formatNotificationRelativeTime(value: string, language: MobileLanguage) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return language === "en" ? "Just now" : "Baru saja";
  if (diff < hour) {
    const count = Math.floor(diff / minute);
    return language === "en" ? `${count}m ago` : `${count} mnt lalu`;
  }
  if (diff < day) {
    const count = Math.floor(diff / hour);
    return language === "en" ? `${count}h ago` : `${count} jam lalu`;
  }
  if (diff < 2 * day) return language === "en" ? "Yesterday" : "Kemarin";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeDecimalInput(value: string) {
  const digits = value.replace(/[^\d.]/g, "");
  const decimalIndex = digits.indexOf(".");
  return decimalIndex === -1
    ? digits
    : `${digits.slice(0, decimalIndex + 1)}${digits.slice(decimalIndex + 1).replace(/\./g, "")}`;
}

function NumericInput({ value, onChangeValue, mode = "grouped", separator, ...props }: Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeValue: (value: string) => void;
  mode?: "grouped" | "decimal";
  separator?: string;
}) {
  const language = useContext(MobileLanguageContext);
  const groupedValue = mode === "grouped"
    ? formatGroupedInput(value, separator ?? (language === "en" ? "," : "."))
    : value;
  const selectionRef = useRef({ start: groupedValue.length, end: groupedValue.length });
  const [selection, setSelection] = useState(() => ({ start: groupedValue.length, end: groupedValue.length }));

  const handleChange = (input: string) => {
    if (mode === "decimal") {
      onChangeValue(normalizeDecimalInput(input));
      return;
    }

    const previousDigits = groupedValue.replace(/[^\d]/g, "");
    const nextDigits = input.replace(/[^\d]/g, "");
    const previousCaret = groupedValue.slice(0, selectionRef.current.start).replace(/[^\d]/g, "").length;
    let commonPrefix = 0;
    while (commonPrefix < previousDigits.length && previousDigits[commonPrefix] === nextDigits[commonPrefix]) {
      commonPrefix += 1;
    }
    const digitDelta = nextDigits.length - previousDigits.length;
    const nextCaret = digitDelta >= 0
      ? Math.min(nextDigits.length, previousCaret + digitDelta)
      : Math.max(0, previousCaret + (previousCaret > commonPrefix ? digitDelta : 0));
    const nextDisplay = formatGroupedInput(nextDigits, separator ?? (language === "en" ? "," : "."));
    let displayCaret = 0;
    let digitsBeforeCaret = 0;
    while (displayCaret < nextDisplay.length) {
      if (/\d/.test(nextDisplay[displayCaret])) {
        digitsBeforeCaret += 1;
        if (digitsBeforeCaret === nextCaret) {
          displayCaret += 1;
          break;
        }
      }
      displayCaret += 1;
    }
    selectionRef.current = { start: displayCaret, end: displayCaret };
    setSelection(selectionRef.current);
    onChangeValue(nextDigits);
  };

  return <TextInput
    {...props}
    value={groupedValue}
    onChangeText={handleChange}
    onSelectionChange={(event) => {
      selectionRef.current = event.nativeEvent.selection;
    }}
    selection={mode === "grouped" ? selection : undefined}
    keyboardType={props.keyboardType ?? (mode === "decimal" ? "decimal-pad" : "number-pad")}
  />;
}

function Pressable({ accessibilityLabel, ...props }: PressableProps) {
  const language = useContext(MobileLanguageContext);
  return (
    <NativePressable
      {...props}
      accessibilityLabel={accessibilityLabel ? translateMobileText(accessibilityLabel, language) : accessibilityLabel}
    />
  );
}

function useTransientDismiss(handler: TransientDismissHandler) {
  const register = useContext(TransientDismissContext);
  useEffect(() => register(handler), [handler, register]);
}

function TransientPopupSurface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const popupRef = useRef<View>(null);
  const popupId = useId();
  const registerPopupRegion = useContext(TransientPopupRegionContext);
  const dismissAll = useContext(TransientPopupDismissAllContext);
  const language = useContext(MobileLanguageContext);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const updateAnchor = useCallback(() => {
    popupRef.current?.measureInWindow((left, top, width, height) => {
      if (width > 0 && height > 0) {
        const nextAnchor = { left, top, width, height };
        setAnchor(nextAnchor);
        registerPopupRegion(popupId, { left, top, right: left + width, bottom: top + height });
      }
    });
  }, [popupId, registerPopupRegion]);

  useEffect(() => () => registerPopupRegion(popupId, null), [popupId, registerPopupRegion]);

  return <>
    <View
      ref={popupRef}
      collapsable={false}
      onLayout={updateAnchor}
      pointerEvents="none"
      style={[style, styles.transientPopupAnchor]}
    >
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.transientPopupScroll}>
        {children}
      </ScrollView>
    </View>
    <Modal
      transparent
      visible={anchor !== null}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissAll}
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={language === "en" ? "Close options" : "Tutup pilihan"}
          onPress={dismissAll}
          style={StyleSheet.absoluteFill}
        />
        {anchor && <View
          accessibilityViewIsModal
          style={[
            style,
            {
              left: Math.max(8, Math.min(anchor.left, windowWidth - Math.min(anchor.width, windowWidth - 16) - 8)),
              top: Math.max(8, Math.min(anchor.top, windowHeight - anchor.height - 8)),
              width: Math.min(anchor.width, windowWidth - 16),
              maxHeight: Math.min(anchor.height, windowHeight - 16),
              position: "absolute",
              right: undefined,
              bottom: undefined,
            },
          ]}
        >
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.transientPopupScroll}>
            {children}
          </ScrollView>
        </View>}
      </View>
    </Modal>
  </>;
}

function PopupAwareScrollView(props: ScrollViewProps) {
  const dismissOutsidePopup = useContext(TransientPopupOutsideTouchContext);
  return <ScrollView
    {...props}
    onTouchStart={(event) => {
      props.onTouchStart?.(event);
      dismissOutsidePopup(event.nativeEvent.pageX, event.nativeEvent.pageY);
    }}
    onTouchMove={(event) => {
      props.onTouchMove?.(event);
      dismissOutsidePopup(event.nativeEvent.pageX, event.nativeEvent.pageY);
    }}
  />;
}

const monthOptions = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const oauthAvatarUrlPattern = /^https:\/\/(?:[a-z0-9-]+\.)*(?:googleusercontent|githubusercontent)\.com(?:[/:?#]|$)/i;
const formatBudgetMoney = (value: number, spaced = false) => `Rp${spaced ? " " : ""}${Math.round(value).toLocaleString("id-ID")}`;
const formatMobileDate = (value: string, language: MobileLanguage = "id") =>
  new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const showLocalizedAlert = (title: string, message: string, language: MobileLanguage) =>
  Alert.alert(translateMobileText(title, language), translateMobileText(message, language));
const localizedActionLabel = (action: "Lihat" | "Ubah" | "Hapus", name: string, language: MobileLanguage) =>
  `${language === "en" ? ({ Lihat: "View", Ubah: "Edit", Hapus: "Delete" }[action]) : action} ${name}`;
const formatTransactionDate = (transaction: DemoTransaction, language: MobileLanguage) => {
  const time = transaction.date.split("•")[1]?.trim();
  const localizedTime = language === "en" ? time?.replace(".", ":") : time;
  return `${formatMobileDate(transaction.dateISO, language)}${localizedTime ? ` • ${localizedTime}` : ""}`;
};
function toDemoCategory(category: NativeCategory): DemoCategory {
  const icon = category.icon && category.icon in MaterialCommunityIcons.glyphMap
    ? category.icon as keyof typeof MaterialCommunityIcons.glyphMap
    : "tag-outline";
  return {
    id: category.id,
    name: category.name,
    label: category.name,
    type: category.type,
    description: category.description ?? undefined,
    isSystem: category.is_system,
    icon,
    color: category.color ?? undefined,
  };
}
function toDemoTransaction(
  transaction: NativeTransaction,
  categoryNames: Map<string, string>,
  language: MobileLanguage,
  timeZone?: string | null,
): DemoTransaction {
  const amount = Number(transaction.amount_cents);
  const date = new Date(transaction.transaction_date);
  if (!Number.isFinite(amount) || Number.isNaN(date.getTime())) {
    throw new Error("The server returned an invalid transaction.");
  }
  const dateISO = formatInputDateInTimezone(date, timeZone);
  const time = new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
    timeZone: timeZone || undefined,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const income = transaction.transaction_type === "INCOME";
  return {
    id: transaction.id,
    date: `${formatMobileDate(dateISO, language)} • ${time}`,
    dateISO,
    category: categoryNames.get(transaction.category_id) ?? "Kategori tidak tersedia",
    categoryId: transaction.category_id,
    note: transaction.note ?? "",
    amount: `${income ? "+" : "-"}${formatBudgetMoney(amount, true)}`,
    income,
    status: "completed",
  };
}
function formatInputDateInTimezone(date: Date, timeZone?: string | null) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function inputDateTimeToIsoInTimezone(date: string, time: string, timeZone?: string | null) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  if (!timeZone) return new Date(desiredLocalAsUtc).toISOString();
  let instant = desiredLocalAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedLocalAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    instant += desiredLocalAsUtc - representedLocalAsUtc;
  }
  return new Date(instant).toISOString();
}
const investmentTypeSearchLabels: Record<string, string> = {
  Stock: "saham",
  "Mutual Fund": "reksa dana",
  Gold: "emas",
  Crypto: "kripto",
  Bond: "obligasi",
  Deposit: "deposito",
  Property: "properti",
  Other: "lainnya",
};
function useDemoTransactions() {
  const context = useContext(DemoTransactionsContext);
  if (!context) throw new Error("DemoTransactionsContext is missing.");
  return context;
}

const categoryEditorIcons: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
  { icon: "shopping-outline", label: "Belanja" },
  { icon: "car-outline", label: "Transportasi" },
  { icon: "home-outline", label: "Rumah" },
  { icon: "silverware-fork-knife", label: "Makanan" },
  { icon: "heart-pulse", label: "Kesehatan" },
  { icon: "school-outline", label: "Pendidikan" },
  { icon: "dumbbell", label: "Olahraga" },
  { icon: "gamepad-variant-outline", label: "Hiburan" },
  { icon: "briefcase-outline", label: "Bisnis" },
  { icon: "cash-multiple", label: "Pendapatan" },
  { icon: "gift-outline", label: "Hadiah" },
  { icon: "piggy-bank-outline", label: "Tabungan" },
  { icon: "tag-outline", label: "Lainnya" },
];
const categoryEditorColors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"];

const routes: { key: RouteKey; label: string; group: string }[] = [
  { key: "dashboard", label: "Beranda", group: "Utama" },
  { key: "incomes", label: "Pemasukan", group: "Transaksi" },
  { key: "expenses", label: "Pengeluaran", group: "Transaksi" },
  { key: "transactions", label: "Riwayat Transaksi", group: "Transaksi" },
  { key: "categories", label: "Kategori", group: "Transaksi" },
  { key: "budgets", label: "Anggaran", group: "Perencanaan" },
  { key: "goals", label: "Target Tabungan", group: "Perencanaan" },
  { key: "investments", label: "Investasi", group: "Perencanaan" },
  { key: "reports", label: "Laporan", group: "Analisis" },
  { key: "analytics", label: "Analitik", group: "Analisis" },
  { key: "forecast", label: "Perkiraan Keuangan", group: "Analisis" },
  { key: "notifications", label: "Notifikasi", group: "Sistem" },
  { key: "audit", label: "Log Aktivitas", group: "Sistem" },
  { key: "profile", label: "Profil", group: "Sistem" },
  { key: "settings", label: "Pengaturan", group: "Sistem" },
];

const routeAliases: Record<RouteKey, string[]> = {
  dashboard: ["home", "ringkasan", "summary", "dashboard"],
  incomes: ["income", "pendapatan", "incomes"],
  expenses: ["expense", "biaya", "expenses"],
  transactions: ["transaction", "transaksi", "mutasi", "transactions"],
  categories: ["category", "categories"],
  budgets: ["budget", "budgets"],
  goals: ["goal", "tabungan", "saving", "goals", "target"],
  investments: ["investment", "investments"],
  forecast: ["forecast", "proyeksi", "prediksi"],
  reports: ["report", "reports"],
  analytics: ["analytic", "analisis", "statistik"],
  notifications: ["notification", "pemberitahuan"],
  audit: ["audit", "audit log", "log", "riwayat aktivitas"],
  settings: ["setting", "konfigurasi", "settings"],
  profile: ["profile", "akun saya", "user"],
};

const routePaths: Record<RouteKey, string> = {
  dashboard: "/dashboard",
  incomes: "/incomes",
  expenses: "/expenses",
  transactions: "/transactions",
  categories: "/categories",
  budgets: "/budgets",
  goals: "/goals",
  investments: "/investments",
  forecast: "/forecast",
  reports: "/reports",
  analytics: "/analytics",
  notifications: "/notifications",
  audit: "/log-aktivitas",
  settings: "/settings",
  profile: "/profile",
};

function matchMobileMenuRoutes(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length < 2) return [];
  const matches = routes.map((route) => {
    const haystacks = [route.label.toLocaleLowerCase(), ...routeAliases[route.key], route.key, routePaths[route.key]];
    return {
      ...route,
      startsWithQuery: haystacks.some((value) => value.startsWith(normalized)),
      containsQuery: haystacks.some((value) => value.includes(normalized)),
    };
  });
  return [
    ...matches.filter((route) => route.startsWithQuery),
    ...matches.filter((route) => !route.startsWithQuery && route.containsQuery),
  ].slice(0, 6);
}

const drawerGroups: { title?: string; items: { key: RouteKey; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] }[] = [
  { items: [
    { key: "dashboard", label: "Beranda", icon: "home-outline" },
    { key: "incomes", label: "Pemasukan", icon: "arrow-down" },
    { key: "expenses", label: "Pengeluaran", icon: "arrow-up" },
    { key: "transactions", label: "Riwayat Transaksi", icon: "receipt-text-outline" },
    { key: "categories", label: "Kategori", icon: "folder-outline" },
    { key: "budgets", label: "Anggaran", icon: "chart-donut" },
    { key: "goals", label: "Target Tabungan", icon: "bullseye" },
    { key: "investments", label: "Investasi", icon: "trending-up" },
    { key: "reports", label: "Laporan", icon: "file-chart-outline" },
    { key: "analytics", label: "Analitik", icon: "chart-bar" },
    { key: "forecast", label: "Perkiraan Keuangan", icon: "creation-outline" },
    { key: "settings", label: "Pengaturan", icon: "cog-outline" },
  ] },
];

const bottomTabs: { key: RouteKey | "add"; label: string; icon: string }[] = [
  { key: "dashboard", label: "Beranda", icon: "home-outline" },
  { key: "transactions", label: "Transaksi", icon: "receipt-text-outline" },
  { key: "add", label: "Tambah", icon: "plus" },
  { key: "reports", label: "Laporan", icon: "chart-bar" },
  { key: "profile", label: "Profil", icon: "account-outline" },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const [route, setRoute] = useState<RouteKey>("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [userSettings, setUserSettings] = useState<NativeUserSettings | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [initialReset, setInitialReset] = useState<{ token: string; id: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<DemoTransaction | null>(null);
  const [transactionToView, setTransactionToView] = useState<DemoTransaction | null>(null);
  const [transactions, setTransactions] = useState<DemoTransaction[]>([]);
  const [rawTransactions, setRawTransactions] = useState<NativeTransaction[]>([]);
  const [syncQueueRecords, setSyncQueueRecords] = useState<NativeTransactionSyncRecord[]>([]);
  const [categories, setCategories] = useState<DemoCategory[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financeRevision, setFinanceRevision] = useState(0);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<DemoNotification[]>([]);
  const [notificationError, setNotificationError] = useState(false);
  const [toast, setToast] = useState<NativeToast | null>(null);
  const [language, setLanguage] = useState<MobileLanguage>("id");
  const authUserRef = useRef(authUser);
  const syncQueueRecordsRef = useRef(syncQueueRecords);
  const languageRef = useRef(language);
  const handledAuthLinks = useRef(new Set<string>());
  const notificationRefreshRef = useRef<() => Promise<void>>(async () => {});
  const optimisticTransactionSequence = useRef(0);
  const transactionSyncUserId = authUser?.id;
  const transactionSyncQueue = useMemo(
    () => transactionSyncUserId ? new NativeTransactionSyncQueue(transactionSyncUserId, AsyncStorage) : null,
    [transactionSyncUserId],
  );
  const publishSyncQueueRecords = useCallback((
    records: NativeTransactionSyncRecord[],
    ownerId: string | undefined = authUserRef.current?.id,
  ) => {
    if (ownerId !== authUserRef.current?.id) return;
    syncQueueRecordsRef.current = records;
    setSyncQueueRecords(records);
    setTransactions((current) => withPendingTransactionSync(current, records));
  }, []);
  const toastSequence = useRef(0);
  const showToast = useCallback((message: string, tone: NativeToast["tone"] = "success") => {
    setToast({ id: ++toastSequence.current, message, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);
  useEffect(() => {
    setNativeOfflineCacheScope(authUser?.id);
  }, [authUser?.id]);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  const invalidateFinancialSnapshots = useCallback(() => {
    const userId = authUserRef.current?.id;
    if (!userId) return;
    clearFinancialSnapshots(userId);
    setFinanceRevision((revision) => revision + 1);
  }, []);
  const restoreAuthSession = useCallback(async () => {
    if (!authUserRef.current) setAuthStatus("loading");
    setAuthError(null);
    let cachedUser: AuthUser | null = null;
    try {
      const tokens = await readAuthTokens();
      if (!tokens) {
        await clearAuthTokens();
        setAuthUser(null);
        setAuthStatus("signedOut");
        return;
      }
      cachedUser = await readCachedAuthUser();
      if (cachedUser) {
        setAuthUser(cachedUser);
        setAuthStatus("authenticated");
      }
      const user = await getAuthenticatedUser();
      try {
        await saveCachedAuthUser(user);
      } catch (error) {
        console.error("Could not cache the refreshed native account profile.", error);
      }
      setNotifications([]);
      setAuthUser(user);
      setAuthStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearAuthTokens();
        setAuthUser(null);
        setAuthStatus("signedOut");
        return;
      }
      if (cachedUser || authUserRef.current) {
        console.error("Could not refresh the active native account profile; keeping the current session.", error);
        return;
      }
      console.error("Failed to restore the native authentication session.", error);
      setAuthError(
        error instanceof Error
          ? error.message
          : translateMobileText("Gagal memuat sesi autentikasi.", languageRef.current),
      );
      setAuthStatus("error");
    }
  }, []);
  const saveUserSettings = useCallback(async (patch: NativeSettingsPatch) => {
    try {
      const response = await settingsApi.update(patch);
      if (!response.success || !response.data) {
        throw new Error("The server returned invalid user settings.");
      }
      setUserSettings(response.data);
      if (patch.theme !== undefined) setDarkMode(patch.theme === "dark");
      if (patch.language !== undefined) setLanguage(patch.language);
      return true;
    } catch (error) {
      console.error("Failed to save account settings.", error);
      Alert.alert(
        translateMobileText("Pengaturan tidak dapat disimpan.", language),
        error instanceof Error
          ? error.message
          : translateMobileText("Silakan coba lagi.", language),
      );
      return false;
    }
  }, [language]);
  const registerNativePush = useCallback(async (enabled: boolean) => {
    setPushSaving(true);
    setPushError(null);
    try {
      if (!enabled) {
        const token = await AsyncStorage.getItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
        if (token) await nativePushApi.remove(token);
        await AsyncStorage.removeItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
        setPushEnabled(false);
        return true;
      }
      if (!Notifications) {
        throw new Error(language === "en"
          ? "Push notifications require a native app build."
          : "Notifikasi push memerlukan build aplikasi native.");
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Neraca",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: "default",
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted") {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (permission.status !== "granted") {
        throw new Error(translateMobileText("Izin notifikasi perangkat ditolak.", language));
      }

      const configuredProjectId =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId ??
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      if (typeof configuredProjectId !== "string" || !configuredProjectId.trim()) {
        throw new Error(
          "Set EXPO_PUBLIC_EAS_PROJECT_ID or configure the EAS project ID before enabling remote notifications.",
        );
      }
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: configuredProjectId,
      })).data;
      await nativePushApi.register(
        token,
        Platform.OS === "ios" ? "ios" : "android",
      );
      try {
        await AsyncStorage.setItem(NATIVE_PUSH_TOKEN_STORAGE_KEY, token);
      } catch (error) {
        try {
          await nativePushApi.remove(token);
        } catch (cleanupError) {
          console.error("Could not unregister the native push token after local storage failed.", cleanupError);
        }
        throw error;
      }
      setPushEnabled(true);
      return true;
    } catch (error) {
      console.error("Failed to configure native push notifications.", error);
      const detail = error instanceof ApiError
        ? `${error.message} (HTTP ${error.status})`
        : error instanceof Error
          ? error.message
          : translateMobileText("Silakan coba lagi.", language);
      setPushError(detail);
      return false;
    } finally {
      setPushSaving(false);
    }
  }, [language]);
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let active = true;
    void settingsApi.get()
      .then(async (response) => {
        if (!active) return;
        if (!response.success || !response.data) {
          throw new Error("The server returned invalid user settings.");
        }
        setUserSettings(response.data);
        setDarkMode(response.data.theme === "dark");
        setLanguage(response.data.language);
        try {
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, response.data.language);
        } catch (error) {
          console.error("Could not cache the account language preference.", error);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Failed to load account settings.", error);
        Alert.alert(
          "Pengaturan akun tidak dapat dimuat.",
          error instanceof Error ? error.message : "Silakan coba lagi.",
        );
      });
    void AsyncStorage.getItem(NATIVE_PUSH_TOKEN_STORAGE_KEY)
      .then((token) => {
        if (active) setPushEnabled(Boolean(token));
      })
      .catch((error: unknown) => {
        if (active) console.error("Failed to read native push registration status.", error);
      });
    return () => {
      active = false;
    };
  }, [authStatus]);
  const handleNativeAuthLink = useCallback(async (url: string) => {
    if (handledAuthLinks.current.has(url)) return true;
    const parsed = Linking.parse(url);
    const path = [parsed.hostname, parsed.path]
      .filter(Boolean)
      .join("/")
      .replace(/^\/+|\/+$/g, "");
    if (path === "reset-password") {
      handledAuthLinks.current.add(url);
      try {
        await clearAuthTokens();
        setAuthUser(null);
        setAuthError(null);
        setInitialReset({
          token: typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : "",
          id: typeof parsed.queryParams?.id === "string" ? parsed.queryParams.id : "",
        });
        setAuthStatus("signedOut");
      } catch (error) {
        console.error("Failed to prepare the native password reset flow.", error);
        setAuthError(
          error instanceof Error
            ? error.message
            : translateMobileText("Gagal membuka tautan reset kata sandi.", languageRef.current),
        );
        setAuthStatus("error");
      }
      return true;
    }
    if (path !== "auth/callback") return false;
    handledAuthLinks.current.add(url);
    const accessToken = parsed.queryParams?.accessToken;
    const refreshToken = parsed.queryParams?.refreshToken;
    if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
      setAuthError(translateMobileText("Login Google gagal. Silakan coba lagi.", languageRef.current));
      setAuthStatus("signedOut");
      return true;
    }
    try {
      await saveAuthTokens({ accessToken, refreshToken });
      const cachedUser = await readCachedAuthUser();
      if (cachedUser) {
        setAuthUser(cachedUser);
        setInitialReset(null);
        setAuthError(null);
        setNotifications([]);
        setAuthStatus("authenticated");
        void getAuthenticatedUser()
          .then(async (user) => {
            try {
              await saveCachedAuthUser(user);
            } catch (error) {
              console.error("Could not cache the refreshed native account profile.", error);
            }
            setAuthUser(user);
          })
          .catch((error: unknown) => {
            console.error("Could not refresh the authenticated native profile.", error);
          });
        return true;
      }
      const user = await getAuthenticatedUser();
      try {
        await saveCachedAuthUser(user);
      } catch (error) {
        console.error("Could not cache the native account profile.", error);
      }
      setAuthUser(user);
      setInitialReset(null);
      setAuthError(null);
      setNotifications([]);
      setAuthStatus("authenticated");
    } catch (error) {
      await clearAuthTokens();
      console.error("Native OAuth callback could not establish a session.", error);
      setAuthError(
        error instanceof Error
          ? error.message
          : translateMobileText("Login Google gagal. Silakan coba lagi.", languageRef.current),
      );
      setAuthStatus("signedOut");
    }
    return true;
  }, []);
  const onAuthenticated = useCallback((user: AuthUser) => {
    setAuthUser(user);
    void saveCachedAuthUser(user).catch((error: unknown) => {
      console.error("Could not cache the native account profile.", error);
    });
    setInitialReset(null);
    setAuthError(null);
    setNotifications([]);
    setAuthStatus("authenticated");
  }, []);
  const onProfileChanged = useCallback((user: AuthUser) => {
    setAuthUser(user);
    void saveCachedAuthUser(user).catch((error: unknown) => {
      console.error("Could not cache the updated native account profile.", error);
    });
  }, []);
  const onPasswordReset = useCallback(() => {
    setAuthUser(null);
    setNotifications([]);
    setAuthStatus("signedOut");
  }, []);
  const handleLogout = useCallback(async () => {
    setLogoutLoading(true);
    let serverLogoutError: unknown = null;
    try {
      const pushToken = await AsyncStorage.getItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
      if (pushToken) {
        try {
          await nativePushApi.remove(pushToken);
        } catch (error) {
          console.error("Could not unregister the native push token before logout.", error);
        }
      }
      await AsyncStorage.removeItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
      setPushEnabled(false);
    } catch (error) {
      console.error("Could not clear native push registration during logout.", error);
      Alert.alert(
        translateMobileText("Sesi lokal sedang diakhiri.", language),
        error instanceof Error
          ? error.message
          : translateMobileText("Status notifikasi perangkat tidak dapat diperbarui.", language),
      );
    }
    try {
      await authApi.logout();
    } catch (error) {
      serverLogoutError = error;
      console.error("The server could not close the native session.", error);
    }
    try {
      await clearAuthTokens();
    } catch (error) {
      console.error("Could not securely clear native authentication tokens.", error);
      setAuthError(
        error instanceof Error
          ? error.message
          : translateMobileText("Sesi akun tidak dapat dihapus.", language),
      );
      setAuthStatus("error");
      setLogoutLoading(false);
      return;
    }
    if (authUser) clearFinancialSnapshots(authUser.id);
    setAuthUser(null);
    setPushError(null);
    setAuthStatus("signedOut");
    setLogoutLoading(false);
    if (serverLogoutError) {
      Alert.alert(
        translateMobileText("Sesi lokal sudah dihapus.", language),
        translateMobileText("Server tidak dapat mengakhiri sesi. Coba masuk kembali jika diperlukan.", language),
      );
    }
  }, [authUser, language]);
  const handleAccountDeleted = useCallback(async () => {
    if (authUser) clearFinancialSnapshots(authUser.id);
    setAuthUser(null);
    setUserSettings(null);
    setPushEnabled(false);
    setPushError(null);
    setNotifications([]);
    setAuthStatus("signedOut");
    setRoute("dashboard");
    const cleanup = await Promise.allSettled([
      AsyncStorage.removeItem(NATIVE_PUSH_TOKEN_STORAGE_KEY),
      clearAuthTokens(),
      transactionSyncQueue?.clear() ?? Promise.resolve(),
      authUser ? clearNativeOfflineCache(authUser.id) : Promise.resolve(),
    ]);
    const cleanupError = cleanup.find((result) => result.status === "rejected");
    if (cleanupError?.status === "rejected") {
      console.error("The account was deleted, but native local account data could not be cleared.", cleanupError.reason);
      Alert.alert(
        translateMobileText("Akun sudah dihapus.", language),
        translateMobileText("Data sesi di perangkat tidak dapat dibersihkan. Tutup dan buka kembali aplikasi.", language),
      );
    }
  }, [authUser, language, transactionSyncQueue]);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (authUserRef.current) clearFinancialSnapshots(authUserRef.current.id);
      setAuthUser(null);
      setNotifications([]);
      setAuthStatus("signedOut");
    });
    return () => setUnauthorizedHandler(null);
  }, []);
  useEffect(() => {
    let active = true;
    const processInitialUrl = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (active && url && await handleNativeAuthLink(url)) return;
        if (active) await restoreAuthSession();
      } catch (error) {
        if (!active) return;
        console.error("Failed to initialize native authentication.", error);
        setAuthError(
          error instanceof Error
            ? error.message
            : translateMobileText("Gagal memuat sesi autentikasi.", languageRef.current),
        );
        setAuthStatus("error");
      }
    };
    void processInitialUrl();
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleNativeAuthLink(url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleNativeAuthLink, restoreAuthSession]);
  const refreshFinanceData = useCallback(async () => {
    invalidateFinancialSnapshots();
    setFinanceLoading(true);
    setFinanceError(null);
    try {
      const [categoryResponse, transactionResponse] = await Promise.all([
        financeApi.listCategories(),
        financeApi.listTransactions(),
      ]);
      const categoryNames = new Map(categoryResponse.map((item) => [item.id, item.name]));
      const nextCategories = categoryResponse.filter((item) => item.is_active).map(toDemoCategory);
      const nextTransactions = transactionResponse
        .map((item) => toDemoTransaction(item, categoryNames, language, userSettings?.timezone))
        .sort((left, right) => right.dateISO.localeCompare(left.dateISO) || right.date.localeCompare(left.date));
      setCategories(nextCategories);
      setTransactions(withPendingTransactionSync(nextTransactions, syncQueueRecordsRef.current));
      setRawTransactions(transactionResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to load native finance data.", error);
      setFinanceError(message);
      Alert.alert(translateMobileText("Data keuangan tidak dapat dimuat.", language), message);
    } finally {
      setFinanceLoading(false);
    }
  }, [invalidateFinancialSnapshots, language, userSettings?.timezone]);
  const flushTransactionSync = useCallback(async (force = false) => {
    if (
      !transactionSyncQueue
      || !transactionSyncUserId
      || authUserRef.current?.id !== transactionSyncUserId
      || (!force && backendReachable === false)
    ) {
      return { succeeded: 0, records: syncQueueRecordsRef.current };
    }
    const result = await transactionSyncQueue.flush(async (record) => {
      switch (record.action) {
        case "create":
          if (!record.payload) throw new ApiError("Queued transaction data is invalid.", 400, null);
          await financeApi.createTransaction(record.payload);
          return;
        case "update":
          if (!record.payload) throw new ApiError("Queued transaction data is invalid.", 400, null);
          await financeApi.updateTransaction(record.entityId, record.payload);
          return;
        case "delete": {
          const response = await financeApi.removeTransaction(record.entityId);
          if (!response.success) {
            throw new ApiError("The server did not confirm the queued transaction deletion.", 500, response);
          }
          return;
        }
      }
    }, Date.now(), () => authUserRef.current?.id === transactionSyncUserId);
    publishSyncQueueRecords(result.records, transactionSyncUserId);
    if (result.succeeded > 0 && authUserRef.current?.id === transactionSyncUserId) {
      await refreshFinanceData();
    }
    return result;
  }, [backendReachable, publishSyncQueueRecords, refreshFinanceData, transactionSyncQueue, transactionSyncUserId]);
  const retryPendingSync = useCallback(async () => {
    if (!transactionSyncQueue || !transactionSyncUserId || authUserRef.current?.id !== transactionSyncUserId) return;
    try {
      const retriedRecords = await transactionSyncQueue.retryFailed();
      publishSyncQueueRecords(retriedRecords, transactionSyncUserId);
      const result = await flushTransactionSync();
      if (result.records.some((record) => record.failed)) {
        showToast(translateMobileText("Sinkronisasi gagal", language), "error");
      } else if (result.succeeded > 0 && result.records.length === 0) {
        showToast(translateMobileText("Transaksi tersinkron.", language));
      } else {
        showToast(translateMobileText("Perubahan transaksi menunggu koneksi.", language), "info");
      }
    } catch (error) {
      console.error("Could not retry native transaction sync.", error);
      Alert.alert(
        translateMobileText("Sinkronisasi gagal", language),
        error instanceof Error ? error.message : "Silakan coba lagi.",
      );
    }
  }, [flushTransactionSync, language, publishSyncQueueRecords, showToast, transactionSyncQueue, transactionSyncUserId]);
  const dismissFailedSync = useCallback(async () => {
    if (!transactionSyncQueue || !transactionSyncUserId || authUserRef.current?.id !== transactionSyncUserId) return;
    const failedRecords = syncQueueRecordsRef.current.filter((record) => record.failed);
    if (failedRecords.length === 0) return;
    Alert.alert(
      translateMobileText("Hapus dari antrean", language),
      translateMobileText("Hapus perubahan gagal dari antrean lokal? Perubahan tersebut tidak akan dikirim ke server.", language),
      [
        { text: translateMobileText("Batal", language), style: "cancel" },
        {
          text: translateMobileText("Hapus", language),
          style: "destructive",
          onPress: () => {
            void transactionSyncQueue.dismissFailed()
              .then((records) => publishSyncQueueRecords(records, transactionSyncUserId))
              .catch((error: unknown) => {
                console.error("Could not dismiss failed native transaction sync items.", error);
                Alert.alert(
                  translateMobileText("Sinkronisasi gagal", language),
                  error instanceof Error ? error.message : "Antrean transaksi lokal tidak dapat diperbarui.",
                );
              });
          },
        },
      ],
    );
  }, [language, publishSyncQueueRecords, transactionSyncQueue, transactionSyncUserId]);
  useEffect(() => {
    if (authStatus !== "authenticated" || !transactionSyncQueue) return;
    let active = true;
    void transactionSyncQueue.getRecords()
      .then((records) => {
        if (active) publishSyncQueueRecords(records, transactionSyncUserId);
      })
      .catch((error: unknown) => {
        console.error("Could not load the native transaction sync queue.", error);
        if (active) {
          Alert.alert(
            translateMobileText("Sinkronisasi gagal", languageRef.current),
            error instanceof Error ? error.message : "Antrean transaksi tersimpan tidak dapat dibaca.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [authStatus, publishSyncQueueRecords, transactionSyncQueue, transactionSyncUserId]);
  useEffect(() => {
    if (authStatus !== "authenticated" || !transactionSyncUserId) return;
    let active = true;
    let checking = false;
    const probe = async () => {
      if (checking) return;
      checking = true;
      let reachable = false;
      try {
        reachable = await checkApiConnectivity();
      } catch {
        reachable = false;
      } finally {
        checking = false;
      }
      if (!active || authUserRef.current?.id !== transactionSyncUserId) return;
      setBackendReachable(reachable);
      if (reachable && syncQueueRecordsRef.current.some((record) => !record.failed)) {
        void flushTransactionSync(true).catch((error: unknown) => {
          console.error("Native transaction sync failed after the backend became reachable.", error);
        });
      }
    };
    void probe();
    let interval: ReturnType<typeof setInterval> | undefined;
    const startInterval = () => {
      if (!interval) interval = setInterval(() => void probe(), 30_000);
    };
    const stopInterval = () => {
      if (interval) clearInterval(interval);
      interval = undefined;
    };
    if (AppState.currentState === "active") startInterval();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void probe();
        startInterval();
      } else {
        stopInterval();
      }
    });
    return () => {
      active = false;
      stopInterval();
      subscription.remove();
    };
  }, [authStatus, flushTransactionSync, transactionSyncUserId]);
  useEffect(() => {
    if (authStatus !== "authenticated" || !transactionSyncQueue) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const attemptSync = () => {
      void flushTransactionSync().catch((error: unknown) => {
        console.error("Automatic native transaction sync failed.", error);
        if (active) showToast(translateMobileText("Sinkronisasi gagal", languageRef.current), "error");
      });
    };
    const scheduleNextAttempt = (records: NativeTransactionSyncRecord[]) => {
      if (retryTimer) clearTimeout(retryTimer);
      const nextAttemptAt = records
        .filter((record) => !record.failed)
        .reduce((earliest, record) => Math.min(earliest, record.nextAttemptAt ?? Date.now()), Infinity);
      const delay = Number.isFinite(nextAttemptAt)
        ? Math.max(0, Math.min(30_000, nextAttemptAt - Date.now()))
        : 30_000;
      retryTimer = setTimeout(() => {
        if (AppState.currentState === "active") attemptSync();
        else scheduleNextAttempt(syncQueueRecordsRef.current);
      }, delay);
    };
    scheduleNextAttempt(syncQueueRecords);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !active) return;
      if (retryTimer) clearTimeout(retryTimer);
      attemptSync();
    });
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      subscription.remove();
    };
  }, [authStatus, flushTransactionSync, showToast, syncQueueRecords, transactionSyncQueue]);
  const refreshCategories = useCallback(async () => {
    const response = await financeApi.listCategories();
    setCategories(response.filter((item) => item.is_active).map(toDemoCategory));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => {
      if (authStatus === "authenticated") {
        return refreshFinanceData();
      }
      if (authStatus === "signedOut") {
        setTransactions([]);
        setRawTransactions([]);
        syncQueueRecordsRef.current = [];
        setSyncQueueRecords([]);
        setCategories([]);
        setFinanceError(null);
        setFinanceLoading(false);
      }
    });
  }, [authStatus, refreshFinanceData]);
  useEffect(() => {
    if (authStatus !== "authenticated" || !authUser) return;
    let wasInactive = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        wasInactive = true;
        return;
      }
      if (!wasInactive) return;
      wasInactive = false;
      void refreshFinanceData();
    });
    return () => subscription.remove();
  }, [authStatus, authUser, refreshFinanceData]);

  const transactionPayload = useCallback((transaction: NewDemoTransaction): NativeTransactionPayload => {
    const category = categories.find((item) =>
      item.name === transaction.category || item.label === transaction.category,
    );
    const amount = Number(transaction.amount.replace(/[^\d]/g, ""));
    const timeMatch = transaction.date.match(/(\d{1,2})[.:](\d{2})/);
    if (!category || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Pilih kategori aktif dan nominal transaksi yang valid.");
    }
    const time = timeMatch
      ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`
      : "00:00";
    return {
      category_id: category.id,
      transaction_type: transaction.income ? "INCOME" as const : "EXPENSE" as const,
      amount_cents: amount,
      transaction_date: inputDateTimeToIsoInTimezone(
        transaction.dateISO,
        time,
        userSettings?.timezone,
      ),
      ...(transaction.note.trim() ? { note: transaction.note.trim() } : {}),
    };
  }, [categories, userSettings]);
  const addTransaction = useCallback(async (transaction: NewDemoTransaction) => {
    const optimisticId = `${NATIVE_PENDING_TRANSACTION_PREFIX}${Date.now()}-${++optimisticTransactionSequence.current}`;
    const payload: NativeTransactionPayload = {
      ...transactionPayload(transaction),
      reference_number: optimisticId,
    };
    const optimisticTransaction: DemoTransaction = {
      ...transaction,
      id: optimisticId,
      status: "completed",
    };
    const typeLabel = transaction.income ? "pemasukan" : "pengeluaran";
    const amount = formatBudgetMoney(getTransactionAmount(transaction));
    const optimisticNotificationId = `local-${optimisticId}`;
    setTransactions((current) => [optimisticTransaction, ...current]);
    setNotifications((current) => [{
      id: optimisticNotificationId,
      title: `Transaksi ${typeLabel} baru`,
      message: `Transaksi ${typeLabel} tercatat sebesar ${amount}.`,
      createdAt: new Date().toISOString(),
      isRead: false,
    }, ...current]);
    try {
      const created = await financeApi.createTransaction(payload);
      const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
      const mapped = toDemoTransaction(created, categoryNames, language, userSettings?.timezone);
      setTransactions((current) => current
        .map((item) => item.id === optimisticId ? mapped : item)
        .sort((left, right) => right.dateISO.localeCompare(left.dateISO) || right.date.localeCompare(left.date)));
      setRawTransactions((current) => [created, ...current]);
      invalidateFinancialSnapshots();
      showToast(translateMobileText("Transaksi Berhasil", language));
      void notificationRefreshRef.current();
    } catch (error) {
      if (isRetryableTransactionMutationError(error) && transactionSyncQueue) {
        try {
          const records = await transactionSyncQueue.enqueue({
            action: "create",
            entityId: optimisticId,
            payload,
            draft: transaction,
          }, 1);
          publishSyncQueueRecords(records, transactionSyncUserId);
          showToast(translateMobileText("Perubahan transaksi menunggu koneksi.", language), "info");
          return;
        } catch (queueError) {
          console.error("Could not persist the pending native transaction.", queueError);
          setTransactions((current) => current.filter((item) => item.id !== optimisticId));
          setNotifications((current) => current.filter((item) => item.id !== optimisticNotificationId));
          throw new Error(`${translateMobileText("Transaksi tidak dapat disimpan.", language)} ${queueError instanceof Error ? queueError.message : "Antrean lokal tidak dapat disimpan."}`);
        }
      }
      setTransactions((current) => current.filter((item) => item.id !== optimisticId));
      setNotifications((current) => current.filter((item) => item.id !== optimisticNotificationId));
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to create native transaction.", error);
      throw new Error(`${translateMobileText("Transaksi tidak dapat disimpan.", language)} ${message}`);
    }
  }, [categories, invalidateFinancialSnapshots, language, publishSyncQueueRecords, showToast, transactionPayload, transactionSyncQueue, transactionSyncUserId, userSettings]);
  const updateTransaction = useCallback(async (id: string, transaction: NewDemoTransaction) => {
    const payload = transactionPayload(transaction);
    const previous = transactions.find((item) => item.id === id);
    const queuedMutation = syncQueueRecordsRef.current.find((record) => record.entityId === id);
    if (queuedMutation?.action === "delete") {
      throw new Error(translateMobileText("Transaksi sudah menunggu penghapusan.", language));
    }
    if (queuedMutation && transactionSyncQueue) {
      const records = await transactionSyncQueue.enqueue({
        action: "update",
        entityId: id,
        payload,
        draft: transaction,
      });
      publishSyncQueueRecords(records, transactionSyncUserId);
      setTransactions((current) => current.map((item) =>
        item.id === id
          ? queuedMutation.action === "create"
            ? { ...transaction, id, status: item.status, syncState: "pending" }
            : { ...item, syncState: "pending" }
          : item,
      ));
      invalidateFinancialSnapshots();
      showToast(translateMobileText("Perubahan transaksi menunggu koneksi.", language), "info");
      return;
    }
    if (previous) setTransactions((current) => current.map((item) =>
      item.id === id ? { ...transaction, id, status: item.status } : item,
    ));
    try {
      const updated = await financeApi.updateTransaction(id, payload);
      const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
      const mapped = toDemoTransaction(updated, categoryNames, language, userSettings?.timezone);
      setTransactions((current) => current
        .map((item) => item.id === id ? mapped : item)
        .sort((left, right) => right.dateISO.localeCompare(left.dateISO) || right.date.localeCompare(left.date)));
      setRawTransactions((current) => current.map((item) => item.id === id ? updated : item));
      invalidateFinancialSnapshots();
      showToast(translateMobileText("Transaksi berhasil diperbarui.", language));
    } catch (error) {
      if (isRetryableTransactionMutationError(error) && transactionSyncQueue) {
        if (previous) setTransactions((current) => current.map((item) => item.id === id ? previous : item));
        try {
          const records = await transactionSyncQueue.enqueue({
            action: "update",
            entityId: id,
            payload,
          }, 1);
          publishSyncQueueRecords(records, transactionSyncUserId);
          showToast(translateMobileText("Perubahan transaksi menunggu koneksi.", language), "info");
          return;
        } catch (queueError) {
          console.error("Could not persist the pending native transaction update.", queueError);
          throw new Error(`${translateMobileText("Transaksi tidak dapat diperbarui.", language)} ${queueError instanceof Error ? queueError.message : "Antrean lokal tidak dapat disimpan."}`);
        }
      }
      if (previous) setTransactions((current) => current.map((item) => item.id === id ? previous : item));
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to update native transaction.", error);
      throw new Error(`${translateMobileText("Transaksi tidak dapat diperbarui.", language)} ${message}`);
    }
  }, [categories, invalidateFinancialSnapshots, language, publishSyncQueueRecords, showToast, transactionPayload, transactionSyncQueue, transactionSyncUserId, transactions, userSettings]);
  const removeTransaction = useCallback(async (id: string) => {
    const queuedMutation = syncQueueRecordsRef.current.find((record) => record.entityId === id);
    if (queuedMutation?.action === "create" && transactionSyncQueue) {
      const records = await transactionSyncQueue.enqueue({ action: "delete", entityId: id, payload: null });
      publishSyncQueueRecords(records, transactionSyncUserId);
      setTransactions((current) => current.filter((item) => item.id !== id));
      setNotifications((current) => current.filter((item) => item.id !== `local-${id}`));
      invalidateFinancialSnapshots();
      return;
    }
    if (queuedMutation?.action === "delete") return;
    try {
      const response = await financeApi.removeTransaction(id);
      if (!response.success) {
        throw new ApiError("The server could not delete the transaction.", 500, response);
      }
      setTransactions((current) => current.filter((item) => item.id !== id));
      setRawTransactions((current) => current.filter((item) => item.id !== id));
      invalidateFinancialSnapshots();
    } catch (error) {
      if (isRetryableTransactionMutationError(error) && transactionSyncQueue) {
        try {
          const records = await transactionSyncQueue.enqueue({
            action: "delete",
            entityId: id,
            payload: null,
          }, 1);
          publishSyncQueueRecords(records, transactionSyncUserId);
          showToast(translateMobileText("Perubahan transaksi menunggu koneksi.", language), "info");
          return;
        } catch (queueError) {
          console.error("Could not persist the pending native transaction deletion.", queueError);
          Alert.alert(
            translateMobileText("Transaksi tidak dapat dihapus.", language),
            queueError instanceof Error ? queueError.message : "Antrean lokal tidak dapat disimpan.",
          );
          return;
        }
      }
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to delete native transaction.", error);
      Alert.alert(translateMobileText("Transaksi tidak dapat dihapus.", language), message);
    }
  }, [invalidateFinancialSnapshots, language, publishSyncQueueRecords, showToast, transactionSyncQueue, transactionSyncUserId]);
  const loadNotifications = useCallback(async () => {
    try {
      const response = await notificationApi.list();
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error("The server returned an invalid notifications response.");
      }
      const loadedNotifications = response.data.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        createdAt: item.created_at,
        isRead: item.is_read,
      }));
      setNotifications((current) => [
        ...loadedNotifications,
        ...current.filter((item) =>
          item.id.startsWith("local-") &&
          !loadedNotifications.some((loaded) =>
            loaded.title === item.title &&
            loaded.message.replace(/\D/g, "") === item.message.replace(/\D/g, ""),
          ),
        ),
      ]);
      setNotificationError(false);
    } catch (error) {
      console.error("Failed to load native notifications.", error);
      setNotificationError(true);
    }
  }, []);
  useEffect(() => {
    notificationRefreshRef.current = loadNotifications;
  }, [loadNotifications]);
  const retryNotificationLoad = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void Promise.resolve().then(loadNotifications);
  }, [authStatus, loadNotifications]);
  useEffect(() => {
    if (authStatus !== "authenticated" || route !== "notifications") return;
    void Promise.resolve().then(loadNotifications);
  }, [authStatus, loadNotifications, route]);
  const runNotificationAction = useCallback(async (
    action: () => Promise<unknown>,
    updateLocal: () => void,
  ) => {
    try {
      await action();
      updateLocal();
      setNotificationError(false);
    } catch (error) {
      console.error("Failed to update a native notification.", error);
      setNotificationError(true);
      Alert.alert(
        translateMobileText("Notifikasi tidak dapat diperbarui.", language),
        error instanceof Error
          ? error.message
          : translateMobileText("Silakan coba lagi.", language),
      );
    }
  }, [language]);
  const markNotificationRead = useCallback((id: string) => {
    if (id.startsWith("local-")) {
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
      return;
    }
    void runNotificationAction(
      () => notificationApi.markRead(id),
      () => setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item)),
    );
  }, [runNotificationAction]);
  const markAllNotificationsRead = useCallback(() => {
    void runNotificationAction(
      () => notificationApi.markAllRead(),
      () => setNotifications((current) => current.map((item) => item.isRead ? item : { ...item, isRead: true })),
    );
  }, [runNotificationAction]);
  const removeNotification = useCallback((id: string) => {
    if (id.startsWith("local-")) {
      setNotifications((current) => current.filter((item) => item.id !== id));
      return;
    }
    void runNotificationAction(
      () => notificationApi.remove(id),
      () => setNotifications((current) => current.filter((item) => item.id !== id)),
    );
  }, [runNotificationAction]);
  const removeAllNotifications = useCallback(() => {
    void runNotificationAction(
      () => notificationApi.removeAll(),
      () => setNotifications([]),
    );
  }, [runNotificationAction]);
  const pendingSyncCount = syncQueueRecords.filter((record) => !record.failed).length;
  const failedSyncCount = syncQueueRecords.filter((record) => record.failed).length;
  const transactionContext = useMemo(() => ({
    transactions,
    rawTransactions,
    categories,
    financeLoading,
    financeError,
    financeRevision,
    invalidateFinancialSnapshots,
    notifications,
    notificationError,
    addTransaction,
    updateTransaction,
    removeTransaction,
    refreshFinanceData,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    removeAllNotifications,
    retryNotificationLoad,
    refreshCategories,
    showToast,
  }), [addTransaction, categories, financeError, financeLoading, financeRevision, invalidateFinancialSnapshots, markAllNotificationsRead, markNotificationRead, notificationError, notifications, rawTransactions, refreshCategories, refreshFinanceData, removeAllNotifications, removeNotification, removeTransaction, retryNotificationLoad, showToast, transactions, updateTransaction]);
  const changeLanguage = useCallback(async (nextLanguage: MobileLanguage) => {
    if (!await saveUserSettings({ language: nextLanguage })) return;
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.error("Could not cache the saved account language.", error);
      Alert.alert(
        translateMobileText("Bahasa sudah tersimpan di akun.", nextLanguage),
        error instanceof Error
          ? error.message
          : translateMobileText("Preferensi lokal tidak dapat diperbarui.", nextLanguage),
      );
    }
  }, [saveUserSettings]);
  const changeTheme = useCallback((dark: boolean) => {
    void saveUserSettings({ theme: dark ? "dark" : "light" });
  }, [saveUserSettings]);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((storedLanguage) => {
        if (active && (storedLanguage === "id" || storedLanguage === "en")) {
          setLanguage(storedLanguage);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load the language preference.", error);
        Alert.alert(
          translateMobileText("Gagal memuat pengaturan.", "id"),
          translateMobileText("Bahasa aplikasi tidak dapat dimuat.", "id"),
        );
      });
    return () => {
      active = false;
    };
  }, []);
  const transientDismissers = useRef(new Set<TransientDismissHandler>());
  const transientPopupRegions = useRef(new Map<string, TransientPopupRect>());
  const registerTransientDismiss = useCallback((handler: TransientDismissHandler) => {
    transientDismissers.current.add(handler);
    return () => {
      transientDismissers.current.delete(handler);
    };
  }, []);
  const registerTransientPopupRegion = useCallback((id: string, rect: TransientPopupRect | null) => {
    if (rect) transientPopupRegions.current.set(id, rect);
    else transientPopupRegions.current.delete(id);
  }, []);
  const dismissTransientUi = useCallback(() => {
    const hadHeaderSearch = headerSearchOpen;
    let hadTransientUi = false;
    transientDismissers.current.forEach((dismiss) => {
      hadTransientUi = dismiss() || hadTransientUi;
    });
    if (hadHeaderSearch) setHeaderSearchOpen(false);
    return hadHeaderSearch || hadTransientUi;
  }, [headerSearchOpen]);
  const dismissTransientUiOutsidePopup = useCallback((x: number, y: number) => {
    const insidePopup = [...transientPopupRegions.current.values()].some((rect) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
    if (!insidePopup) dismissTransientUi();
  }, [dismissTransientUi]);
  useEffect(() => {
    if (Platform.OS !== "android" || !Notifications) return;
    void Notifications.setNotificationChannelAsync("default", {
      name: "Neraca",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    }).catch((error: unknown) => {
      console.error("Could not configure the Android notification channel.", error);
    });
  }, []);
  const handleBack = useCallback(() => {
    if (dismissTransientUi()) return true;
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    if (addOpen) {
      setAddOpen(false);
      setTransactionToEdit(null);
      return true;
    }
    if (transactionToView) {
      setTransactionToView(null);
      return true;
    }
    if (route !== "dashboard") {
      setRoute("dashboard");
      return true;
    }
    return false;
  }, [addOpen, dismissTransientUi, drawerOpen, route, transactionToView]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => subscription.remove();
  }, [handleBack]);
  const navigateToRoute = useCallback((next: RouteKey) => {
    dismissTransientUi();
    setRoute(next);
  }, [dismissTransientUi]);
  const navigateToTab = useCallback((next: RouteKey) => {
    dismissTransientUi();
    setRoute(next);
  }, [dismissTransientUi]);
  const handledNotificationResponses = useRef(new Set<string>());
  useEffect(() => {
    if (!Notifications) return;
    const handleResponse = (response: NotificationsModule.NotificationResponse) => {
      if (authStatus !== "authenticated") return;
      const identifier = response.notification.request.identifier;
      if (handledNotificationResponses.current.has(identifier)) return;
      handledNotificationResponses.current.add(identifier);
      if (response.notification.request.content.data?.route === "notifications") {
        navigateToTab("notifications");
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch((error: unknown) => {
        console.error("Could not read the last notification response.", error);
      });
    return () => subscription.remove();
  }, [authStatus, navigateToTab]);
  const openAddTransaction = () => {
    setTransactionToEdit(null);
    setAddOpen(true);
  };
  const openEditTransaction = (transaction: DemoTransaction) => {
    setTransactionToEdit(transaction);
    setAddOpen(true);
  };
  const openViewTransaction = (transaction: DemoTransaction) => {
    setTransactionToView(transaction);
  };
  const closeTransactionForm = () => {
    setAddOpen(false);
    setTransactionToEdit(null);
  };
  const palette = useMemo<Palette>(() => (darkMode ? themes.dark : themes.light), [darkMode]);
  const insets = useSafeAreaInsets();
  const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;

  if (authStatus === "loading") {
    return (
      <SafeAreaView style={[styles.safe, styles.launchScreen, { backgroundColor: palette.background }]}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        <Image
          accessibilityLabel="Neraca"
          source={require("./assets/neraca-splash.png")}
          resizeMode="contain"
          style={styles.launchMark}
        />
      </SafeAreaView>
    );
  }

  if (authStatus === "error") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        <View style={styles.content}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Sesi akun tidak dapat dimuat</Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>{authError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void restoreAuthSession()}
            style={[styles.primaryButton, { backgroundColor: palette.accent, alignSelf: "flex-start" }]}
          >
            <Text style={{ color: palette.accentText, fontWeight: "700" }}>Coba lagi</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (authStatus === "signedOut") {
    return (
      <MobileLanguageContext.Provider value={language}>
        <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
          <StatusBar style={darkMode ? "light" : "dark"} />
          <AuthScreen
            key={`${initialReset?.token ?? ""}:${initialReset?.id ?? ""}:${authError ?? ""}`}
            darkMode={darkMode}
            language={language}
            initialReset={initialReset}
            initialError={authError}
            onAuthenticated={onAuthenticated}
            onPasswordReset={onPasswordReset}
            onDeepLink={(url) => { void handleNativeAuthLink(url); }}
          />
        </SafeAreaView>
      </MobileLanguageContext.Provider>
    );
  }

  if (!authUser) {
    return (
      <SafeAreaView style={[styles.safe, styles.launchScreen, { backgroundColor: palette.background }]}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        <Image
          accessibilityLabel="Neraca"
          source={require("./assets/neraca-splash.png")}
          resizeMode="contain"
          style={styles.launchMark}
        />
      </SafeAreaView>
    );
  }

  return (
    <MobileLanguageContext.Provider value={language}>
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <DemoTransactionsContext.Provider value={transactionContext}>
      <TransientDismissContext.Provider value={registerTransientDismiss}>
      <TransientPopupRegionContext.Provider value={registerTransientPopupRegion}>
      <TransientPopupOutsideTouchContext.Provider value={dismissTransientUiOutsidePopup}>
      <TransientPopupDismissAllContext.Provider value={dismissTransientUi}>
      <View style={styles.screen}>
        <Header palette={palette} user={authUser} notificationItems={notifications} unreadNotificationCount={unreadNotificationCount} searchOpen={headerSearchOpen} onSearchOpenChange={setHeaderSearchOpen} onDismissTransient={dismissTransientUi} onNavigate={navigateToRoute} onMenu={() => { dismissTransientUi(); setDrawerOpen(true); }} onNotifications={() => navigateToRoute("notifications")} onMarkAllNotificationsRead={markAllNotificationsRead} onProfile={() => navigateToRoute("profile")} onSettings={() => navigateToRoute("settings")} />
        {(backendReachable === false || syncQueueRecords.length > 0) && <View
          accessibilityRole="summary"
          style={[styles.nativeSyncBanner, { backgroundColor: palette.muted, borderColor: palette.border }]}
        >
          <MaterialCommunityIcons
            name={backendReachable === false ? "cloud-off-outline" : failedSyncCount > 0 ? "alert-circle-outline" : "cloud-sync-outline"}
            size={18}
            color={backendReachable === false || failedSyncCount > 0 ? palette.warning : palette.accent}
          />
          <View style={styles.nativeSyncBannerCopy}>
            {backendReachable === false
              ? <Text style={[styles.nativeSyncBannerText, { color: palette.text }]}>{translateMobileText("Koneksi ke server terputus.", language)}</Text>
              : failedSyncCount > 0
                ? <Text style={[styles.nativeSyncBannerText, { color: palette.text }]}>{failedSyncCount} • {translateMobileText("Sinkronisasi gagal", language)}</Text>
                : <Text style={[styles.nativeSyncBannerText, { color: palette.text }]}>{translateMobileText("Menyinkronkan transaksi...", language)}</Text>}
            {pendingSyncCount > 0 && <Text style={[styles.nativeSyncBannerDetail, { color: palette.secondaryText }]}>
              {pendingSyncCount} {translateMobileText("transaksi menunggu sinkronisasi.", language)}
            </Text>}
            {backendReachable === false && <Text style={[styles.nativeSyncBannerDetail, { color: palette.secondaryText }]}>{translateMobileText("Periksa koneksi lalu tunggu server dapat dijangkau kembali.", language)}</Text>}
          </View>
          {failedSyncCount > 0 && <View style={styles.nativeSyncBannerActions}>
            <Pressable accessibilityRole="button" onPress={() => { void retryPendingSync(); }} style={[styles.nativeSyncAction, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <Text style={[styles.nativeSyncBannerText, { color: palette.text }]}>{translateMobileText("Coba sinkronkan lagi", language)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void dismissFailedSync()} style={[styles.nativeSyncAction, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <Text style={[styles.nativeSyncBannerText, { color: palette.text }]}>{translateMobileText("Hapus dari antrean", language)}</Text>
            </Pressable>
          </View>}
        </View>}
        <View
          style={styles.pageContent}
          onTouchStart={(event) => dismissTransientUiOutsidePopup(event.nativeEvent.pageX, event.nativeEvent.pageY)}
        >
          <BackendOfflineContext.Provider value={backendReachable !== true}>
            {route === "dashboard" ? (
              <Dashboard key={authUser.id} palette={palette} userId={authUser.id} displayName={authUser.full_name?.trim() || authUser.username?.trim() || authUser.email} onNavigate={navigateToRoute} />
            ) : (
              <FeaturePage route={route} palette={palette} onNavigate={navigateToRoute} onAddTransaction={openAddTransaction} onEditTransaction={openEditTransaction} onViewTransaction={openViewTransaction} onThemeChange={changeTheme} onLanguageChange={changeLanguage} language={language} user={authUser} onUserChange={onProfileChanged} onLogout={handleLogout} onAccountDeleted={handleAccountDeleted} logoutLoading={logoutLoading} userSettings={userSettings} onSettingsChange={saveUserSettings} pushEnabled={pushEnabled} pushError={pushError} onPushEnabledChange={registerNativePush} pushSaving={pushSaving} />
            )}
          </BackendOfflineContext.Provider>
        </View>
        <View style={[styles.bottomNav, { backgroundColor: palette.background, borderColor: palette.border, paddingBottom: Math.max(insets.bottom, 2) }]}>
          {bottomTabs.map((tab) => {
            const selected = addOpen ? tab.key === "add" : route === tab.key;
            const isAddAction = tab.key === "add";
            return <Pressable key={tab.key} accessibilityRole={isAddAction ? "button" : "tab"} accessibilityLabel={tab.label} accessibilityState={{ selected }} onPress={() => { if (tab.key === "add") { dismissTransientUi(); setTransactionToEdit(null); setAddOpen(true); } else navigateToTab(tab.key); }} style={({ pressed }) => [styles.navItem, isAddAction && styles.navAddItem, pressed && styles.navItemPressed]}>
              <View style={[
                styles.navIconWrap,
                isAddAction ? styles.navAddIcon : undefined,
                isAddAction && { backgroundColor: palette.accent },
              ]}>
                <MaterialCommunityIcons name={tab.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={isAddAction ? 25 : 20} color={isAddAction ? palette.accentText : selected ? palette.accent : palette.secondaryText} />
              </View>
              <Text style={[styles.navText, { color: isAddAction ? palette.accent : selected ? palette.accent : palette.secondaryText }]}>{tab.label}</Text>
            </Pressable>;
          })}
        </View>
        {toast && <View pointerEvents="none" style={styles.toastRegion}>
          <View accessibilityRole="alert" style={[styles.toast, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <MaterialCommunityIcons
              name={toast.tone === "error" ? "alert-circle" : toast.tone === "info" ? "progress-clock" : "check-circle"}
              size={19}
              color={toast.tone === "error" ? palette.expenseAmount : toast.tone === "info" ? palette.info : palette.incomeAmount}
            />
            <Text style={[styles.toastText, { color: palette.text }]}>{toast.message}</Text>
          </View>
        </View>}
      </View>
      <Drawer open={drawerOpen} route={route} palette={palette} onClose={() => setDrawerOpen(false)} onNavigate={(next) => { navigateToRoute(next); setDrawerOpen(false); }} />
      <AddTransactionModal open={addOpen} palette={palette} initialTransaction={transactionToEdit} onClose={closeTransactionForm} />
      <TransactionDetailModal transaction={transactionToView} palette={palette} onClose={() => setTransactionToView(null)} />
      </TransientPopupDismissAllContext.Provider>
      </TransientPopupOutsideTouchContext.Provider>
      </TransientPopupRegionContext.Provider>
      </TransientDismissContext.Provider>
      </DemoTransactionsContext.Provider>
    </SafeAreaView>
    </MobileLanguageContext.Provider>
  );
}

function Header({ palette, user, notificationItems, unreadNotificationCount, searchOpen, onSearchOpenChange, onDismissTransient, onNavigate, onMenu, onNotifications, onMarkAllNotificationsRead, onProfile, onSettings }: { palette: Palette; user: AuthUser; notificationItems: DemoNotification[]; unreadNotificationCount: number; searchOpen: boolean; onSearchOpenChange: (open: boolean) => void; onDismissTransient: () => void; onNavigate: (route: RouteKey) => void; onMenu: () => void; onNotifications: () => void; onMarkAllNotificationsRead: () => void; onProfile: () => void; onSettings: () => void }) {
  const language = useContext(MobileLanguageContext);
  const { width: viewportWidth } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailedUrl, setAvatarFailedUrl] = useState<string | null>(null);
  const userName = user.full_name || user.username || user.email;
  const userInitials = userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const avatarUrl = user.avatar_url && oauthAvatarUrlPattern.test(user.avatar_url) ? user.avatar_url : null;
  const notificationMenuWidth = Math.min(300, viewportWidth - 24);
  const menuMatches = useMemo(() => matchMobileMenuRoutes(query), [query]);
  const dismissHeaderMenus = useCallback(() => {
    const wasOpen = notificationOpen || profileOpen;
    setNotificationOpen(false);
    setProfileOpen(false);
    return wasOpen;
  }, [notificationOpen, profileOpen]);
  useTransientDismiss(dismissHeaderMenus);
  const closeSearch = useCallback(() => {
    setQuery("");
    onSearchOpenChange(false);
  }, [onSearchOpenChange]);

  const navigateToMatch = (route: RouteKey) => {
    closeSearch();
    onNavigate(route);
  };
  const openSearch = () => {
    onDismissTransient();
    setQuery("");
    onSearchOpenChange(true);
  };
  const markAllNotificationsRead = () => {
    onMarkAllNotificationsRead();
    setNotificationOpen(false);
  };
  const toggleNotifications = () => {
    const wasOpen = notificationOpen;
    onDismissTransient();
    if (!wasOpen) setNotificationOpen(true);
  };
  const toggleProfile = () => {
    const wasOpen = profileOpen;
    onDismissTransient();
    if (!wasOpen) setProfileOpen(true);
  };

  return (
    <View style={[styles.header, { borderBottomColor: palette.border, zIndex: searchOpen ? 30 : 1, elevation: searchOpen ? 12 : 0 }]}>
      {searchOpen ? (
        <View style={[styles.globalSearch, { borderColor: palette.border, backgroundColor: palette.background }]}>
          <MaterialCommunityIcons name="magnify" size={19} color={palette.secondaryText} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              if (menuMatches[0]) navigateToMatch(menuMatches[0].key);
            }}
            placeholder="Cari menu..."
            placeholderTextColor={palette.secondaryText}
            style={[styles.globalSearchInput, { color: palette.text }]}
            accessibilityLabel="Cari menu"
            returnKeyType="search"
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Tutup pencarian menu" onPress={closeSearch} style={styles.globalSearchClose}>
            <MaterialCommunityIcons name="close" size={18} color={palette.secondaryText} />
          </Pressable>
          {menuMatches.length > 0 && <ScrollView
            style={[styles.globalSearchResults, { backgroundColor: palette.popover, borderColor: palette.border }]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            accessibilityRole="list"
            accessibilityLabel="Hasil menu"
          >
            {menuMatches.map((item) => {
              const drawerItem = drawerGroups.flatMap((group) => group.items).find((entry) => entry.key === item.key);
              return <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => navigateToMatch(item.key)}
                style={[styles.globalSearchResult, { borderBottomColor: palette.border }]}
              >
                {drawerItem && <MaterialCommunityIcons name={drawerItem.icon} size={19} color={palette.accent} />}
                <Text numberOfLines={1} style={[styles.globalSearchResultText, { color: palette.text }]}>{item.label}</Text>
              </Pressable>;
            })}
          </ScrollView>}
          {query.trim().length >= 2 && menuMatches.length === 0 && <View style={[styles.globalSearchResults, styles.globalSearchEmpty, { backgroundColor: palette.popover, borderColor: palette.border }]}><Text style={{ color: palette.secondaryText }}>Tidak ada menu yang cocok</Text></View>}
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Buka menu navigasi" onPress={onMenu} style={styles.iconButton}><MaterialCommunityIcons name="menu" size={22} color={palette.text} /></Pressable>
      )}
      <View style={styles.headerActions}>
        {!searchOpen && <Pressable accessibilityRole="button" accessibilityLabel="Pencarian menu" onPress={openSearch} style={styles.iconButton}><MaterialCommunityIcons name="magnify" size={22} color={palette.text} /></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Notifikasi" onPress={toggleNotifications} style={styles.iconButton}><MaterialCommunityIcons name="bell-outline" size={20} color={palette.text} />{unreadNotificationCount > 0 && <View style={styles.notificationDot}><Text style={styles.notificationCount}>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</Text></View>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Profil" onPress={toggleProfile} style={styles.avatar}>
          <View style={[styles.avatarCircle, { backgroundColor: palette.accent }]}>
            {avatarUrl && avatarFailedUrl !== avatarUrl
              ? <Image accessibilityLabel="Foto profil" source={{ uri: avatarUrl }} onError={() => setAvatarFailedUrl(avatarUrl)} style={styles.avatarImage} />
              : <Text style={{ color: palette.accentText, fontSize: 13, fontWeight: "700" }}>{userInitials}</Text>}
          </View>
        </Pressable>
      </View>
      {notificationOpen && <View style={[styles.headerMenu, { backgroundColor: palette.surface, borderColor: palette.border, width: notificationMenuWidth }]}>
        <Text style={[styles.menuHeading, { color: palette.text }]}>Notifikasi</Text>
        <View style={[styles.menuDivider, { backgroundColor: palette.border }]} />
        {notificationItems.length ? notificationItems.slice(0, 5).map((item) => {
          const relativeTime = formatNotificationRelativeTime(item.createdAt, language);
          return <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}${relativeTime ? `, ${relativeTime}` : ""}`}
            accessibilityHint={language === "en" ? "Open all notifications" : "Buka semua notifikasi"}
            onPress={onNotifications}
            style={styles.notificationPreview}
          >
            <View style={styles.notificationPreviewTitle}>
              {!item.isRead && <View style={[styles.notificationPreviewUnreadDot, { backgroundColor: palette.accent }]} />}
              <Text numberOfLines={1} style={[styles.menuItemTitle, styles.notificationPreviewTitleText, { color: palette.text }]}>{item.title}</Text>
            </View>
            {relativeTime ? <Text style={[styles.menuItemMeta, { color: palette.secondaryText }]}>{relativeTime}</Text> : null}
          </Pressable>;
        }) : <Text style={[styles.menuItemMeta, { color: palette.secondaryText, paddingHorizontal: 12, paddingVertical: 14 }]}>Belum ada notifikasi.</Text>}
        {unreadNotificationCount > 0 && <Pressable
          accessibilityRole="button"
          onPress={markAllNotificationsRead}
          style={styles.notificationMenuAction}
        >
          <Text style={{ color: palette.accent }}>Tandai semua dibaca</Text>
        </Pressable>}
        <View style={[styles.menuDivider, { backgroundColor: palette.border }]} />
        <Pressable accessibilityRole="button" onPress={onNotifications} style={styles.notificationMenuAction}><Text style={{ color: palette.accent }}>Lihat Semua</Text></Pressable>
      </View>}
      {profileOpen && <View style={[styles.headerMenu, styles.profileMenu, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.menuItemTitle, { color: palette.text }]}>{userName}</Text>
        <Text style={[styles.menuItemMeta, { color: palette.secondaryText }]}>{user.email}</Text>
        <View style={[styles.menuDivider, { backgroundColor: palette.border }]} />
        <Pressable onPress={onProfile} style={styles.menuRow}><MaterialCommunityIcons name="account-outline" size={18} color={palette.secondaryText} /><Text style={{ color: palette.text }}>Profil</Text></Pressable>
        <Pressable onPress={() => { setProfileOpen(false); onSettings(); }} style={styles.menuRow}><MaterialCommunityIcons name="cog-outline" size={18} color={palette.secondaryText} /><Text style={{ color: palette.text }}>Pengaturan</Text></Pressable>
      </View>}
    </View>
  );
}

function Dashboard({ palette, userId, displayName, onNavigate }: { palette: Palette; userId: string; displayName: string; onNavigate: (route: RouteKey) => void }) {
  const { width: viewportWidth } = useWindowDimensions();
  const { transactions, financeLoading, financeError, financeRevision, refreshFinanceData } = useDemoTransactions();
  const language = useContext(MobileLanguageContext);
  const [overview, setOverview] = useState(() => dashboardSnapshots.get(userId)?.overview ?? null);
  const [cashflowTrend, setCashflowTrend] = useState(() => dashboardSnapshots.get(userId)?.cashflowTrend ?? []);
  const [insights, setInsights] = useState(() => dashboardSnapshots.get(userId)?.insights ?? []);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "cancelled">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterFocused, setFilterFocused] = useState(false);
  const [focusedFilterOption, setFocusedFilterOption] = useState<string | null>(null);
  const dismissDashboardFilter = useCallback(() => {
    const wasOpen = filterOpen;
    setFilterOpen(false);
    setFocusedFilterOption(null);
    return wasOpen;
  }, [filterOpen]);
  useTransientDismiss(dismissDashboardFilter);
  useEffect(() => {
    const now = new Date();
    const today = toDateKey(now);
    const monthStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const yearStart = toDateKey(new Date(now.getFullYear(), 0, 1));
    let active = true;
    const cached = dashboardSnapshots.get(userId) ?? {
      overview: null,
      cashflowTrend: [],
      insights: [],
    };
    dashboardSnapshots.set(userId, cached);
    void financeApi.getDashboardSummary()
      .then((nextOverview) => {
        cached.overview = nextOverview;
        dashboardSnapshots.set(userId, cached);
        if (active) {
          setOverview(nextOverview);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Silakan coba lagi.";
        console.error("Failed to load native dashboard overview.", error);
        if (active) setDashboardError(message);
      });
    void financeApi.getCashflowTrend(yearStart, today, "monthly")
      .then((nextTrend) => {
        cached.cashflowTrend = nextTrend.trend;
        dashboardSnapshots.set(userId, cached);
        if (active) setCashflowTrend(nextTrend.trend);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Silakan coba lagi.";
        console.error("Failed to load native dashboard cashflow trend.", error);
        if (active) setDashboardError(message);
      });
    void financeApi.getInsights(monthStart, today)
      .then((nextInsights) => {
        cached.insights = nextInsights;
        dashboardSnapshots.set(userId, cached);
        if (active) setInsights(nextInsights);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Silakan coba lagi.";
        console.error("Failed to load native dashboard insights.", error);
        if (active) setDashboardError(message);
      });
    return () => { active = false; };
  }, [dashboardRefresh, financeRevision, userId]);
  const kpiWidth = (viewportWidth - 32 - 12) / 2;
  const keyword = query.trim().toLowerCase();
  const filteredTransactions = transactions.filter((item) => {
    const searchableStatus = item.status === "completed" ? "selesai lunas completed" : item.status;
    const searchable = `${item.note} ${item.category} ${item.amount} ${item.amount.replace(/\D/g, "")} ${item.date} ${item.dateISO} ${item.income ? "pemasukan income" : "pengeluaran expense"} ${item.status} ${searchableStatus}`.toLowerCase();
    const matchesQuery = keyword === "" || searchable.includes(keyword);
    const matchesType = typeFilter === "all" || (typeFilter === "income" ? item.income : !item.income);
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesQuery && matchesType && matchesStatus;
  });
  const recentTransactions = filteredTransactions.slice(0, 5);
  const greetingHour = new Date().getHours();
  const greeting = greetingHour >= 4 && greetingHour < 11
    ? "pagi"
    : greetingHour < 15 && greetingHour >= 11
      ? "siang"
      : greetingHour < 18 && greetingHour >= 15
        ? "sore"
        : "malam";
  const netCashFlowChange = overview
    ? BigInt(overview.net_cash_flow_cents) - BigInt(overview.previous_net_cash_flow_cents)
    : 0n;
  const kpis = [
    [translateMobileText("SALDO SAAT INI", language), formatBudgetMoney(Number(overview?.total_assets_cents ?? 0)), translateMobileText("Total pemasukan dikurangi pengeluaran", language)],
    [translateMobileText("ARUS KAS", language), formatBudgetMoney(Number(overview?.net_cash_flow_cents ?? 0)), `${netCashFlowChange >= 0n ? "+" : "-"}${formatBudgetMoney(Number(netCashFlowChange >= 0n ? netCashFlowChange : -netCashFlowChange))} ${translateMobileText("dibanding bulan lalu", language)}`],
    [translateMobileText("PEMASUKAN", language), formatBudgetMoney(Number(overview?.total_income_cents ?? 0)), translateMobileText("Periode bulan ini", language)],
    [translateMobileText("PENGELUARAN", language), formatBudgetMoney(Number(overview?.total_expense_cents ?? 0)), translateMobileText("Periode bulan ini", language)],
  ];
  return (
    <FlatList
      data={[]}
      renderItem={() => null}
      keyExtractor={(item) => item}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <Text style={[styles.greeting, { color: palette.text }]}>{translateMobileText(`Selamat ${greeting}, ${displayName}`, language)}</Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>Berikut ringkasan keuangan Anda bulan ini.</Text>
          <FinanceDataState palette={palette} loading={false} error={financeError ?? dashboardError} onRetry={() => {
            if (financeError) void refreshFinanceData();
            else {
              setDashboardError(null);
              setDashboardRefresh((current) => current + 1);
            }
          }} />
          <View style={styles.kpiGrid}>{kpis.map(([label, value, note]) => <KpiCard key={label} palette={palette} label={label} value={value} note={note} width={kpiWidth} />)}</View>
          <Card palette={palette} style={styles.chartCard}>
            <View style={styles.cardRow}>
              <View><Text style={[styles.dashboardCardTitle, { color: palette.text }]}>Arus Kas Bulanan</Text><Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Tren bulanan</Text></View>
              <View style={[styles.legend, { backgroundColor: palette.muted }]}>
                <View style={[styles.legendDot, { backgroundColor: palette.chart1 }]} /><Text style={[styles.legendText, { color: palette.secondaryText }]}>Positif</Text>
                <View style={[styles.legendDot, { backgroundColor: palette.chart4 }]} /><Text style={[styles.legendText, { color: palette.secondaryText }]}>Negatif</Text>
              </View>
            </View>
            <CashflowLineChart palette={palette} trend={cashflowTrend} />
          </Card>
          <Card palette={palette} style={styles.transactionCard}>
            <View style={styles.transactionHeader}>
              <View><Text style={[styles.dashboardCardTitle, { color: palette.text }]}>Transaksi Terbaru</Text><Text style={[styles.dashboardCardMeta, { color: palette.secondaryText }]}>Diperbarui baru saja</Text></View>
              <View style={styles.toolbar}>
                <Pressable accessibilityRole="button" onPress={() => onNavigate("transactions")} style={styles.viewAllLink}><Text style={{ color: palette.accent, fontWeight: "600" }}>Lihat Semua</Text><MaterialCommunityIcons name="arrow-right" size={14} color={palette.accent} /></Pressable>
                <View style={styles.dashboardFilterAnchor}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Filter transaksi" accessibilityState={{ expanded: filterOpen }} onFocus={() => setFilterFocused(true)} onBlur={() => setFilterFocused(false)} onPress={() => setFilterOpen((open) => !open)} style={[styles.filterButton, { borderColor: filterFocused ? palette.accent : palette.border, borderWidth: filterFocused ? 2 : 1 }]}>
                    <MaterialCommunityIcons name="filter-variant" size={16} color={palette.text} /><Text style={{ color: palette.text }}>Filter</Text>
                  </Pressable>
                  {filterOpen && <TransientPopupSurface style={[styles.dashboardFilterMenu, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <Text style={[styles.menuHeading, { color: palette.text }]}>Kategori</Text>
                    {([
                      ["all", "Semua Jenis"],
                      ["income", "Pemasukan"],
                      ["expense", "Pengeluaran"],
                    ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: typeFilter === value }} onFocus={() => setFocusedFilterOption(`type-${value}`)} onBlur={() => setFocusedFilterOption(null)} onPress={() => { setTypeFilter(value); setFilterOpen(false); }} style={[styles.dashboardFilterOption, focusedFilterOption === `type-${value}` && { backgroundColor: palette.muted, borderRadius: 8 }]}>
                      <Text style={[styles.selectText, { color: palette.text }]}>{label}</Text>
                      {typeFilter === value && <MaterialCommunityIcons name="check" size={16} color={palette.accent} />}
                    </Pressable>)}
                    <View style={[styles.menuDivider, { backgroundColor: palette.border }]} />
                    <Text style={[styles.menuHeading, { color: palette.text }]}>Status</Text>
                    {([
                      ["all", "Semua Status"],
                      ["completed", "Berhasil"],
                      ["pending", "Pending"],
                      ["cancelled", "Dibatalkan"],
                    ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: statusFilter === value }} onFocus={() => setFocusedFilterOption(`status-${value}`)} onBlur={() => setFocusedFilterOption(null)} onPress={() => { setStatusFilter(value); setFilterOpen(false); }} style={[styles.dashboardFilterOption, focusedFilterOption === `status-${value}` && { backgroundColor: palette.muted, borderRadius: 8 }]}>
                      <Text style={[styles.selectText, { color: palette.text }]}>{label}</Text>
                      {statusFilter === value && <MaterialCommunityIcons name="check" size={16} color={palette.accent} />}
                    </Pressable>)}
                  </TransientPopupSurface>}
                </View>
              </View>
            </View>
            <View style={[styles.searchBox, { borderColor: searchFocused ? palette.accent : palette.border, borderWidth: searchFocused ? 2 : 1, backgroundColor: palette.background }]}>
              <MaterialCommunityIcons name="magnify" size={19} color={palette.secondaryText} />
              <TextInput value={query} onChangeText={setQuery} onFocus={() => { setSearchFocused(true); setFilterOpen(false); }} onBlur={() => setSearchFocused(false)} placeholder="Cari deskripsi, kategori, akun, jumlah, atau status..." placeholderTextColor={palette.secondaryText} style={[styles.searchInput, { color: palette.text }]} accessibilityLabel="Pencarian transaksi" numberOfLines={1} returnKeyType="search" />
            </View>
            <View style={[styles.transactionList, { borderColor: palette.border }]}>
              {recentTransactions.length > 0 ? recentTransactions.map((item, index) => <View key={item.id} style={[styles.demoTransaction, { borderBottomColor: palette.border, borderBottomWidth: index < recentTransactions.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={styles.demoTransactionCopy}><RawText style={[styles.demoTransactionCategory, { color: palette.text }]}>{item.category}</RawText><Text style={[styles.demoTransactionDate, { color: palette.secondaryText }]}>{formatTransactionDate(item, language)}</Text></View>
                <Text style={[styles.demoTransactionAmount, { color: item.income ? palette.incomeAmount : palette.expenseAmount }]}>{item.amount}</Text>
              </View>) : !financeLoading && <View style={styles.transactionEmptyState}><Text style={[styles.emptyText, { color: palette.secondaryText }]}>Belum ada data.</Text></View>}
            </View>
            {!financeLoading && <Text style={[styles.emptyText, { color: palette.secondaryText }]}>Menampilkan {recentTransactions.length} dari {Math.min(filteredTransactions.length, 5)}</Text>}
          </Card>
          <Card palette={palette} style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View><Text style={[styles.dashboardCardTitle, { color: palette.text }]}>Wawasan AI</Text><Text style={[styles.insightContext, { color: palette.secondaryText }]}>KONTEKS IDR</Text></View>
              <View style={[styles.insightIcon, { backgroundColor: palette.accent + "1A" }]}><MaterialCommunityIcons name="creation" size={17} color={palette.accent} /></View>
            </View>
            <View style={styles.insightItems}>
              {insights.length ? insights.map((insight, index) => (
                <Text key={`${index}-${insight}`} style={[styles.insightText, { color: palette.text, backgroundColor: palette.muted, borderColor: palette.border }]}>{insight}</Text>
              )) : <Text style={[styles.emptyText, { color: palette.secondaryText }]}>Belum ada wawasan untuk periode ini.</Text>}
            </View>
          </Card>
        </View>
      }
    />
  );
}

function CashflowLineChart({ palette, trend }: { palette: Palette; trend: NativeTrendPoint[] }) {
  const language = useContext(MobileLanguageContext);
  const { width } = useWindowDimensions();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const dismissTooltip = useCallback(() => {
    if (selectedMonth === null) return false;
    setSelectedMonth(null);
    return true;
  }, [selectedMonth]);
  useTransientDismiss(dismissTooltip);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const locale = language === "en" ? "en-US" : "id-ID";
  const monthLabels = Array.from({ length: 12 }, (_, index) =>
    new Date(currentYear, index, 1).toLocaleDateString(locale, { month: "short" }),
  );
  const fullMonthLabels = Array.from({ length: 12 }, (_, index) =>
    new Date(currentYear, index, 1).toLocaleDateString(locale, { month: "long" }),
  );
  const trendByMonth = new Map(trend.map((item) => [item.period.slice(0, 7), Number(item.netCashFlow)]));
  const points = monthLabels.map((label, index) => {
    const monthKey = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
    const value = trendByMonth.get(monthKey);
    const isFutureMonth = index > currentDate.getMonth();
    return {
      label,
      value: isFutureMonth ? null : value !== undefined && Number.isFinite(value) ? value : 0,
    };
  });
  if (!trend.length) return <EmptyPanel palette={palette} message="Belum ada tren arus kas untuk periode ini." />;
  const visibleValues = points.flatMap((point) => point.value === null ? [] : [Math.abs(point.value)]);
  const max = Math.max(1, ...visibleValues);
  const chart = { left: 42, right: 342, top: 12, bottom: 164, max };
  const step = max / 4;
  const plotWidth = chart.right - chart.left;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(18, slotWidth * 0.62);
  const yForMagnitude = (value: number) => chart.bottom - (Math.abs(value) / chart.max) * (chart.bottom - chart.top);
  const tooltipWidth = 176;
  const chartWidth = Math.max(260, width - 72);
  const selectedPoint = selectedMonth === null ? null : points[selectedMonth];
  const selectedX = selectedMonth === null
    ? 0
    : chart.left + selectedMonth * slotWidth + slotWidth / 2;
  const tooltipLeft = Math.max(4, Math.min(chartWidth - tooltipWidth - 4, selectedX * chartWidth / 360 - tooltipWidth / 2));

  return <View style={[styles.lineChartWrap, { width: "100%" }]}>
    <Svg width="100%" height={200} viewBox="0 0 360 220">
      {[0, step, step * 2, step * 3, max].map((value) => {
        const y = yForMagnitude(value);
        const label = value === 0 ? "0" : value >= 1_000_000
          ? `${Number((value / 1_000_000).toFixed(1))} jt`
          : `${Math.round(value / 1000)} rb`;
        return <SvgText key={value} x="2" y={y + 4} fill={palette.secondaryText} fontSize="10">{label}</SvgText>;
      })}
      {[0, step, step * 2, step * 3, max].map((value) => {
        const y = yForMagnitude(value);
        return <Line key={value} x1={chart.left} x2={chart.right} y1={y} y2={y} stroke={palette.border} strokeWidth="1" />;
      })}
      {points.map((point, index) => {
        const value = point.value;
        if (value === null || value === 0) return null;
        const x = chart.left + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = yForMagnitude(value);
        const height = chart.bottom - y;
        return <Fragment key={`${point.label}-${index}`}>
          <Rect
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx="3"
            fill={value < 0 ? palette.chart4 : palette.chart1}
            stroke={selectedMonth === index ? palette.text : "none"}
            strokeWidth={selectedMonth === index ? 2 : 0}
            pointerEvents="none"
          />
        </Fragment>;
      })}
      {points.map((point, index) => {
        const x = chart.left + index * slotWidth + slotWidth / 2;
        return <SvgText key={`${point.label}-${index}`} x={x} y="194" fill={palette.secondaryText} fontSize="9" textAnchor="end" transform={`rotate(-45 ${x} 194)`}>{point.label}</SvgText>;
      })}
      {points.map((point, index) => {
        if (point.value === null) return null;
        return <Rect
          key={`hit-${point.label}`}
          x={chart.left + index * slotWidth}
          y={chart.top}
          width={slotWidth}
          height={chart.bottom - chart.top}
          fill="transparent"
          accessible
          accessibilityLabel={`${point.label}, ${translateMobileText("Arus Kas", language)}: ${formatBudgetMoney(point.value)}`}
          onPress={() => setSelectedMonth((current) => current === index ? null : index)}
        />;
      })}
    </Svg>
    {selectedPoint && selectedPoint.value !== null && selectedMonth !== null && (
      <View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={[
          styles.cashflowTooltip,
          { left: tooltipLeft, top: 25, backgroundColor: palette.popover, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.cashflowTooltipTitle, { color: palette.text }]}>{fullMonthLabels[selectedMonth]}</Text>
        <View style={styles.cashflowTooltipRow}>
          <View style={[styles.cashflowTooltipDot, { backgroundColor: selectedPoint.value < 0 ? palette.chart4 : palette.chart1 }]} />
          <Text style={[styles.cashflowTooltipLabel, { color: palette.secondaryText }]}>{translateMobileText("Arus Kas", language)}</Text>
          <Text style={[styles.cashflowTooltipValue, { color: palette.text }]}>
            {selectedPoint.value < 0 ? "-" : ""}{formatBudgetMoney(Math.abs(selectedPoint.value)).replace(/^Rp\s*/, "")}
          </Text>
        </View>
      </View>
    )}
  </View>;
}

function FeaturePage({ route, palette, onNavigate, onAddTransaction, onEditTransaction, onViewTransaction, onThemeChange, onLanguageChange, language, user, onUserChange, onLogout, onAccountDeleted, logoutLoading, userSettings, onSettingsChange, pushEnabled, pushError, onPushEnabledChange, pushSaving }: { route: RouteKey; palette: Palette; onNavigate: (route: RouteKey) => void; onAddTransaction: () => void; onEditTransaction: (transaction: DemoTransaction) => void; onViewTransaction: (transaction: DemoTransaction) => void; onThemeChange: (dark: boolean) => void; onLanguageChange: (language: MobileLanguage) => Promise<void>; language: MobileLanguage; user: AuthUser; onUserChange: (user: AuthUser) => void; onLogout: () => Promise<void>; onAccountDeleted: () => Promise<void>; logoutLoading: boolean; userSettings: NativeUserSettings | null; onSettingsChange: (patch: NativeSettingsPatch) => Promise<boolean>; pushEnabled: boolean; pushError: string | null; onPushEnabledChange: (enabled: boolean) => Promise<boolean>; pushSaving: boolean }) {
  if (route === "categories") return <CategoriesPage palette={palette} />;
  if (route === "transactions" || route === "incomes" || route === "expenses") return <TransactionsPage route={route} palette={palette} onAddTransaction={onAddTransaction} onEditTransaction={onEditTransaction} onViewTransaction={onViewTransaction} />;
  if (route === "budgets") return <BudgetsPage palette={palette} userId={user.id} />;
  if (route === "goals") return <GoalsPage palette={palette} userId={user.id} />;
  if (route === "investments") return <InvestmentsPage palette={palette} userId={user.id} />;
  if (route === "reports") return <ReportsPageNative palette={palette} onNavigate={onNavigate} userId={user.id} />;
  if (route === "analytics" || route === "forecast") return <AnalysisPage route={route} palette={palette} userId={user.id} />;
  if (route === "notifications" || route === "audit") return <ActivityPage route={route} palette={palette} />;
  if (route === "profile" || route === "settings") return <AccountPage route={route} palette={palette} onThemeChange={onThemeChange} language={language} onLanguageChange={onLanguageChange} user={user} onUserChange={onUserChange} onLogout={onLogout} onAccountDeleted={onAccountDeleted} logoutLoading={logoutLoading} userSettings={userSettings} onSettingsChange={onSettingsChange} pushEnabled={pushEnabled} pushError={pushError} onPushEnabledChange={onPushEnabledChange} pushSaving={pushSaving} />;
  return null;
}

function PageHeader({ palette, title, description }: { palette: Palette; title: string; description: string }) {
  return <View><Text style={[styles.pageTitle, { color: palette.text }]}>{title}</Text><Text style={[styles.subtitle, { color: palette.secondaryText }]}>{description}</Text></View>;
}

function getLocalDateInput() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function Toolbar({ palette, count, action, onAction, showAction = true, showCount = true }: { palette: Palette; count: string; action: string; onAction: () => void; showAction?: boolean; showCount?: boolean }) {
  return <View style={styles.pageToolbar}>{showCount && <Text style={[styles.resultCount, { color: palette.secondaryText }]}>{count}</Text>}{showAction && <Pressable accessibilityRole="button" onPress={onAction} style={[styles.primaryButton, styles.addActionButton, { backgroundColor: palette.accent }]}><MaterialCommunityIcons name="plus" size={18} color={palette.accentText} /><Text style={{ color: palette.accentText, fontWeight: "700" }}>{action}</Text></Pressable>}</View>;
}

function CategoriesPage({ palette }: { palette: Palette }) {
  const language = useContext(MobileLanguageContext);
  const { categories, financeLoading, financeError, refreshCategories, refreshFinanceData, showToast } = useDemoTransactions();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "INCOME" | "EXPENSE">("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openFilter, setOpenFilter] = useState<"type" | "sort" | "pageSize" | null>(null);
  const dismissCategoryFilters = useCallback(() => {
    const wasOpen = openFilter !== null;
    setOpenFilter(null);
    return wasOpen;
  }, [openFilter]);
  useTransientDismiss(dismissCategoryFilters);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DemoCategory | null>(null);
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<DemoCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryType, setCategoryType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryIcon, setCategoryIcon] = useState<keyof typeof MaterialCommunityIcons.glyphMap>("tag-outline");
  const [categoryColor, setCategoryColor] = useState(categoryEditorColors[0]);
  const sortOptions: [string, string][] = [
    ["name_asc", "Nama (A-Z)"],
    ["name_desc", "Nama (Z-A)"],
    ["created_desc", "Terbaru"],
    ["created_asc", "Terlama"],
  ];
  const sortLabel = sortOptions.find(([value]) => value === sort)?.[1] ?? "Nama (A-Z)";
  const filteredCategories = categories.filter((category) => {
    const term = query.trim().toLowerCase();
    return (type === "all" || category.type === type)
      && (!term || `${category.name} ${category.label} ${category.description ?? ""}`.toLowerCase().includes(term));
  }).sort((a, b) => {
    if (sort === "name_desc") return b.name.localeCompare(a.name);
    if (sort === "created_desc") return categories.findIndex((item) => item.id === b.id) - categories.findIndex((item) => item.id === a.id);
    if (sort === "created_asc") return categories.findIndex((item) => item.id === a.id) - categories.findIndex((item) => item.id === b.id);
    return a.name.localeCompare(b.name);
  });
  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const openEditor = (category: DemoCategory | null) => {
    setEditingCategory(category);
    setCategoryName(category?.label ?? "");
    setCategoryDescription(category?.description ?? "");
    setCategoryType(category?.type ?? "EXPENSE");
    setCategoryIcon(category?.icon ?? "tag-outline");
    setCategoryColor(category?.color ?? categoryEditorColors[0]);
    setEditorOpen(true);
  };
  const saveCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      Alert.alert(translateMobileText("Nama kategori wajib diisi", language));
      return;
    }
    try {
      const payload = {
        name,
        type: categoryType,
        description: categoryDescription.trim() || undefined,
        icon: categoryIcon,
        color: categoryColor,
      };
      if (editingCategory) await financeApi.updateCategory(editingCategory.id, payload);
      else await financeApi.createCategory(payload);
      await refreshCategories();
      showToast(translateMobileText(editingCategory ? "Kategori berhasil diperbarui." : "Kategori berhasil disimpan.", language));
      if (!editingCategory) setPage(1);
      setEditorOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to save native category.", error);
      Alert.alert(translateMobileText("Kategori tidak dapat disimpan.", language), message);
    }
  };
  const resetFilters = () => {
    setQuery("");
    setType("all");
    setSort("name_asc");
    setPage(1);
    setOpenFilter(null);
  };
  const startIndex = filteredCategories.length ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, filteredCategories.length);
  const categoryTypeLabel = (value: "INCOME" | "EXPENSE") => value === "INCOME" ? "Pemasukan" : "Pengeluaran";
  const dropdown = (key: "type" | "sort") => {
    if (openFilter !== key) return null;
    const options = key === "type"
      ? [["all", "Semua jenis"], ["INCOME", "Pemasukan"], ["EXPENSE", "Pengeluaran"]]
      : sortOptions;
    return <TransientPopupSurface style={[styles.filterOptions, styles.categoryFilterOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {options.map(([value, label]) => <Pressable key={value} accessibilityRole="button" onPress={() => {
        if (key === "type") setType(value as "all" | "INCOME" | "EXPENSE");
        else setSort(value);
        setPage(1);
        setOpenFilter(null);
      }} style={styles.filterOption}><Text style={{ color: palette.text }}>{label}</Text></Pressable>)}
    </TransientPopupSurface>;
  };

  return <>
  <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, styles.categoryContent]} showsVerticalScrollIndicator={false}>
    <PageHeader palette={palette} title="Kategori" description="Susun kategori untuk mengelompokkan transaksi Anda." />
    <FinanceDataState palette={palette} loading={financeLoading} error={financeError} onRetry={() => { void refreshFinanceData(); }} />
    <Toolbar palette={palette} count={`${filteredCategories.length} kategori`} action="Tambah Kategori" onAction={() => openEditor(null)} />
    <View style={[styles.categoryFilterCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={[styles.searchBox, styles.categorySearchBox, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <MaterialCommunityIcons name="magnify" size={17} color={palette.secondaryText} />
        <TextInput value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="Cari kategori..." placeholderTextColor={palette.secondaryText} style={[styles.searchInput, styles.categorySearchInput, { color: palette.text }]} accessibilityLabel="Cari kategori..." />
      </View>
      <View style={styles.categoryFilters}>
        <View style={[styles.filterMenu, styles.transactionFilterFullWidth]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Jenis kategori" accessibilityState={{ expanded: openFilter === "type" }} onPress={() => setOpenFilter(openFilter === "type" ? null : "type")} style={[styles.categoryFilterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.categoryFilterLabel, { color: palette.text }]}>{type === "all" ? "Semua jenis" : categoryTypeLabel(type)}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} />
          </Pressable>{dropdown("type")}
        </View>
        <View style={styles.filterMenu}>
          <Pressable accessibilityRole="button" accessibilityLabel="Urutkan" accessibilityState={{ expanded: openFilter === "sort" }} onPress={() => setOpenFilter(openFilter === "sort" ? null : "sort")} style={[styles.categoryFilterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.categoryFilterLabel, { color: palette.text }]}>{sortLabel}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} />
          </Pressable>{dropdown("sort")}
        </View>
        <Pressable accessibilityRole="button" onPress={resetFilters} style={[styles.categoryResetButton, { borderColor: palette.border }]}>
          <MaterialCommunityIcons name="backup-restore" size={15} color={palette.text} /><Text style={[styles.categoryFilterLabel, { color: palette.text }]}>Reset Filter</Text>
        </Pressable>
      </View>
    </View>
    {visibleCategories.length > 0 ? <View style={styles.categoryCardList}>
      {visibleCategories.map((category) => <View key={category.id} style={[styles.categoryMobileCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <View style={styles.categoryMobileHeader}>
          <View style={[styles.categoryIconTile, { backgroundColor: palette.muted }]}><MaterialCommunityGlyphIcons name={category.icon} size={16} color={category.color ?? palette.secondaryText} /></View>
          <View style={styles.categoryMobileName}>
            <RawText numberOfLines={1} style={[styles.categoryMobileTitle, { color: palette.text }]}>{category.label}</RawText>
            {category.isSystem && <Text style={[styles.categorySystemLabel, { color: palette.secondaryText }]}>Sistem</Text>}
          </View>
        </View>
        <View style={styles.categoryBadgeRow}>
          <View style={[styles.categoryTypeChip, { borderColor: palette.border }]}><Text style={[styles.categoryTypeText, { color: palette.text }]}>{categoryTypeLabel(category.type)}</Text></View>
          <View style={styles.categoryStatusChip}><Text style={styles.categoryStatusText}>Aktif</Text></View>
        </View>
        {category.description && <RawText style={[styles.categoryDescription, { color: palette.secondaryText }]}>{category.description}</RawText>}
        <View style={[styles.categoryMobileActions, { borderTopColor: palette.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Lihat", category.label, language)} onPress={() => Alert.alert(category.label, `${translateMobileText(categoryTypeLabel(category.type), language)}${category.description ? `\n${category.description}` : ""}`)} style={styles.categoryActionButton}><MaterialCommunityIcons name="eye-outline" size={16} color={palette.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Ubah", category.label, language)} onPress={() => openEditor(category)} style={styles.categoryActionButton}><MaterialCommunityIcons name="pencil-outline" size={16} color={palette.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Hapus", category.label, language)} onPress={() => setPendingCategoryDelete(category)} style={styles.categoryActionButton}><MaterialCommunityIcons name="delete-outline" size={16} color={palette.text} /></Pressable>
        </View>
      </View>)}
    </View> : <View style={[styles.categoryNoResults, { borderColor: palette.border, backgroundColor: palette.surface }]}><MaterialCommunityIcons name="tag-outline" size={28} color={palette.secondaryText} /><Text style={[styles.categoryMobileTitle, { color: palette.text }]}>Kategori tidak ditemukan.</Text><Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Ubah pencarian atau filter untuk melihat kategori lain.</Text><Pressable accessibilityRole="button" onPress={resetFilters} style={[styles.categoryResetButton, styles.categoryNoResultsButton, { borderColor: palette.border }]}><Text style={[styles.categoryFilterLabel, { color: palette.text }]}>Reset Filter</Text></Pressable></View>}
    {filteredCategories.length > 0 && <View style={styles.categoryPagination}>
      <View style={styles.categoryPageSizeRow}>
        <Text style={[styles.categoryPaginationText, { color: palette.secondaryText }]}>Baris per halaman</Text>
        <View style={styles.filterMenu}>
          <Pressable accessibilityRole="button" accessibilityLabel="Baris per halaman" onPress={() => setOpenFilter(openFilter === "pageSize" ? null : "pageSize")} style={[styles.pageSize, styles.categoryPageSize, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>{pageSize}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} /></Pressable>
          {openFilter === "pageSize" && <TransientPopupSurface style={[styles.filterOptions, styles.categoryPageSizeOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>{[5, 10, 20, 50].map((size) => <Pressable key={size} accessibilityRole="button" onPress={() => { setPageSize(size); setPage(1); setOpenFilter(null); }} style={styles.filterOption}><Text style={{ color: palette.text }}>{size}</Text></Pressable>)}</TransientPopupSurface>}
        </View>
      </View>
      <Text style={[styles.categoryPaginationText, styles.categoryRangeText, { color: palette.secondaryText }]}>Menampilkan {startIndex}–{endIndex} dari {filteredCategories.length}</Text>
      <View style={styles.categoryPageControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Sebelumnya" disabled={currentPage <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage <= 1 ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-left" size={18} color={palette.secondaryText} /></Pressable>
        <Text style={[styles.categoryPaginationText, { color: palette.secondaryText }]}>{currentPage} / {totalPages}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Berikutnya" disabled={currentPage >= totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage >= totalPages ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-right" size={18} color={palette.secondaryText} /></Pressable>
      </View>
    </View>}
    <CategoryEditorModal open={editorOpen} palette={palette} title={editingCategory ? "Ubah Kategori" : "Tambah Kategori"} name={categoryName} description={categoryDescription} type={categoryType} icon={categoryIcon} color={categoryColor} onNameChange={setCategoryName} onDescriptionChange={setCategoryDescription} onTypeChange={setCategoryType} onIconChange={setCategoryIcon} onColorChange={setCategoryColor} onSave={saveCategory} onClose={() => setEditorOpen(false)} />
  </ScrollView>
  <NativeDeleteDialog
    open={pendingCategoryDelete !== null}
    title="Hapus Kategori"
    description="Apakah Anda yakin ingin menghapus kategori ini?"
    palette={palette}
    onClose={() => setPendingCategoryDelete(null)}
    onConfirm={() => {
      if (pendingCategoryDelete) {
        void financeApi.removeCategory(pendingCategoryDelete.id)
          .then(async (response) => {
            if (!response.success) throw new Error("The server could not delete the category.");
            await refreshCategories();
            showToast(translateMobileText("Kategori berhasil dihapus.", language));
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Silakan coba lagi.";
            console.error("Failed to delete native category.", error);
            Alert.alert(translateMobileText("Kategori tidak dapat dihapus.", language), message);
          });
      }
      setPendingCategoryDelete(null);
    }}
  />
  </>;
}

function FloatingFormModal({ open, palette, title, description, rawDescription = false, onClose, actions, children }: {
  open: boolean;
  palette: Palette;
  title: string;
  description: string;
  rawDescription?: boolean;
  onClose: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableModalWidth = Math.max(0, windowWidth - 32);
  const modalWidth = windowWidth >= 640
    ? Math.min(availableModalWidth, 512)
    : availableModalWidth;
  const modalMaxHeight = Math.max(0, windowHeight - insets.top - insets.bottom - 24);

  return <Modal animationType="fade" transparent statusBarTranslucent navigationBarTranslucent visible={open} onRequestClose={onClose}>
    <View style={[styles.floatingModalBackdrop, { paddingVertical: 12 }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.floatingModalKeyboard, { maxHeight: modalMaxHeight, width: modalWidth }]}>
        <View style={[styles.floatingModal, { backgroundColor: palette.card, borderColor: palette.border, maxHeight: modalMaxHeight, width: modalWidth }]}>
          <View style={[styles.floatingModalHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.modalTitle, styles.floatingModalTitle, { color: palette.text }]}>{title}</Text>
            {rawDescription
              ? <RawText style={[styles.modalDescription, styles.floatingModalDescription, { color: palette.secondaryText }]}>{description}</RawText>
              : <Text style={[styles.modalDescription, styles.floatingModalDescription, { color: palette.secondaryText }]}>{description}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={onClose} style={styles.floatingModalClose}>
              <MaterialCommunityIcons name="close" size={20} color={palette.secondaryText} />
            </Pressable>
          </View>
          <PopupAwareScrollView style={styles.floatingModalBody} contentContainerStyle={styles.floatingModalBodyContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {children}
          </PopupAwareScrollView>
          <View style={[styles.floatingModalFooter, { borderTopColor: palette.border }]}>{actions}</View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

function NativeSelect<T extends string | number>({ label, value, options, palette, onChange, disabled = false, active = true, optionsStyle, placeholder }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  palette: Palette;
  onChange: (value: T) => void;
  disabled?: boolean;
  active?: boolean;
  optionsStyle?: StyleProp<ViewStyle>;
  placeholder?: string;
}) {
  const triggerRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectState, setSelectState] = useState<{
    active: boolean;
    open: boolean;
    anchor: { left: number; top: number; width: number; height: number } | null;
  }>(() => ({ active, open: false, anchor: null }));
  if (selectState.active !== active) setSelectState({ active, open: false, anchor: null });
  const isOpen = active && selectState.open;
  const anchor = selectState.anchor;
  const selected = options.find((option) => option.value === value);
  const openOptions = useCallback(() => {
    triggerRef.current?.measureInWindow((left, top, width, height) => {
      const margin = 12;
      const gap = 6;
      const maxHeight = Math.min(240, Math.max(0, windowHeight - margin * 2));
      const panelHeight = Math.min(maxHeight, options.length * 44 + 8);
      const spaceBelow = windowHeight - top - height - margin;
      const spaceAbove = top - margin;
      const fitsBelow = spaceBelow >= panelHeight || spaceBelow >= spaceAbove;
      const requestedTop = fitsBelow ? top + height + gap : top - panelHeight - gap;
      const panelWidth = Math.min(width, Math.max(0, windowWidth - margin * 2));
      const panelLeft = Math.max(margin, Math.min(left, windowWidth - panelWidth - margin));
      const panelTop = Math.max(margin, Math.min(requestedTop, windowHeight - panelHeight - margin));
      setSelectState({ active, open: true, anchor: { left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight } });
    });
  }, [active, options.length, windowHeight, windowWidth]);
  const closeOptions = useCallback(() => {
    setSelectState({ active, open: false, anchor: null });
  }, [active]);
  const renderOption = useCallback(({ item }: ListRenderItemInfo<{ value: T; label: string }>) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: item.value === value }}
      onPress={() => {
        onChange(item.value);
        closeOptions();
      }}
      style={styles.nativeSelectOption}
    >
      <Text numberOfLines={1} style={[styles.nativeSelectText, { color: palette.text }]}>{item.label}</Text>
      {item.value === value && <MaterialCommunityIcons name="check" size={16} color={palette.text} />}
    </Pressable>
  ), [closeOptions, onChange, palette.text, value]);

  return <>
    <View ref={triggerRef} collapsable={false} style={styles.nativeSelectContainer}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: isOpen, disabled }}
      disabled={disabled || !active}
      onPress={() => {
        if (isOpen) closeOptions();
        else openOptions();
      }}
      style={[
        styles.nativeSelectTrigger,
        { backgroundColor: palette.input, borderColor: palette.border },
        disabled && styles.nativeSelectDisabled,
      ]}
    >
      <Text numberOfLines={1} style={[styles.categoryFilterLabel, styles.nativeSelectText, { color: palette.text }]}>
        {selected?.label ?? placeholder ?? ""}
      </Text>
      <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={palette.secondaryText} />
    </Pressable>
    </View>
    <Modal
      transparent
      visible={isOpen && anchor !== null}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closeOptions}
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tutup ${label}`}
          onPress={closeOptions}
          style={StyleSheet.absoluteFill}
        />
        {anchor && <View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={[
            styles.nativeSelectOptions,
            optionsStyle,
            {
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              height: anchor.height,
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            renderItem={renderOption}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            ListEmptyComponent={<Text style={[styles.nativeSelectEmpty, { color: palette.secondaryText }]}>Tidak ada pilihan</Text>}
          />
        </View>}
      </View>
    </Modal>
  </>;
}

function NativeCalendarPicker({ label, value, palette, onChange, active = false, onOpenChange, allowClear = true, disabled = false, triggerStyle }: {
  label: string;
  value: string;
  palette: Palette;
  onChange: (value: string) => void;
  active?: boolean;
  onOpenChange: (open: boolean) => void;
  allowClear?: boolean;
  disabled?: boolean;
  triggerStyle?: StyleProp<ViewStyle>;
}) {
  const language = useContext(MobileLanguageContext);
  const triggerRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [calendarState, setCalendarState] = useState<{
    value: string;
    anchor: { left: number; top: number; width: number; height: number } | null;
    visibleMonth: Date;
  }>(() => {
    const selected = value ? new Date(`${value}T00:00:00`) : new Date();
    return { value, anchor: null, visibleMonth: new Date(selected.getFullYear(), selected.getMonth(), 1) };
  });
  if (calendarState.value !== value) {
    const selected = value ? new Date(`${value}T00:00:00`) : new Date();
    setCalendarState({ value, anchor: null, visibleMonth: new Date(selected.getFullYear(), selected.getMonth(), 1) });
  }
  const { anchor, visibleMonth } = calendarState;
  const setAnchor = (nextAnchor: typeof anchor) => setCalendarState((current) => ({ ...current, anchor: nextAnchor }));
  const closeCalendar = () => {
    setAnchor(null);
    onOpenChange(false);
  };
  const setVisibleMonth = (nextMonth: Date | ((previous: Date) => Date)) => setCalendarState((current) => ({
    ...current,
    visibleMonth: typeof nextMonth === "function" ? nextMonth(current.visibleMonth) : nextMonth,
  }));
  const today = getLocalDateInput();
  const locale = language === "en" ? "en-US" : "id-ID";
  const monthTitle = visibleMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = language === "en"
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const firstDayOffset = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const weeksInMonth = Math.ceil((firstDayOffset + new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()) / 7);
  const calendarDays = Array.from({ length: weeksInMonth * 7 }, (_, index) => {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstDayOffset + 1);
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, dateValue, inMonth: date.getMonth() === visibleMonth.getMonth() };
  });

  const openCalendar = () => {
    triggerRef.current?.measureInWindow((left, top, _width, height) => {
      const margin = 12;
      const gap = 8;
      const panelWidth = Math.max(0, Math.min(340, windowWidth - margin * 2));
      const panelHeight = Math.min(412, Math.max(0, windowHeight - margin * 2));
      const spaceBelow = windowHeight - top - height - margin;
      const spaceAbove = top - margin;
      const fitsBelow = spaceBelow >= panelHeight || spaceBelow >= spaceAbove;
      const requestedTop = fitsBelow ? top + height + gap : top - panelHeight - gap;
      const panelTop = Math.max(margin, Math.min(requestedTop, windowHeight - panelHeight - margin));

      setAnchor({
        left: Math.max(margin, Math.min(left, windowWidth - panelWidth - margin)),
        top: panelTop,
        width: panelWidth,
        height: Math.max(0, panelHeight),
      });
    });
  };

  const displayDate = value
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : "Pilih tanggal";

  return <>
    <View ref={triggerRef} collapsable={false} style={styles.transactionFilterFullWidth}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: active && anchor !== null, disabled }}
        disabled={disabled}
        onPress={disabled ? undefined : () => {
          if (active) {
            closeCalendar();
          } else {
            setAnchor(null);
            openCalendar();
            onOpenChange(true);
          }
        }}
        style={[
          styles.transactionDateButton,
          styles.transactionFilterFullWidth,
          { backgroundColor: palette.muted },
          triggerStyle,
          { borderColor: active ? palette.secondaryText : palette.border },
        ]}
      >
        <Text style={[styles.selectText, styles.transactionDateValue, { color: value ? palette.text : palette.secondaryText }]}>{displayDate}</Text>
      </Pressable>
    </View>
    <Modal
      transparent
      visible={active && anchor !== null}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closeCalendar}
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tutup ${label}`}
          onPress={closeCalendar}
          onTouchMove={closeCalendar}
          style={StyleSheet.absoluteFill}
        />
        {anchor && <View
          style={[
            styles.nativeCalendar,
            {
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              height: anchor.height,
              backgroundColor: palette.muted,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.nativeCalendarHeader}>
            <Text style={[styles.nativeCalendarMonth, { color: palette.text }]}>{monthTitle}</Text>
            <View style={styles.nativeCalendarNavigation}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bulan sebelumnya"
                onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                style={styles.nativeCalendarNavButton}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={palette.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bulan berikutnya"
                onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                style={styles.nativeCalendarNavButton}
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color={palette.text} />
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.nativeCalendarDays} showsVerticalScrollIndicator={false}>
            <View style={styles.nativeCalendarWeek}>
              {weekdays.map((day) => (
                <Text key={day} style={[styles.nativeCalendarWeekday, { color: palette.text }]}>{day}</Text>
              ))}
            </View>
            {Array.from({ length: weeksInMonth }, (_, week) => <View key={week} style={styles.nativeCalendarWeek}>
              {calendarDays.slice(week * 7, week * 7 + 7).map(({ date, dateValue, inMonth }) => {
                const selected = dateValue === value;
                return <Pressable
                  key={dateValue}
                  accessibilityRole="button"
                  accessibilityLabel={date.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(dateValue);
                    closeCalendar();
                  }}
                  style={[
                    styles.nativeCalendarDay,
                    selected && { backgroundColor: palette.text },
                    dateValue === today && !selected && { borderColor: palette.secondaryText, borderWidth: 1 },
                  ]}
                >
                  <Text style={{ color: selected ? palette.background : inMonth ? palette.text : palette.secondaryText, fontSize: 14, textAlign: "center" }}>
                    {date.getDate()}
                  </Text>
                </Pressable>;
              })}
            </View>)}
          </ScrollView>
          <View style={[styles.nativeCalendarFooter, { borderTopColor: palette.border }]}>
            {allowClear && <Pressable accessibilityRole="button" onPress={() => { onChange(""); closeCalendar(); }} style={styles.nativeCalendarAction}><Text style={{ color: palette.text, fontSize: 14 }}>{language === "en" ? "Clear" : "Bersihkan"}</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => { onChange(today); closeCalendar(); }} style={styles.nativeCalendarAction}><Text style={{ color: palette.text, fontSize: 14 }}>{language === "en" ? "Today" : "Hari ini"}</Text></Pressable>
          </View>
        </View>}
      </View>
    </Modal>
  </>;
}

function CategoryEditorModal({ open, palette, title, name, description, type, icon, color, onNameChange, onDescriptionChange, onTypeChange, onIconChange, onColorChange, onSave, onClose }: {
  open: boolean;
  palette: Palette;
  title: string;
  name: string;
  description: string;
  type: "INCOME" | "EXPENSE";
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: "INCOME" | "EXPENSE") => void;
  onIconChange: (value: keyof typeof MaterialCommunityIcons.glyphMap) => void;
  onColorChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return <FloatingFormModal open={open} palette={palette} title={title} description="Susun kategori untuk mengelompokkan transaksi Anda." onClose={onClose} actions={
    <>
      <Pressable accessibilityRole="button" onPress={onSave} style={[styles.floatingModalSaveButton, { backgroundColor: palette.accent }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Simpan</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onClose} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Batal</Text></Pressable>
    </>
  }>
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Nama Kategori</Text>
    <TextInput value={name} onChangeText={onNameChange} placeholder="Masukkan nama kategori" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.floatingModalInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Nama Kategori" />
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Jenis</Text>
    <NativeSelect
    label="Jenis kategori"
    value={type}
    options={[{ value: "INCOME", label: "Pemasukan" }, { value: "EXPENSE", label: "Pengeluaran" }]}
    palette={palette}
    active={open}
    onChange={onTypeChange}
    />
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Pilih Ikon</Text>
    <View style={[styles.categoryEditorIconGrid, { borderColor: palette.border }]}>
      {categoryEditorIcons.map((item) => <Pressable key={item.icon} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: icon === item.icon }} onPress={() => onIconChange(item.icon)} style={[styles.categoryEditorIconButton, { backgroundColor: icon === item.icon ? palette.muted : "transparent", borderColor: icon === item.icon ? palette.accent : "transparent" }]}><MaterialCommunityGlyphIcons name={item.icon} size={19} color={icon === item.icon ? palette.accent : palette.secondaryText} /></Pressable>)}
    </View>
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Pilih Warna</Text>
    <View style={styles.categoryEditorColorGrid}>
      {categoryEditorColors.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Warna ${value}`} accessibilityState={{ selected: color === value }} onPress={() => onColorChange(value)} style={[styles.categoryEditorColorButton, { backgroundColor: value, borderColor: color === value ? palette.text : "transparent" }]} />)}
    </View>
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Deskripsi (Opsional)</Text>
    <TextInput value={description} onChangeText={onDescriptionChange} placeholder="Masukkan deskripsi kategori" placeholderTextColor={palette.secondaryText} multiline style={[styles.fieldInput, styles.floatingModalInput, styles.noteInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Deskripsi (Opsional)" />
  </FloatingFormModal>;
}

function TransactionsPage({ route, palette, onAddTransaction, onEditTransaction, onViewTransaction }: { route: RouteKey; palette: Palette; onAddTransaction: () => void; onEditTransaction: (transaction: DemoTransaction) => void; onViewTransaction: (transaction: DemoTransaction) => void }) {
  const { transactions, addTransaction, removeTransaction, financeLoading, financeError, refreshFinanceData } = useDemoTransactions();
  const language = useContext(MobileLanguageContext);
  const title = route === "incomes" ? "Pemasukan" : route === "expenses" ? "Pengeluaran" : "Riwayat Transaksi";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua Kategori");
  const [type, setType] = useState("Semua Jenis");
  const [today, setToday] = useState(getLocalDateInput);
  const lastKnownToday = useRef(today);
  const hasCustomDateRange = useRef(false);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<DemoTransaction | null>(null);
  const [openFilter, setOpenFilter] = useState<"category" | "type" | "fromDate" | "toDate" | "pageSize" | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const syncToday = () => {
      const nextToday = getLocalDateInput();
      if (lastKnownToday.current !== nextToday) {
        lastKnownToday.current = nextToday;
        setToday(nextToday);
        if (!hasCustomDateRange.current) {
          setFromDate(nextToday);
          setToDate(nextToday);
          setPage(1);
        }
      }

      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      timer = setTimeout(syncToday, nextMidnight - now.getTime() + 50);
    };
    syncToday();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        clearTimeout(timer);
        syncToday();
      }
    });

    return () => {
      clearTimeout(timer);
      appStateSubscription.remove();
    };
  }, []);
  const dismissTransactionFilters = useCallback(() => {
    const wasOpen = openFilter !== null;
    setOpenFilter(null);
    return wasOpen;
  }, [openFilter]);
  useTransientDismiss(dismissTransactionFilters);
  const [pageSize, setPageSize] = useState(10);
  const isIncomePage = route === "incomes";
  const isExpensePage = route === "expenses";
  const description = route === "transactions"
    ? "Lihat dan cari seluruh histori transaksi keuangan Anda."
    : `Pantau seluruh ${title.toLowerCase()} Anda dalam satu tempat.`;
  const categories = [...new Set(transactions.map((item) => item.category))];
  const filteredData = transactions.filter((item) => {
    const searchableStatus = item.status === "completed" ? "selesai lunas completed" : item.status;
    const searchable = `${item.note} ${item.category} ${item.amount} ${item.amount.replace(/\D/g, "")} ${item.date} ${item.dateISO} ${item.income ? "pemasukan income" : "pengeluaran expense"} ${searchableStatus}`.toLowerCase();
    return (!query.trim() || searchable.includes(query.trim().toLowerCase()))
      && (category === "Semua Kategori" || item.category === category)
      && (isIncomePage ? item.income : isExpensePage ? !item.income : type === "Semua Jenis" || (type === "Pemasukan" ? item.income : !item.income))
      && (!fromDate || item.dateISO >= fromDate)
      && (!toDate || item.dateISO <= toDate);
  });
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const visibleData = filteredData.slice((page - 1) * pageSize, page * pageSize);
  const resetFilters = () => {
    setQuery("");
    setCategory("Semua Kategori");
    setType("Semua Jenis");
    hasCustomDateRange.current = false;
    const currentDate = getLocalDateInput();
    lastKnownToday.current = currentDate;
    setToday(currentDate);
    setFromDate(currentDate);
    setToDate(currentDate);
    setPage(1);
    setOpenFilter(null);
  };
  const setDateFilter = (key: "fromDate" | "toDate", value: string) => {
    if (value !== lastKnownToday.current) hasCustomDateRange.current = true;
    if (key === "fromDate") setFromDate(value);
    else setToDate(value);
    setPage(1);
    setOpenFilter(null);
  };
  const renderFilterOptions = (key: "category" | "type") => {
    if (openFilter !== key) return null;
    const options = key === "category"
      ? ["Semua Kategori", ...categories]
      : ["Semua Jenis", "Pemasukan", "Pengeluaran"];
    return <TransientPopupSurface style={[styles.filterOptions, styles.transactionFilterOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {options.map((option) => <Pressable key={`${key}-${option}`} accessibilityRole="button" onPress={() => {
        if (key === "category") setCategory(option);
        else if (key === "type") setType(option);
        setPage(1);
        setOpenFilter(null);
      }} style={styles.filterOption}><Text style={{ color: palette.text }}>{option}</Text></Pressable>)}
    </TransientPopupSurface>;
  };
  const startIndex = filteredData.length ? (page - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(page * pageSize, filteredData.length);
  return <>
  <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, styles.transactionContent]} showsVerticalScrollIndicator={false}>
    <PageHeader palette={palette} title={route === "transactions" ? "Riwayat Transaksi" : title} description={description} />
    <FinanceDataState palette={palette} loading={financeLoading} error={financeError} onRetry={() => { void refreshFinanceData(); }} />
    <Toolbar palette={palette} count={`${filteredData.length} transaksi`} action="Tambah Transaksi" onAction={onAddTransaction} showAction={route !== "transactions"} showCount={route !== "transactions"} />
    <View style={[styles.transactionFilterCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={[styles.searchBox, styles.transactionSearchBox, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <MaterialCommunityIcons name="magnify" size={19} color={palette.secondaryText} />
        <TextInput value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="Cari deskripsi, kategori, akun, jumlah, atau status..." placeholderTextColor={palette.secondaryText} style={[styles.searchInput, { color: palette.text }]} accessibilityLabel="Pencarian transaksi" />
      </View>
      <View style={styles.transactionFilters}>
        <View style={[
          styles.filterMenu,
          styles.transactionFilterColumn,
          (isIncomePage || isExpensePage) && styles.transactionFilterFullColumn,
        ]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kategori" accessibilityState={{ expanded: openFilter === "category" }} onPress={() => setOpenFilter(openFilter === "category" ? null : "category")} style={[styles.selectButton, styles.transactionFilterButton, (isIncomePage || isExpensePage) && styles.transactionFilterCategoryButton, { borderColor: palette.border, backgroundColor: palette.muted }]}>
            <Text numberOfLines={1} style={[styles.selectText, { color: palette.text }]}>{category}</Text><MaterialCommunityIcons name="chevron-down" size={18} color={palette.secondaryText} />
          </Pressable>
          {renderFilterOptions("category")}
        </View>
        {!isIncomePage && !isExpensePage && <View style={[styles.filterMenu, styles.transactionFilterColumn]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Jenis" accessibilityState={{ expanded: openFilter === "type" }} onPress={() => setOpenFilter(openFilter === "type" ? null : "type")} style={[styles.selectButton, styles.transactionFilterButton, { borderColor: palette.border, backgroundColor: palette.muted }]}>
            <Text style={[styles.selectText, { color: palette.text }]}>{type}</Text><MaterialCommunityIcons name="chevron-down" size={18} color={palette.secondaryText} />
          </Pressable>
          {renderFilterOptions("type")}
        </View>}
        {(["fromDate", "toDate"] as const).map((key) => <View key={key} style={[styles.transactionDateFilter, styles.transactionFilterColumn]}>
          <Text style={[styles.transactionDateLabel, { color: palette.secondaryText }]}>{key === "fromDate" ? "Dari tanggal" : "Sampai tanggal"}</Text>
          <NativeCalendarPicker
            label={key === "fromDate" ? "Dari tanggal" : "Sampai tanggal"}
            value={key === "fromDate" ? fromDate : toDate}
            palette={palette}
            active={openFilter === key}
            onOpenChange={(open) => setOpenFilter(open ? key : null)}
            onChange={(value) => setDateFilter(key, value)}
          />
        </View>)}
        <Pressable accessibilityRole="button" onPress={resetFilters} style={[styles.resetButton, styles.transactionResetButton, styles.transactionFilterFullWidth, { backgroundColor: palette.muted }]}>
          <MaterialCommunityIcons name="backup-restore" size={17} color={palette.text} /><Text style={{ color: palette.text, fontWeight: "600" }}>Reset Filter</Text>
        </Pressable>
      </View>
    </View>
    {visibleData.length ? <View style={[styles.transactionCardList, { borderColor: palette.border, backgroundColor: palette.card }]}>{visibleData.map((item, index) => <View key={item.id} style={[styles.transactionMobileCard, { borderBottomColor: palette.border, backgroundColor: palette.card }, index === visibleData.length - 1 && styles.transactionMobileCardLast]}>
      <View style={styles.transactionMobileMain}>
        <View style={styles.transactionMobileCopy}>
          <Text style={[styles.transactionDateText, { color: palette.secondaryText }]}>{formatTransactionDate(item, language)}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: palette.muted }]}><RawText numberOfLines={1} style={[styles.transactionCategoryText, { color: palette.text }]}>{item.category}</RawText></View>
          <Text numberOfLines={1} style={[styles.transactionNoteText, { color: palette.secondaryText }]}>{item.note}</Text>
          {item.syncState && <Text style={[styles.transactionSyncStatus, { color: palette.text }]}>{translateMobileText(item.syncState === "failed" ? "Sinkronisasi gagal" : "Belum tersinkron", language)}</Text>}
        </View>
        <Text style={[styles.transactionAmount, { color: item.income ? palette.incomeAmount : palette.expenseAmount }]}>{item.amount}</Text>
      </View>
      <View style={[styles.transactionMobileActions, { borderTopColor: palette.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Lihat", item.note, language)} onPress={() => onViewTransaction(item)} style={styles.transactionActionButton}><MaterialCommunityIcons name="eye-outline" size={18} color={palette.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Ubah", item.note, language)} onPress={() => onEditTransaction(item)} style={styles.transactionActionButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={palette.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Duplikasi ${item.note}`} onPress={() => addTransaction({ date: item.date, dateISO: item.dateISO, category: item.category, note: item.note, amount: item.amount, income: item.income })} style={styles.transactionActionButton}><MaterialCommunityIcons name="content-copy" size={18} color={palette.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Hapus", item.note, language)} onPress={() => setPendingDelete(item)} style={styles.transactionActionButton}><MaterialCommunityIcons name="delete-outline" size={18} color={palette.expenseAmount} /></Pressable>
      </View>
    </View>)}</View> : <View style={[styles.transactionNoResults, { borderColor: palette.border, backgroundColor: palette.surface }]}><MaterialCommunityIcons name="receipt-text-outline" size={30} color={palette.secondaryText} /><Text style={[styles.transactionNoResultsTitle, { color: palette.text }]}>Belum ada transaksi.</Text><Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Mulai dengan menambahkan transaksi pertama Anda.</Text></View>}
    {filteredData.length > 0 && <View style={styles.transactionPagination}>
      <View style={styles.transactionPageSizeRow}><Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Baris per halaman</Text><View style={styles.filterMenu}>
        <Pressable accessibilityRole="button" accessibilityLabel="Baris per halaman" onPress={() => setOpenFilter(openFilter === "pageSize" ? null : "pageSize")} style={[styles.pageSize, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>{pageSize}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} /></Pressable>
        {openFilter === "pageSize" && <TransientPopupSurface style={[styles.filterOptions, styles.pageSizeOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>{[10, 25, 50].map((size) => <Pressable key={size} accessibilityRole="button" onPress={() => { setPageSize(size); setPage(1); setOpenFilter(null); }} style={styles.filterOption}><Text style={{ color: palette.text }}>{size}</Text></Pressable>)}</TransientPopupSurface>}
      </View></View>
      <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Menampilkan {startIndex}–{endIndex} dari {filteredData.length}</Text>
      <View style={styles.transactionPageControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Sebelumnya" disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} style={[styles.transactionPageNavButton, { borderColor: palette.border, opacity: page <= 1 ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-left" size={18} color={palette.text} /></Pressable>
        <Text style={[styles.transactionPageNumber, { color: palette.secondaryText }]}>{page} / {totalPages}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Berikutnya" disabled={page >= totalPages} onPress={() => setPage((current) => Math.min(totalPages, current + 1))} style={[styles.transactionPageNavButton, { borderColor: palette.border, opacity: page >= totalPages ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-right" size={18} color={palette.text} /></Pressable>
      </View>
    </View>}
  </ScrollView>
  <NativeDeleteDialog
    open={pendingDelete !== null}
    title="Hapus Transaksi"
    description="Apakah Anda yakin ingin menghapus transaksi ini?"
    palette={palette}
    onClose={() => setPendingDelete(null)}
    onConfirm={() => {
      if (pendingDelete) removeTransaction(pendingDelete.id);
      setPendingDelete(null);
    }}
  />
  </>;
}

function BudgetsPage({ palette, userId }: { palette: Palette; userId: string }) {
  const language = useContext(MobileLanguageContext);
  const { transactions, categories, financeRevision, invalidateFinancialSnapshots } = useDemoTransactions();
  const now = new Date();
  const [budgets, setBudgets] = useState<DemoBudget[]>(() => budgetSnapshots.get(userId) ?? []);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [budgetsError, setBudgetsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("category_asc");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [openFilter, setOpenFilter] = useState<"sort" | "month" | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedBudget, setSelectedBudget] = useState<DemoBudget | null>(null);
  const [pendingBudgetDelete, setPendingBudgetDelete] = useState<DemoBudget | null>(null);
  const [formCategory, setFormCategory] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const dismissBudgetFilters = useCallback(() => {
    const wasOpen = openFilter !== null || pageSizeOpen;
    setOpenFilter(null);
    setPageSizeOpen(false);
    return wasOpen;
  }, [openFilter, pageSizeOpen, setOpenFilter, setPageSizeOpen]);
  useTransientDismiss(dismissBudgetFilters);
  const loadBudgets = useCallback(async () => {
    setBudgetsLoading(true);
    setBudgetsError(null);
    try {
      const response = await financeApi.listBudgets();
      const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
      const nextBudgets = response.map((budget) => {
        const amount = Number(budget.budget_amount_cents);
        if (!Number.isSafeInteger(amount) || amount < 0) {
          throw new Error("The server returned an invalid budget amount.");
        }
        const period = `${budget.year}-${String(budget.month).padStart(2, "0")}`;
        const spent = transactions
          .filter((transaction) =>
            transaction.categoryId === budget.category_id && transaction.dateISO.startsWith(period) && !transaction.income,
          )
          .reduce((total, transaction) => total + getTransactionAmount(transaction), 0);
        return {
          id: budget.id,
          category: categoryNames.get(budget.category_id) ?? budget.category_name ?? "Kategori tidak tersedia",
          categoryId: budget.category_id,
          amount,
          spent,
          month: budget.month,
          year: budget.year,
        };
      });
      budgetSnapshots.set(userId, nextBudgets);
      setBudgets(nextBudgets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to load native budgets.", error);
      setBudgetsError(message);
    } finally {
      setBudgetsLoading(false);
    }
  }, [categories, transactions, userId, setBudgets, setBudgetsError, setBudgetsLoading]);
  useEffect(() => {
    void Promise.resolve().then(loadBudgets);
  }, [financeRevision, loadBudgets]);

  const periodBudgets = budgets.filter((item) => item.month === month && item.year === year);
  const filteredBudgets = periodBudgets.filter((item) => item.category.toLowerCase().includes(query.trim().toLowerCase()));
  const sortedBudgets = [...filteredBudgets].sort((a, b) => {
    if (sort === "category_desc") return b.category.localeCompare(a.category);
    if (sort === "amount_desc") return b.amount - a.amount;
    if (sort === "amount_asc") return a.amount - b.amount;
    if (sort === "spent_desc") return b.spent - a.spent;
    if (sort === "percentage_desc") return (b.spent / b.amount) - (a.spent / a.amount);
    return a.category.localeCompare(b.category);
  });
  const totalPages = Math.max(1, Math.ceil(filteredBudgets.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleBudgets = sortedBudgets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalAmount = periodBudgets.reduce((sum, item) => sum + item.amount, 0);
  const totalSpent = periodBudgets.reduce((sum, item) => sum + item.spent, 0);
  const overallUsage = totalAmount ? Math.round((totalSpent / totalAmount) * 100) : 0;
  const sortOptions: [string, string][] = [
    ["category_asc", "Kategori (A-Z)"],
    ["category_desc", "Kategori (Z-A)"],
    ["amount_desc", "Anggaran (Tertinggi)"],
    ["amount_asc", "Anggaran (Terendah)"],
    ["spent_desc", "Terpakai (Terbanyak)"],
    ["percentage_desc", "Penggunaan (Tertinggi)"],
  ];
  const sortLabel = sortOptions.find(([key]) => key === sort)?.[1] ?? sortOptions[0][1];
  const periodLabel = `${monthOptions[month - 1]} ${year}`;

  const openEditor = (mode: "create" | "edit" | "view", budget: DemoBudget | null = null) => {
    setFormMode(mode);
    setSelectedBudget(budget);
    setFormCategory(budget?.category ?? categories.find((category) => category.type === "EXPENSE")?.name ?? "");
    setFormAmount(budget ? String(budget.amount) : "");
    setFormMonth(budget?.month ?? month);
    setFormYear(budget?.year ?? year);
    setEditorOpen(true);
  };
  const saveBudget = async () => {
    const amount = Number(formAmount.replace(/[^\d]/g, ""));
    const category = categories.find((item) => item.type === "EXPENSE" && item.name === formCategory);
    if (!category || !Number.isSafeInteger(amount) || amount <= 0) {
      showLocalizedAlert("Data anggaran belum lengkap", "Pilih kategori dan masukkan jumlah anggaran lebih dari nol.", language);
      return;
    }
    const duplicate = budgets.some((item) =>
      item.id !== selectedBudget?.id && item.category === formCategory && item.month === formMonth && item.year === formYear
    );
    if (duplicate) {
      showLocalizedAlert("Anggaran sudah ada", "Kategori tersebut sudah memiliki anggaran untuk periode ini.", language);
      return;
    }
    try {
      const payload = {
        category_id: category.id,
        budget_amount_cents: amount,
        month: formMonth,
        year: formYear,
      };
      if (selectedBudget) await financeApi.updateBudget(selectedBudget.id, payload);
      else await financeApi.createBudget(payload);
      await loadBudgets();
      setEditorOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to save native budget.", error);
      Alert.alert(translateMobileText("Anggaran tidak dapat disimpan.", language), message);
    }
  };
  const resetFilters = () => {
    setQuery("");
    setSort("category_asc");
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setPage(1);
    setOpenFilter(null);
    setPageSizeOpen(false);
  };
  const renderFilterOptions = (key: "sort" | "month") => {
    if (openFilter !== key) return null;
    const options: [string, string][] = key === "sort"
      ? sortOptions
      : monthOptions.map((label, index): [string, string] => [String(index + 1), label]);
    return <TransientPopupSurface style={[styles.filterOptions, styles.budgetFilterOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <ScrollView nestedScrollEnabled>
      {options.map(([value, label]) => <Pressable key={`${key}-${value}`} accessibilityRole="button" onPress={() => {
        if (key === "sort") setSort(value);
        else setMonth(Number(value));
        setPage(1);
        setOpenFilter(null);
      }} style={styles.filterOption}><Text style={{ color: palette.text }}>{label}</Text></Pressable>)}
      </ScrollView>
    </TransientPopupSurface>;
  };
  const usageColor = (usage: number) => usage >= 90 ? palette.expenseAmount : usage >= 70 ? "#F59E0B" : palette.accent;
  const formSelect = (key: "category" | "month", label: string, options: string[]) => {
    if (key === "category") {
      return <NativeSelect
        label={label}
        value={formCategory}
        options={options.map((option) => ({ value: option, label: option }))}
        palette={palette}
        active={editorOpen}
        disabled={formMode === "view"}
        onChange={setFormCategory}
      />;
    }
    return <NativeSelect
      label={label}
      value={formMonth}
      options={options.map((option, index) => ({ value: index + 1, label: option }))}
      palette={palette}
      active={editorOpen}
      disabled={formMode === "view"}
      onChange={setFormMonth}
    />;
  };

  return <>
  <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, styles.budgetContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <PageHeader palette={palette} title="Anggaran" description="Tetapkan batas pengeluaran per kategori dan kendalikan anggaran." />
    <FinanceDataState palette={palette} loading={budgetsLoading} error={budgetsError} onRetry={() => { void loadBudgets(); }} />
    <Toolbar palette={palette} count={`${filteredBudgets.length} anggaran`} action="Tambah Anggaran" onAction={() => openEditor("create")} />
    <View style={[styles.budgetFilterCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.searchBox, styles.budgetSearchBox, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <MaterialCommunityIcons name="magnify" size={17} color={palette.secondaryText} />
        <TextInput value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="Cari anggaran..." placeholderTextColor={palette.secondaryText} style={[styles.searchInput, styles.categorySearchInput, { color: palette.text }]} accessibilityLabel="Cari anggaran..." returnKeyType="search" />
      </View>
      <View style={styles.budgetFilters}>
        <View style={styles.filterMenu}>
          <Pressable accessibilityRole="button" accessibilityLabel="Urutkan" accessibilityState={{ expanded: openFilter === "sort" }} onPress={() => setOpenFilter(openFilter === "sort" ? null : "sort")} style={[styles.categoryFilterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text numberOfLines={1} style={[styles.categoryFilterLabel, { color: palette.text }]}>{sortLabel}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} />
          </Pressable>{renderFilterOptions("sort")}
        </View>
        <View style={styles.filterMenu}>
          <Pressable accessibilityRole="button" accessibilityLabel="Bulan" accessibilityState={{ expanded: openFilter === "month" }} onPress={() => setOpenFilter(openFilter === "month" ? null : "month")} style={[styles.categoryFilterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.categoryFilterLabel, { color: palette.text }]}>{monthOptions[month - 1]}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} />
          </Pressable>{renderFilterOptions("month")}
        </View>
        <View style={[styles.budgetYearStepper, { borderColor: palette.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tahun sebelumnya" onPress={() => { setYear((value) => value - 1); setPage(1); }} style={styles.budgetYearButton}><MaterialCommunityIcons name="chevron-left" size={18} color={palette.secondaryText} /></Pressable>
          <Text style={[styles.categoryFilterLabel, { color: palette.text }]}>{year}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Tahun berikutnya" onPress={() => { setYear((value) => value + 1); setPage(1); }} style={styles.budgetYearButton}><MaterialCommunityIcons name="chevron-right" size={18} color={palette.secondaryText} /></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={resetFilters} style={[styles.categoryResetButton, { borderColor: palette.border }]}>
          <MaterialCommunityIcons name="backup-restore" size={15} color={palette.text} /><Text style={[styles.categoryFilterLabel, { color: palette.text }]}>Reset Filter</Text>
        </Pressable>
      </View>
    </View>
    <View style={styles.budgetSummaryList}>
      {[
        ["Total Anggaran", formatBudgetMoney(totalAmount)],
        ["Total Terpakai", formatBudgetMoney(totalSpent)],
        ["Sisa", formatBudgetMoney(totalAmount - totalSpent)],
        ["Penggunaan", `${overallUsage}%`],
      ].map(([label, value]) => <Card key={label} palette={palette} style={styles.budgetSummaryCard}>
        <Text style={[styles.kpiLabel, { color: palette.secondaryText }]}>{label}</Text>
        <Text style={[styles.kpiValue, { color: palette.text }]}>{value}</Text>
      </Card>)}
    </View>
    {visibleBudgets.length ? <View style={styles.budgetCardList}>
      {visibleBudgets.map((budget) => {
        const usage = budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100) : 0;
        return <Card key={budget.id} palette={palette} style={styles.budgetCard}>
          <View style={styles.budgetCardHeading}>
            <View style={styles.budgetCardTitleWrap}>
              <RawText numberOfLines={2} style={[styles.budgetCardTitle, { color: palette.text }]}>{budget.category}</RawText>
              <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{monthOptions[budget.month - 1]} {budget.year}</Text>
            </View>
            {usage >= 90 && <Text style={[styles.budgetOverLabel, { color: palette.expenseAmount }]}>Melebihi batas</Text>}
          </View>
          <View style={styles.budgetUsageRow}>
            <View style={[styles.progressTrack, styles.budgetProgressTrack, { backgroundColor: palette.border }]}>
              <View style={[styles.progressFill, { backgroundColor: usageColor(usage), width: `${Math.min(100, usage)}%` as `${number}%` }]} />
            </View>
            <Text style={[styles.budgetUsageText, { color: usageColor(usage) }]}>{usage}%</Text>
          </View>
          <View style={styles.budgetAmounts}>
            {[
              ["Total Anggaran", formatBudgetMoney(budget.amount, true)],
              ["Total Terpakai", formatBudgetMoney(budget.spent, true)],
              ["Sisa", formatBudgetMoney(budget.amount - budget.spent, true)],
            ].map(([label, value]) => <View key={label} style={styles.budgetAmountItem}>
              <Text style={[styles.budgetAmountLabel, { color: palette.secondaryText }]}>{label}</Text>
              <Text numberOfLines={1} style={[styles.budgetAmountValue, { color: palette.text }]}>{value}</Text>
            </View>)}
          </View>
          <View style={[styles.budgetActions, { borderTopColor: palette.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Lihat", budget.category, language)} onPress={() => openEditor("view", budget)} style={styles.categoryActionButton}><MaterialCommunityIcons name="eye-outline" size={18} color={palette.text} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Ubah", budget.category, language)} onPress={() => openEditor("edit", budget)} style={styles.categoryActionButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={palette.text} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Hapus", budget.category, language)} onPress={() => setPendingBudgetDelete(budget)} style={styles.categoryActionButton}><MaterialCommunityIcons name="delete-outline" size={18} color={palette.expenseAmount} /></Pressable>
          </View>
        </Card>;
      })}
    </View> : <View style={[styles.budgetEmptyState, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <MaterialCommunityIcons name="wallet-outline" size={28} color={palette.secondaryText} />
      <Text style={[styles.transactionNoResultsTitle, { color: palette.text }]}>{periodBudgets.length ? "Tidak ada anggaran yang cocok" : `Belum ada anggaran untuk ${periodLabel}`}</Text>
      <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{periodBudgets.length ? "Ubah kata pencarian untuk melihat anggaran." : "Tambahkan anggaran untuk mulai menetapkan batas pengeluaran."}</Text>
      {!periodBudgets.length && <Pressable accessibilityRole="button" onPress={() => openEditor("create")} style={[styles.primaryButton, styles.addActionButton, { backgroundColor: palette.accent, marginTop: 8 }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Tambah Anggaran</Text></Pressable>}
    </View>}
    {filteredBudgets.length > 0 && <View style={styles.budgetPagination}>
      <View style={styles.categoryPageSizeRow}>
        <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Baris per halaman</Text>
        <View style={styles.filterMenu}>
          <Pressable accessibilityRole="button" accessibilityLabel="Baris per halaman" onPress={() => setPageSizeOpen((open) => !open)} style={[styles.pageSize, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>{pageSize}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} /></Pressable>
          {pageSizeOpen && <TransientPopupSurface style={[styles.filterOptions, styles.categoryPageSizeOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>{[10, 25, 50].map((size) => <Pressable key={size} accessibilityRole="button" accessibilityState={{ selected: pageSize === size }} onPress={() => { setPageSize(size); setPage(1); setPageSizeOpen(false); }} style={styles.filterOption}><Text style={{ color: palette.text }}>{size}</Text></Pressable>)}</TransientPopupSurface>}
        </View>
      </View>
      <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Menampilkan {filteredBudgets.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredBudgets.length)}` : "0–0"} dari {filteredBudgets.length}</Text>
      <View style={styles.categoryPageControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Sebelumnya" accessibilityState={{ disabled: currentPage <= 1 }} disabled={currentPage <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage <= 1 ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-left" size={18} color={palette.secondaryText} /></Pressable>
        <Text style={[styles.categoryPaginationText, { color: palette.secondaryText }]}>{currentPage} / {totalPages}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Berikutnya" accessibilityState={{ disabled: currentPage >= totalPages }} disabled={currentPage >= totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage >= totalPages ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-right" size={18} color={palette.secondaryText} /></Pressable>
      </View>
    </View>}
    <FloatingFormModal
      open={editorOpen}
      palette={palette}
      title={formMode === "view" ? "Detail Anggaran" : formMode === "edit" ? "Ubah Anggaran" : "Tambah Anggaran"}
      description={formMode === "create" ? "Batas pengeluaran untuk kategori dan periode." : `${monthOptions[(selectedBudget?.month ?? formMonth) - 1]} ${selectedBudget?.year ?? formYear}`}
      onClose={() => setEditorOpen(false)}
      actions={formMode === "view"
        ? <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={[styles.floatingModalCancelButton, { backgroundColor: palette.background, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Tutup</Text></Pressable>
        : <>
            <Pressable accessibilityRole="button" onPress={saveBudget} style={[styles.floatingModalSaveButton, { backgroundColor: palette.accent }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Simpan</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={[styles.floatingModalCancelButton, { backgroundColor: palette.background, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Batal</Text></Pressable>
          </>
      }
    >
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Kategori</Text>
      {formSelect("category", "Kategori anggaran", categories.filter((item) => item.type === "EXPENSE").map((item) => item.name))}
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Nominal Anggaran</Text>
      <NumericInput value={formAmount} onChangeValue={setFormAmount} editable={formMode !== "view"} placeholder="Masukkan jumlah" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.floatingModalInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Nominal Anggaran" />
      <View style={styles.budgetFormPeriod}>
        <View style={styles.budgetFormPeriodItem}><Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Bulan</Text>{formSelect("month", "Bulan anggaran", monthOptions)}</View>
        <View style={styles.budgetFormPeriodItem}><Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Tahun</Text><View style={[styles.budgetYearStepper, styles.floatingModalInput, { backgroundColor: palette.input, borderColor: palette.border }]}><Pressable accessibilityRole="button" accessibilityLabel="Tahun sebelumnya" disabled={formMode === "view"} onPress={() => setFormYear((value) => value - 1)} style={styles.budgetYearButton}><MaterialCommunityIcons name="chevron-left" size={18} color={palette.secondaryText} /></Pressable><Text style={[styles.categoryFilterLabel, { color: palette.text }]}>{formYear}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tahun berikutnya" disabled={formMode === "view"} onPress={() => setFormYear((value) => value + 1)} style={styles.budgetYearButton}><MaterialCommunityIcons name="chevron-right" size={18} color={palette.secondaryText} /></Pressable></View></View>
      </View>
    </FloatingFormModal>
  </ScrollView>
  <NativeDeleteDialog
    open={pendingBudgetDelete !== null}
    title="Hapus Anggaran"
    description="Apakah Anda yakin ingin menghapus anggaran ini?"
    palette={palette}
    onClose={() => setPendingBudgetDelete(null)}
    onConfirm={() => {
      if (pendingBudgetDelete) {
        void financeApi.removeBudget(pendingBudgetDelete.id)
          .then((response) => {
            if (!response.success) throw new Error("The server could not delete the budget.");
            invalidateFinancialSnapshots();
            setBudgets((current) => {
              const next = current.filter((budget) => budget.id !== pendingBudgetDelete.id);
              budgetSnapshots.set(userId, next);
              return next;
            });
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Silakan coba lagi.";
            console.error("Failed to delete native budget.", error);
            Alert.alert(translateMobileText("Anggaran tidak dapat dihapus.", language), message);
          });
      }
      setPendingBudgetDelete(null);
    }}
  />
  </>;
}

function GoalsPage({ palette, userId }: { palette: Palette; userId: string }) {
  const language = useContext(MobileLanguageContext);
  const { categories, financeRevision, invalidateFinancialSnapshots } = useDemoTransactions();
  const today = getLocalDateInput();
  const [goals, setGoals] = useState<DemoGoal[]>(() => goalSnapshots.get(userId) ?? []);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | DemoGoal["status"]>("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openFilter, setOpenFilter] = useState<"status" | "sort" | "pageSize" | null>(null);
  const dismissGoalFilters = useCallback(() => {
    const wasOpen = openFilter !== null;
    setOpenFilter(null);
    return wasOpen;
  }, [openFilter]);
  useTransientDismiss(dismissGoalFilters);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedGoal, setSelectedGoal] = useState<DemoGoal | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formCurrent, setFormCurrent] = useState("");
  const [formStartDate, setFormStartDate] = useState(today);
  const [formTargetDate, setFormTargetDate] = useState(today);
  const [openDateField, setOpenDateField] = useState<"start" | "target" | null>(null);
  const [formStatus, setFormStatus] = useState<DemoGoal["status"]>("ACTIVE");
  const [formCategory, setFormCategory] = useState("");
  const [pendingGoalDelete, setPendingGoalDelete] = useState<DemoGoal | null>(null);
  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const response = await financeApi.listSavingGoals();
      const categoryNames = new Map(categories.map((category) => [category.id, category.label]));
      const nextGoals = response.map((goal) => {
        const target = Number(goal.target_amount_cents);
        const current = Number(goal.current_amount_cents);
        if (!Number.isFinite(target) || !Number.isFinite(current)) {
          throw new Error("The server returned invalid saving goal amounts.");
        }
        return {
          id: goal.id,
          name: goal.name,
          description: goal.description ?? "",
          target,
          current,
          startDate: goal.start_date.slice(0, 10),
          targetDate: goal.target_date.slice(0, 10),
          status: goal.status,
          category: goal.category_id ? categoryNames.get(goal.category_id) ?? "" : "",
          categoryId: goal.category_id ?? undefined,
        };
      });
      goalSnapshots.set(userId, nextGoals);
      setGoals(nextGoals);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to load native saving goals.", error);
      setGoalsError(message);
    } finally {
      setGoalsLoading(false);
    }
  }, [categories, userId]);
  useEffect(() => {
    void Promise.resolve().then(loadGoals);
  }, [financeRevision, loadGoals]);

  const sortOptions: [string, string][] = [
    ["name_asc", "Nama (A-Z)"],
    ["name_desc", "Nama (Z-A)"],
    ["target_desc", "Target (Tertinggi)"],
    ["target_asc", "Target (Terendah)"],
    ["progress_desc", "Progres (Tertinggi)"],
    ["target_date_asc", "Tanggal Target (Terdekat)"],
  ];
  const statusOptions: { value: "all" | DemoGoal["status"]; label: string }[] = [
    { value: "all", label: "Semua Status" },
    { value: "ACTIVE", label: "Aktif" },
    { value: "COMPLETED", label: "Selesai" },
    { value: "CANCELLED", label: "Dibatalkan" },
  ];
  const categoryOptions = ["", ...categories.map((category) => category.label)];
  const visibleGoals = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = goals.filter((goal) =>
      (status === "all" || goal.status === status) &&
      (!keyword || goal.name.toLowerCase().includes(keyword) || goal.description.toLowerCase().includes(keyword))
    );
    return result.sort((a, b) => {
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "target_desc") return b.target - a.target;
      if (sort === "target_asc") return a.target - b.target;
      if (sort === "progress_desc") return (b.current / b.target) - (a.current / a.target);
      if (sort === "target_date_asc") return a.targetDate.localeCompare(b.targetDate);
      return a.name.localeCompare(b.name);
    });
  }, [goals, query, sort, status]);
  const totalPages = Math.max(1, Math.ceil(visibleGoals.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageGoals = visibleGoals.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const sortLabel = sortOptions.find(([value]) => value === sort)?.[1] ?? sortOptions[0][1];
  const statusLabel = statusOptions.find((option) => option.value === status)?.label ?? "Semua Status";

  const openEditor = useCallback((mode: "create" | "edit" | "view", goal: DemoGoal | null = null) => {
    setFormMode(mode);
    setSelectedGoal(goal);
    setFormName(goal?.name ?? "");
    setFormDescription(goal?.description ?? "");
    setFormTarget(goal ? String(goal.target) : "");
    setFormCurrent(goal ? String(goal.current) : "0");
    setFormStartDate(goal?.startDate ?? today);
    setFormTargetDate(goal?.targetDate ?? today);
    setOpenDateField(null);
    setFormStatus(goal?.status ?? "ACTIVE");
    setFormCategory(goal?.category ?? "");
    setEditorOpen(true);
  }, [today]);
  const saveGoal = async () => {
    const target = Number(formTarget.replace(/[^\d]/g, ""));
    const current = Number(formCurrent.replace(/[^\d]/g, ""));
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
    if (!formName.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0 || !validDate(formStartDate) || !validDate(formTargetDate) || formTargetDate < formStartDate) {
      showLocalizedAlert("Periksa data target", "Isi nama, nominal target yang lebih dari nol, nominal terkumpul, dan tanggal yang valid.", language);
      return;
    }
    const categoryId = categories.find((category) => category.label === formCategory)?.id;
    if (formCategory && !categoryId) {
      showLocalizedAlert("Kategori target tidak tersedia", "Pilih kategori yang masih aktif.", language);
      return;
    }
    try {
      const payload = {
        name: formName.trim(),
        category_id: categoryId,
        description: formDescription.trim() || undefined,
        target_amount_cents: target,
        current_amount_cents: current,
        start_date: new Date(`${formStartDate}T00:00:00`).toISOString(),
        target_date: new Date(`${formTargetDate}T00:00:00`).toISOString(),
        status: formStatus,
      };
      if (selectedGoal) await financeApi.updateSavingGoal(selectedGoal.id, payload);
      else await financeApi.createSavingGoal(payload);
      await loadGoals();
      setPage(1);
      setEditorOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to save native saving goal.", error);
      Alert.alert(translateMobileText("Target tabungan tidak dapat disimpan.", language), message);
    }
  };
  const handleView = useCallback((goal: DemoGoal) => openEditor("view", goal), [openEditor]);
  const handleEdit = useCallback((goal: DemoGoal) => openEditor("edit", goal), [openEditor]);
  const handleDelete = useCallback((goal: DemoGoal) => setPendingGoalDelete(goal), []);
  const renderGoal = useCallback(({ item }: { item: DemoGoal }) => (
    <GoalCardNative goal={item} palette={palette} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
  ), [handleDelete, handleEdit, handleView, palette]);
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setSort("name_asc");
    setPage(1);
    setOpenFilter(null);
  };
  const filterButton = (key: "status" | "sort", label: string, options: { value: string; label: string }[], selected: string) => {
    const expanded = openFilter === key;
    const selectedValue = key === "status" ? status : sort;
    return <View style={styles.goalFilterMenu} key={key}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} onPress={() => setOpenFilter(expanded ? null : key)} style={[styles.goalFilterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <Text numberOfLines={1} style={[styles.categoryFilterLabel, { color: palette.text }]}>{selected}</Text>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={palette.secondaryText} />
      </Pressable>
      {expanded && <TransientPopupSurface style={[styles.goalFilterOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {options.map((option) => <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === selectedValue }}
          onPress={() => {
            if (key === "status") setStatus(option.value as typeof status);
            else setSort(option.value);
            setPage(1);
            setOpenFilter(null);
          }}
          style={styles.goalFilterOption}
        >
          <Text style={{ color: palette.text }}>{option.label}</Text>
          {option.value === selectedValue && <MaterialCommunityIcons name="check" size={16} color={palette.accent} />}
        </Pressable>)}
      </TransientPopupSurface>}
    </View>;
  };
  const formSelect = (key: "status" | "category", label: string, options: { value: string; label: string }[], onSelect: (value: string) => void) => (
    <NativeSelect
      label={label}
      value={key === "category" ? formCategory : formStatus}
      options={options}
      palette={palette}
      active={editorOpen}
      disabled={formMode === "view"}
      onChange={onSelect}
    />
  );

  return <>
    <FlatList
    style={styles.scroll}
    contentContainerStyle={[styles.content, styles.goalContent]}
    data={pageGoals}
    keyExtractor={(item) => item.id}
    renderItem={renderGoal}
    keyboardShouldPersistTaps="handled"
    removeClippedSubviews={false}
    showsVerticalScrollIndicator={false}
    ListHeaderComponent={<View style={styles.goalHeader}>
      <PageHeader palette={palette} title="Target Tabungan" description="Rencanakan dan pantau progres target tabungan Anda." />
      <FinanceDataState palette={palette} loading={goalsLoading} error={goalsError} onRetry={() => { void loadGoals(); }} />
      <View style={styles.goalToolbar}>
        <Text style={[styles.resultCount, { color: palette.secondaryText }]}>{visibleGoals.length} target</Text>
        <Pressable accessibilityRole="button" onPress={() => openEditor("create")} style={[styles.primaryButton, styles.transactionPrimaryButton, styles.goalAddButton, { backgroundColor: palette.accent }]}>
          <MaterialCommunityIcons name="plus" size={18} color={palette.accentText} /><Text style={{ color: palette.accentText, fontWeight: "700" }}>Tambah Target</Text>
        </Pressable>
      </View>
      <View style={[styles.goalFilterCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.searchBox, styles.goalSearchBox, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={palette.secondaryText} />
          <TextInput value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="Cari target tabungan..." placeholderTextColor={palette.secondaryText} style={[styles.searchInput, styles.categorySearchInput, { color: palette.text }]} accessibilityLabel="Cari target tabungan..." returnKeyType="search" />
        </View>
        <View style={styles.goalFilters}>
          {filterButton("status", "Filter status target", statusOptions, statusLabel)}
          {filterButton("sort", "Urutkan target", sortOptions.map(([value, label]) => ({ value, label })), sortLabel)}
          <Pressable accessibilityRole="button" onPress={resetFilters} style={[styles.categoryResetButton, styles.goalResetButton, { borderColor: palette.border }]}>
            <MaterialCommunityIcons name="backup-restore" size={16} color={palette.text} /><Text style={[styles.categoryFilterLabel, { color: palette.text }]}>Reset Filter</Text>
          </Pressable>
        </View>
      </View>
    </View>}
    ListEmptyComponent={<View style={[styles.goalEmptyState, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <MaterialCommunityIcons name="bullseye-arrow" size={32} color={palette.secondaryText} />
      <Text style={[styles.transactionNoResultsTitle, { color: palette.text }]}>{goals.length ? "Tidak ada target yang cocok" : "Belum ada target tabungan"}</Text>
      <Text style={[styles.cardSubtitle, { color: palette.secondaryText, textAlign: "center" }]}>{goals.length ? "Ubah kata pencarian atau status untuk melihat target." : "Tambahkan target untuk mulai memantau tabungan."}</Text>
      {!goals.length && <Pressable accessibilityRole="button" onPress={() => openEditor("create")} style={[styles.primaryButton, styles.goalEmptyButton, { backgroundColor: palette.accent }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Tambah Target</Text></Pressable>}
    </View>}
    ListFooterComponent={visibleGoals.length > 0 ? <View style={styles.goalPagination}>
      <View style={styles.categoryPageSizeRow}>
        <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Baris per halaman</Text>
        <View style={styles.filterMenu}>
          <Pressable accessibilityRole="button" accessibilityLabel="Baris per halaman" onPress={() => setOpenFilter(openFilter === "pageSize" ? null : "pageSize")} style={[styles.pageSize, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>{pageSize}</Text><MaterialCommunityIcons name="chevron-down" size={16} color={palette.secondaryText} /></Pressable>
          {openFilter === "pageSize" && <TransientPopupSurface style={[styles.filterOptions, styles.categoryPageSizeOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>{[5, 10, 20, 50].map((size) => <Pressable key={size} accessibilityRole="button" onPress={() => { setPageSize(size); setPage(1); setOpenFilter(null); }} style={styles.filterOption}><Text style={{ color: palette.text }}>{size}</Text></Pressable>)}</TransientPopupSurface>}
        </View>
      </View>
      <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Menampilkan {visibleGoals.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, visibleGoals.length)}` : "0–0"} dari {visibleGoals.length}</Text>
      <View style={styles.categoryPageControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Sebelumnya" disabled={currentPage <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage <= 1 ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-left" size={18} color={palette.secondaryText} /></Pressable>
        <Text style={[styles.categoryPaginationText, { color: palette.secondaryText }]}>{currentPage} / {totalPages}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Berikutnya" disabled={currentPage >= totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage >= totalPages ? 0.45 : 1 }]}><MaterialCommunityIcons name="chevron-right" size={18} color={palette.secondaryText} /></Pressable>
      </View>
    </View> : null}
    ListFooterComponentStyle={styles.goalFooter}
    />
    <FloatingFormModal
      open={editorOpen}
      palette={palette}
      title={formMode === "view" ? "Detail Target" : formMode === "edit" ? "Ubah Target" : "Tambah Target"}
      description={formMode === "create" ? "Rencanakan tabungan yang ingin dicapai." : selectedGoal?.name ?? ""}
      onClose={() => setEditorOpen(false)}
      actions={formMode === "view"
        ? <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Tutup</Text></Pressable>
        : <>
            <Pressable accessibilityRole="button" onPress={saveGoal} style={[styles.floatingModalSaveButton, { backgroundColor: palette.accent }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Simpan</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Batal</Text></Pressable>
          </>
      }
    >
      <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Nama Target</Text>
      <TextInput value={formName} onChangeText={setFormName} editable={formMode !== "view"} placeholder="Nama target tabungan" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.goalFieldInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Nama Target" />
      <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Deskripsi (opsional)</Text>
      <TextInput value={formDescription} onChangeText={setFormDescription} editable={formMode !== "view"} multiline placeholder="Catatan tentang target ini" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.goalFieldInput, styles.noteInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Deskripsi target" />
      <View style={styles.goalFormAmounts}>
        <View style={styles.goalFormAmountItem}>
          <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Target</Text>
          <NumericInput value={formTarget} onChangeValue={setFormTarget} editable={formMode !== "view"} placeholder="0" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.goalFieldInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Nominal target" />
        </View>
        <View style={styles.goalFormAmountItem}>
          <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Terkumpul</Text>
          <NumericInput value={formCurrent} onChangeValue={setFormCurrent} editable={formMode !== "view"} placeholder="0" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.goalFieldInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} accessibilityLabel="Nominal terkumpul" />
        </View>
      </View>
      <View style={styles.goalFormAmounts}>
        <View style={styles.goalFormAmountItem}>
          <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Tanggal Mulai</Text>
          <NativeCalendarPicker
            label="Tanggal mulai"
            value={formStartDate}
            palette={palette}
            active={editorOpen && openDateField === "start"}
            disabled={formMode === "view"}
            onOpenChange={(open) => setOpenDateField(open ? "start" : null)}
            onChange={setFormStartDate}
            allowClear={false}
            triggerStyle={[styles.fieldInput, styles.goalFieldInput, { backgroundColor: palette.input }]}
          />
        </View>
        <View style={styles.goalFormAmountItem}>
          <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Tanggal Target</Text>
          <NativeCalendarPicker
            label="Tanggal target"
            value={formTargetDate}
            palette={palette}
            active={editorOpen && openDateField === "target"}
            disabled={formMode === "view"}
            onOpenChange={(open) => setOpenDateField(open ? "target" : null)}
            onChange={setFormTargetDate}
            allowClear={false}
            triggerStyle={[styles.fieldInput, styles.goalFieldInput, { backgroundColor: palette.input }]}
          />
        </View>
      </View>
      <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Kategori (opsional)</Text>
      {formSelect("category", "Kategori target", categoryOptions.map((value) => ({ value, label: value || "Tidak ada kategori" })), setFormCategory)}
      <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Status</Text>
      {formSelect("status", "Status target", statusOptions.filter((option) => option.value !== "all"), (value) => setFormStatus(value as DemoGoal["status"]))}
    </FloatingFormModal>
    <NativeDeleteDialog
      open={pendingGoalDelete !== null}
      title="Hapus Target Tabungan"
      description="Apakah Anda yakin ingin menghapus target tabungan ini?"
      palette={palette}
      onClose={() => setPendingGoalDelete(null)}
      onConfirm={() => {
        if (pendingGoalDelete) {
          const deletedGoalId = pendingGoalDelete.id;
          void financeApi.removeSavingGoal(deletedGoalId)
            .then((response) => {
              if (!response.success) throw new Error("The server could not delete the saving goal.");
              invalidateFinancialSnapshots();
              setGoals((current) => {
                const next = current.filter((goal) => goal.id !== deletedGoalId);
                goalSnapshots.set(userId, next);
                return next;
              });
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : "Silakan coba lagi.";
              console.error("Failed to delete native saving goal.", error);
              Alert.alert(translateMobileText("Target tabungan tidak dapat dihapus.", language), message);
            });
        }
        setPendingGoalDelete(null);
      }}
    />
  </>;
}

const GoalCardNative = memo(function GoalCardNative({ goal, palette, onView, onEdit, onDelete }: {
  goal: DemoGoal;
  palette: Palette;
  onView: (goal: DemoGoal) => void;
  onEdit: (goal: DemoGoal) => void;
  onDelete: (goal: DemoGoal) => void;
}) {
  const [today] = useState(getLocalDateInput);
  const [estimateNow] = useState(() => Date.now());
  const language = useContext(MobileLanguageContext);
  const { width: viewportWidth } = useWindowDimensions();
  const percentage = goal.target > 0 ? Math.min(999, Math.round((goal.current / goal.target) * 1000) / 10) : 0;
  const estimate = goal.current > 0 && goal.current < goal.target && goal.startDate < today
    ? new Date(Date.parse(`${today}T00:00:00`) + ((goal.target - goal.current) / (goal.current / Math.max(1, (estimateNow - Date.parse(`${goal.startDate}T00:00:00`))))) ).toISOString().slice(0, 10)
    : null;
  const statusLabel = goal.status === "COMPLETED" ? "Selesai" : goal.status === "CANCELLED" ? "Dibatalkan" : "Aktif";
  const darkTheme = palette.background === "#020202";
  const statusColor = goal.status === "COMPLETED"
    ? palette.incomeAmount
    : goal.status === "CANCELLED"
      ? palette.secondaryText
      : darkTheme ? "#3B82F6" : "#1D4ED8";
  const statusBackground = goal.status === "COMPLETED"
    ? darkTheme ? "rgba(16,185,129,0.1)" : "rgba(4,120,87,0.08)"
    : goal.status === "CANCELLED"
      ? palette.muted
      : darkTheme ? "rgba(59,130,246,0.1)" : "rgba(29,78,216,0.08)";
  const statusBorder = goal.status === "COMPLETED"
    ? darkTheme ? "rgba(16,185,129,0.3)" : "rgba(4,120,87,0.3)"
    : goal.status === "CANCELLED"
      ? palette.border
      : darkTheme ? "rgba(59,130,246,0.3)" : "rgba(29,78,216,0.3)";
  const formatGoalDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short", year: "numeric" });
  const amounts = [["Target", goal.target], ["Sisa", Math.max(0, goal.target - goal.current)]] as const;
  return <View style={[styles.goalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
    <View style={styles.goalCardHeading}>
      <View style={styles.goalCardCopy}>
        <RawText numberOfLines={1} style={[styles.goalCardTitle, { color: palette.text }]}>{goal.name}</RawText>
        {!!goal.description && <RawText numberOfLines={1} style={[styles.goalCardDescription, { color: palette.secondaryText }]}>{goal.description}</RawText>}
      </View>
      <View style={[styles.goalStatusChip, { backgroundColor: statusBackground, borderColor: statusBorder }]}><Text style={[styles.goalStatusText, { color: statusColor }]}>{statusLabel}</Text></View>
    </View>
    <View style={styles.goalProgressSummary}>
      <View style={styles.goalProgressLead}>
        <Text style={[styles.goalAmountLabel, { color: palette.secondaryText }]}>Terkumpul</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.goalProgressValue, { color: palette.text }]}>{formatBudgetMoney(goal.current, true)}</Text>
      </View>
      <Text style={[styles.goalPercentage, { color: palette.accent }]}>{Math.round(percentage)}%</Text>
    </View>
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Progres target ${goal.name}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.max(0, Math.min(100, percentage)) }}
      style={[styles.goalProgressTrack, { backgroundColor: palette.border }]}
    >
      <View style={[styles.goalProgressFill, { backgroundColor: palette.accent, width: `${Math.min(100, percentage)}%` as `${number}%` }]} />
    </View>
    <View style={styles.goalAmounts}>
      {amounts.map(([label, value]) => <View key={label} style={[styles.goalAmountItem, viewportWidth < 400 && styles.goalAmountItemNarrow]}>
        <Text style={[styles.goalAmountLabel, { color: palette.secondaryText }]}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[label === "Target" ? styles.goalTargetValue : styles.goalAmountValue, { color: palette.text }]}>{formatBudgetMoney(value, true)}</Text>
      </View>)}
    </View>
    <Text style={[styles.goalEstimate, { color: palette.secondaryText }]}>Estimasi tercapai: {estimate ? formatGoalDate(estimate) : "Belum cukup data"}</Text>
    <View style={[styles.goalActions, { borderTopColor: palette.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Lihat", goal.name, language)} onPress={() => onView(goal)} style={styles.goalActionButton}><MaterialCommunityIcons name="eye-outline" size={18} color={palette.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Ubah", goal.name, language)} onPress={() => onEdit(goal)} style={styles.goalActionButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={palette.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Hapus", goal.name, language)} onPress={() => onDelete(goal)} style={styles.goalActionButton}><MaterialCommunityIcons name="delete-outline" size={18} color={palette.expenseAmount} /></Pressable>
    </View>
  </View>;
});

function InvestmentsPage({ palette, userId }: { palette: Palette; userId: string }) {
  const language = useContext(MobileLanguageContext);
  const { financeRevision, invalidateFinancialSnapshots } = useDemoTransactions();
  const [items, setItems] = useState<DemoInvestment[]>(() => investmentSnapshots.get(userId) ?? []);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState<DemoInvestment["status"] | "all">("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openFilter, setOpenFilter] = useState<"type" | "status" | "sort" | "pageSize" | null>(null);
  const dismissInvestmentFilters = useCallback(() => {
    const wasOpen = openFilter !== null;
    setOpenFilter(null);
    return wasOpen;
  }, [openFilter]);
  useTransientDismiss(dismissInvestmentFilters);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedItem, setSelectedItem] = useState<DemoInvestment | null>(null);
  const [pendingInvestmentDelete, setPendingInvestmentDelete] = useState<DemoInvestment | null>(null);
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("");
  const [formSymbol, setFormSymbol] = useState("");
  const [formType, setFormType] = useState("Stock");
  const [formStatus, setFormStatus] = useState<DemoInvestment["status"]>("ACTIVE");
  const [formQuantity, setFormQuantity] = useState("0");
  const [formAverageBuyPrice, setFormAverageBuyPrice] = useState("0");
  const [formCurrentPrice, setFormCurrentPrice] = useState("");
  const [formInvested, setFormInvested] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [purchaseDateOpen, setPurchaseDateOpen] = useState(false);
  const loadInvestments = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await financeApi.listInvestments();
      const nextItems = response.map((item) => {
        const quantity = Number(item.quantity);
        const averageBuyPrice = Number(item.average_buy_price);
        const currentPrice = Number(item.current_price);
        const invested = Number(item.invested_amount_cents);
        const currentValue = Number(item.current_value_cents);
        if (![quantity, averageBuyPrice, currentPrice, invested, currentValue].every(Number.isFinite)) {
          throw new Error("The server returned invalid investment values.");
        }
        return {
          id: item.id,
          type: item.investment_type,
          platform: item.platform,
          name: item.name,
          symbol: item.symbol ?? "",
          quantity,
          averageBuyPrice,
          currentPrice,
          invested,
          currentValue,
          purchaseDate: item.purchase_date.slice(0, 10),
          notes: item.notes ?? "",
          status: item.status,
        };
      });
      investmentSnapshots.set(userId, nextItems);
      setItems(nextItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to load native investments.", error);
      setItemsError(message);
    } finally {
      setItemsLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void Promise.resolve().then(loadInvestments);
  }, [financeRevision, loadInvestments]);

  const typeOptions = [
    { value: "all", label: "Semua Jenis" },
    { value: "Stock", label: "Saham" },
    { value: "Mutual Fund", label: "Reksa Dana" },
    { value: "Gold", label: "Emas" },
    { value: "Crypto", label: "Kripto" },
    { value: "Bond", label: "Obligasi" },
    { value: "Deposit", label: "Deposito" },
    { value: "Property", label: "Properti" },
    { value: "Other", label: "Lainnya" },
  ];
  const statusOptions = [
    { value: "all", label: "Semua Status" },
    { value: "ACTIVE", label: "Aktif" },
    { value: "SOLD", label: "Dijual" },
    { value: "CLOSED", label: "Ditutup" },
  ];
  const sortOptions = [
    { value: "name_asc", label: "Nama (A-Z)" },
    { value: "name_desc", label: "Nama (Z-A)" },
    { value: "value_desc", label: "Nilai (Tertinggi)" },
    { value: "value_asc", label: "Nilai (Terendah)" },
    { value: "pl_desc", label: "Profit/Loss (Terbesar)" },
    { value: "purchase_desc", label: "Tanggal Beli (Terbaru)" },
  ];
  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    const filtered = items.filter((item) =>
      (type === "all" || item.type === type) &&
      (status === "all" || item.status === status) &&
      (!keyword || `${item.name} ${item.platform} ${item.type} ${investmentTypeSearchLabels[item.type] ?? ""} ${item.status} ${item.status === "ACTIVE" ? "aktif" : item.status === "SOLD" ? "dijual" : "ditutup"} ${item.purchaseDate} ${item.invested} ${item.currentValue}`.toLocaleLowerCase().includes(keyword))
    );
    return filtered.sort((a, b) => {
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "value_desc") return b.currentValue - a.currentValue;
      if (sort === "value_asc") return a.currentValue - b.currentValue;
      if (sort === "pl_desc") return (b.currentValue - b.invested) - (a.currentValue - a.invested);
      if (sort === "purchase_desc") return b.purchaseDate.localeCompare(a.purchaseDate);
      return a.name.localeCompare(b.name);
    });
  }, [items, query, sort, status, type]);
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalInvested = items.reduce((sum, item) => sum + item.invested, 0);
  const totalValue = items.reduce((sum, item) => sum + item.currentValue, 0);
  const profitLoss = totalValue - totalInvested;
  const roi = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
  const allocation = useMemo(() => {
    const totals = new Map<string, number>();
    items.forEach((item) => totals.set(item.type, (totals.get(item.type) ?? 0) + item.currentValue));
    return [...totals].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const openEditor = useCallback((mode: "create" | "edit" | "view", item: DemoInvestment | null = null) => {
    setFormMode(mode);
    setSelectedItem(item);
    setFormName(item?.name ?? "");
    setFormPlatform(item?.platform ?? "");
    setFormSymbol(item?.symbol ?? "");
    setFormType(item?.type ?? "Stock");
    setFormStatus(item?.status ?? "ACTIVE");
    setFormQuantity(item ? String(item.quantity) : "0");
    setFormAverageBuyPrice(item ? String(item.averageBuyPrice) : "0");
    setFormCurrentPrice(item ? String(item.currentPrice) : "");
    setFormInvested(item ? String(item.invested) : "");
    setFormNotes(item?.notes ?? "");
    setFormPurchaseDate(item?.purchaseDate ?? "");
    setPurchaseDateOpen(false);
    setEditorOpen(true);
  }, []);
  const saveInvestment = async () => {
    const quantity = Number(formQuantity);
    const averageBuyPrice = Number(formAverageBuyPrice);
    const currentPrice = formCurrentPrice.trim() ? Number(formCurrentPrice) : averageBuyPrice;
    const invested = formMode === "create"
      ? quantity * averageBuyPrice
      : Number(formInvested.replace(/[^\d]/g, ""));
    const currentValue = quantity * currentPrice;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(formPurchaseDate) && !Number.isNaN(Date.parse(`${formPurchaseDate}T00:00:00`));
    if (
      !formName.trim() ||
      !formPlatform.trim() ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isFinite(averageBuyPrice) ||
      averageBuyPrice < 0 ||
      !Number.isFinite(currentPrice) ||
      currentPrice < 0 ||
      !Number.isSafeInteger(Math.round(invested)) ||
      invested < 0 ||
      !Number.isFinite(currentValue) ||
      !["Stock", "Mutual Fund", "Gold", "Crypto", "Bond", "Deposit", "Property", "Other"].includes(formType) ||
      !validDate
    ) {
      showLocalizedAlert("Periksa data investasi", "Isi nama, platform, jumlah unit, harga, modal, dan tanggal beli yang valid.", language);
      return;
    }
    try {
      const payload = {
        investment_type: formType as DemoInvestment["type"],
        platform: formPlatform.trim(),
        name: formName.trim(),
        symbol: formSymbol.trim() || undefined,
        quantity,
        average_buy_price: averageBuyPrice,
        current_price: currentPrice,
        invested_amount_cents: Math.round(invested),
        notes: formNotes.trim() || undefined,
        purchase_date: new Date(`${formPurchaseDate}T00:00:00`).toISOString(),
        status: formStatus,
      };
      if (selectedItem) await financeApi.updateInvestment(selectedItem.id, payload);
      else await financeApi.createInvestment(payload);
      await loadInvestments();
      setPage(1);
      setEditorOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to save native investment.", error);
      Alert.alert(translateMobileText("Investasi tidak dapat disimpan.", language), message);
    }
  };
  const removeInvestment = (item: DemoInvestment) => setPendingInvestmentDelete(item);
  const resetFilters = () => {
    setQuery("");
    setType("all");
    setStatus("all");
    setSort("name_asc");
    setPage(1);
    setOpenFilter(null);
  };
  const selectedLabels = {
    type: typeOptions.find((option) => option.value === type)?.label ?? "Semua Jenis",
    status: statusOptions.find((option) => option.value === status)?.label ?? "Semua Status",
    sort: sortOptions.find((option) => option.value === sort)?.label ?? "Nama (A-Z)",
  };
  const filterButton = (key: "type" | "status" | "sort", label: string, value: string, options: { value: string; label: string }[]) => {
    const expanded = openFilter === key;
    const selectedValue = key === "type" ? type : key === "status" ? status : sort;
    return <View key={key} style={styles.investmentFilterMenu}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setOpenFilter(expanded ? null : key)}
        style={[styles.investmentFilterButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <Text numberOfLines={1} style={[styles.investmentFilterLabel, { color: palette.text }]}>{value}</Text>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={palette.secondaryText} />
      </Pressable>
      {expanded && <TransientPopupSurface style={[styles.investmentFilterOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {options.map((option) => <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === selectedValue }}
          onPress={() => selectFilterOption(option.value)}
          style={styles.investmentFilterOption}
        >
          <Text style={{ color: palette.text }}>{option.label}</Text>
          {option.value === selectedValue && <MaterialCommunityIcons name="check" size={16} color={palette.accent} />}
        </Pressable>)}
      </TransientPopupSurface>}
    </View>;
  };
  const selectFilterOption = (value: string) => {
    if (openFilter === "type") setType(value);
    else if (openFilter === "status") setStatus(value as DemoInvestment["status"] | "all");
    else if (openFilter === "sort") setSort(value);
    else if (openFilter === "pageSize") setPageSize(Number(value));
    setPage(1);
    setOpenFilter(null);
  };

  const renderItem = useCallback(({ item }: { item: DemoInvestment }) => (
    <InvestmentCardNative
      item={item}
      palette={palette}
      language={language}
      onView={() => openEditor("view", item)}
      onEdit={() => openEditor("edit", item)}
      onDelete={() => removeInvestment(item)}
    />
  ), [language, openEditor, palette]);
  const summaryCards = [
    { label: "Total Modal", value: formatBudgetMoney(totalInvested), tone: undefined },
    { label: "Nilai Saat Ini", value: formatBudgetMoney(totalValue), tone: undefined },
    { label: "Profit / Loss", value: `${profitLoss < 0 ? "-" : ""}${formatBudgetMoney(Math.abs(profitLoss))}`, tone: profitLoss >= 0 ? "profit" as const : "loss" as const },
    { label: "ROI", value: `${roi.toFixed(1)}%`, tone: roi >= 0 ? "profit" as const : "loss" as const },
  ];

  return <>
    <FlatList
      style={styles.scroll}
      contentContainerStyle={[styles.content, styles.investmentContent]}
      data={pageItems}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<View>
        <PageHeader palette={palette} title="Investasi" description="Kelola portofolio investasi Anda." />
        <FinanceDataState palette={palette} loading={itemsLoading} error={itemsError} onRetry={() => { void loadInvestments(); }} />
        <View style={styles.investmentToolbar}>
          <Text style={[styles.resultCount, { color: palette.secondaryText }]}>{visibleItems.length} investasi</Text>
          <Pressable accessibilityRole="button" onPress={() => openEditor("create")} style={[styles.primaryButton, styles.transactionPrimaryButton, styles.investmentAddButton, { backgroundColor: palette.accent }]}>
            <MaterialCommunityIcons name="plus" size={18} color={palette.accentText} />
            <Text style={{ color: palette.accentText, fontWeight: "700" }}>Tambah Investasi</Text>
          </Pressable>
        </View>
        <View style={[styles.investmentFilterCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.searchBox, styles.investmentSearchBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <MaterialCommunityIcons name="magnify" size={17} color={palette.secondaryText} />
            <TextInput
              value={query}
              onChangeText={(value) => { setQuery(value); setPage(1); }}
              placeholder="Cari investasi..."
              placeholderTextColor={palette.secondaryText}
              style={[styles.searchInput, styles.investmentSearchInput, { color: palette.text }]}
              accessibilityLabel="Cari investasi..."
              returnKeyType="search"
            />
          </View>
          <View style={styles.investmentFilterList}>
            {filterButton("type", "Jenis investasi", selectedLabels.type, typeOptions)}
            {filterButton("status", "Status investasi", selectedLabels.status, statusOptions)}
            {filterButton("sort", "Urutkan investasi", selectedLabels.sort, sortOptions)}
            <Pressable accessibilityRole="button" onPress={resetFilters} style={[styles.investmentResetButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <MaterialCommunityIcons name="backup-restore" size={16} color={palette.text} />
              <Text style={[styles.investmentFilterLabel, { color: palette.text, fontWeight: "600" }]}>Reset Filter</Text>
            </Pressable>
          </View>
        </View>
        {!!items.length && <View style={styles.investmentSummaryList}>
          {summaryCards.map((card) => <Card key={card.label} palette={palette} style={styles.investmentSummaryCard}>
            <Text style={[styles.investmentSummaryLabel, { color: palette.secondaryText }]}>{card.label}</Text>
            <Text style={[styles.investmentSummaryValue, { color: card.tone === "profit" ? palette.incomeAmount : card.tone === "loss" ? palette.expenseAmount : palette.text }]}>{card.value}</Text>
          </Card>)}
        </View>}
      </View>}
      ListEmptyComponent={<View style={[styles.investmentEmptyState, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <MaterialCommunityIcons name={items.length ? "magnify" : "chart-line"} size={30} color={palette.secondaryText} />
        <Text style={[styles.transactionNoResultsTitle, { color: palette.text }]}>{items.length ? "Tidak ada investasi yang cocok" : "Belum ada investasi"}</Text>
        <Text style={[styles.cardSubtitle, { color: palette.secondaryText, textAlign: "center" }]}>{items.length ? "Ubah pencarian atau filter untuk melihat investasi." : "Tambahkan investasi untuk mulai melihat portofolio Anda."}</Text>
        {!items.length && <Pressable accessibilityRole="button" onPress={() => openEditor("create")} style={[styles.primaryButton, styles.investmentEmptyButton, { backgroundColor: palette.accent }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Tambah Investasi</Text></Pressable>}
      </View>}
      ListFooterComponent={visibleItems.length ? <View style={styles.investmentFooter}>
        <View style={styles.investmentPagination}>
          <View style={styles.investmentPageSizeRow}>
            <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Baris per halaman</Text>
            <View style={styles.investmentPageSizeSelect}>
              <Pressable accessibilityRole="button" accessibilityLabel="Baris per halaman" accessibilityState={{ expanded: openFilter === "pageSize" }} onPress={() => setOpenFilter(openFilter === "pageSize" ? null : "pageSize")} style={[styles.pageSize, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={{ color: palette.text }}>{pageSize}</Text>
                <MaterialCommunityIcons name={openFilter === "pageSize" ? "chevron-up" : "chevron-down"} size={16} color={palette.secondaryText} />
              </Pressable>
              {openFilter === "pageSize" && <TransientPopupSurface style={[styles.investmentPageSizeOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                {[5, 10, 20, 50].map((size) => <Pressable key={size} accessibilityRole="button" accessibilityState={{ selected: pageSize === size }} onPress={() => selectFilterOption(String(size))} style={styles.investmentFilterOption}>
                  <Text style={{ color: palette.text }}>{size}</Text>
                  {pageSize === size && <MaterialCommunityIcons name="check" size={16} color={palette.accent} />}
                </Pressable>)}
              </TransientPopupSurface>}
            </View>
          </View>
          <Text style={[styles.transactionPaginationLabel, { color: palette.secondaryText }]}>Menampilkan {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleItems.length)} dari {visibleItems.length}</Text>
          <View style={styles.categoryPageControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Sebelumnya" disabled={currentPage <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage <= 1 ? 0.45 : 1 }]}>
              <MaterialCommunityIcons name="chevron-left" size={18} color={palette.secondaryText} />
            </Pressable>
            <Text style={[styles.categoryPaginationText, { color: palette.secondaryText }]}>{currentPage} / {totalPages}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Berikutnya" disabled={currentPage >= totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))} style={[styles.categoryPageButton, { borderColor: palette.border, opacity: currentPage >= totalPages ? 0.45 : 1 }]}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={palette.secondaryText} />
            </Pressable>
          </View>
        </View>
        <Card palette={palette} style={styles.investmentAllocationCard}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Komposisi Aset</Text>
          {allocation.length ? <>
            <View style={styles.investmentDonutWrap}>
              <Svg width={184} height={184} viewBox="0 0 184 184">
                <Circle cx="92" cy="92" r="72" fill="none" stroke={palette.muted} strokeWidth="37" />
                {allocation.map(([assetType, value], index) => {
                  const circumference = 2 * Math.PI * 72;
                  const length = totalValue > 0 ? (value / totalValue) * circumference : 0;
                  const offset = allocation.slice(0, index).reduce((sum, [, previous]) => sum + (totalValue > 0 ? (previous / totalValue) * circumference : 0), 0);
                  return <Circle key={assetType} cx="92" cy="92" r="72" fill="none" stroke={index === 0 ? palette.accent : palette.secondaryText} strokeWidth="37" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-offset} rotation="-90" origin="92, 92" />;
                })}
              </Svg>
            </View>
            <View style={styles.investmentAllocationLegend}>
              {allocation.map(([assetType, value], index) => <View key={assetType} style={[styles.investmentLegendRow, { backgroundColor: palette.muted }]}>
                <View style={[styles.investmentLegendDot, { backgroundColor: index === 0 ? palette.accent : palette.secondaryText }]} />
                <Text numberOfLines={1} style={[styles.investmentLegendName, { color: palette.secondaryText }]}>{typeOptions.find((option) => option.value === assetType)?.label ?? assetType}</Text>
                <Text style={[styles.investmentLegendValue, { color: palette.text }]}>{formatBudgetMoney(value)}</Text>
              </View>)}
            </View>
          </> : <View style={styles.investmentAllocationEmpty}><Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Belum ada komposisi aset untuk ditampilkan.</Text></View>}
        </Card>
      </View> : null}
    />
    <FloatingFormModal
      open={editorOpen}
      palette={palette}
      title={formMode === "view" ? "Detail Investasi" : formMode === "edit" ? "Ubah Investasi" : "Tambah Investasi"}
      description={formMode === "create" ? "Catat aset dan pantau nilainya." : selectedItem?.name ?? ""}
      onClose={() => setEditorOpen(false)}
      actions={formMode === "view"
        ? <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Tutup</Text></Pressable>
        : <>
            <Pressable accessibilityRole="button" onPress={saveInvestment} style={[styles.floatingModalSaveButton, { backgroundColor: palette.accent }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>Simpan</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border }]}><Text style={{ color: palette.text, fontWeight: "600" }}>Batal</Text></Pressable>
          </>
      }
    >
            {formMode === "view" && selectedItem ? (
              <View>
                <View style={styles.investmentReadOnlyDetails}>
                  {[
                    ["Jenis", typeOptions.find((option) => option.value === selectedItem.type)?.label ?? selectedItem.type],
                    ["Status", statusOptions.find((option) => option.value === selectedItem.status)?.label ?? selectedItem.status],
                    ["Platform", selectedItem.platform],
                    ["Nama", selectedItem.name],
                    ["Simbol", selectedItem.symbol || "Tidak ada"],
                    ["Jumlah Unit", String(selectedItem.quantity)],
                    ["Harga Beli Rata-rata", formatBudgetMoney(selectedItem.averageBuyPrice, true)],
                    ["Harga Saat Ini", formatBudgetMoney(selectedItem.currentPrice, true)],
                    ["Total Modal", formatBudgetMoney(selectedItem.invested, true)],
                    ["Nilai Saat Ini", formatBudgetMoney(selectedItem.currentValue, true)],
                    ["Tanggal Beli", formatMobileDate(selectedItem.purchaseDate, language)],
                    ["Catatan", selectedItem.notes || "Tidak ada"],
                  ].map(([label, value]) => <View key={label} style={styles.investmentReadOnlyField}>
                    <Text style={[styles.investmentReadOnlyLabel, { color: palette.secondaryText }]}>{label}</Text>
                    <Text style={[styles.investmentReadOnlyValue, { color: palette.text }]}>{value}</Text>
                  </View>)}
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Jenis</Text>
                <NativeSelect label="Jenis investasi" value={formType} options={typeOptions.filter((option) => option.value !== "all")} palette={palette} active={editorOpen} onChange={setFormType} />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Status</Text>
                <NativeSelect label="Status investasi" value={formStatus} options={statusOptions.filter((option) => option.value !== "all")} palette={palette} active={editorOpen} onChange={(value) => setFormStatus(value as DemoInvestment["status"])} />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Nama</Text>
                <TextInput value={formName} onChangeText={setFormName} placeholder="Nama investasi" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Nama" />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Platform</Text>
                <TextInput value={formPlatform} onChangeText={setFormPlatform} placeholder="Platform investasi" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Platform" />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Simbol</Text>
                <TextInput value={formSymbol} onChangeText={setFormSymbol} placeholder="Simbol (opsional)" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Simbol" />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Jumlah Unit</Text>
                <NumericInput mode="decimal" value={formQuantity} onChangeValue={setFormQuantity} placeholder="0" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Jumlah Unit" />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Harga Beli Rata-rata</Text>
                <NumericInput mode="decimal" value={formAverageBuyPrice} onChangeValue={setFormAverageBuyPrice} placeholder="0" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Harga Beli Rata-rata" />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Harga Saat Ini</Text>
                <NumericInput mode="decimal" value={formCurrentPrice} onChangeValue={setFormCurrentPrice} placeholder="Kosongkan jika sama dengan harga beli" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Harga Saat Ini" />
                <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Jika dikosongkan, otomatis memakai Harga Beli Rata-rata (ROI awal = 0%).</Text>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Modal Awal</Text>
                {formMode === "create"
                  ? <View accessibilityLiveRegion="polite" style={[styles.investmentCurrencyField, { backgroundColor: palette.muted, borderColor: `${palette.accent}4D` }]}>
                    <Text style={[styles.investmentCurrencyPrefix, { color: palette.text }]}>{formatBudgetMoney((Number(formQuantity) || 0) * (Number(formAverageBuyPrice) || 0), true)}</Text>
                    <Text style={[styles.investmentCurrencySuffix, { color: palette.secondaryText }]}>IDR</Text>
                  </View>
                  : <View style={[styles.investmentCurrencyField, { backgroundColor: palette.input, borderColor: palette.border }]}>
                    <Text style={[styles.investmentCurrencyAffix, { color: palette.text }]}>Rp</Text>
                    <NumericInput value={formInvested} onChangeValue={setFormInvested} separator="." placeholder="0" placeholderTextColor={palette.secondaryText} style={[styles.investmentCurrencyInput, { color: palette.text }]} accessibilityLabel="Modal Awal" />
                    <Text style={[styles.investmentCurrencySuffix, { color: palette.secondaryText }]}>IDR</Text>
                  </View>}
                {formMode === "create" && <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Otomatis: Jumlah Unit × Harga Beli Rata-rata</Text>}
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Tanggal Beli</Text>
                <NativeCalendarPicker
                  label="Tanggal beli"
                  value={formPurchaseDate}
                  palette={palette}
                  active={editorOpen && purchaseDateOpen}
                  onOpenChange={setPurchaseDateOpen}
                  onChange={setFormPurchaseDate}
                  triggerStyle={[styles.fieldInput, { backgroundColor: palette.input }]}
                />
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Catatan</Text>
                <TextInput value={formNotes} onChangeText={setFormNotes} multiline placeholder="Catatan (opsional)" placeholderTextColor={palette.secondaryText} style={[styles.fieldInput, styles.noteInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} accessibilityLabel="Catatan" />
              </>
            )}
    </FloatingFormModal>
    <NativeDeleteDialog
      open={pendingInvestmentDelete !== null}
      title="Hapus Investasi"
      description="Apakah Anda yakin ingin menghapus investasi ini?"
      palette={palette}
      onClose={() => setPendingInvestmentDelete(null)}
      onConfirm={() => {
        if (pendingInvestmentDelete) {
          const deletedInvestmentId = pendingInvestmentDelete.id;
          void financeApi.removeInvestment(deletedInvestmentId)
            .then((response) => {
              if (!response.success) throw new Error("The server could not delete the investment.");
              invalidateFinancialSnapshots();
              setItems((current) => {
                const next = current.filter((item) => item.id !== deletedInvestmentId);
                investmentSnapshots.set(userId, next);
                return next;
              });
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : "Silakan coba lagi.";
              console.error("Failed to delete native investment.", error);
              Alert.alert(translateMobileText("Investasi tidak dapat dihapus.", language), message);
            });
        }
        setPendingInvestmentDelete(null);
      }}
    />
  </>;
}

const InvestmentCardNative = memo(function InvestmentCardNative({
  item,
  palette,
  language,
  onView,
  onEdit,
  onDelete,
}: {
  item: DemoInvestment;
  palette: Palette;
  language: MobileLanguage;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeLabel = item.type === "Other" ? "Lainnya" : item.type === "Stock" ? "Saham" : item.type === "Mutual Fund" ? "Reksa Dana" : item.type === "Gold" ? "Emas" : item.type === "Crypto" ? "Kripto" : item.type === "Bond" ? "Obligasi" : item.type === "Deposit" ? "Deposito" : "Properti";
  const icon = item.type === "Stock" ? "chart-line" : item.type === "Mutual Fund" ? "chart-pie" : item.type === "Gold" ? "gold" : item.type === "Crypto" ? "bitcoin" : item.type === "Bond" ? "bank-outline" : item.type === "Deposit" ? "piggy-bank-outline" : item.type === "Property" ? "home-city-outline" : "chart-line";
  const profitLoss = item.currentValue - item.invested;
  const profitLossPercent = item.invested ? (profitLoss / item.invested) * 100 : 0;
  const statusText = item.status === "ACTIVE" ? "Aktif" : item.status === "SOLD" ? "Dijual" : "Ditutup";
  return <Card palette={palette} style={styles.investmentCard}>
    <View style={styles.investmentCardHeading}>
      <View style={[styles.investmentIcon, { backgroundColor: palette.muted }]}><MaterialCommunityGlyphIcons name={icon} size={17} color={palette.secondaryText} /></View>
      <View style={styles.investmentCardCopy}>
        <RawText numberOfLines={1} style={[styles.investmentCardName, { color: palette.text }]}>{item.name}</RawText>
        <RawText numberOfLines={1} style={[styles.investmentCardSubtitle, { color: palette.secondaryText }]}>{translateMobileText(typeLabel, language)} · {item.platform}</RawText>
      </View>
      <View style={[styles.investmentStatusBadge, { backgroundColor: item.status === "ACTIVE" ? `${palette.accent}22` : palette.muted }]}>
        <Text style={[styles.investmentStatusText, { color: item.status === "ACTIVE" ? palette.accent : palette.secondaryText }]}>{statusText}</Text>
      </View>
    </View>
    <View style={styles.investmentValueBlock}>
      <Text style={[styles.investmentMetricLabel, { color: palette.secondaryText }]}>Nilai Saat Ini</Text>
      <Text style={[styles.investmentCurrentValue, { color: palette.text }]}>{formatBudgetMoney(item.currentValue, true)}</Text>
      <Text style={[styles.investmentProfitLoss, { color: profitLoss >= 0 ? palette.incomeAmount : palette.expenseAmount }]}>
        {profitLoss >= 0 ? "+" : "-"}{formatBudgetMoney(Math.abs(profitLoss), true)}
        <Text style={[styles.investmentProfitPct, { color: palette.secondaryText }]}> ({profitLossPercent.toFixed(1)}%)</Text>
      </Text>
    </View>
    <View style={[styles.investmentDetails, { borderColor: palette.border }]}>
      <View style={styles.investmentDetailItem}>
        <Text style={[styles.investmentMetricLabel, { color: palette.secondaryText }]}>Total Modal</Text>
        <Text style={[styles.investmentDetailValue, { color: palette.text }]}>{formatBudgetMoney(item.invested, true)}</Text>
      </View>
      <View style={styles.investmentDetailItem}>
        <Text style={[styles.investmentMetricLabel, { color: palette.secondaryText }]}>Tanggal Beli</Text>
        <Text style={[styles.investmentDetailValue, { color: palette.text }]}>{formatMobileDate(item.purchaseDate, language)}</Text>
      </View>
    </View>
    <View style={[styles.investmentActions, { borderColor: palette.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Lihat", item.name, language)} onPress={onView} style={styles.goalActionButton}><MaterialCommunityIcons name="eye-outline" size={17} color={palette.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Ubah", item.name, language)} onPress={onEdit} style={styles.goalActionButton}><MaterialCommunityIcons name="pencil-outline" size={17} color={palette.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedActionLabel("Hapus", item.name, language)} onPress={onDelete} style={styles.goalActionButton}><MaterialCommunityIcons name="delete-outline" size={17} color="#ef5350" /></Pressable>
    </View>
  </Card>;
});

type ReportPeriodKey = "thisMonth" | "lastMonth" | "threeMonths" | "sixMonths" | "thisYear" | "custom";
type ReportDateRange = { start: string; end: string };
type ReportPoint = { date: string; label: string; income: number; expense: number; net: number };
type ReportCategory = { name: string; amount: number; categoryId?: string };
type ChartDetailMetric = { label: string; value: string };
type ChartDetailSelection = {
  title: string;
  subtitle: string;
  metrics: ChartDetailMetric[];
  transactions: DemoTransaction[];
};
type NativeAnalyticsPageData = {
  overview: NativeAnalyticsOverview;
  expenses: NativeAnalyticsTypeResult;
  incomes: NativeAnalyticsTypeResult;
  spending: NativeAnalyticsSpending;
  health: NativeAnalyticsHealth;
  insights: string[];
  budgets: NativeBudget[];
  budgetSpending: NativeAnalyticsSpending | null;
};
type NativeReportPageData = {
  summary: NativeReportSummary;
  points: ReportPoint[];
  expenses: ReportCategory[];
  incomes: ReportCategory[];
};
type NativeForecastPageData = {
  forecast: NativeForecast;
  spendingPrediction: NativeSpendingPrediction;
};

const reportPeriodOptions: { key: ReportPeriodKey; label: string }[] = [
  { key: "thisMonth", label: "Bulan Ini" },
  { key: "lastMonth", label: "Bulan Lalu" },
  { key: "threeMonths", label: "3 Bulan Terakhir" },
  { key: "sixMonths", label: "6 Bulan Terakhir" },
  { key: "thisYear", label: "Tahun Ini" },
  { key: "custom", label: "Kustom" },
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReportDateRange(period: ReportPeriodKey, customRange: ReportDateRange): ReportDateRange {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  if (period === "custom") return customRange;
  if (period === "lastMonth") {
    return { start: toDateKey(new Date(year, month - 1, 1)), end: toDateKey(new Date(year, month, 0)) };
  }

  if (period === "threeMonths" || period === "sixMonths") {
    const months = period === "threeMonths" ? 3 : 6;
    const targetMonth = new Date(year, month - months, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(today.getDate(), lastDay));
    return { start: toDateKey(start), end: toDateKey(today) };
  }
  if (period === "thisYear") {
    return { start: toDateKey(new Date(year, 0, 1)), end: toDateKey(today) };
  }
  return { start: toDateKey(new Date(year, month, 1)), end: toDateKey(new Date(year, month + 1, 0)) };
}

function getCompleteMonthDateRange(range: ReportDateRange): ReportDateRange | null {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const firstMonth = new Date(start.getFullYear(), start.getMonth() + (start.getDate() > 1 ? 1 : 0), 1);
  const lastMonth = new Date(
    end.getFullYear(),
    end.getMonth() - (end.getDate() < new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() ? 1 : 0),
    1,
  );
  if (firstMonth > lastMonth) return null;
  return {
    start: toDateKey(firstMonth),
    end: toDateKey(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)),
  };
}

function formatAnalyticsPeriod(period: string, language: MobileLanguage) {
  if (/^\d{4}-\d{2}$/.test(period)) {
    return new Date(`${period}-01T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
      month: "short",
      year: "2-digit",
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return formatMobileDate(period, language);
  }
  if (/^\d{4}-W\d{2}$/.test(period)) {
    const [, year, week] = period.match(/^(\d{4})-W(\d{2})$/) ?? [];
    return language === "en" ? `Week ${week}, ${year}` : `Pekan ${week}, ${year}`;
  }
  return period;
}

function reportCompactMoney(value: number, language: MobileLanguage) {
  if (!value) return "Rp0";
  const abs = Math.abs(value);
  const amount = abs >= 1_000_000
    ? (abs / 1_000_000).toLocaleString(language === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 })
    : abs >= 1_000
      ? String(Math.round(abs / 1_000))
      : String(abs);
  const unit = abs >= 1_000_000
    ? language === "en" ? "M" : "jt"
    : abs >= 1_000
      ? language === "en" ? "K" : "rb"
      : "";
  const compact = unit ? `${amount}${language === "en" ? "" : " "}${unit}` : amount;
  return `${value < 0 ? "-" : ""}Rp${compact}`;
}

type AnalyticsTrendPoint = { date: string; label: string; values: Record<string, number> };
type AnalyticsSavingsPoint = ReportPoint & {
  savingRate: number | null;
  cumulativeIncome: number;
  cumulativeExpense: number;
};

function buildAnalyticsExpenseTrend(
  transactions: NativeTransaction[],
  localizedTransactions: DemoTransaction[],
  categories: DemoCategory[],
  range: ReportDateRange,
  language: MobileLanguage,
) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const mode: "daily" | "monthly" = spanDays <= 62 ? "daily" : "monthly";
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const localDates = new Map(localizedTransactions.map((transaction) => [transaction.id, transaction.dateISO]));
  const buckets = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    if (transaction.transaction_type !== "EXPENSE") continue;
    const date = localDates.get(transaction.id) ?? transaction.transaction_date.slice(0, 10);
    if (date < range.start || date > range.end) continue;
    const amount = Number(transaction.amount_cents);
    if (!Number.isFinite(amount)) continue;
    const key = mode === "monthly" ? date.slice(0, 7) : date;
    const category = categoryNames.get(transaction.category_id) ?? "__other__";
    const values = buckets.get(key) ?? new Map<string, number>();
    values.set(category, (values.get(category) ?? 0) + amount);
    buckets.set(key, values);
  }

  const totals = new Map<string, number>();
  for (const values of buckets.values()) {
    for (const [name, amount] of values) totals.set(name, (totals.get(name) ?? 0) + amount);
  }
  const topCategories = [...totals.entries()]
    .filter(([name]) => name !== "__other__")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name]) => name);
  const topCategorySet = new Set(topCategories);
  const periodKeys: string[] = [];
  const cursor = mode === "monthly"
    ? new Date(start.getFullYear(), start.getMonth(), 1)
    : new Date(start);
  while (cursor <= end) {
    periodKeys.push(mode === "monthly"
      ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
      : toDateKey(cursor));
    if (mode === "monthly") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  const points = periodKeys.map((key) => {
    const amounts = buckets.get(key) ?? new Map<string, number>();
    const date = mode === "monthly" ? `${key}-01` : key;
    const values: Record<string, number> = {};
    let other = 0;
    for (const [name, amount] of amounts) {
      if (topCategorySet.has(name)) values[name] = amount;
      else other += amount;
    }
    if (other > 0) values.__other__ = other;
    return { date, label: formatAnalyticsPeriod(date, language), values };
  });
  const categoriesInTrend = [
    ...topCategories,
    ...(points.some((point) => (point.values.__other__ ?? 0) > 0) ? ["__other__"] : []),
  ];
  return { categories: categoriesInTrend, points, granularity: mode };
}

function buildAnalyticsSavingsTrend(
  transactions: NativeTransaction[],
  localizedTransactions: DemoTransaction[],
  range: ReportDateRange,
  language: MobileLanguage,
  granularity: "daily" | "monthly",
): AnalyticsSavingsPoint[] {
  const localDates = new Map(localizedTransactions.map((transaction) => [transaction.id, transaction.dateISO]));
  const totalsByPeriod = new Map<string, { income: number; expense: number }>();

  for (const transaction of transactions) {
    const date = localDates.get(transaction.id) ?? transaction.transaction_date.slice(0, 10);
    if (date < range.start || date > range.end) continue;
    const amount = Number(transaction.amount_cents);
    if (!Number.isFinite(amount)) throw new Error("The server returned an invalid amount for the savings trend.");
    const key = granularity === "monthly" ? date.slice(0, 7) : date;
    const totals = totalsByPeriod.get(key) ?? { income: 0, expense: 0 };
    if (transaction.transaction_type === "INCOME") totals.income += amount;
    else totals.expense += amount;
    totalsByPeriod.set(key, totals);
  }

  const firstDate = new Date(`${range.start}T00:00:00`);
  const lastDate = new Date(`${range.end}T00:00:00`);
  const cursor = granularity === "monthly"
    ? new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
    : firstDate;
  const points: AnalyticsSavingsPoint[] = [];
  let cumulativeIncome = 0;
  let cumulativeExpense = 0;

  while (cursor <= lastDate) {
    const key = granularity === "monthly"
      ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
      : toDateKey(cursor);
    const date = granularity === "monthly" ? `${key}-01` : key;
    const totals = totalsByPeriod.get(key) ?? { income: 0, expense: 0 };
    const net = totals.income - totals.expense;
    cumulativeIncome += totals.income;
    cumulativeExpense += totals.expense;
    points.push({
      date,
      label: formatAnalyticsPeriod(date, language),
      income: totals.income,
      expense: totals.expense,
      net,
      savingRate: cumulativeIncome > 0
        ? ((cumulativeIncome - cumulativeExpense) / cumulativeIncome) * 100
        : null,
      cumulativeIncome,
      cumulativeExpense,
    });
    if (granularity === "monthly") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

function AnalyticsTrendChart({ categories, points, palette, loading, error, onRetry, transactions, range, granularity }: {
  categories: string[];
  points: AnalyticsTrendPoint[];
  palette: Palette;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  transactions: DemoTransaction[];
  range: ReportDateRange;
  granularity: "daily" | "monthly";
}) {
  const language = useContext(MobileLanguageContext);
  const [selection, setSelection] = useState<ChartDetailSelection | null>(null);
  if (loading || error) {
    return (
      <View style={styles.analyticsEmptyChart}>
        <FinanceDataState palette={palette} loading={loading} error={error} onRetry={onRetry} />
      </View>
    );
  }
  if (!points.length || !categories.length) {
    return <View style={styles.reportEmptyChart}><EmptyPanel palette={palette} message="Belum ada data pengeluaran pada periode ini." /></View>;
  }
  const chart = { left: 64, right: 348, top: 20, bottom: 202 };
  const max = Math.max(1, ...points.map((point) => categories.reduce((sum, name) => sum + (point.values[name] ?? 0), 0)));
  const slot = (chart.right - chart.left) / points.length;
  const barWidth = Math.min(28, slot * 0.78);
  const colors = [palette.chart3, palette.chart1, palette.success, palette.info, palette.warning, palette.chart5];
  const tickStride = Math.max(1, Math.ceil(points.length / 8));
  const y = (value: number) => chart.bottom - (value / max) * (chart.bottom - chart.top);
  return (
    <View style={[styles.reportSvgChart, { height: 322 }]}>
      <ChartTapHint palette={palette} />
      <View style={styles.analyticsLegend}>
        {categories.map((name, index) => (
          <View key={name} style={styles.analyticsLegendItem}>
            <View style={[styles.reportLegendDot, { backgroundColor: colors[index % colors.length] }]} />
            <Text numberOfLines={1} style={[styles.analyticsLegendText, { color: palette.secondaryText }]}>{name === "__other__" ? language === "en" ? "Other" : "Lainnya" : name}</Text>
          </View>
        ))}
      </View>
      <Svg width="100%" height={260} viewBox="0 0 360 260">
        {[0, max / 2, max].map((tick) => {
          const tickY = y(tick);
          return (
            <Fragment key={tick}>
              <Line x1={chart.left} x2={chart.right} y1={tickY} y2={tickY} stroke={palette.border} strokeWidth="1" />
              <SvgText x="2" y={tickY + 4} fill={palette.secondaryText} fontSize="9">{reportCompactMoney(tick, language)}</SvgText>
            </Fragment>
          );
        })}
        {points.map((point, index) => {
          let stacked = 0;
          const x = chart.left + slot * index + (slot - barWidth) / 2;
          const periodRange = getChartPointRange(point.date, range, granularity);
          const segments = categories.map((name, categoryIndex) => {
            const amount = point.values[name] ?? 0;
            const segmentHeight = (amount / max) * (chart.bottom - chart.top);
            const rect = (
              <Rect
                key={`${point.label}-${name}`}
                x={x}
                y={chart.bottom - stacked - segmentHeight}
                width={barWidth}
                height={Math.max(0, segmentHeight)}
                fill={colors[categoryIndex % colors.length]}
                pointerEvents="none"
              />
            );
            stacked += segmentHeight;
            return rect;
          });
          return (
            <Fragment key={point.label}>
              {segments}
              <Rect
                x={chart.left + slot * index}
                y={chart.top}
                width={slot}
                height={chart.bottom - chart.top}
                fill="transparent"
                accessible
                accessibilityLabel={`${point.label}: ${translateMobileText("Pengeluaran", language)} ${formatBudgetMoney(categories.reduce((sum, name) => sum + (point.values[name] ?? 0), 0))}`}
                onPress={() => {
                  const matchingTransactions = transactions.filter((transaction) =>
                    !transaction.income &&
                    transaction.dateISO >= periodRange.start &&
                    transaction.dateISO <= periodRange.end
                  );
                  setSelection(createChartDetail(
                    point.label,
                    translateMobileText("Rincian komposisi pengeluaran pada periode ini.", language),
                    categories
                      .filter((name) => (point.values[name] ?? 0) > 0)
                      .map((name) => ({
                        label: name === "__other__" ? translateMobileText("Lainnya", language) : name,
                        value: formatBudgetMoney(point.values[name]),
                      })),
                    matchingTransactions,
                  ));
                }}
              />
              {index % tickStride === 0 && (
                <SvgText x={x + barWidth / 2} y="232" fill={palette.secondaryText} fontSize="9" textAnchor="middle">
                  {granularity === "daily"
                    ? String(new Date(`${point.date}T00:00:00`).getDate())
                    : new Date(`${point.date.slice(0, 7)}-01T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
                      month: "short",
                      ...(points.length > 12 ? { year: "2-digit" as const } : {}),
                    })}
                </SvgText>
              )}
            </Fragment>
          );
        })}
      </Svg>
      <ChartDetailModal selection={selection} palette={palette} onClose={() => setSelection(null)} />
    </View>
  );
}

function AnalyticsSavingsRateChart({ points, palette, transactions, range, granularity, loading, error, onRetry }: {
  points: AnalyticsSavingsPoint[];
  palette: Palette;
  transactions: DemoTransaction[];
  range: ReportDateRange;
  granularity: "daily" | "monthly";
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const language = useContext(MobileLanguageContext);
  const [selection, setSelection] = useState<ChartDetailSelection | null>(null);

  if (loading || error) {
    return (
      <View style={styles.analyticsEmptyChart}>
        <FinanceDataState palette={palette} loading={loading} error={error} onRetry={onRetry} />
      </View>
    );
  }

  if (!transactions.length) {
    return (
      <View style={styles.reportEmptyChart}>
        <EmptyPanel palette={palette} message="Belum ada transaksi pada periode ini, jadi saving rate belum dapat dihitung." />
      </View>
    );
  }

  if (!points.some((point) => point.savingRate !== null)) {
    return (
      <View style={styles.reportEmptyChart}>
        <EmptyPanel palette={palette} message="Belum ada pemasukan pada periode ini. Saving rate dihitung saat ada pemasukan." />
      </View>
    );
  }

  const chart = { left: 52, right: 348, top: 20, bottom: 214 };
  const rates = points.flatMap((point) => point.savingRate === null ? [] : [point.savingRate]);
  const min = Math.min(0, Math.floor(Math.min(...rates) / 25) * 25);
  const max = Math.max(100, Math.ceil(Math.max(...rates) / 25) * 25);
  const scale = max - min || 1;
  const xStep = points.length === 1 ? 0 : (chart.right - chart.left) / (points.length - 1);
  const y = (value: number) => chart.bottom - ((value - min) / scale) * (chart.bottom - chart.top);
  const segments: string[][] = [];
  let currentSegment: string[] = [];
  points.forEach((point, index) => {
    if (point.savingRate === null) {
      if (currentSegment.length) segments.push(currentSegment);
      currentSegment = [];
      return;
    }
    const command = `${currentSegment.length ? "L" : "M"} ${chart.left + xStep * index} ${y(point.savingRate)}`;
    currentSegment.push(command);
  });
  if (currentSegment.length) segments.push(currentSegment);
  const tickValues = Array.from({ length: 5 }, (_, index) => min + (scale * index) / 4);
  const tickStride = Math.max(1, Math.ceil(points.length / 6));
  let latestRateIndex = -1;
  points.forEach((point, index) => {
    if (point.savingRate !== null) latestRateIndex = index;
  });
  const axisLabel = (date: string) => {
    const value = new Date(`${date}T00:00:00`);
    const locale = language === "en" ? "en-US" : "id-ID";
    if (granularity === "monthly") {
      return value.toLocaleDateString(locale, { month: "short" });
    }
    const day = String(value.getDate());
    return value.getDate() === 1
      ? `${day} ${value.toLocaleDateString(locale, { month: "short" })}`
      : day;
  };

  return (
    <View style={styles.reportSvgChart}>
      <ChartTapHint palette={palette} />
      <Svg width="100%" height={260} viewBox="0 0 360 260">
        {tickValues.map((value) => (
          <Fragment key={value}>
            <Line
              x1={chart.left}
              x2={chart.right}
              y1={y(value)}
              y2={y(value)}
              stroke={value === 0 ? palette.secondaryText : palette.border}
              strokeWidth={value === 0 ? 1.5 : 1}
            />
            <SvgText x="2" y={y(value) + 4} fill={palette.secondaryText} fontSize="9" textAnchor="start">
              {`${Math.round(value)}%`}
            </SvgText>
          </Fragment>
        ))}
        {segments.map((segment, index) => (
          <Path
            key={`segment-${index}`}
            d={segment.join(" ")}
            fill="none"
            stroke={palette.chart2}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {points.map((point, index) => {
          const pointX = chart.left + xStep * index;
          const pointY = point.savingRate === null ? chart.bottom : y(point.savingRate);
          const previousRate = index > 0 ? points[index - 1].savingRate : null;
          const showRateMarker = point.savingRate !== null && (
            index === latestRateIndex ||
            previousRate === null ||
            Math.abs(point.savingRate - previousRate) >= 1
          );
          const periodRange = getChartPointRange(point.date, range, granularity);
          const matchingTransactions = transactions.filter((transaction) =>
            transaction.dateISO >= range.start && transaction.dateISO <= periodRange.end
          );
          const hitLeft = points.length === 1 || index === 0 ? chart.left : pointX - xStep / 2;
          const hitRight = points.length === 1 || index === points.length - 1 ? chart.right : pointX + xStep / 2;
          return (
            <Fragment key={point.date}>
              {showRateMarker && point.savingRate !== null && (
                <Circle
                  cx={pointX}
                  cy={pointY}
                  r={index === latestRateIndex ? "5" : "3"}
                  fill={point.savingRate < 0 ? palette.expenseAmount : palette.incomeAmount}
                  stroke={palette.surface}
                  strokeWidth="2"
                  pointerEvents="none"
                />
              )}
              {index === latestRateIndex && point.savingRate !== null && (
                <SvgText
                  x={chart.right - 4}
                  y={pointY - 12}
                  fill={point.savingRate < 0 ? palette.expenseAmount : palette.incomeAmount}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="end"
                  pointerEvents="none"
                >
                  {`${point.savingRate.toFixed(1)}%`}
                </SvgText>
              )}
              {(index % tickStride === 0 || points.length <= 8) && (
                <SvgText x={pointX} y="244" fill={palette.secondaryText} fontSize="9" textAnchor="middle">
                  {axisLabel(point.date)}
                </SvgText>
              )}
              <Rect
                x={hitLeft}
                y={chart.top}
                width={hitRight - hitLeft}
                height={chart.bottom - chart.top}
                fill="transparent"
                accessible
                accessibilityLabel={`${point.label}: ${translateMobileText("Saving Rate", language)} ${point.savingRate === null ? translateMobileText("Tidak tersedia", language) : `${point.savingRate.toFixed(1)}%`}`}
                onPress={() => setSelection(createChartDetail(
                  point.label,
                  translateMobileText("Akumulasi sejak awal rentang hingga periode ini.", language),
                  [
                    { label: translateMobileText("Pemasukan kumulatif", language), value: formatBudgetMoney(point.cumulativeIncome) },
                    { label: translateMobileText("Pengeluaran kumulatif", language), value: formatBudgetMoney(point.cumulativeExpense) },
                    { label: translateMobileText("Arus Kas Bersih kumulatif", language), value: formatBudgetMoney(point.cumulativeIncome - point.cumulativeExpense) },
                    {
                      label: translateMobileText("Saving Rate kumulatif", language),
                      value: point.savingRate === null ? translateMobileText("Tidak tersedia", language) : `${point.savingRate.toFixed(1)}%`,
                    },
                  ],
                  matchingTransactions,
                ))}
              />
            </Fragment>
          );
        })}
      </Svg>
      <ChartDetailModal selection={selection} palette={palette} onClose={() => setSelection(null)} />
    </View>
  );
}

function AnalyticsBudgetChart({ range, budgets, categoryBreakdown, palette, transactions }: {
  range: ReportDateRange | null;
  budgets: NativeBudget[];
  categoryBreakdown: NativeAnalyticsSpending["byCategory"];
  palette: Palette;
  transactions: DemoTransaction[];
}) {
  const language = useContext(MobileLanguageContext);
  const [selection, setSelection] = useState<ChartDetailSelection | null>(null);
  if (!range) {
    return (
      <View style={styles.analyticsEmptyChart}>
        <Text style={[styles.emptyText, { color: palette.secondaryText }]}>Rentang ini belum mencakup satu bulan kalender penuh. Pilih rentang yang mencakup satu bulan penuh untuk membandingkan anggaran dan pengeluaran.</Text>
      </View>
    );
  }
  const fullMonths = new Set<string>();
  const monthCursor = new Date(`${range.start}T00:00:00`);
  const lastMonth = new Date(`${range.end}T00:00:00`);
  while (monthCursor <= lastMonth) {
    fullMonths.add(`${monthCursor.getFullYear()}-${monthCursor.getMonth() + 1}`);
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  const rowsByCategory = new Map<string, { id: string; name: string; amount: number; spent: number }>();
  budgets.filter((budget) => fullMonths.has(`${budget.year}-${budget.month}`)).forEach((budget) => {
    const row = rowsByCategory.get(budget.category_id) ?? {
      id: budget.category_id,
      name: budget.category_name ?? "Tanpa kategori",
      amount: 0,
      spent: 0,
    };
    row.amount += Number(budget.budget_amount_cents);
    if (budget.category_name) row.name = budget.category_name;
    rowsByCategory.set(budget.category_id, row);
  });
  categoryBreakdown.forEach((category) => {
    const row = rowsByCategory.get(category.categoryId) ?? {
      id: category.categoryId,
      name: category.categoryName ?? "Tanpa kategori",
      amount: 0,
      spent: 0,
    };
    row.spent = Number(category.totalAmount);
    if (category.categoryName) row.name = category.categoryName;
    rowsByCategory.set(category.categoryId, row);
  });
  const rows = [...rowsByCategory.values()].sort((a, b) => b.spent - a.spent || b.amount - a.amount);
  if (!rows.length) {
    return (
      <View style={styles.analyticsEmptyChart}>
        <Text style={[styles.emptyText, { color: palette.secondaryText }]}>Belum ada anggaran atau pengeluaran pada bulan penuh yang dipilih.</Text>
      </View>
    );
  }
  const max = Math.max(1, ...rows.flatMap((row) => [row.amount, row.spent]));
  const chart = { left: 112, right: 348, top: 12, rowHeight: 38 };
  const bottom = chart.top + rows.length * chart.rowHeight;
  const svgHeight = bottom + 28;
  const x = (value: number) => chart.left + (value / max) * (chart.right - chart.left);
  return (
    <View style={styles.analyticsBudgetChart}>
      <ChartTapHint palette={palette} />
      <View style={styles.analyticsLegend}>
        <View style={styles.analyticsLegendItem}><View style={[styles.reportLegendDot, { backgroundColor: palette.chart5, borderRadius: 2 }]} /><Text style={[styles.analyticsLegendText, { color: palette.secondaryText }]}>Anggaran</Text></View>
        <View style={styles.analyticsLegendItem}><View style={[styles.reportLegendDot, { backgroundColor: palette.chart1, borderRadius: 2 }]} /><Text style={[styles.analyticsLegendText, { color: palette.secondaryText }]}>Pengeluaran</Text></View>
      </View>
      <Svg width="100%" height={svgHeight} viewBox={`0 0 360 ${svgHeight}`}>
        {[0, max / 2, max].map((tick) => (
          <Fragment key={tick}>
            <Line x1={x(tick)} x2={x(tick)} y1={chart.top} y2={bottom} stroke={palette.border} strokeWidth="1" strokeDasharray="3 3" />
            <SvgText x={x(tick)} y={svgHeight - 4} fill={palette.secondaryText} fontSize="8" textAnchor={tick === 0 ? "start" : tick === max ? "end" : "middle"}>
              {reportCompactMoney(tick, language)}
            </SvgText>
          </Fragment>
        ))}
        {rows.map((row, index) => {
          const centerY = chart.top + index * chart.rowHeight + chart.rowHeight / 2;
          const matchingTransactions = transactions.filter((transaction) =>
            !transaction.income &&
            transaction.categoryId === row.id &&
            transaction.dateISO >= range.start &&
            transaction.dateISO <= range.end
          );
          return (
            <Fragment key={row.id}>
              <SvgText x={chart.left - 8} y={centerY + 3} fill={palette.secondaryText} fontSize="9" textAnchor="end">
                {row.name.length > 17 ? `${row.name.slice(0, 16)}…` : row.name}
              </SvgText>
              <Rect x={chart.left} y={centerY - 10} width={x(row.amount) - chart.left} height={8} rx="3" fill={palette.chart5} pointerEvents="none" />
              <Rect x={chart.left} y={centerY + 2} width={x(row.spent) - chart.left} height={8} rx="3" fill={palette.chart1} pointerEvents="none" />
              <Rect
                x="0"
                y={centerY - chart.rowHeight / 2}
                width="360"
                height={chart.rowHeight}
                fill="transparent"
                accessible
                accessibilityLabel={`${row.name}: ${translateMobileText("Anggaran", language)} ${formatBudgetMoney(row.amount)}, ${translateMobileText("Pengeluaran", language)} ${formatBudgetMoney(row.spent)}`}
                onPress={() => setSelection(createChartDetail(
                  row.name,
                  `${formatMobileDate(range.start, language)} - ${formatMobileDate(range.end, language)}`,
                  [
                    { label: translateMobileText("Anggaran", language), value: formatBudgetMoney(row.amount) },
                    { label: translateMobileText("Pengeluaran", language), value: formatBudgetMoney(row.spent) },
                    { label: translateMobileText("Sisa Anggaran", language), value: formatBudgetMoney(row.amount - row.spent) },
                  ],
                  matchingTransactions,
                ))}
              />
            </Fragment>
          );
        })}
      </Svg>
      <ChartDetailModal selection={selection} palette={palette} onClose={() => setSelection(null)} />
    </View>
  );
}

function ReportChartCard({ palette, title, subtitle, children }: {
  palette: Palette;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card palette={palette} style={styles.reportCard}>
      <Text style={[styles.cardTitle, { color: palette.text, fontSize: 16 }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, styles.reportSubtitle, { color: palette.secondaryText, fontSize: 12 }]}>{subtitle}</Text>
      {children}
    </Card>
  );
}

function addDateDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return toDateKey(value);
}

function getChartPointRange(
  date: string,
  reportRange: ReportDateRange,
  granularity: "daily" | "weekly" | "monthly",
): ReportDateRange {
  let start: string;
  if (granularity === "monthly" && /^\d{4}-\d{2}$/.test(date)) {
    start = `${date}-01`;
  } else if (granularity === "weekly" && /^(\d{4})-W(\d{2})$/.test(date)) {
    const [, year, week] = /^(\d{4})-W(\d{2})$/.exec(date) ?? [];
    if (!year || !week) throw new Error("The chart returned an invalid weekly period.");
    const januaryFourth = new Date(Number(year), 0, 4);
    const mondayOffset = (januaryFourth.getDay() + 6) % 7;
    start = toDateKey(new Date(Number(year), 0, 4 - mondayOffset + (Number(week) - 1) * 7));
  } else if (granularity === "monthly") {
    start = `${date.slice(0, 7)}-01`;
  } else {
    start = date.slice(0, 10);
  }
  const parsedStart = new Date(`${start}T00:00:00`);
  const end = granularity === "daily"
    ? start
    : granularity === "weekly"
      ? addDateDays(start, 6)
      : toDateKey(new Date(parsedStart.getFullYear(), parsedStart.getMonth() + 1, 0));
  return {
    start: start < reportRange.start ? reportRange.start : start,
    end: end > reportRange.end ? reportRange.end : end,
  };
}

function getIsoWeekKey(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstMonday = new Date(Date.UTC(weekYear, 0, 4));
  firstMonday.setUTCDate(firstMonday.getUTCDate() - ((firstMonday.getUTCDay() + 6) % 7));
  const week = Math.floor((monday.getTime() - firstMonday.getTime()) / 604_800_000) + 1;
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function formatReportTrendLabel(
  period: string,
  range: ReportDateRange,
  granularity: "daily" | "weekly" | "monthly",
  language: MobileLanguage,
) {
  const date = granularity === "weekly"
    ? getChartPointRange(period, range, "weekly").start
    : granularity === "monthly"
      ? `${period}-01`
      : period;
  const value = new Date(`${date}T00:00:00`);
  const locale = language === "en" ? "en-US" : "id-ID";
  if (granularity === "daily" && value.getDate() !== 1) return String(value.getDate());
  const includeYear = granularity === "monthly" &&
    Date.parse(`${range.end}T00:00:00`) - Date.parse(`${range.start}T00:00:00`) > 366 * 86_400_000;
  return value.toLocaleDateString(locale, {
    day: granularity === "monthly" ? undefined : "numeric",
    month: "short",
    ...(includeYear ? { year: "2-digit" as const } : {}),
  });
}

function fillReportTrendPoints(
  source: ReportPoint[],
  range: ReportDateRange,
  granularity: "daily" | "weekly" | "monthly",
  language: MobileLanguage,
): ReportPoint[] {
  const totalsByPeriod = new Map<string, { income: number; expense: number }>();
  for (const point of source) {
    const period = granularity === "weekly"
      ? /^\d{4}-W\d{2}$/.test(point.date) ? point.date : getIsoWeekKey(point.date)
      : granularity === "monthly"
        ? point.date.slice(0, 7)
        : point.date.slice(0, 10);
    const totals = totalsByPeriod.get(period) ?? { income: 0, expense: 0 };
    totals.income += point.income;
    totals.expense += point.expense;
    totalsByPeriod.set(period, totals);
  }

  const periodKeys: string[] = [];
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  if (granularity === "monthly") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      periodKeys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else if (granularity === "weekly") {
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    while (cursor <= end) {
      periodKeys.push(getIsoWeekKey(toDateKey(cursor)));
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const cursor = new Date(start);
    while (cursor <= end) {
      periodKeys.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return periodKeys.map((period) => {
    const totals = totalsByPeriod.get(period) ?? { income: 0, expense: 0 };
    const label = formatReportTrendLabel(period, range, granularity, language);
    return { date: period, label, income: totals.income, expense: totals.expense, net: totals.income - totals.expense };
  });
}

function createChartDetail(
  title: string,
  subtitle: string,
  metrics: ChartDetailMetric[],
  transactions: DemoTransaction[],
): ChartDetailSelection {
  return { title, subtitle, metrics, transactions };
}

const chartDetailKeyExtractor = (transaction: DemoTransaction) => transaction.id;

const ChartDetailTransactionRow = memo(function ChartDetailTransactionRow({
  transaction,
  palette,
  language,
}: {
  transaction: DemoTransaction;
  palette: Palette;
  language: MobileLanguage;
}) {
  return (
    <View style={[styles.chartDetailTransaction, { borderColor: palette.border }]}>
      <View style={styles.chartDetailTransactionCopy}>
        <Text numberOfLines={1} style={[styles.chartDetailTransactionTitle, { color: palette.text }]}>
          {transaction.note.trim() || transaction.category}
        </Text>
        <Text numberOfLines={1} style={[styles.chartDetailTransactionSubtitle, { color: palette.secondaryText }]}>
          {transaction.category} · {formatMobileDate(transaction.dateISO, language)}
        </Text>
      </View>
      <Text style={[styles.chartDetailTransactionAmount, { color: transaction.income ? palette.incomeAmount : palette.expenseAmount }]}>
        {transaction.income ? "+" : "-"}{formatBudgetMoney(getTransactionAmount(transaction), true)}
      </Text>
    </View>
  );
});

function ChartDetailModal({
  selection,
  palette,
  onClose,
}: {
  selection: ChartDetailSelection | null;
  palette: Palette;
  onClose: () => void;
}) {
  const language = useContext(MobileLanguageContext);
  const renderTransaction = useCallback(
    ({ item }: { item: DemoTransaction }) => <ChartDetailTransactionRow transaction={item} palette={palette} language={language} />,
    [language, palette],
  );
  if (!selection) return null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.chartDetailOverlay}>
        <NativePressable
          accessibilityRole="button"
          accessibilityLabel={translateMobileText("Tutup rincian grafik", language)}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.chartDetailSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.chartDetailHeader}>
            <View style={styles.chartDetailHeadingCopy}>
              <Text style={[styles.chartDetailTitle, { color: palette.text }]}>{selection.title}</Text>
              <Text style={[styles.chartDetailSubtitle, { color: palette.secondaryText }]}>{selection.subtitle}</Text>
            </View>
            <NativePressable
              accessibilityRole="button"
              accessibilityLabel={translateMobileText("Tutup rincian grafik", language)}
              hitSlop={8}
              onPress={onClose}
              style={styles.chartDetailClose}
            >
              <MaterialCommunityIcons name="close" size={20} color={palette.text} />
            </NativePressable>
          </View>
          <View style={styles.chartDetailMetrics}>
            {selection.metrics.map((metric) => (
              <View key={metric.label} style={[styles.chartDetailMetric, { backgroundColor: palette.muted }]}>
                <Text style={[styles.chartDetailMetricLabel, { color: palette.secondaryText }]}>{metric.label}</Text>
                <Text style={[styles.chartDetailMetricValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {metric.value}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.chartDetailListTitle, { color: palette.text }]}>
            {translateMobileText("Transaksi terkait", language)} ({selection.transactions.length})
          </Text>
          <FlatList
            data={selection.transactions}
            keyExtractor={chartDetailKeyExtractor}
            renderItem={renderTransaction}
            style={styles.chartDetailList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.chartDetailEmpty, { color: palette.secondaryText }]}>
                {translateMobileText("Tidak ada transaksi untuk pilihan ini.", language)}
              </Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

function ChartTapHint({ palette }: { palette: Palette }) {
  const language = useContext(MobileLanguageContext);
  return (
    <Text style={[styles.chartTapHint, { color: palette.secondaryText }]}>
      {translateMobileText("Ketuk grafik untuk melihat rincian dan transaksi.", language)}
    </Text>
  );
}

function ReportTrendChart({
  points,
  palette,
  transactions,
  range,
  granularity,
}: {
  points: ReportPoint[];
  palette: Palette;
  transactions: DemoTransaction[];
  range: ReportDateRange;
  granularity: "daily" | "weekly" | "monthly";
}) {
  const language = useContext(MobileLanguageContext);
  const [selection, setSelection] = useState<ChartDetailSelection | null>(null);
  if (!points.length) {
    return <View style={styles.reportEmptyChart}><EmptyPanel palette={palette} message="Belum ada data untuk menampilkan tren arus kas." /></View>;
  }
  const chart = { left: 56, right: 348, top: 16, bottom: 216 };
  const min = Math.min(0, ...points.map((point) => point.net));
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense, point.net]));
  const scaleRange = max - min || 1;
  const step = points.length === 1 ? 0 : (chart.right - chart.left) / (points.length - 1);
  const y = (value: number) => chart.bottom - ((value - min) / scaleRange) * (chart.bottom - chart.top);
  const pathFor = (key: "income" | "expense" | "net") => points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${chart.left + step * index} ${y(key === "net" ? point.net : point[key])}`)
    .join(" ");
  const tickValues = [...new Set([max, 0, min])];
  const tickStride = Math.max(1, Math.ceil(points.length / 8));
  const series = [
    { key: "income", color: palette.chart2 },
    { key: "expense", color: palette.danger },
    { key: "net", color: palette.info },
  ] as const;
  return (
    <View style={[styles.reportSvgChart, { height: 284 }]}>
      <ChartTapHint palette={palette} />
      <Svg width="100%" height={260} viewBox="0 0 360 260">
        {tickValues.map((value) => {
          const tickY = y(value);
          return (
            <Fragment key={value}>
              <Line x1={chart.left} x2={chart.right} y1={tickY} y2={tickY} stroke={palette.border} strokeWidth="1" />
              <SvgText x="2" y={tickY + 4} fill={palette.secondaryText} fontSize="9">{reportCompactMoney(value, language)}</SvgText>
            </Fragment>
          );
        })}
        {series.map(({ key, color }) => (
          <Fragment key={key}>
            <Path d={pathFor(key)} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => (
              point.income > 0 || point.expense > 0 || points.length === 1
                ? <Circle
                    key={`${key}-${point.date}`}
                    cx={chart.left + step * index}
                    cy={y(key === "net" ? point.net : point[key])}
                    r={points.length === 1 ? "5" : "4"}
                    fill={color}
                    pointerEvents="none"
                  />
                : null
            ))}
          </Fragment>
        ))}
        {points.map((point, index) => {
          const pointRange = getChartPointRange(point.date, range, granularity);
          const matchingTransactions = transactions.filter((transaction) =>
            transaction.dateISO >= pointRange.start && transaction.dateISO <= pointRange.end
          );
          return (
            <Rect
              key={`hit-${point.date}`}
              x={chart.left + step * index - Math.min(22, points.length === 1 ? 22 : step / 2)}
              y={chart.top}
              width={Math.min(44, points.length === 1 ? 44 : step)}
              height={chart.bottom - chart.top}
              fill="transparent"
              accessible
              accessibilityLabel={`${point.label}: ${translateMobileText("Pemasukan", language)} ${formatBudgetMoney(point.income)}, ${translateMobileText("Pengeluaran", language)} ${formatBudgetMoney(point.expense)}`}
              onPress={() => setSelection(createChartDetail(
                point.label,
                translateMobileText("Ringkasan transaksi pada periode grafik ini.", language),
                [
                  { label: translateMobileText("Pemasukan", language), value: formatBudgetMoney(point.income) },
                  { label: translateMobileText("Pengeluaran", language), value: formatBudgetMoney(point.expense) },
                  { label: translateMobileText("Arus Kas Bersih", language), value: formatBudgetMoney(point.net) },
                ],
                matchingTransactions,
              ))}
            />
          );
        })}
        {points.map((point, index) => (
          index % tickStride === 0
            ? <SvgText key={point.date} x={chart.left + step * index} y="244" fill={palette.secondaryText} fontSize="9" textAnchor="middle">{point.label}</SvgText>
            : null
        ))}
      </Svg>
      <ChartDetailModal selection={selection} palette={palette} onClose={() => setSelection(null)} />
    </View>
  );
}

function ReportIncomeExpenseChart({
  points,
  palette,
  transactions,
  range,
  granularity,
}: {
  points: ReportPoint[];
  palette: Palette;
  transactions: DemoTransaction[];
  range: ReportDateRange;
  granularity: "daily" | "weekly" | "monthly";
}) {
  const language = useContext(MobileLanguageContext);
  const [selection, setSelection] = useState<ChartDetailSelection | null>(null);
  if (!points.length) {
    return <View style={styles.reportEmptyChart}><EmptyPanel palette={palette} message="Tren pemasukan dan pengeluaran belum tersedia." /></View>;
  }
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]));
  const chart = { left: 58, right: 348, top: 20, bottom: 218 };
  const slot = (chart.right - chart.left) / points.length;
  const tickStride = Math.max(1, Math.ceil(points.length / 8));
  const y = (value: number) => chart.bottom - (value / max) * (chart.bottom - chart.top);
  const x = (index: number) => chart.left + slot * index + slot / 2;
  const linePath = (key: "income" | "expense") =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`).join(" ");
  return (
    <>
      <ChartTapHint palette={palette} />
      <View style={styles.reportLegend}>
        <View style={[styles.reportLegendDot, { backgroundColor: palette.chart2 }]} />
        <Text style={[styles.reportLegendText, { color: palette.secondaryText }]}>Pemasukan</Text>
        <View style={[styles.reportLegendDot, { backgroundColor: palette.chart1 }]} />
        <Text style={[styles.reportLegendText, { color: palette.secondaryText }]}>Pengeluaran</Text>
      </View>
      <Svg width="100%" height={260} viewBox="0 0 360 260">
        {[0, max / 2, max].map((tick) => (
          <Fragment key={tick}>
            <Line x1={chart.left} x2={chart.right} y1={y(tick)} y2={y(tick)} stroke={palette.border} strokeWidth="1" />
            <SvgText x="2" y={y(tick) + 4} fill={palette.secondaryText} fontSize="9">{reportCompactMoney(tick, language)}</SvgText>
          </Fragment>
        ))}
        <Path d={linePath("income")} fill="none" stroke={palette.chart2} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        <Path d={linePath("expense")} fill="none" stroke={palette.chart1} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        {points.map((point, index) => (
          <Fragment key={point.date}>
            <Circle cx={x(index)} cy={y(point.income)} r="3.5" fill={palette.chart2} pointerEvents="none" />
            <Circle cx={x(index)} cy={y(point.expense)} r="3.5" fill={palette.chart1} pointerEvents="none" />
            <Rect
              x={chart.left + slot * index}
              y={chart.top}
              width={slot}
              height={chart.bottom - chart.top}
              fill="transparent"
              accessible
              accessibilityLabel={`${point.label}: ${translateMobileText("Pemasukan", language)} ${formatBudgetMoney(point.income)}, ${translateMobileText("Pengeluaran", language)} ${formatBudgetMoney(point.expense)}`}
              onPress={() => {
                const pointRange = getChartPointRange(point.date, range, granularity);
                const matchingTransactions = transactions.filter((transaction) =>
                  transaction.dateISO >= pointRange.start && transaction.dateISO <= pointRange.end
                );
                setSelection(createChartDetail(
                  point.label,
                  translateMobileText("Ringkasan transaksi pada periode grafik ini.", language),
                  [
                    { label: translateMobileText("Pemasukan", language), value: formatBudgetMoney(point.income) },
                    { label: translateMobileText("Pengeluaran", language), value: formatBudgetMoney(point.expense) },
                  ],
                  matchingTransactions,
                ));
              }}
            />
            {index % tickStride === 0 && <SvgText x={x(index)} y="244" fill={palette.secondaryText} fontSize="9" textAnchor="middle">{point.label}</SvgText>}
          </Fragment>
        ))}
      </Svg>
      <ChartDetailModal selection={selection} palette={palette} onClose={() => setSelection(null)} />
    </>
  );
}

function ReportCategoryBreakdown({
  categories,
  palette,
  transactions,
  range,
  transactionType,
}: {
  categories: ReportCategory[];
  palette: Palette;
  transactions: DemoTransaction[];
  range: ReportDateRange;
  transactionType: "income" | "expense";
}) {
  const language = useContext(MobileLanguageContext);
  const [selection, setSelection] = useState<ChartDetailSelection | null>(null);
  if (!categories.length) {
    return <View style={styles.reportEmptyChart}><EmptyPanel palette={palette} message="Belum ada transaksi untuk kategori ini pada periode terpilih." /></View>;
  }
  const colors = [palette.chart1, palette.chart2, palette.chart3, palette.chart4, palette.chart5, palette.border];
  const total = categories.reduce((sum, category) => sum + category.amount, 0);
  if (total <= 0) {
    return <View style={styles.reportEmptyChart}><EmptyPanel palette={palette} message="Belum ada transaksi untuk kategori ini pada periode terpilih." /></View>;
  }
  const circumference = 2 * Math.PI * 68;
  return (
    <>
      <ChartTapHint palette={palette} />
      <View style={styles.reportDonutWrap}>
        <Svg width={190} height={190} viewBox="0 0 190 190">
          <Circle cx="95" cy="95" r="68" fill="none" stroke={palette.border} strokeWidth="24" />
          {categories.map((category, index) => {
            const length = category.amount / total * circumference;
            const offset = categories.slice(0, index).reduce((sum, item) => sum + item.amount / total * circumference, 0);
            const matchingTransactions = transactions.filter((transaction) =>
              (category.categoryId ? transaction.categoryId === category.categoryId : transaction.category === category.name) &&
              transaction.income === (transactionType === "income")
            );
            return <Circle
              key={category.name}
              cx="95"
              cy="95"
              r="68"
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="24"
              strokeDasharray={`${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`}
              strokeDashoffset={-offset}
              rotation="-90"
              origin="95, 95"
              accessible
              accessibilityLabel={`${category.name}: ${formatBudgetMoney(category.amount)}`}
              onPress={() => setSelection(createChartDetail(
                category.name,
                `${formatMobileDate(range.start, language)} - ${formatMobileDate(range.end, language)}`,
                [
                  { label: translateMobileText(transactionType === "income" ? "Pemasukan" : "Pengeluaran", language), value: formatBudgetMoney(category.amount) },
                  { label: translateMobileText("Persentase dari total", language), value: `${(category.amount / total * 100).toFixed(1)}%` },
                ],
                matchingTransactions,
              ))}
            />;
          })}
          <SvgText x="95" y="91" fill={palette.secondaryText} fontSize="11" textAnchor="middle">Total</SvgText>
          <SvgText x="95" y="110" fill={palette.text} fontSize="12" fontWeight="600" textAnchor="middle">{reportCompactMoney(total, language)}</SvgText>
        </Svg>
      </View>
      <View style={styles.reportCategoryList}>
        {categories.map((category, index) => (
          <NativePressable
            key={category.name}
            accessibilityRole="button"
            accessibilityLabel={`${category.name}, ${formatBudgetMoney(category.amount)}. ${translateMobileText("Ketuk untuk melihat transaksi", language)}`}
            onPress={() => {
              const matchingTransactions = transactions.filter((transaction) =>
                (category.categoryId ? transaction.categoryId === category.categoryId : transaction.category === category.name) &&
                transaction.income === (transactionType === "income")
              );
              setSelection(createChartDetail(
                category.name,
                `${formatMobileDate(range.start, language)} - ${formatMobileDate(range.end, language)}`,
                [
                  { label: translateMobileText(transactionType === "income" ? "Pemasukan" : "Pengeluaran", language), value: formatBudgetMoney(category.amount) },
                  { label: translateMobileText("Persentase dari total", language), value: `${(category.amount / total * 100).toFixed(1)}%` },
                ],
                matchingTransactions,
              ));
            }}
            style={[styles.reportCategoryRow, { backgroundColor: palette.muted }]}
          >
            <View style={[styles.reportLegendDot, { backgroundColor: colors[index % colors.length] }]} />
            <RawText numberOfLines={2} style={[styles.reportCategoryLabel, { color: palette.secondaryText }]}>{category.name}</RawText>
            <Text style={[styles.reportCategoryAmount, { color: palette.text }]}>{formatBudgetMoney(category.amount)}</Text>
          </NativePressable>
        ))}
      </View>
      <ChartDetailModal selection={selection} palette={palette} onClose={() => setSelection(null)} />
    </>
  );
}

function ReportsPageNative({ palette, onNavigate, userId }: { palette: Palette; onNavigate: (route: RouteKey) => void; userId: string }) {
  const { transactions: allTransactions, financeRevision, showToast } = useDemoTransactions();
  const language = useContext(MobileLanguageContext);
  const [reportState, setReportState] = useState<{
    key: string;
    data: NativeReportPageData | null;
    error: string | null;
  } | null>(null);
  const [reportRefresh, setReportRefresh] = useState(0);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportExportError, setReportExportError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriodKey>("thisMonth");
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [chartSelection, setChartSelection] = useState<ChartDetailSelection | null>(null);
  const [customStart, setCustomStart] = useState(() => getReportDateRange("thisMonth", { start: "", end: "" }).start);
  const [customEnd, setCustomEnd] = useState(() => getReportDateRange("thisMonth", { start: "", end: "" }).end);
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);
  const [focusedControl, setFocusedControl] = useState<"period" | "export" | "viewAll" | "close" | "option" | "apply" | null>(null);
  const [openDateField, setOpenDateField] = useState<"start" | "end" | null>(null);
  const { width } = useWindowDimensions();
  const customRange = useMemo(() => ({ start: customStart, end: customEnd }), [customEnd, customStart]);
  const range = useMemo(() => getReportDateRange(period, customRange), [customRange, period]);
  const reportSpanDays = (Date.parse(`${range.end}T00:00:00`) - Date.parse(`${range.start}T00:00:00`)) / 86_400_000 + 1;
  const reportGranularity = reportSpanDays <= 31 ? "daily" : reportSpanDays <= 120 ? "weekly" : "monthly";
  const reportSnapshotKey = `${userId}:${language}:${range.start}:${range.end}:${reportGranularity}:${financeRevision}`;
  const reportRequestKey = `${reportSnapshotKey}:${reportRefresh}`;
  const reportData = reportState?.key === reportRequestKey
    ? reportState.data
    : reportSnapshots.get(reportSnapshotKey) ?? null;
  const reportError = reportState?.key === reportRequestKey ? reportState.error : null;
  useEffect(() => {
    let active = true;
    const loadReport = async () => {
      try {
        const [summaryResponse, expensesResponse, incomesResponse, trendResponse] = await Promise.all([
          financeApi.getReportSummary(range.start, range.end),
          financeApi.getReportCategoryBreakdown("expense", range.start, range.end),
          financeApi.getReportCategoryBreakdown("income", range.start, range.end),
          financeApi.getReportCashflowTrend(reportGranularity, range.start, range.end),
        ]);
        if (!active) return;
        const mapCategories = (response: NativeReportCategoryBreakdown): ReportCategory[] =>
          response.categories.map((item) => {
            const amount = Number(item.totalAmount);
            if (!Number.isFinite(amount)) throw new Error("The server returned an invalid report category amount.");
            return { name: item.categoryName ?? "Kategori tidak tersedia", amount, categoryId: item.categoryId };
          });
        const nextPoints = trendResponse.data.map((item) => {
          const income = Number(item.income);
          const expense = Number(item.expense);
          const net = Number(item.netCashFlow);
          if (![income, expense, net].every(Number.isFinite)) {
            throw new Error("The server returned invalid report trend values.");
          }
          const periodDate = /^\d{4}-\d{2}/.test(item.period)
            ? new Date(`${item.period.slice(0, 10)}T00:00:00`)
            : new Date(item.period);
          return {
            date: item.period,
            label: Number.isNaN(periodDate.getTime())
              ? item.period
              : periodDate.toLocaleDateString(language === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short" }),
            income,
            expense,
            net,
          };
        });
        const data = {
          summary: summaryResponse,
          expenses: mapCategories(expensesResponse),
          incomes: mapCategories(incomesResponse),
          points: nextPoints,
        };
        reportSnapshots.set(reportSnapshotKey, data);
        setReportState({ key: reportRequestKey, data, error: null });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Silakan coba lagi.";
        console.error("Failed to load native report data.", error);
        setReportState({
          key: reportRequestKey,
          data: reportSnapshots.get(reportSnapshotKey) ?? null,
          error: message,
        });
      }
    };
    void loadReport();
    return () => { active = false; };
  }, [language, range.end, range.start, reportGranularity, reportRefresh, reportRequestKey, reportSnapshotKey]);
  const reportSummary = reportData?.summary ?? null;
  const reportPoints = reportData?.points;
  const reportExpenses = reportData?.expenses ?? [];
  const reportIncomes = reportData?.incomes ?? [];
  const periodLabel = reportPeriodOptions.find((option) => option.key === period)?.label ?? "Bulan Ini";
  const timeSeparator = language === "en" ? ":" : ".";
  const rangeLabel = `${formatMobileDate(range.start, language)} • 00${timeSeparator}00 – ${formatMobileDate(range.end, language)} • 23${timeSeparator}59`;
  const transactions = useMemo(
    () => allTransactions.filter((transaction) => transaction.dateISO >= range.start && transaction.dateISO <= range.end),
    [allTransactions, range.end, range.start],
  );
  const reportIsEmpty = reportSummary
    ? reportSummary.summary.transactions === 0
    : transactions.length === 0;
  const expenses = reportExpenses;
  const incomes = reportIncomes;
  const localIncome = reportSummary ? 0 : transactions.filter((item) => item.income).reduce((sum, item) => sum + getTransactionAmount(item), 0);
  const localExpense = reportSummary ? 0 : transactions.filter((item) => !item.income).reduce((sum, item) => sum + getTransactionAmount(item), 0);
  const localCategoryBreakdown = (income: boolean): ReportCategory[] => {
    const totals = new Map<string, ReportCategory>();
    for (const transaction of transactions) {
      if (transaction.income !== income) continue;
      const key = transaction.categoryId ?? transaction.category;
      const existing = totals.get(key);
      if (existing) existing.amount += getTransactionAmount(transaction);
      else totals.set(key, {
        name: transaction.category,
        amount: getTransactionAmount(transaction),
        categoryId: transaction.categoryId,
      });
    }
    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  };
  const totalIncome = Number(reportSummary?.summary.income ?? localIncome);
  const totalExpense = Number(reportSummary?.summary.expense ?? localExpense);
  const netCashFlow = Number(reportSummary?.summary.netCashFlow ?? totalIncome - totalExpense);
  const points = useMemo(
    () => fillReportTrendPoints(reportPoints ?? [], range, reportGranularity, language),
    [language, range, reportGranularity, reportPoints],
  );
  const summary = [
    { label: "TOTAL PEMASUKAN", value: formatBudgetMoney(totalIncome), icon: "cash-plus" },
    { label: "TOTAL PENGELUARAN", value: formatBudgetMoney(totalExpense), icon: "cash-minus" },
    { label: "ARUS KAS BERSIH", value: `${netCashFlow < 0 ? "-" : ""}${formatBudgetMoney(Math.abs(netCashFlow))}`, icon: "swap-vertical" },
    { label: "JUMLAH TRANSAKSI", value: String(reportSummary?.summary.transactions ?? transactions.length), icon: "receipt-text-outline" },
  ] as const;
  const customDateIsValid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
  };
  const applyCustomRange = () => {
    if (!customDateIsValid(draftStart) || !customDateIsValid(draftEnd) || draftStart > draftEnd) {
      showLocalizedAlert("Rentang tanggal tidak valid", "Pilih tanggal yang tersedia dan pastikan tanggal mulai tidak melewati tanggal akhir.", language);
      return;
    }
    setCustomStart(draftStart);
    setCustomEnd(draftEnd);
    setPeriod("custom");
    setPeriodModalOpen(false);
  };
  const openPeriodSelector = () => {
    setDraftStart(customStart);
    setDraftEnd(customEnd);
    setOpenDateField(null);
    setPeriodModalOpen(true);
  };
  const exportReport = async () => {
    setReportExporting(true);
    setReportExportError(null);
    try {
      const report = await financeApi.getReportExport(range.start, range.end);
      const result = await saveNativeReportExport(report);
      if (result === "saved") {
        showToast(translateMobileText("Laporan berhasil diunduh.", language));
      }
    } catch (error) {
      console.error("Failed to export the native Excel report.", error);
      setReportExportError(translateMobileText("Unduhan Excel gagal. Silakan coba lagi.", language));
    } finally {
      setReportExporting(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader palette={palette} title="Laporan Keuangan" description="Ringkasan kinerja keuangan Anda dalam periode terpilih." />
        <FinanceDataState palette={palette} loading={false} error={reportError} onRetry={() => { setReportRefresh((current) => current + 1); }} />
        <View style={styles.reportPeriodBlock}>
          <View style={[styles.reportPeriodHeading, width < 640 && styles.reportPeriodHeadingStacked]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Periode</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Periode ${periodLabel}, ubah periode`}
              accessibilityState={{ expanded: periodModalOpen }}
              focusable
              onFocus={() => setFocusedControl("period")}
              onBlur={() => setFocusedControl(null)}
              onPress={openPeriodSelector}
              style={[
                styles.reportPeriodButton,
                { borderColor: palette.border, backgroundColor: palette.surface },
                focusedControl === "period" && { borderColor: palette.accent, borderWidth: 2 },
              ]}
            >
              <Text style={[styles.reportPeriodButtonText, { color: palette.text }]}>{periodLabel}</Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={palette.secondaryText} />
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>{rangeLabel}</Text>
        </View>

        <Card palette={palette} style={styles.reportExportCard}>
          <View style={styles.reportExportRow}>
            <Text style={[styles.reportExportTitle, { color: palette.text }]}>Ekspor Laporan</Text>
            <NativePressable
              accessibilityRole="button"
              accessibilityLabel={translateMobileText("Unduh Excel (.xlsx)", language)}
              accessibilityState={{ disabled: reportExporting, busy: reportExporting }}
              disabled={reportExporting}
              focusable
              onFocus={() => setFocusedControl("export")}
              onBlur={() => setFocusedControl(null)}
              onPress={() => void exportReport()}
              style={[
                styles.reportExportButton,
                { backgroundColor: palette.input, borderColor: palette.border, borderWidth: 1 },
                reportExporting && { opacity: 0.65 },
                focusedControl === "export" && { borderColor: palette.accent, borderWidth: 2 },
              ]}
            >
              {reportExporting
                ? <ActivityIndicator size="small" color={palette.accent} />
                : <MaterialCommunityIcons name="download" size={18} color={palette.accent} />}
              <Text style={[styles.reportExportButtonText, { color: palette.text }]}>
                {reportExporting ? "Mengunduh..." : "Unduh Excel (.xlsx)"}
              </Text>
            </NativePressable>
          </View>
          {reportExportError && (
            <Text accessibilityRole="alert" style={[styles.reportExportError, { color: palette.expenseAmount }]}>
              {reportExportError}
            </Text>
          )}
        </Card>

        {reportError && !reportData ? null : reportIsEmpty ? (
          <ReportEmptyState palette={palette} />
        ) : (
          <>
            <View style={styles.reportSummaryList}>
              {summary.map((item) => (
                <Card key={item.label} palette={palette} style={styles.reportSummaryCard}>
                  <View style={styles.reportSummaryHeading}>
                    <Text style={[styles.kpiLabel, styles.reportSummaryLabel, { color: palette.secondaryText }]}>{item.label}</Text>
                    <View style={[styles.reportSummaryIcon, { backgroundColor: palette.muted }]}>
                      <MaterialCommunityIcons name={item.icon} size={16} color={palette.accent} />
                    </View>
                  </View>
                  <Text style={[styles.reportSummaryValue, { color: palette.text }]}>{item.value}</Text>
                  <View style={styles.reportSummaryComparison}>
                    <View style={styles.reportSummaryChange}>
                      <MaterialCommunityIcons name="arrow-top-right" size={14} color={palette.incomeAmount} />
                      <Text style={[styles.reportSummaryNew, { color: palette.incomeAmount }]}>Baru</Text>
                    </View>
                    <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>vs periode sebelumnya</Text>
                  </View>
                </Card>
              ))}
            </View>

            <ReportChartCard palette={palette} title="Tren Arus Kas" subtitle="Pemasukan, pengeluaran, dan arus kas bersih per periode.">
              <View style={styles.reportLegend}>
                <View style={[styles.reportLegendLine, { borderTopColor: palette.chart2 }]} />
                <Text style={[styles.reportLegendText, { color: palette.secondaryText }]}>Pemasukan</Text>
                <View style={[styles.reportLegendLine, { borderTopColor: palette.danger }]} />
                <Text style={[styles.reportLegendText, { color: palette.secondaryText }]}>Pengeluaran</Text>
                <View style={[styles.reportLegendLine, { borderTopColor: palette.info }]} />
                <Text style={[styles.reportLegendText, { color: palette.secondaryText }]}>Bersih</Text>
              </View>
              <ReportTrendChart points={points} palette={palette} transactions={transactions} range={range} granularity={reportGranularity} />
            </ReportChartCard>

            <ReportChartCard palette={palette} title="Pemasukan vs Pengeluaran" subtitle="Tren pemasukan dan pengeluaran per periode.">
              <ReportIncomeExpenseChart points={points} palette={palette} transactions={transactions} range={range} granularity={reportGranularity} />
            </ReportChartCard>

            <ReportChartCard palette={palette} title="Pengeluaran per Kategori" subtitle="Distribusi pengeluaran berdasarkan kategori.">
              <ReportCategoryBreakdown categories={expenses.length ? expenses : localCategoryBreakdown(false)} palette={palette} transactions={transactions} range={range} transactionType="expense" />
            </ReportChartCard>

            <ReportChartCard palette={palette} title="Kategori Pengeluaran Terbesar" subtitle="Lima kategori dengan pengeluaran tertinggi pada periode terpilih.">
              {expenses.length === 0 ? (
                <View style={styles.reportEmptyChart}><EmptyPanel palette={palette} message="Belum ada pengeluaran pada periode terpilih." /></View>
              ) : (
                <View style={styles.reportTopCategories}>
                  <ChartTapHint palette={palette} />
                  {expenses.slice(0, 5).map((category, index) => (
                    <NativePressable
                      key={category.name}
                      accessibilityRole="button"
                      accessibilityLabel={`${category.name}, ${formatBudgetMoney(category.amount)}. ${translateMobileText("Ketuk untuk melihat transaksi", language)}`}
                      onPress={() => setChartSelection(createChartDetail(
                        category.name,
                        `${formatMobileDate(range.start, language)} - ${formatMobileDate(range.end, language)}`,
                        [
                          { label: translateMobileText("Total Pengeluaran", language), value: formatBudgetMoney(category.amount) },
                          { label: translateMobileText("Persentase dari total", language), value: `${(category.amount / totalExpense * 100).toFixed(1)}%` },
                        ],
                        transactions.filter((transaction) =>
                          !transaction.income &&
                          (category.categoryId ? transaction.categoryId === category.categoryId : transaction.category === category.name)
                        ),
                      ))}
                      style={styles.reportTopCategoryItem}
                    >
                      <View style={styles.reportTopCategoryHeading}>
                        <View style={styles.reportTopCategoryName}>
                          {index === 0
                            ? <MaterialCommunityIcons name="trophy-outline" size={16} color={palette.accent} />
                            : <Text style={[styles.reportRank, { color: palette.secondaryText, backgroundColor: palette.muted }]}>{index + 1}</Text>}
                          <RawText numberOfLines={1} style={[styles.reportCategoryLabel, { color: palette.text }]}>{category.name}</RawText>
                        </View>
                        <Text style={[styles.reportCategoryAmount, { color: palette.text }]}>{formatBudgetMoney(category.amount)}</Text>
                      </View>
                      <View style={styles.reportTopCategoryProgress}>
                        <View style={[styles.reportProgressTrack, { backgroundColor: palette.border }]}>
                          <View style={[styles.reportProgressFill, { width: `${Math.max(2, category.amount / expenses[0].amount * 100)}%`, backgroundColor: palette.accent }]} />
                        </View>
                        <Text style={[styles.reportPercentage, { color: palette.secondaryText }]}>{(category.amount / totalExpense * 100).toFixed(1)}%</Text>
                      </View>
                    </NativePressable>
                  ))}
                </View>
              )}
            </ReportChartCard>

            <ReportChartCard palette={palette} title="Pemasukan per Kategori" subtitle="Distribusi pemasukan berdasarkan kategori.">
              <ReportCategoryBreakdown categories={incomes.length ? incomes : localCategoryBreakdown(true)} palette={palette} transactions={transactions} range={range} transactionType="income" />
            </ReportChartCard>

            <Card palette={palette} style={styles.reportTransactionCard}>
              <View style={styles.reportTransactionHeader}>
                <View style={styles.reportTransactionTitleBlock}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Ringkasan Transaksi</Text>
                  <Text style={[styles.cardSubtitle, styles.reportSubtitle, { color: palette.secondaryText }]}>Transaksi terbaru pada periode ini.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  focusable
                  onFocus={() => setFocusedControl("viewAll")}
                  onBlur={() => setFocusedControl(null)}
                  onPress={() => onNavigate("transactions")}
                  style={[
                    styles.reportViewAllButton,
                    focusedControl === "viewAll" && { backgroundColor: palette.muted, borderColor: palette.accent, borderRadius: 10, borderWidth: 2 },
                  ]}
                >
                  <Text style={[styles.reportViewAllText, { color: palette.accent }]}>Lihat Semua Transaksi</Text>
                  <MaterialCommunityIcons name="arrow-right" size={15} color={palette.accent} />
                </Pressable>
              </View>
              {transactions.slice(0, 8).map((transaction) => (
                <View key={transaction.id} style={[styles.reportTransaction, { borderTopColor: palette.border }]}>
                  <View style={[styles.reportTransactionBadge, { borderColor: palette.border }]}>
                    <Text style={{ color: palette.secondaryText, fontSize: 9 }}>{transaction.income ? "PEMASUKAN" : "PENGELUARAN"}</Text>
                  </View>
                  <View style={styles.reportTransactionCopy}>
                    <Text numberOfLines={1} style={{ color: palette.text, fontWeight: "600" }}>{transaction.category}</Text>
                    <Text numberOfLines={1} style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{transaction.date}</Text>
                  </View>
                  <Text style={[styles.reportTransactionAmount, { color: transaction.income ? palette.incomeAmount : palette.expenseAmount }]}>{transaction.amount}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      <ChartDetailModal selection={chartSelection} palette={palette} onClose={() => setChartSelection(null)} />

      <Modal visible={periodModalOpen} transparent animationType="fade" onRequestClose={() => { setOpenDateField(null); setPeriodModalOpen(false); }}>
        <View style={styles.reportModalBackdrop}>
          <Pressable onPress={() => { setOpenDateField(null); setPeriodModalOpen(false); }} style={StyleSheet.absoluteFill} accessible={false} focusable={false} />
          <View style={[styles.reportPeriodModal, { backgroundColor: palette.card, borderColor: palette.border, maxHeight: "85%", width: Math.min(Math.max(0, width - 32), 512) }]}>
            <View style={styles.reportModalHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Pilih Periode</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup"
                focusable
                onFocus={() => setFocusedControl("close")}
                onBlur={() => setFocusedControl(null)}
                onPress={() => { setOpenDateField(null); setPeriodModalOpen(false); }}
                style={[styles.reportModalClose, focusedControl === "close" && { borderColor: palette.accent, borderRadius: 10, borderWidth: 2 }]}
              >
                <MaterialCommunityIcons name="close" size={20} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {reportPeriodOptions.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === option.key }}
                  focusable
                  onFocus={() => setFocusedControl("option")}
                  onBlur={() => setFocusedControl(null)}
                  onPress={() => {
                    if (option.key === "custom") {
                      setDraftStart(customStart);
                      setDraftEnd(customEnd);
                      setPeriod("custom");
                    } else {
                      setPeriod(option.key);
                      setPeriodModalOpen(false);
                    }
                  }}
                  style={[
                    styles.reportPeriodOption,
                    { borderBottomColor: palette.border },
                    focusedControl === "option" && { backgroundColor: palette.muted, borderColor: palette.accent, borderWidth: 2 },
                  ]}
                >
                  <Text style={{ color: palette.text }}>{option.label}</Text>
                  {period === option.key && <MaterialCommunityIcons name="check" size={18} color={palette.accent} />}
                </Pressable>
              ))}
              {period === "custom" && (
                <View style={styles.reportCustomRange}>
                  <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Tanggal mulai</Text>
                  <NativeCalendarPicker
                    label="Tanggal mulai"
                    value={draftStart}
                    palette={palette}
                    active={periodModalOpen && period === "custom" && openDateField === "start"}
                    onOpenChange={(open) => setOpenDateField(open ? "start" : null)}
                    onChange={setDraftStart}
                    allowClear={false}
                    triggerStyle={[styles.reportDateInput, { backgroundColor: palette.input }]}
                  />
                  <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Tanggal akhir</Text>
                  <NativeCalendarPicker
                    label="Tanggal akhir"
                    value={draftEnd}
                    palette={palette}
                    active={periodModalOpen && period === "custom" && openDateField === "end"}
                    onOpenChange={(open) => setOpenDateField(open ? "end" : null)}
                    onChange={setDraftEnd}
                    allowClear={false}
                    triggerStyle={[styles.reportDateInput, { backgroundColor: palette.input }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    focusable
                    onFocus={() => setFocusedControl("apply")}
                    onBlur={() => setFocusedControl(null)}
                    onPress={applyCustomRange}
                    style={[
                      styles.reportApplyButton,
                      { backgroundColor: palette.accent },
                      focusedControl === "apply" && { borderColor: palette.accentText, borderWidth: 2 },
                    ]}
                  >
                    <Text style={[styles.reportApplyText, { color: palette.accentText }]}>Terapkan Periode</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AnalyticsPageNative({ palette, userId }: { palette: Palette; userId: string }) {
  const language = useContext(MobileLanguageContext);
  const { rawTransactions, transactions, categories, financeError, financeRevision, refreshFinanceData } = useDemoTransactions();
  const { width } = useWindowDimensions();
  const [chartSelection, setChartSelection] = useState<ChartDetailSelection | null>(null);
  const [period, setPeriod] = useState<ReportPeriodKey>("thisMonth");
  const [customRange, setCustomRange] = useState<ReportDateRange>(() => {
    const today = getLocalDateInput();
    return { start: today, end: today };
  });
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(customRange.start);
  const [draftEnd, setDraftEnd] = useState(customRange.end);
  const [openDateField, setOpenDateField] = useState<"start" | "end" | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [analyticsState, setAnalyticsState] = useState<{
    requestKey: string;
    snapshotKey: string;
    data: NativeAnalyticsPageData | null;
    error: string | null;
  } | null>(null);
  const [overviewState, setOverviewState] = useState<{
    snapshotKey: string;
    overview: NativeAnalyticsOverview;
  } | null>(null);
  const range = useMemo(() => getReportDateRange(period, customRange), [customRange, period]);
  const completeMonthRange = useMemo(() => getCompleteMonthDateRange(range), [range]);
  const analyticsGranularity: "daily" | "monthly" = (Date.parse(`${range.end}T23:59:59`) - Date.parse(`${range.start}T00:00:00`)) / 86_400_000 > 62
    ? "monthly"
    : "daily";
  const analyticsSnapshotKey = `${userId}:${range.start}:${range.end}:${analyticsGranularity}:${financeRevision}`;
  const analyticsRequestKey = `${analyticsSnapshotKey}:${retryCount}`;
  const analyticsData = analyticsState?.snapshotKey === analyticsSnapshotKey
    ? analyticsState.data
    : analyticsSnapshots.get(analyticsSnapshotKey) ?? null;
  const analyticsOverview = analyticsData?.overview
    ?? (overviewState?.snapshotKey === analyticsSnapshotKey ? overviewState.overview : null)
    ?? analyticsSnapshots.get(analyticsSnapshotKey)?.overview
    ?? null;
  const analyticsError = analyticsState?.requestKey === analyticsRequestKey ? analyticsState.error : null;
  useEffect(() => {
    let active = true;
    const loadAnalytics = async () => {
      const overviewPromise = financeApi.getAnalyticsOverview(range.start, range.end).then((overview) => {
        if (![overview.income, overview.expense, overview.netCashFlow, overview.transactions].every((value) => Number.isFinite(Number(value)))) {
          throw new Error("The server returned invalid analytics overview values.");
        }
        if (active) setOverviewState({ snapshotKey: analyticsSnapshotKey, overview });
        return overview;
      });
      const [
        overview,
        expenses,
        incomes,
        spending,
        health,
        insights,
        budgets,
        budgetSpending,
      ] = await Promise.all([
        overviewPromise,
        financeApi.getAnalyticsExpenses(range.start, range.end, analyticsGranularity),
        financeApi.getAnalyticsIncome(range.start, range.end, analyticsGranularity),
        financeApi.getAnalyticsSpending(range.start, range.end),
        financeApi.getFinancialHealth(range.start, range.end),
        financeApi.getInsights(range.start, range.end),
        financeApi.listBudgets(),
        completeMonthRange
          ? financeApi.getAnalyticsSpending(completeMonthRange.start, completeMonthRange.end)
          : Promise.resolve(null),
      ]);
      const numericValues = [
        overview.income,
        overview.expense,
        overview.netCashFlow,
        spending.avgExpense,
        spending.largestExpense,
        spending.avgTransaction,
        health.netCashFlow,
        ...expenses.categories.map((item) => item.totalAmount),
        ...incomes.categories.map((item) => item.totalAmount),
        ...(budgetSpending?.byCategory.map((item) => item.totalAmount) ?? []),
        ...budgets.map((item) => item.budget_amount_cents),
      ];
      if (numericValues.some((value) => !Number.isFinite(Number(value)))) {
        throw new Error("The server returned invalid analytics values.");
      }
      if (!active) return;
      const data = { overview, expenses, incomes, spending, health, insights, budgets, budgetSpending };
      analyticsSnapshots.set(analyticsSnapshotKey, data);
      setAnalyticsState({ requestKey: analyticsRequestKey, snapshotKey: analyticsSnapshotKey, data, error: null });
    };
    void Promise.resolve().then(loadAnalytics).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to load native financial analytics.", error);
      setAnalyticsState({
        requestKey: analyticsRequestKey,
        snapshotKey: analyticsSnapshotKey,
        data: analyticsSnapshots.get(analyticsSnapshotKey) ?? null,
        error: message,
      });
    });
    return () => { active = false; };
  }, [analyticsGranularity, analyticsRequestKey, analyticsSnapshotKey, completeMonthRange, range.end, range.start]);
  const rangeTransactions = transactions.filter((item) => item.dateISO >= range.start && item.dateISO <= range.end);
  const localIncome = rangeTransactions.filter((item) => item.income).reduce((sum, item) => sum + getTransactionAmount(item), 0);
  const localExpense = rangeTransactions.filter((item) => !item.income).reduce((sum, item) => sum + getTransactionAmount(item), 0);
  const totalIncome = Number(analyticsOverview?.income ?? localIncome);
  const totalExpense = Number(analyticsOverview?.expense ?? localExpense);
  const netCashFlow = Number(analyticsOverview?.netCashFlow ?? totalIncome - totalExpense);
  const savingRate = analyticsOverview?.savingRate ?? (totalIncome ? netCashFlow / totalIncome * 100 : 0);
  const healthScore = analyticsData?.health.score ?? 0;
  const concentration = analyticsData?.health.spendingConcentration ?? 0;
  const localCategoryTotals = (income: boolean) => {
    const totals = new Map<string, { id?: string; name: string; amount: number }>();
    for (const item of rangeTransactions) {
      if (item.income !== income) continue;
      const key = item.categoryId ?? item.category;
      const current = totals.get(key);
      if (current) current.amount += getTransactionAmount(item);
      else totals.set(key, { id: key, name: item.category, amount: getTransactionAmount(item) });
    }
    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  };
  const expenses = analyticsData
    ? analyticsData.spending.byCategory
      .map((item) => ({ id: item.categoryId, name: item.categoryName ?? "Tanpa kategori", amount: Number(item.totalAmount) }))
      .sort((left, right) => right.amount - left.amount)
    : localCategoryTotals(false);
  const incomes = analyticsData
    ? analyticsData.incomes.categories
      .map((item) => ({ id: item.categoryId, name: item.categoryName ?? "Tanpa kategori", amount: Number(item.totalAmount) }))
      .sort((left, right) => right.amount - left.amount)
    : localCategoryTotals(true);
  const trend = useMemo(
    () => buildAnalyticsExpenseTrend(rawTransactions, transactions, categories, range, language),
    [categories, language, range, rawTransactions, transactions],
  );
  const savingsPoints = useMemo(
    () => buildAnalyticsSavingsTrend(rawTransactions, transactions, range, language, analyticsGranularity),
    [analyticsGranularity, language, range, rawTransactions, transactions],
  );
  const expenseCount = analyticsData?.spending.expenseTransactions ?? rangeTransactions.filter((item) => !item.income).length;
  const incomeCount = analyticsData?.spending.incomeTransactions ?? rangeTransactions.filter((item) => item.income).length;
  const averageExpense = Number(analyticsData?.spending.avgExpense ?? (expenseCount ? localExpense / expenseCount : 0));
  const largestExpense = Number(analyticsData?.spending.largestExpense ?? Math.max(0, ...rangeTransactions.filter((item) => !item.income).map(getTransactionAmount)));
  const averageTransaction = Number(analyticsData?.spending.avgTransaction ?? (rangeTransactions.length ? (localIncome + localExpense) / rangeTransactions.length : 0));
  const incomeVsExpense = analyticsData?.health.incomeVsExpense;
  const expenseRatio = analyticsData?.health.expenseRatio ?? (totalIncome ? totalExpense / totalIncome * 100 : 0);
  const rangeLabel = `${formatMobileDate(range.start, language)} - ${formatMobileDate(range.end, language)}`;
  const kpis = [
    { label: "TOTAL PEMASUKAN", value: formatBudgetMoney(totalIncome), icon: "arrow-down-bold" as const, tone: palette.incomeAmount },
    { label: "TOTAL PENGELUARAN", value: formatBudgetMoney(totalExpense), icon: "arrow-up-bold" as const, tone: palette.expenseAmount },
    { label: "ARUS KAS BERSIH", value: formatBudgetMoney(netCashFlow), icon: "swap-horizontal" as const, tone: netCashFlow >= 0 ? palette.incomeAmount : palette.expenseAmount },
    { label: "SAVING RATE", value: `${savingRate.toFixed(1)}%`, icon: "content-save-outline" as const, tone: palette.accent },
    { label: "JUMLAH TRANSAKSI", value: String(analyticsOverview?.transactions ?? rangeTransactions.length), icon: "receipt-text-outline" as const, tone: palette.secondaryText },
  ];
  const topExpensePercent = (amount: number) => totalExpense ? `${(amount / totalExpense * 100).toFixed(1)}%` : "0.0%";
  const topIncomePercent = (amount: number) => totalIncome ? `${(amount / totalIncome * 100).toFixed(1)}%` : "0.0%";
  const dateRangeIsValid = (start: string, end: string) => {
    const validDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00`);
      return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
    };
    return validDate(start) && validDate(end) && start <= end;
  };
  const applyPeriod = (nextPeriod: ReportPeriodKey) => {
    setOpenDateField(null);
    setPeriod(nextPeriod);
    if (nextPeriod === "custom") {
      setDraftStart(range.start);
      setDraftEnd(range.end);
    } else {
      setPeriodModalOpen(false);
    }
  };
  const applyCustomRange = () => {
    if (!dateRangeIsValid(draftStart, draftEnd)) {
      showLocalizedAlert("Rentang tidak valid", "Pastikan tanggal tersedia dan tanggal mulai tidak melewati tanggal akhir.", language);
      return;
    }
    setCustomRange({ start: draftStart, end: draftEnd });
    setPeriod("custom");
    setPeriodModalOpen(false);
  };
  const insights = analyticsData?.insights ?? [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.analyticsContent} showsVerticalScrollIndicator={false}>
      <PageHeader palette={palette} title="Analitik Keuangan" description="Wawasan mendalam atas performa keuangan Anda." />
      <View style={styles.analyticsPeriodRow}>
        <View style={styles.analyticsPeriodCopy}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Periode</Text>
          <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{rangeLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pilih periode. Saat ini ${reportPeriodOptions.find((item) => item.key === period)?.label}`}
          onPress={() => setPeriodModalOpen(true)}
          style={[styles.selectButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.selectText, { color: palette.text }]}>{reportPeriodOptions.find((item) => item.key === period)?.label}</Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={palette.secondaryText} />
        </Pressable>
      </View>
      <FinanceDataState palette={palette} loading={false} error={analyticsError} onRetry={() => setRetryCount((count) => count + 1)} />

      <>
      <View style={[styles.analyticsKpiGrid, { width: width - 32 }]}>
        {kpis.map((item) => (
          <Card key={item.label} palette={palette} style={styles.analyticsKpiCard}>
            <View style={styles.analyticsKpiHeading}>
              <Text style={[styles.kpiLabel, { color: palette.secondaryText }]}>{item.label}</Text>
              <MaterialCommunityIcons name={item.icon} size={18} color={item.tone} />
            </View>
            <Text style={[styles.analyticsKpiValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
            <Text style={[styles.analyticsKpiHint, { color: palette.secondaryText }]}>Data akun dari backend</Text>
          </Card>
        ))}
      </View>

      <ReportChartCard palette={palette} title="Komposisi Pengeluaran per Kategori" subtitle="Proporsi total pengeluaran per periode.">
        <AnalyticsTrendChart
          categories={trend.categories}
          points={trend.points}
          palette={palette}
          loading={false}
          error={financeError}
          onRetry={() => { void refreshFinanceData(); }}
          transactions={transactions}
          range={range}
          granularity={trend.granularity}
        />
      </ReportChartCard>
      <ReportChartCard palette={palette} title="Tren Saving Rate" subtitle="Persentase pemasukan tersisa, dihitung kumulatif sejak awal periode.">
        <AnalyticsSavingsRateChart
          points={savingsPoints}
          palette={palette}
          transactions={transactions}
          range={range}
          granularity={analyticsGranularity}
          loading={false}
          error={financeError}
          onRetry={() => { void refreshFinanceData(); }}
        />
      </ReportChartCard>
      <ReportChartCard palette={palette} title="Anggaran vs Pengeluaran per Kategori" subtitle="Membandingkan bulan kalender penuh yang tercakup dalam periode terpilih.">
        <AnalyticsBudgetChart
          range={completeMonthRange}
          budgets={analyticsData?.budgets ?? []}
          categoryBreakdown={analyticsData?.budgetSpending?.byCategory ?? []}
          palette={palette}
          transactions={transactions}
        />
      </ReportChartCard>

      <View style={styles.analyticsSection}>
        <Card palette={palette} style={styles.analyticsListCard}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Kategori Pengeluaran Terbesar</Text>
          {expenses.length ? (
            <View style={styles.analyticsTopCategoryList}>
              <ChartTapHint palette={palette} />
              {expenses.slice(0, 5).map((item, index) => {
                const percentage = totalExpense > 0 ? Math.min(100, item.amount / totalExpense * 100) : 0;
                return (
                  <NativePressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${formatBudgetMoney(item.amount)}. ${translateMobileText("Ketuk untuk melihat transaksi", language)}`}
                    onPress={() => setChartSelection(createChartDetail(
                      item.name,
                      rangeLabel,
                      [
                        { label: translateMobileText("Total Pengeluaran", language), value: formatBudgetMoney(item.amount) },
                        { label: translateMobileText("Persentase dari total", language), value: topExpensePercent(item.amount) },
                      ],
                      transactions.filter((transaction) =>
                        !transaction.income &&
                        transaction.categoryId === item.id &&
                        transaction.dateISO >= range.start &&
                        transaction.dateISO <= range.end
                      ),
                    ))}
                    style={styles.analyticsTopCategoryItem}
                  >
                    <View style={styles.analyticsTopCategoryHeader}>
                      <View style={styles.analyticsTopCategoryLead}>
                        <View style={[styles.analyticsTopCategoryBadge, { backgroundColor: palette.muted }]}>
                          {index === 0 ? (
                            <MaterialCommunityIcons name="trophy-outline" size={14} color={palette.chart1} />
                          ) : (
                            <Text style={[styles.analyticsRankText, { color: palette.secondaryText }]}>{index + 1}</Text>
                          )}
                        </View>
                        <RawText style={[styles.analyticsCategoryName, { color: palette.text }]} numberOfLines={1}>{item.name}</RawText>
                      </View>
                      <Text style={[styles.analyticsCategoryValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatBudgetMoney(item.amount, true)}</Text>
                    </View>
                    <View style={styles.analyticsTopCategoryProgress}>
                      <View style={[styles.analyticsTopCategoryTrack, { backgroundColor: palette.muted }]}>
                        <View style={[styles.analyticsTopCategoryFill, { width: `${percentage}%`, backgroundColor: palette.chart1 }]} />
                      </View>
                      <Text style={[styles.analyticsCategoryPercent, { color: palette.secondaryText }]}>{topExpensePercent(item.amount)}</Text>
                    </View>
                  </NativePressable>
                );
              })}
            </View>
          ) : <EmptyPanel palette={palette} message="Belum ada pengeluaran pada periode ini." compact />}
        </Card>
        <Card palette={palette} style={[styles.analyticsListCard, styles.analyticsListCardSpaced]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Kategori Pemasukan Terbesar</Text>
          {incomes.length ? (
            <View style={styles.analyticsTopCategoryList}>
              {incomes.slice(0, 5).map((item, index) => {
                const percentage = totalIncome > 0 ? Math.min(100, item.amount / totalIncome * 100) : 0;
                return (
                  <View key={item.name} style={styles.analyticsTopCategoryItem}>
                    <View style={styles.analyticsTopCategoryHeader}>
                      <View style={styles.analyticsTopCategoryLead}>
                        <View style={[styles.analyticsTopCategoryBadge, { backgroundColor: palette.muted }]}>
                          {index === 0 ? (
                            <MaterialCommunityIcons name="trophy-outline" size={14} color={palette.chart1} />
                          ) : (
                            <Text style={[styles.analyticsRankText, { color: palette.secondaryText }]}>{index + 1}</Text>
                          )}
                        </View>
                        <RawText style={[styles.analyticsCategoryName, { color: palette.text }]} numberOfLines={1}>{item.name}</RawText>
                      </View>
                      <Text style={[styles.analyticsCategoryValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatBudgetMoney(item.amount, true)}</Text>
                    </View>
                    <View style={styles.analyticsTopCategoryProgress}>
                      <View style={[styles.analyticsTopCategoryTrack, { backgroundColor: palette.muted }]}>
                        <View style={[styles.analyticsTopCategoryFill, { width: `${percentage}%`, backgroundColor: palette.chart1 }]} />
                      </View>
                      <Text style={[styles.analyticsCategoryPercent, { color: palette.secondaryText }]}>{topIncomePercent(item.amount)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : <EmptyPanel palette={palette} message="Belum ada pemasukan pada periode ini." compact />}
        </Card>
      </View>

      <View style={styles.analyticsSection}>
        <ReportChartCard palette={palette} title="Analisis Pengeluaran" subtitle="Rata-rata, nilai terbesar, dan jumlah transaksi.">
          <View style={styles.analyticsMetricGrid}>
            {[
              ["Rata-rata Pengeluaran", formatBudgetMoney(averageExpense)],
              ["Pengeluaran Terbesar", formatBudgetMoney(largestExpense)],
              ["Rata-rata Transaksi", formatBudgetMoney(averageTransaction)],
              ["Jumlah Transaksi", String(analyticsData?.spending.totalTransactions ?? rangeTransactions.length)],
              ["Transaksi Pemasukan", String(incomeCount)],
              ["Transaksi Pengeluaran", String(expenseCount)],
            ].map(([label, value]) => (
              <View key={label} style={styles.analyticsMetricTile}>
                <Text style={[styles.analyticsMetricLabel, { color: palette.secondaryText }]}>{label}</Text>
                <Text style={[styles.analyticsMetricValue, styles.analyticsMetricTileValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
              </View>
            ))}
          </View>
        </ReportChartCard>

        <ReportChartCard palette={palette} title="Kesehatan Keuangan" subtitle="Indikator sederhana dari data transaksi Anda.">
          {analyticsData && analyticsData.overview.transactions > 0 && !analyticsData.health.insufficientData ? (
            <>
              <View style={styles.analyticsHealthHeader}>
                <View><Text style={[styles.analyticsMetricLabel, { color: palette.secondaryText }]}>Skor</Text><Text style={[styles.analyticsHealthScore, { color: palette.text }]}>{healthScore}</Text></View>
                <Text style={[styles.analyticsHealthStatus, { color: healthScore >= 66 ? palette.incomeAmount : healthScore >= 33 ? "#D97706" : palette.expenseAmount, backgroundColor: healthScore >= 66 ? `${palette.incomeAmount}1A` : healthScore >= 33 ? `${palette.warning}1A` : `${palette.expenseAmount}1A` }]}>{healthScore >= 66 ? "Sehat" : healthScore >= 33 ? "Cukup" : "Perlu perhatian"}</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: palette.muted, marginTop: 10 }]}><View style={[styles.progressFill, { width: `${healthScore}%`, backgroundColor: healthScore >= 66 ? palette.incomeAmount : healthScore >= 33 ? "#D97706" : palette.expenseAmount }]} /></View>
              <View style={styles.analyticsHealthRiskRow}>
                <Text style={[styles.analyticsMetricLabel, { color: palette.secondaryText }]}>Risiko</Text>
                <Text style={[styles.analyticsMetricValue, { color: palette.text }]}>{healthScore}/100</Text>
              </View>
              {[
                ["Saving Rate", `${savingRate.toFixed(1)}%`],
                ["Rasio Pengeluaran", `${expenseRatio.toFixed(1)}%`],
                ["Pemasukan vs Pengeluaran", incomeVsExpense != null ? `${incomeVsExpense.toFixed(2)}x` : "Belum tersedia"],
                ["Konsentrasi Pengeluaran", `${concentration.toFixed(1)}%`],
                ["Arus Kas Bersih", formatBudgetMoney(netCashFlow, true)],
              ].map(([label, value]) => (
                <View key={label} style={styles.analyticsHealthRow}>
                  <Text style={[styles.analyticsMetricLabel, { color: palette.secondaryText }]}>{label}</Text>
                  <Text style={[styles.analyticsMetricValue, { color: palette.text }]}>{value}</Text>
                </View>
              ))}
            </>
          ) : <EmptyPanel palette={palette} message="Belum cukup data untuk menilai kesehatan keuangan." compact />}
        </ReportChartCard>
      </View>

      <ReportChartCard palette={palette} title="Wawasan" subtitle="Wawasan dari data keuangan Anda.">
        {insights.length ? insights.map((insight) => (
          <View key={insight} style={styles.analyticsInsightRow}>
            <MaterialCommunityIcons name="lightbulb-outline" size={18} color={palette.accent} />
            <Text style={[styles.analyticsInsightText, { color: palette.text }]}>{translateMobileText(insight, language)}</Text>
          </View>
        )) : <EmptyPanel palette={palette} message="Belum ada wawasan untuk periode ini." compact />}
      </ReportChartCard>
      </>

      <ChartDetailModal selection={chartSelection} palette={palette} onClose={() => setChartSelection(null)} />

      <Modal visible={periodModalOpen} transparent animationType="fade" onRequestClose={() => { setOpenDateField(null); setPeriodModalOpen(false); }}>
        <View style={styles.reportModalBackdrop}>
          <View style={[styles.reportPeriodModal, { backgroundColor: palette.card, borderColor: palette.border, maxHeight: "85%", width: Math.min(Math.max(0, width - 32), 512) }]}>
            <View style={styles.reportModalHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Pilih Periode</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Tutup pemilih periode" onPress={() => setPeriodModalOpen(false)} style={styles.reportModalClose}><MaterialCommunityIcons name="close" size={22} color={palette.secondaryText} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 370 }} keyboardShouldPersistTaps="handled">
              {reportPeriodOptions.map((option) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: period === option.key }}
                  key={option.key}
                  onPress={() => applyPeriod(option.key)}
                  style={[styles.reportPeriodOption, { borderColor: palette.border }]}
                >
                  <Text style={[styles.selectText, { color: palette.text }]}>{option.label}</Text>
                  {period === option.key && <MaterialCommunityIcons name="check" size={19} color={palette.accent} />}
                </Pressable>
              ))}
              {period === "custom" && (
                <View style={styles.reportCustomRange}>
                  <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Tanggal mulai</Text>
                  <NativeCalendarPicker
                    label="Tanggal mulai"
                    value={draftStart}
                    palette={palette}
                    active={periodModalOpen && period === "custom" && openDateField === "start"}
                    onOpenChange={(open) => setOpenDateField(open ? "start" : null)}
                    onChange={setDraftStart}
                    allowClear={false}
                    triggerStyle={[styles.reportDateInput, { backgroundColor: palette.input }]}
                  />
                  <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Tanggal akhir</Text>
                  <NativeCalendarPicker
                    label="Tanggal akhir"
                    value={draftEnd}
                    palette={palette}
                    active={periodModalOpen && period === "custom" && openDateField === "end"}
                    onOpenChange={(open) => setOpenDateField(open ? "end" : null)}
                    onChange={setDraftEnd}
                    allowClear={false}
                    triggerStyle={[styles.reportDateInput, { backgroundColor: palette.input }]}
                  />
                  <Pressable accessibilityRole="button" onPress={applyCustomRange} style={[styles.reportApplyButton, { backgroundColor: palette.accent }]}>
                    <Text style={[styles.reportApplyText, { color: palette.accentText }]}>Terapkan Periode</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function AnalysisPage({ route, palette, userId }: { route: "analytics" | "forecast"; palette: Palette; userId: string }) {
  const copy = route === "analytics"
    ? ["Analitik Keuangan", "Wawasan mendalam atas performa keuangan Anda."]
    : ["Perkiraan Keuangan", "Gambaran ke depan untuk pemasukan, pengeluaran, dan saldo yang diproyeksikan."];
  if (route === "forecast") {
    return <ForecastPageNative palette={palette} title={copy[0]} description={copy[1]} userId={userId} />;
  }
  return <AnalyticsPageNative palette={palette} userId={userId} />;
}

function ForecastPageNative({ palette, title, description, userId }: { palette: Palette; title: string; description: string; userId: string }) {
  const { financeRevision } = useDemoTransactions();
  const { width } = useWindowDimensions();
  const [horizon, setHorizon] = useState(3);
  const [horizonModalOpen, setHorizonModalOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [forecastState, setForecastState] = useState<{
    key: string;
    data: NativeForecastPageData | null;
    error: string | null;
  } | null>(null);
  const forecastSnapshotKey = `${userId}:${horizon}:${financeRevision}`;
  const forecastData = forecastState?.key === forecastSnapshotKey
    ? forecastState.data
    : forecastSnapshots.get(forecastSnapshotKey) ?? null;
  const forecastError = forecastState?.key === forecastSnapshotKey ? forecastState.error : null;
  const forecast = forecastData?.forecast ?? null;
  const spendingPrediction = forecastData?.spendingPrediction ?? null;
  const horizonOptions = [1, 2, 3, 4, 5, 6];
  useEffect(() => {
    let active = true;
    const loadForecast = async () => {
      const [forecastResponse, spendingResponse] = await Promise.all([
        financeApi.getForecast(horizon),
        financeApi.getSpendingPrediction(horizon),
      ]);
      const values = [
        ...forecastResponse.months.flatMap((item) => [
          item.projectedIncomeCents,
          item.projectedExpenseCents,
          item.projectedNetCashflowCents,
          item.projectedEndingBalanceCents,
        ]),
        spendingResponse.predictedTotalCents,
        spendingResponse.otherCents,
        ...spendingResponse.categories.map((item) => item.predictedAmountCents),
      ];
      if (values.some((value) => !Number.isFinite(Number(value)))) {
        throw new Error("The server returned invalid forecast values.");
      }
      if (!active) return;
      const data = { forecast: forecastResponse, spendingPrediction: spendingResponse };
      forecastSnapshots.set(forecastSnapshotKey, data);
      setForecastState({ key: forecastSnapshotKey, data, error: null });
    };
    void Promise.resolve().then(loadForecast).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "Silakan coba lagi.";
      console.error("Failed to load native financial forecast.", error);
      setForecastState({
        key: forecastSnapshotKey,
        data: forecastSnapshots.get(forecastSnapshotKey) ?? null,
        error: message,
      });
    });
    return () => { active = false; };
  }, [forecastSnapshotKey, horizon, retryCount]);
  const predictedTotal = Number(spendingPrediction?.predictedTotalCents ?? 0);
  const otherAmount = Number(spendingPrediction?.otherCents ?? 0);
  const confidence = spendingPrediction?.confidence ?? 0;
  const confidenceLabel = confidence >= 0.75
    ? "Tinggi"
    : confidence >= 0.5 ? "Sedang" : "Rendah";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PageHeader palette={palette} title={title} description={description} />
      <FinanceDataState palette={palette} loading={false} error={forecastError} onRetry={() => setRetryCount((count) => count + 1)} />

      <Card palette={palette} style={styles.forecastSelector}>
        <Text style={[styles.forecastLabel, { color: palette.text }]}>Jangka waktu perkiraan</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pilih jangka waktu perkiraan. Saat ini ${horizon} bulan`}
          accessibilityState={{ expanded: horizonModalOpen }}
          onPress={() => setHorizonModalOpen(true)}
          style={[styles.forecastSelectButton, { backgroundColor: palette.input, borderColor: palette.border }]}
        >
          <Text style={[styles.selectText, { color: palette.text }]}>{horizon} bulan</Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={palette.secondaryText} />
        </Pressable>
      </Card>

      {forecast ? forecast.insufficientData || !forecast.months.length ? (
        <Card palette={palette} style={styles.forecastEmpty}>
          <View style={styles.forecastEmptyContent} accessibilityRole="text">
            <Text style={[styles.forecastEmptyTitle, { color: palette.text }]}>Belum cukup data untuk membuat perkiraan keuangan.</Text>
            <Text style={[styles.forecastEmptyDescription, { color: palette.secondaryText }]}>Tambah riwayat transaksi untuk membuka perkiraan yang lebih lengkap.</Text>
          </View>
        </Card>
      ) : (
        <Card palette={palette} style={styles.forecastSpendingCard}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Proyeksi arus kas</Text>
          {forecast.months.map((month) => (
            <View key={month.period} style={[styles.forecastCategoryRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.forecastCategoryCopy}>
                <Text style={[styles.forecastCategoryName, { color: palette.text }]}>{month.period}</Text>
                <Text style={[styles.forecastMetricLabel, { color: palette.secondaryText }]}>
                  Masuk {formatBudgetMoney(Number(month.projectedIncomeCents))} · Keluar {formatBudgetMoney(Number(month.projectedExpenseCents))}
                </Text>
              </View>
              <Text style={[styles.forecastCategoryAmount, { color: palette.text }]}>
                {formatBudgetMoney(Number(month.projectedEndingBalanceCents))}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {spendingPrediction ? <Card palette={palette} style={styles.forecastSpendingCard}>
        <View style={styles.forecastSpendingHeader}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Prediksi pengeluaran</Text>
          <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Pratinjau pengeluaran Anda berdasarkan kategori.</Text>
          <Text style={[styles.forecastDataNote, { color: palette.secondaryText }]}>Bersumber dari analisis backend akun Anda.</Text>
        </View>
        <View style={[styles.forecastPeriodBadge, { backgroundColor: palette.muted, borderColor: palette.border }]}>
          <Text style={[styles.forecastPeriodText, { color: palette.secondaryText }]}>
            {spendingPrediction?.period
              ? `Periode prediksi: ${spendingPrediction.period}`
              : "Periode prediksi belum tersedia."}
          </Text>
        </View>
        {predictedTotal > 0 ? (
          <>
            <View style={[styles.forecastMetricCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.forecastMetricLabel, { color: palette.secondaryText }]}>Total pengeluaran yang diprediksi</Text>
              <Text style={[styles.forecastTotal, { color: palette.text }]}>{formatBudgetMoney(predictedTotal)}</Text>
              <View style={styles.forecastConfidenceRow}>
                <View style={[styles.forecastConfidenceBadge, { backgroundColor: palette.muted, borderColor: palette.expenseAmount }]}>
                  <Text style={[styles.forecastConfidenceText, { color: palette.expenseAmount }]}>{confidenceLabel} · {Math.round(confidence * 100)}%</Text>
                </View>
                <Text style={[styles.forecastMetricLabel, { color: palette.secondaryText }]}>Kepercayaan: {Math.round(confidence * 100)}%</Text>
              </View>
            </View>
            {otherAmount > 0 && (
              <View style={[styles.forecastMetricCard, { backgroundColor: palette.muted, borderColor: palette.border }]}>
                <Text style={[styles.forecastMetricLabel, { color: palette.secondaryText }]}>Pengeluaran lain</Text>
                <Text style={[styles.forecastOtherTotal, { color: palette.text }]}>{formatBudgetMoney(otherAmount)}</Text>
              </View>
            )}
            <View style={styles.forecastBreakdown}>
              <Text style={[styles.forecastBreakdownTitle, { color: palette.text }]}>Rincian kategori</Text>
              {spendingPrediction?.categories.length ? spendingPrediction.categories.map((item) => (
                <View key={item.categoryId} style={[styles.forecastCategoryRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.forecastCategoryCopy}>
                    <RawText style={[styles.forecastCategoryName, { color: palette.text }]}>{item.categoryName}</RawText>
                    <Text style={[styles.forecastMetricLabel, { color: palette.secondaryText }]}>{item.basedOnMonths} bulan riwayat</Text>
                  </View>
                  <Text style={[styles.forecastCategoryAmount, { color: palette.text }]}>{formatBudgetMoney(Number(item.predictedAmountCents))}</Text>
                </View>
              )) : (
                <View accessibilityRole="text" style={[styles.forecastCategoryEmpty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.forecastEmptyTitle, { color: palette.text }]}>Belum ada rincian kategori.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View accessibilityRole="text" style={styles.forecastSpendingEmpty}>
            <Text style={[styles.forecastEmptyTitle, { color: palette.text }]}>Belum ada prediksi pengeluaran.</Text>
            <Text style={[styles.forecastEmptyDescription, { color: palette.secondaryText }]}>Tambah riwayat transaksi untuk menghasilkan pratinjau kategori berbasis kepercayaan.</Text>
          </View>
        )}
      </Card> : null}

      <Modal visible={horizonModalOpen} transparent animationType="fade" onRequestClose={() => setHorizonModalOpen(false)}>
        <View style={styles.reportModalBackdrop}>
          <View style={[styles.reportPeriodModal, { backgroundColor: palette.card, borderColor: palette.border, maxHeight: "85%", width: Math.min(Math.max(0, width - 32), 512) }]}>
            <View style={styles.reportModalHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Jangka waktu perkiraan</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup pemilih jangka waktu"
                onPress={() => setHorizonModalOpen(false)}
                style={styles.reportModalClose}
              >
                <MaterialCommunityIcons name="close" size={22} color={palette.secondaryText} />
              </Pressable>
            </View>
            {horizonOptions.map((option) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: horizon === option }}
                key={option}
                onPress={() => {
                  setHorizon(option);
                  setHorizonModalOpen(false);
                }}
                style={[styles.reportPeriodOption, { borderColor: palette.border }]}
              >
                <Text style={[styles.selectText, { color: palette.text }]}>{option} bulan</Text>
                {horizon === option && <MaterialCommunityIcons name="check" size={19} color={palette.accent} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function ActivityPage({ route, palette }: { route: RouteKey; palette: Palette }) {
  const context = useDemoTransactions();
  const language = useContext(MobileLanguageContext);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const isNotificationsPage = route === "notifications";
  const filteredNotifications = useMemo(
    () => context.notifications.filter((item) => filter === "all" || !item.isRead),
    [context.notifications, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredNotifications.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = filteredNotifications.length ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, filteredNotifications.length);
  const setNotificationFilter = (value: string) => {
    setFilter(value as "all" | "unread");
    setPage(1);
  };
  const setNotificationPageSize = (value: string | number) => {
    setPageSize(Number(value));
    setPage(1);
  };
  const renderNotification = useCallback(({ item }: { item: DemoNotification }) => (
    <NotificationCard
      item={item}
      palette={palette}
      language={language}
      onMarkRead={() => context.markNotificationRead(item.id)}
      onDelete={() => context.removeNotification(item.id)}
    />
  ), [context, language, palette]);

  if (!isNotificationsPage) {
    return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PageHeader palette={palette} title="Log Aktivitas" description="Sesi aktif pada setiap perangkat." />
      <Card palette={palette} style={styles.listCard}>
        <EmptyPanel palette={palette} message="Belum ada sesi perangkat." compact />
      </Card>
    </ScrollView>;
  }

  if (context.notificationError && context.notifications.length === 0) {
    return <ScrollView style={styles.scroll} contentContainerStyle={styles.notificationContent} showsVerticalScrollIndicator={false}>
      <PageHeader palette={palette} title="Notifikasi" description="Pemberitahuan dan aktivitas akun Anda." />
      <View accessibilityRole="alert" style={[styles.notificationEmpty, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={30} color={palette.expenseAmount} />
        <Text style={[styles.notificationEmptyTitle, { color: palette.text }]}>Gagal memuat notifikasi.</Text>
        <Text style={[styles.cardSubtitle, styles.notificationEmptyDescription, { color: palette.secondaryText }]}>Terjadi kesalahan yang tidak terduga.</Text>
        <Pressable accessibilityRole="button" onPress={() => { void context.retryNotificationLoad(); }} style={[styles.notificationRetryButton, { backgroundColor: palette.accent }]}>
          <Text style={{ color: palette.accentText, fontWeight: "700" }}>Coba lagi</Text>
        </Pressable>
      </View>
    </ScrollView>;
  }

  const notificationHeader = (
    <View>
      <PageHeader palette={palette} title="Notifikasi" description="Pemberitahuan dan aktivitas akun Anda." />
      {context.notificationError && <View style={[styles.notificationSyncWarning, { backgroundColor: palette.muted, borderColor: palette.border }]}>
        <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Daftar tersimpan lokal. Sinkronisasi server belum selesai.</Text>
        <Pressable accessibilityRole="button" onPress={() => { void context.retryNotificationLoad(); }}>
          <Text style={[styles.notificationActionText, { color: palette.accent }]}>Coba lagi</Text>
        </Pressable>
      </View>}
      <View style={styles.notificationToolbar}>
        <View style={styles.notificationFilter}>
          <NativeSelect
            label="Filter notifikasi"
            value={filter}
            options={[{ value: "all", label: "Semua" }, { value: "unread", label: "Belum dibaca" }]}
            palette={palette}
            onChange={setNotificationFilter}
          />
        </View>
        <View style={styles.notificationActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tandai semua dibaca"
            disabled={!context.notifications.some((item) => !item.isRead)}
            onPress={context.markAllNotificationsRead}
            style={[styles.notificationActionButton, { backgroundColor: palette.muted, opacity: context.notifications.some((item) => !item.isRead) ? 1 : 0.5 }]}
          >
            <MaterialCommunityIcons name="check-all" size={17} color={palette.text} />
            <Text style={[styles.notificationActionText, { color: palette.text }]}>Tandai semua dibaca</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hapus Semua"
            disabled={!context.notifications.length}
            onPress={context.removeAllNotifications}
            style={[styles.notificationActionButton, { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, opacity: context.notifications.length ? 1 : 0.5 }]}
          >
            <MaterialCommunityIcons name="delete-outline" size={17} color={palette.expenseAmount} />
            <Text style={[styles.notificationActionText, { color: palette.expenseAmount }]}>Hapus Semua</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
  const notificationFooter = filteredNotifications.length > 0 ? (
    <View style={styles.notificationPagination}>
      <View style={styles.notificationPageSize}>
        <Text style={[styles.notificationMeta, { color: palette.secondaryText }]}>Baris per halaman</Text>
        <View style={styles.notificationPageSizeSelect}>
          <NativeSelect
            label="Baris per halaman"
            value={pageSize}
            options={[10, 20, 50].map((size) => ({ value: size, label: String(size) }))}
            palette={palette}
            onChange={setNotificationPageSize}
          />
        </View>
      </View>
      <Text style={[styles.notificationMeta, { color: palette.secondaryText }]}>
        Menampilkan {startIndex}–{endIndex} dari {filteredNotifications.length}
      </Text>
      <View style={styles.notificationPageControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sebelumnya"
          disabled={currentPage <= 1}
          onPress={() => setPage((value) => Math.max(1, value - 1))}
          style={[styles.transactionPageNavButton, { borderColor: palette.border, opacity: currentPage <= 1 ? 0.45 : 1 }]}
        >
          <MaterialCommunityIcons name="chevron-left" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.notificationMeta, { color: palette.secondaryText }]}>{currentPage} / {totalPages}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Berikutnya"
          disabled={currentPage >= totalPages}
          onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
          style={[styles.transactionPageNavButton, { borderColor: palette.border, opacity: currentPage >= totalPages ? 0.45 : 1 }]}
        >
          <MaterialCommunityIcons name="chevron-right" size={18} color={palette.text} />
        </Pressable>
      </View>
    </View>
  ) : null;

  return <FlatList
    style={styles.scroll}
    contentContainerStyle={styles.notificationContent}
    data={pageItems}
    keyExtractor={(item) => item.id}
    renderItem={renderNotification}
    ListHeaderComponent={notificationHeader}
    ListEmptyComponent={
      <View style={[styles.notificationEmpty, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <MaterialCommunityIcons name="bell-outline" size={30} color={palette.secondaryText} />
        <Text style={[styles.notificationEmptyTitle, { color: palette.text }]}>Belum ada notifikasi.</Text>
        <Text style={[styles.cardSubtitle, styles.notificationEmptyDescription, { color: palette.secondaryText }]}>Notifikasi dan aktivitas akun Anda akan muncul di sini.</Text>
      </View>
    }
    ListFooterComponent={notificationFooter}
    showsVerticalScrollIndicator={false}
  />;
}

function TransactionDetailModal({ transaction, palette, onClose }: {
  transaction: DemoTransaction | null;
  palette: Palette;
  onClose: () => void;
}) {
  const language = useContext(MobileLanguageContext);
  const inputStyle = { backgroundColor: palette.input, borderColor: palette.border, color: palette.text };
  const dateValue = transaction
    ? new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(`${transaction.dateISO}T00:00:00`))
    : "";
  const amountValue = transaction?.amount.replace(/^[+-]\s*/, "").replace(/^Rp\s*/, "") ?? "";

  return <FloatingFormModal
    open={transaction !== null}
    palette={palette}
    title="Detail Transaksi"
    description={transaction?.category ?? ""}
    rawDescription
    onClose={onClose}
    actions={<Pressable accessibilityRole="button" onPress={onClose} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border }]}>
      <Text style={{ color: palette.text, fontWeight: "600" }}>Tutup</Text>
    </Pressable>}
  >
    {transaction && <>
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Tanggal</Text>
      <TextInput accessibilityLabel="Tanggal" editable={false} value={dateValue} style={[styles.fieldInput, styles.floatingModalInput, inputStyle]} />
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Jenis</Text>
      <TextInput accessibilityLabel="Jenis" editable={false} value={translateMobileText(transaction.income ? "Pemasukan" : "Pengeluaran", language)} style={[styles.fieldInput, styles.floatingModalInput, inputStyle]} />
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Kategori</Text>
      <TextInput accessibilityLabel="Kategori" editable={false} value={transaction.category} style={[styles.fieldInput, styles.floatingModalInput, inputStyle]} />
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Nominal</Text>
      <TextInput accessibilityLabel="Nominal" editable={false} value={amountValue} style={[styles.fieldInput, styles.floatingModalInput, inputStyle]} />
      <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>Catatan</Text>
      <TextInput accessibilityLabel="Catatan" editable={false} value={transaction.note} multiline style={[styles.fieldInput, styles.floatingModalInput, styles.noteInput, inputStyle]} />
    </>}
  </FloatingFormModal>;
}

const NotificationCard = memo(function NotificationCard({ item, palette, language, onMarkRead, onDelete }: {
  item: DemoNotification;
  palette: Palette;
  language: MobileLanguage;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const notificationTime = formatNotificationRelativeTime(item.createdAt, language);

  return <View style={[styles.notificationCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
    <View style={[styles.notificationIcon, { backgroundColor: palette.muted }]}>
      <MaterialCommunityIcons name="receipt-text-outline" size={18} color={palette.accent} />
    </View>
    <View style={styles.notificationCopy}>
      <View style={styles.notificationTitleRow}>
        <Text style={[styles.notificationTitle, { color: palette.text }]}>{item.title}</Text>
        {!item.isRead && <Text style={[styles.notificationUnread, { backgroundColor: palette.muted, color: palette.text }]}>Belum dibaca</Text>}
      </View>
      <RawText style={[styles.notificationMessage, { color: palette.secondaryText }]}>{item.message}</RawText>
      <Text style={[styles.notificationTime, { color: palette.secondaryText }]}>{notificationTime}</Text>
    </View>
    <View style={styles.notificationItemActions}>
      {!item.isRead && <Pressable accessibilityRole="button" accessibilityLabel={`Tandai dibaca: ${item.title}`} onPress={onMarkRead} style={styles.notificationIconButton}>
        <MaterialCommunityIcons name="check" size={18} color={palette.text} />
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Hapus: ${item.title}`} onPress={onDelete} style={styles.notificationIconButton}>
        <MaterialCommunityIcons name="delete-outline" size={18} color={palette.expenseAmount} />
      </Pressable>
    </View>
  </View>;
});

function AccountPage({ route, palette, onThemeChange, language, onLanguageChange, user, onUserChange, onLogout, onAccountDeleted, logoutLoading, userSettings, onSettingsChange, pushEnabled, pushError, onPushEnabledChange, pushSaving }: { route: RouteKey; palette: Palette; onThemeChange: (dark: boolean) => void; language: MobileLanguage; onLanguageChange: (language: MobileLanguage) => Promise<void>; user: AuthUser; onUserChange: (user: AuthUser) => void; onLogout: () => Promise<void>; onAccountDeleted: () => Promise<void>; logoutLoading: boolean; userSettings: NativeUserSettings | null; onSettingsChange: (patch: NativeSettingsPatch) => Promise<boolean>; pushEnabled: boolean; pushError: string | null; onPushEnabledChange: (enabled: boolean) => Promise<boolean>; pushSaving: boolean }) {
  const [nameDraft, setNameDraft] = useState(user.full_name);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const saveProfileName = async () => {
    const fullName = nameDraft.trim();
    if (fullName.length < 2 || fullName.length > 100) {
      setProfileError(language === "en" ? "Name must be between 2 and 100 characters." : "Nama harus terdiri dari 2 sampai 100 karakter.");
      return;
    }

    setSavingName(true);
    setProfileError(null);
    try {
      const response = await authApi.updateProfile(fullName);
      if (!response.success || !response.data) {
        throw new Error(response.message || (language === "en" ? "Profile could not be updated." : "Profil tidak dapat diperbarui."));
      }
      onUserChange(response.data);
      setNameDraft(response.data.full_name);
      setEditingName(false);
    } catch (error) {
      console.error("Failed to update the native profile name.", error);
      setProfileError(error instanceof Error ? error.message : (language === "en" ? "Profile could not be updated. Try again." : "Profil tidak dapat diperbarui. Coba lagi."));
    } finally {
      setSavingName(false);
    }
  };

  if (route === "profile") return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <PageHeader palette={palette} title="Profil" description="Informasi akun Anda." />
      <Card palette={palette} style={styles.profileCard}>
        <View style={styles.profileHeading}>
          <View style={styles.profileIcon}>
            <MaterialCommunityIcons name="account-outline" size={22} color={palette.accent} />
          </View>
          <View style={styles.profileHeadingCopy}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Profil</Text>
            <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Informasi akun Anda.</Text>
          </View>
        </View>
        <View style={styles.profileFields}>
          <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Nama</Text>
          {editingName ? (
            <>
              <TextInput
                accessibilityLabel={language === "en" ? "Profile name" : "Nama profil"}
                autoCapitalize="words"
                editable={!savingName}
                maxLength={100}
                onChangeText={(value) => {
                  setNameDraft(value);
                  setProfileError(null);
                }}
                returnKeyType="done"
                onSubmitEditing={() => { void saveProfileName(); }}
                value={nameDraft}
                style={[styles.settingsTextInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
              />
              <View style={styles.profileEditActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingName}
                  onPress={() => { void saveProfileName(); }}
                  style={[styles.profileEditButton, { backgroundColor: palette.accent, opacity: savingName ? 0.6 : 1 }]}
                >
                  <Text style={[styles.profileEditButtonText, { color: palette.accentText }]}>
                    {savingName ? (language === "en" ? "Saving..." : "Menyimpan...") : (language === "en" ? "Save name" : "Simpan nama")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingName}
                  onPress={() => {
                    setNameDraft(user.full_name);
                    setProfileError(null);
                    setEditingName(false);
                  }}
                  style={[styles.profileEditButton, { borderColor: palette.border, borderWidth: 1, opacity: savingName ? 0.6 : 1 }]}
                >
                  <Text style={[styles.profileEditButtonText, { color: palette.text }]}>{language === "en" ? "Cancel" : "Batal"}</Text>
                </Pressable>
              </View>
              {profileError && <Text accessibilityRole="alert" style={[styles.profileFeedback, { color: palette.expenseAmount }]}>{profileError}</Text>}
            </>
          ) : (
            <View style={styles.inlineValue}>
              <Text style={[styles.fieldValue, styles.profileNameValue, { color: palette.text }]}>{user.full_name || user.username}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={language === "en" ? "Edit profile name" : "Ubah nama profil"}
                onPress={() => {
                  setNameDraft(user.full_name);
                  setProfileError(null);
                  setEditingName(true);
                }}
                style={[styles.profileEditIconButton, { borderColor: palette.border }]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={palette.accent} />
              </Pressable>
            </View>
          )}
          <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Email</Text>
          <View style={styles.inlineValue}>
            <MaterialCommunityIcons name="email-outline" size={18} color={palette.secondaryText} />
            <Text style={[styles.fieldValue, { color: palette.text }]}>{user.email}</Text>
          </View>
        </View>
      </Card>
      <LogoutAction palette={palette} language={language} onLogout={onLogout} loading={logoutLoading} />
    </ScrollView>
  );
  return <SettingsPage palette={palette} onThemeChange={onThemeChange} language={language} onLanguageChange={onLanguageChange} user={user} onLogout={onLogout} onAccountDeleted={onAccountDeleted} logoutLoading={logoutLoading} userSettings={userSettings} onSettingsChange={onSettingsChange} pushEnabled={pushEnabled} pushError={pushError} onPushEnabledChange={onPushEnabledChange} pushSaving={pushSaving} />;
}

function LogoutAction({ palette, language, onLogout, loading }: { palette: Palette; language: MobileLanguage; onLogout: () => Promise<void>; loading: boolean }) {
  const label = loading
    ? language === "en" ? "Signing out..." : "Keluar..."
    : translateMobileText("Keluar", language);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={() => void onLogout()}
      style={[styles.profileLogoutAction, { opacity: loading ? 0.6 : 1 }]}
    >
      <MaterialCommunityIcons name="logout" size={20} color={palette.expenseAmount} />
      <Text style={[styles.profileLogoutText, { color: palette.expenseAmount }]}>{label}</Text>
    </Pressable>
  );
}

type NativeSettingsTab = "Umum" | "Akun" | "Finance Bot" | "Notifikasi" | "Tentang";
const settingsTabs: { label: NativeSettingsTab; icon: keyof typeof MaterialCommunityIcons.glyphMap; summary: string }[] = [
  { label: "Umum", icon: "palette-outline", summary: "Tampilan, tema, bahasa, preferensi aplikasi" },
  { label: "Akun", icon: "account-outline", summary: "Profil, email, sesi aktif, keamanan" },
  { label: "Finance Bot", icon: "robot-outline", summary: "Bot, anggaran, peringatan, pengingat" },
  { label: "Notifikasi", icon: "bell-outline", summary: "Transaksi, anggaran, target, akun, sistem" },
  { label: "Tentang", icon: "wallet-outline", summary: "Informasi versi aplikasi" },
];

function sessionIdFromAccessToken(token: string): string | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as {
      sessionId?: unknown;
    };
    return typeof payload.sessionId === "string" ? payload.sessionId : null;
  } catch {
    return null;
  }
}

function formatSessionDate(value: string, language: MobileLanguage) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const SessionRow = memo(function SessionRow({ item, palette, language, current, canRevoke, onRevoke }: {
  item: NativeSession;
  palette: Palette;
  language: MobileLanguage;
  current: boolean;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  const deviceName = item.device_name?.trim();
  const deviceParts = [item.operating_system, item.browser]
    .filter((value): value is string => Boolean(value?.trim()) && value?.toLowerCase() !== "unknown");
  const device = (deviceName && deviceName.toLowerCase() !== "unknown" ? deviceName : null)
    || deviceParts.join(" · ")
    || translateMobileText("Perangkat tidak diketahui", language);
  const location = [item.city, item.country].filter(Boolean).join(", ")
    || translateMobileText("Lokasi tidak diketahui", language);
  const lastActive = item.last_activity_at || item.updated_at;

  return (
    <View style={[styles.sessionRow, { borderColor: palette.border }]}>
      <View style={styles.sessionDetails}>
        <View style={styles.sessionDeviceHeading}>
          <Text style={[styles.settingsChoiceText, styles.sessionDeviceName, { color: palette.text }]}>{device}</Text>
          {current && (
            <View style={[styles.sessionCurrentBadge, { borderColor: palette.border, backgroundColor: palette.muted }]}>
              <Text style={[styles.sessionCurrentText, { color: palette.text }]}>{translateMobileText("Perangkat ini", language)}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.settingsAccountLabel, { color: palette.secondaryText }]}>{location}</Text>
        <Text style={[styles.settingsAccountLabel, { color: palette.secondaryText }]}>
          {translateMobileText("Aktif", language)}: {formatSessionDate(lastActive, language)}
        </Text>
        {canRevoke && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${translateMobileText("Keluarkan", language)}: ${device}`}
            onPress={onRevoke}
            style={[styles.sessionRevokeButton, { borderColor: palette.border }]}
          >
            <MaterialCommunityIcons name="logout" size={16} color={palette.expenseAmount} />
            <Text style={[styles.sessionRevokeText, { color: palette.expenseAmount }]}>{translateMobileText("Keluarkan", language)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function SettingsPage({ palette, onThemeChange, language, onLanguageChange, user, onLogout, onAccountDeleted, logoutLoading, userSettings, onSettingsChange, pushEnabled, pushError, onPushEnabledChange, pushSaving }: { palette: Palette; onThemeChange: (dark: boolean) => void; language: MobileLanguage; onLanguageChange: (language: MobileLanguage) => Promise<void>; user: AuthUser; onLogout: () => Promise<void>; onAccountDeleted: () => Promise<void>; logoutLoading: boolean; userSettings: NativeUserSettings | null; onSettingsChange: (patch: NativeSettingsPatch) => Promise<boolean>; pushEnabled: boolean; pushError: string | null; onPushEnabledChange: (enabled: boolean) => Promise<boolean>; pushSaving: boolean }) {
  const [tab, setTab] = useState<NativeSettingsTab>("Umum");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<NativeSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionDialog, setSessionDialog] = useState<SessionDialogState | null>(null);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const settingsScrollRef = useRef<ScrollView>(null);
  const settingsScrollOffsetRef = useRef(0);
  const languageCardRef = useRef<View>(null);
  const languageAnchorRef = useRef<{ screenY: number; scrollY: number } | null>(null);
  const previousLanguageRef = useRef(language);
  useLayoutEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;

    const anchor = languageAnchorRef.current;
    const card = languageCardRef.current;
    languageAnchorRef.current = null;
    if (!anchor || !card || Math.abs(settingsScrollOffsetRef.current - anchor.scrollY) > 1) return;

    card.measureInWindow((_x, screenY) => {
      const offset = Math.max(0, settingsScrollOffsetRef.current + screenY - anchor.screenY);
      settingsScrollRef.current?.scrollTo({ y: offset, animated: false });
      settingsScrollOffsetRef.current = offset;
    });
  }, [language]);
  const isDark = palette.background === themes.dark.background;
  const navigationColors = {
    surface: isDark ? "#171717" : "#FFFFFF",
    selected: isDark ? "#171717" : palette.muted,
    unselected: isDark ? "#0A0A0A" : palette.background,
    selectedIcon: isDark ? "rgba(178, 213, 229, 0.1)" : "rgba(10, 108, 186, 0.1)",
    unselectedIcon: isDark ? "#171717" : palette.muted,
    selectedBorder: isDark ? "rgba(178, 213, 229, 0.4)" : "rgba(10, 108, 186, 0.4)",
  };
  const financeBot = userSettings?.notification_preferences.financeBot ?? {
    enabled: false,
    personality: "SANTAI" as const,
    budgetThreshold: 80,
    dailyReminderEnabled: true,
    reminderTime1: "20:00",
    reminderTime2: "22:00",
  };
  const botEnabled = financeBot.enabled;
  const personalityLabels: Record<typeof financeBot.personality, string> = {
    SANTAI: "Santai",
    TEGAS: "Tegas",
    SAVAGE: "Savage",
    CUSTOM: "Kustom",
  };
  const budgetThreshold = financeBot.budgetThreshold ?? 80;
  const dailyReminder = financeBot.dailyReminderEnabled ?? true;
  const reminderTime1 = financeBot.reminderTime1 ?? "20:00";
  const reminderTime2 = financeBot.reminderTime2 ?? "22:00";
  const notifications = {
    Transaksi: userSettings?.notification_preferences.transactions ?? true,
    Anggaran: userSettings?.notification_preferences.budgets ?? true,
    "Target Tabungan": userSettings?.notification_preferences.savingGoals ?? true,
    Akun: userSettings?.notification_preferences.accounts ?? true,
    Investasi: userSettings?.notification_preferences.investments ?? true,
    Sistem: userSettings?.notification_preferences.system ?? true,
  };
  const filteredTabs = settingsTabs.filter((item) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const searchText = [
      item.label,
      item.summary,
      translateMobileText(item.label, language),
      translateMobileText(item.summary, language),
    ].join(" ").toLocaleLowerCase();
    return !normalizedQuery || searchText.includes(normalizedQuery);
  });
  const activeTab = filteredTabs.some((item) => item.label === tab) ? tab : filteredTabs[0]?.label;

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(false);
    try {
      const tokens = await readAuthTokens();
      const currentId = tokens?.accessToken
        ? sessionIdFromAccessToken(tokens.accessToken)
        : null;
      const result = await sessionApi.list();
      setCurrentSessionId(currentId);
      setSessions(result);
    } catch (error) {
      console.error("Failed to load native active sessions.", error);
      setSessionsError(true);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "Akun") return;
    const timer = setTimeout(() => void loadSessions(), 0);
    return () => clearTimeout(timer);
  }, [loadSessions, tab]);

  const revokeSession = useCallback((session: NativeSession) => {
    if (session.id === currentSessionId) return;
    const deviceName = session.device_name?.trim();
    const deviceParts = [session.operating_system, session.browser]
      .filter((value): value is string => Boolean(value?.trim()) && value?.toLowerCase() !== "unknown");
    const device = (deviceName && deviceName.toLowerCase() !== "unknown" ? deviceName : null)
      || deviceParts.join(" · ")
      || translateMobileText("Perangkat tidak diketahui", language);
    setSessionDialog({ kind: "single", session, device });
  }, [currentSessionId, language]);

  const revokeOtherSessions = useCallback(() => {
    setSessionDialog({ kind: "others" });
  }, []);

  const closeSessionDialog = useCallback(() => {
    if (!sessionActionLoading) setSessionDialog(null);
  }, [sessionActionLoading]);

  const confirmSessionAction = useCallback(async () => {
    if (!sessionDialog) return;
    if (sessionDialog.kind === "error") {
      setSessionDialog(null);
      return;
    }

    setSessionActionLoading(true);
    try {
      const response = sessionDialog.kind === "single"
        ? await sessionApi.revoke(sessionDialog.session.id)
        : await sessionApi.revokeOthers();
      if (!response.success) throw new Error("Server tidak mengonfirmasi pengeluaran perangkat.");
      setSessionDialog(null);
      await loadSessions();
    } catch (error) {
      console.error("Failed to sign out a native device session.", error);
      setSessionDialog({
        kind: "error",
        title: translateMobileText("Perangkat tidak dapat dikeluarkan.", language),
        description: error instanceof Error ? error.message : translateMobileText("Coba lagi.", language),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }, [language, loadSessions, sessionDialog]);

  const closeDeleteDialog = useCallback(() => {
    if (deletingAccount) return;
    setDeleteDialogOpen(false);
    setDeleteEmail("");
    setDeletePassword("");
    setDeleteError(null);
  }, [deletingAccount]);

  const deleteAccount = useCallback(async () => {
    setDeleteError(null);
    if (!user.email || deleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setDeleteError(translateMobileText("Email konfirmasi tidak cocok dengan akun.", language));
      return;
    }
    const requiresPassword = user.has_manual_password !== false;
    if (requiresPassword && !deletePassword.trim()) {
      setDeleteError(translateMobileText("Masukkan kata sandi saat ini untuk menghapus akun.", language));
      return;
    }

    setDeletingAccount(true);
    try {
      const payload: DeleteAccountPayload = {
        email: deleteEmail.trim(),
        ...(requiresPassword ? { password: deletePassword } : {}),
      };
      const response = await authApi.deleteAccount(payload);
      if (!response.success) {
        throw new Error(translateMobileText("Server tidak mengonfirmasi penghapusan akun.", language));
      }
      await onAccountDeleted();
    } catch (error) {
      console.error("Failed to delete the native account.", error);
      setDeleteError(error instanceof Error
        ? error.message
        : translateMobileText("Akun tidak dapat dihapus. Coba lagi.", language));
    } finally {
      setDeletingAccount(false);
    }
  }, [deleteEmail, deletePassword, language, onAccountDeleted, user.email, user.has_manual_password]);

  const renderSession = useCallback(({ item }: { item: NativeSession }) => (
    <SessionRow
      item={item}
      palette={palette}
      language={language}
      current={item.id === currentSessionId}
      canRevoke={currentSessionId !== null && item.id !== currentSessionId}
      onRevoke={() => revokeSession(item)}
    />
  ), [currentSessionId, language, palette, revokeSession]);

  const renderChoice = (label: string, selected: boolean, onPress: () => void, icon?: keyof typeof MaterialCommunityIcons.glyphMap) => (
    <Pressable
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.settingsChoice, { borderColor: palette.border }]}
    >
      <View style={styles.settingsChoiceLabel}>
        {icon && <MaterialCommunityIcons name={icon} size={17} color={palette.secondaryText} />}
        <Text style={[styles.settingsChoiceText, { color: palette.text }]}>{label}</Text>
      </View>
      <View
        accessible={false}
        style={[
          styles.settingsRadio,
          { borderColor: palette.secondaryText },
        ]}
      >
        <View style={[styles.settingsRadioDot, { backgroundColor: palette.accent, opacity: selected ? 1 : 0 }]} />
      </View>
    </Pressable>
  );

  const sectionHeader = (icon: keyof typeof MaterialCommunityIcons.glyphMap, title: string, subtitle: string) => (
    <View style={styles.settingsSectionHeader}>
      <View style={[styles.settingsSectionIcon, { backgroundColor: palette.muted }]}>
        <MaterialCommunityIcons name={icon} size={18} color={palette.accent} />
      </View>
      <View style={styles.settingsSectionCopy}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{subtitle}</Text>
      </View>
    </View>
  );

  const renderToggle = (label: string, enabled: boolean, onPress: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.settingsToggleRow, { borderColor: palette.border, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.settingsChoiceText, styles.settingsToggleLabel, { color: palette.text }]}>{label}</Text>
      <View style={[styles.settingsSwitch, { backgroundColor: enabled ? palette.accent : palette.muted, borderColor: palette.border }]}>
        <View style={[styles.settingsSwitchThumb, { alignSelf: enabled ? "flex-end" : "flex-start", backgroundColor: enabled ? palette.accentText : palette.secondaryText }]} />
      </View>
    </Pressable>
  );
  const updateFinanceBot = (patch: Partial<typeof financeBot>) => {
    void onSettingsChange({
      notification_preferences: {
        financeBot: { ...financeBot, ...patch },
      },
    });
  };
  const notificationPreferenceKeys = {
    Transaksi: "transactions",
    Anggaran: "budgets",
    "Target Tabungan": "savingGoals",
    Akun: "accounts",
    Investasi: "investments",
    Sistem: "system",
  } as const;

  return (
    <>
    <ScrollView
      ref={settingsScrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.settingsContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => { settingsScrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
    >
      <PageHeader palette={palette} title="Pengaturan" description="Kelola preferensi tampilan, bahasa, dan notifikasi Anda." />

      <Card palette={palette} style={[styles.settingsNavigation, { backgroundColor: navigationColors.surface }]}>
        <View style={[styles.searchBox, styles.settingsSearch, { borderColor: palette.border, backgroundColor: isDark ? "#111111" : "#FFFFFF" }]}>
          <MaterialCommunityIcons name="magnify" size={16} color={palette.secondaryText} />
          <TextInput
            accessibilityLabel="Cari pengaturan"
            value={query}
            onChangeText={setQuery}
            placeholder="Cari pengaturan"
            placeholderTextColor={palette.secondaryText}
            style={[styles.searchInput, styles.settingsSearchInput, { color: palette.text }]}
          />
        </View>
        <View style={styles.settingsNavigationItems}>
          {filteredTabs.length ? filteredTabs.map((item) => {
            const selected = activeTab === item.label;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(item.label)}
                style={[styles.settingsNavigationItem, { backgroundColor: selected ? navigationColors.selected : navigationColors.unselected, borderColor: selected ? navigationColors.selectedBorder : palette.border }]}
              >
                <View style={[styles.settingsNavigationIcon, { backgroundColor: selected ? navigationColors.selectedIcon : navigationColors.unselectedIcon }]}>
                  <MaterialCommunityIcons name={item.icon} size={17} color={selected ? palette.accent : palette.secondaryText} />
                </View>
                <Text style={[styles.settingsNavigationLabel, { color: palette.text }]}>{translateMobileText(item.label, language)}</Text>
              </Pressable>
            );
          }) : (
            <View style={[styles.settingsNoResults, { borderColor: palette.border }]}>
              <Text style={[styles.cardSubtitle, { color: palette.secondaryText, marginTop: 0 }]}>Tidak ada pengaturan yang cocok.</Text>
            </View>
          )}
        </View>
      </Card>

      {activeTab === "Umum" && (
        <View style={styles.settingsPanel}>
          <Text style={[styles.settingsGroupTitle, { color: palette.text }]}>Preferensi Aplikasi</Text>
          <Card palette={palette} style={styles.settingsPreferenceCard}>
            {sectionHeader("palette-outline", "Tampilan", "Pilih tema untuk antarmuka.")}
            <View style={styles.settingsChoiceList}>
              {renderChoice(translateMobileText("Terang", language), palette.background === themes.light.background, () => onThemeChange(false), "white-balance-sunny")}
              {renderChoice(translateMobileText("Gelap", language), palette.background === themes.dark.background, () => onThemeChange(true), "moon-waning-crescent")}
            </View>
          </Card>
          <View ref={languageCardRef}>
            <Card palette={palette} style={styles.settingsPreferenceCard}>
              {sectionHeader("web", "Bahasa", "Pilih bahasa antarmuka.")}
              <View style={styles.settingsChoiceList}>
                {(["id", "en"] as const).map((nextLanguage) => {
                  const selected = language === nextLanguage;
                  const label = nextLanguage === "id" ? "Indonesia" : "English";
                  return (
                    <Pressable
                      key={nextLanguage}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        if (selected) return;
                        const card = languageCardRef.current;
                        if (!card) {
                          void onLanguageChange(nextLanguage);
                          return;
                        }
                        card.measureInWindow((_x, screenY) => {
                          languageAnchorRef.current = { screenY, scrollY: settingsScrollOffsetRef.current };
                          void onLanguageChange(nextLanguage);
                        });
                      }}
                      style={[styles.settingsChoice, { borderColor: palette.border }]}
                    >
                      <View style={styles.settingsChoiceLabel}>
                        <Text style={[styles.settingsChoiceText, { color: palette.text }]}>{label}</Text>
                      </View>
                      <View accessible={false} style={[styles.settingsRadio, { borderColor: palette.secondaryText }]}>
                        <View style={[styles.settingsRadioDot, { backgroundColor: palette.accent, opacity: selected ? 1 : 0 }]} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        </View>
      )}

      {activeTab === "Akun" && (
        <View style={styles.settingsPanel}>
          <View>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Akun</Text>
            <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Kelola profil dan sesi pada akun Anda.</Text>
          </View>
          <Card palette={palette} style={styles.settingsContentCard}>
            {sectionHeader("account-outline", "Profil", "Informasi akun Anda")}
            <View style={styles.settingsAccountDetails}>
              <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Nama</Text>
              <Text style={[styles.fieldValue, { color: palette.text }]}>{user.full_name || user.username}</Text>
              <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>Email</Text>
              <Text style={[styles.fieldValue, { color: palette.text }]}>{user.email}</Text>
            </View>
          </Card>
          <LogoutAction palette={palette} language={language} onLogout={onLogout} loading={logoutLoading} />
          <Card palette={palette} style={styles.settingsContentCard}>
            {sectionHeader("laptop", "Sesi Aktif", "Perangkat yang sedang login dengan akun Anda")}
            {sessionsLoading ? null : sessionsError ? (
              <View style={[styles.sessionsState, { borderColor: palette.border }]}>
                <Text style={[styles.sessionError, { color: palette.expenseAmount }]} accessibilityLiveRegion="polite">
                  {translateMobileText("Sesi aktif tidak dapat dimuat.", language)}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => void loadSessions()} style={[styles.sessionActionButton, { borderColor: palette.border }]}>
                  <Text style={[styles.sessionActionText, { color: palette.text }]}>{translateMobileText("Coba lagi", language)}</Text>
                </Pressable>
              </View>
            ) : sessions.length === 0 ? (
              <View style={[styles.sessionsState, { borderColor: palette.border }]}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color={palette.secondaryText} />
                <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{translateMobileText("Belum ada sesi aktif.", language)}</Text>
              </View>
            ) : (
              <View style={styles.sessionList}>
                <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>
                  {translateMobileText("Sesi aktif pada perangkat", language)}: {sessions.length}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={sessionsLoading || sessions.length <= 1}
                  onPress={revokeOtherSessions}
                  style={[
                    styles.sessionActionButton,
                    { borderColor: palette.border, opacity: sessionsLoading || sessions.length <= 1 ? 0.55 : 1 },
                  ]}
                >
                  <MaterialCommunityIcons name="logout-variant" size={17} color={palette.expenseAmount} />
                  <Text style={[styles.sessionActionText, { color: palette.expenseAmount }]}>{translateMobileText("Keluar dari perangkat lain", language)}</Text>
                </Pressable>
                <FlatList
                  data={sessions}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSession}
                  scrollEnabled={false}
                  removeClippedSubviews={false}
                />
              </View>
            )}
          </Card>
          <View style={[styles.accountDangerZone, { borderColor: palette.expenseAmount, backgroundColor: palette.surface }]}>
            <View style={styles.accountDangerCopy}>
              <MaterialCommunityIcons name="alert-outline" size={20} color={palette.expenseAmount} />
              <View style={styles.accountDangerText}>
                <Text style={[styles.settingsChoiceText, { color: palette.expenseAmount }]}>{translateMobileText("Zona berbahaya", language)}</Text>
                <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>
                  {translateMobileText("Penghapusan akun akan menghapus akun dan data terkait secara permanen.", language)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDeleteDialogOpen(true)}
              style={[styles.deleteAccountButton, { backgroundColor: palette.expenseAmount }]}
            >
              <MaterialCommunityIcons name="delete-outline" size={18} color={palette.accentText} />
              <Text style={[styles.deleteAccountButtonText, { color: palette.accentText }]}>{translateMobileText("Hapus akun", language)}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {activeTab === "Finance Bot" && (
        <View style={styles.settingsPanel}>
          <View>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Finance Bot</Text>
            <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Atur pengingat dan gaya Finance Bot.</Text>
          </View>
          <Card palette={palette} style={styles.settingsContentCard}>
            <View style={styles.settingsBotControls}>
              {renderToggle("Aktifkan Finance Bot", botEnabled, () => updateFinanceBot({ enabled: !botEnabled }))}
              <View style={[styles.settingsControlGroup, { borderColor: palette.border }]}>
                <Text style={[styles.settingsChoiceText, styles.settingsControlTitle, { color: palette.text }]}>Gaya bicara bot</Text>
                <View style={styles.settingsChoiceList}>
                  {(["SANTAI", "TEGAS", "SAVAGE", "CUSTOM"] as const).map((value) => renderChoice(
                    personalityLabels[value],
                    financeBot.personality === value,
                    () => updateFinanceBot({ personality: value }),
                  ))}
                </View>
                {financeBot.personality === "CUSTOM" && (
                  <TextInput
                    accessibilityLabel="Gaya bicara khusus"
                    placeholder="Tulis gaya bicara bot"
                    defaultValue={financeBot.customStyle ?? ""}
                    placeholderTextColor={palette.secondaryText}
                    onEndEditing={(event) => updateFinanceBot({ customStyle: event.nativeEvent.text })}
                    style={[styles.settingsTextInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
                  />
                )}
              </View>
              <View style={[styles.settingsControlGroup, { borderColor: palette.border }]}>
                <Text style={[styles.settingsChoiceText, styles.settingsControlTitle, { color: palette.text }]}>Ambang peringatan anggaran</Text>
                <View style={styles.settingsThresholds}>
                  {[50, 70, 80, 90, 100].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: budgetThreshold === value }}
                      onPress={() => updateFinanceBot({ budgetThreshold: value })}
                      style={[styles.settingsThreshold, { backgroundColor: budgetThreshold === value ? palette.accent : palette.background, borderColor: palette.border }]}
                    >
                      <Text style={{ color: budgetThreshold === value ? palette.accentText : palette.text, fontWeight: "600" }}>{value}%</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[styles.settingsControlGroup, { borderColor: palette.border }]}>
                {renderToggle("Pengingat transaksi harian", dailyReminder, () => updateFinanceBot({ dailyReminderEnabled: !dailyReminder }))}
                {dailyReminder && (
                  <View style={styles.settingsReminderTimes}>
                    {([
                      ["Waktu Pengingat 1", "reminderTime1", reminderTime1],
                      ["Waktu Pengingat 2", "reminderTime2", reminderTime2],
                    ] as const).map(([label, key, value]) => (
                      <View key={key} style={styles.settingsReminderField}>
                        <Text style={[styles.settingsAccountLabel, { color: palette.secondaryText }]}>{label}</Text>
                        <TextInput
                          accessibilityLabel={label}
                          defaultValue={value}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          onEndEditing={(event) => {
                            const nextValue = event.nativeEvent.text;
                            if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nextValue)) {
                              updateFinanceBot({ [key]: nextValue });
                            } else {
                              Alert.alert(
                                translateMobileText("Waktu pengingat tidak valid.", language),
                                translateMobileText("Gunakan format 24 jam, misalnya 20:00.", language),
                              );
                            }
                          }}
                          style={[styles.settingsTextInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
                        />
                      </View>
                    ))}
                  </View>
                )}
                <Text style={[styles.settingsTimezoneNote, { color: palette.secondaryText }]}>
                  Waktu pengingat mengikuti zona waktu akun{userSettings?.timezone ? ` (${userSettings.timezone})` : ""}.
                </Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {activeTab === "Notifikasi" && (
        <View style={styles.settingsPanel}>
          <View>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Notifikasi</Text>
            <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Atur pengingat dan notifikasi penting.</Text>
          </View>
          <Card palette={palette} style={styles.settingsContentCard}>
            <View style={styles.settingsBotControls}>
              {renderToggle(
                pushSaving ? "Memproses notifikasi perangkat..." : "Aktifkan notifikasi perangkat",
                pushEnabled,
                () => { void onPushEnabledChange(!pushEnabled); },
                pushSaving,
              )}
              {pushError && (
                <View style={[styles.pushErrorNotice, { borderColor: palette.expenseAmount, backgroundColor: palette.background }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color={palette.expenseAmount} />
                  <View style={styles.pushErrorCopy}>
                    <Text style={[styles.settingsChoiceText, { color: palette.expenseAmount }]}>{translateMobileText("Notifikasi belum aktif", language)}</Text>
                    <Text accessibilityLiveRegion="polite" style={[styles.cardSubtitle, { color: palette.secondaryText }]}>{translateMobileText("Server belum dapat mendaftarkan notifikasi.", language)} {pushError}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={pushSaving}
                      onPress={() => { void onPushEnabledChange(true); }}
                      style={styles.pushRetryButton}
                    >
                      <Text style={[styles.sessionActionText, { color: palette.text }]}>{translateMobileText("Coba lagi", language)}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {Object.entries(notifications).map(([label, enabled]) => {
                const key = notificationPreferenceKeys[label as keyof typeof notificationPreferenceKeys];
                return renderToggle(label, enabled, () => {
                  void onSettingsChange({
                    notification_preferences: { [key]: !enabled },
                  });
                });
              })}
            </View>
          </Card>
        </View>
      )}

      {activeTab === "Tentang" && (
        <View style={styles.settingsPanel}>
          <View>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Tentang</Text>
            <Text style={[styles.cardSubtitle, { color: palette.secondaryText }]}>Informasi versi aplikasi.</Text>
          </View>
          <Card palette={palette} style={styles.settingsAboutCard}>
            <View style={[styles.settingsAboutRow, { borderColor: palette.border }]}>
              <Text style={[styles.settingsAccountLabel, { color: palette.secondaryText }]}>Versi</Text>
              <Text style={[styles.settingsChoiceText, { color: palette.text }]}>v{Constants.expoConfig?.version ?? "1.0.4"}</Text>
            </View>
          </Card>
        </View>
      )}
    </ScrollView>
    <FloatingFormModal
      open={deleteDialogOpen}
      palette={palette}
      title={translateMobileText("Hapus akun", language)}
      description={translateMobileText("Tindakan ini tidak dapat dibatalkan. Masukkan email akun untuk melanjutkan.", language)}
      onClose={closeDeleteDialog}
      actions={
        <>
          <Pressable
            accessibilityRole="button"
            disabled={deletingAccount}
            onPress={closeDeleteDialog}
            style={[styles.floatingModalCancelButton, { borderColor: palette.border, opacity: deletingAccount ? 0.55 : 1 }]}
          >
            <Text style={[styles.floatingModalActionText, { color: palette.text }]}>{translateMobileText("Batalkan", language)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deletingAccount }}
            disabled={deletingAccount}
            onPress={() => void deleteAccount()}
            style={[styles.floatingModalSaveButton, { backgroundColor: palette.expenseAmount, opacity: deletingAccount ? 0.65 : 1 }]}
          >
            {deletingAccount
              ? <ActivityIndicator color={palette.accentText} />
              : <Text style={[styles.floatingModalActionText, { color: palette.accentText }]}>{translateMobileText("Hapus akun", language)}</Text>}
          </Pressable>
        </>
      }
    >
      <View style={styles.deleteAccountForm}>
        <Text style={[styles.floatingModalLabel, { color: palette.text }]}>{translateMobileText("Konfirmasi email", language)}</Text>
        <TextInput
          accessibilityLabel="Konfirmasi email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={deleteEmail}
          onChangeText={setDeleteEmail}
          placeholder={user.email}
          placeholderTextColor={palette.secondaryText}
          style={[styles.settingsTextInput, styles.floatingModalInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
        />
        {user.has_manual_password === false ? (
          <Text style={[styles.accountDeleteNote, { color: palette.secondaryText }]}>
            {translateMobileText("Akun ini menggunakan login Google. Konfirmasi email saja sudah cukup.", language)}
          </Text>
        ) : (
          <>
            <Text style={[styles.floatingModalLabel, { color: palette.text }]}>{translateMobileText("Kata sandi saat ini", language)}</Text>
            <View style={styles.securePasswordField}>
              <TextInput
                accessibilityLabel="Kata sandi saat ini"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                selectionColor={palette.accent}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder={translateMobileText("Kata sandi saat ini", language)}
                placeholderTextColor={palette.secondaryText}
                style={[styles.settingsTextInput, styles.floatingModalInput, { backgroundColor: palette.input, borderColor: palette.border, color: "transparent" }]}
              />
              {deletePassword.length > 0 && (
                <Text accessible={false} pointerEvents="none" style={[styles.securePasswordMask, { color: palette.text }]}>
                  {"•".repeat(deletePassword.length)}
                </Text>
              )}
            </View>
          </>
        )}
        {deleteError && (
          <Text accessibilityLiveRegion="polite" style={[styles.deleteAccountError, { color: palette.expenseAmount }]}>
            {deleteError}
          </Text>
        )}
      </View>
    </FloatingFormModal>
    {sessionDialog && (
      <NativeActionDialog
        palette={palette}
        title={sessionDialog.kind === "error"
          ? sessionDialog.title
          : sessionDialog.kind === "single"
            ? translateMobileText("Keluarkan perangkat?", language)
            : translateMobileText("Keluar dari perangkat lain?", language)}
        description={sessionDialog.kind === "error"
          ? sessionDialog.description
          : sessionDialog.kind === "single"
            ? `${translateMobileText("Sesi pada", language)} ${sessionDialog.device} ${translateMobileText("akan dikeluarkan dari akun.", language)}`
            : translateMobileText("Sesi di perangkat lain akan dikeluarkan. Perangkat ini tetap masuk.", language)}
        confirmLabel={sessionDialog.kind === "error"
          ? translateMobileText("Mengerti", language)
          : sessionDialog.kind === "single"
            ? translateMobileText("Keluarkan", language)
            : translateMobileText("Keluar dari perangkat lain", language)}
        cancelLabel={sessionDialog.kind === "error" ? null : translateMobileText("Batalkan", language)}
        destructive={sessionDialog.kind !== "error"}
        loading={sessionActionLoading}
        onClose={closeSessionDialog}
        onConfirm={() => { void confirmSessionAction(); }}
      />
    )}
    </>
  );
}

function NativeActionDialog({ palette, title, description, confirmLabel, cancelLabel, destructive, loading, onClose, onConfirm }: {
  palette: Palette;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string | null;
  destructive: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent statusBarTranslucent visible onRequestClose={onClose}>
      <View style={styles.deleteDialogBackdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.sessionConfirmDialog, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup dialog"
            disabled={loading}
            onPress={onClose}
            style={styles.deleteDialogClose}
          >
            <MaterialCommunityIcons name="close" size={24} color={palette.secondaryText} />
          </Pressable>
          <Text accessibilityRole="header" style={[styles.sessionConfirmTitle, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.sessionConfirmDescription, { color: palette.secondaryText }]}>{description}</Text>
          <View style={styles.sessionConfirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              onPress={onConfirm}
              style={[styles.deleteDialogConfirm, { backgroundColor: destructive ? palette.expenseAmount : palette.accent, opacity: loading ? 0.65 : 1 }]}
            >
              {loading
                ? <ActivityIndicator color={palette.accentText} />
                : <Text style={[styles.sessionConfirmActionText, { color: palette.accentText }]}>{confirmLabel}</Text>}
            </Pressable>
            {cancelLabel && (
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={onClose}
                style={[styles.deleteDialogCancel, { borderColor: palette.border }]}
              >
                <Text style={[styles.sessionConfirmActionText, { color: palette.text }]}>{cancelLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Card({ palette, style, children }: { palette: Palette; style?: object; children: ReactNode }) {
  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>{children}</View>;
}

function KpiCard({ palette, label, value, note, width }: { palette: Palette; label: string; value: string; note: string; width: number }) {
  return <Card palette={palette} style={[styles.kpiCard, { width }]}><Text style={[styles.kpiLabel, { color: palette.secondaryText }]}>{label}</Text><Text style={[styles.kpiValue, { color: palette.text }]}>{value}</Text><Text style={[styles.kpiNote, { color: palette.secondaryText }]}>{note}</Text></Card>;
}

function EmptyPanel({ palette, message, compact = false }: { palette: Palette; message: string; compact?: boolean }) {
  return <View style={[styles.emptyPanel, compact && styles.emptyPanelCompact]}><MaterialCommunityIcons name="file-chart-outline" size={18} color={palette.secondaryText} /><Text style={[styles.emptyText, compact && styles.emptyTextCompact, { color: palette.secondaryText }]}>{message}</Text></View>;
}

function ReportEmptyState({ palette }: { palette: Palette }) {
  const language = useContext(MobileLanguageContext);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={[styles.reportEmptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <View style={[styles.reportEmptyIcon, { backgroundColor: palette.muted }]}>
        <MaterialCommunityIcons name="arrow-top-right" size={32} color={palette.secondaryText} />
      </View>
      <View style={styles.reportEmptyCopy}>
        <Text style={[styles.reportEmptyTitle, { color: palette.text }]}>
          {translateMobileText("Belum ada data laporan pada periode ini.", language)}
        </Text>
        <Text style={[styles.reportEmptyDescription, { color: palette.secondaryText }]}>
          {translateMobileText("Data akan muncul setelah Anda menambahkan transaksi pada periode tersebut.", language)}
        </Text>
      </View>
    </View>
  );
}

function FinanceDataState({ palette, error, onRetry }: {
  palette: Palette;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const language = useContext(MobileLanguageContext);
  const offline = useContext(BackendOfflineContext);
  if (offline || !error) return null;
  return <View style={[styles.emptyPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
    <Text style={[styles.emptyText, { color: palette.secondaryText }]}>
      {language === "en" ? "The financial summary could not be refreshed." : "Ringkasan keuangan belum dapat diperbarui."}
    </Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.primaryButton, { backgroundColor: palette.accent }]}>
      <Text style={{ color: palette.accentText, fontWeight: "700" }}>{translateMobileText("Coba lagi", language)}</Text>
    </Pressable>
  </View>;
}

function Drawer({ open, route, palette, onClose, onNavigate }: { open: boolean; route: RouteKey; palette: Palette; onClose: () => void; onNavigate: (route: RouteKey) => void }) {
  const { width: viewportWidth } = useWindowDimensions();
  const drawerWidth = Math.min(viewportWidth * 0.74, 320);
  const [translateX] = useState(() => new Animated.Value(-drawerWidth));
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      Animated.timing(translateX, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(translateX, { toValue: -drawerWidth, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [drawerWidth, open, translateX]);

  if (!mounted) return null;
  return <Modal animationType="fade" transparent visible={mounted} onRequestClose={onClose}>
    <View style={styles.drawerBackdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Tutup menu navigasi" onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.drawer, { backgroundColor: palette.surface, width: drawerWidth, transform: [{ translateX }] }]}>
        <View style={styles.drawerHeader}><Text style={[styles.drawerTitle, { color: palette.text }]}>Neraca</Text><Pressable accessibilityRole="button" accessibilityLabel="Tutup menu" onPress={onClose}><MaterialCommunityIcons name="close" size={18} color={palette.secondaryText} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.drawerList}>{drawerGroups.map((group, groupIndex) => <View key={`${group.title || "home"}-${groupIndex}`} style={styles.drawerGroupBlock}>
          {group.title && <Text style={[styles.drawerGroupTitle, { color: palette.secondaryText }]}>{group.title}</Text>}
          {group.items.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: route === item.key }} onPress={() => onNavigate(item.key)} style={[styles.drawerItem, route === item.key && { backgroundColor: palette.accent }]}>
            <MaterialCommunityIcons name={item.icon} size={16} color={route === item.key ? palette.accentText : palette.secondaryText} />
            <Text style={{ color: route === item.key ? palette.accentText : palette.secondaryText, fontSize: 16, fontWeight: route === item.key ? "600" : "500" }}>{item.label}</Text>
          </Pressable>)}
        </View>)}</ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}

function AddTransactionModal({ open, palette, initialTransaction, onClose }: { open: boolean; palette: Palette; initialTransaction: DemoTransaction | null; onClose: () => void }) {
  const { addTransaction, updateTransaction, categories, showToast } = useDemoTransactions();
  const language = useContext(MobileLanguageContext);
  const text = (value: string) => translateMobileText(value, language);
  const formKey = open ? initialTransaction?.id ?? "new" : null;
  const createFormState = () => ({
    key: formKey,
    date: initialTransaction?.dateISO ?? getLocalDateInput(),
    dateOpen: false,
    type: initialTransaction?.income ? "Pemasukan" as const : "Pengeluaran" as const,
    category: initialTransaction?.category ?? "",
    amount: initialTransaction ? initialTransaction.amount.replace(/[^\d]/g, "") : "",
    note: initialTransaction?.note ?? "",
    errors: {} as TransactionFieldErrors,
    submitError: undefined as string | undefined,
  });
  const [formState, setFormState] = useState(createFormState);
  if (formState.key !== formKey) setFormState(createFormState());
  const formErrors = formState.key === formKey ? formState.errors : {};
  const setFormErrors = (next: TransactionFieldErrors | ((current: TransactionFieldErrors) => TransactionFieldErrors)) => {
    setFormState((current) => ({
      ...current,
      errors: typeof next === "function" ? next(current.key === formKey ? current.errors : {}) : next,
    }));
  };
  const { date, dateOpen, type, category, amount, note } = formState;
  const setDate = (nextDate: string) => setFormState((current) => ({ ...current, date: nextDate }));
  const setDateOpen = (nextOpen: boolean) => setFormState((current) => ({ ...current, dateOpen: nextOpen }));
  const inputStyle = { backgroundColor: palette.input, borderColor: palette.border, color: palette.text };
  const categoryOptions = categories
    .filter((item) => item.type === (type === "Pemasukan" ? "INCOME" : "EXPENSE"))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((item) => ({ value: item.label, label: text(item.label) }));
  if (initialTransaction && category && !categoryOptions.some((item) => item.value === category)) {
    categoryOptions.push({ value: category, label: text(category) });
  }
  const [savingFormKey, setSavingFormKey] = useState<string | null>(null);
  const saving = savingFormKey === formKey;
  const submittingFormKey = useRef<string | null>(null);
  const saveTransaction = () => {
    if (submittingFormKey.current === formKey) return;
    const parsedAmount = Number(amount.replace(/[^\d]/g, ""));
    const nextErrors: TransactionFieldErrors = {};
    if (!date) nextErrors.date = "Wajib diisi";
    if (!category.trim()) nextErrors.category = "Wajib diisi";
    if (!Number.isFinite(parsedAmount)) nextErrors.amount = "Nominal harus berupa angka";
    else if (parsedAmount <= 0) nextErrors.amount = "Wajib diisi";
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const transactionDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(transactionDate.getTime())) {
      setFormErrors((current) => ({ ...current, date: "Tanggal tidak valid" }));
      return;
    }

    const income = type === "Pemasukan";
    const existingTime = initialTransaction?.date.split("•")[1]?.trim();
    const time = initialTransaction?.dateISO === date && existingTime
      ? existingTime
      : new Date().toLocaleTimeString(language === "en" ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const transaction = {
      date: `${formatMobileDate(date, language)} • ${time}`,
      dateISO: date,
      category: category.trim(),
      note: note.trim() || category.trim(),
      amount: `${income ? "+" : "-"}${formatBudgetMoney(parsedAmount, true)}`,
      income,
    };
    setSavingFormKey(formKey);
    setFormState((current) => ({ ...current, submitError: undefined }));
    const submissionKey = formKey;
    submittingFormKey.current = submissionKey;
    const request = initialTransaction
      ? updateTransaction(initialTransaction.id, transaction)
      : addTransaction(transaction);
    onClose();
    void request
      .catch((error: unknown) => {
        showToast(
          error instanceof Error ? error.message : text("Transaksi tidak dapat disimpan."),
          "error",
        );
      })
      .finally(() => {
        if (submittingFormKey.current === submissionKey) submittingFormKey.current = null;
        setSavingFormKey((current) => current === submissionKey ? null : current);
      });
  };

  return <FloatingFormModal open={open} palette={palette} title={text(initialTransaction ? "Ubah Transaksi" : "Tambah Transaksi")} description={initialTransaction ? text(category) : text("Lihat dan cari seluruh histori transaksi keuangan Anda.")} onClose={onClose} actions={
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={text("Simpan")} disabled={saving} onPress={() => void saveTransaction()} style={[styles.floatingModalSaveButton, { backgroundColor: palette.accent, opacity: saving ? 0.7 : 1 }]}><Text style={{ color: palette.accentText, fontWeight: "700" }}>{text(saving ? "Menyimpan..." : "Simpan")}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={[styles.floatingModalCancelButton, { backgroundColor: palette.muted, borderColor: palette.border, opacity: saving ? 0.7 : 1 }]}><Text style={{ color: palette.text, fontWeight: "600" }}>{text("Batal")}</Text></Pressable>
    </>
  }>
    {formState.submitError && <Text accessibilityRole="alert" style={[styles.transactionFieldError, { color: palette.expenseAmount }]}>{text(formState.submitError)}</Text>}
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>{text("Tanggal")}</Text>
    <NativeCalendarPicker
      label={text("Tanggal transaksi")}
      value={date}
      palette={palette}
      active={open && dateOpen}
      onOpenChange={setDateOpen}
      onChange={(value) => {
        setDate(value);
        setFormErrors((current) => ({ ...current, date: undefined }));
      }}
      allowClear={false}
      triggerStyle={[styles.fieldInput, styles.selectField, styles.floatingModalInput, styles.floatingModalDateField, inputStyle]}
    />
    {formErrors.date && <Text accessibilityRole="alert" style={[styles.transactionFieldError, { color: palette.expenseAmount }]}>{text(formErrors.date)}</Text>}
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>{text("Jenis")}</Text>
    <NativeSelect
      label={text("Jenis transaksi")}
      value={type}
      options={[{ value: "Pemasukan", label: text("Pemasukan") }, { value: "Pengeluaran", label: text("Pengeluaran") }]}
      palette={palette}
      active={open}
      optionsStyle={styles.transactionSelectOptions}
      onChange={(value) => setFormState((current) => ({ ...current, type: value }))}
    />
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>{text("Kategori")}</Text>
    <NativeSelect
      label={text("Kategori")}
      value={category}
      options={categoryOptions}
      palette={palette}
      active={open}
      optionsStyle={styles.transactionSelectOptions}
      placeholder={text("Kategori")}
      onChange={(value) => {
        setFormState((current) => ({ ...current, category: value }));
        setFormErrors((current) => ({ ...current, category: undefined }));
      }}
    />
    {formErrors.category && <Text accessibilityRole="alert" style={[styles.transactionFieldError, { color: palette.expenseAmount }]}>{text(formErrors.category)}</Text>}
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>{text("Nominal")}</Text>
    <NumericInput
      value={amount}
      onChangeValue={(value) => {
        setFormState((current) => ({ ...current, amount: value }));
        setFormErrors((current) => ({ ...current, amount: undefined }));
      }}
      placeholder="0"
      placeholderTextColor={palette.secondaryText}
      style={[styles.fieldInput, styles.floatingModalInput, inputStyle]}
      accessibilityLabel={text("Nominal")}
    />
    {formErrors.amount && <Text accessibilityRole="alert" style={[styles.transactionFieldError, { color: palette.expenseAmount }]}>{text(formErrors.amount)}</Text>}
    <Text style={[styles.fieldLabel, styles.floatingModalLabel, { color: palette.text }]}>{text("Catatan")}</Text>
    <TextInput value={note} onChangeText={(value) => setFormState((current) => ({ ...current, note: value }))} multiline style={[styles.fieldInput, styles.floatingModalInput, styles.noteInput, inputStyle]} accessibilityLabel={text("Catatan")} />
  </FloatingFormModal>;
}

function NativeDeleteDialog({ open, title, description, palette, onClose, onConfirm }: {
  open: boolean;
  title: string;
  description: string;
  palette: Palette;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const language = useContext(MobileLanguageContext);
  const text = (value: string) => translateMobileText(value, language);
  const destructiveColor = palette.background === "#020202" ? "#F87171" : "#DC2626";
  const destructiveButtonTint = palette.background === "#020202" ? "rgba(248,113,113,0.2)" : "rgba(220,38,38,0.1)";

  return <Modal
    animationType="fade"
    transparent
    statusBarTranslucent
    navigationBarTranslucent
    visible={open}
    onRequestClose={onClose}
  >
    <View style={styles.deleteDialogBackdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel={text("Tutup")} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.deleteDialog, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={text("Tutup")} onPress={onClose} style={styles.deleteDialogClose}>
        <MaterialCommunityIcons name="close" size={19} color={palette.secondaryText} />
        </Pressable>
        <Text style={[styles.deleteDialogTitle, { color: palette.text }]}>{text(title)}</Text>
        <Text style={[styles.deleteDialogDescription, { color: palette.secondaryText }]}>{text(description)}</Text>
        <View style={styles.deleteDialogActions}>
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.deleteDialogCancel, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={{ color: palette.text, fontWeight: "600" }}>{text("Batal")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onConfirm} style={[styles.deleteDialogConfirm, { backgroundColor: destructiveButtonTint }]}>
            <Text style={{ color: destructiveColor, fontWeight: "600" }}>{text("Hapus")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  launchScreen: { alignItems: "center", justifyContent: "center" },
  launchMark: { width: 112, height: 112 },
  screen: { flex: 1 },
  pageContent: { flex: 1 },
  scroll: { flex: 1 },
  header: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 60, paddingHorizontal: 12, position: "relative" },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 2, marginLeft: "auto" },
  globalSearch: { alignItems: "center", borderRadius: 16, borderWidth: 1, flex: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 12 },
  globalSearchInput: { flex: 1, fontSize: 14, minHeight: 40, paddingVertical: 0 },
  globalSearchClose: { alignItems: "center", justifyContent: "center", minHeight: 40, minWidth: 32 },
  globalSearchResults: { borderRadius: 10, borderWidth: 1, elevation: 12, left: 0, maxHeight: 288, overflow: "hidden", position: "absolute", right: 0, top: 52, zIndex: 40 },
  globalSearchResult: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, minHeight: 48, paddingHorizontal: 14 },
  globalSearchResultText: { flex: 1, fontSize: 14, fontWeight: "500" },
  globalSearchEmpty: { justifyContent: "center", minHeight: 52, paddingHorizontal: 14 },
  iconButton: { alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 48 },
  menuIcon: { fontSize: 23 },
  icon: { fontSize: 23 },
  notificationDot: { alignItems: "center", backgroundColor: "#EF4444", borderRadius: 8, height: 16, justifyContent: "center", position: "absolute", right: 3, top: 5, width: 16 },
  notificationCount: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  headerMenu: { borderRadius: 10, borderWidth: 1, elevation: 8, padding: 12, position: "absolute", right: 12, top: 58, zIndex: 20 },
  transientPopupAnchor: { opacity: 0 },
  transientPopupScroll: { flexGrow: 0, maxHeight: 232 },
  profileMenu: { width: 230 },
  menuHeading: { fontSize: 14, fontWeight: "700" },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  menuRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 38 },
  notificationPreview: { paddingHorizontal: 12, paddingVertical: 8 },
  notificationPreviewTitle: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 18 },
  notificationPreviewTitleText: { flex: 1 },
  notificationPreviewUnreadDot: { borderRadius: 4, height: 6, width: 6 },
  notificationMenuAction: { alignItems: "center", justifyContent: "center", minHeight: 40 },
  toastRegion: { alignItems: "center", left: 16, position: "absolute", right: 16, top: 64, zIndex: 100 },
  toast: { alignItems: "center", borderRadius: 12, borderWidth: 1, elevation: 8, flexDirection: "row", gap: 10, maxWidth: 512, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  toastText: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  menuItemTitle: { fontSize: 13, fontWeight: "600" },
  menuItemMeta: { fontSize: 12, marginTop: 3 },
  avatar: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  avatarCircle: { alignItems: "center", borderRadius: 18, height: 36, justifyContent: "center", overflow: "hidden", width: 36 },
  avatarImage: { height: 36, width: 36 },
  content: { padding: 16, paddingBottom: 0 },
  greeting: { fontSize: 24, fontWeight: "700", lineHeight: 31 },
  pageTitle: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  kpiCard: { borderRadius: 16, height: 124, justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
  kpiLabel: { fontSize: 10, fontWeight: "500" },
  kpiValue: { fontSize: 14, fontWeight: "700" },
  kpiNote: { fontSize: 12, lineHeight: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  dashboardCardTitle: { fontSize: 16, fontWeight: "700" },
  dashboardCardMeta: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  chartCard: { minHeight: 296, marginTop: 24, paddingHorizontal: 20, paddingVertical: 16 },
  demoChart: { alignItems: "flex-end", flexDirection: "row", gap: 10, height: 120, justifyContent: "center", marginTop: 28 },
  demoBar: { borderRadius: 5, width: 28 },
  lineChartWrap: { marginTop: 16, position: "relative", width: "100%" },
  cashflowTooltip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, position: "absolute", width: 176 },
  cashflowTooltipTitle: { fontSize: 12, fontWeight: "700", marginBottom: 7 },
  cashflowTooltipRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  cashflowTooltipDot: { borderRadius: 4, height: 8, width: 8 },
  cashflowTooltipLabel: { flex: 1, fontSize: 11 },
  cashflowTooltipValue: { fontSize: 11, fontWeight: "700" },
  transactionList: { borderRadius: 14, borderWidth: 1, marginTop: 14, overflow: "hidden" },
  demoList: { gap: 12, marginTop: 16 },
  transactionItem: { minHeight: 140, padding: 14 },
  transactionRows: { borderRadius: 14, borderWidth: 1, marginTop: 16, overflow: "hidden" },
  transactionRow: { borderBottomWidth: 1, padding: 12 },
  categoryBadge: { alignSelf: "flex-start", borderRadius: 8, marginTop: 5, maxWidth: "78%", paddingHorizontal: 8, paddingVertical: 4 },
  paginationMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  pageSize: { alignItems: "center", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 4, minHeight: 38, paddingHorizontal: 10 },
  demoTransaction: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
  demoTransactionCopy: { flex: 1, paddingRight: 8 },
  demoTransactionCategory: { fontSize: 14, lineHeight: 20 },
  demoTransactionDate: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  demoTransactionAmount: { fontSize: 14, fontWeight: "700" },
  insightCard: { marginTop: 24, minHeight: 355, paddingHorizontal: 20, paddingVertical: 16 },
  insightHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 54 },
  insightContext: { fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 4 },
  insightIcon: { alignItems: "center", borderRadius: 12, height: 32, justifyContent: "center", width: 32 },
  insightItems: { gap: 10, marginTop: 16 },
  insightText: { borderRadius: 12, borderWidth: 1, fontSize: 14, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12 },
  transactionCard: { marginTop: 24, minHeight: 624, paddingHorizontal: 16, paddingVertical: 16 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSubtitle: { fontSize: 14, marginTop: 5 },
  cardRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  legend: { alignItems: "center", borderRadius: 18, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { fontSize: 12 },
  emptyPanel: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 200 },
  emptyPanelCompact: { minHeight: 82 },
  emptyChart: { alignItems: "center", flex: 1, justifyContent: "center" },
  emptyText: { fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: "center" },
  emptyTextCompact: { marginTop: 8 },
  transactionHeader: { gap: 14 },
  toolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 2, position: "relative" },
  viewAllLink: { alignItems: "center", flexDirection: "row", gap: 4, minHeight: 44 },
  filterButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  dashboardFilterAnchor: { position: "relative" },
  dashboardFilterMenu: { borderRadius: 12, borderWidth: 1, elevation: 24, maxHeight: 340, padding: 8, position: "absolute", right: 0, top: 48, width: 260, zIndex: 50 },
  dashboardFilterOption: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 8 },
  transactionEmptyState: { alignItems: "center", justifyContent: "center", minHeight: 112 },
  searchBox: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 4, minHeight: 46, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, minHeight: 44 },
  transactionEmpty: { borderRadius: 18, borderWidth: 1, marginTop: 16, minHeight: 140 },
  addHint: { bottom: 14, fontSize: 14, position: "absolute", textAlign: "center", width: "100%" },
  pagination: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  pageButton: { alignItems: "center", borderRadius: 22, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  pageText: { fontSize: 14 },
  featureList: { gap: 12, marginTop: 24 },
  featureCard: { minHeight: 170 },
  featureCardPrimary: { minHeight: 210 },
  featureHeading: { flex: 1, minWidth: 0 },
  pageToolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  resultCount: { fontSize: 14, fontWeight: "600" },
  primaryButton: { alignItems: "center", borderRadius: 10, justifyContent: "center", minHeight: 44, maxWidth: 220, paddingHorizontal: 14 },
  addActionButton: { borderRadius: 24, flexDirection: "row", gap: 6, maxWidth: "72%", paddingHorizontal: 18 },
  filterStack: { gap: 10, marginTop: 16 },
  filterMenu: { position: "relative" },
  filterOptions: { borderRadius: 9, borderWidth: 1, elevation: 24, left: 0, maxHeight: 240, maxWidth: 260, paddingVertical: 4, position: "absolute", top: 48, width: 260, zIndex: 50 },
  filterOption: { justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  filterRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  transactionFilters: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  selectButton: { alignItems: "center", borderRadius: 20, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 14 },
  transactionFilterColumn: { minWidth: 0, width: "47%" },
  transactionFilterFullColumn: { width: "100%" },
  transactionFilterFullWidth: { width: "100%" },
  transactionFilterButton: { minWidth: 0, width: "100%" },
  transactionFilterCategoryButton: { alignSelf: "flex-start", width: 168 },
  transactionResetButton: { alignSelf: "stretch", backgroundColor: "transparent", borderRadius: 24, borderWidth: 0, flexDirection: "row", gap: 8, justifyContent: "center" },
  transactionContent: { paddingBottom: 28 },
  nativeSyncBanner: { alignItems: "flex-start", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  nativeSyncBannerCopy: { flex: 1, gap: 3, minWidth: 140 },
  nativeSyncBannerText: { fontSize: 12, fontWeight: "600" },
  nativeSyncBannerDetail: { fontSize: 12 },
  nativeSyncBannerActions: { alignItems: "stretch", gap: 6, width: "100%" },
  nativeSyncAction: { alignItems: "center", borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  transactionPrimaryButton: { borderRadius: 12, flexDirection: "row", gap: 6 },
  transactionFilterCard: { borderRadius: 20, gap: 12, marginTop: 24, padding: 16 },
  transactionSearchBox: { marginTop: 0, minHeight: 46 },
  transactionDateFilter: { alignItems: "flex-start", gap: 5 },
  transactionDateLabel: { fontSize: 12 },
  transactionDateButton: { alignItems: "center", borderRadius: 24, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 10 },
  transactionDateValue: { fontSize: 16 },
  transactionFilterOptions: { maxWidth: 260 },
  transactionCardList: { borderRadius: 12, borderWidth: 1, marginTop: 20, overflow: "hidden" },
  transactionMobileCard: { borderBottomWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  transactionMobileCardLast: { borderBottomWidth: 0 },
  transactionMobileMain: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  transactionMobileCopy: { flex: 1, minWidth: 0 },
  transactionDateText: { fontSize: 12 },
  transactionCategoryText: { fontSize: 12 },
  transactionNoteText: { fontSize: 12, marginTop: 5 },
  transactionSyncStatus: { fontSize: 11, fontWeight: "600", marginTop: 4 },
  transactionAmount: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  transactionMobileActions: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "flex-end", marginTop: 10, paddingHorizontal: 8, paddingVertical: 4 },
  transactionActionButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  transactionNoResults: { alignItems: "center", borderRadius: 18, borderWidth: 1, gap: 4, justifyContent: "center", marginTop: 20, minHeight: 150, padding: 18 },
  transactionNoResultsTitle: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  transactionPagination: { gap: 12, marginTop: 18 },
  transactionPageSizeRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  transactionPaginationLabel: { fontSize: 14 },
  pageSizeOptions: { bottom: 42, left: 0, top: undefined, width: 88 },
  transactionPageControls: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  transactionPageNumbers: { flex: 1 },
  transactionPageNumber: { fontSize: 14, textAlign: "center" },
  transactionPageNavButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  categoryContent: { paddingBottom: 24 },
  categoryFilterCard: { borderRadius: 18, borderWidth: 1, marginTop: 20, padding: 14 },
  categorySearchBox: { borderRadius: 22, marginTop: 0, minHeight: 42, paddingHorizontal: 10 },
  categorySearchInput: { fontSize: 14, minHeight: 40 },
  categoryFilters: { gap: 8, marginTop: 8 },
  categoryFilterButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12, width: "100%" },
  categoryFilterLabel: { fontSize: 13, fontWeight: "500" },
  categoryFilterOptions: { maxWidth: 260 },
  categoryResetButton: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42, paddingHorizontal: 12 },
  categoryCardList: { gap: 12, marginTop: 16 },
  categoryMobileCard: { borderRadius: 18, borderWidth: 1, padding: 12 },
  categoryMobileHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  categoryIconTile: { alignItems: "center", borderRadius: 10, height: 36, justifyContent: "center", width: 36 },
  categoryMobileName: { flex: 1, minWidth: 0 },
  categoryMobileTitle: { fontSize: 14, fontWeight: "600" },
  categorySystemLabel: { fontSize: 12, marginTop: 1 },
  categoryBadgeRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  categoryTypeChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  categoryTypeText: { fontSize: 12, fontWeight: "500" },
  categoryStatusChip: { backgroundColor: "#123C28", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  categoryStatusText: { color: "#4ADE80", fontSize: 12, fontWeight: "600" },
  categoryDescription: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  categoryMobileActions: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 2, marginTop: 10, paddingTop: 6 },
  categoryActionButton: { alignItems: "center", height: 40, justifyContent: "center", width: 44 },
  categoryNoResults: { alignItems: "center", borderRadius: 18, borderWidth: 1, gap: 6, justifyContent: "center", marginTop: 16, minHeight: 190, padding: 18 },
  categoryNoResultsButton: { alignSelf: "stretch", marginTop: 10 },
  categoryPagination: { gap: 12, marginTop: 18 },
  categoryPageSizeRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  categoryPageSize: { minHeight: 38, minWidth: 64 },
  categoryPageSizeOptions: { bottom: 42, left: 0, top: undefined, width: 88 },
  categoryPaginationText: { fontSize: 14 },
  categoryRangeText: { textAlign: "left" },
  categoryPageControls: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  categoryPageButton: { alignItems: "center", borderRadius: 22, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  categoryEditor: { borderRadius: 14, maxHeight: "90%", padding: 20, width: "90%" },
  categoryEditorHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  categoryEditorTypes: { flexDirection: "row", gap: 10 },
  categoryEditorType: { alignItems: "center", borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44 },
  categoryEditorIconGrid: { borderRadius: 12, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 8 },
  categoryEditorIconButton: { alignItems: "center", borderRadius: 9, borderWidth: 1, height: 38, justifyContent: "center", width: "18%" },
  categoryEditorColorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryEditorColorButton: { borderRadius: 16, borderWidth: 2, height: 28, width: 28 },
  selectText: { fontSize: 13 },
  resetButton: { alignItems: "center", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  categoryCard: { marginTop: 12, padding: 16 },
  categoryTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  categoryIcon: { fontSize: 24 },
  badgeRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 16 },
  typeBadge: { borderRadius: 8, borderWidth: 1, fontSize: 12, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  activeBadge: { backgroundColor: "#123C28", borderRadius: 8, color: "#4ADE80", fontSize: 12, fontWeight: "600", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  itemActions: { borderTopWidth: 1, flexDirection: "row", gap: 24, marginTop: 14, paddingTop: 12 },
  listCard: { marginTop: 20, minHeight: 180 },
  notificationContent: { padding: 16, paddingBottom: 24 },
  notificationStatus: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  notificationStatusText: { fontSize: 14, textAlign: "center" },
  notificationToolbar: { gap: 10, marginTop: 20 },
  notificationSyncWarning: { alignItems: "center", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", marginTop: 12, padding: 12 },
  notificationFilter: { width: "100%" },
  notificationActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  notificationActionButton: { alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 44, paddingHorizontal: 11 },
  notificationActionText: { fontSize: 12, fontWeight: "600" },
  notificationEmpty: { alignItems: "center", borderRadius: 14, borderWidth: 1, justifyContent: "center", marginTop: 20, minHeight: 220, padding: 20 },
  notificationEmptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  notificationEmptyDescription: { maxWidth: 300, textAlign: "center" },
  notificationRetryButton: { alignItems: "center", borderRadius: 10, justifyContent: "center", marginTop: 16, minHeight: 44, minWidth: 120, paddingHorizontal: 16 },
  notificationCard: { alignItems: "flex-start", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 12, padding: 12 },
  notificationIcon: { alignItems: "center", borderRadius: 9, height: 36, justifyContent: "center", width: 36 },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTitleRow: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  notificationTitle: { flexShrink: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  notificationUnread: { borderRadius: 6, fontSize: 10, fontWeight: "600", overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3 },
  notificationMessage: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  notificationTime: { fontSize: 12, marginTop: 6 },
  notificationItemActions: { alignItems: "center", flexDirection: "row", gap: 2 },
  notificationIconButton: { alignItems: "center", height: 44, justifyContent: "center", width: 40 },
  notificationPagination: { gap: 12, marginTop: 20 },
  notificationPageSize: { alignItems: "center", flexDirection: "row", gap: 10 },
  notificationMeta: { fontSize: 13 },
  notificationPageSizeSelect: { flex: 1, maxWidth: 100 },
  notificationPageControls: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "center" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  summaryCard: { minHeight: 106, padding: 14, width: "47%" },
  progressTrack: { borderRadius: 4, height: 6, marginTop: 14, overflow: "hidden", width: "100%" },
  progressFill: { borderRadius: 4, height: 6 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  budgetContent: { paddingBottom: 28 },
  budgetFilterCard: { borderRadius: 18, borderWidth: 1, gap: 10, marginTop: 20, padding: 14 },
  budgetSearchBox: { borderRadius: 22, marginTop: 0, minHeight: 42, paddingHorizontal: 10 },
  budgetFilters: { gap: 8 },
  budgetFilterOptions: { maxWidth: 260 },
  budgetYearStepper: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 4 },
  budgetYearButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  budgetSummaryList: { gap: 12, marginTop: 20 },
  budgetSummaryCard: { minHeight: 88, padding: 14 },
  budgetCardList: { gap: 14, marginTop: 18 },
  budgetCard: { padding: 16 },
  budgetCardHeading: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  budgetCardTitleWrap: { flex: 1, minWidth: 0, paddingRight: 8 },
  budgetCardTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  budgetOverLabel: { fontSize: 11, fontWeight: "600" },
  budgetUsageRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 10 },
  budgetProgressTrack: { flex: 1, marginTop: 0, width: undefined },
  budgetUsageText: { fontSize: 12, fontWeight: "600", minWidth: 34, textAlign: "right" },
  budgetAmounts: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingBottom: 12 },
  budgetAmountItem: { flex: 1, minWidth: 0, paddingRight: 4 },
  budgetAmountLabel: { fontSize: 10, lineHeight: 14 },
  budgetAmountValue: { fontSize: 12, fontWeight: "600", lineHeight: 18, marginTop: 3 },
  budgetActions: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 2, marginTop: 8, paddingTop: 4 },
  budgetEmptyState: { alignItems: "center", borderRadius: 16, borderWidth: 1, gap: 6, justifyContent: "center", marginTop: 18, minHeight: 170, padding: 20 },
  budgetPagination: { gap: 12, marginTop: 18 },
  budgetKeyboardAvoid: { alignItems: "center", justifyContent: "center", width: "100%" },
  budgetEditor: { maxHeight: "90%", width: "92%" },
  budgetFormScroll: { flexGrow: 0 },
  budgetFormPeriod: { flexDirection: "row", gap: 12 },
  budgetFormPeriodItem: { flex: 1, minWidth: 0 },
  budgetFormOptions: { borderRadius: 9, borderWidth: 1, marginTop: 5, maxHeight: 180, paddingVertical: 4 },
  goalContent: { paddingBottom: 28 },
  goalHeader: { elevation: 10, overflow: "visible", position: "relative", zIndex: 10 },
  goalToolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  goalAddButton: { borderRadius: 13, maxWidth: 190, paddingHorizontal: 12 },
  goalFilterCard: { borderRadius: 14, borderWidth: 1, gap: 10, marginTop: 20, overflow: "visible", padding: 14 },
  goalSearchBox: { borderRadius: 22, marginTop: 0, minHeight: 42, paddingHorizontal: 10 },
  goalFilters: { alignItems: "stretch", flexDirection: "column", gap: 8 },
  goalFilterMenu: { position: "relative", width: "100%" },
  goalFilterButton: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  goalFilterOptions: { borderRadius: 12, borderWidth: 1, elevation: 24, left: 0, maxHeight: 240, maxWidth: 260, paddingVertical: 4, position: "absolute", top: 48, width: 260, zIndex: 50 },
  goalFilterOption: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  goalResetButton: { alignSelf: "stretch", minHeight: 44 },
  goalCard: { borderRadius: 18, borderWidth: 1, marginTop: 16, padding: 18 },
  goalCardHeading: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  goalCardCopy: { flex: 1, minWidth: 0 },
  goalCardTitle: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  goalCardDescription: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  goalStatusChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  goalStatusText: { fontSize: 12, fontWeight: "600" },
  goalProgressSummary: { alignItems: "flex-end", flexDirection: "row", gap: 12, justifyContent: "space-between", marginTop: 14 },
  goalProgressLead: { flex: 1, minWidth: 0 },
  goalProgressValue: { fontSize: 20, fontWeight: "700", lineHeight: 27, marginTop: 1 },
  goalProgressTrack: { borderRadius: 5, height: 10, marginTop: 8, overflow: "hidden", width: "100%" },
  goalProgressFill: { borderRadius: 5, height: 10 },
  goalPercentage: { fontSize: 16, fontWeight: "700", lineHeight: 22, marginBottom: 2 },
  goalAmounts: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginTop: 14 },
  goalAmountItem: { flex: 1, minWidth: 0 },
  goalAmountItemNarrow: { flexBasis: "48%", flexGrow: 0 },
  goalAmountLabel: { fontSize: 13, lineHeight: 18 },
  goalAmountValue: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  goalTargetValue: { fontSize: 17, fontWeight: "700", lineHeight: 23 },
  goalEstimate: { fontSize: 14, lineHeight: 20, marginBottom: 8, marginTop: 12 },
  goalActions: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 2, marginTop: 0, paddingTop: 12 },
  goalActionButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  goalEmptyState: { alignItems: "center", borderRadius: 18, borderWidth: 1, gap: 6, justifyContent: "center", marginTop: 18, minHeight: 210, padding: 20 },
  goalEmptyButton: { marginTop: 8, paddingHorizontal: 14 },
  goalPagination: { gap: 12, marginTop: 18 },
  goalFooter: { paddingBottom: 8 },
  goalEditor: { maxHeight: "92%", padding: 20, width: "92%" },
  goalEditorHeading: { flex: 1, minWidth: 0, paddingRight: 8 },
  goalFormScroll: { flexGrow: 0, maxHeight: 490 },
  goalFieldInput: { minHeight: 44 },
  goalFormAmounts: { gap: 10 },
  goalFormAmountItem: { minWidth: 0 },
  goalFormMenu: { position: "relative" },
  goalFormOptions: { borderRadius: 9, borderWidth: 1, marginTop: 4, maxHeight: 190, paddingVertical: 4 },
  investmentContent: { paddingBottom: 24 },
  investmentToolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  investmentAddButton: { borderRadius: 13, maxWidth: 210, paddingHorizontal: 12 },
  investmentFilterCard: { borderRadius: 18, borderWidth: 1, elevation: 10, gap: 10, marginTop: 20, overflow: "visible", padding: 14, zIndex: 10 },
  investmentSearchBox: { borderRadius: 22, marginTop: 0, minHeight: 42, paddingHorizontal: 10 },
  investmentSearchInput: { fontSize: 14, minHeight: 40 },
  investmentFilterList: { gap: 8 },
  investmentFilterMenu: { position: "relative", width: "100%" },
  investmentFilterButton: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  investmentFilterLabel: { fontSize: 13, fontWeight: "500" },
  investmentResetButton: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  investmentFilterOptions: { borderRadius: 12, borderWidth: 1, elevation: 24, left: 0, maxHeight: 240, maxWidth: 260, paddingVertical: 4, position: "absolute", top: 48, width: 260, zIndex: 50 },
  investmentFilterOption: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  investmentPageSizeSelect: { position: "relative", width: 88 },
  investmentPageSizeOptions: { borderRadius: 9, borderWidth: 1, bottom: 42, elevation: 24, left: 0, maxHeight: 192, paddingVertical: 4, position: "absolute", width: 88, zIndex: 50 },
  investmentSummaryList: { gap: 12, marginTop: 20 },
  investmentSummaryCard: { minHeight: 116, padding: 16 },
  investmentSummaryLabel: { fontSize: 14 },
  investmentSummaryValue: { fontSize: 18, fontWeight: "600", letterSpacing: -0.45, marginTop: 6 },
  investmentCard: { borderRadius: 12, marginTop: 16, padding: 16 },
  investmentCardHeading: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  investmentIcon: { alignItems: "center", borderRadius: 10, height: 36, justifyContent: "center", width: 36 },
  investmentCardCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  investmentCardName: { fontSize: 14, fontWeight: "500" },
  investmentCardSubtitle: { fontSize: 12, marginTop: 2 },
  investmentStatusBadge: { borderRadius: 8, flexShrink: 0, paddingHorizontal: 8, paddingVertical: 4 },
  investmentStatusText: { fontSize: 12, fontWeight: "500" },
  investmentValueBlock: { alignItems: "flex-start", marginTop: 12 },
  investmentMetricLabel: { fontSize: 11 },
  investmentCurrentValue: { fontSize: 18, fontWeight: "600", marginTop: 2 },
  investmentProfitLoss: { fontSize: 14, fontWeight: "500", marginTop: 8 },
  investmentProfitPct: { fontSize: 12, fontWeight: "400" },
  investmentDetails: { flexDirection: "row", gap: 8, marginTop: 12 },
  investmentDetailItem: { flex: 1, minWidth: 0 },
  investmentDetailValue: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  investmentActions: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 2, marginTop: 12, paddingTop: 12 },
  investmentEmptyState: { alignItems: "center", borderRadius: 18, borderWidth: 1, gap: 6, justifyContent: "center", marginTop: 16, minHeight: 190, padding: 18 },
  investmentEmptyButton: { marginTop: 8, paddingHorizontal: 14 },
  investmentFooter: { paddingBottom: 8 },
  investmentPagination: { gap: 12, marginTop: 18 },
  investmentPageSizeRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  investmentAllocationCard: { marginTop: 22, padding: 16 },
  investmentDonutWrap: { alignItems: "center", marginTop: 12 },
  investmentAllocationLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 8 },
  investmentLegendRow: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: 6, minHeight: 38, paddingHorizontal: 8, paddingVertical: 8, width: "48%" },
  investmentLegendDot: { borderRadius: 5, height: 8, width: 8 },
  investmentLegendName: { flex: 1, fontSize: 11, minWidth: 0 },
  investmentLegendValue: { fontSize: 11, fontWeight: "500" },
  investmentAllocationEmpty: { alignItems: "center", justifyContent: "center", minHeight: 160 },
  investmentEditor: { maxHeight: "92%", width: "92%" },
  investmentFormScroll: { flexGrow: 0, maxHeight: 460 },
  investmentReadOnlyDetails: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "space-between" },
  investmentReadOnlyField: { gap: 4, width: "48%" },
  investmentReadOnlyLabel: { fontSize: 13, fontWeight: "600" },
  investmentReadOnlyValue: { fontSize: 15, lineHeight: 21 },
  investmentTypeOption: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 42, paddingHorizontal: 10 },
  investmentFormRow: { flexDirection: "row", gap: 10 },
  investmentFormField: { flex: 1, minWidth: 0 },
  investmentCurrencyField: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", minHeight: 46, paddingHorizontal: 12 },
  investmentCurrencyPrefix: { fontSize: 14, fontWeight: "600" },
  investmentCurrencyAffix: { fontSize: 14, fontWeight: "600", marginRight: 8 },
  investmentCurrencyInput: { flex: 1, fontSize: 14, fontWeight: "600", minHeight: 44, paddingHorizontal: 0, paddingVertical: 0 },
  investmentCurrencySuffix: { fontSize: 11, fontWeight: "500", marginLeft: 8 },
  periodBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  reportPeriodBlock: { marginTop: 20 },
  reportPeriodHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  reportPeriodHeadingStacked: { alignItems: "flex-start", flexDirection: "column", gap: 8 },
  reportPeriodButton: { alignItems: "center", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  reportPeriodButtonText: { fontSize: 14, fontWeight: "500" },
  reportExportCard: { marginTop: 16, padding: 14 },
  reportExportRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  reportExportTitle: { flexShrink: 0, fontSize: 15 },
  reportExportButton: { alignItems: "center", borderRadius: 24, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 0, minHeight: 48, paddingHorizontal: 16 },
  reportExportButtonText: { fontSize: 14, fontWeight: "600" },
  reportExportError: { fontSize: 12, marginTop: 8 },
  reportSummaryList: { gap: 12, marginTop: 20 },
  reportSummaryCard: { minHeight: 108, padding: 16 },
  reportSummaryHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  reportSummaryLabel: { letterSpacing: 1.1 },
  reportSummaryIcon: { alignItems: "center", borderRadius: 11, height: 36, justifyContent: "center", width: 36 },
  reportSummaryValue: { fontSize: 19, fontWeight: "600", letterSpacing: -0.35, marginTop: 6 },
  reportSummaryComparison: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  reportSummaryChange: { alignItems: "center", flexDirection: "row", gap: 2 },
  reportSummaryNew: { fontSize: 12, fontWeight: "600" },
  reportCard: { marginTop: 16, padding: 16 },
  analyticsContent: { padding: 16, paddingBottom: 28 },
  analyticsPeriodRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", marginTop: 20 },
  analyticsPeriodCopy: { flex: 1, minWidth: 0 },
  analyticsDemoNote: { alignItems: "center", borderRadius: 9, flexDirection: "row", gap: 8, marginTop: 12, paddingHorizontal: 10, paddingVertical: 8 },
  analyticsDemoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  analyticsKpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  analyticsKpiCard: { minHeight: 108, padding: 14, width: "47%" },
  analyticsKpiHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  analyticsKpiValue: { fontSize: 18, fontWeight: "600", letterSpacing: -0.3, marginTop: 10 },
  analyticsKpiHint: { fontSize: 11, marginTop: 4 },
  analyticsLegend: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  analyticsLegendItem: { alignItems: "center", flexDirection: "row", gap: 5, maxWidth: "100%" },
  analyticsLegendText: { flexShrink: 1, fontSize: 10 },
  analyticsEmptyChart: { justifyContent: "center", minHeight: 220, paddingHorizontal: 12 },
  analyticsBudgetChart: { marginTop: 12 },
  analyticsSection: { marginTop: 16 },
  analyticsListCard: { minHeight: 300, padding: 16 },
  analyticsListCardSpaced: { marginTop: 16 },
  analyticsTopCategoryList: { gap: 18, marginTop: 22 },
  analyticsTopCategoryItem: { gap: 10 },
  analyticsTopCategoryHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  analyticsTopCategoryLead: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  analyticsTopCategoryBadge: { alignItems: "center", borderRadius: 11, height: 22, justifyContent: "center", width: 22 },
  analyticsTopCategoryProgress: { alignItems: "center", flexDirection: "row", gap: 8 },
  analyticsTopCategoryTrack: { borderRadius: 4, flex: 1, height: 6, overflow: "hidden" },
  analyticsTopCategoryFill: { borderRadius: 4, height: "100%" },
  analyticsCategoryRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between", minHeight: 58, paddingVertical: 8 },
  analyticsCategoryLead: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  analyticsRank: { alignItems: "center", borderRadius: 5, height: 23, justifyContent: "center", width: 23 },
  analyticsRankText: { fontSize: 11, fontWeight: "600" },
  analyticsCategoryName: { flex: 1, fontSize: 14, minWidth: 0 },
  analyticsCategoryAmount: { alignItems: "flex-end", maxWidth: "44%" },
  analyticsCategoryValue: { fontSize: 14, fontWeight: "600" },
  analyticsCategoryPercent: { fontSize: 12, minWidth: 42, textAlign: "right" },
  analyticsMetricGrid: { columnGap: 16, flexDirection: "row", flexWrap: "wrap", marginTop: 26, rowGap: 34 },
  analyticsMetricTile: { flexBasis: "46%", flexGrow: 1, minWidth: "44%" },
  analyticsMetricLabel: { fontSize: 13, lineHeight: 18 },
  analyticsMetricValue: { fontSize: 14, fontWeight: "600", marginTop: 5 },
  analyticsMetricTileValue: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  analyticsHealthHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  analyticsHealthScore: { fontSize: 29, fontWeight: "700", marginTop: 1 },
  analyticsHealthStatus: { borderRadius: 18, fontSize: 14, fontWeight: "700", overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6 },
  analyticsHealthRiskRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  analyticsHealthRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", minHeight: 30, paddingVertical: 4 },
  analyticsInsightRow: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 14 },
  analyticsInsightText: { flex: 1, fontSize: 13, lineHeight: 19 },
  reportSubtitle: { marginTop: 4 },
  chartTapHint: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  reportLegendText: { fontSize: 11 },
  reportSvgChart: { height: 260, marginTop: 8, width: "100%" },
  reportEmptyChart: { justifyContent: "center", marginTop: 14, minHeight: 150 },
  reportBarChart: { alignItems: "flex-end", flexDirection: "row", gap: 6, height: 190, justifyContent: "space-around", marginTop: 12 },
  reportDateGroup: { alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end", minWidth: 0 },
  reportBars: { alignItems: "flex-end", flex: 1, flexDirection: "row", gap: 4, justifyContent: "center", width: "100%" },
  reportValueBar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, maxWidth: 18, minWidth: 8, width: "36%" },
  reportAxisLabel: { fontSize: 10, marginTop: 6, textAlign: "center" },
  reportDonutWrap: { alignItems: "center", marginTop: 10 },
  reportCategoryList: { gap: 2, marginTop: 4 },
  reportCategoryRow: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: 8, minHeight: 40, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8 },
  reportCategoryLabel: { flex: 1, fontSize: 12, minWidth: 0 },
  reportCategoryAmount: { fontSize: 12, fontWeight: "600" },
  reportTopCategories: { gap: 16, marginTop: 20 },
  reportTopCategoryItem: { gap: 10, minHeight: 44 },
  reportTopCategoryHeading: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  reportTopCategoryName: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  reportRank: { borderRadius: 5, fontSize: 11, overflow: "hidden", paddingHorizontal: 5, paddingVertical: 2, textAlign: "center" },
  reportTopCategoryProgress: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  reportProgressTrack: { borderRadius: 4, flex: 1, height: 7, overflow: "hidden" },
  reportProgressFill: { borderRadius: 4, height: "100%" },
  reportPercentage: { fontSize: 11, textAlign: "right", width: 42 },
  reportTransactionCard: { marginTop: 16, padding: 16 },
  reportTransactionHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 8 },
  reportTransactionTitleBlock: { flex: 1, minWidth: 160 },
  reportViewAllButton: { alignItems: "center", flexDirection: "row", gap: 4, justifyContent: "center", minHeight: 44 },
  reportViewAllText: { fontSize: 12, fontWeight: "600" },
  reportTransactionBadge: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 },
  reportTransaction: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, paddingVertical: 10 },
  reportTransactionCopy: { flex: 1, minWidth: 0 },
  reportTransactionAmount: { fontSize: 12, fontWeight: "700" },
  reportModalBackdrop: { alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.6)", flex: 1, justifyContent: "center", padding: 16 },
  reportPeriodModal: { borderRadius: 14, borderWidth: 1, overflow: "hidden", padding: 16 },
  chartDetailOverlay: { backgroundColor: "rgba(0, 0, 0, 0.52)", flex: 1, justifyContent: "flex-end" },
  chartDetailSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: "86%", paddingBottom: 20, paddingHorizontal: 18, paddingTop: 18 },
  chartDetailHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  chartDetailHeadingCopy: { flex: 1, minWidth: 0 },
  chartDetailTitle: { fontSize: 18, fontWeight: "700" },
  chartDetailSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  chartDetailClose: { alignItems: "center", borderRadius: 10, height: 44, justifyContent: "center", width: 44 },
  chartDetailMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chartDetailMetric: { borderRadius: 10, flexBasis: "48%", flexGrow: 1, minHeight: 64, padding: 10 },
  chartDetailMetricLabel: { fontSize: 11 },
  chartDetailMetricValue: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  chartDetailListTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 18 },
  chartDetailList: { flexGrow: 0, minHeight: 120 },
  chartDetailTransaction: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, minHeight: 58, paddingVertical: 9 },
  chartDetailTransactionCopy: { flex: 1, minWidth: 0 },
  chartDetailTransactionTitle: { fontSize: 13, fontWeight: "600" },
  chartDetailTransactionSubtitle: { fontSize: 11, marginTop: 3 },
  chartDetailTransactionAmount: { fontSize: 12, fontWeight: "700" },
  chartDetailEmpty: { fontSize: 13, lineHeight: 20, paddingVertical: 20, textAlign: "center" },
  reportModalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  reportModalClose: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  reportPeriodOption: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 8 },
  reportCustomRange: { gap: 10, paddingTop: 14 },
  reportDateInput: { borderRadius: 9, borderWidth: 1, fontSize: 15, minHeight: 44, paddingHorizontal: 12 },
  reportApplyButton: { alignItems: "center", borderRadius: 9, justifyContent: "center", minHeight: 44, marginTop: 4 },
  reportApplyText: { fontSize: 14, fontWeight: "600" },
  settingsContent: { padding: 16, paddingBottom: 36 },
  settingsNavigation: { borderRadius: 29, gap: 16, marginHorizontal: 8, marginTop: 24, padding: 12 },
  settingsSearch: { borderRadius: 13, marginTop: 0, minHeight: 44, paddingHorizontal: 10 },
  settingsSearchInput: { fontSize: 16 },
  settingsNavigationItems: { gap: 8 },
  settingsNavigationItem: { alignItems: "center", borderRadius: 22, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 49, paddingHorizontal: 8 },
  settingsNavigationIcon: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  settingsNavigationLabel: { fontSize: 12, fontWeight: "500" },
  settingsNoResults: { borderRadius: 12, borderStyle: "dashed", borderWidth: 1, padding: 12 },
  settingsPanel: { gap: 12, marginTop: 24 },
  settingsGroupTitle: { fontSize: 14, fontWeight: "700", marginBottom: 0 },
  settingsPanelTitle: { fontSize: 20, fontWeight: "700" },
  settingsPreferenceCard: { gap: 16, minHeight: 176, padding: 16 },
  settingsContentCard: { gap: 16, padding: 16 },
  settingsSectionHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  settingsSectionIcon: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  settingsSectionCopy: { flex: 1, minWidth: 0 },
  settingsChoiceList: { gap: 8 },
  settingsChoice: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 46, paddingHorizontal: 14, paddingVertical: 8 },
  settingsChoiceLabel: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 },
  settingsChoiceText: { fontSize: 14, fontWeight: "500" },
  settingsRadio: { alignItems: "center", borderRadius: 10, borderWidth: 1, flexShrink: 0, height: 20, justifyContent: "center", minHeight: 20, minWidth: 20, width: 20 },
  settingsRadioDot: { borderRadius: 4, flexShrink: 0, height: 8, width: 8 },
  settingsAccountDetails: { gap: 6 },
  settingsAccountLabel: { fontSize: 13, fontWeight: "500" },
  sessionsState: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, minHeight: 56, padding: 12 },
  sessionList: { gap: 10 },
  sessionRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  sessionDetails: { gap: 6 },
  sessionDeviceHeading: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sessionDeviceName: { flexShrink: 1 },
  sessionCurrentBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  sessionCurrentText: { fontSize: 11, fontWeight: "600" },
  sessionRevokeButton: { alignItems: "center", alignSelf: "flex-start", borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 7, marginTop: 2, minHeight: 44, paddingHorizontal: 10 },
  sessionRevokeText: { fontSize: 13, fontWeight: "600" },
  sessionActionButton: { alignItems: "center", alignSelf: "flex-start", borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 44, paddingHorizontal: 12 },
  sessionActionText: { fontSize: 13, fontWeight: "600" },
  sessionConfirmDialog: { borderRadius: 16, borderWidth: 1, maxWidth: 512, padding: 24, width: "100%" },
  sessionConfirmTitle: { fontSize: 22, fontWeight: "700", paddingHorizontal: 28, textAlign: "center" },
  sessionConfirmDescription: { alignSelf: "center", fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 340, textAlign: "center" },
  sessionConfirmActions: { gap: 10, marginTop: 24 },
  sessionConfirmActionText: { fontSize: 16, fontWeight: "700" },
  pushErrorNotice: { alignItems: "flex-start", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  pushErrorCopy: { flex: 1, gap: 6, minWidth: 0 },
  pushRetryButton: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44, paddingHorizontal: 8 },
  sessionError: { flex: 1, fontSize: 13, lineHeight: 19 },
  accountDangerZone: { borderRadius: 14, borderWidth: 1, gap: 12, padding: 14 },
  accountDangerCopy: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  accountDangerText: { flex: 1, gap: 4 },
  deleteAccountButton: { alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 46, paddingHorizontal: 14 },
  deleteAccountButtonText: { fontSize: 14, fontWeight: "700" },
  deleteAccountForm: { gap: 4 },
  accountDeleteNote: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  deleteAccountError: { fontSize: 13, lineHeight: 19, marginTop: 10 },
  floatingModalActionText: { fontSize: 14, fontWeight: "600" },
  settingsBotControls: { gap: 12 },
  settingsToggleRow: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", minHeight: 50, paddingHorizontal: 14, paddingVertical: 10 },
  settingsToggleLabel: { flex: 1 },
  settingsSwitch: { borderRadius: 12, borderWidth: 1, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 46 },
  settingsSwitchThumb: { borderRadius: 10, height: 18, width: 18 },
  settingsControlGroup: { borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 },
  settingsControlTitle: { fontWeight: "600" },
  settingsThresholds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  settingsThreshold: { alignItems: "center", borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 54, paddingHorizontal: 10 },
  settingsTextInput: { borderRadius: 9, borderWidth: 1, fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
  securePasswordField: { position: "relative" },
  securePasswordMask: { position: "absolute", left: 13, right: 12, top: 0, bottom: 0, fontSize: 14, textAlignVertical: "center" },
  settingsReminderTimes: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  settingsReminderField: { flex: 1, gap: 6, minWidth: 120 },
  settingsTimezoneNote: { fontSize: 12, lineHeight: 17 },
  settingsAboutCard: { paddingHorizontal: 16, paddingVertical: 4 },
  settingsAboutRow: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 48 },
  profileCard: { alignItems: "center", marginTop: 20, padding: 24 },
  profileLogoutAction: { alignItems: "center", alignSelf: "stretch", flexDirection: "row", gap: 10, marginTop: 12, minHeight: 48, paddingHorizontal: 12 },
  profileLogoutText: { fontSize: 15, fontWeight: "600" },
  profileAvatar: { alignItems: "center", backgroundColor: "#B2D5E5", borderRadius: 36, height: 72, justifyContent: "center", width: 72 },
  profileName: { fontSize: 20, fontWeight: "700", marginTop: 14 },
  exportButton: { alignItems: "center", borderRadius: 9, borderWidth: 1, justifyContent: "center", marginTop: 14, minHeight: 44, paddingHorizontal: 14 },
  reportEmptyCard: { alignItems: "center", borderRadius: 16, borderWidth: 1, justifyContent: "center", marginTop: 16, minHeight: 360, paddingHorizontal: 24, paddingVertical: 48 },
  reportEmptyIcon: { alignItems: "center", borderRadius: 16, height: 64, justifyContent: "center", width: 64 },
  reportEmptyCopy: { alignItems: "center", marginTop: 16, maxWidth: 360 },
  reportEmptyTitle: { fontSize: 16, fontWeight: "700", lineHeight: 24, textAlign: "center" },
  reportEmptyDescription: { fontSize: 14, lineHeight: 22, marginTop: 4, textAlign: "center" },
  reportLegend: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  reportLegendDot: { borderRadius: 5, height: 10, width: 10 },
  reportLegendLine: { borderTopWidth: 2, height: 0, width: 15 },
  reportLegendDashed: { borderStyle: "dashed" },
  profileHeading: { alignItems: "center", flexDirection: "row", gap: 12 },
  profileIcon: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  profileHeadingCopy: { flex: 1 },
  inlineValue: { alignItems: "center", flexDirection: "row", gap: 8 },
  profileNameValue: { flexShrink: 1 },
  profileEditIconButton: { alignItems: "center", borderRadius: 9, height: 44, justifyContent: "center", width: 44 },
  profileEditActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  profileEditButton: { alignItems: "center", borderRadius: 9, justifyContent: "center", minHeight: 44, minWidth: 96, paddingHorizontal: 14 },
  profileEditButtonText: { fontSize: 14, fontWeight: "600" },
  profileFeedback: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  forecastSelector: { borderRadius: 12, gap: 8, marginTop: 20, padding: 16 },
  forecastLabel: { fontSize: 14, fontWeight: "500" },
  forecastSelectButton: { alignItems: "center", borderRadius: 9, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  forecastEmpty: { alignItems: "center", justifyContent: "center", marginTop: 16, minHeight: 280, paddingHorizontal: 24, paddingVertical: 32 },
  forecastEmptyContent: { alignItems: "center", gap: 4 },
  forecastEmptyTitle: { fontSize: 16, fontWeight: "600", lineHeight: 22, textAlign: "center" },
  forecastEmptyDescription: { fontSize: 14, lineHeight: 20, maxWidth: 360, textAlign: "center" },
  forecastSpendingCard: { gap: 16, marginTop: 16, padding: 16 },
  forecastSpendingHeader: { gap: 2 },
  forecastDataNote: { fontSize: 11, marginTop: 3 },
  forecastPeriodBadge: { alignSelf: "stretch", borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 12 },
  forecastPeriodText: { fontSize: 13 },
  forecastMetricCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  forecastMetricLabel: { fontSize: 13, lineHeight: 18 },
  forecastTotal: { fontSize: 24, fontWeight: "700", marginTop: 4 },
  forecastConfidenceRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  forecastConfidenceBadge: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  forecastConfidenceText: { fontSize: 12, fontWeight: "500" },
  forecastOtherTotal: { fontSize: 20, fontWeight: "600", marginTop: 4 },
  forecastBreakdown: { gap: 10 },
  forecastBreakdownTitle: { fontSize: 14, fontWeight: "600" },
  forecastCategoryRow: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  forecastCategoryCopy: { flex: 1, minWidth: 0 },
  forecastCategoryName: { fontSize: 14, fontWeight: "500" },
  forecastCategoryAmount: { fontSize: 14, fontWeight: "600" },
  forecastCategoryEmpty: { alignItems: "center", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 360, padding: 20 },
  forecastSpendingEmpty: { alignItems: "center", justifyContent: "center", minHeight: 160, paddingVertical: 24 },
  fieldValue: { fontSize: 16, fontWeight: "600", marginTop: 5 },
  profileFields: { alignSelf: "stretch", marginTop: 12 },
  sectionHeading: { fontSize: 18, fontWeight: "700", marginTop: 24 },
  chevron: { fontSize: 25 },
  bottomNav: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 68, paddingTop: 4, width: "100%" },
  navItem: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 60 },
  navItemPressed: { opacity: 0.72 },
  navAddItem: { transform: [{ translateY: -5 }] },
  navIconWrap: { alignItems: "center", borderRadius: 18, height: 32, justifyContent: "center", width: 56 },
  navAddIcon: { borderRadius: 25, elevation: 4, height: 50, width: 50 },
  navText: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  drawerBackdrop: { backgroundColor: "rgba(0,0,0,0.62)", flex: 1 },
  drawer: { height: "100%", paddingTop: 12 },
  drawerHeader: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 20 },
  drawerList: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 24 },
  drawerGroupBlock: { marginBottom: 0 },
  drawerGroupTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 6, paddingHorizontal: 12, textTransform: "uppercase" },
  drawerTitle: { fontSize: 16, fontWeight: "600" },
  close: { fontSize: 30 },
  drawerGroup: { marginTop: 24 },
  groupTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7, marginBottom: 7, textTransform: "uppercase" },
  drawerItem: { alignItems: "center", borderRadius: 22, flexDirection: "row", gap: 12, minHeight: 44, marginBottom: 3, paddingHorizontal: 12 },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.62)", flex: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 16 },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", padding: 24 },
  floatingModalBackdrop: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", flex: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 16 },
  floatingModalKeyboard: { alignItems: "center", justifyContent: "center", maxHeight: "100%" },
  floatingModal: { borderRadius: 14, borderWidth: 1, elevation: 16, maxHeight: "100%", minWidth: 0, overflow: "hidden", shadowColor: "#000000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 20, width: "100%" },
  floatingModalHeader: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 15, paddingHorizontal: 44, paddingTop: 21 },
  floatingModalTitle: { textAlign: "center" },
  floatingModalDescription: { maxWidth: 320, textAlign: "center" },
  floatingModalClose: { alignItems: "center", height: 44, justifyContent: "center", position: "absolute", right: 10, top: 10, width: 44 },
  floatingModalBody: { alignSelf: "stretch", flexGrow: 1, flexShrink: 1, minHeight: 0, minWidth: 0, width: "100%" },
  floatingModalBodyContent: { alignSelf: "stretch", paddingBottom: 20, paddingHorizontal: 22, paddingTop: 8, width: "100%" },
  floatingModalFooter: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, paddingHorizontal: 22, paddingVertical: 14 },
  floatingModalSaveButton: { alignItems: "center", borderRadius: 12, justifyContent: "center", minHeight: 46, width: "100%" },
  floatingModalCancelButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 46, width: "100%" },
  floatingModalLabel: { fontSize: 14, marginBottom: 7, marginTop: 15 },
  floatingModalInput: { borderRadius: 11, minHeight: 44 },
  floatingModalSelect: { borderRadius: 11 },
  floatingModalDateField: { justifyContent: "center" },
  transactionFieldError: { fontSize: 12, lineHeight: 16, marginTop: 5 },
  transactionSelectOptions: { maxWidth: "100%" },
  deleteDialogBackdrop: { alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.6)", flex: 1, justifyContent: "center", padding: 16 },
  deleteDialog: { borderRadius: 16, borderWidth: 1, maxWidth: 512, padding: 24, width: "100%" },
  deleteDialogClose: { alignItems: "center", height: 44, justifyContent: "center", position: "absolute", right: 8, top: 8, width: 44, zIndex: 1 },
  deleteDialogTitle: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  deleteDialogDescription: { alignSelf: "center", fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 260, textAlign: "center" },
  deleteDialogActions: { flexDirection: "column-reverse", gap: 8, marginTop: 24 },
  deleteDialogCancel: { alignItems: "center", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 44, width: "100%" },
  deleteDialogConfirm: { alignItems: "center", borderRadius: 12, justifyContent: "center", minHeight: 44, width: "100%" },
  nativeSelectContainer: { position: "relative" },
  nativeSelectTrigger: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  nativeSelectDisabled: { opacity: 0.65 },
  nativeSelectText: { flex: 1, fontSize: 14 },
  nativeSelectOptions: { borderRadius: 12, borderWidth: 1, elevation: 24, overflow: "hidden", paddingVertical: 4, position: "absolute", shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  nativeSelectOption: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 },
  nativeSelectEmpty: { fontSize: 14, paddingHorizontal: 12, paddingVertical: 14 },
  nativeCalendar: { borderRadius: 4, borderWidth: 1, elevation: 24, paddingHorizontal: 6, paddingVertical: 8, position: "absolute", shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 8 },
  nativeCalendarHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingLeft: 6 },
  nativeCalendarMonth: { fontSize: 16, fontWeight: "700" },
  nativeCalendarNavigation: { alignItems: "center", flexDirection: "row" },
  nativeCalendarNavButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  nativeCalendarDays: { flex: 1 },
  nativeCalendarWeek: { alignItems: "center", flexDirection: "row" },
  nativeCalendarWeekday: { flex: 1, fontSize: 14, fontWeight: "500", lineHeight: 32, textAlign: "center" },
  nativeCalendarDay: { alignItems: "center", borderColor: "transparent", borderRadius: 4, borderWidth: 1, flex: 1, height: 44, justifyContent: "center" },
  nativeCalendarFooter: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", marginTop: 2, minHeight: 48 },
  nativeCalendarAction: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 64, paddingHorizontal: 12 },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalDescription: { fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 280 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  fieldInput: { borderRadius: 8, borderWidth: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10 },
  selectField: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  typeOptions: { borderRadius: 12, borderWidth: 1, marginTop: -2, paddingVertical: 4 },
  typeOption: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14 },
  modalActions: { flexDirection: "column", gap: 8, marginTop: 18 },
  modalStackedAction: { alignSelf: "stretch", marginTop: 0, paddingHorizontal: 20 },
  closeButton: { alignItems: "center", borderRadius: 8, borderWidth: 1, justifyContent: "center", marginTop: 20, minHeight: 46 },
  saveButton: { alignItems: "center", borderRadius: 8, justifyContent: "center", marginTop: 20, minHeight: 46, paddingHorizontal: 20 },
});

const themes = {
  dark: { background: "#020202", surface: "#161616", card: "#171717", input: "#1C1C1C", popover: "#111111", border: "#2A2A2A", muted: "#242424", text: "#FFFFFF", secondaryText: "#A1A1AA", accent: "#B2D5E5", accentText: "#020202", incomeAmount: "#10B981", expenseAmount: "#EF4444", chart1: "#B2D5E5", chart2: "#34D399", chart3: "#FBBF24", chart4: "#F87171", chart5: "#A1A1AA", success: "#22C55E", info: "#3B82F6", warning: "#F59E0B", danger: "#EF4444" },
  light: { background: "#FFFFFF", surface: "#FAFAFA", card: "#FFFFFF", input: "#FFFFFF", popover: "#FFFFFF", border: "#E4E4E7", muted: "#F4F4F5", text: "#18181B", secondaryText: "#52525B", accent: "#0A6CBA", accentText: "#FFFFFF", incomeAmount: "#047857", expenseAmount: "#B91C1C", chart1: "#0A6CBA", chart2: "#059669", chart3: "#D97706", chart4: "#DC2626", chart5: "#71717A", success: "#16A34A", info: "#2563EB", warning: "#F59E0B", danger: "#EF4444" },
} as const;
