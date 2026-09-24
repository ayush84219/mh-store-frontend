import { useState, useEffect } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  FileText, CheckSquare, Layers,
  ArrowRight, TrendingUp, PieChart, Layers3, Search, Printer,
  ClipboardList, RotateCcw, Scale
} from 'lucide-react';

export default function DashboardView({
  stats,
  transactions,
  designs = [],
  onNavigate,
  currencySymbol,
  role
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('all');
  const [txDateFilter, setTxDateFilter] = useState('all');
  const [txSort, setTxSort] = useState('latest');
  const [txPage, setTxPage] = useState(5);

  const [weightTransactions, setWeightTransactions] = useState([]);
  const [wcSearchQuery, setWcSearchQuery] = useState('');
  const [wcStatusFilter, setWcStatusFilter] = useState('all');
  const [wcDateFilter, setWcDateFilter] = useState('all');
  const [wcSort, setWcSort] = useState('latest');
  const [wcPage, setWcPage] = useState(10);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/weight-capture`)
      .then(res => res.ok ? res.json() : { success: false, data: [] })
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setWeightTransactions(data.data);
        }
      })
      .catch(err => console.error('Dashboard weight capture fetch error:', err));
  }, []);

  const applyDateFilter = (dateStr, filter) => {
    if (filter === 'all') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    if (filter === 'today') return d.toDateString() === now.toDateString();
    if (filter === 'week') {
      const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (filter === 'month') {
      const monthAgo = new Date(); monthAgo.setDate(now.getDate() - 30);
      return d >= monthAgo;
    }
    return true;
  };

  const sortByDate = (arr, dateField, order) => {
    return [...arr].sort((a, b) => {
      const da = new Date(a[dateField] || 0);
      const db = new Date(b[dateField] || 0);
      return order === 'latest' ? db - da : da - db;
    });
  };

  const filteredTransactions = sortByDate(
    transactions.filter(t => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || (
        t.id.toLowerCase().includes(query) ||
        t.itemName.toLowerCase().includes(query) ||
        t.type.toLowerCase().includes(query) ||
        t.status.toLowerCase().includes(query)
      );
      const matchesStatus = txStatusFilter === 'all' || t.status.toLowerCase() === txStatusFilter.toLowerCase();
      const matchesDate = applyDateFilter(t.date, txDateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    }),
    'date',
    txSort
  );

  const filteredWcTransactions = sortByDate(
    weightTransactions.filter(w => {
      const q = wcSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (w.materialName || '').toLowerCase().includes(q) ||
        (w.materialCode || '').toLowerCase().includes(q) ||
        (w.lotNo || '').toLowerCase().includes(q) ||
        (w.supplier || '').toLowerCase().includes(q) ||
        (w.status || '').toLowerCase().includes(q) ||
        (w.storeLocation || '').toLowerCase().includes(q)
      );
      const matchesStatus = wcStatusFilter === 'all' || (w.status || 'Captured').toLowerCase() === wcStatusFilter.toLowerCase();
      const matchesDate = applyDateFilter(w.capturedAt, wcDateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    }),
    'capturedAt',
    wcSort
  );

  const handlePrint = () => {
    document.body.classList.add('print-transactions-mode');
    window.print();
  };

  const txStatuses = [...new Set(transactions.map(t => t.status))].filter(Boolean);
  const wcStatuses = [...new Set(weightTransactions.map(w => w.status || 'Captured'))].filter(Boolean);

  const selectStyle = { height: '32px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-main)', padding: '0 8px', cursor: 'pointer' };

  // Calculate distribution for the Category Pie Chart representation dynamically
  const categoryCounts = {};
  designs.forEach(d => {
    if (d.category) {
      categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
    }
  });

  const totalDesigns = designs.length || 1;
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f97316', '#a855f7'];

  const categories = Object.keys(categoryCounts).map((name, idx) => ({
    name,
    value: Math.round((categoryCounts[name] / totalDesigns) * 100),
    color: colors[idx % colors.length]
  }));

  // fallback if no categories exist
  if (categories.length === 0) {
    categories.push({ name: 'No Designs', value: 100, color: '#6b7280' });
  }

  // SVG parameters for donut chart
  let cumulativePercent = 0;
  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };
  const getRolePanel = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin' || r === 'supply chain lead') return 'admin';
    if (r === 'designer' || r === 'lead designer' || r === 'pattern auditor') return 'designer';
    return 'store';
  };

  const renderFlowchart = () => {
    const panel = getRolePanel(role);
    if (panel === 'admin') {
      return (
        <div className="flowchart-container">
          <div className="flowchart-step" onClick={() => onNavigate('design')}>
            <Layers3 size={24} />
            <span>PRODUCT DESIGN</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('material_issue')}>
            <ClipboardList size={24} />
            <span>MATERIAL ISSUE</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('generate_po')}>
            <FileText size={24} />
            <span>GENERATE PO</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('material_details')}>
            <Layers size={24} />
            <span>MATERIAL DETAIL</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('reports_history')}>
            <TrendingUp size={24} />
            <span>REPORT AND HISTORY</span>
          </div>
        </div>
      );
    }

    if (panel === 'designer') {
      return (
        <div className="flowchart-container">
          <div className="flowchart-step" onClick={() => onNavigate('design')}>
            <Layers3 size={24} />
            <span>PRODUCT DESIGN</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('material_verification')}>
            <CheckSquare size={24} />
            <span>MATERIAL VERIFY</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('zip_po')}>
            <FileText size={24} />
            <span>ZIP, DORI & BONE PO</span>
          </div>
        </div>
      );
    }

    if (panel === 'store') {
      return (
        <div className="flowchart-container">
          <div className="flowchart-step" onClick={() => onNavigate('material_details')}>
            <Layers size={24} />
            <span>MATERIAL DETAIL</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('material_issue')}>
            <ClipboardList size={24} />
            <span>MATERIAL ISSUE</span>
          </div>
          <div className="flowchart-arrow">
            <ArrowRight size={20} />
          </div>

          <div className="flowchart-step" onClick={() => onNavigate('return_material')}>
            <RotateCcw size={24} />
            <span>MATERIAL RETURN</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="animate-fade">


      {/* Procurement Process Flow */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <Layers3 size={18} className="text-accent" />
            Procurement Process Flow
          </h2>
        </div>

        {renderFlowchart()}

      </div>

      {/* Double Column: Recent Transactions & Analytics */}
      <div className="split-view">
        {/* Left Column: Recent Transactions */}
        <div className="panel transactions-panel" style={{ marginBottom: 0 }}>
          <div style={{ display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h2 className="panel-title" style={{ margin: 0 }}>Recent Transactions</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm print-hide"
                onClick={handlePrint}
                style={{ height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Printer size={12} />
                <span>Print</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} className="print-hide">
              <div style={{ position: 'relative', flex: '1 1 150px', minWidth: '130px' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '28px', height: '32px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', width: '100%' }}
                />
              </div>
              <select value={txStatusFilter} onChange={e => setTxStatusFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Status</option>
                {txStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={txDateFilter} onChange={e => setTxDateFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <select value={txSort} onChange={e => { setTxSort(e.target.value); setTxPage(5); }} style={selectStyle}>
                <option value="latest">⬇ Latest First</option>
                <option value="oldest">⬆ Oldest First</option>
              </select>
              {(searchQuery || txStatusFilter !== 'all' || txDateFilter !== 'all' || txSort !== 'latest') && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSearchQuery(''); setTxStatusFilter('all'); setTxDateFilter('all'); setTxSort('latest'); setTxPage(5); }}
                  style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item Name</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No recent transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.slice(0, txPage).map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 'bold' }}>{t.id}</td>
                      <td>{t.itemName}</td>
                      <td>{t.type}</td>
                      <td>{t.date}</td>
                      <td>
                        <span className={`status-badge ${t.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredTransactions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing {Math.min(txPage, filteredTransactions.length)} of {filteredTransactions.length} entries
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {txPage < filteredTransactions.length && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setTxPage(p => p + 5)} style={{ fontSize: '12px', padding: '0 12px', height: '30px' }}>
                      Show More (+5)
                    </button>
                  )}
                  {txPage > 5 && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setTxPage(5)} style={{ fontSize: '12px', padding: '0 12px', height: '30px' }}>
                      Show Less
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Garment Categories Share (SVG Donut Chart) */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title">
              <PieChart size={18} className="text-accent" />
              Design Distribution
            </h2>
          </div>

          <div className="chart-container-svg">
            <svg width="220" height="220" viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }}>
              {categories.map((cat, idx) => {
                const percent = cat.value / 100;
                const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                cumulativePercent += percent;
                const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                const largeArcFlag = percent > 0.5 ? 1 : 0;

                const pathData = [
                  `M ${startX} ${startY}`, // Move to starting coordinate
                  `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Draw arc to end coordinate
                  `L 0 0`, // Line back to center
                  `Z` // Close path
                ].join(' ');

                return (
                  <path
                    key={idx}
                    d={pathData}
                    fill={cat.color}
                    stroke="var(--bg-secondary)"
                    strokeWidth="0.02"
                  />
                );
              })}
              {/* Center cutout to make it a donut chart */}
              <circle cx="0" cy="0" r="0.6" fill="var(--bg-secondary)" />
            </svg>

            {/* Absolute overlay count in middle */}
            <div style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <span style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-family-title)' }}>
                {stats.activeDesigns}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                Designs
              </span>
            </div>
          </div>

          <div className="chart-legend">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {categories.map((cat, idx) => (
                <div key={idx} className="chart-legend-item">
                  <div className="chart-legend-color" style={{ backgroundColor: cat.color }}></div>
                  <span style={{ fontWeight: '500' }}>{cat.name} ({cat.value}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weight Capture Transactions Section */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div style={{ display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} style={{ color: 'var(--accent-color)' }} />
              Material Add Transactions
              <span style={{ fontSize: '11px', fontWeight: '600', background: 'var(--accent-light)', color: 'var(--accent-color)', borderRadius: '12px', padding: '2px 10px', marginLeft: '4px' }}>
                {filteredWcTransactions.length} / {weightTransactions.length} entries
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 160px', minWidth: '140px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Search size={13} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Search material, lot, location..."
                value={wcSearchQuery}
                onChange={(e) => setWcSearchQuery(e.target.value)}
                style={{ paddingLeft: '28px', height: '32px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', width: '100%' }}
              />
            </div>
            <select value={wcStatusFilter} onChange={e => setWcStatusFilter(e.target.value)} style={selectStyle}>
              <option value="all">All Status</option>
              {wcStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={wcDateFilter} onChange={e => setWcDateFilter(e.target.value)} style={selectStyle}>
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
            <select value={wcSort} onChange={e => { setWcSort(e.target.value); setWcPage(10); }} style={selectStyle}>
              <option value="latest">⬇ Latest First</option>
              <option value="oldest">⬆ Oldest First</option>
            </select>
            {(wcSearchQuery || wcStatusFilter !== 'all' || wcDateFilter !== 'all' || wcSort !== 'latest') && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setWcSearchQuery(''); setWcStatusFilter('all'); setWcDateFilter('all'); setWcSort('latest'); setWcPage(10); }}
                style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Material</th>
                <th>Lot No</th>
                <th>Supplier</th>
                <th>Location</th>
                <th>Pieces / Pkts</th>
                <th>Net Wt (kg)</th>
                <th>Captured At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredWcTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    {weightTransactions.length === 0 ? 'No material add transactions found.' : 'No results for your search.'}
                  </td>
                </tr>
              ) : (
                filteredWcTransactions.slice(0, wcPage).map((w, idx) => (
                  <tr key={w.id || idx}>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{w.id}</td>
                    <td>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{w.materialName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.materialCode}</div>
                    </td>
                    <td style={{ fontWeight: '600' }}>{w.lotNo || '—'}</td>
                    <td style={{ fontSize: '12px' }}>{w.supplier || '—'}</td>
                    <td style={{ fontSize: '12px' }}>{w.storeLocation || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: '700' }}>{w.pieces ?? '—'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }}>/ {w.packets ?? '—'} pkt</span>
                    </td>
                    <td style={{ fontWeight: '700', color: '#10b981' }}>{w.netWeightKg != null ? `${Number(w.netWeightKg).toFixed(2)} kg` : '—'}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {w.capturedAt ? new Date(w.capturedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${(w.status || 'captured').toLowerCase().replace(/\s+/g, '-')}`}>
                        {w.status || 'Captured'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filteredWcTransactions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Showing {Math.min(wcPage, filteredWcTransactions.length)} of {filteredWcTransactions.length} entries
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {wcPage < filteredWcTransactions.length && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setWcPage(p => p + 10)} style={{ fontSize: '12px', padding: '0 12px', height: '30px' }}>
                    Show More (+10)
                  </button>
                )}
                {wcPage > 10 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setWcPage(10)} style={{ fontSize: '12px', padding: '0 12px', height: '30px' }}>
                    Show Less
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
