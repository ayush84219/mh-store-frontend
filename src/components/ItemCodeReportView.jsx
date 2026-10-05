import React, { useState, useEffect, useMemo } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  Boxes, QrCode, Search, Filter, Printer, Download, ArrowUpRight, ArrowDownLeft,
  RefreshCw, FileSpreadsheet, Eye, Calendar, Tag, Layers, CheckCircle2, ChevronRight,
  ChevronDown, ArrowLeft, ArrowRight, MapPin, User, Scale, FileText, ChevronLeft,
  AlertCircle, Package, ArrowRightLeft, Clock, Copy, Check, ClipboardList
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

export default function ItemCodeReportView({
  itemCodes: propItemCodes,
  materials: propMaterials,
  weightCaptures: propWeightCaptures,
  issueLogs: propIssueLogs,
  transfers: propTransfers,
  currencySymbol = '₹'
}) {
  // ── States ───────────────────────────────────────────────────────────────
  const [itemCodesList, setItemCodesList] = useState(propItemCodes || []);
  const [inventoryMaterials, setInventoryMaterials] = useState(propMaterials || []);
  const [weightCaptures, setWeightCaptures] = useState(propWeightCaptures || []);
  const [issueLogs, setIssueLogs] = useState(propIssueLogs || []);
  const [transfers, setTransfers] = useState(propTransfers || []);
  const [loading, setLoading] = useState(false);

  // View Mode: 'overview' | 'detail'
  const [viewMode, setViewMode] = useState('overview');
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [expandedRowCodes, setExpandedRowCodes] = useState(new Set());
  const [copiedCode, setCopiedCode] = useState(null);

  // Overview Filters
  const [overviewSearch, setOverviewSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all'); // 'all', 'in_stock', 'low_stock', 'out_of_stock'
  const [overviewSort, setOverviewSort] = useState('code_asc');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  // Detail Ledger Filters
  const [detailSubTab, setDetailSubTab] = useState('all'); // 'all', 'inward', 'issue', 'transfer'
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const [txSort, setTxSort] = useState('newest'); // 'newest', 'oldest'

  // Fetch full data from backend if props not supplied or to refresh
  const fetchData = async () => {
    setLoading(true);
    const backendUrl = getBackendUrl();
    try {
      const [icRes, matRes, wcRes, issRes, trRes] = await Promise.all([
        fetch(`${backendUrl}/api/item-codes`),
        fetch(`${backendUrl}/api/materials`),
        fetch(`${backendUrl}/api/weight-capture`),
        fetch(`${backendUrl}/api/issue-logs`),
        fetch(`${backendUrl}/api/transfers`)
      ]);

      if (icRes.ok) {
        const icData = await icRes.json();
        const list = icData.success && Array.isArray(icData.data) ? icData.data : (Array.isArray(icData) ? icData : []);
        setItemCodesList(list);
        if (!selectedItemCode && list.length > 0) {
          setSelectedItemCode(list[0].item_code);
        }
      }

      if (matRes.ok) {
        const mData = await matRes.json();
        setInventoryMaterials(Array.isArray(mData) ? mData : (mData.data || []));
      }

      if (wcRes.ok) {
        const wData = await wcRes.json();
        setWeightCaptures(wData.success && Array.isArray(wData.data) ? wData.data : (Array.isArray(wData) ? wData : []));
      }

      if (issRes.ok) {
        const iData = await issRes.json();
        setIssueLogs(Array.isArray(iData) ? iData : (iData.data || []));
      }

      if (trRes.ok) {
        const tData = await trRes.json();
        setTransfers(Array.isArray(tData) ? tData : (tData.data || []));
      }
    } catch (err) {
      console.error('Error fetching Item Code Report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update when props change
  useEffect(() => {
    if (propItemCodes && propItemCodes.length > 0) setItemCodesList(propItemCodes);
    if (propMaterials && propMaterials.length > 0) setInventoryMaterials(propMaterials);
    if (propWeightCaptures && propWeightCaptures.length > 0) setWeightCaptures(propWeightCaptures);
    if (propIssueLogs && propIssueLogs.length > 0) setIssueLogs(propIssueLogs);
    if (propTransfers && propTransfers.length > 0) setTransfers(propTransfers);
  }, [propItemCodes, propMaterials, propWeightCaptures, propIssueLogs, propTransfers]);

  // Copy code handler
  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  // Toggle row expansion
  const toggleRowExpansion = (code) => {
    setExpandedRowCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // ── Compute All Item Codes Summary ──────────────────────────────────────────
  const allItemCodesSummary = useMemo(() => {
    return itemCodesList.map(ic => {
      const code = ic.item_code;
      const mt = ic.mt_code;
      const name = ic.item_name || '';

      // Inwards
      const inwards = weightCaptures.filter(w =>
        w.itemCode === code || w.materialCode === code || (mt && w.materialCode === mt) || (w.materialName && name && w.materialName.toLowerCase() === name.toLowerCase())
      );
      const totalInwardPcs = inwards.reduce((s, w) => s + (Number(w.pieces) || 0), 0);
      const totalInwardKg = inwards.reduce((s, w) => s + (Number(w.netWeightKg || w.grossWeightKg) || 0), 0);
      const totalInwardPkts = inwards.reduce((s, w) => s + (Number(w.packets) || 1), 0);

      // Issues & Returns
      let totalIssuedPcs = 0;
      let totalReturnedPcs = 0;
      let issuesCount = 0;
      issueLogs.forEach(log => {
        (log.materials || []).forEach(m => {
          if (m.itemCode === code || m.materialId === code || (mt && m.materialId === mt) || (m.name && name && m.name.toLowerCase() === name.toLowerCase())) {
            if (log.isReturn) {
              totalReturnedPcs += Number(m.qty) || 0;
            } else {
              totalIssuedPcs += Number(m.qty) || 0;
              issuesCount++;
            }
          }
        });
      });

      // Transfers
      const itemTransfers = transfers.filter(t =>
        t.itemCode === code || t.materialCode === code || (mt && t.materialCode === mt)
      );
      const totalTransferredPkts = itemTransfers.reduce((s, t) => s + (Number(t.quantity || t.qty) || 1), 0);

      // Matched inventory material
      const matchedMat = inventoryMaterials.find(m =>
        m.itemCode === code || m.id === code || (mt && m.id === mt) || (m.name && name && m.name.toLowerCase() === name.toLowerCase())
      );
      const currentStock = matchedMat ? (Number(matchedMat.stock) || 0) : Math.max(0, totalInwardPcs - totalIssuedPcs + totalReturnedPcs);
      const location = matchedMat?.location || (inwards[0]?.storeLocation) || 'Main Store';
      const rate = Number(ic.rate || matchedMat?.rate || 0);
      const stockValuation = currentStock * rate;

      // Recent transactions snippet for quick preview
      const recentTx = [];
      inwards.slice(-2).forEach(w => {
        recentTx.push({
          type: 'inward',
          date: w.capturedAt || w.date,
          qty: `+${Number(w.pieces || 0).toLocaleString()}`,
          ref: w.invoiceNo || w.poNumber || `Inward #${w.id}`,
          operator: w.storeIncharge || 'Store'
        });
      });
      issueLogs.forEach(log => {
        (log.materials || []).forEach(m => {
          if (m.itemCode === code || m.materialId === code || (mt && m.materialId === mt)) {
            recentTx.push({
              type: log.isReturn ? 'return' : 'issue',
              date: log.date || log.timestamp,
              qty: `${log.isReturn ? '+' : '-'}${Number(m.qty || 0).toLocaleString()}`,
              ref: `Lot #${log.lotId || 'N/A'}`,
              operator: log.personName || 'Store'
            });
          }
        });
      });

      const brand = ic.brand || matchedMat?.brand || (inwards.find(w => w.brand)?.brand) || 'General';
      const vendor = ic.vendor || ic.supplier || matchedMat?.vendor || matchedMat?.supplier || (inwards.find(w => w.supplier || w.vendor)?.supplier || inwards.find(w => w.supplier || w.vendor)?.vendor) || '';

      return {
        ...ic,
        brand,
        vendor,
        matchedMat,
        location,
        rate,
        stockValuation,
        totalInwardPcs,
        totalInwardKg,
        totalInwardPkts,
        inwardsCount: inwards.length,
        totalIssuedPcs,
        totalReturnedPcs,
        netConsumedPcs: Math.max(0, totalIssuedPcs - totalReturnedPcs),
        issuesCount,
        totalTransferredPkts,
        transfersCount: itemTransfers.length,
        currentStock,
        totalTxCount: inwards.length + issuesCount + itemTransfers.length,
        recentTx: recentTx.slice(-3).reverse()
      };
    });
  }, [itemCodesList, weightCaptures, issueLogs, transfers, inventoryMaterials]);

  // Extract unique categories & brands/vendors for filter options
  const filterOptions = useMemo(() => {
    const cats = new Set();
    const brands = new Set();
    allItemCodesSummary.forEach(item => {
      if (item.category) cats.add(item.category.trim());
      if (item.brand && item.brand !== 'N/A' && item.brand !== 'General') brands.add(item.brand.trim());
      if (item.vendor && item.vendor !== 'N/A' && item.vendor !== item.brand) brands.add(item.vendor.trim());
    });
    return {
      categories: Array.from(cats).sort(),
      brands: Array.from(brands).sort()
    };
  }, [allItemCodesSummary]);

  // Global KPIs across all item codes
  const globalKpi = useMemo(() => {
    let totalItems = allItemCodesSummary.length;
    let totalInward = 0;
    let totalInwardKg = 0;
    let totalIssued = 0;
    let totalStock = 0;
    let totalValuation = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    allItemCodesSummary.forEach(item => {
      totalInward += item.totalInwardPcs;
      totalInwardKg += item.totalInwardKg;
      totalIssued += item.totalIssuedPcs;
      totalStock += item.currentStock;
      totalValuation += item.stockValuation;
      if (item.currentStock > 100) inStockCount++;
      else if (item.currentStock > 0 && item.currentStock <= 100) lowStockCount++;
      else outOfStockCount++;
    });

    return {
      totalItems,
      totalInward,
      totalInwardKg,
      totalIssued,
      totalStock,
      totalValuation,
      inStockCount,
      lowStockCount,
      outOfStockCount
    };
  }, [allItemCodesSummary]);

  // Filtered and Sorted Overview Items
  const filteredOverviewItems = useMemo(() => {
    const q = overviewSearch.toLowerCase().trim();
    return allItemCodesSummary
      .filter(item => {
        const matchesQ = !q ||
          item.item_code.toLowerCase().includes(q) ||
          (item.item_name || '').toLowerCase().includes(q) ||
          (item.brand || '').toLowerCase().includes(q) ||
          (item.vendor || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.style || '').toLowerCase().includes(q) ||
          (item.location || '').toLowerCase().includes(q);

        const matchesCat = categoryFilter === 'all' || (item.category || '').toLowerCase() === categoryFilter.toLowerCase();
        const matchesBrand = brandFilter === 'all' || 
          (item.brand || '').toLowerCase() === brandFilter.toLowerCase() ||
          (item.vendor || '').toLowerCase() === brandFilter.toLowerCase();

        let matchesStock = true;
        if (stockStatusFilter === 'in_stock') matchesStock = item.currentStock > 0;
        else if (stockStatusFilter === 'low_stock') matchesStock = item.currentStock > 0 && item.currentStock <= 100;
        else if (stockStatusFilter === 'out_of_stock') matchesStock = item.currentStock <= 0;

        return matchesQ && matchesCat && matchesBrand && matchesStock;
      })
      .sort((a, b) => {
        if (overviewSort === 'code_asc') return a.item_code.localeCompare(b.item_code, undefined, { numeric: true });
        if (overviewSort === 'code_desc') return b.item_code.localeCompare(a.item_code, undefined, { numeric: true });
        if (overviewSort === 'name_asc') return (a.item_name || '').localeCompare(b.item_name || '');
        if (overviewSort === 'stock_desc') return b.currentStock - a.currentStock;
        if (overviewSort === 'stock_asc') return a.currentStock - b.currentStock;
        if (overviewSort === 'inward_desc') return b.totalInwardPcs - a.totalInwardPcs;
        if (overviewSort === 'tx_desc') return b.totalTxCount - a.totalTxCount;
        return 0;
      });
  }, [allItemCodesSummary, overviewSearch, categoryFilter, brandFilter, stockStatusFilter, overviewSort]);

  const paginatedOverviewItems = useMemo(() => {
    const start = page * rpp;
    return filteredOverviewItems.slice(start, start + rpp);
  }, [filteredOverviewItems, page, rpp]);

  const totalOverviewPages = Math.ceil(filteredOverviewItems.length / rpp) || 1;

  // ── Compute Selected Item Detailed Transactions ────────────────────────────
  const selectedItemData = useMemo(() => {
    if (!selectedItemCode) return null;
    const summary = allItemCodesSummary.find(s => s.item_code === selectedItemCode);
    if (!summary) return null;

    const code = summary.item_code;
    const mt = summary.mt_code;
    const name = summary.item_name || '';

    const txList = [];

    // 1. Inwards (Weight Machine & Manual Captures)
    weightCaptures.forEach(w => {
      if (w.itemCode === code || w.materialCode === code || (mt && w.materialCode === mt) || (w.materialName && name && w.materialName.toLowerCase() === name.toLowerCase())) {
        const dObj = parseToDateObject(w.capturedAt || w.date);
        txList.push({
          id: `IN-${w.id}`,
          rawId: w.id,
          txType: 'inward',
          badgeColor: 'var(--success, #10b981)',
          badgeBg: 'var(--success-light, #ecfdf5)',
          typeLabel: 'Inward Receipt',
          date: w.capturedAt ? formatDateTime(w.capturedAt) : (w.date || '—'),
          dateObj: dObj,
          refNo: w.invoiceNo && w.invoiceNo !== 'N/A' ? `Inv: ${w.invoiceNo}` : (w.poNumber && w.poNumber !== 'N/A' ? `PO: ${w.poNumber}` : `Inward #${w.id}`),
          poNumber: w.poNumber || '—',
          invoiceNo: w.invoiceNo || '—',
          source: w.supplier || 'Vendor / Supplier',
          destination: w.storeLocation || 'Main Store',
          inwardQty: Number(w.pieces) || 0,
          outwardQty: 0,
          uom: w.unit || summary.uom || 'Pcs',
          weightKg: Number(w.netWeightKg || w.grossWeightKg) || 0,
          packets: Number(w.packets) || 1,
          operator: w.storeIncharge || 'Store Operator',
          mode: (w.entryMode === 'Manual' || w.entryMode === 'Manually' || w.status === 'Manual' || w.status === 'Manually') ? 'Manual Entry' : 'Weight Scale',
          remarks: w.remarks || `Inward received at ${w.storeLocation || 'Main Store'}`
        });
      }
    });

    // 2. Outward Issues & Returns
    issueLogs.forEach(log => {
      (log.materials || []).forEach(m => {
        if (m.itemCode === code || m.materialId === code || (mt && m.materialId === mt) || (m.name && name && m.name.toLowerCase() === name.toLowerCase())) {
          const dObj = parseToDateObject(log.date || log.timestamp || log.createdAt);
          const isRet = log.isReturn === true || log.isReturn === 1;
          txList.push({
            id: `ISS-${log.id}-${m.materialId || ''}`,
            rawId: log.id,
            txType: isRet ? 'return' : 'issue',
            badgeColor: isRet ? 'var(--accent-color, #0284c7)' : 'var(--danger, #ef4444)',
            badgeBg: isRet ? 'var(--accent-light, #e0f2fe)' : 'var(--danger-light, #fef2f2)',
            typeLabel: isRet ? 'Material Return' : 'Store Issue',
            date: log.date ? formatDateTime(log.date) : (log.timestamp ? formatDateTime(log.timestamp) : '—'),
            dateObj: dObj,
            refNo: `Lot #${log.lotId || 'N/A'}`,
            poNumber: '—',
            invoiceNo: '—',
            source: isRet ? (log.receiverDept || 'Cutting') : 'Main Store',
            destination: isRet ? 'Main Store' : `${log.receiverDept || 'Cutting Dept'}${log.receiverName ? ` (${log.receiverName})` : ''}`,
            inwardQty: isRet ? (Number(m.qty) || 0) : 0,
            outwardQty: isRet ? 0 : (Number(m.qty) || 0),
            uom: m.unit || summary.uom || 'Pcs',
            weightKg: 0,
            packets: 0,
            operator: log.personName || 'Store Incharge',
            mode: log.slipNo ? `Slip: ${log.slipNo}` : 'BOM Lot Issue',
            remarks: log.remarks || (isRet ? `Leftovers returned from Lot #${log.lotId}` : `Issued for Lot #${log.lotId} manufacturing`)
          });
        }
      });
    });

    // 3. Location Transfers
    transfers.forEach(t => {
      if (t.itemCode === code || t.materialCode === code || (mt && t.materialCode === mt)) {
        const dObj = parseToDateObject(t.transferredAt || t.date || t.timestamp);
        txList.push({
          id: `TR-${t.id}`,
          rawId: t.id,
          txType: 'transfer',
          badgeColor: '#8b5cf6',
          badgeBg: 'rgba(139, 92, 246, 0.1)',
          typeLabel: 'Bin Transfer',
          date: t.transferredAt ? formatDateTime(t.transferredAt) : '—',
          dateObj: dObj,
          refNo: `Transfer #${t.id}`,
          poNumber: '—',
          invoiceNo: '—',
          source: t.fromLocation || 'Store',
          destination: t.toLocation || 'Rack Bin',
          inwardQty: 0,
          outwardQty: 0,
          transferQty: Number(t.quantity || t.qty) || 1,
          uom: 'Packets',
          weightKg: 0,
          packets: Number(t.quantity || t.qty) || 1,
          operator: t.transferredBy || t.operator || 'Admin',
          mode: 'Internal Relocation',
          remarks: `Relocated from ${t.fromLocation || 'Store'} to ${t.toLocation}`
        });
      }
    });

    // Sort ascending by chronological date to compute running balance
    txList.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    let running = 0;
    txList.forEach((tx, idx) => {
      running += (tx.inwardQty || 0) - (tx.outwardQty || 0);
      tx.runningBalance = running;
      tx.slNo = idx + 1;
    });

    return {
      ...summary,
      transactions: txList
    };
  }, [selectedItemCode, allItemCodesSummary, weightCaptures, issueLogs, transfers]);

  // Filtered detail transactions based on sub-tab and search
  const filteredDetailTransactions = useMemo(() => {
    if (!selectedItemData) return [];
    let list = selectedItemData.transactions || [];

    // Sub-tab filter
    if (detailSubTab === 'inward') {
      list = list.filter(t => t.txType === 'inward' || t.txType === 'return');
    } else if (detailSubTab === 'issue') {
      list = list.filter(t => t.txType === 'issue');
    } else if (detailSubTab === 'transfer') {
      list = list.filter(t => t.txType === 'transfer');
    }

    // Type filter dropdown
    if (txTypeFilter !== 'all') {
      list = list.filter(t => t.txType === txTypeFilter);
    }

    // Search query
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase().trim();
      list = list.filter(t =>
        t.refNo.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        t.operator.toLowerCase().includes(q) ||
        t.mode.toLowerCase().includes(q) ||
        t.remarks.toLowerCase().includes(q)
      );
    }

    // Date range
    if (txDateFrom) {
      const fromObj = new Date(txDateFrom);
      list = list.filter(t => t.dateObj >= fromObj);
    }
    if (txDateTo) {
      const toObj = new Date(txDateTo);
      toObj.setHours(23, 59, 59, 999);
      list = list.filter(t => t.dateObj <= toObj);
    }

    // Sort order
    if (txSort === 'newest') {
      return [...list].reverse();
    }
    return list;
  }, [selectedItemData, detailSubTab, txTypeFilter, txSearch, txDateFrom, txDateTo, txSort]);

  // ── Handlers: Print, PDF, CSV ──────────────────────────────────────────────
  const handlePrintMasterRegister = () => {
    const printWin = window.open('', '_blank', 'width=1100,height=800');
    if (!printWin) {
      alert('Please allow popups to print report.');
      return;
    }

    const rowsHtml = filteredOverviewItems.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 7px 9px; text-align: center; font-weight: 600;">${idx + 1}</td>
        <td style="padding: 7px 9px; font-weight: 700; color: #0284c7;">${item.item_code}</td>
        <td style="padding: 7px 9px; font-weight: 600;">${item.item_name}</td>
        <td style="padding: 7px 9px;">
          <div style="font-weight: 700;">${item.brand || 'General'}</div>
          ${item.vendor && item.vendor.trim().toLowerCase() !== (item.brand || '').trim().toLowerCase() ? `<div style="font-size: 9.5px; color: #64748b;">${item.vendor}</div>` : ''}
        </td>
        <td style="padding: 7px 9px;">${item.category || 'Trims'}</td>
        <td style="padding: 7px 9px; text-align: center;">${item.uom || 'PCS'}</td>
        <td style="padding: 7px 9px; text-align: right; color: #10b981; font-weight: 700;">${item.totalInwardPcs > 0 ? '+' + item.totalInwardPcs.toLocaleString() : '0'}</td>
        <td style="padding: 7px 9px; text-align: right; color: #ef4444; font-weight: 700;">${item.totalIssuedPcs > 0 ? '-' + item.totalIssuedPcs.toLocaleString() : '0'}</td>
        <td style="padding: 7px 9px; text-align: right; color: #0284c7; font-weight: 700; background: #f0f9ff;">${item.currentStock.toLocaleString()}</td>
        <td style="padding: 7px 9px; text-align: center; font-size: 11px;">${item.location || 'Main Store'}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <html>
        <head>
          <title>Item Code Master Inventory Register</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
            th { background: #1e3a8a; color: #ffffff; padding: 8px 9px; font-size: 10.5px; text-transform: uppercase; text-align: left; font-weight: 800; letter-spacing: 0.3px; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px;">
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #1e3a8a;">G-PDMS | ITEM CODE MASTER INVENTORY REGISTER</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Stock Balance, Total Inwards, Issues & Store Bin Allocations</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Generated: <strong>${new Date().toLocaleString('en-IN')}</strong></div>
              <div>Total Items: <strong>${filteredOverviewItems.length}</strong></div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Item Code</th>
                <th>Material Description</th>
                <th>Brand / Vendor</th>
                <th>Category</th>
                <th style="text-align: center;">UOM</th>
                <th style="text-align: right;">Total Inward</th>
                <th style="text-align: right;">Total Issued</th>
                <th style="text-align: right;">Current Stock</th>
                <th style="text-align: center;">Location / Bin</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div style="margin-top: 30px; display: flex; justify-content: space-between; padding: 0 20px; font-size: 11px; color: #64748b;">
            <div>Store Manager: ___________________</div>
            <div>Accounts Officer: ___________________</div>
            <div>Authorized Signatory: ___________________</div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handlePrintItemCodeReport = (itemData) => {
    if (!itemData) return;
    const printWin = window.open('', '_blank', 'width=1100,height=800');
    if (!printWin) {
      alert('Please allow popups to print report.');
      return;
    }

    const rowsHtml = (itemData.transactions || []).map((t, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 7px 9px; text-align: center; font-weight: 600;">${idx + 1}</td>
        <td style="padding: 7px 9px; white-space: nowrap; font-size: 11px;">${t.date}</td>
        <td style="padding: 7px 9px; font-weight: 700; font-size: 11px;">${t.typeLabel}</td>
        <td style="padding: 7px 9px; font-weight: 600; font-size: 11px;">${t.refNo}</td>
        <td style="padding: 7px 9px; font-size: 11px;">${t.source}</td>
        <td style="padding: 7px 9px; font-size: 11px;">${t.destination}</td>
        <td style="padding: 7px 9px; text-align: right; font-weight: 700; color: #10b981;">${t.inwardQty > 0 ? '+' + t.inwardQty.toLocaleString() : '—'}</td>
        <td style="padding: 7px 9px; text-align: right; font-weight: 700; color: #ef4444;">${t.outwardQty > 0 ? '-' + t.outwardQty.toLocaleString() : '—'}</td>
        <td style="padding: 7px 9px; text-align: right; font-weight: 800; color: #0284c7; background: #f0f9ff;">${t.runningBalance != null ? t.runningBalance.toLocaleString() : '—'}</td>
        <td style="padding: 7px 9px; text-align: center; font-size: 11px;">${t.weightKg > 0 ? t.weightKg.toFixed(2) + ' Kg' : (t.packets > 0 ? t.packets + ' Pkts' : '—')}</td>
        <td style="padding: 7px 9px; font-size: 11px;">${t.operator}</td>
        <td style="padding: 7px 9px; font-size: 10.5px; color: #64748b;">${t.remarks}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <html>
        <head>
          <title>Item Code Statement - ${itemData.item_code}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
            th { background: #1e3a8a; color: #ffffff; padding: 8px 9px; font-size: 10.5px; text-transform: uppercase; text-align: left; font-weight: 800; letter-spacing: 0.3px; }
            .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; flex: 1; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px;">
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #1e3a8a;">G-PDMS | ITEM CODE MASTER REPORT & LEDGER</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Full Inward, Issue, Transfer & Stock Balance Audit Statement</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Generated: <strong>${new Date().toLocaleString('en-IN')}</strong></div>
              <div>Item Code: <strong style="font-size: 14px; color: #1e3a8a;">${itemData.item_code}</strong></div>
            </div>
          </div>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #0369a1;">${itemData.item_code} — ${itemData.item_name}</div>
              <div style="font-size: 11.5px; color: #0284c7; margin-top: 2px;">
                Brand: <strong>${itemData.brand || 'General'}</strong>${itemData.vendor && itemData.vendor.trim().toLowerCase() !== (itemData.brand || '').trim().toLowerCase() ? ` | Vendor: <strong>${itemData.vendor}</strong>` : ''} | Category: <strong>${itemData.category || 'Trims'}</strong> | Style/Lot: <strong>${itemData.style || 'N/A'}</strong> | UOM: <strong>${itemData.uom || 'PCS'}</strong> | Rate: <strong>${currencySymbol} ${Number(itemData.rate || 0).toFixed(2)}</strong>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10.5px; color: #64748b; text-transform: uppercase;">Current Warehouse Stock</div>
              <div style="font-size: 20px; font-weight: 800; color: #10b981;">${itemData.currentStock.toLocaleString()} <span style="font-size: 12px;">${itemData.uom || 'Pcs'}</span></div>
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-bottom: 14px;">
            <div class="kpi-card">
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Inward Received</div>
              <div style="font-size: 15px; font-weight: 800; color: #10b981; margin-top: 2px;">${itemData.totalInwardPcs.toLocaleString()} ${itemData.uom || 'Pcs'}</div>
              <div style="font-size: 10.5px; color: #64748b;">${itemData.inwardsCount} receipts (${itemData.totalInwardKg.toFixed(2)} Kg)</div>
            </div>
            <div class="kpi-card">
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Store Issues</div>
              <div style="font-size: 15px; font-weight: 800; color: #ef4444; margin-top: 2px;">${itemData.totalIssuedPcs.toLocaleString()} ${itemData.uom || 'Pcs'}</div>
              <div style="font-size: 10.5px; color: #64748b;">${itemData.issuesCount} lots consumed</div>
            </div>
            <div class="kpi-card">
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Location Transfers</div>
              <div style="font-size: 15px; font-weight: 800; color: #8b5cf6; margin-top: 2px;">${itemData.transfersCount} relocations</div>
              <div style="font-size: 10.5px; color: #64748b;">${itemData.totalTransferredPkts} packets moved</div>
            </div>
            <div class="kpi-card" style="background: #ecfdf5; border-color: #a7f3d0;">
              <div style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 700;">Net Balance Stock</div>
              <div style="font-size: 15px; font-weight: 800; color: #047857; margin-top: 2px;">${itemData.currentStock.toLocaleString()} ${itemData.uom || 'Pcs'}</div>
              <div style="font-size: 10.5px; color: #047857;">Location: ${itemData.location || 'Main Store'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Ref / Doc No</th>
                <th>From (Source)</th>
                <th>To (Destination)</th>
                <th style="text-align: right;">Inward (+)</th>
                <th style="text-align: right;">Outward (-)</th>
                <th style="text-align: right;">Balance</th>
                <th style="text-align: center;">Weight/Pkts</th>
                <th>Operator</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 30px; display: flex; justify-content: space-between; padding: 0 20px; font-size: 11px; color: #64748b;">
            <div>Prepared By: ___________________</div>
            <div>Store Manager: ___________________</div>
            <div>Authorized Signatory: ___________________</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleExportItemCodeReportPDF = (itemData) => {
    if (!itemData) return;
    const doc = new jsPDF('landscape');
    const pw = doc.internal.pageSize.getWidth();

    // Header Banner
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pw, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('ITEM CODE TRANSACTION REPORT & LEDGER', 14, 17);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | G-PDMS System`, pw - 14, 17, { align: 'right' });

    // Item Profile Header
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${itemData.item_code} — ${itemData.item_name || 'N/A'}`, 14, 36);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Brand: ${itemData.brand || 'General'}${itemData.vendor && itemData.vendor.toLowerCase() !== (itemData.brand || '').toLowerCase() ? ` | Vendor: ${itemData.vendor}` : ''} | Category: ${itemData.category || 'Trims'} | Style/Lot: ${itemData.style || 'N/A'} | UOM: ${itemData.uom || 'PCS'} | Rate: Rs. ${Number(itemData.rate || 0).toFixed(2)}`, 14, 43);

    // KPI Summary Metrics Box
    doc.setFillColor(240, 247, 255);
    doc.roundedRect(14, 48, pw - 28, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text(`Total Inward: ${itemData.totalInwardPcs.toLocaleString()} ${itemData.uom || 'Pcs'} (${itemData.totalInwardKg.toFixed(2)} Kg)`, 20, 57);
    doc.setTextColor(239, 68, 68);
    doc.text(`Total Issued: ${itemData.totalIssuedPcs.toLocaleString()} ${itemData.uom || 'Pcs'}`, 95, 57);
    doc.setTextColor(139, 92, 246);
    doc.text(`Transfers: ${itemData.transfersCount} (${itemData.totalTransferredPkts} pkts)`, 165, 57);
    doc.setTextColor(30, 58, 138);
    doc.text(`Current Stock: ${itemData.currentStock.toLocaleString()} ${itemData.uom || 'Pcs'}`, 230, 57);

    // Table of Transactions
    const tableBody = (itemData.transactions || []).map((t, idx) => [
      idx + 1,
      t.date,
      t.typeLabel.replace(/^[^\w]+/, ''),
      t.refNo,
      t.source,
      t.destination,
      t.inwardQty > 0 ? `+${t.inwardQty.toLocaleString()}` : '—',
      t.outwardQty > 0 ? `-${t.outwardQty.toLocaleString()}` : '—',
      t.runningBalance != null ? t.runningBalance.toLocaleString() : '—',
      t.weightKg > 0 ? `${t.weightKg.toFixed(2)} Kg` : (t.packets > 0 ? `${t.packets} pkts` : '—'),
      t.operator,
      t.remarks
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['#', 'Date & Time', 'Type', 'Ref / Doc No', 'From (Source)', 'To (Destination)', 'Inward (+)', 'Outward (-)', 'Balance', 'Weight/Pkts', 'Operator', 'Remarks']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [15, 23, 42],
        halign: 'center'
      },
      columnStyles: {
        0: { width: 10, halign: 'center' },
        1: { width: 28, halign: 'left' },
        2: { width: 22, fontStyle: 'bold' },
        3: { width: 24, fontStyle: 'bold' },
        4: { width: 28, halign: 'left' },
        5: { width: 28, halign: 'left' },
        6: { width: 18, fontStyle: 'bold', textColor: [16, 185, 129], halign: 'right' },
        7: { width: 18, fontStyle: 'bold', textColor: [239, 68, 68], halign: 'right' },
        8: { width: 18, fontStyle: 'bold', textColor: [2, 132, 199], halign: 'right' },
        9: { width: 18 },
        10: { width: 22 },
        11: { halign: 'left' }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`item_code_report_${itemData.item_code}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportItemCodeReportCSV = (itemData) => {
    if (!itemData) return;
    const headers = [
      'Sl No', 'Item Code', 'Item Name', 'Brand', 'Vendor', 'Category', 'Date & Time', 'Transaction Type',
      'Ref / Doc No', 'PO Number', 'Invoice No', 'From Source', 'To Destination',
      'Inward Qty', 'Outward Qty', 'Running Stock Balance', 'UOM', 'Weight (Kg)', 'Packets', 'Operator', 'Mode', 'Remarks'
    ];
    const rows = (itemData.transactions || []).map((t, idx) => [
      idx + 1,
      `"${itemData.item_code}"`,
      `"${(itemData.item_name || '').replace(/"/g, '""')}"`,
      `"${itemData.brand || ''}"`,
      `"${itemData.vendor || ''}"`,
      `"${itemData.category || ''}"`,
      `"${t.date}"`,
      `"${t.typeLabel}"`,
      `"${t.refNo}"`,
      `"${t.poNumber}"`,
      `"${t.invoiceNo}"`,
      `"${(t.source || '').replace(/"/g, '""')}"`,
      `"${(t.destination || '').replace(/"/g, '""')}"`,
      t.inwardQty || 0,
      t.outwardQty || 0,
      t.runningBalance != null ? t.runningBalance : '',
      `"${t.uom || itemData.uom || 'Pcs'}"`,
      t.weightKg || 0,
      t.packets || 0,
      `"${t.operator}"`,
      `"${t.mode}"`,
      `"${(t.remarks || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `item_code_ledger_${itemData.item_code}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportOverviewCSV = () => {
    const headers = [
      'Sl No', 'Item Code', 'Item Name', 'Brand', 'Vendor', 'Category', 'Style / Lot',
      'UOM', 'Rate (INR)', 'Total Inward Pcs', 'Total Inward Kg', 'Inwards Count',
      'Total Issued Pcs', 'Issues Count', 'Transfers Count', 'Current Stock Available', 'Location'
    ];
    const rows = filteredOverviewItems.map((item, idx) => [
      idx + 1,
      `"${item.item_code}"`,
      `"${(item.item_name || '').replace(/"/g, '""')}"`,
      `"${item.brand || ''}"`,
      `"${item.vendor || ''}"`,
      `"${item.category || ''}"`,
      `"${item.style || ''}"`,
      `"${item.uom || 'PCS'}"`,
      item.rate || 0,
      item.totalInwardPcs || 0,
      item.totalInwardKg || 0,
      item.inwardsCount || 0,
      item.totalIssuedPcs || 0,
      item.issuesCount || 0,
      item.transfersCount || 0,
      item.currentStock || 0,
      `"${item.location || 'Main Store'}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `item_codes_summary_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-family-body, inherit)' }}>
      {/* ── MODE 1: ALL ITEM CODES OVERVIEW REGISTER ──────────────────────── */}
      {viewMode === 'overview' && (
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: 'var(--border-radius-lg, 12px)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04))',
          padding: '16px 20px'
        }}>
          {/* Quick Filter Status Tabs & Actions Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setStockStatusFilter('all'); setPage(0); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: stockStatusFilter === 'all' ? '1.5px solid var(--accent-color, #0284c7)' : '1px solid var(--border-color, #cbd5e1)',
                  background: stockStatusFilter === 'all' ? 'var(--accent-light, #e0f2fe)' : 'var(--bg-secondary, #ffffff)',
                  color: stockStatusFilter === 'all' ? 'var(--accent-color, #0284c7)' : 'var(--text-main, #334155)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                All Items ({allItemCodesSummary.length})
              </button>

              <button
                type="button"
                onClick={() => { setStockStatusFilter('in_stock'); setPage(0); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: stockStatusFilter === 'in_stock' ? '1.5px solid var(--success, #10b981)' : '1px solid var(--border-color, #cbd5e1)',
                  background: stockStatusFilter === 'in_stock' ? 'var(--success-light, #ecfdf5)' : 'var(--bg-secondary, #ffffff)',
                  color: stockStatusFilter === 'in_stock' ? 'var(--success, #10b981)' : 'var(--text-muted, #64748b)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success, #10b981)' }}></span>
                <span>In Stock ({globalKpi.inStockCount})</span>
              </button>

              <button
                type="button"
                onClick={() => { setStockStatusFilter('low_stock'); setPage(0); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: stockStatusFilter === 'low_stock' ? '1.5px solid var(--warning, #f59e0b)' : '1px solid var(--border-color, #cbd5e1)',
                  background: stockStatusFilter === 'low_stock' ? 'var(--warning-light, #fffbeb)' : 'var(--bg-secondary, #ffffff)',
                  color: stockStatusFilter === 'low_stock' ? 'var(--warning, #f59e0b)' : 'var(--text-muted, #64748b)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning, #f59e0b)' }}></span>
                <span>Low Stock ({globalKpi.lowStockCount})</span>
              </button>

              <button
                type="button"
                onClick={() => { setStockStatusFilter('out_of_stock'); setPage(0); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: stockStatusFilter === 'out_of_stock' ? '1.5px solid var(--danger, #ef4444)' : '1px solid var(--border-color, #cbd5e1)',
                  background: stockStatusFilter === 'out_of_stock' ? 'var(--danger-light, #fef2f2)' : 'var(--bg-secondary, #ffffff)',
                  color: stockStatusFilter === 'out_of_stock' ? 'var(--danger, #ef4444)' : 'var(--text-muted, #64748b)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger, #ef4444)' }}></span>
                <span>Out of Stock ({globalKpi.outOfStockCount})</span>
              </button>
            </div>

            {/* Actions: Export & Print */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePrintMasterRegister}
                style={{
                  padding: '0 14px',
                  height: '34px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  background: 'var(--bg-secondary, #ffffff)',
                  color: 'var(--accent-color, #0284c7)',
                  border: '1px solid var(--border-color, #dbeafe)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                title="Print master inventory register"
              >
                <Printer size={14} />
                <span>Print Register</span>
              </button>

              <button
                type="button"
                onClick={handleExportOverviewCSV}
                style={{
                  padding: '0 14px',
                  height: '34px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  background: 'var(--success, #10b981)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s'
                }}
                title="Download CSV spreadsheet"
              >
                <Download size={14} />
                <span>Export Excel / CSV</span>
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}>
            {/* Search Box */}
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search Item Code (STxxxxx), Name, Brand, Category, Rack..."
                value={overviewSearch}
                onChange={(e) => { setOverviewSearch(e.target.value); setPage(0); }}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px 0 34px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  border: '1px solid var(--border-color, #dbeafe)',
                  fontSize: '12.5px',
                  outline: 'none',
                  background: 'var(--bg-secondary, #ffffff)',
                  color: 'var(--text-main, #0f172a)'
                }}
              />
              <Search size={15} color="var(--text-muted, #64748b)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              {overviewSearch && (
                <button
                  type="button"
                  onClick={() => setOverviewSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: 'var(--border-radius-sm, 6px)',
                border: '1px solid var(--border-color, #dbeafe)',
                fontSize: '12.5px',
                fontWeight: '600',
                background: 'var(--bg-secondary, #ffffff)',
                color: 'var(--text-main, #334155)',
                cursor: 'pointer',
                minWidth: '140px'
              }}
            >
              <option value="all">All Categories ({filterOptions.categories.length})</option>
              {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Brand Filter */}
            <select
              value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); setPage(0); }}
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: 'var(--border-radius-sm, 6px)',
                border: '1px solid var(--border-color, #dbeafe)',
                fontSize: '12.5px',
                fontWeight: '600',
                background: 'var(--bg-secondary, #ffffff)',
                color: 'var(--text-main, #334155)',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="all">All Brands / Vendors ({filterOptions.brands.length})</option>
              {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* Sort Filter */}
            <select
              value={overviewSort}
              onChange={(e) => setOverviewSort(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: 'var(--border-radius-sm, 6px)',
                border: '1px solid var(--border-color, #dbeafe)',
                fontSize: '12.5px',
                fontWeight: '600',
                background: 'var(--bg-secondary, #ffffff)',
                color: 'var(--text-main, #334155)',
                cursor: 'pointer',
                minWidth: '170px'
              }}
            >
              <option value="code_asc">Item Code (ST00001 →)</option>
              <option value="code_desc">Item Code (Latest First)</option>
              <option value="name_asc">Material Name (A → Z)</option>
              <option value="stock_desc">Highest Stock First</option>
              <option value="stock_asc">Lowest Stock First</option>
              <option value="inward_desc">Highest Inward Received</option>
              <option value="tx_desc">Most Active Transactions</option>
            </select>
          </div>

          {/* Overview Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                  <th style={{ padding: '10px 8px', width: '35px', textAlign: 'center', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>#</th>
                  <th style={{ padding: '10px 10px', width: '95px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ITEM CODE</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>MATERIAL DESCRIPTION</th>
                  <th style={{ padding: '10px 10px', width: '135px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>BRAND / VENDOR</th>
                  <th style={{ padding: '10px 10px', width: '85px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>CATEGORY</th>
                  <th style={{ padding: '10px 8px', width: '55px', textAlign: 'center', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>UOM</th>
                  <th style={{ padding: '10px 12px', width: '105px', textAlign: 'right', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>TOTAL INWARD</th>
                  <th style={{ padding: '10px 12px', width: '90px', textAlign: 'right', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>TOTAL ISSUED</th>
                  <th style={{ padding: '10px 12px', width: '105px', textAlign: 'right', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>CURRENT STOCK</th>
                  <th style={{ padding: '10px 12px', width: '220px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>LOCATION / BIN</th>
                  <th style={{ padding: '10px 10px', width: '90px', textAlign: 'center', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOverviewItems.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Boxes size={32} style={{ margin: '0 auto 8px auto', opacity: 0.3 }} />
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>No Item Codes Found</div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>Try searching with a different keyword or resetting your filters.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedOverviewItems.map((item, idx) => {
                    const isExpanded = expandedRowCodes.has(item.item_code);

                    return (
                      <React.Fragment key={item.item_code}>
                        <tr
                          onClick={() => toggleRowExpansion(item.item_code)}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: isExpanded ? '#eff6ff' : (idx % 2 === 1 ? '#f8fafc' : '#ffffff'),
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Row Number */}
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#0f172a', fontWeight: '700', fontSize: '12px' }}>
                            {page * rpp + idx + 1}
                          </td>

                          {/* Item Code */}
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                color: '#2563eb',
                                fontWeight: '700',
                                fontSize: '12px',
                                letterSpacing: '0.2px'
                              }}>
                                {item.item_code}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyCode(e, item.item_code)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: copiedCode === item.item_code ? '#16a34a' : '#94a3b8'
                                }}
                                title="Copy Item Code"
                              >
                                {copiedCode === item.item_code ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>
                          </td>

                          {/* Material Description */}
                          <td style={{ padding: '8px 12px', fontWeight: '800', color: '#0f172a', fontSize: '12px', textTransform: 'uppercase' }}>
                            {item.item_name}
                          </td>

                          {/* Brand / Vendor */}
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' }}>
                              {item.brand || 'General'}
                            </div>
                            {item.vendor && item.vendor.trim().toLowerCase() !== (item.brand || '').trim().toLowerCase() && (
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', marginTop: '1px', textTransform: 'uppercase' }}>
                                {item.vendor}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 8px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              color: '#475569',
                              fontSize: '11px',
                              fontWeight: '600',
                              border: '1px solid #e2e8f0'
                            }}>
                              {item.category || 'Trims'}
                            </span>
                          </td>

                          {/* UOM */}
                          <td style={{ padding: '8px', textAlign: 'center', color: '#475569', fontWeight: '600', fontSize: '11.5px' }}>
                            {item.uom || 'PCS'}
                          </td>

                          {/* Total Inward Receipts */}
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#16a34a', fontSize: '12px' }}>
                            {item.totalInwardPcs > 0 ? `+${item.totalInwardPcs.toLocaleString()}` : '0'}
                          </td>

                          {/* Total Issued */}
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#dc2626', fontSize: '12px' }}>
                            {item.totalIssuedPcs > 0 ? `-${item.totalIssuedPcs.toLocaleString()}` : '0'}
                          </td>

                          {/* Available Stock */}
                          <td style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontWeight: '900',
                            color: '#1e40af',
                            fontSize: '12.5px',
                            background: '#f0f7ff'
                          }}>
                            {item.currentStock.toLocaleString()}
                          </td>

                          {/* Location / Bin */}
                          <td style={{ padding: '8px 12px', fontSize: '11.5px', color: '#334155' }}>
                            {item.location || 'Main Store'}
                          </td>

                          {/* Action Buttons */}
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItemCode(item.item_code);
                                  setViewMode('detail');
                                }}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Eye size={11} />
                                <span>Ledger</span>
                              </button>
                              <div style={{ color: '#94a3b8' }}>
                                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* ── INLINE EXPANDED ROW (QUICK PREVIEW & RECENT TX) ── */}
                        {isExpanded && (
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                            <td colSpan="11" style={{ padding: '14px 20px' }}>
                              <div style={{
                                background: '#ffffff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '8px',
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0284c7' }}>
                                      Quick Summary: {item.item_code} — {item.item_name}
                                    </span>
                                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                      (Brand: <strong>{item.brand || 'General'}</strong>{item.vendor && item.vendor.trim().toLowerCase() !== (item.brand || '').trim().toLowerCase() ? <> | Vendor: <strong>{item.vendor}</strong></> : null} | Category: <strong>{item.category || 'Trims'}</strong>)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedItemCode(item.item_code);
                                      setViewMode('detail');
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      borderRadius: '6px',
                                      background: '#e0f2fe',
                                      color: '#0284c7',
                                      border: '1px solid #bae6fd',
                                      fontWeight: '700',
                                      fontSize: '11.5px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <span>Open Full Ledger &amp; Print</span>
                                    <ArrowRight size={12} />
                                  </button>
                                </div>

                                {/* 4 Summary Badges */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Inwards</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#16a34a', marginTop: '2px' }}>
                                      +{item.totalInwardPcs.toLocaleString()} {item.uom || 'PCS'}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>{item.inwardsCount} Receipts ({item.totalInwardKg.toFixed(2)} Kg)</div>
                                  </div>

                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Issues</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626', marginTop: '2px' }}>
                                      -{item.totalIssuedPcs.toLocaleString()} {item.uom || 'PCS'}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>{item.issuesCount} Lots Consumed</div>
                                  </div>

                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Current Balance</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0284c7', marginTop: '2px' }}>
                                      {item.currentStock.toLocaleString()} {item.uom || 'PCS'}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#0284c7' }}>📍 Location: {item.location || 'Main Store'}</div>
                                  </div>

                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Valuation Rate</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                                      {currencySymbol} {Number(item.rate || 0).toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>Value: {currencySymbol} {item.stockValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  </div>
                                </div>

                                {/* Recent Activity Preview */}
                                {item.recentTx && item.recentTx.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                                      Recent Transactions:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      {item.recentTx.map((tx, tIdx) => (
                                        <div key={tIdx} style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          fontSize: '11.5px',
                                          padding: '5px 10px',
                                          borderRadius: '4px',
                                          background: tx.type === 'inward' ? '#ecfdf5' : '#fef2f2',
                                          border: `1px solid ${tx.type === 'inward' ? '#a7f3d0' : '#fecaca'}`
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontWeight: '700', color: tx.type === 'inward' ? '#16a34a' : '#dc2626' }}>
                                              {tx.type === 'inward' ? 'Inward Receipt' : 'Store Issue'}
                                            </span>
                                            <span style={{ color: '#0f172a' }}>• Ref: <strong>{tx.ref}</strong></span>
                                            <span style={{ color: '#64748b' }}>• By: {tx.operator}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontWeight: '700', color: tx.type === 'inward' ? '#16a34a' : '#dc2626' }}>
                                              {tx.qty} {item.uom || 'PCS'}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '10.5px' }}>{formatDateTime(tx.date)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
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
          </div>

          {/* Pagination Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '14px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              Showing <strong>{filteredOverviewItems.length > 0 ? page * rpp + 1 : 0}</strong> to <strong>{Math.min((page + 1) * rpp, filteredOverviewItems.length)}</strong> of <strong>{filteredOverviewItems.length}</strong> items
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={rpp}
                onChange={(e) => { setRpp(Number(e.target.value)); setPage(0); }}
                style={{
                  height: '30px',
                  padding: '0 8px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  border: '1px solid var(--border-color, #dbeafe)',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  background: 'var(--bg-secondary, #ffffff)',
                  color: 'var(--text-main, #334155)'
                }}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>

              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  border: '1px solid var(--border-color, #dbeafe)',
                  background: page === 0 ? 'var(--bg-primary, #f1f5f9)' : 'var(--bg-secondary, #ffffff)',
                  color: page === 0 ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={13} /> Prev
              </button>

              <span style={{ fontWeight: '700', color: 'var(--accent-color)', padding: '0 4px', fontSize: '12px' }}>
                {page + 1} / {totalOverviewPages}
              </span>

              <button
                type="button"
                disabled={page >= totalOverviewPages - 1}
                onClick={() => setPage(p => Math.min(totalOverviewPages - 1, p + 1))}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  border: '1px solid var(--border-color, #dbeafe)',
                  background: page >= totalOverviewPages - 1 ? 'var(--bg-primary, #f1f5f9)' : 'var(--bg-secondary, #ffffff)',
                  color: page >= totalOverviewPages - 1 ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: page >= totalOverviewPages - 1 ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODE 2: SINGLE ITEM DEEP LEDGER & AUDIT STATEMENT ──────────────── */}
      {viewMode === 'detail' && selectedItemData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Selection & Action Bar */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 'var(--border-radius-lg, 12px)',
            border: '1px solid var(--border-color, #dbeafe)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  background: 'var(--bg-primary, #f1f5f9)',
                  color: 'var(--text-main, #334155)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={13} />
                <span>← All Item Codes</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-muted)' }}>Item:</span>
                <select
                  value={selectedItemCode}
                  onChange={(e) => setSelectedItemCode(e.target.value)}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: '1.5px solid var(--accent-color, #0284c7)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    color: 'var(--accent-color, #0284c7)',
                    background: 'var(--accent-light, #e0f2fe)',
                    cursor: 'pointer',
                    minWidth: '240px',
                    outline: 'none'
                  }}
                >
                  {allItemCodesSummary.map(item => (
                    <option key={item.item_code} value={item.item_code}>
                      {item.item_code} — {item.item_name} ({item.brand || 'General'} • {item.currentStock} {item.uom})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Print & Export Actions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handlePrintItemCodeReport(selectedItemData)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  background: 'var(--bg-secondary, #ffffff)',
                  color: 'var(--accent-color, #0284c7)',
                  border: '1px solid var(--border-color, #dbeafe)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Printer size={13} />
                <span>Print Voucher</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportItemCodeReportPDF(selectedItemData)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  background: 'var(--danger, #ef4444)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <FileText size={13} />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportItemCodeReportCSV(selectedItemData)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  background: 'var(--success, #10b981)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Download size={13} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Item Profile Card & 4 KPI Boxes */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 'var(--border-radius-lg, 12px)',
            border: '1px solid var(--border-color, #dbeafe)',
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    background: 'var(--accent-light, #e0f2fe)',
                    color: 'var(--accent-color, #0284c7)',
                    fontSize: '13px',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <QrCode size={13} />
                    {selectedItemData.item_code}
                  </span>
                  <span style={{
                    background: 'var(--bg-primary, #f1f5f9)',
                    color: 'var(--text-muted, #475569)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {selectedItemData.category || 'Trims'}
                  </span>
                  {selectedItemData.brand && (
                    <span style={{
                      background: 'var(--bg-primary, #f1f5f9)',
                      color: 'var(--text-muted, #475569)',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)'
                    }}>
                      Brand: {selectedItemData.brand}
                    </span>
                  )}
                  {selectedItemData.vendor && selectedItemData.vendor.trim().toLowerCase() !== (selectedItemData.brand || '').trim().toLowerCase() && (
                    <span style={{
                      background: 'var(--bg-primary, #f1f5f9)',
                      color: 'var(--text-muted, #475569)',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)'
                    }}>
                      Vendor: {selectedItemData.vendor}
                    </span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                  {selectedItemData.item_name}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Style / Lot: <strong style={{ color: 'var(--text-main)' }}>{selectedItemData.style || 'N/A'}</strong> • Unit: <strong style={{ color: 'var(--text-main)' }}>{selectedItemData.uom || 'PCS'}</strong> • Standard Rate: <strong style={{ color: 'var(--text-main)' }}>{currencySymbol} {Number(selectedItemData.rate || 0).toFixed(2)}</strong>
                </div>
              </div>

              <div style={{
                background: 'var(--accent-light, #e0f2fe)',
                padding: '10px 18px',
                borderRadius: '8px',
                textAlign: 'right',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Available Stock</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-color, #0284c7)', marginTop: '1px' }}>
                  {selectedItemData.currentStock.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>{selectedItemData.uom || 'Pcs'}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  📍 Bin: <strong style={{ color: 'var(--text-main)' }}>{selectedItemData.location || 'Main Store'}</strong>
                </div>
              </div>
            </div>

            {/* 4 KPI Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px'
            }}>
              <div style={{
                background: 'var(--bg-primary, #f8fafc)',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Total Inward Received</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: 'var(--success, #10b981)' }}>
                  +{selectedItemData.totalInwardPcs.toLocaleString()} {selectedItemData.uom || 'Pcs'}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {selectedItemData.inwardsCount} receipts ({selectedItemData.totalInwardKg.toFixed(2)} Kg)
                </div>
              </div>

              <div style={{
                background: 'var(--bg-primary, #f8fafc)',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Total Store Issues</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: 'var(--danger, #ef4444)' }}>
                  -{selectedItemData.totalIssuedPcs.toLocaleString()} {selectedItemData.uom || 'Pcs'}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {selectedItemData.issuesCount} lots consumed
                </div>
              </div>

              <div style={{
                background: 'var(--bg-primary, #f8fafc)',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Location Transfers</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: '#8b5cf6' }}>
                  {selectedItemData.transfersCount} Relocations
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {selectedItemData.totalTransferredPkts} packets moved
                </div>
              </div>

              <div style={{
                background: 'var(--bg-primary, #f8fafc)',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Total Transactions</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: 'var(--text-main)' }}>
                  {selectedItemData.totalTxCount} Entries
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  Full lifecycle statement
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tabs: All / Inward / Issue / Transfer */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 'var(--border-radius-lg, 12px)',
            border: '1px solid var(--border-color, #dbeafe)',
            padding: '16px 20px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              borderBottom: '1px solid var(--border-color, #dbeafe)',
              paddingBottom: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDetailSubTab('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: detailSubTab === 'all' ? 'var(--accent-color, #0284c7)' : 'var(--bg-primary, #f1f5f9)',
                    color: detailSubTab === 'all' ? '#ffffff' : 'var(--text-main, #475569)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ClipboardList size={13} />
                  <span>Statement ({selectedItemData.transactions.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailSubTab('inward')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: detailSubTab === 'inward' ? 'var(--success, #10b981)' : 'var(--bg-primary, #f1f5f9)',
                    color: detailSubTab === 'inward' ? '#ffffff' : 'var(--text-main, #475569)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ArrowDownLeft size={13} />
                  <span>Inwards ({selectedItemData.inwardsCount + (selectedItemData.totalReturnedPcs > 0 ? 1 : 0)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailSubTab('issue')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: detailSubTab === 'issue' ? 'var(--danger, #ef4444)' : 'var(--bg-primary, #f1f5f9)',
                    color: detailSubTab === 'issue' ? '#ffffff' : 'var(--text-main, #475569)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ArrowUpRight size={13} />
                  <span>Issues ({selectedItemData.issuesCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailSubTab('transfer')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: detailSubTab === 'transfer' ? '#8b5cf6' : 'var(--bg-primary, #f1f5f9)',
                    color: detailSubTab === 'transfer' ? '#ffffff' : 'var(--text-main, #475569)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ArrowRightLeft size={13} />
                  <span>Transfers ({selectedItemData.transfersCount})</span>
                </button>
              </div>

              {/* Search within transactions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search PO, Invoice, Lot #..."
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    style={{
                      height: '32px',
                      padding: '0 10px 0 28px',
                      borderRadius: 'var(--border-radius-sm, 6px)',
                      border: '1px solid var(--border-color, #dbeafe)',
                      fontSize: '12px',
                      outline: 'none',
                      background: 'var(--bg-secondary, #ffffff)',
                      color: 'var(--text-main, #0f172a)',
                      width: '180px'
                    }}
                  />
                  <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                <select
                  value={txSort}
                  onChange={(e) => setTxSort(e.target.value)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: '1px solid var(--border-color, #dbeafe)',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: 'var(--bg-secondary, #ffffff)',
                    color: 'var(--text-main, #334155)'
                  }}
                >
                  <option value="newest">Latest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>

            {/* Detailed Ledger Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #dbeafe)', borderRadius: 'var(--border-radius-md, 8px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                    <th style={{ padding: '10px 8px', width: '35px', textAlign: 'center', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>#</th>
                    <th style={{ padding: '10px 10px', width: '135px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>DATE &amp; TIME</th>
                    <th style={{ padding: '10px 10px', width: '110px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>TYPE</th>
                    <th style={{ padding: '10px 10px', width: '110px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>REF / DOC NO</th>
                    <th style={{ padding: '10px 10px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>SOURCE → DESTINATION</th>
                    <th style={{ padding: '10px 10px', width: '90px', textAlign: 'right', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>INWARD (+)</th>
                    <th style={{ padding: '10px 10px', width: '90px', textAlign: 'right', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>OUTWARD (-)</th>
                    <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>BALANCE</th>
                    <th style={{ padding: '10px 10px', width: '90px', textAlign: 'center', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>WEIGHT/PKTS</th>
                    <th style={{ padding: '10px 10px', width: '110px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>OPERATOR</th>
                    <th style={{ padding: '10px 10px', fontWeight: '800', color: '#ffffff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetailTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                        No transactions found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDetailTransactions.map((tx, idx) => (
                      <tr
                        key={tx.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-color, #dbeafe)',
                          background: idx % 2 === 1 ? 'var(--bg-primary, #f8fafc)' : 'var(--bg-card, #ffffff)'
                        }}
                      >
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {tx.slNo || idx + 1}
                        </td>

                        <td style={{ padding: '10px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-main)', fontWeight: '600' }}>
                          {tx.date}
                        </td>

                        <td style={{ padding: '10px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: tx.badgeBg,
                            color: tx.badgeColor,
                            fontWeight: '700',
                            fontSize: '11px'
                          }}>
                            {tx.typeLabel}
                          </span>
                        </td>

                        <td style={{ padding: '10px', fontWeight: '700', color: 'var(--accent-color, #0284c7)' }}>
                          {tx.refNo}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {tx.mode}
                          </div>
                        </td>

                        <td style={{ padding: '10px', fontSize: '11.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{tx.source}</span> → <strong style={{ color: 'var(--text-main)' }}>{tx.destination}</strong>
                        </td>

                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: 'var(--success, #10b981)', fontSize: '12.5px' }}>
                          {tx.inwardQty > 0 ? `+${tx.inwardQty.toLocaleString()}` : '—'}
                        </td>

                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: 'var(--danger, #ef4444)', fontSize: '12.5px' }}>
                          {tx.outwardQty > 0 ? `-${tx.outwardQty.toLocaleString()}` : '—'}
                        </td>

                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: 'var(--accent-color, #0284c7)', fontSize: '12.5px', background: 'var(--accent-subtle, #f0f9ff)' }}>
                          {tx.runningBalance != null ? `${tx.runningBalance.toLocaleString()} ${tx.uom || 'Pcs'}` : '—'}
                        </td>

                        <td style={{ padding: '10px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {tx.weightKg > 0 ? `${tx.weightKg.toFixed(2)} Kg` : (tx.packets > 0 ? `${tx.packets} Pkts` : '—')}
                        </td>

                        <td style={{ padding: '10px', fontSize: '11.5px', color: 'var(--text-main)', fontWeight: '600' }}>
                          {tx.operator}
                        </td>

                        <td style={{ padding: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {tx.remarks}
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
    </div>
  );
}
