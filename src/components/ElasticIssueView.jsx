import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Search, Plus, Minus, Download, Printer, RefreshCw,
  CheckCircle, AlertTriangle, Layers, X,
  Calendar, User, Scissors, Sliders, Calculator, Zap, ArrowRight, Table,
  ShieldCheck, Lock, ExternalLink, Ruler
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getBackendUrl } from '../utils/api';
import SmartSelectWithManual from './SmartSelectWithManual';

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

  // BOM & Design Verification States
  const [designs, setDesigns] = useState([]);
  const [bomStatus, setBomStatus] = useState('idle'); // 'idle' | 'approved' | 'pending' | 'not_created' | 'rejected'
  const [bomDesign, setBomDesign] = useState(null);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // Step 1.5: Automatic Size to Meter Backend Calculation State & Switch Mode
  const [issuePcs, setIssuePcs] = useState(0);
  const [materialMode, setMaterialMode] = useState('elastic'); // 'elastic' | 'tape' | 'bone' | 'both' | 'all'
  const [isWithoutLot, setIsWithoutLot] = useState(false); // Without Lot / Direct Floor Issue Mode
  const [isWithoutPo, setIsWithoutPo] = useState(false); // W/O PO (Direct Floor Issue) Mode
  const withoutLotActive = isWithoutLot || isWithoutPo;
  const [boneRollCount, setBoneRollCount] = useState(1);
  const [boneWidth, setBoneWidth] = useState('1.5 Inch (Standard)');
  const [customBoneWidth, setCustomBoneWidth] = useState('');
  const [withoutLotStyle, setWithoutLotStyle] = useState('Lower / Tracksuit');
  const [elasticSizeInput, setElasticSizeInput] = useState('50');
  const [elasticUnit, setElasticUnit] = useState('inch'); // 'inch' or 'cm'
  const [tapeSizeInput, setTapeSizeInput] = useState('62');
  const [tapeUnit, setTapeUnit] = useState('cm'); // 'inch' or 'cm'
  const [calcResult, setCalcResult] = useState({
    elasticPerPcMtr: 1.27,
    tapePerPcMtr: 0.62,
    totalElasticMtr: 0,
    totalTapeMtr: 0,
    recommendedRolls: 0,
    elasticFormula: '50 Inch × 0.0254 = 1.27 m',
    tapeFormula: '62 CM / 100 = 0.62 m',
    formulaExplanation: '50 Inch × 0.0254 = 1.27 m | 62 CM / 100 = 0.62 m'
  });
  const [calculating, setCalculating] = useState(false);

  // Step 2: Elastic, Tape & Bone Issue Details
  const [rollCount, setRollCount] = useState(0);
  const [tapeRollCount, setTapeRollCount] = useState(0);
  const [elasticWidth, setElasticWidth] = useState('1 Inch (Standard)');
  const [customWidth, setCustomWidth] = useState('');
  const [tapeWidth, setTapeWidth] = useState('0.5 Inch (Standard)');
  const [customTapeWidth, setCustomTapeWidth] = useState('');
  const [selectedShade, setSelectedShade] = useState('');

  // Issuer, Receiver & Supervisor
  const [issuerName, setIssuerName] = useState(currentUser?.name || '');
  const [receiverName, setReceiverName] = useState('');
  const [supervisorName, setSupervisorName] = useState('ROHIT / MONU');
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

  // Fetch designs to verify BOM existence and approval status
  const fetchDesigns = async () => {
    try {
      setLoadingDesigns(true);
      const res = await fetch(`${getBackendUrl()}/api/designs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDesigns(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch designs in ElasticIssueView:', e);
    } finally {
      setLoadingDesigns(false);
    }
  };

  // Computed: List of all designs with Approved BOMs
  const approvedDesignsList = useMemo(() => {
    return (designs || []).filter(d => String(d.status || '').toLowerCase().trim() === 'approved');
  }, [designs]);

  // Helper to calculate sequential without lot slip number from history
  const getNextWithoutLotSeq = (history = issueHistory, mode = materialMode) => {
    const prefix = mode === 'tape' ? 'tape-w/o-' : mode === 'bone' ? 'bone-w/o-' : 'elastic-w/o-';
    let max = 0;
    (history || []).forEach(h => {
      const s = String(h.slipNo || '').toLowerCase();
      if (s.startsWith(prefix)) {
        const n = parseInt(s.replace(prefix, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return `${prefix}${String(max + 1).padStart(2, '0')}`;
  };

  // Fetch next Issue Slip Number from backend or local sequence
  const fetchNextIssueSlipNo = async (isWo = withoutLotActive, mode = materialMode) => {
    if (isWo) {
      const type = mode === 'tape' ? 'tape_wo' : mode === 'bone' ? 'bone_wo' : 'elastic_wo';
      try {
        const res = await fetch(`${getBackendUrl()}/api/po-number/next/${type}`);
        if (res.ok) {
          const data = await res.json();
          if (data.poNumber) {
            setIssueSlipNo(data.poNumber);
            return data.poNumber;
          }
        }
      } catch (_) {}
      const fallback = getNextWithoutLotSeq(issueHistory, mode);
      setIssueSlipNo(fallback);
      return fallback;
    }

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
    fetchDesigns();
  }, []);

  // Update slip number when withoutLotActive or materialMode changes
  useEffect(() => {
    fetchNextIssueSlipNo(withoutLotActive, materialMode);
  }, [withoutLotActive, materialMode]);

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

  // Automatic Backend Calculation Trigger
  const triggerCalculation = async (
    eSize = elasticSizeInput,
    eUnit = elasticUnit,
    tSize = tapeSizeInput,
    tUnit = tapeUnit,
    targetLot = lotDetails,
    customPcs = issuePcs
  ) => {
    try {
      setCalculating(true);
      const pcs = parseInt(customPcs || targetLot?.quantity || 600, 10);
      const res = await fetch(`${getBackendUrl()}/api/elastic/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNo: targetLot?.lotNo || searchLotInput,
          pcs,
          sizeInput: eSize,
          elasticUnit: eUnit,
          unit: eUnit,
          tapeSizeInput: tSize,
          tapeUnit: tUnit
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
        if (data.recommendedRolls && (!rollCount || rollCount === 1)) {
          setRollCount(data.recommendedRolls);
        }
      }
    } catch (e) {
      console.warn('Calculation error:', e);
    } finally {
      setCalculating(false);
    }
  };

  // Re-calculate automatically when size, unit, tape, lot, or issue pcs changes
  useEffect(() => {
    triggerCalculation(elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, lotDetails, issuePcs);
  }, [elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, lotDetails, issuePcs]);

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
          supervisorName: record.supervisorName || lotDetails?.supervisor || '',
          issueDate: record.date,
          style: record.style,
          brand: record.brand,
          garmentType: record.garmentType,
          fabric: record.fabric,
          quantity: record.quantity,
          shade: record.shade,
          size: record.size,
          elasticWidth: record.width,
          unitType: elasticUnit,
          elasticSizeInput: parseFloat(elasticSizeInput) || 0,
          elasticPerPcMtr: calcResult.elasticPerPcMtr,
          totalElasticMtr: calcResult.totalElasticMtr,
          tapePerPcMtr: calcResult.tapePerPcMtr,
          totalTapeMtr: calcResult.totalTapeMtr,
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
              width: record.width,
              elasticPerPcMtr: calcResult.elasticPerPcMtr,
              totalElasticMtr: calcResult.totalElasticMtr
            }]
          })
        });
      } catch (_) {}
    } catch (e) {
      console.warn('Backend sync warning:', e);
    }
  };

  // Verify BOM existence and approval status for a specific lot
  const verifyBOMStatus = async (lotQuery) => {
    try {
      let currentDesigns = designs;
      try {
        const res = await fetch(`${getBackendUrl()}/api/designs`);
        if (res.ok) {
          const fresh = await res.json();
          if (Array.isArray(fresh)) {
            setDesigns(fresh);
            currentDesigns = fresh;
          }
        }
      } catch (_) {}

      const cleanQ = String(lotQuery || '').trim().toLowerCase();
      const matched = (currentDesigns || []).find(d => 
        String(d.id || '').trim().toLowerCase() === cleanQ ||
        String(d.lot_no || '').trim().toLowerCase() === cleanQ
      );

      if (!matched) {
        setBomStatus('not_created');
        setBomDesign(null);
      } else {
        setBomDesign(matched);
        const st = String(matched.status || '').trim().toLowerCase();
        if (st === 'approved') {
          setBomStatus('approved');
        } else if (st === 'rejected') {
          setBomStatus('rejected');
        } else {
          setBomStatus('pending');
        }
      }
    } catch (e) {
      console.warn('Error verifying BOM status:', e);
    }
  };

  // Search Lot Details
  const handleSearchLot = async (targetLot = null) => {
    const lotToQuery = (targetLot || searchLotInput || '').trim();
    if (!lotToQuery) {
      setLotError('Please enter a Lot Number to search.');
      setBomStatus('idle');
      setBomDesign(null);
      return;
    }

    setSearchingLot(true);
    setLotError('');

    // Check BOM status in parallel
    verifyBOMStatus(lotToQuery);

    try {
      const cleanLot = encodeURIComponent(lotToQuery);
      const res = await fetch(`${getBackendUrl()}/api/lot/${cleanLot}`);

      if (!res.ok) {
        throw new Error(`Lot "${lotToQuery}" not found. You can still enter details and issue pieces manually.`);
      }

      const data = await res.json();
      setLotDetails(data);
      const cuttingQty = parseInt(data.quantity || 0, 10);
      setIssuePcs(cuttingQty > 0 ? cuttingQty : 600);
      triggerCalculation(elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, data, cuttingQty > 0 ? cuttingQty : 600);

      // Extract primary shade if available
      let primaryShade = '';
      if (data.shade) {
        const raw = String(data.shade);
        const first = raw.split(',')[0].replace(/\[.*?\]/g, '').trim();
        primaryShade = first || raw;
      }
      setSelectedShade(primaryShade);

      setRemarks(`Internal Elastic waistband issue for Lot ${data.lotNo || cleanLot} (${data.style || 'Garment'} - ${data.brand || ''}). Cutting Qty: ${cuttingQty || 600} Pcs.`);

      setRecentLots(prev => {
        const updated = [lotToQuery, ...prev.filter(l => l !== lotToQuery)];
        return updated.slice(0, 6);
      });

      showToast(`Lot ${data.lotNo || lotToQuery} details loaded.`);
    } catch (err) {
      console.warn('Lot search warning:', err);
      setLotError(err.message || 'Lot details not found in Google Sheets / Cutting Matrix.');
      setLotDetails(null);
      setIssuePcs(0);
    } finally {
      setSearchingLot(false);
    }
  };

  const effectiveWidth = elasticWidth === 'Custom' ? (customWidth || '1 Inch') : elasticWidth;
  const effectiveTapeWidth = tapeWidth === 'Custom' ? (customTapeWidth || '0.5 Inch') : tapeWidth;
  const effectiveBoneWidth = boneWidth === 'Custom' ? (customBoneWidth || '1.5 Inch') : boneWidth;

  // ── Build Original Issue Bill / PO PDF Document (Clean B&W Layout) ──────
  const createElasticIssuePDFDocument = async (data) => {
    const {
      slipNo,
      lotNo,
      isWithoutLot = false,
      isWithoutPo = false,
      issuerName = '',
      receiverName = '',
      supervisorName = 'ROHIT / MONU',
      date = new Date().toISOString().split('T')[0],
      style = 'LOWER',
      brand = 'Mohit Hosiery',
      garmentType = 'LOWER',
      fabric = 'Cotton Poly Blend',
      quantity = 600,
      shade = 'Standard',
      size = 'M, L, XL, 2XL',
      width = '1 Inch (Standard)',
      tapeWidth = '0.5 Inch (Standard)',
      boneWidth = '1.5 Inch (Standard)',
      boneRolls = 1,
      elasticPerPcMtr = 1.27,
      totalElasticMtr = 762,
      tapePerPcMtr = 0.62,
      totalTapeMtr = 372,
      elasticSizeInput = '50',
      elasticUnit = 'inch',
      tapeSizeInput = '62',
      tapeUnit = 'cm',
      materialMode = 'elastic',
      formulaExplanation = '',
      remarks = ''
    } = data;

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Outer & Inner Borders (Crisp Black & White)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.2);
    doc.rect(20, 20, pw - 40, ph - 40);

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.6);
    doc.rect(23, 23, pw - 46, ph - 46);

    const im = 36;
    const iw = pw - im * 2;
    let y = 36;

    // Header Box
    doc.setFillColor(248, 248, 248);
    doc.rect(im, y, iw, 58, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(im, y, iw, 58, 'S');

    const withoutLotMode = Boolean(isWithoutLot || isWithoutPo || String(slipNo).toLowerCase().includes('-w/o-'));
    const effectiveMode = String(slipNo || '').toLowerCase().startsWith('tape')
      ? 'tape'
      : String(slipNo || '').toLowerCase().startsWith('bone')
        ? 'bone'
        : String(slipNo || '').toLowerCase().startsWith('elastic')
          ? 'elastic'
          : (materialMode || 'elastic');

    const modeLabel = effectiveMode === 'tape'
      ? 'TAPE'
      : effectiveMode === 'bone'
        ? 'BONE'
        : effectiveMode === 'both'
          ? 'ELASTIC & TAPE'
          : effectiveMode === 'all'
            ? 'ALL ACCESSORIES'
            : 'ELASTIC';

    // Company & Document Title (Pure Black)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text('MOHIT HOSIERY', im + 12, y + 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const docTitle = withoutLotMode
      ? `MATERIAL ISSUE SLIP (W/O LOT - ${modeLabel} ISSUE)`
      : `MATERIAL ISSUE BILL / PURCHASE ORDER (${modeLabel} ORIGINAL)`;
    doc.text(docTitle, im + 12, y + 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(withoutLotMode ? `Store & Accessories Department • Direct Floor Stock Issue (W/O LOT - ${modeLabel})` : `Store & Accessories Department • Production Floor Issue (${modeLabel})`, im + 12, y + 48);

    // Right Header Information Box (Pure Black & White)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(withoutLotMode ? `SLIP NO: ${slipNo}` : `BILL / PO NO: ${slipNo}`, pw - im - 12, y + 19, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`DATE: ${date}`, pw - im - 12, y + 33, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(withoutLotMode ? `[ W/O LOT - ${modeLabel} ISSUE ]` : `[ ORIGINAL ISSUE BILL - ${modeLabel} ]`, pw - im - 12, y + 48, { align: 'right' });

    y += 68;

    // ── 1. PRODUCTION & LOT SPECIFICATIONS ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(withoutLotMode ? `1. DIRECT FLOOR MOVEMENT SPECIFICATIONS (W/O LOT - ${modeLabel})` : `1. PRODUCTION & LOT SPECIFICATIONS (${modeLabel})`, im + 8, y + 12);
    
    // Spacing so text does not overwrite the section header
    y += 30;

    const colW = iw / 2;
    const drawField = (label, val, xPos, yPos) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 75, 75);
      doc.text(`${label}:`, xPos, yPos);

      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(String(val || '—'), xPos + labelW + 3, yPos);
    };

    if (withoutLotMode) {
      drawField('Issue Mode', `WITHOUT LOT (${modeLabel} Floor Issue)`, im + 6, y);
      drawField('Issue Quantity', `${quantity || 600} Pcs`, im + colW + 6, y);
      y += 18;

      drawField('Item / Style Name', style || garmentType || 'LOWER', im + 6, y);
      drawField('Supervisor Name', supervisorName || 'ROHIT / MONU', im + colW + 6, y);
      y += 18;

      drawField('Department', 'CUTTING FLOOR', im + 6, y);
      drawField('Issued By', issuerName || 'STORE INCHARGE', im + colW + 6, y);
      y += 24;
    } else {
      drawField('Lot Number', `LOT #${lotNo}`, im + 6, y);
      drawField('Total Cutting Quantity', `${quantity || 600} Pcs`, im + colW + 6, y);
      y += 18;

      drawField('Item / Style Name', style || garmentType || 'LOWER', im + 6, y);
      drawField('Buyer / Brand', brand || 'Mohit Hosiery', im + colW + 6, y);
      y += 18;

      drawField('Garment Type', garmentType || 'LOWER / Pants', im + 6, y);
      drawField('Supervisor Name', supervisorName || 'ROHIT / MONU', im + colW + 6, y);
      y += 18;

      drawField('Lot Shade / Color', shade || 'Standard', im + 6, y);
      drawField('Target Sizes', size || 'M, L, XL, 2XL', im + colW + 6, y);
      y += 24;
    }

    // ── 2. MATERIAL ALLOCATION & TOTAL REQUIREMENT ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`2. MATERIAL ALLOCATION & TOTAL REQUIREMENT (${modeLabel} SPEC)`, im + 8, y + 12);
    
    // Spacing before table header
    y += 26;

    // Table Header (Crisp Solid Black Bar with White Text)
    const thH = 20;
    doc.setFillColor(0, 0, 0);
    doc.rect(im, y, iw, thH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('#', im + 6, y + 13);
    doc.text('ITEM / MATERIAL DESCRIPTION', im + 24, y + 13);
    doc.text('SPECIFICATION', im + 180, y + 13);
    doc.text('PER PC REQ.', im + 290, y + 13);
    doc.text(withoutLotMode ? 'ISSUE PCS' : 'CUTTING PCS', im + 375, y + 13);
    doc.text(effectiveMode === 'bone' ? 'TOTAL ROLLS' : 'TOTAL REQ. (MTR)', pw - im - 10, y + 13, { align: 'right' });
    y += thH;

    let itemIdx = 1;
    let grandTotalMtr = 0;

    // Row: Elastic (Shown if elastic, both, or all)
    if (effectiveMode === 'elastic' || effectiveMode === 'both' || effectiveMode === 'all') {
      const rowH = 24;
      doc.setFillColor(255, 255, 255);
      doc.rect(im, y, iw, rowH, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.6);
      doc.line(im, y + rowH, pw - im, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(itemIdx++), im + 6, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text('Elastic Waistband Roll', im + 24, y + 15);

      doc.setFont('helvetica', 'normal');
      doc.text(width || '1 Inch (Standard)', im + 180, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text(`${elasticPerPcMtr} Mtr (${elasticSizeInput} ${elasticUnit})`, im + 290, y + 15);

      doc.text(`${quantity || 600} Pcs`, im + 375, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${totalElasticMtr} Mtr`, pw - im - 10, y + 15, { align: 'right' });

      grandTotalMtr += parseFloat(totalElasticMtr) || 0;
      y += rowH;
    }

    // Row: Tape (Shown if tape, both, or all)
    if (effectiveMode === 'tape' || effectiveMode === 'both' || effectiveMode === 'all') {
      const rowH = 24;
      doc.setFillColor(255, 255, 255);
      doc.rect(im, y, iw, rowH, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.6);
      doc.line(im, y + rowH, pw - im, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(itemIdx++), im + 6, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text('Tape Roll (Drawcord Tape)', im + 24, y + 15);

      doc.setFont('helvetica', 'normal');
      doc.text(tapeWidth || '0.5 Inch (Standard)', im + 180, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text(`${tapePerPcMtr} Mtr (${tapeSizeInput} ${tapeUnit})`, im + 290, y + 15);

      doc.text(`${quantity || 600} Pcs`, im + 375, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${totalTapeMtr} Mtr`, pw - im - 10, y + 15, { align: 'right' });

      grandTotalMtr += parseFloat(totalTapeMtr) || 0;
      y += rowH;
    }

    // Row: Bone (Shown if bone or all)
    if (effectiveMode === 'bone' || effectiveMode === 'all') {
      const rowH = 24;
      doc.setFillColor(255, 255, 255);
      doc.rect(im, y, iw, rowH, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.6);
      doc.line(im, y + rowH, pw - im, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(itemIdx++), im + 6, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text('Bone Pocketing / Piping Roll', im + 24, y + 15);

      doc.setFont('helvetica', 'normal');
      doc.text(boneWidth || '1.5 Inch (Standard)', im + 180, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text('18 CM Standard Cut', im + 290, y + 15);

      doc.text(`${quantity || 600} Pcs`, im + 375, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${boneRolls || 1} Roll(s)`, pw - im - 10, y + 15, { align: 'right' });

      y += rowH;
    }

    // Table Outer Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(im, y, pw - im, y);

    // ── Total Material Requirement Summary Bar ──
    const totH = 24;
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, totH, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(im, y, iw, totH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL MATERIAL REQUIREMENT ON BILL (${modeLabel}):`, im + 8, y + 15);

    doc.setFontSize(10);
    const totalDisplay = effectiveMode === 'bone'
      ? `${boneRolls || 1} Roll(s)`
      : `${grandTotalMtr.toFixed(2).replace(/\.00$/, '')} Mtr`;
    doc.text(totalDisplay, pw - im - 10, y + 15, { align: 'right' });
    y += totH + 18;

    // ── 3. FORMULA BREAKDOWN & INSTRUCTIONS ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('3. FORMULA BREAKDOWN & INSTRUCTIONS', im + 8, y + 12);
    y += 24;

    doc.setFillColor(255, 255, 255);
    doc.rect(im, y, iw, 42, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 42, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const formText = effectiveMode === 'tape'
      ? `${tapeSizeInput} ${tapeUnit} = ${tapePerPcMtr} m × ${quantity || 600} pcs = ${totalTapeMtr} m`
      : effectiveMode === 'bone'
        ? `18 CM Standard Cut × ${quantity || 600} pcs = ${boneRolls || 1} Roll(s)`
        : (formulaExplanation || `${elasticSizeInput} ${elasticUnit} = ${elasticPerPcMtr} m × ${quantity || 600} pcs = ${totalElasticMtr} m`);
    doc.text(`Conversion: ${formText}`, im + 8, y + 15);

    const remText = remarks || `Standard internal material issue bill for ${modeLabel} (${style || 'Garment'}).`;
    doc.text(`Remarks: ${remText}`, im + 8, y + 30);
    y += 54;

    // ── 4. VERIFICATION & SIGNATURES ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('4. VERIFICATION & SIGNATURES', im + 8, y + 12);
    y += 26;

    const sigColW = (iw - 20) / 3;

    // Box 1: Store Staff (Issuer)
    const x1 = im;
    doc.setFillColor(255, 255, 255);
    doc.rect(x1, y, sigColW, 64, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(x1, y, sigColW, 64, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('ISSUED BY (STORE STAFF)', x1 + 6, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Name: ', x1 + 6, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(issuerName || 'STORE STAFF', x1 + 38, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date}`, x1 + 6, y + 39);
    doc.text('Sign: ____________________', x1 + 6, y + 54);

    // Box 2: Cutting Master (Receiver)
    const x2 = x1 + sigColW + 10;
    doc.setFillColor(255, 255, 255);
    doc.rect(x2, y, sigColW, 64, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(x2, y, sigColW, 64, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('RECEIVED BY (CUTTING MASTER)', x2 + 6, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Name: ', x2 + 6, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(receiverName || 'CUTTING MASTER', x2 + 38, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date}`, x2 + 6, y + 39);
    doc.text('Sign: ____________________', x2 + 6, y + 54);

    // Box 3: Supervisor Approval
    const x3 = x2 + sigColW + 10;
    doc.setFillColor(255, 255, 255);
    doc.rect(x3, y, sigColW, 64, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(x3, y, sigColW, 64, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('SUPERVISOR / AUTHORIZED', x3 + 6, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Name: ', x3 + 6, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(supervisorName || 'SUPERVISOR', x3 + 38, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date}`, x3 + 6, y + 39);
    doc.text('Sign: ____________________', x3 + 6, y + 54);

    // Official Footer (Subtle B&W)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Official Material Issue Bill / Purchase Order (Original) • Mohit Hosiery Quality & Production Management', pw / 2, ph - 30, { align: 'center' });

    return doc;
  };

  // Navigation helpers to BOM Creation & Approval Queue
  const handleCreateBOM = (targetLot = null) => {
    const lot = targetLot || lotDetails?.lotNo || searchLotInput.trim();
    if (lot) {
      setPrefilledLotNo(lot);
    }
    if (typeof onNavigate === 'function') {
      onNavigate('design');
    }
  };

  const handleViewApprovalQueue = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('approval_queue');
    }
  };

  // ── Generate Professional Original Issue Bill / PO / W/O PO Slip ─────────────────────────────
  const generateElasticIssueBill = async () => {
    if (!lotDetails && !searchLotInput && !withoutLotActive) {
      showToast('Please enter or search a Lot Number first, or switch to "Without Lot" mode.', 'error');
      return;
    }

    // MANDATORY WORKFLOW RULE: BOM MUST BE CREATED AND APPROVED (UNLESS WITHOUT LOT / W/O PO MODE)
    if (!withoutLotActive && bomStatus !== 'approved') {
      if (bomStatus === 'not_created') {
        showToast('Workflow Blocked: BOM is not created for this Lot! Create BOM first or switch to "Without Lot" mode.', 'error');
      } else if (bomStatus === 'pending') {
        showToast('Workflow Blocked: BOM is Pending Approval! Approve in queue or switch to "Without Lot" mode.', 'error');
      } else if (bomStatus === 'rejected') {
        showToast('Workflow Blocked: BOM was rejected! Revise in Design View or switch to "Without Lot" mode.', 'error');
      } else {
        showToast('Workflow Blocked: BOM must be created and Approved before issue, or switch to "Without Lot" mode.', 'error');
      }
      return;
    }

    if (!issuerName || !receiverName) {
      showToast('Please provide both Issuer and Receiver names.', 'error');
      return;
    }

    setGenerating(true);
    try {
      // Ensure slip prefix matches active mode in without lot mode
      let currentSlipNo = issueSlipNo;
      if (withoutLotActive) {
        const expectedPrefix = materialMode === 'tape' ? 'tape-w/o-' : materialMode === 'bone' ? 'bone-w/o-' : 'elastic-w/o-';
        if (!currentSlipNo || !currentSlipNo.toLowerCase().startsWith(expectedPrefix)) {
          currentSlipNo = await fetchNextIssueSlipNo(true, materialMode);
        }
      } else if (!currentSlipNo) {
        currentSlipNo = await fetchNextIssueSlipNo(false);
      }
      const currentLotNo = withoutLotActive ? '' : (lotDetails?.lotNo || searchLotInput.trim() || 'FLOOR-STOCK');
      const currentQuantity = parseInt(issuePcs || lotDetails?.quantity || 600, 10);
      const calculatedRolls = calcResult.recommendedRolls || Math.ceil((calcResult.totalElasticMtr || 762) / 25) || rollCount;

      const payload = {
        slipNo: currentSlipNo,
        lotNo: currentLotNo,
        isWithoutLot: withoutLotActive,
        isWithoutPo: withoutLotActive,
        rolls: calculatedRolls,
        width: effectiveWidth,
        tapeWidth: effectiveTapeWidth,
        boneWidth: effectiveBoneWidth,
        boneRolls: boneRollCount,
        shade: selectedShade || lotDetails?.shade || 'Standard Shade',
        issuerName,
        receiverName,
        supervisorName: supervisorName || lotDetails?.supervisor || 'ROHIT / MONU',
        date: issueDate,
        style: withoutLotActive ? (withoutLotStyle || 'Floor Issue') : (lotDetails?.style || 'LOWER'),
        brand: lotDetails?.brand || 'Mohit Hosiery',
        garmentType: lotDetails?.garmentType || 'LOWER',
        fabric: lotDetails?.fabric || 'Cotton Poly Blend',
        quantity: currentQuantity,
        cuttingQty: parseInt(lotDetails?.quantity || currentQuantity, 10),
        issuePcs: currentQuantity,
        size: lotDetails?.size || 'M, L, XL, 2XL',
        elasticPerPcMtr: calcResult.elasticPerPcMtr,
        totalElasticMtr: calcResult.totalElasticMtr,
        tapePerPcMtr: calcResult.tapePerPcMtr,
        totalTapeMtr: calcResult.totalTapeMtr,
        elasticSizeInput,
        elasticUnit,
        tapeSizeInput,
        tapeUnit,
        materialMode,
        formulaExplanation: calcResult.formulaExplanation,
        remarks: remarks || (isWithoutPo ? 'Floor Material Issue without PO' : '')
      };

      const doc = await createElasticIssuePDFDocument(payload);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const generatedData = {
        ...payload,
        doc,
        pdfUrl,
        isSaved: false
      };

      setGeneratedSlipData(generatedData);
      showToast(`Bill ${currentSlipNo} preview ready. Review and confirm to save.`);
    } catch (err) {
      console.error('Issue bill generation error:', err);
      showToast(err.message || 'Failed to generate Original Bill.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const [savingSlip, setSavingSlip] = useState(false);

  const handleConfirmAndSaveBill = async () => {
    if (!generatedSlipData) return;
    setSavingSlip(true);
    try {
      await saveToHistory(generatedSlipData);
      await fetchNextIssueSlipNo();
      setGeneratedSlipData(prev => prev ? { ...prev, isSaved: true } : null);
      showToast(`Original Material Issue Bill ${generatedSlipData.slipNo} confirmed and saved successfully!`);
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save bill details.', 'error');
    } finally {
      setSavingSlip(false);
    }
  };

  const handleDownloadPDF = () => {
    if (generatedSlipData?.doc) {
      generatedSlipData.doc.save(`${generatedSlipData.slipNo}_Original_Material_Issue_Bill.pdf`);
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
      const isItemWithoutLot = Boolean(item.isWithoutLot || item.isWithoutPo || !item.lotNo || item.lotNo === 'W/O-LOT' || item.lotNo === 'W/O-PO-FLOOR' || String(item.slipNo).toLowerCase().includes('-w/o-'));
      const itemMode = String(item.slipNo || '').toLowerCase().startsWith('tape')
        ? 'tape'
        : String(item.slipNo || '').toLowerCase().startsWith('bone')
          ? 'bone'
          : String(item.slipNo || '').toLowerCase().startsWith('elastic')
            ? 'elastic'
            : (item.materialMode || materialMode);

      const doc = await createElasticIssuePDFDocument({
        ...item,
        slipNo: item.slipNo,
        lotNo: item.lotNo,
        isWithoutLot: isItemWithoutLot,
        isWithoutPo: isItemWithoutLot,
        width: item.width || item.elasticWidth || '1 Inch (Standard)',
        tapeWidth: item.tapeWidth || '0.5 Inch (Standard)',
        boneWidth: item.boneWidth || '1.5 Inch (Standard)',
        shade: item.shade || 'Standard',
        issuerName: item.issuerName || 'Store Staff',
        receiverName: item.receiverName || 'Cutting Master',
        supervisorName: item.supervisorName || 'ROHIT / MONU',
        date: item.date || new Date().toISOString().split('T')[0],
        style: item.style || 'LOWER',
        brand: item.brand || 'Mohit Hosiery',
        garmentType: item.garmentType || 'LOWER',
        fabric: item.fabric || 'Cotton Poly Blend',
        quantity: item.quantity || 600,
        size: item.size || 'M, L, XL, 2XL',
        elasticPerPcMtr: item.elasticPerPcMtr || calcResult.elasticPerPcMtr,
        totalElasticMtr: item.totalElasticMtr || calcResult.totalElasticMtr,
        tapePerPcMtr: item.tapePerPcMtr || calcResult.tapePerPcMtr,
        totalTapeMtr: item.totalTapeMtr || calcResult.totalTapeMtr,
        elasticSizeInput,
        elasticUnit,
        tapeSizeInput,
        tapeUnit,
        materialMode: itemMode,
        formulaExplanation: item.formulaExplanation || calcResult.formulaExplanation,
        remarks: item.remarks || ''
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setGeneratedSlipData({
        ...item,
        doc,
        pdfUrl,
        isSaved: true
      });
    } catch (err) {
      console.error('Reprint error:', err);
      showToast('Failed to open bill for printing.', 'error');
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
            {/* ISSUE METHOD SELECTOR: WITH LOT vs WITHOUT LOT */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 18px',
              borderRadius: '14px',
              background: withoutLotActive ? '#fff7ed' : '#f0fdf4',
              border: withoutLotActive ? '1.5px solid #fdba74' : '1.5px solid #86efac',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: withoutLotActive ? '#9a3412' : '#166534' }}>
                  Select Issue Method:
                </span>
                <div style={{ display: 'inline-flex', background: '#ffffff', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWithoutLot(false);
                      setIsWithoutPo(false);
                      setLotDetails(null);
                      setSearchLotInput('');
                      setBomStatus('idle');
                      showToast('Switched to "With Lot" Mode (BOM verification active).');
                    }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      background: !withoutLotActive ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
                      color: !withoutLotActive ? '#ffffff' : '#64748b',
                      boxShadow: !withoutLotActive ? '0 2px 8px rgba(5, 150, 105, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ShieldCheck size={15} /> With Lot (BOM / PO Verified)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWithoutLot(true);
                      setIsWithoutPo(true);
                      setBomStatus('idle');
                      setSearchLotInput('');
                      setLotDetails({
                        lotNo: '',
                        style: withoutLotStyle || 'Floor Issue',
                        quantity: issuePcs || 600,
                        brand: 'Floor Issue',
                        garmentType: withoutLotStyle || 'Floor Issue',
                        fabric: 'Standard',
                        shade: 'Standard'
                      });
                      if (materialMode === 'both' || materialMode === 'all') {
                        setMaterialMode('elastic');
                      }
                      if (!issuePcs) setIssuePcs(600);
                      showToast('⚡ Switched to "Without Lot" Mode. All BOM & PO restrictions removed!');
                    }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      background: withoutLotActive ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'transparent',
                      color: withoutLotActive ? '#ffffff' : '#64748b',
                      boxShadow: withoutLotActive ? '0 2px 8px rgba(234, 88, 12, 0.35)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Zap size={15} /> Without Lot (Direct Floor Issue - No Restriction)
                  </button>
                </div>
              </div>

              <span style={{ fontSize: '12px', fontWeight: '700', color: withoutLotActive ? '#c2410c' : '#15803d' }}>
                {withoutLotActive
                  ? '⚡ Without Lot: Direct floor issue unlocked. No BOM or PO restrictions!'
                  : '🏷️ With Lot: Search and verify Lot against approved BOM.'}
              </span>
            </div>

            {/* STEP 1: CONDITIONAL DISPLAY FOR WITHOUT LOT VS WITH LOT */}
            {withoutLotActive ? (
              <div style={{
                marginBottom: '16px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                border: '1.5px solid #fdba74',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: '#ea580c', color: '#ffffff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800'
                    }}>1</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#9a3412' }}>
                      Direct Floor Movement Details (Without Lot)
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9a3412', fontWeight: '700' }}>
                    Voucher No: <strong style={{ color: '#ea580c' }}>{issueSlipNo || 'Loading...'}</strong>
                    <span style={{ marginLeft: '6px', fontSize: '10.5px', fontWeight: '800', background: '#ffffff', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fed7aa' }}>WITHOUT LOT</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {/* Optional Reference */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                      REFERENCE / TAG (OPTIONAL):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Floor Cutting / Sample / Lot #"
                      value={searchLotInput}
                      onChange={(e) => setSearchLotInput(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1.5px solid #fdba74', background: '#ffffff',
                        fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Style / Garment Name */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                      STYLE / GARMENT ITEM:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lower, Tracksuit, Hoodie..."
                      value={withoutLotStyle}
                      onChange={(e) => setWithoutLotStyle(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1.5px solid #fdba74', background: '#ffffff',
                        fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Quantity Pcs */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                      TARGET CUTTING / ISSUE PCS:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={issuePcs || 600}
                      onChange={(e) => setIssuePcs(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1.5px solid #fdba74', background: '#ffffff',
                        fontSize: '14px', fontWeight: '800', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #fed7aa',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#c2410c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle size={16} color="#ea580c" />
                  <span>Unrestricted Mode: No BOM or PO required! Issue form is completely unlocked below.</span>
                </div>
              </div>
            ) : (
              <>
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

                {/* Approved BOM Lots Quick Selector */}
                {approvedDesignsList.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(5, 150, 105, 0.06)',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} /> Ready to Issue (Approved BOM Lots):
                    </span>
                    {approvedDesignsList.slice(0, 8).map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setSearchLotInput(d.id); handleSearchLot(d.id); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #86efac',
                          background: (lotDetails?.lotNo === d.id || searchLotInput === d.id) ? '#059669' : '#ffffff',
                          color: (lotDetails?.lotNo === d.id || searchLotInput === d.id) ? '#ffffff' : '#047857',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        <span>LOT #{d.id}</span>
                        <span style={{ opacity: 0.8, fontSize: '10px' }}>({d.style || 'Garment'})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent suggestions */}
                {recentLots.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
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
                    marginTop: '16px',
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
              </>
            )}

            {/* BOM APPROVAL STATUS CARD (MANDATORY GATEWAY - ONLY FOR WITH LOT MODE) */}
            {!withoutLotActive && (lotDetails || searchLotInput.trim().length >= 3) && (
              <div style={{
                marginTop: '14px',
                padding: '16px 20px',
                borderRadius: '12px',
                border: bomStatus === 'approved'
                  ? '1.5px solid #86efac'
                  : bomStatus === 'pending'
                    ? '1.5px solid #fcd34d'
                    : '1.5px solid #fca5a5',
                background: bomStatus === 'approved'
                  ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                  : bomStatus === 'pending'
                    ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                    : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {bomStatus === 'approved' ? (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#16a34a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' }}>
                        <ShieldCheck size={20} />
                      </div>
                    ) : bomStatus === 'pending' ? (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#d97706', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)' }}>
                        <AlertTriangle size={20} />
                      </div>
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dc2626', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)' }}>
                        <Lock size={20} />
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '14px',
                          fontWeight: '800',
                          color: bomStatus === 'approved' ? '#166534' : bomStatus === 'pending' ? '#92400e' : '#991b1b'
                        }}>
                          {bomStatus === 'approved' && '✓ BOM Approved & Verified for Issue'}
                          {bomStatus === 'pending' && `⏳ BOM Pending Approval (Status: ${bomDesign?.status || 'In Verification'})`}
                          {bomStatus === 'not_created' && '⚠️ BOM Not Created for this Lot'}
                          {bomStatus === 'rejected' && '❌ BOM Rejected by Admin'}
                          {bomStatus === 'idle' && 'Verifying BOM Status...'}
                        </h4>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: bomStatus === 'approved' ? '#bbf7d0' : bomStatus === 'pending' ? '#fde68a' : '#fecaca',
                          color: bomStatus === 'approved' ? '#14532d' : bomStatus === 'pending' ? '#78350f' : '#7f1d1d'
                        }}>
                          {bomStatus === 'approved' ? 'READY TO ISSUE' : 'ISSUE LOCKED'}
                        </span>
                      </div>

                      <p style={{
                        margin: '3px 0 0 0',
                        fontSize: '12px',
                        color: bomStatus === 'approved' ? '#15803d' : bomStatus === 'pending' ? '#b45309' : '#b91c1c',
                        fontWeight: '600',
                        lineHeight: '1.4'
                      }}>
                        {bomStatus === 'approved' && `BOM verified with ${(bomDesign?.bom || []).length} accessory items configured (${bomDesign?.style || lotDetails?.style || 'Garment Design'}). You are authorized to issue Elastic materials.`}
                        {bomStatus === 'pending' && `A BOM design was submitted for Lot #${lotDetails?.lotNo || searchLotInput}, but it is awaiting Admin Approval in the Approval Queue. Elastic materials can only be issued after approval.`}
                        {bomStatus === 'not_created' && `No Bill of Materials (BOM) found for Lot #${lotDetails?.lotNo || searchLotInput}. Workflow Rule: BOM must be created and approved first in Design Management.`}
                        {bomStatus === 'rejected' && `The BOM for Lot #${lotDetails?.lotNo || searchLotInput} was rejected. Please review and revise the BOM in Design Management.`}
                        {bomStatus === 'idle' && 'Checking if a verified BOM exists for this lot...'}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Action Buttons for Unapproved or Missing BOM */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {bomStatus === 'not_created' && (
                      <button
                        type="button"
                        onClick={() => handleCreateBOM(lotDetails?.lotNo || searchLotInput)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Plus size={15} /> Create BOM for Lot #{lotDetails?.lotNo || searchLotInput}
                      </button>
                    )}

                    {bomStatus === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={handleViewApprovalQueue}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <ExternalLink size={15} /> Go to Approval Queue
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateBOM(lotDetails?.lotNo || searchLotInput)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #f59e0b',
                            background: '#ffffff',
                            color: '#b45309',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          View/Edit BOM
                        </button>
                      </>
                    )}

                    {bomStatus === 'rejected' && (
                      <button
                        type="button"
                        onClick={() => handleCreateBOM(lotDetails?.lotNo || searchLotInput)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#dc2626',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        Revise BOM in Design View
                      </button>
                    )}

                    {/* Quick 1-Click W/O PO Issue Bypass Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsWithoutPo(true);
                        if (!lotDetails) {
                          setLotDetails({
                            lotNo: searchLotInput || 'W/O-PO-FLOOR',
                            style: 'Floor Issue',
                            quantity: issuePcs || 600,
                            brand: 'Mohit Hosiery',
                            garmentType: 'LOWER',
                            fabric: 'Cotton Poly Blend',
                            shade: 'Standard'
                          });
                          if (!issuePcs) setIssuePcs(600);
                        }
                        showToast(`⚡ Issue W/O PO enabled for Lot #${lotDetails?.lotNo || searchLotInput}. Issue form unlocked!`);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Zap size={15} /> ⚡ Issue W/O PO (Bypass PO / BOM)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BACKEND CALCULATION & STEP 2 (SHOWN AFTER LOT IS ENTERED & BOM APPROVED, OR IF W/O PO) */}
            {(lotDetails || isWithoutPo) && (bomStatus === 'approved' || isWithoutPo) && (
              <>
                {/* BACKEND CALCULATION & CONVERSION CARD */}
                <div style={{
              marginTop: '18px',
              padding: '18px 20px',
              borderRadius: '14px',
              background: '#ffffff',
              border: '1.5px solid #059669',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: materialMode === 'tape' ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff'
                  }}>
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                      Automated Backend Meter Conversion & Consumption
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Formulas: <strong>Inchs × 0.0254 = Mtr</strong> &bull; <strong>CMs ÷ 100 = Mtr</strong>
                    </span>
                  </div>
                </div>

                {/* MATERIAL SWITCH CONTROLS (ELASTIC, TAPE, BONE) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#f1f5f9',
                  padding: '4px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    onClick={() => setMaterialMode('elastic')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: materialMode === 'elastic' ? '#059669' : 'transparent',
                      color: materialMode === 'elastic' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: materialMode === 'elastic' ? '0 2px 8px rgba(5, 150, 105, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'elastic' ? '#a7f3d0' : '#059669' }}></span>
                    Elastic Only
                  </button>

                  <button
                    type="button"
                    onClick={() => setMaterialMode('tape')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: materialMode === 'tape' ? '#2563eb' : 'transparent',
                      color: materialMode === 'tape' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: materialMode === 'tape' ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'tape' ? '#bfdbfe' : '#2563eb' }}></span>
                    Tape Only
                  </button>

                  <button
                    type="button"
                    onClick={() => setMaterialMode('bone')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: materialMode === 'bone' ? '#0284c7' : 'transparent',
                      color: materialMode === 'bone' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: materialMode === 'bone' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'bone' ? '#bae6fd' : '#0284c7' }}></span>
                    Bone Only
                  </button>

                  {!withoutLotActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMaterialMode('both')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: materialMode === 'both' ? '#0f172a' : 'transparent',
                          color: materialMode === 'both' ? '#ffffff' : '#475569',
                          fontWeight: '800',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: materialMode === 'both' ? '0 2px 8px rgba(15, 23, 42, 0.35)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Sliders size={13} />
                        Elastic + Tape
                      </button>

                      <button
                        type="button"
                        onClick={() => setMaterialMode('all')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: materialMode === 'all' ? '#7c3aed' : 'transparent',
                          color: materialMode === 'all' ? '#ffffff' : '#475569',
                          fontWeight: '800',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: materialMode === 'all' ? '0 2px 8px rgba(124, 58, 237, 0.35)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Layers size={13} />
                        All (Elastic + Tape + Bone)
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* INPUT CONTROLS: ELASTIC, TAPE OR BONE (BASED ON SWITCH) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: materialMode === 'both' ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
                gap: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                {/* ELASTIC INPUT (Shown if 'elastic' or 'both') */}
                {(materialMode === 'elastic' || materialMode === 'both') && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1.5px solid #86efac',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.06)'
                  }}>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span>
                        ELASTIC SIZE INPUT
                      </span>
                      <span style={{ fontSize: '11px', background: '#dcfce7', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        Formula: {String(elasticUnit).toLowerCase() === 'cm' ? '÷ 100' : String(elasticUnit).toLowerCase() === 'mtr' ? '× 1' : String(elasticUnit).toLowerCase() === 'yard' ? '× 0.9144' : '× 0.0254'}
                      </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={elasticSizeInput}
                        onChange={(e) => setElasticSizeInput(e.target.value)}
                        placeholder="e.g. 50"
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px',
                          border: '1.5px solid #059669', fontSize: '16px', fontWeight: '800',
                          color: '#0f172a', background: '#ffffff', outline: 'none'
                        }}
                      />
                      <SmartSelectWithManual
                        value={elasticUnit}
                        onChange={setElasticUnit}
                        options={[
                          { label: 'Inch (×0.0254)', value: 'inch' },
                          { label: 'CM (÷100)', value: 'cm' },
                          { label: 'Mtr (×1)', value: 'mtr' },
                          { label: 'Yard (×0.9144)', value: 'yard' },
                          { label: 'MM (÷1000)', value: 'mm' }
                        ]}
                        placeholder="Unit"
                        manualPlaceholder="e.g. inch"
                        manualLabel="+ Manual Unit"
                        unitMode={true}
                        icon="ruler"
                        theme="emerald"
                      />
                    </div>

                    {/* Elastic Presets */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {[
                        { label: '50 Inch (1.27m)', size: '50', u: 'inch' },
                        { label: '32 Inch (0.81m)', size: '32', u: 'inch' },
                        { label: '40 Inch (1.02m)', size: '40', u: 'inch' }
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setElasticSizeInput(p.size);
                            setElasticUnit(p.u);
                          }}
                          style={{
                            padding: '4px 9px', borderRadius: '6px',
                            border: elasticSizeInput === p.size && elasticUnit === p.u ? '1.5px solid #059669' : '1px solid #cbd5e1',
                            background: elasticSizeInput === p.size && elasticUnit === p.u ? '#dcfce7' : '#ffffff',
                            color: elasticSizeInput === p.size && elasticUnit === p.u ? '#059669' : '#475569',
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAPE INPUT (Shown if 'tape' or 'both') */}
                {(materialMode === 'tape' || materialMode === 'both') && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1.5px solid #93c5fd',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)'
                  }}>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                        TAPE SIZE INPUT
                      </span>
                      <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        Formula: {String(tapeUnit).toLowerCase() === 'cm' ? '÷ 100' : String(tapeUnit).toLowerCase() === 'mtr' ? '× 1' : String(tapeUnit).toLowerCase() === 'yard' ? '× 0.9144' : '× 0.0254'}
                      </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={tapeSizeInput}
                        onChange={(e) => setTapeSizeInput(e.target.value)}
                        placeholder="e.g. 62"
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px',
                          border: '1.5px solid #3b82f6', fontSize: '16px', fontWeight: '800',
                          color: '#0f172a', background: '#ffffff', outline: 'none'
                        }}
                      />
                      <SmartSelectWithManual
                        value={tapeUnit}
                        onChange={setTapeUnit}
                        options={[
                          { label: 'CM (÷100)', value: 'cm' },
                          { label: 'Inch (×0.0254)', value: 'inch' },
                          { label: 'Mtr (×1)', value: 'mtr' },
                          { label: 'Yard (×0.9144)', value: 'yard' },
                          { label: 'MM (÷1000)', value: 'mm' }
                        ]}
                        placeholder="Unit"
                        manualPlaceholder="e.g. cm"
                        manualLabel="+ Manual Unit"
                        unitMode={true}
                        icon="ruler"
                        theme="blue"
                      />
                    </div>

                    {/* Tape Presets */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {[
                        { label: '62 CM (0.62m)', size: '62', u: 'cm' },
                        { label: '50 CM (0.50m)', size: '50', u: 'cm' },
                        { label: '24 Inch (0.61m)', size: '24', u: 'inch' }
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setTapeSizeInput(p.size);
                            setTapeUnit(p.u);
                          }}
                          style={{
                            padding: '4px 9px', borderRadius: '6px',
                            border: tapeSizeInput === p.size && tapeUnit === p.u ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                            background: tapeSizeInput === p.size && tapeUnit === p.u ? '#dbeafe' : '#ffffff',
                            color: tapeSizeInput === p.size && tapeUnit === p.u ? '#1d4ed8' : '#475569',
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BONE INPUT (Shown if 'bone' or 'all') */}
                {(materialMode === 'bone' || materialMode === 'all') && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1.5px solid #0284c7',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.06)'
                  }}>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                        BONE POCKETING INPUT
                      </span>
                      <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        Pocket Bone Roll
                      </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        value={boneRollCount}
                        onChange={(e) => setBoneRollCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        placeholder="Rolls (e.g. 1)"
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px',
                          border: '1.5px solid #0284c7', fontSize: '16px', fontWeight: '800',
                          color: '#0f172a', background: '#ffffff', outline: 'none'
                        }}
                      />
                      <SmartSelectWithManual
                        value={boneWidth}
                        onChange={setBoneWidth}
                        options={[
                          { label: '1.5 Inch (Standard)', value: '1.5 Inch (Standard)' },
                          { label: '1 Inch', value: '1 Inch' },
                          { label: '1.25 Inch', value: '1.25 Inch' },
                          { label: '2 Inch', value: '2 Inch' },
                          { label: 'Custom', value: 'Custom' }
                        ]}
                        placeholder="Bone Width"
                        manualPlaceholder="e.g. 1.75 Inch"
                        manualLabel="+ Custom Width"
                        icon="ruler"
                        theme="blue"
                      />
                    </div>

                    {/* Bone Presets */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {['1.5 Inch (Standard)', '1.25 Inch', '1 Inch'].map(bw => (
                        <button
                          key={bw}
                          type="button"
                          onClick={() => setBoneWidth(bw)}
                          style={{
                            padding: '4px 9px', borderRadius: '6px',
                            border: boneWidth === bw ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            background: boneWidth === bw ? '#e0f2fe' : '#ffffff',
                            color: boneWidth === bw ? '#0284c7' : '#475569',
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          {bw}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* EXACT BREAKDOWN TABLE: ELASTIC, TAPE OR BONE */}
              <div style={{ marginTop: '16px', overflowX: 'auto', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#ffffff', fontSize: '12px', fontWeight: '800' }}>
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Material</th>
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'right' }}>Input</th>
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'center' }}>Conversion Formula</th>
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'right' }}>Per Pc (In Mtr)</th>
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'right' }}>Pcs</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const effPcs = parseInt(issuePcs || lotDetails?.quantity || 600, 10);
                      const ePerPc = parseFloat(calcResult.elasticPerPcMtr || (elasticUnit === 'cm' ? (parseFloat(elasticSizeInput) || 0) / 100 : (parseFloat(elasticSizeInput) || 0) * 0.0254).toFixed(4)) || 0;
                      const eTotal = parseFloat((ePerPc * effPcs).toFixed(4));

                      const tPerPc = parseFloat(calcResult.tapePerPcMtr || (tapeUnit === 'cm' ? (parseFloat(tapeSizeInput) || 0) / 100 : (parseFloat(tapeSizeInput) || 0) * 0.0254).toFixed(4)) || 0;
                      const tTotal = parseFloat((tPerPc * effPcs).toFixed(4));

                      return (
                        <>
                          {/* ELASTIC ROW */}
                          {(materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                            <tr style={{ background: '#ffffff', borderBottom: (materialMode === 'both' || materialMode === 'all') ? '1px solid #e2e8f0' : 'none' }}>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span>
                                Elastic
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                {elasticSizeInput || 0} {elasticUnit === 'cm' ? 'CM' : 'Inch'}
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <code style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>
                                  {elasticUnit === 'cm' ? `${elasticSizeInput || 0} ÷ 100` : `${elasticSizeInput || 0} × 0.0254`}
                                </code>
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '900', color: '#047857', fontSize: '14px', background: '#f0fdf4' }}>
                                {ePerPc} m
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                {effPcs}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#065f46', fontSize: '15px', background: '#dcfce7' }}>
                                {eTotal} m
                              </td>
                            </tr>
                          )}

                          {/* TAPE ROW */}
                          {(materialMode === 'tape' || materialMode === 'both' || materialMode === 'all') && (
                            <tr style={{ background: '#ffffff', borderBottom: materialMode === 'all' ? '1px solid #e2e8f0' : 'none' }}>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', fontWeight: '800', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                                Tape
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                {tapeSizeInput || 0} {tapeUnit === 'cm' ? 'CM' : 'Inch'}
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>
                                  {tapeUnit === 'cm' ? `${tapeSizeInput || 0} ÷ 100` : `${tapeSizeInput || 0} × 0.0254`}
                                </code>
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '900', color: '#1d4ed8', fontSize: '14px', background: '#eff6ff' }}>
                                {tPerPc} m
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                {effPcs}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#1e3a8a', fontSize: '15px', background: '#dbeafe' }}>
                                {tTotal} m
                              </td>
                            </tr>
                          )}

                          {/* BONE ROW */}
                          {(materialMode === 'bone' || materialMode === 'all') && (
                            <tr style={{ background: '#ffffff' }}>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', fontWeight: '800', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                                Bone Pocketing
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                {boneRollCount} Roll(s) ({effectiveBoneWidth})
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <code style={{ background: '#f0f9ff', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>
                                  18 CM Standard Cut
                                </code>
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '900', color: '#0284c7', fontSize: '14px', background: '#f0f9ff' }}>
                                {effectiveBoneWidth}
                              </td>
                              <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                {effPcs}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#0369a1', fontSize: '15px', background: '#e0f2fe' }}>
                                {boneRollCount} Roll(s)
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* EXCEL SHEET PRODUCTION ROW PREVIEW */}
              <div style={{ marginTop: '16px', borderTop: '1px dashed #cbd5e1', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Table size={14} color="#059669" />
                    <span>Excel Sheet Output Preview ({materialMode === 'elastic' ? 'Elastic' : materialMode === 'tape' ? 'Tape' : 'Both'}):</span>
                  </span>
                  {materialMode !== 'tape' && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Total Requirement: <strong>{calcResult.totalElasticMtr} Mtr</strong>
                    </span>
                  )}
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: '800', borderBottom: '1.5px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>DATE</th>
                        {!withoutLotActive && (
                          <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Lot No.</th>
                        )}
                        <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Item Name</th>
                        <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Pcs (Issued)</th>
                        <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Supervisor Name</th>
                        {(materialMode === 'tape' || materialMode === 'both') && (
                          <th style={{ padding: '8px 10px', borderRight: materialMode === 'both' ? '1px solid #e2e8f0' : 'none' }}>Tape Per Pc (In mtr.)</th>
                        )}
                        {(materialMode === 'elastic' || materialMode === 'both') && (
                          <th style={{ padding: '8px 10px' }}>Elastic Per Pc (In mtr.)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: '#ffffff', color: '#0f172a' }}>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>{issueDate}</td>
                        {!withoutLotActive && (
                          <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '800', color: '#059669' }}>
                            {lotDetails?.lotNo || searchLotInput || '—'}
                          </td>
                        )}
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '700' }}>
                          {withoutLotActive ? (withoutLotStyle || 'LOWER') : (lotDetails?.garmentType || lotDetails?.style || 'LOWER')}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '800' }}>
                          {issuePcs}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>
                          {lotDetails?.supervisor || issuerName || 'ROHIT / MONU'}
                        </td>
                        {(materialMode === 'tape' || materialMode === 'both') && (
                          <td style={{ padding: '8px 10px', borderRight: materialMode === 'both' ? '1px solid #e2e8f0' : 'none', fontWeight: '700', color: '#1d4ed8' }}>
                            {calcResult.tapePerPcMtr > 0 ? `${calcResult.tapePerPcMtr}` : '—'}
                          </td>
                        )}
                        {(materialMode === 'elastic' || materialMode === 'both') && (
                          <td style={{ padding: '8px 10px', fontWeight: '800', color: '#047857', background: '#f0fdf4' }}>
                            {calcResult.elasticPerPcMtr || 0}
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* STEP 2: ISSUE DETAILS & ORIGINAL BILL SPECIFICATIONS */}
            <div style={{
              marginTop: '28px',
              paddingTop: '22px',
              borderTop: '2px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
                }}>2</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    Issue Details (Date, Issuer, Receiver & Supervisor)
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Fill date, issuer, receiver and review total requirement before generating original bill / PO
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

              {/* LEFT COLUMN: ISSUER, RECEIVER, SUPERVISOR & DATE */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <User size={16} color="#059669" />
                  <span>Issue & Requisition Information:</span>
                </div>

                {/* ISSUER NAME */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <User size={14} color="#059669" />
                    <span>Issuer Name (Store Staff / Prepared By):</span>
                  </label>
                  <SmartSelectWithManual
                    value={issuerName}
                    onChange={setIssuerName}
                    options={['PARAS', 'RASHMI', 'STORE STAFF', 'ADMIN', 'STORE INCHARGE']}
                    placeholder="Select Issuer or + Manual Entry"
                    manualPlaceholder="Type custom issuer name..."
                    manualLabel="+ Manual Entry (Store Staff)"
                    localStorageKey="elastic_issuer_names"
                    icon="user"
                    theme="emerald"
                  />
                </div>

                {/* RECEIVER NAME */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Scissors size={14} color="#059669" />
                    <span>Receiver Name (Cutting Master / Received By):</span>
                  </label>
                  <SmartSelectWithManual
                    value={receiverName}
                    onChange={setReceiverName}
                    options={['JAYBIR', 'ROHIT', 'MONU', 'CUTTING MASTER', 'SEWING MASTER']}
                    placeholder="Select Receiver or + Manual Entry"
                    manualPlaceholder="Type custom receiver name..."
                    manualLabel="+ Manual Entry (Cutting Master)"
                    localStorageKey="elastic_receiver_names"
                    icon="scissors"
                    theme="emerald"
                  />
                </div>

                {/* SUPERVISOR NAME */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <ShieldCheck size={14} color="#059669" />
                    <span>Supervisor / Floor Incharge Name:</span>
                  </label>
                  <SmartSelectWithManual
                    value={supervisorName}
                    onChange={setSupervisorName}
                    options={['ROHIT / MONU', 'MOHIT SIR', 'MANISH', 'FLOOR SUPERVISOR', 'STORE INCHARGE']}
                    placeholder="Select Supervisor or + Manual Entry"
                    manualPlaceholder="Type custom supervisor name..."
                    manualLabel="+ Manual Entry (Supervisor)"
                    localStorageKey="elastic_supervisor_names"
                    icon="shield"
                    theme="emerald"
                  />
                </div>

                {/* Issue Date & Remarks */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      ISSUE DATE
                    </span>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      style={{
                        width: '100%', padding: '8px', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '12.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
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
                      placeholder="e.g. Elastic for waistband..."
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '12px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: TOTAL REQUIREMENT LIVE SUMMARY */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1.5px solid #059669',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.08)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={16} color="#059669" />
                      <span>Total Requirement on Original Bill:</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#059669', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                      ORIGINAL BILL SPEC
                    </span>
                  </div>

                  {/* Production Quick Details & Editable Issue Pcs */}
                  {withoutLotActive ? (
                    <div style={{
                      background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #fed7aa',
                      marginBottom: '12px',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ fontSize: '10.5px', color: '#c2410c', display: 'block', fontWeight: '800', textTransform: 'uppercase' }}>
                          ISSUE MODE & ITEM
                        </span>
                        <strong style={{ color: '#9a3412', fontSize: '13.5px' }}>
                          Without Lot — {withoutLotStyle || 'Floor Issue'}
                        </strong>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        background: '#ea580c',
                        color: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        ⚡ DIRECT FLOOR ISSUE
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontSize: '12.5px' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: '700' }}>LOT & ITEM</span>
                        <strong style={{ color: '#0f172a' }}>LOT #{lotDetails?.lotNo || searchLotInput || '—'} ({lotDetails?.garmentType || lotDetails?.style || 'LOWER'})</strong>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: '700' }}>CUTTING MATRIX PCS</span>
                        <strong style={{ color: '#059669', fontSize: '13.5px' }}>{lotDetails?.quantity || 600} Pcs</strong>
                      </div>
                    </div>
                  )}

                  {/* Editable Issue Pcs Box */}
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    marginBottom: '14px'
                  }}>
                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Scissors size={14} color="#059669" />
                        <span>Issue Pcs (Editable):</span>
                      </span>
                      <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        Live Auto-Calculation
                      </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="1"
                        value={issuePcs}
                        onChange={(e) => setIssuePcs(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        placeholder="e.g. 600"
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1.5px solid #059669',
                          background: '#ffffff',
                          fontSize: '15px',
                          fontWeight: '800',
                          color: '#0f172a',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>Pcs</span>
                      {!withoutLotActive && lotDetails?.quantity && (
                        <button
                          type="button"
                          onClick={() => setIssuePcs(parseInt(lotDetails.quantity, 10))}
                          style={{
                            padding: '6px 9px',
                            borderRadius: '6px',
                            border: '1px solid #86efac',
                            background: '#ffffff',
                            color: '#047857',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Match Cutting ({lotDetails.quantity})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Material Requirement Highlights */}
                  {(materialMode === 'elastic' || materialMode === 'both') && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      marginBottom: materialMode === 'both' ? '10px' : '14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800', textTransform: 'uppercase' }}>
                            Elastic Total Requirement
                          </span>
                          <div style={{ fontSize: '12px', color: '#334155', fontWeight: '600', marginTop: '2px' }}>
                            Per Pc: <strong>{calcResult.elasticPerPcMtr} Mtr</strong> ({elasticSizeInput} {elasticUnit}) × {issuePcs} Pcs
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#059669', lineHeight: '1.1' }}>
                            {calcResult.totalElasticMtr} Mtr
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(materialMode === 'tape' || materialMode === 'both') && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#eff6ff',
                      border: '1.5px solid #93c5fd',
                      marginBottom: '14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '800', textTransform: 'uppercase' }}>
                            Tape Total Requirement
                          </span>
                          <div style={{ fontSize: '12px', color: '#334155', fontWeight: '600', marginTop: '2px' }}>
                            Per Pc: <strong>{calcResult.tapePerPcMtr} Mtr</strong> ({tapeSizeInput} {tapeUnit}) × {issuePcs} Pcs
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '20px', fontWeight: '900', color: '#1d4ed8', lineHeight: '1.1' }}>
                            {calcResult.totalTapeMtr} Mtr
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Formula Note */}
                  <div style={{ fontSize: '11.5px', color: '#64748b', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>
                    Conversion Formula: <strong style={{ color: '#0f172a' }}>{calcResult.formulaExplanation}</strong>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700', marginTop: '10px', textAlign: 'center' }}>
                  ✓ All details verified & ready to print formal original bill / PO
                </div>
              </div>

            </div>

            {/* ACTION: GENERATE BILL BUTTON */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {withoutLotActive ? (
                  <span style={{ color: '#c2410c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} /> Without Lot Mode ({materialMode === 'tape' ? 'Tape Only' : materialMode === 'bone' ? 'Bone Only' : 'Elastic Only'}) &bull; Total: <strong style={{ color: '#ea580c' }}>{materialMode === 'tape' ? `${calcResult.totalTapeMtr} Mtr` : materialMode === 'bone' ? `${boneRollCount} Roll(s)` : `${calcResult.totalElasticMtr} Mtr`}</strong>
                  </span>
                ) : bomStatus === 'approved' ? (
                  <span>
                    Total Requirement: <strong style={{ color: '#059669' }}>{materialMode === 'tape' ? `${calcResult.totalTapeMtr} Mtr` : materialMode === 'bone' ? `${boneRollCount} Roll(s)` : `${calcResult.totalElasticMtr} Mtr`}</strong> for <strong>LOT #{lotDetails?.lotNo || searchLotInput || '—'}</strong> (BOM Approved ✓)
                  </span>
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={15} /> Original Issue Bill / PO generation locked until BOM is created & approved
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={generateElasticIssueBill}
                disabled={generating || (!withoutLotActive && bomStatus !== 'approved')}
                title={(!withoutLotActive && bomStatus !== 'approved') ? 'BOM must be created and approved by Admin before generating issue bill' : 'Generate official Original Material Issue Bill / PO'}
                style={{
                  padding: '12px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  background: (withoutLotActive || bomStatus === 'approved')
                    ? (withoutLotActive ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)')
                    : '#94a3b8',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '800',
                  cursor: (generating || (!withoutLotActive && bomStatus !== 'approved')) ? 'not-allowed' : 'pointer',
                  boxShadow: (withoutLotActive || bomStatus === 'approved') ? (withoutLotActive ? '0 6px 18px rgba(234, 88, 12, 0.4)' : '0 6px 18px rgba(5, 150, 105, 0.4)') : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  opacity: (withoutLotActive || bomStatus === 'approved') ? 1 : 0.7
                }}
              >
                {generating ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (withoutLotActive || bomStatus === 'approved') ? (
                  <Printer size={18} />
                ) : (
                  <Lock size={18} />
                )}
                <span>
                  {generating
                    ? 'Generating Original Bill...'
                    : withoutLotActive
                      ? `Generate W/O Lot ${materialMode === 'tape' ? 'Tape' : materialMode === 'bone' ? 'Bone' : 'Elastic'} Issue Slip`
                      : 'Generate Original Issue Bill / PO'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* EMPTY WAITING STATE (WHEN NO LOT HAS BEEN SEARCHED / ENTERED YET AND NOT IN W/O PO MODE) */}
      {!lotDetails && !isWithoutPo && (
        <div className="panel" style={{
          padding: '36px 24px',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1.5px dashed #cbd5e1',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#f0fdf4',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Search size={22} />
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
            Enter or Select a Lot Number Above
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted, #64748b)', fontWeight: '500', maxWidth: '440px' }}>
            Search a Lot Number above or click an Approved Lot to verify BOM approval and open the Elastic / Tape calculation and issue form.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setIsWithoutPo(true);
                setLotDetails({
                  lotNo: searchLotInput || 'W/O-PO-FLOOR',
                  style: 'Floor Issue',
                  quantity: 600,
                  brand: 'Mohit Hosiery',
                  garmentType: 'LOWER',
                  fabric: 'Cotton Poly Blend',
                  shade: 'Standard'
                });
                setIssuePcs(600);
                showToast('⚡ Issue W/O PO enabled. Form is unlocked for direct issue!');
              }}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Zap size={16} /> ⚡ Issue W/O PO (Elastic, Tape or Bone Floor Issue)
            </button>
          </div>
        </div>
      )}
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
                    <th style={{ padding: '10px 12px' }}>BILL / SLIP NO</th>
                    <th style={{ padding: '10px 12px' }}>DATE</th>
                    <th style={{ padding: '10px 12px' }}>LOT NO</th>
                    <th style={{ padding: '10px 12px' }}>ITEM / STYLE</th>
                    <th style={{ padding: '10px 12px' }}>PCS</th>
                    <th style={{ padding: '10px 12px' }}>PER PC REQ.</th>
                    <th style={{ padding: '10px 12px' }}>TOTAL REQUIREMENT</th>
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
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '12.5px',
                            fontWeight: '800',
                            color: String(item.slipNo || '').toLowerCase().includes('-w/o-') ? '#c2410c' : '#059669',
                            background: String(item.slipNo || '').toLowerCase().includes('-w/o-') ? '#fff7ed' : '#f0fdf4',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: String(item.slipNo || '').toLowerCase().includes('-w/o-') ? '1px solid #fed7aa' : '1px solid #bbf7d0',
                            display: 'inline-block'
                          }}>
                            {item.slipNo}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                          {(!item.lotNo || item.lotNo === 'W/O-LOT' || item.lotNo === 'W/O-PO-FLOOR' || item.isWithoutLot || item.isWithoutPo || String(item.slipNo).toLowerCase().includes('-w/o-')) ? (
                            <span style={{
                              background: '#fff7ed',
                              color: '#c2410c',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '800',
                              border: '1px solid #fed7aa'
                            }}>
                              W/O LOT
                            </span>
                          ) : (
                            `LOT #${item.lotNo}`
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.style || item.garmentType || 'LOWER'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                          {item.quantity || 600} Pcs
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#047857' }}>
                          {item.elasticPerPcMtr || item.elastic_per_pc_mtr ? `${item.elasticPerPcMtr || item.elastic_per_pc_mtr} Mtr` : '1.27 Mtr'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '900', color: '#065f46', background: '#f0fdf4' }}>
                          {item.totalElasticMtr || item.total_elastic_mtr ? `${item.totalElasticMtr || item.total_elastic_mtr} Mtr` : '762 Mtr'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.issuerName || 'STORE STAFF'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '700' }}>
                          {item.receiverName || 'CUTTING MASTER'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleReprintFromHistory(item)}
                            title="Print Original Bill (B&W)"
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
                            <Printer size={11} /> Print (Original)
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

      {/* GENERATED BILL / CONFIRMATION MODAL */}
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
            maxWidth: '580px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            animation: 'scaleIn 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: generatedSlipData.isSaved
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '18px 24px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: generatedSlipData.isSaved ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: generatedSlipData.isSaved ? '#ffffff' : '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    {generatedSlipData.isSaved ? 'Original Issue Bill Saved & Ready!' : 'Review & Confirm Bill Details'}
                  </h3>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Bill / PO No: <strong>{generatedSlipData.slipNo}</strong> {!generatedSlipData.isSaved && '• (Pending Save Confirmation)'}
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
              {/* Notice banner depending on saved state */}
              {!generatedSlipData.isSaved ? (
                <div style={{
                  background: '#fefce8',
                  border: '1.5px solid #fde047',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#854d0e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600'
                }}>
                  <AlertTriangle size={18} style={{ color: '#ca8a04', flexShrink: 0 }} />
                  <span>Please verify all details below. Click <strong>"Confirm & Save Bill"</strong> to record in system.</span>
                </div>
              ) : (
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '700'
                }}>
                  <CheckCircle size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>✓ Successfully saved to database & history! You can now print or download the original bill.</span>
                </div>
              )}

              {/* Details Grid */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>
                      {(generatedSlipData.isWithoutLot || generatedSlipData.isWithoutPo) ? 'ISSUE MODE' : 'LOT NUMBER'}
                    </span>
                    <strong style={{ color: (generatedSlipData.isWithoutLot || generatedSlipData.isWithoutPo) ? '#ea580c' : '#0f172a' }}>
                      {(generatedSlipData.isWithoutLot || generatedSlipData.isWithoutPo) ? '⚡ WITHOUT LOT (Floor Issue)' : `LOT #${generatedSlipData.lotNo}`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>TOTAL REQUIREMENT ON BILL</span>
                    <strong style={{ color: '#059669', fontSize: '16px' }}>{generatedSlipData.totalElasticMtr || 762} Mtr</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ITEM / STYLE & PCS</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.style || 'LOWER'} • {generatedSlipData.issuePcs || generatedSlipData.quantity || 600} Pcs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>PER PC REQUIREMENT</span>
                    <strong style={{ color: '#047857' }}>{generatedSlipData.elasticPerPcMtr || 1.27} Mtr / Pc</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUE DATE</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>SUPERVISOR</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.supervisorName || 'ROHIT / MONU'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUED BY (STORE)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.issuerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>RECEIVED BY (CUTTING)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.receiverName}</strong>
                  </div>
                  {generatedSlipData.remarks && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>REMARKS / NOTES</span>
                      <span style={{ color: '#334155', fontStyle: 'italic' }}>{generatedSlipData.remarks}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Pending Confirm vs Saved */}
              {!generatedSlipData.isSaved ? (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={handleConfirmAndSaveBill}
                      disabled={savingSlip}
                      style={{
                        flex: 1.3,
                        padding: '14px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: '800',
                        cursor: savingSlip ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
                        opacity: savingSlip ? 0.8 : 1
                      }}
                    >
                      {savingSlip ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Saving Details...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={17} />
                          <span>Confirm & Save Bill Details</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintBill}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1.5px solid #0f172a',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Printer size={16} />
                      <span>Preview / Print (B&W)</span>
                    </button>
                  </div>

                  <div style={{ textAlign: 'center' }}>
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
                      Cancel & Edit Details
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={handlePrintBill}
                      style={{
                        flex: 1.2,
                        padding: '13px',
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
                      <span>Print Original Bill (B&W)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      style={{
                        flex: 1,
                        padding: '13px',
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
                      <span>Download Bill (PDF)</span>
                    </button>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setGeneratedSlipData(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#059669',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Done / Issue Next Lot →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
