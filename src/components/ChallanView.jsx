import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Search, Printer, Download, RefreshCw, CheckCircle,
  AlertTriangle, Scissors, User, UserCheck, Calendar, Package, Tag,
  Layers, Zap, Camera, Upload, X, Trash2, Eye, ShieldCheck, Sparkles,
  ChevronRight, Box, Edit2, ArrowRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getBackendUrl } from '../utils/api';

export default function ChallanView({
  currentUser = null,
  currencySymbol = '₹',
  prefilledLotNo = '',
  onNavigate = () => {}
}) {
  // ── Form State ──
  const [lotNo, setLotNo] = useState(prefilledLotNo || '');
  const [styleName, setStyleName] = useState('');
  const [brand, setBrand] = useState('');
  const [colorShade, setColorShade] = useState('');

  // Component & Issue Details
  const [componentName, setComponentName] = useState('');
  const [componentType, setComponentType] = useState('Trims & Accessories');
  const [issueQty, setIssueQty] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [issuePhoto, setIssuePhoto] = useState(null);
  const [remarks, setRemarks] = useState('');

  // Handover & Signatory Personnel (Issued By, Received By, Supervisor Name)
  const [issuedBy, setIssuedBy] = useState(currentUser?.name || 'Paras (Store Incharge)');
  const [receivedBy, setReceivedBy] = useState('');
  const [supervisorName, setSupervisorName] = useState('');

  // UI States
  const [searchingLot, setSearchingLot] = useState(false);
  const [lotDetails, setLotDetails] = useState(null);
  const [lotError, setLotError] = useState('');
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useState('form'); // 'form' | 'history'

  // Challan Date & Time
  const [challanDate, setChallanDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [challanTime, setChallanTime] = useState(() => {
    const today = new Date();
    return today.toTimeString().slice(0, 5);
  });

  // Local Storage Challan History
  const [challanHistory, setChallanHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('gpdms_component_challans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Search query for history
  const [historySearch, setHistorySearch] = useState('');

  // Sequential Challan Number generator
  const currentChallanNo = useMemo(() => {
    const seq = challanHistory.length + 1;
    const padSeq = String(seq).padStart(4, '0');
    const cleanLot = (lotNo || '').trim().replace(/[^a-zA-Z0-9]/g, '');
    return cleanLot ? `CH-${cleanLot}-${padSeq}` : `CH-GEN-${padSeq}`;
  }, [challanHistory.length, lotNo]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync if prefilled lot passed from another view
  useEffect(() => {
    if (prefilledLotNo && !lotNo) {
      setLotNo(prefilledLotNo);
      handleSearchLot(prefilledLotNo);
    }
  }, [prefilledLotNo]);

  // ── Search Lot Details ──
  const handleSearchLot = async (targetLot = null) => {
    const lotToQuery = (targetLot || lotNo || '').trim();
    if (!lotToQuery) {
      setLotError('Please enter a Lot Number to verify.');
      return;
    }

    setSearchingLot(true);
    setLotError('');

    try {
      const cleanLot = encodeURIComponent(lotToQuery);
      const res = await fetch(`${getBackendUrl()}/api/lot/${cleanLot}`);

      if (!res.ok) {
        throw new Error(`Lot "${lotToQuery}" not found in database. Manual entry is available below.`);
      }

      const data = await res.json();
      setLotDetails(data);

      if (data.style || data.garmentType) {
        setStyleName(data.style || data.garmentType);
      }
      if (data.quantity && !issueQty) {
        setIssueQty(data.quantity);
      }
      if (data.brand) {
        setBrand(data.brand);
      }
      if (data.shade) {
        setColorShade(String(data.shade).split(',')[0].replace(/\[.*?\]/g, '').trim());
      }

      showToast(`Lot ${data.lotNo || lotToQuery} details loaded!`);
    } catch (err) {
      console.warn('Lot lookup note:', err);
      setLotError(err.message || 'Lot details not found. Direct manual floor entry available.');
      setLotDetails(null);
    } finally {
      setSearchingLot(false);
    }
  };

  // ── Quick Component Chips ──
  const QUICK_COMPONENTS = [
    { name: 'Tape', icon: '🎗️', defaultUnit: 'Mtr' },
    { name: 'Button', icon: '🔘', defaultUnit: 'Pcs' },
    { name: 'Lace', icon: '🕸️', defaultUnit: 'Mtr' },
    { name: 'Elastic', icon: '🧵', defaultUnit: 'Roll' },
    { name: 'Zipper', icon: '🤐', defaultUnit: 'Pcs' },
    { name: 'Drawcord / Dori', icon: '➰', defaultUnit: 'Mtr' },
    { name: 'Label / Tag', icon: '🏷️', defaultUnit: 'Pcs' },
    { name: 'Badge / Patch', icon: '🛡️', defaultUnit: 'Pcs' },
    { name: 'Eyelet', icon: '⭕', defaultUnit: 'Pcs' },
    { name: 'Pocketing / Bone', icon: '📦', defaultUnit: 'Mtr' },
  ];

  const handleSelectQuickComponent = (comp) => {
    setComponentName(comp.name);
    setComponentType(comp.name);
    setUnit(comp.defaultUnit);
  };

  // ── Handle Photo Upload ──
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setIssuePhoto(event.target?.result);
        showToast('Photo attached to Challan!');
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Generate Formal PDF Challan ──
  const generateChallanPDF = (challanData) => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pw - margin * 2;
    let y = margin;

    // Header Border Box
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(1.5);
    doc.rect(margin, y, contentWidth, 70);

    // Company Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('G_PDMS APPARELS - COMPONENT ISSUE CHALLAN', margin + 14, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Production Floor Material Movement & Delivery Handover Voucher', margin + 14, y + 42);
    doc.text(`Issued On: ${challanData.date || challanDate} at ${challanData.time || challanTime}`, margin + 14, y + 56);

    // Challan Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(challanData.challanNo || currentChallanNo, pw - margin - 14, y + 26, { align: 'right' });
    doc.setFontSize(9);
    doc.setTextColor(5, 150, 105);
    doc.text('STATUS: ISSUED & DELIVERED', pw - margin - 14, y + 42, { align: 'right' });

    y += 84;

    // ── 1. LOT & GARMENT DETAILS SECTION ──
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('1. PRODUCTION LOT SPECIFICATIONS', margin + 8, y + 14);
    y += 20;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.rect(margin, y, contentWidth, 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('LOT NUMBER:', margin + 12, y + 16);
    doc.text('STYLE / GARMENT:', margin + 180, y + 16);
    doc.text('COLOR / SHADE:', margin + 380, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(challanData.lotNo ? `#${challanData.lotNo}` : 'N/A (General Issue)', margin + 12, y + 32);
    doc.text(challanData.styleName || 'Production Floor Item', margin + 180, y + 32);
    doc.text(challanData.colorShade || 'Standard', margin + 380, y + 32);

    y += 56;

    // ── 2. COMPONENT ISSUE PARTICULARS TABLE ──
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('2. COMPONENT ISSUE & MATERIAL QUANTITY', margin + 8, y + 14);
    y += 20;

    // Table Header
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 22, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('S.NO', margin + 10, y + 15);
    doc.text('COMPONENT / MATERIAL NAME', margin + 50, y + 15);
    doc.text('TYPE / CATEGORY', margin + 260, y + 15);
    doc.text('UNIT', margin + 370, y + 15);
    doc.text('ISSUE QUANTITY / PCS', pw - margin - 15, y + 15, { align: 'right' });
    y += 22;

    // Table Row
    const rowH = 34;
    doc.rect(margin, y, contentWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('1', margin + 14, y + 21);
    doc.text(challanData.componentName || 'Accessory Item', margin + 50, y + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(challanData.componentType || 'Trims & Accessories', margin + 260, y + 21);
    doc.text(challanData.unit || 'Pcs', margin + 370, y + 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${challanData.issueQty || 0} ${challanData.unit || 'Pcs'}`, pw - margin - 15, y + 21, { align: 'right' });
    y += rowH + 10;

    // Remarks Box
    if (challanData.remarks) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 26, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 26);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('REMARKS / NOTE:', margin + 8, y + 17);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(challanData.remarks, margin + 95, y + 17);
      y += 34;
    }

    // Embed Photo thumbnail if provided
    if (challanData.issuePhoto && typeof challanData.issuePhoto === 'string' && challanData.issuePhoto.startsWith('data:image')) {
      try {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text('ATTACHED MATERIAL PHOTO:', margin + 8, y + 12);
        doc.addImage(challanData.issuePhoto, 'JPEG', margin + 8, y + 18, 90, 70);
        y += 98;
      } catch (err) {
        console.warn('Could not embed photo in PDF:', err);
      }
    }

    // ── 3. FORMAL 3-SIGNATORY HANDOVER BOXES ──
    y = Math.max(y + 20, ph - margin - 110);

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('3. AUTHORIZATION & HANDOVER ACKNOWLEDGEMENT', margin + 8, y + 13);
    y += 18;

    const colW = (contentWidth) / 3;
    const signH = 75;

    // Box 1: Issued By
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, colW, signH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('ISSUED BY (STORE):', margin + 8, y + 14);
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(challanData.issuedBy || 'Store Incharge', margin + 8, y + 30);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Authorized Signature & Date', margin + 8, y + signH - 8);

    // Box 2: Received By
    doc.rect(margin + colW, y, colW, signH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('RECEIVED BY (FLOOR):', margin + colW + 8, y + 14);
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(challanData.receivedBy || 'Floor Operator / Tailor', margin + colW + 8, y + 30);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Receiver Signature & Date', margin + colW + 8, y + signH - 8);

    // Box 3: Supervisor Name
    doc.rect(margin + colW * 2, y, colW, signH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('SUPERVISOR APPROVAL:', margin + colW * 2 + 8, y + 14);
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(challanData.supervisorName || 'Floor Supervisor', margin + colW * 2 + 8, y + 30);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Supervisor Signature & Seal', margin + colW * 2 + 8, y + signH - 8);

    return doc;
  };

  // ── Save & Print Challan ──
  const handleSaveAndPrintChallan = () => {
    if (!lotNo.trim()) {
      showToast('Please enter the Lot Number first.', 'error');
      return;
    }
    if (!componentName.trim()) {
      showToast('Please enter the Component Name.', 'error');
      return;
    }
    if (!issueQty || Number(issueQty) <= 0) {
      showToast('Please enter valid Issue Pieces / Quantity.', 'error');
      return;
    }
    if (!issuedBy.trim()) {
      showToast('Please specify Issued By name.', 'error');
      return;
    }
    if (!receivedBy.trim()) {
      showToast('Please specify Received By name.', 'error');
      return;
    }
    if (!supervisorName.trim()) {
      showToast('Please specify Supervisor Name.', 'error');
      return;
    }

    const newRecord = {
      id: Date.now(),
      challanNo: currentChallanNo,
      date: challanDate,
      time: challanTime,
      lotNo: lotNo.trim(),
      styleName: styleName.trim() || 'Floor Item',
      brand: brand || '',
      colorShade: colorShade || 'Standard',
      componentName: componentName.trim(),
      componentType,
      issueQty: Number(issueQty),
      unit,
      issuePhoto,
      issuedBy: issuedBy.trim(),
      receivedBy: receivedBy.trim(),
      supervisorName: supervisorName.trim(),
      remarks: remarks.trim()
    };

    // Save to local storage
    const updatedHistory = [newRecord, ...challanHistory].slice(0, 500);
    setChallanHistory(updatedHistory);
    try {
      localStorage.setItem('gpdms_component_challans', JSON.stringify(updatedHistory));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // Generate & open print dialog
    const doc = generateChallanPDF(newRecord);
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');

    showToast(`Challan ${newRecord.challanNo} generated & printed!`);
  };

  // ── Delete from History ──
  const handleDeleteChallan = (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this challan record?')) return;
    const updated = challanHistory.filter(c => c.id !== id);
    setChallanHistory(updated);
    try {
      localStorage.setItem('gpdms_component_challans', JSON.stringify(updated));
    } catch {}
    showToast('Challan record removed.');
  };

  // ── Reset Form ──
  const handleResetForm = () => {
    setLotNo('');
    setStyleName('');
    setBrand('');
    setColorShade('');
    setComponentName('');
    setComponentType('Trims & Accessories');
    setIssueQty('');
    setUnit('Pcs');
    setIssuePhoto(null);
    setRemarks('');
    setReceivedBy('');
    setSupervisorName('');
    setLotDetails(null);
    setLotError('');
    showToast('Form cleared for new challan.');
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return challanHistory;
    const q = historySearch.toLowerCase().trim();
    return challanHistory.filter(c =>
      String(c.challanNo || '').toLowerCase().includes(q) ||
      String(c.lotNo || '').toLowerCase().includes(q) ||
      String(c.componentName || '').toLowerCase().includes(q) ||
      String(c.styleName || '').toLowerCase().includes(q) ||
      String(c.issuedBy || '').toLowerCase().includes(q) ||
      String(c.receivedBy || '').toLowerCase().includes(q) ||
      String(c.supervisorName || '').toLowerCase().includes(q)
    );
  }, [challanHistory, historySearch]);

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      padding: '16px 20px',
      fontFamily: 'inherit',
      overflowX: 'hidden'
    }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: toast.type === 'error' ? '#ef4444' : '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} color="#4ade80" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff', boxShadow: '0 3px 10px rgba(15, 23, 42, 0.15)'
          }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px' }}>
                Component Issue Challan
              </h1>
              <span style={{ fontSize: '11px', fontWeight: '800', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}>
                {currentChallanNo}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
              Official Production Floor Delivery Handover Voucher & Challan Generator
            </p>
          </div>
        </div>

        {/* View Switcher: Form vs History */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'inline-flex',
            background: '#f8fafc',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('form')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'form' ? '#0f172a' : 'transparent',
                color: viewMode === 'form' ? '#ffffff' : '#64748b',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ✍️ Challan Form
            </button>
            <button
              type="button"
              onClick={() => setViewMode('history')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'history' ? '#0f172a' : 'transparent',
                color: viewMode === 'history' ? '#ffffff' : '#64748b',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              📜 Challan History ({challanHistory.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            title="Reset Form"
            style={{
              padding: '6px 12px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={13} /> Clear
          </button>
        </div>
      </div>

      {viewMode === 'form' ? (
        /* UNIFIED FULL-WIDTH CHALLAN FORM (Never squished or cut off) */
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}>

          {/* SECTION 1: LOT NUMBER & PRODUCTION SPECIFICATIONS */}
          {/* SECTION 1: LOT NUMBER & PRODUCTION SPECIFICATIONS (OPTIONAL) */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '6px',
                  background: '#0f172a', color: '#ffffff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800'
                }}>1</span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  PRODUCTION LOT DETAILS
                </span>
                <span style={{ fontSize: '10.5px', fontWeight: '700', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  Optional
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Optional: Enter Lot number to auto-verify garment style, or leave blank for general floor issue
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}>
              {/* Lot Number with integrated Verify button - OPTIONAL */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', textTransform: 'uppercase' }}>
                  <span>LOT NUMBER</span>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'none' }}>(Optional)</span>
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="e.g. 62114, 76141 (Optional)..."
                    value={lotNo}
                    onChange={(e) => setLotNo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchLot(); }}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', background: '#ffffff',
                      fontSize: '13.5px', fontWeight: '700', color: '#0f172a', outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchLot()}
                    disabled={searchingLot}
                    style={{
                      padding: '0 14px', borderRadius: '8px', border: 'none',
                      background: '#0f172a', color: '#ffffff', fontSize: '12px', fontWeight: '700',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                    }}
                  >
                    {searchingLot ? <RefreshCw size={13} className="spin" /> : <Search size={13} />}
                    Verify
                  </button>
                </div>
                {lotError && (
                  <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '600' }}>
                    {lotError}
                  </div>
                )}
              </div>

              {/* Style / Garment Item */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', textTransform: 'uppercase' }}>
                  <span>STYLE / GARMENT ITEM</span>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'none' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lower, Tracksuit, Shirt (Optional)..."
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Date & Time */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  CHALLAN ISSUE DATE & TIME
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '6px' }}>
                  <input
                    type="date"
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 10px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', background: '#ffffff',
                      fontSize: '12.5px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                  <input
                    type="time"
                    value={challanTime}
                    onChange={(e) => setChallanTime(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 8px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', background: '#ffffff',
                      fontSize: '12.5px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMPONENT SPECIFICATION & QUANTITY */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '6px',
                  background: '#0f172a', color: '#ffffff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800'
                }}>2</span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  COMPONENT SPECIFICATION & ISSUE PIECES
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Click quick chip or type component name directly
              </span>
            </div>

            {/* Quick Component Buttons Bar */}
            <div style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '16px',
              padding: '8px 10px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              {QUICK_COMPONENTS.map(comp => {
                const isSelected = componentName === comp.name;
                return (
                  <button
                    key={comp.name}
                    type="button"
                    onClick={() => handleSelectQuickComponent(comp)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: isSelected ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                      background: isSelected ? '#0f172a' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#334155',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{comp.icon}</span>
                    <span>{comp.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Component Inputs Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '16px'
            }}>
              {/* Component Name */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  COMPONENT / MATERIAL NAME <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cotton Tape 1 inch, Horn Button 24L, GPO Lace..."
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Category / Specification */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  CATEGORY / SPECIFICATION
                </label>
                <input
                  type="text"
                  placeholder="e.g. Trims, Elastic, Tapes, Buttons..."
                  value={componentType}
                  onChange={(e) => setComponentType(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Issue Quantity / Pcs */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  ISSUE QUANTITY / PCS <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder="e.g. 3000, 50, 2..."
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '14px', fontWeight: '800', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Unit of Measure */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  UNIT OF MEASURE
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: '700', color: '#0f172a', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="Pcs">Pcs (Pieces)</option>
                  <option value="Mtr">Mtr (Meters)</option>
                  <option value="Roll">Roll (Rolls)</option>
                  <option value="Kg">Kg (Kilograms)</option>
                  <option value="Pkt">Pkt (Packets)</option>
                  <option value="Box">Box (Boxes)</option>
                  <option value="Cone">Cone (Cones)</option>
                  <option value="Dozen">Dozen (12 Pcs)</option>
                  <option value="Gross">Gross (144 Pcs)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: 3 SIGNATORIES (Issued By, Received By, Supervisor Name) & PHOTO */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '6px',
                  background: '#0f172a', color: '#ffffff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800'
                }}>3</span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  HANDOVER SIGNATORIES & AUTHORIZATION
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Names print onto the 3-signature acknowledgement footer of the challan
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '16px'
            }}>
              {/* Issued By */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  ISSUED BY (STORE INCHARGE) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paras (Store Incharge)"
                  value={issuedBy}
                  onChange={(e) => setIssuedBy(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Received By */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  RECEIVED BY (FLOOR / TAILOR) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Tailor, Line 2, Cutting..."
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Supervisor Name */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  SUPERVISOR NAME (FLOOR INCHARGE) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Sharma (Floor Supervisor)"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>

              {/* Attach Photo (Optional) */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  ATTACH PHOTO / PICTURE (OPTIONAL)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#475569'
                  }}>
                    <Camera size={14} color="#0f172a" />
                    <span>{issuePhoto ? 'Change Photo' : 'Attach Material Photo'}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>

                  {issuePhoto && (
                    <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                      <img src={issuePhoto} alt="Issue" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setIssuePhoto(null)}
                        style={{
                          position: 'absolute', top: 0, right: 0,
                          background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                          width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Remarks Full Width */}
            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                REMARKS / INSTRUCTIONS
              </label>
              <input
                type="text"
                placeholder="e.g. Issued for Lot #62114 cuff stitching. Handover verified on production floor."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid #cbd5e1', background: '#f8fafc',
                  fontSize: '12.5px', color: '#334155', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>
          </div>

          {/* SECTION 4: FULL-WIDTH SUMMARY & INSTANT PRINT BAR */}
          <div style={{
            padding: '16px 24px',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                  VOUCHER
                </span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{currentChallanNo}</strong>
              </div>

              <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }}></div>

              <div>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                  LOT & COMPONENT
                </span>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                  {lotNo ? `#${lotNo}` : 'General Floor Issue'} &bull; {componentName || 'Accessory'}
                </strong>
              </div>

              <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }}></div>

              <div>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                  TOTAL TO ISSUE
                </span>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                  {issueQty || 0} <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>{unit}</span>
                </strong>
              </div>

              <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }}></div>

              <div>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                  SIGNATORIES
                </span>
                <span style={{ fontSize: '12px', color: '#334155', fontWeight: '600' }}>
                  {issuedBy || 'Store'} &rarr; {receivedBy || 'Tailor'} (Sup: {supervisorName || '—'})
                </span>
              </div>
            </div>

            {/* Print & Save Button */}
            <button
              type="button"
              onClick={handleSaveAndPrintChallan}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Printer size={16} />
              Save & Print Delivery Challan (PDF)
            </button>
          </div>

        </div>
      ) : (
        /* CHALLAN HISTORY LOG TABLE */
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
                Issued Component Challan Registry
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                All generated delivery challans with signatory records & re-download
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search Challans (Lot, Name, Signatory)..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    padding: '7px 12px 7px 30px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    color: '#0f172a',
                    outline: 'none',
                    width: '260px'
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px' }}>
                {filteredHistory.length} Records
              </span>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <FileSpreadsheet size={36} style={{ display: 'block', margin: '0 auto 10px auto', opacity: 0.5 }} />
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#64748b' }}>No Challans Found</div>
              <p style={{ fontSize: '12px', margin: '4px 0 14px 0' }}>Click "Challan Form" above to create and print a delivery challan.</p>
              <button
                type="button"
                onClick={() => setViewMode('form')}
                style={{
                  padding: '7px 16px', borderRadius: '7px', border: 'none',
                  background: '#0f172a', color: '#ffffff', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                ➕ Create Challan Now
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800' }}>CHALLAN NO</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800' }}>DATE & TIME</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800' }}>LOT NO</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800' }}>STYLE</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800' }}>COMPONENT NAME</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800', textAlign: 'right' }}>ISSUE PCS / QTY</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800' }}>HANDOVER SIGNATORIES</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '800', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    >
                      <td style={{ padding: '12px', fontWeight: '800', color: '#0f172a' }}>
                        {item.challanNo}
                      </td>
                      <td style={{ padding: '12px', color: '#64748b', fontSize: '11.5px' }}>
                        {item.date} {item.time}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '800', color: '#0f172a' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '11.5px', color: item.lotNo ? '#0f172a' : '#64748b' }}>
                          {item.lotNo ? `#${item.lotNo}` : 'General Issue'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#334155', fontWeight: '600' }}>
                        {item.styleName || '—'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '800', color: '#0f172a' }}>
                        {item.componentName}
                        {item.componentType && (
                          <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                            {item.componentType}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>
                        {item.issueQty} <span style={{ fontSize: '11px', color: '#64748b' }}>{item.unit}</span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '11px', color: '#475569' }}>
                        <div><strong>By:</strong> {item.issuedBy}</div>
                        <div><strong>To:</strong> {item.receivedBy}</div>
                        <div><strong>Sup:</strong> {item.supervisorName}</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const doc = generateChallanPDF(item);
                              const blobUrl = doc.output('bloburl');
                              window.open(blobUrl, '_blank');
                            }}
                            title="Print / View Challan PDF"
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#0f172a',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Printer size={12} /> Print
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteChallan(item.id, e)}
                            title="Delete"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
