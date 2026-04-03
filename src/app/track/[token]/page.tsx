'use client';

import { useState, useEffect } from 'react';
import { TRACKING_STAGES } from '@/lib/constants';
import { Package, Loader2, AlertCircle, ArrowLeft, ClipboardList, Truck, MapPin, Check, X as XIcon, RotateCcw, Activity } from 'lucide-react';

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
        if (!res.ok) setError(data.error || 'Order not found');
        else { setOrder(data.order); setBusiness(data.business || null); setHistory(data.history || []); }
      } catch { setError('Something went wrong'); }
      finally { setLoading(false); }
    };
    fetchTracking();
  }, [token]);

  const brandName = business?.name || 'TrackFlow';
  const supportEmail = business?.support_email || 'support@trackflow.com';

  if (loading) {
    return (
      <div className="tracking-page">
        <TrackHeader business={business} brandName={brandName} />
        <div className="loading-center" style={{ minHeight: '60vh' }}>
          <Loader2 size={32} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--primary)' }} />
          <p>Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="tracking-page">
        <TrackHeader business={business} brandName={brandName} />
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

  const displayStatus = order.is_cancelled ? 'Cancelled' : order.tracking_status;
  const statusClass = displayStatus === 'Delivered' ? 'delivered' : displayStatus === 'Cancelled' ? 'cancelled' : ['In Transit', 'Shipped', 'Out for Delivery'].includes(displayStatus) ? 'in-transit' : '';
  const primaryBrand = order.order_items?.[0]?.brand || brandName;

  const getStageState = (stage: string) => {
    if (order.is_cancelled) return 'pending';
    const currentIdx = TRACKING_STAGES.indexOf(order.tracking_status as typeof TRACKING_STAGES[number]);
    const stageIdx = TRACKING_STAGES.indexOf(stage as typeof TRACKING_STAGES[number]);
    if (stageIdx < currentIdx) return 'completed';
    if (stageIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="tracking-page">
      <TrackHeader business={business} brandName={brandName} />

      <div className="tracking-body animate-fade-in-up">
        {/* Order ID pill */}
        <div className="order-id-pill">{order.order_id}</div>

        {/* Main card */}
        <div className="tf-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          {/* Status */}
          <div className="track-status-section">
            <div className="section-label">ORDER STATUS</div>
            <div className={`track-status-text ${statusClass}`}>{displayStatus}</div>
          </div>

          {/* Estimated delivery */}
          {order.estimated_delivery && (
            <div className="track-status-section">
              <div className="section-label">ESTIMATED DELIVERY BY</div>
              <div className="track-delivery-date">
                {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}

          {/* Order Details */}
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

        {/* Item cards */}
        {order.order_items?.map((item, i) => (
          <div key={i} className="track-item-card" style={{ marginBottom: '1rem' }}>
            <div className="track-item-header">
              <div className="track-item-icon">{brandName.charAt(0)}</div>
              <div>
                <div className="track-item-name">{item.product_name}</div>
                <div className="track-item-tracking">
                  TRACKING ID : {order.tracking_id || '—'}
                </div>
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

        {/* Horizontal Timeline */}
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
            {/* RTO step */}
            <div className={`h-timeline-step ${order.tracking_status === 'RTO' ? 'active' : 'pending'}`}>
              <div className={`h-timeline-icon ${order.tracking_status === 'RTO' ? 'cancelled' : 'pending'}`}><RotateCcw size={18} /></div>
              <span className={`h-timeline-name ${order.tracking_status === 'RTO' ? 'active' : ''}`}>RTO In Transit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Footer */}
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

function TrackHeader({ business, brandName }: { business: Business | null; brandName: string }) {
  return (
    <div className="tracking-header">
      <div className="tracking-header-inner">
        <div className="tracking-logo">
          {business?.logo_url ? <img src={business.logo_url} alt={brandName} /> : <Package size={16} />}
        </div>
        <span className="tracking-brand-name">{brandName}</span>
      </div>
    </div>
  );
}
