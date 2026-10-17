import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileText, Search, Plus, Minus, Download, Printer, RefreshCw,
  CheckCircle, AlertTriangle, ArrowRight, Layers, Box, Check, X,
  Calendar, User, ShieldCheck, Sparkles, Sliders, Scissors, Lock, ExternalLink, Zap,
  Scale, MapPin, Edit2, CheckCircle2, Eye
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getBackendUrl } from '../utils/api';
import SmartSelectWithManual from './SmartSelectWithManual';

export default function BoneIssueView({
  currencySymbol = '₹',
  currentUser = null,
  prefilledLotNo = '',
  setPrefilledLotNo = () => {},
  onNavigate = () => {}
}) {
  // Tab Mode: 'generator' (Issue Form) or 'history' (Past Issue Slips)
  const [viewMode, setViewMode] = useState('generator');

  // Issue Method: With Lot vs Without Lot
  const [isWithoutLot, setIsWithoutLot] = useState(false);
  const [withoutLotStyle, setWithoutLotStyle] = useState('Lower / Tracksuit');

  // Step 1: Search Lot State
  const [searchLotInput, setSearchLotInput] = useState(prefilledLotNo || '');
  const [searchingLot, setSearchingLot] = useState(false);
  const [lotDetails, setLotDetails] = useState(null);
  const [lotError, setLotError] = useState('');
  const [recentLots, setRecentLots] = useState([]);

  // ── Cutting Details Cache & 30-Minute Auto-Reload ───────────────────────────
  const CUTTING_CACHE_MAX_ENTRIES = 100;
  const CUTTING_CACHE_RELOAD_INTERVAL_MS = 30 * 60 * 1000;
  const [cuttingHeaders, setCuttingHeaders] = useState([]);
  const [lastCuttingCacheReload, setLastCuttingCacheReload] = useState(() => new Date());
  const [isReloadingCuttingCache, setIsReloadingCuttingCache] = useState(false);
  const [cuttingCacheRefreshCount, setCuttingCacheRefreshCount] = useState(0);
  const [cacheReloadNotice, setCacheReloadNotice] = useState('');
  const matrixCacheRef = useRef({});

  // ── Active Lot Cutting Details State & Matrix ──
  const [activeLotCutting, setActiveLotCutting] = useState(null);
  const [loadingActiveLotCutting, setLoadingActiveLotCutting] = useState(false);
  const [showActiveCuttingMatrix, setShowActiveCuttingMatrix] = useState(false);

  const reloadCuttingCache = useCallback(async (manual = false) => {
    setIsReloadingCuttingCache(true);
    matrixCacheRef.current = {};
    try {
      const res = await fetch(`${getBackendUrl()}/api/cutting-headers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCuttingHeaders(data);
      }
      setLastCuttingCacheReload(new Date());
      setCuttingCacheRefreshCount(c => c + 1);
      if (manual) {
        setCacheReloadNotice('✓ Cache emptied & reloaded');
        setTimeout(() => setCacheReloadNotice(''), 3500);
      }
    } catch (err) {
      console.warn('Failed to reload cutting headers cache:', err);
    } finally {
      setIsReloadingCuttingCache(false);
    }
  }, []);

  useEffect(() => {
    reloadCuttingCache(false);
    const intervalId = setInterval(() => {
      reloadCuttingCache(false);
    }, CUTTING_CACHE_RELOAD_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [reloadCuttingCache]);

  const activeSizes = useMemo(() => {
    if (!activeLotCutting || !activeLotCutting.rows || activeLotCutting.rows.length === 0) return [];
    const sizeSet = new Set();
    activeLotCutting.rows.forEach(r => {
      if (r.sizes && typeof r.sizes === 'object') {
        Object.keys(r.sizes).forEach(sz => {
          if (Number(r.sizes[sz]) > 0) sizeSet.add(sz);
        });
      }
    });
    const standardOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', 'FREE', 'FS'];
    return Array.from(sizeSet).sort((a, b) => {
      const idxA = standardOrder.indexOf(a.toUpperCase());
      const idxB = standardOrder.indexOf(b.toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [activeLotCutting]);



  // Step 2: Simple Issue Details (Direct Issue Weight in Kg & Cutting Pcs)
  const [boneWeightKg, setBoneWeightKg] = useState('2.50');
  const [boneRollCount, setBoneRollCount] = useState('');
  const [issuePcs, setIssuePcs] = useState(0);
  const [boneWidth, setBoneWidth] = useState('1.5 Inch (Standard)');
  const [customWidth, setCustomWidth] = useState('');
  const [selectedShade, setSelectedShade] = useState('');
  const effectiveWidth = boneWidth === 'Custom' ? (customWidth || '1.5 Inch') : boneWidth;
  const effectiveTapeWidth = '0.5 Inch (Standard)';
  const effectiveElasticWidth = '1 Inch (Standard)';
  const materialMode = 'bone';

  // Issuer, Receiver & Supervisor
  const [issuerName, setIssuerName] = useState(currentUser?.name || 'paras');
  const [receiverName, setReceiverName] = useState('');
  const [supervisorName, setSupervisorName] = useState('ROHIT / MONU');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [issueSlipNo, setIssueSlipNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Generation & Modal State
  const [generating, setGenerating] = useState(false);
  const [savingSlip, setSavingSlip] = useState(false);
  const [generatedSlipData, setGeneratedSlipData] = useState(null);
  const [toast, setToast] = useState(null);

  // History State
  const [issueHistory, setIssueHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // BOM & Design Verification States
  const [designs, setDesigns] = useState([]);
  const [bomStatus, setBomStatus] = useState('idle'); // 'idle' | 'checking' | 'approved' | 'pending' | 'not_created'
  const [bomDesign, setBomDesign] = useState(null);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // Inventory Materials & Mapped Bone Items
  const [materials, setMaterials] = useState([]);
  const [boneMaterialName, setBoneMaterialName] = useState('Bone Chinese (Beige)');
  const [selectedBoneMaterialId, setSelectedBoneMaterialId] = useState('ST00346');

  const searchInputRef = useRef(null);

  useEffect(() => {
    const rawLot = searchLotInput || lotDetails?.lotNo || prefilledLotNo || '';
    const cleanLot = String(rawLot).trim();
    if (!cleanLot) {
      setActiveLotCutting(null);
      setLoadingActiveLotCutting(false);
      return;
    }

    const cleanLower = cleanLot.toLowerCase();
    const headerMatch = (cuttingHeaders || []).find(ch => 
      String(ch.Lot_Number || '').trim().toLowerCase() === cleanLower
    );
    const designMatch = (designs || []).find(d => 
      String(d.id || '').trim().toLowerCase() === cleanLower ||
      String(d.lotNumber || '').trim().toLowerCase() === cleanLower
    );

    const memoryTotal = Number(headerMatch?.Cutting_Qty) || Number(designMatch?.quantity) || Number(lotDetails?.quantity) || 0;
    const hasMemoryData = Boolean(headerMatch || designMatch || lotDetails);

    setActiveLotCutting({
      lotNumber: cleanLot,
      totalPieces: memoryTotal,
      style: headerMatch?.Style || designMatch?.category || lotDetails?.style || '',
      fabric: headerMatch?.Fabric || lotDetails?.fabric || '',
      brand: headerMatch?.Brand || designMatch?.brand || lotDetails?.brand || '',
      partyName: headerMatch?.Party_Name || lotDetails?.partyName || '',
      garmentType: headerMatch?.Garment_Type || lotDetails?.garmentType || '',
      dateOfIssue: headerMatch?.Date_of_Issue || headerMatch?.JobOrder_Date || '',
      shades: headerMatch?.Shades || lotDetails?.shade || '',
      sizes: headerMatch?.Sizes || lotDetails?.size || '',
      rows: matrixCacheRef.current[cleanLower]?.rows || [],
      hasDetails: hasMemoryData
    });

    if (memoryTotal > 0 && (!issuePcs || Number(issuePcs) === 0)) {
      setIssuePcs(memoryTotal);
    }
    

    if (matrixCacheRef.current[cleanLower]) {
      const cached = matrixCacheRef.current[cleanLower];
      const matrixRows = cached?.rows || [];
      const matrixTotal = matrixRows.reduce((sum, r) => sum + (Number(r.totalPcs) || 0), 0);
      const resolvedTotal = matrixTotal > 0 ? matrixTotal : (memoryTotal > 0 ? memoryTotal : (Number(cached?.cuttingQty) || Number(cached?.header?.Cutting_Qty) || 0));
      setActiveLotCutting(prev => ({
        ...prev,
        totalPieces: resolvedTotal,
        rows: matrixRows,
        hasDetails: true
      }));
      setLoadingActiveLotCutting(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setLoadingActiveLotCutting(true);
      try {
        const res = await fetch(`${getBackendUrl()}/api/cutting/${encodeURIComponent(cleanLot)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();

        if (Object.keys(matrixCacheRef.current).length >= CUTTING_CACHE_MAX_ENTRIES) {
          matrixCacheRef.current = {};
        }

        matrixCacheRef.current[cleanLower] = data;
        const matrixRows = data?.rows || [];
        const matrixTotal = matrixRows.reduce((sum, r) => sum + (Number(r.totalPcs) || 0), 0);
        const resolvedTotal = matrixTotal > 0 ? matrixTotal : (memoryTotal > 0 ? memoryTotal : (Number(data?.cuttingQty) || Number(data?.header?.Cutting_Qty) || 0));

        const styleVal = data?.style || data?.header?.Style || '';
        const fabricVal = data?.fabric || data?.header?.Fabric || '';
        const brandVal = data?.brand || data?.header?.Brand || '';
        const partyVal = data?.partyName || data?.header?.Party_Name || '';
        const shadesVal = data?.shades || data?.header?.Shades || '';
        const sizesVal = data?.sizes || data?.header?.Sizes || '';

        if (!isCancelled) {
          setActiveLotCutting(prev => ({
            ...prev,
            totalPieces: resolvedTotal,
            style: prev?.style || styleVal,
            fabric: prev?.fabric || fabricVal,
            brand: prev?.brand || brandVal,
            partyName: prev?.partyName || partyVal,
            shades: prev?.shades || shadesVal,
            sizes: prev?.sizes || sizesVal,
            rows: matrixRows,
            hasDetails: true
          }));

          if (resolvedTotal > 0) {
            setIssuePcs(resolvedTotal);
          }
          if (styleVal) {
            setWithoutLotStyle(styleVal);
          }
          setLotDetails(prev => ({
            ...(prev || {}),
            lotNo: cleanLot,
            quantity: resolvedTotal || prev?.quantity || 0,
            style: styleVal || prev?.style || '',
            fabric: fabricVal || prev?.fabric || '',
            brand: brandVal || prev?.brand || '',
            partyName: partyVal || prev?.partyName || '',
            shade: shadesVal || prev?.shade || '',
            size: sizesVal || prev?.size || ''
          }));
        }
      } catch (err) {
        if (!isCancelled) {
          setActiveLotCutting(prev => (prev ? { ...prev, hasDetails: prev.hasDetails || hasMemoryData } : null));
        }
      } finally {
        if (!isCancelled) setLoadingActiveLotCutting(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchLotInput, lotDetails, prefilledLotNo, cuttingHeaders, designs, cuttingCacheRefreshCount]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch materials to support mapping & inventory display
  const fetchMaterials = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/materials`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMaterials(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch materials in BoneIssueView:', e);
    }
  };

  // Filter materials to show Bone category
  const boneMaterials = useMemo(() => {
    return (materials || []).filter(m => 
      (m.category || '').toLowerCase().includes('bone') || 
      (m.name || '').toLowerCase().includes('bone')
    );
  }, [materials]);

  // Active Selected Material Object from Inventory
  const currentBoneMaterial = useMemo(() => {
    return (boneMaterials || []).find(m => String(m.id) === String(selectedBoneMaterialId)) || null;
  }, [boneMaterials, selectedBoneMaterialId]);

  // Handler for selecting a Bone item
  const handleSelectBoneMaterial = (id) => {
    setSelectedBoneMaterialId(id);
    const mat = boneMaterials.find(m => String(m.id) === String(id));
    if (mat) {
      setBoneMaterialName(mat.name);
    }
  };

  // Auto-link bone material on load if not yet selected
  useEffect(() => {
    if (boneMaterials.length > 0 && !selectedBoneMaterialId) {
      const firstBone = boneMaterials[0];
      if (firstBone) {
        setSelectedBoneMaterialId(firstBone.id);
        if (!boneMaterialName || boneMaterialName === 'Bone Pocketing' || boneMaterialName === 'Bone Chinese (Beige)') {
          setBoneMaterialName(firstBone.name);
        }
      }
    }
  }, [boneMaterials]);

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
      console.warn('Failed to fetch designs in BoneIssueView:', e);
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
    const prefix = mode === 'tape' ? 'tape-w/o-' : mode === 'elastic' ? 'elastic-w/o-' : 'bone-w/o-';
    let max = 0;
    (history || []).forEach(h => {
      const s = String(h.slipNo || '').toLowerCase();
      if (s.startsWith(prefix)) {
        const n = parseInt(s.replace(prefix, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return `${prefix}${max + 1}`;
  };

  // Fetch next Issue Slip Number from backend or local sequence
  const fetchNextIssueSlipNo = async (isWo = isWithoutLot) => {
    if (isWo) {
      const type = materialMode === 'tape' ? 'tape_wo' : materialMode === 'elastic' ? 'elastic_wo' : 'bone_wo';
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
      const fallback = getNextWithoutLotSeq(issueHistory, materialMode);
      setIssueSlipNo(fallback);
      return fallback;
    }

    try {
      const res = await fetch(`${getBackendUrl()}/api/po-number/next/bone_issue`);
      if (res.ok) {
        const data = await res.json();
        if (data.poNumber) {
          setIssueSlipNo(data.poNumber);
          return data.poNumber;
        }
      }
    } catch (_) {}
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const fallback = `BONE-ISSUE-${randomSuffix}`;
    setIssueSlipNo(fallback);
    return fallback;
  };

  // Initialize next slip number on mount
  useEffect(() => {
    fetchNextIssueSlipNo();
    loadIssueHistory();
    fetchDesigns();
    fetchMaterials();
  }, []);

  // Update slip number when isWithoutLot or materialMode changes
  useEffect(() => {
    fetchNextIssueSlipNo(isWithoutLot);
  }, [isWithoutLot, materialMode]);

  // Auto-search lot with debounce as user types
  useEffect(() => {
    const trimmed = (searchLotInput || '').trim();
    if (!trimmed || trimmed.length < 3) {
      return;
    }
    // Prevent redundant auto-searches if lot is already loaded
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
      const localSaved = localStorage.getItem('gpdms_bone_issue_history');
      let localList = [];
      if (localSaved) {
        try { localList = JSON.parse(localSaved); } catch (_) {}
      }

      // 1. Fetch from Dedicated bone_issue Table
      try {
        const res = await fetch(`${getBackendUrl()}/api/bone-issues`);
        if (res.ok) {
          const records = await res.json();
          if (Array.isArray(records) && records.length > 0) {
            setIssueHistory(records);
            localStorage.setItem('gpdms_bone_issue_history', JSON.stringify(records.slice(0, 100)));
            setLoadingHistory(false);
            return;
          }
        }
      } catch (_) {}

      // 2. Legacy fallback from issue_logs (for older records before table was created)
      try {
        const res = await fetch(`${getBackendUrl()}/api/issue-logs`);
        if (res.ok) {
          const logs = await res.json();
          const boneLogs = (Array.isArray(logs) ? logs : []).filter(l => 
            String(l.id || '').toUpperCase().includes('BONE') || 
            String(l.category || '').toUpperCase().includes('BONE')
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
          boneLogs.forEach(bl => {
            if (!combined.some(c => c.slipNo === bl.slipNo)) {
              combined.push(bl);
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
      localStorage.setItem('gpdms_bone_issue_history', JSON.stringify(updated.slice(0, 100)));

      // 1. Save directly into dedicated bone_issue MySQL table
      try {
        await fetch(`${getBackendUrl()}/api/bone-issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slipNo: record.slipNo,
            lotNo: record.lotNo,
            issuePcs: record.issuePcs || record.quantity || 0,
            boneWeightKg: record.boneWeightKg || '2.50',
            weight: record.boneWeightKg || '2.50',
            supervisorName: record.supervisorName || 'ROHIT / MONU',
            selectedBoneMaterialId: record.selectedBoneMaterialId || '',
            boneMaterialName: record.boneMaterialName || 'Bone Chinese (Beige)',
            issuerName: record.issuerName,
            receiverName: record.receiverName,
            issueDate: record.date,
            style: record.style,
            brand: record.brand,
            garmentType: record.garmentType,
            fabric: record.fabric,
            quantity: record.quantity || 0,
            shade: record.shade,
            size: record.size,
            remarks: record.remarks
          })
        });
      } catch (_) {}

      // 2. Also sync to global issue_logs for general traceability
      try {
        await fetch(`${getBackendUrl()}/api/issue-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: record.slipNo,
            lotId: record.lotNo,
            isReissue: false,
            isReturn: false,
            category: 'BONE / POCKETING',
            volume: record.issuePcs || 0,
            weightKg: record.boneWeightKg || '2.50',
            supervisorName: record.supervisorName || 'ROHIT / MONU',
            personName: record.issuerName,
            receiverName: record.receiverName,
            receiverDept: 'CUTTING',
            date: record.date,
            materials: [{
              name: record.boneMaterialName || 'Bone Chinese (Beige)',
              materialId: record.selectedBoneMaterialId || '',
              issueWeightKg: record.boneWeightKg || '2.50',
              issuePcs: record.issuePcs,
              cuttingQty: record.quantity,
              shade: record.shade
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
        const boneBomRow = (matched.bom || []).find(b => (b.name || '').toLowerCase().includes('bone'));
        if (boneBomRow && boneBomRow.materialId) {
          setSelectedBoneMaterialId(boneBomRow.materialId);
          const mappedBone = (materials || []).find(m => String(m.id) === String(boneBomRow.materialId));
          if (mappedBone) {
            setBoneMaterialName(mappedBone.name);
          }
        }
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

      // Extract primary shade if available
      let primaryShade = '';
      if (data.shade) {
        const raw = String(data.shade);
        const first = raw.split(',')[0].replace(/\[.*?\]/g, '').trim();
        primaryShade = first || raw;
      }
      setSelectedShade(primaryShade);

      const cuttingQty = parseInt(data.quantity || 0, 10);
      const effQty = cuttingQty > 0 ? cuttingQty : (issuePcs || '');
      setIssuePcs(effQty);
      if (data.style || data.garmentType) {
        setWithoutLotStyle(data.style || data.garmentType);
      }
      setRemarks(`Internal Bone pocketing issue for Lot ${data.lotNo || cleanLot} (${data.style || 'Garment'} - ${data.brand || ''}). Cutting Qty: ${effQty || 0} Pcs.`);

      setRecentLots(prev => {
        const updated = [lotToQuery, ...prev.filter(l => l !== lotToQuery)];
        return updated.slice(0, 6);
      });

      showToast(`Lot ${data.lotNo || lotToQuery} details loaded (${effQty || 0} Pcs).`);
    } catch (err) {
      console.warn('Lot search warning:', err);
      setLotError(err.message || 'Lot details not found in Google Sheets / Cutting Matrix.');
      if (!isWithoutLot) {
        setLotDetails(null);
        setIssuePcs('');
      }
    } finally {
      setSearchingLot(false);
    }
  };

  // ── Build Professional, High-Contrast Black & White Issue Voucher PDF ──────
  const createBoneIssuePDFDocument = async (data) => {
    const {
      slipNo,
      lotNo,
      issuePcs = 0,
      boneWeightKg = '2.50',
      boneMaterialName = 'Bone Chinese (Beige)',
      supervisorName = 'ROHIT / MONU',
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
      remarks = '',
      isWithoutLot = false,
      materialMode = 'bone',
      width = '1.5 Inch',
      tapeWidth = '0.5 Inch',
      elasticWidth = '1 Inch'
    } = data;

    // Create Portrait A4 Document
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = doc.internal.pageSize.getWidth(); // 595.28 pt
    const ph = doc.internal.pageSize.getHeight(); // 841.89 pt

    // ── Outer Document Frame Border ──────────────────────────────────────
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.2);
    doc.rect(26, 26, pw - 52, ph - 52);

    const im = 44; // Inner margin
    const iw = pw - im * 2; // 507.28 pt
    let y = 48;

    // ── 1. Header (Company Branding & Voucher Info) ──────────────────────
    // Left: Company Branding & Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(isWithoutLot ? 'MOHIT HOSIERY — W/O BOM ISSUE' : 'MOHIT HOSIERY', im, y + 14);

    const effectiveMaterialMode = String(slipNo || '').toLowerCase().startsWith('tape')
      ? 'tape'
      : String(slipNo || '').toLowerCase().startsWith('elastic')
        ? 'elastic'
        : String(slipNo || '').toLowerCase().startsWith('bone')
          ? 'bone'
          : (materialMode || 'bone');

    const modeLabel = effectiveMaterialMode === 'tape' ? 'TAPE' : effectiveMaterialMode === 'elastic' ? 'ELASTIC' : 'BONE POCKETING';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const voucherSubTitle = isWithoutLot
      ? `MATERIAL ISSUE SLIP (W/O BOM - ${modeLabel} ISSUE)`
      : `INTERNAL MATERIAL ISSUE VOUCHER — ${modeLabel}`;
    doc.text(voucherSubTitle, im, y + 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(isWithoutLot ? `Store Department • Direct Floor Stock Issue (W/O BOM - ${modeLabel})` : 'Store Department  •  Cutting Floor Material Movement', im, y + 39);

    // Right: Voucher No & Date (Clean aligned, no box)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(isWithoutLot ? `SLIP NO:  ${slipNo}` : `VOUCHER NO:  ${slipNo}`, pw - im, y + 14, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Date:  ${date}`, pw - im, y + 27, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(isWithoutLot ? `[ W/O BOM - ${modeLabel} ISSUE ]` : '[ BOM APPROVED ISSUE ]', pw - im, y + 39, { align: 'right' });

    y += 50;

    // Header Divider Line (Clean solid rule)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(im, y, pw - im, y);
    y += 18;

    // ── 2. Lot & Production Specifications (Clean & Balanced, No Boxes) ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(isWithoutLot ? `1. DIRECT FLOOR MOVEMENT SPECIFICATIONS (W/O BOM - ${modeLabel})` : '1. LOT & PRODUCTION SPECIFICATIONS', im, y);
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

    // Row specifications
    if (isWithoutLot) {
      drawSpec('Lot Number', `LOT #${lotNo || '—'}`, im, y);
      drawSpec('Issue Weight', `${boneWeightKg} Kg`, im + halfW, y);
      y += 18;

      drawSpec('Issue Mode', `WITHOUT BOM (${modeLabel} Floor Issue)`, im, y);
      drawSpec('Style / Item', style || 'Floor Issue', im + halfW, y);
      y += 18;

      drawSpec('Department', 'CUTTING FLOOR', im, y);
      drawSpec('Supervisor Name', supervisorName || 'ROHIT / MONU', im + halfW, y);
      y += 18;

      drawSpec('Issued By', issuerName || 'STORE INCHARGE', im, y);
      drawSpec('Received By', receiverName || 'CUTTING MASTER', im + halfW, y);
      y += 24;
    } else {
      // Row 1
      drawSpec('Lot Number', `LOT #${lotNo}`, im, y);
      drawSpec('Cutting Quantity', `${quantity || issuePcs} Pcs`, im + halfW, y);
      y += 18;

      // Row 2
      drawSpec('Style Name', style, im, y);
      drawSpec('Brand / Buyer', brand, im + halfW, y);
      y += 18;

      // Row 3
      drawSpec('Garment Type', garmentType, im, y);
      drawSpec('Supervisor Name', supervisorName || 'ROHIT / MONU', im + halfW, y);
      y += 18;

      // Row 4
      drawSpec('Lot Shade / Color', shade || 'Standard', im, y);
      drawSpec('Target Sizes', size || 'M, L, XL, 2XL', im + halfW, y);
      y += 18;

      // Row 5
      drawSpec('Department', 'CUTTING FLOOR', im, y);
      drawSpec('Issue Weight', `${boneWeightKg} Kg (${issuePcs} Pcs)`, im + halfW, y);
      y += 24;
    }

    // Clean horizontal divider rule
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.6);
    doc.line(im, y, pw - im, y);
    y += 18;

    // ── 3. Issued Material (Open Clean Table, No Nested Boxes) ────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('2. ISSUED MATERIAL SPECIFICATION', im, y);
    y += 12;

    // Table Header with subtle fill and clean top/bottom lines
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
    doc.text('ITEM / MATERIAL DESCRIPTION', im + 40, y + 15);
    if (!isWithoutLot) {
      doc.text('CUTTING PCS', im + 270, y + 15);
    }
    doc.text('ISSUE WEIGHT (KG)', pw - im - 14, y + 15, { align: 'right' });
    y += thH;

    // Data Row
    const trH = 26;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('1', im + 12, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const itemDesc = effectiveMaterialMode === 'tape'
      ? `Tape Roll (Drawcord Tape - ${tapeWidth || '0.5 Inch'})`
      : effectiveMaterialMode === 'elastic'
        ? `Elastic Waistband Roll (${elasticWidth || '1 Inch'})`
        : `${boneMaterialName || 'Bone Chinese (Beige)'} (${width || '1.5 Inch'})`;
    doc.text(itemDesc, im + 40, y + 17);

    if (!isWithoutLot) {
      doc.setFont('helvetica', 'normal');
      doc.text(`${quantity || issuePcs || 0} Pcs`, im + 270, y + 17);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${boneWeightKg || '2.50'} Kg`, pw - im - 14, y + 17, { align: 'right' });
    y += trH;

    // Row divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.6);
    doc.line(im, y, pw - im, y);

    // Total Row
    const totH = 24;
    doc.setFillColor(248, 248, 248);
    doc.rect(im, y, iw, totH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL BONE ISSUE WEIGHT (${modeLabel}):`, im + 12, y + 16);

    doc.setFontSize(10.5);
    doc.text(`${boneWeightKg || '2.50'} Kg`, pw - im - 14, y + 16, { align: 'right' });
    y += totH;

    // Accounting double line at bottom of total
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(im, y, pw - im, y);
    doc.line(im, y + 2.5, pw - im, y + 2.5);
    y += 24;

    // ── 4. Remarks (Clean open text, No bulky box) ────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('3. INTERNAL REMARKS & FLOOR INSTRUCTIONS', im, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 50);
    const remText = remarks || `Internal Bone pocketing issue for Lot ${lotNo} (${style}) - Issue Weight: ${boneWeightKg} Kg.`;
    const splitRemarks = doc.splitTextToSize(remText, iw);
    doc.text(splitRemarks, im, y);
    y += Math.max(26, splitRemarks.length * 13 + 12);

    // Clean horizontal divider rule before signatures
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.6);
    doc.line(im, y, pw - im, y);
    y += 20;

    // ── 5. Tri-Signatures (Issuer, Supervisor & Receiver) ─────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('4. VERIFICATION & FORMAL SIGNATURES', im, y);
    y += 16;

    const sigColW = (iw - 30) / 3;
    const xSig1 = im;
    const xSig2 = im + sigColW + 15;
    const xSig3 = im + (sigColW * 2) + 30;

    // Col 1: Issuer (Store Staff)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('ISSUED BY (STORE)', xSig1, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text('Name:', xSig1, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(issuerName || 'N/A', xSig1 + 34, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Date:', xSig1, y + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(date, xSig1 + 34, y + 30);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Sig: _______________', xSig1, y + 54);

    // Col 2: Supervisor (Floor Incharge)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('SUPERVISOR (FLOOR)', xSig2, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text('Name:', xSig2, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(supervisorName || 'ROHIT / MONU', xSig2 + 34, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Date:', xSig2, y + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(date, xSig2 + 34, y + 30);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Sig: _______________', xSig2, y + 54);

    // Col 3: Receiver (Cutting Master)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('RECEIVED BY (CUTTING)', xSig3, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text('Name:', xSig3, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(receiverName || 'N/A', xSig3 + 34, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Date:', xSig3, y + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(date, xSig3 + 34, y + 30);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Sig: _______________', xSig3, y + 54);

    // ── 6. Footer Notice ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Official Internal Material Issue Voucher  •  Mohit Hosiery Quality Management System', pw / 2, ph - 38, { align: 'center' });

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

  // ── Generate Professional Bone Issue Voucher ─────────────────────────────
  const generateBoneIssueBill = async () => {
    const enteredLotNo = (lotDetails?.lotNo || searchLotInput || '').trim();
    if (!enteredLotNo) {
      showToast('Please enter a Lot Number (Required in all modes).', 'error');
      return;
    }

    // MANDATORY WORKFLOW RULE: BOM MUST BE CREATED AND APPROVED
    if (!isWithoutLot && bomStatus !== 'approved') {
      if (bomStatus === 'not_created') {
        showToast('Workflow Blocked: BOM (Bill of Materials) is not created for this Lot! Create BOM in Design View first.', 'error');
      } else if (bomStatus === 'pending') {
        showToast('Workflow Blocked: BOM is Pending Approval! Approve in queue first.', 'error');
      } else if (bomStatus === 'rejected') {
        showToast('Workflow Blocked: BOM was rejected by Admin! Revise in Design View.', 'error');
      } else {
        showToast('Workflow Blocked: BOM must be created and Approved before issue.', 'error');
      }
      return;
    }

    if (!issuerName || !receiverName) {
      showToast('Please provide both Issuer and Receiver names.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const currentSlipNo = issueSlipNo || await fetchNextIssueSlipNo();
      const currentLotNo = enteredLotNo.toUpperCase();
      const effectivePcs = parseInt(issuePcs, 10) || 600;

      const payload = {
        slipNo: currentSlipNo,
        lotNo: currentLotNo,
        isWithoutLot,
        materialMode,
        issuePcs: effectivePcs,
        boneWeightKg: boneWeightKg || '2.50',
        boneRollCount: boneRollCount || '',
        boneRolls: boneRollCount ? `${boneRollCount} Roll(s) (${boneWeightKg || '2.50'} Kg)` : `${boneWeightKg || '2.50'} Kg`,
        rolls: boneRollCount ? Number(boneRollCount) : 1,
        weight: boneWeightKg || '2.50',
        supervisorName: supervisorName || 'ROHIT / MONU',
        selectedBoneMaterialId,
        boneMaterialName: boneMaterialName || 'Bone Chinese (Beige)',
        width: effectiveWidth,
        tapeWidth: effectiveTapeWidth,
        elasticWidth: effectiveElasticWidth,
        shade: selectedShade || lotDetails?.shade || 'Standard Shade',
        issuerName,
        receiverName,
        date: issueDate,
        style: isWithoutLot ? (withoutLotStyle || 'Floor Issue') : (lotDetails?.style || 'Garment Design'),
        brand: isWithoutLot ? 'Floor Issue' : (lotDetails?.brand || 'Mohit Hosiery'),
        garmentType: isWithoutLot ? (withoutLotStyle || 'Floor Issue') : (lotDetails?.garmentType || 'Trouser / Tracksuit'),
        fabric: lotDetails?.fabric || 'Cotton Poly Blend',
        quantity: isWithoutLot ? effectivePcs : (lotDetails?.quantity || effectivePcs),
        size: lotDetails?.size || 'M, L, XL, 2XL',
        remarks
      };

      const doc = await createBoneIssuePDFDocument(payload);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const generatedData = {
        ...payload,
        doc,
        pdfUrl,
        isSaved: false
      };

      setGeneratedSlipData(generatedData);
      showToast(`Voucher ${currentSlipNo} preview ready. Review and confirm to save.`);
    } catch (err) {
      console.error('Issue slip generation error:', err);
      showToast(err.message || 'Failed to generate Issue Bill.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmAndSaveBill = async () => {
    if (!generatedSlipData) return;
    setSavingSlip(true);
    try {
      await saveToHistory(generatedSlipData);
      await fetchNextIssueSlipNo();
      setGeneratedSlipData(prev => prev ? { ...prev, isSaved: true } : null);
      showToast(`Bone Issue Voucher ${generatedSlipData.slipNo} confirmed and saved successfully!`);
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save voucher details.', 'error');
    } finally {
      setSavingSlip(false);
    }
  };

  const handleDownloadPDF = () => {
    if (generatedSlipData?.doc) {
      generatedSlipData.doc.save(`${generatedSlipData.slipNo}_Bone_Issue_Voucher.pdf`);
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
      const effectivePcs = item.issuePcs || item.quantity || item.rolls || 600;
      const isItemWithoutLot = Boolean(
        item.isWithoutLot ||
        !item.lotNo ||
        item.lotNo === 'W/O-LOT' ||
        String(item.slipNo).toLowerCase().includes('-w/o-')
      );
      const itemMode = String(item.slipNo || '').toLowerCase().startsWith('tape')
        ? 'tape'
        : String(item.slipNo || '').toLowerCase().startsWith('elastic')
          ? 'elastic'
          : String(item.slipNo || '').toLowerCase().startsWith('bone')
            ? 'bone'
            : (item.materialMode || materialMode);

      const doc = await createBoneIssuePDFDocument({
        slipNo: item.slipNo,
        lotNo: (item.lotNo && item.lotNo !== 'W/O-LOT') ? item.lotNo : '—',
        issuePcs: effectivePcs,
        boneWeightKg: item.boneWeightKg || item.weight || '2.50',
        weight: item.boneWeightKg || item.weight || '2.50',
        supervisorName: item.supervisorName || 'ROHIT / MONU',
        boneMaterialName: item.boneMaterialName || 'Bone Chinese (Beige)',
        selectedBoneMaterialId: item.selectedBoneMaterialId || '',
        width: item.width || '1.5 Inch (Standard)',
        tapeWidth: item.tapeWidth || '0.5 Inch (Standard)',
        elasticWidth: item.elasticWidth || '1 Inch (Standard)',
        shade: item.shade || 'Standard',
        issuerName: item.issuerName || 'Store Staff',
        receiverName: item.receiverName || 'Cutting Master',
        date: item.date || new Date().toISOString().split('T')[0],
        style: item.style || 'Garment Design',
        brand: item.brand || 'Mohit Hosiery',
        garmentType: item.garmentType || 'Trouser / Tracksuit',
        fabric: item.fabric || 'Cotton Poly Blend',
        quantity: item.quantity || effectivePcs,
        size: item.size || 'M, L, XL, 2XL',
        remarks: item.remarks || '',
        isWithoutLot: isItemWithoutLot,
        materialMode: itemMode
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setGeneratedSlipData({
        doc,
        pdfUrl,
        slipNo: item.slipNo,
        lotNo: item.lotNo,
        issuePcs: effectivePcs,
        boneWeightKg: item.boneWeightKg || item.weight || '2.50',
        supervisorName: item.supervisorName || 'ROHIT / MONU',
        boneMaterialName: item.boneMaterialName || 'Bone Chinese (Beige)',
        width: item.width || '1.5 Inch (Standard)',
        shade: item.shade || 'Standard',
        issuerName: item.issuerName || 'Store Staff',
        receiverName: item.receiverName || 'Cutting Master',
        date: item.date || new Date().toISOString().split('T')[0],
        style: item.style || 'Garment Design',
        brand: item.brand || 'Mohit Hosiery',
        isSaved: true
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
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(2, 132, 199, 0.35)',
            flexShrink: 0
          }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Bone Issue (Internal Roll Issue)
              </h1>
              <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                Internal Floor Issue
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
              Search Lot Number, specify quantity of rolls, enter Issuer & Receiver names, and generate official Issue Voucher.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Issue Form vs History) */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-primary, #f0f7ff)', padding: '5px', borderRadius: '10px', border: '1px solid var(--border-color, #dbeafe)' }}>
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
              background: viewMode === 'generator' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: viewMode === 'generator' ? '#ffffff' : 'var(--text-muted, #64748b)',
              boxShadow: viewMode === 'generator' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={14} /> New Bone Issue
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
              background: viewMode === 'history' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: viewMode === 'history' ? '#ffffff' : 'var(--text-muted, #64748b)',
              boxShadow: viewMode === 'history' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
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
          {/* WORKFLOW MODE SELECTOR: WITH BOM VS WITHOUT BOM */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'var(--bg-card, #ffffff)',
            padding: '12px 18px',
            borderRadius: '14px',
            border: '1.5px solid var(--border-color, #dbeafe)',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Issue Workflow Mode:
              </span>
              <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-primary, #f0f7ff)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color, #cbd5e1)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsWithoutLot(false);
                    setLotDetails(null);
                    setSearchLotInput('');
                    setBomStatus('idle');
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    background: !isWithoutLot ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                    color: !isWithoutLot ? '#ffffff' : '#64748b',
                    boxShadow: !isWithoutLot ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ShieldCheck size={15} /> With BOM (BOM Approved)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsWithoutLot(true);
                    setBomStatus('idle');
                    if (!lotDetails) {
                      setLotDetails({
                        lotNo: searchLotInput.trim() || '',
                        style: withoutLotStyle || 'Lower / Tracksuit',
                        quantity: issuePcs || 0,
                        brand: 'Floor Issue',
                        garmentType: withoutLotStyle || 'Lower / Tracksuit',
                        fabric: 'Standard',
                        shade: 'Standard'
                      });
                    }
                    if (searchLotInput.trim() && (!lotDetails || !lotDetails.quantity)) {
                      handleSearchLot(searchLotInput.trim());
                    }
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    background: isWithoutLot ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'transparent',
                    color: isWithoutLot ? '#ffffff' : '#64748b',
                    boxShadow: isWithoutLot ? '0 2px 8px rgba(234, 88, 12, 0.35)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Zap size={15} /> Without BOM (Direct Floor Issue - No Restriction)
                </button>
              </div>
            </div>

            <span style={{ fontSize: '12px', fontWeight: '700', color: isWithoutLot ? '#c2410c' : '#0284c7' }}>
              {isWithoutLot
                ? '⚡ Without BOM: Direct floor issue unlocked. Lot No required, BOM verification bypassed!'
                : '🛡️ With BOM: Search and verify Lot against approved BOM.'}
            </span>
          </div>

          {/* STEP 1: CONDITIONAL DISPLAY FOR WITHOUT BOM VS WITH BOM */}
          {isWithoutLot ? (
            <div className="panel" style={{
              padding: '22px 24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              border: '1.5px solid #fdba74',
              boxShadow: 'var(--shadow-card)',
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
                    Direct Floor Movement Details (Without BOM)
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#9a3412', fontWeight: '700' }}>
                  Voucher No: <strong style={{ color: '#ea580c' }}>{issueSlipNo || 'Loading...'}</strong>
                  <span style={{ marginLeft: '6px', fontSize: '10.5px', fontWeight: '800', background: '#ffffff', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fed7aa' }}>WITHOUT BOM</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* Lot Number (Required) */}
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                    LOT NUMBER (REQUIRED) <span style={{ color: '#dc2626' }}>*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Lot # (e.g. 62114)"
                    value={searchLotInput}
                    onChange={(e) => setSearchLotInput(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1.5px solid #fdba74', background: '#ffffff',
                      fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
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
                    placeholder="e.g. Lower / Tracksuit..."
                    value={withoutLotStyle}
                    onChange={(e) => setWithoutLotStyle(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1.5px solid #fdba74', background: '#ffffff',
                      fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Target Issue Weight (Kg) */}
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                    TARGET ISSUE WEIGHT (KGS):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Enter Weight in Kg (e.g. 2.50)"
                      value={boneWeightKg}
                      onChange={(e) => setBoneWeightKg(e.target.value)}
                      style={{
                        flex: 1, padding: '9px 12px', borderRadius: '8px',
                        border: '1.5px solid #fdba74', background: '#ffffff',
                        fontSize: '14px', fontWeight: '800', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#c2410c', background: '#ffedd5', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fdba74' }}>
                      Kgs
                    </span>
                  </div>
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
                <span>Unrestricted Mode: No BOM required! Direct floor issue unlocked below.</span>
              </div>
            </div>
          ) : (
            /* STEP 1: SEARCH LOT NUMBER (BOM APPROVED) */
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
                      background: '#0284c7', color: '#ffffff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800'
                    }}>1</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                      Search Lot Number
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                    Voucher No: <strong style={{ color: '#0284c7' }}>{issueSlipNo || 'Loading...'}</strong>
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
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11.5px', fontWeight: '700', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: searchingLot ? 'wait' : 'pointer',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
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
                    background: 'rgba(22, 163, 74, 0.06)',
                    border: '1px solid rgba(22, 163, 74, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                          background: (lotDetails?.lotNo === d.id || searchLotInput === d.id) ? '#16a34a' : '#ffffff',
                          color: (lotDetails?.lotNo === d.id || searchLotInput === d.id) ? '#ffffff' : '#166534',
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

                {/* BOM STATUS BANNER (APPROVAL WORKFLOW) */}
                {lotDetails && (
                  <div style={{
                    marginTop: '16px',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: bomStatus === 'approved' ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : bomStatus === 'pending' ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    border: bomStatus === 'approved' ? '1.5px solid #86efac' : bomStatus === 'pending' ? '1.5px solid #fcd34d' : '1.5px solid #fca5a5',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: bomStatus === 'approved' ? '#16a34a' : bomStatus === 'pending' ? '#d97706' : '#dc2626',
                          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {bomStatus === 'approved' ? <CheckCircle size={18} /> : bomStatus === 'pending' ? <Clock size={18} /> : <AlertTriangle size={18} />}
                        </div>
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
                            {bomStatus === 'approved' && `BOM verified with ${(bomDesign?.bom || []).length} accessory items configured (${bomDesign?.style || lotDetails?.style || 'Garment Design'}). You are authorized to issue Bone pocketing.`}
                            {bomStatus === 'pending' && `A BOM design was submitted for Lot #${lotDetails?.lotNo || searchLotInput}, but it is awaiting Admin Approval in the Approval Queue. Bone materials can only be issued after approval.`}
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
                              Open Approval Queue
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
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LIVE CUTTING DETAILS ACCORDING TO ENTERED LOT NUMBER (ALWAYS VISIBLE IN ALL MODES) ── */}
            {Boolean((searchLotInput && searchLotInput.trim()) || lotDetails?.lotNo) && (
              <div style={{
                marginTop: '16px',
                marginBottom: '16px',
                padding: '14px 18px',
                borderRadius: '10px',
                background: activeLotCutting?.hasDetails 
                  ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' 
                  : '#f8fafc',
                border: activeLotCutting?.hasDetails ? '1.5px solid #86efac' : '1px dashed #cbd5e1',
                boxShadow: activeLotCutting?.hasDetails ? '0 2px 8px rgba(34, 197, 94, 0.08)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                {/* Header of Cutting Card */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '10px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: activeLotCutting?.hasDetails ? '#dcfce7' : '#f1f5f9',
                      color: activeLotCutting?.hasDetails ? '#15803d' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Scissors size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                          Cutting Details &amp; Batch Metrics
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          fontFamily: 'monospace',
                          background: '#0f172a',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          Lot #{searchLotInput?.trim() || lotDetails?.lotNo || '—'}
                        </span>
                        {activeLotCutting?.hasDetails ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <CheckCircle2 size={11} /> Verified Cutting Sheet
                          </span>
                        ) : loadingActiveLotCutting ? (
                          <span style={{ fontSize: '11px', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={11} className="animate-spin" /> Checking cutting database...
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '2px 7px',
                            borderRadius: '6px'
                          }}>
                            No cutting sheet in DB
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => reloadCuttingCache(true)}
                          disabled={isReloadingCuttingCache}
                          title="Empty in-memory cache & reload cutting database now (Auto-reloads every 30 minutes)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            color: '#0284c7',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: '6px',
                            cursor: isReloadingCuttingCache ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <RefreshCw size={10} className={isReloadingCuttingCache ? "animate-spin" : ""} />
                          {isReloadingCuttingCache ? 'Reloading...' : 'Reload (30m Auto)'}
                        </button>
                        {cacheReloadNotice && (
                          <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '700' }}>
                            {cacheReloadNotice}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Production batch particulars automatically synchronized with Lot #{searchLotInput?.trim() || lotDetails?.lotNo || '—'} • Auto-refreshes every 30m
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      background: '#ffffff',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #86efac',
                      boxShadow: '0 1px 3px rgba(34, 197, 94, 0.12)'
                    }}>
                      <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        TOTAL CUTTING QUANTITY
                      </span>
                      <strong style={{ fontSize: '17px', fontWeight: '900', color: '#15803d' }}>
                        {(activeLotCutting?.totalPieces || (Number(lotDetails?.quantity) || 0)).toLocaleString()} <span style={{ fontSize: '12px' }}>Pcs</span>
                      </strong>
                    </div>

                    {activeLotCutting?.rows && activeLotCutting.rows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowActiveCuttingMatrix(!showActiveCuttingMatrix)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          border: showActiveCuttingMatrix ? '1.5px solid #0284c7' : '1px solid #bae6fd',
                          background: showActiveCuttingMatrix ? '#0284c7' : '#f0f9ff',
                          color: showActiveCuttingMatrix ? '#ffffff' : '#0369a1',
                          cursor: 'pointer',
                          boxShadow: '0 1px 4px rgba(2, 132, 199, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Eye size={13} />
                        {showActiveCuttingMatrix ? 'Hide Matrix' : `Matrix Breakdown (${activeLotCutting.rows.length} Colors)`}
                      </button>
                    )}
                  </div>
                </div>

                {/* 6 Particulars Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px'
                }}>
                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>GARMENT STYLE</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.style || lotDetails?.style || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>FABRIC</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.fabric || lotDetails?.fabric || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>BRAND / BUYER</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.brand || lotDetails?.brand || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>PARTY NAME</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.partyName || lotDetails?.partyName || 'Mohit Hosiery'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>SHADES</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', marginTop: '2px', wordBreak: 'break-word', maxHeight: '42px', overflowY: 'auto' }}>
                      {activeLotCutting?.shades || (activeLotCutting?.rows?.map(r => `${r.color} [${r.totalPcs || 0}]`).join(', ')) || lotDetails?.shade || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>SIZES</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.sizes || (activeSizes.length > 0 ? activeSizes.join(', ') : (lotDetails?.size || '—'))}
                    </div>
                  </div>
                </div>

                {/* Expandable Color-Size Cutting Matrix */}
                {showActiveCuttingMatrix && activeLotCutting?.rows && activeLotCutting.rows.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1.5px solid #bae6fd',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0369a1' }}>
                        Full Color-Size Cutting Matrix ({activeLotCutting.rows.length} Colors)
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Source: MySQL `cutting` / Master Google Sheets
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <thead>
                          <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '800', color: '#0369a1' }}>Color / Shade</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Table</th>
                            {activeSizes.map(sz => (
                              <th key={sz} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>{sz}</th>
                            ))}
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>Total Pcs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLotCutting.rows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '6px 10px', fontWeight: '800', color: '#0f172a' }}>{row.color}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontSize: '10.5px' }}>{row.cuttingTable || '—'}</td>
                              {activeSizes.map(sz => (
                                <td key={sz} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: row.sizes?.[sz] ? '700' : '400', color: row.sizes?.[sz] ? '#0f172a' : '#cbd5e1' }}>
                                  {row.sizes?.[sz] ? Number(row.sizes[sz]).toLocaleString() : '—'}
                                </td>
                              ))}
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>
                                {(Number(row.totalPcs) || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: '900', color: '#0f172a' }}>
                            <td colSpan={2} style={{ padding: '7px 10px' }}>Grand Total</td>
                            {activeSizes.map(sz => {
                              const szSum = activeLotCutting.rows.reduce((sum, r) => sum + (Number(r.sizes?.[sz]) || 0), 0);
                              return (
                                <td key={sz} style={{ padding: '7px 8px', textAlign: 'center', fontWeight: '900', color: '#0f172a' }}>
                                  {szSum.toLocaleString()}
                                </td>
                              );
                            })}
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '900', color: '#15803d' }}>
                              {(activeLotCutting.totalPieces || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

        {/* STEP 2: ISSUE DETAILS (DATE, ISSUER, RECEIVER & SUPERVISOR) */}
          <div className="panel" style={{
              padding: '22px 24px',
              borderRadius: '16px',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #dbeafe)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: '#0284c7', color: '#ffffff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800'
                  }}>2</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                      Issue Details (Date, Issuer, Receiver & Supervisor)
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Fill date, issuer, receiver and review total requirement before generating original bill / PO
                    </p>
                  </div>
                </div>

                <span style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: '#0284c7',
                  background: '#f0f9ff',
                  border: '1.5px solid #bae6fd',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                  Bone Pocketing Issue
                </span>
              </div>

              {/* Bone Pocketing Width Specification Banner */}
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#f0f9ff',
                border: '1.5px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369a1' }}>
                    Bone Pocketing Width:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['1.5 Inch (Standard)', '1.0 Inch', '1.25 Inch', '2.0 Inch', 'Custom'].map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setBoneWidth(w)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: boneWidth === w ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                          background: boneWidth === w ? '#0284c7' : '#ffffff',
                          color: boneWidth === w ? '#ffffff' : '#334155',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  {boneWidth === 'Custom' && (
                    <input
                      type="text"
                      placeholder="e.g. 1.75 Inch"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1.5px solid #0284c7',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        width: '110px',
                        outline: 'none'
                      }}
                    />
                  )}
                </div>

                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>
                  Effective Width: <strong style={{ color: '#0f172a' }}>{effectiveWidth}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                
                {/* LEFT COLUMN: ISSUER, RECEIVER & SUPERVISOR (STAFF DETAILS) */}
                <div style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <User size={15} color="#0284c7" />
                    <span>Issue & Requisition Information:</span>
                  </div>

                  {/* ISSUER NAME */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <User size={14} color="#0284c7" />
                      <span>Issuer Name (Store Staff / Prepared By):</span>
                    </label>
                    <SmartSelectWithManual
                      value={issuerName}
                      onChange={setIssuerName}
                      options={['paras', 'PARAS', 'RASHMI', 'STORE INCHARGE', 'ADMIN', 'STORE DISPATCH']}
                      placeholder="Select Issuer or + Manual Entry"
                      manualPlaceholder="Type custom store staff name..."
                      manualLabel="+ Manual Entry (Store Staff)"
                      localStorageKey="bone_issuer_names"
                      icon="user"
                      theme="blue"
                    />
                  </div>

                  {/* RECEIVER NAME */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Scissors size={14} color="#0284c7" />
                      <span>Receiver Name (Cutting Master / Received By):</span>
                    </label>
                    <SmartSelectWithManual
                      value={receiverName}
                      onChange={setReceiverName}
                      options={['JAYBIR', 'ROHIT', 'MONU', 'CUTTING MASTER', 'SEWING INCHARGE']}
                      placeholder="Select Receiver or + Manual Entry"
                      manualPlaceholder="Type custom receiver name..."
                      manualLabel="+ Manual Entry (Cutting Master)"
                      localStorageKey="bone_receiver_names"
                      icon="scissors"
                      theme="blue"
                    />
                  </div>

                  {/* SUPERVISOR / FLOOR INCHARGE NAME */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <ShieldCheck size={14} color="#0284c7" />
                      <span>Supervisor / Floor Incharge Name:</span>
                    </label>
                    <SmartSelectWithManual
                      value={supervisorName}
                      onChange={setSupervisorName}
                      options={['ROHIT / MONU', 'MOHIT SIR', 'MANISH', 'FLOOR SUPERVISOR', 'STORE INCHARGE']}
                      placeholder="Select Supervisor or + Manual Entry"
                      manualPlaceholder="Type custom supervisor name..."
                      manualLabel="+ Manual Entry (Supervisor)"
                      localStorageKey="bone_supervisor_names"
                      icon="shield"
                      theme="blue"
                    />
                  </div>

                  {/* BONE SPECIFICATION & MATERIAL MAPPING CARD */}
                  {materialMode === 'bone' && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#f0f9ff',
                      border: '1.5px solid #bae6fd',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Scale size={14} color="#0284c7" />
                          <span>Bone Specification & Material Mapping:</span>
                        </span>
                        <span style={{
                          fontSize: '10.5px',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '800'
                        }}>
                          {effectiveWidth}
                        </span>
                      </div>

                      {/* Mapped Bone Inventory Item Dropdown */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#0369a1', margin: 0 }}>
                            MATERIAL NAME MAPPING (BONE CATEGORY):
                          </label>
                          <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: '700' }}>
                            {boneMaterials.length} Items Available
                          </span>
                        </div>
                        <select
                          value={selectedBoneMaterialId}
                          onChange={(e) => handleSelectBoneMaterial(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: '1px solid #bae6fd',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#0f172a',
                            background: '#ffffff',
                            outline: 'none'
                          }}
                        >
                          <option value="">— Select Bone Inventory Item —</option>
                          {boneMaterials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.id}) • Stock: {m.stock} Kg
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

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
                        placeholder="e.g. Elastic for waistband..."
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: '8px',
                          border: '1px solid #cbd5e1', background: '#ffffff',
                          fontSize: '12px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: TOTAL REQUIREMENT ON ORIGINAL BILL */}
                <div style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1.5px solid #0284c7',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={16} color="#0284c7" />
                        <span>Total Requirement on Original Bill:</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px' }}>
                        ORIGINAL BILL SPEC
                      </span>
                    </div>

                    {/* ISSUE MODE & LOT */}
                    {!isWithoutLot ? (
                      <div style={{
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #bfdbfe',
                        marginBottom: '12px',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#1d4ed8', display: 'block', fontWeight: '800', textTransform: 'uppercase' }}>
                            ISSUE MODE & LOT
                          </span>
                          <strong style={{ color: '#1e40af', fontSize: '13.5px' }}>
                            With BOM — LOT #{lotDetails?.lotNo || searchLotInput || '—'} ({lotDetails?.style || lotDetails?.garmentType || withoutLotStyle || 'Lower / Tracksuit'})
                          </strong>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          background: '#2563eb',
                          color: '#ffffff',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          🛡️ BOM APPROVED ({lotDetails?.quantity || issuePcs || 0} Pcs)
                        </span>
                      </div>
                    ) : (
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
                            ISSUE MODE & LOT
                          </span>
                          <strong style={{ color: '#9a3412', fontSize: '13.5px' }}>
                            Without BOM — LOT #{searchLotInput || lotDetails?.lotNo || '—'} ({withoutLotStyle || 'Lower / Tracksuit'})
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
                    )}

                    {/* Editable Issue Box: Direct Issue Weight in Kgs */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#f0f9ff',
                      border: '1.5px solid #0284c7',
                      marginBottom: '14px',
                      boxShadow: '0 2px 10px rgba(2, 132, 199, 0.08)'
                    }}>
                      <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Scale size={16} color="#0284c7" />
                          <span>Direct Issue Weight (Editable):</span>
                        </span>
                        <span style={{ fontSize: '10.5px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                          Kg-Wise Floor Issue
                        </span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', alignItems: 'flex-start' }}>
                        {/* 1. Bone Issue Weight */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', display: 'block', marginBottom: '4px' }}>
                            Issue Weight (Kg):
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={boneWeightKg}
                              onChange={(e) => setBoneWeightKg(e.target.value)}
                              placeholder="e.g. 2.50"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '2px solid #0284c7',
                                background: '#ffffff',
                                fontSize: '15px',
                                fontWeight: '900',
                                color: '#0f172a',
                                outline: 'none'
                              }}
                            />
                            <span style={{
                              fontSize: '13px',
                              fontWeight: '900',
                              color: '#0369a1',
                              background: '#e0f2fe',
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: '1.5px solid #bae6fd',
                              whiteSpace: 'nowrap'
                            }}>
                              Kg
                            </span>
                          </div>
                        </div>

                        {/* 2. Roll Quantity (Optional) */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1' }}>
                              Roll Quantity:
                            </span>
                            <span style={{
                              fontSize: '9.5px',
                              color: '#0284c7',
                              background: '#e0f2fe',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: '700'
                            }}>
                              Optional
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={boneRollCount}
                              onChange={(e) => setBoneRollCount(e.target.value)}
                              placeholder="e.g. 1, 2 (Optional)"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1.5px solid #0284c7',
                                background: '#ffffff',
                                fontSize: '15px',
                                fontWeight: '800',
                                color: '#0f172a',
                                outline: 'none'
                              }}
                            />
                            <span style={{
                              fontSize: '13px',
                              fontWeight: '900',
                              color: '#0369a1',
                              background: '#e0f2fe',
                              padding: '7px 10px',
                              borderRadius: '8px',
                              border: '1.5px solid #bae6fd',
                              whiteSpace: 'nowrap'
                            }}>
                              Roll(s)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Weights & Quick Rolls */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Quick Weights:</span>
                        {['0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '5.0', '10.0'].map(w => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setBoneWeightKg(w)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: String(boneWeightKg) === String(w) ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                              background: String(boneWeightKg) === String(w) ? '#0284c7' : '#ffffff',
                              color: String(boneWeightKg) === String(w) ? '#ffffff' : '#0369a1',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease'
                            }}
                          >
                            {w} Kg
                          </button>
                        ))}

                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginLeft: '6px' }}>Rolls (Opt):</span>
                        {['1', '2', '3', '4', '5'].map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setBoneRollCount(r)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: String(boneRollCount) === r ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                              background: String(boneRollCount) === r ? '#0284c7' : '#ffffff',
                              color: String(boneRollCount) === r ? '#ffffff' : '#0369a1',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease'
                            }}
                          >
                            {r} Roll{r > 1 ? 's' : ''}
                          </button>
                        ))}
                        {boneRollCount && (
                          <button
                            type="button"
                            onClick={() => setBoneRollCount('')}
                            style={{
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                            title="Clear Roll Count"
                          >
                            ✕ Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bone Requirement Highlight Card */}
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: '#f0f9ff',
                      border: '2px solid #0284c7',
                      marginBottom: '14px',
                      boxShadow: '0 3px 12px rgba(2, 132, 199, 0.08)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                            <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              • {(boneMaterialName || 'BONE CHINESE (BEIGE)').toUpperCase()} REQUIREMENT
                            </span>
                            {(currentBoneMaterial?.id || selectedBoneMaterialId || 'ST00346') && (
                              <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>
                                ID: {currentBoneMaterial?.id || selectedBoneMaterialId || 'ST00346'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '700', marginTop: '3px' }}>
                            {!isWithoutLot ? 'With BOM Approved Floor Issue (Kg-Wise)' : 'Direct Floor Issue (Kg-Wise)'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                            ISSUE UNIT
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                            Kilograms (Kg)
                          </span>
                        </div>
                      </div>

                      {/* HERO CALLOUT: TOTAL BONE ISSUE */}
                      <div style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px', fontWeight: '900'
                          }}>
                            📦
                          </div>
                          <div>
                            <div style={{ fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.95 }}>
                              TOTAL BONE ISSUE
                            </div>
                            <div style={{ fontSize: '11.5px', fontWeight: '600', opacity: 0.95 }}>
                              {!isWithoutLot ? 'Approved BOM Floor Weight Issue (Kg-Wise)' : 'Direct Floor Weight Issue (Kg-Wise)'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1', letterSpacing: '-0.5px' }}>
                            {boneWeightKg || '0'} <span style={{ fontSize: '18px', fontWeight: '800' }}>Kg</span>
                          </div>
                          {boneRollCount ? (
                            <div style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                              {boneRollCount} Roll{Number(boneRollCount) > 1 ? 's' : ''}
                            </div>
                          ) : null}
                          <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: '700', marginTop: '3px' }}>
                            {currentBoneMaterial ? `Store stock: ${currentBoneMaterial.stock || '15'}` : 'Store stock: 15'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Verified Status Note */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#059669',
                      padding: '8px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      marginTop: '6px'
                    }}>
                      <span>✓ All details verified & ready to print formal original bill / PO</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* ACTION: GENERATE BILL BUTTON */}
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {isWithoutLot ? (
                    <span style={{ color: '#475569', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} color="#64748b" /> Direct Floor Issue &bull; LOT #{searchLotInput || lotDetails?.lotNo || '—'} &bull; Total: <strong style={{ color: '#ea580c' }}>{boneWeightKg} Kg{boneRollCount ? ` (${boneRollCount} Roll${Number(boneRollCount) > 1 ? 's' : ''})` : ''}</strong> to <strong>{receiverName || 'Cutting Master'}</strong> (Supervisor: {supervisorName || 'ROHIT / MONU'})
                    </span>
                  ) : bomStatus === 'approved' ? (
                    <span style={{ color: '#16a34a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} /> With BOM Mode &bull; LOT #{lotDetails?.lotNo || searchLotInput || '—'} &bull; Total: <strong style={{ color: '#0284c7' }}>{boneWeightKg} Kg{boneRollCount ? ` (${boneRollCount} Roll${Number(boneRollCount) > 1 ? 's' : ''})` : ''} ({lotDetails?.quantity || issuePcs || 0} Pcs)</strong> to <strong>{receiverName || 'Cutting Master'}</strong> (BOM Approved ✓)
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={15} /> Original Issue Bill / PO generation locked until Lot BOM is approved
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={generateBoneIssueBill}
                  disabled={generating || (!isWithoutLot && bomStatus !== 'approved')}
                  title={(!isWithoutLot && bomStatus !== 'approved') ? 'BOM must be created and approved by Admin before generating issue bill' : 'Generate official Original Material Issue Bill / PO'}
                  style={{
                    padding: '12px 32px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (isWithoutLot || bomStatus === 'approved')
                      ? (isWithoutLot ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)')
                      : '#94a3b8',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '800',
                    cursor: (generating || (!isWithoutLot && bomStatus !== 'approved')) ? 'not-allowed' : 'pointer',
                    boxShadow: (isWithoutLot || bomStatus === 'approved') ? '0 6px 18px rgba(2, 132, 199, 0.4)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  {generating ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Printer size={18} />
                  )}
                  <span>
                    {generating
                      ? 'Generating Issue Slip...'
                      : 'Generate Material Issue Bill'}
                  </span>
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
                Bone Issue Slips History
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Records of internal bone rolls issued to cutting and tailoring departments
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
              <div style={{ fontSize: '14px', fontWeight: '700' }}>No Bone Issue Slips generated yet.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Issue your first roll using the "New Bone Issue" tab above.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11.5px', fontWeight: '800' }}>
                    <th style={{ padding: '10px 12px' }}>SLIP NO</th>
                    <th style={{ padding: '10px 12px' }}>DATE</th>
                    <th style={{ padding: '10px 12px' }}>LOT NO</th>
                    <th style={{ padding: '10px 12px' }}>WEIGHT (KG)</th>
                    <th style={{ padding: '10px 12px' }}>ISSUE PCS</th>
                    <th style={{ padding: '10px 12px' }}>ISSUED BY</th>
                    <th style={{ padding: '10px 12px' }}>SUPERVISOR</th>
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
                        String(h.issuerName || '').toLowerCase().includes(q) ||
                        String(h.supervisorName || '').toLowerCase().includes(q);
                    })
                    .map((item, idx) => (
                      <tr key={item.slipNo || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            background: String(item.slipNo || '').toLowerCase().includes('-w/o-') ? '#fff7ed' : '#f0f9ff',
                            color: String(item.slipNo || '').toLowerCase().includes('-w/o-') ? '#c2410c' : '#0284c7',
                            border: `1px solid ${String(item.slipNo || '').toLowerCase().includes('-w/o-') ? '#fed7aa' : '#bae6fd'}`,
                            borderRadius: '5px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: '800'
                          }}>
                            {item.slipNo}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {Boolean(item.isWithoutLot || String(item.slipNo || '').toLowerCase().includes('-w/o-')) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                                {item.lotNo && item.lotNo !== 'W/O-LOT' && item.lotNo !== 'W/O-PO-FLOOR' ? `LOT #${item.lotNo}` : 'LOT #—'}
                              </span>
                              <span style={{
                                padding: '2px 6px',
                                background: '#fff7ed',
                                color: '#c2410c',
                                border: '1px solid #fed7aa',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '800'
                              }}>
                                W/O BOM
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>
                              LOT #{item.lotNo || '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0284c7' }}>
                          {item.boneWeightKg || item.weight || '2.50'} Kg
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>
                          {item.issuePcs || item.quantity || item.rolls || 600} Pcs
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.issuerName || 'ADMIN'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.supervisorName || 'ROHIT / MONU'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '700' }}>
                          {item.receiverName || 'JAYBIR'}
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
                              color: '#0284c7',
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
            maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            animation: 'scaleIn 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: generatedSlipData.isSaved
                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
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
                  background: generatedSlipData.isSaved ? 'rgba(255,255,255,0.2)' : 'rgba(2, 132, 199, 0.25)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    {generatedSlipData.isSaved ? 'Bone Issue Voucher Saved & Ready!' : 'Review & Confirm Voucher Details'}
                  </h3>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Voucher No: <strong>{generatedSlipData.slipNo}</strong> {!generatedSlipData.isSaved && '• (Pending Save Confirmation)'}
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
              {/* Notice banner */}
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
                  <span>Please verify all details below. Click <strong>"Confirm & Save Voucher"</strong> to record in system.</span>
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
                  <span>✓ Successfully saved to database & history! You can now print or download the voucher.</span>
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
                      {generatedSlipData.isWithoutLot ? 'LOT NUMBER & MODE' : 'LOT NUMBER'}
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      LOT #{generatedSlipData.lotNo || '—'}
                      {generatedSlipData.isWithoutLot && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#ea580c', background: '#fff7ed', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                          ⚡ WITHOUT BOM
                        </span>
                      )}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUE WEIGHT (KG)</span>
                    <strong style={{ color: '#0284c7', fontSize: '16px' }}>{generatedSlipData.boneWeightKg || '2.50'} Kg</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUE QUANTITY (PCS)</span>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>{generatedSlipData.issuePcs} Pcs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>SUPERVISOR (FLOOR)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.supervisorName || 'ROHIT / MONU'}</strong>
                  </div>
                  {!generatedSlipData.isWithoutLot && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>CUTTING MATRIX PCS</span>
                      <strong style={{ color: '#0f172a' }}>{generatedSlipData.quantity || 600} Pcs</strong>
                    </div>
                  )}
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
                  {generatedSlipData.remarks && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>REMARKS</span>
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
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: '800',
                        cursor: savingSlip ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                        opacity: savingSlip ? 0.8 : 1
                      }}
                    >
                      {savingSlip ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Saving Voucher...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={17} />
                          <span>Confirm & Save Voucher</span>
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
                      <span>Print Voucher (B&W)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      style={{
                        flex: 1,
                        padding: '13px',
                        borderRadius: '10px',
                        border: '1.5px solid #0284c7',
                        background: '#ffffff',
                        color: '#0284c7',
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
                      <span>Download PDF</span>
                    </button>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setGeneratedSlipData(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0284c7',
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
