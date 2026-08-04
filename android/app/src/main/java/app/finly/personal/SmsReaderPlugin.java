package app.finly.personal;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.HashMap;
import java.util.Map;

/**
 * Reads bank alert SMS so transactions can be imported automatically.
 *
 * WHY A CUSTOM PLUGIN
 * There is no web API for the SMS inbox — WebOTP reads a single specially
 * formatted OTP and nothing else. Automatic extraction needs native READ_SMS,
 * which is only available in a real Android app. This build is sideloaded for
 * personal use; Google Play restricts READ_SMS to default-SMS-handler apps, so
 * this could not be published there.
 *
 * PRIVACY
 * The inbox is read only after the user grants the permission at runtime, and
 * only message bodies are handed to the JS layer. Parsing happens on-device
 * (see src/lib/smsParser.ts); nothing is uploaded unless the parser identifies a
 * transaction and the user has enabled import.
 */
@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(
            alias = SmsReaderPlugin.SMS_PERMISSION,
            strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS }
        )
    }
)
public class SmsReaderPlugin extends Plugin {

    static final String SMS_PERMISSION = "sms";
    private static final String EVENT_SMS_RECEIVED = "smsReceived";
    /** Hard ceiling so a huge inbox can't stall the bridge or exhaust memory. */
    private static final int MAX_LIMIT = 500;

    private BroadcastReceiver receiver;

    /* ── Permissions ─────────────────────────────────────────────────────── */

    @PluginMethod
    public void checkSmsPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState(SMS_PERMISSION).toString().equals("granted"));
        call.resolve(result);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        if (getPermissionState(SMS_PERMISSION).toString().equals("granted")) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias(SMS_PERMISSION, call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState(SMS_PERMISSION).toString().equals("granted"));
        call.resolve(result);
    }

    /* ── Inbox read ──────────────────────────────────────────────────────── */

    /**
     * Returns inbox messages newer than `sinceMillis`, newest first.
     *
     * `sinceMillis` matters: without it every scan walks years of history and
     * re-parses everything. The JS layer persists a high-water mark so a scan
     * only looks at what arrived since the last one.
     */
    @PluginMethod
    public void readInbox(PluginCall call) {
        if (!getPermissionState(SMS_PERMISSION).toString().equals("granted")) {
            call.reject("SMS permission not granted");
            return;
        }

        long sinceMillis = call.getLong("sinceMillis", 0L);
        int limit = Math.min(call.getInt("limit", 200), MAX_LIMIT);

        JSArray messages = new JSArray();
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                Telephony.Sms.Inbox.CONTENT_URI,
                new String[] { Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE },
                Telephony.Sms.DATE + " > ?",
                new String[] { String.valueOf(sinceMillis) },
                Telephony.Sms.DATE + " DESC"
            );

            if (cursor != null) {
                int idCol = cursor.getColumnIndexOrThrow(Telephony.Sms._ID);
                int addressCol = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS);
                int bodyCol = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY);
                int dateCol = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE);

                int count = 0;
                while (cursor.moveToNext() && count < limit) {
                    JSObject message = new JSObject();
                    message.put("id", cursor.getString(idCol));
                    message.put("sender", cursor.getString(addressCol));
                    message.put("body", cursor.getString(bodyCol));
                    message.put("receivedAt", cursor.getLong(dateCol));
                    messages.put(message);
                    count++;
                }
            }

            JSObject result = new JSObject();
            result.put("messages", messages);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read SMS inbox: " + e.getMessage(), e);
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    /* ── Live watching ───────────────────────────────────────────────────── */

    /**
     * Starts forwarding incoming SMS to JS as `smsReceived` events.
     *
     * Registered dynamically rather than declared in the manifest so nothing is
     * received until the user has actually opted in. Guarded against double
     * registration: calling this twice would deliver every message twice, and
     * the JS layer would then attempt two imports for one SMS.
     */
    @PluginMethod
    public void startWatching(PluginCall call) {
        if (!getPermissionState(SMS_PERMISSION).toString().equals("granted")) {
            call.reject("SMS permission not granted");
            return;
        }

        if (receiver != null) {
            call.resolve(); // already watching — do not stack receivers
            return;
        }

        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
                    return;
                }

                SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                if (parts == null || parts.length == 0) return;

                // Multipart SMS arrives as several parts of ONE logical message;
                // concatenate before emitting, or a long bank alert is split and
                // neither half parses.
                Map<String, StringBuilder> bodies = new HashMap<>();
                Map<String, Long> timestamps = new HashMap<>();

                for (SmsMessage part : parts) {
                    if (part == null) continue;
                    String sender = part.getOriginatingAddress();
                    String key = sender == null ? "" : sender;
                    if (!bodies.containsKey(key)) {
                        bodies.put(key, new StringBuilder());
                        timestamps.put(key, part.getTimestampMillis());
                    }
                    bodies.get(key).append(part.getMessageBody());
                }

                for (Map.Entry<String, StringBuilder> entry : bodies.entrySet()) {
                    JSObject payload = new JSObject();
                    payload.put("sender", entry.getKey());
                    payload.put("body", entry.getValue().toString());
                    payload.put("receivedAt", timestamps.get(entry.getKey()));
                    notifyListeners(EVENT_SMS_RECEIVED, payload);
                }
            }
        };

        IntentFilter filter = new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
        // SMS_RECEIVED is a protected broadcast from the system, so the receiver
        // must be exported on API 34+ or registration throws.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }

        call.resolve();
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        unregister();
        call.resolve();
    }

    private void unregister() {
        if (receiver == null) return;
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // Already unregistered — nothing to undo.
        }
        receiver = null;
    }

    @Override
    protected void handleOnDestroy() {
        // Leaving the receiver registered leaks it across activity recreation,
        // which is how you end up with several receivers all firing.
        unregister();
        super.handleOnDestroy();
    }
}
