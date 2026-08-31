import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  Package, Save, RefreshCw, Download, Search, Filter,
  MapPin, User, ChevronDown, ChevronRight, CheckCircle2,
  AlertTriangle, X, Printer, Menu, Edit3, Layers, FileText
} from 'lucide-react';

const BASE_CODE = 1000;

const parseMTNum = (code) => {
  const m = String(code || '').match(/MT(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
};

export default function ManuallyWeightCapture({ racks = [], currentUser = null }) {
  const [captures, setCaptures] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Dynamic slot options from the racks configuration
  const generatedLocations = useMemo(() => {
    const list = [];
    racks.forEach(rack => {
      const displayLabel = rack.warehouse && rack.code.includes(rack.warehouse) ? rack.code : `${rack.warehouse} - Rack ${rack.code}`;
      list.push({ code: displayLabel, label: displayLabel, rawCode: rack.code, warehouse: rack.warehouse });
    });
    return list;
  }, [racks]);

  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);
  const [q, setQ] = useState('');
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPo, setFilterPo] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  // Printer status
  const [printerStatus, setPrinterStatus] = useState('offline');
  const [printerName, setPrinterName] = useState('');
  const printerWsRef = useRef(null);

  // Counter
  const [nextCodeNum, setNextCodeNum] = useState(BASE_CODE);

  // Packet Location Breakdown State ('same' | 'multiple')
  const [locationMode, setLocationMode] = useState('same');
  const [locationGroups, setLocationGroups] = useState([
    { location: '', count: 1 }
  ]);

  // Pure Manual Inward Form (Direct Quantity Input, No Weight Machinery)
  const [form, setForm] = useState({
    materialName: '',
    materialCode: `MT${BASE_CODE}`,
    category: '',
    unit: 'Pcs',
    pieces: '',
    packets: '1',
    supplier: '',
    lotNo: '',
    qrCode: '',
    poNumber: '',
    invoiceNo: '',
    storeLocation: '',
    storeIncharge: currentUser?.name || 'Pooja',
    remarks: '',
  });

  const [metadataFlash, setMetadataFlash] = useState(false);

  // Inward PO Requirement, Duplicate Bill & 3% Tolerance State
  const [inwardCheck, setInwardCheck] = useState(null);
  const [checkingInward, setCheckingInward] = useState(false);
  const [approvalModal, setApprovalModal] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const numPieces = parseInt(form.pieces, 10) || 0;

  // Live Inward Pre-Check Effect
  useEffect(() => {
    let active = true;
    const po = (form.poNumber || '').trim();
    const mat = (form.materialName || '').trim();
    const sup = (form.supplier || '').trim();
    const inv = (form.invoiceNo || '').trim();
    const pcs = numPieces;

    if (!po && !mat && !sup && !inv) {
      setInwardCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingInward(true);
        const res = await fetch(`${getBackendUrl()}/api/inward/check-eligibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poNumber: po,
            materialName: mat,
            supplier: sup,
            invoiceNo: inv,
            incomingQty: pcs
          })
        });
        const data = await res.json();
        if (active && data.success) {
          setInwardCheck(data);
        }
      } catch (err) {
        console.warn('Inward eligibility check failed:', err);
      } finally {
        if (active) setCheckingInward(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.poNumber, form.materialName, form.supplier, form.invoiceNo, numPieces]);

  const areDetailsFilled = () => {
    return (
      (form.materialName || '').trim() !== '' &&
      (form.category || '').trim() !== '' &&
      (form.supplier || '').trim() !== '' &&
      (form.poNumber || '').trim() !== '' &&
      (form.invoiceNo || '').trim() !== '' &&
      (form.storeLocation || '').trim() !== '' &&
      (form.storeIncharge || '').trim() !== '' &&
      numPieces > 0
    );
  };

  const getPacketLocationForIndex = (packetNo) => {
    if (locationMode === 'same' || !locationGroups || locationGroups.length === 0) {
      return form.storeLocation || 'Main Store';
    }
    let offset = 0;
    for (const group of locationGroups) {
      const cnt = parseInt(group.count, 10) || 0;
      if (packetNo > offset && packetNo <= offset + cnt) {
        return group.location.trim() || form.storeLocation || 'Main Store';
      }
      offset += cnt;
    }
    return form.storeLocation || 'Main Store';
  };

  const getCombinedLocationSummary = () => {
    if (locationMode === 'same' || !locationGroups || locationGroups.length === 0) {
      return form.storeLocation || 'Main Store';
    }
    const parts = locationGroups
      .filter(g => g.location.trim() && parseInt(g.count, 10) > 0)
      .map(g => `${g.location.trim()} (${g.count} pkt${parseInt(g.count, 10) > 1 ? 's' : ''})`);
    return parts.length > 0 ? parts.join(', ') : (form.storeLocation || 'Main Store');
  };

  // Fetch captures log and highest material code from DB on mount
  useEffect(() => {
    fetch(`${getBackendUrl()}/api/weight-capture`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data && res.data.length > 0) {
          const dbCaptures = res.data.map(item => ({
            id: item.id,
            materialCode: item.materialCode,
            time: item.capturedAt ? new Date(item.capturedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00',
            date: item.capturedAt ? new Date(item.capturedAt).toLocaleDateString('en-IN') : '',
            po: item.poNumber || 'N/A',
            material: item.materialName,
            category: item.category || '',
            weight: item.grossWeightKg ? item.grossWeightKg.toFixed(3) : '0.000',
            netWeightKg: item.netWeightKg || 0,
            pieces: item.pieces || 0,
            packets: item.packets || 1,
            unit: item.unit || 'Pcs',
            barcodeId: item.barcodeId || '',
            invoiceNo: item.invoiceNo || 'N/A',
            location: item.storeLocation || 'Main Store',
            operator: item.storeIncharge || 'Pooja',
            entryMode: (item.entryMode === 'Manual' || item.entryMode === 'Manually' || item.status === 'Manual' || item.status === 'Manually') ? 'Manually' : 'Weight Machine',
            status: (item.entryMode === 'Manual' || item.entryMode === 'Manually' || item.status === 'Manual' || item.status === 'Manually') ? 'Manually' : 'Weight Machine',
            approvalStatus: item.approvalStatus || 'Approved'
          }));
          setCaptures(dbCaptures);

          const nums = res.data
            .map(row => parseMTNum(row.materialCode))
            .filter(n => !isNaN(n));
          if (nums.length > 0) {
            const highest = Math.max(...nums);
            const next = highest + 1;
            setNextCodeNum(next);
            setForm(p => ({ ...p, materialCode: `MT${next}` }));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Printer connection check
  const connectPrinter = () => {
    if (printerWsRef.current && printerWsRef.current.readyState === WebSocket.OPEN) {
      printerWsRef.current.close();
    }
    setPrinterStatus('connecting');
    setPrinterName('');
    try {
      const ws = new WebSocket('ws://localhost:8765');
      printerWsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'auth_success') {
          ws.send(JSON.stringify({ type: 'status' }));
        } else if (msg.type === 'status') {
          setPrinterStatus('online');
          setPrinterName(msg.printerName || 'USB Printer');
          ws.close();
        } else if (msg.type === 'auth_failed') {
          setPrinterStatus('offline');
          ws.close();
        }
      };
      ws.onerror = () => setPrinterStatus('offline');
      ws.onclose = () => { if (printerStatus === 'connecting') setPrinterStatus('offline'); };
    } catch (_) {
      setPrinterStatus('offline');
    }
  };

  useEffect(() => {
    connectPrinter();
    const interval = setInterval(connectPrinter, 15000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAutoFillDemo = () => {
    const loc = generatedLocations[0]?.code || 'Hall 1 - Rack 1';
    setForm(prev => ({
      ...prev,
      materialName: 'YKK #5 Brass Zipper 28"',
      category: 'ZIPPERS / TRIMS',
      supplier: 'YKK India Pvt Ltd',
      poNumber: 'PO-2026-008',
      invoiceNo: 'INV-99214',
      storeLocation: loc,
      storeIncharge: currentUser?.name || 'Pooja',
      pieces: '3000',
      packets: '10',
      unit: 'Pcs',
      remarks: 'Manual Raw Material Inward Entry'
    }));
    showToast('✨ Sample manual metadata & quantity autofilled!');
  };

  const handleSaveClick = () => {
    if (!areDetailsFilled()) {
      showToast('⚠️ Please fill in all required metadata fields and a valid quantity before saving!', 'error');
      setMetadataFlash(true);
      setTimeout(() => setMetadataFlash(false), 2000);
      return;
    }

    if (inwardCheck && inwardCheck.requiresApproval) {
      setApprovalModal(true);
      return;
    }

    setSaveDialog(true);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const totalPackets = parseInt(form.packets, 10) || 1;
      const totalPieces = parseInt(form.pieces, 10) || 0;
      const barcodeId = `${form.materialCode}-A${String(totalPackets).padStart(2, '0')}`;
      const finalLocation = getCombinedLocationSummary();

      const newEntry = {
        id: captures.length + 1,
        materialCode: form.materialCode,
        time: now.toTimeString().slice(0, 8),
        date: now.toLocaleDateString('en-IN'),
        po: form.poNumber || 'N/A',
        material: form.materialName,
        weight: '0.000',
        netWeightKg: 0,
        pieces: totalPieces,
        packets: totalPackets,
        unit: form.unit,
        barcodeId,
        invoiceNo: form.invoiceNo || 'N/A',
        location: finalLocation,
        operator: form.storeIncharge || currentUser?.name || 'Operator',
        entryMode: 'Manually',
        status: 'Manually',
      };

      setCaptures(prev => [newEntry, ...prev]);
      setSaving(false);
      setSaveDialog(false);

      const nextNum = nextCodeNum + 1;
      setNextCodeNum(nextNum);
      setForm(p => ({ ...p, pieces: '', packets: '1', remarks: '', materialCode: `MT${nextNum}` }));

      showToast(`✅ Manual Material Inward Saved: ${totalPieces.toLocaleString()} ${form.unit}`);

      // Save into MySQL table weight_capture (weight fields zeroed out cleanly)
      fetch(`${getBackendUrl()}/api/weight-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialCode: form.materialCode,
          materialName: form.materialName,
          unit: form.unit,
          category: form.category,
          supplier: form.supplier,
          lotNo: form.lotNo,
          poNumber: form.poNumber,
          invoiceNo: form.invoiceNo,
          storeLocation: finalLocation,
          storeIncharge: form.storeIncharge,
          grossWeightKg: 0,
          tareWeightKg: 0,
          netWeightKg: 0,
          weightPerPieceG: 0,
          sampleQty: 0,
          sampleWeightKg: 0,
          pieces: totalPieces,
          packets: totalPackets,
          barcodeId: barcodeId,
          entryMode: 'Manually',
          status: 'Manually',
          approvalStatus: 'Approved',
          remarks: form.remarks,
        })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success && res.id) {
            setCaptures(prev => prev.map(item => item.materialCode === newEntry.materialCode ? { ...item, id: res.id } : item));
          }
        })
        .catch(() => {});

      // Send to print service if online
      if (printerStatus === 'online') {
        try {
          const pws = new WebSocket('ws://localhost:8765');
          let nextPkt = 1;
          const sendNext = () => {
            if (nextPkt > totalPackets) { pws.close(); return; }
            const pktLoc = getPacketLocationForIndex(nextPkt);
            const pktBarcodeId = `${form.materialCode}-A${String(nextPkt).padStart(2, '0')}`;
            pws.send(JSON.stringify({
              type: 'print_accessory',
              data: {
                cmp: form.supplier || 'Vendor',
                materialName: form.materialName,
                materialCode: form.materialCode,
                category: form.category,
                weight: `N/A (Manual)`,
                pieces: String(totalPieces),
                unit: form.unit,
                operator: form.storeIncharge,
                poNumber: form.poNumber,
                billNo: form.invoiceNo,
                totalPackets,
                barcodeId: pktBarcodeId,
                location: pktLoc,
                packetNo: nextPkt,
                date: now.toLocaleDateString('en-GB')
              }
            }));
            nextPkt++;
          };
          pws.onopen = () => {
            pws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
          };
          pws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'auth_success') sendNext();
            else if (msg.type === 'print_accessory_result' && msg.success) {
              if (nextPkt > totalPackets) pws.close();
              else sendNext();
            }
          };
        } catch (_) {}
      }
    }, 400);
  };

  const handleSubmitApprovalRequest = async () => {
    try {
      setApprovalSubmitting(true);
      const totalPackets = parseInt(form.packets, 10) || 1;
      const totalPieces = parseInt(form.pieces, 10) || 0;
      const finalLocation = getCombinedLocationSummary();
      const barcodeId = `${form.materialCode}-A${String(totalPackets).padStart(2, '0')}`;
      const reasonStr = (inwardCheck?.reasons || ['Incoming quantity exceeds PO requirement']).join(' | ');

      const newEntry = {
        id: captures.length + 1,
        materialCode: form.materialCode,
        time: now.toTimeString().slice(0, 8),
        date: now.toLocaleDateString('en-IN'),
        po: form.poNumber || 'N/A',
        material: form.materialName,
        weight: '0.000',
        netWeightKg: 0,
        pieces: totalPieces,
        packets: totalPackets,
        unit: form.unit,
        barcodeId,
        invoiceNo: form.invoiceNo || 'N/A',
        location: finalLocation,
        operator: form.storeIncharge || currentUser?.name || 'Operator',
        entryMode: 'Manually',
        status: 'Pending Approval',
        approvalStatus: 'Pending Approval',
        remarks: `[Awaiting Excess Approval: ${reasonStr}] ${form.remarks || ''}`
      };

      setCaptures(prev => [newEntry, ...prev]);

      const captureRes = await fetch(`${getBackendUrl()}/api/weight-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialCode: form.materialCode,
          materialName: form.materialName,
          unit: form.unit,
          category: form.category,
          supplier: form.supplier,
          lotNo: form.lotNo,
          poNumber: form.poNumber,
          invoiceNo: form.invoiceNo,
          storeLocation: finalLocation,
          storeIncharge: form.storeIncharge,
          grossWeightKg: 0,
          tareWeightKg: 0,
          netWeightKg: 0,
          weightPerPieceG: 0,
          sampleQty: 0,
          sampleWeightKg: 0,
          pieces: totalPieces,
          packets: totalPackets,
          barcodeId: barcodeId,
          entryMode: 'Manually',
          status: 'Pending Approval',
          approvalStatus: 'Pending Approval',
          remarks: `[Awaiting Excess Approval: ${reasonStr}] ${form.remarks || ''}`
        })
      });
      const captureData = await captureRes.json();
      if (captureData.success && captureData.id) {
        setCaptures(prev => prev.map(item => item.materialCode === newEntry.materialCode ? { ...item, id: captureData.id } : item));
      }

      // Submit to approval requests
      const payload = {
        id: `INW-${Date.now()}`,
        type: 'inward_approval',
        status: 'pending',
        requesterName: currentUser?.name || form.storeIncharge || 'Store Operator',
        requesterRole: currentUser?.role || 'Store',
        date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        lotId: form.lotNo || form.poNumber || 'N/A',
        pieces: totalPieces,
        personName: form.storeIncharge || currentUser?.name || 'Operator',
        materialId: form.materialCode,
        materialName: form.materialName,
        reason: reasonStr,
        items: [{
          captureId: captureData?.id || null,
          materialCode: form.materialCode,
          materialName: form.materialName,
          unit: form.unit,
          category: form.category,
          supplier: form.supplier,
          lotNo: form.lotNo,
          poNumber: form.poNumber,
          invoiceNo: form.invoiceNo,
          poQty: inwardCheck?.orderedQty || inwardCheck?.remainingQty || 0,
          orderedQty: inwardCheck?.orderedQty || inwardCheck?.remainingQty || 0,
          remainingQty: inwardCheck?.remainingQty || 0,
          storeLocation: finalLocation,
          storeIncharge: form.storeIncharge,
          grossWeightKg: 0,
          tareWeightKg: 0,
          netWeightKg: 0,
          weightPerPieceG: 0,
          sampleQty: 0,
          sampleWeightKg: 0,
          pieces: totalPieces,
          packets: totalPackets,
          barcodeId: barcodeId,
          entryMode: 'Manually',
          remarks: form.remarks || ''
        }]
      };

      await fetch(`${getBackendUrl()}/api/approval-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const nextNum = nextCodeNum + 1;
      setNextCodeNum(nextNum);
      setForm(p => ({ ...p, pieces: '', packets: '1', remarks: '', materialCode: `MT${nextNum}` }));

      showToast('⚠️ Excess Inward logged as Pending Approval.', 'success');
      setApprovalModal(false);
      handleClear();
    } catch (err) {
      showToast('Failed to submit approval request: ' + err.message, 'error');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleClear = () => {
    setForm(prev => ({
      ...prev,
      materialName: '',
      supplier: '',
      poNumber: '',
      invoiceNo: '',
      pieces: '',
      packets: '1',
      remarks: ''
    }));
    showToast('Cleared inputs.', 'info');
  };

  const handleSort = (col) => {
    setOrderBy(col);
    setOrder(o => orderBy === col ? (o === 'asc' ? 'desc' : 'asc') : 'asc');
  };

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const downloadCSV = () => {
    if (filteredCaptures.length === 0) {
      showToast('No log data available to export.', 'error');
      return;
    }
    const csvHeaders = [
      'ID', 'Material Code', 'Date', 'Time', 'PO Number', 'Material Name',
      'Quantity (Pieces)', 'Packets', 'Unit', 'Barcode ID', 'Invoice Number',
      'Location', 'Operator', 'Status'
    ];
    const csvRows = filteredCaptures.map(row => [
      row.id,
      row.materialCode || '',
      row.date || '',
      row.time || '',
      row.po || '',
      row.material || '',
      row.pieces ?? '',
      row.packets ?? '',
      row.unit || '',
      row.barcodeId || '',
      row.invoiceNo || '',
      row.location || '',
      row.operator || '',
      row.status || 'Manually'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Manual_Material_Inward_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Downloaded successfully!');
  };

  const isSameDate = (recordDateStr, filterDateStr) => {
    if (!filterDateStr) return true;
    if (!recordDateStr) return false;
    const [fYear, fMonth, fDay] = filterDateStr.split('-');
    const rParts = recordDateStr.split(/[\/-]/);
    if (rParts.length !== 3) return false;
    let rDay, rMonth, rYear;
    if (rParts[0].length === 4) {
      rYear = rParts[0]; rMonth = rParts[1]; rDay = rParts[2];
    } else {
      rDay = rParts[0]; rMonth = rParts[1]; rYear = rParts[2];
    }
    return (
      parseInt(rYear, 10) === parseInt(fYear, 10) &&
      parseInt(rMonth, 10) === parseInt(fMonth, 10) &&
      parseInt(rDay, 10) === parseInt(fDay, 10)
    );
  };

  const filterOptions = useMemo(() => {
    const categories = new Set();
    const pos = new Set();
    const locations = new Set();
    const operators = new Set();

    captures.forEach(c => {
      if (c.category) categories.add(c.category);
      if (c.po && c.po !== 'N/A') pos.add(c.po);
      if (c.location) locations.add(c.location);
      if (c.operator) operators.add(c.operator);
    });

    return {
      categories: Array.from(categories).sort(),
      pos: Array.from(pos).sort(),
      locations: Array.from(locations).sort(),
      operators: Array.from(operators).sort()
    };
  }, [captures]);

  const filteredCaptures = useMemo(() => {
    const ql = q.toLowerCase();
    return captures
      .filter(r => {
        const matchesQ = !ql ||
          (r.material && r.material.toLowerCase().includes(ql)) ||
          (r.po && r.po.toLowerCase().includes(ql)) ||
          (r.operator && r.operator.toLowerCase().includes(ql)) ||
          (r.status && r.status.toLowerCase().includes(ql)) ||
          (r.materialCode && r.materialCode.toLowerCase().includes(ql));

        const matchesCategory = !filterCategory || (r.category && r.category.toLowerCase() === filterCategory.toLowerCase());
        const matchesPo = !filterPo || r.po === filterPo;
        const matchesLocation = !filterLocation || r.location === filterLocation;
        const matchesOperator = !filterOperator || r.operator === filterOperator;
        const matchesDate = !filterDate || isSameDate(r.date, filterDate);

        return matchesQ && matchesCategory && matchesPo && matchesLocation && matchesOperator && matchesDate;
      })
      .sort((a, b) => {
        let av = a[orderBy] ?? '', bv = b[orderBy] ?? '';
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return order === 'asc' ? -1 : 1;
        if (av > bv) return order === 'asc' ? 1 : -1;
        return 0;
      });
  }, [captures, q, orderBy, order, filterCategory, filterPo, filterLocation, filterOperator, filterDate]);

  const paginatedData = useMemo(() => {
    const start = page * rpp;
    return filteredCaptures.slice(start, start + rpp);
  }, [filteredCaptures, page, rpp]);

  const totalPages = Math.ceil(filteredCaptures.length / rpp) || 1;

  return (
    <div className="page-container" style={{ padding: '16px', maxWidth: '100%', fontFamily: "'Times New Roman', Times, serif" }}>
      <style>{`
        .page-container {
          padding: 16px !important;
        }
        .page-container, .page-container *, .wcs-input, .wcs-textarea, .wcs-label, table, th, td, button, select, input, textarea {
          font-family: 'Times New Roman', Times, serif !important;
        }
        .wcs-input {
          padding: 10px 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .wcs-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
          background: #ffffff;
        }
        .wcs-textarea {
          padding: 10px 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: all 0.2s ease;
          resize: vertical;
          min-height: 64px;
        }
        .wcs-textarea:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
          background: #ffffff;
        }
        .wcs-label {
          font-size: 12px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          display: block;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }
      `}</style>

      {/* Toast popup */}
      {toastMessage && (
        <div className="notification-toast animate-scale" style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1200 }}>
          {toastType === 'success' ? <CheckCircle2 style={{ color: '#10b981' }} /> : <AlertTriangle style={{ color: '#ef4444' }} />}
          <div className="notification-content">
            <div className="notification-title" style={{ color: toastType === 'success' ? '#10b981' : '#ef4444' }}>
              {toastType.toUpperCase()}
            </div>
            <div className="notification-body">{toastMessage}</div>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="panel" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--accent-color)', color: '#fff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>Material Add</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manual Raw Material Inward Register</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
              {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--text-main)' }}>{now.toTimeString().slice(0, 8)}</span>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-color)', height: '24px' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: '#3b82f6', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px' }}>M</div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Operator</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>{currentUser?.name || 'Pooja'}</span>
            </div>
          </div>

          {/* Mode Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#2563eb',
            border: '1.5px solid rgba(59, 130, 246, 0.25)', fontWeight: '700', fontSize: '12px'
          }}>
            <Edit3 size={14} />
            <span>Manual Inward</span>
          </div>

          {/* Printer Status Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px',
            backgroundColor: printerStatus === 'online'
              ? 'rgba(16,185,129,0.1)'
              : printerStatus === 'connecting'
                ? 'rgba(251,191,36,0.1)'
                : 'rgba(239,68,68,0.1)',
            color: printerStatus === 'online' ? '#10b981'
              : printerStatus === 'connecting' ? '#f59e0b'
                : '#ef4444',
            border: `1.5px solid ${printerStatus === 'online' ? 'rgba(16,185,129,0.25)'
              : printerStatus === 'connecting' ? 'rgba(251,191,36,0.25)'
                : 'rgba(239,68,68,0.25)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
            onClick={connectPrinter}
            title={printerStatus === 'online' ? `Default Printer: ${printerName || 'USB Printer'} (Click to reconnect)` : 'Click to connect print service'}
          >
            <Printer size={14} />
            <span>{printerStatus === 'connecting' ? 'Connecting...' : (printerStatus === 'online' ? (printerName || 'USB Printer Connected') : 'Printer Offline')}</span>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh Page"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '6px',
              border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)',
              color: 'var(--text-main)', cursor: 'pointer', transition: 'all 0.2s ease', padding: 0
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── WORKFLOW INSTRUCTIONS BANNER ── */}
      <div className="panel" style={{
        padding: '20px 24px', borderRadius: '12px', border: '1.5px solid var(--border-color)',
        marginBottom: '20px', background: 'var(--bg-secondary)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-main)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📋 Operating Instructions: Step-by-Step Manual Inward Workflow
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Step 1 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${areDetailsFilled() ? '#10b981' : 'var(--border-color)'}`,
            background: areDetailsFilled() ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: areDetailsFilled() ? '#10b981' : 'var(--accent-color)', color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>1</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Fill Metadata Details</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Enter material name, PO number, bill/invoice, and supplier.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${numPieces > 0 ? '#10b981' : 'var(--border-color)'}`,
            background: numPieces > 0 ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: numPieces > 0 ? '#10b981' : 'var(--accent-color)', color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>2</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Enter Quantity & Packets</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Directly input total quantity / pieces and total packet count.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${(form.storeLocation || '').trim() ? '#10b981' : 'var(--border-color)'}`,
            background: (form.storeLocation || '').trim() ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: (form.storeLocation || '').trim() ? '#10b981' : 'var(--accent-color)', color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>3</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Assign Warehouse Rack</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Select warehouse location slot for material placement.
            </p>
          </div>

          {/* Step 4 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: '1.5px solid var(--border-color)',
            background: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: 'var(--accent-color)', color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>4</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Save & Print Add</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Click <strong>Save & Print Material Add</strong> to store in database.
            </p>
          </div>
        </div>
      </div>

      {/* ── MANUAL MATERIAL ENTRY FORM (NO WEIGHT FIELDS) ── */}
      <div className="panel" style={{
        margin: '0 0 24px 0',
        padding: '28px',
        borderRadius: '12px',
        border: metadataFlash ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
        boxShadow: metadataFlash ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 4px 16px rgba(0,0,0,0.05)',
        transform: metadataFlash ? 'scale(1.005)' : 'scale(1)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={22} style={{ color: '#3b82f6' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                Manual Raw Material Inward Details
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Enter material specifications and incoming item count directly</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoFillDemo}
            style={{
              padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '800',
              border: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            ⚡ Autofill Demo Details
          </button>
        </div>

        {/* Live PO Requirement, Duplicate Invoice & 3% Tolerance Status Card */}
        {inwardCheck && (
          <div style={{
            marginBottom: '20px',
            padding: '14px 16px',
            borderRadius: '10px',
            background: inwardCheck.requiresApproval
              ? 'rgba(239, 68, 68, 0.06)'
              : (inwardCheck.poFound ? 'rgba(16, 185, 129, 0.06)' : 'rgba(99, 102, 241, 0.05)'),
            border: `1.5px solid ${inwardCheck.requiresApproval ? '#ef4444' : (inwardCheck.poFound ? '#10b981' : '#cbd5e1')}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: inwardCheck.requiresApproval ? '#dc2626' : (inwardCheck.poFound ? '#059669' : '#4f46e5')
                }}>
                  {inwardCheck.requiresApproval ? '⚠️ Admin Approval Required' : (inwardCheck.poFound ? '✅ PO Requirement Verified' : 'ℹ️ Inward Pre-Check')}
                </span>
                {checkingInward && <span style={{ fontSize: '11px', color: '#64748b' }}>Checking database...</span>}
              </div>
              {inwardCheck.poFound && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                  Matched PO #{form.poNumber}
                </span>
              )}
            </div>

            {inwardCheck.poFound ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: inwardCheck.reasons?.length ? '10px' : '0' }}>
                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>ORDERED QTY</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{inwardCheck.orderedQty.toLocaleString()} Pcs</div>
                </div>
                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>ALREADY RECEIVED</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#059669' }}>{inwardCheck.receivedQty.toLocaleString()} Pcs</div>
                </div>
                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>REMAINING NEEDED</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: inwardCheck.remainingQty <= 0 ? '#ef4444' : '#2563eb' }}>
                    {inwardCheck.remainingQty?.toLocaleString()} Pcs
                  </div>
                </div>
                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>INCOMING MANUAL QTY</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: inwardCheck.isExcess ? '#dc2626' : '#0f172a' }}>
                    {numPieces.toLocaleString()} Pcs {inwardCheck.isExcess && `(+${inwardCheck.excessPercent}%)`}
                  </div>
                </div>
              </div>
            ) : (
              form.poNumber && (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  PO #{form.poNumber} not found in database. Entry will be received as Ad-hoc / New stock.
                </div>
              )
            )}

            {inwardCheck.reasons && inwardCheck.reasons.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                {inwardCheck.reasons.map((r, rIdx) => (
                  <div key={rIdx} style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚠️</span> {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

          <div className="form-group">
            <label className="wcs-label">Material Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.materialName}
              onChange={setF('materialName')}
              placeholder="e.g. YKK Brass Zipper"
              style={{ height: '40px' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">Material Code (Auto) <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.materialCode}
              onChange={setF('materialCode')}
              style={{ height: '40px', fontFamily: 'monospace', fontWeight: '900', backgroundColor: '#f8fafc' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">Category <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.category}
              onChange={setF('category')}
              placeholder="e.g. ZIPPERS / TRIMS"
              style={{ height: '40px' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">Supplier / Vendor <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.supplier}
              onChange={setF('supplier')}
              placeholder="e.g. CMF Fabric Ltd"
              style={{ height: '40px' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">PO Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.poNumber}
              onChange={setF('poNumber')}
              placeholder="e.g. PO-0007"
              style={{ height: '40px' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">Bill / Invoice Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.invoiceNo}
              onChange={setF('invoiceNo')}
              placeholder="e.g. BILL-9921"
              style={{ height: '40px' }}
            />
          </div>

          {/* Direct Total Quantity Input */}
          <div className="form-group" style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '12px', borderRadius: '8px', border: '1.5px solid #bfdbfe' }}>
            <label className="wcs-label" style={{ color: '#1d4ed8', fontWeight: '900' }}>
              Total Quantity / Pieces <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              min="1"
              className="wcs-input"
              value={form.pieces}
              onChange={setF('pieces')}
              placeholder="e.g. 3000"
              style={{ height: '42px', fontSize: '16px', fontWeight: '900', color: '#1d4ed8' }}
            />
          </div>

          {/* Packets & Unit Selection */}
          <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="wcs-label">Total Packets <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number"
                  min="1"
                  className="wcs-input"
                  value={form.packets}
                  onChange={setF('packets')}
                  placeholder="1"
                  style={{ height: '42px', fontWeight: '800' }}
                />
              </div>
              <div>
                <label className="wcs-label">Unit of Measure</label>
                <select
                  className="wcs-input"
                  value={form.unit}
                  onChange={setF('unit')}
                  style={{ height: '42px', cursor: 'pointer', fontWeight: '800' }}
                >
                  {['Pcs', 'Mtr', 'Kg', 'Gm', 'Pair', 'Cone', 'Roll', 'Set', 'Doz', 'Box', 'Pkt', 'Bundle', 'Yds', 'Cm', 'Inch'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="wcs-label">Location Slot <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              required
              className="wcs-input"
              value={form.storeLocation}
              onChange={setF('storeLocation')}
              style={{ height: '40px', cursor: 'pointer' }}
            >
              <option value="">-- Select Configured Location Slot --</option>
              {generatedLocations.map(loc => (
                <option key={loc.code} value={loc.code}>{loc.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="wcs-label">Store Incharge / Authorized Person <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="wcs-input"
              value={form.storeIncharge}
              onChange={setF('storeIncharge')}
              placeholder="e.g. Pooja"
              style={{ height: '40px' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="wcs-label">Remarks / Operational Notes</label>
            <textarea
              className="wcs-textarea"
              value={form.remarks}
              onChange={setF('remarks')}
              placeholder="Add operational notes here..."
              style={{ height: '56px' }}
            />
          </div>

        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-secondary"
            style={{ padding: '12px 20px', fontWeight: '800' }}
          >
            Clear Form
          </button>

          <button
            type="button"
            onClick={handleSaveClick}
            style={{
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '800',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <CheckCircle2 size={19} /> Save & Print Material Add
          </button>
        </div>
      </div>

      {/* ── RECENT MANUAL INWARD LOGS TABLE ── */}
      <div className="panel" style={{ padding: '24px', borderRadius: '12px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', background: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Menu size={20} style={{ color: '#334155' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>
              Recent Inward Logs (weight_capture)
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                className="wcs-input"
                placeholder="Search logs..."
                value={q}
                onChange={e => { setQ(e.target.value); setPage(0); }}
                style={{ paddingLeft: '36px', height: '38px', width: '220px', fontSize: '13px' }}
              />
            </div>
            <button
              style={{
                border: showFilters ? '1.5px solid #3b82f6' : '1.5px solid #cbd5e1',
                padding: '8px',
                borderRadius: '8px',
                background: showFilters ? 'rgba(59, 130, 246, 0.08)' : '#ffffff',
                cursor: 'pointer',
                color: showFilters ? '#3b82f6' : '#475569',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={() => setShowFilters(!showFilters)}
              title="Toggle Filters"
            >
              <Filter size={16} />
            </button>
            <button
              style={{
                border: '1.5px solid #cbd5e1',
                padding: '8px',
                borderRadius: '8px',
                background: '#ffffff',
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={downloadCSV}
              title="Download CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <label className="wcs-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Category</label>
              <select
                className="wcs-input"
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); setPage(0); }}
                style={{ height: '36px', fontSize: '13px', cursor: 'pointer', padding: '6px 10px' }}
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="wcs-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>PO Number</label>
              <select
                className="wcs-input"
                value={filterPo}
                onChange={e => { setFilterPo(e.target.value); setPage(0); }}
                style={{ height: '36px', fontSize: '13px', cursor: 'pointer', padding: '6px 10px' }}
              >
                <option value="">All POs</option>
                {filterOptions.pos.map(po => (
                  <option key={po} value={po}>{po}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="wcs-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Location</label>
              <select
                className="wcs-input"
                value={filterLocation}
                onChange={e => { setFilterLocation(e.target.value); setPage(0); }}
                style={{ height: '36px', fontSize: '13px', cursor: 'pointer', padding: '6px 10px' }}
              >
                <option value="">All Locations</option>
                {filterOptions.locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="wcs-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Operator</label>
              <select
                className="wcs-input"
                value={filterOperator}
                onChange={e => { setFilterOperator(e.target.value); setPage(0); }}
                style={{ height: '36px', fontSize: '13px', cursor: 'pointer', padding: '6px 10px' }}
              >
                <option value="">All Operators</option>
                {filterOptions.operators.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="wcs-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Date</label>
              <input
                type="date"
                className="wcs-input"
                value={filterDate}
                onChange={e => { setFilterDate(e.target.value); setPage(0); }}
                style={{ height: '36px', fontSize: '13px', padding: '6px 10px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setFilterCategory('');
                  setFilterPo('');
                  setFilterLocation('');
                  setFilterOperator('');
                  setFilterDate('');
                  setPage(0);
                }}
                style={{
                  height: '36px', width: '100%', border: '1.5px solid #cbd5e1', borderRadius: '8px',
                  background: '#ffffff', color: '#ef4444', cursor: 'pointer', fontWeight: '700', fontSize: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '10px' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {[
                  ['# / CODE', 'materialCode'],
                  ['TIME', 'time'],
                  ['PO NUMBER', 'po'],
                  ['MATERIAL NAME', 'material'],
                  ['QUANTITY (PIECES)', 'pieces'],
                  ['PACKETS', 'packets'],
                  ['LOCATION', 'location'],
                  ['STATUS', 'status'],
                  ['ACTIONS', null]
                ].map(([col, field]) => (
                  <th
                    key={col}
                    style={{
                      padding: '14px 16px', color: '#64748b', fontSize: '11px', fontWeight: '800',
                      textTransform: 'uppercase', letterSpacing: '0.6px', cursor: field ? 'pointer' : 'default',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => field && handleSort(field)}
                  >
                    {col} {orderBy === field && (order === 'asc' ? '▲' : '▼')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontWeight: '600' }}>No inward logs found in database.</td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <React.Fragment key={row.id}>
                    <tr style={{
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease'
                    }}>
                      {/* # / CODE */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '900', color: '#3b82f6', fontSize: '13px' }}>#{row.id}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', fontFamily: 'monospace', marginTop: '2px' }}>{row.materialCode}</div>
                      </td>

                      {/* TIME */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '12.5px', fontFamily: 'monospace' }}>{row.time}</div>
                        {row.date && <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>{row.date}</div>}
                      </td>

                      {/* PO NUMBER */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: '6px',
                          background: '#ede9fe', color: '#6d28d9', fontWeight: '800', fontSize: '11.5px',
                          border: '1px solid rgba(109, 40, 217, 0.15)'
                        }}>
                          {row.po}
                        </span>
                      </td>

                      {/* MATERIAL NAME */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>{row.material}</div>
                        {row.barcodeId && (
                          <div style={{ marginTop: '3px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '2px 7px', borderRadius: '4px', background: '#e0e7ff',
                              color: '#4338ca', fontSize: '10.5px', fontWeight: '800', fontFamily: 'monospace'
                            }}>
                              🏷️ {row.barcodeId}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* QUANTITY */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '900', color: '#2563eb', fontSize: '15px' }}>
                          {row.pieces.toLocaleString()} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>{row.unit || 'Pcs'}</span>
                        </div>
                      </td>

                      {/* PACKETS */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          padding: '3px 8px', borderRadius: '4px', background: '#f3e8ff',
                          color: '#7e22ce', fontSize: '11.5px', fontWeight: '800'
                        }}>
                          📦 {row.packets} Packets
                        </span>
                      </td>

                      {/* LOCATION */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '800', color: '#0f172a', fontSize: '12px' }}>
                          <MapPin size={13} style={{ color: '#6366f1' }} /> {row.location}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', fontWeight: '700', marginTop: '3px' }}>
                          <User size={12} style={{ color: '#94a3b8' }} /> {row.operator}
                        </div>
                      </td>

                      {/* STATUS (MANUALLY OR WEIGHT MACHINE) */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '800',
                          backgroundColor: (row.status === 'Manually' || row.status === 'Manual' || row.entryMode === 'Manually' || row.entryMode === 'Manual') ? '#eff6ff' : '#f0fdf4',
                          color: (row.status === 'Manually' || row.status === 'Manual' || row.entryMode === 'Manually' || row.entryMode === 'Manual') ? '#2563eb' : '#059669',
                          border: `1px solid ${(row.status === 'Manually' || row.status === 'Manual' || row.entryMode === 'Manually' || row.entryMode === 'Manual') ? '#bfdbfe' : '#bbf7d0'}`
                        }}>
                          {(row.status === 'Manually' || row.status === 'Manual' || row.entryMode === 'Manually' || row.entryMode === 'Manual') ? '📝 Manually' : '⚖️ Weight Machine'}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                            borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                            border: '1.5px solid #cbd5e1', color: '#0f172a', background: '#ffffff',
                            cursor: 'pointer', transition: 'all 0.15s'
                          }}
                        >
                          {expandedRow === row.id ? <><ChevronDown size={14} /> Hide</> : <><ChevronRight size={14} /> Details</>}
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDED ROW DETAILS */}
                    {expandedRow === row.id && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan="9" style={{ padding: '16px 20px', borderBottom: '2px solid #e2e8f0' }}>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px',
                            background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1.5px solid #cbd5e1'
                          }}>
                            <div>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                📦 Item Inward Summary
                              </span>
                              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><strong style={{ color: '#64748b' }}>Material:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.material}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Total Quantity:</strong> <span style={{ fontWeight: '800', color: '#2563eb' }}>{row.pieces.toLocaleString()} {row.unit || 'Pcs'}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Total Packets:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.packets || 1} packet(s)</span></div>
                                <div><strong style={{ color: '#64748b' }}>Inward Method:</strong> <span style={{ fontWeight: '800', color: '#2563eb' }}>{row.entryMode || 'Manually'}</span></div>
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                🏷️ Procurement Reference
                              </span>
                              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><strong style={{ color: '#64748b' }}>PO Number:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.po}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Invoice / Bill:</strong> <span style={{ fontWeight: '700', color: '#0f172a' }}>{row.invoiceNo || 'N/A'}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Barcode ID:</strong> <span style={{ fontWeight: '800', color: '#4338ca', fontFamily: 'monospace' }}>{row.barcodeId || 'N/A'}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Location Slot:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.location}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Showing {page * rpp + 1} to {Math.min((page + 1) * rpp, filteredCaptures.length)} of {filteredCaptures.length} entries
          </span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>Rows per page:</span>
            <select
              className="wcs-input"
              value={rpp}
              onChange={e => { setRpp(Number(e.target.value)); setPage(0); }}
              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', width: 'auto', height: '34px', border: '1px solid #cbd5e1' }}
            >
              <option value={5}>5</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="BaseBtn" style={{ padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', opacity: page === 0 ? 0.4 : 1 }}>Previous</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="BaseBtn" style={{ padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SAVE CONFIRMATION DIALOG ── */}
      {saveDialog && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="panel animate-scale" style={{ maxWidth: '480px', width: '100%', margin: '20px', padding: '24px' }}>
            <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ margin: 0 }}><Save size={18} /> Confirm Manual Material Inward</h3>
              <button onClick={() => setSaveDialog(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {[
                ['Material', form.materialName],
                ['Total Quantity', `${numPieces.toLocaleString()} ${form.unit}`],
                ['Total Packets', `${form.packets || 1} packet(s)`],
                ['PO Number', form.poNumber],
                ['Bill / Invoice', form.invoiceNo],
                ['Store Location', form.storeLocation],
                ['Inward Mode', 'Manually (No Weight Machine)'],
                ['Incharge / Operator', form.storeIncharge]
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{l}:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '800' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Packet Location Assignment */}
            <div style={{
              marginBottom: '20px',
              padding: '14px',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '8px'
            }}>
              <label style={{
                display: 'block', fontSize: '11.5px', fontWeight: '800',
                color: 'var(--text-main)', marginBottom: '10px',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                📍 Location Assignment for Packets
              </label>

              {/* Mode Selection Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setLocationMode('same');
                    const total = parseInt(form.packets, 10) || 1;
                    setLocationGroups([{ location: form.storeLocation || '', count: total }]);
                  }}
                  style={{
                    flex: 1, padding: '7px 8px', fontSize: '11px', fontWeight: '800',
                    borderRadius: '6px', cursor: 'pointer',
                    background: locationMode === 'same' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: locationMode === 'same' ? '#fff' : 'var(--text-main)',
                    border: locationMode === 'same' ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  📍 Same Location (All Packets)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationMode('multiple');
                    const total = parseInt(form.packets, 10) || 1;
                    if (locationGroups.length <= 1) {
                      setLocationGroups([
                        { location: form.storeLocation || 'hall 1 rack 2', count: Math.ceil(total / 2) },
                        { location: 'hall 2 rack 3', count: Math.floor(total / 2) || 1 }
                      ]);
                    }
                  }}
                  style={{
                    flex: 1, padding: '7px 8px', fontSize: '11px', fontWeight: '800',
                    borderRadius: '6px', cursor: 'pointer',
                    background: locationMode === 'multiple' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: locationMode === 'multiple' ? '#fff' : 'var(--text-main)',
                    border: locationMode === 'multiple' ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  🔀 Multiple Locations (Split)
                </button>
              </div>

              {locationMode === 'same' ? (
                <div>
                  <label className="wcs-label">Store Location</label>
                  <select
                    className="wcs-input"
                    value={form.storeLocation}
                    onChange={setF('storeLocation')}
                    style={{ height: '36px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    <option value="">-- Select Configured Location Slot --</option>
                    {generatedLocations.map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {locationGroups.map((grp, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Location #{idx + 1}</label>
                        <select
                          className="wcs-input"
                          value={grp.location}
                          onChange={e => {
                            const val = e.target.value;
                            setLocationGroups(prev => prev.map((g, i) => i === idx ? { ...g, location: val } : g));
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', height: '32px', cursor: 'pointer' }}
                        >
                          <option value="">-- Select Slot --</option>
                          {generatedLocations.map(loc => (
                            <option key={loc.code} value={loc.code}>{loc.code} ({loc.label.split(' - ')[0]})</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Packets</label>
                        <input
                          type="number"
                          min="1"
                          className="wcs-input"
                          value={grp.count}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setLocationGroups(prev => prev.map((g, i) => i === idx ? { ...g, count: val } : g));
                          }}
                          style={{ padding: '6px 10px', fontSize: '12px', textAlign: 'center', fontWeight: '800' }}
                        />
                      </div>
                      {locationGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLocationGroups(prev => prev.filter((_, i) => i !== idx))}
                          style={{ marginTop: '14px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="Remove location"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const total = parseInt(form.packets, 10) || 1;
                        const allocated = locationGroups.reduce((s, g) => s + (parseInt(g.count, 10) || 0), 0);
                        const remaining = Math.max(1, total - allocated);
                        setLocationGroups(prev => [...prev, { location: '', count: remaining }]);
                      }}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      + Add Location Group
                    </button>

                    {(() => {
                      const total = parseInt(form.packets, 10) || 1;
                      const allocated = locationGroups.reduce((s, g) => s + (parseInt(g.count, 10) || 0), 0);
                      return (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: allocated === total ? '#10b981' : '#f59e0b' }}>
                          {allocated === total ? `✅ ${allocated}/${total} Allocated` : `⚠️ ${allocated}/${total} Allocated`}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSaveDialog(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-success" onClick={handleSave} disabled={saving} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {saving ? <div className="Spinner"></div> : <><CheckCircle2 size={16} /> Confirm Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INWARD APPROVAL REQUIRED DIALOG ── */}
      {approvalModal && inwardCheck && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="panel animate-scale" style={{ maxWidth: '520px', width: '100%', margin: '20px', padding: '24px', border: '2px solid #ef4444', borderRadius: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={22} color="#dc2626" /> Admin Approval Required
              </h3>
              <button onClick={() => setApprovalModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: '1.5' }}>
              This manual material inward cannot be saved directly because it violates one or more procurement safety rules:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {inwardCheck.reasons.map((reason, idx) => (
                <div key={idx} style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '14px' }}>⚠️</span>
                  <div>{reason}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><span style={{ color: '#64748b' }}>Material:</span> <strong>{form.materialName}</strong></div>
                <div><span style={{ color: '#64748b' }}>PO Number:</span> <strong>{form.poNumber || 'N/A'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Supplier:</span> <strong>{form.supplier}</strong></div>
                <div><span style={{ color: '#64748b' }}>Bill / Invoice:</span> <strong>{form.invoiceNo}</strong></div>
                <div><span style={{ color: '#64748b' }}>Incoming Quantity:</span> <strong style={{ color: '#2563eb' }}>{numPieces.toLocaleString()} {form.unit}</strong></div>
                {inwardCheck.poFound && (
                  <div><span style={{ color: '#64748b' }}>Remaining Required:</span> <strong style={{ color: '#dc2626' }}>{inwardCheck.remainingQty?.toLocaleString()} Pcs</strong></div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setApprovalModal(false)} disabled={approvalSubmitting}>Cancel</button>

              {currentUser?.role === 'Admin' && (
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    setApprovalModal(false);
                    setSaveDialog(true);
                  }}
                  style={{ fontWeight: '800' }}
                >
                  ⚡ Admin Override (Save Directly)
                </button>
              )}

              <button
                className="btn btn-primary"
                onClick={handleSubmitApprovalRequest}
                disabled={approvalSubmitting}
                style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: '800' }}
              >
                {approvalSubmitting ? <div className="Spinner"></div> : <>📤 Submit to Approval Queue</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
