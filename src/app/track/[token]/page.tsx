'use client';

import { useState, useEffect } from 'react';
import { Package, Loader2, AlertCircle, ArrowLeft, MapPin, Truck, Flame, ClipboardCheck, PackageCheck, CheckCircle, Calendar } from 'lucide-react';

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
  const m: Record<string, string> = { 'order placed': 'Order Placed', processing: 'Processing', packed: 'Packed', shipped: 'Shipped', 'in transit': 'In Transit', 'out for delivery': 'Out For Delivery', delivered: 'Delivered', rto: 'RTO In Transit' };
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
        const r = await fetch(`/api/track?token=${token}`);
        const d = await r.json();
        if (!r.ok) setError(d.error || 'Order not found');
        else { setOrder(d.order); setBusiness(d.business || null); setHistory(d.history || []); }
      } catch { setError('Something went wrong'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const brandName = business?.name || 'Order Tracking';

  if (loading) return <div className="tracking-page"><Header brandName={brandName} business={business} /><div className="loading-center" style={{ minHeight: '60vh' }}><Loader2 size={32} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--primary)' }} /></div></div>;

  if (error || !order) return (
    <div className="tracking-page"><Header brandName={brandName} business={business} />
      <div className="tracking-body"><div className="tf-card animate-fade-in-up" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 0.75rem' }} />
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Order Not Found</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>This tracking link may be invalid or expired.</p>
        <a href="/track" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.5rem' }}><ArrowLeft size={16} /> Search by Order ID</a>
      </div></div>
    </div>
  );

  const currentStep = order.is_cancelled ? -1 : (statusToStep[order.tracking_status.toLowerCase()] ?? -1);
  const isRTO = order.tracking_status.toLowerCase() === 'rto';
  const productNames = order.order_items?.map(i => i.product_name).filter(Boolean) || [];
  const activities = history.map((h, i) => ({
    date: new Date(h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    time: new Date(h.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    activity: h.status,
    notes: h.notes,
    isCurrent: i === history.length - 1,
  }));

  return (
    <div className="tracking-page">
      <Header brandName={brandName} business={business} />
      <main className="tracking-body animate-fade-in-up">
        <div className="remix-grid">
          {/* LEFT */}
          <div className="remix-left">
            {/* Status */}
            <div className="tf-card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '0.25rem' }}>Order Status</p>
              <p style={{ fontSize: '1.375rem', fontWeight: 800, color: getStatusColor(order.tracking_status, order.is_cancelled) }}>
                {getDisplayStatus(order.tracking_status, order.is_cancelled)}
              </p>
            </div>

            {/* Estimated Delivery */}
            {order.estimated_delivery && (
              <div className="tf-card" style={{ padding: '1.25rem' }}>
                <p className="section-label" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Calendar size={11} /> Estimated Delivery by
                </p>
                <p style={{ fontSize: '1.125rem', fontWeight: 800 }}>
                  {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}

            {/* Order Details */}
            <div className="tf-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <MapPin size={16} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Order Details</span>
              </div>
              <div className="detail-table">
                <div className="detail-row"><span className="detail-key">Order ID</span><span className="detail-val">{order.order_id}</span></div>
                {productNames.map((name, i) => (
                  <div key={i} className="detail-row"><span className="detail-key">{i === 0 ? 'Product' : ''}</span><span className="detail-val">{name}</span></div>
                ))}
                <div className="detail-row" style={{ borderBottom: 'none' }}><span className="detail-key">Delivery City</span><span className="detail-val">{order.city}</span></div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="remix-right">
            <div className="tf-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <div className="courier-avatar"><Truck size={18} style={{ color: 'var(--primary)' }} /></div>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{order.courier_partner || 'Courier Partner'}</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginBottom: '1.25rem' }}>
                TRACKING ID : <span style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '0.9375rem' }}>{order.tracking_id || '—'}</span>
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Flame size={16} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Recent Activities</span>
              </div>

              <div style={{ position: 'relative', marginLeft: '0.25rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {activities.length > 0 ? activities.map((act, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ width: '3.5rem', flexShrink: 0, textAlign: 'right', paddingRight: '0.375rem' }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{act.date}</p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>{act.time}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '0.625rem', height: '0.625rem', borderRadius: '50%', marginTop: '0.25rem', flexShrink: 0, zIndex: 10, background: act.isCurrent ? 'var(--success)' : 'var(--fg-muted)' }} />
                      {i < activities.length - 1 && <div style={{ width: '1px', flex: 1, borderLeft: '2px dashed var(--border)', minHeight: '2.25rem' }} />}
                    </div>
                    <div style={{ paddingBottom: '1.25rem', flex: 1 }}>
                      <p style={{ fontSize: '0.8125rem' }}><span style={{ fontWeight: 600 }}>Activity : </span>{act.activity}</p>
                      {act.notes && act.notes !== `Status updated to ${act.activity}` && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.125rem', fontStyle: 'italic' }}>📝 {act.notes}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>No activity yet — updates will appear here.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="tf-card" style={{ padding: '1rem 0.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 0.25rem' }}>
            <div style={{ position: 'absolute', top: '1.25rem', left: 0, right: 0, display: 'flex', padding: '0 22px', zIndex: 0 }}>
              {STEPS.slice(0, -1).map((_, i) => (
                <div key={i} style={{ flex: 1, height: '2px', backgroundColor: i < currentStep ? 'var(--primary)' : 'var(--border)' }} />
              ))}
            </div>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = !order.is_cancelled && i < currentStep;
              const active = !order.is_cancelled && i === currentStep;
              return (
                <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10, width: `${100 / STEPS.length}%` }}>
                  <div style={{
                    width: '2.5rem', height: '2.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${done || active ? 'var(--primary)' : 'var(--border)'}`, background: 'white',
                    ...(active ? { animation: 'pulseDot 2s ease-in-out infinite' } : {}),
                  }}>
                    <Icon size={16} style={{ color: done || active ? 'var(--primary)' : 'var(--fg-muted)' }} strokeWidth={done || active ? 2.5 : 1.5} />
                  </div>
                  <span style={{ fontSize: '0.5625rem', marginTop: '0.375rem', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3, fontWeight: done || active ? 600 : 500, color: done || active ? 'var(--fg)' : 'var(--fg-muted)' }}>{step.label}</span>
                </div>
              );
            })}
            {isRTO && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10, width: `${100 / (STEPS.length + 1)}%` }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--danger)', background: 'white', animation: 'pulseDot 2s ease-in-out infinite' }}>
                  <Package size={16} style={{ color: 'var(--danger)' }} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '0.5625rem', marginTop: '0.375rem', textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>RTO In{'\n'}Transit</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {business && (
        <footer className="tracking-footer-brand">
          <div className="tracking-footer-inner" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src="/shiptrack-logo.png" alt="ShipTrack" style={{ width: '2rem', height: '2rem', objectFit: 'contain' }} />
              <p style={{ fontSize: '0.8125rem' }}><span style={{ color: 'var(--primary)', fontWeight: 600 }}>Shipping </span>that fuels Ecommerce<span style={{ color: 'var(--primary)', fontWeight: 600 }}> Success.</span></p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {business.support_phone && <span className="footer-pill">📞 {business.support_phone}</span>}
              {business.support_email && <span className="footer-pill">📧 {business.support_email}</span>}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function Header({ brandName, business }: { brandName: string; business: Business | null }) {
  const logoUrl = business?.logo_url;
  // Convert Google Drive share links to direct image URLs
  const directLogo = logoUrl && logoUrl.includes('drive.google.com')
    ? logoUrl.replace(/\/file\/d\/([^/]+).*/, '/uc?export=view&id=$1')
    : logoUrl;

  return (
    <div className="tracking-header">
      <div className="tracking-header-inner" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {directLogo ? (
            <img src={directLogo} alt={brandName} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
          ) : (
            <div className="courier-avatar">
              <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>
                {brandName.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{brandName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
          <span>Shipping</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Powered</span>
          <span>by</span>
          <img src="/shiptrack-logo.png" alt="ShipTrack" style={{ width: '1.75rem', height: '1.75rem', marginLeft: '0.125rem' }} />
        </div>
      </div>
    </div>
  );
}
