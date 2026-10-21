import { useSyncExternalStore } from "react";

export type ParcelStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed";

export type FailureCode =
  | "CUSTOMER_UNREACHABLE"
  | "WRONG_ADDRESS"
  | "REFUSED_COD"
  | "RESCHEDULED_BY_CUSTOMER";

export const FAILURE_REASONS: { code: FailureCode; label: string }[] = [
  { code: "CUSTOMER_UNREACHABLE", label: "Customer Unreachable" },
  { code: "WRONG_ADDRESS", label: "Wrong Address" },
  { code: "REFUSED_COD", label: "Refused COD" },
  { code: "RESCHEDULED_BY_CUSTOMER", label: "Rescheduled by Customer" },
];

export interface Parcel {
  id: string;
  recipient: string;
  phone: string;
  from: string;
  to: string;
  address: string;
  item: string;
  qty: number;
  weightKg: number;
  status: ParcelStatus;
  codAmount: number;
  codCollected?: number;
  shop: string;
  shopLocation: string;
  notes?: string;
  pickedUpAt?: string;
  completedAt?: string;
  failureCode?: FailureCode;
}

const seed: Parcel[] = [
  { id: "MM250430001", recipient: "Aye Aye Mon", phone: "09 421 556 781", from: "Mandalay", to: "Yangon", address: "No. 12, Bo Gyoke Rd, Kamayut Tsp, Yangon", item: "Women T-Shirt", qty: 1, weightKg: 0.5, status: "pending", codAmount: 25000, shop: "Shwe Shop", shopLocation: "Yangon, Myanmar", notes: "Call before arrival." },
  { id: "MM250430002", recipient: "Ko Min Thu", phone: "09 785 223 104", from: "Yangon", to: "Bago", address: "45, Strand Rd, Bago", item: "Electronics", qty: 1, weightKg: 1.2, status: "picked_up", codAmount: 0, shop: "Tech Zone", shopLocation: "Yangon, Myanmar", pickedUpAt: "2026-10-21T08:15:00Z" },
  { id: "MM250430003", recipient: "Hsu Myat", phone: "09 954 110 223", from: "Yangon", to: "Taunggyi", address: "88, Merchant St, Taunggyi", item: "Books", qty: 2, weightKg: 1.0, status: "in_transit", codAmount: 18000, shop: "Book Corner", shopLocation: "Yangon, Myanmar" },
  { id: "MM250430004", recipient: "Ei Ei Phyu", phone: "09 260 778 900", from: "Yangon", to: "Nay Pyi Taw", address: "Zabu Thiri Tsp, Nay Pyi Taw", item: "Clothing", qty: 3, weightKg: 1.8, status: "out_for_delivery", codAmount: 42000, shop: "Shwe Shop", shopLocation: "Yangon, Myanmar", notes: "Leave at reception if absent." },
  { id: "MM250430005", recipient: "Zaw Lin", phone: "09 330 456 712", from: "Yangon", to: "Yangon", address: "21, Pyay Rd, Hlaing Tsp, Yangon", item: "Shoes", qty: 1, weightKg: 0.9, status: "in_transit", codAmount: 35000, shop: "Step Up", shopLocation: "Yangon, Myanmar" },
  { id: "MM250430006", recipient: "Thandar Win", phone: "09 512 667 889", from: "Yangon", to: "Yangon", address: "7, Inya Rd, Yangon", item: "Cosmetics", qty: 2, weightKg: 0.4, status: "delivered", codAmount: 15000, codCollected: 15000, shop: "Glow Beauty", shopLocation: "Yangon, Myanmar", completedAt: "2026-10-21T06:40:00Z" },
];

const KEY = "rider-parcels-v1";
let state: Parcel[] = seed;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}
function save(next: Parcel[]) {
  state = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}
function update(id: string, patch: Partial<Parcel>) {
  load();
  save(state.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function useParcels(): Parcel[] {
  return useSyncExternalStore(
    (cb) => {
      load();
      listeners.add(cb);
      cb();
      return () => listeners.delete(cb);
    },
    () => state,
    () => seed,
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulated API calls — swap for real backend later. */
export const riderApi = {
  async findParcel(code: string): Promise<Parcel | null> {
    load();
    await wait(300);
    return state.find((p) => p.id === code.trim().toUpperCase()) ?? null;
  },
  async confirmPickup(id: string) {
    await wait(700);
    update(id, { status: "picked_up", pickedUpAt: new Date().toISOString() });
  },
  async markDelivered(id: string, codCollected: number) {
    await wait(600);
    update(id, { status: "delivered", codCollected, completedAt: new Date().toISOString() });
  },
  async markFailed(id: string, failureCode: FailureCode) {
    await wait(600);
    update(id, { status: "failed", failureCode, completedAt: new Date().toISOString() });
  },
  async advance(id: string, status: ParcelStatus) {
    await wait(300);
    update(id, { status });
  },
  reset() {
    save(seed);
  },
};

export const formatMMK = (n: number) => `${n.toLocaleString("en-US")} Ks`;
export const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
