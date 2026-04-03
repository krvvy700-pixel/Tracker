'use client';

import { useState, useEffect } from 'react';
import { TRACKING_STAGES, STAGE_ICONS } from '@/lib/constants';

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

interface TrackingHistory {
  status: string;
  created_at: string;
  notes: string;
}

export default function TrackingTokenPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [history, setHistory] = useState<TrackingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const res = await fetch(`/api/track?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Order not found');
        } else {
          setOrder(data.order);
          setHistory(data.history || []);
        }
      } catch {
        setError('Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchTracking();
  }, [token]);

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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="tracking-page">
        <div className="tracking-container">
          <div className="loading-overlay" style={{ minHeight: '60vh' }}>
            <div className="spinner spinner-lg"></div>
            <p>Loading your order...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracking-page">
        <div className="tracking-container">
          <div className="tracking-header">
            <h1>📦 Track Your Order</h1>
          </div>
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <a href="/track" className="btn btn-ghost">
              ← Try searching by Order ID
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="tracking-page">
      <div className="tracking-container">
        <div className="tracking-header">
          <h1>📦 Order Tracking</h1>
          <p>Real-time delivery status for your order</p>
        </div>

        <div className="tracking-result">
          <div className="tracking-order-card">
            <div className="tracking-order-header">
              <div>
                <div className="tracking-order-id">{order.order_id}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <span className={`status-badge status-${(order.is_cancelled ? 'cancelled' : order.tracking_status).toLowerCase().replace(/\s+/g, '-')}`}>
                {STAGE_ICONS[order.is_cancelled ? 'Cancelled' : order.tracking_status]}{' '}
                {order.is_cancelled ? 'Cancelled' : order.tracking_status}
              </span>
            </div>

            <div className="tracking-order-body">
              <div className="order-details-grid">
                <div className="order-detail-item">
                  <div className="order-detail-label">Customer</div>
                  <div className="order-detail-value">{order.customer_name}</div>
                </div>
                <div className="order-detail-item">
                  <div className="order-detail-label">Payment</div>
                  <div className="order-detail-value">
                    <span className={`payment-badge ${order.payment_method === 'COD' ? 'payment-cod' : 'payment-prepaid'}`}>
                      {order.payment_method === 'COD' ? '💵 COD' : '💳 Prepaid'}
                    </span>
                  </div>
                </div>
                <div className="order-detail-item">
                  <div className="order-detail-label">Delivering To</div>
                  <div className="order-detail-value" style={{ fontSize: 13 }}>
                    {order.city}, {order.state} — {order.pincode}
                  </div>
                </div>
                <div className="order-detail-item">
                  <div className="order-detail-label">Order Total</div>
                  <div className="order-detail-value" style={{ color: 'var(--accent-primary-hover)' }}>
                    ₹{Number(order.order_total).toFixed(0)}
                  </div>
                </div>
              </div>

              {order.tracking_id && (
                <div className="alert alert-info" style={{ marginBottom: 24 }}>
                  <span>🚚</span>
                  <div>
                    <strong>Tracking ID:</strong> {order.tracking_id}
                    {order.courier_partner && <> • <strong>Courier:</strong> {order.courier_partner}</>}
                  </div>
                </div>
              )}

              {order.estimated_delivery && (
                <div className="alert alert-success" style={{ marginBottom: 24 }}>
                  <span>📅</span>
                  <div>
                    <strong>Estimated Delivery:</strong>{' '}
                    {new Date(order.estimated_delivery).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
                  Delivery Timeline
                </h3>
                <div className="timeline">
                  {TRACKING_STAGES.map((stage) => {
                    const state = getStageState(stage);
                    const timestamp = getTimestamp(stage);
                    return (
                      <div key={stage} className={`timeline-item ${state}`}>
                        <div className="timeline-line"></div>
                        <div className="timeline-dot">
                          {state === 'completed' ? '✓' : STAGE_ICONS[stage]}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-title">{stage}</div>
                          {timestamp && <div className="timeline-time">{timestamp}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="items-list">
                <div className="items-list-title">Order Items</div>
                {order.order_items?.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-name">{item.product_name}</div>
                    <span className="item-brand">{item.brand}</span>
                    <span className="item-qty">×{item.quantity}</span>
                    <span className="item-price">₹{Number(item.price).toFixed(0)}</span>
                  </div>
                ))}
                <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                  Total: ₹{Number(order.order_total).toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          <p>Need help? Contact us at support@yourdomain.com</p>
        </div>
      </div>
    </div>
  );
}
