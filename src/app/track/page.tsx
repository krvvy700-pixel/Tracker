'use client';

import { useState, FormEvent } from 'react';
import { TRACKING_STAGES } from '@/lib/constants';
import { Package, Search, Loader2, AlertCircle, ClipboardList, Truck, MapPin, Check, RotateCcw, Activity } from 'lucide-react';

interface OrderItem { brand: string; product_name: string; quantity: number; price: number; }
interface TrackingOrder {
  order_id: string; customer_name: string; tracking_status: string; tracking_id: string;
  courier_partner: string; status_updated_at: string; estimated_delivery: string;
  order_total: number; payment_method: string; is_cancelled: boolean;
  city: string; state: string; pincode: string; created_at: string; order_items: OrderItem[];
}
interface Business { name: string; logo_url: string; support_email: string; support_phone: string; }
interface TrackingHistory { status: string; created_at: string; notes: string; }

const TIMELINE_ICONS = [ClipboardList, Package, Package, Truck, Truck, MapPin, Check];
const TIMELINE_LABELS = ['Order Placed', 'Processing', 'Packed', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered'];

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
      let searchId = orderId.trim();
      if (!searchId.startsWith('#')) searchId = '#' + searchId;
      const res = await fetch(`/api/track?orderId=${encodeURIComponent(searchId)}&phone=${phone}`);
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Order not found');
      else { setOrder(data.order); setBusiness(data.business || null); setHistory(data.history || []); }
    } catch { setError('Something went wrong.'); }
    finally { setLoading(false); }
  };

  const brandName = business?.name || 'TrackFlow';
  const supportEmail = business?.support_email || 'support@trackflow.com';

  const getStageState = (stage: string) => {
    if (!order) return 'pending';
    if (order.is_cancelled) return 'pending';
    const currentIdx = TRACKING_STAGES.indexOf(order.tracking_status as typeof TRACKING_STAGES[number]);
    const stageIdx = TRACKING_STAGES.indexOf(stage as typeof TRACKING_STAGES[number]);
    if (stageIdx < currentIdx) return 'completed';
    if (stageIdx === currentIdx) return 'active';
    return 'pending';
  };

  const displayStatus = order ? (order.is_cancelled ? 'Cancelled' : order.tracking_status) : '';
  const statusClass = displayStatus === 'Delivered' ? 'delivered' : displayStatus === 'Cancelled' ? 'cancelled' : ['In Transit', 'Shipped', 'Out for Delivery'].includes(displayStatus) ? 'in-transit' : '';
  const primaryBrand = order?.order_items?.[0]?.brand || brandName;

  return (
    <div className="tracking-page">
      {/* Header */}
      <div className="tracking-header">
        <div className="tracking-header-inner">
          <div className="tracking-logo">
            {business?.logo_url ? <img src={business.logo_url} alt={brandName} /> : <Package size={16} />}
          </div>
          <span className="tracking-brand-name">{brandName}</span>
        </div>
      </div>

      <div className="tracking-body">
        {/* Subtitle */}
        <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '0.75rem' }}>
          Your Order Tracking details are shown below
        </p>

        {/* Search */}
        <div className="tf-card animate-fade-in-up" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input type="text" className="form-input" placeholder="Order ID (e.g., 3594)" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input type="text" className="form-input" placeholder="Last 4 digits of phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={4} required style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <Loader2 size={16} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Search size={16} />}
                Track
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="alert-band alert-error-band animate-fade-in-up" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}

        {/* Result — same layout as token page */}
        {order && (
          <div className="animate-fade-in-up">
            <div className="order-id-pill">{order.order_id}</div>

            <div className="tf-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
              <div className="track-status-section">
                <div className="section-label">ORDER STATUS</div>
                <div className={`track-status-text ${statusClass}`}>{displayStatus}</div>
              </div>

              {order.estimated_delivery && (
                <div className="track-status-section">
                  <div className="section-label">ESTIMATED DELIVERY BY</div>
                  <div className="track-delivery-date">
                    {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <MapPin size={14} /> Order Details
                </h3>
                <div className="detail-table">
                  <div className="detail-row"><span className="detail-key">Order ID</span><span className="detail-val">{order.order_id}</span></div>
                  <div className="detail-row"><span className="detail-key">Customer</span><span className="detail-val">{order.customer_name}</span></div>
                  {order.order_items?.map((item, i) => (
                    <div key={i} className="detail-row"><span className="detail-key">Product</span><span className="detail-val">{item.product_name}</span></div>
                  ))}
                  <div className="detail-row"><span className="detail-key">Qty</span><span className="detail-val">{order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 1}</span></div>
                  <div className="detail-row"><span className="detail-key">Total</span><span className="detail-val">₹{Number(order.order_total).toFixed(2)}</span></div>
                  <div className="detail-row"><span className="detail-key">Order Shipped On</span><span className="detail-val">{new Date(order.created_at).toLocaleString('en-IN')}</span></div>
                  <div className="detail-row"><span className="detail-key">Delivery City</span><span className="detail-val">{order.city}</span></div>
                  <div className="detail-row"><span className="detail-key">Brand</span><span className="detail-val">{primaryBrand}</span></div>
                </div>
              </div>
            </div>

            {order.order_items?.map((item, i) => (
              <div key={i} className="track-item-card" style={{ marginBottom: '1rem' }}>
                <div className="track-item-header">
                  <div className="track-item-icon">{brandName.charAt(0)}</div>
                  <div>
                    <div className="track-item-name">{item.product_name}</div>
                    <div className="track-item-tracking">TRACKING ID : {order.tracking_id || '—'}</div>
                  </div>
                </div>
                <div className="track-activity">
                  <div className="track-activity-title"><Activity size={12} /> Recent Activities</div>
                  {history.length > 0 ? (
                    history.slice(-3).map((h, idx) => (
                      <p key={idx} className="track-activity-empty" style={{ color: 'var(--fg)' }}>
                        {h.status} — {new Date(h.created_at).toLocaleString('en-IN')}
                      </p>
                    ))
                  ) : (
                    <p className="track-activity-empty">No activity yet — updates will appear here.</p>
                  )}
                </div>
              </div>
            ))}

            <div className="tf-card" style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
              <div className="h-timeline">
                {TIMELINE_LABELS.map((stage, idx) => {
                  const state = getStageState(stage);
                  const Icon = TIMELINE_ICONS[idx];
                  return (
                    <div key={stage} className={`h-timeline-step ${state}`}>
                      <div className={`h-timeline-icon ${state}`}><Icon size={18} /></div>
                      <span className={`h-timeline-name ${state}`}>{stage}</span>
                    </div>
                  );
                })}
                <div className={`h-timeline-step ${order.tracking_status === 'RTO' ? 'active' : 'pending'}`}>
                  <div className={`h-timeline-icon ${order.tracking_status === 'RTO' ? 'cancelled' : 'pending'}`}><RotateCcw size={18} /></div>
                  <span className={`h-timeline-name ${order.tracking_status === 'RTO' ? 'active' : ''}`}>RTO In Transit</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="tracking-footer-brand">
        <div className="tracking-footer-inner">
          <div className="tracking-footer-logo">
            {business?.logo_url ? <img src={business.logo_url} alt={brandName} /> : brandName.charAt(0)}
          </div>
          <div>
            <div className="tracking-footer-name">{brandName}</div>
            <div className="tracking-footer-support">📧 {supportEmail}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
