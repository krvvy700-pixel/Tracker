'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TRACKING_STAGES_WITH_SPECIAL, STAGE_ICONS, ROLE_PERMISSIONS, getStatusColorClass } from '@/lib/constants';
import {
  Package, Upload, Users, LogOut, Search, Eye, Link2, MessageCircle, Mail,
  ChevronLeft, ChevronRight, X, Check, Truck, AlertCircle, ShoppingBag,
  Loader2, FileUp, Info, UserPlus, Trash2, Building2, Plus, Lock, Unlock,
  Activity, Zap, Calendar, StickyNote
} from 'lucide-react';

/* ═══════════ TYPES ═══════════ */
interface OrderItem { id: string; brand: string; product_name: string; quantity: number; price: number; }
interface Order {
  id: string; order_id: string; shopify_id: string; payment_method: string; financial_status: string;
  customer_name: string; customer_email: string; customer_mobile: string;
  address_line1: string; address_line2: string; address_line3: string;
  city: string; state: string; pincode: string;
  tracking_status: string; tracking_id: string; courier_partner: string;
  tracking_token: string; status_updated_at: string; estimated_delivery: string;
  order_total: number; is_cancelled: boolean; cancelled_at: string;
  notes: string; created_at: string; updated_at: string; order_items: OrderItem[];
  business_id: string;
}
interface AuthUser { username: string; displayName: string; role: 'admin' | 'manager' | 'viewer'; }
interface TeamUser { id: string; username: string; display_name: string; role: string; is_active: boolean; last_login: string; created_at: string; }
interface Business { id: string; name: string; logo_url: string; support_email: string; support_phone: string; is_default: boolean; created_at: string; }
type TabType = 'orders' | 'upload' | 'team' | 'businesses';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, percent: 0 });

  // Bulk status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkTrackingId, setBulkTrackingId] = useState('');
  const [bulkCourier, setBulkCourier] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkEstDelivery, setBulkEstDelivery] = useState('');

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Team
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamUser, setNewTeamUser] = useState({ username: '', password: '', displayName: '', role: 'viewer' });

  // Businesses
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [showBizModal, setShowBizModal] = useState(false);
  const [editBiz, setEditBiz] = useState<Business | null>(null);
  const [bizForm, setBizForm] = useState({ name: '', logoUrl: '', supportEmail: '', supportPhone: '', isDefault: false });

  // Alert
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 50;

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (!savedToken || !savedUser) { router.push('/login'); return; }
    setToken(savedToken);
    setUser(JSON.parse(savedUser));
  }, [router]);

  const hasPermission = (perm: string) => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(perm) ?? false;
  };

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  /* ═══ FETCH FUNCTIONS ═══ */
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (brandFilter) params.set('brand', brandFilter);
      const res = await fetch(`/api/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { setOrders(data.orders); setTotalOrders(data.total); }
    } catch { showAlert('error', 'Failed to load orders'); }
    finally { setLoading(false); }
  }, [token, page, search, statusFilter, brandFilter]);

  const fetchBrands = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/brands', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setBrands(data.brands);
    } catch { /* ignore */ }
  }, [token]);

  const fetchTeamUsers = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/team', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setTeamUsers(data.users);
    } catch { /* ignore */ }
  }, [token, user]);

  const fetchBusinesses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/businesses', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setBusinesses(data.businesses || []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { if (token) { fetchOrders(); fetchBrands(); fetchBusinesses(); } }, [token, fetchOrders, fetchBrands, fetchBusinesses]);
  useEffect(() => { if (activeTab === 'team') fetchTeamUsers(); }, [activeTab, fetchTeamUsers]);

  const handleSearchChange = (val: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  /* ═══ CSV UPLOAD (chunked — works on Vercel Hobby 10s limit) ═══ */
  const CHUNK_SIZE = 500; // rows per chunk

  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.endsWith('.csv')) { showAlert('error', 'Please upload a CSV file'); return; }
    setUploading(true);
    setUploadResult(null);
    setUploadProgress({ current: 0, total: 0, percent: 0 });

    try {
      // 1. Read and parse CSV on the client
      const csvText = await file.text();
      const lines = csvText.split('\n');
      const header = lines[0];
      const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
      const totalRows = dataLines.length;

      // 2. Split into chunks
      const chunks: string[] = [];
      for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
        const chunkLines = dataLines.slice(i, i + CHUNK_SIZE);
        chunks.push(header + '\n' + chunkLines.join('\n'));
      }

      setUploadProgress({ current: 0, total: chunks.length, percent: 0 });

      // 3. Send chunks sequentially
      let totalNew = 0, totalUpdated = 0, totalBrands = 0;

      for (let i = 0; i < chunks.length; i++) {
        const blob = new Blob([chunks[i]], { type: 'text/csv' });
        const chunkFile = new File([blob], file.name, { type: 'text/csv' });

        const formData = new FormData();
        formData.append('file', chunkFile);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', chunks.length.toString());

        const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
        const data = await res.json();

        if (!res.ok) {
          showAlert('error', `Chunk ${i + 1}/${chunks.length} failed: ${data.error}`);
          break;
        }

        totalNew += data.stats?.newOrders || 0;
        totalUpdated += data.stats?.updatedOrders || 0;
        totalBrands = Math.max(totalBrands, data.stats?.brandsDetected || 0);

        setUploadProgress({ current: i + 1, total: chunks.length, percent: Math.round(((i + 1) / chunks.length) * 100) });
      }

      setUploadResult({ total: totalRows, unique: totalNew + totalUpdated, newOrders: totalNew, updatedOrders: totalUpdated });
      showAlert('success', `Upload complete! ${totalNew} new, ${totalUpdated} updated, ${totalBrands} brands detected`);
      fetchOrders(); fetchBrands(); fetchBusinesses();
    } catch { showAlert('error', 'Upload failed'); }
    finally { setUploading(false); }
  };

  /* ═══ BULK STATUS ═══ */
  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedOrders.size === 0) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrders),
          status: bulkStatus,
          trackingId: bulkTrackingId || undefined,
          courierPartner: bulkCourier || undefined,
          notes: bulkNotes || undefined,
          estimatedDelivery: bulkEstDelivery || undefined,
        }),
      });
      if (res.ok) {
        showAlert('success', `Updated ${selectedOrders.size} orders to "${bulkStatus}"`);
        setSelectedOrders(new Set()); setShowStatusModal(false);
        setBulkStatus(''); setBulkTrackingId(''); setBulkCourier(''); setBulkNotes(''); setBulkEstDelivery('');
        fetchOrders();
      } else { showAlert('error', 'Update failed'); }
    } catch { showAlert('error', 'Update failed'); }
  };

  /* ═══ DELETE ORDER ═══ */
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        showAlert('success', `Order ${orderId} deleted`);
        if (showDetailModal) setShowDetailModal(false);
        fetchOrders();
      } else { showAlert('error', 'Delete failed'); }
    } catch { showAlert('error', 'Delete failed'); }
  };

  const handleSingleStatusUpdate = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderIds: [orderId], status }),
      });
      if (res.ok) {
        showAlert('success', `Order ${orderId} → ${status}`);
        fetchOrders();
        if (detailOrder && detailOrder.order_id === orderId) {
          setDetailOrder({ ...detailOrder, tracking_status: status, is_cancelled: status === 'Cancelled' });
        }
      }
    } catch { showAlert('error', 'Update failed'); }
  };

  /* ═══ TEAM ═══ */
  const handleCreateTeamUser = async () => {
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newTeamUser),
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', `User ${newTeamUser.username} created`);
        setShowTeamModal(false); setNewTeamUser({ username: '', password: '', displayName: '', role: 'viewer' });
        fetchTeamUsers();
      } else { showAlert('error', data.error || 'Failed'); }
    } catch { showAlert('error', 'Failed'); }
  };

  const handleToggleTeamUser = async (userId: string, isActive: boolean) => {
    try {
      await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: userId, isActive }) });
      fetchTeamUsers();
    } catch { /* ignore */ }
  };

  const handleDeleteTeamUser = async (userId: string) => {
    if (!confirm('Delete this team member?')) return;
    try {
      await fetch(`/api/team?id=${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchTeamUsers(); showAlert('success', 'User deleted');
    } catch { /* ignore */ }
  };

  /* ═══ BUSINESSES ═══ */
  const handleSaveBusiness = async () => {
    try {
      const method = editBiz ? 'PATCH' : 'POST';
      const body = editBiz
        ? { id: editBiz.id, name: bizForm.name, logoUrl: bizForm.logoUrl, supportEmail: bizForm.supportEmail, supportPhone: bizForm.supportPhone, isDefault: bizForm.isDefault }
        : { name: bizForm.name, logoUrl: bizForm.logoUrl, supportEmail: bizForm.supportEmail, supportPhone: bizForm.supportPhone, isDefault: bizForm.isDefault };
      const res = await fetch('/api/businesses', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showAlert('success', editBiz ? 'Business updated' : 'Business created');
        setShowBizModal(false); setEditBiz(null);
        setBizForm({ name: '', logoUrl: '', supportEmail: '', supportPhone: '', isDefault: false });
        fetchBusinesses();
      } else {
        const data = await res.json();
        showAlert('error', data.error || 'Failed');
      }
    } catch { showAlert('error', 'Failed'); }
  };

  const handleDeleteBusiness = async (id: string) => {
    if (!confirm('Delete this business? Orders will be unlinked.')) return;
    try {
      await fetch(`/api/businesses?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchBusinesses(); showAlert('success', 'Business deleted');
    } catch { /* ignore */ }
  };

  const openEditBiz = (biz: Business) => {
    setEditBiz(biz);
    setBizForm({ name: biz.name, logoUrl: biz.logo_url || '', supportEmail: biz.support_email || '', supportPhone: biz.support_phone || '', isDefault: biz.is_default });
    setShowBizModal(true);
  };

  /* ═══ HELPERS ═══ */
  const copyTrackingLink = (trackingToken: string) => {
    const link = `${window.location.origin}/track/${trackingToken}`;
    navigator.clipboard.writeText(link);
    showAlert('success', 'Tracking link copied!');
  };

  const getTrackingLink = (trackingToken: string) => `${window.location.origin}/track/${trackingToken}`;

  const sendWhatsApp = (order: Order) => {
    const phone = order.customer_mobile.startsWith('91') ? order.customer_mobile : '91' + order.customer_mobile;
    const link = getTrackingLink(order.tracking_token);
    const status = order.is_cancelled ? 'Cancelled' : order.tracking_status;
    const message = `Hi ${order.customer_name},\n\nYour order *${order.order_id}* is now: *${status}*\n\n📦 Track your order here:\n${link}\n\nThank you for shopping with us! 🙏`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendEmail = (order: Order) => {
    if (!order.customer_email) { showAlert('error', 'No email address'); return; }
    const link = getTrackingLink(order.tracking_token);
    const status = order.is_cancelled ? 'Cancelled' : order.tracking_status;
    const subject = `Order ${order.order_id} — ${status}`;
    const body = `Hi ${order.customer_name},\n\nYour order ${order.order_id} is now: ${status}\n\nTrack: ${link}\n\nTotal: ₹${Number(order.order_total).toFixed(0)}\nPayment: ${order.payment_method}`;
    window.open(`mailto:${order.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const toggleSelectAll = () => {
    setSelectedOrders(selectedOrders.size === orders.length ? new Set() : new Set(orders.map((o) => o.order_id)));
  };

  const toggleSelectOrder = (orderId: string) => {
    const next = new Set(selectedOrders);
    next.has(orderId) ? next.delete(orderId) : next.add(orderId);
    setSelectedOrders(next);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    router.push('/login');
  };

  const totalPages = Math.ceil(totalOrders / limit);

  if (!user) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  /* ═══════════════════════════════════════ */
  /*              RENDER                     */
  /* ═══════════════════════════════════════ */

  const navItems = [
    { id: 'orders' as TabType, label: 'Orders', icon: ShoppingBag, show: true },
    { id: 'upload' as TabType, label: 'Upload CSV', icon: Upload, show: hasPermission('upload_csv') },
    { id: 'businesses' as TabType, label: 'Businesses', icon: Building2, show: hasPermission('manage_businesses') },
    { id: 'team' as TabType, label: 'Team', icon: Users, show: hasPermission('manage_team') },
  ].filter((i) => i.show);

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon"><Package /></div>
          <div>
            <div className="sidebar-brand-name">TrackFlow</div>
            <div className="sidebar-brand-sub">Order Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user.displayName.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.displayName}</div>
              <span className="role-pill">{user.role}</span>
            </div>
          </div>
          <button className="nav-btn" onClick={logout} style={{ marginTop: '0.5rem' }}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="btn-icon" onClick={() => setSidebarOpen(true)}><Package size={20} /></button>
          <span className="mobile-header-title">{activeTab}</span>
        </div>

        <div className="main-inner">
          {/* Toast */}
          {alert && (
            <div className={`toast toast-${alert.type}`}>
              {alert.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              {alert.message}
            </div>
          )}

          {/* ════════ ORDERS TAB ════════ */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="page-title">Orders</h2>
                <p className="page-subtitle">Manage and track all customer orders</p>
              </div>

              {/* Stage KPIs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {TRACKING_STAGES_WITH_SPECIAL.map((stage) => {
                  const count = stage === 'Cancelled'
                    ? orders.filter((o) => o.is_cancelled).length
                    : orders.filter((o) => o.tracking_status === stage && !o.is_cancelled).length;
                  return (
                    <button key={stage} onClick={() => { setStatusFilter(statusFilter === stage ? '' : stage); setPage(1); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem',
                        borderRadius: '9999px', border: statusFilter === stage ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        background: statusFilter === stage ? 'var(--primary-light)' : 'var(--card-bg)',
                        fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                        color: statusFilter === stage ? 'var(--primary)' : 'var(--fg-muted)',
                      }}>
                      <span>{STAGE_ICONS[stage]}</span>
                      <span>{stage}</span>
                      <span style={{ fontWeight: 700, color: count > 0 ? 'var(--fg)' : 'var(--fg-muted)' }}>{count}</span>
                    </button>
                  );
                })}
                <button onClick={() => { setStatusFilter(''); setPage(1); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem',
                    borderRadius: '9999px', border: !statusFilter ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: !statusFilter ? 'var(--primary-light)' : 'var(--card-bg)',
                    fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                    color: !statusFilter ? 'var(--primary)' : 'var(--fg-muted)',
                  }}>
                  <span>📊</span><span>All</span><span style={{ fontWeight: 700, color: 'var(--fg)' }}>{totalOrders}</span>
                </button>
              </div>

              {/* Toolbar */}
              <div className="toolbar">
                <div className="toolbar-search">
                  <Search />
                  <input type="text" className="form-input" placeholder="Search by order ID, name, phone, email..." onChange={(e) => handleSearchChange(e.target.value)} />
                </div>
                <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All Statuses</option>
                  {TRACKING_STAGES_WITH_SPECIAL.map((s) => (<option key={s} value={s}>{STAGE_ICONS[s]} {s}</option>))}
                </select>
                <select className="form-select" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}>
                  <option value="">All Brands</option>
                  {brands.map((b) => (<option key={b} value={b}>{b}</option>))}
                </select>
              </div>

              {/* Bulk bar */}
              {selectedOrders.size > 0 && hasPermission('update_status') && (
                <div className="bulk-bar">
                  <span className="bulk-count">{selectedOrders.size}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>selected</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowStatusModal(true)}>Update Status</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedOrders(new Set())}>Clear</button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="table-card">
                {loading ? (
                  <div className="loading-center"><div className="spinner spinner-lg" /><p>Loading orders...</p></div>
                ) : orders.length === 0 ? (
                  <div className="empty-state">
                    <Package size={40} />
                    <div className="empty-state-title">No orders found</div>
                    <div className="empty-state-text">Upload a CSV to get started</div>
                  </div>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table className="tf-table">
                        <thead>
                          <tr>
                            {hasPermission('update_status') && (<th style={{ width: 48 }}><input type="checkbox" className="tf-checkbox" onChange={toggleSelectAll} checked={selectedOrders.size === orders.length && orders.length > 0} /></th>)}
                            <th>Order</th>
                            <th className="col-hide-md">Customer</th>
                            <th className="col-hide-lg">City</th>
                            <th className="col-hide-sm">Total</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => (
                            <tr key={order.id}>
                              {hasPermission('update_status') && (
                                <td><input type="checkbox" className="tf-checkbox" checked={selectedOrders.has(order.order_id)} onChange={() => toggleSelectOrder(order.order_id)} /></td>
                              )}
                              <td><span style={{ fontWeight: 600, color: 'var(--primary)' }}>{order.order_id}</span></td>
                              <td className="col-hide-md">
                                <div>
                                  <p style={{ fontWeight: 500 }}>{order.customer_name}</p>
                                  {order.customer_email && <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{order.customer_email}</p>}
                                </div>
                              </td>
                              <td className="col-hide-lg">
                                <div>
                                  <p>{order.city}</p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{order.state}</p>
                                </div>
                              </td>
                              <td className="col-hide-sm" style={{ fontWeight: 500 }}>₹{Number(order.order_total).toLocaleString()}</td>
                              <td>
                                <span className={`status-pill ${getStatusColorClass(order.is_cancelled ? 'Cancelled' : order.tracking_status)}`}>
                                  {order.is_cancelled ? 'Cancelled' : order.tracking_status}
                                </span>
                              </td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn-icon" onClick={() => { setDetailOrder(order); setShowDetailModal(true); }} title="View"><Eye size={16} /></button>
                                  <button className="btn-icon" onClick={() => copyTrackingLink(order.tracking_token)} title="Copy Link"><Link2 size={16} /></button>
                                  <button className="btn-icon" onClick={() => sendWhatsApp(order)} title="WhatsApp" style={{ color: '#25D366' }}><MessageCircle size={16} /></button>
                                  <button className="btn-icon" onClick={() => sendEmail(order)} title="Email" style={{ color: 'var(--info)' }}><Mail size={16} /></button>
                                  {hasPermission('delete_order') && <button className="btn-icon" onClick={() => handleDeleteOrder(order.order_id)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="pagination">
                        <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                          <ChevronLeft size={16} /> Prev
                        </button>
                        <span className="pagination-info">Page {page} of {totalPages}</span>
                        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ════════ UPLOAD TAB ════════ */}
          {activeTab === 'upload' && hasPermission('upload_csv') && (
            <div className="space-y-6 animate-fade-in-up max-w-2xl">
              <div>
                <h2 className="page-title">Upload CSV</h2>
                <p className="page-subtitle">Import orders from Shopify CSV export</p>
              </div>

              {/* Brands auto-detected from CSV */}

              {/* Drop zone */}
              <div
                className={`upload-zone ${dragOver ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0 2rem' }}>
                    <Loader2 size={40} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--primary)' }} />
                    <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      {uploadProgress.total > 0
                        ? `Chunk ${uploadProgress.current}/${uploadProgress.total} — ${uploadProgress.percent}%`
                        : 'Parsing CSV...'}
                    </p>
                    {uploadProgress.total > 0 && (
                      <div style={{ width: '100%', height: '6px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${uploadProgress.percent}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                      </div>
                    )}
                    <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Each chunk ~500 rows • fits within 10s timeout</p>
                  </div>
                ) : (
                  <>
                    <div className="upload-icon"><FileUp /></div>
                    <p className="upload-title">Drop your CSV file here</p>
                    <p className="upload-hint">or click to browse • .csv only</p>
                    <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} />
                  </>
                )}
              </div>

              {/* Results */}
              {uploadResult && (
                <div className="upload-results">
                  {[
                    { label: 'CSV Rows', value: (uploadResult as Record<string, number>).total },
                    { label: 'Unique Orders', value: (uploadResult as Record<string, number>).unique },
                    { label: 'New', value: (uploadResult as Record<string, number>).newOrders },
                    { label: 'Updated', value: (uploadResult as Record<string, number>).updatedOrders },
                  ].map((r) => (
                    <div key={r.label} className="upload-result-card">
                      <p className="upload-result-value">{r.value}</p>
                      <p className="upload-result-label">{r.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="info-box">
                <Info size={16} />
                <div>
                  <p className="info-box-title">How it works</p>
                  <p className="info-box-text">
                    Export your orders from Shopify as CSV, then upload here. Brands are <strong>auto-detected</strong> from the Vendor column and businesses are created automatically. Re-uploading updates existing orders without creating duplicates. Handles 3,000+ orders in seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ════════ BUSINESSES TAB ════════ */}
          {activeTab === 'businesses' && hasPermission('manage_businesses') && (
            <div className="space-y-6 animate-fade-in-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 className="page-title">Businesses</h2>
                  <p className="page-subtitle">Manage brand logos and tracking page branding</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditBiz(null); setBizForm({ name: '', logoUrl: '', supportEmail: '', supportPhone: '', isDefault: false }); setShowBizModal(true); }}>
                  <Plus size={16} /> Add Business
                </button>
              </div>

              <div className="info-box">
                <Info size={16} />
                <div>
                  <p className="info-box-text">
                    Each business can have its own logo and name. When you upload orders, assign them to a business — customers will see that branding on their tracking page.
                  </p>
                </div>
              </div>

              {businesses.length === 0 ? (
                <div className="empty-state">
                  <Building2 size={40} />
                  <div className="empty-state-title">No businesses yet</div>
                  <div className="empty-state-text">Add a business to brand your tracking pages</div>
                </div>
              ) : (
                <div className="businesses-grid">
                  {businesses.map((biz) => (
                    <div key={biz.id} className="business-card">
                      <div className="business-logo">
                        {biz.logo_url ? (
                          <img src={biz.logo_url} alt={biz.name} />
                        ) : (
                          <span className="business-logo-letter">{biz.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="business-info">
                        <div className="business-name">
                          {biz.name}
                          {biz.is_default && <span className="status-pill status-pill-delivered" style={{ marginLeft: '0.5rem' }}>Default</span>}
                        </div>
                        <div className="business-meta">
                          {[biz.support_email, biz.support_phone].filter(Boolean).join(' • ') || 'No contact info'}
                        </div>
                      </div>
                      <div className="business-actions">
                        <button className="btn-icon" onClick={() => openEditBiz(biz)} title="Edit"><Eye size={16} /></button>
                        <button className="btn-icon" onClick={() => handleDeleteBusiness(biz.id)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ TEAM TAB ════════ */}
          {activeTab === 'team' && hasPermission('manage_team') && (
            <div className="space-y-6 animate-fade-in-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 className="page-title">Team</h2>
                  <p className="page-subtitle">Manage team members and permissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowTeamModal(true)}>
                  <UserPlus size={16} /> Add Member
                </button>
              </div>

              <div className="info-box">
                <Info size={16} />
                <div>
                  <p className="info-box-text">
                    <strong>Admin</strong> — Full access &nbsp;|&nbsp;
                    <strong>Manager</strong> — Upload, update, cancel &nbsp;|&nbsp;
                    <strong>Viewer</strong> — View only
                  </p>
                </div>
              </div>

              <div className="table-card">
                <table className="tf-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th className="col-hide-sm">Role</th>
                      <th className="col-hide-md">Status</th>
                      <th className="col-hide-lg">Last Login</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Super admin */}
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="sidebar-avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>S</div>
                          <div>
                            <p style={{ fontWeight: 500 }}>Super Admin</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>env credentials</p>
                          </div>
                        </div>
                      </td>
                      <td className="col-hide-sm"><span className="role-pill">admin</span></td>
                      <td className="col-hide-md"><span className="status-pill status-pill-delivered">Active</span></td>
                      <td className="col-hide-lg" style={{ color: 'var(--fg-muted)' }}>—</td>
                      <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>System account</td>
                    </tr>
                    {teamUsers.map((tu) => (
                      <tr key={tu.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="sidebar-avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>{tu.display_name.charAt(0)}</div>
                            <div>
                              <p style={{ fontWeight: 500 }}>{tu.display_name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>@{tu.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="col-hide-sm"><span className="role-pill">{tu.role}</span></td>
                        <td className="col-hide-md">
                          <span className={`status-pill ${tu.is_active ? 'status-pill-delivered' : 'status-pill-default'}`}>
                            {tu.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="col-hide-lg" style={{ color: 'var(--fg-muted)' }}>
                          {tu.last_login ? new Date(tu.last_login).toLocaleDateString() : 'Never'}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button className="btn-icon" onClick={() => handleToggleTeamUser(tu.id, !tu.is_active)} title={tu.is_active ? 'Disable' : 'Enable'}>
                              {tu.is_active ? <Lock size={16} /> : <Unlock size={16} />}
                            </button>
                            <button className="btn-icon" onClick={() => handleDeleteTeamUser(tu.id)} title="Delete" style={{ color: 'var(--danger)' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ════════ MODALS ════════ */}

      {/* Bulk Status Modal */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Update {selectedOrders.size} Orders</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowStatusModal(false)}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">New Status</label>
                <select className="form-select" style={{ width: '100%' }} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                  <option value="">Select status...</option>
                  {TRACKING_STAGES_WITH_SPECIAL.map((s) => (<option key={s} value={s}>{STAGE_ICONS[s]} {s}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tracking ID (optional)</label>
                <input type="text" className="form-input" placeholder="TRK..." value={bulkTrackingId} onChange={(e) => setBulkTrackingId(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Courier Partner (optional)</label>
                <input type="text" className="form-input" placeholder="e.g., Delhivery" value={bulkCourier} onChange={(e) => setBulkCourier(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label"><Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />Estimated Delivery (optional)</label>
                <input type="date" className="form-input" value={bulkEstDelivery} onChange={(e) => setBulkEstDelivery(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label"><StickyNote size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />Note (optional)</label>
                <textarea className="form-input" rows={2} placeholder="e.g., Dispatched via express" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} style={{ height: 'auto', resize: 'vertical' }} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setShowStatusModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleBulkUpdate} disabled={!bulkStatus}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetailModal && detailOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Order {detailOrder.order_id}</h3>
                <p className="modal-subtitle">Placed on {new Date(detailOrder.created_at).toLocaleDateString()}</p>
              </div>
              <button className="btn-icon" onClick={() => setShowDetailModal(false)}><X size={16} /></button>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`status-pill ${getStatusColorClass(detailOrder.is_cancelled ? 'Cancelled' : detailOrder.tracking_status)}`}>
                  {detailOrder.is_cancelled ? 'Cancelled' : detailOrder.tracking_status}
                </span>
              </div>

              {/* Details */}
              <div className="detail-grid">
                <div><p className="detail-field-label">Customer</p><p className="detail-field-value">{detailOrder.customer_name}</p></div>
                <div><p className="detail-field-label">Email</p><p className="detail-field-value">{detailOrder.customer_email || '—'}</p></div>
                <div><p className="detail-field-label">Phone</p><p className="detail-field-value">{detailOrder.customer_mobile}</p></div>
                <div><p className="detail-field-label">Total</p><p className="detail-field-value">₹{Number(detailOrder.order_total).toLocaleString()}</p></div>
                <div><p className="detail-field-label">City</p><p className="detail-field-value">{detailOrder.city}, {detailOrder.state}</p></div>
                <div><p className="detail-field-label">Pincode</p><p className="detail-field-value">{detailOrder.pincode}</p></div>
                <div className="detail-field-full">
                  <p className="detail-field-label">Address</p>
                  <p className="detail-field-value">{[detailOrder.address_line1, detailOrder.address_line2, detailOrder.address_line3].filter(Boolean).join(', ')}</p>
                </div>
              </div>

              {/* Courier */}
              {detailOrder.tracking_id && (
                <div className="alert-band alert-info-band">
                  <Truck size={16} />
                  <span><strong>{detailOrder.tracking_id}</strong> • {detailOrder.courier_partner}</span>
                </div>
              )}

              {/* Status update */}
              {hasPermission('update_status') && (
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Update Status</label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    defaultValue={detailOrder.is_cancelled ? 'Cancelled' : detailOrder.tracking_status}
                    onChange={(e) => handleSingleStatusUpdate(detailOrder.order_id, e.target.value)}
                  >
                    {TRACKING_STAGES_WITH_SPECIAL.map((s) => (<option key={s} value={s}>{STAGE_ICONS[s]} {s}</option>))}
                  </select>
                </div>
              )}

              {/* Items */}
              {detailOrder.order_items && detailOrder.order_items.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Items ({detailOrder.order_items.length})</p>
                  <div className="items-list">
                    {detailOrder.order_items.map((item, i) => (
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
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-whatsapp" onClick={() => sendWhatsApp(detailOrder)} style={{ flex: 1, height: '2.5rem' }}>
                  <MessageCircle size={16} /> WhatsApp
                </button>
                <button className="btn btn-email" onClick={() => sendEmail(detailOrder)} style={{ flex: 1, height: '2.5rem' }} disabled={!detailOrder.customer_email}>
                  <Mail size={16} /> Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Team Member</h3>
              <button className="btn-icon" onClick={() => setShowTeamModal(false)}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="form-group"><label className="form-label">Display Name</label><input type="text" className="form-input" placeholder="John Doe" value={newTeamUser.displayName} onChange={(e) => setNewTeamUser({ ...newTeamUser, displayName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" placeholder="johndoe" value={newTeamUser.username} onChange={(e) => setNewTeamUser({ ...newTeamUser, username: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" placeholder="Secure password" value={newTeamUser.password} onChange={(e) => setNewTeamUser({ ...newTeamUser, password: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" style={{ width: '100%' }} value={newTeamUser.role} onChange={(e) => setNewTeamUser({ ...newTeamUser, role: e.target.value })}>
                  <option value="viewer">Viewer (read-only)</option>
                  <option value="manager">Manager (upload + update)</option>
                  <option value="admin">Admin (full access)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setShowTeamModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateTeamUser} disabled={!newTeamUser.username || !newTeamUser.password || !newTeamUser.displayName}>Create User</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Modal */}
      {showBizModal && (
        <div className="modal-overlay" onClick={() => setShowBizModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editBiz ? 'Edit Business' : 'Add Business'}</h3>
              <button className="btn-icon" onClick={() => setShowBizModal(false)}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="form-group"><label className="form-label">Business Name</label><input type="text" className="form-input" placeholder="My Brand" value={bizForm.name} onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Logo URL</label>
                <input type="text" className="form-input" placeholder="https://example.com/logo.png" value={bizForm.logoUrl} onChange={(e) => setBizForm({ ...bizForm, logoUrl: e.target.value })} />
                {bizForm.logoUrl && (
                  <div className="logo-preview" style={{ marginTop: '0.5rem' }}>
                    <img src={bizForm.logoUrl} alt="Preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div className="form-group"><label className="form-label">Support Email</label><input type="email" className="form-input" placeholder="support@brand.com" value={bizForm.supportEmail} onChange={(e) => setBizForm({ ...bizForm, supportEmail: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Support Phone</label><input type="text" className="form-input" placeholder="+91 98765 43210" value={bizForm.supportPhone} onChange={(e) => setBizForm({ ...bizForm, supportPhone: e.target.value })} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="isDefault" className="tf-checkbox" checked={bizForm.isDefault} onChange={(e) => setBizForm({ ...bizForm, isDefault: e.target.checked })} />
                <label htmlFor="isDefault" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>Set as default business</label>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setShowBizModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveBusiness} disabled={!bizForm.name}>{editBiz ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ STAT CARD COMPONENT ═══ */
function StatCard({ icon: Icon, label, value, color }: { icon: typeof ShoppingBag; label: string; value: number; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <Icon size={18} className="stat-card-icon" style={{ color }} />
      </div>
      <p className="stat-card-value">{value}</p>
    </div>
  );
}
