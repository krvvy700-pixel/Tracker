'use client';

import { useState, FormEvent } from 'react';
import { TRACKING_STAGES } from '@/lib/constants';
import { Package, Search, Loader2, AlertCircle, Truck, Calendar, Check, X as XIcon } from 'lucide-react';

interface OrderItem {
  brand: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface TrackingOrder {
  order_id: string;
  customer_name: string;
  tracking_status: string;
  tracking_id: string;
  courier_partner: string;
  status_updated_at: string;
  estimated_delivery: string;
  order_total: number;
  payment_method: string;
  is_cancelled: boolean;
  city: string;
  state: string;
  pincode: string;
  created_at: string;
  order_items: OrderItem[];
}

interface Business {
  name: string;
  logo_url: string;
  support_email: string;
  support_phone: string;
}

interface TrackingHistory {
  status: string;
  created_at: string;
  notes: string;
}

export default function TrackingPage() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [history, setHistory] = useState<TrackingHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setBusiness(null);
    setLoading(true);

    try {
      let searchId = orderId.trim();
      if (!searchId.startsWith('#')) searchId = '#' + searchId;

      const params = new URLSearchParams({ orderId: searchId, phone });
      const res = await fetch(`/api/track?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Order not found');
      } else {
        setOrder(data.order);
        setBusiness(data.business || null);
        setHistory(data.history || []);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStageState = (stage: string) => {
    if (!order) return 'pending';
    if (order.is_cancelled) {
      const currentIdx = TRACKING_STAGES.indexOf(order.tracking_status as typeof TRACKING_STAGES[number]);
      const stageIdx = TRACKING_STAGES.indexOf(stage as typeof TRACKING_STAGES[number]);
      if (stageIdx < currentIdx) return 'completed';
      if (stage === order.tracking_status) return 'cancelled';
      return 'pending';
    }
    const currentIdx = TRACKING_STAGES.indexOf(order.tracking_status as typeof TRACKING_STAGES[number]);
    const stageIdx = TRACKING_STAGES.indexOf(stage as typeof TRACKING_STAGES[number]);
    if (stageIdx < currentIdx) return 'completed';
    if (stageIdx === currentIdx) return 'active';
    return 'pending';
  };

  const getTimestamp = (stage: string) => {
    const entry = history.find((h) => h.status === stage);
    if (!entry) return null;
    return new Date(entry.created_at).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const brandName = business?.name || 'TrackFlow';
  const supportEmail = business?.support_email || 'support@trackflow.com';

  return (
    <div className="tracking-page">
      {/* Header */}
      <div className="tracking-header">
        <div className="tracking-header-inner">
          <div className="tracking-logo">
            {business?.logo_url ? (
              <img src={business.logo_url} alt={brandName} />
            ) : (
              <Package size={16} />
            )}
          </div>
          <span className="tracking-brand-name">{brandName}</span>
        </div>
      </div>

      <div className="tracking-body">
        {/* Search card */}
        <div className="tf-card animate-fade-in-up" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 className="page-title" style={{ marginBottom: '0.25rem' }}>Track Your Order</h2>
          <p className="page-subtitle" style={{ marginBottom: '1.25rem' }}>Enter your Order ID and the last 4 digits of your phone number</p>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Order ID (e.g., 3594)"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Last 4 digits of phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={4}
                  required
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ gap: '0.5rem' }}>
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Search size={16} />}
                  Track
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="alert-band alert-error-band animate-fade-in-up" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {order && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Summary card */}
            <div className="tf-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Order {order.order_id}</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>
                    Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <span className={`status-pill ${getStatusPillClass(order)}`}>
                  {order.is_cancelled ? 'Cancelled' : order.tracking_status}
                </span>
              </div>

              <div className="order-summary-grid">
                <div>
                  <p className="order-summary-label">Customer</p>
                  <p className="order-summary-value">{order.customer_name}</p>
                </div>
                <div>
                  <p className="order-summary-label">Payment</p>
                  <p className="order-summary-value">{order.payment_method}</p>
                </div>
                <div>
                  <p className="order-summary-label">Address</p>
                  <p className="order-summary-value">{order.city}, {order.state}</p>
                </div>
                <div>
                  <p className="order-summary-label">Total</p>
                  <p className="order-summary-value">₹{Number(order.order_total).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Courier info */}
            {order.tracking_id && (
              <div className="alert-band alert-info-band">
                <Truck size={16} />
                <div style={{ fontSize: '0.875rem' }}>
                  <strong>{order.courier_partner}</strong>
                  <span style={{ color: 'var(--fg-muted)' }}> • {order.tracking_id}</span>
                </div>
              </div>
            )}

            {/* Estimated delivery */}
            {order.estimated_delivery && (
              <div className="alert-band alert-success-band">
                <Calendar size={16} />
                <div style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--fg-muted)' }}>Estimated delivery: </span>
                  <strong>{new Date(order.estimated_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="tf-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.25rem' }}>Delivery Timeline</h3>
              <div className="timeline">
                {TRACKING_STAGES.map((stage, idx) => {
                  const state = getStageState(stage);
                  const timestamp = getTimestamp(stage);
                  const isLast = idx === TRACKING_STAGES.length - 1;
                  return (
                    <div key={stage} className="timeline-step">
                      <div className="timeline-track">
                        <div className={`timeline-dot timeline-dot-${state}`}>
                          {state === 'completed' && <Check size={8} />}
                        </div>
                        {!isLast && (
                          <div className={`timeline-line ${state === 'completed' ? 'timeline-line-completed' : 'timeline-line-pending'}`} />
                        )}
                      </div>
                      <div className="timeline-label">
                        <p className={`timeline-label-text ${state}`}>{stage}</p>
                        {timestamp && <p className="timeline-label-time">{timestamp}</p>}
                        {state === 'completed' && !timestamp && <p className="timeline-label-time">Completed</p>}
                      </div>
                    </div>
                  );
                })}
                {order.is_cancelled && (
                  <div className="timeline-step" style={{ marginTop: '0.5rem' }}>
                    <div className="timeline-track">
                      <div className="timeline-dot timeline-dot-cancelled">
                        <XIcon size={8} />
                      </div>
                    </div>
                    <div className="timeline-label">
                      <p className="timeline-label-text cancelled">Cancelled</p>
                      {order.status_updated_at && (
                        <p className="timeline-label-time">{new Date(order.status_updated_at).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            {order.order_items && order.order_items.length > 0 && (
              <div className="tf-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={16} /> Order Items
                </h3>
                <div className="items-list">
                  {order.order_items.map((item, i) => (
                    <div key={i} className="item-row">
                      <div className="item-info">
                        <div className="item-name">{item.product_name}</div>
                        <span className="item-brand-tag">{item.brand}</span>
                      </div>
                      <div className="item-pricing">
                        <div className="item-price">₹{Number(item.price).toLocaleString()}</div>
                        <div className="item-qty">×{item.quantity}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="items-total" style={{ marginTop: '0.75rem' }}>
                  <span className="items-total-label">Total</span>
                  <span className="items-total-value">₹{Number(order.order_total).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="tracking-footer">
        Need help? Contact us at {supportEmail}
      </div>
    </div>
  );
}

function getStatusPillClass(order: { is_cancelled: boolean; tracking_status: string }) {
  const status = order.is_cancelled ? 'Cancelled' : order.tracking_status;
  const map: Record<string, string> = {
    'Order Placed': 'status-pill-placed',
    'Processing': 'status-pill-processing',
    'Packed': 'status-pill-packed',
    'Shipped': 'status-pill-shipped',
    'In Transit': 'status-pill-transit',
    'Out for Delivery': 'status-pill-out',
    'Delivered': 'status-pill-delivered',
    'Cancelled': 'status-pill-cancelled',
    'RTO': 'status-pill-rto',
  };
  return map[status] || 'status-pill-default';
}
