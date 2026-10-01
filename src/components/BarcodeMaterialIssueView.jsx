import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Scan, 
  Barcode, 
  QrCode, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Printer, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  ArrowRight, 
  FileText, 
  Layers, 
  User, 
  Building2, 
  Sparkles, 
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  Camera, 
  CameraOff, 
  Calendar, 
  History, 
  Hash, 
  Scale,
  Boxes,
  Send,
  Eye,
  ShoppingBag,
  Clock,
  MapPin,
  Tag
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Sound feedback helper using Web Audio API
const playFeedbackSound = (type = 'success') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'scan') {
      // Crisp high-pitch double chirp on barcode scan
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } else if (type === 'success') {
      // Pleasant victory chime on successful issue
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.36);
    } else if (type === 'error') {
      // Low buzz on shortage/error
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch (e) {
    // Audio context may be restricted by browser policy before user interaction
  }
};

// Visual Barcode SVG generator
const BarcodeVisual = ({ code, height = 38 }) => {
  const str = String(code || 'MT1000-A01');
  let currentX = 4;
  const bars = [];
  const startPattern = [2, 1, 1, 2, 1, 4];
  let isBar = true;
  startPattern.forEach((w, idx) => {
    if (isBar) {
      bars.push(<rect key={`st-${idx}`} x={currentX} y={0} width={w * 1.4} height={height} fill="currentColor" />);
    }
    currentX += w * 1.4;
    isBar = !isBar;
  });

  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const b1 = (charCode % 3) + 1;
    const s1 = ((charCode >> 1) % 2) + 1;
    const b2 = ((charCode >> 2) % 3) + 1;
    const s2 = ((charCode >> 3) % 2) + 1;
    const b3 = ((charCode >> 4) % 2) + 1;
    const s3 = 11 - (b1 + s1 + b2 + s2 + b3);
    const widths = [b1, Math.max(1, s1), b2, Math.max(1, s2), b3, Math.max(1, s3)];
    let barFlag = true;
    widths.forEach((w, wIdx) => {
      if (barFlag) {
        bars.push(<rect key={`c-${i}-${wIdx}`} x={currentX} y={0} width={w * 1.2} height={height} fill="currentColor" />);
      }
      currentX += w * 1.2;
      barFlag = !barFlag;
    });
  }

  [2, 3, 3, 1, 1, 1, 2].forEach((w, idx) => {
    bars.push(<rect key={`sp-${idx}`} x={currentX} y={0} width={w * 1.2} height={height} fill="currentColor" />);
    currentX += w * 1.2;
  });

  const totalWidth = Math.max(140, Math.ceil(currentX + 8));

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={totalWidth} height={height} style={{ overflow: 'visible' }}>
        {bars}
      </svg>
      <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', letterSpacing: '2px', marginTop: '2px' }}>
        {str}
      </span>
    </div>
  );
};

export default function BarcodeMaterialIssueView({
  materials = [],
  designs = [],
  onIssueMaterials,
  onReturnMaterials,
  issueLogs = [],
  currencySymbol = '₹',
  currentUser = null,
  onRedirectToTab
}) {
  // ── State Variables ──────────────────────────────────────────────────────────
  const [scanInput, setScanInput] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [scannedPacketInfo, setScannedPacketInfo] = useState(null);
  
  // Issue Parameters
  const [issueQty, setIssueQty] = useState(1);
  const [lotNumber, setLotNumber] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDept, setReceiverDept] = useState('Cutting');
  const [personName, setPersonName] = useState(currentUser?.name || 'Store Operator');
  const [remarks, setRemarks] = useState('');
  
  // Modes & UI controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [issueCart, setIssueCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  
  // Camera scanning state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const scannerInputRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Keep scanner input focused
  useEffect(() => {
    if (scannerInputRef.current && !cameraActive) {
      scannerInputRef.current.focus();
    }
  }, [cameraActive, successNotice]);

  // Sync issuer name with current user
  useEffect(() => {
    if (currentUser?.name && (!personName || personName === 'Store Operator')) {
      setPersonName(currentUser.name);
    }
  }, [currentUser]);

  // ── Barcode Resolution Logic ──────────────────────────────────────────────
  const resolveMaterialFromBarcode = (rawCode) => {
    if (!rawCode || !rawCode.trim()) return null;
    const cleanCode = rawCode.trim();
    const upperCode = cleanCode.toUpperCase();

    // 1. Check for exact ID match
    let match = materials.find(m => String(m.id).toUpperCase() === upperCode);
    let packetMatch = null;

    // 2. Check for Packet Barcode Pattern: e.g. "MT1001-A01" or "1001-A02"
    if (!match && upperCode.includes('-A')) {
      const parts = upperCode.split('-A');
      const baseCode = parts[0];
      const pktNum = parseInt(parts[1], 10);
      match = materials.find(m => 
        String(m.id).toUpperCase() === baseCode || 
        String(m.materialCode || '').toUpperCase() === baseCode
      );
      if (match) {
        const totalPkts = Math.max(1, parseInt(match.packets || 1, 10));
        const pktWeight = Math.round((Number(match.stock || 0) / totalPkts) * 100) / 100;
        packetMatch = {
          packetNumber: pktNum || 1,
          totalPackets: totalPkts,
          packetWeight: pktWeight,
          packetBarcode: cleanCode
        };
      }
    }

    // 3. Check for barcodeId / materialCode field match
    if (!match) {
      match = materials.find(m => 
        String(m.barcodeId || '').toUpperCase() === upperCode ||
        String(m.materialCode || '').toUpperCase() === upperCode
      );
    }

    // 4. Fuzzy fallback search on ID or Name
    if (!match) {
      match = materials.find(m => 
        String(m.id).toUpperCase().includes(upperCode) ||
        String(m.name || '').toUpperCase().includes(upperCode)
      );
    }

    return { material: match || null, packetInfo: packetMatch };
  };

  // Handle Scan Submit (from USB scanner Enter key or manual input)
  const handleScanSubmit = (e) => {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;

    setErrorMessage('');
    const { material, packetInfo } = resolveMaterialFromBarcode(scanInput);

    if (!material) {
      if (soundEnabled) playFeedbackSound('error');
      setErrorMessage(`❌ No material found for scanned barcode: "${scanInput}". Please verify or select from the directory.`);
      return;
    }

    if (soundEnabled) playFeedbackSound('scan');
    
    setScannedBarcode(scanInput.trim());
    setSelectedMaterial(material);
    setScannedPacketInfo(packetInfo);

    // If packet barcode was scanned, suggest its single packet weight or default 1
    if (packetInfo && packetInfo.packetWeight > 0) {
      setIssueQty(Math.min(packetInfo.packetWeight, material.stock));
    } else {
      setIssueQty(material.stock > 0 ? (material.stock >= 1 ? 1 : material.stock) : 0);
    }

    // In batch mode: auto-queue if requested or ready
    if (batchMode) {
      const defaultQty = (packetInfo && packetInfo.packetWeight > 0) 
        ? Math.min(packetInfo.packetWeight, material.stock)
        : Math.min(1, material.stock);
      
      addToCart(material, defaultQty, scanInput.trim(), packetInfo);
      setScanInput('');
    } else {
      setScanInput('');
    }
  };

  // Handle Lot selection
  const handleLotSelect = (lotId) => {
    setSelectedLotId(lotId);
    setLotNumber(lotId);
    const design = designs.find(d => String(d.id) === String(lotId));
    if (design && design.department) {
      setReceiverDept(design.department);
    }
  };

  // ── Stock Math Calculations ───────────────────────────────────────────────
  // Stock - Issue = Total Stock (Remaining Balance)
  const currentStock = selectedMaterial ? Number(selectedMaterial.stock || 0) : 0;
  const numIssueQty = Number(issueQty || 0);
  const remainingStock = Math.round((currentStock - numIssueQty) * 100) / 100;
  const isShortage = numIssueQty > currentStock;
  const isZeroStock = currentStock <= 0;

  // Add to Batch Cart
  const addToCart = (mat, qty, barcode, pktInfo = null) => {
    if (!mat) return;
    if (Number(qty) <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }
    if (Number(qty) > Number(mat.stock)) {
      if (soundEnabled) playFeedbackSound('error');
      setErrorMessage(`Cannot add ${qty} ${mat.unit}. Only ${mat.stock} ${mat.unit} available in stock.`);
      return;
    }

    setIssueCart(prev => {
      const existingIdx = prev.findIndex(item => item.material.id === mat.id && item.barcode === barcode);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = Math.min(mat.stock, updated[existingIdx].qty + Number(qty));
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: newQty,
          remainingStock: Math.round((mat.stock - newQty) * 100) / 100
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: `CART-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            material: mat,
            barcode: barcode || mat.id,
            qty: Number(qty),
            unit: mat.unit || 'Pcs',
            initialStock: mat.stock,
            remainingStock: Math.round((mat.stock - Number(qty)) * 100) / 100,
            packetInfo: pktInfo
          }
        ];
      }
    });

    if (soundEnabled) playFeedbackSound('scan');
    setErrorMessage('');
  };

  const removeFromCart = (cartItemId) => {
    setIssueCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const updateCartQty = (cartItemId, newQty) => {
    setIssueCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const validQty = Math.max(0.1, Math.min(item.material.stock, Number(newQty) || 0));
        return {
          ...item,
          qty: validQty,
          remainingStock: Math.round((item.material.stock - validQty) * 100) / 100
        };
      }
      return item;
    }));
  };

  // ── Single Item Issue Execution ──────────────────────────────────────────
  const handleSingleIssue = async () => {
    if (!selectedMaterial) {
      setErrorMessage('Please scan or select a material first.');
      return;
    }
    if (isZeroStock) {
      setErrorMessage('This material is currently out of stock (0 available).');
      return;
    }
    if (numIssueQty <= 0) {
      setErrorMessage('Please enter a valid issue quantity greater than 0.');
      return;
    }
    if (isShortage) {
      if (soundEnabled) playFeedbackSound('error');
      setErrorMessage(`Insufficient stock! Cannot issue ${numIssueQty} ${selectedMaterial.unit}. Maximum available is ${currentStock} ${selectedMaterial.unit}.`);
      return;
    }
    if (!personName.trim()) {
      setErrorMessage('Please enter the Issuer Name (Issued By).');
      return;
    }
    if (!receiverName.trim()) {
      setErrorMessage('Please enter the Receiver Name (Issued To).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const issueItem = {
        materialId: selectedMaterial.id,
        materialName: selectedMaterial.name,
        bomItemName: selectedMaterial.category || 'Accessory',
        totalRequired: numIssueQty,
        unit: selectedMaterial.unit || 'Pcs',
        barcode: scannedBarcode || selectedMaterial.id,
        initialStock: currentStock,
        remainingStock: remainingStock
      };

      const finalLotId = lotNumber.trim() || 'GENERAL-ISSUE';

      // Call system issue handler
      if (onIssueMaterials) {
        await onIssueMaterials(
          finalLotId,
          1,
          [issueItem],
          false,
          personName.trim(),
          receiverName.trim(),
          receiverDept.trim() || 'Cutting'
        );
      }

      if (soundEnabled) playFeedbackSound('success');

      const receiptData = {
        slipNo: `IS-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleString('en-GB'),
        lotId: finalLotId,
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim() || 'Cutting',
        remarks: remarks.trim(),
        items: [
          {
            materialCode: selectedMaterial.id,
            materialName: selectedMaterial.name,
            category: selectedMaterial.category,
            color: selectedMaterial.color || 'Default',
            location: selectedMaterial.location || 'Main Store',
            barcode: scannedBarcode || selectedMaterial.id,
            previousStock: currentStock,
            issuedQty: numIssueQty,
            totalStock: remainingStock,
            unit: selectedMaterial.unit || 'Pcs'
          }
        ]
      };

      setSuccessNotice(receiptData);
      
      // Reset form selection
      setSelectedMaterial(null);
      setScannedBarcode('');
      setScannedPacketInfo(null);
      setIssueQty(1);
      setRemarks('');

    } catch (err) {
      console.error('Issue failed:', err);
      setErrorMessage(`Failed to complete issue: ${err.message || 'Server error'}`);
      if (soundEnabled) playFeedbackSound('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Batch Issue Execution ────────────────────────────────────────────────
  const handleBatchIssue = async () => {
    if (issueCart.length === 0) {
      setErrorMessage('Issue Cart is empty. Please scan materials to add them to the queue.');
      return;
    }
    if (!personName.trim()) {
      setErrorMessage('Please enter the Issuer Name (Issued By).');
      return;
    }
    if (!receiverName.trim()) {
      setErrorMessage('Please enter the Receiver Name (Issued To).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const issuedItems = issueCart.map(item => ({
        materialId: item.material.id,
        materialName: item.material.name,
        bomItemName: item.material.category || 'Accessory',
        totalRequired: item.qty,
        unit: item.unit,
        barcode: item.barcode,
        initialStock: item.initialStock,
        remainingStock: item.remainingStock
      }));

      const finalLotId = lotNumber.trim() || 'BATCH-ISSUE';

      if (onIssueMaterials) {
        await onIssueMaterials(
          finalLotId,
          issueCart.length,
          issuedItems,
          false,
          personName.trim(),
          receiverName.trim(),
          receiverDept.trim() || 'Cutting'
        );
      }

      if (soundEnabled) playFeedbackSound('success');

      const receiptData = {
        slipNo: `IS-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleString('en-GB'),
        lotId: finalLotId,
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim() || 'Cutting',
        remarks: remarks.trim(),
        items: issueCart.map(item => ({
          materialCode: item.material.id,
          materialName: item.material.name,
          category: item.material.category,
          color: item.material.color || 'Default',
          location: item.material.location || 'Main Store',
          barcode: item.barcode,
          previousStock: item.initialStock,
          issuedQty: item.qty,
          totalStock: item.remainingStock,
          unit: item.unit
        }))
      };

      setSuccessNotice(receiptData);
      setIssueCart([]);
      setSelectedMaterial(null);
      setScannedBarcode('');
      setRemarks('');

    } catch (err) {
      console.error('Batch issue failed:', err);
      setErrorMessage(`Failed to issue batch items: ${err.message || 'Server error'}`);
      if (soundEnabled) playFeedbackSound('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── PDF Material Issue Slip Generation ───────────────────────────────────
  const generatePdfIssueSlip = (receipt) => {
    if (!receipt) return;
    const doc = new jsPDF();

    // Header styling
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MOHIT HOSIERY - MATERIAL ISSUE SLIP', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL STORE DISPATCH RECEIPT', 14, 20);

    // Metadata grid
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Slip No:`, 14, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.slipNo}`, 38, 34);

    doc.setFont('helvetica', 'bold');
    doc.text(`Date & Time:`, 120, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.date}`, 150, 34);

    doc.setFont('helvetica', 'bold');
    doc.text(`Target Lot No:`, 14, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.lotId}`, 44, 42);

    doc.setFont('helvetica', 'bold');
    doc.text(`Department:`, 120, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.receiverDept}`, 150, 42);

    doc.setFont('helvetica', 'bold');
    doc.text(`Issued To (Receiver):`, 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.receiverName}`, 58, 50);

    doc.setFont('helvetica', 'bold');
    doc.text(`Issued By (Store):`, 120, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.personName}`, 155, 50);

    if (receipt.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Remarks:`, 14, 58);
      doc.setFont('helvetica', 'normal');
      doc.text(`${receipt.remarks}`, 36, 58);
    }

    // Items table
    const tableBody = receipt.items.map((item, idx) => [
      idx + 1,
      item.materialCode,
      `${item.materialName}\n(${item.category || 'Accessory'})`,
      item.color || 'Default',
      item.barcode || 'N/A',
      `${item.previousStock} ${item.unit}`,
      `${item.issuedQty} ${item.unit}`,
      `${item.totalStock} ${item.unit}`,
      item.location || 'Store'
    ]);

    autoTable(doc, {
      startY: receipt.remarks ? 64 : 56,
      head: [['#', 'Code', 'Material Name', 'Shade', 'Barcode / Tag', 'Stock Before', 'Issued Qty', 'Total Balance', 'Store Loc']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [2, 132, 199],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [20, 20, 20],
        halign: 'center'
      },
      columnStyles: {
        1: { fontStyle: 'bold', halign: 'left' },
        2: { halign: 'left' },
        6: { fontStyle: 'bold', textColor: [220, 38, 38] },
        7: { fontStyle: 'bold', textColor: [16, 185, 129] }
      },
      margin: { left: 14, right: 14 }
    });

    // Signature footers
    const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 30;
    doc.setDrawColor(180, 180, 180);
    doc.line(20, finalY, 75, finalY);
    doc.line(135, finalY, 190, finalY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Issuer Signature', 30, finalY + 6);
    doc.text('Receiver Signature', 145, finalY + 6);

    doc.save(`Material_Issue_Slip_${receipt.slipNo}.pdf`);
  };

  // Filtered materials directory list for search modal/quick picker
  const filteredMaterials = useMemo(() => {
    if (!filterQuery.trim()) return materials.slice(0, 15);
    const q = filterQuery.toLowerCase().trim();
    return materials.filter(m => 
      String(m.id).toLowerCase().includes(q) ||
      String(m.name || '').toLowerCase().includes(q) ||
      String(m.category || '').toLowerCase().includes(q) ||
      String(m.color || '').toLowerCase().includes(q) ||
      String(m.location || '').toLowerCase().includes(q) ||
      String(m.barcodeId || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [materials, filterQuery]);

  // Recent Issue Logs filtered for display
  const recentBarcodeLogs = useMemo(() => {
    return (issueLogs || []).filter(log => {
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase();
      return (
        String(log.id || '').toLowerCase().includes(q) ||
        String(log.lotId || '').toLowerCase().includes(q) ||
        String(log.personName || '').toLowerCase().includes(q) ||
        String(log.receiverName || '').toLowerCase().includes(q) ||
        (Array.isArray(log.materials) && log.materials.some(m => String(m.name || '').toLowerCase().includes(q)))
      );
    }).slice(0, 10);
  }, [issueLogs, historySearch]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'var(--font-family-body, system-ui)' }}>
      {/* ── HEADER & WORKFLOW BAR ────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(56, 189, 248, 0.04) 100%)',
        border: '1px solid var(--border-color, #dbeafe)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
          }}>
            <Scan size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Material Issue with Barcode Scanner
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 9px',
                borderRadius: '999px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                ⚡ Auto-Scan Ready
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
              Scan material or packet barcodes with instant real-time stock deduction: <code>Stock - Issue = Total Stock</code>
            </p>
          </div>
        </div>

        {/* Action Controls & Sound Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #dbeafe)',
              background: soundEnabled ? '#e0f2fe' : 'var(--bg-secondary, #fff)',
              color: soundEnabled ? '#0284c7' : 'var(--text-muted, #64748b)',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={soundEnabled ? 'Disable Scan Sound' : 'Enable Scan Sound'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setBatchMode(!batchMode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: `1px solid ${batchMode ? '#0284c7' : 'var(--border-color, #dbeafe)'}`,
              background: batchMode ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'var(--bg-secondary, #fff)',
              color: batchMode ? '#fff' : 'var(--text-main, #0f172a)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: batchMode ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none'
            }}
          >
            <ShoppingBag size={16} />
            <span>Multi-Scan Mode {batchMode ? `(${issueCart.length})` : 'Off'}</span>
          </button>

          {onRedirectToTab && (
            <button
              type="button"
              onClick={() => onRedirectToTab('material_issue')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #dbeafe)',
                background: 'var(--bg-secondary, #fff)',
                color: 'var(--text-main, #0f172a)',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Boxes size={16} />
              <span>Lot BOM Issue Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* ── NOTIFICATION & ERROR BANNERS ────────────────────────────────────── */}
      {errorMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          color: '#b91c1c',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {successNotice && (
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
          border: '1px solid #a7f3d0',
          borderRadius: '14px',
          padding: '18px 22px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                background: '#10b981',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#065f46' }}>
                  Material Successfully Issued! (Slip: {successNotice.slipNo})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#047857' }}>
                  Issued to <strong>{successNotice.receiverName}</strong> ({successNotice.receiverDept}) | Lot: <strong>{successNotice.lotId}</strong> | Date: {successNotice.date}
                </p>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {successNotice.items.map((it, idx) => (
                    <span key={idx} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#fff',
                      border: '1px solid #6ee7b7',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#065f46'
                    }}>
                      📦 {it.materialName}: <strong>-{it.issuedQty} {it.unit}</strong> (New Stock: {it.totalStock} {it.unit})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => generatePdfIssueSlip(successNotice)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                }}
              >
                <Printer size={16} />
                <span>Print Issue Slip (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => setSuccessNotice(null)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE GRID ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: batchMode ? '1.1fr 0.9fr' : '1.3fr 0.7fr', gap: '24px', alignItems: 'start' }}>
        {/* ── LEFT COLUMN: SCANNER HUB & CURRENT MATERIAL FORM ── */}
        <div>
          {/* BARCODE SCANNER INPUT BOX */}
          <div style={{
            background: 'var(--bg-secondary, #ffffff)',
            border: '2px solid #0284c7',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 8px 24px -4px rgba(2, 132, 199, 0.15)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Top scanning indicator bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #0284c7, #38bdf8, #0284c7)',
              backgroundSize: '200% 100%',
              animation: 'scanGlow 3s infinite linear'
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                <Barcode size={22} color="#0284c7" />
                <span>SCAN BARCODE / ENTER MATERIAL ID</span>
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                Hardware USB Scanner / Keyboard Autofocus
              </span>
            </div>

            <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan Packet Barcode (e.g. MT1001-A01) or Type Material ID..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 44px',
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    borderRadius: '12px',
                    border: '2px solid #93c5fd',
                    background: '#f8fbff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Scan size={20} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              <button
                type="submit"
                style={{
                  padding: '0 24px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: '800',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                }}
              >
                <span>Search</span>
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Quick barcode helper hint */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
              <span>💡 Format examples: <code>MT1001-A01</code>, <code>MT1005</code>, <code>1002</code></span>
              <span style={{ color: '#0284c7', fontWeight: '600' }}>{materials.length} Materials Loaded</span>
            </div>
          </div>

          {/* ── ACTIVE SCANNED MATERIAL DETAILS CARD ── */}
          {selectedMaterial ? (
            <div style={{
              background: 'var(--bg-secondary, #ffffff)',
              border: '1px solid var(--border-color, #dbeafe)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: 'var(--shadow-md)',
              marginBottom: '24px'
            }}>
              {/* Card Header with Status & Barcode visual */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #edf2f7', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      background: '#e0f2fe',
                      color: '#0284c7',
                      fontSize: '12px',
                      fontWeight: '800',
                      padding: '3px 9px',
                      borderRadius: '6px'
                    }}>
                      {selectedMaterial.id}
                    </span>
                    <span style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '3px 9px',
                      borderRadius: '6px'
                    }}>
                      {selectedMaterial.category || 'Accessory'}
                    </span>
                    {scannedPacketInfo && (
                      <span style={{
                        background: '#fef3c7',
                        color: '#b45309',
                        fontSize: '12px',
                        fontWeight: '800',
                        padding: '3px 9px',
                        borderRadius: '6px'
                      }}>
                        🏷️ Packet {scannedPacketInfo.packetNumber} of {scannedPacketInfo.totalPackets}
                      </span>
                    )}
                  </div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    {selectedMaterial.name}
                  </h2>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <BarcodeVisual code={scannedBarcode || selectedMaterial.id} height={32} />
                </div>
              </div>

              {/* Material Specifications Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
                marginBottom: '22px',
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>SHADE / COLOR</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    {selectedMaterial.color || 'Default'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>STORE LOCATION</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0284c7', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} />
                    <span>{selectedMaterial.location || 'Main Store'}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>TOTAL PACKETS</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    {selectedMaterial.packets || 1} Packets
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>UNIT TYPE</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    {selectedMaterial.unit || 'Pcs'}
                  </div>
                </div>
              </div>

              {/* ── STOCK FORMULA & CALCULATION BANNER (STOCK - ISSUE = TOTAL STOCK) ── */}
              <div style={{
                background: isShortage 
                  ? '#fff1f2' 
                  : 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                border: `2px solid ${isShortage ? '#f87171' : '#38bdf8'}`,
                borderRadius: '14px',
                padding: '18px 20px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: isShortage ? '#b91c1c' : '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📊 Real-Time Stock Calculation Formula:
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                    Stock - Issue = Total Stock
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  {/* Current Stock */}
                  <div style={{
                    flex: 1,
                    minWidth: '120px',
                    background: '#fff',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>CURRENT STOCK</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: currentStock > 0 ? '#0f172a' : '#ef4444', marginTop: '2px' }}>
                      {currentStock.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600' }}>{selectedMaterial.unit || 'Pcs'}</span>
                    </div>
                  </div>

                  {/* Minus Sign */}
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#64748b' }}>
                    ➖
                  </div>

                  {/* Issue Qty */}
                  <div style={{
                    flex: 1,
                    minWidth: '120px',
                    background: '#fff',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '2px solid #ef4444',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '800' }}>ISSUE QUANTITY</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#dc2626', marginTop: '2px' }}>
                      {numIssueQty.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600' }}>{selectedMaterial.unit || 'Pcs'}</span>
                    </div>
                  </div>

                  {/* Equals Sign */}
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#64748b' }}>
                    🟰
                  </div>

                  {/* New Balance Total Stock */}
                  <div style={{
                    flex: 1,
                    minWidth: '130px',
                    background: isShortage ? '#fef2f2' : '#ecfdf5',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: `2px solid ${isShortage ? '#ef4444' : '#10b981'}`,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: isShortage ? '#991b1b' : '#047857', fontWeight: '800' }}>
                      {isShortage ? 'SHORTAGE DEFICIT' : 'TOTAL STOCK REMAINING'}
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: isShortage ? '#b91c1c' : '#059669', marginTop: '2px' }}>
                      {remainingStock.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600' }}>{selectedMaterial.unit || 'Pcs'}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div style={{ marginTop: '14px', height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${currentStock > 0 ? Math.max(0, Math.min(100, (remainingStock / currentStock) * 100)) : 0}%`,
                    background: isShortage ? '#ef4444' : remainingStock > (selectedMaterial.threshold || 50) ? '#10b981' : '#f59e0b',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* ── ISSUE QUANTITY CONTROLLER ── */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
                  Specify Issue Quantity ({selectedMaterial.unit || 'Pcs'})
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setIssueQty(prev => Math.max(1, (Number(prev) || 0) - 10))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueQty(prev => Math.max(1, (Number(prev) || 0) - 1))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}
                  >
                    -1
                  </button>

                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={issueQty}
                    onChange={(e) => setIssueQty(e.target.value)}
                    style={{
                      width: '120px',
                      padding: '10px 14px',
                      fontSize: '18px',
                      fontWeight: '800',
                      textAlign: 'center',
                      borderRadius: '10px',
                      border: isShortage ? '2px solid #ef4444' : '2px solid #0284c7',
                      color: isShortage ? '#b91c1c' : '#0f172a',
                      background: '#fff'
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setIssueQty(prev => Math.min(currentStock, (Number(prev) || 0) + 1))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueQty(prev => Math.min(currentStock, (Number(prev) || 0) + 10))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueQty(prev => Math.min(currentStock, (Number(prev) || 0) + 50))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}
                  >
                    +50
                  </button>

                  {/* Packet weight quick presets */}
                  {scannedPacketInfo && scannedPacketInfo.packetWeight > 0 && (
                    <button
                      type="button"
                      onClick={() => setIssueQty(scannedPacketInfo.packetWeight)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #f59e0b', background: '#fef3c7', color: '#b45309', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🏷️ 1 Packet ({scannedPacketInfo.packetWeight} {selectedMaterial.unit})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIssueQty(currentStock)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #10b981', background: '#ecfdf5', color: '#047857', fontWeight: '700', cursor: 'pointer' }}
                  >
                    All Stock ({currentStock})
                  </button>
                </div>
              </div>

              {/* ── METADATA & RECIPIENT FIELDS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                    Target Lot / Job Work No.
                  </label>
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="e.g. 1001, 76031 or General"
                    list="active-lots-list"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  />
                  <datalist id="active-lots-list">
                    {designs.map(d => (
                      <option key={d.id} value={d.id}>{d.id} - {d.brand || ''} {d.category || ''}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                    Issued To (Receiver Name) *
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="e.g. Rohit Contractor / Tailor"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                    Department
                  </label>
                  <select
                    value={receiverDept}
                    onChange={(e) => setReceiverDept(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: '#fff'
                    }}
                  >
                    <option value="Cutting">Cutting Dept</option>
                    <option value="Stitching">Stitching / Tailors</option>
                    <option value="Finishing">Finishing Dept</option>
                    <option value="Packing">Packing Dept</option>
                    <option value="Sampling">Sampling</option>
                    <option value="Job Work">External Job Work / Vendor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                    Issued By (Store Operator)
                  </label>
                  <input
                    type="text"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: '#f8fafc'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                  Issue Purpose / Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Regular Production BOM dispatch, extra replacement..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSingleIssue}
                  disabled={isSubmitting || isShortage || isZeroStock}
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    background: isShortage || isZeroStock 
                      ? '#94a3b8' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '16px',
                    cursor: isShortage || isZeroStock ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: isShortage || isZeroStock ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <CheckCircle2 size={20} />
                  <span>
                    {isSubmitting ? 'Processing Issue...' : `CONFIRM ISSUE (-${numIssueQty} ${selectedMaterial.unit})`}
                  </span>
                </button>

                {batchMode && (
                  <button
                    type="button"
                    onClick={() => {
                      addToCart(selectedMaterial, numIssueQty, scannedBarcode, scannedPacketInfo);
                      setSelectedMaterial(null);
                      setScannedBarcode('');
                    }}
                    disabled={isShortage || isZeroStock}
                    style={{
                      padding: '14px 20px',
                      borderRadius: '12px',
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={18} />
                    <span>Add to Queue</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedMaterial(null);
                    setScannedBarcode('');
                    setScannedPacketInfo(null);
                    if (scannerInputRef.current) scannerInputRef.current.focus();
                  }}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          ) : (
            /* EMPTY SCAN STATE PROMPT */
            <div style={{
              background: 'var(--bg-secondary, #ffffff)',
              border: '2px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              color: '#64748b',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f0f9ff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
                marginBottom: '16px'
              }}>
                <Scan size={32} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                Awaiting Barcode Scan
              </h3>
              <p style={{ margin: 0, fontSize: '13px', maxWidth: '380px', marginInline: 'auto' }}>
                Scan any physical material packet sticker or type a code in the search box above to load real-time stock balances.
              </p>
            </div>
          )}

          {/* ── BATCH ISSUE QUEUE (IF BATCH MODE IS ON) ── */}
          {batchMode && (
            <div style={{
              background: 'var(--bg-secondary, #ffffff)',
              border: '1px solid var(--border-color, #dbeafe)',
              borderRadius: '16px',
              padding: '22px',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={20} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Multi-Item Batch Queue ({issueCart.length} Items)
                  </h3>
                </div>
                {issueCart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIssueCart([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {issueCart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  No items in batch queue yet. Scan items to add them here.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Material</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Barcode</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Stock</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Issue Qty</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>New Balance</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issueCart.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 10px', fontWeight: '700', color: '#0f172a' }}>
                              {item.material.name}
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{item.material.color}</div>
                            </td>
                            <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: '600' }}>
                              {item.barcode}
                            </td>
                            <td style={{ padding: '10px 10px', color: '#475569' }}>
                              {item.initialStock} {item.unit}
                            </td>
                            <td style={{ padding: '10px 10px' }}>
                              <input
                                type="number"
                                min="0.1"
                                value={item.qty}
                                onChange={(e) => updateCartQty(item.id, e.target.value)}
                                style={{
                                  width: '70px',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #0284c7',
                                  fontWeight: '700',
                                  textAlign: 'center'
                                }}
                              />
                            </td>
                            <td style={{ padding: '10px 10px', fontWeight: '800', color: '#059669' }}>
                              {item.remainingStock} {item.unit}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleBatchIssue}
                      disabled={isSubmitting}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: '800',
                        fontSize: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <CheckCircle2 size={18} />
                      <span>Issue All {issueCart.length} Queue Items</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: QUICK DIRECTORY & RECENT SCANNED ISSUES ── */}
        <div>
          {/* QUICK MATERIAL SEARCH PICKER */}
          <div style={{
            background: 'var(--bg-secondary, #ffffff)',
            border: '1px solid var(--border-color, #dbeafe)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={16} color="#0284c7" />
                <span>Materials Quick Picker</span>
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{filteredMaterials.length} shown</span>
            </div>

            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by Name, Code, Color, Location..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                marginBottom: '12px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredMaterials.map((mat) => (
                <div
                  key={mat.id}
                  onClick={() => {
                    setSelectedMaterial(mat);
                    setScannedBarcode(mat.id);
                    setScannedPacketInfo(null);
                    setIssueQty(mat.stock > 0 ? 1 : 0);
                    if (soundEnabled) playFeedbackSound('scan');
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: selectedMaterial?.id === mat.id ? '#e0f2fe' : '#f8fafc',
                    border: `1px solid ${selectedMaterial?.id === mat.id ? '#38bdf8' : '#e2e8f0'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{mat.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {mat.id} • {mat.color || 'Default'} • {mat.location || 'Store'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: mat.stock > 0 ? '#059669' : '#ef4444' }}>
                      {mat.stock} {mat.unit || 'Pcs'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Stock</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RECENT ISSUE AUDIT LOGS */}
          <div style={{
            background: 'var(--bg-secondary, #ffffff)',
            border: '1px solid var(--border-color, #dbeafe)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={16} color="#0284c7" />
                <span>Recent Barcode Issue Logs</span>
              </h3>
            </div>

            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Filter logs by Lot, Person, Material..."
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                marginBottom: '10px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentBarcodeLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>
                  No recent issue logs found.
                </div>
              ) : (
                recentBarcodeLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800', fontSize: '12px', color: '#0284c7' }}>
                        {log.id}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {log.date}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>
                      Lot: <span style={{ color: '#4338ca' }}>{log.lotId || 'N/A'}</span> • To: <strong>{log.receiverName || 'Tailor'}</strong> ({log.receiverDept || 'Cutting'})
                    </div>

                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569' }}>
                      {Array.isArray(log.materials) && log.materials.map((m, idx) => (
                        <span key={idx} style={{ display: 'inline-block', marginRight: '6px' }}>
                          • {m.name}: <strong>{m.qty} {m.unit || 'Pcs'}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
