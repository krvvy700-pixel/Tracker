'use client';

import { useState, useEffect } from 'react';
import { Package, Loader2, AlertCircle, ArrowLeft, MapPin, Truck, Flame, ClipboardCheck, PackageCheck, CheckCircle } from 'lucide-react';

interface OrderItem { brand: string; product_name: string; quantity: number; price: number; }
interface TrackingOrder {
  order_id: string; customer_name: string; tracking_status: string; tracking_id: string;
  courier_partner: string; status_updated_at: string; estimated_delivery: string;
  order_total: number; is_cancelled: boolean; city: string; state: string; created_at: string;
  order_items: OrderItem[];
}
interface Business { name: string; logo_url: string; support_email: string; support_phone: string; }
interface TrackingHistory { status: string; created_at: string; notes: string; }

/* ═══ TIMELINE ═══ */
const STEPS = [
  { label: 'Order\nBooked', icon: ClipboardCheck, key: 'booked' },
  { label: 'Pickup\nCompleted', icon: PackageCheck, key: 'pickup' },
  { label: 'In-Transit', icon: Truck, key: 'transit' },
  { label: 'Out For\nDelivery', icon: MapPin, key: 'out' },
  { label: 'Delivered', icon: CheckCircle, key: 'delivered' },
];
const statusToStep: Record<string, number> = {
  'order placed': 0, processing: 0, packed: 1, shipped: 1,
  'in transit': 2, 'out for delivery': 3, delivered: 4,
};

const getStatusColor = (s: string, c: boolean) => {
  if (c) return 'var(--danger)';
  if (s.toLowerCase() === 'delivered') return 'var(--success)';
  return 'var(--fg)';
};

const getDisplayStatus = (s: string, c: boolean) => {
  if (c) return 'Cancelled';
  const m: Record<string, string> = {
    'order placed': 'Order Placed', processing: 'Processing', packed: 'Packed',
    shipped: 'Shipped', 'in transit': 'In Transit', 'out for delivery': 'Out For Delivery',
    delivered: 'Delivered', rto: 'RTO In Transit',
  };
  return m[s.toLowerCase()] || s;
};

export default function TrackingTokenPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [history, setHistory] = useState<TrackingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/track?token=${token}`);
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Order not found');
        else { setOrder(data.order); setBusiness(data.business || null); setHistory(data.history || []); }
      } catch { setError('Something went wrong'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const brandName = business?.name || 'Order Tracking';

  if (loading) return (
    <div className="tracking-page">
      <Header brandName={brandName} />
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={32} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--primary)' }} />
      </div>
    </div>
  );

  if (error || !order) return (
    <div className="tracking-page">
      <Header brandName={brandName} />
      <div className="tracking-body">
        <div className="tf-card animate-fade-in-up" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 0.75rem' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Order Not Found</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>This tracking link may be invalid or expired.</p>
          <a href="/track" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.5rem' }}><ArrowLeft size={16} /> Search by Order ID</a>
        </div>
      </div>
    </div>
  );

  const currentStep = order.is_cancelled ? -1 : (statusToStep[order.tracking_status.toLowerCase()] ?? -1);
  const isRTO = order.tracking_status.toLowerCase() === 'rto';

  // Build activities from history
  const activities = history.map((h, i) => ({
    date: new Date(h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    time: new Date(h.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    activity: h.status + (h.notes ? ` — ${h.notes}` : ''),
    isCurrent: i === history.length - 1,
  }));

  return (
    <div className="tracking-page">
      <Header brandName={brandName} />

      <main className="tracking-body animate-fade-in-up">
        {/* ═══ TWO COLUMN LAYOUT ═══ */}
        <div className="remix-grid">
          {/* LEFT: Status + Delivery + Details */}
          <div className="remix-left">
            {/* Order Status */}
            <div className="tf-card" style={{ padding: '1.5rem' }}>
              <p className="section-label" style={{ marginBottom: '0.25rem' }}>Order Status</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: getStatusColor(order.tracking_status, order.is_cancelled) }}>
                {getDisplayStatus(order.tracking_status, order.is_cancelled)}
              </p>
            </div>

            {/* Estimated Delivery */}
            {order.estimated_delivery && (
              <div className="tf-card" style={{ padding: '1.5rem' }}>
                <p className="section-label" style={{ marginBottom: '0.25rem' }}>Estimated Delivery by</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg)' }}>
                  {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}

            {/* Order Details */}
            <div className="tf-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <MapPin size={18} />
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Order Details</span>
              </div>
              <div className="detail-table">
                {[
                  { label: 'Order ID', value: order.order_id },
                  { label: 'Delivery City', value: order.city },
                ].map((row, i, arr) => (
                  <div key={row.label} className="detail-row" style={i === arr.length - 1 ? { borderBottom: 'none' } : {}}>
                    <span className="detail-key">{row.label}</span>
                    <span className="detail-val">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Courier + Activities */}
          <div className="remix-right">
            <div className="tf-card" style={{ padding: '1.5rem' }}>
              {/* Courier Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Truck size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>
                  {order.courier_partner || 'Courier Partner'}
                </span>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
                TRACKING ID : <span style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '1rem' }}>{order.tracking_id || '—'}</span>
              </p>

              {/* Recent Activities */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Flame size={18} />
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Activities</span>
              </div>

              <div style={{ position: 'relative', marginLeft: '0.25rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {activities.length > 0 ? activities.map((act, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                    {/* Date/Time */}
                    <div style={{ width: '4rem', flexShrink: 0, textAlign: 'right', paddingRight: '0.5rem' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{act.date}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>{act.time}</p>
                    </div>
                    {/* Dot + Line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                      <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', marginTop: '0.25rem', flexShrink: 0, zIndex: 10, background: act.isCurrent ? 'var(--success)' : 'var(--fg-muted)' }} />
                      {i < activities.length - 1 && (
                        <div style={{ width: '1px', flex: 1, borderLeft: '2px dashed var(--border)', minHeight: '2.5rem' }} />
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ paddingBottom: '1.5rem', flex: 1 }}>
                      <p style={{ fontSize: '0.875rem', color: 'var(--fg)' }}>
                        <span style={{ fontWeight: 600 }}>Activity : </span>{act.activity}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>No activity yet — updates will appear here.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ TIMELINE BAR ═══ */}
        <div className="tf-card" style={{ padding: '1.5rem', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 0.5rem' }}>
            {/* Connector lines */}
            <div style={{ position: 'absolute', top: '1.5rem', left: 0, right: 0, display: 'flex', padding: '0 28px', zIndex: 0 }}>
              {STEPS.slice(0, -1).map((_, i) => (
                <div key={i} style={{ flex: 1, height: '2px', backgroundColor: i < currentStep ? 'var(--primary)' : 'var(--border)' }} />
              ))}
            </div>

            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isCompleted = !order.is_cancelled && i < currentStep;
              const isActive = !order.is_cancelled && i === currentStep;
              return (
                <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10, width: `${100 / STEPS.length}%` }}>
                  <div style={{
                    width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${isCompleted || isActive ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'white', transition: 'all 0.2s',
                    ...(isActive ? { animation: 'pulseDot 2s ease-in-out infinite' } : {}),
                  }}>
                    <Icon size={20} style={{ color: isCompleted || isActive ? 'var(--primary)' : 'var(--fg-muted)' }} strokeWidth={isCompleted || isActive ? 2.5 : 1.5} />
                  </div>
                  <span style={{
                    fontSize: '0.625rem', marginTop: '0.5rem', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3,
                    fontWeight: isCompleted || isActive ? 600 : 500,
                    color: isCompleted || isActive ? 'var(--fg)' : 'var(--fg-muted)',
                  }}>{step.label}</span>
                </div>
              );
            })}

            {/* RTO step — only shown when status is RTO */}
            {isRTO && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10, width: `${100 / (STEPS.length + 1)}%` }}>
                <div style={{
                  width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--danger)', background: 'white', animation: 'pulseDot 2s ease-in-out infinite',
                }}>
                  <Package size={20} style={{ color: 'var(--danger)' }} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '0.625rem', marginTop: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>RTO In{'\n'}Transit</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      {business && (
        <footer className="tracking-footer-brand">
          <div className="tracking-footer-inner" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <p style={{ fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Shipping </span>
                that fuels Ecommerce
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}> Success.</span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {business.support_phone && (
                <span style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>📞 {business.support_phone}</span>
              )}
              <span style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>📧 {business.support_email}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function Header({ brandName }: { brandName: string }) {
  return (
    <div className="tracking-header">
      <div className="tracking-header-inner" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>CN</span>
          </div>
          <span className="tracking-brand-name">{brandName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
          <span>Shipping</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Powered</span>
          <span>by</span>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.25rem' }}>
            <Package size={14} style={{ color: 'var(--primary)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
