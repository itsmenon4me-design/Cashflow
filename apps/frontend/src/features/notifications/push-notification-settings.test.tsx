import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PushNotificationSettings } from "@/features/notifications/push-notification-settings";
import { notificationService } from "@/services/notification.service";
import { uiText } from "@/locales";

vi.mock("@/services/notification.service", () => ({
  notificationService: {
    pushConfig: vi.fn(),
    savePushSubscription: vi.fn(),
    removePushSubscription: vi.fn(),
  },
}));

const browserSubscription = {
  endpoint: "https://push.example.test/subscription",
  toJSON: () => ({
    endpoint: "https://push.example.test/subscription",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

const pushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};

const registration = { pushManager };
const serviceWorker = {
  getRegistrations: vi.fn(),
  register: vi.fn(),
};
const requestPermission = vi.fn();
const originalNotification = Object.getOwnPropertyDescriptor(
  window,
  "Notification",
);
const originalPushManager = Object.getOwnPropertyDescriptor(
  window,
  "PushManager",
);
const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

function restoreProperty(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    Reflect.deleteProperty(target, property);
  }
}

describe("PushNotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationService.pushConfig).mockResolvedValue({
      enabled: true,
      publicKey: "B".repeat(87),
    });
    vi.mocked(notificationService.savePushSubscription).mockResolvedValue();
    vi.mocked(notificationService.removePushSubscription).mockResolvedValue();
    pushManager.getSubscription.mockResolvedValue(null);
    pushManager.subscribe.mockResolvedValue(browserSubscription);
    serviceWorker.getRegistrations.mockResolvedValue([]);
    serviceWorker.register.mockResolvedValue(registration);
    requestPermission.mockResolvedValue("granted");
    const mockNotification = {
      permission: "default",
      requestPermission,
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: mockNotification,
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
  });

  afterEach(() => {
    cleanup();
    restoreProperty(window, "Notification", originalNotification);
    restoreProperty(window, "PushManager", originalPushManager);
    restoreProperty(navigator, "serviceWorker", originalServiceWorker);
  });

  it("requests browser permission only after the user activates device notifications", async () => {
    render(<PushNotificationSettings />);
    const enableSwitch = await screen.findByRole("switch", {
      name: `${uiText.settingsPage.pushTitle}: ${uiText.settingsPage.pushEnable}`,
    });

    await waitFor(() => expect(enableSwitch).toBeEnabled());
    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(enableSwitch);

    await waitFor(() => expect(requestPermission).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(notificationService.savePushSubscription).toHaveBeenCalledWith({
        endpoint: browserSubscription.endpoint,
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      }),
    );
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it("hides the explanatory text and reports an actionable error if push is unavailable", async () => {
    vi.mocked(notificationService.pushConfig).mockResolvedValue({
      enabled: false,
      publicKey: null,
    });
    render(<PushNotificationSettings />);

    const enableSwitch = await screen.findByRole("switch", {
      name: `${uiText.settingsPage.pushTitle}: ${uiText.settingsPage.pushEnable}`,
    });
    await waitFor(() => expect(enableSwitch).toBeEnabled());
    expect(enableSwitch).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Tampilkan pengingat umum CashFlow di perangkat. Detail tetap hanya terlihat di aplikasi.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Notifikasi perangkat belum dikonfigurasi di server."),
    ).not.toBeInTheDocument();

    fireEvent.click(enableSwitch);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      uiText.settingsPage.pushUnavailable,
    );
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
