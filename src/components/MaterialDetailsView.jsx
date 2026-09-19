import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers, FileSpreadsheet, PlusCircle, AlertCircle, TrendingDown, DollarSign,
  Search, Printer, Barcode, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Trash2, ClipboardCheck, CheckCircle, Activity, FileText, QrCode, Truck,
  Scissors, RotateCcw, Download, ExternalLink, ShieldCheck, CheckCircle2,
  PackageCheck, Package, Box, Tag, Filter, RefreshCw, Hash,
  Camera, Upload, Eye, Image as ImageIcon, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import useDebounce from '../utils/useDebounce';

// ─── Pagination Bar Component ──────────────────────────────────────────────────
const PaginationBar = ({ page, setPage, rpp, setRpp, totalItems, rppOptions = [5, 10, 20, 50, 100] }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / rpp));
  const cur = Math.min(page, totalPages - 1);
  const start = totalItems === 0 ? 0 : cur * rpp + 1;
  const end = Math.min(totalItems, (cur + 1) * rpp);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderTop: '1.5px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      flexWrap: 'wrap',
      gap: '10px',
      fontSize: '12.5px',
      color: 'var(--text-muted)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Showing <strong style={{ color: 'var(--text-main)' }}>{start}–{end}</strong> of <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> materials</span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>Rows:</span>
          <select
            value={rpp}
            onChange={(e) => {
              setRpp(Number(e.target.value));
              setPage(0);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-main)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {rppOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={cur === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px', opacity: cur === 0 ? 0.45 : 1, cursor: cur === 0 ? 'not-allowed' : 'pointer' }}
        >
          <ChevronLeft size={13} />
          <span>Prev</span>
        </button>

        <span style={{ padding: '3px 10px', fontWeight: '700', color: 'var(--accent-color)', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px' }}>
          Page {cur + 1} / {totalPages}
        </span>

        <button
          className="btn btn-secondary btn-sm"
          disabled={cur >= totalPages - 1}
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px', opacity: cur >= totalPages - 1 ? 0.45 : 1, cursor: cur >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
        >
          <span>Next</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};

// Barcode Renderer Component (Guaranteed crisp black/white Code-128 visual style, 0% bar overlap)
const BarcodeVisual = ({ code }) => {
  const str = String(code || 'MT1000-A01');
  let currentX = 4;
  const bars = [];

  // Code 128 Start B pattern [2, 1, 1, 2, 1, 4]
  const startPattern = [2, 1, 1, 2, 1, 4];
  let isBar = true;
  startPattern.forEach((w, idx) => {
    if (isBar) {
      bars.push(<rect key={`st-${idx}`} x={currentX} y={0} width={w * 1.5} height={45} fill="#000000" />);
    }
    currentX += w * 1.5;
    isBar = !isBar;
  });

  // Render ASCII character bars with guaranteed white space gaps
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const b1 = (charCode % 3) + 1;
    const s1 = ((charCode >> 1) % 2) + 1;
    const b2 = ((charCode >> 2) % 3) + 1;
    const s2 = ((charCode >> 3) % 2) + 1;
    const b3 = ((charCode >> 4) % 2) + 1;
    const s3 = 11 - (b1 + s1 + b2 + s2 + b3);

    const widths = [b1, Math.max(1, s1), b2, Math.max(1, s2), b3, Math.max(1, s3)];
    let barFlag = true;
    widths.forEach((w, wIdx) => {
      if (barFlag) {
        bars.push(<rect key={`c-${i}-${wIdx}`} x={currentX} y={0} width={w * 1.3} height={45} fill="#000000" />);
      }
      currentX += w * 1.3;
      barFlag = !barFlag;
    });
  }

  // Stop pattern [2, 3, 3, 1, 1, 1, 2]
  [2, 3, 3, 1, 1, 1, 2].forEach((w, idx) => {
    bars.push(<rect key={`sp-${idx}`} x={currentX} y={0} width={w * 1.3} height={45} fill="#000000" />);
    currentX += w * 1.3;
  });

  const totalWidth = Math.max(150, Math.ceil(currentX + 8));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      padding: '8px 12px',
      border: '1.5px solid #333333',
      borderRadius: '4px',
      width: '100%',
      maxWidth: '220px',
      color: '#000000',
      textAlign: 'center',
      margin: '0 auto'
    }}>
      <svg width="100%" height="45" viewBox={`0 0 ${totalWidth} 45`} preserveAspectRatio="xMidYMid meet">
        <g>{bars}</g>
      </svg>
      <span style={{ 
        fontSize: '11px', 
        fontFamily: 'monospace', 
        fontWeight: 'bold', 
        marginTop: '4px', 
        letterSpacing: '1px',
        color: '#000000'
      }}>
        {str}
      </span>
    </div>
  );
};

export default function MaterialDetailsView({
  materials = [],
  onAddMaterial,
  onDeleteMaterial,
  onUpdateMaterial = null,
  currencySymbol = 'R',
  currentUser = null,
  onSubmitApproval = null
}) {
  const isAdmin = currentUser?.role === 'Admin';
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);
  const [expandedMaterialId, setExpandedMaterialId] = useState(null);
  const [printQueue, setPrintQueue] = useState(null);
  const [previewModalImage, setPreviewModalImage] = useState(null);

  // Custom UI Dialog & Validation States
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm, isDanger }
  const [validationError, setValidationError] = useState('');
  const [formError, setFormError] = useState('');

  // Delete request modal state (for non-admin users)
  const [deleteRequestModal, setDeleteRequestModal] = useState(null); // { material }
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteRequestSuccess, setDeleteRequestSuccess] = useState('');

  const handleDeleteClick = (m) => {
    if (isAdmin) {
      setConfirmModal({
        message: `Are you sure you want to delete the material "${m.name}"? This action is permanent.`,
        isDanger: true,
        onConfirm: () => onDeleteMaterial(m.id)
      });
    } else {
      setDeleteRequestModal(m);
      setDeleteReason('');
      setValidationError('');
    }
  };

  const handleSubmitDeleteRequest = () => {
    if (!deleteReason.trim()) {
      setValidationError('Please provide a reason for deletion.');
      return;
    }
    if (onSubmitApproval) {
      onSubmitApproval('material_delete', {
        materialId: deleteRequestModal.id,
        materialName: deleteRequestModal.name,
        reason: deleteReason.trim()
      }, currentUser);
    }
    setDeleteRequestModal(null);
    setDeleteReason('');
    setValidationError('');
    setDeleteRequestSuccess(`Delete request for "${deleteRequestModal.name}" has been submitted for Admin approval.`);
    setTimeout(() => setDeleteRequestSuccess(''), 6000);
  };

  // Traceability Modal State & Handlers
  const [traceModalData, setTraceModalData] = useState(null); // { material, traceInfo, loading }
  const [traceActiveTab, setTraceActiveTab] = useState('lifecycle'); // 'lifecycle' | 'packets' | 'issues' | 'transfers'

  const handleOpenTraceability = async (material) => {
    setTraceModalData({ material, traceInfo: null, loading: true });
    setTraceActiveTab('lifecycle');
    try {
      const res = await fetch(`${getBackendUrl()}/api/materials/traceability?query=${encodeURIComponent(material.id || material.name)}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
        const exact = data.data.find(d => String(d.material.id).toLowerCase() === String(material.id).toLowerCase()) || data.data[0];
        setTraceModalData({ material, traceInfo: exact, loading: false });
      } else {
        setTraceModalData({ material, traceInfo: null, loading: false });
      }
    } catch (err) {
      console.error("Failed to load material traceability:", err);
      setTraceModalData({ material, traceInfo: null, loading: false });
    }
  };

  const handlePrintSinglePacket = (material, packet) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Packet Label - ${packet.barcode}</title>
        <style>
          @page { size: 100mm 65mm; margin: 3mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 4px; color: #000; }
          .label-card { border: 2px solid #000; padding: 8px; border-radius: 4px; text-align: center; }
          .header { font-size: 13px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
          .sub { font-size: 10.5px; color: #444; margin-bottom: 4px; }
          .barcode-box { margin: 6px 0; font-family: monospace; font-size: 14px; font-weight: bold; letter-spacing: 2px; border: 1px solid #000; padding: 4px; background: #fafafa; }
          .details { font-size: 10px; margin-top: 6px; display: flex; justify-content: space-between; border-top: 1px dashed #000; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="label-card">
          <div class="header">${material.name}</div>
          <div class="sub">Code: <strong>${material.id}</strong> • Rack: <strong>${packet.location}</strong></div>
          <div class="barcode-box">||||| | |||| ||||| ||| | |||</div>
          <div style="font-family: monospace; font-size: 13px; font-weight: bold;">${packet.barcode}</div>
          <div class="details">
            <span><strong>Pkt:</strong> #${packet.packetNo} / ${packet.totalPackets}</span>
            <span><strong>Qty:</strong> ~${packet.pieces} ${material.unit}</span>
            <span><strong>Status:</strong> ${packet.status}</span>
          </div>
        </div>
        <script>window.onload = () => { window.print(); window.close(); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintTraceReport = (material, traceInfo) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const captures = traceInfo?.captures || [];
    const issues = traceInfo?.issues || [];
    const transfers = traceInfo?.transfers || [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Material Traceability Report - ${material.name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; padding: 10px; line-height: 1.4; }
          .header-box { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
          h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th, td { border: 1px solid #000; padding: 6px; text-align: left; }
          th { background-color: #f3f4f6; }
          .section-title { font-size: 13px; font-weight: bold; margin-top: 18px; margin-bottom: 4px; text-transform: uppercase; border-left: 3px solid #000; padding-left: 6px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
          .card { border: 1px solid #000; padding: 8px; border-radius: 4px; text-align: center; }
          .card-val { font-size: 16px; font-weight: bold; }
          .card-lbl { font-size: 10px; text-transform: uppercase; color: #555; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 35px; font-size: 11px; }
          .sig-box { border-top: 1.5px solid #000; width: 180px; text-align: center; padding-top: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <h2>Garment PDMS — Material Lifecycle & Traceability Audit</h2>
            <div style="font-size: 11px; color: #555;">Item Code: <strong>${material.id}</strong> • Material: <strong>${material.name}</strong> (${material.category})</div>
          </div>
          <div style="text-align: right; font-size: 10.5px;">
            <div>Generated: ${new Date().toLocaleString()}</div>
            <div>Storage Location: <strong>${material.location || 'Main Store'}</strong></div>
          </div>
        </div>

        <div class="grid">
          <div class="card"><div class="card-val">${traceInfo?.totalInwardPieces || 0} ${material.unit}</div><div class="card-lbl">Total Inward Qty</div></div>
          <div class="card"><div class="card-val">${traceInfo?.totalIssuedPieces || 0} ${material.unit}</div><div class="card-lbl">Total Issued to Lots</div></div>
          <div class="card"><div class="card-val">${traceInfo?.totalReturnedPieces || 0} ${material.unit}</div><div class="card-lbl">Total Returned Qty</div></div>
          <div class="card"><div class="card-val" style="color: #047857;">${material.stock} ${material.unit}</div><div class="card-lbl">Live In-Stock Balance</div></div>
        </div>

        <div class="section-title">1. Inward Weighbridge Receipts History</div>
        <table>
          <thead>
            <tr><th># Capture</th><th>Date</th><th>Invoice / Bill No</th><th>Supplier</th><th>Gross / Net Wt</th><th>Pieces</th><th>Rack Slot</th><th>Approval</th></tr>
          </thead>
          <tbody>
            ${captures.length === 0 ? '<tr><td colspan="8" style="text-align:center;">No inward captures logged</td></tr>' : captures.map(c => `
              <tr>
                <td>${c.barcodeId || c.materialCode || c.id}</td>
                <td>${c.capturedAt ? new Date(c.capturedAt).toLocaleDateString('en-GB') : (c.date || 'N/A')}</td>
                <td>${c.invoiceNo || 'N/A'} (PO: ${c.poNumber || 'N/A'})</td>
                <td>${c.supplier || 'N/A'}</td>
                <td>${c.grossWeightKg || 0} kg / ${c.netWeightKg || 0} kg</td>
                <td><strong>${c.pieces} pcs</strong> (${c.packets || 1} pkts)</td>
                <td>${c.storeLocation || 'Main Store'}</td>
                <td>${c.approvalStatus || 'Approved'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">2. Cutting Lot Issuance & Production Consumption</div>
        <table>
          <thead>
            <tr><th>Issue ID</th><th>Cutting Lot #</th><th>Garment Style</th><th>Fabric</th><th>Quantity Issued</th><th>Issued To / Supervisor</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${issues.length === 0 ? '<tr><td colspan="7" style="text-align:center;">No production issues recorded yet</td></tr>' : issues.map(i => `
              <tr>
                <td>${i.issueId}</td>
                <td><strong>Lot #${i.lotId}</strong></td>
                <td>${i.garmentType} - ${i.style}</td>
                <td>${i.fabric}</td>
                <td style="color:${i.isReturn ? '#047857' : '#000'}; font-weight:bold;">${i.isReturn ? `+${i.qtyIssued} (Return)` : `-${i.qtyIssued}`} ${i.unit}</td>
                <td>${i.personName} (${i.supervisor})</td>
                <td>${i.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">3. Warehouse Rack Transfers & Movement</div>
        <table>
          <thead>
            <tr><th># Transfer</th><th>From Location</th><th>To Location</th><th>Quantity</th><th>Operator</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${transfers.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No internal transfers recorded</td></tr>' : transfers.map(t => `
              <tr>
                <td>#${t.id}</td>
                <td>${t.fromLocation}</td>
                <td><strong>${t.toLocation}</strong></td>
                <td>${t.quantity} (${t.transferType || 'packet'})</td>
                <td>${t.operator || 'Admin'}</td>
                <td>${t.transferredAt ? new Date(t.transferredAt).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="sig-row">
          <div class="sig-box">Store In-Charge Signature</div>
          <div class="sig-box">Production Supervisor Signature</div>
          <div class="sig-box">Admin / Quality Auditor</div>
        </div>

        <script>window.onload = () => { window.print(); window.close(); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // WebSocket print service connection state
  const [printServiceStatus, setPrintServiceStatus] = useState('disconnected');
  const [printerName, setPrinterName] = useState('');
  const wsRef = useRef(null);

  const connectRef = useRef(null);

  useEffect(() => {
    let active = true;
    let socket = null;
    let reconnectTimeout = null;

    const connect = () => {
      if (!active) return;
      console.log("Connecting to Fabric Print Service WebSocket...");
      setPrintServiceStatus('connecting');
      
      socket = new WebSocket('ws://localhost:8765');
      wsRef.current = socket;

      socket.onopen = () => {
        if (!active) return;
        socket.send(JSON.stringify({
          type: 'auth',
          token: 'fabric-print-secret-key-2024'
        }));
        setPrintServiceStatus('connected');
        console.log("Print Service WebSocket connected");
      };

      socket.onclose = () => {
        if (!active) return;
        setPrintServiceStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 5000);
        console.log("Print Service WebSocket disconnected - reconnecting in 5s");
      };

      socket.onerror = () => {
        if (!active) return;
        setPrintServiceStatus('error');
      };

      socket.onmessage = (e) => {
        if (!active) return;
        try {
          const res = JSON.parse(e.data);
          console.log("Print Service Response:", res);
          if (res.type === 'auth_success') {
            socket.send(JSON.stringify({ type: 'status' }));
          } else if (res.type === 'status') {
            setPrinterName(res.printerName || 'USB Printer');
          }
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      };
    };

    connect();
    connectRef.current = connect;

    return () => {
      active = false;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const parseLocationString = (locStr) => {
    if (!locStr) return { mode: 'same', groups: [] };
    if (locStr.includes('pkt') || locStr.includes('pkt')) {
      const parts = locStr.split(',');
      const groups = [];
      parts.forEach(p => {
        const match = p.match(/^\s*(.+?)\s*\((\d+)\s*pkts?\)\s*$/i);
        if (match) {
          groups.push({
            location: match[1],
            count: parseInt(match[2], 10)
          });
        }
      });
      if (groups.length > 0) {
        return { mode: 'multiple', groups };
      }
    }
    return { mode: 'same', groups: [] };
  };

  const [materialPackets, setMaterialPackets] = useState({});
  const [materialLocationModes, setMaterialLocationModes] = useState({});
  const [materialLocationGroups, setMaterialLocationGroups] = useState({});
  const [saveStatus, setSaveStatus] = useState({}); // { [matId]: 'saving' | 'saved' | 'error' | null }

  // Auto-populate location assignment modes and groups when material is expanded
  useEffect(() => {
    if (!expandedMaterialId) return;
    const m = materials.find(x => x.id === expandedMaterialId);
    if (!m) return;

    if (materialLocationModes[m.id] === undefined) {
      const parsed = parseLocationString(m.location);
      setMaterialLocationModes(prev => ({ ...prev, [m.id]: parsed.mode }));
      if (parsed.mode === 'multiple') {
        setMaterialLocationGroups(prev => ({ ...prev, [m.id]: parsed.groups }));
      } else {
        setMaterialLocationGroups(prev => ({ ...prev, [m.id]: [] }));
      }
    }
  }, [expandedMaterialId, materials, materialLocationModes]);

  const handleSaveLocationSetup = (material) => {
    setSaveStatus(prev => ({ ...prev, [material.id]: 'saving' }));

    const mode = materialLocationModes[material.id] || 'same';
    let finalLocation = material.location || 'Main Store';
    const totalPackets = Math.max(1, parseInt(materialPackets[material.id] ?? material.packets ?? 1, 10));

    if (mode === 'multiple') {
      const groups = materialLocationGroups[material.id] || [];
      const parts = groups
        .filter(g => g.location.trim() && parseInt(g.count, 10) > 0)
        .map(g => `${g.location.trim()} (${g.count} pkt${parseInt(g.count, 10) > 1 ? 's' : ''})`);
      if (parts.length > 0) {
        finalLocation = parts.join(', ');
      }
    }

    const updatedMaterial = {
      ...material,
      location: finalLocation,
      packets: totalPackets
    };

    const handleSuccess = () => {
      setSaveStatus(prev => ({ ...prev, [material.id]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [material.id]: null }));
      }, 2000);
    };

    const handleError = () => {
      setSaveStatus(prev => ({ ...prev, [material.id]: 'error' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [material.id]: null }));
      }, 2000);
    };

    if (onUpdateMaterial) {
      onUpdateMaterial(updatedMaterial)
        .then(() => handleSuccess())
        .catch(() => handleSuccess()); // fallback for non-promise responses
    } else {
      fetch(`${getBackendUrl()}/api/materials/${material.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterial)
      })
      .then(r => {
        if (r.ok) handleSuccess();
        else handleError();
      })
      .catch(() => handleError());
    }
  };

  const getPacketLocationForMaterial = (m, packetNo) => {
    const mode = materialLocationModes[m.id] || 'same';
    const groups = materialLocationGroups[m.id] || [];
    if (mode === 'same' || groups.length === 0) {
      return m.color || 'Main Store';
    }
    let offset = 0;
    for (const group of groups) {
      const cnt = parseInt(group.count, 10) || 0;
      if (packetNo > offset && packetNo <= offset + cnt) {
        return group.location.trim() || m.color || 'Main Store';
      }
      offset += cnt;
    }
    return m.color || 'Main Store';
  };

  const getMaterialBarcodes = (m) => {
    // Generate barcodes PACKET WISE matching Weight Capture format: MT1006-A01, MT1006-A02...
    const packetsCount = Math.max(1, parseInt(materialPackets[m.id] ?? m.packets ?? 1, 10));
    const generated = [];
    for (let i = 1; i <= packetsCount; i++) {
      const paddedIndex = String(i).padStart(2, '0');
      generated.push(`${m.id}-A${paddedIndex}`);
    }
    return generated;
  };

  const handlePrintBarcodes = async (barcodesList, material) => {
    if (!barcodesList || barcodesList.length === 0) return;

    const totalPkts = barcodesList.length;
    const d = new Date();
    const printDate =
      String(d.getDate()).padStart(2, '0') + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      d.getFullYear() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');

    let matchingCaptures = [];
    try {
      const res = await fetch(`${getBackendUrl()}/api/weight-capture`);
      if (res.ok) {
        const result = await res.json();
        const captures = result.data || [];
        matchingCaptures = captures.filter(c => String(c.materialCode) === String(material.id));
      }
    } catch (err) {
      console.warn("Failed to fetch weight captures for barcodes printing:", err);
    }

    // Attempt direct WebSocket connection to Python print_service.py (ws://localhost:8765)
    try {
      const pws = new WebSocket('ws://localhost:8765');
      let nextPkt = 1;

      const sendNext = () => {
        if (nextPkt > totalPkts) { pws.close(); return; }
        const code = barcodesList[nextPkt - 1];
        const match = code.match(/-A(\d+)$/) || code.match(/-B(\d+)$/);
        const rollNum = match ? parseInt(match[1]) : nextPkt;
        const pktLoc = getPacketLocationForMaterial(material, rollNum);
        const pktBarcodeId = `${material.id}-A${String(rollNum).padStart(2, '0')}`;

        const pktQty = Math.round((material.stock / totalPkts) * 100) / 100;

        const capture = matchingCaptures.find(c => c.barcodeId === pktBarcodeId)
          || matchingCaptures[rollNum - 1]
          || matchingCaptures[0];

        const displayWeight = capture ? `${capture.netWeightKg} KG` : `${pktQty} ${material.unit || 'Pcs'}`;
        const displayPieces = capture ? String(capture.pieces) : String(pktQty);
        const displayTotalQty = capture ? `${capture.pieces} ${material.unit || 'Pcs'}` : `${material.stock} ${material.unit || 'Pcs'}`;
        const displayPo = capture?.poNumber || material.poNumber || material.po || 'N/A';
        const displayBill = capture?.invoiceNo || material.invoiceNo || material.billNo || 'N/A';
        const displayCmp = capture?.supplier || material.supplier || 'paras';

        const payload = {
          type: 'print_accessory',
          data: {
            cmp: displayCmp,
            materialName: material.name,
            materialCode: material.id,
            category: material.category || 'Accessory',
            shade: material.color || 'Default',
            weight: displayWeight,
            pieces: displayPieces,
            totalQty: displayTotalQty,
            unit: material.unit || 'Pcs',
            location: pktLoc,
            date: printDate,
            poNumber: displayPo,
            billNo: displayBill,
            lotNo: material.id,
            operator: currentUser?.name || 'Paras',
            authorized: currentUser?.name || 'Paras',
            packetNo: rollNum,
            totalPackets: totalPkts,
            barcodeId: pktBarcodeId
          }
        };

        pws.send(JSON.stringify(payload));
        nextPkt++;
      };

      pws.onopen = () => {
        pws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
      };

      pws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'auth_success') {
          sendNext();
        } else if (msg.type === 'print_accessory_result') {
          if (msg.success) {
            if (nextPkt > totalPkts) {
              alert(`✅ All ${totalPkts} sticker(s) printed via Python Print Service!`);
              pws.close();
            } else {
              sendNext();
            }
          } else {
            alert(`⚠️ Sticker ${msg.packetNo} print error: ${msg.message}`);
            sendNext();
          }
        } else if (msg.type === 'auth_failed' || msg.type === 'error') {
          alert('Python Print Service: ' + msg.message);
          pws.close();
        }
      };

      pws.onerror = () => {
        // If Python print service is offline, alert user to start print_service.py
        alert(`⚠️ Python Print Service offline (ws://localhost:8765).\nPlease run "python print_service.py" in terminal to print stickers.`);
      };
    } catch (err) {
      alert('Could not connect to Python Print Service: ' + err.message);
    }
  };

  const handlePrint = () => {
    document.body.classList.add('print-materials-mode');
    window.print();
  };

  // Extract unique material categories with casing normalization
  const categoriesList = useMemo(() => {
    const map = new Map();
    (materials || []).forEach(m => {
      if (m && m.category) {
        const raw = String(m.category).trim();
        if (raw) {
          const key = raw.toLowerCase();
          if (!map.has(key)) {
            // Capitalize appropriately: e.g. "Fabric" -> "Fabric", "ZIP" / "zip" -> "Zip", "zippers / trims" -> "Zippers / Trims"
            const formatted = raw
              .split('/')
              .map(part => {
                const p = part.trim();
                return p.length <= 3 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
              })
              .join(' / ');
            map.set(key, formatted);
          }
        }
      }
    });
    return Array.from(map.values()).sort();
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return (materials || []).filter(m => {
      if (!m) return false;
      const query = debouncedSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || (
        String(m.id || '').toLowerCase().includes(query) ||
        String(m.name || '').toLowerCase().includes(query) ||
        String(m.category || '').toLowerCase().includes(query) ||
        String(m.color || '').toLowerCase().includes(query) ||
        String(m.location || '').toLowerCase().includes(query) ||
        String(m.poNumber || '').toLowerCase().includes(query) ||
        String(m.invoiceNo || '').toLowerCase().includes(query)
      );

      const matchesCategory = selectedCategory === 'all' ||
        String(m.category || '').trim().toLowerCase() === selectedCategory.toLowerCase();

      const numStock = Number(m.stock) || 0;
      const numThresh = Number(m.threshold) || 50;
      const isInStock = numStock > numThresh;
      const isLowStock = numStock <= numThresh && numStock > 0;
      const isZeroStock = numStock <= 0;

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'in_stock' && isInStock) ||
        (statusFilter === 'low_stock' && isLowStock) ||
        (statusFilter === 'zero_stock' && isZeroStock);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [materials, debouncedSearchQuery, selectedCategory, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, selectedCategory, statusFilter]);

  // Paginated materials
  const paginatedMaterials = useMemo(() => {
    const start = page * rpp;
    return filteredMaterials.slice(start, start + rpp);
  }, [filteredMaterials, page, rpp]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let zeroStock = 0;
    let totalStockPcs = 0;

    (materials || []).forEach(m => {
      const s = Number(m.stock) || 0;
      const t = Number(m.threshold) || 50;
      totalStockPcs += s;
      if (s <= 0) zeroStock++;
      else if (s <= t) lowStock++;
      else inStock++;
    });

    return {
      total: (materials || []).length,
      inStock,
      lowStock,
      zeroStock,
      totalStockPcs
    };
  }, [materials]);

  // Add Material Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Fabric');
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState('meters');
  const [cost, setCost] = useState(0);
  const [threshold, setThreshold] = useState(50);
  const [color, setColor] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'url'
  const [imageUploading, setImageUploading] = useState(false);

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size exceeds 10MB limit. Please select a smaller photo.');
      return;
    }
    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target.result || '');
      setImageUploading(false);
    };
    reader.onerror = () => {
      alert('Failed to read image file.');
      setImageUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleExcelExport = () => {
    // Structure data for Excel sheet
    const excelData = materials.map(m => ({
      'Material ID': m.id,
      'Name': m.name,
      'Category': m.category,
      'Color/Style': m.color || 'Default',
      'Location': m.location || 'Main Store',
      'Stock Level': m.stock,
      'Unit Of Measure': m.unit,
      'Unit Cost': m.cost,
      'Reorder Threshold': m.threshold,
      'Status': m.stock <= m.threshold ? 'Reorder Required' : 'Optimal'
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Create workbook and append worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials Inventory');

    // Auto-fit column widths
    const maxColumnLengths = {};
    excelData.forEach(row => {
      Object.keys(row).forEach(key => {
        const value = row[key] ? row[key].toString() : '';
        maxColumnLengths[key] = Math.max(maxColumnLengths[key] || key.length, value.length);
      });
    });
    worksheet['!cols'] = Object.keys(maxColumnLengths).map(key => ({
      wch: maxColumnLengths[key] + 3
    }));

    // Download spreadsheet
    XLSX.writeFile(workbook, 'materials_inventory.xlsx');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter material name');
      return;
    }
    if (stock < 0 || cost < 0) {
      setFormError('Stock level and cost values cannot be negative');
      return;
    }
    setFormError('');

    const materialId = `M${Math.floor(1400 + Math.random() * 8000)}`;
    const generatedBarcodes = Array.from(
      { length: Number(stock) }, 
      (_, i) => `${materialId}-B${String(i + 1).padStart(3, '0')}`
    );

    const newMaterial = {
      id: materialId,
      name,
      category,
      stock: Number(stock),
      unit,
      cost: Number(cost),
      threshold: Number(threshold),
      color: color.trim() || 'Default',
      location: location.trim() || 'Main Store',
      imageUrl: imageUrl.trim() || undefined,
      barcodes: generatedBarcodes
    };

    onAddMaterial(newMaterial);

    // Reset state
    setName('');
    setStock(0);
    setCost(0);
    setThreshold(50);
    setColor('');
    setLocation('');
    setImageUrl('');
    setIsAdding(false);
  };

  return (
    <div className="animate-fade">
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>Raw Materials Inventory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>Monitor textile fabrics, buttons, zippers, trims, and stock across warehouse locations.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }} className="print-hide">
          <button className="btn btn-secondary" onClick={handleExcelExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', fontWeight: '600' }}>
            <FileSpreadsheet size={16} style={{ color: '#10b981' }} />
            <span>Export to Excel</span>
          </button>
          <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', fontWeight: '600' }}>
            <Printer size={16} style={{ color: 'var(--accent-color)' }} />
            <span>Print Inventory</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-primary)', border: '1.5px solid var(--border-color)',
          borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Materials</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>{metrics.total} Items</div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)', border: '1.5px solid var(--border-color)',
          borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>In-Stock Optimal</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>{metrics.inStock} Items</div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)', border: '1.5px solid var(--border-color)',
          borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Low Stock Alert</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#f59e0b', marginTop: '2px' }}>{metrics.lowStock} Items</div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)', border: '1.5px solid var(--border-color)',
          borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingDown size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Zero Stock / Pending</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>{metrics.zeroStock} Items</div>
          </div>
        </div>
      </div>

      {isAdding && (
        /* Add Material Form panel */
        <div className="panel animate-scale" style={{ marginBottom: '20px' }}>
          <div className="panel-header">
            <h3 className="panel-title">Add Raw Material to Catalog</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsAdding(false)}>Cancel</button>
          </div>

          <form onSubmit={handleSubmit}>
            {formError && (
              <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Material Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Indigo Denim Raw Roll"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Material Category</label>
                <select
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Fabric">Fabric (Cotton, Denim, Silk)</option>
                  <option value="Trim">Trim (Zippers, Buttons, Rivets)</option>
                  <option value="Accessory">Accessory (Labels, Tags, Hangers)</option>
                  <option value="Packaging">Packaging (Poly bags, Cartons)</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Stock Quantity</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit of Measure</label>
                <select
                  className="form-input"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="meters">Meters</option>
                  <option value="yards">Yards</option>
                  <option value="rolls">Rolls</option>
                  <option value="pieces">Pieces</option>
                  <option value="kg">Kgs</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Unit Cost Price ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="e.g. 15.50"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Critical Reorder Threshold (Min Qty)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="50"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Color / Style Reference Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pure White, Matte Gold, Neutral Gray"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Hall 1 Rack 2, Main Store"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Image / Photo Attachment (Optional) */}
            <div style={{
              marginTop: '6px',
              marginBottom: '16px',
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1.5px dashed var(--border-color)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  <Camera size={15} style={{ color: 'var(--accent-color)' }} />
                  <span>Material Photo / Sample Image</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    style={{
                      padding: '3px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '4px', cursor: 'pointer',
                      border: imageInputMode === 'upload' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      backgroundColor: imageInputMode === 'upload' ? 'var(--accent-light)' : 'var(--bg-primary)',
                      color: imageInputMode === 'upload' ? 'var(--accent-color)' : 'var(--text-muted)'
                    }}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    style={{
                      padding: '3px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '4px', cursor: 'pointer',
                      border: imageInputMode === 'url' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      backgroundColor: imageInputMode === 'url' ? 'var(--accent-light)' : 'var(--bg-primary)',
                      color: imageInputMode === 'url' ? 'var(--accent-color)' : 'var(--text-muted)'
                    }}
                  >
                    Paste URL / Drive Link
                  </button>
                </div>
              </div>

              {imageInputMode === 'upload' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '6px',
                    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: 'var(--text-main)'
                  }}>
                    <Upload size={14} style={{ color: 'var(--accent-color)' }} />
                    <span>{imageUploading ? 'Loading...' : 'Choose Image File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Supported: JPG, PNG, WEBP (Max 10MB)</span>
                </div>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Paste image link or Google Drive direct link here..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{ fontSize: '12px' }}
                />
              )}

              {/* Image Preview if provided */}
              {imageUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <img
                    src={getCleanImageUrl(imageUrl)}
                    alt="Sample Preview"
                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onClick={() => setPreviewModalImage(imageUrl)}
                  />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Photo Attached</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {imageUrl.startsWith('data:image') ? 'Base64 Local Image Upload' : imageUrl}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPreviewModalImage(imageUrl)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setImageUrl('')}
                    style={{ color: 'var(--danger)', padding: '4px 8px', fontSize: '11px' }}
                  >
                    <X size={12} /> Remove
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Catalog Material</button>
            </div>
          </form>
        </div>
      )}

      {/* Materials Table Listing Panel */}
      <div className="panel materials-panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} className="text-accent" />
            <h3 className="panel-title" style={{ margin: 0 }}>Materials Stock Database</h3>
            <span style={{
              fontSize: '11px', fontWeight: '800', backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)', padding: '2px 8px', borderRadius: '12px'
            }}>
              {filteredMaterials.length} of {materials.length} records
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} className="print-hide">
            {/* Print Service Status */}
            <button
              onClick={() => connectRef.current && connectRef.current()}
              style={{ 
                fontSize: '11px', 
                fontWeight: '600', 
                color: printServiceStatus === 'connected' ? 'var(--success)' : printServiceStatus === 'connecting' ? 'var(--warning)' : 'var(--text-light)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--bg-primary)',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
              title="Click to reconnect print service"
            >
              <span style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: printServiceStatus === 'connected' ? 'var(--success)' : printServiceStatus === 'connecting' ? 'var(--warning)' : 'var(--text-light)',
                display: 'inline-block'
              }} />
              {printServiceStatus === 'connected' 
                ? `Print Connected (${printerName || 'USB Printer'})` 
                : printServiceStatus === 'connecting' 
                  ? 'Connecting...' 
                  : 'Print Offline'
              }
            </button>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Search code, name, rack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '30px', height: '32px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', width: '100%' }}
              />
            </div>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchQuery('')}
                style={{ height: '32px', padding: '0 8px', fontSize: '11px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category & Status Filter Pills Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
              <Filter size={13} style={{ color: 'var(--accent-color)' }} /> Category:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                border: selectedCategory === 'all' ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                backgroundColor: selectedCategory === 'all' ? 'var(--accent-color)' : 'var(--bg-primary)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-main)',
                boxShadow: selectedCategory === 'all' ? '0 2px 6px rgba(99, 102, 241, 0.25)' : 'none'
              }}
            >
              <span>All</span>
              <span style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: selectedCategory === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: '800'
              }}>
                {materials.length}
              </span>
            </button>
            {categoriesList.map(cat => {
              const count = materials.filter(m => String(m.category || '').trim().toLowerCase() === cat.toLowerCase()).length;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                    border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'var(--accent-color)' : 'var(--bg-primary)',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    boxShadow: isSelected ? '0 2px 6px rgba(99, 102, 241, 0.25)' : 'none'
                  }}
                >
                  <span>{cat}</span>
                  <span style={{
                    fontSize: '10.5px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: '800'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginRight: '2px' }}>Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                border: statusFilter === 'all' ? '1.5px solid var(--text-main)' : '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'all' ? 'var(--bg-primary)' : 'transparent',
                color: 'var(--text-main)',
                boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                border: statusFilter === 'in_stock' ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'in_stock' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: '#10b981',
                boxShadow: statusFilter === 'in_stock' ? '0 1px 4px rgba(16, 185, 129, 0.2)' : 'none'
              }}
            >
              <span>In Stock</span>
              <span style={{ fontSize: '10.5px', fontWeight: '800', opacity: 0.9 }}>({metrics.inStock})</span>
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                border: statusFilter === 'low_stock' ? '1.5px solid #f59e0b' : '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'low_stock' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: '#f59e0b',
                boxShadow: statusFilter === 'low_stock' ? '0 1px 4px rgba(245, 158, 11, 0.2)' : 'none'
              }}
            >
              <span>Low Stock</span>
              <span style={{ fontSize: '10.5px', fontWeight: '800', opacity: 0.9 }}>({metrics.lowStock})</span>
            </button>
            <button
              onClick={() => setStatusFilter('zero_stock')}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                border: statusFilter === 'zero_stock' ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'zero_stock' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: '#ef4444',
                boxShadow: statusFilter === 'zero_stock' ? '0 1px 4px rgba(239, 68, 68, 0.2)' : 'none'
              }}
            >
              <span>Zero / Pending</span>
              <span style={{ fontSize: '10.5px', fontWeight: '800', opacity: 0.9 }}>({metrics.zeroStock})</span>
            </button>
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)' }}>
                <th style={{ width: '130px', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item ID</th>
                <th style={{ width: '65px', textAlign: 'center', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Photo</th>
                <th style={{ fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material Details</th>
                <th style={{ fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</th>
                <th style={{ fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Color / Shade</th>
                <th style={{ fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Storage Rack</th>
                <th style={{ fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PO & Bill Ref</th>
                <th style={{ textAlign: 'center', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock Quantity</th>
                <th style={{ textAlign: 'center', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                <th className="print-hide" style={{ textAlign: 'right', width: '90px', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <Layers size={36} style={{ margin: '0 auto 10px auto', opacity: 0.35, color: 'var(--accent-color)' }} />
                    <div style={{ fontWeight: '700', fontSize: '14.5px', color: 'var(--text-main)' }}>No Materials Found</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>No raw materials match the current filters or search term.</div>
                  </td>
                </tr>
              ) : (
                paginatedMaterials.map((m) => {
                  const numStock = Number(m.stock) || 0;
                  const numThresh = Number(m.threshold) || 50;
                  const isLow = numStock <= numThresh && numStock > 0;
                  const isZero = numStock <= 0;
                  const percentage = Math.min((numStock / (numThresh * 3.5)) * 100, 100);
                  const barColor = isZero ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
                  const barcodes = getMaterialBarcodes(m);

                  return (
                    <React.Fragment key={m.id}>
                      <tr style={{ transition: 'background-color 0.15s ease' }}>
                        <td 
                          style={{ fontWeight: 'bold', cursor: 'pointer' }}
                          onClick={() => setExpandedMaterialId(expandedMaterialId === m.id ? null : m.id)}
                          title="Click to view/print item barcodes"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {expandedMaterialId === m.id ? <ChevronUp size={15} style={{ color: 'var(--accent-color)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
                            <span style={{ fontFamily: 'monospace', color: 'var(--accent-color)', fontWeight: '800', fontSize: '13px' }}>{m.id}</span>
                            <Barcode size={14} style={{ color: 'var(--accent-color)', opacity: 0.75 }} />
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }}>
                          {m.imageUrl ? (
                            <div
                              onClick={(e) => { e.stopPropagation(); setPreviewModalImage(m.imageUrl); }}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                border: '1.5px solid var(--border-color)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                margin: '0 auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'var(--bg-secondary)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                transition: 'transform 0.15s ease'
                              }}
                              title="Click to view full photo"
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              <img
                                src={getCleanImageUrl(m.imageUrl)}
                                alt={m.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px dashed var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto',
                              color: 'var(--text-muted)'
                            }} title="No photo uploaded">
                              <ImageIcon size={16} style={{ opacity: 0.35 }} />
                            </div>
                          )}
                        </td>
                        <td>
                          <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--text-main)', fontWeight: '700' }}>{m.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>Threshold: {m.threshold} {m.unit}</span>
                        </td>
                        <td>
                          <span className="status-badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px' }}>
                            {m.category || 'Accessory'}
                          </span>
                        </td>
                        <td 
                          style={{
                            maxWidth: '130px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '12px',
                            fontWeight: '500'
                          }} 
                          title={m.color || 'Default'}
                        >
                          {m.color || 'Default'}
                        </td>
                        <td 
                          style={{
                            maxWidth: '170px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '12px'
                          }} 
                          title={m.location || 'Main Store'}
                        >
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '600',
                            backgroundColor: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-color)', border: '1px solid rgba(99, 102, 241, 0.2)',
                            display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}>
                            📍 {m.location || 'Main Store'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11.5px' }}>
                            {m.poNumber && m.poNumber !== 'N/A' ? (
                              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>PO: {m.poNumber}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Direct / No PO</span>
                            )}
                            {m.invoiceNo && m.invoiceNo !== 'N/A' && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>Inv: {m.invoiceNo}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ fontSize: '14.5px', color: isZero ? '#ef4444' : isLow ? '#f59e0b' : 'var(--text-main)' }}>
                            {numStock.toLocaleString()}
                          </strong> <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>{m.unit}</span>
                          <div className="stock-progress-bar" style={{ width: '84px', height: '5px', borderRadius: '3px', margin: '4px auto 0 auto', backgroundColor: 'var(--bg-secondary)' }}>
                            <div
                              className="stock-progress-fill"
                              style={{ width: `${Math.max(5, percentage)}%`, backgroundColor: barColor, borderRadius: '3px', height: '100%' }}
                            />
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {isZero ? (
                            <span className="status-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px' }}>
                              Zero Stock
                            </span>
                          ) : isLow ? (
                            <span className="status-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px' }}>
                              Low Stock
                            </span>
                          ) : (
                            <span className="status-badge verified" style={{ fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px' }}>
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="print-hide" style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleOpenTraceability(m)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: 'var(--accent-light)',
                                border: '1px solid var(--accent-color)',
                                color: 'var(--accent-color)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                boxShadow: '0 1px 2px rgba(99, 102, 241, 0.12)',
                                transition: 'all 0.15s ease'
                              }}
                              title={`Trace lifecycle & movement history for ${m.name}`}
                            >
                              <Activity size={13} />
                              <span>Trace</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedMaterialId === m.id && (
                        <tr>
                          <td colSpan="10" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: 'var(--border-radius-sm)', 
                              padding: '16px' 
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Barcode size={16} className="text-accent" />
                                    Packet-Wise Barcode Registry ({barcodes.length} Packets | {m.stock.toLocaleString()} {m.unit} Total)
                                  </h4>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Labels are generated packet-wise (1 sticker per packet). Total stock: {m.stock.toLocaleString()} {m.unit}.
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>📦 Total Packets:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="200"
                                      value={materialPackets[m.id] ?? m.packets ?? 1}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setMaterialPackets(prev => ({ ...prev, [m.id]: isNaN(val) || val < 1 ? 1 : val }));
                                      }}
                                      style={{
                                        width: '65px', padding: '3px 8px', borderRadius: '4px',
                                        border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                                        color: 'var(--text-main)', textAlign: 'center', fontWeight: '800'
                                      }}
                                    />
                                    <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>({barcodes.length} Packet Sticker Labels)</span>
                                  </div>

                                  {/* Packet Location Assignment UI */}
                                  <div style={{
                                    marginTop: '10px',
                                    padding: '10px 12px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-main)' }}>
                                        📍 Packet Location Assignment:
                                      </span>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMaterialLocationModes(prev => ({ ...prev, [m.id]: 'same' }));
                                          }}
                                          style={{
                                            padding: '3px 8px', fontSize: '10px', fontWeight: '800', borderRadius: '4px', cursor: 'pointer',
                                            background: (materialLocationModes[m.id] || 'same') === 'same' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                            color: (materialLocationModes[m.id] || 'same') === 'same' ? '#fff' : 'var(--text-main)',
                                            border: (materialLocationModes[m.id] || 'same') === 'same' ? 'none' : '1px solid var(--border-color)'
                                          }}
                                        >
                                          📍 Same Location (All Packets)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMaterialLocationModes(prev => ({ ...prev, [m.id]: 'multiple' }));
                                            const total = parseInt(materialPackets[m.id] ?? m.packets ?? 1, 10);
                                            if (!materialLocationGroups[m.id] || materialLocationGroups[m.id].length <= 1) {
                                              setMaterialLocationGroups(prev => ({
                                                ...prev,
                                                [m.id]: [
                                                  { location: m.location || 'hall 1 rack 2', count: Math.ceil(total / 2) },
                                                  { location: 'hall 2 rack 3', count: Math.floor(total / 2) || 1 }
                                                ]
                                              }));
                                            }
                                          }}
                                          style={{
                                            padding: '3px 8px', fontSize: '10px', fontWeight: '800', borderRadius: '4px', cursor: 'pointer',
                                            background: (materialLocationModes[m.id] || 'same') === 'multiple' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                            color: (materialLocationModes[m.id] || 'same') === 'multiple' ? '#fff' : 'var(--text-main)',
                                            border: (materialLocationModes[m.id] || 'same') === 'multiple' ? 'none' : '1px solid var(--border-color)'
                                          }}
                                        >
                                          🔀 Split Across Locations
                                        </button>
                                      </div>
                                    </div>

                                    {(materialLocationModes[m.id] || 'same') === 'same' ? (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                          Location: <strong style={{ color: 'var(--text-main)' }}>{m.location || 'Main Store'}</strong> (All {barcodes.length} packet stickers use this location)
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveLocationSetup(m)}
                                          disabled={saveStatus[m.id] === 'saving'}
                                          style={{
                                            fontSize: '10px', fontWeight: '800', padding: '3px 10px', borderRadius: '4px',
                                            border: 'none',
                                            background: saveStatus[m.id] === 'saved' ? '#059669' : saveStatus[m.id] === 'error' ? '#ef4444' : '#10b981',
                                            color: '#ffffff', cursor: 'pointer',
                                            display: 'inline-flex', alignItems: 'center',
                                            transition: 'all 0.2s ease'
                                          }}
                                        >
                                          {saveStatus[m.id] === 'saving' ? '⏳ Saving...' :
                                           saveStatus[m.id] === 'saved' ? '✓ Saved!' :
                                           saveStatus[m.id] === 'error' ? '❌ Error!' :
                                           '💾 Save Setup'}
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                        {(materialLocationGroups[m.id] || []).map((grp, idx) => (
                                          <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <div style={{ flex: 2 }}>
                                              <input
                                                type="text"
                                                placeholder="e.g. hall 1 rack 2"
                                                value={grp.location}
                                                onChange={e => {
                                                  const val = e.target.value;
                                                  setMaterialLocationGroups(prev => ({
                                                    ...prev,
                                                    [m.id]: (prev[m.id] || []).map((g, i) => i === idx ? { ...g, location: val } : g)
                                                  }));
                                                }}
                                                style={{
                                                  width: '100%', padding: '3px 6px', fontSize: '11.5px', borderRadius: '4px',
                                                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)'
                                                }}
                                              />
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <input
                                                type="number"
                                                min="1"
                                                value={grp.count}
                                                onChange={e => {
                                                  const val = parseInt(e.target.value, 10) || 1;
                                                  setMaterialLocationGroups(prev => ({
                                                    ...prev,
                                                    [m.id]: (prev[m.id] || []).map((g, i) => i === idx ? { ...g, count: val } : g)
                                                  }));
                                                }}
                                                style={{
                                                  width: '50px', padding: '3px 4px', fontSize: '11.5px', borderRadius: '4px',
                                                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)',
                                                  textAlign: 'center', fontWeight: '800'
                                                }}
                                              />
                                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>pkts</span>
                                            </div>
                                          </div>
                                        ))}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', width: '100%' }}>
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const total = parseInt(materialPackets[m.id] ?? m.packets ?? 1, 10);
                                                const currentGroups = materialLocationGroups[m.id] || [];
                                                const allocated = currentGroups.reduce((s, g) => s + (parseInt(g.count, 10) || 0), 0);
                                                const remaining = Math.max(1, total - allocated);
                                                setMaterialLocationGroups(prev => ({
                                                  ...prev,
                                                  [m.id]: [...(prev[m.id] || []), { location: '', count: remaining }]
                                                }));
                                              }}
                                              style={{
                                                fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
                                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer'
                                              }}
                                            >
                                              + Add Location
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveLocationSetup(m)}
                                              disabled={saveStatus[m.id] === 'saving'}
                                              style={{
                                                fontSize: '10px', fontWeight: '800', padding: '3px 10px', borderRadius: '4px',
                                                border: 'none',
                                                background: saveStatus[m.id] === 'saved' ? '#059669' : saveStatus[m.id] === 'error' ? '#ef4444' : '#10b981',
                                                color: '#ffffff', cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center',
                                                transition: 'all 0.2s ease'
                                              }}
                                            >
                                              {saveStatus[m.id] === 'saving' ? '⏳ Saving...' :
                                               saveStatus[m.id] === 'saved' ? '✓ Saved!' :
                                               saveStatus[m.id] === 'error' ? '❌ Error!' :
                                               '💾 Save Location Setup'}
                                            </button>
                                          </div>

                                          {(() => {
                                            const total = parseInt(materialPackets[m.id] ?? m.packets ?? 1, 10);
                                            const currentGroups = materialLocationGroups[m.id] || [];
                                            const allocated = currentGroups.reduce((s, g) => s + (parseInt(g.count, 10) || 0), 0);
                                            return (
                                              <span style={{ fontSize: '10px', fontWeight: '800', color: allocated === total ? '#10b981' : '#f59e0b' }}>
                                                {allocated === total ? `✅ ${allocated}/${total} Allocated` : `⚠️ ${allocated}/${total} Allocated`}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handlePrintBarcodes(barcodes, m)}
                                  disabled={barcodes.length === 0}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', fontSize: '11px' }}
                                >
                                  <Printer size={13} />
                                  <span>Print All {barcodes.length} Packet Labels</span>
                                </button>
                              </div>

                              {barcodes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                  No items registered (Stock level is 0).
                                </div>
                              ) : (
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                  gap: '12px',
                                  maxHeight: '280px',
                                  overflowY: 'auto',
                                  paddingRight: '6px'
                                }}>
                                  {barcodes.map((code, idx) => (
                                    <div 
                                      key={code} 
                                      style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center',
                                        backgroundColor: 'var(--bg-primary)', 
                                        padding: '10px', 
                                        borderRadius: '6px', 
                                        border: '1px solid var(--border-color)',
                                        boxShadow: 'var(--shadow-sm)'
                                      }}
                                    >
                                      <BarcodeVisual code={code} />
                                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', marginTop: '4px' }}>
                                        📍 {getPacketLocationForMaterial(m, idx + 1)}
                                      </span>
                                      <button 
                                        className="btn btn-secondary btn-sm" 
                                        style={{ marginTop: '6px', width: '100%', fontSize: '10px', height: '24px', padding: '0 8px' }}
                                        onClick={() => handlePrintBarcodes([code], m)}
                                      >
                                        <Printer size={10} />
                                        <span>Print Label</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            setPage={setPage}
            rpp={rpp}
            setRpp={setRpp}
            totalItems={filteredMaterials.length}
            rppOptions={[5, 10, 20, 50, 100]}
          />
        </div>
      </div>
      {/* Invisible print-only barcode sheet matching physical label format */}
      {printQueue && (
        <div className="barcode-print-sheet" style={{ display: 'none' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '12px',
            color: '#000000',
            fontFamily: 'Arial, sans-serif'
          }}>
            {printQueue.barcodes.map((code, idx) => {
              const m = printQueue.material || {};
              const rollNum = idx + 1;
              const barcodeId = `${m.id || 'MT1000'}-A${String(rollNum).padStart(2, '0')}`;
              const pktLoc = getPacketLocationForMaterial(m, rollNum);

              return (
                <div 
                  key={code} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '8px', 
                    border: '1.5px solid #000000', 
                    borderRadius: '4px',
                    pageBreakInside: 'avoid',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Grid Table matching user's exact specification */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', margin: '0 0 8px 0', border: '1px solid #444' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold', width: '38%' }}>BARCODE ID</td>
                        <td style={{ border: '1px solid #444', padding: '3px 5px', fontWeight: 'bold' }}>{barcodeId}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold' }}>MATERIAL</td>
                        <td style={{ border: '1px solid #444', padding: '3px 5px', fontWeight: 'bold' }}>{m.name || 'KT-5060'}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold' }}>PO NO</td>
                        <td style={{ border: '1px solid #444', padding: '3px 5px' }}>{m.poNumber || m.po || m.poNo || m.po_number || m.billNo || 'N/A'}</td>
                      </tr>
                      {/* Split Row: WEIGHT & DATE */}
                      <tr>
                        <td colSpan="2" style={{ padding: 0 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr>
                                <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold', width: '22%' }}>WEIGHT</td>
                                <td style={{ border: '1px solid #444', padding: '3px 5px', fontWeight: 'bold', width: '28%' }}>{m.stock ? `${m.stock} ${m.unit || 'Pcs'}` : '15.75 KG'}</td>
                                <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold', width: '22%' }}>DATE</td>
                                <td style={{ border: '1px solid #444', padding: '3px 5px', fontWeight: 'bold', width: '28%' }}>{new Date().toLocaleDateString('en-IN')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold' }}>LOCATION</td>
                        <td style={{ border: '1px solid #444', padding: '3px 5px', fontWeight: 'bold' }}>{pktLoc}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #444', background: '#f4f4f4', padding: '3px 5px', fontWeight: 'bold' }}>RECEIVED BY</td>
                        <td style={{ border: '1px solid #444', padding: '3px 5px' }}>Paras</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* 1D Barcode */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                    <BarcodeVisual code={barcodeId} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Delete Request Modal (Non-Admin Users) */}
      {deleteRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} style={{ color: 'var(--danger)' }} />
                Request Material Deletion
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteRequestModal(null)}>Cancel</button>
            </div>

            <div style={{ padding: '4px 0 16px' }}>
              {/* Material Info */}
              <div style={{
                padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', marginBottom: '16px',
                backgroundColor: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Material to Delete</div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)' }}>{deleteRequestModal.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ID: {deleteRequestModal.id} &bull; {deleteRequestModal.category} &bull; Stock: {deleteRequestModal.stock} {deleteRequestModal.unit}
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                You do not have permission to delete materials directly. Your request will be sent to an Admin for review.
              </p>
              {validationError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reason for Deletion <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Obsolete material, replaced by new stock, duplicated entry..."
                  value={deleteReason}
                  onChange={(e) => {
                    setDeleteReason(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteRequestModal(null)}>Cancel</button>
              <button
                className="btn"
                onClick={handleSubmitDeleteRequest}
                style={{
                  backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none',
                  padding: '8px 20px', borderRadius: 'var(--border-radius-sm)',
                  fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <ClipboardCheck size={14} />
                Submit for Admin Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: confirmModal.isDanger ? 'var(--danger)' : 'var(--text-main)' }}>Confirm Action</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.4' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                style={{
                  backgroundColor: confirmModal.isDanger ? 'var(--danger)' : 'var(--accent-color)',
                  color: '#fff',
                  border: 'none'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Traceability & Movement Audit Modal */}
      {traceModalData && (
        <div className="modal-overlay" style={{ zIndex: 2100, backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '960px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {traceModalData.material.imageUrl ? (
                  <div
                    onClick={() => setPreviewModalImage(traceModalData.material.imageUrl)}
                    style={{
                      width: '56px', height: '56px', borderRadius: '8px',
                      border: '2px solid var(--accent-color)', overflow: 'hidden',
                      cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title="Click to zoom material photo"
                  >
                    <img
                      src={getCleanImageUrl(traceModalData.material.imageUrl)}
                      alt={traceModalData.material.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)', border: '1.5px dashed var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: 'var(--text-muted)'
                  }}>
                    <ImageIcon size={24} style={{ opacity: 0.4 }} />
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}>
                      {traceModalData.material.id}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                      {traceModalData.material.name}
                    </h3>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Category: <strong>{traceModalData.material.category}</strong> • Storage Location: <strong>{traceModalData.material.location || 'Main Store'}</strong> • Unit: <strong>{traceModalData.material.unit}</strong>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {traceModalData.traceInfo && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handlePrintTraceReport(traceModalData.material, traceModalData.traceInfo)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '12px' }}
                  >
                    <Printer size={14} />
                    <span>Print Audit Report</span>
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTraceModalData(null)}
                  style={{ padding: '4px 10px', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {traceModalData.loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
                <span>Aggregating complete lifecycle & movement trail...</span>
              </div>
            ) : !traceModalData.traceInfo ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                <AlertCircle size={36} style={{ margin: '0 auto 10px auto', color: 'var(--warning)' }} />
                <h4>No Inward or Movement Logs Recorded Yet</h4>
                <p style={{ fontSize: '13px' }}>This material was created manually. When weighbridge inward captures or lot issues occur, the full trail will appear here.</p>
              </div>
            ) : (
              <div>
                {/* Metric Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Inwarded</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                      {traceModalData.traceInfo.totalInwardPieces.toLocaleString()} {traceModalData.material.unit}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: '600' }}>
                      {traceModalData.traceInfo.captures.length} Inward Shipment{traceModalData.traceInfo.captures.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Issued to Lots</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#b45309', marginTop: '2px' }}>
                      {traceModalData.traceInfo.totalIssuedPieces.toLocaleString()} {traceModalData.material.unit}
                    </div>
                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>
                      {traceModalData.traceInfo.issues.filter(i => !i.isReturn).length} Lot Issues
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Returned to Stock</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#047857', marginTop: '2px' }}>
                      {traceModalData.traceInfo.totalReturnedPieces.toLocaleString()} {traceModalData.material.unit}
                    </div>
                    <div style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>
                      {traceModalData.traceInfo.issues.filter(i => i.isReturn).length} Return Logs
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1.5px solid #10b981' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#065f46' }}>Live In-Stock</div>
                    <div style={{ fontSize: '19px', fontWeight: '900', color: '#047857', marginTop: '2px' }}>
                      {Number(traceModalData.material.stock).toLocaleString()} {traceModalData.material.unit}
                    </div>
                    <div style={{ fontSize: '11px', color: '#065f46', fontWeight: '700' }}>
                      📍 {traceModalData.material.location || 'Main Store'}
                    </div>
                  </div>
                </div>

                {/* Sub Tab Navigation */}
                <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '18px', gap: '8px' }}>
                  <button
                    onClick={() => setTraceActiveTab('lifecycle')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: 'none',
                      borderBottom: traceActiveTab === 'lifecycle' ? '2.5px solid var(--accent-color)' : '2.5px solid transparent',
                      color: traceActiveTab === 'lifecycle' ? 'var(--accent-color)' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Activity size={15} />
                    <span>Lifecycle Timeline</span>
                  </button>
                  <button
                    onClick={() => setTraceActiveTab('packets')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: 'none',
                      borderBottom: traceActiveTab === 'packets' ? '2.5px solid var(--accent-color)' : '2.5px solid transparent',
                      color: traceActiveTab === 'packets' ? 'var(--accent-color)' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Barcode size={15} />
                    <span>Packet Barcodes ({traceModalData.traceInfo.packets?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setTraceActiveTab('issues')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: 'none',
                      borderBottom: traceActiveTab === 'issues' ? '2.5px solid var(--accent-color)' : '2.5px solid transparent',
                      color: traceActiveTab === 'issues' ? 'var(--accent-color)' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Scissors size={15} />
                    <span>Lot Consumption ({traceModalData.traceInfo.issues?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setTraceActiveTab('transfers')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: 'none',
                      borderBottom: traceActiveTab === 'transfers' ? '2.5px solid var(--accent-color)' : '2.5px solid transparent',
                      color: traceActiveTab === 'transfers' ? 'var(--accent-color)' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Truck size={15} />
                    <span>Transfers & Movements ({traceModalData.traceInfo.transfers?.length || 0})</span>
                  </button>
                </div>

                {/* Tab 1: Full Lifecycle Timeline */}
                {traceActiveTab === 'lifecycle' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Inward Capture Step */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                        <PackageCheck size={18} />
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>Step 1: Weighbridge Inward Capture</strong>
                          <span style={{ fontSize: '11px', color: '#047857', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {traceModalData.traceInfo.captures.length} Inward Event{traceModalData.traceInfo.captures.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {traceModalData.traceInfo.captures.map((c, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 0', borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none' }}>
                            {c.imageUrl && (
                              <div
                                onClick={() => setPreviewModalImage(c.imageUrl)}
                                style={{
                                  width: '44px', height: '44px', borderRadius: '6px',
                                  border: '1.5px solid var(--border-color)', overflow: 'hidden',
                                  cursor: 'pointer', flexShrink: 0,
                                  backgroundColor: 'var(--bg-primary)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Click to view inward capture photo"
                              >
                                <img
                                  src={getCleanImageUrl(c.imageUrl)}
                                  alt="Inward capture"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                            )}
                            <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)' }}>
                              <div>• Invoice: <strong>{c.invoiceNo || 'N/A'}</strong> (PO: <strong>{c.poNumber || 'N/A'}</strong>) | Supplier: <strong>{c.supplier || 'N/A'}</strong></div>
                              <div>• Captured: <strong>{c.pieces} pcs</strong> ({c.packets || 1} pkts) • Gross: {c.grossWeightKg}kg / Net: {c.netWeightKg}kg • Operator: <strong>{c.storeIncharge || 'Pooja'}</strong></div>
                              <div>• Location: <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>📍 {c.storeLocation || 'Main Store'}</span> • Status: <strong style={{ color: '#047857' }}>{c.approvalStatus || 'Approved'}</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warehouse Rack Assignment Step */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                        <Layers size={18} />
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>Step 2: Warehouse Location & Rack Placement</strong>
                          <span style={{ fontSize: '11px', color: 'var(--accent-color)', backgroundColor: 'var(--accent-light)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Stored in {traceModalData.material.location || 'Main Store'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Allocated to <strong>{traceModalData.material.location || 'Main Store'}</strong> with barcode prefix <code>{traceModalData.traceInfo.primaryBarcode}</code>.
                        </p>
                      </div>
                    </div>

                    {/* Production Issuance Step */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                        <Scissors size={18} />
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>Step 3: Cutting Lot Consumption & Issuance</strong>
                          <span style={{ fontSize: '11px', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {traceModalData.traceInfo.totalIssuedPieces} {traceModalData.material.unit} Dispatched
                          </span>
                        </div>
                        {traceModalData.traceInfo.issues.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No material issued to cutting lots yet.</div>
                        ) : (
                          traceModalData.traceInfo.issues.slice(0, 3).map((iss, idx) => (
                            <div key={idx} style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
                              • <strong>{iss.issueId}</strong>: Issued <strong>{iss.qtyIssued} {iss.unit}</strong> to Lot <strong>#{iss.lotId}</strong> ({iss.garmentType} - {iss.style}) • Supervisor: <strong>{iss.supervisor}</strong> ({iss.date})
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Final Available Stock Balance Step */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                        <ShieldCheck size={18} />
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.06)', border: '1.5px solid #10b981', borderRadius: '8px', padding: '14px' }}>
                        <strong style={{ fontSize: '13.5px', color: '#047857' }}>Step 4: Current In-Stock Verified Balance</strong>
                        <div style={{ fontSize: '12px', color: '#065f46', marginTop: '4px' }}>
                          Verified Available Balance: <strong>{traceModalData.material.stock} {traceModalData.material.unit}</strong> across <strong>{traceModalData.traceInfo.packetsCount} packets</strong> ready for dispatch.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Packet Barcodes Grid */}
                {traceActiveTab === 'packets' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                      {traceModalData.traceInfo.packets?.map((pkt) => (
                        <div key={pkt.packetNo} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', padding: '2px 6px', borderRadius: '4px' }}>
                              Packet #{pkt.packetNo} of {pkt.totalPackets}
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#047857', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              {pkt.status}
                            </span>
                          </div>
                          <BarcodeVisual code={pkt.barcode} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            <span>Qty: <strong>~{pkt.pieces} {traceModalData.material.unit}</strong></span>
                            <span>📍 <strong>{pkt.location}</strong></span>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handlePrintSinglePacket(traceModalData.material, pkt)}
                            style={{ width: '100%', marginTop: '8px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            <Printer size={12} />
                            <span>Print Packet Label</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Lot Consumption Table */}
                {traceActiveTab === 'issues' && (
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '8px' }}>Issue ID</th>
                          <th style={{ padding: '8px' }}>Cutting Lot #</th>
                          <th style={{ padding: '8px' }}>Garment Style</th>
                          <th style={{ padding: '8px' }}>Fabric</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Quantity</th>
                          <th style={{ padding: '8px' }}>Issued To / Supervisor</th>
                          <th style={{ padding: '8px' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceModalData.traceInfo.issues?.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              No lot consumption logs recorded for this material.
                            </td>
                          </tr>
                        ) : (
                          traceModalData.traceInfo.issues.map((iss, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px', fontWeight: 'bold' }}>{iss.issueId}</td>
                              <td style={{ padding: '8px', color: 'var(--accent-color)', fontWeight: 'bold' }}>Lot #{iss.lotId}</td>
                              <td style={{ padding: '8px' }}>{iss.garmentType} ({iss.style})</td>
                              <td style={{ padding: '8px' }}>{iss.fabric}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: iss.isReturn ? '#047857' : 'var(--text-main)' }}>
                                {iss.isReturn ? `+${iss.qtyIssued} (Return)` : `-${iss.qtyIssued}`} {iss.unit}
                              </td>
                              <td style={{ padding: '8px' }}>{iss.personName} ({iss.supervisor})</td>
                              <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{iss.date}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 4: Transfers & Movements */}
                {traceActiveTab === 'transfers' && (
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '8px' }}># Transfer ID</th>
                          <th style={{ padding: '8px' }}>From Location</th>
                          <th style={{ padding: '8px' }}>To Location</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Quantity</th>
                          <th style={{ padding: '8px' }}>Operator</th>
                          <th style={{ padding: '8px' }}>Transferred At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceModalData.traceInfo.transfers?.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              No internal rack transfers recorded.
                            </td>
                          </tr>
                        ) : (
                          traceModalData.traceInfo.transfers.map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px', fontWeight: 'bold' }}>#{t.id}</td>
                              <td style={{ padding: '8px' }}>{t.fromLocation}</td>
                              <td style={{ padding: '8px', color: 'var(--accent-color)', fontWeight: 'bold' }}>📍 {t.toLocation}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{t.quantity} ({t.transferType || 'packet'})</td>
                              <td style={{ padding: '8px' }}>{t.operator || 'Admin'}</td>
                              <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                                {t.transferredAt ? new Date(t.transferredAt).toLocaleString('en-GB') : 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IMAGE ENLARGED PREVIEW MODAL ─────────────────────────────── */}
      {previewModalImage && (
        <div
          className="modal-overlay"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="panel animate-scale"
            style={{
              maxWidth: '650px', width: '90%', padding: '20px',
              borderRadius: '12px', background: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📷 Material Photo Preview
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              width: '100%', maxHeight: '450px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#f8fafc', borderRadius: '8px', overflow: 'hidden', padding: '10px'
            }}>
              <img
                src={getCleanImageUrl(previewModalImage)}
                alt="Material preview enlarged"
                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '6px' }}
                onError={(e) => { e.target.alt = 'Image failed to load'; }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewModalImage(null)}
                style={{ fontWeight: '700', padding: '8px 16px' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
