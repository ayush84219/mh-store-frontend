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

  // Aggregated Purely Lot-Wise Registry List
  // Aggregated Purely BOM Lot Registry List
  const lotRegistryList = useMemo(() => {
    const lotsMap = new Map();

    // 1. Populate ONLY from registered BOM designs
    (designs || []).forEach(d => {
      if (!d.id) return;
      const cleanLot = String(d.id).replace('LOT-', '').trim();
      if (!cleanLot) return;
      const lower = cleanLot.toLowerCase();

      if (!lotsMap.has(lower)) {
        lotsMap.set(lower, {
          id: `LOT-${cleanLot}`,
          lotNo: cleanLot,
          displayLot: getLotVersionInfo(cleanLot, designs).displayLot,
          versionText: getLotVersionInfo(cleanLot, designs).versionText,
          isRecreated: getLotVersionInfo(cleanLot, designs).isRecreated,
          design: d,
          brand: d.brand || 'Client',
          category: d.category || 'Garment',
          style: d.style || 'Custom Style',
          quantity: d.quantity || 100,
          status: d.status || 'Draft',
          date: d.created_at || d.date || '',
          imageUrl: d.imageUrl || null,
          matchingPOs: [],
          matchingRgps: [],
          matchingDori: [],
          matchingZip: [],
          matchingExtra: [],
          matchingScans: [],
          matchingLogs: [],
          matchingIssueLogs: [],
          matchingWeight: []
        });
      }
    });

    // Helper to find existing BOM lot
    const findBomLot = (rawKey) => {
      if (!rawKey) return null;
      const clean = String(rawKey).replace('LOT-', '').trim().toLowerCase();
      if (!clean) return null;
      return lotsMap.get(clean) || null;
    };

    // 2. Link General POs to BOM lots
    (pos || []).forEach(p => {
      const lot = findBomLot(p.designName) || findBomLot(p.lotId);
      if (lot) lot.matchingPOs.push(p);
    });

    // 3. Link RGPs to BOM lots
    processedRgpList.forEach(r => {
      let matchedLots = new Set();
      (r.entries || []).forEach(e => {
        if (e.lotNo) {
          const lot = findBomLot(e.lotNo);
          if (lot && !matchedLots.has(lot.lotNo)) {
            lot.matchingRgps.push(r);
            matchedLots.add(lot.lotNo);
          }
        }
      });
      if (r.lotNo) {
        const lot = findBomLot(r.lotNo);
        if (lot && !matchedLots.has(lot.lotNo)) {
          lot.matchingRgps.push(r);
          matchedLots.add(lot.lotNo);
        }
      }
    });

    // 4. Link Dori Orders to BOM lots
    (dooriOrders || []).forEach(d => {
      const lot = findBomLot(d.Lot_Number) || findBomLot(d.lotNo);
      if (lot) lot.matchingDori.push(d);
    });

    // 5. Link Zip Orders to BOM lots
    (zipOrders || []).forEach(z => {
      const lot = findBomLot(z.Lot_Number) || findBomLot(z.lotNo);
      if (lot) lot.matchingZip.push(z);
    });

    // 6. Link Extra Material Issues to BOM lots
    (extraMaterialIssues || []).forEach(ex => {
      const lot = findBomLot(ex.lot_no) || findBomLot(ex.lotId);
      if (lot) lot.matchingExtra.push(ex);
    });

    // 7. Link Security Scans to BOM lots
    (scanLogs || []).forEach(s => {
      const lot = findBomLot(s.lot_number);
      if (lot) {
        lot.matchingScans.push(s);
      } else {
        // Also check if scan was for an RGP linked to a BOM lot
        for (const bomLot of lotsMap.values()) {
          const rgpMatch = bomLot.matchingRgps.some(r => String(r.rgpNo).toLowerCase() === String(s.lot_number).toLowerCase());
          if (rgpMatch && !bomLot.matchingScans.some(sc => sc.id === s.id)) {
            bomLot.matchingScans.push(s);
          }
        }
      }
    });

    // 8. Link Audit Logs to BOM lots
    (historyLogs || []).forEach(h => {
      const lot = findBomLot(h.lotId);
      if (lot) lot.matchingLogs.push(h);
    });

    // 9. Compute stage metrics for each BOM lot
    const list = Array.from(lotsMap.values()).map(lot => {
      const hasDesign = Boolean(lot.design);
      const isApproved = lot.design?.status?.toLowerCase() === 'approved' || lot.matchingLogs.some(l => l.action === 'approved');
      const isRejected = lot.design?.status?.toLowerCase() === 'rejected' || lot.matchingLogs.some(l => l.action === 'rejected');
      const hasPOs = lot.matchingPOs.length > 0;
      const hasRgp = lot.matchingRgps.length > 0;
      const hasZip = lot.matchingZip.length > 0;
      const hasDori = lot.matchingDori.length > 0;
      const hasScans = lot.matchingScans.length > 0;

      let completedStages = 0;
      if (hasDesign) completedStages++;
      if (isApproved) completedStages++;
      if (hasPOs) completedStages++;
      if (hasRgp) completedStages++;
      if (hasZip) completedStages++;
      if (hasDori) completedStages++;
      if (hasScans) completedStages++;

      const isFullyComplete = completedStages >= 4;
      const hasProductionActivity = hasPOs || hasRgp || hasZip || hasDori || hasScans;

      let computedStatus = lot.status || 'Draft';
      if (isFullyComplete) {
        computedStatus = 'Completed';
      } else if (hasProductionActivity) {
        computedStatus = 'In Production';
      } else if (isApproved) {
        computedStatus = 'Approved';
      } else if (isRejected) {
        computedStatus = 'Rejected';
      } else if (lot.design?.status) {
        computedStatus = lot.design.status.charAt(0).toUpperCase() + lot.design.status.slice(1);
      }

      let badgeColor = '#f59e0b';
      if (isFullyComplete) badgeColor = '#059669';
      else if (computedStatus.toLowerCase() === 'rejected') badgeColor = '#ef4444';
      else if (isApproved) badgeColor = '#10b981';
      else if (hasProductionActivity) badgeColor = '#3b82f6';
      else badgeColor = '#f59e0b';

      return {
        ...lot,
        hasDesign,
        isApproved,
        isRejected,
        hasPOs,
        hasRgp,
        hasZip,
        hasDori,
        hasScans,
        completedStages,
        totalStages: 7,
        completionPercent: Math.round((completedStages / 7) * 100),
        isFullyComplete,
        hasProductionActivity,
        computedStatus,
        badgeColor
      };
    });

    return list;
  }, [designs, pos, processedRgpList, dooriOrders, zipOrders, extraMaterialIssues, scanLogs, historyLogs]);

  // Filter list based on selected category & search query
  const filteredLotsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let list = lotRegistryList.filter(lot => {
      // 1. Category filter (Lot-wise)
      if (itemCategory === 'approved' && !lot.isApproved) return false;
      if (itemCategory === 'production' && !lot.hasProductionActivity) return false;
      if (itemCategory === 'rgps' && lot.matchingRgps.length === 0) return false;
      if (itemCategory === 'pos' && lot.matchingPOs.length === 0) return false;
      if (itemCategory === 'dori_zip' && (lot.matchingDori.length === 0 && lot.matchingZip.length === 0)) return false;
      if (itemCategory === 'completed' && !lot.isFullyComplete) return false;

      // 2. Status filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'approved' && !lot.isApproved) return false;
        if (typeFilter === 'pending' && lot.isApproved) return false;
        if (typeFilter === 'completed' && !lot.isFullyComplete) return false;
        if (typeFilter === 'production' && !lot.hasProductionActivity) return false;
      }

      // 3. Date range filter
      if (dateFilter !== 'all') {
        const now = new Date();
        if (!lot.date) return false;
        const dDate = parseToDateObject(lot.date);
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

      // 4. Search query
      if (q) {
        const matchLot = String(lot.lotNo).toLowerCase().includes(q);
        const matchDisplay = String(lot.displayLot).toLowerCase().includes(q);
        const matchStyle = String(lot.style).toLowerCase().includes(q);
        const matchBrand = String(lot.brand).toLowerCase().includes(q);
        const matchCategory = String(lot.category).toLowerCase().includes(q);
        const matchPO = lot.matchingPOs.some(p => String(p.poNumber).toLowerCase().includes(q) || String(p.vendorName).toLowerCase().includes(q));
        const matchRGP = lot.matchingRgps.some(r => String(r.rgpNo).toLowerCase().includes(q) || String(r.vendor).toLowerCase().includes(q));
        if (!matchLot && !matchDisplay && !matchStyle && !matchBrand && !matchCategory && !matchPO && !matchRGP) return false;
      }

      return true;
    });

    // Sort items
    list.sort((a, b) => {
      if (ageSort === 'most_progress') return b.completedStages - a.completedStages;
      if (ageSort === 'lot_asc') return String(a.lotNo).localeCompare(String(b.lotNo), undefined, { numeric: true });
      if (ageSort === 'lot_desc') return String(b.lotNo).localeCompare(String(a.lotNo), undefined, { numeric: true });
      const dateA = parseToDateObject(a.date).getTime();
      const dateB = parseToDateObject(b.date).getTime();
      return ageSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return list;
  }, [lotRegistryList, itemCategory, typeFilter, dateFilter, searchQuery, ageSort]);

  // Auto-select first lot when list changes or resets
  useEffect(() => {
    if ((!selectedLotId || !lotRegistryList.some(l => l.id === selectedLotId || l.lotNo === selectedLotId)) && filteredLotsList.length > 0) {
      setSelectedLotId(filteredLotsList[0].id);
    }
  }, [filteredLotsList, selectedLotId, lotRegistryList]);

  // Selected Lot Entity Resolver
  const selectedLot = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).replace('LOT-', '').trim().toLowerCase();
    return lotRegistryList.find(l => 
      l.id.toLowerCase() === String(selectedLotId).toLowerCase() ||
      l.lotNo.toLowerCase() === cleanId ||
      l.displayLot.toLowerCase() === cleanId
    ) || null;
  }, [selectedLotId, lotRegistryList]);

  const selectedDesign = selectedLot?.design || null;
  const selectedRgp = selectedLot?.matchingRgps[0] || null;
  const selectedDori = selectedLot?.matchingDori[0] || null;
  const selectedZip = selectedLot?.matchingZip[0] || null;
  const selectedPO = selectedLot?.matchingPOs[0] || null;

  // Helper function to resolve dynamic design image preview URLs
  const getCleanImageUrl = (url) => {
    if (!url) return '';
    return url.replace('wait', `${getBackendUrl()}`);
  };

  // Compile timeline events dynamically for the selected Lot
  const getTimelineEvents = () => {
    if (!selectedLot) return [];
    const events = [];

    // 1. Stage 1: Design Pack Registration
    if (selectedLot.design) {
      const d = selectedLot.design;
      const regTime = d.created_at || d.date || selectedLot.date;
      events.push({
        type: 'registration',
        title: 'Stage 1: Design Pack Registered',
        timestamp: formatDateTime(regTime) || 'Initial Registration',
        dateObj: parseToDateObject(regTime),
        actor: d.designer || 'Design Team',
        icon: <FileText size={16} />,
        color: '#3b82f6',
        details: (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Style Code:</strong> {d.style || selectedLot.style}</div>
            <div><strong>Category:</strong> {d.category || selectedLot.category}</div>
            <div><strong>Brand/Client:</strong> {d.brand || selectedLot.brand}</div>
            <div><strong>Fabric Type:</strong> {d.fabricType || 'Standard'}</div>
            <div><strong>Target Pieces:</strong> {d.quantity || selectedLot.quantity || 100} pcs</div>
            <div><strong>Registration Status:</strong> {d.status || 'Active'}</div>
          </div>
        )
      });
    }

    // 2. Stage 2: Technical Verification Approvals/Rejections
    const lotHistory = (selectedLot.matchingLogs || []).filter(h => h.lotId);
    lotHistory.forEach(h => {
      const isApprove = h.action === 'approved';
      events.push({
        type: 'verification',
        title: isApprove ? 'Stage 2: Technical Verification Approved' : `Technical Verification: ${h.action || 'Update'}`,
        timestamp: formatDateTime(h.timestamp),
        dateObj: parseToDateObject(h.timestamp),
        actor: h.actorName || 'Technical Admin',
        icon: isApprove ? <ShieldCheck size={16} /> : <AlertCircle size={16} />,
        color: isApprove ? '#10b981' : '#ef4444',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Action:</strong> {h.action?.toUpperCase()}</p>
            {h.details && <p><strong>Comments / Sign-off:</strong> {h.details}</p>}
          </div>
        )
      });
    });

    // 3. Stage 3: Trim Purchase Orders (PO)
    (selectedLot.matchingPOs || []).forEach(po => {
      let parsedItems = [];
      try {
        parsedItems = typeof po.items === 'string' ? JSON.parse(po.items) : (po.items || []);
      } catch (_) {}

      events.push({
        type: 'po_created',
        title: `Stage 3: Trim Purchase Order Released (#${po.poNumber})`,
        timestamp: formatDateTime(po.date) || 'PO Generated',
        dateObj: parseToDateObject(po.date),
        actor: 'Purchasing Dept',
        icon: <ClipboardList size={16} />,
        color: '#3b82f6',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div><strong>Vendor / Supplier:</strong> {po.vendorName || 'Supplier'}</div>
              <div><strong>Total Amount:</strong> {currencySymbol}{parseFloat(po.total || 0).toLocaleString('en-IN')}</div>
            </div>
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
    });

    // 4. Stage 4: Returnable Gate Passes (RGP)
    (selectedLot.matchingRgps || []).forEach(r => {
      events.push({
        type: 'rgp_issued',
        title: `Stage 4: Returnable Gate Pass Issued (#${r.rgpNo})`,
        timestamp: formatDateTime(r.date) || 'Pass Issued',
        dateObj: parseToDateObject(r.date),
        actor: r.preparedBy || 'Dispatch Head',
        icon: <Truck size={16} />,
        color: '#a855f7',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div><strong>Vendor / Processor:</strong> {r.vendor || 'N/A'}</div>
              <div><strong>Department:</strong> {r.department || 'Dispatch'}</div>
              <div><strong>Purpose:</strong> {r.purpose || 'Processing'}</div>
              <div><strong>Expected Return:</strong> {formatDateTime(r.expectedReturnDate) || '—'}</div>
              <div><strong>Vehicle No:</strong> {r.vehicleNo || 'N/A'}</div>
              <div><strong>Status:</strong> <span className={`status-badge ${r.isReturned ? 'verified' : (r.isOverdue ? 'overdue' : 'in-verification')}`}>{r.computedStatus}</span></div>
            </div>
            {r.entries?.length > 0 && (
              <div style={{ marginTop: '6px', color: 'var(--accent-color)', fontWeight: '600' }}>
                Manifest Items: {r.totalItemsCount} item(s) (Total Qty: {r.totalQty1})
              </div>
            )}
          </div>
        )
      });

      if (r.gateOutScan) {
        events.push({
          type: 'gate_out_scan',
          title: `Security Gate Out Scan Verified (#${r.rgpNo})`,
          timestamp: formatDateTime(r.gateOutScan.scanned_at) || 'Scanned Out',
          dateObj: parseToDateObject(r.gateOutScan.scanned_at),
          actor: r.gateOutScan.person_name || 'Security Gatekeeper',
          icon: <Truck size={16} />,
          color: '#3b82f6',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Gate Log:</strong> Verified outward dispatch bundle destined for <strong>{r.gateOutScan.supplier_name || r.vendor}</strong>.</p>
              {r.gateOutScan.quantity > 0 && <p><strong>Dispatched Units:</strong> {r.gateOutScan.quantity} pcs</p>}
            </div>
          )
        });
      }

      if (r.gateInScan) {
        events.push({
          type: 'gate_in_scan',
          title: `Security Gate In Return Scan Verified (#${r.rgpNo})`,
          timestamp: formatDateTime(r.gateInScan.scanned_at) || 'Returned Inward',
          dateObj: parseToDateObject(r.gateInScan.scanned_at),
          actor: r.gateInScan.person_name || 'Security Gatekeeper',
          icon: <ShieldCheck size={16} />,
          color: '#10b981',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Return Check-in:</strong> Material successfully returned from <strong>{r.gateInScan.supplier_name || r.vendor}</strong> and inward verified at factory gate.</p>
            </div>
          )
        });
      }
    });

    // 5. Stage 5: Zip Purchase Orders
    (selectedLot.matchingZip || []).forEach(z => {
      const zipDate = z.Saved_At || z.Issue_Date;
      events.push({
        type: 'zip_created',
        title: `Stage 5: Zip Purchase Order Released (#${z.po_number || z.Lot_Number})`,
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
          </div>
        )
      });
    });

    // 6. Stage 6: Dori Purchase Orders
    (selectedLot.matchingDori || []).forEach(d => {
      const doriDate = d.Issue_Date || d.Timestamp;
      events.push({
        type: 'dori_created',
        title: `Stage 6: Dori Purchase Order Released (#${d.po_number || d.Lot_Number})`,
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
          </div>
        )
      });
    });

    // 7. Extra Material Issues
    (selectedLot.matchingExtra || []).forEach(ex => {
      const exDate = ex.issueDate || ex.createdAt || ex.date;
      events.push({
        type: 'extra_material',
        title: `Extra Material Requisition Issued (#${ex.voucherId || ex.id})`,
        timestamp: formatDateTime(exDate) || 'Requisition Created',
        dateObj: parseToDateObject(exDate),
        actor: ex.personName || 'Production Supervisor',
        icon: <ClipboardList size={16} />,
        color: '#ef4444',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Department:</strong> {ex.department || 'Stitching'}</p>
            <p><strong>Receiver / Requester:</strong> {ex.receiverName || ex.personName || 'Store Incharge'}</p>
            <p><strong>Reason:</strong> {ex.reason || 'Extra requirements / Defect compensation'}</p>
          </div>
        )
      });
    });

    // 8. Stage 7: Gate Scanner Checkpoints
    (selectedLot.matchingScans || []).forEach(s => {
      events.push({
        type: 'scan_checkpoint',
        title: `Stage 7: Security Gate Checkpoint (${s.scan_type || 'Gate Entry'})`,
        timestamp: formatDateTime(s.scanned_at || s.timestamp),
        dateObj: parseToDateObject(s.scanned_at || s.timestamp),
        actor: s.person_name || 'Security Gatekeeper',
        icon: <QrCode size={16} />,
        color: '#06b6d4',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Supplier / Destination:</strong> {s.supplier_name || 'Checkpoint'}</p>
            <p><strong>Material Name:</strong> {s.material_name || 'Fabric/Trims'} ({s.quantity || 0} pcs)</p>
          </div>
        )
      });
    });

    return events.sort((a, b) => a.dateObj - b.dateObj);
  };

  // Compile full 7-Stage Workflow Steps strictly for the selected Lot
  const getWorkflowSteps = () => {
    if (!selectedLot) return [];

    const approvedLog = (selectedLot.matchingLogs || []).find(h => h.action === 'approved');
    const firstPo = selectedLot.matchingPOs[0];
    const firstRgp = selectedLot.matchingRgps[0];
    const firstZip = selectedLot.matchingZip[0];
    const firstDori = selectedLot.matchingDori[0];
    const firstScan = selectedLot.matchingScans[0];

    return [
      {
        id: 'stage_1_design',
        name: 'Stage 1: Design Pack Registration',
        isComplete: Boolean(selectedLot.hasDesign),
        date: selectedLot.design?.created_at || selectedLot.design?.date || selectedLot.date,
        actor: selectedLot.design?.designer || 'Design Team',
        icon: <FileText size={16} />,
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div><strong>Style Code:</strong> {selectedLot.style || 'N/A'}</div>
              <div><strong>Garment:</strong> {selectedLot.category || 'N/A'}</div>
              <div><strong>Brand/Client:</strong> {selectedLot.brand || 'N/A'}</div>
              <div><strong>Target Order:</strong> {selectedLot.quantity || 100} pcs</div>
            </div>
          </div>
        )
      },
      {
        id: 'stage_2_approval',
        name: 'Stage 2: Technical Verification Approval',
        isComplete: Boolean(selectedLot.isApproved),
        date: approvedLog?.timestamp || (selectedLot.isApproved ? selectedLot.date : null),
        actor: approvedLog?.actorName || (selectedLot.isApproved ? 'Admin Approver' : null),
        icon: <ShieldCheck size={16} />,
        details: selectedLot.isApproved ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: '700' }}>✓ BOM &amp; Technical specifications verified and approved for production.</span>
            {approvedLog?.details && <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>Note: {approvedLog.details}</p>}
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting technical team BOM verification &amp; approval.</span>
      },
      {
        id: 'stage_3_po',
        name: 'Stage 3: Trim Purchase Order (PO) Release',
        isComplete: selectedLot.matchingPOs.length > 0,
        date: firstPo?.date,
        actor: 'Purchasing Dept',
        icon: <ClipboardList size={16} />,
        details: selectedLot.matchingPOs.length > 0 ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span><strong>Total POs Issued:</strong> {selectedLot.matchingPOs.length} purchase order(s)</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>
                Total: {currencySymbol}{selectedLot.matchingPOs.reduce((sum, p) => sum + parseFloat(p.total || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Vendors: {Array.from(new Set(selectedLot.matchingPOs.map(p => p.vendorName).filter(Boolean))).join(', ') || 'Suppliers'}
            </div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No general trim purchase orders generated yet.</span>
      },
      {
        id: 'stage_4_rgp',
        name: 'Stage 4: Fabric / Material RGP Gate Pass',
        isComplete: selectedLot.matchingRgps.length > 0,
        date: firstRgp?.date,
        actor: firstRgp?.preparedBy || 'Dispatch Head',
        icon: <Truck size={16} />,
        details: selectedLot.matchingRgps.length > 0 ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span><strong>Attached RGPs:</strong> {selectedLot.matchingRgps.length} gate pass(es)</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {selectedLot.matchingRgps.map(r => (
                  <span key={r.id || r.rgpNo} className={`status-badge ${r.isReturned ? 'verified' : (r.isOverdue ? 'overdue' : 'in-verification')}`} style={{ fontSize: '10px' }}>
                    #{r.rgpNo} ({r.computedStatus})
                  </span>
                ))}
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Processors: {Array.from(new Set(selectedLot.matchingRgps.map(r => r.vendor).filter(Boolean))).join(', ')}
            </div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No returnable gate passes issued for outside processing.</span>
      },
      {
        id: 'stage_5_zip',
        name: 'Stage 5: Zip Purchase Order Release',
        isComplete: selectedLot.matchingZip.length > 0,
        date: firstZip?.Saved_At || firstZip?.Issue_Date,
        actor: firstZip?.Supervisor || 'Storekeeper',
        icon: <Scissors size={16} />,
        details: selectedLot.matchingZip.length > 0 ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Zip POs:</strong> {selectedLot.matchingZip.length} PO(s) ({selectedLot.matchingZip.reduce((sum, z) => sum + Number(z.Total_Pieces_CH || z.Total_Pieces || 0), 0)} pcs)</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>
                ₹{selectedLot.matchingZip.reduce((sum, z) => sum + parseFloat(z.Total_Cost || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting zipper purchase order calculation and release.</span>
      },
      {
        id: 'stage_6_dori',
        name: 'Stage 6: Dori / Thread PO Release',
        isComplete: selectedLot.matchingDori.length > 0,
        date: firstDori?.Issue_Date || firstDori?.Timestamp,
        actor: firstDori?.Supervisor || 'Storekeeper',
        icon: <Shuffle size={16} />,
        details: selectedLot.matchingDori.length > 0 ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Dori POs:</strong> {selectedLot.matchingDori.length} PO(s) ({selectedLot.matchingDori.reduce((sum, d) => sum + Number(d.Total_Pieces || 0), 0)} pcs)</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>
                ₹{selectedLot.matchingDori.reduce((sum, d) => sum + parseFloat(d.Total_Cost || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting dori / drawstring purchase order compilation.</span>
      },
      {
        id: 'stage_7_scan',
        name: 'Stage 7: Security Gate & Checkpoint Verification',
        isComplete: selectedLot.matchingScans.length > 0,
        date: firstScan?.scanned_at || firstScan?.timestamp,
        actor: firstScan?.person_name || 'Security Gatekeeper',
        icon: <QrCode size={16} />,
        details: selectedLot.matchingScans.length > 0 ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <span style={{ color: '#06b6d4', fontWeight: '700' }}>
              ✓ {selectedLot.matchingScans.length} Security scan checkpoint(s) logged at factory security gates.
            </span>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Pending gate entry or inward barcode checkpoint scans.</span>
      }
    ];
  };

  // PDF Generator for selected Lot
  const downloadWorkflowPDF = () => {
    if (!selectedLot) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text(`LOT #${selectedLot.displayLot} WORKFLOW & AUDIT REPORT`, 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Style Code: ${selectedLot.style || 'N/A'} | Client: ${selectedLot.brand || 'N/A'}`, 40, 68);

    // Metadata Table
    autoTable(doc, {
      startY: 85,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      head: [['Field', 'Details', 'Field', 'Details']],
      body: [
        ['Lot Number', `#${selectedLot.displayLot}`, 'Status', selectedLot.computedStatus],
        ['Brand / Client', selectedLot.brand || '—', 'Garment Category', selectedLot.category || '—'],
        ['Style Code', selectedLot.style || '—', 'Target Order Units', `${selectedLot.quantity || 100} pcs`],
        ['Workflow Progress', `${selectedLot.completedStages} / 7 Stages (${selectedLot.completionPercent}%)`, 'Registration Date', formatDateTime(selectedLot.date) || '—']
      ],
      styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [0, 75, 135], textColor: [255, 255, 255] }
    });

    const stepsY = doc.lastAutoTable.finalY + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text('1. 7-Stage Workflow Pipeline Sign-off Matrix', 40, stepsY);

    const stepRows = workflowSteps.map((step, idx) => [
      `Stage ${idx + 1}`,
      step.name.replace(/^Stage \d+:\s*/, ''),
      step.isComplete ? 'COMPLETED' : 'PENDING',
      step.date ? formatDateTime(step.date) : '—',
      step.actor || (step.isComplete ? 'Verified' : 'Pending')
    ]);

    autoTable(doc, {
      startY: stepsY + 8,
      margin: { left: 40, right: 40 },
      theme: 'striped',
      head: [['Stage', 'Workflow Milestone', 'Status', 'Completed Timestamp', 'Sign-off Actor']],
      body: stepRows,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] }
    });

    const eventsY = doc.lastAutoTable.finalY + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text('2. Chronological Operational Event Logs', 40, eventsY);

    const events = getTimelineEvents();
    const eventRows = events.map((evt, idx) => [
      idx + 1,
      evt.timestamp,
      evt.title,
      evt.actor || 'System'
    ]);

    autoTable(doc, {
      startY: eventsY + 8,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      head: [['#', 'Timestamp', 'Operational Milestone / Event', 'Actor / Operator']],
      body: eventRows.length > 0 ? eventRows : [['—', '—', 'No event logs recorded', '—']],
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255] }
    });

    doc.save(`Lot_${String(selectedLot.displayLot).replace(/[^a-zA-Z0-9_-]/g, '_')}_Workflow_Audit.pdf`);
  };

  // Export Filtered History Lots to Excel / CSV
  const handleExportHistoryExcel = () => {
    const headers = ['Lot No', 'Display Lot', 'Brand', 'Category', 'Style', 'Target Pcs', 'Status', 'Stages Complete', 'Trim POs Count', 'RGP Passes Count', 'Zip POs Count', 'Dori POs Count', 'Gate Scans Count', 'Date'];
    const rows = filteredLotsList.map(lot => [
      `"${lot.lotNo || ''}"`,
      `"${lot.displayLot || ''}"`,
      `"${String(lot.brand || '').replace(/"/g, '""')}"`,
      `"${String(lot.category || '').replace(/"/g, '""')}"`,
      `"${String(lot.style || '').replace(/"/g, '""')}"`,
      lot.quantity || 0,
      `"${lot.computedStatus || ''}"`,
      `"${lot.completedStages} / 7"`,
      lot.matchingPOs.length,
      lot.matchingRgps.length,
      lot.matchingZip.length,
      lot.matchingDori.length,
      lot.matchingScans.length,
      `"${formatDateTime(lot.date)}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Lots_Workflow_Register_${itemCategory}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const timelineEvents = getTimelineEvents();
  const workflowSteps = getWorkflowSteps();
  const visibleSteps = workflowSteps;
  const completedStepsCount = workflowSteps.filter(s => s.isComplete).length;
  const allComplete = selectedLot?.isFullyComplete || false;

  return (
    <div className="animate-fade">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
            Operations &amp; Lot Work History
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Multi-module lifecycle tracker &amp; lot-wise audit trail for BOM, POs, RGP passes, Zip/Dori, and Gate Scans.
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

      {/* Analytics KPI Ribbon Banner (Exact Same Size and Design, Pure Lot-Wise) */}
      <div className="animate-slide-up" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        {[
          { label: 'Total Lots', value: lotRegistryList.length, icon: <Boxes size={16} />, color: '#0284c7', bg: '#e0f2fe' },
          { label: 'Approved Lots', value: lotRegistryList.filter(l => l.isApproved).length, icon: <ShieldCheck size={16} />, color: '#10b981', bg: '#d1fae5' },
          { label: 'In Production', value: lotRegistryList.filter(l => l.hasProductionActivity).length, icon: <Activity size={16} />, color: '#a855f7', bg: '#f3e8ff' },
          { label: 'With RGP Passes', value: lotRegistryList.filter(l => l.hasRgp).length, icon: <Truck size={16} />, color: '#a855f7', bg: '#f3e8ff' },
          { label: 'With Trim POs', value: lotRegistryList.filter(l => l.hasPOs).length, icon: <ClipboardList size={16} />, color: '#3b82f6', bg: '#dbeafe' },
          { label: 'With Dori / Zip', value: lotRegistryList.filter(l => l.hasDori || l.hasZip).length, icon: <Shuffle size={16} />, color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Gate Scanned', value: lotRegistryList.filter(l => l.hasScans).length, icon: <QrCode size={16} />, color: '#06b6d4', bg: '#cffafe' },
          { label: 'Fully Completed', value: lotRegistryList.filter(l => l.isFullyComplete).length, icon: <CheckCircle size={16} />, color: '#059669', bg: '#d1fae5' },
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

        {/* Left Panel: Filter & Lot Selector */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '18px' }}>
            <h3 className="panel-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <Search size={15} />
              <span>Select Lot to Inspect</span>
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
                { id: 'all', label: 'All Lots', count: lotRegistryList.length },
                { id: 'approved', label: 'Approved', count: lotRegistryList.filter(l => l.isApproved).length, highlight: '#10b981' },
                { id: 'production', label: 'In Prod', count: lotRegistryList.filter(l => l.hasProductionActivity).length, highlight: '#3b82f6' },
                { id: 'rgps', label: 'With RGP', count: lotRegistryList.filter(l => l.hasRgp).length, highlight: '#a855f7' },
                { id: 'pos', label: 'With PO', count: lotRegistryList.filter(l => l.hasPOs).length, highlight: '#3b82f6' },
                { id: 'dori_zip', label: 'Dori/Zip', count: lotRegistryList.filter(l => l.hasDori || l.hasZip).length, highlight: '#f59e0b' },
                { id: 'completed', label: 'Completed', count: lotRegistryList.filter(l => l.isFullyComplete).length, highlight: '#059669' }
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
                placeholder="Search Lot #, Style, Brand, PO, RGP..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', height: '34px', fontSize: '12px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Quick Filters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Status Filter</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved Lots</option>
                  <option value="pending">Pending Approval</option>
                  <option value="production">In Production</option>
                  <option value="completed">Completed Lots</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Sort Order</label>
                <select
                  value={ageSort}
                  onChange={(e) => setAgeSort(e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="lot_asc">Lot No (Ascending)</option>
                  <option value="most_progress">Most Progress</option>
                </select>
              </div>
            </div>

            {/* List of Filtered Lots */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '5px',
              maxHeight: '340px', overflowY: 'auto', paddingRight: '3px',
              border: '1px solid var(--border-color)', borderRadius: '8px', padding: '5px'
            }}>
              {filteredLotsList.map(item => {
                const isSelected = selectedLot?.id === item.id || selectedLot?.lotNo === item.lotNo;
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
                          Lot #{item.displayLot}
                        </span>
                      </div>

                      <span className={`status-badge ${item.isFullyComplete ? 'verified' : (item.isApproved ? 'verified' : (item.hasProductionActivity ? 'in-verification' : 'overdue'))}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                        {item.computedStatus}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                        {item.brand} ({item.category})
                      </span>
                      <span style={{ fontWeight: '600', color: 'var(--text-main)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.style}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
                        <Clock size={9} />
                        <span>{formatDateTime(item.date) || '—'}</span>
                      </div>
                      <span style={{ fontWeight: '700', color: item.badgeColor || 'var(--accent-color)' }}>
                        Stage {item.completedStages}/7 ({item.completionPercent}%)
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredLotsList.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No lot records match current search or filters.
                </div>
              )}
            </div>
          </div>

          {/* Contextual Lot Specification Card */}
          {selectedLot && (
            <div className="panel animate-scale" style={{ padding: '16px', borderLeft: `4px solid ${selectedLot.badgeColor || 'var(--accent-color)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Boxes size={15} style={{ color: selectedLot.badgeColor || 'var(--accent-color)' }} />
                  <span>Lot #{selectedLot.displayLot} Specifications</span>
                </h3>
                <span className={`status-badge ${selectedLot.isFullyComplete ? 'verified' : (selectedLot.isApproved ? 'verified' : (selectedLot.hasProductionActivity ? 'in-verification' : 'overdue'))}`} style={{ fontSize: '10px' }}>
                  {selectedLot.computedStatus}
                </span>
              </div>

              {selectedLot.imageUrl && (
                <div style={{ width: '100%', height: '120px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px', marginBottom: '10px' }}>
                  <img
                    src={getCleanImageUrl(selectedLot.imageUrl)}
                    alt="Design spec"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Style Code</span>
                  <span style={{ fontWeight: '600' }}>{selectedLot.style}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Brand / Client</span>
                  <span style={{ fontWeight: '600' }}>{selectedLot.brand}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Garment Category</span>
                  <span style={{ fontWeight: '600' }}>{selectedLot.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Order Units</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{selectedLot.quantity || 100} pcs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Workflow Progress</span>
                  <span style={{ fontWeight: '800', color: selectedLot.badgeColor }}>
                    {selectedLot.completedStages}/7 Stages ({selectedLot.completionPercent}%)
                  </span>
                </div>
              </div>

              {/* Linked Records Badges */}
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {selectedLot.matchingPOs.length > 0 && (
                  <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {selectedLot.matchingPOs.length} PO(s)
                  </span>
                )}
                {selectedLot.matchingRgps.length > 0 && (
                  <span style={{ fontSize: '10px', background: '#f3e8ff', color: '#7e22ce', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {selectedLot.matchingRgps.length} RGP(s)
                  </span>
                )}
                {selectedLot.matchingZip.length > 0 && (
                  <span style={{ fontSize: '10px', background: '#fce7f3', color: '#be185d', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {selectedLot.matchingZip.length} Zip PO
                  </span>
                )}
                {selectedLot.matchingDori.length > 0 && (
                  <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {selectedLot.matchingDori.length} Dori PO
                  </span>
                )}
                {selectedLot.matchingScans.length > 0 && (
                  <span style={{ fontSize: '10px', background: '#cffafe', color: '#0e7490', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {selectedLot.matchingScans.length} Scan(s)
                  </span>
                )}
                {selectedLot.matchingExtra.length > 0 && (
                  <span style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {selectedLot.matchingExtra.length} Extra
                  </span>
                )}
              </div>
            </div>
          )}
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
                    padding: '5px 14px',
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
                    padding: '5px 14px',
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
                  backgroundColor: '#004b87',
                  color: '#ffffff',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Download size={13} />
                <span>Download Audit PDF</span>
              </button>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--accent-light)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Compiling Workflow History Logs...</span>
              </div>
            ) : !selectedLot ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>No Lot Selected</h4>
                <p style={{ fontSize: '13px', maxWidth: '360px' }}>Select an active lot from the left panel list to inspect its 7-stage lifecycle timeline.</p>
              </div>
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

                {/* Attached RGP Passes Detailed Matrix for this Lot */}
                {selectedLot.matchingRgps.length > 0 && (
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)', borderRadius: '10px',
                      border: '1.5px solid var(--border-color)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={15} style={{ color: '#a855f7' }} />
                        <span>Attached Returnable Gate Passes ({selectedLot.matchingRgps.length} pass(es))</span>
                      </h4>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                              <th style={{ padding: '6px 8px' }}>RGP #</th>
                              <th style={{ padding: '6px 8px' }}>Vendor / Processor</th>
                              <th style={{ padding: '6px 8px' }}>Issued Date</th>
                              <th style={{ padding: '6px 8px' }}>Expected Return</th>
                              <th style={{ padding: '6px 8px' }}>Dispatched Units</th>
                              <th style={{ padding: '6px 8px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLot.matchingRgps.map((rgp, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '6px 8px', fontWeight: '700', color: '#a855f7' }}>#{rgp.rgpNo}</td>
                                <td style={{ padding: '6px 8px', fontWeight: '600' }}>{rgp.vendor}</td>
                                <td style={{ padding: '6px 8px' }}>{formatDateTime(rgp.date)}</td>
                                <td style={{ padding: '6px 8px' }}>{formatDateTime(rgp.expectedReturnDate) || '—'}</td>
                                <td style={{ padding: '6px 8px', fontWeight: '700' }}>{rgp.totalQty1} pcs</td>
                                <td style={{ padding: '6px 8px' }}>
                                  <span className={`status-badge ${rgp.isReturned ? 'verified' : (rgp.isOverdue ? 'overdue' : 'in-verification')}`} style={{ fontSize: '10px' }}>
                                    {rgp.computedStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                      No chronological milestones logged for Lot #{selectedLot.displayLot}.
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

