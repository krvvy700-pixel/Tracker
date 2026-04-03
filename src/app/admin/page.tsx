'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TRACKING_STAGES_WITH_SPECIAL, STAGE_ICONS, ROLE_PERMISSIONS } from '@/lib/constants';

interface OrderItem {
  id: string;
  brand: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
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
  tracking_status: string;
  tracking_id: string;
  courier_partner: string;
  tracking_token: string;
  status_updated_at: string;
  estimated_delivery: string;
  order_total: number;
  is_cancelled: boolean;
  cancelled_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

interface AuthUser {
  username: string;
  displayName: string;
  role: 'admin' | 'manager' | 'viewer';
}

interface TeamUser {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  last_login: string;
  created_at: string;
}

type TabType = 'orders' | 'upload' | 'team';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkTrackingId, setBulkTrackingId] = useState('');
  const [bulkCourier, setBulkCourier] = useState('');

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Team state
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamUser, setNewTeamUser] = useState({ username: '', password: '', displayName: '', role: 'viewer' });

  // Alert
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 50;

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (!savedToken || !savedUser) {
      router.push('/login');
      return;
    }

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

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (brandFilter) params.set('brand', brandFilter);

      const res = await fetch(`/api/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders);
        setTotalOrders(data.total);
      }
    } catch {
      showAlert('error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, statusFilter, brandFilter]);

  const fetchBrands = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/brands', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setBrands(data.brands);
    } catch { /* ignore */ }
  }, [token]);

  const fetchTeamUsers = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/team', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setTeamUsers(data.users);
    } catch { /* ignore */ }
  }, [token, user]);

  useEffect(() => {
    if (token) {
      fetchOrders();
      fetchBrands();
    }
  }, [token, fetchOrders, fetchBrands]);

  useEffect(() => {
    if (activeTab === 'team') fetchTeamUsers();
  }, [activeTab, fetchTeamUsers]);

  const handleSearchChange = (val: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  // CSV Upload
  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.endsWith('.csv')) {
      showAlert('error', 'Please upload a CSV file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResult(data.stats);
        showAlert('success', `Upload complete! ${data.stats.newOrders} new, ${data.stats.updatedOrders} updated`);
        fetchOrders();
        fetchBrands();
      } else {
        showAlert('error', data.error || 'Upload failed');
      }
    } catch {
      showAlert('error', 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Bulk status update
  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedOrders.size === 0) return;

    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrders),
          status: bulkStatus,
          trackingId: bulkTrackingId || undefined,
          courierPartner: bulkCourier || undefined,
        }),
      });

      if (res.ok) {
        showAlert('success', `Updated ${selectedOrders.size} orders to "${bulkStatus}"`);
        setSelectedOrders(new Set());
        setShowStatusModal(false);
        setBulkStatus('');
        setBulkTrackingId('');
        setBulkCourier('');
        fetchOrders();
      } else {
        showAlert('error', 'Update failed');
      }
    } catch {
      showAlert('error', 'Update failed');
    }
  };

  // Single order status update
  const handleSingleStatusUpdate = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderIds: [orderId], status }),
      });

      if (res.ok) {
        showAlert('success', `Order ${orderId} → ${status}`);
        fetchOrders();
        if (detailOrder && detailOrder.order_id === orderId) {
          setDetailOrder({ ...detailOrder, tracking_status: status, is_cancelled: status === 'Cancelled' });
        }
      }
    } catch {
      showAlert('error', 'Update failed');
    }
  };

  // Team management
  const handleCreateTeamUser = async () => {
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTeamUser),
      });

      const data = await res.json();

      if (res.ok) {
        showAlert('success', `User ${newTeamUser.username} created`);
        setShowTeamModal(false);
        setNewTeamUser({ username: '', password: '', displayName: '', role: 'viewer' });
        fetchTeamUsers();
      } else {
        showAlert('error', data.error || 'Failed to create user');
      }
    } catch {
      showAlert('error', 'Failed to create user');
    }
  };

  const handleToggleTeamUser = async (userId: string, isActive: boolean) => {
    try {
      await fetch('/api/team', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: userId, isActive }),
      });
      fetchTeamUsers();
    } catch { /* ignore */ }
  };

  const handleDeleteTeamUser = async (userId: string) => {
    if (!confirm('Delete this team member?')) return;
    try {
      await fetch(`/api/team?id=${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTeamUsers();
      showAlert('success', 'User deleted');
    } catch { /* ignore */ }
  };

  // Copy tracking link
  const copyTrackingLink = (trackingToken: string) => {
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${domain}/track/${trackingToken}`;
    navigator.clipboard.writeText(link);
    showAlert('success', 'Tracking link copied!');
  };

  // Get tracking link
  const getTrackingLink = (trackingToken: string) => {
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    return `${domain}/track/${trackingToken}`;
  };

  // Send via WhatsApp
  const sendWhatsApp = (order: Order) => {
    const phone = order.customer_mobile.startsWith('91') ? order.customer_mobile : '91' + order.customer_mobile;
    const link = getTrackingLink(order.tracking_token);
    const status = order.is_cancelled ? 'Cancelled' : order.tracking_status;
    const message = `Hi ${order.customer_name},\n\nYour order *${order.order_id}* is now: *${status}*\n\n📦 Track your order here:\n${link}\n\nThank you for shopping with us! 🙏`;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Send via Email
  const sendEmail = (order: Order) => {
    if (!order.customer_email) {
      showAlert('error', 'No email address for this customer');
      return;
    }
    const link = getTrackingLink(order.tracking_token);
    const status = order.is_cancelled ? 'Cancelled' : order.tracking_status;
    const subject = `Order ${order.order_id} — ${status}`;
    const body = `Hi ${order.customer_name},\n\nYour order ${order.order_id} is now: ${status}\n\nTrack your order here:\n${link}\n\nOrder Total: ₹${Number(order.order_total).toFixed(0)}\nPayment: ${order.payment_method}\n\nThank you for shopping with us!`;
    const mailtoUrl = `mailto:${order.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.order_id)));
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    const next = new Set(selectedOrders);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setSelectedOrders(next);
  };

  const getStatusClass = (status: string) => {
    return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    router.push('/login');
  };

  const totalPages = Math.ceil(totalOrders / limit);

  if (!user) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h2>📦 TrackFlow</h2>
          <span>CRM Dashboard</span>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); setSidebarOpen(false); }}>
            <span className="nav-item-icon">📋</span> Orders
          </button>
          {hasPermission('upload_csv') && (
            <button className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => { setActiveTab('upload'); setSidebarOpen(false); }}>
              <span className="nav-item-icon">📤</span> Upload CSV
            </button>
          )}
          {hasPermission('manage_team') && (
            <button className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => { setActiveTab('team'); setSidebarOpen(false); }}>
              <span className="nav-item-icon">👥</span> Team
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.displayName}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
          </div>
          <button className="nav-item" onClick={logout} style={{ marginTop: 8 }}>
            <span className="nav-item-icon">🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            <span>{alert.type === 'success' ? '✅' : alert.type === 'error' ? '❌' : 'ℹ️'}</span>
            {alert.message}
          </div>
        )}

        {/* ============ ORDERS TAB ============ */}
        {activeTab === 'orders' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Orders</h1>
                <p className="page-subtitle">{totalOrders} total orders</p>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Orders</div>
                <div className="stat-value gradient">{totalOrders}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Delivered</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {orders.filter((o) => o.tracking_status === 'Delivered').length}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">In Transit</div>
                <div className="stat-value" style={{ color: 'var(--info)' }}>
                  {orders.filter((o) => ['Shipped', 'In Transit', 'Out for Delivery'].includes(o.tracking_status)).length}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Cancelled</div>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>
                  {orders.filter((o) => o.is_cancelled).length}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="table-container">
              <div className="table-toolbar">
                <div className="table-search">
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    placeholder="Search order ID, name, phone, email..."
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
                <div className="table-filters">
                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  >
                    <option value="">All Status</option>
                    {TRACKING_STAGES_WITH_SPECIAL.map((s) => (
                      <option key={s} value={s}>{STAGE_ICONS[s]} {s}</option>
                    ))}
                  </select>

                  <select
                    className="filter-select"
                    value={brandFilter}
                    onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                  >
                    <option value="">All Brands</option>
                    {brands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bulk actions */}
              {selectedOrders.size > 0 && hasPermission('update_status') && (
                <div className="bulk-actions">
                  <span className="bulk-count">{selectedOrders.size} selected</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowStatusModal(true)}>
                    Update Status
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrders(new Set())}>
                    Clear
                  </button>
                </div>
              )}

              {loading ? (
                <div className="loading-overlay">
                  <div className="spinner spinner-lg"></div>
                  <p>Loading orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-text">No orders found</div>
                  <div className="empty-state-hint">Upload a CSV to get started</div>
                </div>
              ) : (
                <>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          {hasPermission('update_status') && (
                            <th style={{ width: 40 }}>
                              <input
                                type="checkbox"
                                className="table-checkbox"
                                onChange={toggleSelectAll}
                                checked={selectedOrders.size === orders.length && orders.length > 0}
                              />
                            </th>
                          )}
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Phone</th>
                          <th>City</th>
                          <th>Payment</th>
                          <th>Items</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.id}>
                            {hasPermission('update_status') && (
                              <td>
                                <input
                                  type="checkbox"
                                  className="table-checkbox"
                                  checked={selectedOrders.has(order.order_id)}
                                  onChange={() => toggleSelectOrder(order.order_id)}
                                />
                              </td>
                            )}
                            <td>
                              <strong style={{ color: 'var(--accent-primary-hover)' }}>{order.order_id}</strong>
                            </td>
                            <td>
                              <div>{order.customer_name}</div>
                              {order.customer_email && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.customer_email}</div>
                              )}
                            </td>
                            <td>{order.customer_mobile}</td>
                            <td>
                              <div>{order.city}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.state}</div>
                            </td>
                            <td>
                              <span className={`payment-badge ${order.payment_method === 'COD' ? 'payment-cod' : 'payment-prepaid'}`}>
                                {order.payment_method === 'COD' ? '💵 COD' : '💳 ' + order.payment_method}
                              </span>
                            </td>
                            <td>{order.order_items?.length || 0}</td>
                            <td>₹{Number(order.order_total).toFixed(0)}</td>
                            <td>
                              <span className={`status-badge ${getStatusClass(order.is_cancelled ? 'Cancelled' : order.tracking_status)}`}>
                                {STAGE_ICONS[order.is_cancelled ? 'Cancelled' : order.tracking_status]}{' '}
                                {order.is_cancelled ? 'Cancelled' : order.tracking_status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => { setDetailOrder(order); setShowDetailModal(true); }}
                                  title="View Details"
                                >
                                  👁️
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => copyTrackingLink(order.tracking_token)}
                                  title="Copy Tracking Link"
                                >
                                  🔗
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => sendWhatsApp(order)}
                                  title="Send via WhatsApp"
                                  style={{ color: '#25D366' }}
                                >
                                  💬
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => sendEmail(order)}
                                  title="Send via Email"
                                  style={{ color: '#60a5fa' }}
                                >
                                  📧
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-pagination">
                    <span className="pagination-info">
                      Page {page} of {totalPages} ({totalOrders} orders)
                    </span>
                    <div className="pagination-buttons">
                      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        ← Prev
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ============ UPLOAD TAB ============ */}
        {activeTab === 'upload' && hasPermission('upload_csv') && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Upload CSV</h1>
                <p className="page-subtitle">Import orders from Shopify export</p>
              </div>
            </div>

            <div style={{ maxWidth: 600 }}>
              <div
                className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                {uploading ? (
                  <>
                    <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }}></div>
                    <div className="upload-zone-text">Processing CSV...</div>
                    <div className="upload-zone-hint">Cleaning data and importing orders</div>
                  </>
                ) : (
                  <>
                    <div className="upload-zone-icon">📁</div>
                    <div className="upload-zone-text">Drop Shopify CSV here</div>
                    <div className="upload-zone-hint">or click to browse • .csv files only</div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </>
                )}
              </div>

              {uploadResult && (
                <div className="upload-stats">
                  <div className="upload-stat">
                    <div className="upload-stat-value">{(uploadResult as Record<string, number>).total}</div>
                    <div className="upload-stat-label">CSV Rows</div>
                  </div>
                  <div className="upload-stat">
                    <div className="upload-stat-value">{(uploadResult as Record<string, number>).unique}</div>
                    <div className="upload-stat-label">Unique Orders</div>
                  </div>
                  <div className="upload-stat">
                    <div className="upload-stat-value" style={{ color: 'var(--success)' }}>
                      {(uploadResult as Record<string, number>).newOrders}
                    </div>
                    <div className="upload-stat-label">New</div>
                  </div>
                  <div className="upload-stat">
                    <div className="upload-stat-value" style={{ color: 'var(--warning)' }}>
                      {(uploadResult as Record<string, number>).updatedOrders}
                    </div>
                    <div className="upload-stat-label">Updated</div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <div className="alert alert-info">
                  <span>ℹ️</span>
                  <div>
                    <strong>How it works:</strong> Upload your Shopify &quot;orders_export&quot; CSV. The system automatically
                    cleans the data, removes unnecessary columns (keeps only 14 fields), normalizes phone numbers,
                    and deduplicates. Re-uploading the same orders updates existing data without creating duplicates.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ TEAM TAB ============ */}
        {activeTab === 'team' && hasPermission('manage_team') && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Team Management</h1>
                <p className="page-subtitle">Manage team members and their roles</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowTeamModal(true)}>
                + Add Member
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div className="alert alert-info">
                <span>ℹ️</span>
                <div>
                  <strong>Roles:</strong> Admin (full access) • Manager (upload CSV, update status, cancel orders) • Viewer (view only)
                </div>
              </div>
            </div>

            <div className="table-container">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Super admin row */}
                    <tr>
                      <td><strong>Super Admin</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>env credentials</td>
                      <td><span className="role-badge role-admin">Admin</span></td>
                      <td><span style={{ color: 'var(--success)' }}>● Active</span></td>
                      <td>—</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>System account</td>
                    </tr>
                    {teamUsers.map((tu) => (
                      <tr key={tu.id}>
                        <td>{tu.display_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{tu.username}</td>
                        <td>
                          <span className={`role-badge role-${tu.role}`}>{tu.role}</span>
                        </td>
                        <td>
                          <span style={{ color: tu.is_active ? 'var(--success)' : 'var(--danger)' }}>
                            ● {tu.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {tu.last_login ? new Date(tu.last_login).toLocaleDateString() : 'Never'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleToggleTeamUser(tu.id, !tu.is_active)}
                            >
                              {tu.is_active ? '🔒' : '🔓'}
                            </button>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleDeleteTeamUser(tu.id)}
                              style={{ color: 'var(--danger)' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ============ BULK STATUS MODAL ============ */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Update Status ({selectedOrders.size} orders)</h3>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Status</label>
                <select className="form-select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                  <option value="">Select status...</option>
                  {TRACKING_STAGES_WITH_SPECIAL.map((s) => (
                    <option key={s} value={s}>{STAGE_ICONS[s]} {s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tracking ID (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., AWB number"
                  value={bulkTrackingId}
                  onChange={(e) => setBulkTrackingId(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Courier Partner (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Delhivery, BlueDart"
                  value={bulkCourier}
                  onChange={(e) => setBulkCourier(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowStatusModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkUpdate} disabled={!bulkStatus}>
                Update {selectedOrders.size} Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ORDER DETAIL MODAL ============ */}
      {showDetailModal && detailOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Order {detailOrder.order_id}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="order-details-grid">
                <div className="order-detail-item">
                  <div className="order-detail-label">Customer</div>
                  <div className="order-detail-value">{detailOrder.customer_name}</div>
                </div>
                <div className="order-detail-item">
                  <div className="order-detail-label">Phone</div>
                  <div className="order-detail-value">{detailOrder.customer_mobile}</div>
                </div>
                <div className="order-detail-item">
                  <div className="order-detail-label">Email</div>
                  <div className="order-detail-value">{detailOrder.customer_email || '—'}</div>
                </div>
                <div className="order-detail-item">
                  <div className="order-detail-label">Payment</div>
                  <div className="order-detail-value">
                    <span className={`payment-badge ${detailOrder.payment_method === 'COD' ? 'payment-cod' : 'payment-prepaid'}`}>
                      {detailOrder.payment_method === 'COD' ? '💵 COD' : '💳 ' + detailOrder.payment_method}
                    </span>
                  </div>
                </div>
                <div className="order-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="order-detail-label">Address</div>
                  <div className="order-detail-value" style={{ fontSize: 13 }}>
                    {[detailOrder.address_line1, detailOrder.address_line2, detailOrder.address_line3].filter(Boolean).join(', ')}
                    <br />
                    {detailOrder.city}, {detailOrder.state} — {detailOrder.pincode}
                  </div>
                </div>
              </div>

              {/* Status Update */}
              {hasPermission('update_status') && (
                <div className="form-group">
                  <label className="form-label">Update Status</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TRACKING_STAGES_WITH_SPECIAL.map((s) => (
                      <button
                        key={s}
                        className={`btn btn-xs ${
                          (detailOrder.is_cancelled ? 'Cancelled' : detailOrder.tracking_status) === s
                            ? 'btn-primary'
                            : 'btn-ghost'
                        }`}
                        onClick={() => handleSingleStatusUpdate(detailOrder.order_id, s)}
                      >
                        {STAGE_ICONS[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracking link */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Tracking Link</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/track/${detailOrder.tracking_token}`}
                    style={{ fontSize: 12 }}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => copyTrackingLink(detailOrder.tracking_token)}>
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* Send Tracking Link */}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Send Tracking Link</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => sendWhatsApp(detailOrder)}
                    style={{ background: '#25D366', color: 'white' }}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => sendEmail(detailOrder)}
                    style={{ background: '#3b82f6', color: 'white' }}
                    disabled={!detailOrder.customer_email}
                  >
                    📧 Email
                  </button>
                </div>
                {!detailOrder.customer_email && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    No email address available for this customer
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="items-list">
                <div className="items-list-title">Items ({detailOrder.order_items?.length || 0})</div>
                {detailOrder.order_items?.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-name">{item.product_name}</div>
                    <span className="item-brand">{item.brand}</span>
                    <span className="item-qty">×{item.quantity}</span>
                    <span className="item-price">₹{Number(item.price).toFixed(0)}</span>
                  </div>
                ))}
                <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 700, fontSize: 15 }}>
                  Total: ₹{Number(detailOrder.order_total).toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ ADD TEAM MEMBER MODAL ============ */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Team Member</h3>
              <button className="modal-close" onClick={() => setShowTeamModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={newTeamUser.displayName}
                  onChange={(e) => setNewTeamUser({ ...newTeamUser, displayName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="johndoe"
                  value={newTeamUser.username}
                  onChange={(e) => setNewTeamUser({ ...newTeamUser, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Secure password"
                  value={newTeamUser.password}
                  onChange={(e) => setNewTeamUser({ ...newTeamUser, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={newTeamUser.role}
                  onChange={(e) => setNewTeamUser({ ...newTeamUser, role: e.target.value })}
                >
                  <option value="viewer">Viewer (read-only)</option>
                  <option value="manager">Manager (upload + update)</option>
                  <option value="admin">Admin (full access)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowTeamModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateTeamUser}
                disabled={!newTeamUser.username || !newTeamUser.password || !newTeamUser.displayName}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
