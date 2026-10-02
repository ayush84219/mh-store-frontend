import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, User, ClipboardList, CheckCircle, XCircle,
  Scissors, Shuffle, Truck, QrCode, ShieldCheck, AlertCircle, FileText, Check, Download,
  BarChart3, TrendingUp, Activity, Boxes, Eye, Tag, Calendar, MapPin, Building,
  ArrowRight, ShieldAlert, FileSpreadsheet, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DailyWeeklyCalendarReport from './DailyWeeklyCalendarReport';

const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
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
  const [itemCategory, setItemCategory] = useState('all'); // 'all' | 'designs' | 'rgps' | 'pos'
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

  // Fetch all history data from backend on mount
  useEffect(() => {
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

  // Unified items list representing Design Lots, RGP Passes, and POs
  const unifiedItemsList = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    // 1. Design Lots
    designs.forEach(d => {
      if (d.id && !seenIds.has(String(d.id).toLowerCase())) {
        seenIds.add(String(d.id).toLowerCase());
        list.push({
          id: String(d.id),
          itemType: 'design',
          title: `Lot #${getLotVersionInfo(d.id, designs).displayLot}`,
          subTitle: `${d.brand || 'Client'} (${d.category || 'Design'})`,
          secondaryText: d.style || 'Custom Style',
          date: d.created_at || d.date || '',
          imageUrl: d.imageUrl || null,
          design: d
        });
      }
    });

    // 2. RGP Returnable Gate Passes
    processedRgpList.forEach(r => {
      if (r.rgpNo && !seenIds.has(String(r.rgpNo).toLowerCase())) {
        seenIds.add(String(r.rgpNo).toLowerCase());
        list.push({
          id: String(r.rgpNo),
          itemType: 'rgp',
          title: `RGP #${r.rgpNo}`,
          subTitle: `${r.vendor || 'Vendor'} • ${r.rgpType || 'Gate Pass'}`,
          secondaryText: `${r.totalItemsCount || 0} items (${r.computedStatus})`,
          date: r.date || '',
          imageUrl: null,
          rgp: r
        });
      }
    });

    // 3. Purchase Orders
    pos.forEach(p => {
      if (p.poNumber && !seenIds.has(String(p.poNumber).toLowerCase())) {
        seenIds.add(String(p.poNumber).toLowerCase());
        list.push({
          id: String(p.poNumber),
          itemType: 'po',
          title: `PO #${p.poNumber}`,
          subTitle: `${p.vendorName || 'Supplier'}`,
          secondaryText: `${p.designName || 'Purchase Order'} (${p.status || 'Active'})`,
          date: p.date || '',
          imageUrl: null,
          po: p
        });
      }
    });

    // 4. Cutting Headers / Other Scan Lots
    cuttingHeaders.forEach(h => {
      if (h.Lot_Number && !seenIds.has(String(h.Lot_Number).toLowerCase())) {
        seenIds.add(String(h.Lot_Number).toLowerCase());
        list.push({
          id: String(h.Lot_Number),
          itemType: 'cutting',
          title: `Lot #${h.Lot_Number}`,
          subTitle: `${h.Style || 'Cutting Lot'}`,
          secondaryText: `${h.Garment_Type || 'Garment'}`,
          date: h.Created_At || h.Date || '',
          imageUrl: null
        });
      }
    });

    return list;
  }, [designs, processedRgpList, pos, cuttingHeaders]);

  // Filter approved/verification lot list for selection
  const filteredLotsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let list = unifiedItemsList.filter(item => {
      // 1. Category filter
      if (itemCategory === 'designs' && item.itemType !== 'design' && item.itemType !== 'cutting') return false;
      if (itemCategory === 'rgps' && item.itemType !== 'rgp') return false;
      if (itemCategory === 'pos' && item.itemType !== 'po') return false;

      // 2. Design Type filter (for designs)
      if (typeFilter === 'original' && item.itemType === 'design' && String(item.id).includes('-V')) return false;
      if (typeFilter === 'version' && item.itemType === 'design' && !String(item.id).includes('-V')) return false;

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
  const selectedRgp = useMemo(() => {
    if (!selectedLotId) return null;
    const cleanId = String(selectedLotId).trim().toLowerCase();
    return processedRgpList.find(r => 
      String(r.rgpNo).toLowerCase() === cleanId ||
      String(r.id).toLowerCase() === cleanId
    ) || null;
  }, [selectedLotId, processedRgpList]);

  const resolvedLotId = useMemo(() => {
    if (!selectedLotId) return '';
    const cleanId = String(selectedLotId).trim().toUpperCase();
    if (cleanId.startsWith('PO-')) {
      const po = pos.find(p => String(p.poNumber).toUpperCase().trim() === cleanId);
      if (po && po.designName) {
        return po.designName;
      }
    }
    return selectedLotId;
  }, [selectedLotId, pos]);

  const selectedDesign = designs.find(d => String(d.id).toLowerCase() === String(resolvedLotId).toLowerCase());

  // Helper function to resolve dynamic design image preview URLs
  const getCleanImageUrl = (url) => {
    if (!url) return '';
    return url.replace('wait', `${getBackendUrl()}`);
  };

  // Compile timeline events dynamically for the selected lot ID
  const getTimelineEvents = () => {
    if (!selectedLotId) return [];

    const events = [];

    // IF RGP IS SELECTED: Compile pure RGP operational events
    if (selectedRgp) {
      // 1. RGP Creation
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

      // 2. Security Gate Out Dispatch Scan
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

      // 3. Security Gate Entry scans
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

      // 4. Security Gate In Return Scan
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

    // IF DESIGN LOT IS SELECTED: Compile comprehensive lot lifecycle events
    const lotIdLower = resolvedLotId.toLowerCase();

    // 1. Milestone: Design Registration
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

    // 2. Milestone: Technical Verification Approvals/Rejections (from design_history table)
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

    // 3. Milestone: General Purchase Orders (PO) compiled
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
            <p><strong>PO Status:</strong> <span className={`status-badge ${po.status?.toLowerCase() === 'approved' ? 'verified' : 'pending'}`}>{po.status}</span></p>
            {parsedItems.length > 0 && (
              <table style={{ width: '100%', marginTop: '6px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '4px' }}>Item</th>
                    <th style={{ padding: '4px', textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px' }}>{item.description}</td>
                      <td style={{ padding: '4px', textAlign: 'right' }}>{item.qty} {item.uom || 'pcs'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      });
    });

    // 4. Milestone: Zip PO compiled
    const matchingZipOrder = zipOrders.find(z => String(z.Lot_Number).toLowerCase() === lotIdLower);
    if (matchingZipOrder) {
      const zipPoNum = matchingZipOrder.po_number || '';
      const zipTime = matchingZipOrder.Saved_At || matchingZipOrder.Issue_Date || selectedDesign?.date;
      let placements = [];
      try {
        placements = JSON.parse(matchingZipOrder.Selected_Placements || '[]');
      } catch (_) { }
      events.push({
        type: 'zip_po_created',
        title: `Zip Purchase Orders Compiled${zipPoNum ? ` — ${zipPoNum}` : ''}`,
        timestamp: formatDateTime(zipTime) || 'Processed',
        dateObj: parseToDateObject(zipTime),
        actor: matchingZipOrder.Supervisor || 'Storekeeper',
        icon: <Scissors size={16} />,
        color: '#ec4899',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {zipPoNum && <p><strong>PO Number:</strong> <span style={{ color: '#7c3aed', fontWeight: '700' }}>{zipPoNum}</span></p>}
            <p><strong>Garment:</strong> {matchingZipOrder.Garment_Type || matchingZipOrder.ch_garment || 'N/A'} — {matchingZipOrder.Style || matchingZipOrder.ch_style || ''}</p>
            <p><strong>Total Pieces:</strong> {parseInt(matchingZipOrder.Total_Pieces_CH || matchingZipOrder.Total_Pieces) || 0} pcs</p>
            <p><strong>Total Cost:</strong> ₹{parseFloat(matchingZipOrder.Total_Cost || 0).toLocaleString('en-IN')}</p>
            <p><strong>Supervisor:</strong> {matchingZipOrder.Supervisor || 'N/A'}</p>
            {placements.length > 0 && <p><strong>Placements:</strong> {placements.join(', ')}</p>}
          </div>
        )
      });
    }

    // 5. Milestone: Doori PO compiled
    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    if (matchingDooriOrder && matchingDooriOrder.dori_payload) {
      const doriPoNum = matchingDooriOrder.po_number || '';
      const doriTime = matchingDooriOrder.Issue_Date || matchingDooriOrder.Timestamp || selectedDesign?.date;
      let placements = [];
      try {
        placements = JSON.parse(matchingDooriOrder.Selected_Placements || '[]');
      } catch (_) { }
      events.push({
        type: 'doori_po_created',
        title: `Thread / Doori PO Compiled${doriPoNum ? ` — ${doriPoNum}` : ''}`,
        timestamp: formatDateTime(doriTime) || 'Processed',
        dateObj: parseToDateObject(doriTime),
        actor: matchingDooriOrder.Supervisor || 'Storekeeper',
        icon: <Shuffle size={16} />,
        color: '#f59e0b',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {doriPoNum && <p><strong>PO Number:</strong> <span style={{ color: '#f59e0b', fontWeight: '700' }}>{doriPoNum}</span></p>}
            <p><strong>Garment:</strong> {matchingDooriOrder.Garment_Type || 'N/A'} — {matchingDooriOrder.Style || ''}</p>
            <p><strong>Total Pieces:</strong> {parseInt(matchingDooriOrder.Total_Pieces) || 0} pcs</p>
            <p><strong>Total Cost:</strong> ₹{parseFloat(matchingDooriOrder.Total_Cost || 0).toLocaleString('en-IN')}</p>
            <p><strong>Supervisor:</strong> {matchingDooriOrder.Supervisor || 'N/A'}</p>
            {placements.length > 0 && <p><strong>Placements:</strong> {placements.join(', ')}</p>}
          </div>
        )
      });
    }

    // 6. Milestone: Associated Returnable Gate Passes (RGPs) from processedRgpList
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
            <p><strong>Pass Status:</strong> <span className={`status-badge ${r.computedStatus === 'Returned' ? 'verified' : 'in-verification'}`}>{r.computedStatus}</span></p>
            {r.entries.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dispatched {r.totalItemsCount} item(s) • Total Qty: {r.totalQty1}</span>
              </div>
            )}
          </div>
        )
      });
    });

    // 7. Milestone: Scans & Gate Entries from scanLogs
    const matchingScans = scanLogs.filter(s => {
      const scanLotLower = String(s.lot_number).toLowerCase();
      if (scanLotLower === lotIdLower) return true;
      return associatedRgps.some(r => String(r.rgpNo).toLowerCase() === scanLotLower);
    });

    matchingScans.forEach(s => {
      const isRGP = s.scan_type === 'rgp_entry' || s.scan_type === 'rgp_return' || s.rgp_payload;
      const isGate = s.scan_type === 'gate_entry';
      const isPrintingOut = s.scan_type === 'printing_gate_out';

      let title = 'Arrival Scanned at Gate';
      let color = '#14b8a6';

      if (isRGP) {
        title = (s.scan_type === 'rgp_return' ? 'Fabric RGP Returned' : 'Fabric RGP Dispatched') + ` (#${s.lot_number})`;
        color = s.scan_type === 'rgp_return' ? '#10b981' : '#a855f7';
      } else if (isPrintingOut) {
        title = 'Printing Gate Out Scan';
        color = '#f97316';
      } else if (!isGate) {
        title = 'Material Received & Checked-In';
        color = '#06b6d4';
      }

      events.push({
        type: isRGP ? 'rgp_scan' : 'barcode_scan',
        title: title,
        timestamp: formatDateTime(s.scanned_at) || 'Scanned',
        dateObj: parseToDateObject(s.scanned_at),
        actor: s.person_name || 'Gatekeeper',
        icon: isRGP ? <Truck size={16} /> : <QrCode size={16} />,
        color: color,
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Operator:</strong> {s.person_name} | <strong>Party:</strong> {s.supplier_name}</p>
            {s.material_name && <p><strong>Material:</strong> {s.material_name} {s.quantity > 0 ? `(${s.quantity} pcs)` : ''}</p>}
          </div>
        )
      });
    });

    // 8. Milestone: Material Issues (issue_logs)
    const lotIssueLogs = issueLogs.filter(log => String(log.lotId).toLowerCase() === lotIdLower);
    lotIssueLogs.forEach(log => {
      const isRet = log.isReturn === 1 || log.isReturn === true;
      const isRe = log.isReissue === 1 || log.isReissue === true;

      let title = "Materials Issued";
      if (isRet) title = "Materials Returned";
      else if (isRe) title = "Materials Re-Issued";

      events.push({
        type: 'material_issue_log',
        title: title,
        timestamp: formatDateTime(log.date) || 'Processed',
        dateObj: parseToDateObject(log.date),
        actor: log.receiverName ? `${log.personName || 'Store'} → ${log.receiverName}` : (log.personName || 'Storekeeper'),
        icon: <ClipboardList size={16} />,
        color: isRet ? '#ef4444' : (isRe ? '#84cc16' : '#10b981'),
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Category:</strong> {log.category || 'N/A'}</p>
            <p><strong>Total Items Count:</strong> {log.volume || 0} pcs</p>
          </div>
        )
      });
    });

    // Sort events chronologically
    return events.sort((a, b) => a.dateObj - b.dateObj);
  };

  // Compile workflow steps for selected Lot or RGP
  const getWorkflowSteps = () => {
    if (!selectedLotId) return [];

    // IF RGP IS SELECTED: 4 Operational Process Stages
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
                  ✓ {selectedRgp.totalItemsCount} item(s) logged in gate pass manifest (Total Qty: {selectedRgp.totalQty1})
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
              {selectedRgp.gateOutScan?.scanned_at && (
                <p><strong>Scanned Out:</strong> {formatDateTime(selectedRgp.gateOutScan.scanned_at)}</p>
              )}
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
              <p style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                {selectedRgp.isReturned
                  ? 'Material batch returned back to premises.'
                  : (selectedRgp.isOverdue ? '⚠️ Return is overdue. Follow-up required with vendor.' : 'Processing in progress within turnaround window.')}
              </p>
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
              {selectedRgp.gateInScan?.person_name && <p><strong>Verified By:</strong> {selectedRgp.gateInScan.person_name}</p>}
              {selectedRgp.gateInScan?.scanned_at && <p><strong>Inward Scanned At:</strong> {formatDateTime(selectedRgp.gateInScan.scanned_at)}</p>}
            </div>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Pending return delivery and gate scanner verification.</span>
        }
      ];
    }

    // IF DESIGN LOT IS SELECTED: Standard 6 stages with integrated RGP and Scan substeps
    const lotIdLower = resolvedLotId.toLowerCase().trim();

    // 1. Design Stage
    const designExists = !!selectedDesign;
    const designDate = selectedDesign ? (selectedDesign.created_at || selectedDesign.date) : '';
    const designer = selectedDesign ? (selectedDesign.designer || 'System') : '';

    // 2. Approved Stage
    const approvedLog = historyLogs.find(h => String(h.lotId).toLowerCase() === lotIdLower && h.action === 'approved');
    const designApproved = (selectedDesign?.status?.toLowerCase() === 'approved') || !!approvedLog;
    const approvalDate = approvedLog ? approvedLog.timestamp : (designApproved ? designDate : '');
    const approvalActor = approvedLog ? approvedLog.actorName : (designApproved ? 'Admin' : '');

    // 3. Trim PO Stage
    const matchingPOs = pos.filter(po =>
      (po.designName && String(po.designName).toLowerCase() === lotIdLower) ||
      (po.poNumber && String(po.poNumber).toLowerCase() === lotIdLower)
    );
    const poReleased = matchingPOs.length > 0;
    const poDate = poReleased ? matchingPOs[0].date : '';

    // 4. Fabric RGP Stage
    const associatedRgps = processedRgpList.filter(r => {
      if (String(r.rgpNo).toLowerCase() === lotIdLower) return true;
      if (Array.isArray(r.entries)) {
        return r.entries.some(e => String(e.lotNo || '').toLowerCase() === lotIdLower);
      }
      return false;
    });
    const rgpReleased = associatedRgps.length > 0;
    const rgpDate = rgpReleased ? associatedRgps[0].date : '';
    const rgpActor = rgpReleased ? associatedRgps[0].preparedBy : '';

    // Helper: build scanner sub-steps
    const buildScannerSubSteps = (lotRef) => {
      const ref = String(lotRef).toLowerCase();
      const gate = scanLogs.find(s => String(s.lot_number).toLowerCase() === ref && s.scan_type === 'gate_entry');
      const matIn = scanLogs.find(s => String(s.lot_number).toLowerCase() === ref && s.scan_type === 'material_in');
      const sup = scanLogs.find(s => String(s.lot_number).toLowerCase() === ref && s.scan_type === 'supplier_entry');
      return [
        { id: 'gate_entry', label: 'Gate Entry', icon: '🔒', done: !!gate, data: gate },
        { id: 'material_in', label: 'Material Received', icon: '📦', done: !!matIn, data: matIn },
        { id: 'supplier_entry', label: 'Supplier Check-In', icon: '🏭', done: !!sup, data: sup },
      ];
    };

    const rgpSubSteps = buildScannerSubSteps(lotIdLower);

    // 5. ZIP Stage
    const matchingZipOrder = zipOrders.find(z => String(z.Lot_Number).toLowerCase() === lotIdLower);
    const zipCompiled = !!matchingZipOrder;
    const zipDate = zipCompiled ? (matchingZipOrder.Saved_At || matchingZipOrder.Issue_Date || '') : '';
    const zipActor = zipCompiled ? (matchingZipOrder.Supervisor || 'Storekeeper') : '';
    const zipPoNum = zipCompiled ? (matchingZipOrder.po_number || '') : '';
    const zipSubSteps = buildScannerSubSteps(lotIdLower);

    // 6. Doori PO Stage
    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    const dooriReleased = !!(matchingDooriOrder && matchingDooriOrder.dori_payload);
    const dooriDate = dooriReleased ? (matchingDooriOrder.Issue_Date || matchingDooriOrder.Timestamp || '') : '';
    const dooriActor = dooriReleased ? (matchingDooriOrder.Supervisor || 'Storekeeper') : '';
    const doriPoNum = dooriReleased ? (matchingDooriOrder.po_number || '') : '';
    const dooriSubSteps = buildScannerSubSteps(lotIdLower);

    return [
      {
        id: 'design',
        name: 'Design Registration',
        isComplete: designExists,
        date: designDate,
        actor: designer,
        icon: <FileText size={16} />,
        details: selectedDesign ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Style:</strong> {selectedDesign.style || 'N/A'}</div>
            <div><strong>Category:</strong> {selectedDesign.category || 'N/A'}</div>
            <div><strong>Brand/Client:</strong> {selectedDesign.brand || 'N/A'}</div>
            <div><strong>Fabric Type:</strong> {selectedDesign.fabricType || 'N/A'}</div>
            <div><strong>Target Pieces:</strong> {selectedDesign.quantity || 100} pcs</div>
          </div>
        ) : null
      },
      {
        id: 'approved',
        name: 'Technical Verification Approval',
        isComplete: designApproved,
        date: approvalDate,
        actor: approvalActor,
        icon: <ShieldCheck size={16} />,
        details: designApproved ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Status:</strong> Approved</div>
            {approvedLog?.details && <div style={{ marginTop: '4px' }}><strong>Comments:</strong> {approvedLog.details}</div>}
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting technical verification approval.</span>
      },
      {
        id: 'po',
        name: 'Trim Purchase Order (PO) Release',
        isComplete: poReleased,
        date: poDate,
        actor: poReleased ? 'Purchasing' : '',
        icon: <ClipboardList size={16} />,
        details: poReleased ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <strong>Associated Trim POs ({matchingPOs.length}):</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {matchingPOs.map((po, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  PO #{po.poNumber} to <strong>{po.vendorName}</strong> — {currencySymbol}{po.total?.toFixed(2)} ({po.status})
                </li>
              ))}
            </ul>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No Trim Purchase Orders released yet.</span>
      },
      {
        id: 'rgp',
        name: 'Fabric RGP (Returnable Gate Pass)',
        isComplete: rgpReleased,
        date: rgpDate,
        actor: rgpActor,
        icon: <Truck size={16} />,
        subSteps: rgpReleased ? rgpSubSteps : [],
        details: rgpReleased ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {associatedRgps.map((r, idx) => (
                <span key={idx} style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                  RGP #{r.rgpNo} ({r.computedStatus})
                </span>
              ))}
            </div>
            <div><strong>Primary Vendor:</strong> {associatedRgps[0]?.vendor || 'N/A'}</div>
            <div><strong>Department:</strong> {associatedRgps[0]?.department || 'N/A'}</div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Returnable Gate Pass dispatch has not been logged.</span>
      },
      {
        id: 'zip',
        name: `Zip Purchase Orders — Zipper Selection${zipPoNum ? ` (${zipPoNum})` : ''}`,
        isComplete: zipCompiled,
        date: zipDate,
        actor: zipActor,
        icon: <Scissors size={16} />,
        subSteps: zipCompiled ? zipSubSteps : [],
        details: zipCompiled ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {zipPoNum && <div><strong>PO Number:</strong> <span style={{ color: '#7c3aed', fontWeight: '700' }}>{zipPoNum}</span></div>}
            <div><strong>Garment:</strong> {matchingZipOrder.Garment_Type || matchingZipOrder.ch_garment || 'N/A'} — {matchingZipOrder.Style || matchingZipOrder.ch_style || ''}</div>
            <div><strong>Total Pieces:</strong> {parseInt(matchingZipOrder.Total_Pieces_CH || matchingZipOrder.Total_Pieces) || 0} pcs</div>
            <div><strong>Total Cost:</strong> ₹{parseFloat(matchingZipOrder.Total_Cost || 0).toLocaleString('en-IN')}</div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Zipper specifications not yet compiled.</span>
      },
      {
        id: 'doori',
        name: `Dori Purchase Orders — Thread / Drawstring${doriPoNum ? ` (${doriPoNum})` : ''}`,
        isComplete: dooriReleased,
        date: dooriDate,
        actor: dooriActor,
        icon: <Shuffle size={16} />,
        subSteps: dooriReleased ? dooriSubSteps : [],
        details: dooriReleased ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {doriPoNum && <div><strong>PO Number:</strong> <span style={{ color: '#f59e0b', fontWeight: '700' }}>{doriPoNum}</span></div>}
            <div><strong>Garment:</strong> {matchingDooriOrder.Garment_Type || 'N/A'} — {matchingDooriOrder.Style || ''}</div>
            <div><strong>Total Pieces:</strong> {parseInt(matchingDooriOrder.Total_Pieces) || 0} pcs</div>
            <div><strong>Total Cost:</strong> ₹{parseFloat(matchingDooriOrder.Total_Cost || 0).toLocaleString('en-IN')}</div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Thread / doori purchase specifications not yet compiled.</span>
      },
    ];
  };

  // PDF Generator for selected item (RGP or Design Lot)
  const downloadWorkflowPDF = () => {
    // If RGP is selected: Download dedicated RGP Pass & Security Scanner Audit
    if (selectedRgp) {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const r = selectedRgp;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(31, 41, 55);
      doc.text('RETURNABLE GATE PASS (RGP) AUDIT REPORT', 40, 50);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Pass Ref: #${r.rgpNo}`, 40, 68);

      // Status Badge in PDF
      const statusColor = r.isReturned ? [16, 185, 129] : (r.isOverdue ? [239, 68, 68] : [245, 158, 11]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(`STATUS: ${r.computedStatus.toUpperCase()}`, 380, 50);
      doc.setTextColor(31, 41, 55);

      // RGP Meta Table
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

      // Itemized Matrix
      const itemsY = doc.lastAutoTable.finalY + 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
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

      // Scanner Logs Table
      const scansY = doc.lastAutoTable.finalY + 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text('2. Security Gate Scanner & Verification Records', 40, scansY);

      const scanRows = r.scans.map((s, idx) => [
        idx + 1,
        formatDateTime(s.scanned_at),
        s.scan_type === 'rgp_entry' ? 'Gate Out (Dispatch)' : (s.scan_type === 'rgp_return' ? 'Gate In (Return)' : s.scan_type || 'Gate Entry'),
        s.person_name || 'Gatekeeper',
        s.supplier_name || r.vendor || '—',
        `${s.quantity || 0} pcs`,
        'VERIFIED SCAN'
      ]);

      autoTable(doc, {
        startY: scansY + 10,
        margin: { left: 40, right: 40 },
        theme: 'striped',
        head: [['#', 'Timestamp', 'Gate Event', 'Security Gatekeeper', 'Vendor / Destination', 'Quantity', 'Verification']],
        body: scanRows.length > 0 ? scanRows : [['—', '—', 'Awaiting gate scanner verification', '—', '—', '—', 'PENDING']],
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }
      });

      doc.save(`RGP_${r.rgpNo}_Audit_Report.pdf`);
      return;
    }

    // If Design Lot is selected: Download Lot Workflow Report
    if (!selectedDesign) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const lotId = selectedDesign.id;
    const allSteps = getWorkflowSteps();
    const steps = allSteps.filter(step => step.id === 'design' || step.id === 'approved' || step.isComplete);
    const allComplete = steps.length >= 4;

    // Title / Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.text('Lot Operational Workflow Report', 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 40, 68);

    // Status Banner in PDF
    const statusText = allComplete ? 'WORKFLOW STATUS: COMPLETE' : 'WORKFLOW STATUS: IN PROGRESS';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(allComplete ? 16 : 245, allComplete ? 185 : 158, allComplete ? 129 : 11);
    doc.text(statusText, 380, 50);
    doc.setTextColor(31, 41, 55);

    // Lot Info Box
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.rect(40, 85, 515, 90, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Lot Information', 50, 105);

    doc.setFont('helvetica', 'normal');
    doc.text(`Lot Number: #${lotId}`, 50, 125);
    doc.text(`Style Code: ${selectedDesign.style || 'N/A'}`, 50, 140);
    doc.text(`Brand / Client: ${selectedDesign.brand || 'N/A'}`, 50, 155);

    doc.text(`Category: ${selectedDesign.category || 'N/A'}`, 260, 125);
    doc.text(`Fabric Spec: ${selectedDesign.fabricType || 'N/A'}`, 260, 140);
    doc.text(`Target Pieces: ${selectedDesign.quantity || 100} pcs`, 260, 155);

    // Section 1: Workflow Checklist
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text('1. Workflow Stage Progress Checklist', 40, 205);

    const checklistHeaders = [['Step', 'Workflow Stage', 'Status', 'Completed Date/Time', 'Actor / Operator']];
    const checklistBody = steps.map((step, idx) => [
      idx + 1,
      step.name,
      step.isComplete ? 'COMPLETED' : 'PENDING',
      step.isComplete ? formatDateTime(step.date) : '—',
      step.isComplete ? step.actor : '—'
    ]);

    autoTable(doc, {
      head: checklistHeaders,
      body: checklistBody,
      startY: 215,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 6 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }
    });

    // Section 2: Chronological History Audit Log
    const nextY = doc.lastAutoTable.finalY + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text('2. Detailed Operational History Log', 40, nextY);

    const logHeaders = [['Timestamp', 'Event Title', 'Actor / Operator', 'Operational Details']];
    const logBody = timelineEvents.map(evt => [
      evt.timestamp,
      evt.title,
      evt.actor || 'System',
      typeof evt.details === 'string' ? evt.details : 'Status logged in system records'
    ]);

    autoTable(doc, {
      head: logHeaders,
      body: logBody,
      startY: nextY + 15,
      margin: { left: 40, right: 40 },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] }
    });

    doc.save(`Lot_${lotId}_Workflow_Report.pdf`);
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
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700' }}>Production &amp; RGP Work History</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Complete operational register &amp; workflow audit for Design Lots, Returnable Gate Passes (RGPs), Purchase Orders, and Security Gate Scanner records.
        </p>
      </div>

      {errorMessage && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px' }}>{errorMessage}</span>
        </div>
      )}

      {/* === Visual Stage Overview Analytics Banner === */}
      {filteredLotsList.length > 0 && (
        <div className="animate-slide-up" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[
            {
              label: 'Total Items',
              value: unifiedItemsList.length,
              icon: <Boxes size={18} />,
              color: '#0284c7',
              bg: '#e0f2fe',
              pct: 100
            },
            {
              label: 'RGP Passes',
              value: processedRgpList.length,
              icon: <Truck size={18} />,
              color: '#a855f7',
              bg: '#f3e8ff',
              pct: processedRgpList.length > 0 ? 100 : 0
            },
            {
              label: 'In Transit RGPs',
              value: processedRgpList.filter(r => r.computedStatus === 'In Transit').length,
              icon: <Activity size={18} />,
              color: '#f59e0b',
              bg: '#fef3c7',
              pct: processedRgpList.length > 0 ? Math.round((processedRgpList.filter(r => r.computedStatus === 'In Transit').length / processedRgpList.length) * 100) : 0
            },
            {
              label: 'Returned RGPs',
              value: processedRgpList.filter(r => r.computedStatus === 'Returned').length,
              icon: <ShieldCheck size={18} />,
              color: '#10b981',
              bg: '#d1fae5',
              pct: processedRgpList.length > 0 ? Math.round((processedRgpList.filter(r => r.computedStatus === 'Returned').length / processedRgpList.length) * 100) : 0
            },
            {
              label: 'Gate Scan Events',
              value: scanLogs.length,
              icon: <QrCode size={18} />,
              color: '#06b6d4',
              bg: '#cffafe',
              pct: 100
            },
            {
              label: 'Material Issues',
              value: issueLogs.length,
              icon: <ClipboardList size={18} />,
              color: '#059669',
              bg: '#d1fae5',
              pct: 100
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="analytics-kpi-card"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: stat.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: stat.color
                }}>
                  {stat.icon}
                </div>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', fontFamily: 'var(--font-family-title)' }}>
                  {stat.value}
                </span>
              </div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {stat.label}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', background: '#f0f7ff', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(stat.pct, 100)}%`,
                  borderRadius: '2px',
                  background: `linear-gradient(90deg, ${stat.color}, ${stat.bg})`,
                  animation: 'barGrowRight 0.7s cubic-bezier(0.4, 0, 0.2, 1) both',
                  animationDelay: `${i * 0.08}s`
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left Panel: Category Tabs, Search & Item Selector */}
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '20px' }}>
            <h3 className="panel-title" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} />
              <span>Select Item to Track</span>
            </h3>

            {/* Category Selector Tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--bg-secondary)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '14px',
              flexWrap: 'wrap'
            }}>
              {[
                { id: 'all', label: 'All Items', count: unifiedItemsList.length },
                { id: 'designs', label: 'Lots', count: designs.length },
                { id: 'rgps', label: 'RGPs', count: processedRgpList.length, highlight: '#a855f7' },
                { id: 'pos', label: 'POs', count: pos.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setItemCategory(tab.id)}
                  style={{
                    flex: 1,
                    minWidth: '55px',
                    padding: '5px 8px',
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
                    gap: '4px'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '9px',
                    opacity: 0.8,
                    background: itemCategory === tab.id ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.04)',
                    padding: '1px 4px',
                    borderRadius: '4px'
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search Lot, RGP #, Vendor, PO..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '34px', fontSize: '12px' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Quick Filters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {itemCategory === 'rgps' ? (
                <div>
                  <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>RGP Status</label>
                  <select
                    value={rgpStatusFilter}
                    onChange={(e) => setRgpStatusFilter(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: '6px',
                      border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                      fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="in_transit">In Transit</option>
                    <option value="returned">Returned</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Design Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: '6px',
                      border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                      fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                    }}
                  >
                    <option value="all">All Designs</option>
                    <option value="original">Original</option>
                    <option value="version">Recreated</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Sort Order</label>
                <select
                  value={ageSort}
                  onChange={(e) => setAgeSort(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: '6px',
                    border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                    fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                  }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>

            {/* List of Filtered Items */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px',
              maxHeight: '340px', overflowY: 'auto', paddingRight: '4px',
              border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px'
            }}>
              {filteredLotsList.map(item => {
                const isSelected = selectedLotId === item.id;
                const isRgp = item.itemType === 'rgp';
                const isPo = item.itemType === 'po';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedLotId(item.id)}
                    style={{
                      padding: '9px 11px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'all 0.15s',
                      backgroundColor: isSelected
                        ? (isRgp ? 'rgba(168, 85, 247, 0.1)' : 'var(--accent-light, rgba(99, 102, 241, 0.08))')
                        : 'transparent',
                      border: '1.5px solid',
                      borderColor: isSelected
                        ? (isRgp ? '#a855f7' : 'var(--accent-color)')
                        : 'transparent',
                      color: isSelected
                        ? (isRgp ? '#a855f7' : 'var(--accent-color)')
                        : 'var(--text-main)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isRgp ? <Truck size={14} style={{ color: '#a855f7' }} /> : (isPo ? <ClipboardList size={14} style={{ color: '#6366f1' }} /> : <FileText size={14} />)}
                        <span style={{ fontWeight: '700', fontSize: '13px' }}>
                          {item.title}
                        </span>
                      </div>

                      {isRgp && item.rgp && (
                        <span className={`status-badge ${item.rgp.computedStatus === 'Returned' ? 'verified' : (item.rgp.computedStatus === 'Overdue' ? 'overdue' : 'in-verification')}`} style={{ fontSize: '9px', padding: '1px 5px', textTransform: 'none' }}>
                          {item.rgp.computedStatus}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      <span>{item.subTitle}</span>
                      <span>{item.secondaryText}</span>
                    </div>

                    {item.date && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.75 }}>
                        <Clock size={9} />
                        <span>{formatDateTime(item.date)}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredLotsList.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No records match the current filters
                </div>
              )}
            </div>
          </div>

          {/* Left Panel: Contextual Specification Card */}
          {selectedRgp ? (
            /* RGP Pass Specifications Card */
            <div className="panel animate-scale" style={{ padding: '20px', borderLeft: '4px solid #a855f7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#a855f7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={16} />
                  <span>RGP Pass Manifest</span>
                </h3>
                <span className={`status-badge ${selectedRgp.computedStatus === 'Returned' ? 'verified' : (selectedRgp.computedStatus === 'Overdue' ? 'overdue' : 'in-verification')}`}>
                  {selectedRgp.computedStatus}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>RGP Number</span>
                  <span style={{ fontWeight: '800', color: '#a855f7' }}>#{selectedRgp.rgpNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vendor / Processor</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.vendor || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Department</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.department || 'Dispatch'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pass Type</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.rgpType || 'RGP'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expected Return</span>
                  <span style={{ fontWeight: '700', color: selectedRgp.isOverdue ? '#ef4444' : 'var(--text-main)' }}>
                    {formatDateTime(selectedRgp.expectedReturnDate) || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vehicle No</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.vehicleNo || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Authorized By</span>
                  <span style={{ fontWeight: '600' }}>{selectedRgp.authorizedBy || selectedRgp.preparedBy || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Line Items</span>
                  <span style={{ fontWeight: '800', color: 'var(--accent-color)' }}>{selectedRgp.totalItemsCount} items</span>
                </div>
              </div>
            </div>
          ) : selectedDesign ? (
            /* Design Lot Specifications Card */
            <div className="panel animate-scale" style={{ padding: '20px' }}>
              <h3 className="panel-title" style={{ marginBottom: '14px' }}>Lot Specifications</h3>

              {selectedDesign.imageUrl && (
                <div style={{ width: '100%', height: '140px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px', marginBottom: '14px' }}>
                  <img
                    src={getCleanImageUrl(selectedDesign.imageUrl)}
                    alt="Design spec"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lot ID</span>
                  <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    #{getLotVersionInfo(selectedDesign.id, designs).displayLot}
                    {getLotVersionInfo(selectedDesign.id, designs).isRecreated && (
                      <span className="status-badge in-verification" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none' }}>
                        {getLotVersionInfo(selectedDesign.id, designs).versionText}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Style Code</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.style}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Brand/Client</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.brand}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Category</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fabric Specification</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.fabricType || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Pieces</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{selectedDesign.quantity || 100} pcs</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Panel: Workflow Timeline & Scanner Audit */}
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '24px', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} />
                <span>
                  {selectedRgp 
                    ? `Operational Pipeline & Gate Scanner Trail for RGP #${selectedRgp.rgpNo}` 
                    : `Workflow Timeline ${selectedLotId ? `for #${selectedLotId}` : ''}`}
                </span>
              </h3>
            </div>

            {/* Workflow Operational Status Banner */}
            {selectedLotId && (
              <div style={{
                marginBottom: '20px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: allComplete
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))'
                  : selectedRgp?.isOverdue
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
                border: '1.5px solid',
                borderColor: allComplete ? 'rgba(16, 185, 129, 0.25)' : (selectedRgp?.isOverdue ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: allComplete ? 'var(--success)' : (selectedRgp?.isOverdue ? '#ef4444' : 'var(--warning)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {allComplete ? <Check size={20} /> : (selectedRgp?.isOverdue ? <AlertCircle size={20} /> : <Clock size={20} />)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>
                      {selectedRgp 
                        ? `RGP Operational Status: ${selectedRgp.computedStatus.toUpperCase()}`
                        : `Production Work Status: ${allComplete ? 'Complete' : 'In Progress'}`}
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {selectedRgp
                        ? (selectedRgp.isReturned
                            ? `Gate In return verified. Material batch successfully received back from ${selectedRgp.vendor}.`
                            : (selectedRgp.isOverdue 
                                ? `⚠️ Return is overdue against target date ${formatDateTime(selectedRgp.expectedReturnDate)}.`
                                : `Dispatched to ${selectedRgp.vendor}. Expected return on ${formatDateTime(selectedRgp.expectedReturnDate)}.`))
                        : (allComplete
                            ? 'All stages in the lot operational process have been successfully executed.'
                            : `${completedStepsCount} of ${workflowSteps.length} process stages completed.`)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* View switcher & Action Toolbar */}
            {selectedLotId && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '24px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  backgroundColor: 'var(--bg-primary)',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setViewMode('pipeline')}
                    style={{
                      padding: '6px 14px',
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
                      padding: '6px 14px',
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
                      padding: '6px 14px',
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
                    📅 Daily &amp; Calendar Tracker
                  </button>
                </div>

                <button
                  onClick={downloadWorkflowPDF}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: selectedRgp ? '#9333ea' : (allComplete ? 'var(--success)' : 'var(--accent-color)'),
                    color: '#ffffff',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <Download size={14} />
                  <span>{selectedRgp ? 'Download RGP PDF' : 'Download PDF Report'}</span>
                </button>
              </div>
            )}

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--accent-light)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Compiling Workflow History Logs...</span>
              </div>
            ) : !selectedLotId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>No Item Selected</h4>
                <p style={{ fontSize: '13px', maxWidth: '360px' }}>Select an active design lot or RGP pass from the left panel list to view its entire workflow sequence timeline.</p>
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
              /* Step-by-Step Pipeline View */
              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {/* Vertical Connector Line */}
                <div style={{
                  position: 'absolute', left: '9px', top: '12px', bottom: '12px',
                  width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {visibleSteps.map((step) => (
                    <div key={step.id} style={{ position: 'relative', display: 'flex', gap: '16px', zIndex: 2 }}>
                      {/* Node circle */}
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: step.isComplete ? 'var(--success)' : 'var(--bg-primary)',
                        border: '3px solid',
                        borderColor: step.isComplete ? 'var(--success)' : 'var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        flexShrink: 0,
                        marginTop: '3px',
                        boxShadow: '0 0 0 4px var(--bg-secondary)'
                      }}>
                        {step.isComplete && <Check size={10} strokeWidth={3} />}
                      </div>

                      {/* Content panel */}
                      <div className="panel" style={{
                        flex: 1,
                        padding: '14px 18px',
                        margin: 0,
                        boxShadow: 'var(--shadow-sm)',
                        borderColor: step.isComplete ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                        opacity: step.isComplete ? 1 : 0.75,
                        backgroundColor: step.isComplete ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.01)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: step.isComplete ? 'var(--success)' : 'var(--text-light)', display: 'inline-flex' }}>{step.icon}</span>
                            <span>{step.name}</span>
                          </span>

                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '12px',
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

                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '10px', paddingTop: '10px' }}>
                          {step.details}

                          {/* Nested Scanner Sub-Steps */}
                          {step.isComplete && step.subSteps && step.subSteps.length > 0 && (
                            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Scanner Activity Log
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {step.subSteps.map(sub => (
                                  <div key={sub.id} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: sub.done
                                      ? 'rgba(16, 185, 129, 0.06)'
                                      : 'rgba(148, 163, 184, 0.05)',
                                    border: '1px solid',
                                    borderColor: sub.done ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'
                                  }}>
                                    <div style={{
                                      width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                                      backgroundColor: sub.done ? 'var(--success)' : 'transparent',
                                      border: '2px solid',
                                      borderColor: sub.done ? 'var(--success)' : 'var(--border-color)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                                    }}>
                                      {sub.done && <Check size={8} strokeWidth={3} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: sub.done ? 'var(--text-main)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span>{sub.icon}</span>
                                          <span>{sub.label}</span>
                                        </span>
                                        <span style={{
                                          fontSize: '10px', fontWeight: '600', padding: '1px 7px', borderRadius: '10px',
                                          backgroundColor: sub.done ? 'var(--success-light)' : 'rgba(148,163,184,0.1)',
                                          color: sub.done ? 'var(--success)' : 'var(--text-muted)'
                                        }}>
                                          {sub.done ? '✓ Scanned' : 'Not Scanned'}
                                        </span>
                                      </div>
                                      {sub.done && sub.data && (
                                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                          <span>👤 <strong>{sub.data.person_name}</strong></span>
                                          <span>🏭 <strong>{sub.data.supplier_name}</strong></span>
                                          {sub.data.material_name && <span>📋 {sub.data.material_name}</span>}
                                          {sub.data.quantity > 0 && <span>🔢 {sub.data.quantity} pcs</span>}
                                          <span>🕐 {formatDateTime(sub.data.scanned_at)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* If RGP Selected: Display Itemized Table & Gate Scanner Audit Trail */}
                {selectedRgp && (
                  <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Itemized Dispatched Items Matrix */}
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      border: '1.5px solid var(--border-color)',
                      padding: '16px 20px',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Boxes size={16} style={{ color: '#a855f7' }} />
                        <span>Itemized Dispatched Items Matrix ({selectedRgp.totalItemsCount} rows)</span>
                      </h4>

                      {selectedRgp.entries && selectedRgp.entries.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                                <th style={{ padding: '8px' }}>#</th>
                                <th style={{ padding: '8px' }}>Lot Reference</th>
                                <th style={{ padding: '8px' }}>Item Description</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Qty 1</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Qty 2</th>
                                <th style={{ padding: '8px' }}>Purpose</th>
                                <th style={{ padding: '8px' }}>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRgp.entries.map((entry, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ padding: '8px', fontWeight: '700' }}>{entry.lotNo || '—'}</td>
                                  <td style={{ padding: '8px', fontWeight: '600' }}>{entry.itemDesc || '—'}</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#a855f7' }}>
                                    {entry.qty1 || 0} {entry.uom || 'pcs'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>
                                    {entry.qty2 ? `${entry.qty2} ${entry.uom || 'pcs'}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px' }}>{entry.purpose || '—'}</td>
                                  <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>{entry.remarks || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No itemized rows recorded in pass payload.
                        </div>
                      )}
                    </div>

                    {/* Security Gate Scanner Activity Trail */}
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      border: '1.5px solid var(--border-color)',
                      padding: '16px 20px',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <QrCode size={16} style={{ color: '#06b6d4' }} />
                        <span>Security Gate Scanner Activity Trail ({selectedRgp.scans.length} events)</span>
                      </h4>

                      {selectedRgp.scans && selectedRgp.scans.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                                <th style={{ padding: '8px' }}>Timestamp</th>
                                <th style={{ padding: '8px' }}>Gate Event Type</th>
                                <th style={{ padding: '8px' }}>Gatekeeper / Officer</th>
                                <th style={{ padding: '8px' }}>Party / Processor</th>
                                <th style={{ padding: '8px' }}>Material / Info</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Verified Qty</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Security Badge</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRgp.scans.map((s, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {formatDateTime(s.scanned_at)}
                                  </td>
                                  <td style={{ padding: '8px', fontWeight: '700' }}>
                                    {s.scan_type === 'rgp_entry' ? (
                                      <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <ArrowUpRight size={13} /> Gate Out (Dispatch)
                                      </span>
                                    ) : s.scan_type === 'rgp_return' ? (
                                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <ArrowDownLeft size={13} /> Gate In (Return)
                                      </span>
                                    ) : (
                                      <span style={{ color: '#06b6d4' }}>{s.scan_type || 'Gate Entry'}</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px', fontWeight: '600' }}>{s.person_name || 'Gatekeeper'}</td>
                                  <td style={{ padding: '8px' }}>{s.supplier_name || selectedRgp.vendor}</td>
                                  <td style={{ padding: '8px' }}>{s.material_name || 'Fabric/Trims'}</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>
                                    {s.quantity ? `${s.quantity} pcs` : '—'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <span className="status-badge verified" style={{ fontSize: '10px' }}>
                                      ✓ Verified
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          Awaiting security scanner checkpoints for this gate pass.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : timelineEvents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <AlertCircle size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>No timeline logs found</h4>
                <p style={{ fontSize: '13px', maxWidth: '360px' }}>We couldn't compile logs for this ID. Check if there are design status updates, gate passes, or scans linked.</p>
              </div>
            ) : (
              /* Original Timeline view (Chronological Log) */
              <div style={{ position: 'relative', paddingLeft: '20px' }}>
                <div style={{
                  position: 'absolute', left: '7px', top: '10px', bottom: '10px',
                  width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} style={{ position: 'relative', display: 'flex', gap: '16px', zIndex: 2 }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: 'var(--bg-primary)', border: '3.5px solid',
                        borderColor: evt.color, flexShrink: 0, marginTop: '4px',
                        boxShadow: '0 0 0 3px var(--bg-primary)'
                      }}></div>

                      <div className="animate-scale" style={{
                        flex: 1, backgroundColor: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)', borderRadius: '10px',
                        padding: '14px 18px', boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: evt.color, display: 'inline-flex' }}>{evt.icon}</span>
                            <span>{evt.title}</span>
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{evt.timestamp}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          <span>by <strong>{evt.actor}</strong></span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', color: 'var(--text-color)', fontSize: '13px' }}>
                          {evt.details}
                        </div>
                      </div>
                    </div>
                  ))}
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
