"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Account, Item } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export type CartLine = {
  item_id: string;
  sku: string;
  brand: string;
  name: string;
  value: number;
  image_path: string | null;
  qty: number;
  order_multiple: number;
  max_per_order: number | null;
  stock: number;
};

export type CartContact = { id?: string; name: string; mobile: string; email: string };

type CartState = {
  account: Account | null;
  contact: CartContact | null;
  lines: CartLine[];
};

type CartContextValue = CartState & {
  ready: boolean;
  setAccount: (account: Account | null) => void;
  setContact: (contact: CartContact | null) => void;
  setQty: (item: Item, qty: number) => void;
  addItem: (item: Item, qty: number) => void;
  removeItem: (itemId: string) => void;
  clear: (opts?: { keepAccount?: boolean }) => void;
  count: number;
  total: number;
};

const STORAGE_KEY = "posmshop-cart-v1";
const empty: CartState = { account: null, contact: null, lines: [] };

const CartContext = createContext<CartContextValue | null>(null);

function toLine(item: Item, qty: number): CartLine {
  return {
    item_id: item.id,
    sku: item.sku,
    brand: item.brand,
    name: item.name,
    value: Number(item.value),
    image_path: item.image_path,
    qty,
    order_multiple: item.order_multiple,
    max_per_order: item.max_per_order,
    stock: item.stock,
  };
}

export function CartProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(empty);
  const [ready, setReady] = useState(false);
  const key = `${STORAGE_KEY}:${userId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState({ ...empty, ...JSON.parse(raw) });
    } catch {
      // ignore unreadable storage
    }
    setReady(true);
  }, [key]);

  // The saved outlet can go stale (e.g. its market or name changed after an Excel upload).
  // Re-read it from the database once per visit; drop the cart if the outlet no longer exists.
  const accountId = state.account?.id;
  useEffect(() => {
    if (!ready || !accountId) return;
    let cancelled = false;
    createClient()
      .from("accounts")
      .select("id, account_number, name, parent_number, parent_name, kam_name, market, channel")
      .eq("id", accountId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setState((s) => {
          if (s.account?.id !== accountId) return s;
          if (!data) return empty;
          const fresh = data as Account;
          return JSON.stringify(fresh) === JSON.stringify(s.account) ? s : { ...s, account: fresh };
        });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accountId]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage unavailable (private mode) — cart lives in memory only
    }
  }, [key, ready, state]);

  const setAccount = useCallback((account: Account | null) => {
    setState((s) =>
      s.account?.id === account?.id
        ? { ...s, account }
        : // Changing account resets the contact and the cart: market visibility may differ.
          { account, contact: null, lines: [] },
    );
  }, []);

  const setContact = useCallback((contact: CartContact | null) => setState((s) => ({ ...s, contact })), []);

  const setQty = useCallback((item: Item, qty: number) => {
    setState((s) => {
      if (qty <= 0) return { ...s, lines: s.lines.filter((l) => l.item_id !== item.id) };
      const exists = s.lines.some((l) => l.item_id === item.id);
      return {
        ...s,
        lines: exists
          ? s.lines.map((l) => (l.item_id === item.id ? { ...toLine(item, qty) } : l))
          : [...s.lines, toLine(item, qty)],
      };
    });
  }, []);

  const addItem = useCallback(
    (item: Item, qty: number) => {
      setQty(item, qty);
    },
    [setQty],
  );

  const removeItem = useCallback(
    (itemId: string) => setState((s) => ({ ...s, lines: s.lines.filter((l) => l.item_id !== itemId) })),
    [],
  );

  const clear = useCallback(
    (opts?: { keepAccount?: boolean }) =>
      setState((s) => (opts?.keepAccount ? { ...s, lines: [] } : empty)),
    [],
  );

  const value = useMemo<CartContextValue>(() => {
    const count = state.lines.reduce((n, l) => n + l.qty, 0);
    const total = state.lines.reduce((n, l) => n + l.qty * l.value, 0);
    return { ...state, ready, setAccount, setContact, setQty, addItem, removeItem, clear, count, total };
  }, [state, ready, setAccount, setContact, setQty, addItem, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
