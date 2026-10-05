import React, { useState, useEffect, useMemo } from 'react';
import { getBackendUrl } from '../utils/api';
import { 
  TrendingUp, FileText, Calendar, DollarSign, Download, Printer, ClipboardList, 
  Search, Scale, ArrowLeftRight, Settings, Users, ShieldAlert, Truck, Layers,
  Scissors, AlertCircle, AlertTriangle, ExternalLink, RefreshCw, BarChart3, Activity, 
  PackageCheck, RotateCcw, ArrowRightLeft, Gauge, Package,
  QrCode, ShieldCheck, CheckCircle, Check, Copy, X, ChevronDown, ChevronUp, Boxes, FileSpreadsheet, Eye, ArrowUpRight, Clock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PDFDocument } from './PDFDocument';
import DailyWeeklyCalendarReport from './DailyWeeklyCalendarReport';
import ItemCodeReportView from './ItemCodeReportView';

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
  const [activeReportTab, setActiveReportTab] = useState('master_operations_report'); // 'master_operations_report', 'daily_weekly_calendar', 'rgp_reports', 'material_ledger', 'designer_audits', 'store_audits'
  const [selectedLotId, setSelectedLotId] = useState('');
  
  // Master Operations & Logistics (RGP, Dori, Zip, PO, Extra Pieces, Scanner) states
  const [masterModuleFilter, setMasterModuleFilter] = useState('all'); // 'all', 'rgp', 'rgp_closed', 'rgp_intransit', 'rgp_overdue', 'dori_po', 'zip_po', 'po', 'extra_pieces', 'scanner'
  const [masterDeptFilter, setMasterDeptFilter] = useState('all');
  const [masterStatusFilter, setMasterStatusFilter] = useState('all');
  const [masterSearch, setMasterSearch] = useState('');
  const [masterDateFrom, setMasterDateFrom] = useState('');
  const [masterDateTo, setMasterDateTo] = useState('');
  const [masterSort, setMasterSort] = useState('latest');
  const [selectedMasterRecordForModal, setSelectedMasterRecordForModal] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);

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

  // RGP Pass Register states
  const [rgpList, setRgpList] = useState([]);
  const [rgpLoading, setRgpLoading] = useState(false);
  const [rgpSearch, setRgpSearch] = useState('');
  const [rgpStatusFilter, setRgpStatusFilter] = useState('all');
  const [rgpTypeFilter, setRgpTypeFilter] = useState('all');
  const [rgpScanFilter, setRgpScanFilter] = useState('all');
  const [rgpDateFilter, setRgpDateFilter] = useState('all');
  const [rgpSort, setRgpSort] = useState('latest');
  const [selectedRgpForModal, setSelectedRgpForModal] = useState(null);
  const [expandedRgpIds, setExpandedRgpIds] = useState(new Set());
  const [rgpViewMode, setRgpViewMode] = useState('table');

  // Consolidated Lot-Wise Operations Report states
  const [lotWiseList, setLotWiseList] = useState([]);
  const [lotWiseLoading, setLotWiseLoading] = useState(false);
  const [lotSearch, setLotSearch] = useState('');
  const [lotStatusFilter, setLotStatusFilter] = useState('all');
  const [lotBrandFilter, setLotBrandFilter] = useState('all');
  const [lotSort, setLotSort] = useState('lot_desc');
  const [selectedLotForModal, setSelectedLotForModal] = useState(null);
  const [expandedLotIds, setExpandedLotIds] = useState(new Set());

  // Fetch lot-wise consolidated summary from backend
  const fetchLotWiseData = async () => {
    setLotWiseLoading(true);
    const backendUrl = getBackendUrl();
    try {
      const res = await fetch(`${backendUrl}/api/reports/lot-wise-summary`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setLotWiseList(json.data);
        }
      }
    } catch (err) {
      console.error('Error fetching lot-wise summary:', err);
    } finally {
      setLotWiseLoading(false);
    }
  };

  // Auto-select first design lot if available
  useEffect(() => {
    if (!selectedLotId && designs.length > 0) {
      setSelectedLotId(designs[0].id);
    }
  }, [designs, selectedLotId]);

  // Comprehensive fetch function for all datasets
  const fetchAllMasterData = async () => {
    setMasterLoading(true);
    const backendUrl = getBackendUrl();
    try {
      const [issueRes, extraRes, designHRes, zipRes, dooriRes, scansRes, transferRes, weightRes, rgpRes] = await Promise.all([
        fetch(`${backendUrl}/api/issue-logs`),
        fetch(`${backendUrl}/api/extra-material-issues`),
        fetch(`${backendUrl}/api/design-history`),
        fetch(`${backendUrl}/api/zip-orders`),
        fetch(`${backendUrl}/api/doori-orders`),
        fetch(`${backendUrl}/api/scans`),
        fetch(`${backendUrl}/api/transfers`),
        fetch(`${backendUrl}/api/weight-capture`),
        fetch(`${backendUrl}/api/rgp`)
      ]);

      if (issueRes.ok) setFetchedIssueLogs(await issueRes.json());
      if (extraRes.ok) setExtraMaterialIssues(await extraRes.json());
      if (designHRes.ok) setDesignHistory(await designHRes.json());
      if (zipRes.ok) setZipOrders(await zipRes.json());
      if (dooriRes.ok) setDooriOrders(await dooriRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
      if (transferRes.ok) setTransfers(await transferRes.json());
      if (weightRes.ok) {
        const wData = await weightRes.json();
        setWeightCaptures(wData.success && Array.isArray(wData.data) ? wData.data : (Array.isArray(wData) ? wData : []));
      }
      if (rgpRes.ok) {
        const rData = await rgpRes.json();
        setRgpList(Array.isArray(rData) ? rData : []);
      }
      fetchLotWiseData();
    } catch (err) {
      console.error('Error fetching master data:', err);
    } finally {
      setMasterLoading(false);
    }
  };

  // Load audit data on mount and tab changes
  useEffect(() => {
    const backendUrl = getBackendUrl();

    fetchLotWiseData();

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

    // Fetch RGPs
    fetch(`${backendUrl}/api/rgp`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setRgpList(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching RGPs:', err));

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
        details: `${t.qty || t.quantity || 0} units of ${t.materialName || t.itemCode || t.materialCode || 'trims'} transferred from ${t.fromLocation || 'Store'} to ${t.toLocation}`,
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

  // Refresh RGP data
  const fetchRgpData = async () => {
    setRgpLoading(true);
    const backendUrl = getBackendUrl();
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`${backendUrl}/api/rgp`),
        fetch(`${backendUrl}/api/scans`)
      ]);
      if (rRes.ok) {
        const rData = await rRes.json();
        setRgpList(Array.isArray(rData) ? rData : []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setScans(Array.isArray(sData) ? sData : []);
      }
    } catch (e) {
      console.error('Error refreshing RGP data:', e);
    } finally {
      setRgpLoading(false);
    }
  };

  // Toggle RGP row expansion
  const toggleRgpExpand = (id) => {
    setExpandedRgpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Processed RGP list with full calculations
  const processedRgpList = useMemo(() => {
    return (rgpList || []).map(rgp => {
      const rgpNoClean = String(rgp.rgpNo || '').trim();
      const rgpNoLower = rgpNoClean.toLowerCase();
      
      const entries = Array.isArray(rgp.entries) ? rgp.entries : [];
      const totalQty1 = entries.reduce((sum, e) => sum + (Number(e.qty1) || 0), 0) || Number(rgp.qty) || 0;
      const totalQty2 = entries.reduce((sum, e) => sum + (Number(e.qty2) || 0), 0);
      const uniqueLots = Array.from(new Set(entries.map(e => e.lotNo).filter(Boolean)));
      
      // Match scans from scans table
      const matchingScans = (scans || []).filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        if (sLot === rgpNoLower) return true;
        if (s.rgp_payload) {
          try {
            const p = typeof s.rgp_payload === 'string' ? JSON.parse(s.rgp_payload) : s.rgp_payload;
            if (p && String(p.rgpNo || '').toLowerCase() === rgpNoLower) return true;
          } catch (_) {}
        }
        return false;
      });

      // Find Gate Out / Issue scan
      const gateOutScan = matchingScans.find(s => s.scan_type === 'rgp_entry' || s.scan_type === 'gate_entry');
      // Find Gate In / Return scan
      const gateInScan = matchingScans.find(s => s.scan_type === 'rgp_return');

      // Check dates and status
      const issueDateObj = parseToDateObject(rgp.date);
      const expDateObj = parseToDateObject(rgp.expectedReturnDate);
      const isReturned = !!gateInScan || rgp.status === 'Returned';
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const isExpPast = expDateObj.getTime() > 0 && expDateObj < now;
      const isOverdue = !isReturned && isExpPast;
      
      let daysOverdue = 0;
      if (isOverdue && expDateObj.getTime() > 0) {
        daysOverdue = Math.ceil((now - expDateObj) / (1000 * 60 * 60 * 24));
      }

      let status = 'In Transit';
      if (isReturned) status = 'Returned';
      else if (isOverdue) status = 'Overdue';

      return {
        ...rgp,
        entries,
        totalQty1,
        totalQty2,
        uniqueLots,
        matchingScans,
        gateOutScan,
        gateInScan,
        isReturned,
        isOverdue,
        daysOverdue,
        status,
        issueDateObj,
        expDateObj
      };
    });
  }, [rgpList, scans]);

  // Filtered RGP list
  const filteredRgpList = useMemo(() => {
    let list = processedRgpList.filter(item => {
      // 1. Text Search
      const q = rgpSearch.toLowerCase().trim();
      if (q) {
        const matchNo = String(item.rgpNo || '').toLowerCase().includes(q);
        const matchVendor = String(item.vendor || '').toLowerCase().includes(q);
        const matchDept = String(item.department || '').toLowerCase().includes(q);
        const matchPurpose = String(item.purpose || '').toLowerCase().includes(q);
        const matchVehicle = String(item.vehicleNo || '').toLowerCase().includes(q);
        const matchPrepared = String(item.preparedBy || '').toLowerCase().includes(q);
        const matchAuth = String(item.authorizedBy || '').toLowerCase().includes(q);
        const matchType = String(item.rgpType || '').toLowerCase().includes(q);
        const matchItem = item.entries.some(e => 
          String(e.itemDesc || '').toLowerCase().includes(q) || 
          String(e.lotNo || '').toLowerCase().includes(q) ||
          String(e.purpose || '').toLowerCase().includes(q)
        );
        if (!matchNo && !matchVendor && !matchDept && !matchPurpose && !matchVehicle && !matchPrepared && !matchAuth && !matchType && !matchItem) {
          return false;
        }
      }

      // 2. Status Filter
      if (rgpStatusFilter === 'open' && (item.isReturned || item.isOverdue)) return false;
      if (rgpStatusFilter === 'returned' && !item.isReturned) return false;
      if (rgpStatusFilter === 'overdue' && !item.isOverdue) return false;

      // 3. Type Filter
      if (rgpTypeFilter !== 'all' && String(item.rgpType || '').toLowerCase() !== rgpTypeFilter.toLowerCase()) {
        return false;
      }

      // 4. Scanner Filter
      if (rgpScanFilter === 'scanned_out' && !item.gateOutScan) return false;
      if (rgpScanFilter === 'scanned_in' && !item.gateInScan) return false;
      if (rgpScanFilter === 'not_scanned' && (item.gateOutScan || item.gateInScan)) return false;

      // 5. Date Filter
      if (!applyDateFilter(item.date, rgpDateFilter)) return false;

      return true;
    });

    // Sort
    list.sort((a, b) => {
      if (rgpSort === 'latest') {
        return b.issueDateObj.getTime() - a.issueDateObj.getTime();
      } else if (rgpSort === 'oldest') {
        return a.issueDateObj.getTime() - b.issueDateObj.getTime();
      } else if (rgpSort === 'exp_return') {
        return a.expDateObj.getTime() - b.expDateObj.getTime();
      } else if (rgpSort === 'rgp_no') {
        return String(b.rgpNo || '').localeCompare(String(a.rgpNo || ''));
      }
      return 0;
    });

    return list;
  }, [processedRgpList, rgpSearch, rgpStatusFilter, rgpTypeFilter, rgpScanFilter, rgpDateFilter, rgpSort]);

  // Summary Metrics KPI for RGPs
  const rgpStats = useMemo(() => {
    const total = processedRgpList.length;
    const returned = processedRgpList.filter(r => r.isReturned).length;
    const overdue = processedRgpList.filter(r => r.isOverdue).length;
    const inTransit = processedRgpList.filter(r => !r.isReturned && !r.isOverdue).length;
    const totalDispatchedQty = processedRgpList.reduce((sum, r) => sum + r.totalQty1, 0);
    const scannedAtGate = processedRgpList.filter(r => r.gateOutScan || r.gateInScan).length;
    const scanRate = total > 0 ? Math.round((scannedAtGate / total) * 100) : 0;
    
    // Type counts
    const typeCounts = {};
    processedRgpList.forEach(r => {
      const t = r.rgpType || 'Other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    return { total, returned, overdue, inTransit, totalDispatchedQty, scannedAtGate, scanRate, typeCounts };
  }, [processedRgpList]);

  // Date Range Checker Helper
  const isDateInRange = (dateVal, fromDateStr, toDateStr) => {
    if (!fromDateStr && !toDateStr) return true;
    const d = parseToDateObject(dateVal);
    if (d.getTime() === 0) return true;
    
    if (fromDateStr) {
      const fromDate = new Date(fromDateStr);
      fromDate.setHours(0, 0, 0, 0);
      if (d < fromDate) return false;
    }
    if (toDateStr) {
      const toDate = new Date(toDateStr);
      toDate.setHours(23, 59, 59, 999);
      if (d > toDate) return false;
    }
    return true;
  };

  // Quick Date Preset Handler
  const handleApplyDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      const dStr = now.toISOString().split('T')[0];
      setMasterDateFrom(dStr);
      setMasterDateTo(dStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const dStr = y.toISOString().split('T')[0];
      setMasterDateFrom(dStr);
      setMasterDateTo(dStr);
    } else if (preset === 'this_week') {
      const w = new Date();
      w.setDate(now.getDate() - 7);
      setMasterDateFrom(w.toISOString().split('T')[0]);
      setMasterDateTo(now.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const m = new Date();
      m.setDate(now.getDate() - 30);
      setMasterDateFrom(m.toISOString().split('T')[0]);
      setMasterDateTo(now.toISOString().split('T')[0]);
    } else if (preset === 'clear') {
      setMasterDateFrom('');
      setMasterDateTo('');
    }
  };

  // Unified Master Operations Records (RGP, Dori PO, Zip PO, General PO, Extra Pieces, Scanner Logs)
  const unifiedMasterRecords = useMemo(() => {
    const list = [];

    // 1. RGP Records
    (processedRgpList || []).forEach(r => {
      const entries = Array.isArray(r.entries) ? r.entries : [];
      let itemDesc = 'Material Goods';
      if (entries.length > 1) {
        itemDesc = `See Items (${entries.length})`;
      } else if (entries.length === 1 && entries[0].itemDesc) {
        itemDesc = entries[0].itemDesc;
      } else if (r.itemDesc || r.particulars) {
        itemDesc = r.itemDesc || r.particulars;
      }

      const qty = r.totalQty1 || Number(r.qty) || 0;
      const uom = (entries[0] && entries[0].uom) || r.uom || 'PCS';
      const statusLabel = r.status || (r.isReturned ? 'Returned' : (r.isOverdue ? 'Overdue' : 'In Transit'));

      list.push({
        id: `RGP-${r.id || r.rgpNo}`,
        docNo: r.rgpNo || `RGP-${r.id}`,
        moduleType: 'rgp',
        moduleLabel: 'RGP',
        badgeColor: '#7c3aed',
        date: r.date || '',
        dateObj: r.issueDateObj || parseToDateObject(r.date),
        type: r.rgpType || 'BUTTONS / TRIMS',
        department: r.department || 'Store',
        vendor: r.vendor || '—',
        purpose: r.purpose || 'DYEING / PROCESSING',
        itemDescription: itemDesc,
        items: entries,
        quantity: qty,
        uom: uom,
        status: statusLabel,
        isReturned: r.isReturned,
        isOverdue: r.isOverdue,
        expectedReturnDate: r.expectedReturnDate || '',
        vehicleNo: r.vehicleNo || '',
        preparedBy: r.preparedBy || '',
        authorizedBy: r.authorizedBy || '',
        scans: r.matchingScans || [],
        raw: r
      });
    });

    // 2. Dori PO Records
    (dooriOrders || []).forEach(d => {
      const docNo = d.po_number || `DORI-PO-${d.id}`;
      let placements = [];
      try {
        placements = JSON.parse(d.Selected_Placements || '[]');
      } catch (_) {}

      const itemDesc = d.Style 
        ? `${d.Style} • ${d.Garment_Type || 'Garment'} (${d.Total_Pieces || 0} pcs)`
        : `Dori Thread • ${d.Total_Pieces || 0} pcs`;

      // Find matching scans for this Dori PO
      const doriScans = (scans || []).filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        const dLot = String(d.Lot_Number || '').trim().toLowerCase();
        const dPo = String(d.po_number || '').trim().toLowerCase();
        return (sLot && (sLot === dLot || sLot === dPo)) || (s.material_name && String(s.material_name).toLowerCase().includes('dori'));
      });

      let statusLabel = d.status || 'Active';
      if (doriScans.some(s => s.scan_type === 'material_in')) {
        statusLabel = 'Material Received';
      } else if (doriScans.some(s => s.scan_type === 'gate_entry')) {
        statusLabel = 'Gate Entry Verified';
      }

      list.push({
        id: `DORI-${d.id || d.po_number}`,
        docNo: docNo,
        moduleType: 'dori_po',
        moduleLabel: 'Dori PO',
        badgeColor: '#f59e0b',
        date: d.Issue_Date || d.Timestamp || '',
        dateObj: parseToDateObject(d.Issue_Date || d.Timestamp),
        type: d.Garment_Type ? `Dori (${d.Garment_Type})` : 'Dori Order',
        department: d.department || 'Store',
        vendor: d.Supplier || d.Supervisor || 'Vendor',
        purpose: d.Style ? `Dori Procurement for ${d.Style}` : 'Thread & Dori Order',
        itemDescription: itemDesc,
        items: placements.map((p) => ({ lotNo: d.Lot_Number, itemDesc: `Placement: ${p}`, qty1: d.Total_Pieces, uom: 'PCS' })),
        quantity: parseInt(d.Total_Pieces) || 0,
        uom: 'PCS',
        status: statusLabel,
        cost: d.Total_Cost || 0,
        preparedBy: d.Supervisor || 'Store',
        scans: doriScans,
        raw: d
      });
    });

    // 3. Zip PO Records
    (zipOrders || []).forEach(z => {
      const docNo = z.po_number || `ZIP-PO-${z.id}`;
      let placements = [];
      try {
        placements = JSON.parse(z.Selected_Placements || '[]');
      } catch (_) {}

      const totalPcs = parseInt(z.Total_Pieces_CH || z.Total_Pieces) || 0;
      const itemDesc = z.Style 
        ? `${z.Style} • Teeth: ${z.Teeth_Color || 'STD'} (${totalPcs} pcs)`
        : `Zipper Trims • ${totalPcs} pcs`;

      // Find matching scans for this Zip PO
      const zipScans = (scans || []).filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        const zLot = String(z.Lot_Number || '').trim().toLowerCase();
        const zPo = String(z.po_number || '').trim().toLowerCase();
        return (sLot && (sLot === zLot || sLot === zPo)) || (s.material_name && String(s.material_name).toLowerCase().includes('zip'));
      });

      let statusLabel = z.status || 'Active';
      if (zipScans.some(s => s.scan_type === 'material_in')) {
        statusLabel = 'Material Received';
      } else if (zipScans.some(s => s.scan_type === 'gate_entry')) {
        statusLabel = 'Gate Entry Verified';
      }

      list.push({
        id: `ZIP-${z.id || z.po_number}`,
        docNo: docNo,
        moduleType: 'zip_po',
        moduleLabel: 'Zip PO',
        badgeColor: '#ec4899',
        date: z.Saved_At || z.Issue_Date || '',
        dateObj: parseToDateObject(z.Saved_At || z.Issue_Date),
        type: z.Garment_Type ? `Zip (${z.Garment_Type})` : 'Zipper Order',
        department: z.department || 'Store',
        vendor: z.Supplier || z.Supervisor || 'Puneet Zip',
        purpose: z.Style ? `Zipper Procurement for ${z.Style}` : 'Zipper Order',
        itemDescription: itemDesc,
        items: placements.map((p) => ({ lotNo: z.Lot_Number, itemDesc: `Placement: ${p}`, qty1: totalPcs, uom: 'PCS' })),
        quantity: totalPcs,
        uom: 'PCS',
        status: statusLabel,
        cost: z.Total_Cost || 0,
        preparedBy: z.Supervisor || 'Store',
        scans: zipScans,
        raw: z
      });
    });

    // 4. Purchase Orders (General PO)
    (pos || []).forEach(p => {
      let parsedItems = [];
      try {
        parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []);
      } catch (_) {}

      const itemDesc = parsedItems.length > 1 
        ? `See Items (${parsedItems.length})` 
        : (parsedItems[0]?.description || p.category || 'Trims & Accessories');

      const totalQty = parsedItems.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0) || parsedItems.length;

      // Find matching scans for General PO
      const poScans = (scans || []).filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        const pPo = String(p.poNumber || '').trim().toLowerCase();
        const pDes = String(p.designName || '').trim().toLowerCase();
        return (sLot && (sLot === pPo || sLot === pDes));
      });

      let statusLabel = p.status || 'Active';
      if (poScans.some(s => s.scan_type === 'material_in')) {
        statusLabel = 'Material Received';
      } else if (poScans.some(s => s.scan_type === 'gate_entry')) {
        statusLabel = 'Gate Entry Verified';
      }

      list.push({
        id: `PO-${p.id || p.poNumber}`,
        docNo: p.poNumber || `PO-${p.id}`,
        moduleType: 'po',
        moduleLabel: 'General PO',
        badgeColor: '#3b82f6',
        date: p.date || '',
        dateObj: parseToDateObject(p.date),
        type: p.category || 'Accessories',
        department: p.department || 'Store',
        vendor: p.vendorName || 'Supplier',
        purpose: p.designName ? `Procurement for Lot #${p.designName}` : 'Trim Procurement',
        itemDescription: itemDesc,
        items: parsedItems.map(it => ({ lotNo: p.lotId || p.designName, itemDesc: it.description || it.name, qty1: it.qty, uom: it.uom || 'PCS' })),
        quantity: totalQty,
        uom: parsedItems[0]?.uom || 'PCS',
        status: statusLabel,
        cost: p.total || 0,
        scans: poScans,
        raw: p
      });
    });

    // 5. PO Extra Pieces / Extra Material Issues
    (extraMaterialIssues || []).forEach(ex => {
      const exItems = Array.isArray(ex.items) ? ex.items : [];
      const totalQty = exItems.reduce((s, it) => s + (parseFloat(it.totalRequired || it.qty || it.extraQty) || 0), 0);
      const itemDesc = exItems.length > 1 
        ? `See Extra Items (${exItems.length})` 
        : (exItems[0] ? `+${exItems[0].totalRequired || exItems[0].qty || 0} ${exItems[0].unit || 'pcs'} ${exItems[0].bomItemName || exItems[0].materialName || ''}` : 'Extra Material Requisition');

      const exScans = (scans || []).filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        const exLot = String(ex.lot_no || ex.lotId || '').trim().toLowerCase();
        return sLot && (sLot === exLot || sLot === `ex-${ex.id}` || sLot === `ex-${ex.voucherId}`);
      });

      list.push({
        id: `EX-${ex.voucherId || ex.id}`,
        docNo: ex.voucherId ? `EX-${ex.voucherId}` : `EX-${ex.id}`,
        moduleType: 'extra_pieces',
        moduleLabel: 'Extra Pieces',
        badgeColor: '#ef4444',
        date: ex.issueDate || ex.createdAt || ex.date || '',
        dateObj: parseToDateObject(ex.issueDate || ex.createdAt || ex.date),
        type: 'Extra Material Requisition',
        department: ex.department || 'Stitching',
        vendor: ex.receiverName ? `${ex.personName || 'Store'} → ${ex.receiverName}` : (ex.receiverName || ex.personName || 'Production Dept'),
        purpose: ex.reason ? `Extra Requisition: ${ex.reason} (Lot #${ex.lotId})` : `Extra Pieces for Lot #${ex.lotId}`,
        itemDescription: itemDesc,
        items: exItems.map(it => ({ lotNo: ex.lotId, itemDesc: it.bomItemName || it.materialName, qty1: it.totalRequired || it.qty, uom: it.unit || 'PCS' })),
        quantity: totalQty,
        uom: exItems[0]?.unit || 'PCS',
        status: 'Issued / Requisition',
        preparedBy: ex.personName || 'Store',
        scans: exScans,
        raw: ex
      });
    });

    // 6. Scanner Logs / QR Scans
    (scans || []).forEach(sc => {
      const scanType = sc.scan_type === 'gate_entry' 
        ? 'Gate Entry (Gate In)' 
        : (sc.scan_type === 'material_in' 
          ? 'Material Entry (Received)' 
          : (sc.scan_type === 'printing_gate_out' 
            ? 'Printing Gate Out' 
            : (sc.scan_type === 'supplier_entry'
              ? 'Supplier Check-In'
              : (sc.scan_type === 'rgp_entry' 
                ? 'RGP Gate Out (Issue)' 
                : (sc.scan_type === 'rgp_return' 
                  ? 'RGP Gate In (Return)' 
                  : sc.scan_type)))));

      const scanBadgeColor = sc.scan_type === 'gate_entry'
        ? '#10b981'
        : (sc.scan_type === 'material_in'
          ? '#3b82f6'
          : (sc.scan_type === 'printing_gate_out'
            ? '#f97316'
            : (sc.scan_type === 'supplier_entry'
              ? '#f59e0b'
              : (sc.scan_type === 'rgp_entry'
                ? '#a855f7'
                : (sc.scan_type === 'rgp_return' ? '#ec4899' : '#06b6d4')))));

      let statusLabel = 'Gate Entry Verified';
      if (sc.scan_type === 'material_in') statusLabel = 'Material Received';
      else if (sc.scan_type === 'supplier_entry') statusLabel = 'Supplier Check-In';
      else if (sc.scan_type === 'printing_gate_out') statusLabel = 'Printing Dispatched';
      else if (sc.scan_type === 'rgp_entry') statusLabel = 'RGP Dispatched';
      else if (sc.scan_type === 'rgp_return') statusLabel = 'RGP Returned';

      list.push({
        id: `SCAN-${sc.id}`,
        docNo: sc.lot_number ? `SCAN-${sc.id} (#${sc.lot_number})` : `SCAN-${sc.id}`,
        moduleType: 'scanner',
        scanSubType: sc.scan_type,
        moduleLabel: 'Scanner Log',
        badgeColor: scanBadgeColor,
        date: sc.scanned_at || sc.timestamp || '',
        dateObj: parseToDateObject(sc.scanned_at || sc.timestamp),
        type: scanType,
        department: sc.department || (sc.scan_type === 'printing_gate_out' ? 'Printing' : 'Gate / Security'),
        vendor: sc.supplier_name || 'Vendor / Processor',
        purpose: sc.lot_number ? `Gate Checkpoint for Lot #${sc.lot_number} (${sc.supplier_name || 'Vendor'})` : `Security Verification (${sc.supplier_name || 'Checkpoint'})`,
        itemDescription: sc.material_name ? `${sc.material_name} — Verified at Gate (${sc.quantity || 0} pcs)` : `Materials Checked-In (${sc.quantity || 0} pcs)`,
        items: [{ lotNo: sc.lot_number, itemDesc: sc.material_name || 'Goods', qty1: sc.quantity || 0, uom: 'PCS' }],
        quantity: parseFloat(sc.quantity) || 0,
        uom: 'PCS',
        status: statusLabel,
        preparedBy: sc.person_name || 'Security Guard',
        scans: [sc],
        raw: sc
      });
    });

    return list;
  }, [processedRgpList, dooriOrders, zipOrders, pos, extraMaterialIssues, scans]);

  // Master Filtered Records
  const filteredMasterRecords = useMemo(() => {
    let list = unifiedMasterRecords.filter(r => {
      // 1. Module Filter
      if (masterModuleFilter === 'rgp') {
        if (r.moduleType !== 'rgp') return false;
      } else if (masterModuleFilter === 'rgp_closed') {
        if (r.moduleType !== 'rgp') return false;
        const s = String(r.status).toLowerCase();
        if (!s.includes('returned') && !s.includes('closed')) return false;
      } else if (masterModuleFilter === 'rgp_intransit') {
        if (r.moduleType !== 'rgp') return false;
        const s = String(r.status).toLowerCase();
        if (!s.includes('transit') && !s.includes('open')) return false;
      } else if (masterModuleFilter === 'rgp_overdue') {
        if (r.moduleType !== 'rgp') return false;
        const s = String(r.status).toLowerCase();
        if (!s.includes('overdue')) return false;
      } else if (masterModuleFilter === 'dori_po') {
        if (r.moduleType !== 'dori_po') return false;
      } else if (masterModuleFilter === 'zip_po') {
        if (r.moduleType !== 'zip_po') return false;
      } else if (masterModuleFilter === 'po') {
        if (r.moduleType !== 'po') return false;
      } else if (masterModuleFilter === 'extra_pieces') {
        if (r.moduleType !== 'extra_pieces') return false;
      } else if (masterModuleFilter === 'scanner') {
        if (r.moduleType !== 'scanner') return false;
      } else if (masterModuleFilter === 'scanner_gate_entry') {
        if (r.moduleType !== 'scanner' || r.scanSubType !== 'gate_entry') return false;
      } else if (masterModuleFilter === 'scanner_material_in') {
        if (r.moduleType !== 'scanner' || (r.scanSubType !== 'material_in' && r.scanSubType !== 'material_entry')) return false;
      } else if (masterModuleFilter === 'scanner_supplier') {
        if (r.moduleType !== 'scanner' || r.scanSubType !== 'supplier_entry') return false;
      } else if (masterModuleFilter === 'scanner_printing') {
        if (r.moduleType !== 'scanner' || r.scanSubType !== 'printing_gate_out') return false;
      } else if (masterModuleFilter === 'scanner_rgp') {
        if (r.moduleType !== 'scanner' || (r.scanSubType !== 'rgp_entry' && r.scanSubType !== 'rgp_return')) return false;
      }

      // 2. Department Filter
      if (masterDeptFilter !== 'all') {
        if (!String(r.department || '').toLowerCase().includes(masterDeptFilter.toLowerCase())) {
          return false;
        }
      }

      // 3. Status Filter
      if (masterStatusFilter !== 'all') {
        const s = String(r.status || '').toLowerCase();
        if (masterStatusFilter === 'closed' && !s.includes('closed') && !s.includes('returned')) return false;
        if (masterStatusFilter === 'in_transit' && !s.includes('transit') && !s.includes('open') && !s.includes('pending')) return false;
        if (masterStatusFilter === 'overdue' && !s.includes('overdue')) return false;
        if (masterStatusFilter === 'verified' && !s.includes('verified') && !s.includes('approved')) return false;
        if (masterStatusFilter === 'scanned' && !s.includes('scanned') && !s.includes('logged') && !s.includes('received')) return false;
      }

      // 4. Date Range Filter
      if (masterDateFrom || masterDateTo) {
        if (!isDateInRange(r.date, masterDateFrom, masterDateTo)) return false;
      }

      // 5. Search Text Filter
      if (masterSearch.trim()) {
        const q = masterSearch.toLowerCase().trim();
        const matchDoc = String(r.docNo || '').toLowerCase().includes(q);
        const matchType = String(r.type || '').toLowerCase().includes(q);
        const matchDept = String(r.department || '').toLowerCase().includes(q);
        const matchVendor = String(r.vendor || '').toLowerCase().includes(q);
        const matchPurpose = String(r.purpose || '').toLowerCase().includes(q);
        const matchItem = String(r.itemDescription || '').toLowerCase().includes(q);
        const matchPrep = String(r.preparedBy || '').toLowerCase().includes(q);
        const matchAuth = String(r.authorizedBy || '').toLowerCase().includes(q);
        const matchVehicle = String(r.vehicleNo || '').toLowerCase().includes(q);
        const matchItemsList = (r.items || []).some(it => 
          String(it.lotNo || '').toLowerCase().includes(q) || 
          String(it.itemDesc || it.name || '').toLowerCase().includes(q)
        );

        if (!matchDoc && !matchType && !matchDept && !matchVendor && !matchPurpose && !matchItem && !matchPrep && !matchAuth && !matchVehicle && !matchItemsList) {
          return false;
        }
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      if (masterSort === 'latest') {
        return (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0);
      } else if (masterSort === 'oldest') {
        return (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0);
      } else if (masterSort === 'qty_desc') {
        return (parseFloat(b.quantity) || 0) - (parseFloat(a.quantity) || 0);
      } else if (masterSort === 'qty_asc') {
        return (parseFloat(a.quantity) || 0) - (parseFloat(b.quantity) || 0);
      }
      return 0;
    });

    return list;
  }, [unifiedMasterRecords, masterModuleFilter, masterDeptFilter, masterStatusFilter, masterDateFrom, masterDateTo, masterSearch, masterSort]);

  // Master KPI Stats
  const masterKPIStats = useMemo(() => {
    const totalRecords = filteredMasterRecords.length;
    const totalPieces = filteredMasterRecords.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
    const closedCount = filteredMasterRecords.filter(r => String(r.status).toLowerCase().includes('closed') || String(r.status).toLowerCase().includes('returned')).length;
    const openCount = filteredMasterRecords.filter(r => String(r.status).toLowerCase().includes('transit') || String(r.status).toLowerCase().includes('open') || String(r.status).toLowerCase().includes('pending') || String(r.status).toLowerCase().includes('active')).length;
    const overdueCount = filteredMasterRecords.filter(r => String(r.status).toLowerCase().includes('overdue')).length;
    const scanCount = filteredMasterRecords.filter(r => r.moduleType === 'scanner' || (r.scans && r.scans.length > 0)).length;

    return { totalRecords, totalPieces, closedCount, openCount, overdueCount, scanCount };
  }, [filteredMasterRecords]);

  // Reset Master Filters
  const handleResetMasterFilters = () => {
    setMasterModuleFilter('all');
    setMasterDeptFilter('all');
    setMasterStatusFilter('all');
    setMasterSearch('');
    setMasterDateFrom('');
    setMasterDateTo('');
    setMasterSort('latest');
  };

  // Dynamic Title for Master Report
  const getMasterReportTitle = () => {
    if (masterModuleFilter === 'rgp_closed') return 'Closed RGP Dashboard';
    if (masterModuleFilter === 'rgp') return 'Returnable Gate Pass (RGP) Register';
    if (masterModuleFilter === 'rgp_intransit') return 'In-Transit RGP Dashboard';
    if (masterModuleFilter === 'rgp_overdue') return 'Overdue RGP Tracking Register';
    if (masterModuleFilter === 'dori_po') return 'Dori PO Sourcing & Dispatch Register';
    if (masterModuleFilter === 'zip_po') return 'Zip PO Sourcing & Order Register';
    if (masterModuleFilter === 'po') return 'General Purchase Orders (PO) Register';
    if (masterModuleFilter === 'extra_pieces') return 'PO Extra Pieces & Material Issues Report';
    if (masterModuleFilter === 'scanner_gate_entry') return 'Gate Entry (Gate In) Scanner Checkpoints Report';
    if (masterModuleFilter === 'scanner_material_in') return 'Material Entry & Received Scans Report';
    if (masterModuleFilter === 'scanner_supplier') return 'Supplier Check-In Gate Logs Report';
    if (masterModuleFilter === 'scanner_printing') return 'Printing Gate Out Dispatch Report';
    if (masterModuleFilter === 'scanner_rgp') return 'RGP Gate Dispatch & Return Scans Report';
    if (masterModuleFilter === 'scanner') return 'QR Scanner Logs & Gate Entry Report';
    return 'Master Operations & Logistics Report';
  };

  // Dynamic Filter Badge Details
  const getMasterFilterBadge = () => {
    if (masterModuleFilter === 'rgp_closed') return { text: 'Showing Closed RGP Only', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)' };
    if (masterModuleFilter === 'rgp') return { text: 'Showing All RGP Passes', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)', border: 'rgba(124, 58, 237, 0.25)' };
    if (masterModuleFilter === 'rgp_intransit') return { text: 'Showing In-Transit RGP Only', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' };
    if (masterModuleFilter === 'rgp_overdue') return { text: 'Showing Overdue RGP Only', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', border: 'rgba(220, 38, 38, 0.25)' };
    if (masterModuleFilter === 'dori_po') return { text: 'Showing Dori POs Only', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' };
    if (masterModuleFilter === 'zip_po') return { text: 'Showing Zip POs Only', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.25)' };
    if (masterModuleFilter === 'po') return { text: 'Showing General POs Only', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)' };
    if (masterModuleFilter === 'extra_pieces') return { text: 'Showing PO Extra Pieces Only', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)' };
    if (masterModuleFilter === 'scanner_gate_entry') return { text: 'Showing Gate Entry Scans Only', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)' };
    if (masterModuleFilter === 'scanner_material_in') return { text: 'Showing Material Received Only', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)' };
    if (masterModuleFilter === 'scanner_supplier') return { text: 'Showing Supplier Check-Ins Only', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' };
    if (masterModuleFilter === 'scanner_printing') return { text: 'Showing Printing Gate Out Only', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.25)' };
    if (masterModuleFilter === 'scanner_rgp') return { text: 'Showing RGP Gate Scans Only', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.25)' };
    if (masterModuleFilter === 'scanner') return { text: 'Showing All QR Scanner Logs Only', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)' };
    return { text: 'Showing All Modules (RGP, Dori, Zip, PO, Extra Pieces, Scanner)', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.25)' };
  };

  // Master Excel Export
  const handleExportMasterExcel = (filteredData, filterName = 'Operations_Report') => {
    if (!filteredData || filteredData.length === 0) {
      alert('No records available to export.');
      return;
    }
    
    const headers = [
      'Module / Category',
      'Document / Reference No',
      'Date / Time',
      'Type / Subtype',
      'Department',
      'Vendor / Party / Operator',
      'Purpose / Remarks',
      'Item Description',
      'Quantity Sent / Pieces',
      'UOM',
      'Expected Return / Status',
      'Vehicle No',
      'Prepared / Authorized By',
      'Total Cost / Amount'
    ];

    const rows = filteredData.map(r => [
      r.moduleLabel || r.moduleType || '',
      r.docNo || '',
      formatDateTime(r.date) || r.date || '',
      r.type || '',
      r.department || '',
      r.vendor || '',
      r.purpose || '',
      r.itemDescription || '',
      r.quantity || 0,
      r.uom || 'PCS',
      r.status || '',
      r.vehicleNo || '',
      [r.preparedBy, r.authorizedBy].filter(Boolean).join(' / ') || '',
      r.cost ? `₹${r.cost}` : ''
    ]);

    const csvContent = '\uFEFF' + [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filterName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Master PDF Report Export
  const handleExportMasterPDF = (filteredData, activeTitle = 'Operations & Logistics Master Report') => {
    if (!filteredData || filteredData.length === 0) {
      alert('No records to export to PDF.');
      return;
    }

    const doc = new jsPDF('landscape', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header Banner
    doc.setFillColor(0, 75, 135); // Deep corporate blue
    doc.rect(0, 0, pageWidth, 55, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(activeTitle.toUpperCase(), 35, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(224, 242, 254);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Total Records: ${filteredData.length}`, pageWidth - 35, 34, { align: 'right' });

    // Summary Metrics Banner
    const totalQty = filteredData.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
    const closedCount = filteredData.filter(r => String(r.status).toLowerCase().includes('closed') || String(r.status).toLowerCase().includes('returned')).length;
    const inTransitCount = filteredData.filter(r => String(r.status).toLowerCase().includes('transit') || String(r.status).toLowerCase().includes('open') || String(r.status).toLowerCase().includes('pending') || String(r.status).toLowerCase().includes('active')).length;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(35, 65, pageWidth - 70, 32, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Total Records: ${filteredData.length}   |   Total Quantity/Pieces: ${totalQty.toLocaleString()}   |   Closed / Returned: ${closedCount}   |   In-Transit / Open: ${inTransitCount}`, 45, 85);

    const tableHead = [['#', 'DOC / RGP NO', 'DATE', 'TYPE', 'DEPT', 'VENDOR / PARTY', 'PURPOSE', 'ITEM DESCRIPTION', 'QTY', 'UOM', 'STATUS']];

    const tableBody = filteredData.map((r, idx) => [
      idx + 1,
      r.docNo || '—',
      formatDateTime(r.date) || r.date || '—',
      r.type || r.moduleLabel || '—',
      r.department || '—',
      r.vendor || '—',
      r.purpose || '—',
      (r.itemDescription || '—').length > 35 ? (r.itemDescription || '—').substring(0, 35) + '...' : (r.itemDescription || '—'),
      (parseFloat(r.quantity) || 0).toLocaleString(),
      r.uom || 'PCS',
      r.status || 'Active'
    ]);

    autoTable(doc, {
      startY: 108,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 75, 135],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        cellPadding: 4.5,
        overflow: 'linebreak',
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 80, fontStyle: 'bold' },
        2: { cellWidth: 65 },
        3: { cellWidth: 65 },
        4: { cellWidth: 60 },
        5: { cellWidth: 80 },
        6: { cellWidth: 65 },
        7: { cellWidth: 150 },
        8: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 35, halign: 'center' },
        10: { cellWidth: 65, halign: 'center' }
      },
      margin: { left: 35, right: 35 },
      didDrawPage: (data) => {
        const pageNum = doc.internal.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${data.pageNumber} of ${pageNum} — Production & Logistics Operations Report`, pageWidth / 2, pageHeight - 15, { align: 'center' });
      }
    });

    const filename = `${activeTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // CSV Export for RGPs
  const handleExportRgpCSV = () => {
    if (!filteredRgpList.length) {
      alert('No RGP records to export.');
      return;
    }
    const headers = [
      'RGP Number',
      'Issue Date',
      'Expected Return Date',
      'Status',
      'Vendor/Party',
      'RGP Type',
      'Department',
      'Purpose',
      'Vehicle No',
      'Total Items',
      'Total Qty (Pcs)',
      'Total Bags/Rolls',
      'Prepared By',
      'Authorized By',
      'Gate Out Scan Date',
      'Gate Out Guard',
      'Gate In Return Scan Date',
      'Gate In Guard',
      'Item Descriptions & Lots'
    ];

    const rows = filteredRgpList.map(r => {
      const itemSummaries = r.entries.map(e => `[Lot #${e.lotNo || 'N/A'}: ${e.itemDesc || ''} (${e.qty1 || 0} ${e.uom || ''})]`).join('; ');
      return [
        `"${r.rgpNo || ''}"`,
        `"${r.date || ''}"`,
        `"${r.expectedReturnDate || ''}"`,
        `"${r.status || ''}"`,
        `"${r.vendor || ''}"`,
        `"${r.rgpType || ''}"`,
        `"${r.department || ''}"`,
        `"${r.purpose || ''}"`,
        `"${r.vehicleNo || ''}"`,
        r.entries.length,
        r.totalQty1,
        r.totalQty2,
        `"${r.preparedBy || ''}"`,
        `"${r.authorizedBy || ''}"`,
        `"${r.gateOutScan ? formatDateTime(r.gateOutScan.scanned_at) : 'Not Scanned'}"`,
        `"${r.gateOutScan ? (r.gateOutScan.person_name || '—') : '—'}"`,
        `"${r.gateInScan ? formatDateTime(r.gateInScan.scanned_at) : 'Not Scanned'}"`,
        `"${r.gateInScan ? (r.gateInScan.person_name || '—') : '—'}"`,
        `"${itemSummaries.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RGP_Pass_Full_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Download for single RGP
  const handleDownloadRgpPdf = (rgp) => {
    if (!rgp) return;
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      // Header banner
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text('RETURNABLE GATE PASS (RGP)', 40, 45);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Official Document — Generated: ${new Date().toLocaleString('en-GB')}`, 40, 60);

      // Status Stamp
      const isRet = rgp.isReturned;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      if (isRet) {
        doc.setTextColor(16, 185, 129);
        doc.text('STATUS: FULLY RETURNED', 390, 45);
      } else if (rgp.isOverdue) {
        doc.setTextColor(239, 68, 68);
        doc.text(`STATUS: OVERDUE (${rgp.daysOverdue} Days)`, 390, 45);
      } else {
        doc.setTextColor(124, 58, 237);
        doc.text('STATUS: IN-TRANSIT / OPEN', 390, 45);
      }

      // Border Box for Header Info
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(40, 75, 515, 95, 6, 6, 'FD');

      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`RGP Number:`, 55, 95);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.rgpNo || 'N/A'}`, 130, 95);

      doc.setFont('helvetica', 'bold');
      doc.text(`Issue Date:`, 55, 112);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.date || 'N/A'}`, 130, 112);

      doc.setFont('helvetica', 'bold');
      doc.text(`Exp. Return:`, 55, 129);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.expectedReturnDate || 'N/A'}`, 130, 129);

      doc.setFont('helvetica', 'bold');
      doc.text(`Vehicle No:`, 55, 146);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.vehicleNo || 'N/A'}`, 130, 146);

      doc.setFont('helvetica', 'bold');
      doc.text(`Vendor / Party:`, 270, 95);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.vendor || 'N/A'}`, 360, 95);

      doc.setFont('helvetica', 'bold');
      doc.text(`RGP Type:`, 270, 112);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.rgpType || 'N/A'}`, 360, 112);

      doc.setFont('helvetica', 'bold');
      doc.text(`Department:`, 270, 129);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.department || 'N/A'}`, 360, 129);

      doc.setFont('helvetica', 'bold');
      doc.text(`Purpose:`, 270, 146);
      doc.setFont('helvetica', 'normal');
      doc.text(`${rgp.purpose || 'N/A'}`, 360, 146);

      // Items Table
      const itemRows = (rgp.entries || []).map((e, idx) => [
        idx + 1,
        e.lotNo || '—',
        e.itemDesc || 'Item',
        e.qty1 || 0,
        e.qty2 || 0,
        e.uom || 'PCS',
        e.purpose || rgp.purpose || '—'
      ]);

      autoTable(doc, {
        startY: 185,
        head: [['#', 'Lot No', 'Item Description', 'Qty 1', 'Qty 2 (Rolls)', 'UOM', 'Purpose']],
        body: itemRows.length ? itemRows : [['1', '—', rgp.itemDesc || 'Materials', rgp.qty || 1, '—', rgp.uom || 'PCS', rgp.purpose || '—']],
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 5 },
        margin: { left: 40, right: 40 }
      });

      let nextY = doc.lastAutoTable.finalY + 20;

      // Gate Scanner Audit Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Security Gate Scanner Verification Trail', 40, nextY);
      nextY += 10;

      const scanRows = (rgp.matchingScans || []).map((s, idx) => [
        idx + 1,
        s.scan_type === 'rgp_return' ? 'Gate In (Return Scan)' : (s.scan_type === 'rgp_entry' ? 'Gate Out (Dispatch Scan)' : s.scan_type),
        formatDateTime(s.scanned_at),
        s.person_name || 'Gatekeeper',
        s.supplier_name || rgp.vendor || '—',
        `${s.quantity || 0} ${s.material_name || ''}`
      ]);

      if (scanRows.length > 0) {
        autoTable(doc, {
          startY: nextY,
          head: [['#', 'Event Type', 'Scan Date & Time', 'Security / Guard', 'Party Verified', 'Scanned Material & Qty']],
          body: scanRows,
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
          styles: { fontSize: 8, cellPadding: 4 },
          margin: { left: 40, right: 40 }
        });
        nextY = doc.lastAutoTable.finalY + 30;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text('No live QR scanner gate logs recorded for this pass yet.', 40, nextY + 12);
        nextY += 40;
      }

      // Authorization Signatures
      if (nextY > 720) {
        doc.addPage();
        nextY = 60;
      }
      doc.setDrawColor(203, 213, 225);
      doc.line(50, nextY + 35, 180, nextY + 35);
      doc.line(370, nextY + 35, 500, nextY + 35);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(`Prepared By: ${rgp.preparedBy || 'Store Incharge'}`, 50, nextY + 48);
      doc.text(`Authorized By: ${rgp.authorizedBy || 'Management'}`, 370, nextY + 48);

      doc.save(`RGP_${rgp.rgpNo || 'Pass'}_Document.pdf`);
    } catch (err) {
      console.error('Error generating RGP PDF:', err);
      alert('Could not generate PDF: ' + err.message);
    }
  };

  // Unique lot brands
  const uniqueLotBrands = useMemo(() => {
    const set = new Set();
    (lotWiseList || []).forEach(l => {
      if (l.brand && l.brand !== '—' && l.brand !== '') set.add(l.brand);
    });
    return Array.from(set).sort();
  }, [lotWiseList]);

  // Filtered Lot-Wise List
  const filteredLotWiseList = useMemo(() => {
    let list = (lotWiseList || []).filter(lot => {
      // 1. Process Status Filter
      if (lotStatusFilter === 'complete') {
        if (!lot.isCompleted) return false;
      } else if (lotStatusFilter === 'in_progress') {
        if (lot.isCompleted) return false;
      } else if (lotStatusFilter === 'pending_rgp') {
        if (!String(lot.processStatus).toLowerCase().includes('pending rgp')) return false;
      } else if (lotStatusFilter === 'pending_gate') {
        if (!String(lot.processStatus).toLowerCase().includes('pending gate')) return false;
      } else if (lotStatusFilter === 'pending_receive') {
        if (!String(lot.processStatus).toLowerCase().includes('pending store')) return false;
      } else if (lotStatusFilter === 'overdue') {
        if (!String(lot.processStatus).toLowerCase().includes('overdue')) return false;
      } else if (lotStatusFilter === 'bom_registered') {
        if (!String(lot.processStatus).toLowerCase().includes('bom registered')) return false;
      }

      // 2. Brand Filter
      if (lotBrandFilter !== 'all') {
        if (String(lot.brand || '').toLowerCase() !== lotBrandFilter.toLowerCase()) return false;
      }

      // 3. Search Query
      if (lotSearch.trim()) {
        const q = lotSearch.toLowerCase().trim();
        const matchLot = String(lot.lotNo || '').toLowerCase().includes(q);
        const matchStyle = String(lot.style || '').toLowerCase().includes(q);
        const matchBrand = String(lot.brand || '').toLowerCase().includes(q);
        const matchFabric = String(lot.fabricType || '').toLowerCase().includes(q);
        const matchVendors = (lot.vendors || []).some(v => String(v).toLowerCase().includes(q));
        const matchMaterials = (lot.materials || []).some(m => String(m.name || '').toLowerCase().includes(q) || String(m.source || '').toLowerCase().includes(q));
        const matchRgps = (lot.rgps || []).some(r => String(r.rgpNo || '').toLowerCase().includes(q) || String(r.vendor || '').toLowerCase().includes(q));
        const matchPos = (lot.pos || []).some(p => String(p.poNumber || '').toLowerCase().includes(q) || String(p.vendorName || '').toLowerCase().includes(q));
        const matchDoori = (lot.dooriOrders || []).some(d => String(d.po_number || d.Lot_Number || '').toLowerCase().includes(q));
        const matchZip = (lot.zipOrders || []).some(z => String(z.po_number || z.Lot_Number || '').toLowerCase().includes(q));
        const matchExtra = (lot.extraIssues || []).some(ex => String(ex.voucher_id || ex.voucherId || ex.id || '').toLowerCase().includes(q));

        if (!matchLot && !matchStyle && !matchBrand && !matchFabric && !matchVendors && !matchMaterials && !matchRgps && !matchPos && !matchDoori && !matchZip && !matchExtra) {
          return false;
        }
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      const numA = parseInt(String(a.lotNo).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.lotNo).replace(/\D/g, ''), 10) || 0;
      if (lotSort === 'lot_desc') return numB - numA;
      if (lotSort === 'lot_asc') return numA - numB;
      if (lotSort === 'target_desc') return (b.targetPieces || 0) - (a.targetPieces || 0);
      if (lotSort === 'target_asc') return (a.targetPieces || 0) - (b.targetPieces || 0);
      if (lotSort === 'ops_desc') {
        const opsA = (a.counts?.rgp || 0) + (a.counts?.po || 0) + (a.counts?.doori || 0) + (a.counts?.zip || 0) + (a.counts?.scans || 0);
        const opsB = (b.counts?.rgp || 0) + (b.counts?.po || 0) + (b.counts?.doori || 0) + (b.counts?.zip || 0) + (b.counts?.scans || 0);
        return opsB - opsA;
      }
      return 0;
    });

    return list;
  }, [lotWiseList, lotStatusFilter, lotBrandFilter, lotSearch, lotSort]);

  // KPI stats for Lot-Wise Report
  const lotWiseKPIStats = useMemo(() => {
    const total = filteredLotWiseList.length;
    const completed = filteredLotWiseList.filter(l => l.isCompleted).length;
    const inProgress = total - completed;
    const totalTargetPcs = filteredLotWiseList.reduce((sum, l) => sum + (l.targetPieces || 0), 0);
    const totalRgpPcs = filteredLotWiseList.reduce((sum, l) => sum + (l.totalRgpPcs || 0), 0);
    const totalReceivedPcs = filteredLotWiseList.reduce((sum, l) => sum + (l.totalReceivedPcs || 0), 0);
    const overdueCount = filteredLotWiseList.filter(l => String(l.processStatus).toLowerCase().includes('overdue')).length;

    return { total, completed, inProgress, totalTargetPcs, totalRgpPcs, totalReceivedPcs, overdueCount };
  }, [filteredLotWiseList]);

  // Toggle row expansion in Lot-Wise table
  const toggleLotExpand = (lotNo) => {
    setExpandedLotIds(prev => {
      const next = new Set(prev);
      if (next.has(lotNo)) next.delete(lotNo);
      else next.add(lotNo);
      return next;
    });
  };

  // Reset Lot-Wise Filters
  const handleResetLotFilters = () => {
    setLotSearch('');
    setLotStatusFilter('all');
    setLotBrandFilter('all');
    setLotSort('lot_desc');
  };

  // Export Lot-Wise Summary to Excel / CSV
  const handleExportLotSummaryExcel = () => {
    const headers = [
      'Lot Number',
      'Style Code',
      'Brand / Client',
      'Fabric Type',
      'Target Pieces',
      'RGP Tags Breakdown',
      'RGP Dori Breakdown',
      'RGP Zip & Trims Breakdown',
      'Dori PO Orders',
      'Zip PO Orders',
      'General PO & Extra Requisitions',
      'Vendors Involved',
      'Gate Entry (Gate In) Trail',
      'Material In (Store Received) Trail',
      'Material Out (Gate Dispatch) Trail',
      'Process Status',
      'Is Complete'
    ];

    const rows = filteredLotWiseList.map(l => {
      const rgpTagsStr = (l.rgpTagList || []).map(t => `${t.rgpNo}: ${t.itemDesc} (${t.qty} ${t.uom}) [${t.status}]`).join('; ');
      const rgpDoriStr = (l.rgpDoriList || []).map(d => `${d.rgpNo}: ${d.itemDesc} (${d.qty} ${d.uom}) [${d.status}]`).join('; ');
      const rgpZipStr = (l.rgpZipList || []).map(z => `${z.rgpNo}: ${z.itemDesc} (${z.qty} ${z.uom}) [${z.status}]`).join('; ');
      const doriOrdersStr = (l.dooriOrders || []).map(d => `PO #${d.po_number || d.Lot_Number}: ${d.Total_Pieces} pcs (${d.Style || ''})`).join('; ');
      const zipOrdersStr = (l.zipOrders || []).map(z => `PO #${z.po_number || z.Lot_Number}: ${z.Total_Pieces_CH || z.Total_Pieces} pcs (Teeth: ${z.Teeth_Color || 'STD'})`).join('; ');
      const posStr = [...(l.pos || []).map(p => `PO #${p.poNumber} (${p.vendorName || ''})`), ...(l.extraIssues || []).map(ex => `Extra #${ex.voucher_id || ex.voucherId || ex.id} (${ex.reason || ''})`)].join('; ');
      const gateInStr = (l.gateInScans || []).map(s => `${s.person_name || 'Guard'}: ${s.quantity || 0} pcs from ${s.supplier_name || ''} at ${formatDateTime(s.scanned_at || s.timestamp)}`).join('; ');
      const matInStr = (l.materialInScans || []).map(s => `${s.person_name || 'Verifier'}: ${s.material_name || ''} (${s.quantity || 0} pcs) at ${formatDateTime(s.scanned_at || s.timestamp)}`).join('; ');
      const matOutStr = (l.materialOutScans || []).map(s => `${s.person_name || 'Guard'}: ${s.material_name || ''} (${s.quantity || 0} pcs) at ${formatDateTime(s.scanned_at || s.timestamp)}`).join('; ');

      return [
        `"${l.lotNo}"`,
        `"${String(l.style || '').replace(/"/g, '""')}"`,
        `"${String(l.brand || '').replace(/"/g, '""')}"`,
        `"${String(l.fabricType || '').replace(/"/g, '""')}"`,
        l.targetPieces || 0,
        `"${rgpTagsStr.replace(/"/g, '""')}"`,
        `"${rgpDoriStr.replace(/"/g, '""')}"`,
        `"${rgpZipStr.replace(/"/g, '""')}"`,
        `"${doriOrdersStr.replace(/"/g, '""')}"`,
        `"${zipOrdersStr.replace(/"/g, '""')}"`,
        `"${posStr.replace(/"/g, '""')}"`,
        `"${(l.vendors || []).join(', ').replace(/"/g, '""')}"`,
        `"${gateInStr.replace(/"/g, '""')}"`,
        `"${matInStr.replace(/"/g, '""')}"`,
        `"${matOutStr.replace(/"/g, '""')}"`,
        `"${l.processStatus}"`,
        l.isCompleted ? 'YES (COMPLETE)' : 'NO (IN PROGRESS)'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Lot_Wise_Operations_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Single Lot PDF Dossier
  const handleDownloadLotPDF = (lot) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      // Title & Header
      doc.setFillColor(0, 75, 135);
      doc.rect(40, 30, 515, 45, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text(`MANUFACTURING LOT AUDIT DOSSIER — LOT #${lot.lotNo}`, 50, 58);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Consolidated Operations Dossier`, 40, 90);

      // Metadata Table
      autoTable(doc, {
        startY: 100,
        margin: { left: 40, right: 40 },
        theme: 'grid',
        head: [['Lot Metadata', 'Details', 'Process Lifecycle', 'Status Details']],
        body: [
          ['Lot Number', `#${lot.lotNo}`, 'Lifecycle Status', lot.isCompleted ? '✓ COMPLETE (All Processes Finished)' : lot.processStatus],
          ['Style Code', lot.style || '—', 'Target Pieces', `${lot.targetPieces || 0} PCS`],
          ['Brand / Client', lot.brand || '—', 'RGP Operations', `Tags: ${lot.rgpTagList?.length || 0} | Dori: ${lot.rgpDoriList?.length || 0} | Zip: ${lot.rgpZipList?.length || 0}`],
          ['Fabric Type', lot.fabricType || '—', 'Scanners Verified', `Gate In: ${lot.gateInScans?.length || 0} | Material In: ${lot.materialInScans?.length || 0} | Out: ${lot.materialOutScans?.length || 0}`],
          ['Vendors Involved', (lot.vendors || []).join(', ') || '—', 'PO & Trims Orders', `Dori: ${lot.totalDoriPcs || 0} pcs | Zip: ${lot.totalZipPcs || 0} pcs | PO: ${lot.totalPoPcs || 0} pcs`]
        ],
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [0, 75, 135], textColor: [255, 255, 255] }
      });

      let nextY = doc.lastAutoTable.finalY + 16;

      // 1. Materials Matrix
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('1. Consolidated Raw Materials & Accessories Breakdown', 40, nextY);
      nextY += 8;

      const matRows = (lot.materials || []).map((m, idx) => [
        idx + 1,
        m.name || 'Material',
        m.color || '—',
        `${m.qty || 0} ${m.uom || 'PCS'}`,
        m.source || 'PO/RGP',
        m.meta || '—'
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 40, right: 40 },
        theme: 'striped',
        head: [['#', 'Material Name', 'Color / Teeth', 'Total Qty', 'Document Source', 'Purpose / Placement']],
        body: matRows.length > 0 ? matRows : [['—', 'No direct materials recorded', '—', '—', '—', '—']],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255] }
      });

      nextY = doc.lastAutoTable.finalY + 16;

      // 2. Connected RGPs & POs
      if (nextY > 680) { doc.addPage(); nextY = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('2. Returnable Gate Passes (RGP) & Purchase Orders Record', 40, nextY);
      nextY += 8;

      const rgpPoRows = [];
      (lot.rgps || []).forEach(r => {
        rgpPoRows.push([
          `RGP #${r.rgpNo}`,
          'RGP Pass',
          r.vendor || '—',
          formatDateTime(r.date),
          r.expectedReturnDate ? formatDateTime(r.expectedReturnDate) : '—',
          r.status || 'Dispatched'
        ]);
      });
      (lot.pos || []).forEach(p => {
        rgpPoRows.push([
          `PO #${p.poNumber}`,
          'General PO',
          p.vendorName || '—',
          formatDateTime(p.date),
          '—',
          p.status || 'Active'
        ]);
      });
      (lot.dooriOrders || []).forEach(d => {
        rgpPoRows.push([
          `Dori #${d.po_number || d.Lot_Number}`,
          'Dori PO',
          d.Supplier_Name || d.Supplier || '—',
          formatDateTime(d.Issue_Date || d.Timestamp),
          '—',
          'Compiled'
        ]);
      });
      (lot.zipOrders || []).forEach(z => {
        rgpPoRows.push([
          `Zip #${z.po_number || z.Lot_Number}`,
          'Zip PO',
          z.Supplier_Name || z.Supplier || '—',
          formatDateTime(z.Saved_At || z.Issue_Date),
          '—',
          'Compiled'
        ]);
      });

      autoTable(doc, {
        startY: nextY,
        margin: { left: 40, right: 40 },
        theme: 'grid',
        head: [['Doc Ref #', 'Module Type', 'Vendor / Party', 'Issued Date', 'Expected Return', 'Status']],
        body: rgpPoRows.length > 0 ? rgpPoRows : [['—', 'No sub-orders or RGPs logged', '—', '—', '—', '—']],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] }
      });

      nextY = doc.lastAutoTable.finalY + 16;

      // 3. Security Gate & Scanner Trail
      if (nextY > 680) { doc.addPage(); nextY = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('3. Security Gate Entry & Scanner Inward Verification Trail', 40, nextY);
      nextY += 8;

      const scanRows = (lot.scans || []).map((s, idx) => [
        idx + 1,
        s.scan_type === 'gate_entry' ? 'Gate Entry (Gate In)' : (s.scan_type === 'material_in' ? 'Material Received (Inward)' : (s.scan_type === 'rgp_entry' ? 'Gate Out (Dispatch)' : s.scan_type)),
        s.person_name || 'Guard',
        s.supplier_name || 'Vendor',
        `${s.quantity || 0} pcs of ${s.material_name || 'Goods'}`,
        formatDateTime(s.scanned_at || s.timestamp)
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 40, right: 40 },
        theme: 'grid',
        head: [['#', 'Scan Event', 'Officer / Guard', 'Party Verified', 'Material & Quantity', 'Scanned Timestamp']],
        body: scanRows.length > 0 ? scanRows : [['—', 'No QR scanner checkpoints logged yet', '—', '—', '—', '—']],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }
      });

      nextY = doc.lastAutoTable.finalY + 25;
      if (nextY > 720) { doc.addPage(); nextY = 50; }

      // Signatures
      doc.setDrawColor(203, 213, 225);
      doc.line(50, nextY + 30, 180, nextY + 30);
      doc.line(220, nextY + 30, 350, nextY + 30);
      doc.line(390, nextY + 30, 520, nextY + 30);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Prepared By (Store)', 50, nextY + 42);
      doc.text('Security Gate Incharge', 220, nextY + 42);
      doc.text('Factory Manager / Auth', 390, nextY + 42);

      doc.save(`Lot_${lot.lotNo}_Operations_Dossier.pdf`);
    } catch (err) {
      console.error('Error generating Lot PDF:', err);
      alert('Could not generate Lot PDF: ' + err.message);
    }
  };

  // Download All Filtered Lots PDF Master Register
  const handleDownloadAllLotsPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 75, 135);
      doc.text('CONSOLIDATED LOT-WISE OPERATIONS MASTER REGISTER', 40, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | Total Manufacturing Lots: ${filteredLotWiseList.length}`, 40, 56);

      const tableRows = filteredLotWiseList.map((l, idx) => {
        const rgpTags = (l.rgpTagList || []).map(t => `${t.rgpNo} (${t.qty} pcs)`).join(', ') || '—';
        const rgpDori = (l.rgpDoriList || []).map(d => `${d.rgpNo} (${d.qty} pcs)`).join(', ') || '—';
        const rgpZip = (l.rgpZipList || []).map(z => `${z.rgpNo} (${z.qty} pcs)`).join(', ') || '—';
        const doriPO = (l.dooriOrders || []).map(d => `PO #${d.po_number || d.Lot_Number} (${d.Total_Pieces} pcs)`).join(', ') || '—';
        const zipPO = (l.zipOrders || []).map(z => `PO #${z.po_number || z.Lot_Number} (${z.Total_Pieces_CH || z.Total_Pieces} pcs)`).join(', ') || '—';
        const genPO = [...(l.pos || []).map(p => `PO #${p.poNumber}`), ...(l.extraIssues || []).map(ex => `Ex #${ex.voucher_id || ex.voucherId || ex.id}`)].join(', ') || '—';
        const gateIn = (l.gateInScans || []).map(s => `${s.quantity || 0} pcs (${s.person_name || 'Guard'})`).join(', ') || '—';
        const matIn = (l.materialInScans || []).map(s => `${s.quantity || 0} pcs (${s.material_name || 'Goods'})`).join(', ') || '—';
        const matOut = (l.materialOutScans || []).map(s => `${s.quantity || 0} pcs (${s.person_name || 'Guard'})`).join(', ') || '—';

        return [
          idx + 1,
          `#${l.lotNo}\n${l.style || ''}`,
          `${l.targetPieces || 0} PCS`,
          rgpTags,
          rgpDori,
          rgpZip,
          doriPO,
          zipPO,
          genPO,
          (l.vendors || []).slice(0, 2).join(', ') || '—',
          gateIn,
          matIn,
          matOut,
          l.isCompleted ? '✓ COMPLETE' : l.processStatus
        ];
      });

      autoTable(doc, {
        startY: 68,
        margin: { left: 30, right: 30 },
        theme: 'grid',
        head: [['#', 'Lot No & Style', 'Target', 'RGP Tags', 'RGP Dori', 'RGP Zip/Trims', 'Dori PO', 'Zip PO', 'General PO / Extra', 'Vendors', 'Gate In (Entry)', 'Material In (Store)', 'Material Out (Gate)', 'Process Status']],
        body: tableRows.length > 0 ? tableRows : [['—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', 'No matching lots']],
        styles: { fontSize: 7.5, cellPadding: 3.5, overflow: 'linebreak' },
        headStyles: { fillColor: [0, 75, 135], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      doc.save(`Consolidated_Lot_Operations_Master_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating master PDF:', err);
      alert('Could not generate master PDF: ' + err.message);
    }
  };

  // Print single lot dossier modal view
  const handlePrintLotDossier = (lot) => {
    setSelectedLotForModal(lot);
    setTimeout(() => {
      window.print();
    }, 300);
  };

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
        <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>Analyze manufacturing cost expenditures, check PO archives, inspect material consumption by Lot, and audit Returnable Gate Passes (RGPs).</p>
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
          onClick={() => setActiveReportTab('master_operations_report')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'master_operations_report' ? 'var(--accent-color, #2563eb)' : 'transparent',
            color: activeReportTab === 'master_operations_report' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FileSpreadsheet size={14} />
          <span>Master Operations Report ({filteredMasterRecords.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('lot_wise_report')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'lot_wise_report' ? 'var(--accent-color, #2563eb)' : 'transparent',
            color: activeReportTab === 'lot_wise_report' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Layers size={14} />
          <span>Lot-Wise Operations Report ({filteredLotWiseList.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('item_code_report')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'item_code_report' ? 'var(--accent-color, #2563eb)' : 'transparent',
            color: activeReportTab === 'item_code_report' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Boxes size={14} />
          <span>Item Code Master Report &amp; Ledger</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('daily_weekly_calendar')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'daily_weekly_calendar' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'daily_weekly_calendar' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Calendar size={14} />
          <span>Daily &amp; Weekly Calendar</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('rgp_reports')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'rgp_reports' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'rgp_reports' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Truck size={14} />
          <span>RGP Pass Register ({processedRgpList.length || 0})</span>
        </button>
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
          <PackageCheck size={14} />
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
        <button
          type="button"
          onClick={() => setActiveReportTab('analytics_charts')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeReportTab === 'analytics_charts' ? 'var(--accent-color)' : 'transparent',
            color: activeReportTab === 'analytics_charts' ? '#ffffff' : 'var(--text-main)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <BarChart3 size={14} />
          <span>Analytics &amp; Graphs</span>
        </button>
      </div>


      {activeReportTab === 'master_operations_report' && (
        <div className="animate-scale" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Header Card */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            backgroundColor: 'var(--bg-secondary)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#004b87',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 75, 135, 0.25)'
              }}>
                {masterModuleFilter === 'rgp' || masterModuleFilter === 'rgp_closed' ? (
                  <Truck size={22} />
                ) : masterModuleFilter === 'scanner' ? (
                  <QrCode size={22} />
                ) : masterModuleFilter === 'extra_pieces' ? (
                  <Boxes size={22} />
                ) : (
                  <FileSpreadsheet size={22} />
                )}
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '800',
                  color: 'var(--text-main)',
                  letterSpacing: '-0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>{getMasterReportTitle()}</span>
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Real-time multi-filter reporting across RGP Passes, Dori PO, Zip PO, General POs, Extra Pieces Requisitions &amp; QR Scanner Logs.
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetMasterFilters}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
                title="Reset all search queries and date filters"
              >
                <RotateCcw size={14} />
                <span>Back / Reset</span>
              </button>

              <button
                type="button"
                onClick={fetchAllMasterData}
                disabled={masterLoading}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
                title="Live reload from MySQL database"
              >
                <RefreshCw size={14} className={masterLoading ? 'animate-spin' : ''} />
                <span>{masterLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportMasterExcel(filteredMasterRecords, getMasterReportTitle())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                  transition: 'all 0.15s'
                }}
                title="Download complete filtered dataset to CSV / Excel spreadsheet"
              >
                <FileSpreadsheet size={15} />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportMasterPDF(filteredMasterRecords, getMasterReportTitle())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s'
                }}
                title="Generate print-ready multi-page PDF Report document"
              >
                <Download size={15} />
                <span>PDF Report</span>
              </button>
            </div>
          </div>

          {/* Badges and Summary Chips Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '4px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {(() => {
                const badge = getMasterFilterBadge();
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: badge.color }}></span>
                    <span>{badge.text}</span>
                  </span>
                );
              })()}

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}>
                <BarChart3 size={13} />
                <span>{filteredMasterRecords.length} Records</span>
              </span>

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)'
              }}>
                <Search size={13} />
                <span>Real-time Search &amp; Filters</span>
              </span>

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <CheckCircle size={13} />
                <span>Live MySQL Sync</span>
              </span>
            </div>

            {/* Metric summary numbers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <span>Total Qty/Pcs: <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>{masterKPIStats.totalPieces.toLocaleString()}</strong></span>
              <span>Closed/Returned: <strong style={{ color: '#10b981', fontSize: '13px' }}>{masterKPIStats.closedCount}</strong></span>
              <span>Open/In-Transit: <strong style={{ color: '#f59e0b', fontSize: '13px' }}>{masterKPIStats.openCount}</strong></span>
            </div>
          </div>

          {/* Filter Bar with Search, Module, Department, Status, Date Pickers */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '14px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
              <Search size={15} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Search anything..."
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                style={{
                  paddingLeft: '36px',
                  paddingRight: masterSearch ? '30px' : '12px',
                  height: '38px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary, #ffffff)',
                  color: 'var(--text-main)',
                  width: '100%',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
              {masterSearch && (
                <button
                  type="button"
                  onClick={() => setMasterSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Module / Record Category Filter */}
            <select
              value={masterModuleFilter}
              onChange={(e) => setMasterModuleFilter(e.target.value)}
              style={{
                height: '38px',
                fontSize: '13px',
                fontWeight: '600',
                padding: '0 28px 0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-primary, #ffffff)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '170px'
              }}
            >
              <option value="all">📦 All Modules &amp; Categories</option>
              <option value="rgp_closed">🔴 Closed RGP Only</option>
              <option value="rgp">🚚 All RGP Passes</option>
              <option value="rgp_intransit">🟡 In-Transit RGP Only</option>
              <option value="rgp_overdue">🚨 Overdue RGP Only</option>
              <option value="dori_po">🧵 Dori PO (Thread Orders)</option>
              <option value="zip_po">✂️ Zip PO (Zipper Orders)</option>
              <option value="po">📋 General Purchase Orders</option>
              <option value="extra_pieces">⚡ PO Extra Pieces Requisitions</option>
              <option value="scanner">📲 All Scanner Logs</option>
              <option value="scanner_gate_entry">🔒 Gate Entry (Gate In) Only</option>
              <option value="scanner_material_in">📦 Material Entry / Received Only</option>
              <option value="scanner_supplier">🏭 Supplier Check-In Only</option>
              <option value="scanner_printing">🖨️ Printing Gate Out Only</option>
              <option value="scanner_rgp">🚚 RGP Dispatch &amp; Return Scans</option>
            </select>

            {/* Department Dropdown */}
            <select
              value={masterDeptFilter}
              onChange={(e) => setMasterDeptFilter(e.target.value)}
              style={{
                height: '38px',
                fontSize: '13px',
                fontWeight: '600',
                padding: '0 28px 0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-primary, #ffffff)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '150px'
              }}
            >
              <option value="all">🏢 All Departments</option>
              <option value="Store">Store</option>
              <option value="Stitching">Stitching</option>
              <option value="Sampling">Sampling</option>
              <option value="Production">Production</option>
              <option value="Cutting">Cutting</option>
              <option value="Finishing">Finishing</option>
              <option value="Quality">Quality</option>
              <option value="Packing">Packing</option>
              <option value="Dyeing">Dyeing</option>
              <option value="Printing">Printing</option>
              <option value="jacket">jacket</option>
              <option value="Other">Other</option>
            </select>

            {/* Status Filter */}
            <select
              value={masterStatusFilter}
              onChange={(e) => setMasterStatusFilter(e.target.value)}
              style={{
                height: '38px',
                fontSize: '13px',
                fontWeight: '600',
                padding: '0 28px 0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-primary, #ffffff)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '135px'
              }}
            >
              <option value="all">⚙️ All Statuses</option>
              <option value="closed">Closed / Returned</option>
              <option value="in_transit">In Transit / Pending</option>
              <option value="overdue">Overdue</option>
              <option value="verified">Verified / Approved</option>
              <option value="scanned">Scanned / Received</option>
            </select>

            {/* Date Range Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={masterDateFrom}
                onChange={(e) => setMasterDateFrom(e.target.value)}
                style={{
                  height: '38px',
                  fontSize: '12.5px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary, #ffffff)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
                title="From Date"
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={masterDateTo}
                onChange={(e) => setMasterDateTo(e.target.value)}
                style={{
                  height: '38px',
                  fontSize: '12.5px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary, #ffffff)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
                title="To Date"
              />
            </div>

            {/* Date Preset Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('today')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('this_week')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('this_month')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Month
              </button>
              {(masterDateFrom || masterDateTo) && (
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('clear')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '5px',
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
          </div>

          {/* Master Data Table */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'left'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#004b87',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    whiteSpace: 'nowrap'
                  }}>
                    <th style={{ padding: '13px 14px', width: '130px' }}>RGP / DOC NO</th>
                    <th style={{ padding: '13px 14px', width: '115px' }}>MATERIAL OUT DATE</th>
                    <th style={{ padding: '13px 14px', width: '120px' }}>RGP TYPE</th>
                    <th style={{ padding: '13px 14px', width: '110px' }}>DEPARTMENT</th>
                    <th style={{ padding: '13px 14px', width: '140px' }}>VENDOR / PARTY</th>
                    <th style={{ padding: '13px 14px', width: '120px' }}>PURPOSE</th>
                    <th style={{ padding: '13px 14px', minWidth: '220px' }}>ITEM DESCRIPTION</th>
                    <th style={{ padding: '13px 14px', width: '110px', textAlign: 'right' }}>QUANTITY SENT</th>
                    <th style={{ padding: '13px 14px', width: '70px', textAlign: 'center' }}>UOM</th>
                    <th style={{ padding: '13px 14px', width: '130px', textAlign: 'center' }}>EXP / STATUS</th>
                    <th style={{ padding: '13px 14px', width: '90px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <AlertCircle size={32} color="#94a3b8" />
                          <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>No matching operational records found</strong>
                          <p style={{ margin: 0, fontSize: '13px' }}>Try adjusting your search keywords, department filter, module filter or date range.</p>
                          <button
                            type="button"
                            onClick={handleResetMasterFilters}
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: '8px' }}
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMasterRecords.map((r, idx) => {
                      const isEven = idx % 2 === 0;
                      const isClosed = String(r.status).toLowerCase().includes('returned') || String(r.status).toLowerCase().includes('closed');
                      const isOverdue = String(r.status).toLowerCase().includes('overdue');
                      const isInTransit = String(r.status).toLowerCase().includes('transit') || String(r.status).toLowerCase().includes('open');
                      const isScanner = r.moduleType === 'scanner';
                      const hasLinkedScans = r.scans && r.scans.length > 0;

                      return (
                        <tr
                          key={r.id || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: isEven ? 'var(--bg-secondary)' : 'var(--bg-primary, #f8fafc)',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 75, 135, 0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isEven ? 'var(--bg-secondary)' : 'var(--bg-primary, #f8fafc)'}
                        >
                          {/* Doc / RGP No */}
                          <td style={{ padding: '12px 14px', fontWeight: '800' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ color: '#004b87', fontSize: '13px' }}>{r.docNo}</span>
                              <span style={{
                                fontSize: '9.5px',
                                fontWeight: '800',
                                width: 'fit-content',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: `${r.badgeColor}18`,
                                color: r.badgeColor
                              }}>
                                {r.moduleLabel}
                              </span>
                            </div>
                          </td>

                          {/* Material Out Date */}
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(r.date) || r.date || '—'}
                          </td>

                          {/* RGP Type */}
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-main)', fontWeight: '600' }}>
                            {r.type}
                          </td>

                          {/* Department */}
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                            {r.department || 'Store'}
                          </td>

                          {/* Vendor / Party */}
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                            {r.vendor || '—'}
                          </td>

                          {/* Purpose */}
                          <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {r.purpose || '—'}
                          </td>

                          {/* Item Description */}
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-main)' }}>
                            {r.items && r.items.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => setSelectedMasterRecordForModal(r)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: '#004b87',
                                  fontWeight: '700',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{r.itemDescription}</span>
                                <ArrowUpRight size={12} />
                              </button>
                            ) : (
                              <span>{r.itemDescription}</span>
                            )}
                          </td>

                          {/* Quantity Sent */}
                          <td style={{ padding: '12px 14px', fontSize: '13.5px', fontWeight: '800', textAlign: 'right', color: 'var(--text-main)' }}>
                            {Number(r.quantity || 0).toLocaleString()}
                          </td>

                          {/* UOM */}
                          <td style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: '700', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {r.uom || 'PCS'}
                          </td>

                          {/* Status & Expected Date / Scanner Verification */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '800',
                                backgroundColor: isScanner
                                  ? `${r.badgeColor}18`
                                  : isClosed 
                                    ? 'rgba(16, 185, 129, 0.12)' 
                                    : isOverdue 
                                      ? 'rgba(239, 68, 68, 0.12)' 
                                      : 'rgba(245, 158, 11, 0.12)',
                                color: isScanner ? r.badgeColor : (isClosed ? '#10b981' : isOverdue ? '#ef4444' : '#f59e0b'),
                                border: `1px solid ${isScanner ? `${r.badgeColor}35` : (isClosed ? 'rgba(16, 185, 129, 0.25)' : isOverdue ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)')}`
                              }}>
                                {r.status}
                              </span>

                              {/* Linked Gate Scanner Badge */}
                              {!isScanner && hasLinkedScans && (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '700',
                                  color: '#06b6d4',
                                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  <QrCode size={9} />
                                  <span>{r.scans.length} Scan{r.scans.length > 1 ? 's' : ''} Logged</span>
                                </span>
                              )}

                              {r.expectedReturnDate && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  Exp: {formatDateTime(r.expectedReturnDate)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedMasterRecordForModal(r)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', height: '28px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="View complete record details and verification logs"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Master Record Details Modal */}
          {selectedMasterRecordForModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}>
              <div className="animate-scale" style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: `${selectedMasterRecordForModal.badgeColor}20`,
                      color: selectedMasterRecordForModal.badgeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {selectedMasterRecordForModal.moduleType === 'scanner' ? <QrCode size={18} /> : <FileText size={18} />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-main)' }}>
                        {selectedMasterRecordForModal.docNo}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {selectedMasterRecordForModal.moduleLabel} Details &bull; {formatDateTime(selectedMasterRecordForModal.date)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMasterRecordForModal(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Overview Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Vendor / Party / Destination</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedMasterRecordForModal.vendor || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Department</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedMasterRecordForModal.department || 'Store'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Purpose / Checkpoint</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedMasterRecordForModal.purpose || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Quantity</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{Number(selectedMasterRecordForModal.quantity || 0).toLocaleString()} {selectedMasterRecordForModal.uom}</strong>
                  </div>
                  {selectedMasterRecordForModal.vehicleNo && (
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Vehicle No</span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedMasterRecordForModal.vehicleNo}</strong>
                    </div>
                  )}
                  {selectedMasterRecordForModal.cost && (
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Amount</span>
                      <strong style={{ fontSize: '13.5px', color: '#059669' }}>₹{Number(selectedMasterRecordForModal.cost).toLocaleString()}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Verification Status</span>
                    <strong style={{ fontSize: '13.5px', color: '#10b981' }}>{selectedMasterRecordForModal.status}</strong>
                  </div>
                </div>

                {/* Items Table */}
                {selectedMasterRecordForModal.items && selectedMasterRecordForModal.items.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 10px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Boxes size={16} color="#6366f1" />
                      <span>Material / Items Breakdown ({selectedMasterRecordForModal.items.length} items)</span>
                    </h4>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '8px 10px' }}>#</th>
                            <th style={{ padding: '8px 10px' }}>Lot No</th>
                            <th style={{ padding: '8px 10px' }}>Item Description</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty 1</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty 2</th>
                            <th style={{ padding: '8px 10px' }}>UOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMasterRecordForModal.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color: '#7c3aed' }}>{it.lotNo ? `#${it.lotNo}` : '—'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '600' }}>{it.itemDesc || it.description || it.name || it.bomItemName || 'Item'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>{Number(it.qty1 || it.qty || it.totalRequired || 0).toLocaleString()}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{it.qty2 || '—'}</td>
                              <td style={{ padding: '8px 10px' }}>{it.uom || it.unit || 'PCS'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Security Gate & Material Scanner Verification Trail */}
                {selectedMasterRecordForModal.scans && selectedMasterRecordForModal.scans.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 10px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <QrCode size={16} color="#06b6d4" />
                      <span>Security Gate &amp; Material Scanner Verification Trail ({selectedMasterRecordForModal.scans.length} events)</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedMasterRecordForModal.scans.map((s, idx) => {
                        const isReturn = s.scan_type === 'rgp_return';
                        const isGateIn = s.scan_type === 'gate_entry';
                        const isMatIn = s.scan_type === 'material_in';
                        const isPrinting = s.scan_type === 'printing_gate_out';

                        let badgeText = 'Gate Entry (Gate In)';
                        let badgeBg = 'rgba(16, 185, 129, 0.15)';
                        let badgeColor = '#10b981';

                        if (isReturn) {
                          badgeText = 'Gate In (Return)';
                          badgeBg = 'rgba(236, 72, 153, 0.15)';
                          badgeColor = '#ec4899';
                        } else if (isMatIn) {
                          badgeText = 'Material Received';
                          badgeBg = 'rgba(59, 130, 246, 0.15)';
                          badgeColor = '#3b82f6';
                        } else if (isPrinting) {
                          badgeText = 'Printing Gate Out';
                          badgeBg = 'rgba(249, 115, 22, 0.15)';
                          badgeColor = '#f97316';
                        } else if (s.scan_type === 'rgp_entry') {
                          badgeText = 'Gate Out (Dispatch)';
                          badgeBg = 'rgba(168, 85, 247, 0.15)';
                          badgeColor = '#a855f7';
                        }

                        return (
                          <div key={idx} style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12.5px',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: '800',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                marginRight: '8px'
                              }}>
                                {badgeText}
                              </span>
                              <strong>Guard/Officer: {s.person_name || 'Security'}</strong> &bull; {s.material_name || 'Goods'} ({s.quantity || 0} pcs) &bull; Party: {s.supplier_name || 'Vendor'}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} />
                              <span>{formatDateTime(s.scanned_at || s.timestamp)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Prepared: <strong>{selectedMasterRecordForModal.preparedBy || 'Store Incharge'}</strong>
                    {selectedMasterRecordForModal.authorizedBy && <> &bull; Authorized: <strong>{selectedMasterRecordForModal.authorizedBy}</strong></>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedMasterRecordForModal(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeReportTab === 'lot_wise_report' && (
        <div className="animate-scale" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Header Card */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            backgroundColor: 'var(--bg-secondary)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
              }}>
                <Layers size={22} />
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '800',
                  color: 'var(--text-main)',
                  letterSpacing: '-0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>Consolidated Lot-Wise Operations &amp; Verification Register</span>
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Complete single-view operations master register: RGP Tags, RGP Dori, RGP Zip, Dori PO, Zip PO, General PO, Extra Pieces &amp; Gate Scanner Checkpoints visible in one line.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="print-hide" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetLotFilters}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: '36px', padding: '0 12px' }}
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>

              <button
                type="button"
                onClick={fetchLotWiseData}
                disabled={lotWiseLoading}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: '36px', padding: '0 12px' }}
              >
                <RefreshCw size={13} className={lotWiseLoading ? 'spin' : ''} />
                <span>{lotWiseLoading ? 'Syncing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: '36px', padding: '0 14px' }}
              >
                <Printer size={14} />
                <span>Print Master Register</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAllLotsPDF}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: '36px', padding: '0 14px', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
              >
                <Download size={14} />
                <span>PDF Master (A3)</span>
              </button>

              <button
                type="button"
                onClick={handleExportLotSummaryExcel}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: '36px', padding: '0 14px', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
              >
                <FileSpreadsheet size={14} />
                <span>Excel Export</span>
              </button>
            </div>
          </div>

          {/* Visual Analytics & Graphs Dashboard */}
          <div className="print-hide" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px'
          }}>
            {/* Graph 1: Process Completion & Pipeline Health Gauge */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} color="#7c3aed" />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Pipeline Process Health</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                  {lotWiseKPIStats.total > 0 ? Math.round((lotWiseKPIStats.completed / lotWiseKPIStats.total) * 100) : 0}% Fully Complete
                </span>
              </div>

              {/* Progress Multi-Bar */}
              <div style={{ width: '100%', height: '14px', borderRadius: '7px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', display: 'flex', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <div style={{ width: `${lotWiseKPIStats.total > 0 ? (lotWiseKPIStats.completed / lotWiseKPIStats.total) * 100 : 0}%`, backgroundColor: '#10b981' }} title={`Complete: ${lotWiseKPIStats.completed}`} />
                <div style={{ width: `${lotWiseKPIStats.total > 0 ? (lotWiseKPIStats.overdueCount / lotWiseKPIStats.total) * 100 : 0}%`, backgroundColor: '#f59e0b' }} title={`Pending RGP: ${lotWiseKPIStats.overdueCount}`} />
                <div style={{ width: `${lotWiseKPIStats.total > 0 ? (Math.max(0, lotWiseKPIStats.inProgress - lotWiseKPIStats.overdueCount) / lotWiseKPIStats.total) * 100 : 0}%`, backgroundColor: '#3b82f6' }} title={`In Progress: ${lotWiseKPIStats.inProgress}`} />
              </div>

              {/* Legend & Numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11.5px' }}>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>✓ Completed</span>
                  <strong style={{ fontSize: '14px', color: '#059669' }}>{lotWiseKPIStats.completed} lots</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>⏳ Pending RGP</span>
                  <strong style={{ fontSize: '14px', color: '#d97706' }}>{lotWiseKPIStats.overdueCount} lots</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>⚡ In Progress</span>
                  <strong style={{ fontSize: '14px', color: '#2563eb' }}>{lotWiseKPIStats.inProgress} lots</strong>
                </div>
              </div>
            </div>

            {/* Graph 2: Volume Comparison Graph */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={16} color="#06b6d4" />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Production Volume Metrics</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target vs Verified</span>
              </div>

              {/* Volume Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cutting Planned Target</span>
                    <strong style={{ color: '#06b6d4' }}>{lotWiseKPIStats.totalTargetPcs.toLocaleString()} PCS</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#06b6d4' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Materials Store Inward Received</span>
                    <strong style={{ color: '#10b981' }}>{lotWiseKPIStats.totalReceivedPcs.toLocaleString()} PCS</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${lotWiseKPIStats.totalTargetPcs > 0 ? Math.min(100, (lotWiseKPIStats.totalReceivedPcs / lotWiseKPIStats.totalTargetPcs) * 100) : (lotWiseKPIStats.totalReceivedPcs > 0 ? 100 : 0)}%`,
                      height: '100%',
                      backgroundColor: '#10b981'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Graph 3: 4-Step Security Gate & Scanner Flow Funnel */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={16} color="#ec4899" />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Security &amp; Gate Scanner Funnel</span>
                </div>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '700' }}>Active Checkpoints</span>
              </div>

              {/* 4 Funnel Checkpoint Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                <div style={{ padding: '6px 4px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block' }}>1. Gate In</span>
                  <strong style={{ fontSize: '13px', color: '#10b981' }}>
                    {filteredLotWiseList.reduce((s, l) => s + (l.gateInScans?.length || 0), 0)}
                  </strong>
                </div>
                <div style={{ padding: '6px 4px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block' }}>2. Store In</span>
                  <strong style={{ fontSize: '13px', color: '#3b82f6' }}>
                    {filteredLotWiseList.reduce((s, l) => s + (l.materialInScans?.length || 0), 0)}
                  </strong>
                </div>
                <div style={{ padding: '6px 4px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block' }}>3. Gate Out</span>
                  <strong style={{ fontSize: '13px', color: '#a855f7' }}>
                    {filteredLotWiseList.reduce((s, l) => s + (l.materialOutScans?.length || 0), 0)}
                  </strong>
                </div>
                <div style={{ padding: '6px 4px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block' }}>4. RGP Ret</span>
                  <strong style={{ fontSize: '13px', color: '#06b6d4' }}>
                    {filteredLotWiseList.reduce((s, l) => s + (l.rgpReturnScans?.length || 0), 0)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="print-hide" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            backgroundColor: 'var(--bg-secondary)',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search Lot #, Style, Brand, Material, Vendor, RGP, PO..."
                className="form-input"
                value={lotSearch}
                onChange={(e) => setLotSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '34px', height: '36px', fontSize: '12.5px' }}
              />
              {lotSearch && (
                <button
                  type="button"
                  onClick={() => setLotSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '170px' }}>
              <select
                className="form-select"
                value={lotStatusFilter}
                onChange={(e) => setLotStatusFilter(e.target.value)}
                style={{ width: '100%', height: '36px', fontSize: '12px', fontWeight: '600' }}
              >
                <option value="all">All Process Statuses</option>
                <option value="complete">✓ Complete (All Processes Over)</option>
                <option value="in_progress">In Progress (Active)</option>
                <option value="pending_rgp">Pending RGP Return</option>
                <option value="pending_gate">Pending Gate Entry (Gate In)</option>
                <option value="pending_receive">Pending Store Check-In</option>
                <option value="overdue">Overdue RGPs</option>
                <option value="bom_registered">BOM Registered Only</option>
              </select>
            </div>

            {/* Brand Filter */}
            {uniqueLotBrands.length > 0 && (
              <div style={{ minWidth: '140px' }}>
                <select
                  className="form-select"
                  value={lotBrandFilter}
                  onChange={(e) => setLotBrandFilter(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '12px', fontWeight: '600' }}
                >
                  <option value="all">All Brands / Clients</option>
                  {uniqueLotBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Selector */}
            <div style={{ minWidth: '160px' }}>
              <select
                className="form-select"
                value={lotSort}
                onChange={(e) => setLotSort(e.target.value)}
                style={{ width: '100%', height: '36px', fontSize: '12px', fontWeight: '600' }}
              >
                <option value="lot_desc">Lot No (Highest First)</option>
                <option value="lot_asc">Lot No (Lowest First)</option>
                <option value="target_desc">Target Units (High to Low)</option>
                <option value="target_asc">Target Units (Low to High)</option>
                <option value="ops_desc">Most Operations Count</option>
              </select>
            </div>
          </div>

          {/* Master Multi-Column One-Line Operations Table */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '1500px' }}>
                <thead>
                  <tr style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderBottom: '2px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    whiteSpace: 'nowrap'
                  }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: '35px' }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '160px' }}>LOT NO. &amp; STYLE</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>TARGET PCS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '190px' }}>RGP (TAGS &amp; LABELS)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '190px' }}>RGP (DORI / DRAWSTRING)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '160px' }}>RGP (ZIP &amp; TRIMS)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '150px' }}>DORI PO ORDERS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '150px' }}>ZIP PO ORDERS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '150px' }}>GENERAL PO &amp; EXTRAS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '130px' }}>VENDORS / PARTIES</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '170px' }}>GATE ENTRY (GATE IN)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '170px' }}>MATERIAL IN (STORE)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '160px' }}>MATERIAL OUT (DISPATCH)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', minWidth: '140px' }}>PROCESS STATUS</th>
                    <th className="print-hide" style={{ padding: '10px 12px', textAlign: 'right', minWidth: '110px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLotWiseList.map((lot, idx) => {
                    const isCompleted = lot.isCompleted;

                    let statusBadgeBg = 'rgba(59, 130, 246, 0.12)';
                    let statusBadgeColor = '#2563eb';
                    let statusBadgeBorder = 'rgba(59, 130, 246, 0.25)';

                    if (isCompleted) {
                      statusBadgeBg = 'rgba(16, 185, 129, 0.15)';
                      statusBadgeColor = '#059669';
                      statusBadgeBorder = 'rgba(16, 185, 129, 0.35)';
                    } else if (String(lot.processStatus).toLowerCase().includes('overdue')) {
                      statusBadgeBg = 'rgba(239, 68, 68, 0.15)';
                      statusBadgeColor = '#dc2626';
                      statusBadgeBorder = 'rgba(239, 68, 68, 0.35)';
                    } else if (String(lot.processStatus).toLowerCase().includes('pending rgp')) {
                      statusBadgeBg = 'rgba(168, 85, 247, 0.15)';
                      statusBadgeColor = '#7c3aed';
                      statusBadgeBorder = 'rgba(168, 85, 247, 0.3)';
                    } else if (String(lot.processStatus).toLowerCase().includes('pending gate')) {
                      statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
                      statusBadgeColor = '#d97706';
                      statusBadgeBorder = 'rgba(245, 158, 11, 0.3)';
                    }

                    return (
                      <tr
                        key={lot.lotNo}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        {/* 1. Serial # */}
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {idx + 1}
                        </td>

                        {/* 2. Lot No & Style & Brand */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '800', fontSize: '13.5px', color: '#7c3aed' }}>
                              #{lot.lotNo}
                            </span>
                            {lot.isRecreated && (
                              <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                                RUN-V
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px', fontSize: '12px' }}>
                            {lot.style || 'Custom Design'}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {lot.brand && <span>{lot.brand} &bull; </span>}
                            <span>{lot.fabricType || 'Fabric'}</span>
                          </div>
                        </td>

                        {/* 3. Target Cutting Pcs */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--text-main)' }}>
                            {Number(lot.targetPieces || 0).toLocaleString()}
                          </span>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block' }}>PCS</span>
                        </td>

                        {/* 4. RGP (Tags & Labels) */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.rgpTagList && lot.rgpTagList.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {lot.rgpTagList.map((t, tI) => (
                                <div key={tI} style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ color: '#7c3aed', fontSize: '11px' }}>{t.rgpNo}</strong>
                                    <span style={{ fontSize: '9.5px', fontWeight: '800', color: t.status === 'Returned' ? '#10b981' : '#7c3aed' }}>{t.status}</span>
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-main)', marginTop: '1px' }}>
                                    {t.itemDesc} &bull; <strong>{t.qty} {t.uom}</strong>
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    Party: {t.vendor} {t.purpose && `(${t.purpose})`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 5. RGP (Dori / Drawstring) */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.rgpDoriList && lot.rgpDoriList.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {lot.rgpDoriList.map((d, dI) => (
                                <div key={dI} style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ color: '#d97706', fontSize: '11px' }}>{d.rgpNo}</strong>
                                    <span style={{ fontSize: '9.5px', fontWeight: '800', color: d.status === 'Returned' ? '#10b981' : '#d97706' }}>{d.status}</span>
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-main)', marginTop: '1px' }}>
                                    {d.itemDesc} &bull; <strong>{d.qty} {d.uom}</strong>
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    Party: {d.vendor} {d.purpose && `(${d.purpose})`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 6. RGP (Zip & Other Trims) */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.rgpZipList && lot.rgpZipList.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {lot.rgpZipList.map((z, zI) => (
                                <div key={zI} style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: 'rgba(236, 72, 153, 0.06)', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ color: '#db2777', fontSize: '11px' }}>{z.rgpNo}</strong>
                                    <span style={{ fontSize: '9.5px', fontWeight: '800', color: z.status === 'Returned' ? '#10b981' : '#db2777' }}>{z.status}</span>
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-main)', marginTop: '1px' }}>
                                    {z.itemDesc} &bull; <strong>{z.qty} {z.uom}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 7. Dori PO Orders */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.dooriOrders && lot.dooriOrders.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {lot.dooriOrders.map((d, dI) => (
                                <div key={dI} style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                                  <strong style={{ color: '#d97706', fontSize: '11px' }}>PO #{d.po_number || d.Lot_Number}</strong>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-main)', marginTop: '1px' }}>
                                    <strong>{d.Total_Pieces} pcs</strong> &bull; {d.Garment_Type || d.Style || 'Dori'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 8. Zip PO Orders */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.zipOrders && lot.zipOrders.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {lot.zipOrders.map((z, zI) => (
                                <div key={zI} style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                                  <strong style={{ color: '#db2777', fontSize: '11px' }}>PO #{z.po_number || z.Lot_Number}</strong>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-main)', marginTop: '1px' }}>
                                    <strong>{z.Total_Pieces_CH || z.Total_Pieces} pcs</strong> &bull; {z.Teeth_Color || 'Teeth'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 9. General PO & Extras */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.pos?.length > 0 || lot.extraIssues?.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {(lot.pos || []).map((p, pI) => (
                                <div key={pI} style={{ padding: '3px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: '10.5px' }}>
                                  <strong style={{ color: '#2563eb' }}>PO #{p.poNumber}</strong> &bull; ₹{Number(p.total || 0).toLocaleString()}
                                </div>
                              ))}
                              {(lot.extraIssues || []).map((ex, exI) => (
                                <div key={exI} style={{ padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '10.5px', color: '#dc2626' }}>
                                  <strong>Extra #{ex.voucher_id || ex.voucherId || ex.id}</strong> ({ex.reason || 'Extra'})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 10. Vendors / Parties */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-main)' }}>
                            {(lot.vendors || []).join(', ') || 'Internal Store'}
                          </div>
                        </td>

                        {/* 11. Gate Entry (Gate In) */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.gateInScans && lot.gateInScans.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {lot.gateInScans.map((sc, scI) => (
                                <div key={scI} style={{ fontSize: '10.5px', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  <strong style={{ color: '#059669' }}>✓ Gate In: {sc.quantity || 0} pcs</strong>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                    {sc.person_name || 'Guard'} &bull; {sc.supplier_name || 'Party'} &bull; {formatDateTime(sc.scanned_at || sc.timestamp)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontStyle: 'italic' }}>No Gate In Scan</span>
                          )}
                        </td>

                        {/* 12. Material In (Store Received) */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.materialInScans && lot.materialInScans.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {lot.materialInScans.map((sc, scI) => (
                                <div key={scI} style={{ fontSize: '10.5px', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                  <strong style={{ color: '#2563eb' }}>✓ Inward: {sc.quantity || 0} pcs</strong> ({sc.material_name || 'Goods'})
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                    {sc.person_name || 'Verifier'} &bull; {formatDateTime(sc.scanned_at || sc.timestamp)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontStyle: 'italic' }}>Pending Inward</span>
                          )}
                        </td>

                        {/* 13. Material Out (Gate Dispatch) */}
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.materialOutScans && lot.materialOutScans.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {lot.materialOutScans.map((sc, scI) => (
                                <div key={scI} style={{ fontSize: '10.5px', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                  <strong style={{ color: '#7c3aed' }}>Gate Out: {sc.quantity || 0} pcs</strong>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                    {sc.person_name || 'Guard'} &bull; {formatDateTime(sc.scanned_at || sc.timestamp)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontStyle: 'italic' }}>No Gate Out</span>
                          )}
                        </td>

                        {/* 14. Process Status */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            backgroundColor: statusBadgeBg,
                            color: statusBadgeColor,
                            border: `1px solid ${statusBadgeBorder}`,
                            fontSize: '10.5px',
                            fontWeight: '800',
                            letterSpacing: '-0.1px',
                            whiteSpace: 'nowrap'
                          }}>
                            {isCompleted ? '✓ COMPLETE (All Over)' : lot.processStatus}
                          </div>
                        </td>

                        {/* 15. Actions */}
                        <td className="print-hide" style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedLotForModal(lot)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 7px', fontSize: '11px', height: '26px' }}
                              title="Inspect Full Lot Operations Dossier"
                            >
                              <Eye size={11} />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadLotPDF(lot)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 7px', fontSize: '11px', height: '26px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              title="Download Lot Audit PDF"
                            >
                              <Download size={11} />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLotWiseList.length === 0 && (
                    <tr>
                      <td colSpan={15} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Layers size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4, display: 'block' }} />
                        <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>No Manufacturing Lots Found</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>Try adjusting search filters, brand selection, or process status.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Print Signature Authority Section for Physical Printing */}
            <div className="print-only" style={{
              display: 'none',
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '2px solid #333',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ width: '160px', borderTop: '1px solid #000', marginBottom: '4px' }}></div>
                <strong style={{ fontSize: '11px' }}>Prepared By (Store Incharge)</strong>
              </div>
              <div>
                <div style={{ width: '160px', borderTop: '1px solid #000', marginBottom: '4px' }}></div>
                <strong style={{ fontSize: '11px' }}>Security Gate Officer</strong>
              </div>
              <div>
                <div style={{ width: '160px', borderTop: '1px solid #000', marginBottom: '4px' }}></div>
                <strong style={{ fontSize: '11px' }}>Factory Manager / Plant Head</strong>
              </div>
            </div>
          </div>

          {/* Single Lot Dossier & Print View Modal */}
          {selectedLotForModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px'
              }}
              onClick={() => setSelectedLotForModal(null)}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  maxWidth: '880px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: '#7c3aed',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                        Manufacturing Lot Operations Dossier — Lot #{selectedLotForModal.lotNo}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Consolidated Process Lifecycle Audit &bull; Generated: {new Date().toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLotForModal(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Lot Overview Specs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                  backgroundColor: 'var(--bg-primary)',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Lot Reference</span>
                    <strong style={{ fontSize: '14px', color: '#7c3aed' }}>#{selectedLotForModal.lotNo}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Style Code</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedLotForModal.style || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Brand / Client</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedLotForModal.brand || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Fabric Type</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{selectedLotForModal.fabricType || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Target Pieces</span>
                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{Number(selectedLotForModal.targetPieces || 0).toLocaleString()} PCS</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Lifecycle Status</span>
                    <strong style={{ fontSize: '13.5px', color: selectedLotForModal.isCompleted ? '#10b981' : '#f59e0b' }}>
                      {selectedLotForModal.isCompleted ? '✓ COMPLETE (All Processes Finished)' : selectedLotForModal.processStatus}
                    </strong>
                  </div>
                </div>

                {/* Milestone Process Flow Checklist */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                    Process Milestone Verification Checklist
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '8px'
                  }}>
                    {[
                      { step: '1. BOM & Cutting', done: true },
                      { step: '2. Orders & RGPs', done: (selectedLotForModal.counts?.po + selectedLotForModal.counts?.doori + selectedLotForModal.counts?.zip + selectedLotForModal.counts?.rgp) > 0 },
                      { step: '3. Gate In Scan', done: (selectedLotForModal.gateInScans?.length || 0) > 0 },
                      { step: '4. Material Store In', done: (selectedLotForModal.materialInScans?.length || 0) > 0 },
                      { step: '5. RGP Returns / Closed', done: selectedLotForModal.isCompleted || selectedLotForModal.counts?.rgp === 0 }
                    ].map((st, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          backgroundColor: st.done ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)',
                          border: `1px solid ${st.done ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                          fontSize: '11px',
                          fontWeight: '700',
                          color: st.done ? '#059669' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {st.done ? <Check size={13} color="#10b981" /> : <Clock size={13} />}
                        <span>{st.step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Granular Sub-Records Matrix: RGPs, Dori, Zip, POs */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                    Sub-Orders &amp; Gate Passes Breakdown
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {/* RGPs list */}
                    <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                      <strong style={{ fontSize: '12px', color: '#7c3aed', display: 'block', marginBottom: '6px' }}>
                        Returnable Gate Passes (RGPs) ({selectedLotForModal.rgps?.length || 0})
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                        {(selectedLotForModal.rgps || []).map((r, rI) => (
                          <div key={rI} style={{ padding: '4px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
                            <strong>RGP #{r.rgpNo}</strong> &bull; {r.vendor} &bull; <span style={{ color: r.status === 'Returned' ? '#10b981' : '#7c3aed', fontWeight: '700' }}>{r.status || 'Dispatched'}</span>
                          </div>
                        ))}
                        {(!selectedLotForModal.rgps || selectedLotForModal.rgps.length === 0) && (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No RGP passes</span>
                        )}
                      </div>
                    </div>

                    {/* Dori & Zip */}
                    <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                      <strong style={{ fontSize: '12px', color: '#d97706', display: 'block', marginBottom: '6px' }}>
                        Dori &amp; Zip PO Orders
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                        {(selectedLotForModal.dooriOrders || []).map((d, dI) => (
                          <div key={dI} style={{ padding: '4px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
                            <strong>Dori PO #{d.po_number || d.Lot_Number}</strong>: {d.Total_Pieces} pcs
                          </div>
                        ))}
                        {(selectedLotForModal.zipOrders || []).map((z, zI) => (
                          <div key={zI} style={{ padding: '4px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
                            <strong>Zip PO #{z.po_number || z.Lot_Number}</strong>: {z.Total_Pieces_CH || z.Total_Pieces} pcs ({z.Teeth_Color || 'STD'})
                          </div>
                        ))}
                        {(!selectedLotForModal.dooriOrders?.length && !selectedLotForModal.zipOrders?.length) && (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No Dori/Zip POs</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Itemized Materials Breakdown */}
                {selectedLotForModal.materials && selectedLotForModal.materials.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Boxes size={14} color="#6366f1" />
                      <span>Consolidated Materials &amp; Accessories Manifest ({selectedLotForModal.materials.length} items)</span>
                    </h4>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '7px 10px', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '7px 10px', textAlign: 'left' }}>Material Name</th>
                            <th style={{ padding: '7px 10px', textAlign: 'left' }}>Color / Teeth</th>
                            <th style={{ padding: '7px 10px', textAlign: 'right' }}>Total Qty</th>
                            <th style={{ padding: '7px 10px', textAlign: 'left' }}>Document Source</th>
                            <th style={{ padding: '7px 10px', textAlign: 'left' }}>Placement / Purpose</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLotForModal.materials.map((m, mI) => (
                            <tr key={mI} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{mI + 1}</td>
                              <td style={{ padding: '7px 10px', fontWeight: '600' }}>{m.name}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{m.color || '—'}</td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700' }}>{Number(m.qty).toLocaleString()} {m.uom}</td>
                              <td style={{ padding: '7px 10px', color: '#7c3aed', fontWeight: '600' }}>{m.source}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{m.meta || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Security Gate Scanner Trail */}
                {selectedLotForModal.scans && selectedLotForModal.scans.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <QrCode size={14} color="#06b6d4" />
                      <span>Security Gate &amp; Scanner Inward Verification Trail ({selectedLotForModal.scans.length} scans)</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedLotForModal.scans.map((sc, scI) => (
                        <div
                          key={scI}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            flexWrap: 'wrap',
                            gap: '6px'
                          }}
                        >
                          <div>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: sc.scan_type === 'gate_entry' ? 'rgba(16, 185, 129, 0.15)' : (sc.scan_type === 'material_in' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(124, 58, 237, 0.15)'),
                              color: sc.scan_type === 'gate_entry' ? '#10b981' : (sc.scan_type === 'material_in' ? '#3b82f6' : '#7c3aed'),
                              marginRight: '8px'
                            }}>
                              {sc.scan_type === 'gate_entry' ? 'Gate Entry (Gate In)' : (sc.scan_type === 'material_in' ? 'Material Received' : (sc.scan_type === 'rgp_entry' ? 'Gate Out' : sc.scan_type))}
                            </span>
                            <strong>Guard/Officer: {sc.person_name || 'Security'}</strong> &bull; {sc.material_name || 'Goods'} ({sc.quantity || 0} pcs) &bull; Party: {sc.supplier_name || 'Vendor'}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            <span>{formatDateTime(sc.scanned_at || sc.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures & Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Vendors: <strong>{(selectedLotForModal.vendors || []).join(', ') || 'Internal Store'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadLotPDF(selectedLotForModal)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
                    >
                      <Download size={13} />
                      <span>Download PDF Dossier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintLotDossier(selectedLotForModal)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={13} />
                      <span>Print Dossier</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeReportTab === 'daily_weekly_calendar' && (
        <DailyWeeklyCalendarReport
          issueLogs={allIssueLogs}
          extraMaterialIssues={extraMaterialIssues}
          pos={pos}
          designs={designs}
          scans={scans}
          transfers={transfers}
          weightCaptures={weightCaptures}
          zipOrders={zipOrders}
          dooriOrders={dooriOrders}
          designHistory={designHistory}
          currencySymbol={currencySymbol}
          embeddedIn="report"
        />
      )}

      {activeReportTab === 'item_code_report' && (
        <ItemCodeReportView
          weightCaptures={weightCaptures}
          issueLogs={allIssueLogs}
          transfers={transfers}
          currencySymbol={currencySymbol}
        />
      )}

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
                                        <strong>{detailObj.data.materialName} ({detailObj.data.itemCode || detailObj.data.materialCode || 'Trims'})</strong>
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
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase' }}>Material Name & Item Code</span>
                                        <strong>{detailObj.data.materialName} ({detailObj.data.itemCode || detailObj.data.materialCode || '—'})</strong>
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

      {/* ============================================================ */}
      {/* ANALYTICS & GRAPHS TAB                                        */}
      {/* ============================================================ */}
      {activeReportTab === 'analytics_charts' && (() => {
        // --- Compute analytics from all store audits ---
        const allAudits = getStoreAudits();
        const totalIssues = allAudits.filter(a => a.id.startsWith('IS-')).length;
        const totalExtra = allAudits.filter(a => a.id.startsWith('EX-')).length;
        const totalReturns = allAudits.filter(a => a.id.startsWith('RT-')).length;
        const totalTransfers = allAudits.filter(a => a.id.startsWith('TR-')).length;
        const totalWeight = allAudits.filter(a => a.id.startsWith('WC-')).length;
        const totalScans = allAudits.filter(a => a.id.startsWith('SC-')).length;
        const totalAll = allAudits.length || 1;

        // --- Operation breakdown donut data ---
        const donutData = [
          { label: 'Material Issue', count: totalIssues, color: '#0284c7' },
          { label: 'Extra Requisition', count: totalExtra, color: '#f59e0b' },
          { label: 'Returns', count: totalReturns, color: '#8b5cf6' },
          { label: 'Transfers', count: totalTransfers, color: '#3b82f6' },
          { label: 'Weight Capture', count: totalWeight, color: '#10b981' },
          { label: 'Scans', count: totalScans, color: '#06b6d4' },
        ].filter(d => d.count > 0);

        // --- SVG Donut chart helpers ---
        const donutTotal = donutData.reduce((s, d) => s + d.count, 0) || 1;
        const donutR = 70, donutCx = 90, donutCy = 90, strokeWidth = 28;
        let cumAngle = -90;
        const donutSegments = donutData.map(d => {
          const pct = d.count / donutTotal;
          const startAngle = cumAngle;
          const sweep = pct * 360;
          cumAngle += sweep;
          const toRad = deg => (deg * Math.PI) / 180;
          const x1 = donutCx + donutR * Math.cos(toRad(startAngle));
          const y1 = donutCy + donutR * Math.sin(toRad(startAngle));
          const x2 = donutCx + donutR * Math.cos(toRad(startAngle + sweep));
          const y2 = donutCy + donutR * Math.sin(toRad(startAngle + sweep));
          const largeArc = sweep > 180 ? 1 : 0;
          const pathD = `M ${x1} ${y1} A ${donutR} ${donutR} 0 ${largeArc} 1 ${x2} ${y2}`;
          return { ...d, pct, pathD, sweep };
        });

        // --- 7-day daily operation trend bar chart ---
        const last7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' }), date: d.toDateString(), count: 0 });
        }
        allAudits.forEach(a => {
          const d = new Date(a.date || '');
          const ds = d.toDateString();
          const slot = last7.find(s => s.date === ds);
          if (slot) slot.count++;
        });
        const barMax = Math.max(...last7.map(d => d.count), 1);
        const BAR_H = 120;
        const BAR_W = 30;
        const BAR_GAP = 14;
        const svgBarW = last7.length * (BAR_W + BAR_GAP) + 20;

        // --- Top 5 lots by issue count ---
        const lotCountMap = {};
        (fetchedIssueLogs || []).forEach(l => {
          const k = String(l.lotId || 'Unknown');
          lotCountMap[k] = (lotCountMap[k] || 0) + 1;
        });
        const topLots = Object.entries(lotCountMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const topLotsMax = topLots.length > 0 ? topLots[0][1] : 1;

        // --- PO vs Design count trend ---
        const totalDesigns = designs.length;
        const totalPOs = pos.length;

        return (
          <div className="animate-fade">
            {/* KPI Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Total Operations', value: totalAll, icon: <Activity size={20} />, color: '#0284c7', bg: '#e0f2fe' },
                { label: 'Issues', value: totalIssues, icon: <PackageCheck size={20} />, color: '#0369a1', bg: '#dbeafe' },
                { label: 'Extra Requisitions', value: totalExtra, icon: <Package size={20} />, color: '#d97706', bg: '#fef3c7' },
                { label: 'Returns', value: totalReturns, icon: <RotateCcw size={20} />, color: '#7c3aed', bg: '#ede9fe' },
                { label: 'Transfers', value: totalTransfers, icon: <ArrowRightLeft size={20} />, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Weight Captures', value: totalWeight, icon: <Gauge size={20} />, color: '#059669', bg: '#d1fae5' },
              ].map((kpi, i) => (
                <div key={i} className="analytics-kpi-card animate-slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                      {kpi.icon}
                    </div>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', fontFamily: 'var(--font-family-title)' }}>{kpi.value}</span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                  <div style={{ marginTop: '10px', height: '3px', borderRadius: '2px', background: `linear-gradient(90deg, ${kpi.color}, ${kpi.bg})`, width: `${Math.round((kpi.value / totalAll) * 100)}%`, minWidth: '10%' }} />
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.9fr)', gap: '20px', marginBottom: '24px' }}>

              {/* Donut Chart */}
              <div className="chart-card-wrapper animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={16} color="var(--accent-color)" />
                    Operation Breakdown
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Distribution of all store operations</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {donutData.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', width: '100%', fontSize: '13px' }}>No data yet</div>
                  ) : (
                    <>
                      <svg width="180" height="180" viewBox="0 0 180 180" style={{ flexShrink: 0, overflow: 'visible' }}>
                        {donutSegments.map((seg, i) => (
                          <path
                            key={i}
                            d={seg.pathD}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            className="donut-slice-path"
                            style={{ filter: `drop-shadow(0 2px 4px ${seg.color}40)` }}
                          />
                        ))}
                        <text x={donutCx} y={donutCy - 8} textAnchor="middle" style={{ fontSize: '22px', fontWeight: '800', fill: 'var(--text-main)', fontFamily: 'var(--font-family-title)' }}>
                          {donutTotal}
                        </text>
                        <text x={donutCx} y={donutCy + 12} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--text-muted)', fontFamily: 'var(--font-family-body)' }}>
                          Total
                        </text>
                      </svg>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: '100px' }}>
                        {donutSegments.map((seg, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-main)' }}>{seg.label}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{seg.count} ({Math.round(seg.pct * 100)}%)</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 7-Day Bar Chart */}
              <div className="chart-card-wrapper animate-slide-up" style={{ animationDelay: '0.15s' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={16} color="var(--accent-color)" />
                    7-Day Operation Trend
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Daily operation count for the last 7 days</p>
                </div>
                <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
                  <svg width={svgBarW} height={BAR_H + 50} viewBox={`0 0 ${svgBarW} ${BAR_H + 50}`} style={{ minWidth: '320px', width: '100%' }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="1" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                      const y = BAR_H - pct * BAR_H + 8;
                      return (
                        <g key={i}>
                          <line x1="10" y1={y} x2={svgBarW - 10} y2={y} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4,4" />
                          <text x="6" y={y + 4} style={{ fontSize: '9px', fill: 'var(--text-muted)' }} textAnchor="middle">
                            {Math.round(pct * barMax)}
                          </text>
                        </g>
                      );
                    })}
                    {/* Bars */}
                    {last7.map((day, i) => {
                      const bh = barMax > 0 ? (day.count / barMax) * BAR_H : 0;
                      const x = 18 + i * (BAR_W + BAR_GAP);
                      const y = BAR_H - bh + 8;
                      return (
                        <g key={i}>
                          {/* Background bar */}
                          <rect x={x} y={8} width={BAR_W} height={BAR_H} rx="5" fill="#f0f7ff" />
                          {/* Value bar */}
                          {bh > 0 && (
                            <rect
                              x={x} y={y} width={BAR_W} height={bh} rx="5"
                              fill="url(#barGrad)"
                              className="bar-column-rect"
                              style={{ filter: 'drop-shadow(0 2px 6px rgba(2,132,199,0.25))' }}
                            />
                          )}
                          {/* Count label */}
                          {day.count > 0 && (
                            <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" style={{ fontSize: '9px', fontWeight: '700', fill: '#0284c7' }}>
                              {day.count}
                            </text>
                          )}
                          {/* Day label */}
                          <text x={x + BAR_W / 2} y={BAR_H + 26} textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--text-muted)' }}>
                            {day.label.split(' ')[0]}
                          </text>
                          <text x={x + BAR_W / 2} y={BAR_H + 38} textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>
                            {day.label.split(' ')[1]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

              {/* Top 5 Lots */}
              <div className="chart-card-wrapper animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PackageCheck size={16} color="var(--accent-color)" />
                    Top Lots by Issues
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Most active production lots</p>
                </div>
                {topLots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>No issue data yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {topLots.map(([lotId, count], i) => {
                      const pct = Math.round((count / topLotsMax) * 100);
                      const colors = ['#0284c7', '#0369a1', '#38bdf8', '#7dd3fc', '#bae6fd'];
                      return (
                        <div key={lotId}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
                              <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>#{i + 1}</span>Lot {lotId}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: colors[i] }}>{count} issues</span>
                          </div>
                          <div style={{ height: '8px', borderRadius: '4px', background: '#e0f2fe', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              borderRadius: '4px',
                              background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}99)`,
                              animation: 'barGrowRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) both',
                              animationDelay: `${i * 0.1}s`
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Operation Summary Table */}
              <div className="chart-card-wrapper animate-slide-up" style={{ animationDelay: '0.25s' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} color="var(--accent-color)" />
                    Portfolio Overview
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Summary across all modules</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Total Design Lots', value: totalDesigns, color: '#0284c7', pct: 100 },
                    { label: 'Purchase Orders', value: totalPOs, color: '#7c3aed', pct: totalDesigns > 0 ? Math.round((totalPOs / Math.max(totalDesigns, 1)) * 100) : 0 },
                    { label: 'Issue Transactions', value: totalIssues, color: '#059669', pct: totalAll > 0 ? Math.round((totalIssues / totalAll) * 100) : 0 },
                    { label: 'Store Scan Events', value: totalScans, color: '#06b6d4', pct: totalAll > 0 ? Math.round((totalScans / totalAll) * 100) : 0 },
                    { label: 'Weight Captures', value: totalWeight, color: '#f59e0b', pct: totalAll > 0 ? Math.round((totalWeight / totalAll) * 100) : 0 },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: `${row.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: row.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{row.label}</span>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: row.color }}>{row.value}</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '3px', background: '#f0f7ff' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(row.pct, 100)}%`,
                            borderRadius: '3px',
                            background: row.color,
                            animation: 'barGrowRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) both',
                            animationDelay: `${i * 0.08}s`,
                            opacity: 0.8
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {activeReportTab === 'rgp_reports' && (
        <div className="animate-scale" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Action Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'var(--bg-secondary)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="var(--accent-color)" />
                <span>Returnable Gate Pass (RGP) Audit Register &amp; Scanner Logs</span>
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Complete operational audit of external processor transfers, gate dispatch/inward QR scans, vendor returns, and overdue tracking.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={fetchRgpData}
                disabled={rgpLoading}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px' }}
                title="Refresh RGP &amp; Gate Scanner records"
              >
                <RefreshCw size={13} className={rgpLoading ? 'animate-spin' : ''} />
                <span>{rgpLoading ? 'Refreshing...' : 'Refresh Logs'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportRgpCSV}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.3)' }}
                title="Export all filtered RGPs to Excel / CSV spreadsheet"
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px' }}
                title="Print RGP Audit Summary"
              >
                <Printer size={13} />
                <span>Print Register</span>
              </button>
            </div>
          </div>

          {/* 6 Executive KPI Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px'
          }}>
            {/* 1. Total RGPs */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid #6366f1',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Total RGP Passes</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                  <FileText size={15} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>
                {rgpStats.total}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(rgpStats.typeCounts).slice(0, 3).map(([type, cnt]) => (
                  <span key={type} style={{ background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>
                    {type}: {cnt}
                  </span>
                ))}
              </div>
            </div>

            {/* 2. Dispatched / In Transit */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid #f59e0b',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>In-Transit / Open</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                  <Truck size={15} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b' }}>
                {rgpStats.inTransit}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {rgpStats.total > 0 ? `${Math.round((rgpStats.inTransit / rgpStats.total) * 100)}% of total passes` : 'Awaiting return'}
              </div>
            </div>

            {/* 3. Fully Returned */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid #10b981',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Returned &amp; Closed</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CheckCircle size={15} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                {rgpStats.returned}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Verified by gate return scan
              </div>
            </div>

            {/* 4. Overdue Passes */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: rgpStats.overdue > 0 ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-secondary)',
              border: '1px solid',
              borderColor: rgpStats.overdue > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)',
              borderLeft: '4px solid #ef4444',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: rgpStats.overdue > 0 ? '#ef4444' : 'var(--text-muted)' }}>Overdue Passes</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <AlertTriangle size={15} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444' }}>
                {rgpStats.overdue}
              </div>
              <div style={{ fontSize: '11px', color: rgpStats.overdue > 0 ? '#ef4444' : 'var(--text-muted)', marginTop: '4px', fontWeight: rgpStats.overdue > 0 ? '700' : '400' }}>
                {rgpStats.overdue > 0 ? 'Requires vendor follow-up' : 'All returns within schedule'}
              </div>
            </div>

            {/* 5. Total Units Dispatched */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid #8b5cf6',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Total Dispatched Units</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                  <Boxes size={15} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>
                {rgpStats.totalDispatchedQty.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>pcs</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Cumulative goods out
              </div>
            </div>

            {/* 6. Gate Scanner Compliance */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid #06b6d4',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Gate Scan Verification</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                  <QrCode size={15} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#06b6d4' }}>
                {rgpStats.scanRate}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {rgpStats.scannedAtGate} of {rgpStats.total} scanned at gate
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '14px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
              <Search size={15} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Search RGP #, Vendor, Lot #, Department, Purpose, Item, Vehicle..."
                value={rgpSearch}
                onChange={(e) => setRgpSearch(e.target.value)}
                style={{
                  paddingLeft: '36px',
                  paddingRight: rgpSearch ? '30px' : '12px',
                  height: '36px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary, #f8fafc)',
                  color: 'var(--text-main)',
                  width: '100%',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
              {rgpSearch && (
                <button
                  type="button"
                  onClick={() => setRgpSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={rgpStatusFilter}
              onChange={(e) => setRgpStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Statuses</option>
              <option value="open">In-Transit / Open</option>
              <option value="returned">Fully Returned</option>
              <option value="overdue">Overdue Passes</option>
            </select>

            {/* Type Filter */}
            <select
              value={rgpTypeFilter}
              onChange={(e) => setRgpTypeFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All RGP Types</option>
              <option value="Fabric">Fabric</option>
              <option value="Tools">Tools</option>
              <option value="Machine">Machine</option>
              <option value="Sample">Sample</option>
              <option value="Other">Other</option>
            </select>

            {/* Gate Scanner Status Filter */}
            <select
              value={rgpScanFilter}
              onChange={(e) => setRgpScanFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Gate Scans</option>
              <option value="scanned_out">Scanned at Gate Out (Issue)</option>
              <option value="scanned_in">Scanned at Gate In (Return)</option>
              <option value="not_scanned">Pending Gate Scan</option>
            </select>

            {/* Date Preset Filter */}
            <select
              value={rgpDateFilter}
              onChange={(e) => setRgpDateFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Time</option>
              <option value="today">Issued Today</option>
              <option value="week">Issued This Week</option>
              <option value="month">Issued This Month</option>
            </select>

            {/* Sort */}
            <select
              value={rgpSort}
              onChange={(e) => setRgpSort(e.target.value)}
              style={styles.select}
            >
              <option value="latest">Latest Created</option>
              <option value="oldest">Oldest First</option>
              <option value="exp_return">Return Date (Earliest)</option>
              <option value="rgp_no">RGP Number</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              padding: '2px',
              marginLeft: 'auto'
            }}>
              <button
                type="button"
                onClick={() => setRgpViewMode('table')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: rgpViewMode === 'table' ? 'var(--accent-color)' : 'transparent',
                  color: rgpViewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setRgpViewMode('cards')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: rgpViewMode === 'cards' ? 'var(--accent-color)' : 'transparent',
                  color: rgpViewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Cards View
              </button>
            </div>
          </div>

          {/* Results Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>Showing <strong>{filteredRgpList.length}</strong> of <strong>{processedRgpList.length}</strong> RGP records</span>
            {filteredRgpList.length < processedRgpList.length && (
              <button
                type="button"
                onClick={() => {
                  setRgpSearch('');
                  setRgpStatusFilter('all');
                  setRgpTypeFilter('all');
                  setRgpScanFilter('all');
                  setRgpDateFilter('all');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Main Content: Table or Cards View */}
          {filteredRgpList.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Truck size={48} strokeWidth={1} style={{ marginBottom: '12px', color: 'var(--text-light)', display: 'inline-block', opacity: 0.5 }} />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 6px 0' }}>No RGP Records Found</h3>
              <p style={{ fontSize: '13px', margin: 0, maxWidth: '400px', display: 'inline-block' }}>
                No Returnable Gate Passes matched your current filter criteria. Try resetting search parameters or create a new RGP pass.
              </p>
            </div>
          ) : rgpViewMode === 'table' ? (
            /* Table View */
            <div className="panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 16px', width: '30px' }}></th>
                      <th style={{ padding: '12px 16px' }}>RGP Pass &amp; Type</th>
                      <th style={{ padding: '12px 16px' }}>Dates &amp; Status</th>
                      <th style={{ padding: '12px 16px' }}>Vendor &amp; Purpose</th>
                      <th style={{ padding: '12px 16px' }}>Dispatched Goods</th>
                      <th style={{ padding: '12px 16px' }}>Vehicle / Auth</th>
                      <th style={{ padding: '12px 16px' }}>Gate QR Scans</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRgpList.map((rgp) => {
                      const isExpanded = expandedRgpIds.has(rgp.id || rgp.rgpNo);
                      return (
                        <React.Fragment key={rgp.id || rgp.rgpNo}>
                          <tr
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)',
                              backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.02)' : 'transparent',
                              transition: 'background-color 0.15s'
                            }}
                          >
                            {/* Expand Toggle */}
                            <td style={{ padding: '12px 8px 12px 16px' }}>
                              <button
                                type="button"
                                onClick={() => toggleRgpExpand(rgp.id || rgp.rgpNo)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px'
                                }}
                                title={isExpanded ? 'Collapse row' : 'Expand details'}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>

                            {/* RGP Pass & Type */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '800', color: '#7c3aed', fontFamily: 'monospace', fontSize: '14px' }}>
                                  {rgp.rgpNo || 'RGP-PASS'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                                  color: '#7c3aed',
                                  border: '1px solid rgba(124, 58, 237, 0.2)'
                                }}>
                                  {rgp.rgpType || 'Fabric'}
                                </span>
                                {rgp.uniqueLots.length > 0 && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Lots: {rgp.uniqueLots.join(', ')}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Dates & Status */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)' }}>
                                Issued: {formatDateTime(rgp.date)}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Exp Return: {rgp.expectedReturnDate ? formatDateTime(rgp.expectedReturnDate) : 'Not specified'}
                              </div>
                              <div style={{ marginTop: '5px' }}>
                                {rgp.isReturned ? (
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <Check size={11} /> Fully Returned
                                  </span>
                                ) : rgp.isOverdue ? (
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <AlertTriangle size={11} /> Overdue by {rgp.daysOverdue}d
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <Clock size={11} /> In Transit
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Vendor & Purpose */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '13.5px' }}>
                                {rgp.vendor || '—'}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Dept: <strong>{rgp.department || 'Store'}</strong>
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                Purpose: {rgp.purpose || 'Processing'}
                              </div>
                            </td>

                            {/* Dispatched Goods */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '13.5px' }}>
                                {rgp.totalQty1.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{rgp.entries[0]?.uom || rgp.uom || 'PCS'}</span>
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {rgp.entries.length} line item{rgp.entries.length === 1 ? '' : 's'}
                                {rgp.totalQty2 > 0 && ` (${rgp.totalQty2} rolls/bags)`}
                              </div>
                            </td>

                            {/* Vehicle & Auth */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                                Veh: {rgp.vehicleNo || 'Self / Courier'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                By: {rgp.preparedBy || 'Store Staff'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Auth: {rgp.authorizedBy || 'Admin'}
                              </div>
                            </td>

                            {/* Gate QR Scans */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {/* Gate Out Scan */}
                                <div style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: rgp.gateOutScan ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                  color: rgp.gateOutScan ? '#10b981' : 'var(--text-muted)',
                                  border: `1px solid ${rgp.gateOutScan ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.2)'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  <span>📤 Gate Out:</span>
                                  <strong>{rgp.gateOutScan ? (rgp.gateOutScan.person_name || 'Scanned') : 'Pending'}</strong>
                                </div>

                                {/* Gate In Scan */}
                                <div style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: rgp.gateInScan ? 'rgba(236, 72, 153, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                  color: rgp.gateInScan ? '#ec4899' : 'var(--text-muted)',
                                  border: `1px solid ${rgp.gateInScan ? 'rgba(236, 72, 153, 0.25)' : 'rgba(148, 163, 184, 0.2)'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  <span>📥 Gate In:</span>
                                  <strong>{rgp.gateInScan ? (rgp.gateInScan.person_name || 'Returned') : 'Pending'}</strong>
                                </div>
                              </div>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRgpForModal(rgp)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '5px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="View Full RGP Specification &amp; QR Modal"
                                >
                                  <Eye size={13} />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadRgpPdf(rgp)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '5px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', color: '#7c3aed', borderColor: 'rgba(124, 58, 237, 0.3)' }}
                                  title="Download / Print Official RGP PDF"
                                >
                                  <Download size={13} />
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Row Accordion */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                              <td colSpan={8} style={{ padding: '0 20px 20px 48px' }}>
                                <div style={{
                                  backgroundColor: 'var(--bg-secondary)',
                                  padding: '16px 20px',
                                  borderRadius: '10px',
                                  border: '1px solid var(--border-color)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '16px'
                                }}>
                                  {/* Line Items Table */}
                                  <div>
                                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Boxes size={14} color="var(--accent-color)" />
                                      Itemized Dispatched Items ({rgp.entries.length})
                                    </h4>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                          <th style={{ padding: '6px 8px' }}>#</th>
                                          <th style={{ padding: '6px 8px' }}>Lot Number</th>
                                          <th style={{ padding: '6px 8px' }}>Item Description</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty 1</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty 2 (Bags/Rolls)</th>
                                          <th style={{ padding: '6px 8px' }}>UOM</th>
                                          <th style={{ padding: '6px 8px' }}>Department</th>
                                          <th style={{ padding: '6px 8px' }}>Purpose</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rgp.entries.map((entry, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                            <td style={{ padding: '6px 8px', fontWeight: '700', color: '#7c3aed' }}>
                                              {entry.lotNo ? `#${entry.lotNo}` : '—'}
                                            </td>
                                            <td style={{ padding: '6px 8px', fontWeight: '600' }}>{entry.itemDesc || 'Item'}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                                              {Number(entry.qty1 || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                              {entry.qty2 || 0}
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>{entry.uom || 'PCS'}</td>
                                            <td style={{ padding: '6px 8px' }}>{entry.department || rgp.department || 'Store'}</td>
                                            <td style={{ padding: '6px 8px' }}>{entry.purpose || rgp.purpose || 'Processing'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Security Gate Scanner Trail */}
                                  <div>
                                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <QrCode size={14} color="#10b981" />
                                      Security Gate Scanner Event Logs ({rgp.matchingScans.length})
                                    </h4>
                                    {rgp.matchingScans.length === 0 ? (
                                      <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        No live security gate scans have been captured yet for this pass. Security personnel can scan the RGP QR code on mobile to record Gate Entry and Return.
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {rgp.matchingScans.map((s, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              padding: '8px 12px',
                                              borderRadius: '6px',
                                              backgroundColor: 'var(--bg-primary)',
                                              border: '1px solid var(--border-color)',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              fontSize: '12px'
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <span style={{
                                                fontSize: '10px',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: s.scan_type === 'rgp_return' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                color: s.scan_type === 'rgp_return' ? '#ec4899' : '#10b981'
                                              }}>
                                                {s.scan_type === 'rgp_return' ? 'Gate In (Return)' : (s.scan_type === 'rgp_entry' ? 'Gate Out (Dispatch)' : s.scan_type)}
                                              </span>
                                              <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                                                Security / Operator: {s.person_name || 'Guard'}
                                              </span>
                                              <span style={{ color: 'var(--text-muted)' }}>
                                                Item: {s.material_name} ({s.quantity} pcs)
                                              </span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <Clock size={11} />
                                              <span>{formatDateTime(s.scanned_at)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Remarks & Authorization Metadata */}
                                  {rgp.remarks && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                      <strong>Remarks:</strong> {rgp.remarks}
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
            </div>
          ) : (
            /* Cards View */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {filteredRgpList.map((rgp) => (
                <div
                  key={rgp.id || rgp.rgpNo}
                  className="panel animate-scale"
                  style={{
                    padding: '18px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>
                    {/* Top Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '800', color: '#7c3aed', fontFamily: 'monospace', fontSize: '15px' }}>
                          {rgp.rgpNo}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {rgp.rgpType} • {rgp.department || 'Store'}
                        </div>
                      </div>
                      <div>
                        {rgp.isReturned ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.25)'
                          }}>
                            Returned
                          </span>
                        ) : rgp.isOverdue ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)'
                          }}>
                            Overdue ({rgp.daysOverdue}d)
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.25)'
                          }}>
                            In Transit
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vendor & Goods info */}
                    <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                        {rgp.vendor}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                        Purpose: {rgp.purpose || 'Processing'}
                      </div>
                    </div>

                    {/* Dispatched Goods */}
                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                        <span>Total Quantity:</span>
                        <span>{rgp.totalQty1.toLocaleString()} {rgp.entries[0]?.uom || rgp.uom || 'PCS'}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {rgp.entries.length} items • {rgp.entries.map(e => e.itemDesc).filter(Boolean).slice(0, 2).join(', ')}
                      </div>
                    </div>

                    {/* Scanner Badges */}
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: rgp.gateOutScan ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                        color: rgp.gateOutScan ? '#10b981' : 'var(--text-muted)'
                      }}>
                        Out: {rgp.gateOutScan ? 'Scanned' : 'Pending'}
                      </span>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: rgp.gateInScan ? 'rgba(236, 72, 153, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                        color: rgp.gateInScan ? '#ec4899' : 'var(--text-muted)'
                      }}>
                        In: {rgp.gateInScan ? 'Returned' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDateTime(rgp.date)}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedRgpForModal(rgp)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11.5px' }}
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadRgpPdf(rgp)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11.5px', color: '#7c3aed', borderColor: 'rgba(124, 58, 237, 0.3)' }}
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Details Modal Dialog */}
          {selectedRgpForModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}>
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                width: '100%',
                maxWidth: '720px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#7c3aed', fontFamily: 'monospace' }}>
                        {selectedRgpForModal.rgpNo}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        color: '#7c3aed'
                      }}>
                        {selectedRgpForModal.rgpType}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                      Vendor: <strong>{selectedRgpForModal.vendor}</strong> | Department: {selectedRgpForModal.department || 'Store'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRgpForModal(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Status & Timing Banner */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: selectedRgpForModal.isReturned ? 'rgba(16, 185, 129, 0.08)' : (selectedRgpForModal.isOverdue ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'),
                  border: `1px solid ${selectedRgpForModal.isReturned ? 'rgba(16, 185, 129, 0.25)' : (selectedRgpForModal.isOverdue ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)')}`
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Issue Date: </span>
                    <strong style={{ fontSize: '13px' }}>{formatDateTime(selectedRgpForModal.date)}</strong>
                    <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Expected Return: </span>
                    <strong style={{ fontSize: '13px' }}>{selectedRgpForModal.expectedReturnDate ? formatDateTime(selectedRgpForModal.expectedReturnDate) : 'Not specified'}</strong>
                  </div>
                  <div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: selectedRgpForModal.isReturned ? '#10b981' : (selectedRgpForModal.isOverdue ? '#ef4444' : '#f59e0b')
                    }}>
                      {selectedRgpForModal.status}
                    </span>
                  </div>
                </div>

                {/* Items Breakdown */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 10px 0' }}>
                    Itemized Items Dispatched ({selectedRgpForModal.entries.length})
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', backgroundColor: 'var(--bg-primary)' }}>
                        <th style={{ padding: '8px' }}>#</th>
                        <th style={{ padding: '8px' }}>Lot #</th>
                        <th style={{ padding: '8px' }}>Item Description</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Qty 1</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Qty 2</th>
                        <th style={{ padding: '8px' }}>UOM</th>
                        <th style={{ padding: '8px' }}>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRgpForModal.entries.map((e, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '8px', fontWeight: '700', color: '#7c3aed' }}>{e.lotNo ? `#${e.lotNo}` : '—'}</td>
                          <td style={{ padding: '8px', fontWeight: '600' }}>{e.itemDesc}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>{Number(e.qty1 || 0).toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{e.qty2 || 0}</td>
                          <td style={{ padding: '8px' }}>{e.uom || 'PCS'}</td>
                          <td style={{ padding: '8px' }}>{e.purpose || selectedRgpForModal.purpose || 'Processing'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Security Gate Logs */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <QrCode size={15} color="#10b981" />
                    Security Gate Scanner Logs
                  </h4>
                  {selectedRgpForModal.matchingScans.length === 0 ? (
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No QR scanner records recorded for this RGP yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedRgpForModal.matchingScans.map((s, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12.5px'
                          }}
                        >
                          <div>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: s.scan_type === 'rgp_return' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: s.scan_type === 'rgp_return' ? '#ec4899' : '#10b981',
                              marginRight: '8px'
                            }}>
                              {s.scan_type === 'rgp_return' ? 'Gate In (Return)' : 'Gate Out (Dispatch)'}
                            </span>
                            <strong>Guard: {s.person_name || 'Security'}</strong> — {s.material_name} ({s.quantity} pcs)
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                            {formatDateTime(s.scanned_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Prepared By: <strong>{selectedRgpForModal.preparedBy || 'Store'}</strong> | Authorized: <strong>{selectedRgpForModal.authorizedBy || 'Admin'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadRgpPdf(selectedRgpForModal)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={14} />
                      <span>Download Official PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRgpForModal(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

