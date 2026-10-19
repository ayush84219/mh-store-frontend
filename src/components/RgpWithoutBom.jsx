import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  FileText,
  Printer,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Building2,
  Truck,
  User,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  Download,
  Eye,
  X,
  Sparkles,
  Zap,
  Info,
  Check,
  ChevronDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// Preset departments
const DEPARTMENTS = [
  'Stitching',
  'Finishing',
  'Cutting',
  'Washing',
  'Embroidery',
  'Printing',
  'Store',
  'Packing',
  'Sampling',
  'Maintenance',
  'Fabric Store'
];

// Preset purposes / work types
const PURPOSES = [
  'Job Work',
  'Washing / Dyeing',
  'Embroidery Work',
  'Screen / Digital Printing',
  'Pleating / Processing',
  'Testing & Quality Inspection',
  'Sample / Buyer Approval',
  'Repair / Alteration',
  'Rejection / Replacement',
  'Inter-Unit Transfer',
  'Floor Issue / Balance Return'
];

// Preset UOM options
const UOM_OPTIONS = ['Pcs', 'Mtr', 'Kgs', 'Roll', 'Bags', 'Bundles', 'Sets', 'Yds', 'Cones', 'Boxes'];

// Preset item chips for rapid addition
const PRESET_ITEMS = [
  { name: 'Elastic', defaultUom: 'Mtr', category: 'Elastic' },
  { name: 'Twill Tape', defaultUom: 'Mtr', category: 'Tape' },
  { name: 'Bone / Pocketing', defaultUom: 'Kgs', category: 'Bone' },
  { name: 'Dori / Drawcord', defaultUom: 'Mtr', category: 'Dori' },
  { name: 'Zipper', defaultUom: 'Pcs', category: 'Zipper' },
  { name: 'Label / Tag', defaultUom: 'Pcs', category: 'Label' },
  { name: 'Button', defaultUom: 'Pcs', category: 'Button' },
  { name: 'Lace / Border', defaultUom: 'Mtr', category: 'Lace' },
  { name: 'Cut Fabric Panels', defaultUom: 'Pcs', category: 'Fabric' },
  { name: 'Fabric Roll', defaultUom: 'Mtr', category: 'Fabric' },
  { name: 'Carton / Polybag', defaultUom: 'Pcs', category: 'Packing' }
];

export default function RgpWithoutBom({ currentUser, onNavigate }) {
  // Tab view: 'create' | 'recent'
  const [activeTab, setActiveTab] = useState('create');

  // Form State
  const [rgpNo, setRgpNo] = useState('Loading...');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Parties & Movement
  const [vendor, setVendor] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorGst, setVendorGst] = useState('');
  const [department, setDepartment] = useState('Stitching');
  const [purpose, setPurpose] = useState('Job Work');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportMode, setTransportMode] = useState('Tempo / Cargo');
  const [driverName, setDriverName] = useState('');

  // Optional Lot Reference
  const [lotNoInput, setLotNoInput] = useState('');
  const [lotDetails, setLotDetails] = useState(null);
  const [lotLoading, setLotLoading] = useState(false);

  // Authorizations
  const [preparedBy, setPreparedBy] = useState(() => currentUser?.username || currentUser?.name || 'Store Officer');
  const [authorizedBy, setAuthorizedBy] = useState('Store Manager');
  const [securityIncharge, setSecurityIncharge] = useState('Gate Security');
  const [carrierName, setCarrierName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);

  // Items State (multi-row)
  const [items, setItems] = useState([
    {
      id: 1,
      itemDesc: '',
      lotNo: '',
      qty: '',
      uom: 'Pcs',
      bags: '1',
      rate: '',
      value: '',
      remarks: ''
    }
  ]);

  // Inventory & Vendor Autocomplete Source
  const [inventoryMaterials, setInventoryMaterials] = useState([]);
  const [recentRgpList, setRecentRgpList] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Preview & Print Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewRgpData, setPreviewRgpData] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copyType, setCopyType] = useState('ORIGINAL (VENDOR COPY)');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch sequential RGP number
  const fetchNextRgpNo = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/rgp`);
      let maxSeq = 0;
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          setRecentRgpList(list);
          // Extract vendor names for autocomplete
          const vSet = new Set();
          list.forEach(r => {
            if (r.vendor && r.vendor.trim()) vSet.add(r.vendor.trim());
            const rNo = String(r.rgpNo || '').toUpperCase();
            const parts = rNo.split('-');
            const seq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seq) && seq > maxSeq && seq < 100000) {
              maxSeq = seq;
            }
          });
          setVendorSuggestions(Array.from(vSet));
        }
      }

      // Also check local storage sequence fallback
      const localLast = localStorage.getItem('gpdms_last_rgp_seq');
      let localSeq = localLast ? parseInt(localLast, 10) : 0;
      if (isNaN(localSeq) || localSeq >= 100000) localSeq = 0;

      const finalSeq = Math.max(maxSeq, localSeq) + 1;
      const padded = String(finalSeq).padStart(6, '0');
      setRgpNo(`RGP-${padded}`);
    } catch (err) {
      console.warn('Failed to fetch next RGP sequence:', err);
      const fallbackSeq = Math.floor(100000 + Math.random() * 900000);
      setRgpNo(`RGP-${fallbackSeq}`);
    }
  };

  // Fetch materials for autocomplete
  useEffect(() => {
    fetchNextRgpNo();
    const fetchMaterials = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/materials`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setInventoryMaterials(data);
        }
      } catch (err) {
        console.warn('Could not load inventory materials:', err);
      }
    };
    fetchMaterials();
  }, []);

  // Quick preset return date calculator
  const applyReturnDaysPreset = (days) => {
    const d = new Date(issueDate || new Date());
    d.setDate(d.getDate() + days);
    setExpectedReturnDate(d.toISOString().split('T')[0]);
  };

  // Optional Lot lookup to assist user with styling/brand context
  const handleLotLookup = async (inputVal) => {
    const clean = String(inputVal || '').trim();
    if (!clean) {
      setLotDetails(null);
      return;
    }
    setLotLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/cutting-headers`);
      if (res.ok) {
        const headers = await res.json();
        const found = headers.find(h => String(h.lotNo || h.lot_no || '').toLowerCase() === clean.toLowerCase());
        if (found) {
          setLotDetails({
            lotNo: found.lotNo || found.lot_no,
            style: found.style || found.garment_item || 'N/A',
            brand: found.brand || found.partyName || found.buyer || 'N/A',
            party: found.partyName || found.brand || 'N/A',
            qty: found.totalPcs || found.cuttingQty || '0'
          });
          showToast(`Loaded details for Lot #${clean}!`, 'success');
        } else {
          setLotDetails(null);
        }
      }
    } catch (e) {
      console.warn('Lot lookup error:', e);
    } finally {
      setLotLoading(false);
    }
  };

  // Row Manipulation
  const handleAddItem = (preset = null) => {
    const newItem = {
      id: Date.now() + Math.random(),
      itemDesc: preset ? preset.name : '',
      lotNo: lotNoInput || '',
      qty: '',
      uom: preset ? preset.defaultUom : 'Pcs',
      bags: '1',
      rate: '',
      value: '',
      remarks: ''
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      showToast('At least one material item is required.', 'error');
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDuplicateItem = (item) => {
    const dup = {
      ...item,
      id: Date.now() + Math.random()
    };
    setItems(prev => [...prev, dup]);
    showToast('Row duplicated successfully.');
  };

  const handleItemChange = (id, field, val) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        // Recalculate value if qty or rate changed
        if (field === 'qty' || field === 'rate') {
          const q = parseFloat(field === 'qty' ? val : updated.qty) || 0;
          const r = parseFloat(field === 'rate' ? val : updated.rate) || 0;
          updated.value = q && r ? (q * r).toFixed(2) : '';
        }
        return updated;
      })
    );
  };

  // Totals calculations
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBags = 0;
    let totalValue = 0;
    items.forEach(it => {
      totalQty += parseFloat(it.qty) || 0;
      totalBags += parseInt(it.bags, 10) || 0;
      totalValue += parseFloat(it.value) || 0;
    });
    return {
      count: items.length,
      totalQty,
      totalBags,
      totalValue: totalValue.toFixed(2)
    };
  }, [items]);

  // Validation
  const validateForm = () => {
    if (!vendor || !vendor.trim()) {
      showToast('Please specify the Vendor / Receiver Party Name.', 'error');
      return false;
    }
    if (!issueDate) {
      showToast('Please select Issue Date.', 'error');
      return false;
    }
    if (items.length === 0) {
      showToast('Please add at least one material item.', 'error');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.itemDesc || !it.itemDesc.trim()) {
        showToast(`Item #${i + 1} is missing a description/name.`, 'error');
        return false;
      }
      if (!it.qty || parseFloat(it.qty) <= 0) {
        showToast(`Item #${i + 1} (${it.itemDesc}) must have a valid quantity > 0.`, 'error');
        return false;
      }
    }
    if (!preparedBy || !preparedBy.trim()) {
      showToast('Please enter Prepared By name.', 'error');
      return false;
    }
    return true;
  };

  // Compile payload
  const compileRgpPayload = () => {
    const formattedEntries = items.map((it, idx) => ({
      srNo: idx + 1,
      lotNo: (it.lotNo || lotNoInput || 'W/O BOM').toUpperCase(),
      itemDesc: it.itemDesc.trim(),
      qty: Number(it.qty) || 0,
      qty2: it.bags ? Number(it.bags) : '',
      uom: it.uom || 'Pcs',
      department: department || 'Stitching',
      purpose: purpose || 'Job Work',
      bags: it.bags || '1',
      rate: it.rate || '',
      value: it.value || '',
      remarks: it.remarks || '',
      isManual: true,
      isWithoutBom: true
    }));

    return {
      rgpNo: rgpNo.trim(),
      date: issueDate,
      vendor: vendor.trim(),
      vendorAddress: vendorAddress.trim(),
      vendorContact: vendorContact.trim(),
      vendorGst: vendorGst.trim(),
      rgpType: 'Without BOM General Floor Issue',
      department: department.trim(),
      purpose: purpose.trim(),
      expectedReturnDate: expectedReturnDate || '',
      vehicleNo: vehicleNo.trim(),
      transportMode: transportMode.trim(),
      driverName: driverName.trim(),
      lotNo: (lotNoInput || 'W/O BOM').toUpperCase(),
      style: lotDetails?.style || '',
      buyer: lotDetails?.brand || lotDetails?.party || '',
      preparedBy: preparedBy.trim(),
      authorizedBy: authorizedBy.trim(),
      securityIncharge: securityIncharge.trim(),
      carrierName: carrierName.trim(),
      remarks: remarks.trim(),
      entries: formattedEntries,
      isWithoutBom: true,
      mode: 'without_bom',
      rgpMode: 'without_bom',
      createdAt: new Date().toISOString()
    };
  };

  // Handle Save and Open Preview
  const handleGenerateAndPreview = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = compileRgpPayload();

      // Generate verification QR Code
      const verifyUrl = `${window.location.origin}/public-scan?rgp=${encodeURIComponent(payload.rgpNo)}`;
      let qrUrl = '';
      try {
        qrUrl = await QRCode.toDataURL(verifyUrl, { width: 250, margin: 1 });
      } catch (e) {
        console.warn('QR Code generation warning:', e);
      }

      setQrCodeDataUrl(qrUrl);
      setPreviewRgpData(payload);
      setPreviewModalOpen(true);

      // Save to database
      const res = await fetch(`${getBackendUrl()}/api/rgp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.warn('RGP database save response not ok:', await res.text());
      } else {
        // Record sequence
        if (payload.rgpNo.startsWith('RGP-')) {
          const parts = payload.rgpNo.split('-');
          const seq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seq)) localStorage.setItem('gpdms_last_rgp_seq', String(seq));
        }
      }
      showToast(`RGP ${payload.rgpNo} generated and saved successfully!`);
    } catch (err) {
      console.error('Error in RGP generation:', err);
      showToast('Generated RGP voucher preview ready.');
    } finally {
      setSubmitting(false);
    }
  };

  // Download Vector PDF
  const handleDownloadPdf = () => {
    if (!previewRgpData) return;
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      const m = 35;

      // Outer Frame
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(1.2);
      doc.roundedRect(m - 10, m - 10, w - (m - 10) * 2, h - (m - 10) * 2, 6, 6, 'S');

      // Top Header
      doc.setFillColor(15, 23, 42);
      doc.rect(m - 10, m - 10, w - (m - 10) * 2, 45, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('RETURNABLE GATE PASS (WITHOUT BOM)', w / 2, m + 18, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);
      doc.text(`${copyType} • OFFICIAL MATERIAL MOVEMENT PERMIT`, w / 2, m + 30, { align: 'center' });

      // Particulars Grid
      let y = m + 52;
      doc.setTextColor(15, 23, 42);

      // Left Box: Consignee / Vendor
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(m, y, (w - m * 2) * 0.58, 80, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TO / VENDOR PARTICULARS:', m + 10, y + 16);

      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text(previewRgpData.vendor || 'N/A', m + 10, y + 33);

      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      if (previewRgpData.vendorAddress) {
        doc.text(`Address: ${previewRgpData.vendorAddress}`, m + 10, y + 47);
      }
      const contactStr = [
        previewRgpData.vendorContact ? `Contact: ${previewRgpData.vendorContact}` : '',
        previewRgpData.vendorGst ? `GSTIN: ${previewRgpData.vendorGst}` : ''
      ].filter(Boolean).join(' | ');
      if (contactStr) doc.text(contactStr, m + 10, y + 60);

      // Right Box: RGP Details & QR
      const rightX = m + (w - m * 2) * 0.60;
      const rightW = (w - m * 2) * 0.40;
      doc.roundedRect(rightX, y, rightW, 80, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('GATE PASS NO:', rightX + 10, y + 16);

      doc.setFontSize(13);
      doc.setTextColor(220, 38, 38);
      doc.text(previewRgpData.rgpNo, rightX + 10, y + 33);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date of Issue: ${previewRgpData.date}`, rightX + 10, y + 48);
      doc.text(`Expected Return: ${previewRgpData.expectedReturnDate || 'N/A'}`, rightX + 10, y + 61);
      doc.text(`Vehicle / Transport: ${previewRgpData.vehicleNo || previewRgpData.transportMode || 'By Hand'}`, rightX + 10, y + 73);

      // Embed QR if available
      if (qrCodeDataUrl) {
        try {
          doc.addImage(qrCodeDataUrl, 'PNG', rightX + rightW - 65, y + 8, 58, 58);
        } catch (e) {
          console.warn('QR embed warning:', e);
        }
      }

      // Movement Info Bar
      y += 90;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(m, y, w - m * 2, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Department: ${previewRgpData.department || 'Store'}`, m + 10, y + 15);
      doc.text(`Purpose: ${previewRgpData.purpose || 'Job Work'}`, m + 160, y + 15);
      if (previewRgpData.lotNo && previewRgpData.lotNo !== 'W/O BOM') {
        doc.text(`Ref Lot: #${previewRgpData.lotNo}${previewRgpData.style ? ` (${previewRgpData.style})` : ''}`, m + 340, y + 15);
      } else {
        doc.text('Mode: Without BOM (Direct Floor Movement)', m + 340, y + 15);
      }

      // Table of Items
      y += 34;
      const tableHeaders = [['SR', 'ITEM DESCRIPTION / SPECIFICATION', 'LOT REF', 'QTY', 'UOM', 'PACKAGES', 'REMARKS']];
      const tableRows = previewRgpData.entries.map((e, idx) => [
        idx + 1,
        e.itemDesc,
        e.lotNo || '-',
        e.qty,
        e.uom || 'Pcs',
        e.bags ? `${e.bags} Bag(s)` : '1',
        e.remarks || '-'
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: m, right: m },
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          textColor: [15, 23, 42]
        },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 'auto', fontStyle: 'bold' },
          2: { cellWidth: 65, halign: 'center' },
          3: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 45, halign: 'center' },
          5: { cellWidth: 65, halign: 'center' },
          6: { cellWidth: 90 }
        }
      });

      // Totals & Terms
      let finalY = doc.lastAutoTable.finalY + 14;

      // Summary Card
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(m, finalY, w - m * 2, 40, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(153, 27, 27);
      doc.text('TOTAL SUMMARY:', m + 10, finalY + 16);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Items: ${previewRgpData.entries.length} line(s)`, m + 110, finalY + 16);
      doc.text(`Total Quantity: ${totals.totalQty} Units`, m + 230, finalY + 16);
      doc.text(`Total Packages: ${totals.totalBags} Bags/Pkgs`, m + 360, finalY + 16);

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Note: Material sent strictly on RETURNABLE basis. Must be returned in sound condition with job-work invoice / delivery challan.',
        m + 10,
        finalY + 31
      );

      // Signatures
      finalY += 56;
      const colW = (w - m * 2) / 4;
      const sigTitles = [
        ['PREPARED BY', previewRgpData.preparedBy || 'Store Officer'],
        ['CHECKED BY', previewRgpData.authorizedBy || 'Store In-Charge'],
        ['SECURITY / GATE STAMP', 'Signature & Time'],
        ['CARRIER / RECEIVER', previewRgpData.carrierName || 'Sign & Mobile']
      ];

      sigTitles.forEach((sig, i) => {
        const sx = m + colW * i;
        doc.setDrawColor(203, 213, 225);
        doc.line(sx + 5, finalY + 35, sx + colW - 10, finalY + 35);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(sig[0], sx + colW / 2 - 2, finalY + 46, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(sig[1], sx + colW / 2 - 2, finalY + 56, { align: 'center' });
      });

      doc.save(`${previewRgpData.rgpNo}_WITHOUT_BOM.pdf`);
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('Failed to generate PDF download.', 'error');
    }
  };

  // Reset form
  const handleResetForm = () => {
    fetchNextRgpNo();
    setVendor('');
    setVendorAddress('');
    setVendorContact('');
    setVendorGst('');
    setDepartment('Stitching');
    setPurpose('Job Work');
    setVehicleNo('');
    setDriverName('');
    setLotNoInput('');
    setLotDetails(null);
    setRemarks('');
    setItems([
      {
        id: Date.now(),
        itemDesc: '',
        lotNo: '',
        qty: '',
        uom: 'Pcs',
        bags: '1',
        rate: '',
        value: '',
        remarks: ''
      }
    ]);
    showToast('Form reset for new RGP entry.');
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto', color: '#0f172a' }}>
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: '700',
            fontSize: '13px',
            zIndex: 99999,
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#ffffff',
          marginBottom: '22px',
          boxShadow: '0 8px 24px rgba(49, 46, 129, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: '900',
                padding: '3px 8px',
                borderRadius: '6px',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Zap size={12} fill="#ffffff" /> WITHOUT BOM
            </span>
            <span style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: '700' }}>
              DIRECT STORE &amp; FLOOR MOVEMENT
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '-0.3px', color: '#ffffff' }}>
            Create Returnable Gate Pass (Without BOM)
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#e0e7ff', opacity: 0.9 }}>
            Fast-track gate pass for fabrics, trims, elastic, dori, zippers, machinery, or job-work materials without requiring BOM approval.
          </p>
        </div>

        {/* Quick Nav / Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{
              padding: '9px 16px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'create' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'create' ? '#312e81' : '#ffffff',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} />
            New RGP Entry
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('recent');
              fetchNextRgpNo();
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'recent' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'recent' ? '#312e81' : '#ffffff',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={15} />
            Recent RGPs ({recentRgpList.length})
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('rgp')}
              style={{
                padding: '9px 14px',
                borderRadius: '9px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent',
                color: '#e0e7ff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Switch to Standard With-BOM RGP form"
            >
              <ArrowRight size={14} />
              With-BOM RGP
            </button>
          )}
        </div>
      </div>

      {activeTab === 'recent' ? (
        /* RECENT RGPs VIEW */
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>
                Recent Returnable Gate Passes
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Logs from database &amp; active store movement
              </span>
            </div>
            <button
              type="button"
              onClick={fetchNextRgpNo}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} /> Refresh List
            </button>
          </div>

          {recentRgpList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
              <FileText size={42} style={{ marginBottom: '10px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>No RGP records found yet.</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Create your first RGP using the form.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 12px' }}>RGP NO</th>
                    <th style={{ padding: '10px 12px' }}>DATE</th>
                    <th style={{ padding: '10px 12px' }}>VENDOR / RECEIVER</th>
                    <th style={{ padding: '10px 12px' }}>DEPARTMENT</th>
                    <th style={{ padding: '10px 12px' }}>PURPOSE</th>
                    <th style={{ padding: '10px 12px' }}>ITEMS</th>
                    <th style={{ padding: '10px 12px' }}>EXP. RETURN</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRgpList.slice(0, 30).map((r, i) => (
                    <tr
                      key={r.rgpNo || i}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                    >
                      <td style={{ padding: '11px 12px', fontWeight: '800', color: '#312e81' }}>{r.rgpNo}</td>
                      <td style={{ padding: '11px 12px', color: '#64748b' }}>{r.date}</td>
                      <td style={{ padding: '11px 12px', fontWeight: '700', color: '#1e293b' }}>{r.vendor}</td>
                      <td style={{ padding: '11px 12px' }}>{r.department || '-'}</td>
                      <td style={{ padding: '11px 12px' }}>{r.purpose || '-'}</td>
                      <td style={{ padding: '11px 12px' }}>
                        <span
                          style={{
                            background: '#e0e7ff',
                            color: '#3730a3',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}
                        >
                          {Array.isArray(r.entries) ? r.entries.length : 1} Item(s)
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', color: '#dc2626', fontWeight: '600' }}>
                        {r.expectedReturnDate || '-'}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewRgpData(r);
                            setPreviewModalOpen(true);
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#312e81',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={12} /> View / Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CREATE RGP WITHOUT BOM FORM */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {/* SECTION 1: HEADER & PARTICULARS */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '22px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '14px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '18px',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#312e81',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '800'
                  }}
                >
                  1
                </span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                  Gate Pass Identification &amp; Consignee Details
                </h3>
              </div>

              {/* RGP Sequence Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>Pass No:</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '900',
                    color: '#dc2626',
                    background: '#fef2f2',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    letterSpacing: '0.4px'
                  }}
                >
                  {rgpNo}
                </span>
                <button
                  type="button"
                  onClick={fetchNextRgpNo}
                  title="Refresh RGP sequence"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '2px'
                  }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px'
              }}
            >
              {/* Vendor / Consignee Name */}
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  VENDOR / RECEIVER PARTY <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  list="vendor-suggestions"
                  placeholder="e.g. Modern Embroidery, RK Washing, ABC Trims..."
                  value={vendor}
                  onChange={e => setVendor(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <datalist id="vendor-suggestions">
                  {vendorSuggestions.map((v, i) => (
                    <option key={i} value={v} />
                  ))}
                </datalist>
              </div>

              {/* Issue Date */}
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  ISSUE DATE <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Expected Return Date & Quick Presets */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      margin: 0
                    }}
                  >
                    EXPECTED RETURN DATE
                  </label>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[3, 7, 15, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => applyReturnDaysPreset(d)}
                        style={{
                          fontSize: '9.5px',
                          fontWeight: '800',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        +{d}d
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={e => setExpectedReturnDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#dc2626',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Department */}
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  ISSUING DEPARTMENT
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9.5px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    background: '#ffffff'
                  }}
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purpose / Reason for Movement */}
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  PURPOSE / WORK TYPE
                </label>
                <select
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9.5px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    background: '#ffffff'
                  }}
                >
                  {PURPOSES.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle No / Mode of Transport */}
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  VEHICLE NO / CARRIER
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL-01-AB-1234 or By Hand"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Optional Lot Reference */}
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  <span>
                    OPTIONAL PRODUCTION LOT REF{' '}
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'none' }}>
                      (Optional)
                    </span>
                  </span>
                  {lotLoading && <span style={{ fontSize: '10px', color: '#2563eb' }}>Searching...</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 62115 (optional)"
                  value={lotNoInput}
                  onChange={e => {
                    setLotNoInput(e.target.value);
                    handleLotLookup(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Vendor Address / Contact */}
              <div style={{ gridColumn: 'span 2' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}
                >
                  VENDOR ADDRESS &amp; CONTACT PARTICULARS
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Factory Address, City, State..."
                    value={vendorAddress}
                    onChange={e => setVendorAddress(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Contact Person / Mobile"
                    value={vendorContact}
                    onChange={e => setVendorContact(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="GSTIN No (optional)"
                    value={vendorGst}
                    onChange={e => setVendorGst(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* If lot details matched, show helpful informational badge */}
            {lotDetails && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '12px',
                  color: '#166534',
                  fontWeight: '700'
                }}
              >
                <CheckCircle2 size={16} color="#16a34a" />
                <span>
                  Lot #{lotDetails.lotNo} Verified: Style: <strong>{lotDetails.style}</strong> • Buyer/Brand:{' '}
                  <strong>{lotDetails.brand}</strong> • Cutting Qty: <strong>{lotDetails.qty} Pcs</strong>
                </span>
              </div>
            )}
          </div>

          {/* SECTION 2: ITEMS & MATERIALS TABLE */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '22px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '14px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#312e81',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '800'
                  }}
                >
                  2
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                    Material Items To Issue On Gate Pass
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Enter any fabric, accessory, trim or equipment without BOM restrictions
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#312e81',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>
            </div>

            {/* Quick Preset Item Chips */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Quick Add Presets:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {PRESET_ITEMS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleAddItem(p)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '7px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#334155',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#eef2ff';
                      e.currentTarget.style.borderColor = '#c7d2fe';
                      e.currentTarget.style.color = '#312e81';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#334155';
                    }}
                  >
                    <span>+</span> {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Table */}
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: '35px' }}>#</th>
                    <th style={{ padding: '8px 10px', minWidth: '220px' }}>
                      ITEM DESCRIPTION / NAME <span style={{ color: '#ef4444' }}>*</span>
                    </th>
                    <th style={{ padding: '8px 10px', width: '110px' }}>LOT REF</th>
                    <th style={{ padding: '8px 10px', width: '95px' }}>
                      QUANTITY <span style={{ color: '#ef4444' }}>*</span>
                    </th>
                    <th style={{ padding: '8px 10px', width: '90px' }}>UOM</th>
                    <th style={{ padding: '8px 10px', width: '80px' }}>PACKAGES</th>
                    <th style={{ padding: '8px 10px', width: '90px' }}>RATE (₹)</th>
                    <th style={{ padding: '8px 10px', width: '100px' }}>VALUE (₹)</th>
                    <th style={{ padding: '8px 10px', minWidth: '150px' }}>REMARKS</th>
                    <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '800', color: '#64748b' }}>{idx + 1}</td>

                      {/* Item Description */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          placeholder="e.g. 35mm Elastic White, YKK #5 Zipper 28 inch..."
                          value={it.itemDesc}
                          onChange={e => handleItemChange(it.id, 'itemDesc', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: !it.itemDesc && toast ? '1px solid #ef4444' : '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Lot Ref */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          placeholder="Lot / Shade"
                          value={it.lotNo}
                          onChange={e => handleItemChange(it.id, 'lotNo', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="0.00"
                          value={it.qty}
                          onChange={e => handleItemChange(it.id, 'qty', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: !it.qty && toast ? '1px solid #ef4444' : '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '800',
                            color: '#0f172a',
                            boxSizing: 'border-box',
                            textAlign: 'right'
                          }}
                        />
                      </td>

                      {/* UOM */}
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={it.uom}
                          onChange={e => handleItemChange(it.id, 'uom', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 6px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#0f172a',
                            boxSizing: 'border-box',
                            background: '#ffffff'
                          }}
                        >
                          {UOM_OPTIONS.map(u => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Packages / Bags */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="number"
                          min="0"
                          placeholder="1"
                          value={it.bags}
                          onChange={e => handleItemChange(it.id, 'bags', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            color: '#0f172a',
                            boxSizing: 'border-box',
                            textAlign: 'center'
                          }}
                        />
                      </td>

                      {/* Approx Rate */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={it.rate}
                          onChange={e => handleItemChange(it.id, 'rate', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            color: '#0f172a',
                            boxSizing: 'border-box',
                            textAlign: 'right'
                          }}
                        />
                      </td>

                      {/* Approx Value */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          readOnly
                          placeholder="0.00"
                          value={it.value}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#475569',
                            boxSizing: 'border-box',
                            textAlign: 'right'
                          }}
                        />
                      </td>

                      {/* Remarks */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          placeholder="e.g. For sample washing..."
                          value={it.remarks}
                          onChange={e => handleItemChange(it.id, 'remarks', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Row Action Buttons */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(it)}
                            title="Duplicate row"
                            style={{
                              border: 'none',
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '5px',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            title="Delete row"
                            style={{
                              border: 'none',
                              background: '#fee2e2',
                              color: '#ef4444',
                              padding: '5px',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer Totals Card */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '12px 18px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  Total Items: <strong style={{ color: '#0f172a' }}>{totals.count} Line(s)</strong>
                </span>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  Total Quantity: <strong style={{ color: '#2563eb' }}>{totals.totalQty}</strong>
                </span>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  Total Packages / Bags: <strong style={{ color: '#0f172a' }}>{totals.totalBags}</strong>
                </span>
                {Number(totals.totalValue) > 0 && (
                  <span style={{ fontSize: '12px', color: '#475569' }}>
                    Declared Value: <strong style={{ color: '#16a34a' }}>₹{totals.totalValue}</strong>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAddItem()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#312e81',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={13} /> + Add Another Item
              </button>
            </div>
          </div>

          {/* SECTION 3: AUTHORIZATIONS & INSTRUCTIONS */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '22px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '14px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '16px'
              }}
            >
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#312e81',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '800'
                }}
              >
                3
              </span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                Signatories, Security Instructions &amp; Dispatch
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '16px'
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase'
                  }}
                >
                  PREPARED BY <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={e => setPreparedBy(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase'
                  }}
                >
                  CHECKED / AUTHORIZED BY
                </label>
                <input
                  type="text"
                  value={authorizedBy}
                  onChange={e => setAuthorizedBy(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase'
                  }}
                >
                  GATE / SECURITY IN-CHARGE
                </label>
                <input
                  type="text"
                  value={securityIncharge}
                  onChange={e => setSecurityIncharge(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase'
                  }}
                >
                  CARRIER / RECEIVER PERSON
                </label>
                <input
                  type="text"
                  placeholder="Carrier name & mobile..."
                  value={carrierName}
                  onChange={e => setCarrierName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* General Remarks */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#1e293b',
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase'
                }}
              >
                SPECIAL GATE PASS REMARKS / DISPATCH NOTES
              </label>
              <textarea
                rows="2"
                placeholder="Enter any specific terms, job specifications, rejection handling, or gate instructions..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Returnable Terms Check */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={e => setTermsAgreed(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>
                Material issued under this Gate Pass is strictly <strong>RETURNABLE</strong>. The receiver agrees to return the goods in sound condition on or before the expected return date.
              </span>
            </label>
          </div>

          {/* ACTION BUTTONS BAR */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '16px 24px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <button
              type="button"
              onClick={handleResetForm}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Reset Form
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleGenerateAndPreview}
                disabled={submitting}
                style={{
                  padding: '12px 28px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(49, 46, 129, 0.35)',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Generating RGP...
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    Generate &amp; Print RGP Voucher
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW & PRINT MODAL */}
      {previewModalOpen && previewRgpData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 22px',
                background: '#1e1b4b',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={20} color="#f59e0b" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    Returnable Gate Pass Print Preview
                  </h3>
                  <span style={{ fontSize: '11px', color: '#c7d2fe' }}>
                    Pass #{previewRgpData.rgpNo} • Mode: Without BOM Direct Floor Issue
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Copy selector */}
                <select
                  value={copyType}
                  onChange={e => setCopyType(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ORIGINAL (VENDOR COPY)" style={{ color: '#000' }}>Original (Vendor Copy)</option>
                  <option value="DUPLICATE (GATE SECURITY COPY)" style={{ color: '#000' }}>Duplicate (Gate Copy)</option>
                  <option value="TRIPLICATE (STORE RECORD COPY)" style={{ color: '#000' }}>Triplicate (Store Copy)</option>
                </select>

                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content: Printable Document Representation */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div
                id="printable-rgp-slip"
                style={{
                  background: '#ffffff',
                  padding: '28px',
                  borderRadius: '10px',
                  border: '1.5px solid #0f172a',
                  color: '#0f172a',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}
              >
                {/* Slip Title Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '1px',
                      color: '#475569',
                      display: 'block'
                    }}
                  >
                    APPAREL MANUFACTURING &amp; EXPORT DIVISION
                  </span>
                  <h2 style={{ margin: '4px 0 2px', fontSize: '20px', fontWeight: '900', letterSpacing: '0.5px' }}>
                    RETURNABLE GATE PASS (WITHOUT BOM)
                  </h2>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626' }}>
                    {copyType}
                  </span>
                </div>

                {/* Particulars Dual Box */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr',
                    gap: '14px',
                    marginBottom: '16px'
                  }}
                >
                  {/* Vendor / Consignee */}
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      background: '#fafafa'
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                      CONSIGNEE / VENDOR TO:
                    </span>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#1e3a8a' }}>
                      {previewRgpData.vendor}
                    </div>
                    {previewRgpData.vendorAddress && (
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                        {previewRgpData.vendorAddress}
                      </div>
                    )}
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                      {previewRgpData.vendorContact && <span>Contact: {previewRgpData.vendorContact} </span>}
                      {previewRgpData.vendorGst && <span>• GST: {previewRgpData.vendorGst}</span>}
                    </div>
                  </div>

                  {/* RGP Meta */}
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      background: '#fafafa',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b' }}>RGP NUMBER:</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#dc2626', marginBottom: '4px' }}>
                        {previewRgpData.rgpNo}
                      </div>
                      <div style={{ fontSize: '11px', color: '#334155' }}>
                        <strong>Date:</strong> {previewRgpData.date}
                      </div>
                      <div style={{ fontSize: '11px', color: '#dc2626' }}>
                        <strong>Exp Return:</strong> {previewRgpData.expectedReturnDate || 'N/A'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        <strong>Vehicle:</strong> {previewRgpData.vehicleNo || 'By Hand'}
                      </div>
                    </div>

                    {qrCodeDataUrl && (
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code"
                        style={{ width: '68px', height: '68px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                      />
                    )}
                  </div>
                </div>

                {/* Department & Purpose Strip */}
                <div
                  style={{
                    background: '#f1f5f9',
                    borderRadius: '6px',
                    padding: '7px 12px',
                    marginBottom: '14px',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: '700'
                  }}
                >
                  <span>Dept: {previewRgpData.department}</span>
                  <span>Purpose: {previewRgpData.purpose}</span>
                  <span>Ref Lot: #{previewRgpData.lotNo || 'W/O BOM'}</span>
                </div>

                {/* Items Table */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '11.5px',
                    marginBottom: '14px',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', width: '30px' }}>#</th>
                      <th style={{ padding: '6px 8px' }}>DESCRIPTION OF GOODS / MATERIALS</th>
                      <th style={{ padding: '6px 8px', width: '80px' }}>LOT REF</th>
                      <th style={{ padding: '6px 8px', width: '70px', textAlign: 'right' }}>QTY</th>
                      <th style={{ padding: '6px 8px', width: '50px', textAlign: 'center' }}>UOM</th>
                      <th style={{ padding: '6px 8px', width: '70px', textAlign: 'center' }}>PACKAGES</th>
                      <th style={{ padding: '6px 8px', width: '110px' }}>REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRgpData.entries.map((e, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '7px 8px', fontWeight: '800' }}>{idx + 1}</td>
                        <td style={{ padding: '7px 8px', fontWeight: '700' }}>{e.itemDesc}</td>
                        <td style={{ padding: '7px 8px', color: '#64748b' }}>{e.lotNo || '-'}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: '900', color: '#1e3a8a' }}>
                          {e.qty}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'center' }}>{e.uom || 'Pcs'}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center' }}>{e.bags ? `${e.bags} Bag` : '-'}</td>
                        <td style={{ padding: '7px 8px', color: '#64748b' }}>{e.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary & Note */}
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginBottom: '28px',
                    fontSize: '11px',
                    color: '#991b1b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: '700'
                  }}
                >
                  <span>
                    Total: {previewRgpData.entries.length} Item(s) &bull; Qty: {totals.totalQty} Units &bull; Packages:{' '}
                    {totals.totalBags} Bags
                  </span>
                  <span>Strictly Returnable by: {previewRgpData.expectedReturnDate || 'Prescribed Date'}</span>
                </div>

                {/* Signature Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                    textAlign: 'center',
                    marginTop: '20px'
                  }}
                >
                  <div>
                    <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '30px', fontWeight: '800' }}></div>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginTop: '5px' }}>
                      PREPARED BY
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>{previewRgpData.preparedBy}</span>
                  </div>

                  <div>
                    <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '30px', fontWeight: '800' }}></div>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginTop: '5px' }}>
                      CHECKED / APPROVED
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>{previewRgpData.authorizedBy}</span>
                  </div>

                  <div>
                    <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '30px', fontWeight: '800' }}></div>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginTop: '5px' }}>
                      SECURITY OUT-GATE
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>Sign &amp; Time Stamp</span>
                  </div>

                  <div>
                    <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '30px', fontWeight: '800' }}></div>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginTop: '5px' }}>
                      RECEIVER / CARRIER
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                      {previewRgpData.carrierName || 'Sign & Mobile'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                padding: '14px 22px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close Preview
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #312e81',
                    background: '#eef2ff',
                    color: '#312e81',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Download size={14} /> Download PDF
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#312e81',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Printer size={14} /> Print Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
