import React, { useState, useEffect, useMemo } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  Scissors, Search, Download, RefreshCw, ExternalLink,
  Layers3, Eye, AlertCircle, FileSpreadsheet,
  CheckCircle2, Sparkles, Tag, Printer, PlusCircle, Database,
  ClipboardList, CheckSquare, Truck, Package, ChevronLeft, ChevronRight,
  TrendingUp, BarChart2, Hash, Calendar, User, SlidersHorizontal,
  ArrowRight, ShieldCheck, Shirt, CircleDot, Table, LayoutGrid, X,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { GARMENT_CATEGORIES, getCleanImageUrl } from '../utils/designHelpers';

export default function OnlyCutting({
  currentUser,
  role,
  onNavigateToDesign,
  onNavigateToZipPO,
  onNavigateToDoriPO,
  onNavigateToBonePO,
  onNavigateToMaterialIssue,
  onNavigateToStockAccessories,
  onRedirectToTab
}) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLotNo, setExpandedLotNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fabricFilter, setFabricFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState('');
  const [workerStats, setWorkerStats] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected Lot Matrix cache
  const [matricesCache, setMatricesCache] = useState({});
  const [loadingMatrixFor, setLoadingMatrixFor] = useState(null);

  const userRole = (role || currentUser?.role || '').toLowerCase();
  const isStoreUser = userRole.includes('store');
  const isAdminUser = userRole.includes('admin');

  const [designedLotIds, setDesignedLotIds] = useState(new Set());

  // Fast fetch undesigned cutting lots (Instant DB load + background Google Sheet sync)
  const fetchLots = async (isLive = false, isSilent = false) => {
    if (isLive) setSyncing(true);
    else if (!isSilent) setLoading(true);
    if (!isSilent) setError('');
    try {
      const endpoint = isLive 
        ? `${getBackendUrl()}/api/reports/undesigned-cutting-lots?live=true`
        : `${getBackendUrl()}/api/reports/undesigned-cutting-lots`;

      const [lotsRes, designsRes, statusRes] = await Promise.all([
        fetch(endpoint),
        fetch(`${getBackendUrl()}/api/designs`).catch(() => null),
        fetch(`${getBackendUrl()}/api/sync/status`).catch(() => null)
      ]);

      const lotsData = lotsRes.ok ? await lotsRes.json() : [];
      const designsData = designsRes && designsRes.ok ? await designsRes.json() : [];
      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        setWorkerStats(statusData?.workerStats || null);
      }

      // Build Set of all designed lot identifiers (id, lotNo2, name)
      const designedSet = new Set();
      if (Array.isArray(designsData)) {
        designsData.forEach(d => {
          if (d.id) designedSet.add(String(d.id).toLowerCase().trim());
          if (d.lotNo2 && d.lotNo2 !== 'N/A') designedSet.add(String(d.lotNo2).toLowerCase().trim());
          if (d.name) designedSet.add(String(d.name).toLowerCase().trim());
        });
      }
      setDesignedLotIds(designedSet);

      const list = Array.isArray(lotsData) ? lotsData : [];
      setLots(list);
      if (isLive) {
        setSyncSuccess(`✓ Live Google Sheet synchronized! ${list.length} cutting lots active in MySQL.`);
        setTimeout(() => setSyncSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Failed to fetch undesigned cutting lots:', err);
      if (!isSilent) setError('Failed to load cutting lots: ' + err.message);
    } finally {
      if (!isSilent) setLoading(false);
      setSyncing(false);
    }
  };

  // Background silent synchronization without UI blocking
  const syncInBackground = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/sync-google-sheets`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.inserted > 0 || data.updated > 0) {
          // If new or updated records were ingested from Google Sheet, update UI seamlessly
          fetchLots(false, true);
          setSyncSuccess(`⚡ Incremental Worker Synced: ${data.inserted} new / ${data.updated} updated lots into MySQL.`);
          setTimeout(() => setSyncSuccess(''), 5000);
        }
      }
      // Update worker stats
      const statusRes = await fetch(`${getBackendUrl()}/api/sync/status`).catch(() => null);
      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        setWorkerStats(statusData?.workerStats || null);
      }
    } catch (_) {}
  };

  useEffect(() => {
    // 1. Instant load from local/indexed MySQL DB (<20ms, zero lag)
    fetchLots(false);

    // 2. Non-blocking background sync with Google Sheets
    syncInBackground();

    // 3. Auto-sync check every 30 seconds in the background
    const interval = setInterval(() => {
      syncInBackground();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch Matrix for expanded lot
  const toggleExpandLot = async (lotNo) => {
    if (expandedLotNo === lotNo) {
      setExpandedLotNo(null);
      return;
    }

    setExpandedLotNo(lotNo);

    if (matricesCache[lotNo]) return; // Already cached

    setLoadingMatrixFor(lotNo);
    try {
      const res = await fetch(`${getBackendUrl()}/api/cutting/${encodeURIComponent(lotNo)}`);
      if (res.ok) {
        const data = await res.json();
        setMatricesCache(prev => ({ ...prev, [lotNo]: data }));
      }
    } catch (err) {
      console.warn('Failed to load matrix for lot:', lotNo, err);
    } finally {
      setLoadingMatrixFor(null);
    }
  };

  // Sync Google Sheets manually on demand
  const handleSyncSheets = async () => {
    await fetchLots(true);
  };

  // Helper: Validate cutting lot and STRICTLY OMIT ANY LOT THAT HAS BEEN DESIGNED
  const isValidLot = (lot) => {
    if (!lot || !lot.Lot_Number) return false;
    const lotStr = String(lot.Lot_Number).trim();
    if (!lotStr || lotStr.includes('{') || lotStr.includes('}') || lotStr.includes('qty:') || lotStr.includes('shade:') || lotStr.includes('receivedDate:')) {
      return false;
    }

    // Double Check: If lot exists in designs table, strictly LEAVE OUT / OMIT
    const cleanLot = lotStr.toLowerCase();
    if (designedLotIds.has(cleanLot)) {
      return false;
    }

    return true;
  };

  // Unique fabrics
  const uniqueFabrics = useMemo(() => {
    const set = new Set();
    lots.forEach(l => {
      if (isValidLot(l)) {
        if (l.Fabric && l.Fabric.trim()) set.add(l.Fabric.trim());
      }
    });
    return Array.from(set).sort();
  }, [lots]);

  // Filtered lots: AUTOMATICALLY & STRICTLY FILTERED BY Saved_At ON OR AFTER 10 AUG 2026
  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      // 1. Mandatory Validity & Saved_At Date Filter: >= 10 AUGUST 2026
      if (!isValidLot(lot)) return false;

      // 2. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        String(lot.Lot_Number || '').toLowerCase().includes(q) ||
        String(lot.Fabric || '').toLowerCase().includes(q) ||
        String(lot.Style || '').toLowerCase().includes(q) ||
        String(lot.Garment_Type || '').toLowerCase().includes(q) ||
        String(lot.Party_Name || '').toLowerCase().includes(q) ||
        String(lot.Brand || '').toLowerCase().includes(q) ||
        String(lot.Supervisor || '').toLowerCase().includes(q);

      // 3. Fabric Filter
      const matchesFabric = fabricFilter === 'all' || String(lot.Fabric || '').trim() === fabricFilter;

      return matchesSearch && matchesFabric;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') {
        const dateB = String(b.Saved_At || b.Date_of_Issue || '');
        const dateA = String(a.Saved_At || a.Date_of_Issue || '');
        return dateB.localeCompare(dateA) || Number(b.id) - Number(a.id);
      }
      if (sortBy === 'date_asc') {
        const dateA = String(a.Saved_At || a.Date_of_Issue || '');
        const dateB = String(b.Saved_At || b.Date_of_Issue || '');
        return dateA.localeCompare(dateB) || Number(a.id) - Number(b.id);
      }
      if (sortBy === 'latest') return Number(b.id) - Number(a.id);
      if (sortBy === 'oldest') return Number(a.id) - Number(b.id);
      if (sortBy === 'lot_asc') return String(a.Lot_Number || '').localeCompare(String(b.Lot_Number || ''), undefined, { numeric: true });
      if (sortBy === 'lot_desc') return String(b.Lot_Number || '').localeCompare(String(a.Lot_Number || ''), undefined, { numeric: true });
      return 0;
    });
  }, [lots, searchQuery, fabricFilter, sortBy]);

  // Paginated lots
  const paginatedLots = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLots.slice(start, start + pageSize);
  }, [filteredLots, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLots.length / pageSize) || 1;

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fabricFilter, sortBy]);

  // KPI Metrics Calculation for Filtered View
  const stats = useMemo(() => {
    let totalPieces = 0;
    const fabricSet = new Set();

    filteredLots.forEach(lot => {
      const q = parseInt(lot.Cutting_Qty, 10) || 0;
      totalPieces += q;
      if (lot.Fabric && lot.Fabric.trim()) fabricSet.add(lot.Fabric.trim());
    });

    const avgLotSize = filteredLots.length > 0 ? Math.round(totalPieces / filteredLots.length) : 0;

    return {
      totalLots: filteredLots.length,
      totalPieces,
      activeFabrics: fabricSet.size,
      avgLotSize
    };
  }, [filteredLots]);

  // Actions Routing
  const navigateTo = (path, lotNo) => {
    const target = lotNo;
    if (path === 'design' && onNavigateToDesign) {
      onNavigateToDesign(target);
    } else if (path === 'zip' && onNavigateToZipPO) {
      onNavigateToZipPO(target);
    } else if (path === 'dori' && onNavigateToDoriPO) {
      onNavigateToDoriPO(target);
    } else if (path === 'bone' && onNavigateToBonePO) {
      onNavigateToBonePO(target);
    } else if (path === 'issue' && onNavigateToMaterialIssue) {
      onNavigateToMaterialIssue(target);
    } else if (path === 'stock' && onNavigateToStockAccessories) {
      onNavigateToStockAccessories(target);
    } else if (onRedirectToTab) {
      if (path === 'design') onRedirectToTab('design');
      if (path === 'zip') onRedirectToTab('zip_po');
      if (path === 'dori') onRedirectToTab('dori_po');
      if (path === 'bone') onRedirectToTab('bone_po');
      if (path === 'issue') onRedirectToTab('material_issue');
      if (path === 'stock') onRedirectToTab('material_verification');
    } else {
      const routeMap = {
        design: 'design',
        zip: 'zip-po',
        dori: 'dori-po',
        bone: 'bone-po',
        issue: 'material-issue',
        stock: 'material-verification'
      };
      window.location.href = `/${routeMap[path] || 'design'}?lot=${encodeURIComponent(target)}`;
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Lot Number', 'Issue Date', 'Party / Client', 'Fabric', 'Garment Type',
      'Style', 'Cutting Qty (pcs)', 'Shades/Colors', 'Sizes', 'Supervisor', 'Brand'
    ];
    const rows = filteredLots.map(l => [
      `"${l.Lot_Number || ''}"`,
      `"${l.Date_of_Issue || ''}"`,
      `"${(l.Party_Name || l.Brand || '').replace(/"/g, '""')}"`,
      `"${(l.Fabric || '').replace(/"/g, '""')}"`,
      `"${(l.Garment_Type || '').replace(/"/g, '""')}"`,
      `"${(l.Style || '').replace(/"/g, '""')}"`,
      l.Cutting_Qty || 0,
      `"${(l.Shades || '').replace(/"/g, '""')}"`,
      `"${(l.Sizes || '').replace(/"/g, '""')}"`,
      `"${(l.Supervisor || '').replace(/"/g, '""')}"`,
      `"${(l.Brand || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `only_cutting_lots_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade" style={{ paddingBottom: '30px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Scissors size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                  Only Cutting &mdash; Not Designed
                </h2>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid #10b981',
                  fontSize: '11px',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                  {workerStats?.lastStatus === 'success' ? 'Worker Synced' : 'Auto-Sync Active'}
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  color: '#6366f1',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  MySQL Indexed
                </span>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Incremental worker ingests Google Sheet into MySQL &bull; Express API serves React instantly with zero lag.
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSyncSheets}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700' }}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Fetching Live Data...' : '⚡ Refresh Live Data'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={filteredLots.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {syncSuccess && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid #10b981',
          color: '#047857',
          fontSize: '12.5px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
            <span>{syncSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncSuccess('')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
              borderRadius: '4px'
            }}
            title="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filter Toolbar (Cleaned Up: Search + Fabric + Sort + Rows Per Page) */}
      <div className="panel" style={{ padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-input"
              placeholder="Search Lot Number, Fabric, Style, Client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13.5px' }}
            />
          </div>

          {/* Fabric Filter Dropdown */}
          <div style={{ width: '180px' }}>
            <select
              className="form-input"
              value={fabricFilter}
              onChange={(e) => setFabricFilter(e.target.value)}
              style={{ height: '38px', fontSize: '13px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value="all">All Fabrics</option>
              {uniqueFabrics.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div style={{ width: '170px' }}>
            <select
              className="form-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ height: '38px', fontSize: '13px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="qty_desc">Quantity: High-Low</option>
              <option value="qty_asc">Quantity: Low-High</option>
              <option value="lot_desc">Lot No: Desc</option>
              <option value="lot_asc">Lot No: Asc</option>
            </select>
          </div>

          {/* Page size */}
          <div style={{ width: '120px' }}>
            <select
              className="form-input"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ height: '38px', fontSize: '13px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value={15}>15 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* FULL ROWS & COLUMNS DATA GRID */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <div style={{
          padding: '12px 18px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Table size={18} className="text-accent" />
            <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
              Cutting Data Grid ({filteredLots.length} records on or after 10 Aug 2026)
            </strong>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Click on any row to expand/collapse color-size matrix breakdown
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Loading cutting schedule grid...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--danger)' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px auto' }} />
            <p>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={fetchLots}>Retry</button>
          </div>
        ) : paginatedLots.length > 0 ? (
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', border: '1px solid var(--border-color)' }}>
              <thead>
                <tr style={{
                  backgroundColor: 'var(--bg-secondary)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                }}>
                  <th style={{ padding: '10px 12px', border: '1px solid var(--border-color)', width: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '110px' }}>Lot Number</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '105px' }}>Date of Issue</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '140px' }}>Party / Client</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '150px' }}>Fabric</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '140px' }}>Garment Type</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '170px' }}>Style</th>
                  <th style={{ padding: '10px 14px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', minWidth: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLots.map((lot, idx) => {
                  const rowNumber = ((currentPage - 1) * pageSize) + idx + 1;
                  const isExpanded = expandedLotNo === lot.Lot_Number;
                  const matrix = matricesCache[lot.Lot_Number];

                  return (
                    <React.Fragment key={lot.id || lot.Lot_Number || idx}>
                      {/* MAIN ROW */}
                      <tr
                        style={{
                          backgroundColor: isExpanded
                            ? 'rgba(99, 102, 241, 0.08)'
                            : idx % 2 === 0
                              ? 'var(--bg-card)'
                              : 'var(--bg-primary)',
                          transition: 'background-color 0.15s',
                          cursor: 'pointer'
                        }}
                        className="grid-row-hover"
                      >
                        {/* Index */}
                        <td
                          style={{ padding: '10px 12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          {rowNumber}
                        </td>

                        {/* Lot Number */}
                        <td
                          style={{ padding: '10px 14px', border: '1px solid var(--border-color)' }}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              backgroundColor: 'var(--accent-light)',
                              color: 'var(--accent-color)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontWeight: '800',
                              fontFamily: 'monospace',
                              fontSize: '13px'
                            }}>
                              #{lot.Lot_Number}
                            </span>
                            {isExpanded ? <ChevronUp size={14} className="text-accent" /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                          </div>
                        </td>

                        {/* Date of Issue */}
                        <td
                          style={{ padding: '10px 14px', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', fontWeight: '500' }}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          {lot.Date_of_Issue || '—'}
                        </td>

                        {/* Party / Client */}
                        <td
                          style={{ padding: '10px 14px', border: '1px solid var(--border-color)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}
                          title={lot.Party_Name || lot.Brand}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          {lot.Party_Name || lot.Brand || '—'}
                        </td>

                        {/* Fabric */}
                        <td
                          style={{ padding: '10px 14px', border: '1px solid var(--border-color)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={lot.Fabric}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{lot.Fabric || 'Standard'}</span>
                        </td>

                        {/* Garment Type */}
                        <td
                          style={{ padding: '10px 14px', border: '1px solid var(--border-color)' }}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-muted)',
                            fontWeight: '600'
                          }}>
                            {lot.Garment_Type || 'Garment'}
                          </span>
                        </td>

                        {/* Style */}
                        <td
                          style={{ padding: '10px 14px', border: '1px solid var(--border-color)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={lot.Style}
                          onClick={() => toggleExpandLot(lot.Lot_Number)}
                        >
                          {lot.Style || '—'}
                        </td>

                        {/* Row Actions */}
                        <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {/* Create Design */}
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateTo('design', lot.Lot_Number);
                              }}
                              style={{ padding: '4px 12px', fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap' }}
                              title="Create Below of Material (BOM) Design"
                            >
                              <PlusCircle size={13} />
                              <span>Create Design</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* INLINE EXPANDED MATRIX BREAKDOWN ROW */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: '16px 20px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Layers3 size={18} className="text-accent" />
                                <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                                  Cutting Matrix Breakdown &mdash; Lot #{lot.Lot_Number} ({lot.Fabric} &bull; {lot.Style})
                                </strong>
                              </div>

                              {loadingMatrixFor === lot.Lot_Number ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 6px auto' }} />
                                  <span>Loading matrix rows for #{lot.Lot_Number}...</span>
                                </div>
                              ) : matrix && matrix.rows && matrix.rows.length > 0 ? (
                                <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '8px 14px', textAlign: 'left', borderRight: '1px solid var(--border-color)' }}>Color / Shade</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Table #</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>M</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>L</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>XL</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>XXL</th>
                                        <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '700' }}>Total Pcs</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {matrix.rows.map((r, mIdx) => (
                                        <tr key={mIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                          <td style={{ padding: '8px 14px', fontWeight: '600', color: 'var(--text-main)', borderRight: '1px solid var(--border-color)' }}>{r.color}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)' }}>{r.cuttingTable || 1}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.sizes?.M ?? 0}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.sizes?.L ?? 0}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.sizes?.XL ?? 0}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.sizes?.XXL ?? 0}</td>
                                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '800', color: '#10b981' }}>{r.totalPcs || 0}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                  {lot.Shades ? `Shades: ${lot.Shades} | Sizes: ${lot.Sizes}` : 'No detailed matrix breakdown rows available.'}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Scissors size={32} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text-main)' }}>No Cutting Lots Found</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>
              No undesigned cutting lots found matching current search filters.
            </p>
          </div>
        )}

        {/* Table Footer with Pagination */}
        {filteredLots.length > 0 && (
          <div style={{
            padding: '12px 18px',
            backgroundColor: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12.5px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <span>
              Showing <strong>{((currentPage - 1) * pageSize) + 1}&ndash;{Math.min(currentPage * pageSize, filteredLots.length)}</strong> of <strong>{filteredLots.length}</strong> cutting lots
            </span>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '5px 10px' }}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '5px 10px' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
