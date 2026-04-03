'use client';

import { useState, useEffect } from 'react';
import { TRACKING_STAGES } from '@/lib/constants';
import { Package, Loader2, AlertCircle, ArrowLeft, Truck, Calendar, Check, X as XIcon } from 'lucide-react';

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

export default function TrackingTokenPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
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
          setBusiness(data.business || null);
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
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const brandName = business?.name || 'TrackFlow';
  const supportEmail = business?.support_email || 'support@trackflow.com';

  if (loading) {
    return (
      <div className="tracking-page">
        <div className="tracking-header">
          <div className="tracking-header-inner">
            <div className="tracking-logo"><Package size={16} /></div>
            <span className="tracking-brand-name">{brandName}</span>
          </div>
        </div>
        <div className="loading-center" style={{ minHeight: '60vh' }}>
          <Loader2 size={32} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--primary)' }} />
          <p>Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracking-page">
        <div className="tracking-header">
          <div className="tracking-header-inner">
            <div className="tracking-logo"><Package size={16} /></div>
            <span className="tracking-brand-name">{brandName}</span>
          </div>
        </div>
        <div className="tracking-body">
          <div className="tf-card animate-fade-in-up" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 0.75rem' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Order Not Found</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>This tracking link may be invalid or expired.</p>
            <a href="/track" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Search by Order ID
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

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
        <div className="space-y-4 animate-fade-in-up">
          {/* Summary */}
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

          {/* Courier */}
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
                <span>Estimated delivery: </span>
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
