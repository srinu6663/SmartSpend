import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { requestFCMToken, onForegroundMessage } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";

export const usePushNotifications = () => {
  const saveFCMToken = useCallback(async (token: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .upsert({ id: user.id, fcm_token: token }, { onConflict: "id" });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      const token = await requestFCMToken();
      if (token) {
        await saveFCMToken(token);
        toast.success("Push notifications enabled! 🔔");
      }
    }
  }, [saveFCMToken]);

  useEffect(() => {
    // Listen for foreground messages and show toast
    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      toast(title || "Finly", {
        description: body,
        duration: 5000,
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  return { requestPermission };
};
