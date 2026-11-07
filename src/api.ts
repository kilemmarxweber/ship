import Constants from "expo-constants";
import { Platform } from "react-native";

import { useSession } from "@/src/session";

function devHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  if (Platform.OS === "android") return "10.0.2.2";
  return "localhost";
}

const PROD_API = "https://shipshop.klambocore.com";

export function apiOrigin() {
  // Dev : EXPO_PUBLIC_API_URL > localhost shop. Ne pas prendre extra.apiUrl
  // (souvent la prod) sinon le picker events / toggle challenges voient une autre DB.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (__DEV__) return `http://${devHost()}:3000`;
  const extraUrl = String(
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
      "",
  )
    .trim()
    .replace(/\/$/, "");
  if (extraUrl) return extraUrl;
  return PROD_API;
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
    return trimmed.replace(
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
      apiOrigin(),
    );
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = apiOrigin();
  return `${origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

/** Alias used by offline media prefetch / cache writers. */
export function remoteMediaUrl(path: string | null | undefined) {
  return mediaUrl(path);
}

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|mkv|avi|3gp)(\?|$)/i.test(url);
}

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(
    status: number,
    message: string,
    body: Record<string, unknown> = {},
  ) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function cleanApiMessage(raw: string, fallback: string) {
  if (/<!DOCTYPE|<html|turbopack|__nextjs/i.test(raw)) return fallback;
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !text ||
    /internal server error|unexpected token|JSON Parse/i.test(text)
  ) {
    return fallback;
  }
  return text.slice(0, 180);
}

function readApiBody(text: string): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { error: String(parsed) };
  } catch {
    return {};
  }
}

function failFromResponse(
  status: number,
  text: string,
  fallback: string,
): never {
  const data = readApiBody(text);
  const raw =
    (typeof data.error === "string" && data.error) ||
    (typeof data.message === "string" && data.message) ||
    text;
  throw new ApiError(status, cleanApiMessage(raw, fallback), data);
}

function requestHeaders(init?: RequestInit) {
  const token = useSession.getState().token;
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Origin", "shipshop://app");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function authHeaderMap() {
  const token = useSession.getState().token;
  const headers: Record<string, string> = {
    Origin: "shipshop://app",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiDownloadFile(
  path: string,
  fileName: string,
): Promise<{ uri: string; mimeType: string }> {
  const url = `${apiOrigin()}${path}`;
  if (Platform.OS === "web") {
    const response = await fetch(url, {
      headers: { ...authHeaderMap(), Accept: "*/*" },
    });
    const textOrBlobOk = response.ok;
    if (!textOrBlobOk) {
      const text = await response.text();
      failFromResponse(
        response.status,
        text,
        "Téléchargement du son impossible",
      );
    }
    const blob = await response.blob();
    return {
      uri: URL.createObjectURL(blob),
      mimeType: blob.type || "audio/mpeg",
    };
  }

  const FileSystem = await import("expo-file-system/legacy");
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  const dest = `${FileSystem.cacheDirectory ?? ""}${safeName}`;
  const result = await FileSystem.downloadAsync(url, dest, {
    headers: authHeaderMap(),
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error("Téléchargement du son impossible");
  }
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (info.size ?? 0) < 256) {
    throw new Error("Fichier audio illisible");
  }
  const mimeType =
    result.headers?.["Content-Type"] ||
    result.headers?.["content-type"] ||
    "audio/mpeg";
  const uri = result.uri.startsWith("file://")
    ? result.uri
    : `file://${result.uri}`;
  return { uri, mimeType };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    ...init,
    headers: requestHeaders(init),
  });
  const text = await response.text();
  if (!response.ok) {
    failFromResponse(response.status, text, "Requête impossible");
  }
  return readApiBody(text) as T;
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = useSession.getState().token;
  const url = `${apiOrigin()}${path}`;
  const text =
    Platform.OS === "web"
      ? await webUpload(url, form, token)
      : await nativeUpload(url, form, token);
  return readApiBody(text) as T;
}

async function webUpload(url: string, form: FormData, token: string | null) {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Origin", "shipshop://app");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { method: "POST", headers, body: form });
  const text = await response.text();
  if (!response.ok) {
    failFromResponse(response.status, text, "Envoi du média impossible");
  }
  return text;
}

function nativeUpload(url: string, form: FormData, token: string | null) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Origin", "shipshop://app");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      const text = xhr.responseText ?? "";
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(text);
        return;
      }
      try {
        failFromResponse(xhr.status, text, "Envoi du média impossible");
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () =>
      reject(new Error("Envoi du média impossible — vérifie le réseau"));
    xhr.ontimeout = () => reject(new Error("Envoi du média trop long"));
    xhr.timeout = 120_000;
    xhr.send(form);
  });
}

export async function apiPayment<T>(
  path: string,
  init: RequestInit & {
    idempotencyKey: string;
    replayScope?: "CHECKOUT" | "ORDER" | "WITHDRAW" | "GIFT" | "TICKET";
  },
): Promise<T> {
  const { idempotencyKey, replayScope, ...rest } = init;
  const headers = requestHeaders(rest);
  headers.set("Idempotency-Key", idempotencyKey);
  try {
    const response = await fetch(`${apiOrigin()}${path}`, {
      ...rest,
      headers,
    });
    const text = await response.text();
    if (!response.ok) {
      failFromResponse(response.status, text, "Paiement impossible");
    }
    return readApiBody(text) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const scope = replayScope ?? "CHECKOUT";
    const replay = await fetch(
      `${apiOrigin()}/api/payments/replay?scope=${encodeURIComponent(scope)}&key=${encodeURIComponent(idempotencyKey)}`,
      { headers: requestHeaders() },
    );
    const text = await replay.text();
    if (replay.ok) return readApiBody(text) as T;
    throw new Error("Connexion interrompue — vérifie tes commandes");
  }
}

export async function authRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "shipshop://app",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    failFromResponse(response.status, text, "Connexion impossible");
  }
  const data = readApiBody(text);
  return {
    data,
    token: response.headers.get("set-auth-token"),
  };
}
