'use client';

import { useState, FormEvent } from 'react';
import { Package, Search, Loader2, AlertCircle, MapPin, Truck, Flame, ClipboardCheck, PackageCheck, CheckCircle } from 'lucide-react';

interface OrderItem { brand: string; product_name: string; quantity: number; price: number; }
interface TrackingOrder {
  order_id: string; customer_name: string; tracking_status: string; tracking_id: string;
  courier_partner: string; estimated_delivery: string; order_total: number; is_cancelled: boolean;
  city: string; state: string; created_at: string; order_items: OrderItem[];
}
interface Business { name: string; logo_url: string; support_email: string; support_phone: string; }
interface TrackingHistory { status: string; created_at: string; notes: string; }

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
    setError(''); setOrder(null); setBusiness(null); setLoading(true);
    try {
      let sid = orderId.trim();
      if (!sid.startsWith('#')) sid = '#' + sid;
      const res = await fetch(`/api/track?orderId=${encodeURIComponent(sid)}&phone=${phone}`);
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Order not found');
      else { setOrder(data.order); setBusiness(data.business || null); setHistory(data.history || []); }
    } catch { setError('Something went wrong.'); }
    finally { setLoading(false); }
  };

  const brandName = business?.name || 'Order Tracking';
  const currentStep = order ? (order.is_cancelled ? -1 : (statusToStep[order.tracking_status.toLowerCase()] ?? -1)) : -1;
  const isRTO = order?.tracking_status.toLowerCase() === 'rto';

  const activities = history.map((h, i) => ({
    date: new Date(h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    time: new Date(h.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    activity: h.status + (h.notes ? ` — ${h.notes}` : ''),
    isCurrent: i === history.length - 1,
  }));

  return (
    <div className="tracking-page">
      {/* Header */}
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

      <main className="tracking-body">
        {/* Search Form */}
        {!order && (
          <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
            <form onSubmit={handleSearch} className="tf-card animate-fade-in-up" style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', textAlign: 'center', marginBottom: '1rem' }}>
                Your order tracking details are shown below
              </p>
              <input type="text" className="form-input" placeholder="Order ID (e.g., 3594)" value={orderId} onChange={(e) => setOrderId(e.target.value)} required style={{ marginBottom: '0.75rem' }} />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input type="text" className="form-input" placeholder="Last 4 digits of phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={4} required style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flexShrink: 0 }}>
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Search size={16} />}
                  Track
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="alert-band alert-error-band animate-fade-in-up" style={{ marginBottom: '1.5rem', maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}

        {/* Result — same 2-column layout */}
        {order && (
          <div className="animate-fade-in-up">
            <div className="remix-grid">
              {/* LEFT */}
              <div className="remix-left">
                <div className="tf-card" style={{ padding: '1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '0.25rem' }}>Order Status</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: getStatusColor(order.tracking_status, order.is_cancelled) }}>
                    {getDisplayStatus(order.tracking_status, order.is_cancelled)}
                  </p>
                </div>

                {order.estimated_delivery && (
                  <div className="tf-card" style={{ padding: '1.5rem' }}>
                    <p className="section-label" style={{ marginBottom: '0.25rem' }}>Estimated Delivery by</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                      {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}

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

              {/* RIGHT */}
              <div className="remix-right">
                <div className="tf-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Truck size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{order.courier_partner || 'Courier Partner'}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
                    TRACKING ID : <span style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '1rem' }}>{order.tracking_id || '—'}</span>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Flame size={18} />
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Activities</span>
                  </div>
                  <div style={{ position: 'relative', marginLeft: '0.25rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {activities.length > 0 ? activities.map((act, i) => (
                      <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ width: '4rem', flexShrink: 0, textAlign: 'right', paddingRight: '0.5rem' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{act.date}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>{act.time}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', marginTop: '0.25rem', flexShrink: 0, zIndex: 10, background: act.isCurrent ? 'var(--success)' : 'var(--fg-muted)' }} />
                          {i < activities.length - 1 && <div style={{ width: '1px', flex: 1, borderLeft: '2px dashed var(--border)', minHeight: '2.5rem' }} />}
                        </div>
                        <div style={{ paddingBottom: '1.5rem', flex: 1 }}>
                          <p style={{ fontSize: '0.875rem' }}><span style={{ fontWeight: 600 }}>Activity : </span>{act.activity}</p>
                        </div>
                      </div>
                    )) : (
                      <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>No activity yet — updates will appear here.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="tf-card" style={{ padding: '1.5rem', marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 0.5rem' }}>
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
                        border: `2px solid ${isCompleted || isActive ? 'var(--primary)' : 'var(--border)'}`, background: 'white',
                        ...(isActive ? { animation: 'pulseDot 2s ease-in-out infinite' } : {}),
                      }}>
                        <Icon size={20} style={{ color: isCompleted || isActive ? 'var(--primary)' : 'var(--fg-muted)' }} strokeWidth={isCompleted || isActive ? 2.5 : 1.5} />
                      </div>
                      <span style={{ fontSize: '0.625rem', marginTop: '0.5rem', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3, fontWeight: isCompleted || isActive ? 600 : 500, color: isCompleted || isActive ? 'var(--fg)' : 'var(--fg-muted)' }}>{step.label}</span>
                    </div>
                  );
                })}
                {isRTO && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10, width: `${100 / (STEPS.length + 1)}%` }}>
                    <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--danger)', background: 'white', animation: 'pulseDot 2s ease-in-out infinite' }}>
                      <Package size={20} style={{ color: 'var(--danger)' }} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '0.625rem', marginTop: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>RTO In{'\n'}Transit</span>
                  </div>
                )}
              </div>
            </div>

            {/* Back button */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => { setOrder(null); setError(''); setOrderId(''); setPhone(''); }}>
                ← Track another order
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
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
              {business.support_phone && <span style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>📞 {business.support_phone}</span>}
              <span style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>📧 {business.support_email}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
