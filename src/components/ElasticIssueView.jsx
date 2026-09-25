import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Search, Plus, Minus, Download, Printer, RefreshCw,
  CheckCircle, AlertTriangle, Layers, X,
  Calendar, User, Scissors, Sliders
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getBackendUrl } from '../utils/api';

export default function ElasticIssueView({
  currencySymbol = '₹',
  currentUser = null,
  prefilledLotNo = '',
  setPrefilledLotNo = () => {},
  onNavigate = () => {}
}) {
  // Tab Mode: 'generator' (Issue Form) or 'history' (Past Issue Slips)
  const [viewMode, setViewMode] = useState('generator');

  // Step 1: Search Lot State
  const [searchLotInput, setSearchLotInput] = useState(prefilledLotNo || '');
  const [searchingLot, setSearchingLot] = useState(false);
  const [lotDetails, setLotDetails] = useState(null);
  const [lotError, setLotError] = useState('');
  const [recentLots, setRecentLots] = useState([]);

  // Step 2: Elastic Issue Details
  const [rollCount, setRollCount] = useState(1);
  const [elasticWidth, setElasticWidth] = useState('1 Inch (Standard)');
  const [customWidth, setCustomWidth] = useState('');
  const [selectedShade, setSelectedShade] = useState('');

  // Issuer & Receiver
  const [issuerName, setIssuerName] = useState(currentUser?.name || '');
  const [receiverName, setReceiverName] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [issueSlipNo, setIssueSlipNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Generation & Modal State
  const [generating, setGenerating] = useState(false);
  const [generatedSlipData, setGeneratedSlipData] = useState(null);
  const [toast, setToast] = useState(null);

  // History State
  const [issueHistory, setIssueHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const searchInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch next Issue Slip Number from backend
  const fetchNextIssueSlipNo = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/po-number/next/elastic_issue`);
      if (res.ok) {
        const data = await res.json();
        if (data.poNumber) {
          setIssueSlipNo(data.poNumber);
          return data.poNumber;
        }
      }
    } catch (_) {}
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const fallback = `ELASTIC-ISSUE-${randomSuffix}`;
    setIssueSlipNo(fallback);
    return fallback;
  };

  // Initialize next slip number on mount
  useEffect(() => {
    fetchNextIssueSlipNo();
    loadIssueHistory();
  }, []);

  // Auto-search lot with debounce as user types
  useEffect(() => {
    const trimmed = (searchLotInput || '').trim();
    if (!trimmed || trimmed.length < 3) {
      return;
    }
    if (lotDetails && String(lotDetails.lotNo || '').toLowerCase() === trimmed.toLowerCase()) {
      return;
    }

    const timer = setTimeout(() => {
      handleSearchLot(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchLotInput]);

  // Sync if prefilled lot passed from another view
  useEffect(() => {
    if (prefilledLotNo) {
      setSearchLotInput(prefilledLotNo);
      handleSearchLot(prefilledLotNo);
    }
  }, [prefilledLotNo]);

  // Load Issue History from backend and localStorage
  const loadIssueHistory = async () => {
    setLoadingHistory(true);
    try {
      const localSaved = localStorage.getItem('gpdms_elastic_issue_history');
      let localList = [];
      if (localSaved) {
        try { localList = JSON.parse(localSaved); } catch (_) {}
      }

      // 1. Fetch from Dedicated elastic_issue Table
      try {
        const res = await fetch(`${getBackendUrl()}/api/elastic-issues`);
        if (res.ok) {
          const records = await res.json();
          if (Array.isArray(records) && records.length > 0) {
            setIssueHistory(records);
            localStorage.setItem('gpdms_elastic_issue_history', JSON.stringify(records.slice(0, 100)));
            setLoadingHistory(false);
            return;
          }
        }
      } catch (_) {}

      // 2. Legacy fallback from issue_logs
      try {
        const res = await fetch(`${getBackendUrl()}/api/issue-logs`);
        if (res.ok) {
          const logs = await res.json();
          const elasticLogs = (Array.isArray(logs) ? logs : []).filter(l =>
            String(l.id || '').toUpperCase().includes('ELASTIC') ||
            String(l.category || '').toUpperCase().includes('ELASTIC')
          ).map(l => ({
            slipNo: l.id,
            lotNo: l.lotId,
            date: l.date,
            rolls: l.volume || 1,
            issuerName: l.personName,
            receiverName: l.receiverName,
            remarks: l.materials ? (typeof l.materials === 'string' ? l.materials : JSON.stringify(l.materials)) : ''
          }));

          const combined = [...localList];
          elasticLogs.forEach(el => {
            if (!combined.some(c => c.slipNo === el.slipNo)) {
              combined.push(el);
            }
          });
          setIssueHistory(combined);
          setLoadingHistory(false);
          return;
        }
      } catch (_) {}

      setIssueHistory(localList);
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Save new issue to history & database table
  const saveToHistory = async (record) => {
    try {
      const current = [...issueHistory];
      const updated = [record, ...current.filter(c => c.slipNo !== record.slipNo)];
      setIssueHistory(updated);
      localStorage.setItem('gpdms_elastic_issue_history', JSON.stringify(updated.slice(0, 100)));

      // 1. Save directly into dedicated elastic_issue MySQL table
      await fetch(`${getBackendUrl()}/api/elastic-issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipNo: record.slipNo,
          lotNo: record.lotNo,
          rolls: record.rolls,
          issuerName: record.issuerName,
          receiverName: record.receiverName,
          issueDate: record.date,
          style: record.style,
          brand: record.brand,
          garmentType: record.garmentType,
          fabric: record.fabric,
          quantity: record.quantity,
          shade: record.shade,
          size: record.size,
          elasticWidth: record.width,
          remarks: record.remarks
        })
      });

      // 2. Also sync to global issue_logs
      try {
        await fetch(`${getBackendUrl()}/api/issue-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: record.slipNo,
            lotId: record.lotNo,
            isReissue: false,
            isReturn: false,
            category: 'ELASTIC / WAISTBAND',
            volume: record.rolls,
            personName: record.issuerName,
            receiverName: record.receiverName,
            receiverDept: 'CUTTING',
            date: record.date,
            materials: [{
              name: 'Elastic Waistband Roll',
              rolls: record.rolls,
              shade: record.shade,
              width: record.width
            }]
          })
        });
      } catch (_) {}
    } catch (e) {
      console.warn('Backend sync warning:', e);
    }
  };

  // Search Lot Details
  const handleSearchLot = async (targetLot = null) => {
    const lotToQuery = (targetLot || searchLotInput || '').trim();
    if (!lotToQuery) {
      setLotError('Please enter a Lot Number to search.');
      return;
    }

    setSearchingLot(true);
    setLotError('');

    try {
      const cleanLot = encodeURIComponent(lotToQuery);
      const res = await fetch(`${getBackendUrl()}/api/lot/${cleanLot}`);

      if (!res.ok) {
        throw new Error(`Lot "${lotToQuery}" not found. You can still issue rolls manually.`);
      }

      const data = await res.json();
      setLotDetails(data);

      // Extract primary shade if available
      let primaryShade = '';
      if (data.shade) {
        const raw = String(data.shade);
        const first = raw.split(',')[0].replace(/\[.*?\]/g, '').trim();
        primaryShade = first || raw;
      }
      setSelectedShade(primaryShade);

      const cuttingQty = parseInt(data.quantity || 0, 10);
      setRemarks(`Internal Elastic waistband roll issue for Lot ${data.lotNo || cleanLot} (${data.style || 'Garment'} - ${data.brand || ''}). Cutting Qty: ${cuttingQty} Pcs.`);

      setRecentLots(prev => {
        const updated = [lotToQuery, ...prev.filter(l => l !== lotToQuery)];
        return updated.slice(0, 6);
      });

      showToast(`Lot ${data.lotNo || lotToQuery} details loaded successfully.`);
    } catch (err) {
      console.warn('Lot search warning:', err);
      setLotError(err.message || 'Lot details not found in Google Sheets / Cutting Matrix.');
      setLotDetails({
        lotNo: lotToQuery,
        style: 'Standard Garment',
        brand: 'Mohit Hosiery',
        garmentType: 'Pants / Tracksuit',
        fabric: 'Cotton / Poly',
        quantity: 0,
        shade: 'Default'
      });
    } finally {
      setSearchingLot(false);
    }
  };

  const effectiveWidth = elasticWidth === 'Custom' ? (customWidth || '1 Inch') : elasticWidth;

  // ── Build Issue Voucher PDF ──────
  const createElasticIssuePDFDocument = async (data) => {
    const {
      slipNo,
      lotNo,
      rolls,
      issuerName,
      receiverName,
      date,
      style = 'Garment Design',
      brand = 'Mohit Hosiery',
      garmentType = 'Trouser / Tracksuit',
      fabric = 'Cotton Poly Blend',
      quantity = 0,
      shade = 'Standard',
      size = 'M, L, XL, 2XL',
      width = '1 Inch (Standard)',
      remarks = ''
    } = data;

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.2);
    doc.rect(26, 26, pw - 52, ph - 52);

    const im = 44;
    const iw = pw - im * 2;
    let y = 48;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('MOHIT HOSIERY', im, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('INTERNAL MATERIAL ISSUE VOUCHER — ELASTIC ROLLS', im, y + 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Store Department  •  Cutting Floor Material Movement', im, y + 39);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`VOUCHER NO:  ${slipNo}`, pw - im, y + 14, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Date:  ${date}`, pw - im, y + 27, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('[ ISSUED TO FLOOR ]', pw - im, y + 39, { align: 'right' });

    y += 50;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(im, y, pw - im, y);
    y += 18;

    // Specifications
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('1. LOT & PRODUCTION SPECIFICATIONS', im, y);
    y += 15;

    const halfW = iw / 2;

    const drawSpec = (label, val, xPos, yPos, maxW = halfW - 10) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`${label}:`, xPos, yPos);

      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);

      const strVal = String(val || 'N/A');
      const valW = maxW - labelW - 4;
      let displayVal = strVal;
      if (doc.getTextWidth(strVal) > valW) {
        while (doc.getTextWidth(displayVal + '...') > valW && displayVal.length > 0) {
          displayVal = displayVal.slice(0, -1);
        }
        displayVal += '...';
      }
      doc.text(displayVal, xPos + labelW + 4, yPos);
    };

    drawSpec('Lot Number', `LOT #${lotNo}`, im, y);
    drawSpec('Cutting Quantity', `${quantity || 0} Pcs`, im + halfW, y);
    y += 18;

    drawSpec('Style Name', style, im, y);
    drawSpec('Brand / Buyer', brand, im + halfW, y);
    y += 18;

    drawSpec('Garment Type', garmentType, im, y);
    drawSpec('Fabric Type', fabric, im + halfW, y);
    y += 18;

    drawSpec('Lot Shade / Color', shade || 'Standard', im, y);
    drawSpec('Target Sizes', size || 'M, L, XL, 2XL', im + halfW, y);
    y += 18;

    drawSpec('Elastic Width', width || '1 Inch (Standard)', im, y);
    drawSpec('Department', 'CUTTING FLOOR', im + halfW, y);
    y += 24;

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.6);
    doc.line(im, y, pw - im, y);
    y += 18;

    // Material table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('2. ISSUED MATERIAL (ROLL QUANTITY)', im, y);
    y += 12;

    const thH = 22;
    doc.setFillColor(248, 248, 248);
    doc.rect(im, y, iw, thH, 'F');

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(im, y, pw - im, y);
    doc.line(im, y + thH, pw - im, y + thH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('#', im + 12, y + 15);
    doc.text('MATERIAL / ITEM DESCRIPTION', im + 45, y + 15);
    doc.text('QUANTITY ISSUED', pw - im - 14, y + 15, { align: 'right' });
    y += thH;

    const trH = 26;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('1', im + 12, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`Elastic Waistband Roll  (${width || '1 Inch'})`, im + 45, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${rolls} ROLL${rolls > 1 ? 'S' : ''}`, pw - im - 14, y + 17, { align: 'right' });
    y += trH;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.6);
    doc.line(im, y, pw - im, y);

    const totH = 24;
    doc.setFillColor(248, 248, 248);
    doc.rect(im, y, iw, totH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL QUANTITY ISSUED:', im + 12, y + 16);

    doc.setFontSize(10);
    doc.text(`${rolls} ROLL${rolls > 1 ? 'S' : ''}`, pw - im - 14, y + 16, { align: 'right' });
    y += totH;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(im, y, pw - im, y);
    doc.line(im, y + 2.5, pw - im, y + 2.5);
    y += 24;

    // Remarks
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('3. INTERNAL REMARKS & FLOOR INSTRUCTIONS', im, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 50);
    const remText = remarks || `Internal Elastic waistband roll issue for Lot ${lotNo} (${style}).`;
    const splitRemarks = doc.splitTextToSize(remText, iw);
    doc.text(splitRemarks, im, y);
    y += Math.max(26, splitRemarks.length * 13 + 12);

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.6);
    doc.line(im, y, pw - im, y);
    y += 22;

    // Dual Signatures
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('4. VERIFICATION & DUAL SIGNATURES', im, y);
    y += 18;

    const sigW = (iw - 50) / 2;
    const xSig2 = im + sigW + 50;

    // Left: Issuer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('ISSUED BY (STORE STAFF)', im, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    doc.text('Name:', im, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(issuerName || 'N/A', im + 44, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Date:', im, y + 34);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(date, im + 44, y + 34);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Signature: __________________________', im, y + 60);

    // Right: Receiver
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('RECEIVED BY (CUTTING MASTER)', xSig2, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    doc.text('Name:', xSig2, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(receiverName || 'N/A', xSig2 + 44, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Date:', xSig2, y + 34);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(date, xSig2 + 44, y + 34);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Signature: __________________________', xSig2, y + 60);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Official Internal Material Issue Voucher  •  Mohit Hosiery Quality Management System', pw / 2, ph - 38, { align: 'center' });

    return doc;
  };

  // ── Generate Professional Elastic Issue Voucher ─────────────────────────────
  const generateElasticIssueBill = async () => {
    if (!lotDetails && !searchLotInput) {
      showToast('Please enter or search a Lot Number first.', 'error');
      return;
    }

    if (!issuerName || !receiverName) {
      showToast('Please provide both Issuer and Receiver names.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const currentSlipNo = issueSlipNo || await fetchNextIssueSlipNo();
      const currentLotNo = lotDetails?.lotNo || searchLotInput.trim();

      const doc = await createElasticIssuePDFDocument({
        slipNo: currentSlipNo,
        lotNo: currentLotNo,
        rolls: rollCount,
        width: effectiveWidth,
        shade: selectedShade || lotDetails?.shade || 'Standard Shade',
        issuerName,
        receiverName,
        date: issueDate,
        style: lotDetails?.style || 'Garment Design',
        brand: lotDetails?.brand || 'Mohit Hosiery',
        garmentType: lotDetails?.garmentType || 'Trouser / Tracksuit',
        fabric: lotDetails?.fabric || 'Cotton Poly Blend',
        quantity: lotDetails?.quantity || 0,
        size: lotDetails?.size || 'M, L, XL, 2XL',
        remarks
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const generatedData = {
        doc,
        pdfUrl,
        slipNo: currentSlipNo,
        lotNo: currentLotNo,
        rolls: rollCount,
        width: effectiveWidth,
        shade: selectedShade || lotDetails?.shade || 'Standard Shade',
        issuerName,
        receiverName,
        date: issueDate,
        style: lotDetails?.style || 'Garment Design',
        brand: lotDetails?.brand || 'Mohit Hosiery',
        garmentType: lotDetails?.garmentType || 'Trouser / Tracksuit',
        fabric: lotDetails?.fabric || 'Cotton Poly Blend',
        quantity: lotDetails?.quantity || 0,
        size: lotDetails?.size || 'M, L, XL, 2XL',
        remarks
      };

      setGeneratedSlipData(generatedData);
      await saveToHistory(generatedData);
      fetchNextIssueSlipNo();

      showToast(`Elastic Issue Voucher ${currentSlipNo} generated successfully!`);
    } catch (err) {
      console.error('Issue slip generation error:', err);
      showToast(err.message || 'Failed to generate Issue Bill.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (generatedSlipData?.doc) {
      generatedSlipData.doc.save(`${generatedSlipData.slipNo}_Elastic_Issue_Voucher.pdf`);
    }
  };

  const handlePrintBill = () => {
    if (generatedSlipData?.pdfUrl) {
      const printWin = window.open(generatedSlipData.pdfUrl, '_blank');
      if (printWin) {
        printWin.focus();
      } else {
        alert('Please allow popups to open print preview.');
      }
    }
  };

  const handleReprintFromHistory = async (item) => {
    try {
      const doc = await createElasticIssuePDFDocument({
        slipNo: item.slipNo,
        lotNo: item.lotNo,
        rolls: item.rolls || 1,
        width: item.width || item.elasticWidth || '1 Inch (Standard)',
        shade: item.shade || 'Standard',
        issuerName: item.issuerName || 'Store Staff',
        receiverName: item.receiverName || 'Cutting Master',
        date: item.date || new Date().toISOString().split('T')[0],
        style: item.style || 'Garment Design',
        brand: item.brand || 'Mohit Hosiery',
        garmentType: item.garmentType || 'Trouser / Tracksuit',
        fabric: item.fabric || 'Cotton Poly Blend',
        quantity: item.quantity || 0,
        size: item.size || 'M, L, XL, 2XL',
        remarks: item.remarks || ''
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setGeneratedSlipData({
        doc,
        pdfUrl,
        slipNo: item.slipNo,
        lotNo: item.lotNo,
        rolls: item.rolls || 1,
        width: item.width || item.elasticWidth || '1 Inch (Standard)',
        shade: item.shade || 'Standard',
        issuerName: item.issuerName || 'Store Staff',
        receiverName: item.receiverName || 'Cutting Master',
        date: item.date || new Date().toISOString().split('T')[0],
        style: item.style || 'Garment Design',
        brand: item.brand || 'Mohit Hosiery'
      });
    } catch (err) {
      console.error('Reprint error:', err);
      showToast('Failed to open voucher for printing.', 'error');
    }
  };

  return (
    <div style={{ padding: '20px 24px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
          padding: '14px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff', fontWeight: '700', boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(8px)'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="panel" style={{
        padding: '18px 24px',
        borderRadius: '16px',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #dbeafe)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35)',
            flexShrink: 0
          }}>
            <Sliders size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Elastic Issue (Internal Roll Issue)
              </h1>
              <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                Internal Floor Issue
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
              Search Lot Number, specify quantity of rolls, width, enter Issuer & Receiver names, and generate official Issue Voucher.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Issue Form vs History) */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-primary, #f0fdf4)', padding: '5px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
          <button
            type="button"
            onClick={() => setViewMode('generator')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '700',
              background: viewMode === 'generator' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: viewMode === 'generator' ? '#ffffff' : 'var(--text-muted, #64748b)',
              boxShadow: viewMode === 'generator' ? '0 2px 8px rgba(5, 150, 105, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={14} /> New Elastic Issue
          </button>
          <button
            type="button"
            onClick={() => setViewMode('history')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '700',
              background: viewMode === 'history' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: viewMode === 'history' ? '#ffffff' : 'var(--text-muted, #64748b)',
              boxShadow: viewMode === 'history' ? '0 2px 8px rgba(5, 150, 105, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Calendar size={14} /> Issue Slips History
          </button>
        </div>
      </div>

      {viewMode === 'generator' ? (
        <>
          {/* STEP 1: SEARCH LOT NUMBER */}
          <div className="panel" style={{
            padding: '22px 24px',
            borderRadius: '16px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #dbeafe)',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: '#059669', color: '#ffffff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800'
                }}>1</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Search Lot Number
                </h3>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                Voucher No: <strong style={{ color: '#059669' }}>{issueSlipNo || 'Loading...'}</strong>
              </div>
            </div>

            {/* Search Input Box */}
            <div style={{ display: 'flex', gap: '10px', maxWidth: '640px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Enter Lot Number (auto-searches on typing)..."
                  value={searchLotInput}
                  onChange={(e) => setSearchLotInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchLot(); }}
                  style={{
                    width: '100%',
                    padding: '11px 16px 11px 38px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-color, #cbd5e1)',
                    background: 'var(--bg-input, #f8fafc)',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-main, #0f172a)',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                {searchingLot && (
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11.5px', fontWeight: '700', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={12} className="animate-spin" /> Searching...
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSearchLot()}
                disabled={searchingLot}
                style={{
                  padding: '0 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: searchingLot ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {searchingLot ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{searchingLot ? 'Searching...' : 'Search Lot'}</span>
              </button>
            </div>

            {/* Recent suggestions */}
            {recentLots.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Recent:</span>
                {recentLots.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => { setSearchLotInput(l); handleSearchLot(l); }}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f1f5f9',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Lot #{l}
                  </button>
                ))}
              </div>
            )}

            {lotError && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626',
                fontSize: '12.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{lotError}</span>
              </div>
            )}

            {/* LOT DETAILS DISPLAY CARD */}
            {lotDetails && (
              <div style={{
                marginTop: '18px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1.5px solid #86efac'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '6px',
                      background: '#059669', color: '#ffffff',
                      fontSize: '12.5px', fontWeight: '800', letterSpacing: '0.5px'
                    }}>
                      LOT #{lotDetails.lotNo}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>
                      {lotDetails.style || 'Garment Design'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      • {lotDetails.brand || 'Mohit Hosiery'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#047857', background: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac' }}>
                    Cutting Qty: <strong>{lotDetails.quantity || 0} Pcs</strong>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>GARMENT TYPE</span>
                    <strong style={{ color: '#0f172a' }}>{lotDetails.garmentType || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>FABRIC</span>
                    <strong style={{ color: '#0f172a' }}>{lotDetails.fabric || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>SHADE / COLOR</span>
                    <strong style={{ color: '#0f172a' }}>{selectedShade || lotDetails.shade || 'Standard'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>SIZES</span>
                    <strong style={{ color: '#0f172a' }}>{lotDetails.size || 'M, L, XL, XXL'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: ELASTIC ISSUE DETAILS */}
          <div className="panel" style={{
            padding: '22px 24px',
            borderRadius: '16px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #dbeafe)',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <span style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: '#059669', color: '#ffffff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800'
              }}>2</span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Issue Details (Quantity of Rolls, Width & Issuer / Receiver)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

              {/* LEFT COLUMN: ISSUER & RECEIVER NAMES */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                {/* ISSUER NAME */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <User size={15} color="#059669" />
                    <span>Issuer Name (Store Staff):</span>
                  </label>
                  <input
                    type="text"
                    value={issuerName}
                    onChange={(e) => setIssuerName(e.target.value)}
                    placeholder="Enter issuer name..."
                    autoComplete="off"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1.5px solid #cbd5e1', background: '#ffffff',
                      fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* RECEIVER NAME */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Scissors size={15} color="#059669" />
                    <span>Receiver Name (Cutting Master):</span>
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Enter receiver name..."
                    autoComplete="off"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1.5px solid #cbd5e1', background: '#ffffff',
                      fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Elastic Width */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Sliders size={15} color="#059669" />
                    <span>Elastic Width:</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['0.5 Inch', '0.75 Inch', '1 Inch (Standard)', '1.5 Inch', '2 Inch', '3 Inch', 'Custom'].map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setElasticWidth(w)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: elasticWidth === w ? '1.5px solid #059669' : '1px solid #cbd5e1',
                          background: elasticWidth === w ? '#dcfce7' : '#ffffff',
                          color: elasticWidth === w ? '#059669' : '#334155',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  {elasticWidth === 'Custom' && (
                    <input
                      type="text"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="e.g. 2.5 Inch"
                      style={{
                        marginTop: '8px',
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        border: '1.5px solid #059669', background: '#ffffff',
                        fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>

                {/* Issue Date & Remarks */}
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      ISSUE DATE
                    </span>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      style={{
                        width: '100%', padding: '7px 8px', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '12px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      REMARKS / INSTRUCTIONS
                    </span>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Elastic rolls for waistband..."
                      style={{
                        width: '100%', padding: '7px 10px', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '12px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: QUANTITY TO ISSUE (ROLLS) */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} color="#059669" />
                  <span>Quantity to Issue (Rolls):</span>
                </label>

                {/* Big Stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRollCount(prev => Math.max(1, (parseInt(prev, 10) || 1) - 1))}
                    style={{
                      width: '44px', height: '44px', borderRadius: '10px',
                      border: '1.5px solid #cbd5e1', background: '#ffffff',
                      fontSize: '18px', fontWeight: '800', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#334155', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <Minus size={18} />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={rollCount}
                    onChange={(e) => setRollCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{
                      width: '110px',
                      height: '44px',
                      textAlign: 'center',
                      fontSize: '22px',
                      fontWeight: '800',
                      borderRadius: '10px',
                      border: '2px solid #059669',
                      background: '#ffffff',
                      color: '#059669',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.15)'
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setRollCount(prev => (parseInt(prev, 10) || 1) + 1)}
                    style={{
                      width: '44px', height: '44px', borderRadius: '10px',
                      border: '1.5px solid #cbd5e1', background: '#ffffff',
                      fontSize: '18px', fontWeight: '800', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#334155', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <Plus size={18} />
                  </button>

                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#334155' }}>
                    Rolls
                  </span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5, 6, 10, 20].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setRollCount(cnt)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: rollCount === cnt ? '1.5px solid #059669' : '1px solid #cbd5e1',
                        background: rollCount === cnt ? '#dcfce7' : '#ffffff',
                        color: rollCount === cnt ? '#059669' : '#334155',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {cnt} Roll{cnt > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', color: '#059669', background: '#dcfce7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #86efac', marginTop: '6px' }}>
                  Issue Summary: <strong>{rollCount} Roll{rollCount > 1 ? 's' : ''}</strong> of Elastic ({effectiveWidth})
                </div>
              </div>

            </div>

            {/* ACTION: GENERATE BILL BUTTON */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Issuing <strong>{rollCount} Roll{rollCount > 1 ? 's' : ''}</strong> of Elastic to <strong>{receiverName || 'Cutting Master'}</strong>
              </div>

              <button
                type="button"
                onClick={generateElasticIssueBill}
                disabled={generating}
                style={{
                  padding: '12px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '800',
                  cursor: generating ? 'wait' : 'pointer',
                  boxShadow: '0 6px 18px rgba(5, 150, 105, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                {generating ? <RefreshCw size={18} className="animate-spin" /> : <Printer size={18} />}
                <span>{generating ? 'Generating Issue Slip...' : 'Generate Elastic Issue Bill'}</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* HISTORY TAB */
        <div className="panel" style={{
          padding: '22px 24px',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Elastic Issue Slips History
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Records of internal elastic rolls issued to cutting and sewing departments
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <input
                  type="text"
                  placeholder="Search by Slip No / Lot No / Receiver..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 12px 7px 32px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box'
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>

              <button
                type="button"
                onClick={loadIssueHistory}
                style={{
                  padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                }}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* History Table */}
          {issueHistory.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <Layers size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: '700' }}>No Elastic Issue Slips generated yet.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Issue your first roll using the "New Elastic Issue" tab above.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11.5px', fontWeight: '800' }}>
                    <th style={{ padding: '10px 12px' }}>SLIP NO</th>
                    <th style={{ padding: '10px 12px' }}>DATE</th>
                    <th style={{ padding: '10px 12px' }}>LOT NO</th>
                    <th style={{ padding: '10px 12px' }}>WIDTH</th>
                    <th style={{ padding: '10px 12px' }}>ROLLS</th>
                    <th style={{ padding: '10px 12px' }}>ISSUED BY</th>
                    <th style={{ padding: '10px 12px' }}>RECEIVED BY</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {issueHistory
                    .filter(h => {
                      if (!historySearch) return true;
                      const q = historySearch.toLowerCase();
                      return String(h.slipNo || '').toLowerCase().includes(q) ||
                        String(h.lotNo || '').toLowerCase().includes(q) ||
                        String(h.receiverName || '').toLowerCase().includes(q) ||
                        String(h.issuerName || '').toLowerCase().includes(q);
                    })
                    .map((item, idx) => (
                      <tr key={item.slipNo || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>
                          {item.slipNo}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                          LOT #{item.lotNo}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.width || item.elasticWidth || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>
                          {item.rolls} Roll{item.rolls > 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.issuerName || 'ADMIN'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '700' }}>
                          {item.receiverName || 'CUTTING MASTER'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleReprintFromHistory(item)}
                            title="Print Black & White Voucher"
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #0f172a',
                              background: '#0f172a',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              marginRight: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Printer size={11} /> Print (B&W)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchLotInput(item.lotNo);
                              handleSearchLot(item.lotNo);
                              setViewMode('generator');
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#059669',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Re-issue
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GENERATED BILL SUCCESS MODAL */}
      {generatedSlipData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            animation: 'scaleIn 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              padding: '18px 24px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    Elastic Issue Voucher Generated!
                  </h3>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Voucher No: <strong>{generatedSlipData.slipNo}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedSlipData(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px' }}>
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>LOT NUMBER</span>
                    <strong style={{ color: '#0f172a' }}>LOT #{generatedSlipData.lotNo}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>QUANTITY ISSUED</span>
                    <strong style={{ color: '#059669', fontSize: '16px' }}>{generatedSlipData.rolls} Rolls</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ELASTIC WIDTH</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.width}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUE DATE</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUED BY (STORE)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.issuerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>RECEIVED BY (CUTTING)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.receiverName}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid #059669',
                    background: '#ffffff',
                    color: '#059669',
                    fontSize: '13.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={16} />
                  <span>Download Voucher (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintBill}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.35)'
                  }}
                >
                  <Printer size={16} />
                  <span>Print Slip (B&W)</span>
                </button>
              </div>

              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setGeneratedSlipData(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Done / Issue Next Lot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
