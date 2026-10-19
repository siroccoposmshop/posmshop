export type Role = "kam" | "admin";

export type Market = {
  code: string;
  name: string;
  cs_email: string | null;
  delivery_days: number;
  currency: string;
  sort: number;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  market: string | null;
  active: boolean;
};

/** An outlet. Outlets sit under a parent account (first 5 digits of the account number). */
export type Account = {
  id: string;
  account_number: string;
  name: string;
  parent_number: string;
  parent_name: string;
  kam_name: string | null;
  market: string;
  channel: string | null;
};

export type ParentAccount = {
  parent_number: string;
  parent_name: string;
  market: string;
  kam_name: string | null;
  outlet_count: number;
};

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  mobile: string;
  email: string;
};

export type Item = {
  id: string;
  sku: string;
  brand: string;
  name: string;
  category: string | null;
  value: number;
  stock: number;
  max_per_order: number | null;
  order_multiple: number;
  markets: string[];
  visible: boolean;
  eta: string | null;
  months_of_stock: number | null;
  delisted: boolean;
  image_path: string | null;
  description: string | null;
};

export type OrderStatus = "submitted" | "processing" | "dispatched" | "delivered" | "cancelled";

export type Order = {
  id: string;
  order_number: string;
  account_id: string;
  account_number: string;
  account_name: string;
  parent_number: string | null;
  parent_name: string | null;
  market: string;
  kam_id: string;
  kam_name: string | null;
  kam_email: string;
  contact_name: string;
  contact_mobile: string;
  contact_email: string;
  notes: string | null;
  total_value: number;
  currency: string;
  status: OrderStatus;
  emails_sent_at: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  item_id: string | null;
  sku: string;
  brand: string;
  name: string;
  category: string | null;
  image_path: string | null;
  qty: number;
  unit_value: number;
  line_value: number;
};
