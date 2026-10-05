import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, User, ClipboardList, CheckCircle, XCircle,
  Scissors, Shuffle, Truck, QrCode, ShieldCheck, AlertCircle, FileText, Check, Download,
  BarChart3, TrendingUp, Activity, Boxes, Eye, Tag, Calendar, MapPin, Building,
  ArrowRight, ShieldAlert, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, RefreshCw, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const getLotVersionInfo = (lotNo, designs = []) => {
  const lotStr = String(lotNo || '').trim();
  if (lotStr.includes('-V')) {
    const parts = lotStr.split('-V');
    return {
      displayLot: parts[0],
      versionText: `Recreated (Run ${parts[1]})`,
      isRecreated: true
    };
  }
  return {
    displayLot: lotStr,
    versionText: 'Original Lot',
    isRecreated: false
  };
};

export default function HistoryView({ designs = [], currencySymbol = 'R', currentUser }) {
  const [selectedLotId, setSelectedLotId] = useState('');
  const [itemCategory, setItemCategory] = useState('all'); // 'all' | 'rgps' | 'dori' | 'zip' | 'pos' | 'extra_material' | 'scans' | 'designs'
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rgpStatusFilter, setRgpStatusFilter] = useState('all');
  const [ageSort, setAgeSort] = useState('newest');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' | 'chronological' | 'calendar'

  // Data lists fetched from backend
  const [historyLogs, setHistoryLogs] = useState([]);
  const [scanLogs, setScanLogs] = useState([]);
  const [cuttingHeaders, setCuttingHeaders] = useState([]);
  const [dooriOrders, setDooriOrders] = useState([]);
  const [zipOrders, setZipOrders] = useState([]);
  const [pos, setPOs] = useState([]);
  const [issueLogs, setIssueLogs] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [extraMaterialIssues, setExtraMaterialIssues] = useState([]);
  const [weightCaptures, setWeightCaptures] = useState([]);
  const [rgpList, setRgpList] = useState([]);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch all history data from backend
  const fetchHistoryData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    const backendUrl = getBackendUrl();

    try {
      const [
        historyRes, scansRes, headersRes, dooriRes, zipRes,
        posRes, issueRes, transferRes, extraRes, weightRes, rgpRes
      ] = await Promise.all([
        fetch(`${backendUrl}/api/design-history`),
        fetch(`${backendUrl}/api/scans`),
        fetch(`${backendUrl}/api/cutting-headers`),
        fetch(`${backendUrl}/api/doori-orders`),
        fetch(`${backendUrl}/api/zip-orders`),
        fetch(`${backendUrl}/api/pos`),
        fetch(`${backendUrl}/api/issue-logs`),
        fetch(`${backendUrl}/api/transfers`),
        fetch(`${backendUrl}/api/extra-material-issues`),
        fetch(`${backendUrl}/api/weight-capture`),
        fetch(`${backendUrl}/api/rgp`)
      ]);

      if (historyRes.ok) setHistoryLogs(await historyRes.json());
      if (scansRes.ok) setScanLogs(await scansRes.json());
      if (headersRes.ok) setCuttingHeaders(await headersRes.json());
      if (dooriRes.ok) setDooriOrders(await dooriRes.json());
      if (zipRes.ok) setZipOrders(await zipRes.json());
      if (posRes.ok) setPOs(await posRes.json());
      if (issueRes.ok) setIssueLogs(await issueRes.json());
      if (transferRes && transferRes.ok) setTransfers(await transferRes.json());
      if (extraRes && extraRes.ok) setExtraMaterialIssues(await extraRes.json());
      if (weightRes && weightRes.ok) {
        const wData = await weightRes.json();
        setWeightCaptures(wData.success && Array.isArray(wData.data) ? wData.data : (Array.isArray(wData) ? wData : []));
      }
      if (rgpRes && rgpRes.ok) {
        const rData = await rgpRes.json();
        setRgpList(Array.isArray(rData) ? rData : []);
      }
    } catch (err) {
      console.error('Failed to load history lists:', err);
      setErrorMessage('Failed to connect to the backend server. Make sure port 5000 is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  // Processed RGP list with safe entries parsing and computed statuses
  const processedRgpList = useMemo(() => {
    return rgpList.map(rgp => {
      let parsedEntries = [];
      try {
        if (Array.isArray(rgp.entries)) {
          parsedEntries = rgp.entries;
        } else if (typeof rgp.entries === 'string') {
          parsedEntries = JSON.parse(rgp.entries);
        }
      } catch (e) {
        parsedEntries = [];
      }

      // Check scans for this RGP
      const rgpScans = scanLogs.filter(s => {
        const scanLot = String(s.lot_number || '').trim().toLowerCase();
        const rgpNoStr = String(rgp.rgpNo || '').trim().toLowerCase();
        if (scanLot === rgpNoStr) return true;
        if (s.rgp_payload) {
          try {
            const p = JSON.parse(s.rgp_payload);
            if (p && String(p.rgpNo || '').toLowerCase() === rgpNoStr) return true;
          } catch (_) { }
        }
        return false;
      });

      const gateOutScan = rgpScans.find(s => s.scan_type === 'rgp_entry');
      const gateInScan = rgpScans.find(s => s.scan_type === 'rgp_return');
      const gateEntryScans = rgpScans.filter(s => s.scan_type === 'gate_entry');

      // Status computation
      let status = 'In Transit';
      const isReturned = Boolean(gateInScan || rgp.status?.toLowerCase() === 'returned');
      const isOverdue = !isReturned && rgp.expectedReturnDate && (new Date(rgp.expectedReturnDate) < new Date());

      if (isReturned) {
        status = 'Returned';
      } else if (isOverdue) {
        status = 'Overdue';
      } else {
        status = 'In Transit';
      }

      const totalQty1 = parsedEntries.reduce((sum, item) => sum + (parseFloat(item.qty1) || 0), 0);
      const totalQty2 = parsedEntries.reduce((sum, item) => sum + (parseFloat(item.qty2) || 0), 0);

      return {
        ...rgp,
        entries: parsedEntries,
        computedStatus: status,
        isReturned,
        isOverdue,
        scans: rgpScans,
        gateOutScan,
        gateInScan,
        gateEntryScans,
        totalItemsCount: parsedEntries.length,
        totalQty1,
        totalQty2
      };
    });
  }, [rgpList, scanLogs]);

  // Unified items list representing all 7 operations modules
  const unifiedItemsList = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    // 1. RGP Returnable Gate Passes
    processedRgpList.forEach(r => {
      const idStr = `RGP-${r.rgpNo || r.id}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        list.push({
          id: idStr,
          rawId: r.rgpNo || r.id,
          itemType: 'rgp',
          title: `RGP #${r.rgpNo}`,
          subTitle: `${r.vendor || 'Vendor'} • ${r.rgpType || 'Gate Pass'}`,
          secondaryText: `${r.totalItemsCount || 0} items (${r.computedStatus})`,
          date: r.date || '',
          badgeColor: '#a855f7',
          rgp: r
        });
      }
    });

    // 2. Dori Purchase Orders
    dooriOrders.forEach(d => {
      const doriNo = d.po_number || `DORI-${d.id}`;
      const idStr = `DORI-${d.id || d.po_number || d.Lot_Number}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        list.push({
          id: idStr,
          rawId: doriNo,
          itemType: 'dori',
          title: `Dori PO #${doriNo}`,
          subTitle: `${d.Style || 'Thread/Dori'} • ${d.Garment_Type || 'Garment'}`,
          secondaryText: `${d.Total_Pieces || 0} pcs (₹${d.Total_Cost || 0})`,
          date: d.Issue_Date || d.Timestamp || '',
          badgeColor: '#f59e0b',
          dori: d
        });
      }
    });

    // 3. Zip Purchase Orders
    zipOrders.forEach(z => {
      const zipNo = z.po_number || `ZIP-${z.id}`;
      const idStr = `ZIP-${z.id || z.po_number || z.Lot_Number}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        list.push({
          id: idStr,
          rawId: zipNo,
          itemType: 'zip',
          title: `Zip PO #${zipNo}`,
          subTitle: `${z.Style || 'Zipper Trims'} • ${z.Garment_Type || z.ch_garment || 'Garment'}`,
          secondaryText: `${z.Total_Pieces_CH || z.Total_Pieces || 0} pcs (₹${z.Total_Cost || 0})`,
          date: z.Saved_At || z.Issue_Date || '',
          badgeColor: '#ec4899',
          zip: z
        });
      }
    });

    // 4. General Purchase Orders (PO)
    pos.forEach(p => {
      const idStr = `PO-${p.poNumber || p.id}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        list.push({
          id: idStr,
          rawId: p.poNumber || p.id,
          itemType: 'po',
          title: `PO #${p.poNumber}`,
          subTitle: `${p.vendorName || 'Supplier'}`,
          secondaryText: `${p.designName ? `Lot #${p.designName}` : 'PO'} (${p.status || 'Active'})`,
          date: p.date || '',
          badgeColor: '#3b82f6',
          po: p
        });
      }
    });

    // 5. Extra Material / Extra Pieces Issues
    extraMaterialIssues.forEach(ex => {
      const idStr = `EXTRA-${ex.voucherId || ex.id}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        const exItems = Array.isArray(ex.items) ? ex.items : [];
        const totalPcs = exItems.reduce((s, it) => s + (parseFloat(it.totalRequired || it.qty) || 0), 0) || ex.extra_pieces || 0;
        list.push({
          id: idStr,
          rawId: ex.voucherId || ex.id,
          itemType: 'extra_material',
          title: `Extra Req #${ex.voucherId || ex.id}`,
          subTitle: `Lot #${ex.lot_no || ex.lotId || 'N/A'} • ${ex.department || 'Production'}`,
          secondaryText: `${totalPcs} pcs (${ex.reason || 'Extra Requisition'})`,
          date: ex.issueDate || ex.createdAt || ex.date || '',
          badgeColor: '#ef4444',
          extra: ex
        });
      }
    });

    // 6. Security Scanner Checkpoint Logs
    scanLogs.forEach(s => {
      const idStr = `SCAN-${s.id}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        list.push({
          id: idStr,
          rawId: s.id,
          itemType: 'scan',
          title: `Scan #${s.id} (${s.scan_type || 'Gate'})`,
          subTitle: `${s.person_name || 'Guard'} • ${s.supplier_name || 'Vendor'}`,
          secondaryText: `Lot #${s.lot_number || 'N/A'} (${s.quantity || 0} pcs)`,
          date: s.scanned_at || s.timestamp || '',
          badgeColor: '#06b6d4',
          scan: s
        });
      }
    });

    // 7. Design Lots
    designs.forEach(d => {
      const idStr = `LOT-${d.id}`;
      if (!seenIds.has(idStr.toLowerCase())) {
        seenIds.add(idStr.toLowerCase());
        list.push({
          id: idStr,
          rawId: d.id,
          itemType: 'design',
          title: `Lot #${getLotVersionInfo(d.id, designs).displayLot}`,
          subTitle: `${d.brand || 'Client'} (${d.category || 'Design'})`,
          secondaryText: d.style || 'Custom Style',
          date: d.created_at || d.date || '',
          imageUrl: d.imageUrl || null,
          badgeColor: '#10b981',
          design: d
        });
      }
    });

    return list;
  }, [designs, processedRgpList, pos, dooriOrders, zipOrders, extraMaterialIssues, scanLogs]);

  // Filter list based on selected category & search query
  const filteredLotsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let list = unifiedItemsList.filter(item => {
      // 1. Category filter
      if (itemCategory === 'rgps' && item.itemType !== 'rgp') return false;
      if (itemCategory === 'dori' && item.itemType !== 'dori') return false;
      if (itemCategory === 'zip' && item.itemType !== 'zip') return false;
      if (itemCategory === 'pos' && item.itemType !== 'po') return false;
      if (itemCategory === 'extra_material' && item.itemType !== 'extra_material') return false;
      if (itemCategory === 'scans' && item.itemType !== 'scan') return false;
      if (itemCategory === 'designs' && item.itemType !== 'design') return false;

      // 2. Design Type filter (for designs)
      if (typeFilter === 'original' && item.itemType === 'design' && String(item.rawId).includes('-V')) return false;
      if (typeFilter === 'version' && item.itemType === 'design' && !String(item.rawId).includes('-V')) return false;

      // 3. RGP Status filter (for rgps)
      if (item.itemType === 'rgp' && rgpStatusFilter !== 'all') {
        const rgpStatus = item.rgp?.computedStatus?.toLowerCase().replace(' ', '_');
        if (rgpStatus !== rgpStatusFilter) return false;
      }

      // 4. Date range filter
      if (dateFilter !== 'all') {
        const now = new Date();
        if (!item.date) return false;
        const dDate = parseToDateObject(item.date);
        if (dDate.getTime() === 0) return false;

        const diffTime = Math.abs(now - dDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (dateFilter === 'today' && dDate.toDateString() !== now.toDateString()) return false;
        if (dateFilter === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          if (dDate.toDateString() !== yesterday.toDateString()) return false;
        }
        if (dateFilter === 'week' && diffDays > 7) return false;
        if (dateFilter === 'month' && diffDays > 30) return false;
      }

      // 5. Search query
      if (q) {
        const matchId = String(item.id).toLowerCase().includes(q);
        const matchTitle = String(item.title).toLowerCase().includes(q);
        const matchSub = String(item.subTitle).toLowerCase().includes(q);
        const matchSec = String(item.secondaryText).toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchSub && !matchSec) return false;
      }

      return true;
    });

    // Sort items
    list.sort((a, b) => {
      const dateA = parseToDateObject(a.date).getTime();
      const dateB = parseToDateObject(b.date).getTime();
      return ageSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return list;
  }, [unifiedItemsList, itemCategory, typeFilter, rgpStatusFilter, dateFilter, searchQuery, ageSort]);

  // Auto-select first item when list changes or resets
  useEffect(() => {
    if (!selectedLotId && filteredLotsList.length > 0) {
      setSelectedLotId(filteredLotsList[0].id);
    }
  }, [filteredLotsList, selectedLotId]);

  // Selected Item Resolvers
  const selectedItemMeta = useMemo(() => {
    if (!selectedLotId) return null;
    return unifiedItemsList.find(it => it.id === selectedLotId || String(it.rawId) === selectedLotId) || null;
  }, [selectedLotId, unifiedItemsList]);

  const selectedRgp = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('RGP-', '').trim().toLowerCase();
    return processedRgpList.find(r => 
      String(r.rgpNo).toLowerCase() === cleanId ||
      String(r.id).toLowerCase() === cleanId ||
      `rgp-${String(r.rgpNo).toLowerCase()}` === String(selectedLotId).toLowerCase()
    ) || null;
  }, [selectedLotId, processedRgpList]);

  const selectedDori = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('DORI-', '').trim().toLowerCase();
    return dooriOrders.find(d => 
      String(d.po_number || '').toLowerCase() === cleanId ||
      String(d.id || '').toLowerCase() === cleanId ||
      String(d.Lot_Number || '').toLowerCase() === cleanId
    ) || null;
  }, [selectedLotId, dooriOrders]);

  const selectedZip = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('ZIP-', '').trim().toLowerCase();
    return zipOrders.find(z => 
      String(z.po_number || '').toLowerCase() === cleanId ||
      String(z.id || '').toLowerCase() === cleanId ||
      String(z.Lot_Number || '').toLowerCase() === cleanId
    ) || null;
  }, [selectedLotId, zipOrders]);

  const selectedPO = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('PO-', '').trim().toLowerCase();
    return pos.find(p => 
      String(p.poNumber || '').toLowerCase() === cleanId ||
      String(p.id || '').toLowerCase() === cleanId ||
      String(p.designName || '').toLowerCase() === cleanId
    ) || null;
  }, [selectedLotId, pos]);

  const selectedExtra = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('EXTRA-', '').replace('EX-', '').trim().toLowerCase();
    return extraMaterialIssues.find(ex => 
      String(ex.voucherId || '').toLowerCase() === cleanId ||
      String(ex.id || '').toLowerCase() === cleanId
    ) || null;
  }, [selectedLotId, extraMaterialIssues]);

  const selectedScan = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('SCAN-', '').trim().toLowerCase();
    return scanLogs.find(s => String(s.id).toLowerCase() === cleanId) || null;
  }, [selectedLotId, scanLogs]);

  const selectedDesign = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('LOT-', '').trim().toLowerCase();
    return designs.find(d => String(d.id).toLowerCase() === cleanId) || null;
  }, [selectedLotId, designs]);

  // Helper function to resolve dynamic design image preview URLs
  const getCleanImageUrl = (url) => {
    if (!url) return '';
    return url.replace('wait', `${getBackendUrl()}`);
  };

  // Compile timeline events dynamically for the selected record
  const getTimelineEvents = () => {
    if (!selectedLotId) return [];
    const events = [];

    // 1. IF RGP IS SELECTED:
    if (selectedRgp) {
      events.push({
        type: 'rgp_created',
        title: `Returnable Gate Pass Issued (#${selectedRgp.rgpNo})`,
        timestamp: formatDateTime(selectedRgp.date) || 'Pass Created',
        dateObj: parseToDateObject(selectedRgp.date),
        actor: selectedRgp.preparedBy || 'Store Incharge',
        icon: <FileText size={16} />,
        color: '#a855f7',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div><strong>Vendor/Processor:</strong> {selectedRgp.vendor || 'N/A'}</div>
              <div><strong>RGP Type:</strong> {selectedRgp.rgpType || 'RGP'}</div>
              <div><strong>Department:</strong> {selectedRgp.department || 'Dispatch'}</div>
              <div><strong>Purpose:</strong> {selectedRgp.purpose || 'Processing'}</div>
              <div><strong>Expected Return:</strong> {formatDateTime(selectedRgp.expectedReturnDate) || '—'}</div>
              <div><strong>Vehicle No:</strong> {selectedRgp.vehicleNo || 'N/A'}</div>
            </div>
            {selectedRgp.authorizedBy && (
              <div style={{ marginTop: '4px' }}><strong>Authorized By:</strong> {selectedRgp.authorizedBy}</div>
            )}
            {selectedRgp.remarks && (
              <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--text-muted)' }}>Remarks: {selectedRgp.remarks}</div>
            )}
          </div>
        )
      });

      if (selectedRgp.gateOutScan) {
        const s = selectedRgp.gateOutScan;
        events.push({
          type: 'gate_out_scan',
          title: `Security Gate Out Scan Verified (#${selectedRgp.rgpNo})`,
          timestamp: formatDateTime(s.scanned_at) || 'Scanned Out',
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name || 'Security Gatekeeper',
          icon: <Truck size={16} />,
          color: '#3b82f6',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Gatekeeper Log:</strong> Verified outward dispatch bundle destined for <strong>{s.supplier_name || selectedRgp.vendor}</strong>.</p>
              <p><strong>Item / Material:</strong> {s.material_name || 'Fabric/Trims'}</p>
              {s.quantity > 0 && <p><strong>Dispatched Units:</strong> {s.quantity} pcs</p>}
            </div>
          )
        });
      }

      selectedRgp.gateEntryScans.forEach(s => {
        events.push({
          type: 'gate_entry_scan',
          title: `Security Gate Entry Logged (#${selectedRgp.rgpNo})`,
          timestamp: formatDateTime(s.scanned_at) || 'Scanned',
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name || 'Gatekeeper',
          icon: <QrCode size={16} />,
          color: '#06b6d4',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Gate Log:</strong> {s.material_name} verified at checkpoint from <strong>{s.supplier_name}</strong>.</p>
            </div>
          )
        });
      });

      if (selectedRgp.gateInScan) {
        const s = selectedRgp.gateInScan;
        events.push({
          type: 'gate_in_scan',
          title: `Security Gate In Return Scan Verified (#${selectedRgp.rgpNo})`,
          timestamp: formatDateTime(s.scanned_at) || 'Returned',
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name || 'Security Gatekeeper',
          icon: <ShieldCheck size={16} />,
          color: '#10b981',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Return Check-in:</strong> Material successfully returned from <strong>{s.supplier_name || selectedRgp.vendor}</strong> and verified at entry gate.</p>
              <p><strong>Returned Material:</strong> {s.material_name || 'Fabric/Trims'}</p>
              {s.quantity > 0 && <p><strong>Verified Quantity:</strong> {s.quantity} pcs</p>}
            </div>
          )
        });
      }

      return events.sort((a, b) => a.dateObj - b.dateObj);
    }

    // 2. IF DORI PO IS SELECTED:
    if (selectedDori) {
      const d = selectedDori;
      const doriDate = d.Issue_Date || d.Timestamp;
      let placements = [];
      try {
        placements = JSON.parse(d.Selected_Placements || '[]');
      } catch (_) {}

      events.push({
        type: 'dori_created',
        title: `Dori Purchase Order Released (#${d.po_number || d.Lot_Number})`,
        timestamp: formatDateTime(doriDate) || 'PO Issued',
        dateObj: parseToDateObject(doriDate),
        actor: d.Supervisor || 'Storekeeper',
        icon: <Shuffle size={16} />,
        color: '#f59e0b',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Garment / Style:</strong> {d.Garment_Type || 'Garment'} — {d.Style || 'N/A'}</p>
            <p><strong>Total Ordered Units:</strong> {d.Total_Pieces || 0} pcs</p>
            <p><strong>Total Cost:</strong> ₹{parseFloat(d.Total_Cost || 0).toLocaleString('en-IN')}</p>
            {placements.length > 0 && <p><strong>Placements:</strong> {placements.join(', ')}</p>}
          </div>
        )
      });

      // Matching scans for this Dori PO
      const doriScans = scanLogs.filter(s => 
        String(s.lot_number).toLowerCase() === String(d.Lot_Number || '').toLowerCase() ||
        String(s.lot_number).toLowerCase() === String(d.po_number || '').toLowerCase()
      );
      doriScans.forEach(s => {
        events.push({
          type: 'scan_event',
          title: `Gate Scanner Verification (${s.scan_type || 'Gate Entry'})`,
          timestamp: formatDateTime(s.scanned_at),
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name || 'Gatekeeper',
          icon: <QrCode size={16} />,
          color: '#06b6d4',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Material:</strong> {s.material_name} ({s.quantity} pcs)</p>
              <p><strong>Supplier / Checkpoint:</strong> {s.supplier_name}</p>
            </div>
          )
        });
      });

      return events.sort((a, b) => a.dateObj - b.dateObj);
    }

    // 3. IF ZIP PO IS SELECTED:
    if (selectedZip) {
      const z = selectedZip;
      const zipDate = z.Saved_At || z.Issue_Date;
      let placements = [];
      try {
        placements = JSON.parse(z.Selected_Placements || '[]');
      } catch (_) {}

      events.push({
        type: 'zip_created',
        title: `Zip Purchase Order Released (#${z.po_number || z.Lot_Number})`,
        timestamp: formatDateTime(zipDate) || 'PO Issued',
        dateObj: parseToDateObject(zipDate),
        actor: z.Supervisor || 'Storekeeper',
        icon: <Scissors size={16} />,
        color: '#ec4899',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Garment / Style:</strong> {z.Garment_Type || z.ch_garment || 'Garment'} — {z.Style || z.ch_style || 'N/A'}</p>
            <p><strong>Teeth / Color:</strong> {z.Teeth_Color || 'Standard'}</p>
            <p><strong>Total Ordered Units:</strong> {z.Total_Pieces_CH || z.Total_Pieces || 0} pcs</p>
            <p><strong>Total Cost:</strong> ₹{parseFloat(z.Total_Cost || 0).toLocaleString('en-IN')}</p>
            {placements.length > 0 && <p><strong>Placements:</strong> {placements.join(', ')}</p>}
          </div>
        )
      });

      const zipScans = scanLogs.filter(s => 
        String(s.lot_number).toLowerCase() === String(z.Lot_Number || '').toLowerCase() ||
        String(s.lot_number).toLowerCase() === String(z.po_number || '').toLowerCase()
      );
      zipScans.forEach(s => {
        events.push({
          type: 'scan_event',
          title: `Gate Scanner Verification (${s.scan_type || 'Gate Entry'})`,
          timestamp: formatDateTime(s.scanned_at),
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name || 'Gatekeeper',
          icon: <QrCode size={16} />,
          color: '#06b6d4',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Material:</strong> {s.material_name} ({s.quantity} pcs)</p>
              <p><strong>Supplier / Checkpoint:</strong> {s.supplier_name}</p>
            </div>
          )
        });
      });

      return events.sort((a, b) => a.dateObj - b.dateObj);
    }

    // 4. IF GENERAL PURCHASE ORDER (PO) IS SELECTED:
    if (selectedPO) {
      const p = selectedPO;
      let parsedItems = [];
      try {
        parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []);
      } catch (_) {}

      events.push({
        type: 'po_created',
        title: `Purchase Order Generated (#${p.poNumber})`,
        timestamp: formatDateTime(p.date) || 'PO Generated',
        dateObj: parseToDateObject(p.date),
        actor: 'Purchasing Dept',
        icon: <ClipboardList size={16} />,
        color: '#3b82f6',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Supplier / Vendor:</strong> {p.vendorName || 'Supplier'}</p>
            <p><strong>Design / Lot:</strong> #{p.designName || p.lotId || 'General'}</p>
            <p><strong>Category:</strong> {p.category || 'Accessories'}</p>
            <p><strong>Total Amount:</strong> {currencySymbol}{parseFloat(p.total || 0).toLocaleString('en-IN')}</p>
            {parsedItems.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <strong>Ordered Line Items:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {parsedItems.map((it, idx) => (
                    <li key={idx}>{it.qty} {it.uom || 'pcs'} — {it.description || it.name || 'Trim'}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      });

      const poScans = scanLogs.filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        const pPo = String(p.poNumber || '').trim().toLowerCase();
        const pDes = String(p.designName || '').trim().toLowerCase();
        return sLot && (sLot === pPo || sLot === pDes);
      });

      poScans.forEach(s => {
        events.push({
          type: 'scan_event',
          title: `Security Gate & Material Scanner Verification (${s.scan_type || 'Gate Entry'})`,
          timestamp: formatDateTime(s.scanned_at || s.timestamp),
          dateObj: parseToDateObject(s.scanned_at || s.timestamp),
          actor: s.person_name || 'Security Guard',
          icon: <QrCode size={16} />,
          color: '#06b6d4',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Checkpoint:</strong> {s.scan_type === 'gate_entry' ? 'Gate Entry (Gate In)' : (s.scan_type === 'material_in' ? 'Material Entry / Received' : s.scan_type)}</p>
              <p><strong>Material Name:</strong> {s.material_name || 'Trims'} ({s.quantity || 0} pcs)</p>
              <p><strong>Supplier Verified:</strong> {s.supplier_name || p.vendorName}</p>
            </div>
          )
        });
      });

      return events.sort((a, b) => a.dateObj - b.dateObj);
    }

    // 5. IF EXTRA MATERIAL REQUISITION IS SELECTED:
    if (selectedExtra) {
      const ex = selectedExtra;
      const exDate = ex.issueDate || ex.createdAt || ex.date;
      const exItems = Array.isArray(ex.items) ? ex.items : [];

      events.push({
        type: 'extra_created',
        title: `Extra Material Requisition Issued (#${ex.voucherId || ex.id})`,
        timestamp: formatDateTime(exDate) || 'Requisition Created',
        dateObj: parseToDateObject(exDate),
        actor: ex.personName || 'Production Supervisor',
        icon: <ClipboardList size={16} />,
        color: '#ef4444',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Lot Number:</strong> #{ex.lot_no || ex.lotId || 'N/A'}</p>
            <p><strong>Department:</strong> {ex.department || 'Stitching'}</p>
            <p><strong>Receiver / Requester:</strong> {ex.receiverName || ex.personName || 'Store Incharge'}</p>
            <p><strong>Reason for Extra Issue:</strong> {ex.reason || 'Extra requirements / Defect compensation'}</p>
            {exItems.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <strong>Item Breakdown:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {exItems.map((it, idx) => (
                    <li key={idx}>+{it.totalRequired || it.qty || 0} {it.unit || 'pcs'} {it.bomItemName || it.materialName || 'Trims'}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      });

      return events.sort((a, b) => a.dateObj - b.dateObj);
    }

    // 5. IF SCANNER LOG IS SELECTED:
    if (selectedScan) {
      const s = selectedScan;
      events.push({
        type: 'scanner_checkpoint',
        title: `QR Security Checkpoint Logged (#${s.id})`,
        timestamp: formatDateTime(s.scanned_at || s.timestamp),
        dateObj: parseToDateObject(s.scanned_at || s.timestamp),
        actor: s.person_name || 'Security Gatekeeper',
        icon: <QrCode size={16} />,
        color: '#06b6d4',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Scan Type:</strong> {s.scan_type || 'Gate Entry'}</p>
            <p><strong>Linked Lot Number:</strong> #{s.lot_number || 'N/A'}</p>
            <p><strong>Supplier / Destination:</strong> {s.supplier_name || 'Vendor'}</p>
            <p><strong>Material Name:</strong> {s.material_name || 'Fabric/Trims'}</p>
            <p><strong>Verified Quantity:</strong> {s.quantity || 0} pcs</p>
          </div>
        )
      });

      return events;
    }

    // 6. IF DESIGN LOT IS SELECTED: Full 7-module lifecycle
    const lotIdLower = String(selectedDesign?.id || selectedLotId).replace('LOT-', '').toLowerCase();

    if (selectedDesign) {
      const regTime = selectedDesign.created_at || selectedDesign.date;
      events.push({
        type: 'registration',
        title: 'Design Pack Registered',
        timestamp: formatDateTime(regTime) || 'Initial Stage',
        dateObj: parseToDateObject(regTime),
        actor: selectedDesign.designer || 'System',
        icon: <FileText size={16} />,
        color: '#3b82f6',
        details: (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Style:</strong> {selectedDesign.style || 'N/A'}</div>
            <div><strong>Category:</strong> {selectedDesign.category || 'N/A'}</div>
            <div><strong>Brand/Client:</strong> {selectedDesign.brand || 'N/A'}</div>
            <div><strong>Fabric Type:</strong> {selectedDesign.fabricType || 'N/A'}</div>
            <div><strong>Target Pieces:</strong> {selectedDesign.quantity || 100} pcs</div>
            <div><strong>Status:</strong> {selectedDesign.status}</div>
          </div>
        )
      });
    }

    // Technical Verification Approvals/Rejections
    const lotHistory = historyLogs.filter(h => String(h.lotId).toLowerCase() === lotIdLower);
    lotHistory.forEach(h => {
      const isApprove = h.action === 'approved';
      events.push({
        type: 'verification',
        title: isApprove ? 'Technical Verification Approved' : 'Technical Verification Update',
        timestamp: formatDateTime(h.timestamp),
        dateObj: parseToDateObject(h.timestamp),
        actor: h.actorName || 'Admin',
        icon: isApprove ? <ShieldCheck size={16} /> : <AlertCircle size={16} />,
        color: isApprove ? '#10b981' : '#ef4444',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Action:</strong> {h.action?.toUpperCase()}</p>
            {h.details && <p><strong>Comments:</strong> {h.details}</p>}
          </div>
        )
      });
    });

    // General Purchase Orders (PO)
    const matchingPOs = pos.filter(po =>
      (po.designName && String(po.designName).toLowerCase() === lotIdLower) ||
      (po.poNumber && String(po.poNumber).toLowerCase() === lotIdLower)
    );
    matchingPOs.forEach(po => {
      let parsedItems = [];
      try {
        parsedItems = typeof po.items === 'string' ? JSON.parse(po.items) : po.items || [];
      } catch (e) { }

      events.push({
        type: 'po_general',
        title: `Trim Purchase Order Issued (${po.poNumber})`,
        timestamp: formatDateTime(po.date) || 'Processed',
        dateObj: parseToDateObject(po.date),
        actor: 'Purchasing',
        icon: <ClipboardList size={16} />,
        color: '#6366f1',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Supplier:</strong> {po.vendorName}</p>
            <p><strong>Total Amount:</strong> {currencySymbol}{po.total?.toFixed(2)}</p>
            {parsedItems.length > 0 && (
              <p><strong>Items:</strong> {parsedItems.map(it => `${it.qty} ${it.uom || 'pcs'} ${it.description || ''}`).join(', ')}</p>
            )}
          </div>
        )
      });
    });

    // Associated RGPs
    const associatedRgps = processedRgpList.filter(r => {
      if (String(r.rgpNo).toLowerCase() === lotIdLower) return true;
      if (Array.isArray(r.entries)) {
        return r.entries.some(e => String(e.lotNo || '').toLowerCase() === lotIdLower);
      }
      return false;
    });
    associatedRgps.forEach(r => {
      events.push({
        type: 'rgp_registered',
        title: `Returnable Gate Pass Issued (#${r.rgpNo})`,
        timestamp: formatDateTime(r.date) || 'Issued',
        dateObj: parseToDateObject(r.date),
        actor: r.preparedBy || 'Dispatch Head',
        icon: <Truck size={16} />,
        color: '#a855f7',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Vendor / Processor:</strong> {r.vendor} ({r.department})</p>
            <p><strong>Purpose:</strong> {r.purpose}</p>
            <p><strong>Status:</strong> {r.computedStatus}</p>
          </div>
        )
      });
    });

    // Zip Orders
    const matchingZipOrder = zipOrders.find(z => String(z.Lot_Number).toLowerCase() === lotIdLower);
    if (matchingZipOrder) {
      events.push({
        type: 'zip_po_created',
        title: `Zip Purchase Orders Compiled${matchingZipOrder.po_number ? ` — ${matchingZipOrder.po_number}` : ''}`,
        timestamp: formatDateTime(matchingZipOrder.Saved_At || matchingZipOrder.Issue_Date),
        dateObj: parseToDateObject(matchingZipOrder.Saved_At || matchingZipOrder.Issue_Date),
        actor: matchingZipOrder.Supervisor || 'Storekeeper',
        icon: <Scissors size={16} />,
        color: '#ec4899',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Garment:</strong> {matchingZipOrder.Garment_Type || matchingZipOrder.ch_garment} — {matchingZipOrder.Style || ''}</p>
            <p><strong>Total Pieces:</strong> {matchingZipOrder.Total_Pieces_CH || matchingZipOrder.Total_Pieces || 0} pcs</p>
          </div>
        )
      });
    }

    // Dori Orders
    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    if (matchingDooriOrder && matchingDooriOrder.dori_payload) {
      events.push({
        type: 'doori_po_created',
        title: `Dori PO Compiled${matchingDooriOrder.po_number ? ` — ${matchingDooriOrder.po_number}` : ''}`,
        timestamp: formatDateTime(matchingDooriOrder.Issue_Date || matchingDooriOrder.Timestamp),
        dateObj: parseToDateObject(matchingDooriOrder.Issue_Date || matchingDooriOrder.Timestamp),
        actor: matchingDooriOrder.Supervisor || 'Storekeeper',
        icon: <Shuffle size={16} />,
        color: '#f59e0b',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Garment:</strong> {matchingDooriOrder.Garment_Type} — {matchingDooriOrder.Style}</p>
            <p><strong>Total Pieces:</strong> {matchingDooriOrder.Total_Pieces} pcs</p>
          </div>
        )
      });
    }

    // Extra Material Issues
    const matchingExtra = extraMaterialIssues.filter(ex => String(ex.lot_no || ex.lotId).toLowerCase() === lotIdLower);
    matchingExtra.forEach(ex => {
      events.push({
        type: 'extra_material_log',
        title: `Extra Material Issued (#${ex.voucherId || ex.id})`,
        timestamp: formatDateTime(ex.issueDate || ex.createdAt),
        dateObj: parseToDateObject(ex.issueDate || ex.createdAt),
        actor: ex.personName || 'Store Incharge',
        icon: <ClipboardList size={16} />,
        color: '#ef4444',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Reason:</strong> {ex.reason || 'Extra requisition'}</p>
            <p><strong>Receiver:</strong> {ex.receiverName || 'Dept'}</p>
          </div>
        )
      });
    });

    // Scans
    const matchingScans = scanLogs.filter(s => {
      const scanLotLower = String(s.lot_number).toLowerCase();
      if (scanLotLower === lotIdLower) return true;
      return associatedRgps.some(r => String(r.rgpNo).toLowerCase() === scanLotLower);
    });
    matchingScans.forEach(s => {
      events.push({
        type: 'barcode_scan',
        title: `QR Scan Checkpoint: ${s.scan_type || 'Gate Entry'}`,
        timestamp: formatDateTime(s.scanned_at),
        dateObj: parseToDateObject(s.scanned_at),
        actor: s.person_name || 'Gatekeeper',
        icon: <QrCode size={16} />,
        color: '#06b6d4',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Party / Destination:</strong> {s.supplier_name}</p>
            {s.material_name && <p><strong>Material:</strong> {s.material_name} ({s.quantity || 0} pcs)</p>}
          </div>
        )
      });
    });

    return events.sort((a, b) => a.dateObj - b.dateObj);
  };

  // Compile workflow steps for selected Lot or RGP
  const getWorkflowSteps = () => {
    if (!selectedLotId) return [];

    if (selectedRgp) {
      const rgpCreated = Boolean(selectedRgp.date || selectedRgp.rgpNo);
      const gateOutDone = Boolean(selectedRgp.gateOutScan || selectedRgp.scans.length > 0);
      const vendorTransitDone = Boolean(selectedRgp.date);
      const returnDone = selectedRgp.isReturned;

      return [
        {
          id: 'rgp_issue',
          name: 'Stage 1: Returnable Gate Pass Issued & Authorized',
          isComplete: rgpCreated,
          date: selectedRgp.date,
          actor: selectedRgp.preparedBy || 'Dispatch Head',
          icon: <FileText size={16} />,
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <div><strong>Vendor:</strong> {selectedRgp.vendor}</div>
                <div><strong>Pass Type:</strong> {selectedRgp.rgpType}</div>
                <div><strong>Department:</strong> {selectedRgp.department}</div>
                <div><strong>Purpose:</strong> {selectedRgp.purpose}</div>
                <div><strong>Vehicle No:</strong> {selectedRgp.vehicleNo || 'N/A'}</div>
                <div><strong>Authorized By:</strong> {selectedRgp.authorizedBy || 'Authorized'}</div>
              </div>
              {selectedRgp.entries.length > 0 && (
                <div style={{ color: 'var(--accent-color)', fontWeight: '600' }}>
                  ✓ {selectedRgp.totalItemsCount} item(s) logged in manifest (Total Qty: {selectedRgp.totalQty1})
                </div>
              )}
            </div>
          )
        },
        {
          id: 'rgp_gate_out',
          name: 'Stage 2: Security Gate Out Dispatch Scan',
          isComplete: gateOutDone,
          date: selectedRgp.gateOutScan ? selectedRgp.gateOutScan.scanned_at : (selectedRgp.scans[0]?.scanned_at || selectedRgp.date),
          actor: selectedRgp.gateOutScan ? selectedRgp.gateOutScan.person_name : (selectedRgp.scans[0]?.person_name || 'Gatekeeper'),
          icon: <Truck size={16} />,
          details: gateOutDone ? (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Checkpoint Log:</strong> Verified outward dispatch at exit security post.</p>
              <p><strong>Processor Destination:</strong> {selectedRgp.gateOutScan?.supplier_name || selectedRgp.vendor}</p>
            </div>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting security scanner gate-out check.</span>
        },
        {
          id: 'rgp_transit',
          name: 'Stage 3: Vendor Processing & Transit Window',
          isComplete: vendorTransitDone,
          date: selectedRgp.expectedReturnDate,
          actor: selectedRgp.vendor,
          icon: <Activity size={16} />,
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>Target Return Date:</strong> {formatDateTime(selectedRgp.expectedReturnDate) || 'Flexible'}</span>
                <span className={`status-badge ${selectedRgp.isReturned ? 'verified' : (selectedRgp.isOverdue ? 'overdue' : 'in-verification')}`}>
                  {selectedRgp.computedStatus}
                </span>
              </div>
            </div>
          )
        },
        {
          id: 'rgp_gate_in',
          name: 'Stage 4: Security Gate In Return Scan & Inventory Inward',
          isComplete: returnDone,
          date: selectedRgp.gateInScan?.scanned_at,
          actor: selectedRgp.gateInScan?.person_name || (returnDone ? 'Gatekeeper' : ''),
          icon: <ShieldCheck size={16} />,
          details: returnDone ? (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Return Verification:</strong> Security scanner verified return inward.</p>
              {selectedRgp.gateInScan?.scanned_at && <p><strong>Inward Scanned At:</strong> {formatDateTime(selectedRgp.gateInScan.scanned_at)}</p>}
            </div>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Pending return delivery and gate scanner verification.</span>
        }
      ];
    }

    // IF GENERAL PO IS SELECTED:
    if (selectedPO) {
      const p = selectedPO;
      const poScans = scanLogs.filter(s => {
        const sLot = String(s.lot_number || '').trim().toLowerCase();
        const pPo = String(p.poNumber || '').trim().toLowerCase();
        const pDes = String(p.designName || '').trim().toLowerCase();
        return sLot && (sLot === pPo || sLot === pDes);
      });
      const gateScan = poScans.find(s => s.scan_type === 'gate_entry');
      const matInScan = poScans.find(s => s.scan_type === 'material_in');

      return [
        {
          id: 'po_issue',
          name: `Stage 1: Purchase Order Generated (#${p.poNumber})`,
          isComplete: true,
          date: p.date,
          actor: 'Purchasing',
          icon: <ClipboardList size={16} />,
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Supplier:</strong> {p.vendorName || 'Vendor'}</p>
              <p><strong>Total Amount:</strong> {currencySymbol}{parseFloat(p.total || 0).toLocaleString('en-IN')}</p>
            </div>
          )
        },
        {
          id: 'po_gate',
          name: 'Stage 2: Security Gate Entry (Gate In) Verification',
          isComplete: Boolean(gateScan),
          date: gateScan?.scanned_at,
          actor: gateScan?.person_name || 'Gatekeeper',
          icon: <QrCode size={16} />,
          details: gateScan ? (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Gate Checkpoint:</strong> Verified {gateScan.material_name || 'Goods'} ({gateScan.quantity || 0} pcs) from {gateScan.supplier_name || p.vendorName}.</p>
            </div>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting gate entry scan checkpoint.</span>
        },
        {
          id: 'po_receive',
          name: 'Stage 3: Material Entry & Received Store Check-In',
          isComplete: Boolean(matInScan),
          date: matInScan?.scanned_at,
          actor: matInScan?.person_name || 'Store Incharge',
          icon: <ShieldCheck size={16} />,
          details: matInScan ? (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Material Received:</strong> {matInScan.material_name} ({matInScan.quantity || 0} pcs) verified and stocked in inventory.</p>
            </div>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting material received verification.</span>
        }
      ];
    }

    // Default design workflow
    const lotIdLower = String(selectedDesign?.id || selectedLotId).replace('LOT-', '').toLowerCase().trim();
    const designExists = !!selectedDesign;
    const designDate = selectedDesign ? (selectedDesign.created_at || selectedDesign.date) : '';
    const designer = selectedDesign ? (selectedDesign.designer || 'System') : '';

    const approvedLog = historyLogs.find(h => String(h.lotId).toLowerCase() === lotIdLower && h.action === 'approved');
    const designApproved = (selectedDesign?.status?.toLowerCase() === 'approved') || !!approvedLog;

    const matchingPOs = pos.filter(po => (po.designName && String(po.designName).toLowerCase() === lotIdLower) || (po.poNumber && String(po.poNumber).toLowerCase() === lotIdLower));
    const poReleased = matchingPOs.length > 0;

    const associatedRgps = processedRgpList.filter(r => String(r.rgpNo).toLowerCase() === lotIdLower || (Array.isArray(r.entries) && r.entries.some(e => String(e.lotNo || '').toLowerCase() === lotIdLower)));
    const rgpReleased = associatedRgps.length > 0;

    const matchingZipOrder = zipOrders.find(z => String(z.Lot_Number).toLowerCase() === lotIdLower);
    const zipCompiled = !!matchingZipOrder;

    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    const dooriReleased = !!(matchingDooriOrder && matchingDooriOrder.dori_payload);

    return [
      { id: 'design', name: 'Stage 1: Design Pack Registration', isComplete: designExists, date: designDate, actor: designer, icon: <FileText size={16} /> },
      { id: 'approved', name: 'Stage 2: Technical Verification Approval', isComplete: designApproved, date: approvedLog?.timestamp, actor: approvedLog?.actorName || 'Admin', icon: <ShieldCheck size={16} /> },
      { id: 'po', name: 'Stage 3: Trim Purchase Order (PO) Release', isComplete: poReleased, date: matchingPOs[0]?.date, actor: 'Purchasing', icon: <ClipboardList size={16} /> },
      { id: 'rgp', name: 'Stage 4: Fabric / Material RGP Gate Pass', isComplete: rgpReleased, date: associatedRgps[0]?.date, actor: associatedRgps[0]?.preparedBy, icon: <Truck size={16} /> },
      { id: 'zip', name: 'Stage 5: Zip Purchase Order Release', isComplete: zipCompiled, date: matchingZipOrder?.Saved_At || matchingZipOrder?.Issue_Date, actor: matchingZipOrder?.Supervisor, icon: <Scissors size={16} /> },
      { id: 'doori', name: 'Stage 6: Dori / Thread PO Release', isComplete: dooriReleased, date: matchingDooriOrder?.Issue_Date || matchingDooriOrder?.Timestamp, actor: matchingDooriOrder?.Supervisor, icon: <Shuffle size={16} /> }
    ];
  };

  // PDF Generator for selected item
  const downloadWorkflowPDF = () => {
    if (selectedRgp) {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const r = selectedRgp;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(31, 41, 55);
      doc.text('RETURNABLE GATE PASS (RGP) AUDIT REPORT', 40, 50);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Pass Ref: #${r.rgpNo}`, 40, 68);

      autoTable(doc, {
        startY: 85,
        margin: { left: 40, right: 40 },
        theme: 'grid',
        head: [['Field', 'Details', 'Field', 'Details']],
        body: [
          ['RGP Number', `#${r.rgpNo}`, 'Status', r.computedStatus],
          ['Date Issued', r.date || '—', 'Expected Return', r.expectedReturnDate || '—'],
          ['Vendor / Processor', r.vendor || '—', 'Department', r.department || '—'],
          ['Pass Type', r.rgpType || '—', 'Vehicle No', r.vehicleNo || '—'],
          ['Prepared By', r.preparedBy || '—', 'Authorized By', r.authorizedBy || '—'],
          ['Purpose', r.purpose || '—', 'Remarks', r.remarks || '—']
        ],
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255] }
      });

      const itemsY = doc.lastAutoTable.finalY + 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('1. Itemized Dispatched Items Matrix', 40, itemsY);

      const itemRows = r.entries.map((e, idx) => [
        idx + 1,
        e.lotNo || '—',
        e.itemDesc || '—',
        `${e.qty1 || 0} ${e.uom || 'pcs'}`,
        `${e.qty2 || 0} ${e.uom || 'pcs'}`,
        e.purpose || '—',
        e.remarks || '—'
      ]);

      autoTable(doc, {
        startY: itemsY + 10,
        margin: { left: 40, right: 40 },
        theme: 'striped',
        head: [['#', 'Lot No', 'Description / Fabric Details', 'Qty 1', 'Qty 2', 'Purpose', 'Remarks']],
        body: itemRows.length > 0 ? itemRows : [['—', '—', 'No itemized rows found', '—', '—', '—', '—']],
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] }
      });

      doc.save(`RGP_${r.rgpNo}_Audit_Report.pdf`);
      return;
    }

    // Default lot workflow report
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const targetTitle = selectedItemMeta?.title || `Item #${selectedLotId}`;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text(`OPERATIONAL HISTORY REPORT: ${targetTitle}`, 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 40, 68);

    const events = getTimelineEvents();
    const eventRows = events.map((evt, idx) => [
      idx + 1,
      evt.timestamp,
      evt.title,
      evt.actor || 'System'
    ]);

    autoTable(doc, {
      startY: 85,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      head: [['#', 'Timestamp', 'Operational Milestone / Event', 'Actor / Operator']],
      body: eventRows.length > 0 ? eventRows : [['—', '—', 'No event logs recorded', '—']],
      styles: { fontSize: 8.5, cellPadding: 6 },
      headStyles: { fillColor: [0, 75, 135], textColor: [255, 255, 255] }
    });

    doc.save(`Operations_Audit_${String(selectedLotId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  };

  // Export Filtered History Items to Excel / CSV
  const handleExportHistoryExcel = () => {
    const headers = ['ID', 'Module Type', 'Title', 'Sub Title', 'Secondary Info', 'Date / Timestamp'];
    const rows = filteredLotsList.map(item => [
      `"${item.id || ''}"`,
      `"${item.itemType || ''}"`,
      `"${String(item.title || '').replace(/"/g, '""')}"`,
      `"${String(item.subTitle || '').replace(/"/g, '""')}"`,
      `"${String(item.secondaryText || '').replace(/"/g, '""')}"`,
      `"${formatDateTime(item.date)}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Operations_History_Register_${itemCategory}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const timelineEvents = getTimelineEvents();
  const workflowSteps = getWorkflowSteps();
  const completedStepsCount = workflowSteps.filter(s => s.isComplete).length;
  const visibleSteps = workflowSteps.filter(step => {
    if (step.id === 'design' || step.id === 'approved' || step.id === 'rgp_issue') return true;
    return step.isComplete;
  });
  const allComplete = selectedRgp ? selectedRgp.isReturned : (completedStepsCount >= 4);

  return (
    <div className="animate-fade">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
            Operations &amp; RGP Work History
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Multi-module history tracker &amp; audit trail for RGP passes, Dori PO, Zip PO, General PO, Extra Pieces, and Gate Scans.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={fetchHistoryData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportHistoryExcel}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px', borderColor: '#10b981', color: '#10b981' }}
          >
            <FileSpreadsheet size={13} />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px' }}>{errorMessage}</span>
        </div>
      )}

      {/* Analytics KPI Ribbon Banner */}
      <div className="animate-slide-up" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        {[
          { label: 'All Items', value: unifiedItemsList.length, icon: <Boxes size={16} />, color: '#0284c7', bg: '#e0f2fe' },
          { label: 'RGP Passes', value: processedRgpList.length, icon: <Truck size={16} />, color: '#a855f7', bg: '#f3e8ff' },
          { label: 'Dori POs', value: dooriOrders.length, icon: <Shuffle size={16} />, color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Zip POs', value: zipOrders.length, icon: <Scissors size={16} />, color: '#ec4899', bg: '#fce7f3' },
          { label: 'General POs', value: pos.length, icon: <ClipboardList size={16} />, color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Extra Pieces', value: extraMaterialIssues.length, icon: <ShieldAlert size={16} />, color: '#ef4444', bg: '#fee2e2' },
          { label: 'Gate Scans', value: scanLogs.length, icon: <QrCode size={16} />, color: '#06b6d4', bg: '#cffafe' },
          { label: 'Returned RGPs', value: processedRgpList.filter(r => r.computedStatus === 'Returned').length, icon: <ShieldCheck size={16} />, color: '#10b981', bg: '#d1fae5' },
        ].map((stat, i) => (
          <div
            key={i}
            className="analytics-kpi-card"
            style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                {stat.icon}
              </div>
              <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)' }}>
                {stat.value}
              </span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left Panel: Filter & Item Selector */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '18px' }}>
            <h3 className="panel-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <Search size={15} />
              <span>Select Record to Inspect</span>
            </h3>

            {/* Category Selector Tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--bg-secondary)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '12px',
              flexWrap: 'wrap'
            }}>
              {[
                { id: 'all', label: 'All', count: unifiedItemsList.length },
                { id: 'rgps', label: 'RGP', count: processedRgpList.length, highlight: '#a855f7' },
                { id: 'dori', label: 'Dori', count: dooriOrders.length, highlight: '#f59e0b' },
                { id: 'zip', label: 'Zip', count: zipOrders.length, highlight: '#ec4899' },
                { id: 'pos', label: 'PO', count: pos.length, highlight: '#3b82f6' },
                { id: 'extra_material', label: 'Extra', count: extraMaterialIssues.length, highlight: '#ef4444' },
                { id: 'scans', label: 'Scan', count: scanLogs.length, highlight: '#06b6d4' },
                { id: 'designs', label: 'Lots', count: designs.length, highlight: '#10b981' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setItemCategory(tab.id)}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '40px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: itemCategory === tab.id ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: itemCategory === tab.id ? 'var(--bg-primary)' : 'transparent',
                    color: itemCategory === tab.id ? (tab.highlight || 'var(--accent-color)') : 'var(--text-muted)',
                    boxShadow: itemCategory === tab.id ? 'var(--shadow-sm)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '9px',
                    opacity: 0.8,
                    background: itemCategory === tab.id ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.04)',
                    padding: '1px 3px',
                    borderRadius: '3px'
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search input */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Search RGP #, PO, Dori, Zip, Scan..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', height: '34px', fontSize: '12px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Quick Filters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              {itemCategory === 'rgps' ? (
                <div>
                  <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>RGP Status</label>
                  <select
                    value={rgpStatusFilter}
                    onChange={(e) => setRgpStatusFilter(e.target.value)}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="in_transit">In Transit</option>
                    <option value="returned">Returned</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Date Range</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">Past 30 Days</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Sort Order</label>
                <select
                  value={ageSort}
                  onChange={(e) => setAgeSort(e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>

            {/* List of Filtered Items */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '5px',
              maxHeight: '340px', overflowY: 'auto', paddingRight: '3px',
              border: '1px solid var(--border-color)', borderRadius: '8px', padding: '5px'
            }}>
              {filteredLotsList.map(item => {
                const isSelected = selectedLotId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedLotId(item.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all 0.15s',
                      backgroundColor: isSelected ? 'rgba(0, 75, 135, 0.08)' : 'transparent',
                      border: '1.5px solid',
                      borderColor: isSelected ? (item.badgeColor || '#004b87') : 'transparent',
                      color: 'var(--text-main)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: item.badgeColor || 'var(--accent-color)'
                        }}></span>
                        <span style={{ fontWeight: '700', fontSize: '12.5px' }}>
                          {item.title}
                        </span>
                      </div>

                      {item.rgp && (
                        <span className={`status-badge ${item.rgp.computedStatus === 'Returned' ? 'verified' : (item.rgp.computedStatus === 'Overdue' ? 'overdue' : 'in-verification')}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {item.rgp.computedStatus}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{item.subTitle}</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.secondaryText}</span>
                    </div>

                    {item.date && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.75 }}>
                        <Clock size={9} />
                        <span>{formatDateTime(item.date)}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredLotsList.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No records match current search or filters.
                </div>
              )}
            </div>
          </div>

          {/* Contextual Specification Card */}
          {selectedRgp ? (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: '4px solid #a855f7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#a855f7', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Truck size={15} />
                  <span>RGP Manifest Details</span>
                </h3>
                <span className={`status-badge ${selectedRgp.computedStatus === 'Returned' ? 'verified' : (selectedRgp.computedStatus === 'Overdue' ? 'overdue' : 'in-verification')}`}>
                  {selectedRgp.computedStatus}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>RGP No</span>
                  <span style={{ fontWeight: '800', color: '#a855f7' }}>#{selectedRgp.rgpNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vendor / Party</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.vendor || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Department</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.department || 'Store'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expected Return</span>
                  <span style={{ fontWeight: '700', color: selectedRgp.isOverdue ? '#ef4444' : 'var(--text-main)' }}>
                    {formatDateTime(selectedRgp.expectedReturnDate) || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Dispatched Items</span>
                  <span style={{ fontWeight: '800', color: 'var(--accent-color)' }}>{selectedRgp.totalItemsCount} items ({selectedRgp.totalQty1} pcs)</span>
                </div>
              </div>
            </div>
          ) : selectedDori ? (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Shuffle size={15} />
                  <span>Dori Purchase Order</span>
                </h3>
                <span className="status-badge verified">Active PO</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PO Ref</span>
                  <span style={{ fontWeight: '800', color: '#f59e0b' }}>#{selectedDori.po_number || selectedDori.Lot_Number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Garment &amp; Style</span>
                  <span style={{ fontWeight: '600' }}>{selectedDori.Garment_Type} • {selectedDori.Style}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Pieces</span>
                  <span style={{ fontWeight: '700' }}>{selectedDori.Total_Pieces} pcs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Cost</span>
                  <span style={{ fontWeight: '800', color: 'var(--accent-color)' }}>₹{parseFloat(selectedDori.Total_Cost || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : selectedZip ? (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: '4px solid #ec4899' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Scissors size={15} />
                  <span>Zip Purchase Order</span>
                </h3>
                <span className="status-badge verified">Active PO</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PO Ref</span>
                  <span style={{ fontWeight: '800', color: '#ec4899' }}>#{selectedZip.po_number || selectedZip.Lot_Number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Garment &amp; Teeth</span>
                  <span style={{ fontWeight: '600' }}>{selectedZip.Garment_Type} • {selectedZip.Teeth_Color || 'STD'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Pieces</span>
                  <span style={{ fontWeight: '700' }}>{selectedZip.Total_Pieces_CH || selectedZip.Total_Pieces || 0} pcs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Cost</span>
                  <span style={{ fontWeight: '800', color: 'var(--accent-color)' }}>₹{parseFloat(selectedZip.Total_Cost || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : selectedPO ? (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <ClipboardList size={15} />
                  <span>Purchase Order Details</span>
                </h3>
                <span className="status-badge verified">{selectedPO.status || 'Active PO'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PO Number</span>
                  <span style={{ fontWeight: '800', color: '#3b82f6' }}>#{selectedPO.poNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vendor / Supplier</span>
                  <span style={{ fontWeight: '600' }}>{selectedPO.vendorName || 'Supplier'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Design Lot Ref</span>
                  <span style={{ fontWeight: '600' }}>#{selectedPO.designName || selectedPO.lotId || 'General'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Amount</span>
                  <span style={{ fontWeight: '800', color: 'var(--accent-color)' }}>{currencySymbol}{parseFloat(selectedPO.total || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : selectedExtra ? (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <ClipboardList size={15} />
                  <span>Extra Material Requisition</span>
                </h3>
                <span className="status-badge overdue">Requisition</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Voucher ID</span>
                  <span style={{ fontWeight: '800', color: '#ef4444' }}>#{selectedExtra.voucherId || selectedExtra.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lot Reference</span>
                  <span style={{ fontWeight: '700' }}>#{selectedExtra.lot_no || selectedExtra.lotId || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Requester / Dept</span>
                  <span style={{ fontWeight: '600' }}>{selectedExtra.receiverName || selectedExtra.personName || 'Store'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reason</span>
                  <span style={{ fontWeight: '600', fontStyle: 'italic', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedExtra.reason || 'Extra requirement'}</span>
                </div>
              </div>
            </div>
          ) : selectedScan ? (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: '4px solid #06b6d4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <QrCode size={15} />
                  <span>Scanner Checkpoint Log</span>
                </h3>
                <span className="status-badge verified">✓ Verified</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Scan ID &amp; Type</span>
                  <span style={{ fontWeight: '800', color: '#06b6d4' }}>#{selectedScan.id} ({selectedScan.scan_type})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lot Number</span>
                  <span style={{ fontWeight: '700' }}>#{selectedScan.lot_number || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gatekeeper</span>
                  <span style={{ fontWeight: '600' }}>{selectedScan.person_name || 'Guard'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Material &amp; Qty</span>
                  <span style={{ fontWeight: '700' }}>{selectedScan.material_name || 'Trims'} ({selectedScan.quantity || 0} pcs)</span>
                </div>
              </div>
            </div>
          ) : selectedDesign ? (
            <div className="panel animate-scale" style={{ padding: '16px' }}>
              <h3 className="panel-title" style={{ marginBottom: '10px', fontSize: '13px' }}>Lot Specifications</h3>
              {selectedDesign.imageUrl && (
                <div style={{ width: '100%', height: '120px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px', marginBottom: '10px' }}>
                  <img
                    src={getCleanImageUrl(selectedDesign.imageUrl)}
                    alt="Design spec"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lot ID</span>
                  <span style={{ fontWeight: '700' }}>#{getLotVersionInfo(selectedDesign.id, designs).displayLot}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Style Code</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.style}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Brand/Client</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.brand}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Pieces</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{selectedDesign.quantity || 100} pcs</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Panel: Workflow Timeline, Pipeline & Logs */}
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '20px', minHeight: '400px' }}>
            {/* View Mode Bar & Download Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '18px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '14px'
            }}>
              <div style={{
                display: 'flex',
                gap: '4px',
                backgroundColor: 'var(--bg-primary)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <button
                  onClick={() => setViewMode('pipeline')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: viewMode === 'pipeline' ? 'var(--accent-color)' : 'transparent',
                    color: viewMode === 'pipeline' ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  Workflow Pipeline
                </button>
                <button
                  onClick={() => setViewMode('chronological')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: viewMode === 'chronological' ? 'var(--accent-color)' : 'transparent',
                    color: viewMode === 'chronological' ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  Chronological Log
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: viewMode === 'calendar' ? 'var(--accent-color)' : 'transparent',
                    color: viewMode === 'calendar' ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  📅 Calendar Tracker
                </button>
                <button
                  onClick={() => setViewMode('item_code')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: viewMode === 'item_code' ? 'var(--accent-color)' : 'transparent',
                    color: viewMode === 'item_code' ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  📦 Item Code Ledger
                </button>
              </div>

              <button
                onClick={downloadWorkflowPDF}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: selectedRgp ? '#9333ea' : '#004b87',
                  color: '#ffffff',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Download size={13} />
                <span>{selectedRgp ? 'Download RGP PDF' : 'Download Audit PDF'}</span>
              </button>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--accent-light)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Compiling Workflow History Logs...</span>
              </div>
            ) : viewMode === 'item_code' ? (
              <ItemCodeReportView
                weightCaptures={weightCaptures}
                issueLogs={issueLogs}
                transfers={transfers}
                currencySymbol={currencySymbol}
              />
            ) : !selectedLotId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>No Item Selected</h4>
                <p style={{ fontSize: '13px', maxWidth: '360px' }}>Select an active record from the left panel list to inspect its lifecycle timeline.</p>
              </div>
            ) : viewMode === 'calendar' ? (
              <DailyWeeklyCalendarReport
                issueLogs={issueLogs}
                extraMaterialIssues={extraMaterialIssues}
                pos={pos}
                designs={designs}
                scans={scanLogs}
                transfers={transfers}
                weightCaptures={weightCaptures}
                zipOrders={zipOrders}
                dooriOrders={dooriOrders}
                designHistory={historyLogs}
                currencySymbol={currencySymbol}
                embeddedIn="history"
                onSelectLot={(lot) => {
                  setSelectedLotId(lot);
                  setViewMode('pipeline');
                }}
              />
            ) : viewMode === 'pipeline' ? (
              /* Pipeline View */
              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                <div style={{
                  position: 'absolute', left: '9px', top: '12px', bottom: '12px',
                  width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {visibleSteps.map((step) => (
                    <div key={step.id} style={{ position: 'relative', display: 'flex', gap: '14px', zIndex: 2 }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: step.isComplete ? 'var(--success)' : 'var(--bg-primary)',
                        border: '3px solid', borderColor: step.isComplete ? 'var(--success)' : 'var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
                        fontSize: '9px', fontWeight: 'bold', flexShrink: 0, marginTop: '3px',
                        boxShadow: '0 0 0 4px var(--bg-secondary)'
                      }}>
                        {step.isComplete && <Check size={10} strokeWidth={3} />}
                      </div>

                      <div className="panel" style={{
                        flex: 1, padding: '12px 16px', margin: 0, boxShadow: 'var(--shadow-sm)',
                        borderColor: step.isComplete ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                        backgroundColor: step.isComplete ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.01)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: step.isComplete ? 'var(--success)' : 'var(--text-light)', display: 'inline-flex' }}>{step.icon}</span>
                            <span>{step.name}</span>
                          </span>

                          <span style={{
                            fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
                            backgroundColor: step.isComplete ? 'var(--success-light)' : 'rgba(148, 163, 184, 0.1)',
                            color: step.isComplete ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {step.isComplete ? 'Complete' : 'Pending'}
                          </span>
                        </div>

                        {step.isComplete && step.date && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <span>Completed: <strong>{formatDateTime(step.date)}</strong></span>
                            {step.actor && <span style={{ marginLeft: '12px' }}>by <strong>{step.actor}</strong></span>}
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px' }}>
                          {step.details}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* If RGP Selected: Show Dispatched Items Table & Gate Scan Trail */}
                {selectedRgp && (
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)', borderRadius: '10px',
                      border: '1.5px solid var(--border-color)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Boxes size={15} style={{ color: '#a855f7' }} />
                        <span>Itemized Dispatched Items Matrix ({selectedRgp.totalItemsCount} rows)</span>
                      </h4>

                      {selectedRgp.entries && selectedRgp.entries.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                                <th style={{ padding: '6px 8px' }}>#</th>
                                <th style={{ padding: '6px 8px' }}>Lot Reference</th>
                                <th style={{ padding: '6px 8px' }}>Item Description</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty 1</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty 2</th>
                                <th style={{ padding: '6px 8px' }}>Purpose</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRgp.entries.map((entry, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: '700' }}>{entry.lotNo || '—'}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: '600' }}>{entry.itemDesc || '—'}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#a855f7' }}>
                                    {entry.qty1 || 0} {entry.uom || 'pcs'}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                    {entry.qty2 ? `${entry.qty2} ${entry.uom || 'pcs'}` : '—'}
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>{entry.purpose || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No itemized rows recorded in pass payload.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Chronological Timeline View */
              <div style={{ position: 'relative', paddingLeft: '20px' }}>
                <div style={{
                  position: 'absolute', left: '7px', top: '10px', bottom: '10px',
                  width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} style={{ position: 'relative', display: 'flex', gap: '14px', zIndex: 2 }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: 'var(--bg-primary)', border: '3.5px solid',
                        borderColor: evt.color || 'var(--accent-color)', flexShrink: 0, marginTop: '4px',
                        boxShadow: '0 0 0 3px var(--bg-primary)'
                      }}></div>

                      <div className="animate-scale" style={{
                        flex: 1, backgroundColor: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)', borderRadius: '10px',
                        padding: '12px 16px', boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: evt.color, display: 'inline-flex' }}>{evt.icon}</span>
                            <span>{evt.title}</span>
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{evt.timestamp}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          <span>by <strong>{evt.actor}</strong></span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', color: 'var(--text-color)', fontSize: '12.5px' }}>
                          {evt.details}
                        </div>
                      </div>
                    </div>
                  ))}

                  {timelineEvents.length === 0 && (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No chronological milestones logged for this record.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
