export const CLIENTE_ID_STORAGE_KEY = "polla_cliente_id";

export function getOrCreateClienteId(): string {
  const existing = window.localStorage.getItem(CLIENTE_ID_STORAGE_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(CLIENTE_ID_STORAGE_KEY, id);
  return id;
}

export function getClienteId(): string | null {
  return window.localStorage.getItem(CLIENTE_ID_STORAGE_KEY);
}
