import { CSV_COLUMN_MAP } from './constants';

export interface CleanedOrder {
  order_id: string;
  shopify_id: string;
  payment_method: string;
  financial_status: string;
  customer_name: string;
  customer_email: string;
  customer_mobile: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  pincode: string;
  is_cancelled: boolean;
  order_total: number;
  items: CleanedItem[];
}

export interface CleanedItem {
  brand: string;
  product_name: string;
  quantity: number;
  price: number;
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  // Remove country code prefix (91 for India)
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  // Return last 10 digits
  return cleaned.slice(-10);
}

function cleanString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function cleanCSVData(rawRows: Record<string, string>[]): {
  orders: CleanedOrder[];
  stats: { total: number; unique: number; multiItem: number; cancelled: number };
} {
  const orderMap = new Map<string, CleanedOrder>();

  for (const row of rawRows) {
    const orderId = cleanString(row[CSV_COLUMN_MAP.order_id]);
    if (!orderId) continue;

    const item: CleanedItem = {
      brand: cleanString(row[CSV_COLUMN_MAP.brand]),
      product_name: cleanString(row[CSV_COLUMN_MAP.product_name]),
      quantity: parseInt(cleanString(row[CSV_COLUMN_MAP.quantity])) || 1,
      price: parseFloat(cleanString(row[CSV_COLUMN_MAP.price])) || 0,
    };

    if (orderMap.has(orderId)) {
      // Multi-line-item order — just add the item
      const existing = orderMap.get(orderId)!;
      existing.items.push(item);
      existing.order_total += item.price * item.quantity;
    } else {
      // New order
      const customerName =
        cleanString(row[CSV_COLUMN_MAP.customer_name]) ||
        cleanString(row[CSV_COLUMN_MAP.customer_name_fallback]) ||
        'Unknown';

      const phone =
        normalizePhone(cleanString(row[CSV_COLUMN_MAP.phone])) ||
        normalizePhone(cleanString(row[CSV_COLUMN_MAP.billing_phone]));

      const paymentMethod = cleanString(row[CSV_COLUMN_MAP.payment_method]);
      const cancelledAt = cleanString(row[CSV_COLUMN_MAP.cancelled_at]);

      const order: CleanedOrder = {
        order_id: orderId,
        shopify_id: cleanString(row[CSV_COLUMN_MAP.shopify_id]),
        payment_method: paymentMethod || 'COD',
        financial_status: cleanString(row[CSV_COLUMN_MAP.financial_status]) || 'paid',
        customer_name: customerName,
        customer_email: cleanString(row[CSV_COLUMN_MAP.email]),
        customer_mobile: phone,
        address_line1: cleanString(row[CSV_COLUMN_MAP.address_line1]),
        address_line2: cleanString(row[CSV_COLUMN_MAP.address_line2]),
        address_line3: cleanString(row[CSV_COLUMN_MAP.address_line3]),
        city: cleanString(row[CSV_COLUMN_MAP.city]),
        state: cleanString(row[CSV_COLUMN_MAP.state]),
        pincode: cleanString(row[CSV_COLUMN_MAP.pincode]),
        is_cancelled: !!cancelledAt,
        order_total: item.price * item.quantity,
        items: [item],
      };

      orderMap.set(orderId, order);
    }
  }

  const orders = Array.from(orderMap.values());
  const cancelled = orders.filter((o) => o.is_cancelled).length;

  return {
    orders,
    stats: {
      total: rawRows.length,
      unique: orders.length,
      multiItem: orders.filter((o) => o.items.length > 1).length,
      cancelled,
    },
  };
}
