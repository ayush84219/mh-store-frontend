import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, RotateCcw, Calendar, User, Package, Truck, ShieldAlert, Download, FileSpreadsheet, QrCode, ShieldCheck, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ScannerLogsView({ currencySymbol = 'R' }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const backendUrl = getBackendUrl();
    fetch(`${backendUrl}/api/scans`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLogs(data);
        } else {
          setLogs([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch scans logs:', err);
        setLogs([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatScanType = (type) => {
    if (type === 'gate_entry') return { text: 'Gate Entry', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' };
    if (type === 'material_in') return { text: 'Material In', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' };
    if (type === 'printing_gate_out') return { text: 'Printing Gate Out', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)' };
    if (type === 'supplier_entry') return { text: 'Supplier Entry', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)' };
    if (type === 'rgp_entry') return { text: 'RGP Issue', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)' };
    if (type === 'rgp_return') return { text: 'RGP Return', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.2)' };
    return { text: type || 'Unknown', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.2)' };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const pad = (num) => String(num).padStart(2, '0');
      const d = pad(date.getDate());
      const m = pad(date.getMonth() + 1);
      const y = date.getFullYear();
      const hr = pad(date.getHours());
      const min = pad(date.getMinutes());
      
      return `${d}/${m}/${y} ${hr}:${min}`;
    } catch {
      return dateStr;
    }
  };

  // Filtering Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        (log.lot_number || '').toLowerCase().includes(q) ||
        (log.person_name || '').toLowerCase().includes(q) ||
        (log.material_name || '').toLowerCase().includes(q) ||
        (log.supplier_name || '').toLowerCase().includes(q);

      const matchesType = filterType === 'all' || log.scan_type === filterType;

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const d = new Date(log.scanned_at || log.timestamp || 0);
        if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          if (d < from) matchesDate = false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) matchesDate = false;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [logs, searchTerm, filterType, dateFrom, dateTo]);

  // Export Excel / CSV
  const handleExportExcel = () => {
    const headers = ['Scan ID', 'Timestamp', 'Lot Number', 'Scan Type', 'Person / Officer', 'Material Name', 'Quantity', 'Supplier / Party'];
    const rows = filteredLogs.map(log => [
      `"${log.id}"`,
      `"${formatDate(log.scanned_at)}"`,
      `"${log.lot_number || ''}"`,
      `"${log.scan_type || ''}"`,
      `"${(log.person_name || '').replace(/"/g, '""')}"`,
      `"${(log.material_name || '').replace(/"/g, '""')}"`,
      `"${log.quantity || 0}"`,
      `"${(log.supplier_name || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Scanner_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text('QR Scanner Database & Gate Verification Report', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Total Records: ${filteredLogs.length}`, 40, 62);

    const headers = [['#', 'Scan Time', 'Lot Number', 'Scan Type', 'Security / Officer', 'Material Name', 'Quantity', 'Supplier / Party']];
    const data = filteredLogs.map((log, idx) => [
      idx + 1,
      formatDate(log.scanned_at),
      log.lot_number || '—',
      formatScanType(log.scan_type).text,
      log.person_name || '—',
      log.material_name || '—',
      `${log.quantity || 0} pcs`,
      log.supplier_name || '—'
    ]);

    autoTable(doc, {
      startY: 75,
      head: headers,
      body: data,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [0, 75, 135], textColor: [255, 255, 255] }
    });

    doc.save(`Scanner_Logs_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="panel" style={{ padding: '24px' }}>
      {/* Header Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={22} style={{ color: '#004b87' }} />
            <span>QR Scanner Database Logs</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Real-time scanner checkpoints for Gate Entry, Material Inward, RGP Dispatches, and Supplier Verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={fetchLogs} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
          >
            <RotateCcw size={13} />
            <span>Refresh</span>
          </button>

          <button 
            onClick={handleExportExcel} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px', borderColor: '#10b981', color: '#10b981' }}
          >
            <FileSpreadsheet size={13} />
            <span>Excel</span>
          </button>

          <button 
            onClick={handleExportPDF} 
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px',
              borderRadius: '8px', border: 'none', background: '#004b87', color: '#ffffff', fontWeight: '700', cursor: 'pointer'
            }}
          >
            <Download size={13} />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        {[
          { label: 'Total Scans', value: logs.length, color: '#0284c7', bg: '#e0f2fe' },
          { label: 'Gate Entries', value: logs.filter(l => l.scan_type === 'gate_entry').length, color: '#10b981', bg: '#d1fae5' },
          { label: 'Material In', value: logs.filter(l => l.scan_type === 'material_in').length, color: '#3b82f6', bg: '#dbeafe' },
          { label: 'RGP Issues', value: logs.filter(l => l.scan_type === 'rgp_entry').length, color: '#a855f7', bg: '#f3e8ff' },
          { label: 'RGP Returns', value: logs.filter(l => l.scan_type === 'rgp_return').length, color: '#ec4899', bg: '#fce7f3' },
          { label: 'Filtered', value: filteredLogs.length, color: '#f59e0b', bg: '#fef3c7' }
        ].map((kpi, idx) => (
          <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '12px',
        background: 'var(--bg-primary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
          <Search size={15} style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by Lot, Person, Material or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              paddingLeft: '32px',
              height: '36px',
              fontSize: '12.5px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary, #ffffff)',
              color: 'var(--text-main)',
              width: '100%',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            height: '36px',
            fontSize: '12.5px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary, #ffffff)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="all">All Scan Types</option>
          <option value="gate_entry">Gate Entry</option>
          <option value="material_in">Material In</option>
          <option value="printing_gate_out">Printing Gate Out</option>
          <option value="supplier_entry">Supplier Entry</option>
          <option value="rgp_entry">RGP Issue</option>
          <option value="rgp_return">RGP Return</option>
        </select>

        {/* Date From */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            height: '36px',
            fontSize: '12px',
            padding: '0 8px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary, #ffffff)',
            color: 'var(--text-main)',
            outline: 'none'
          }}
          title="From Date"
        />

        {/* Date To */}
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            height: '36px',
            fontSize: '12px',
            padding: '0 8px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary, #ffffff)',
            color: 'var(--text-main)',
            outline: 'none'
          }}
          title="To Date"
        />

        {(searchTerm || filterType !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearchTerm(''); setFilterType('all'); setDateFrom(''); setDateTo(''); }}
            style={{
              height: '36px',
              padding: '0 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              cursor: 'pointer',
              fontWeight: '700'
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Logs Table Area */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          color: 'var(--text-muted)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid var(--accent-light)',
            borderTopColor: 'var(--accent-color)',
            animation: 'spin 1s linear infinite',
            marginBottom: '12px'
          }}></div>
          <span style={{ fontSize: '13px', fontWeight: '500' }}>Fetching MySQL Scan Data...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--border-radius-md)',
          border: '1.5px dashed var(--border-color)',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldAlert size={32} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontWeight: '700', fontSize: '14px' }}>No scan records found</div>
          <div style={{ fontSize: '12px' }}>Scanned entries will show up here automatically once submitted from QR links.</div>
        </div>
      ) : (
        <div className="table-responsive" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table className="table table-striped" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#004b87', color: '#ffffff' }}>
                <th style={{ padding: '12px 10px', fontSize: '12px' }}>Scan Time</th>
                <th style={{ padding: '12px 10px', fontSize: '12px' }}>Lot Number</th>
                <th style={{ padding: '12px 10px', fontSize: '12px' }}>Scan Type</th>
                <th style={{ padding: '12px 10px', fontSize: '12px' }}>Person / Officer</th>
                <th style={{ padding: '12px 10px', fontSize: '12px' }}>Material Name</th>
                <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '12px' }}>Quantity</th>
                <th style={{ padding: '12px 10px', fontSize: '12px' }}>Supplier / Destination</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const typeStyle = formatScanType(log.scan_type);
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                    {/* Timestamp */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={12} />
                        <span>{formatDate(log.scanned_at)}</span>
                      </div>
                    </td>

                    {/* Lot Number */}
                    <td style={{ padding: '10px 10px', fontWeight: '700' }}>
                      <span className="badge badge-accent">
                        {log.lot_number || 'N/A'}
                      </span>
                    </td>

                    {/* Scan Type */}
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: typeStyle.color,
                        backgroundColor: typeStyle.bg,
                        border: `1px solid ${typeStyle.border}`
                      }}>
                        {typeStyle.text}
                      </span>
                    </td>

                    {/* Person Name */}
                    <td style={{ padding: '10px 10px', fontWeight: '500' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{log.person_name}</span>
                      </div>
                    </td>

                    {/* Material Name */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-main)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.material_name}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{log.material_name}</span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--accent-color)' }}>
                      {log.quantity} pcs
                    </td>

                    {/* Supplier */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{log.supplier_name}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span className="status-badge verified" style={{ fontSize: '10px' }}>
                        ✓ Logged
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .badge-accent {
          background-color: var(--accent-light);
          color: var(--accent-color);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
