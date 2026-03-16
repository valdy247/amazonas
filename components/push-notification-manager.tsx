"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { pushPromptCopy, type AppLanguage } from "@/lib/i18n";

type PushNotificationManagerProps = {
  userId: string;
  language: AppLanguage;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function PushNotificationManager({ userId, language }: PushNotificationManagerProps) {
  const copy = pushPromptCopy[language];
  const [isVisible, setIsVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const permission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isSupported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      window.isSecureContext;

    setSupported(isSupported);
    if (!isSupported) {
      setUnsupported(true);
      setIsVisible(true);
      return;
    }

    const storageKey = `pushPromptSeen:${userId}`;

    async function registerAndSync() {
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (Notification.permission === "granted" && !subscription) {
        const keyResponse = await fetch("/api/push/public-key");
        const keyPayload = (await keyResponse.json()) as { data?: { publicKey?: string } };

        if (keyResponse.ok && keyPayload.data?.publicKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyPayload.data.publicKey),
          });
        }
      }

      if (Notification.permission === "granted" && subscription) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      }
    }

    void registerAndSync();

    if (Notification.permission === "default" && !window.localStorage.getItem(storageKey)) {
      setIsVisible(true);
    }
  }, [userId]);

  async function enablePush() {
    const storageKey = `pushPromptSeen:${userId}`;
    window.localStorage.setItem(storageKey, "1");
    setIsBusy(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setIsVisible(false);
        return;
      }

      const keyResponse = await fetch("/api/push/public-key");
      const keyPayload = (await keyResponse.json()) as { data?: { publicKey?: string } };

      if (!keyResponse.ok || !keyPayload.data?.publicKey) {
        setIsVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyPayload.data.publicKey),
        });
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      setIsVisible(false);
    } finally {
      setIsBusy(false);
    }
  }

  function dismissPrompt() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`pushPromptSeen:${userId}`, "1");
    }
    setIsVisible(false);
  }

  if ((!supported && !unsupported) || !isVisible || permission === "granted" || permission === "denied") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17120d]/28 px-4 pb-6 backdrop-blur-[2px] sm:items-center sm:pb-0">
      <div className="w-full max-w-[430px] rounded-[1.65rem] border border-[#eadfd6] bg-white p-5 shadow-[0_28px_70px_rgba(22,18,14,0.18)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3ec] text-[#dc4f1f]">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-[#131316]">{copy.title}</p>
            <p className="mt-1 text-sm text-[#62626d]">
              {unsupported ? copy.unsupported : copy.body}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!unsupported ? (
            <button type="button" className="btn-primary" onClick={() => void enablePush()} disabled={isBusy}>
              {isBusy ? copy.enabling : copy.allow}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={dismissPrompt} disabled={isBusy}>
            {copy.notNow}
          </button>
        </div>
      </div>
    </div>
  );
}
