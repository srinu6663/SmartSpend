import { registerPlugin, Capacitor, type PluginListenerHandle } from "@capacitor/core";

/**
 * Bridge to the native SmsReader plugin (android/.../SmsReaderPlugin.java).
 *
 * On the web there is no SMS inbox to read, so every method degrades to a
 * well-defined "unavailable" rather than throwing. That keeps `npm run dev` in a
 * browser fully usable — the UI just reports that SMS import needs the Android
 * app, instead of erroring on load.
 */

export interface RawSMS {
  id?: string;
  sender: string | null;
  body: string;
  /** Epoch milliseconds. */
  receivedAt: number;
}

export interface SmsReaderPlugin {
  checkSmsPermission(): Promise<{ granted: boolean }>;
  requestSmsPermission(): Promise<{ granted: boolean }>;
  readInbox(options: { sinceMillis?: number; limit?: number }): Promise<{ messages: RawSMS[] }>;
  startWatching(): Promise<void>;
  stopWatching(): Promise<void>;
  addListener(
    event: "smsReceived",
    listener: (message: RawSMS) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const webFallback: SmsReaderPlugin = {
  async checkSmsPermission() {
    return { granted: false };
  },
  async requestSmsPermission() {
    return { granted: false };
  },
  async readInbox() {
    return { messages: [] };
  },
  async startWatching() {
    /* no-op on web */
  },
  async stopWatching() {
    /* no-op on web */
  },
  async addListener() {
    return { remove: async () => undefined } as PluginListenerHandle;
  },
  async removeAllListeners() {
    /* no-op on web */
  },
};

export const SmsReader = registerPlugin<SmsReaderPlugin>("SmsReader", {
  web: webFallback,
});

/** True only in the native Android build, where the inbox actually exists. */
export const isSmsAvailable = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
