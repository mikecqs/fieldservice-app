"use client";

import { useEffect, useState } from "react";
import { subscreverPush, cancelarSubscricaoPush } from "./push-actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Estado = "indisponivel" | "ios_nao_instalado" | "inativo" | "ativo" | "negado";

export function AtivarNotificacoes() {
  const [estado, setEstado] = useState<Estado>("inativo");
  const [aProcessar, setAProcessar] = useState(false);

  useEffect(() => {
    const suportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!suportado) {
      setEstado("indisponivel");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("negado");
      return;
    }

    // No iPhone/iPad, o Web Push só funciona depois de o site ser instalado
    // ("Adicionar ao ecrã principal") — em Safari normal a subscrição falha
    // sempre, por limitação do próprio iOS, não da app.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (isIOS && !isStandalone) {
      setEstado("ios_nao_instalado");
      return;
    }

    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "ativo" : "inativo");
    });
  }, []);

  const ativar = async () => {
    setAProcessar(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado("negado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = sub.toJSON();
      await subscreverPush({ endpoint: sub.endpoint, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } });
      setEstado("ativo");
    } catch {
      setEstado("inativo");
    } finally {
      setAProcessar(false);
    }
  };

  const desativar = async () => {
    setAProcessar(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await cancelarSubscricaoPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("inativo");
    } finally {
      setAProcessar(false);
    }
  };

  if (estado === "indisponivel") return null;

  if (estado === "ios_nao_instalado") {
    return (
      <p className="mb-3 rounded-md border border-neutral-800 bg-neutral-900 p-2.5 text-xs text-neutral-400">
        Para receberes notificações, adiciona este site ao ecrã principal (Partilhar → Adicionar ao Ecrã
        Principal) e abre-o a partir daí.
      </p>
    );
  }

  if (estado === "negado") {
    return (
      <p className="mb-3 rounded-md border border-neutral-800 bg-neutral-900 p-2.5 text-xs text-neutral-500">
        Notificações bloqueadas — ativa-as nas definições do browser para receberes alertas de atraso.
      </p>
    );
  }

  if (estado === "ativo") {
    return (
      <button
        onClick={desativar}
        disabled={aProcessar}
        className="mb-3 rounded-md border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-900 disabled:opacity-40"
      >
        🔔 Notificações ativas
      </button>
    );
  }

  return (
    <button
      onClick={ativar}
      disabled={aProcessar}
      className="mb-3 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
    >
      {aProcessar ? "A ativar…" : "🔔 Ativar notificações"}
    </button>
  );
}
