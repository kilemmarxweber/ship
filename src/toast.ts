import type { Href } from "expo-router";
import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export type ToastAction = {
  href: Href;
  label?: string;
  image?: string | null;
};

type ToastState = {
  id: number;
  message: string | null;
  kind: ToastKind;
  action: ToastAction | null;
  show: (
    message: string,
    kind?: ToastKind,
    action?: ToastAction | null,
  ) => void;
  hide: () => void;
};

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  id: 0,
  message: null,
  kind: "info",
  action: null,
  show: (message, kind = "info", action = null) =>
    set({ id: nextId++, message, kind, action: action ?? null }),
  hide: () => set({ message: null, action: null }),
}));

export function showToast(
  message: string,
  kind: ToastKind = "info",
  action?: ToastAction | null,
) {
  useToast.getState().show(message, kind, action);
}
