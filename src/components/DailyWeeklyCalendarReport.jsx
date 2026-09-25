import React, { useState, useEffect, useMemo } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Search, Filter,
  FileText, Download, Printer, Layers, ArrowRightLeft, Scale, Truck, Users,
  CheckCircle, AlertTriangle, Sparkles, RefreshCw, BarChart3, TrendingUp,
  Package, Scissors, Check, Eye, Tag, ArrowUpRight, ArrowDownLeft, Sliders
} from 'lucide-react';

// Robust Date Formatter & Parser
export const formatDateTime = (dateVal) => {
  if (!dateVal) return '—';
  const str = String(dateVal).trim();
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
  } catch (e) {}

  return str;
};

export const parseToDateObject = (dateVal) => {
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

export const toDateKey = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getWeekNumber = (dateObj) => {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export const getWeekRange = (dateObj) => {
  const curr = new Date(dateObj);
  const first = curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1);
  const firstDay = new Date(curr.setDate(first));
  const lastDay = new Date(curr.setDate(first + 6));
  
  const fYear = firstDay.getFullYear();
  const fMonth = firstDay.toLocaleString('default', { month: 'short' });
  const fDate = firstDay.getDate();

  const lYear = lastDay.getFullYear();
  const lMonth = lastDay.toLocaleString('default', { month: 'short' });
  const lDate = lastDay.getDate();

  return {
    start: firstDay,
    end: lastDay,
    startKey: toDateKey(firstDay),
    endKey: toDateKey(lastDay),
    label: `${fMonth} ${fDate} – ${lMonth} ${lDate}, ${lYear}`
  };
};

export default function DailyWeeklyCalendarReport({
  issueLogs = [],
  extraMaterialIssues = [],
  pos = [],
  designs = [],
  scans = [],
  transfers = [],
  weightCaptures = [],
  zipOrders = [],
  dooriOrders = [],
  designHistory = [],
  currencySymbol = 'R',
  onSelectLot = null,
  embeddedIn = 'report'
}) {
  // Local state for fetched items if parent didn't pass full datasets
  const [internalIssueLogs, setInternalIssueLogs] = useState([]);
  const [internalExtraIssues, setInternalExtraIssues] = useState([]);
  const [internalPos, setInternalPos] = useState([]);
  const [internalScans, setInternalScans] = useState([]);
  const [internalTransfers, setInternalTransfers] = useState([]);
  const [internalWeights, setInternalWeights] = useState([]);
  const [internalZip, setInternalZip] = useState([]);
  const [internalDoori, setInternalDoori] = useState([]);
  const [internalHistory, setInternalHistory] = useState([]);

  // Auto-fetch any missing datasets
  useEffect(() => {
    const backendUrl = getBackendUrl();
    if (!issueLogs.length) {
      fetch(`${backendUrl}/api/issue-logs`).then(r => r.ok && r.json()).then(d => d && setInternalIssueLogs(d)).catch(() => {});
    }
    if (!extraMaterialIssues.length) {
      fetch(`${backendUrl}/api/extra-material-issues`).then(r => r.ok && r.json()).then(d => d && setInternalExtraIssues(d)).catch(() => {});
    }
    if (!pos.length) {
      fetch(`${backendUrl}/api/pos`).then(r => r.ok && r.json()).then(d => d && setInternalPos(d)).catch(() => {});
    }
    if (!scans.length) {
      fetch(`${backendUrl}/api/scans`).then(r => r.ok && r.json()).then(d => d && setInternalScans(d)).catch(() => {});
    }
    if (!transfers.length) {
      fetch(`${backendUrl}/api/transfers`).then(r => r.ok && r.json()).then(d => d && setInternalTransfers(d)).catch(() => {});
    }
    if (!weightCaptures.length) {
      fetch(`${backendUrl}/api/weight-capture`).then(r => r.ok && r.json()).then(d => {
        if (d && d.success && Array.isArray(d.data)) setInternalWeights(d.data);
        else if (Array.isArray(d)) setInternalWeights(d);
      }).catch(() => {});
    }
    if (!zipOrders.length) {
      fetch(`${backendUrl}/api/zip-orders`).then(r => r.ok && r.json()).then(d => d && setInternalZip(d)).catch(() => {});
    }
    if (!dooriOrders.length) {
      fetch(`${backendUrl}/api/doori-orders`).then(r => r.ok && r.json()).then(d => d && setInternalDoori(d)).catch(() => {});
    }
    if (!designHistory.length) {
      fetch(`${backendUrl}/api/design-history`).then(r => r.ok && r.json()).then(d => d && setInternalHistory(d)).catch(() => {});
    }
  }, [issueLogs.length, extraMaterialIssues.length, pos.length, scans.length, transfers.length, weightCaptures.length, zipOrders.length, dooriOrders.length, designHistory.length]);

  const allIssues = issueLogs.length ? issueLogs : internalIssueLogs;
  const allExtra = extraMaterialIssues.length ? extraMaterialIssues : internalExtraIssues;
  const allPos = pos.length ? pos : internalPos;
  const allScans = scans.length ? scans : internalScans;
  const allTransfers = transfers.length ? transfers : internalTransfers;
  const allWeights = weightCaptures.length ? weightCaptures : internalWeights;
  const allZip = zipOrders.length ? zipOrders : internalZip;
  const allDoori = dooriOrders.length ? dooriOrders : internalDoori;
  const allHistory = designHistory.length ? designHistory : internalHistory;

  // Primary Mode: 'calendar', 'day_wise', 'week_wise', 'ledger'
  const [reportMode, setReportMode] = useState('calendar');

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedLotFilter, setSelectedLotFilter] = useState('all');

  // Selected week offset (0 = current week, -1 = previous week, etc.)
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => new Date());

  // 1. UNIFIED EVENT NORMALIZATION ENGINE
  const unifiedEvents = useMemo(() => {
    const list = [];

    // A. Issue Logs (Issues, Re-issues, Returns)
    (allIssues || []).forEach(log => {
      const rawDate = log.date || log.issuedAt || log.timestamp || log.created_at;
      const dateObj = parseToDateObject(rawDate);
      const isRet = log.isReturn === 1 || log.isReturn === true;
      const isRe = log.isReissue === 1 || log.isReissue === true;

      let materialsParsed = [];
      if (Array.isArray(log.materials)) {
        materialsParsed = log.materials;
      } else if (typeof log.materials === 'string') {
        try {
          materialsParsed = JSON.parse(log.materials || '[]');
        } catch (_) {}
      }

      const totalPcs = materialsParsed.reduce((sum, m) => sum + (Number(m.qty || m.issueQty || 0)), 0) || Number(log.volume || log.qtyIssued || 0);

      list.push({
        id: `ISS-${log.id}`,
        type: isRet ? 'return' : (isRe ? 'reissue' : 'issue'),
        category: 'material_issue',
        title: isRet ? `Material Return (Lot #${log.lotId})` : (isRe ? `Material Re-Issue (Lot #${log.lotId})` : `Material Issue (Lot #${log.lotId})`),
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(log.lotId || '').trim(),
        operator: log.personName || log.issuedBy || 'Store Incharge',
        receiver: log.receiverName || 'Cutting / Prod Dept',
        totalQty: totalPcs,
        unit: materialsParsed[0]?.unit || 'Pcs',
        items: materialsParsed,
        notes: log.comments || log.remarks || '',
        badgeColor: isRet ? '#10b981' : (isRe ? '#f59e0b' : '#3b82f6'),
        raw: log
      });
    });

    // B. Extra Material Issues
    (allExtra || []).forEach(ei => {
      const rawDate = ei.issueDate || ei.createdAt || ei.date;
      const dateObj = parseToDateObject(rawDate);
      const items = Array.isArray(ei.items) ? ei.items : [];
      const totalPcs = items.reduce((sum, it) => sum + (Number(it.totalRequired || it.qty || 0)), 0);

      list.push({
        id: `EX-${ei.voucherId || ei.id}`,
        type: 'extra_issue',
        category: 'extra_issue',
        title: `Extra Material Requisition Voucher #${ei.voucherId || ei.id} (Lot #${ei.lotId})`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(ei.lotId || '').trim(),
        operator: ei.personName || 'Store Staff',
        receiver: ei.receiverName || 'Production Floor',
        totalQty: totalPcs,
        unit: items[0]?.unit || 'Pcs',
        items: items,
        notes: ei.remarks || ei.reason || '',
        badgeColor: '#ec4899',
        raw: ei
      });
    });

    // C. Purchase Orders
    (allPos || []).forEach(po => {
      const rawDate = po.date || po.created_at;
      const dateObj = parseToDateObject(rawDate);
      let items = [];
      try {
        items = typeof po.items === 'string' ? JSON.parse(po.items) : (po.items || []);
      } catch (_) {}

      const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

      list.push({
        id: `PO-${po.poNumber || po.id}`,
        type: 'po',
        category: 'po_sourcing',
        title: `Purchase Order Created (${po.poNumber})`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(po.lotId || po.designName || '').trim(),
        operator: po.createdBy || 'Purchase Lead',
        receiver: po.vendorName || 'Supplier',
        totalQty: totalQty,
        amount: po.total || 0,
        unit: 'Units',
        items: items,
        notes: `Vendor: ${po.vendorName} | Tax: ${po.tax || 0}`,
        badgeColor: '#8b5cf6',
        raw: po
      });
    });

    // D. Zip Orders
    (allZip || []).forEach(z => {
      const rawDate = z.Date || z.created_at;
      const dateObj = parseToDateObject(rawDate);
      const totalQty = Number(z.Total_Qty || z.Quantity || 0);

      list.push({
        id: `ZIP-${z.Po_Number || z.id}`,
        type: 'zip_po',
        category: 'po_sourcing',
        title: `Zip PO Generated (${z.Po_Number || 'PO'}) — Lot #${z.Lot_Number}`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(z.Lot_Number || '').trim(),
        operator: z.Created_By || 'Trim Dept',
        receiver: z.Supplier_Name || 'Zip Supplier',
        totalQty: totalQty,
        unit: 'Pcs',
        items: [{ name: z.Zip_Type || 'Zip Order', qty: totalQty }],
        notes: `Color: ${z.Color || '—'} | Teeth: ${z.Teeth_Type || '—'}`,
        badgeColor: '#6366f1',
        raw: z
      });
    });

    // E. Doori Orders
    (allDoori || []).forEach(d => {
      const rawDate = d.Date || d.created_at;
      const dateObj = parseToDateObject(rawDate);
      const totalQty = Number(d.Total_Qty || d.Quantity || 0);

      list.push({
        id: `DOR-${d.Po_Number || d.id}`,
        type: 'doori_po',
        category: 'po_sourcing',
        title: `Doori PO Issued (${d.Po_Number || 'PO'}) — Lot #${d.Lot_Number}`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(d.Lot_Number || '').trim(),
        operator: d.Created_By || 'Trim Dept',
        receiver: d.Supplier_Name || 'Doori Supplier',
        totalQty: totalQty,
        unit: 'Meters',
        items: [{ name: d.Doori_Type || 'Doori Order', qty: totalQty }],
        notes: `Color: ${d.Color || '—'} | Dia: ${d.Diameter || '—'}`,
        badgeColor: '#4f46e5',
        raw: d
      });
    });

    // F. Scans (Gate Entry, Material In, RGP)
    (allScans || []).forEach(s => {
      const rawDate = s.scanned_at || s.created_at || s.date;
      const dateObj = parseToDateObject(rawDate);
      const isGate = s.scan_type === 'gate_entry';
      const isMatIn = s.scan_type === 'material_in';
      const isRgp = String(s.scan_type || '').startsWith('rgp');

      list.push({
        id: `SCN-${s.id}`,
        type: s.scan_type || 'scan',
        category: 'scans',
        title: isGate ? `Gate Entry Inward (Lot #${s.lot_number})` : (isMatIn ? `Store Receipt Inward (Lot #${s.lot_number})` : `RGP Gate Movement (Lot #${s.lot_number})`),
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(s.lot_number || '').trim(),
        operator: s.person_name || 'Gate Operator',
        receiver: s.supplier_name || 'Store',
        totalQty: Number(s.quantity || 0),
        unit: s.unit || 'Pcs',
        items: [{ name: s.material_name || 'Inward Goods', qty: Number(s.quantity || 0) }],
        notes: `Rolls/Pkts: ${s.rolls || s.packets || 1} | Chalan: ${s.chalan_number || '—'}`,
        badgeColor: isGate ? '#0ea5e9' : (isMatIn ? '#10b981' : '#f97316'),
        raw: s
      });
    });

    // G. Material Transfers
    (allTransfers || []).forEach(t => {
      const rawDate = t.transferredAt || t.date || t.timestamp;
      const dateObj = parseToDateObject(rawDate);

      list.push({
        id: `TR-${t.id}`,
        type: 'transfer',
        category: 'transfers',
        title: `Location Transfer (${t.materialName || 'Material'})`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(t.lotId || '').trim(),
        operator: t.transferredBy || t.operator || 'Warehouse Staff',
        receiver: `${t.fromLocation || 'Store'} → ${t.toLocation}`,
        totalQty: Number(t.qty || t.quantity || 0),
        unit: t.unit || 'Pcs',
        items: [{ name: t.materialName || 'Stock Transfer', qty: Number(t.qty || t.quantity || 0) }],
        notes: `From: ${t.fromLocation || '—'} To: ${t.toLocation || '—'}`,
        badgeColor: '#14b8a6',
        raw: t
      });
    });

    // H. Weight Captures (Material Add)
    (allWeights || []).forEach(w => {
      const rawDate = w.captured_at || w.date || w.created_at;
      const dateObj = parseToDateObject(rawDate);

      list.push({
        id: `WC-${w.id}`,
        type: 'weight_capture',
        category: 'weights',
        title: `Weight Recorded: ${w.material_name || 'Material'} (${w.weight || 0} kg)`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(w.lot_no || w.lotId || '').trim(),
        operator: w.operator || w.person_name || 'Store Scale',
        receiver: w.location || 'Store Rack',
        totalQty: Number(w.weight || w.quantity || 0),
        unit: 'kg',
        items: [{ name: w.material_name || 'Weighed Material', qty: Number(w.weight || 0) }],
        notes: `Gross: ${w.weight} kg | Pkts: ${w.packets || 1} | Rack: ${w.location || '—'}`,
        badgeColor: '#eab308',
        raw: w
      });
    });

    // I. Design Verifications & Audit History
    (allHistory || []).forEach(h => {
      const rawDate = h.timestamp || h.date;
      const dateObj = parseToDateObject(rawDate);

      list.push({
        id: `AUD-${h.id}`,
        type: 'design_audit',
        category: 'audits',
        title: `Design Technical Audit: ${h.action || 'Update'} (Lot #${h.lotId})`,
        dateStr: formatDateTime(rawDate),
        dateObj,
        dateKey: toDateKey(dateObj),
        lotId: String(h.lotId || '').trim(),
        operator: h.actorName || 'Designer / Admin',
        receiver: 'Approval Matrix',
        totalQty: 0,
        unit: 'Action',
        items: [],
        notes: h.details || h.comments || '',
        badgeColor: h.action === 'approved' ? '#10b981' : '#64748b',
        raw: h
      });
    });

    // Sort all events newest first by timestamp
    return list.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [allIssues, allExtra, allPos, allZip, allDoori, allScans, allTransfers, allWeights, allHistory]);

  // Map events by dateKey for O(1) calendar cell lookup
  const eventsByDateKey = useMemo(() => {
    const map = {};
    unifiedEvents.forEach(evt => {
      if (!evt.dateKey) return;
      if (!map[evt.dateKey]) {
        map[evt.dateKey] = [];
      }
      map[evt.dateKey].push(evt);
    });
    return map;
  }, [unifiedEvents]);

  // Unique Lots list for filter
  const uniqueLots = useMemo(() => {
    const set = new Set();
    unifiedEvents.forEach(e => {
      if (e.lotId && e.lotId !== 'Manual' && e.lotId !== '—') set.add(e.lotId);
    });
    return Array.from(set).sort();
  }, [unifiedEvents]);

  // 2. FILTERED EVENTS FOR CURRENT VIEWS
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(evt => {
      // 1. Text Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        evt.id.toLowerCase().includes(q) ||
        evt.title.toLowerCase().includes(q) ||
        evt.lotId.toLowerCase().includes(q) ||
        evt.operator.toLowerCase().includes(q) ||
        evt.receiver.toLowerCase().includes(q) ||
        evt.notes.toLowerCase().includes(q) ||
        evt.items.some(i => (i.name || i.bomItemName || i.materialName || '').toLowerCase().includes(q))
      );

      // 2. Category Filter
      const matchesCategory = categoryFilter === 'all' || evt.category === categoryFilter || evt.type === categoryFilter;

      // 3. Lot Filter
      const matchesLot = selectedLotFilter === 'all' || evt.lotId.toLowerCase() === selectedLotFilter.toLowerCase();

      return matchesSearch && matchesCategory && matchesLot;
    });
  }, [unifiedEvents, searchQuery, categoryFilter, selectedLotFilter]);

  // 3. CALENDAR GENERATION LOGIC
  const currentMonthYear = useMemo(() => {
    const y = calendarDate.getFullYear();
    const m = calendarDate.getMonth();
    const monthName = calendarDate.toLocaleString('default', { month: 'long' });
    return { year: y, month: m, label: `${monthName} ${y}` };
  }, [calendarDate]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    // First day of month & days in month
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler days (adjust for Monday start if desired, using Sun=0 standard)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const key = toDateKey(prevDate);
      days.push({
        date: prevDate,
        dayNum: d,
        dateKey: key,
        isCurrentMonth: false,
        events: eventsByDateKey[key] || []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const key = toDateKey(curDate);
      days.push({
        date: curDate,
        dayNum: d,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === toDateKey(new Date()),
        events: eventsByDateKey[key] || []
      });
    }

    // Next month filler days (fill up to 35 or 42 grid slots)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const key = toDateKey(nextDate);
      days.push({
        date: nextDate,
        dayNum: d,
        dateKey: key,
        isCurrentMonth: false,
        events: eventsByDateKey[key] || []
      });
    }

    return days;
  }, [calendarDate, eventsByDateKey]);

  // Monthly aggregated totals
  const monthlyMetrics = useMemo(() => {
    const prefix = `${currentMonthYear.year}-${String(currentMonthYear.month + 1).padStart(2, '0')}`;
    const monthEvents = unifiedEvents.filter(e => e.dateKey && e.dateKey.startsWith(prefix));
    
    let totalIssuesPcs = 0;
    let totalReturnsPcs = 0;
    let totalExtraPcs = 0;
    let totalPosCount = 0;
    let totalPosSpend = 0;
    const activeLotsSet = new Set();

    monthEvents.forEach(e => {
      if (e.lotId) activeLotsSet.add(e.lotId);
      if (e.type === 'issue' || e.type === 'reissue') totalIssuesPcs += e.totalQty;
      if (e.type === 'return') totalReturnsPcs += e.totalQty;
      if (e.type === 'extra_issue') totalExtraPcs += e.totalQty;
      if (e.type === 'po' || e.type === 'zip_po' || e.type === 'doori_po') {
        totalPosCount += 1;
        if (e.amount) totalPosSpend += Number(e.amount);
      }
    });

    return {
      eventsCount: monthEvents.length,
      totalIssuesPcs,
      totalReturnsPcs,
      totalExtraPcs,
      totalPosCount,
      totalPosSpend,
      activeLotsCount: activeLotsSet.size
    };
  }, [unifiedEvents, currentMonthYear]);

  // 4. DAY-WISE SELECTED DATE DATA
  const selectedDayEvents = useMemo(() => {
    if (!selectedDateKey) return [];
    return filteredEvents.filter(e => e.dateKey === selectedDateKey);
  }, [filteredEvents, selectedDateKey]);

  const selectedDayMetrics = useMemo(() => {
    let totalIssuesPcs = 0;
    let totalReturnsPcs = 0;
    let totalExtraPcs = 0;
    let totalPosCount = 0;
    let totalPosSpend = 0;
    let totalScansCount = 0;
    const lotsSet = new Set();

    selectedDayEvents.forEach(e => {
      if (e.lotId) lotsSet.add(e.lotId);
      if (e.type === 'issue' || e.type === 'reissue') totalIssuesPcs += e.totalQty;
      if (e.type === 'return') totalReturnsPcs += e.totalQty;
      if (e.type === 'extra_issue') totalExtraPcs += e.totalQty;
      if (e.type === 'po' || e.type === 'zip_po' || e.type === 'doori_po') {
        totalPosCount += 1;
        if (e.amount) totalPosSpend += Number(e.amount);
      }
      if (e.category === 'scans') totalScansCount += 1;
    });

    return {
      eventsCount: selectedDayEvents.length,
      totalIssuesPcs,
      totalReturnsPcs,
      totalExtraPcs,
      totalPosCount,
      totalPosSpend,
      totalScansCount,
      activeLotsCount: lotsSet.size
    };
  }, [selectedDayEvents]);

  // 5. WEEK-WISE METRICS & 7-DAY AGGREGATION
  const weekInfo = useMemo(() => {
    return getWeekRange(selectedWeekDate);
  }, [selectedWeekDate]);

  const weekEvents = useMemo(() => {
    const sTime = new Date(weekInfo.start).setHours(0, 0, 0, 0);
    const eTime = new Date(weekInfo.end).setHours(23, 59, 59, 999);

    return filteredEvents.filter(e => {
      const t = e.dateObj.getTime();
      return t >= sTime && t <= eTime;
    });
  }, [filteredEvents, weekInfo]);

  const weekDayBreakdown = useMemo(() => {
    const daysArr = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekInfo.start);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      const evts = eventsByDateKey[key] || [];

      let issuesPcs = 0;
      let returnsPcs = 0;
      let extraPcs = 0;
      let posCount = 0;
      const lots = new Set();

      evts.forEach(e => {
        if (e.lotId) lots.add(e.lotId);
        if (e.type === 'issue' || e.type === 'reissue') issuesPcs += e.totalQty;
        if (e.type === 'return') returnsPcs += e.totalQty;
        if (e.type === 'extra_issue') extraPcs += e.totalQty;
        if (e.type === 'po' || e.type === 'zip_po' || e.type === 'doori_po') posCount += 1;
      });

      daysArr.push({
        dayName: dayNames[i],
        shortName: dayNames[i].substring(0, 3),
        date: d,
        dateKey: key,
        formattedDate: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        eventsCount: evts.length,
        issuesPcs,
        returnsPcs,
        extraPcs,
        posCount,
        activeLots: Array.from(lots)
      });
    }

    return daysArr;
  }, [weekInfo, eventsByDateKey]);

  const weekMetrics = useMemo(() => {
    let totalIssues = 0;
    let totalReturns = 0;
    let totalExtra = 0;
    let totalPOs = 0;
    let totalSpend = 0;
    const uniqueLotsSet = new Set();
    const materialConsumptionMap = {};

    weekEvents.forEach(e => {
      if (e.lotId) uniqueLotsSet.add(e.lotId);
      if (e.type === 'issue' || e.type === 'reissue') totalIssues += e.totalQty;
      if (e.type === 'return') totalReturns += e.totalQty;
      if (e.type === 'extra_issue') totalExtra += e.totalQty;
      if (e.type === 'po' || e.type === 'zip_po' || e.type === 'doori_po') {
        totalPOs += 1;
        if (e.amount) totalSpend += Number(e.amount);
      }

      if (e.items && Array.isArray(e.items)) {
        e.items.forEach(it => {
          const name = it.name || it.bomItemName || it.materialName || 'Unspecified';
          const qty = Number(it.qty || it.issueQty || it.totalRequired || 0);
          if (qty > 0) {
            materialConsumptionMap[name] = (materialConsumptionMap[name] || 0) + qty;
          }
        });
      }
    });

    const topMaterials = Object.entries(materialConsumptionMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);

    return {
      eventsCount: weekEvents.length,
      totalIssues,
      totalReturns,
      totalExtra,
      totalPOs,
      totalSpend,
      activeLotsCount: uniqueLotsSet.size,
      topMaterials
    };
  }, [weekEvents]);

  // CSV Export Utility
  const exportToCSV = (eventsToExport, fileName = 'Report.csv') => {
    if (!eventsToExport || !eventsToExport.length) {
      alert('No data to export.');
      return;
    }

    const headers = ['Event ID', 'Date & Time', 'Category', 'Transaction Type', 'Lot Number', 'Operator / Issuer', 'Receiver / Supplier', 'Total Qty', 'Unit', 'Amount', 'Items Details', 'Remarks'];
    
    const rows = eventsToExport.map(e => [
      `"${e.id}"`,
      `"${e.dateStr}"`,
      `"${e.category}"`,
      `"${e.title}"`,
      `"${e.lotId}"`,
      `"${e.operator}"`,
      `"${e.receiver}"`,
      `"${e.totalQty}"`,
      `"${e.unit}"`,
      `"${e.amount || 0}"`,
      `"${(e.items || []).map(i => `${i.qty || 0} ${i.unit || ''} ${i.name || i.bomItemName || ''}`).join('; ')}"`,
      `"${e.notes.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="daily-weekly-report-container formal-report-print-frame animate-fade" style={{ width: '100%' }}>
      {/* ── Formal Document Header (Visible ONLY on Print) ──────────────── */}
      <div className="print-only print-doc-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '10px' }}>
          <div>
            <h1 style={{ fontSize: '18pt', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              MH STORE &amp; APPAREL MANUFACTURING
            </h1>
            <div style={{ fontSize: '10pt', fontWeight: '700', color: '#334155' }}>
              G-PDMS | Production, Material Movement &amp; Sourcing Ledger
            </div>
            <div style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '2px' }}>
              Facility: Main Production Plant &amp; Raw Material Warehouse
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#334155' }}>
            <div style={{ fontWeight: '800', fontSize: '9.5pt', color: '#0f172a', textTransform: 'uppercase' }}>
              {reportMode === 'week_wise' ? `Weekly Report (Week ${getWeekNumber(selectedWeekDate)})` : (reportMode === 'day_wise' ? 'Daily Audit Report' : (reportMode === 'calendar' ? 'Calendar Movement Audit' : 'Master Activity Ledger'))}
            </div>
            <div style={{ marginTop: '3px' }}>
              <strong>Period:</strong> {reportMode === 'week_wise' ? weekInfo.label : (reportMode === 'day_wise' ? parseToDateObject(selectedDateKey).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : currentMonthYear.label)}
            </div>
            <div><strong>Generated At:</strong> {new Date().toLocaleString('en-GB')}</div>
            <div><strong>Status:</strong> <span style={{ color: '#059669', fontWeight: '800' }}>AUDITED &amp; VERIFIED</span></div>
          </div>
        </div>
      </div>

      {/* Top Banner & Mode Selector (Hidden on Print) */}
      <div className="print-hide" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={22} style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>
              Daily, Weekly &amp; Calendar Tracking Hub
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Inspect full daily transaction audits, weekly aggregated trends, and interactive calendar day activity.
          </p>
        </div>

        {/* View Switcher Chips */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-secondary)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setReportMode('calendar')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: reportMode === 'calendar' ? 'var(--accent-color)' : 'transparent',
              color: reportMode === 'calendar' ? '#ffffff' : 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <CalendarIcon size={14} />
            <span>Calendar View</span>
          </button>

          <button
            type="button"
            onClick={() => setReportMode('day_wise')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: reportMode === 'day_wise' ? 'var(--accent-color)' : 'transparent',
              color: reportMode === 'day_wise' ? '#ffffff' : 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={14} />
            <span>Day-Wise Report</span>
          </button>

          <button
            type="button"
            onClick={() => setReportMode('week_wise')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: reportMode === 'week_wise' ? 'var(--accent-color)' : 'transparent',
              color: reportMode === 'week_wise' ? '#ffffff' : 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <BarChart3 size={14} />
            <span>Week-Wise Report</span>
          </button>

          <button
            type="button"
            onClick={() => setReportMode('ledger')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: reportMode === 'ledger' ? 'var(--accent-color)' : 'transparent',
              color: reportMode === 'ledger' ? '#ffffff' : 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <FileText size={14} />
            <span>Full Activity Ledger</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar for Search, Category & Lot (Hidden on Print) */}
      <div className="print-hide" style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Lot #, Material, Operator, Voucher, Item..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '34px',
              paddingRight: '12px',
              height: '36px',
              fontSize: '12.5px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{
            height: '36px',
            fontSize: '12.5px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-main)',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Activity Types</option>
          <option value="material_issue">Material Issues &amp; Returns</option>
          <option value="extra_issue">Extra Requisitions (Vouchers)</option>
          <option value="po_sourcing">Purchase Orders (General, Zip, Doori)</option>
          <option value="scans">Gate &amp; Inward Receipts</option>
          <option value="transfers">Stock Transfers</option>
          <option value="weights">Weight Captures</option>
          <option value="audits">Design &amp; Approvals</option>
        </select>

        {/* Lot Filter */}
        <select
          value={selectedLotFilter}
          onChange={e => setSelectedLotFilter(e.target.value)}
          style={{
            height: '36px',
            fontSize: '12.5px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-main)',
            outline: 'none',
            cursor: 'pointer',
            maxWidth: '180px'
          }}
        >
          <option value="all">All Lots ({uniqueLots.length})</option>
          {uniqueLots.map(lot => (
            <option key={lot} value={lot}>Lot #{lot}</option>
          ))}
        </select>

        {(searchQuery || categoryFilter !== 'all' || selectedLotFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setSelectedLotFilter('all'); }}
            style={{
              height: '36px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* =========================================================================
          VIEW 1: INTERACTIVE CALENDAR VIEW
          ========================================================================= */}
      {reportMode === 'calendar' && (
        <div className="calendar-view-panel animate-fade">
          {/* Calendar Header Navigation & Stats */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                {currentMonthYear.label}
              </h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(calendarDate);
                    prev.setMonth(prev.getMonth() - 1);
                    setCalendarDate(prev);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title="Previous Month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setCalendarDate(today);
                    setSelectedDateKey(toDateKey(today));
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(calendarDate);
                    next.setMonth(next.getMonth() + 1);
                    setCalendarDate(next);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title="Next Month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Quick Month Metrics Summary Pill */}
            <div style={{
              display: 'flex',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary)',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              <span><strong>{monthlyMetrics.eventsCount}</strong> Activities</span>
              <span>•</span>
              <span style={{ color: 'var(--accent-color)' }}><strong>{monthlyMetrics.totalIssuesPcs.toLocaleString()}</strong> Issued Pcs</span>
              <span>•</span>
              <span style={{ color: '#ec4899' }}><strong>{monthlyMetrics.totalExtraPcs.toLocaleString()}</strong> Extra</span>
              <span>•</span>
              <span style={{ color: '#8b5cf6' }}><strong>{monthlyMetrics.totalPosCount}</strong> POs</span>
              <span>•</span>
              <span><strong>{monthlyMetrics.activeLotsCount}</strong> Active Lots</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            marginBottom: '24px'
          }}>
            {/* Days of Week Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              backgroundColor: 'var(--bg-primary)',
              borderBottom: '1px solid var(--border-color)',
              textAlign: 'center',
              fontWeight: '700',
              fontSize: '12px',
              color: 'var(--text-muted)',
              padding: '10px 0'
            }}>
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Grid Days */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridAutoRows: 'minmax(105px, auto)'
            }}>
              {calendarDays.map((day, idx) => {
                const isSelected = day.dateKey === selectedDateKey;
                const hasEvents = day.events.length > 0;
                
                // Group day events by category for badge indicators
                const issuesCount = day.events.filter(e => e.type === 'issue' || e.type === 'reissue').length;
                const returnsCount = day.events.filter(e => e.type === 'return').length;
                const extraCount = day.events.filter(e => e.type === 'extra_issue').length;
                const poCount = day.events.filter(e => e.category === 'po_sourcing').length;
                const scanCount = day.events.filter(e => e.category === 'scans').length;
                const transferCount = day.events.filter(e => e.type === 'transfer' || e.type === 'weight_capture').length;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateKey(day.dateKey)}
                    style={{
                      borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border-color)',
                      borderBottom: '1px solid var(--border-color)',
                      padding: '8px',
                      backgroundColor: isSelected 
                        ? 'rgba(59, 130, 246, 0.08)' 
                        : (day.isCurrentMonth ? 'var(--bg-secondary)' : 'var(--bg-primary)'),
                      opacity: day.isCurrentMonth ? 1 : 0.45,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      outline: isSelected ? '2px solid var(--accent-color)' : 'none',
                      zIndex: isSelected ? 2 : 1
                    }}
                  >
                    {/* Top Date Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: day.isToday || isSelected ? '800' : '600',
                        color: day.isToday ? '#ffffff' : (isSelected ? 'var(--accent-color)' : 'var(--text-main)'),
                        backgroundColor: day.isToday ? 'var(--accent-color)' : 'transparent',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {day.dayNum}
                      </span>

                      {hasEvents && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-muted)',
                          padding: '1px 5px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)'
                        }}>
                          {day.events.length}
                        </span>
                      )}
                    </div>

                    {/* Event Badges in Cell */}
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                      {issuesCount > 0 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: '#2563eb',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          📦 {issuesCount} Issue{issuesCount > 1 ? 's' : ''}
                        </div>
                      )}

                      {extraCount > 0 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(236, 72, 153, 0.12)',
                          color: '#db2777',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          ⚡ {extraCount} Extra Req
                        </div>
                      )}

                      {poCount > 0 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(139, 92, 246, 0.12)',
                          color: '#7c3aed',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          📄 {poCount} PO{poCount > 1 ? 's' : ''}
                        </div>
                      )}

                      {scanCount > 0 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#059669',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          🚚 {scanCount} Inward
                        </div>
                      )}

                      {returnsCount > 0 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#047857',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          ↩ {returnsCount} Return{returnsCount > 1 ? 's' : ''}
                        </div>
                      )}

                      {transferCount > 0 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(20, 184, 166, 0.12)',
                          color: '#0d9488',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          🔄 {transferCount} Transfer
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Inspector Card beneath calendar */}
          {selectedDateKey && (
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={18} style={{ color: 'var(--accent-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                      Detailed Day Audit: {parseToDateObject(selectedDateKey).toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h3>
                  </div>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Showing {selectedDayEvents.length} transactions recorded on this date.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => exportToCSV(selectedDayEvents, `Daily_Report_${selectedDateKey}.csv`)}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Download size={13} />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--accent-color)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Printer size={13} />
                    <span>Print Day Slip</span>
                  </button>
                </div>
              </div>

              {/* Day KPI Cards */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div className="stat-card" style={{ padding: '12px' }}>
                  <span className="stat-title" style={{ fontSize: '11px' }}>Total Issues</span>
                  <span className="stat-value" style={{ fontSize: '18px', color: 'var(--accent-color)' }}>
                    {selectedDayMetrics.totalIssuesPcs.toLocaleString()} pcs
                  </span>
                </div>
                <div className="stat-card" style={{ padding: '12px' }}>
                  <span className="stat-title" style={{ fontSize: '11px' }}>Returns Back</span>
                  <span className="stat-value" style={{ fontSize: '18px', color: 'var(--success)' }}>
                    {selectedDayMetrics.totalReturnsPcs.toLocaleString()} pcs
                  </span>
                </div>
                <div className="stat-card" style={{ padding: '12px' }}>
                  <span className="stat-title" style={{ fontSize: '11px' }}>Extra Issues</span>
                  <span className="stat-value" style={{ fontSize: '18px', color: '#ec4899' }}>
                    {selectedDayMetrics.totalExtraPcs.toLocaleString()} pcs
                  </span>
                </div>
                <div className="stat-card" style={{ padding: '12px' }}>
                  <span className="stat-title" style={{ fontSize: '11px' }}>PO Transactions</span>
                  <span className="stat-value" style={{ fontSize: '18px', color: '#8b5cf6' }}>
                    {selectedDayMetrics.totalPosCount} orders
                  </span>
                </div>
                <div className="stat-card" style={{ padding: '12px' }}>
                  <span className="stat-title" style={{ fontSize: '11px' }}>Active Lots</span>
                  <span className="stat-value" style={{ fontSize: '18px' }}>
                    {selectedDayMetrics.activeLotsCount} lots
                  </span>
                </div>
              </div>

              {/* Event List for selected day */}
              {selectedDayEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Clock size={36} strokeWidth={1.5} style={{ display: 'inline-block', marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>No records or transactions logged on this day.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDayEvents.map(evt => (
                    <div
                      key={evt.id}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: evt.badgeColor
                        }} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)' }}>
                              {evt.title}
                            </span>
                            {evt.lotId && evt.lotId !== '—' && (
                              <span
                                onClick={() => onSelectLot && onSelectLot(evt.lotId)}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: 'var(--accent-color)',
                                  cursor: onSelectLot ? 'pointer' : 'default'
                                }}
                              >
                                Lot #{evt.lotId}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            <span><strong>Operator:</strong> {evt.operator}</span>
                            <span style={{ margin: '0 6px' }}>•</span>
                            <span><strong>Receiver / Target:</strong> {evt.receiver}</span>
                            {evt.notes && (
                              <>
                                <span style={{ margin: '0 6px' }}>•</span>
                                <span>{evt.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {evt.totalQty > 0 && (
                          <div style={{ fontWeight: '800', fontSize: '14px', color: evt.badgeColor }}>
                            {evt.type === 'return' ? '-' : '+'}{evt.totalQty.toLocaleString()} {evt.unit}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {evt.dateStr}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: DAY-WISE REPORT VIEW
          ========================================================================= */}
      {reportMode === 'day_wise' && (
        <div className="day-wise-view-panel animate-fade">
          {/* Day Stepper Bar (Hidden on Print) */}
          <div className="print-hide" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const curr = parseToDateObject(selectedDateKey);
                  curr.setDate(curr.getDate() - 1);
                  setSelectedDateKey(toDateKey(curr));
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                <ChevronLeft size={14} /> Previous Day
              </button>

              <input
                type="date"
                value={selectedDateKey}
                onChange={e => e.target.value && setSelectedDateKey(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: '700',
                  outline: 'none'
                }}
              />

              <button
                type="button"
                onClick={() => {
                  const curr = parseToDateObject(selectedDateKey);
                  curr.setDate(curr.getDate() + 1);
                  setSelectedDateKey(toDateKey(curr));
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                Next Day <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => setSelectedDateKey(toDateKey(new Date()))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent-color)',
                  background: 'transparent',
                  color: 'var(--accent-color)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                Today
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => exportToCSV(selectedDayEvents, `Day_Report_${selectedDateKey}.csv`)}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent-color)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={14} /> Print Day Report
              </button>
            </div>
          </div>

          {/* Day Metrics Cards */}
          <div className="stats-grid print-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Daily Events</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900' }}>{selectedDayMetrics.eventsCount}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Logged transactions</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Materials Issued</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: 'var(--accent-color)' }}>
                {selectedDayMetrics.totalIssuesPcs.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Dispatched to cutting / floor</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Materials Returned</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: 'var(--success)' }}>
                {selectedDayMetrics.totalReturnsPcs.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Returned unused leftovers</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Extra Requisitions</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: '#ec4899' }}>
                {selectedDayMetrics.totalExtraPcs.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Extra voucher pieces</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PO Orders Created</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: '#8b5cf6' }}>
                {selectedDayMetrics.totalPosCount}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Value: {currencySymbol}{selectedDayMetrics.totalPosSpend.toLocaleString()}
              </span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unique Lots Active</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900' }}>
                {selectedDayMetrics.activeLotsCount}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>In production today</span>
            </div>
          </div>

          {/* Full Day Transactions Table */}
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title">
                <FileText size={18} className="text-accent" />
                Comprehensive Day Log ({parseToDateObject(selectedDateKey).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })})
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                {selectedDayEvents.length} records found
              </span>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Time</th>
                    <th>Transaction Type</th>
                    <th>Lot Number</th>
                    <th>Operator / Issuer</th>
                    <th>Receiver / Vendor</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th>Items &amp; Details</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayEvents.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No records logged for this selected day.
                      </td>
                    </tr>
                  ) : (
                    selectedDayEvents.map(evt => (
                      <tr key={evt.id}>
                        <td style={{ fontWeight: '800', fontSize: '12.5px' }}>{evt.id}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {evt.dateStr.split(' ')[1] ? `${evt.dateStr.split(' ')[1]} ${evt.dateStr.split(' ')[2] || ''}` : evt.dateStr}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: `${evt.badgeColor}18`,
                            color: evt.badgeColor,
                            display: 'inline-block'
                          }}>
                            {evt.title}
                          </span>
                        </td>
                        <td>
                          {evt.lotId && evt.lotId !== '—' ? (
                            <span
                              onClick={() => onSelectLot && onSelectLot(evt.lotId)}
                              style={{
                                fontWeight: '700',
                                color: 'var(--accent-color)',
                                cursor: onSelectLot ? 'pointer' : 'default'
                              }}
                            >
                              Lot #{evt.lotId}
                            </span>
                          ) : '—'}
                        </td>
                        <td><strong>{evt.operator}</strong></td>
                        <td>{evt.receiver}</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: evt.badgeColor }}>
                          {evt.totalQty > 0 ? `${evt.totalQty.toLocaleString()} ${evt.unit}` : '—'}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {evt.items && evt.items.length > 0 ? (
                              evt.items.map((it, itIdx) => (
                                <span key={itIdx} style={{
                                  backgroundColor: 'var(--bg-secondary)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '11px'
                                }}>
                                  <strong>{it.qty || it.totalRequired || 0} {it.unit || ''}</strong> {it.name || it.bomItemName || it.materialName || ''}
                                </span>
                              ))
                            ) : (
                              <span>{evt.notes || '—'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: WEEK-WISE REPORT VIEW
          ========================================================================= */}
      {reportMode === 'week_wise' && (
        <div className="week-wise-view-panel animate-fade">
          {/* Week Stepper Bar (Hidden on Print) */}
          <div className="print-hide" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const curr = new Date(selectedWeekDate);
                  curr.setDate(curr.getDate() - 7);
                  setSelectedWeekDate(curr);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                <ChevronLeft size={14} /> Previous Week
              </button>

              <div style={{
                padding: '6px 14px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontWeight: '800',
                fontSize: '13px',
                color: 'var(--text-main)'
              }}>
                📅 {weekInfo.label} (Week {getWeekNumber(selectedWeekDate)})
              </div>

              <button
                type="button"
                onClick={() => {
                  const curr = new Date(selectedWeekDate);
                  curr.setDate(curr.getDate() + 7);
                  setSelectedWeekDate(curr);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                Next Week <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => setSelectedWeekDate(new Date())}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent-color)',
                  background: 'transparent',
                  color: 'var(--accent-color)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                Current Week
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => exportToCSV(weekEvents, `Weekly_Report_Week_${getWeekNumber(selectedWeekDate)}.csv`)}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} /> Export Week CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent-color)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={14} /> Print Week Report
              </button>
            </div>
          </div>

          {/* Week Top KPI Cards */}
          <div className="stats-grid print-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weekly Events</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900' }}>{weekMetrics.eventsCount}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Over 7 days</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Materials Issued</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: 'var(--accent-color)' }}>
                {weekMetrics.totalIssues.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Dispatched trims &amp; fabric</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Materials Returned</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: 'var(--success)' }}>
                {weekMetrics.totalReturns.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Returned items</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Extra Issues</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: '#ec4899' }}>
                {weekMetrics.totalExtra.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Wastage / extra pcs</span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>POs Issued</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900', color: '#8b5cf6' }}>
                {weekMetrics.totalPOs}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Spend: {currencySymbol}{weekMetrics.totalSpend.toLocaleString()}
              </span>
            </div>

            <div className="stat-card print-kpi-card" style={{ padding: '12px 14px', border: '1px solid var(--border-color)' }}>
              <span className="stat-title" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Batches</span>
              <span className="stat-value" style={{ fontSize: '20px', fontWeight: '900' }}>
                {weekMetrics.activeLotsCount}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Unique lots</span>
            </div>
          </div>

          {/* 7-Day Visual Comparative Cards */}
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              7-Day Activity &amp; Material Movement Breakdown
            </h3>
            
            <div className="print-7day-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px'
            }}>
              {weekDayBreakdown.map((d, dIdx) => (
                <div
                  key={dIdx}
                  className="print-7day-card"
                  onClick={() => {
                    setSelectedDateKey(d.dateKey);
                    setReportMode('day_wise');
                  }}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--text-main)' }}>
                      {d.shortName}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {d.formattedDate}
                    </span>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--accent-color)', marginBottom: '4px' }}>
                    {d.eventsCount} <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)' }}>events</span>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>📦 Issue: <strong>{d.issuesPcs.toLocaleString()}</strong></span>
                    <span>⚡ Extra: <strong>{d.extraPcs.toLocaleString()}</strong></span>
                    <span>↩ Ret: <strong>{d.returnsPcs.toLocaleString()}</strong></span>
                    <span>📄 PO: <strong>{d.posCount}</strong></span>
                  </div>

                  <div className="print-hide" style={{
                    marginTop: '8px',
                    paddingTop: '4px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: 'var(--accent-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    View Day <ArrowRightLeft size={9} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Consumed Materials of the Week */}
          {weekMetrics.topMaterials.length > 0 && (
            <div className="panel" style={{ marginBottom: '24px' }}>
              <div className="panel-header">
                <h3 className="panel-title">
                  <BarChart3 size={18} className="text-accent" />
                  Top Consumed Materials &amp; Trims of the Week
                </h3>
              </div>

              <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {weekMetrics.topMaterials.map((mat, mIdx) => (
                  <div
                    key={mIdx}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
                      {mat.name}
                    </span>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--accent-color)' }}>
                      {mat.qty.toLocaleString()} pcs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Consolidated Table */}
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title">
                <FileText size={18} className="text-accent" />
                Weekly Consolidated Transactions ({weekEvents.length} records)
              </h3>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Date &amp; Time</th>
                    <th>Type</th>
                    <th>Lot Number</th>
                    <th>Operator</th>
                    <th>Receiver</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th>Item Details</th>
                  </tr>
                </thead>
                <tbody>
                  {weekEvents.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No transactions recorded for this week.
                      </td>
                    </tr>
                  ) : (
                    weekEvents.map(evt => (
                      <tr key={evt.id}>
                        <td style={{ fontWeight: '800' }}>{evt.id}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{evt.dateStr}</td>
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: `${evt.badgeColor}18`,
                            color: evt.badgeColor
                          }}>
                            {evt.title}
                          </span>
                        </td>
                        <td>
                          {evt.lotId && evt.lotId !== '—' ? (
                            <span
                              onClick={() => onSelectLot && onSelectLot(evt.lotId)}
                              style={{ fontWeight: '700', color: 'var(--accent-color)', cursor: onSelectLot ? 'pointer' : 'default' }}
                            >
                              Lot #{evt.lotId}
                            </span>
                          ) : '—'}
                        </td>
                        <td><strong>{evt.operator}</strong></td>
                        <td>{evt.receiver}</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: evt.badgeColor }}>
                          {evt.totalQty > 0 ? `${evt.totalQty.toLocaleString()} ${evt.unit}` : '—'}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {evt.notes || (evt.items && evt.items.map(i => `${i.qty || 0} ${i.name || ''}`).join(', ')) || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: FULL ACTIVITY LEDGER VIEW
          ========================================================================= */}
      {reportMode === 'ledger' && (
        <div className="ledger-view-panel animate-fade">
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h3 className="panel-title">
                <Layers size={18} className="text-accent" />
                Master Unified Activity Ledger ({filteredEvents.length} records)
              </h3>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => exportToCSV(filteredEvents, 'Master_Activity_Ledger.csv')}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Download size={13} /> Export All CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--accent-color)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Printer size={13} /> Print Ledger
                </button>
              </div>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Date &amp; Time</th>
                    <th>Category</th>
                    <th>Title / Action</th>
                    <th>Lot Number</th>
                    <th>Operator</th>
                    <th>Receiver / Vendor</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No records match your search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.slice(0, 100).map(evt => (
                      <tr key={evt.id}>
                        <td style={{ fontWeight: '800', fontSize: '12px' }}>{evt.id}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{evt.dateStr}</td>
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            textTransform: 'capitalize'
                          }}>
                            {evt.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700', color: evt.badgeColor }}>{evt.title}</td>
                        <td>
                          {evt.lotId && evt.lotId !== '—' ? (
                            <span
                              onClick={() => onSelectLot && onSelectLot(evt.lotId)}
                              style={{ fontWeight: '700', color: 'var(--accent-color)', cursor: onSelectLot ? 'pointer' : 'default' }}
                            >
                              Lot #{evt.lotId}
                            </span>
                          ) : '—'}
                        </td>
                        <td><strong>{evt.operator}</strong></td>
                        <td>{evt.receiver}</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: evt.badgeColor }}>
                          {evt.totalQty > 0 ? `${evt.totalQty.toLocaleString()} ${evt.unit}` : '—'}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {evt.notes || (evt.items && evt.items.map(i => `${i.qty || 0} ${i.name || ''}`).join(', ')) || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredEvents.length > 100 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}>
                Showing top 100 records. Export to CSV to view full dataset of {filteredEvents.length} items.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Official Document Sign-Off Footer (Visible ONLY on Print) ── */}
      <div className="print-only print-sign-off-footer">
        <div className="sign-off-box">
          <div className="sign-off-line"></div>
          <strong>PREPARED BY</strong>
          <div style={{ fontSize: '7.5pt', color: '#64748b' }}>Store Incharge / Logistics Officer</div>
        </div>
        <div className="sign-off-box">
          <div className="sign-off-line"></div>
          <strong>VERIFIED BY</strong>
          <div style={{ fontSize: '7.5pt', color: '#64748b' }}>Production &amp; Cutting Manager</div>
        </div>
        <div className="sign-off-box">
          <div className="sign-off-line"></div>
          <strong>APPROVED BY</strong>
          <div style={{ fontSize: '7.5pt', color: '#64748b' }}>Authorised Factory Management</div>
        </div>
      </div>
    </div>
  );
}
