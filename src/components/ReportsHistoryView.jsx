import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../utils/api';
import { 
  TrendingUp, FileText, Calendar, DollarSign, Download, Printer, ClipboardList, 
  Search, Scale, ArrowLeftRight, Settings, Users, ShieldAlert, Truck, Layers,
  Scissors, AlertCircle, ExternalLink, RefreshCw
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PDFDocument } from './PDFDocument';

const formatDateTime = (dateVal) => {
  if (!dateVal) return '—';
  const str = String(dateVal).trim();

  // Handle dd/mm/yyyy hh:mm or dd/mm/yyyy
  const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?(?:\s*(AM|PM))?/i;
  const match = str.match(dmyRegex);

  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const hour = match[4];
    const minute = match[5];
    const ampm = match[6];

    if (hour && minute) {
      if (ampm) {
        return `${day}/${month}/${year} ${hour.padStart(2, '0')}:${minute} ${ampm.toUpperCase()}`;
      }
      let hr = parseInt(hour, 10);
      const calculatedAmPm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12;
      hr = hr ? hr : 12;
      return `${day}/${month}/${year} ${String(hr).padStart(2, '0')}:${minute} ${calculatedAmPm}`;
    }
    return `${day}/${month}/${year}`;
  }

  // Try JS standard Date parsing
  try {
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(',', '');
    }
  } catch (e) { }

  return str;
};

const parseToDateObject = (dateVal) => {
  if (!dateVal) return new Date(0);

  const str = String(dateVal).trim();
  const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?(?:\s*(AM|PM))?/i;
  const match = str.match(dmyRegex);

  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    let hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const ampm = match[6];

    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }

    return new Date(year, month, day, hour, minute);
  }

  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(0);
};

export default function ReportsHistoryView({ 
  pos = [], 
  designs = [],
  issueLogs = [],
  currencySymbol = 'R' 
}) {
  const [selectedPo, setSelectedPo] = useState(null);
  
  // Premium Design Tokens
  const styles = {
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-color)',
      paddingBottom: '12px',
      marginBottom: '16px'
    },
    title: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '16px',
      fontWeight: '800',
      color: 'var(--text-main)',
      margin: 0
    },
    filterBar: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '12px 16px',
      backgroundColor: 'var(--bg-primary, #f8fafc)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      marginBottom: '16px'
    },
    inputWrapper: {
      position: 'relative',
      flex: '1 1 200px',
      minWidth: '150px'
    },
    inputIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--text-muted)',
      display: 'flex',
      alignItems: 'center'
    },
    input: {
      paddingLeft: '34px',
      height: '36px',
      fontSize: '13px',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-secondary, #ffffff)',
      color: 'var(--text-main)',
      width: '100%',
      outline: 'none',
      transition: 'border-color 0.2s'
    },
    select: {
      height: '36px',
      fontSize: '13px',
      padding: '0 28px 0 12px',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-secondary, #ffffff)',
      color: 'var(--text-main)',
      cursor: 'pointer',
      outline: 'none',
      minWidth: '130px',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23475569%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 10px center',
      transition: 'border-color 0.2s'
    },
    btn: {
      height: '36px',
      padding: '0 16px',
      fontSize: '13px',
      fontWeight: '600',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }
  };
  const [activeReportTab, setActiveReportTab] = useState('material_ledger'); // 'material_ledger', 'designer_audits', 'store_audits'
  const [selectedLotId, setSelectedLotId] = useState('');
  
  // Audit states
  const [designHistory, setDesignHistory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [extraMaterialIssues, setExtraMaterialIssues] = useState([]);
  const [weightCaptures, setWeightCaptures] = useState([]);
  const [zipOrders, setZipOrders] = useState([]);
  const [dooriOrders, setDooriOrders] = useState([]);
  const [scans, setScans] = useState([]);
  const [fetchedIssueLogs, setFetchedIssueLogs] = useState([]);
  const [expandedLotId, setExpandedLotId] = useState(null);
  const [expandedStoreLogId, setExpandedStoreLogId] = useState(null);
  const [expandedPtId, setExpandedPtId] = useState(null);
  
  // Search & Filter states
  const [dhSearchQuery, setDhSearchQuery] = useState('');
  const [dhActionFilter, setDhActionFilter] = useState('all');
  const [dhDateFilter, setDhDateFilter] = useState('all');
  const [dhSort, setDhSort] = useState('latest');
  
  const [saSearchQuery, setSaSearchQuery] = useState('');
  const [saTypeFilter, setSaTypeFilter] = useState('all');
  const [saDateFilter, setSaDateFilter] = useState('all');
  const [saSort, setSaSort] = useState('latest');

  // PO Sourcing Tracking states
  const [ptSearchQuery, setPtSearchQuery] = useState('');
  const [ptTypeFilter, setPtTypeFilter] = useState('all');
  const [ptStatusFilter, setPtStatusFilter] = useState('all');
  const [ptMaterialFilter, setPtMaterialFilter] = useState('all');
  const [ptDateFilter, setPtDateFilter] = useState('all');
  const [ptSort, setPtSort] = useState('latest');

  // Undesigned Cutting Lots Report states
  const [undesignedLots, setUndesignedLots] = useState([]);
  const [loadingUndesigned, setLoadingUndesigned] = useState(false);
  const [undesignedSearch, setUndesignedSearch] = useState('');
  const [undesignedFabricFilter, setUndesignedFabricFilter] = useState('all');
  const [undesignedSort, setUndesignedSort] = useState('latest');

  // Auto-select first design lot if available
  useEffect(() => {
    if (!selectedLotId && designs.length > 0) {
      setSelectedLotId(designs[0].id);
    }
  }, [designs, selectedLotId]);

  // Load audit data on mount and tab changes
  useEffect(() => {
    const backendUrl = getBackendUrl();

    // Fetch issue logs
    fetch(`${backendUrl}/api/issue-logs`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setFetchedIssueLogs(data))
      .catch(err => console.error('Error fetching issue logs:', err));

    // Fetch extra material issues
    fetch(`${backendUrl}/api/extra-material-issues`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setExtraMaterialIssues(data))
      .catch(err => console.error('Error fetching extra material issues:', err));

    // Fetch design history
    fetch(`${backendUrl}/api/design-history`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setDesignHistory(data))
      .catch(err => console.error('Error fetching design history:', err));

    // Fetch zip orders
    fetch(`${backendUrl}/api/zip-orders`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setZipOrders(data))
      .catch(err => console.error('Error fetching zip orders:', err));

    // Fetch doori orders
    fetch(`${backendUrl}/api/doori-orders`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setDooriOrders(data))
      .catch(err => console.error('Error fetching doori orders:', err));

    // Fetch scans
    fetch(`${backendUrl}/api/scans`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setScans(data))
      .catch(err => console.error('Error fetching scans:', err));

    // Fetch transfers
    fetch(`${backendUrl}/api/transfers`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setTransfers(data))
      .catch(err => console.error('Error fetching transfers:', err));

    // Fetch weight captures
    fetch(`${backendUrl}/api/weight-capture`)
      .then(res => res.ok ? res.json() : { success: false, data: [] })
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setWeightCaptures(data.data);
        } else if (Array.isArray(data)) {
          setWeightCaptures(data);
        }
      })
      .catch(err => console.error('Error fetching weight captures:', err));

    // Fetch undesigned lots
    if (activeReportTab === 'undesigned_lots') {
      setLoadingUndesigned(true);
      fetch(`${backendUrl}/api/reports/undesigned-cutting-lots`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setUndesignedLots(data))
        .catch(err => console.error('Error fetching undesigned lots:', err))
        .finally(() => setLoadingUndesigned(false));
    }
  }, [activeReportTab]);

  const allIssueLogs = issueLogs && issueLogs.length > 0 ? issueLogs : fetchedIssueLogs;

  // Calculate stats
  const totalPOValue = pos.reduce((sum, po) => sum + po.total, 0);
  const totalTaxPaid = pos.reduce((sum, po) => sum + po.tax, 0);
  const activePOUnits = pos.length;

  // Store audits parser
  const getStoreAudits = () => {
    const list = [];
    
    // 1. Issue & Return Logs
    (allIssueLogs || []).forEach(log => {
      const dateVal = log.date || log.issuedAt || log.timestamp || log.created_at;
      let matSummary = '';
      if (Array.isArray(log.materials)) {
        matSummary = log.materials.map(m => `${m.qty || m.issueQty || 0} ${m.unit || 'pcs'} ${m.name || m.bomItemName || ''}`).filter(Boolean).join(', ');
      } else if (typeof log.materials === 'string') {
        try {
          const parsed = JSON.parse(log.materials);
          if (Array.isArray(parsed)) {
            matSummary = parsed.map(m => `${m.qty || m.issueQty || 0} ${m.unit || 'pcs'} ${m.name || m.bomItemName || ''}`).filter(Boolean).join(', ');
          }
        } catch (_) {}
      }
      
      const isRet = log.isReturn === 1 || log.isReturn === true;
      const isRe = log.isReissue === 1 || log.isReissue === true;
      const typeStr = isRet ? 'Material Return' : (isRe ? 'Material Re-Issue' : 'Material Issue');

      list.push({
        id: `IS-${log.id}`,
        type: typeStr,
        date: dateVal,
        details: matSummary || `${log.volume || log.qtyIssued || 0} units of material for Lot #${log.lotId}`,
        operator: log.receiverName ? `${log.personName || log.issuedBy || 'Store'} → ${log.receiverName}` : (log.personName || log.issuedBy || 'Store Incharge'),
        tag: isRet ? 'return' : 'issue'
      });

      if (log.returnedQty > 0 && !isRet) {
        list.push({
          id: `RT-${log.id}`,
          type: 'Material Return',
          date: log.returnedAt || dateVal,
          details: `${log.returnedQty} units of material returned for Lot #${log.lotId}`,
          operator: log.returnedBy || log.personName || 'Store Incharge',
          tag: 'return'
        });
      }
    });

    // 2. Extra Material Issues
    (extraMaterialIssues || []).forEach(ei => {
      let itemsSummary = '';
      const items = Array.isArray(ei.items) ? ei.items : [];
      if (items.length > 0) {
        itemsSummary = items.map(it => `+${it.totalRequired || it.qty || 0} ${it.unit || 'pcs'} ${it.bomItemName || it.materialName || ''}`).filter(Boolean).join(', ');
      }

      list.push({
        id: `EX-${ei.voucherId || ei.id}`,
        type: 'Extra Material Requisition',
        date: ei.issueDate || ei.createdAt || ei.date,
        details: `Voucher ${ei.voucherId || ''}: ${itemsSummary || 'Extra materials issued'} for Lot #${ei.lotId} (Receiver: ${ei.receiverName || 'Dept'})`,
        operator: ei.personName || 'Store Staff',
        tag: 'extra_issue'
      });
    });

    // 3. Transfers
    (transfers || []).forEach(t => {
      list.push({
        id: `TR-${t.id}`,
        type: 'Stock Transfer',
        date: t.transferredAt || t.date || t.timestamp,
        details: `${t.qty || t.quantity || 0} units of ${t.materialName || t.materialCode || 'trims'} transferred from ${t.fromLocation || 'Store'} to ${t.toLocation}`,
        operator: t.transferredBy || t.operator || 'System',
        tag: 'transfer'
      });
    });

    // 4. Weight Captures
    (weightCaptures || []).forEach(wc => {
      list.push({
        id: `WC-${wc.id}`,
        type: 'Material Weight Capture',
        date: wc.capturedAt || wc.createdAt || wc.timestamp,
        details: `Weighed ${wc.pieces || 0} pieces of ${wc.materialName || 'material'} (Net: ${wc.netWeightKg || wc.weight || 0} kg) for Lot #${wc.lotNo || '—'}`,
        operator: wc.storeIncharge || wc.operator || 'Weighbridge Operator',
        tag: 'weight'
      });
    });

    // 5. Scans (Gate Entry, Material Check-In, Printing, RGP)
    (scans || []).forEach(s => {
      const isGate = s.scan_type === 'gate_entry';
      const isPrinting = s.scan_type === 'printing_gate_out';
      const isRgp = s.scan_type === 'rgp_entry' || s.scan_type === 'rgp_return';
      const isMatIn = s.scan_type === 'material_in';
      
      let typeLabel = 'Scan Event';
      let desc = '';

      if (isGate) {
        typeLabel = 'Gate Entry Scan';
        desc = `Gate pass arrival for Lot #${s.lot_number}: ${s.material_name || 'Materials'} (${s.quantity || 0} pcs) from ${s.supplier_name || 'Vendor'}`;
      } else if (isPrinting) {
        typeLabel = 'Printing Gate Out';
        desc = `Dispatched for printing Lot #${s.lot_number}: ${s.quantity || 0} pcs ${s.material_name || ''}`;
      } else if (isRgp) {
        typeLabel = s.scan_type === 'rgp_return' ? 'RGP Return Scan' : 'RGP Gate Dispatch';
        desc = `RGP Pass #${s.lot_number}: ${s.quantity || 0} pcs of ${s.material_name || 'Goods'} (${s.supplier_name || 'Processor'})`;
      } else if (isMatIn) {
        typeLabel = 'Material Check-In Scan';
        desc = `Store check-in for Lot #${s.lot_number}: ${s.quantity || 0} pcs of ${s.material_name || 'trims'} from ${s.supplier_name || 'Vendor'}`;
      } else {
        typeLabel = `Scan (${s.scan_type})`;
        desc = `Lot #${s.lot_number}: ${s.quantity || 0} pcs of ${s.material_name || ''}`;
      }

      list.push({
        id: `SC-${s.id}`,
        type: typeLabel,
        date: s.scanned_at || s.timestamp,
        details: desc,
        operator: s.person_name || 'Scanner Operator',
        tag: 'scan'
      });
    });

    // Sort by date descending
    return list.sort((a, b) => parseToDateObject(b.date).getTime() - parseToDateObject(a.date).getTime());
  };

  const applyDateFilter = (dateStr, filter) => {
    if (filter === 'all') return true;
    const d = parseToDateObject(dateStr);
    if (d.getTime() === 0) return true;
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
      const da = parseToDateObject(a[dateField]);
      const db = parseToDateObject(b[dateField]);
      return order === 'latest' ? db.getTime() - da.getTime() : da.getTime() - db.getTime();
    });
  };

  const getStoreLogDetails = (idStr) => {
    if (!idStr) return null;
    const parts = idStr.split('-');
    const prefix = parts[0];
    const rawId = parts.slice(1).join('-');
    const parsedId = Number(rawId);
    
    if (prefix === 'IS' || prefix === 'RT') {
      const log = (allIssueLogs || []).find(l => Number(l.id) === parsedId || String(l.id) === rawId);
      return log ? { type: prefix, data: log } : null;
    }
    if (prefix === 'EX') {
      const ei = (extraMaterialIssues || []).find(e => Number(e.id) === parsedId || String(e.voucherId) === rawId || String(e.id) === rawId);
      return ei ? { type: 'EX', data: ei } : null;
    }
    if (prefix === 'TR') {
      const t = (transfers || []).find(x => Number(x.id) === parsedId || String(x.id) === rawId);
      return t ? { type: 'TR', data: t } : null;
    }
    if (prefix === 'WC') {
      const wc = (weightCaptures || []).find(w => Number(w.id) === parsedId || String(w.id) === rawId);
      return wc ? { type: 'WC', data: wc } : null;
    }
    if (prefix === 'SC') {
      const s = (scans || []).find(x => Number(x.id) === parsedId || String(x.id) === rawId);
      return s ? { type: 'SC', data: s } : null;
    }
    return null;
  };

  // Filtered Designer Audits
  const filteredDesignerAudits = sortByDate(
    (designHistory || []).filter(h => {
      const query = dhSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || (
        String(h.lotId).toLowerCase().includes(query) ||
        (h.details || '').toLowerCase().includes(query) ||
        (h.actorName || '').toLowerCase().includes(query) ||
        (h.action || '').toLowerCase().includes(query)
      );
      const matchesAction = dhActionFilter === 'all' || (h.action || '').toLowerCase() === dhActionFilter.toLowerCase();
      const matchesDate = applyDateFilter(h.timestamp, dhDateFilter);
      return matchesSearch && matchesAction && matchesDate;
    }),
    'timestamp',
    dhSort
  );

  const getLotAuditDetails = (lotId) => {
    const lotStr = String(lotId).toLowerCase().trim();
    
    // 1. Find standard POs
    const relatedPos = (pos || []).filter(po => 
      String(po.lotId).toLowerCase().trim() === lotStr || 
      (po.designName && String(po.designName).toLowerCase().includes(lotStr))
    );

    // 2. Find RGP scans
    const relatedRgps = (scans || []).filter(s => 
      String(s.lot_number).toLowerCase().trim() === lotStr && 
      String(s.scan_type).toLowerCase() === 'rgp'
    );

    // 3. Find Zip POs
    const relatedZips = (zipOrders || []).filter(z => 
      String(z.Lot_Number).toLowerCase().trim() === lotStr
    );

    // 4. Find Doori POs
    const relatedDooris = (dooriOrders || []).filter(d => 
      String(d.Lot_Number).toLowerCase().trim() === lotStr
    );

    return {
      pos: relatedPos,
      rgps: relatedRgps,
      zips: relatedZips,
      dooris: relatedDooris
    };
  };

  // Filtered Store Audits
  const filteredStoreAudits = sortByDate(
    getStoreAudits().filter(s => {
      const query = saSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || (
        s.id.toLowerCase().includes(query) ||
        s.type.toLowerCase().includes(query) ||
        s.details.toLowerCase().includes(query) ||
        s.operator.toLowerCase().includes(query)
      );
      const matchesType = saTypeFilter === 'all' || s.tag === saTypeFilter;
      const matchesDate = applyDateFilter(s.date, saDateFilter);
      return matchesSearch && matchesType && matchesDate;
    }),
    'date',
    saSort
  );

  const getPoTrackingList = () => {
    const list = [];

    // Helper: calculate received qty from scans
    const getReceivedQty = (lotNo) => {
      const lotStr = String(lotNo).toLowerCase().trim();
      return scans
        .filter(s => String(s.lot_number).toLowerCase().trim() === lotStr && s.scan_type === 'material_in')
        .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    };

    // Helper: find scan details by type
    const findScan = (lotNo, type) => {
      const lotStr = String(lotNo).toLowerCase().trim();
      return scans.find(s => String(s.lot_number).toLowerCase().trim() === lotStr && s.scan_type === type);
    };

    // 1. Normal POs
    (pos || []).forEach(po => {
      let poMaterials = [];
      if (po.items) {
        try {
          const itms = typeof po.items === 'string' ? JSON.parse(po.items) : po.items;
          if (Array.isArray(itms)) {
            poMaterials = itms.map(i => (i.name || i.description || i.item || '').trim()).filter(Boolean);
          }
        } catch (_) {}
      }

      const reqQty = po.items ? (typeof po.items === 'string' ? JSON.parse(po.items || '[]') : po.items).reduce((sum, item) => sum + (Number(item.qty) || 0), 0) : 0;
      const recQty = getReceivedQty(po.lotId || po.poNumber);
      
      const gateScan = findScan(po.lotId || po.poNumber, 'gate_entry');
      const recScan = findScan(po.lotId || po.poNumber, 'material_in');

      list.push({
        id: po.poNumber,
        lotId: po.lotId || 'Manual',
        type: 'Normal PO',
        tag: 'normal',
        supplier: po.vendorName || '—',
        requestedQty: reqQty,
        receivedQty: recQty,
        materials: poMaterials,
        gatePerson: gateScan ? gateScan.person_name : (po.gatePerson || '—'),
        gateDate: gateScan ? new Date(gateScan.scanned_at).toLocaleDateString() : (po.gateDate || '—'),
        receiver: recScan ? recScan.person_name : (po.receivedBy || '—'),
        receivedDate: recScan ? new Date(recScan.scanned_at).toLocaleDateString() : (po.receivedDate || '—')
      });
    });

    // 2. Zip POs
    (zipOrders || []).forEach(z => {
      const reqQty = Number(z.Total_Pieces) || 0;
      const recQty = getReceivedQty(z.Lot_Number);

      const gateScan = findScan(z.Lot_Number, 'gate_entry');
      const recScan = findScan(z.Lot_Number, 'material_in');

      list.push({
        id: `ZIP-${z.Lot_Number}`,
        lotId: z.Lot_Number,
        type: 'Zip Purcharge Orders',
        tag: 'zip',
        supplier: z.Supplier_Name || '—',
        requestedQty: reqQty,
        receivedQty: recQty,
        materials: ['Zipper', z.ch_fabric, z.Style].filter(Boolean),
        gatePerson: gateScan ? gateScan.person_name : (z.Gate_Entry_Person || '—'),
        gateDate: gateScan ? new Date(gateScan.scanned_at).toLocaleDateString() : (z.Gate_Entry_Date || '—'),
        receiver: recScan ? recScan.person_name : (z.Material_Received_By || '—'),
        receivedDate: recScan ? new Date(recScan.scanned_at).toLocaleDateString() : (z.Material_Received_Date || '—')
      });
    });

    // 3. Doori POs
    (dooriOrders || []).forEach(d => {
      const reqQty = Number(d.Total_Pieces) || 0;
      const recQty = getReceivedQty(d.Lot_Number);

      const gateScan = findScan(d.Lot_Number, 'gate_entry');
      const recScan = findScan(d.Lot_Number, 'material_in');

      list.push({
        id: `DORI-${d.Lot_Number}`,
        lotId: d.Lot_Number,
        type: 'Doori PO',
        tag: 'doori',
        supplier: d.Supplier_Name || '—',
        requestedQty: reqQty,
        receivedQty: recQty,
        materials: ['Doori / Drawstring', d.ch_fabric, d.Style].filter(Boolean),
        gatePerson: gateScan ? gateScan.person_name : (d.Gate_Entry_Person || '—'),
        gateDate: gateScan ? new Date(gateScan.scanned_at).toLocaleDateString() : (d.Gate_Entry_Date || '—'),
        receiver: recScan ? recScan.person_name : (d.Material_Received_By || '—'),
        receivedDate: recScan ? new Date(recScan.scanned_at).toLocaleDateString() : (d.Material_Received_Date || '—')
      });
    });

    // 4. RGP POs (from scans where scan_type = 'rgp_entry')
    const rgpScans = (scans || []).filter(s => s.scan_type === 'rgp_entry');
    const rgpGroup = {};
    rgpScans.forEach(s => {
      const key = s.lot_number;
      if (!rgpGroup[key]) {
        rgpGroup[key] = {
          qty: 0,
          supplier: s.supplier_name,
          person: s.person_name,
          date: s.scanned_at,
          materials: []
        };
      }
      rgpGroup[key].qty += (Number(s.quantity) || 0);
      if (s.material_name && !rgpGroup[key].materials.includes(s.material_name)) {
        rgpGroup[key].materials.push(s.material_name);
      }
    });

    Object.keys(rgpGroup).forEach(lotNo => {
      const group = rgpGroup[lotNo];
      const recQty = scans
        .filter(s => String(s.lot_number).toLowerCase().trim() === lotNo.toLowerCase().trim() && s.scan_type === 'rgp_return')
        .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

      const returnScan = findScan(lotNo, 'rgp_return');

      list.push({
        id: `RGP-${lotNo}`,
        lotId: lotNo,
        type: 'RGP PO',
        tag: 'rgp',
        supplier: group.supplier || '—',
        requestedQty: group.qty, // Sent out
        receivedQty: recQty, // Returned back
        materials: group.materials.length > 0 ? group.materials : ['Fabric / Trim'],
        gatePerson: group.person || '—', // Dispatcher
        gateDate: new Date(group.date).toLocaleDateString(), // Dispatch date
        receiver: returnScan ? returnScan.person_name : '—', // Receiver back
        receivedDate: returnScan ? new Date(returnScan.scanned_at).toLocaleDateString() : '—' // Receive back date
      });
    });

    return list;
  };

  // Extract unique materials across all PO tracking items
  const uniquePtMaterials = React.useMemo(() => {
    const list = getPoTrackingList();
    const set = new Set();
    list.forEach(item => {
      if (Array.isArray(item.materials)) {
        item.materials.forEach(m => {
          if (m && String(m).trim()) set.add(String(m).trim());
        });
      }
    });
    return Array.from(set).sort();
  }, [pos, zipOrders, dooriOrders, scans, weightCaptures]);

  // Filtered Sourcing & PO Tracking
  const filteredPtList = sortByDate(
    getPoTrackingList().filter(item => {
      // 1. Search Query
      const query = ptSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || (
        String(item.id).toLowerCase().includes(query) ||
        String(item.lotId).toLowerCase().includes(query) ||
        (item.supplier || '').toLowerCase().includes(query) ||
        (item.gatePerson || '').toLowerCase().includes(query) ||
        (item.receiver || '').toLowerCase().includes(query) ||
        (Array.isArray(item.materials) && item.materials.some(m => String(m).toLowerCase().includes(query)))
      );

      // 2. Type Filter
      const matchesType = ptTypeFilter === 'all' || item.tag === ptTypeFilter;

      // 3. Status Filter
      const status = item.receivedQty >= item.requestedQty && item.requestedQty > 0
        ? 'fully'
        : item.receivedQty > 0 && item.receivedQty < item.requestedQty
        ? 'partially'
        : (item.gatePerson && item.gatePerson !== '—')
        ? 'gate_entered'
        : 'pending';

      const matchesStatus = ptStatusFilter === 'all' || status === ptStatusFilter;

      // 4. Material Filter
      const matchesMaterial = ptMaterialFilter === 'all' || (
        Array.isArray(item.materials) && item.materials.some(m => String(m).toLowerCase() === ptMaterialFilter.toLowerCase())
      );

      // 5. Date Filter
      const dateToCheck = item.receivedDate !== '—' ? item.receivedDate : item.gateDate;
      const matchesDate = ptDateFilter === 'all' || applyDateFilter(dateToCheck, ptDateFilter);

      return matchesSearch && matchesType && matchesStatus && matchesMaterial && matchesDate;
    }),
    'receivedDate',
    ptSort
  );

  // Render a responsive bar/line chart using SVG
  const monthData = [
    { label: 'March', amount: 45000 },
    { label: 'April', amount: 82000 },
    { label: 'May', amount: 55000 },
    { label: 'June', amount: totalPOValue > 0 ? totalPOValue : 38500 }
  ];

  const maxVal = Math.max(...monthData.map(m => m.amount)) * 1.2;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '20px', paddingTop: '4px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 6px 0' }}>Reports & Transaction Ledger</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>Analyze manufacturing cost expenditures, check PO archives, and inspect material consumption by Lot.</p>
      </div>

      {/* Sub-tab navigation */}
      <div className="print-hide" style={{
        display: 'flex',
        backgroundColor: 'var(--bg-secondary)',
        padding: '5px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
        width: 'fit-content',
        maxWidth: '100%',
        overflowX: 'auto',
        flexWrap: 'wrap',
        gap: '4px'
      }}>
        <button
          type="button"
          onClick={() => setActiveReportTab('material_ledger')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'material_ledger' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'material_ledger' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ClipboardList size={14} />
          <span>Material Ledger</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('designer_audits')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'designer_audits' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'designer_audits' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Users size={14} />
          <span>Designer Audits</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('store_audits')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'store_audits' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'store_audits' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Scale size={14} />
          <span>Store Audits</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('po_tracking')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'po_tracking' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'po_tracking' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Truck size={14} />
          <span>PO Sourcing Tracking</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('undesigned_lots')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'undesigned_lots' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'undesigned_lots' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Scissors size={14} />
          <span>Undesigned Cutting Lots ({undesignedLots.length || 0})</span>
        </button>
      </div>


      {activeReportTab === 'material_ledger' && (
        <div className="animate-scale">
          {/* Lot Selector Panel */}
          <div className="panel print-hide" style={{ marginBottom: '24px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '15px', fontWeight: '700' }}>Select Manufacturing Lot to Filter Report</label>
              <select
                className="form-input"
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                style={{ maxWidth: '400px' }}
              >
                <option value="">-- Choose Approved Lot --</option>
                {designs.map(design => (
                  <option key={design.id} value={design.id}>
                    Lot {design.id} &mdash; {design.brand || 'No Brand'} ({design.category})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Generates a complete breakdown of raw materials issued, returned, and net consumed for the selected manufacturing cycle.
              </span>
            </div>
          </div>

          {selectedLotId ? (
            (() => {
              // Filter logs for this lot
              const lotLogs = issueLogs.filter(log => String(log.lotId) === String(selectedLotId));
              const selectedDesign = designs.find(d => d.id === selectedLotId);

              if (lotLogs.length === 0) {
                return (
                  <div className="panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <ClipboardList size={48} strokeWidth={1} style={{ marginBottom: '12px', color: 'var(--text-light)', display: 'inline-block' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>No Transactions Recorded</h3>
                    <p style={{ fontSize: '14px', marginTop: '4px' }}>No material issues or return logs have been compiled yet for Lot {selectedLotId}.</p>
                  </div>
                );
              }

              // Compile consumption summary mapping
              const consumptionSummary = {};
              let totalIssuedCount = 0;
              let totalReturnedCount = 0;

              lotLogs.forEach(log => {
                log.materials.forEach(item => {
                  const key = `${item.bomItemName || 'Return'}::${item.name}`;
                  if (!consumptionSummary[key]) {
                    consumptionSummary[key] = {
                      bomItemName: item.bomItemName || 'Return',
                      materialName: item.name,
                      unit: item.unit || 'pcs',
                      issued: 0,
                      returned: 0
                    };
                  }
                  if (log.isReturn) {
                    consumptionSummary[key].returned += item.qty;
                    totalReturnedCount += item.qty;
                  } else {
                    consumptionSummary[key].issued += item.qty;
                    totalIssuedCount += item.qty;
                  }
                });
              });

              const summaryList = Object.values(consumptionSummary);

              // Find manufacturing batch volume if recorded
              const initialLog = lotLogs.find(log => !log.isReissue && !log.isReturn);
              const batchVolume = initialLog ? initialLog.volume : 0;

              return (
                <div>
                  {/* Lot Report Analytics Cards */}
                  <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                    <div className="stat-card" style={{ padding: '20px' }}>
                      <span className="stat-title">Garment Target Batch</span>
                      <span className="stat-value" style={{ fontSize: '22px' }}>
                        {batchVolume > 0 ? `${batchVolume.toLocaleString()} units` : 'N/A'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {selectedDesign ? `${selectedDesign.category} — ${selectedDesign.brand || 'No Brand'}` : 'Details Loaded'}
                      </span>
                    </div>

                    <div className="stat-card" style={{ padding: '20px' }}>
                      <span className="stat-title" style={{ color: 'var(--accent-color)' }}>Total Materials Issued</span>
                      <span className="stat-value" style={{ fontSize: '22px', color: 'var(--accent-color)' }}>
                        {totalIssuedCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Raw materials checked out of store
                      </span>
                    </div>

                    <div className="stat-card" style={{ padding: '20px' }}>
                      <span className="stat-title" style={{ color: 'var(--success)' }}>Total Materials Returned</span>
                      <span className="stat-value" style={{ fontSize: '22px', color: 'var(--success)' }}>
                        {totalReturnedCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Returned leftovers back to inventory
                      </span>
                    </div>
                  </div>

                  {/* Summary Consumption Table */}
                  <div className="panel">
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 className="panel-title">
                        <FileText size={18} className="text-accent" />
                        Lot Material Consumption Ledger (Lot {selectedLotId})
                      </h3>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm print-hide"
                        onClick={() => window.print()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Printer size={14} />
                        <span>Print Report</span>
                      </button>
                    </div>

                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>BOM Component Name</th>
                            <th>Inventory Material Mapped</th>
                            <th style={{ textAlign: 'right' }}>Total Quantity Issued</th>
                            <th style={{ textAlign: 'right' }}>Total Quantity Returned</th>
                            <th style={{ textAlign: 'right' }}>Net Quantity Consumed</th>
                            <th style={{ textAlign: 'left', paddingLeft: '24px' }}>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryList.map((item, idx) => {
                            const net = Math.round((item.issued - item.returned) * 100) / 100;
                            return (
                              <tr key={idx}>
                                <td style={{ fontWeight: 'bold' }}>{item.bomItemName}</td>
                                <td>{item.materialName}</td>
                                <td style={{ textAlign: 'right', fontWeight: '500' }}>{item.issued.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'right', fontWeight: '500', color: item.returned > 0 ? 'var(--success)' : 'inherit' }}>
                                  {item.returned > 0 ? `+${item.returned.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                                  {net.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'left', paddingLeft: '24px', color: 'var(--text-muted)' }}>{item.unit}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lot Logs Audit Trail History */}
                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="panel-title">
                        <Calendar size={18} className="text-accent" />
                        Transaction History (Audit Trail for Lot {selectedLotId})
                      </h3>
                    </div>

                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Log ID</th>
                            <th>Transaction Type</th>
                            <th>Date & Time</th>
                            <th>Issuer Name / Comments</th>
                            <th>Materials Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lotLogs.map((log) => (
                            <tr key={log.id}>
                              <td style={{ fontWeight: 'bold' }}>{log.id}</td>
                              <td>
                                {log.isReturn ? (
                                  <span className="status-badge verified" style={{ textTransform: 'uppercase', backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                                    Material Return
                                  </span>
                                ) : log.isReissue ? (
                                  <span className="status-badge pending" style={{ textTransform: 'uppercase' }}>
                                    Re-issue (Wastage)
                                  </span>
                                ) : (
                                  <span className="status-badge po-generated" style={{ textTransform: 'uppercase' }}>
                                    Initial Issue
                                  </span>
                                )}
                              </td>
                              <td>{log.date}</td>
                              <td>
                                <strong>{log.personName || 'System'}</strong>
                              </td>
                              <td style={{ fontSize: '12px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {log.materials.map((m, mIdx) => (
                                    <span key={mIdx} style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                      <strong>{m.bomItemName || 'Return'}</strong> ({m.name}): <strong>{m.qty} {m.unit}</strong>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <ClipboardList size={48} strokeWidth={1} style={{ marginBottom: '12px', color: 'var(--text-light)', display: 'inline-block' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>Select a Lot Number</h3>
            </div>
          )}
        </div>
      )}

      {/* Designer Audits View */}
      {activeReportTab === 'designer_audits' && (
        <div className="panel animate-scale">
          <div style={{ display: 'block', padding: '20px 20px 0 20px' }}>
            <div style={styles.headerRow}>
              <h3 style={styles.title}>
                <Users size={18} style={{ color: 'var(--accent-color)' }} />
                <span>Designer & Specification Audit Trail</span>
              </h3>
              <button
                className="btn btn-secondary btn-sm print-hide"
                onClick={() => window.print()}
                style={styles.btn}
              >
                <Printer size={14} />
                <span>Print Report</span>
              </button>
            </div>
            <div style={styles.filterBar} className="print-hide">
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search lot, details, actor..."
                  value={dhSearchQuery}
                  onChange={(e) => setDhSearchQuery(e.target.value)}
                  style={styles.input}
                />
              </div>
              <select
                value={dhActionFilter}
                onChange={(e) => setDhActionFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Actions</option>
                <option value="created">Created</option>
                <option value="approved">Approved</option>
                <option value="verified">Verified</option>
                <option value="edited">Edited</option>
              </select>
              <select
                value={dhDateFilter}
                onChange={(e) => setDhDateFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <select
                value={dhSort}
                onChange={(e) => setDhSort(e.target.value)}
                style={styles.select}
              >
                <option value="latest">⬇ Latest First</option>
                <option value="oldest">⬆ Oldest First</option>
              </select>
              {(dhSearchQuery || dhActionFilter !== 'all' || dhDateFilter !== 'all' || dhSort !== 'latest') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setDhSearchQuery(''); setDhActionFilter('all'); setDhDateFilter('all'); setDhSort('latest'); }}
                  style={{ ...styles.btn, padding: '0 12px' }}
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
                  <th>Lot ID</th>
                  <th>Action</th>
                  <th>Operator</th>
                  <th>Details Log</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'center' }}>Workflows</th>
                </tr>
              </thead>
              <tbody>
                {filteredDesignerAudits.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No design audit records matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDesignerAudits.map((h, idx) => {
                    const act = String(h.action || 'created').toLowerCase();
                    const badgeColor = act.includes('created') || act.includes('init')
                      ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }
                      : act.includes('approve')
                      ? { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }
                      : act.includes('verify')
                      ? { backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }
                      : { backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' };

                    const detailData = getLotAuditDetails(h.lotId);
                    const hasDetails = detailData.pos.length > 0 || detailData.rgps.length > 0 || detailData.zips.length > 0 || detailData.dooris.length > 0;

                    return (
                      <React.Fragment key={h.id || idx}>
                        <tr style={{ cursor: hasDetails ? 'pointer' : 'default' }} onClick={() => hasDetails && setExpandedLotId(expandedLotId === h.lotId ? null : h.lotId)}>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>Lot #{h.lotId}</td>
                          <td>
                            <span className="status-badge" style={{ ...badgeColor, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '10px' }}>
                              {h.action}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>{h.actorName}</td>
                          <td style={{ fontSize: '13px' }}>{h.details}</td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{h.timestamp}</td>
                          <td style={{ textAlign: 'center' }}>
                            {hasDetails ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedLotId(expandedLotId === h.lotId ? null : h.lotId);
                                }}
                              >
                                {expandedLotId === h.lotId ? 'Hide Logs' : 'Inspect Details'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Docs</span>
                            )}
                          </td>
                        </tr>
                        {expandedLotId === h.lotId && hasDetails && (
                          <tr style={{ background: 'var(--bg-primary, #f8fafc)' }}>
                            <td colSpan="6" style={{ padding: '16px', borderLeft: '4px solid var(--accent-color)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    🔍 Linked Sourcing Records & POs (Lot #{h.lotId})
                                  </h4>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                  
                                  {/* Standard Purchase Orders */}
                                  <div style={{ background: 'var(--bg-secondary, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', textTransform: 'uppercase' }}>
                                      🛒 Standard POs ({detailData.pos.length})
                                    </span>
                                    {detailData.pos.length === 0 ? (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No standard POs generated.</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {detailData.pos.map((po, pIdx) => (
                                          <div key={pIdx} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                            <span><strong>{po.poNumber}</strong> ({po.vendorName})</span>
                                            <span style={{ fontWeight: '700', color: '#10b981' }}>{currencySymbol} {po.total.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Returnable Gate Passes (RGPs) */}
                                  <div style={{ background: 'var(--bg-secondary, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', textTransform: 'uppercase' }}>
                                      🚪 Returnable Gate Pass (RGP) ({detailData.rgps.length})
                                    </span>
                                    {detailData.rgps.length === 0 ? (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No RGP scans logged.</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {detailData.rgps.map((s, rIdx) => (
                                          <div key={rIdx} style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <strong>{s.material_name}</strong>
                                              <span style={{ fontWeight: '600' }}>Qty: {s.quantity}</span>
                                            </div>
                                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Supplier: {s.supplier_name} | By: {s.person_name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Zip POs */}
                                  <div style={{ background: 'var(--bg-secondary, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', textTransform: 'uppercase' }}>
                                      ⚡ Zip Purcharge Orders ({detailData.zips.length})
                                    </span>
                                    {detailData.zips.length === 0 ? (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Zip Purcharge Orders generated.</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {detailData.zips.map((z, zIdx) => (
                                          <div key={zIdx} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                            <span>Style: <strong>{z.Style}</strong> (Sup: {z.Supervisor})</span>
                                            <span style={{ fontWeight: '700', color: '#10b981' }}>{currencySymbol} {z.Total_Cost.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Doori POs */}
                                  <div style={{ background: 'var(--bg-secondary, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', textTransform: 'uppercase' }}>
                                      🧵 Doori POs ({detailData.dooris.length})
                                    </span>
                                    {detailData.dooris.length === 0 ? (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Doori POs generated.</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {detailData.dooris.map((d, dIdx) => (
                                          <div key={dIdx} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                            <span>Style: <strong>{d.Style}</strong> (Sup: {d.Supervisor})</span>
                                            <span style={{ fontWeight: '700', color: '#10b981' }}>{currencySymbol} {d.Total_Cost.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                </div>
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
          </div>
        </div>
      )}

      {/* Store Audits View */}
      {activeReportTab === 'store_audits' && (
        <div className="panel animate-scale">
          <div style={{ display: 'block', padding: '20px 20px 0 20px' }}>
            <div style={styles.headerRow}>
              <h3 style={styles.title}>
                <Scale size={18} style={{ color: 'var(--accent-color)' }} />
                <span>Store Inventory Sourcing & Issue Audits</span>
              </h3>
              <button
                className="btn btn-secondary btn-sm print-hide"
                onClick={() => window.print()}
                style={styles.btn}
              >
                <Printer size={14} />
                <span>Print Report</span>
              </button>
            </div>
            <div style={styles.filterBar} className="print-hide">
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search details, operator..."
                  value={saSearchQuery}
                  onChange={(e) => setSaSearchQuery(e.target.value)}
                  style={styles.input}
                />
              </div>
              <select
                value={saTypeFilter}
                onChange={(e) => setSaTypeFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Events</option>
                <option value="issue">Standard Issues</option>
                <option value="extra_issue">Extra Requisitions</option>
                <option value="return">Returns</option>
                <option value="transfer">Transfers</option>
                <option value="weight">Material Weight / Add</option>
                <option value="scan">Gate & Scans</option>
              </select>
              <select
                value={saDateFilter}
                onChange={(e) => setSaDateFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <select
                value={saSort}
                onChange={(e) => setSaSort(e.target.value)}
                style={styles.select}
              >
                <option value="latest">⬇ Latest First</option>
                <option value="oldest">⬆ Oldest First</option>
              </select>
              {(saSearchQuery || saTypeFilter !== 'all' || saDateFilter !== 'all' || saSort !== 'latest') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSaSearchQuery(''); setSaTypeFilter('all'); setSaDateFilter('all'); setSaSort('latest'); }}
                  style={{ ...styles.btn, padding: '0 12px' }}
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
                  <th>Log Ref</th>
                  <th>Event Type</th>
                  <th>Operator</th>
                  <th>Action Details</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'center' }}>Workflows</th>
                </tr>
              </thead>
              <tbody>
                {filteredStoreAudits.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No store audit logs matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStoreAudits.map((s, idx) => {
                    const badgeColor = s.tag === 'issue'
                      ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }
                      : s.tag === 'extra_issue'
                      ? { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }
                      : s.tag === 'return'
                      ? { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }
                      : s.tag === 'transfer'
                      ? { backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }
                      : s.tag === 'weight'
                      ? { backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }
                      : { backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' };

                    const detailObj = getStoreLogDetails(s.id);
                    const hasDetails = !!detailObj;

                    return (
                      <React.Fragment key={s.id || idx}>
                        <tr style={{ cursor: hasDetails ? 'pointer' : 'default' }} onClick={() => hasDetails && setExpandedStoreLogId(expandedStoreLogId === s.id ? null : s.id)}>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '12px' }}>{s.id}</td>
                          <td>
                            <span className="status-badge" style={{ ...badgeColor, fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
                              {s.type}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>{s.operator}</td>
                          <td style={{ fontSize: '13px' }}>{s.details}</td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(s.date)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {hasDetails ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedStoreLogId(expandedStoreLogId === s.id ? null : s.id);
                                }}
                              >
                                {expandedStoreLogId === s.id ? 'Hide details' : 'Inspect'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Details</span>
                            )}
                          </td>
                        </tr>
                        {expandedStoreLogId === s.id && hasDetails && (
                          <tr style={{ background: 'var(--bg-primary, #f8fafc)' }}>
                            <td colSpan="6" style={{ padding: '18px', borderLeft: '4px solid var(--accent-color)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    📦 Detailed Audit Log Record — {s.type} ({s.id})
                                  </h4>
                                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                    Logged at: <strong>{formatDateTime(s.date)}</strong>
                                  </span>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                  {/* Render properties dynamically depending on the log type */}
                                  {(detailObj.type === 'IS' || detailObj.type === 'RT') && (
                                    <>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Manufacturing Lot</span>
                                        <strong>Lot #{detailObj.data.lotId}</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Issuer Person</span>
                                        <strong>{detailObj.data.personName || detailObj.data.issuedBy || 'Store Incharge'}</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Received Name (Receiver)</span>
                                        <strong style={{ color: detailObj.data.receiverName ? 'var(--accent-color)' : 'inherit' }}>
                                          {detailObj.data.receiverName || '—'}
                                        </strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Receiver Department / Line</span>
                                        <span>{detailObj.data.receiverDept || 'Cutting'}</span>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Garment Category</span>
                                        <span>{detailObj.data.category || 'N/A'}</span>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Total Quantity Issued/Returned</span>
                                        <span style={{ fontWeight: 'bold', color: detailObj.type === 'IS' ? '#3b82f6' : '#10b981' }}>
                                          {detailObj.data.volume || detailObj.data.qtyIssued || 0} units
                                        </span>
                                      </div>

                                      {/* Materials itemized list */}
                                      {Array.isArray(detailObj.data.materials) && detailObj.data.materials.length > 0 && (
                                        <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-main)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                                            📋 Itemized Material Breakdown ({detailObj.data.materials.length} items):
                                          </span>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                            <thead>
                                              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                                                <th style={{ padding: '6px 10px' }}>BOM Component</th>
                                                <th style={{ padding: '6px 10px' }}>Material Mapped</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Quantity</th>
                                                <th style={{ padding: '6px 10px' }}>UOM</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {detailObj.data.materials.map((m, mIdx) => (
                                                <tr key={mIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                  <td style={{ padding: '6px 10px', fontWeight: '600' }}>{m.bomItemName || 'Component'}</td>
                                                  <td style={{ padding: '6px 10px' }}>{m.name || m.materialName || '—'}</td>
                                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold', color: detailObj.type === 'IS' ? '#3b82f6' : '#10b981' }}>
                                                    {m.qty || m.issueQty || 0}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{m.unit || 'pcs'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {detailObj.type === 'EX' && (
                                    <>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Voucher Ref / Lot</span>
                                        <strong>{detailObj.data.voucherId} (Lot #{detailObj.data.lotId})</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Issuer Person</span>
                                        <strong>{detailObj.data.personName || 'Store Incharge'}</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Receiver Person & Dept / Line</span>
                                        <strong>{detailObj.data.receiverName || 'Tailor'} ({detailObj.data.receiverDept || 'Cutting'})</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Status</span>
                                        <span className="status-badge verified" style={{ textTransform: 'uppercase' }}>
                                          {detailObj.data.status || 'Issued'}
                                        </span>
                                      </div>

                                      {/* Extra items requisition table */}
                                      {Array.isArray(detailObj.data.items) && detailObj.data.items.length > 0 && (
                                        <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                                            ⚡ Extra Material Requisition Items ({detailObj.data.items.length} items):
                                          </span>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                            <thead>
                                              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                                                <th style={{ padding: '6px 10px' }}>Component</th>
                                                <th style={{ padding: '6px 10px' }}>Material</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Extra Qty</th>
                                                <th style={{ padding: '6px 10px' }}>UOM</th>
                                                <th style={{ padding: '6px 10px' }}>Reason / Remarks</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {detailObj.data.items.map((it, itIdx) => (
                                                <tr key={itIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                  <td style={{ padding: '6px 10px', fontWeight: '600' }}>{it.bomItemName || 'Component'}</td>
                                                  <td style={{ padding: '6px 10px' }}>{it.materialName || '—'}</td>
                                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                                                    +{it.totalRequired || it.qty || 0}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{it.unit || 'pcs'}</td>
                                                  <td style={{ padding: '6px 10px', fontSize: '11.5px', color: 'var(--text-main)' }}>
                                                    {it.reason || 'Extra requisition'}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {detailObj.type === 'TR' && (
                                    <>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Material Description</span>
                                        <strong>{detailObj.data.materialName} ({detailObj.data.materialCode || 'Trims'})</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Source Location</span>
                                        <span>{detailObj.data.fromLocation || 'Store Bin'}</span>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Destination Location</span>
                                        <span>{detailObj.data.toLocation}</span>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Transfer quantity</span>
                                        <strong style={{ color: 'var(--accent-color)' }}>{detailObj.data.qty || detailObj.data.quantity} units</strong>
                                      </div>
                                    </>
                                  )}

                                  {detailObj.type === 'WC' && (
                                    <>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Associated Lot</span>
                                        <strong>Lot #{detailObj.data.lotNo}</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Material Name & Code</span>
                                        <strong>{detailObj.data.materialName} ({detailObj.data.materialCode || '—'})</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Net Weight / Gross</span>
                                        <strong style={{ color: '#8b5cf6' }}>{Number(detailObj.data.netWeightKg || detailObj.data.weight || 0).toFixed(3)} kg</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Total pieces / Packets</span>
                                        <span>{detailObj.data.pieces || 0} pcs / {detailObj.data.packets || 0} pkts</span>
                                      </div>
                                    </>
                                  )}

                                  {detailObj.type === 'SC' && (
                                    <>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Scan Type & Lot</span>
                                        <strong>{detailObj.data.scan_type} (Lot #{detailObj.data.lot_number})</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Supplier / Vendor</span>
                                        <strong>{detailObj.data.supplier_name || '—'}</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Material / Qty</span>
                                        <strong>{detailObj.data.material_name} ({detailObj.data.quantity} pcs)</strong>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Scanner Operator</span>
                                        <span>{detailObj.data.person_name || 'Staff'}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
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
          </div>
        </div>
      )}

      {/* PO Sourcing Tracking View */}
      {activeReportTab === 'po_tracking' && (
        <div className="panel animate-scale">
          <div style={{ display: 'block', padding: '20px 20px 0 20px' }}>
            <div style={styles.headerRow}>
              <h3 style={styles.title}>
                <Truck size={18} style={{ color: 'var(--accent-color)' }} />
                <span>PO & Sourcing Receipt Lifecycle Tracking</span>
              </h3>
              <button
                className="btn btn-secondary btn-sm print-hide"
                onClick={() => window.print()}
                style={styles.btn}
              >
                <Printer size={14} />
                <span>Print Report</span>
              </button>
            </div>
            
            <div style={styles.filterBar} className="print-hide">
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search PO, Lot, Supplier, Gate..."
                  value={ptSearchQuery}
                  onChange={(e) => setPtSearchQuery(e.target.value)}
                  style={styles.input}
                />
              </div>
              <select
                value={ptTypeFilter}
                onChange={(e) => setPtTypeFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All PO Types</option>
                <option value="normal">Normal PO</option>
                <option value="zip">Zip Purcharge Orders</option>
                <option value="doori">Doori PO</option>
                <option value="rgp">Returnable Gate Pass</option>
              </select>
              <select
                value={ptStatusFilter}
                onChange={(e) => setPtStatusFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Statuses</option>
                <option value="fully">Fully Received</option>
                <option value="partially">Partially Received</option>
                <option value="gate_entered">Gate Entered</option>
                <option value="pending">Pending</option>
              </select>
              <select
                value={ptMaterialFilter}
                onChange={(e) => setPtMaterialFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">🧵 All Materials</option>
                {uniquePtMaterials.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={ptDateFilter}
                onChange={(e) => setPtDateFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <select
                value={ptSort}
                onChange={(e) => setPtSort(e.target.value)}
                style={styles.select}
              >
                <option value="latest">⬇ Latest First</option>
                <option value="oldest">⬆ Oldest First</option>
              </select>
              {(ptSearchQuery || ptTypeFilter !== 'all' || ptStatusFilter !== 'all' || ptMaterialFilter !== 'all' || ptDateFilter !== 'all' || ptSort !== 'latest') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setPtSearchQuery(''); setPtTypeFilter('all'); setPtStatusFilter('all'); setPtMaterialFilter('all'); setPtDateFilter('all'); setPtSort('latest'); }}
                  style={{ ...styles.btn, padding: '0 12px' }}
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
                  <th>PO Reference</th>
                  <th>PO Type</th>
                  <th>Design Lot</th>
                  <th>Supplier / Vendor</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th style={{ textAlign: 'right' }}>Received</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th style={{ textAlign: 'center' }}>Sourcing Status</th>
                  <th style={{ textAlign: 'center' }}>Workflows</th>
                </tr>
              </thead>
              <tbody>
                {filteredPtList.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No PO sourcing records matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPtList.map((item, idx) => {
                    const balance = Math.max(0, item.requestedQty - item.receivedQty);
                    
                    // Determine Status
                    let statusLabel = 'Pending';
                    let badgeColor = { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' };
                    
                    if (item.receivedQty >= item.requestedQty && item.requestedQty > 0) {
                      statusLabel = 'Fully Received';
                      badgeColor = { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' };
                    } else if (item.receivedQty > 0 && item.receivedQty < item.requestedQty) {
                      statusLabel = 'Partially Received';
                      badgeColor = { backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' };
                    } else if (item.gatePerson && item.gatePerson !== '—') {
                      statusLabel = 'Gate Entered';
                      badgeColor = { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' };
                    }

                    // Grab all scans related to this lot/PO to show detailed scanner history
                    const lotStr = String(item.lotId).toLowerCase().trim();
                    const relatedScans = (scans || []).filter(s => 
                      String(s.lot_number).toLowerCase().trim() === lotStr ||
                      String(s.lot_number).toLowerCase().trim() === String(item.id).toLowerCase().trim()
                    );

                    return (
                      <React.Fragment key={item.id || idx}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedPtId(expandedPtId === item.id ? null : item.id)}>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>{item.id}</td>
                          <td>
                            <span className="status-badge" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '11px', fontWeight: '600' }}>
                              {item.type}
                            </span>
                          </td>
                          <td>
                            <span className="status-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontSize: '11px', fontWeight: 'bold' }}>
                              Lot #{item.lotId}
                            </span>
                          </td>
                          <td style={{ fontWeight: '500' }}>{item.supplier}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{item.requestedQty} pcs</td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: '#10b981' }}>{item.receivedQty} pcs</td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: balance > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                            {balance} pcs
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="status-badge" style={{ ...badgeColor, fontWeight: 'bold', fontSize: '10px' }}>
                              {statusLabel}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPtId(expandedPtId === item.id ? null : item.id);
                              }}
                            >
                              {expandedPtId === item.id ? 'Hide' : 'Scanner Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedPtId === item.id && (
                          <tr style={{ background: 'var(--bg-primary, #f8fafc)' }}>
                            <td colSpan="9" style={{ padding: '20px', borderLeft: '4px solid var(--accent-color)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#333', textTransform: 'uppercase', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                                      🛡️ Security Gate Check-in
                                    </h4>
                                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div><span style={{ color: '#666' }}>Officer:</span> <strong>{item.gatePerson}</strong></div>
                                      <div><span style={{ color: '#666' }}>Checked In:</span> <strong>{item.gateDate}</strong></div>
                                      <div><span style={{ color: '#666' }}>Security Clear:</span> <strong style={{ color: '#10b981' }}>PASSED</strong></div>
                                    </div>
                                  </div>

                                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#333', textTransform: 'uppercase', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                                      📦 Warehouse Store Receipt
                                    </h4>
                                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div><span style={{ color: '#666' }}>Store Operator:</span> <strong>{item.receiver}</strong></div>
                                      <div><span style={{ color: '#666' }}>Checked In:</span> <strong>{item.receivedDate}</strong></div>
                                      <div>
                                        <span style={{ color: '#666' }}>Status: </span>
                                        <strong style={{ color: item.receivedQty >= item.requestedQty ? '#10b981' : '#f59e0b' }}>
                                          {item.receivedQty} / {item.requestedQty} Verified
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                                    📊 Real-time Handheld Scanner History Logs
                                  </h4>
                                  {relatedScans.length === 0 ? (
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      No scans recorded for this lot yet.
                                    </p>
                                  ) : (
                                    <div className="custom-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                      <table className="custom-table" style={{ margin: 0, fontSize: '11px' }}>
                                        <thead>
                                          <tr>
                                            <th>Scanner Action</th>
                                            <th>Scanned By</th>
                                            <th style={{ textAlign: 'right' }}>Scanned Qty</th>
                                            <th>Timestamp</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {relatedScans.map((scan, sIdx) => {
                                            const scanBadge = scan.scan_type === 'gate_entry'
                                              ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', label: 'Gate Entry Check' }
                                              : scan.scan_type === 'material_in'
                                              ? { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', label: 'Store Material In' }
                                              : scan.scan_type === 'printing_gate_out'
                                              ? { backgroundColor: 'rgba(249, 115, 22, 0.12)', color: '#f97316', label: 'Printing Gate Out' }
                                              : scan.scan_type === 'rgp_entry'
                                              ? { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'RGP Dispatch' }
                                              : { backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', label: 'RGP Return In' };

                                            return (
                                              <tr key={scan.id || sIdx}>
                                                <td>
                                                  <span className="status-badge" style={{ ...scanBadge, padding: '2px 6px', fontWeight: 'bold' }}>
                                                    {scanBadge.label}
                                                  </span>
                                                </td>
                                                <td style={{ fontWeight: '600' }}>{scan.person_name}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{scan.quantity} pcs</td>
                                                <td>
                                                  {new Date(scan.scanned_at || scan.timestamp).toLocaleDateString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                  })}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
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
          </div>
        </div>
      )}

      {/* Selected PO Detail Modal */}
      {selectedPo && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-lg animate-scale">
            <div className="modal-header">
              <h3 className="modal-title">Receipt Review: {selectedPo.poNumber}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPo(null)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', backgroundColor: '#ffffff', color: '#333333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0b2240', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ color: '#0b2240', margin: 0, fontFamily: 'var(--font-family-title)', fontWeight: '800' }}>G-PDMS</h2>
                    <span style={{ fontSize: '9px', color: '#666' }}>Apparel Park Industrial Zone</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#0b2240', fontWeight: 'bold' }}>PURCHASE ORDER</h3>
                    <span style={{ fontSize: '10px', display: 'block' }}>PO #: {selectedPo.poNumber}</span>
                    <span style={{ fontSize: '10px', display: 'block' }}>Date: {selectedPo.date}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '10px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#0b2240', display: 'block', textTransform: 'uppercase', fontSize: '9px' }}>Supplier</span>
                    <strong>{selectedPo.vendorName}</strong>
                    <span style={{ display: 'block' }}>{selectedPo.vendorEmail}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#0b2240', display: 'block', textTransform: 'uppercase', fontSize: '9px' }}>Ship To</span>
                    <strong>G-PDMS Hub</strong>
                    <span style={{ display: 'block' }}>Apparel Warehouse, Unit 4</span>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0b2240', color: '#ffffff' }}>
                      <th style={{ padding: '4px 6px', textAlign: 'left' }}>Item Description</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Unit Cost</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPo.items.map((it, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '4px 6px' }}>
                          <div style={{ fontWeight: '600' }}>{it.name}</div>
                          {it.description && (
                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{it.description}</div>
                          )}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{it.qty} {it.unit}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>{Number(it.price).toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{(it.qty * it.price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', fontSize: '10px' }}>
                  <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{currencySymbol} {selectedPo.subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tax ({selectedPo.taxRate}%):</span>
                      <span>{currencySymbol} {selectedPo.tax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: '3px', fontWeight: 'bold' }}>
                      <span>Grand Total:</span>
                      <span>{currencySymbol} {selectedPo.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                <PDFDownloadLink 
                  document={<PDFDocument po={selectedPo} currencySymbol={currencySymbol} />} 
                  fileName={`PO_${selectedPo.poNumber}.pdf`}
                  className="btn btn-primary"
                  style={{ width: '100%', textDecoration: 'none' }}
                >
                  {({ loading }) => (
                    loading ? 'Compiling PDF...' : <><Download size={16} /> Download PDF</>
                  )}
                </PDFDownloadLink>
                 <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    document.body.classList.add('print-po-mode');
                    window.print();
                    document.body.classList.remove('print-po-mode');
                  }}
                >
                  <Printer size={16} /> Print Receipt
                </button>
                <button className="btn btn-danger" onClick={() => setSelectedPo(null)}>
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable PO Container (Original & Duplicate Copies) */}
      {selectedPo && (
        <div className="po-print-container print-only-element">
          {/* Original Copy */}
          <div className="po-print-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '800' }}>G-PDMS</h2>
                <span style={{ fontSize: '10px', color: '#666' }}>Apparel Park Manufacturing Hub</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>PURCHASE ORDER</h3>
                <span style={{ fontSize: '11px', display: 'block', fontWeight: 'bold' }}>ORIGINAL COPY</span>
                <span style={{ fontSize: '11px', display: 'block' }}>PO #: {selectedPo.poNumber}</span>
                <span style={{ fontSize: '11px', display: 'block' }}>Date: {selectedPo.date}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '11px' }}>
              <div>
                <span style={{ fontWeight: 'bold', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}>Vendor</span>
                <strong style={{ fontSize: '12px', display: 'block' }}>{selectedPo.vendorName}</strong>
                <span>{selectedPo.vendorEmail}</span>
                <span style={{ display: 'block', color: '#666' }}>{selectedPo.vendorAddress}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 'bold', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}>Ship To</span>
                <strong style={{ fontSize: '12px', display: 'block' }}>G-PDMS Warehouse</strong>
                <span>Mumbai, India</span>
                <span style={{ display: 'block', color: '#666' }}>Attn: Production Hub</span>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Item Description</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Detail/Description</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Total ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {selectedPo.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '6px', fontWeight: '600' }}>{it.name}</td>
                    <td style={{ padding: '6px', color: '#555' }}>{it.description || '—'}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{it.qty} {it.unit}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{Number(it.price).toFixed(2)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{(it.qty * it.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px' }}>
              <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{currencySymbol} {selectedPo.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax ({selectedPo.taxRate}%):</span>
                  <span>{currencySymbol} {selectedPo.tax.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '4px', fontWeight: 'bold' }}>
                  <span>Grand Total:</span>
                  <span>{currencySymbol} {selectedPo.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Page Break */}
          <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: '1px' }}></div>

          {/* Duplicate Copy */}
          <div className="po-print-sheet" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '800' }}>G-PDMS</h2>
                <span style={{ fontSize: '10px', color: '#666' }}>Apparel Park Manufacturing Hub</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>PURCHASE ORDER</h3>
                <span style={{ fontSize: '11px', display: 'block', fontWeight: 'bold' }}>DUPLICATE COPY</span>
                <span style={{ fontSize: '11px', display: 'block' }}>PO #: {selectedPo.poNumber}</span>
                <span style={{ fontSize: '11px', display: 'block' }}>Date: {selectedPo.date}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '11px' }}>
              <div>
                <span style={{ fontWeight: 'bold', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}>Vendor</span>
                <strong style={{ fontSize: '12px', display: 'block' }}>{selectedPo.vendorName}</strong>
                <span>{selectedPo.vendorEmail}</span>
                <span style={{ display: 'block', color: '#666' }}>{selectedPo.vendorAddress}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 'bold', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}>Ship To</span>
                <strong style={{ fontSize: '12px', display: 'block' }}>G-PDMS Warehouse</strong>
                <span>Mumbai, India</span>
                <span style={{ display: 'block', color: '#666' }}>Attn: Production Hub</span>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Item Description</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Detail/Description</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Total ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {selectedPo.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '6px', fontWeight: '600' }}>{it.name}</td>
                    <td style={{ padding: '6px', color: '#555' }}>{it.description || '—'}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{it.qty} {it.unit}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>0.00</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>0.00</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px' }}>
              <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{currencySymbol} 0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax ({selectedPo.taxRate}%):</span>
                  <span>{currencySymbol} 0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '4px', fontWeight: 'bold' }}>
                  <span>Grand Total:</span>
                  <span>{currencySymbol} 0.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. UNDESIGNED CUTTING LOTS REPORT ── */}
      {activeReportTab === 'undesigned_lots' && (
        <div className="animate-scale">
          {/* Header Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--accent-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Lots Pending Design</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>
                {undesignedLots.length}
              </h3>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Total Cutting Pieces</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                {undesignedLots.reduce((sum, l) => sum + (parseInt(l.Cutting_Qty) || 0), 0).toLocaleString()}
              </h3>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Unique Fabrics</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#f59e0b' }}>
                {new Set(undesignedLots.map(l => (l.Fabric || '').trim()).filter(Boolean)).size}
              </h3>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="panel print-hide" style={{ marginBottom: '20px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', flex: '1 1 520px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search Lot Number, Style, Fabric, Party..."
                    style={{ paddingLeft: '34px', width: '100%', height: '36px', fontSize: '13px' }}
                    value={undesignedSearch}
                    onChange={(e) => setUndesignedSearch(e.target.value)}
                  />
                </div>
                <select
                  className="form-input"
                  style={{ height: '36px', width: '180px', fontSize: '12.5px', flexShrink: 0 }}
                  value={undesignedFabricFilter}
                  onChange={(e) => setUndesignedFabricFilter(e.target.value)}
                >
                  <option value="all">All Fabrics</option>
                  {Array.from(new Set(undesignedLots.map(l => (l.Fabric || '').trim()).filter(Boolean))).slice(0, 50).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  className="form-input"
                  style={{ height: '36px', width: '150px', fontSize: '12.5px', flexShrink: 0 }}
                  value={undesignedSort}
                  onChange={(e) => setUndesignedSort(e.target.value)}
                >
                  <option value="latest">Latest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="qty_desc">Highest Qty</option>
                  <option value="qty_asc">Lowest Qty</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', fontSize: '12px', padding: '0 12px' }}
                  onClick={() => {
                    setLoadingUndesigned(true);
                    fetch(`${getBackendUrl()}/api/reports/undesigned-cutting-lots`)
                      .then(res => res.ok ? res.json() : [])
                      .then(data => setUndesignedLots(data))
                      .finally(() => setLoadingUndesigned(false));
                  }}
                >
                  <RefreshCw size={13} className={loadingUndesigned ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', fontSize: '12px', padding: '0 12px' }}
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," + 
                      ["Lot Number,Fabric,Garment Type,Style,Shades,Sizes,Cutting Qty,Date,Supervisor"]
                      .concat(undesignedLots.map(l => 
                        `"${l.Lot_Number}","${l.Fabric || ''}","${l.Garment_Type || ''}","${l.Style || ''}","${(l.Shades || '').replace(/"/g, '""')}","${l.Sizes || ''}","${l.Cutting_Qty || 0}","${l.Date_of_Issue || ''}","${l.Supervisor || ''}"`
                      )).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `undesigned_cutting_lots_${new Date().toISOString().slice(0,10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Undesigned Lots Table */}
          <div className="panel" style={{ overflowX: 'auto', padding: 0 }}>
            {loadingUndesigned ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                <p>Loading undesigned cutting lots...</p>
              </div>
            ) : (
              (() => {
                const filtered = undesignedLots.filter(l => {
                  const q = undesignedSearch.toLowerCase().trim();
                  const matchesSearch = !q || 
                    String(l.Lot_Number || '').toLowerCase().includes(q) ||
                    String(l.Fabric || '').toLowerCase().includes(q) ||
                    String(l.Style || '').toLowerCase().includes(q) ||
                    String(l.Party_Name || '').toLowerCase().includes(q) ||
                    String(l.Garment_Type || '').toLowerCase().includes(q);

                  const matchesFabric = undesignedFabricFilter === 'all' || 
                    String(l.Fabric || '').toLowerCase().trim() === undesignedFabricFilter.toLowerCase().trim();

                  return matchesSearch && matchesFabric;
                }).sort((a, b) => {
                  if (undesignedSort === 'latest') return Number(b.id) - Number(a.id);
                  if (undesignedSort === 'oldest') return Number(a.id) - Number(b.id);
                  if (undesignedSort === 'qty_desc') return (Number(b.Cutting_Qty) || 0) - (Number(a.Cutting_Qty) || 0);
                  if (undesignedSort === 'qty_asc') return (Number(a.Cutting_Qty) || 0) - (Number(b.Cutting_Qty) || 0);
                  return 0;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <AlertCircle size={28} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                      <p>No undesigned cutting lots match your search or filter.</p>
                    </div>
                  );
                }

                return (
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '700' }}>Lot Number</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700' }}>Fabric & Garment Type</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700' }}>Style</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700' }}>Colors / Shades</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700' }}>Sizes</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Cutting Qty</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700' }}>Issue Date</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Direct Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((lot, idx) => (
                        <tr 
                          key={lot.id || idx} 
                          style={{ 
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background-color 0.15s'
                          }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ 
                              display: 'inline-block',
                              padding: '3px 8px', 
                              backgroundColor: 'rgba(99, 102, 241, 0.12)', 
                              color: 'var(--accent-color)', 
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '13px'
                            }}>
                              #{lot.Lot_Number}
                            </span>
                            {lot.Brand && (
                              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                {lot.Brand}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <strong style={{ color: 'var(--text-main)' }}>{lot.Fabric || '—'}</strong>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {lot.Garment_Type || 'Garment'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', maxWidth: '200px' }}>
                            <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{lot.Style || '—'}</span>
                            {lot.Party_Name && (
                              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                                Party: {lot.Party_Name}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', maxWidth: '220px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-main)', wordBreak: 'break-word' }}>
                              {lot.Shades || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {lot.Sizes || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontWeight: '700', color: 'var(--success)', fontSize: '14px' }}>
                              {lot.Cutting_Qty ? Number(lot.Cutting_Qty).toLocaleString() : '0'}
                            </span>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>pcs</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                              {lot.Date_of_Issue || '—'}
                            </span>
                            {lot.Supervisor && (
                              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                                By: {lot.Supervisor}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <a
                                href={`/design?lot=${encodeURIComponent(lot.Lot_Number)}`}
                                className="btn btn-primary"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  borderRadius: '5px'
                                }}
                              >
                                <ExternalLink size={11} />
                                <span>Create Design</span>
                              </a>
                              <a
                                href={`/zip-po?lot=${encodeURIComponent(lot.Lot_Number)}`}
                                className="btn btn-secondary"
                                style={{
                                  padding: '5px 8px',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  borderRadius: '5px'
                                }}
                              >
                                Zip PO
                              </a>
                              <a
                                href={`/dori-po?lot=${encodeURIComponent(lot.Lot_Number)}`}
                                className="btn btn-secondary"
                                style={{
                                  padding: '5px 8px',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  borderRadius: '5px'
                                }}
                              >
                                Dori PO
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

