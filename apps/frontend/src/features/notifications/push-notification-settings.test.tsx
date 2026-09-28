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
    const enableButton = await screen.findByRole("button", {
      name: uiText.settingsPage.pushEnable,
    });

    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(enableButton);

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
});
