import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl, computeEffectiveFactor, getMultiplierFormulaText } from '../utils/designHelpers';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Layers,
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  AlertTriangle,
  Search,
  Scan,
  FileText,
  Calendar,
  User,
  Building,
  MapPin,
  Package,
  Sparkles,
  Download,
  X,
  RefreshCw,
  ArrowRight,
  Clock,
  Tag,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Copy,
  Scissors,
  CheckCircle2,
  ChevronDown,
  Settings,
  Filter,
  Camera,
  Upload,
  Calculator,
  Shirt,
  Target,
  Boxes,
  RotateCcw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to get official Item Code (guarantees Item Code ST... is used, never MT or ITM- placeholder)
export const getItemCodeDisplay = (m, materialsList = []) => {
  if (!m) return '';

  let code = '';
  const list = (Array.isArray(materialsList) && materialsList.length > 0)
    ? materialsList
    : (typeof window !== 'undefined' && window.__gpdms_materials ? window.__gpdms_materials : []);

  if (typeof m === 'string') {
    const raw = m.trim();
    if (!raw || raw.toUpperCase().startsWith('ITM-')) return '';
    const match = list.find(x =>
      String(x.id).toLowerCase() === raw.toLowerCase() ||
      String(x.itemCode || '').toLowerCase() === raw.toLowerCase() ||
      String(x.stCode || '').toLowerCase() === raw.toLowerCase() ||
      String(x.name || '').trim().toLowerCase() === raw.toLowerCase()
    );
    if (match && (match.itemCode || match.stCode)) {
      code = String(match.itemCode || match.stCode).trim();
    } else {
      code = raw;
    }
  } else if (typeof m === 'object') {
    code = String(m.itemCode || m.stCode || m.item_code || m.materialCode || '').trim();
    if (code.toUpperCase().startsWith('ITM-')) code = '';

    // If not found directly, check if m.id or m.materialId is an ST/MT code
    const matId = String(m.materialId || m.id || '').trim();
    if (!code && matId && !matId.toUpperCase().startsWith('ITM-')) {
      if (matId.toUpperCase().startsWith('ST') || matId.toUpperCase().startsWith('MT')) {
        code = matId;
      }
    }

    // Look up in materials list by ID or by Name
    if (!code && list.length > 0) {
      const targetId = String(m.materialId || m.id || '').trim().toLowerCase();
      const targetName = String(m.name || m.materialName || '').trim().toLowerCase();
      const match = list.find(x =>
        (targetId && (String(x.id).toLowerCase() === targetId || String(x.itemCode || '').toLowerCase() === targetId || String(x.stCode || '').toLowerCase() === targetId)) ||
        (targetName && String(x.name || '').trim().toLowerCase() === targetName)
      );
      if (match && (match.itemCode || match.stCode || match.id)) {
        code = String(match.itemCode || match.stCode || match.id).trim();
      }
    }
  }

  if (!code || code.toUpperCase().startsWith('ITM-')) return '';

  // Clean out any MT prefix: MT1222 -> ST1222, MT0014 -> ST0014
  if (code.toUpperCase().startsWith('MT')) {
    code = 'ST' + code.substring(2);
  } else if (/^M\d+/i.test(code)) {
    code = 'ST' + code.replace(/^\D+/g, '').padStart(5, '0');
  } else if (/^\d+$/.test(code) && code.length <= 5) {
    code = 'ST' + code.padStart(5, '0');
  }

  return code;
};

// Helper to look up material store stock from materials inventory
export const getMaterialStoreStock = (m, allMaterials = []) => {
  if (!m) return 0;
  // 1. Direct availableStock or stock on m
  if (m.availableStock !== undefined && m.availableStock !== null && Number(m.availableStock) > 0) {
    return Number(m.availableStock);
  }
  if (m.stock !== undefined && m.stock !== null && Number(m.stock) > 0) {
    return Number(m.stock);
  }

  const matsList = Array.isArray(allMaterials) ? allMaterials : [];
  if (matsList.length > 0) {
    // 2. Look up by ID
    const targetId = m.materialId || m.id;
    if (targetId) {
      const found = matsList.find(x => String(x.id).trim().toLowerCase() === String(targetId).trim().toLowerCase());
      if (found && found.stock !== undefined && found.stock !== null) {
        return Number(found.stock) || 0;
      }
    }

    // 3. Look up by itemCode
    const targetCode = String(m.itemCode || m.stCode || '').trim().toLowerCase();
    if (targetCode) {
      const found = matsList.find(x => {
        const c = String(x.itemCode || x.stCode || '').trim().toLowerCase();
        return c && c === targetCode;
      });
      if (found && found.stock !== undefined && found.stock !== null) {
        return Number(found.stock) || 0;
      }
    }

    // 4. Look up by name
    const targetName = String(m.name || m.bomItemName || '').trim().toLowerCase();
    if (targetName) {
      const found = matsList.find(x => String(x.name || '').trim().toLowerCase() === targetName);
      if (found && found.stock !== undefined && found.stock !== null) {
        return Number(found.stock) || 0;
      }
    }
  }

  return Number(m.stock || m.availableStock || 0);
};

// Helper to normalize and unify unit casing and variations across inventory & slips
export const normalizeUnitName = (u) => {
  if (!u) return 'Pcs';
  const clean = String(u).trim();
  const upper = clean.toUpperCase();
  if (upper === 'PCS' || upper === 'PC' || upper === 'PIECE' || upper === 'PIECES') return 'Pcs';
  if (upper === 'BOX' || upper === 'BOXES') return 'Box';
  if (upper === 'PKT' || upper === 'PACKET' || upper === 'PACKETS') return 'Pkt';
  if (upper === 'ROLL' || upper === 'ROLLS') return 'Roll';
  if (upper === 'LTR' || upper === 'LITER' || upper === 'LITRE' || upper === 'LITRES') return 'Ltr';
  if (upper === 'MTR' || upper === 'METER' || upper === 'METERS' || upper === 'MTRS') return 'Mtr';
  if (upper === 'BUNDLE' || upper === 'BUNDLES') return 'Bundle';
  if (upper === 'BOTTEL' || upper === 'BOTTLE' || upper === 'BOTTLES') return 'Bottle';
  if (upper === 'KG' || upper === 'KGS' || upper === 'KILOGRAM') return 'Kg';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

// Helper to calculate Total Pieces (Cutting Total Pieces according to lot wise), Issued Qty/Units, and Variance (Cutting - Issue)
export const getChallanPiecesMetrics = (log, allMaterials = [], cuttingMap = {}, designs = []) => {
  if (!log) {
    return {
      totalPieces: 0,
      issuePcs: 0,
      variance: 0,
      hasVariance: false,
      varianceText: '—',
      varianceBadge: '',
      primaryUnit: 'Pcs',
      isPieceBased: true,
      formattedIssueQty: '0 Pcs',
      unitTotals: {},
      totalStoreStock: 0,
      stockBreakdown: [],
      cuttingVolume: 0,
      isDirect: true
    };
  }

  const mats = log.materials || [];
  const rawLot = String(log.lotId || '').trim();
  const cleanLot = rawLot.toLowerCase();

  // Comprehensive check for Without Lot / Direct Requisitions
  const isDirect = !cleanLot ||
    cleanLot === 'direct-item' ||
    cleanLot === 'w/o lot' ||
    cleanLot === 'without lot' ||
    cleanLot === 'no lot' ||
    cleanLot === 'none' ||
    cleanLot === 'n/a' ||
    cleanLot.includes('direct') ||
    cleanLot.includes('w/o') ||
    cleanLot.includes('without') ||
    cleanLot.includes('no lot');

  // 1. Resolve Cutting Total Pieces for this lot from cuttingMap (cutting_header database)
  let cuttingVolume = 0;
  if (!isDirect && cleanLot) {
    if (cuttingMap && cuttingMap[cleanLot] !== undefined && cuttingMap[cleanLot] !== null) {
      cuttingVolume = Number(cuttingMap[cleanLot]) || 0;
    }
  }

  // 2. Fallback to designs prop (if design has garment quantity)
  if (!cuttingVolume && !isDirect && cleanLot && Array.isArray(designs)) {
    const dMatch = designs.find(d =>
      String(d.id || '').trim().toLowerCase() === cleanLot ||
      String(d.lotNumber || '').trim().toLowerCase() === cleanLot
    );
    if (dMatch && Number(dMatch.quantity) > 0) {
      cuttingVolume = Number(dMatch.quantity);
    }
  }

  // 3. Fallback to log.volume / log.pieces if recorded (ONLY for genuine cutting lots, never for W/O LOT)
  if (!cuttingVolume && !isDirect) {
    const rawVol = Number(log.volume !== undefined && log.volume !== null ? log.volume : (log.pieces || 0));
    if (rawVol > 1) {
      cuttingVolume = rawVol;
    }
  }

  // Calculate unit breakdown and detect piece-based vs non-piece materials
  const unitTotals = {};
  let totalRawQty = 0;
  let hasPieces = false;
  let hasNonPieces = false;

  mats.forEach(m => {
    const q = Number(m.qty) || 0;
    totalRawQty += q;
    const rawUnit = String(m.unit || 'Pcs').trim();
    const uUpper = rawUnit.toUpperCase();
    const isPc = uUpper === 'PCS' || uUpper === 'PC' || uUpper === 'PIECE' || uUpper === 'PIECES';
    if (isPc) {
      hasPieces = true;
    } else {
      hasNonPieces = true;
    }
    const normUnit = isPc ? 'Pcs' : normalizeUnitName(rawUnit);
    unitTotals[normUnit] = (unitTotals[normUnit] || 0) + q;
  });

  const unitsList = Object.keys(unitTotals);
  const primaryUnit = unitsList.length === 1 ? unitsList[0] : (hasNonPieces ? (hasPieces ? 'Mixed' : unitsList[0] || 'Units') : 'Pcs');
  const isPieceBased = hasPieces && !hasNonPieces;

  let formattedIssueQty = '0 Pcs';
  if (unitsList.length === 0) {
    formattedIssueQty = '0 Pcs';
  } else if (unitsList.length === 1) {
    formattedIssueQty = `${unitTotals[unitsList[0]].toLocaleString('en-IN')} ${unitsList[0]}`;
  } else {
    formattedIssueQty = unitsList.map(u => `${unitTotals[u].toLocaleString('en-IN')} ${u}`).join(' + ');
  }

  // Stock breakdown for materials inventory reference
  const stockBreakdown = mats.map(m => {
    const matName = m.name || m.bomItemName || 'Material';
    const unit = m.unit || 'Pcs';
    const qty = Number(m.qty) || 0;
    const storeStock = getMaterialStoreStock(m, allMaterials);
    const itemCode = getItemCodeDisplay(m) || m.itemCode || '';
    const location = m.location || '';
    return {
      name: matName,
      unit,
      qty,
      storeStock,
      itemCode,
      location,
      variance: storeStock - qty
    };
  });
  const totalStoreStock = stockBreakdown.reduce((sum, item) => sum + (item.storeStock || 0), 0);

  // Total Pieces shows ONLY cutting total pieces according to lot wise (0 for Direct / Without Lot)
  const totalPieces = isDirect ? 0 : cuttingVolume;

  // Variance calculation with Multiplier / Per Pc consumption factor:
  let variance = 0;
  let hasVariance = false;
  let varianceText = '—';
  let varianceBadge = '';
  let totalTargetRequired = 0;
  let effectiveMult = 1;
  let multDisplay = '1 / Pc';

  if (isDirect) {
    hasVariance = false;
    varianceText = '—';
    varianceBadge = 'Direct Issue';
  } else if (totalPieces > 0) {
    if (isPieceBased) {
      totalTargetRequired = mats.reduce((sum, m) => {
        const mult = getMaterialMultiplier(m, log, totalPieces);
        return sum + Math.round(totalPieces * mult);
      }, 0);
      effectiveMult = totalPieces > 0 && totalTargetRequired > 0 ? Number((totalTargetRequired / totalPieces).toFixed(2)) : 1;
      multDisplay = effectiveMult === 1 ? '1 / Pc' : (effectiveMult < 1 ? `÷${Math.round(1 / effectiveMult)}` : `×${effectiveMult}`);
      variance = totalTargetRequired - totalRawQty;
      hasVariance = true;
      varianceText = variance > 0 ? `+${variance.toLocaleString('en-IN')} Pcs` : `${variance.toLocaleString('en-IN')} Pcs`;
      varianceBadge = variance === 0 ? 'BALANCED' : variance > 0 ? 'CUTTING BALANCE' : 'OVER ISSUED';
    } else {
      hasVariance = false;
      varianceText = '—';
      varianceBadge = `Issued in ${primaryUnit}`;
    }
  } else {
    hasVariance = false;
    varianceText = '—';
    varianceBadge = 'No Lot Qty';
  }

  return {
    totalPieces,
    totalStoreStock,
    issuePcs: totalRawQty,
    totalTargetRequired,
    effectiveMult,
    multDisplay,
    variance,
    hasVariance,
    varianceText,
    varianceBadge,
    primaryUnit,
    isPieceBased,
    formattedIssueQty,
    unitTotals,
    stockBreakdown,
    cuttingVolume,
    isDirect
  };
};

// Helper to extract or derive the multiplier / per-piece consumption factor for an item (hoisted function)
export function getMaterialMultiplier(m, log = null, cuttingPieces = 0) {
  if (!m) return 1;

  // 1. Explicit multiplier stored on material
  if (m.multiplier !== undefined && m.multiplier !== null && m.multiplier !== '') {
    const num = Number(m.multiplier);
    if (!isNaN(num) && num > 0) {
      if (m.multiplierOp === 'divide' && num > 1) {
        return Math.round((1 / num) * 1000) / 1000;
      }
      return num;
    }
  }

  // 2. Explicit factor or perPcReq
  if (m.factor && Number(m.factor) > 0) return Number(m.factor);
  if (m.perPcReq && Number(m.perPcReq) > 0) return Number(m.perPcReq);

  // 3. Smart historical detection for multi-per-piece items (e.g. Buttons, Rivets, Studs, Eyelets)
  const cat = String(m.category || m.componentType || m.bomItemName || '').toUpperCase();
  const name = String(m.name || m.materialName || '').toUpperCase();
  const isMultiGarmentAcc = cat.includes('BUTTON') || name.includes('BUTTON') ||
    cat.includes('RIVET') || name.includes('RIVET') ||
    cat.includes('EYELET') || name.includes('EYELET') ||
    cat.includes('SNAP') || name.includes('SNAP') ||
    cat.includes('STUD') || name.includes('STUD');

  const q = Number(m.qty) || 0;
  if (isMultiGarmentAcc && cuttingPieces > 0 && q > 0) {
    const ratio = q / cuttingPieces;
    if (ratio >= 1.8) {
      // Clean ratio to 1 decimal place or nearest integer (e.g. 10.012 -> 10, 4.17 -> 4.2)
      const cleanRatio = Math.round(ratio * 10) / 10;
      return cleanRatio;
    }
  }

  return 1;
};

// Helper to calculate cutting target, individual issued quantity, and individual variance for a specific material line-item
export const getMaterialItemMetrics = (m, log, allMaterials = [], cuttingMap = {}, designs = []) => {
  if (!m) {
    return {
      qty: 0,
      unit: 'Pcs',
      formattedQty: '0 Pcs',
      multiplier: 1,
      multiplierDisplay: '1 / Pc',
      cuttingPieces: 0,
      targetRequired: 0,
      variance: 0,
      hasVariance: false,
      varianceText: '—',
      varianceBadge: '',
      isAuxiliary: false,
      isDirect: true
    };
  }

  const rawLot = String(log?.lotId || '').trim();
  const cleanLot = rawLot.toLowerCase();

  // Comprehensive check for Without Lot / Direct Requisitions
  const isDirect = !cleanLot ||
    cleanLot === 'direct-item' ||
    cleanLot === 'w/o lot' ||
    cleanLot === 'without lot' ||
    cleanLot === 'no lot' ||
    cleanLot === 'none' ||
    cleanLot === 'n/a' ||
    cleanLot.includes('direct') ||
    cleanLot.includes('w/o') ||
    cleanLot.includes('without') ||
    cleanLot.includes('no lot');

  let cuttingVolume = 0;
  if (!isDirect && cleanLot) {
    if (cuttingMap && cuttingMap[cleanLot] !== undefined && cuttingMap[cleanLot] !== null) {
      cuttingVolume = Number(cuttingMap[cleanLot]) || 0;
    }
  }

  if (!cuttingVolume && !isDirect && cleanLot && Array.isArray(designs)) {
    const dMatch = designs.find(d =>
      String(d.id || '').trim().toLowerCase() === cleanLot ||
      String(d.lotNumber || '').trim().toLowerCase() === cleanLot
    );
    if (dMatch && Number(dMatch.quantity) > 0) {
      cuttingVolume = Number(dMatch.quantity);
    }
  }

  if (!cuttingVolume && !isDirect) {
    const rawVol = Number(log?.volume !== undefined && log?.volume !== null ? log.volume : (log?.pieces || 0));
    if (rawVol > 1) {
      cuttingVolume = rawVol;
    }
  }

  const cuttingPieces = isDirect ? 0 : cuttingVolume;

  const qty = Number(m.qty) || 0;
  const rawUnit = String(m.unit || 'Pcs').trim();
  const uUpper = rawUnit.toUpperCase();
  const isPc = uUpper === 'PCS' || uUpper === 'PC' || uUpper === 'PIECE' || uUpper === 'PIECES';
  const normUnit = isPc ? 'Pcs' : normalizeUnitName(rawUnit);
  
  // Calculate multiplier factor and target required for this item
  const mult = getMaterialMultiplier(m, log, cuttingPieces);
  const targetRequired = (!isDirect && cuttingPieces > 0) ? Math.round(cuttingPieces * mult) : 0;
  const multSuffix = mult !== 1 ? (mult < 1 ? ` (÷${Math.round(1 / mult)})` : ` (×${mult})`) : '';
  const formattedQty = `${qty.toLocaleString('en-IN')} ${normUnit}${multSuffix}`;
  const multiplierDisplay = mult === 1 ? '1 / Pc' : (mult < 1 ? `÷${Math.round(1 / mult)}` : `×${mult}`);

  const matName = String(m.name || m.bomItemName || m.materialName || '').trim().toLowerCase();
  const matCat = String(m.category || m.componentType || m.type || '').trim().toLowerCase();
  const combinedText = `${matName} ${matCat}`;

  // Check for floor tools, machine consumables, stationery, packaging tape, lifters, etc.
  const isTapeAuxiliary = combinedText.includes('cello') ||
    combinedText.includes('bopp') ||
    combinedText.includes('packaging tape') ||
    (combinedText.includes('tape') && (combinedText.includes('2 inch') || combinedText.includes('3 inch') || combinedText.includes('1 inch') || combinedText.includes('transparent') || combinedText.includes('brown') || combinedText.includes('roll')));

  const isGeneralFloorSupply =
    isTapeAuxiliary ||
    combinedText.includes('lifter') ||
    combinedText.includes('machine oil') ||
    (combinedText.includes('oil') && !combinedText.includes('boil')) ||
    combinedText.includes('scissor') ||
    combinedText.includes('needle') ||
    combinedText.includes('chalk') ||
    combinedText.includes('marker') ||
    combinedText.includes('stationery') ||
    combinedText.includes('cutter') ||
    combinedText.includes('blade') ||
    combinedText.includes('folder') ||
    combinedText.includes('screwdriver') ||
    combinedText.includes('wrench') ||
    combinedText.includes('cleaning');

  let variance = 0;
  let hasVariance = false;
  let varianceText = '—';
  let varianceBadge = '';

  if (isDirect) {
    hasVariance = false;
    varianceText = '—';
    varianceBadge = 'Direct Issue';
  } else if (cuttingPieces > 0) {
    if (isPc) {
      // Variance calculated according to multiplier: Target Required (cuttingPieces * mult) - qty
      variance = targetRequired - qty;
      hasVariance = true;
      varianceText = variance > 0 ? `+${variance.toLocaleString('en-IN')} Pcs` : `${variance.toLocaleString('en-IN')} Pcs`;
      varianceBadge = variance === 0 ? 'BALANCED' : variance > 0 ? 'CUTTING BALANCE' : 'OVER ISSUED';
    } else {
      hasVariance = false;
      varianceText = '—';
      varianceBadge = `Issued in ${normUnit}`;
    }
  } else {
    hasVariance = false;
    varianceText = '—';
    varianceBadge = 'No Lot Qty';
  }

  return {
    qty,
    unit: normUnit,
    formattedQty,
    multiplier: mult,
    multiplierDisplay,
    cuttingPieces,
    targetRequired,
    variance,
    hasVariance,
    varianceText,
    varianceBadge,
    isAuxiliary: isGeneralFloorSupply && !isPc,
    isDirect
  };
};

// Sound feedback helper
const playFeedbackSound = (type = 'success') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.36);
    } else if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch (err) {
    // Audio feedback not supported or user gesture required
  }
};

// Searchable Material Dropdown Component with dedicated search bar
export function SearchableMaterialDropdown({
  materials = [],
  value,
  onChange,
  onSwitchToManual = null,
  componentType = '',
  placeholder = "🔍 Search & Choose Material...",
  getPriorIssueInfo = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 360, isAbove: false });
  const [previewPhoto, setPreviewPhoto] = useState(null); // { url, name, itemCode }
  const [showAllOverride, setShowAllOverride] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const selectedMaterial = useMemo(() => {
    if (!value) return null;
    const vStr = String(value).trim().toLowerCase();
    return materials.find(m =>
      String(m.id).trim().toLowerCase() === vStr ||
      String(m.itemCode || '').trim().toLowerCase() === vStr ||
      String(m.stCode || '').trim().toLowerCase() === vStr
    );
  }, [materials, value]);

  const selectedItemCode = useMemo(() => {
    return getItemCodeDisplay(selectedMaterial);
  }, [selectedMaterial]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isAbove = spaceBelow < 320 && rect.top > 320;
      const desiredWidth = Math.min(680, Math.max(rect.width, 460));
      setCoords({
        top: isAbove ? rect.top : rect.bottom + 4,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - desiredWidth - 12)),
        width: desiredWidth,
        isAbove
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleReposition = () => updateCoords();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);
      const timer = setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      setShowAllOverride(false);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const ct = String(componentType || '').toLowerCase().trim();

    let matchKeywords = [];
    if (ct && ct !== '__custom__' && ct !== '__manage__') {
      if (ct.includes('dori')) matchKeywords = ['dori', 'drawcord', 'cord', 'string'];
      else if (ct.includes('elastic')) matchKeywords = ['elastic', 'waistband'];
      else if (ct.includes('zip')) matchKeywords = ['zip', 'zipper', 'slider'];
      else if (ct.includes('button')) matchKeywords = ['button'];
      else if (ct.includes('tape')) matchKeywords = ['tape'];
      else if (ct.includes('tag')) matchKeywords = ['tag', 'hangtag'];
      else matchKeywords = [ct];
    }

    const matchesType = (m) => {
      if (!ct || matchKeywords.length === 0) return true;
      const text = `${m.name || ''} ${m.category || ''} ${m.bomItemName || ''} ${m.componentType || ''}`.toLowerCase();
      return matchKeywords.some(kw => text.includes(kw));
    };

    let pool = materials || [];
    if (!showAllOverride) {
      if (!ct) {
        if (!q) return [];
      } else if (matchKeywords.length > 0) {
        const typeMatches = pool.filter(matchesType);
        pool = typeMatches.length > 0 ? typeMatches : [];
      }
    }

    if (!q) {
      return pool;
    }

    return pool.filter(m => {
      const idStr = String(m.id || '').toLowerCase();
      const nameStr = String(m.name || '').toLowerCase();
      const colorStr = String(m.color || m.shade || '').toLowerCase();
      const catStr = String(m.category || '').toLowerCase();
      const locStr = String(m.location || m.warehouseLocation || '').toLowerCase();
      const codeStr = String(m.itemCode || '').toLowerCase();
      return idStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q) || locStr.includes(q) || codeStr.includes(q);
    });
  }, [materials, searchQuery, componentType, showAllOverride]);

  const unusedFiltered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      if (!componentType) return materials || [];
      const ct = String(componentType).toLowerCase();
      let matchKeywords = [];
      if (ct.includes('dori')) matchKeywords = ['dori', 'drawcord', 'cord', 'string'];
      else if (ct.includes('elastic')) matchKeywords = ['elastic', 'waistband'];
      else if (ct.includes('zip')) matchKeywords = ['zip', 'zipper', 'slider'];
      else if (ct && ct !== '__custom__' && ct !== '__manage__') matchKeywords = [ct];

      return [...(materials || [])].sort((a, b) => {
        const aText = `${a.name || ''} ${a.category || ''}`.toLowerCase();
        const bText = `${b.name || ''} ${b.category || ''}`.toLowerCase();
        const aMatch = matchKeywords.some(kw => aText.includes(kw));
        const bMatch = matchKeywords.some(kw => bText.includes(kw));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }
    return (materials || []).filter(m => {
      const idStr = String(m.id || '').toLowerCase();
      const nameStr = String(m.name || '').toLowerCase();
      const colorStr = String(m.color || m.shade || '').toLowerCase();
      const catStr = String(m.category || '').toLowerCase();
      const locStr = String(m.location || m.warehouseLocation || '').toLowerCase();
      const codeStr = String(m.itemCode || '').toLowerCase();
      return idStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q) || locStr.includes(q) || codeStr.includes(q);
    });
  }, [materials, searchQuery, componentType]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [searchQuery]);

  const scrollHighlightedIntoView = (index) => {
    if (!listRef.current) return;
    const itemEl = listRef.current.children[index];
    if (itemEl && typeof itemEl.scrollIntoView === 'function') {
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => {
        const next = Math.min(prev + 1, filtered.length - 1);
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => {
        const next = Math.max(prev - 1, 0);
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        onChange(filtered[highlightIndex].id);
        setIsOpen(false);
        setSearchQuery('');
        playFeedbackSound('scan');
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: '240px' }}>
      {/* Trigger Box */}
      <div
        onClick={() => {
          if (!isOpen) {
            updateCoords();
            setSearchQuery('');
            if (!componentType) {
              setShowAllOverride(true);
            }
          }
          setIsOpen(!isOpen);
        }}
        title={!componentType ? 'Click to search all store inventory materials' : 'Click to select material'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: !componentType ? 'not-allowed' : 'pointer',
          width: '100%',
          height: '36px',
          minHeight: '36px',
          padding: '0 10px',
          borderRadius: '7px',
          border: selectedMaterial ? '1.5px solid #059669' : !componentType ? '1.5px dashed #ea580c' : isOpen ? '1.5px solid #ea580c' : '1.5px solid #cbd5e1',
          background: selectedMaterial ? '#f0fdf4' : !componentType ? '#fff7ed' : '#ffffff',
          color: selectedMaterial ? '#0f172a' : '#64748b',
          fontSize: '12px',
          fontWeight: '600',
          boxSizing: 'border-box',
          boxShadow: isOpen ? '0 0 0 3px rgba(234, 88, 12, 0.15)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          {selectedMaterial ? (
            <>
              {/* Photo Thumbnail */}
              {(() => {
                const rawImg = selectedMaterial.imageUrl || selectedMaterial.image || selectedMaterial.photo || selectedMaterial.imgUrl;
                const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                return cleanImg ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewPhoto({ url: cleanImg, name: selectedMaterial.name, itemCode: selectedItemCode });
                    }}
                    title="Click to view material photo"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1.5px solid #059669',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    <img
                      src={cleanImg}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '5px',
                    backgroundColor: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #cbd5e1',
                    flexShrink: 0,
                    color: '#64748b'
                  }}>
                    <Package size={14} />
                  </div>
                );
              })()}

              {/* Item Code Badge (NO MT CODE) */}
              {selectedItemCode && (
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: '800',
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '1.5px 6px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)'
                }}>
                  {selectedItemCode}
                </span>
              )}

              {selectedMaterial.category && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  background: '#fff7ed',
                  color: '#c2410c',
                  border: '1px solid #fed7aa',
                  padding: '1.5px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  flexShrink: 0
                }}>
                  {selectedMaterial.category}
                </span>
              )}

              <span style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedMaterial.name}
              </span>
              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                  ({selectedMaterial.color})
                </span>
              )}
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                color: (selectedMaterial.stock || 0) > 0 ? '#15803d' : '#dc2626',
                background: (selectedMaterial.stock || 0) > 0 ? '#dcfce7' : '#fee2e2',
                padding: '1.5px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.stock || 0} {selectedMaterial.unit || 'Pcs'}
              </span>
              {selectedMaterial.location && (
                <span style={{
                  fontSize: '10px',
                  color: '#0284c7',
                  background: '#e0f2fe',
                  padding: '1.5px 6px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 0
                }}>
                  📍 {selectedMaterial.location}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: !componentType ? '#c2410c' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: !componentType ? '700' : '500' }}>
              <Search size={14} style={{ color: '#ea580c' }} />
              <span>{!componentType ? '⚠️ Choose Category / Component First...' : placeholder}</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {selectedMaterial && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchQuery('');
              }}
              title="Clear selection"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ✕
            </button>
          )}
          <ChevronDown
            size={14}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Floating Dropdown with Dedicated Search Bar */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.isAbove
              ? { bottom: `${window.innerHeight - coords.top + 4}px` }
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 20px)',
            background: '#ffffff',
            border: '1.5px solid #ea580c',
            borderRadius: '10px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08)',
            zIndex: 9999999,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* SEARCH BAR INPUT */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#ea580c'
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="🔍 Search material by Name, Item Code (e.g. ST00001), Color, Rack Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '36px',
                padding: '6px 30px 6px 32px',
                fontSize: '12.5px',
                fontWeight: '600',
                borderRadius: '8px',
                border: '1.5px solid #ea580c',
                outline: 'none',
                background: '#fff7ed',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Result Info Header with 1-Click All Items Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', padding: '0 4px', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: '800', color: showAllOverride ? '#1d4ed8' : '#0f172a', whiteSpace: 'nowrap' }}>
                {showAllOverride
                  ? `🌐 All Inventory (${filtered.length} items)`
                  : (!componentType ? '⚠️ Choose Category or click All Items' : `${componentType} (${filtered.length} items)`)}
              </span>

              {/* 1-Click Open All Items Button */}
              {materials && materials.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllOverride(prev => !prev);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '5px',
                    border: showAllOverride ? '1.5px solid #2563eb' : '1px solid #ea580c',
                    background: showAllOverride ? '#eff6ff' : '#fff7ed',
                    color: showAllOverride ? '#1d4ed8' : '#c2410c',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  title={showAllOverride ? `Switch back to ${componentType || 'Category'} filter` : "1-Click to view all store materials across all categories"}
                >
                  <span>{showAllOverride && componentType ? `🎯 Filter: ${componentType}` : `🌐 All Items (${materials.length})`}</span>
                </button>
              )}
            </div>

            <span style={{ fontSize: '10px', whiteSpace: 'nowrap', color: '#94a3b8' }}>&uarr; &darr; Enter &bull; Esc</span>
          </div>

          {/* List of Materials */}
          <div
            ref={listRef}
            style={{
              maxHeight: '270px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '6px'
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                <Package size={28} style={{ margin: '0 auto 6px auto', opacity: 0.5 }} />
                {!componentType ? (
                  <div>
                    <div style={{ color: '#ea580c', fontWeight: '800', fontSize: '13px', marginBottom: '4px' }}>
                      ⚠️ Please Choose Component / Category First
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Select a category (e.g. 1. DORI, 2. ELASTIC, 3. ZIP) in Column 2 to view matching store materials.
                    </div>
                  </div>
                ) : (
                  <div>No materials matching &quot;{searchQuery || componentType}&quot;</div>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '8px',
                    padding: '4px 10px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              filtered.map((mat, idx) => {
                const isSelected = String(mat.id) === String(value);
                const isHighlighted = idx === highlightIndex;
                const hasStock = Number(mat.stock) > 0;
                const displayCode = getItemCodeDisplay(mat);

                return (
                  <div
                    key={mat.id}
                    onClick={() => {
                      onChange(mat.id);
                      setIsOpen(false);
                      setSearchQuery('');
                      playFeedbackSound('scan');
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      background: isHighlighted
                        ? '#ffedd5'
                        : isSelected
                          ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                          : '#ffffff',
                      border: isHighlighted
                        ? '1px solid #ea580c'
                        : isSelected
                          ? '1px solid #fed7aa'
                          : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      fontSize: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      {/* Photo Thumbnail */}
                      {(() => {
                        const rawImg = mat.imageUrl || mat.image || mat.photo || mat.imgUrl;
                        const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                        return cleanImg ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto({ url: cleanImg, name: mat.name, itemCode: displayCode });
                            }}
                            title="Click to view & zoom material photo"
                            style={{
                              position: 'relative',
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: isSelected ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              flexShrink: 0,
                              cursor: 'zoom-in',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              transition: 'transform 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.12)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <img
                              src={cleanImg}
                              alt={mat.name}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                              }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              backgroundColor: 'rgba(15, 23, 42, 0.72)',
                              color: '#ffffff',
                              width: '11px',
                              height: '11px',
                              borderRadius: '3px 0 0 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '7px',
                              pointerEvents: 'none'
                            }}>
                              🔍
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? '#ffedd5' : '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: isSelected ? '#ea580c' : '#94a3b8'
                            }}
                          >
                            <Package size={18} />
                          </div>
                        );
                      })()}

                      {/* Item Code badge (ST00001 etc.) - Absolutely NO MT CODE */}
                      {displayCode && (
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: '800',
                          fontSize: '11px',
                          background: '#0284c7',
                          color: '#ffffff',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                          boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)'
                        }}>
                          {displayCode}
                        </span>
                      )}

                      {/* Category Badge */}
                      {mat.category && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          background: '#fff7ed',
                          color: '#c2410c',
                          border: '1px solid #fed7aa',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {mat.category}
                        </span>
                      )}

                      <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '700',
                          fontSize: '12.5px',
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {mat.name}
                          {mat.color && mat.color !== 'Default' && (
                            <span style={{ fontWeight: '500', color: '#64748b', marginLeft: '6px', fontSize: '11px' }}>
                              ({mat.color})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px', flexWrap: 'wrap' }}>
                          {mat.location && (
                            <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={10} style={{ color: '#0284c7' }} />
                              <span>{mat.location}</span>
                            </div>
                          )}
                          {mat.category && (
                            <span style={{ fontSize: '10px', color: '#ea580c', fontWeight: '700' }}>
                              • {mat.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: hasStock ? '#15803d' : '#dc2626',
                        background: hasStock ? '#dcfce7' : '#fee2e2',
                        padding: '2px 7px',
                        borderRadius: '4px'
                      }}>
                        {mat.stock || 0} {mat.unit || 'Pcs'}
                      </span>
                      {isSelected && (
                        <Check size={14} style={{ color: '#ea580c', fontWeight: 'bold' }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {onSwitchToManual && (
            <div style={{
              paddingTop: '6px',
              borderTop: '1px dashed #fed7aa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Item not in store stock?</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onSwitchToManual();
                }}
                style={{
                  padding: '3px 9px',
                  borderRadius: '5px',
                  border: '1px solid #ea580c',
                  background: '#fff7ed',
                  color: '#c2410c',
                  fontWeight: '700',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ✏️ + Enter Custom Item Manually
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Lightbox Photo Preview Modal */}
      {previewPhoto && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999999,
            padding: '20px'
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              overflow: 'hidden',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              padding: '10px 16px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {previewPhoto.itemCode && (
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: '800',
                    fontSize: '11px',
                    background: '#0284c7',
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {previewPhoto.itemCode}
                  </span>
                )}
                <span style={{ fontWeight: '700', fontSize: '13px' }}>{previewPhoto.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', background: '#f8fafc' }}>
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function WithoutBomMaterialIssueView({
  materials = [],
  designs = [],
  onIssueMaterials,
  issueLogs = [],
  currentUser = null,
  currencySymbol = '₹',
  onSwitchToWithBom,
  onRedirectToTab,
  onSubmitApproval = null,
  initialTab = 'issue',
  isMovementReport = false
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'issue');

  useEffect(() => {
    if (Array.isArray(materials) && materials.length > 0 && typeof window !== 'undefined') {
      window.__gpdms_materials = materials;
    }
  }, [materials]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Issue Workflow Mode: 'item_only' (Direct single/multiple items issue without lot) vs 'floor_lot' (Batch issue against lot)
  const [issueMode, setIssueMode] = useState('item_only'); // 'item_only' | 'floor_lot'

  // Form Fields
  const [lotNo, setLotNo] = useState('');
  const [brandName, setBrandName] = useState('');
  const [styleName, setStyleName] = useState('Direct Item Requisition');
  const [pieces, setPieces] = useState(1);
  const [personName, setPersonName] = useState(currentUser?.name || 'paras');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDept, setReceiverDept] = useState('Cutting');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [dbExtraIssues, setDbExtraIssues] = useState([]);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/extra-material-issues`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setDbExtraIssues(Array.isArray(data) ? data : []))
      .catch(() => { });
  }, []);

  // Available brands from designs list
  const availableBrands = useMemo(() => {
    const set = new Set();
    (designs || []).forEach(d => {
      if (d.brand && typeof d.brand === 'string') {
        const b = d.brand.trim();
        if (b) set.add(b);
      }
    });
    return Array.from(set).sort();
  }, [designs]);

  // ── Cutting Cache Management & 30-Minute Auto-Reload ───────────────────────
  const CUTTING_CACHE_MAX_ENTRIES = 100;
  const CUTTING_CACHE_RELOAD_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  const [cuttingHeaders, setCuttingHeaders] = useState([]);
  const [lastCuttingCacheReload, setLastCuttingCacheReload] = useState(() => new Date());
  const [isReloadingCuttingCache, setIsReloadingCuttingCache] = useState(false);
  const [cuttingCacheRefreshCount, setCuttingCacheRefreshCount] = useState(0);
  const [cacheReloadNotice, setCacheReloadNotice] = useState('');

  // ── In-Memory Matrix Cache to avoid repeat API hits ──
  const matrixCacheRef = useRef({});

  // Reload cache function: empties in-memory matrix cache and reloads cutting headers from MySQL
  const reloadCuttingCache = useCallback(async (manual = false) => {
    setIsReloadingCuttingCache(true);
    // 1. If cache is full or on 30m reload, empty the cache
    matrixCacheRef.current = {};
    console.log('[Cutting Cache] Matrix cache emptied');

    try {
      const res = await fetch(`${getBackendUrl()}/api/cutting-headers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCuttingHeaders(data);
        }
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

  // Auto-reload every 30 minutes and on initial mount
  useEffect(() => {
    reloadCuttingCache(false);

    const intervalId = setInterval(() => {
      console.log('[Cutting Cache] 30-minute interval timer fired: Emptying cache and reloading headers');
      reloadCuttingCache(false);
    }, CUTTING_CACHE_RELOAD_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [reloadCuttingCache]);

  // Map of lowercase lot number -> Cutting Total Pieces
  const cuttingLotMap = useMemo(() => {
    const map = {};
    (cuttingHeaders || []).forEach(ch => {
      if (ch.Lot_Number) {
        const k = String(ch.Lot_Number).trim().toLowerCase();
        const q = Number(ch.Cutting_Qty) || 0;
        if (q > 0) map[k] = q;
      }
    });
    (designs || []).forEach(d => {
      const q = Number(d.quantity) || 0;
      if (q > 0) {
        if (d.id) {
          const k1 = String(d.id).trim().toLowerCase();
          if (!map[k1]) map[k1] = q;
        }
        if (d.lotNumber) {
          const k2 = String(d.lotNumber).trim().toLowerCase();
          if (!map[k2]) map[k2] = q;
        }
      }
    });
    return map;
  }, [cuttingHeaders, designs]);

  // Effective cutting map from in-memory cuttingHeaders and designs (Instant 0ms, zero network lag)
  const effectiveCuttingMap = cuttingLotMap;



  // ── Active Lot Cutting Details State & Fetch ────────────────────────────────
  const [activeLotCutting, setActiveLotCutting] = useState(null);
  const [loadingActiveLotCutting, setLoadingActiveLotCutting] = useState(false);
  const [showActiveCuttingMatrix, setShowActiveCuttingMatrix] = useState(false);

  // Dynamically extract all distinct size columns present in cutting matrix rows
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

  // Synchronous INSTANT lookup from memory (0ms) + debounced background matrix fetch
  useEffect(() => {
    const cleanLot = String(lotNo || '').trim();
    if (!cleanLot) {
      setActiveLotCutting(null);
      setLoadingActiveLotCutting(false);
      return;
    }

    const cleanLower = cleanLot.toLowerCase();

    // 1. INSTANT (0ms) In-Memory Lookup from cuttingHeaders & designs
    const headerMatch = (cuttingHeaders || []).find(ch =>
      String(ch.Lot_Number || '').trim().toLowerCase() === cleanLower
    );
    const designMatch = (designs || []).find(d =>
      String(d.id || '').trim().toLowerCase() === cleanLower ||
      String(d.lotNumber || '').trim().toLowerCase() === cleanLower
    );

    let challanTotal = 0;
    if (headerMatch?.Challan_History) {
      try {
        const chParsed = typeof headerMatch.Challan_History === 'string' ? JSON.parse(headerMatch.Challan_History) : headerMatch.Challan_History;
        if (Array.isArray(chParsed) && chParsed.length > 0) {
          challanTotal = Number(chParsed[0]?.totalQty) || 0;
        }
      } catch (_) { }
    }

    const memoryTotal = (challanTotal > 0 && Math.abs(challanTotal - Number(headerMatch?.Cutting_Qty)) > 50)
      ? challanTotal
      : (Number(headerMatch?.Cutting_Qty) || Number(designMatch?.quantity) || 0);
    const hasMemoryData = Boolean(headerMatch || designMatch);

    // Set immediate cutting details synchronously without waiting for network!
    setActiveLotCutting({
      lotNumber: cleanLot,
      totalPieces: memoryTotal,
      style: headerMatch?.Style || designMatch?.category || '',
      fabric: headerMatch?.Fabric || '',
      brand: headerMatch?.Brand || designMatch?.brand || '',
      partyName: headerMatch?.Party_Name || '',
      garmentType: headerMatch?.Garment_Type || '',
      dateOfIssue: headerMatch?.Date_of_Issue || headerMatch?.JobOrder_Date || '',
      shades: headerMatch?.Shades || '',
      sizes: headerMatch?.Sizes || '',
      rows: matrixCacheRef.current[cleanLower]?.rows || [],
      hasDetails: hasMemoryData
    });

    // Auto-fill form fields immediately
    if (headerMatch?.Brand || designMatch?.brand) {
      setBrandName(headerMatch?.Brand || designMatch?.brand);
    }
    if (headerMatch?.Style || designMatch?.category) {
      setStyleName(headerMatch?.Style || designMatch?.category);
    }
    if (memoryTotal > 0 && (!pieces || pieces === 1)) {
      setPieces(memoryTotal);
    }

    // If already cached in matrixCache, we have full matrix!
    if (matrixCacheRef.current[cleanLower]) {
      setLoadingActiveLotCutting(false);
      return;
    }

    // 2. Debounced background fetch for detailed Color-Size Matrix (350ms debounce to avoid typing lag)
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setLoadingActiveLotCutting(true);
      try {
        const res = await fetch(`${getBackendUrl()}/api/cutting/${encodeURIComponent(cleanLot)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        // If cache is full (capacity limit reached), empty cache to prevent memory bloat
        if (Object.keys(matrixCacheRef.current).length >= CUTTING_CACHE_MAX_ENTRIES) {
          console.log(`[Cutting Cache] Cache reached capacity (${CUTTING_CACHE_MAX_ENTRIES} entries). Emptying cache...`);
          matrixCacheRef.current = {};
        }

        matrixCacheRef.current[cleanLower] = data;
        const matrixRows = data?.rows || [];
        const matrixTotal = matrixRows.reduce((sum, r) => sum + (Number(r.totalPcs) || 0), 0);
        const resolvedTotal = matrixTotal > 0
          ? matrixTotal
          : (memoryTotal > 0 ? memoryTotal : (Number(data?.cuttingQty) || Number(data?.header?.Cutting_Qty) || 0));

        const styleVal = data?.style || data?.header?.Style || '';
        const fabricVal = data?.fabric || data?.header?.Fabric || '';
        const brandVal = data?.brand || data?.header?.Brand || '';
        const partyVal = data?.partyName || data?.header?.Party_Name || '';
        const shadesVal = data?.shades || data?.header?.Shades || '';
        const sizesVal = data?.sizes || data?.header?.Sizes || '';
        const dateVal = data?.dateOfIssue || data?.header?.Date_of_Issue || data?.jobOrderDate || '';

        setActiveLotCutting(prev => ({
          ...prev,
          totalPieces: resolvedTotal,
          style: prev?.style || styleVal,
          fabric: prev?.fabric || fabricVal,
          brand: prev?.brand || brandVal,
          partyName: prev?.partyName || partyVal,
          shades: prev?.shades || shadesVal,
          sizes: prev?.sizes || sizesVal,
          dateOfIssue: prev?.dateOfIssue || dateVal,
          rows: matrixRows,
          hasDetails: Boolean(hasMemoryData || matrixRows.length > 0 || resolvedTotal > 0 || styleVal || fabricVal)
        }));

        if (brandVal && !brandName) setBrandName(brandVal);
        if (styleVal && (!styleName || styleName === 'Direct Item Requisition')) setStyleName(styleVal);
        if (resolvedTotal > 0 && (pieces === memoryTotal || !pieces || pieces === 1)) setPieces(resolvedTotal);
      } catch (err) {
        // Silently keep the in-memory data
      } finally {
        if (!isCancelled) setLoadingActiveLotCutting(false);
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [lotNo, cuttingHeaders, designs, cuttingCacheRefreshCount]);

  // ── Cutting Pieces & 1% Extra Material Allowance ──
  // Resolves cutting pieces from verified cutting sheet / cuttingHeaders / designs
  const cuttingPieces = useMemo(() => {
    const clean = String(lotNo || '').trim().toLowerCase();
    if (!clean) return 0;
    if (activeLotCutting?.totalPieces > 0) return Number(activeLotCutting.totalPieces);
    if (effectiveCuttingMap && effectiveCuttingMap[clean] > 0) return Number(effectiveCuttingMap[clean]);
    return 0;
  }, [lotNo, activeLotCutting, effectiveCuttingMap]);

  // Automatic 1% material addition: e.g. 1000 pieces -> 1% = 10 -> Total 1010 pieces
  const onePercentAllowance = useMemo(() => {
    if (cuttingPieces <= 0) return 0;
    return Math.round(cuttingPieces * 0.01);
  }, [cuttingPieces]);

  // Default Issue Quantity: Cutting Pieces + 1% Extra (e.g. 1000 + 10 = 1010)
  const defaultAutoIssueQty = useMemo(() => {
    if (cuttingPieces <= 0) return 1;
    return cuttingPieces + onePercentAllowance;
  }, [cuttingPieces, onePercentAllowance]);

  const prevLotNoRef = useRef(lotNo);
  const prevDefaultQtyRef = useRef(defaultAutoIssueQty);

  // 1% Threshold Exceeded Approval Modal State
  const [approvalModalData, setApprovalModalData] = useState(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalReason, setApprovalReason] = useState('Extra floor material requisition exceeding 1% cutting allowance');

  // Barcode quick-input
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quickSelectedComponent, setQuickSelectedComponent] = useState('');
  const [showAlreadyIssued, setShowAlreadyIssued] = useState(false);
  const [dismissedAlreadyIssuedLots, setDismissedAlreadyIssuedLots] = useState([]);
  const barcodeInputRef = useRef(null);
  const lotNoInputRef = useRef(null);
  const personNameInputRef = useRef(null);
  const receiverNameInputRef = useRef(null);

  // Material Line Items
  const [items, setItems] = useState([
    {
      id: 1,
      componentType: '',
      customComponentType: '',
      isCustomType: false,
      entryMode: 'choose', // 'choose' (from inventory) | 'manual' (custom entered)
      materialId: '',
      materialName: '',
      itemCode: '',
      color: '',
      unit: 'Mtr',
      availableStock: 0,
      location: '',
      calcMode: 'multiplier', // 'direct' | 'multiplier' | 'per_piece'
      multiplier: 1,
      multiplierOp: 'multiply',
      baseQty: 1,
      perPcReq: 0,
      totalQty: 1
    }
  ]);

  // Form state
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewModal, setPreviewModal] = useState(null); // { doc, pdfUrl, voucherId, issueData, isPreviewOnly }
  const [activePrintData, setActivePrintData] = useState(null);

  // Auto-clear form error after 6 seconds
  useEffect(() => {
    if (!formError) return;
    const timer = setTimeout(() => {
      setFormError('');
    }, 6000);
    return () => clearTimeout(timer);
  }, [formError]);

  // Compute stock shortages across all currently chosen items
  const shortageItemsList = useMemo(() => {
    return items.filter(i => {
      if (!i.materialId || i.entryMode === 'manual') return false;
      const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
      const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(i.availableStock) || 0);
      return Number(i.totalQty) > rackStock;
    });
  }, [items, materials]);

  const hasShortageItems = shortageItemsList.length > 0;

  // Compute total issue quantity sum across all items (always whole integer, rounded up if decimal)
  const totalIssueQuantitySum = useMemo(() => {
    return Math.ceil(items.reduce((sum, item) => sum + (parseFloat(item.totalQty) || 0), 0));
  }, [items]);

  // Helper to extract clean photo URL for any material in logs or materials prop
  const getMaterialPhoto = (m) => {
    if (!m) return '';
    const direct = m.imageUrl || m.photo || m.image || m.imgUrl || m.pic;
    if (direct) return getCleanImageUrl(direct);

    const mId = m.materialId || m.id;
    const rawName = String(m.name || m.materialName || m.bomItemName || '').trim();
    const cleanName = rawName.toLowerCase();
    const rawCode = String(getItemCodeDisplay(m) || m.itemCode || m.stCode || '').trim();
    const cleanCode = rawCode.toLowerCase();

    // Pool of all available material references
    const pool = [
      ...(Array.isArray(materials) ? materials : []),
      ...(typeof window !== 'undefined' && Array.isArray(window.__gpdms_materials) ? window.__gpdms_materials : [])
    ];

    if (pool.length > 0) {
      // 1. Match by exact ID
      if (mId) {
        const idStr = String(mId).trim().toLowerCase();
        const match = pool.find(mat => mat && String(mat.id).trim().toLowerCase() === idStr);
        if (match) {
          const fImg = match.imageUrl || match.image || match.photo || match.imgUrl;
          if (fImg) return getCleanImageUrl(fImg);
        }
      }

      // 2. Match by Item Code (ST... / MT...)
      if (cleanCode && !cleanCode.startsWith('itm-')) {
        const match = pool.find(mat => {
          if (!mat) return false;
          const c = String(mat.itemCode || mat.stCode || '').trim().toLowerCase();
          return c && c === cleanCode;
        });
        if (match) {
          const fImg = match.imageUrl || match.image || match.photo || match.imgUrl;
          if (fImg) return getCleanImageUrl(fImg);
        }
      }

      // 3. Match by exact Name
      if (cleanName) {
        const match = pool.find(mat => {
          if (!mat) return false;
          const n = String(mat.name || '').trim().toLowerCase();
          return n && n === cleanName;
        });
        if (match) {
          const fImg = match.imageUrl || match.image || match.photo || match.imgUrl;
          if (fImg) return getCleanImageUrl(fImg);
        }
      }

      // 4. Match by partial/contained Name (e.g. "bengen" in "bengen 5 ltr")
      if (cleanName && cleanName.length >= 3) {
        const match = pool.find(mat => {
          if (!mat) return false;
          const n = String(mat.name || '').trim().toLowerCase();
          return n && (n.includes(cleanName) || cleanName.includes(n));
        });
        if (match) {
          const fImg = match.imageUrl || match.image || match.photo || match.imgUrl;
          if (fImg) return getCleanImageUrl(fImg);
        }
      }
    }

    return '';
  };

  // Helper to extract component/category name for any material item
  const getMaterialCategory = (m) => {
    if (!m) return '';
    const directType = m.componentType || m.bomItemName;
    if (directType && directType !== 'Accessory' && directType !== 'Material Item' && directType !== 'Standard' && directType !== 'Custom Accessory') {
      return directType;
    }
    if (m.category && m.category !== 'General' && m.category !== 'Standard') {
      return m.category;
    }

    const mId = m.materialId || m.id;
    const mName = m.name || m.materialName;
    if (mId || mName) {
      const match = (materials || []).find(mat =>
        (mId && String(mat.id) === String(mId)) ||
        (mName && String(mat.name).trim().toLowerCase() === String(mName).trim().toLowerCase()) ||
        (m.itemCode && String(mat.itemCode || '').trim().toLowerCase() === String(m.itemCode).trim().toLowerCase())
      );
      if (match) {
        return match.category || match.componentType || match.type || directType || '';
      }
    }
    return directType || m.category || '';
  };

  // Helper to extract location / rack number for any material item
  const getMaterialLocation = (m) => {
    if (!m) return '';
    const directLoc = m.location || m.warehouseLocation || m.storeLocation || m.rack || m.rackNo;
    if (directLoc && directLoc !== 'Store' && directLoc !== 'Main Store') {
      return directLoc;
    }
    const mId = m.materialId || m.id;
    const mName = m.name || m.materialName || m.bomItemName;
    const code = m.itemCode;
    const mCat = (m.bomItemName || m.componentType || m.category || '').trim().toLowerCase();

    if (mId || mName || code) {
      let match = (materials || []).find(mat =>
        (mId && String(mat.id) === String(mId)) ||
        (code && String(mat.itemCode || '').trim().toLowerCase() === String(code).trim().toLowerCase())
      );

      if (!match && mName && mCat) {
        match = (materials || []).find(mat => {
          const matName = String(mat.name || '').trim().toLowerCase();
          const matCat = String(mat.category || mat.componentType || mat.type || '').trim().toLowerCase();
          return matName === String(mName).trim().toLowerCase() && (matCat.includes(mCat) || mCat.includes(matCat));
        });
      }

      if (!match && mName) {
        match = (materials || []).find(mat =>
          String(mat.name || '').trim().toLowerCase() === String(mName).trim().toLowerCase()
        );
      }

      if (match && (match.location || match.warehouseLocation || match.storeLocation || match.rack || match.rackNo)) {
        return match.location || match.warehouseLocation || match.storeLocation || match.rack || match.rackNo;
      }
    }
    return directLoc || '';
  };

  // Helper to parse log date string (DD/MM/YYYY or YYYY-MM-DD) into standard YYYY-MM-DD
  const parseLogDateToYmd = (dateStr) => {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    // Check if DD/MM/YYYY or DD-MM-YYYY (e.g. "15/10/2026" or "15/10/2026 18:14")
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    // Check if YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  };

  // Helper to extract numeric epoch timestamp from any log for strict newest-first sorting
  const getLogTimestamp = (log) => {
    if (!log) return 0;
    if (log.timestamp && !isNaN(Number(log.timestamp))) return Number(log.timestamp);
    if (log.created_at) {
      const t = new Date(log.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    if (log.createdAt) {
      const t = new Date(log.createdAt).getTime();
      if (!isNaN(t)) return t;
    }

    const dateStr = String(log.date || log.issueDate || '').trim();
    if (dateStr) {
      // 1. DD/MM/YYYY or DD-MM-YYYY with optional time (e.g. "31/10/2026 18:07" or "03/11/2026")
      const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        const year = parseInt(dmyMatch[3], 10);
        const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
        const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
        const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, min, sec);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      // 2. YYYY-MM-DD with optional time
      const ymdMatch = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
        const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
        const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, min, sec);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      const parsed = new Date(dateStr).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    const idStr = String(log.id || '').toUpperCase();
    const numPart = parseInt(idStr.replace(/^[A-Z-]+/, ''), 10);
    if (!isNaN(numPart) && numPart > 0) return numPart;

    return 0;
  };

  // History Tab Filters State (Dates, Category Multi-Select, Person, Search)
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyCategories, setHistoryCategories] = useState([]); // multi-select categories array e.g. ['TAG', 'LABEL']
  const [historyPersons, setHistoryPersons] = useState([]); // multi-select person array e.g. ['iss:paras', 'rec:PINTU']

  // Table View & Layout Settings: View Mode ('item_wise' | 'compact_row'), Density ('standard' | 'compact'), Page Size (25, 50, 100, 'all')
  const [historyViewMode, setHistoryViewMode] = useState(() => {
    try {
      return localStorage.getItem('without_bom_history_view_mode') || 'item_wise';
    } catch (_) {
      return 'item_wise';
    }
  });

  const [historyDensity, setHistoryDensity] = useState(() => {
    try {
      return localStorage.getItem('without_bom_history_density') || 'standard';
    } catch (_) {
      return 'standard';
    }
  });

  const [historyPageSize, setHistoryPageSize] = useState(() => {
    try {
      const saved = localStorage.getItem('without_bom_history_page_size');
      return saved ? (saved === 'all' ? 'all' : Number(saved) || 50) : 50;
    } catch (_) {
      return 50;
    }
  });

  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [expandedChallanIds, setExpandedChallanIds] = useState({});

  const handleSetViewMode = (mode) => {
    setHistoryViewMode(mode);
    try { localStorage.setItem('without_bom_history_view_mode', mode); } catch (_) { }
  };

  const handleSetDensity = (density) => {
    setHistoryDensity(density);
    try { localStorage.setItem('without_bom_history_density', density); } catch (_) { }
  };

  const handleSetPageSize = (size) => {
    setHistoryPageSize(size);
    setHistoryCurrentPage(1);
    try { localStorage.setItem('without_bom_history_page_size', String(size)); } catch (_) { }
  };

  const toggleExpandChallan = (challanId) => {
    setExpandedChallanIds(prev => ({
      ...prev,
      [challanId]: !prev[challanId]
    }));
  };

  const handleToggleAllExpanded = () => {
    const allIds = withoutBomLogs.map(l => l.id).filter(Boolean);
    const areAllExpanded = allIds.length > 0 && allIds.every(id => expandedChallanIds[id]);
    if (areAllExpanded) {
      setExpandedChallanIds({});
    } else {
      const newMap = {};
      allIds.forEach(id => { newMap[id] = true; });
      setExpandedChallanIds(newMap);
    }
  };

  // Scrollable Category Dropdown Menu State
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const categoryDropdownRef = useRef(null);

  // Scrollable Person Dropdown Menu State
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const personDropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
      if (personDropdownRef.current && !personDropdownRef.current.contains(e.target)) {
        setPersonDropdownOpen(false);
      }
    };
    if (categoryDropdownOpen || personDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [categoryDropdownOpen, personDropdownOpen]);

  // Category multi-select toggle (allows choosing 2-3+ categories together)
  const handleToggleHistoryCategory = (catName) => {
    const upper = catName.trim().toUpperCase();
    setHistoryCategories(prev => {
      if (prev.includes(upper)) {
        return prev.filter(c => c !== upper);
      } else {
        return [...prev, upper];
      }
    });
  };

  // Person multi-select toggle (allows choosing multiple store issuers / floor masters)
  const handleToggleHistoryPerson = (personKey) => {
    setHistoryPersons(prev => {
      if (prev.includes(personKey)) {
        return prev.filter(p => p !== personKey);
      } else {
        return [...prev, personKey];
      }
    });
  };

  const formatPersonKey = (key) => {
    if (!key) return '';
    if (key.startsWith('iss:')) return `Store: ${key.replace('iss:', '')}`;
    if (key.startsWith('rec:')) return `Floor: ${key.replace('rec:', '')}`;
    return key;
  };

  // Date Quick Preset Handlers
  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setHistoryDateFrom(today);
    setHistoryDateTo(today);
  };

  const handleSetYesterday = () => {
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    setHistoryDateFrom(yest);
    setHistoryDateTo(yest);
  };

  const handleSetLast7Days = () => {
    const today = new Date().toISOString().split('T')[0];
    const past = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    setHistoryDateFrom(past);
    setHistoryDateTo(today);
  };

  const handleResetAllFilters = () => {
    setHistorySearch('');
    setHistoryDateFrom('');
    setHistoryDateTo('');
    setHistoryCategories([]);
    setHistoryPersons([]);
    setPersonSearchTerm('');
    setPersonDropdownOpen(false);
    setCategorySearchTerm('');
    setCategoryDropdownOpen(false);
  };

  // Auto-generate clean sequential Challan / Bill No (e.g. BILL-MI-1, BILL-MI-2...)
  const nextVoucherId = useMemo(() => {
    let max = 0;
    (issueLogs || []).forEach(log => {
      const idStr = String(log.id || '').toUpperCase();
      if (
        idStr.startsWith('BILL-MI-') ||
        idStr.startsWith('CH-MI-') ||
        idStr.startsWith('WO-MI-') ||
        idStr.startsWith('MI-WO-') ||
        idStr.startsWith('BILL-')
      ) {
        const match = idStr.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (!isNaN(n) && n > max) max = n;
        }
      }
    });
    return `BILL-MI-${max + 1}`;
  }, [issueLogs]);

  // Raw without-bom issue logs for history tab (Strictly Without-BOM only)
  const rawWithoutBomLogs = useMemo(() => {
    const logs = [...(issueLogs || [])];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const localElastic = localStorage.getItem('gpdms_elastic_issue_history');
        if (localElastic) {
          const parsed = JSON.parse(localElastic);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              const pSlip = String(p.slipNo || p.slip_no || '').trim().toUpperCase();
              if (pSlip.startsWith('OTHER-') && !logs.some(l => String(l.id || '').toUpperCase() === pSlip)) {
                logs.push({
                  id: p.slipNo || p.slip_no,
                  lotId: p.lotNo || 'W/O BOM',
                  isWithoutBom: true,
                  category: 'OTHER ACCESSORIES',
                  volume: Number(p.otherRollCount || p.rolls || 1),
                  pieces: Number(p.quantity || p.issuePcs || 0),
                  personName: p.issuerName || 'Store In-charge',
                  receiverName: p.receiverName || 'Cutting Master',
                  date: p.date || p.issueDate || '',
                  style: p.style || 'LOWER',
                  remarks: p.remarks || 'Other Accessories Issue',
                  materials: [{
                    name: p.otherMaterialName || 'Other Accessory',
                    bomItemName: 'OTHER ACCESSORIES',
                    qty: Number(p.otherRollCount || p.rolls || 1),
                    unit: p.otherUnit || 'Roll',
                    itemCode: p.otherItemCode || ''
                  }]
                });
              }
            });
          }
        }
      }
    } catch (_) { }

    const filteredRaw = logs.filter(l => {
      const vid = String(l.id || '').toUpperCase();
      // STRICT: Exclude Extra Material & Re-Issues
      if (l.isReissue || vid.startsWith('EMI-') || vid.startsWith('RI-') || String(l.personName || '').toLowerCase().includes('extra')) {
        return false;
      }
      return Boolean(
        l.isWithoutBom ||
        vid.startsWith('BILL-MI-') ||
        vid.startsWith('CH-MI-') ||
        vid.startsWith('WO-MI-') ||
        vid.startsWith('MI-WO-') ||
        vid.startsWith('OTHER-') ||
        String(l.category || '').toUpperCase().includes('WITHOUT BOM') ||
        String(l.category || '').toUpperCase().includes('OTHER') ||
        String(l.lotId || '').toUpperCase().includes('DIRECT')
      );
    });

    // Sort descending: Latest Date / Time and highest sequential Challan Number at the top
    return filteredRaw.sort((a, b) => {
      const timeA = getLogTimestamp(a);
      const timeB = getLogTimestamp(b);
      if (timeA !== timeB) return timeB - timeA;
      const numA = parseInt(String(a.id || '').replace(/^[A-Z-]+/i, ''), 10) || 0;
      const numB = parseInt(String(b.id || '').replace(/^[A-Z-]+/i, ''), 10) || 0;
      if (numA !== numB) return numB - numA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [issueLogs]);

  // Standardize / normalize component category into core category key (e.g. "6. LABEL", "Labels" -> "LABEL")
  const normalizeCategoryKey = (rawCat, rawName = '') => {
    const c = String(rawCat || '').trim().toUpperCase();
    const n = String(rawName || '').trim().toUpperCase();
    if (!c && !n) return '';
    const cleanCat = c.replace(/^\d+[\.\s\-]+/, '').trim();

    if (cleanCat.includes('LABEL') || n.includes('LABEL')) return 'LABEL';
    if (cleanCat.includes('TAG') || n.includes('TAG')) return 'TAG';
    if (cleanCat.includes('ZIP') || n.includes('ZIP')) return 'ZIP';
    if (cleanCat.includes('DORI') || n.includes('DORI') || cleanCat.includes('DRAWSTRING') || n.includes('DRAWSTRING') || cleanCat.includes('CORD')) return 'DORI';
    if (cleanCat.includes('ELASTIC') || n.includes('ELASTIC')) return 'ELASTIC';
    if (cleanCat.includes('BUTTON') || n.includes('BUTTON')) return 'BUTTON';
    if (cleanCat.includes('POLY') || n.includes('POLYBAG') || cleanCat.includes('BAG') || n.includes('POLYBAG')) return 'POLYBAG';
    if (cleanCat.includes('THREAD') || n.includes('THREAD')) return 'THREAD';
    if (cleanCat.includes('PATCH') || n.includes('PATCH') || cleanCat.includes('BADGE')) return 'PATCH';
    if (cleanCat.includes('TAPE') || n.includes('TAPE')) return 'TAPE';
    if (cleanCat.includes('RIVET') || n.includes('RIVET')) return 'RIVET';
    if (cleanCat.includes('HOOK') || n.includes('HOOK')) return 'HOOK';

    if (cleanCat === 'GENERAL' || cleanCat === 'OTHER' || cleanCat === 'ACCESSORIES') return '';
    return cleanCat || n || '';
  };

  // Previously issued materials for the currently entered Lot Number
  const previouslyIssuedForCurrentLot = useMemo(() => {
    const rawInput = String(lotNo || '').trim();
    if (!rawInput) return null;

    const clean = rawInput.toLowerCase();
    // Direct issues / without lot are not production lots
    const isDirect = clean === 'direct-item' ||
      clean === 'w/o lot' ||
      clean === 'without lot' ||
      clean === 'no lot' ||
      clean === 'none' ||
      clean === 'n/a' ||
      clean.includes('direct') ||
      clean.includes('without');
    if (isDirect) return null;

    const normTarget = clean.replace(/^lot\s*#?/, '').replace(/^#/, '').trim();
    if (!normTarget) return null;

    // Combine issueLogs and rawWithoutBomLogs, deduplicate by id
    const allKnownLogs = [...(issueLogs || [])];
    (rawWithoutBomLogs || []).forEach(rl => {
      if (!allKnownLogs.some(l => String(l.id || '').toUpperCase() === String(rl.id || '').toUpperCase())) {
        allKnownLogs.push(rl);
      }
    });

    // Filter logs for this lot
    const matchingLogs = allKnownLogs.filter(l => {
      const rawL = String(l.lotId || l.lotNumber || l.lot || l.designId || '').trim().toLowerCase();
      if (!rawL) return false;
      const normL = rawL.replace(/^lot\s*#?/, '').replace(/^#/, '').trim();
      return normL === normTarget || rawL === clean;
    });

    // Also include extra material issues from dbExtraIssues for this lot
    const matchingExtraIssues = (dbExtraIssues || []).filter(ex => {
      const rawL = String(ex.lotId || ex.lotNumber || ex.lot || '').trim().toLowerCase();
      if (!rawL) return false;
      const normL = rawL.replace(/^lot\s*#?/, '').replace(/^#/, '').trim();
      return normL === normTarget || rawL === clean;
    });

    if (matchingLogs.length === 0 && matchingExtraIssues.length === 0) return null;

    // Aggregate by material and category
    const matMap = {};
    const categoryTotals = {};
    let totalLineItems = 0;
    const challanIds = new Set();

    // Helper to find catalog code & category
    const findCatalogInfo = (name, matId) => {
      if (!materials || !Array.isArray(materials)) return { code: '', cat: '' };
      const matched = materials.find(mat =>
        (matId && String(mat.id) === String(matId)) ||
        (mat.name && String(mat.name).trim().toLowerCase() === String(name).trim().toLowerCase())
      );
      if (!matched) return { code: '', cat: '' };
      const rawCode = matched.itemCode || matched.stCode || matched.materialCode || '';
      const code = String(rawCode).toUpperCase().startsWith('MT') ? '' : rawCode;
      return { code, cat: matched.category || matched.componentType || '' };
    };

    matchingLogs.forEach(l => {
      if (l.id) challanIds.add(l.id);
      const mats = (Array.isArray(l.materials) && l.materials.length > 0)
        ? l.materials
        : (Array.isArray(l.items) && l.items.length > 0 ? l.items : []);

      if (mats.length === 0 && (l.materialName || l.material)) {
        mats.push({
          name: l.materialName || l.material,
          qty: l.quantity || l.qty || l.pieces || 0,
          unit: l.unit || 'Pcs',
          itemCode: l.itemCode || '',
          category: l.category || ''
        });
      }

      mats.forEach(m => {
        if (!m) return;
        const name = String(m.name || m.materialName || m.bomItemName || 'Material Item').trim();
        const qty = Number(m.qty !== undefined ? m.qty : (m.totalQty !== undefined ? m.totalQty : 0)) || 0;
        const rawUnit = String(m.unit || 'Pcs').trim();
        const uUpper = rawUnit.toUpperCase();
        const isPc = uUpper === 'PCS' || uUpper === 'PC' || uUpper === 'PIECE' || uUpper === 'PIECES';
        const normUnit = isPc ? 'Pcs' : rawUnit;
        const catalog = findCatalogInfo(name, m.materialId);
        const cat = String(m.category || m.componentType || getMaterialCategory(m) || catalog.cat || '').trim();
        const rawCode = String(getItemCodeDisplay(m) || m.itemCode || catalog.code || '').trim().toUpperCase();
        const code = rawCode.startsWith('MT') ? '' : rawCode;
        const itemCodeKey = code ? code : (m.materialId ? String(m.materialId) : name.toLowerCase());
        const key = `${itemCodeKey}___${normUnit.toLowerCase()}`;

        if (!matMap[key]) {
          matMap[key] = {
            key,
            materialId: m.materialId || catalog.id || '',
            name,
            unit: normUnit,
            category: cat,
            itemCode: code,
            totalQty: 0,
            challans: []
          };
        }

        matMap[key].totalQty += qty;
        totalLineItems += 1;
        matMap[key].challans.push({
          id: l.id || 'Challan',
          date: l.date || '',
          qty,
          unit: normUnit,
          issuer: l.personName || 'Store',
          receiver: l.receiverName || 'Cutting',
          receiverDept: l.receiverDept || ''
        });

        // Group into category totals (e.g. for LABEL, TAG, ZIP, DORI, etc.)
        const catKey = normalizeCategoryKey(cat, name);
        if (catKey && catKey !== 'GENERAL') {
          if (!categoryTotals[catKey]) {
            categoryTotals[catKey] = {
              categoryKey: catKey,
              totalQty: 0,
              materials: [],
              challanIds: new Set()
            };
          }
          categoryTotals[catKey].totalQty += qty;
          if (!categoryTotals[catKey].materials.includes(name)) {
            categoryTotals[catKey].materials.push(name);
          }
          categoryTotals[catKey].challanIds.add(l.id || 'Challan');
        }
      });
    });

    matchingExtraIssues.forEach(ex => {
      const chId = ex.slipNo || ex.id || 'Extra-Issue';
      challanIds.add(chId);
      const name = String(ex.materialName || ex.bomItemName || 'Material Item').trim();
      const qty = Number(ex.extraQty !== undefined ? ex.extraQty : (ex.qty !== undefined ? ex.qty : ex.quantity)) || 0;
      const rawUnit = String(ex.unit || 'Pcs').trim();
      const uUpper = rawUnit.toUpperCase();
      const isPc = uUpper === 'PCS' || uUpper === 'PC' || uUpper === 'PIECE' || uUpper === 'PIECES';
      const normUnit = isPc ? 'Pcs' : rawUnit;

      const catalog = findCatalogInfo(name, ex.materialId);
      const cat = String(ex.category || ex.componentType || ex.bomItemName || catalog.cat || 'EXTRA').trim();
      const rawCode = String(ex.itemCode || catalog.code || '').trim().toUpperCase();
      const code = rawCode.startsWith('MT') ? '' : rawCode;
      const itemCodeKey = code ? code : (ex.materialId ? String(ex.materialId) : name.toLowerCase());
      const key = `${itemCodeKey}___${normUnit.toLowerCase()}`;

      if (!matMap[key]) {
        matMap[key] = {
          key,
          materialId: ex.materialId || catalog.id || '',
          name,
          unit: normUnit,
          category: cat,
          itemCode: code,
          totalQty: 0,
          challans: []
        };
      }

      matMap[key].totalQty += qty;
      totalLineItems += 1;
      matMap[key].challans.push({
        id: chId,
        date: ex.date || ex.created_at || '',
        qty,
        unit: normUnit,
        issuer: ex.personName || ex.issuerName || 'Store',
        receiver: ex.receiverName || 'Cutting',
        receiverDept: ex.receiverDept || ''
      });

      // Group into category totals (e.g. for LABEL, TAG, ZIP, DORI, etc.)
      const catKey = normalizeCategoryKey(cat, name);
      if (catKey && catKey !== 'GENERAL') {
        if (!categoryTotals[catKey]) {
          categoryTotals[catKey] = {
            categoryKey: catKey,
            totalQty: 0,
            materials: [],
            challanIds: new Set()
          };
        }
        categoryTotals[catKey].totalQty += qty;
        if (!categoryTotals[catKey].materials.includes(name)) {
          categoryTotals[catKey].materials.push(name);
        }
        categoryTotals[catKey].challanIds.add(chId);
      }
    });

    const materialsList = Object.values(matMap);
    if (materialsList.length === 0 || materialsList.every(m => m.totalQty === 0)) {
      return null;
    }

    const totalIssuedQty = materialsList.reduce((sum, m) => sum + (Number(m.totalQty) || 0), 0);

    return {
      lotNo: rawInput,
      normLot: normTarget,
      totalChallans: challanIds.size,
      totalLineItems,
      totalIssuedQty,
      materials: materialsList,
      categoryTotals
    };
  }, [lotNo, issueLogs, rawWithoutBomLogs, dbExtraIssues, materials]);

  // Helper to determine previous issues for a specific material or component category under the current lot
  const getMaterialPriorIssueInfo = useCallback((matOrItem, currentRowId = null) => {
    const maxCutting = cuttingPieces > 0 ? cuttingPieces : 0;
    const maxAllowedTotal = defaultAutoIssueQty > 0 ? defaultAutoIssueQty : maxCutting;

    if (!matOrItem) {
      return {
        alreadyIssued: 0,
        isFullyIssued: false,
        remainingBase: maxCutting,
        allowedWith1Pct: maxAllowedTotal,
        challans: [],
        matchedPrior: null,
        isCategoryPooling: false,
        categoryKey: ''
      };
    }

    const rawCat = String(matOrItem.componentType || matOrItem.category || '').trim();
    const rawName = String(matOrItem.materialName || matOrItem.name || '').trim();
    const hasCategory = Boolean(rawCat);
    const hasMaterial = Boolean(rawName || matOrItem.materialId);

    // If user has not chosen either category or material yet, do NOT mark as prior issued
    if (!hasCategory && !hasMaterial) {
      return {
        alreadyIssued: 0,
        isFullyIssued: false,
        remainingBase: maxCutting,
        allowedWith1Pct: maxAllowedTotal,
        challans: [],
        matchedPrior: null,
        isCategoryPooling: false,
        categoryKey: ''
      };
    }

    const catKey = normalizeCategoryKey(rawCat, rawName);

    // 1. CATEGORY-WISE POOLING (e.g. for LABEL, TAG, ZIP, DORI, ELASTIC, BUTTON, etc.)
    // Mixed brands of the same category share the Lot cutting quota (e.g. 100 Addidas + 190 Polo = 290 Pcs issued)
    if (catKey && catKey !== 'GENERAL') {
      const catData = previouslyIssuedForCurrentLot?.categoryTotals?.[catKey];
      const categoryPriorQty = catData?.totalQty || 0;

      // Sum base quantities of OTHER rows in current items table with same catKey
      let currentOtherRowsQty = 0;
      if (Array.isArray(items)) {
        items.forEach(r => {
          if (currentRowId && String(r.id) === String(currentRowId)) return;
          const rCatKey = normalizeCategoryKey(r.componentType || r.category, r.materialName || r.name);
          if (rCatKey === catKey) {
            const rQty = (r.baseQty !== undefined && r.baseQty !== null && r.baseQty !== '')
              ? Number(r.baseQty)
              : 0;
            currentOtherRowsQty += rQty;
          }
        });
      }

      const totalCategoryIssued = categoryPriorQty + currentOtherRowsQty;
      const remainingBase = Math.max(0, maxCutting - totalCategoryIssued);
      const allowedWith1Pct = Math.max(0, maxAllowedTotal - totalCategoryIssued);
      const isFullyIssued = maxCutting > 0 && totalCategoryIssued >= maxCutting;

      return {
        isCategoryPooling: true,
        categoryKey: catKey,
        alreadyIssued: totalCategoryIssued,
        priorChallansQty: categoryPriorQty,
        currentOtherRowsQty,
        remainingBase,
        allowedWith1Pct,
        isFullyIssued,
        challans: catData ? Array.from(catData.challanIds || []) : [],
        categoryMaterials: catData?.materials || [],
        matchedPrior: catData || null
      };
    }

    // 2. STRICT INDIVIDUAL MATERIAL MATCH (fallback if item has no shared category like OTHER/GENERAL)
    if (!previouslyIssuedForCurrentLot || !Array.isArray(previouslyIssuedForCurrentLot.materials)) {
      return {
        alreadyIssued: 0,
        isFullyIssued: false,
        remainingBase: maxCutting,
        allowedWith1Pct: maxAllowedTotal,
        challans: [],
        matchedPrior: null,
        isCategoryPooling: false,
        categoryKey: ''
      };
    }

    const targetId = String(matOrItem.materialId || matOrItem.id || '').trim();
    const rawTargetCode = String(matOrItem.itemCode || matOrItem.stCode || matOrItem.code || '').trim().toUpperCase();
    const targetCode = rawTargetCode.startsWith('MT') ? '' : rawTargetCode;
    const targetName = String(rawName).toLowerCase();

    // STRICT MATCHING BY SAME ITEM CODE (or exact materialId, or exact full name if neither has an item code)
    const matched = previouslyIssuedForCurrentLot.materials.find(m => {
      const rawMCode = String(m.itemCode || '').trim().toUpperCase();
      const mCode = rawMCode.startsWith('MT') ? '' : rawMCode;
      const mId = String(m.materialId || '').trim();
      const mName = String(m.name || '').trim().toLowerCase();

      // 1. Strict Item Code match: if both have an official item code (e.g. ST00070 vs ST00010)
      if (targetCode && mCode) {
        return targetCode === mCode;
      }

      // 2. Strict Material ID match if IDs are present
      if (targetId && mId) {
        return targetId === mId;
      }

      // 3. Fallback to exact full name match ONLY if neither has an item code
      if (!targetCode && !mCode) {
        return targetName && mName && targetName === mName;
      }

      return false;
    });

    if (!matched || !matched.totalQty || matched.totalQty <= 0) {
      return {
        alreadyIssued: 0,
        isFullyIssued: false,
        remainingBase: maxCutting,
        allowedWith1Pct: maxAllowedTotal,
        challans: [],
        matchedPrior: null,
        isCategoryPooling: false,
        categoryKey: ''
      };
    }

    const alreadyIssued = Number(matched.totalQty) || 0;
    const remainingBase = Math.max(0, maxCutting - alreadyIssued);
    const allowedWith1Pct = Math.max(0, maxAllowedTotal - alreadyIssued);
    const isFullyIssued = maxCutting > 0 && alreadyIssued >= maxCutting;

    return {
      alreadyIssued,
      isFullyIssued,
      remainingBase,
      allowedWith1Pct,
      challans: matched.challans || [],
      matchedPrior: matched,
      isCategoryPooling: false,
      categoryKey: ''
    };
  }, [previouslyIssuedForCurrentLot, cuttingPieces, defaultAutoIssueQty, items]);

  // Automatically update base quantity when lot number changes or cutting quantity resolves with 1% extra
  useEffect(() => {
    const cleanLot = String(lotNo || '').trim().toLowerCase();
    const prevCleanLot = String(prevLotNoRef.current || '').trim().toLowerCase();
    const lotChanged = cleanLot !== prevCleanLot;
    const qtyChanged = defaultAutoIssueQty !== prevDefaultQtyRef.current;

    prevLotNoRef.current = lotNo;
    prevDefaultQtyRef.current = defaultAutoIssueQty;

    // When lot number changes or cutting quantity updates:
    if (lotChanged || qtyChanged) {
      setItems(prev => {
        const runningCatIssued = {};
        return prev.map(item => {
          let targetBase = defaultAutoIssueQty > 0 ? defaultAutoIssueQty : 1;
          const catKey = normalizeCategoryKey(item.componentType || item.category, item.materialName || item.name);

          if (catKey) {
            const priorCatQty = previouslyIssuedForCurrentLot?.categoryTotals?.[catKey]?.totalQty || 0;
            const currentCatAllocated = runningCatIssued[catKey] || 0;
            const totalCatIssued = priorCatQty + currentCatAllocated;
            const remBase = Math.max(0, (cuttingPieces || 0) - totalCatIssued);
            const isFull = cuttingPieces > 0 && totalCatIssued >= cuttingPieces;

            if (totalCatIssued > 0) {
              targetBase = isFull ? 0 : remBase;
            }
            runningCatIssued[catKey] = (runningCatIssued[catKey] || 0) + targetBase;
          } else if (item.materialId || item.materialName) {
            const prior = getMaterialPriorIssueInfo(item, item.id);
            if (prior.alreadyIssued > 0) {
              targetBase = prior.isFullyIssued ? 0 : prior.remainingBase;
            }
          }
          const { factor } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
          const total = Math.ceil(targetBase * factor);
          return {
            ...item,
            baseQty: targetBase,
            totalQty: total > 0 ? total : (targetBase === 0 ? 0 : 1)
          };
        });
      });
    }
  }, [lotNo, defaultAutoIssueQty, previouslyIssuedForCurrentLot, getMaterialPriorIssueInfo, cuttingPieces]);

  // Distinct categories available in Without-BOM logs + count of challans having them
  const availableHistoryCategories = useMemo(() => {
    const counts = {};
    // Seed default common categories
    ['TAG', 'LABEL', 'DORI', 'ZIP', 'ELASTIC', 'BUTTON', 'OTHER ACCESSORIES'].forEach(c => { counts[c] = 0; });

    rawWithoutBomLogs.forEach(l => {
      const seenInThisLog = new Set();
      (l.materials || []).forEach(m => {
        const cat = getMaterialCategory(m);
        if (cat && typeof cat === 'string' && cat.trim()) {
          seenInThisLog.add(cat.trim().toUpperCase());
        }
      });
      if (l.category && typeof l.category === 'string' && l.category.trim() && !l.category.toUpperCase().includes('WITHOUT BOM')) {
        seenInThisLog.add(l.category.trim().toUpperCase());
      }
      seenInThisLog.forEach(cat => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });

    return Object.keys(counts)
      .filter(Boolean)
      .sort((a, b) => {
        if ((counts[b] > 0) !== (counts[a] > 0)) {
          return counts[b] > 0 ? 1 : -1;
        }
        return a.localeCompare(b);
      })
      .map(name => ({ name, count: counts[name] || 0 }));
  }, [rawWithoutBomLogs, materials]);

  // Filtered categories for category dropdown menu search
  const filteredCategoryOptions = useMemo(() => {
    if (!categorySearchTerm.trim()) return availableHistoryCategories;
    const term = categorySearchTerm.trim().toLowerCase();
    return availableHistoryCategories.filter(c => c.name.toLowerCase().includes(term));
  }, [availableHistoryCategories, categorySearchTerm]);

  // Distinct issuers & receivers for person filter with challan count
  const availablePeople = useMemo(() => {
    const issuerCounts = {};
    const receiverCounts = {};
    rawWithoutBomLogs.forEach(l => {
      const iss = l.personName && typeof l.personName === 'string' ? l.personName.trim() : '';
      if (iss) {
        issuerCounts[iss] = (issuerCounts[iss] || 0) + 1;
      }
      const rec = l.receiverName && typeof l.receiverName === 'string' ? l.receiverName.trim() : '';
      if (rec) {
        receiverCounts[rec] = (receiverCounts[rec] || 0) + 1;
      }
    });

    const issuers = Object.keys(issuerCounts)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({ key: `iss:${name}`, name, role: 'Store', count: issuerCounts[name] }));

    const receivers = Object.keys(receiverCounts)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({ key: `rec:${name}`, name, role: 'Floor', count: receiverCounts[name] }));

    return {
      issuers,
      receivers,
      total: issuers.length + receivers.length
    };
  }, [rawWithoutBomLogs]);

  // Filtered issuers & receivers for person dropdown search
  const filteredPeople = useMemo(() => {
    if (!personSearchTerm.trim()) return availablePeople;
    const term = personSearchTerm.trim().toLowerCase();
    return {
      issuers: availablePeople.issuers.filter(p => p.name.toLowerCase().includes(term) || `store: ${p.name}`.toLowerCase().includes(term)),
      receivers: availablePeople.receivers.filter(p => p.name.toLowerCase().includes(term) || `floor: ${p.name}`.toLowerCase().includes(term)),
      total: availablePeople.total
    };
  }, [availablePeople, personSearchTerm]);

  // Filtered without-bom issue logs based on search, dates, multi-select categories, and multi-select persons
  const withoutBomLogs = useMemo(() => {
    const list = rawWithoutBomLogs.filter(l => {
      // 1. Date Range Filter
      if (historyDateFrom || historyDateTo) {
        const logDateYmd = parseLogDateToYmd(l.date);
        if (!logDateYmd) return false;
        if (historyDateFrom && logDateYmd < historyDateFrom) return false;
        if (historyDateTo && logDateYmd > historyDateTo) return false;
      }

      // 2. Category Multi-Select Filter (user can pick 2-3+ categories at once)
      if (historyCategories.length > 0) {
        const hasMatchingCat = (l.materials || []).some(m => {
          const cat = (getMaterialCategory(m) || '').trim().toUpperCase();
          return historyCategories.some(sel => {
            const selUpper = sel.trim().toUpperCase();
            return cat === selUpper || cat.includes(selUpper) || selUpper.includes(cat);
          });
        }) || (l.category && historyCategories.some(sel => String(l.category).toUpperCase().includes(sel.toUpperCase())));

        if (!hasMatchingCat) return false;
      }

      // 3. Person Wise Multi-Select Filter (Store Issuer or Floor Receiver)
      if (historyPersons.length > 0) {
        const matchesAnyPerson = historyPersons.some(hp => {
          if (hp.startsWith('iss:')) {
            const target = hp.replace('iss:', '').trim().toLowerCase();
            return String(l.personName || '').trim().toLowerCase() === target;
          } else if (hp.startsWith('rec:')) {
            const target = hp.replace('rec:', '').trim().toLowerCase();
            return String(l.receiverName || '').trim().toLowerCase().includes(target);
          } else {
            const target = hp.trim().toLowerCase();
            const issMatch = String(l.personName || '').trim().toLowerCase().includes(target);
            const recMatch = String(l.receiverName || '').trim().toLowerCase().includes(target);
            return issMatch || recMatch;
          }
        });
        if (!matchesAnyPerson) return false;
      }

      // 4. Free text search
      if (historySearch) {
        const q = historySearch.toLowerCase();
        const matches = (
          String(l.id || '').toLowerCase().includes(q) ||
          String(l.lotId || '').toLowerCase().includes(q) ||
          String(l.brand || l.brandName || '').toLowerCase().includes(q) ||
          String(l.receiverName || '').toLowerCase().includes(q) ||
          String(l.receiverDept || '').toLowerCase().includes(q) ||
          String(l.personName || '').toLowerCase().includes(q) ||
          String(l.category || '').toLowerCase().includes(q) ||
          (l.materials || []).some(m => String(m.name || m.bomItemName || '').toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      return true;
    });

    // Sort descending: Latest Date / Time and highest sequential Challan Number at the top
    return list.sort((a, b) => {
      const timeA = getLogTimestamp(a);
      const timeB = getLogTimestamp(b);
      if (timeA !== timeB) return timeB - timeA;
      const numA = parseInt(String(a.id || '').replace(/^[A-Z-]+/i, ''), 10) || 0;
      const numB = parseInt(String(b.id || '').replace(/^[A-Z-]+/i, ''), 10) || 0;
      if (numA !== numB) return numB - numA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [rawWithoutBomLogs, historyDateFrom, historyDateTo, historyCategories, historyPersons, historySearch, materials]);

  // Total active filter criteria count
  const activeFiltersCount = (historyDateFrom ? 1 : 0) +
    (historyDateTo ? 1 : 0) +
    (historyCategories.length > 0 ? historyCategories.length : 0) +
    (historyPersons.length > 0 ? historyPersons.length : 0) +
    (historySearch ? 1 : 0);

  // Reset pagination to first page when any filter changes
  useEffect(() => {
    setHistoryCurrentPage(1);
  }, [historySearch, historyDateFrom, historyDateTo, historyCategories, historyPersons]);

  const totalHistoryCount = withoutBomLogs.length;
  const totalPages = useMemo(() => {
    if (historyPageSize === 'all' || !historyPageSize) return 1;
    return Math.max(1, Math.ceil(totalHistoryCount / Number(historyPageSize)));
  }, [totalHistoryCount, historyPageSize]);

  // Safe page index within bounds
  const safeCurrentPage = Math.min(Math.max(1, historyCurrentPage), totalPages);

  // Paginated logs slice
  const paginatedLogs = useMemo(() => {
    if (historyPageSize === 'all' || !historyPageSize) {
      return withoutBomLogs;
    }
    const size = Number(historyPageSize);
    const start = (safeCurrentPage - 1) * size;
    return withoutBomLogs.slice(start, start + size);
  }, [withoutBomLogs, safeCurrentPage, historyPageSize]);

  // Base default accessory component types
  const BASE_COMPONENT_TYPES = useMemo(() => ['DORI', 'ELASTIC', 'ZIP'], []);

  // Custom accessory component types persisted in localStorage
  const [customComponentTypes, setCustomComponentTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('without_bom_custom_component_types');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim().toUpperCase()).filter(Boolean);
      }
    } catch (e) {
      console.error('Failed to load custom component types', e);
    }
    return [];
  });

  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [newTypeNameInput, setNewTypeNameInput] = useState('');

  // Persist custom types whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('without_bom_custom_component_types', JSON.stringify(customComponentTypes));
    } catch (e) { }
  }, [customComponentTypes]);

  // Helper to add a custom component type into list
  const addCustomComponentType = (rawName) => {
    if (!rawName) return '';
    const clean = String(rawName).trim().toUpperCase();
    if (!clean || clean === '__CUSTOM__' || clean === '__MANAGE__') return '';

    const existsInBase = BASE_COMPONENT_TYPES.some(t => t.toUpperCase() === clean);
    const existsInCustom = customComponentTypes.some(t => t.toUpperCase() === clean);

    if (!existsInBase && !existsInCustom) {
      setCustomComponentTypes(prev => {
        const updated = [...prev, clean];
        try {
          localStorage.setItem('without_bom_custom_component_types', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });
    }
    return clean;
  };

  // Helper to remove a custom component type from list
  const removeCustomComponentType = (typeToRemove) => {
    setCustomComponentTypes(prev => {
      const updated = prev.filter(t => t.toUpperCase() !== String(typeToRemove).toUpperCase());
      try {
        localStorage.setItem('without_bom_custom_component_types', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  // Unified list of all types: 1. DORI, 2. ELASTIC, 3. ZIP, 4. [CUSTOM 1], ...
  const allComponentTypes = useMemo(() => {
    const list = [...BASE_COMPONENT_TYPES];
    customComponentTypes.forEach(t => {
      const clean = String(t).trim().toUpperCase();
      if (clean && !list.includes(clean)) {
        list.push(clean);
      }
    });
    return list;
  }, [BASE_COMPONENT_TYPES, customComponentTypes]);

  // Dropdown options
  const componentTypeOptions = useMemo(() => {
    const opts = [{ value: '', label: '-- Select Component --' }, ...allComponentTypes.map((type, idx) => ({
      value: type,
      label: `${idx + 1}. ${type}`
    }))];
    opts.push({ value: '__custom__', label: '✏️ + Add Manually (Custom Type)' });
    if (customComponentTypes.length > 0) {
      opts.push({ value: '__manage__', label: `⚙️ Manage Types (${customComponentTypes.length})...` });
    }
    return opts;
  }, [allComponentTypes, customComponentTypes]);

  // Commit custom type entered in a row input
  const commitCustomType = (rowId, rawVal) => {
    const clean = String(rawVal || '').trim().toUpperCase();
    if (!clean) {
      setItems(prev => prev.map(item => {
        if (item.id !== rowId) return item;
        return {
          ...item,
          isCustomType: false,
          customComponentType: '',
          componentType: item.componentType && item.componentType !== '__custom__' ? item.componentType : (allComponentTypes[0] || 'DORI')
        };
      }));
      return;
    }

    addCustomComponentType(clean);

    setItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return {
        ...item,
        isCustomType: false,
        customComponentType: clean,
        componentType: clean,
        unit: (clean === 'DORI' || clean === 'ELASTIC') ? (item.unit || 'Mtr') : (item.unit || 'Pcs')
      };
    }));
  };

  // Quick department choices
  const commonDepts = ['Cutting', 'Stitching', 'Finishing', 'Packing', 'Sampling', 'Main Store'];

  // Add Item Row
  const handleAddItemRow = (compType = '', defaultMaterialId = '', entryMode = 'choose') => {
    const mat = defaultMaterialId ? materials.find(m => String(m.id) === String(defaultMaterialId)) : null;
    let defUnit = 'Pcs';
    if (compType === 'DORI' || compType === 'ELASTIC') defUnit = 'Mtr';
    else if (compType === 'ZIP') defUnit = 'Pcs';

    setItems(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        componentType: compType,
        customComponentType: '',
        isCustomType: false,
        entryMode: entryMode, // 'choose' | 'manual'
        materialId: mat ? mat.id : '',
        materialName: mat ? mat.name : (entryMode === 'manual' ? (compType ? `${compType} Item` : 'Custom Item') : ''),
        itemCode: mat ? getItemCodeDisplay(mat) : '',
        imageUrl: mat ? (mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '') : '',
        color: mat ? (mat.color || mat.shade || '') : '',
        unit: mat ? (mat.unit || defUnit) : defUnit,
        availableStock: mat ? (Number(mat.stock) || 0) : 0,
        location: mat ? (mat.location || mat.warehouseLocation || 'Main Store') : (entryMode === 'manual' ? 'Custom Entry' : ''),
        multiplier: 1,
        multiplierOp: 'multiply',
        baseQty: defaultAutoIssueQty > 0 ? defaultAutoIssueQty : 1,
        calcMode: 'multiplier',
        perPcReq: 0,
        totalQty: mat ? ((Number(mat.stock) || 0) > 0 ? (defaultAutoIssueQty > 0 ? Math.min(defaultAutoIssueQty, Number(mat.stock)) : 1) : 0) : (defaultAutoIssueQty > 0 ? defaultAutoIssueQty : 1)
      }
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (id) => {
    if (items.length <= 1) {
      setFormError('At least one material item is required to issue.');
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Update Item Row Field
  const handleUpdateItem = (id, fieldOrObj, value) => {
    const field = typeof fieldOrObj === 'string' ? fieldOrObj : null;
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      let updated;
      if (typeof fieldOrObj === 'object' && fieldOrObj !== null) {
        updated = { ...item, ...fieldOrObj };
      } else {
        updated = { ...item, [fieldOrObj]: value };
      }

      const isBaseUpdate = field === 'baseQty' || (typeof fieldOrObj === 'object' && 'baseQty' in fieldOrObj);
      const isMultUpdate = field === 'multiplier' || (typeof fieldOrObj === 'object' && 'multiplier' in fieldOrObj);
      const isMultOpUpdate = field === 'multiplierOp' || (typeof fieldOrObj === 'object' && 'multiplierOp' in fieldOrObj);
      const isQtyUpdate = field === 'totalQty' || (typeof fieldOrObj === 'object' && 'totalQty' in fieldOrObj);

      if (isBaseUpdate) {
        const rawBase = parseFloat(updated.baseQty);
        const base = (!isNaN(rawBase) && rawBase >= 0) ? rawBase : (cuttingPieces > 0 ? defaultAutoIssueQty : 1);
        updated.baseQty = base;
        const { factor } = computeEffectiveFactor(updated.multiplier, updated.multiplierOp);
        const total = Math.ceil(base * factor);
        updated.totalQty = total > 0 ? total : (base === 0 ? 0 : 1);
      } else if (isMultUpdate || isMultOpUpdate) {
        const base = (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '')
          ? (parseFloat(item.baseQty) || 0)
          : (cuttingPieces > 0 ? defaultAutoIssueQty : 1);
        updated.baseQty = base;
        const { factor } = computeEffectiveFactor(updated.multiplier, updated.multiplierOp);
        const total = Math.ceil(base * factor);
        updated.totalQty = total > 0 ? total : (base === 0 ? 0 : 1);
      } else if (isQtyUpdate) {
        const rawQ = parseFloat(updated.totalQty !== undefined ? updated.totalQty : value) || 0;
        const qVal = Math.ceil(rawQ);
        updated.totalQty = qVal;
        const base = (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '')
          ? (parseFloat(item.baseQty) || 0)
          : (cuttingPieces > 0 ? defaultAutoIssueQty : 1);
        if (base > 0 && qVal > 0) {
          if (updated.multiplierOp === 'divide') {
            const newDiv = Math.round((base / qVal) * 100) / 100;
            if (newDiv > 0) updated.multiplier = newDiv;
          } else {
            const newM = Math.round((qVal / base) * 100) / 100;
            if (newM > 0) updated.multiplier = newM;
          }
        }
      }

      return updated;
    }));
  };
  // Recalculate all per_piece items when pieces count changes
  useEffect(() => {
    if (issueMode === 'floor_lot') {
      setItems(prev => prev.map(item => {
        if (item.calcMode === 'per_piece') {
          const perPc = parseFloat(item.perPcReq) || 0;
          const total = Math.round(perPc * (parseInt(pieces, 10) || 1) * 100) / 100;
          return { ...item, totalQty: total > 0 ? total : 1 };
        } else if (item.calcMode === 'multiplier') {
          const { factor } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
          const base = defaultAutoIssueQty > 0 ? defaultAutoIssueQty : (parseInt(pieces, 10) || 1);
          const total = Math.round(base * factor * 100) / 100;
          return { ...item, baseQty: base, totalQty: total > 0 ? total : 1 };
        }
        return item;
      }));
    }
  }, [pieces, issueMode, defaultAutoIssueQty]);

  // Handle Material Selection for a Row
  const handleSelectMaterial = (rowId, materialId) => {
    const mat = (materials || []).find(m => String(m.id) === String(materialId));
    setItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      if (!mat) {
        return {
          ...item,
          materialId: '',
          materialName: '',
          itemCode: '',
          imageUrl: '',
          color: '',
          unit: 'Pcs',
          availableStock: 0,
          location: ''
        };
      }
      const rackStock = Number(mat.stock) || 0;
      const codeDisp = getItemCodeDisplay(mat, materials);

      // Check prior issues for this material in the lot
      const prior = getMaterialPriorIssueInfo({
        materialId: mat.id,
        name: mat.name,
        itemCode: codeDisp,
        category: item.componentType || mat.category
      }, item.id);

      let base;
      if (prior.alreadyIssued > 0) {
        if (prior.isFullyIssued) {
          // If already fully issued with 1% variance
          base = 0;
        } else {
          // If partially issued, e.g. 200 of 1000 issued -> default to remaining base 800
          base = prior.remainingBase;
        }
      } else {
        base = (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '' && item.baseQty !== 0)
          ? Number(item.baseQty)
          : (defaultAutoIssueQty > 0 ? defaultAutoIssueQty : 1);
      }

      const { factor: mult } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
      const desiredTotal = Math.ceil(base * mult);
      const initialTotal = rackStock > 0 ? Math.min(desiredTotal, rackStock) : (rackStock === 0 ? 0 : desiredTotal);

      return {
        ...item,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: codeDisp,
        imageUrl: mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '',
        color: mat.color || mat.shade || '',
        unit: mat.unit || 'Pcs',
        availableStock: rackStock,
        baseQty: base,
        totalQty: initialTotal,
        location: mat.location || mat.warehouseLocation || 'Main Store',
        componentType: item.componentType || (() => {
          const catUpper = String(mat.category || '').toUpperCase();
          if (catUpper.includes('ELASTIC')) return 'ELASTIC';
          if (catUpper.includes('ZIP')) return 'ZIP';
          if (catUpper.includes('BUTTON')) return 'BUTTON';
          if (catUpper.includes('TAG')) return 'TAG';
          if (catUpper.includes('LABEL')) return 'LABEL';
          if (catUpper.includes('DORI')) return 'DORI';
          return catUpper || 'OTHER ACCESSORIES';
        })()
      };
    }));
  };

  // Barcode Scan Handler
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const query = barcodeInput.trim().toLowerCase();
    if (!query) return;

    const matched = (materials || []).find(m =>
      String(m.id || '').toLowerCase() === query ||
      String(m.barcode || '').toLowerCase() === query ||
      String(m.itemCode || '').toLowerCase() === query ||
      String(m.stCode || '').toLowerCase() === query
    );

    if (matched) {
      const codeDisp = getItemCodeDisplay(matched);
      const emptyRow = items.find(i => !i.materialId);
      if (emptyRow) {
        handleSelectMaterial(emptyRow.id, matched.id);
      } else {
        const newId = Date.now() + Math.random();
        const catUpper = String(matched.category || '').toUpperCase();
        const inferredType = catUpper.includes('ELASTIC') ? 'ELASTIC' : catUpper.includes('ZIP') ? 'ZIP' : 'DORI';
        setItems(prev => [
          ...prev,
          {
            id: newId,
            componentType: inferredType,
            customComponentType: '',
            isCustomType: false,
            entryMode: 'choose',
            materialId: matched.id,
            materialName: matched.name,
            itemCode: codeDisp,
            imageUrl: matched.imageUrl || matched.image || matched.photo || matched.imgUrl || '',
            color: matched.color || '',
            unit: matched.unit || (inferredType === 'ZIP' ? 'Pcs' : 'Mtr'),
            availableStock: Number(matched.stock) || 0,
            location: matched.location || 'Main Store',
            multiplier: 1,
            baseQty: defaultAutoIssueQty > 0 ? (Number(matched.stock) > 0 ? Math.min(defaultAutoIssueQty, Number(matched.stock)) : 1) : 1,
            calcMode: 'multiplier',
            perPcReq: 0,
            totalQty: Number(matched.stock) > 0 ? (defaultAutoIssueQty > 0 ? Math.min(defaultAutoIssueQty, Number(matched.stock)) : 1) : 0
          }
        ]);
      }
      playFeedbackSound('scan');
      setFormSuccess(`Scanned & Added: ${matched.name}${codeDisp ? ` [${codeDisp}]` : ''}`);
      setTimeout(() => setFormSuccess(''), 3000);
      setBarcodeInput('');
    } else {
      playFeedbackSound('error');
      setFormError(`Barcode / Item "${barcodeInput}" not found in inventory.`);
      setTimeout(() => setFormError(''), 4000);
    }
  };

  // Generate Official PDF Document
  const generatePDFVoucher = (issueData) => {
    const cleanLot = String(issueData?.lotId || '').replace(/^LOT\s*#?/i, '').trim().toLowerCase();
    const isDirect = issueData?.issueMode === 'item_only' || !cleanLot ||
      cleanLot === 'direct-item' ||
      cleanLot === 'w/o lot' ||
      cleanLot === 'without lot' ||
      cleanLot === 'no lot' ||
      cleanLot === 'none' ||
      cleanLot === 'n/a' ||
      cleanLot.includes('direct') ||
      cleanLot.includes('w/o') ||
      cleanLot.includes('without') ||
      cleanLot.includes('no lot');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const im = 14;
    const iw = pw - im * 2;

    // Header Banner (Clean Black & White Normal)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('MOHIT HOSIERY • QUALITY & PRODUCTION MANAGEMENT', pw / 2, 10, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text('CENTRAL STORE INVENTORY & MATERIAL ALLOCATION SYSTEM', pw / 2, 16, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('MATERIAL ISSUE WITHOUT BOM (OFFICIAL STORE BILL)', pw / 2, 22, { align: 'center' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(im, 24, pw - im, 24);

    // Title Tag
    let y = 31;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const modeTitle = isDirect ? 'MATERIAL ISSUE WITHOUT BOM (WITHOUT LOT)' : `MATERIAL ISSUE WITHOUT BOM (LOT #${issueData.lotId})`;
    doc.text(modeTitle, im, y);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL COPY', pw - im, y, { align: 'right' });

    // Batch & Info Card (Clean Normal B&W)
    y += 4;
    const cardH = 34;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(im, y, iw, cardH, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);

    // Row 1
    doc.setFont('helvetica', 'bold');
    doc.text('Challan / Bill No:', im + 4, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(issueData.voucherId, im + 32, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Issue Date:', im + 72, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(issueData.date, im + 90, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Lot / Brand:', im + 128, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const lotBrandText = isDirect
      ? 'WITHOUT LOT REQUISITION'
      : (issueData.brandName || issueData.brand)
        ? `LOT #${issueData.lotId} (${issueData.brandName || issueData.brand})`
        : `LOT #${issueData.lotId}`;
    doc.text(lotBrandText, im + 148, y + 8);

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Type:', im + 4, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(issueData.style || (isDirect ? 'Store Item Requisition' : 'Floor Issue'), im + 26, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.text('Batch Volume:', im + 72, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(isDirect ? 'Direct Store Issue (No Lot Cutting)' : `${(issueData.pieces || 0).toLocaleString()} Garment Pieces`, im + 95, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.text('Status:', im + 128, y + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('[ REAL STOCK DEDUCTED ]', im + 142, y + 17);
    doc.setTextColor(15, 23, 42);

    // Row 3
    doc.setFont('helvetica', 'bold');
    doc.text('Issued By:', im + 4, y + 26);
    doc.setFont('helvetica', 'normal');
    doc.text(issueData.personName || 'Store In-charge', im + 24, y + 26);

    doc.setFont('helvetica', 'bold');
    doc.text('Received By:', im + 72, y + 26);
    doc.setFont('helvetica', 'normal');
    doc.text(`${issueData.receiverName || 'Floor Master'} (${issueData.receiverDept || 'Cutting'})`, im + 94, y + 26);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Items:', im + 128, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(issueData.items || []).length} Materials Issued`, im + 148, y + 26);

    // Materials Table
    const tableRows = (issueData.items || []).map((item, idx) => {
      const c = getItemCodeDisplay(item, materials) || (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '');
      const mult = Number(item.multiplier) || 1;
      const multSuffix = mult > 1 ? ` (×${mult} Multiplier)` : '';
      const desc = (c ? `[${c}] ${item.materialName || 'Material Item'}` : (item.materialName || 'Material Item')) + multSuffix;
      return [
        idx + 1,
        item.componentType || 'Accessory',
        desc,
        item.color || 'Standard',
        item.location || 'Main Store',
        `${item.availableStock !== undefined ? item.availableStock : '—'} ${item.unit || ''}`,
        `${item.totalQty} ${item.unit || ''}${mult > 1 ? ` (×${mult})` : ''}`,
        `${item.availableStock !== undefined ? Math.max(0, item.availableStock - item.totalQty).toFixed(2) : '—'} ${item.unit || ''}`
      ];
    });

    autoTable(doc, {
      startY: y + cardH + 5,
      head: [['#', 'Component', 'Material Description & Code', 'Shade/Color', 'Rack Location', 'Prev Stock', 'Issued Qty', 'Remaining Balance']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [234, 88, 12],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 48 },
        3: { cellWidth: 20 },
        4: { cellWidth: 24 },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [234, 88, 12] },
        7: { cellWidth: 18, halign: 'right', textColor: [100, 116, 139] }
      }
    });

    let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 140) + 8;

    // Remarks Note
    if (issueData.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Remarks / Allocation Notes:', im, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(issueData.remarks, im + 44, currentY);
      currentY += 8;
    }

    // Verification & Signatures Boxes (3 Signature boxes)
    const sigBoxW = (iw - 16) / 3;
    const sigBoxH = 26;

    // Box 1: Store Staff
    doc.setDrawColor(203, 213, 225);
    doc.rect(im, currentY, sigBoxW, sigBoxH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ISSUED BY (STORE STAFF)', im + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${issueData.personName || 'Store In-charge'}`, im + 4, currentY + 13);
    doc.text('Sign: ____________________', im + 4, currentY + 21);

    // Box 2: Receiver
    const x2 = im + sigBoxW + 8;
    doc.rect(x2, currentY, sigBoxW, sigBoxH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('RECEIVED BY (CUTTING / TAILOR)', x2 + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${issueData.receiverName || 'Floor Master'}`, x2 + 4, currentY + 13);
    doc.text('Sign: ____________________', x2 + 4, currentY + 21);

    // Box 3: Supervisor Approval
    const x3 = x2 + sigBoxW + 8;
    doc.rect(x3, currentY, sigBoxW, sigBoxH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('SUPERVISOR / AUTHORIZED', x3 + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Sign / Stamp: ______________', x3 + 4, currentY + 13);
    doc.text('Date: ____________________', x3 + 4, currentY + 21);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Material Issue Without BOM • Official Store Challan & Inventory Voucher • Mohit Hosiery Central Store', pw / 2, ph - 8, { align: 'center' });

    return doc;
  };

  // Extract issueData payload from current form fields
  const buildIssueDataFromForm = () => {
    if (!lotNo.trim()) {
      setFormError('Please enter or select a Lot Number. Lot Number is required to issue materials.');
      playFeedbackSound('error');
      return null;
    }

    const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
    if (validItems.length === 0) {
      setFormError('Please select at least one material item with an issue quantity greater than 0.');
      playFeedbackSound('error');
      return null;
    }

    const effectiveLot = lotNo.trim();
    const voucherId = nextVoucherId;
    const formattedDate = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    return {
      voucherId,
      date: formattedDate,
      issueMode,
      lotId: effectiveLot,
      brand: brandName.trim(),
      brandName: brandName.trim(),
      style: styleName || (issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Issue'),
      pieces: issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
      cuttingPieces: cuttingPieces || (parseInt(pieces, 10) > 1 ? parseInt(pieces, 10) : 0),
      onePercentAllowance: onePercentAllowance || 0,
      defaultAutoIssueQty: defaultAutoIssueQty || 0,
      personName: personName.trim() || 'Store In-charge',
      receiverName: receiverName.trim() || 'Floor Master',
      receiverDept: receiverDept.trim() || 'Cutting',
      remarks: remarks.trim(),
      items: validItems.map(i => {
        const effectiveType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
        const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
        return {
          ...i,
          componentType: effectiveType,
          materialName: effectiveName,
          multiplier: i.multiplier ? Number(i.multiplier) : 1,
          calcMode: i.calcMode || 'direct'
        };
      })
    };
  };

  // Preview Challan without submitting
  const handlePreviewOnly = () => {
    setFormError('');
    const issueData = buildIssueDataFromForm();
    if (!issueData) return;

    try {
      const doc = generatePDFVoucher(issueData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPreviewModal({ doc, pdfUrl, voucherId: issueData.voucherId, issueData, isPreviewOnly: true });
    } catch (err) {
      setFormError('Failed to generate preview: ' + err.message);
    }
  };

  // Helper to execute confirmed material issue and stock deduction
  const executeConfirmedIssue = async (isAdminOverride = false) => {
    const effectiveLot = lotNo.trim();
    const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);

    // Strict stock verification against store rack inventory - STRICT BLOCKING
    const shortageItems = validItems.filter(i => {
      if (!i.materialId || i.entryMode === 'manual') return false;
      const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
      const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(i.availableStock) || 0);
      return Number(i.totalQty) > rackStock;
    });

    if (shortageItems.length > 0) {
      const errorDetails = shortageItems.map(s => {
        const liveMat = (materials || []).find(m => String(m.id) === String(s.materialId));
        const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(s.availableStock) || 0);
        return `• "${s.materialName}" [${s.itemCode || 'ST'}] (Rack: ${s.location || 'Store'}): Available in Rack = ${rackStock} ${s.unit}, Attempted Issue = ${s.totalQty} ${s.unit}`;
      }).join('\n');

      const msg = `⛔ CANNOT ISSUE — INSUFFICIENT STORE RACK STOCK!\n\nStore rack me utna stock available nahi hai:\n${errorDetails}\n\nNegative stock issue karna strictly blocked hai. Please issue quantity ko rack stock ke barabar ya kam karein.`;
      setFormError(msg);
      playFeedbackSound('error');
      alert(msg);
      return;
    }

    setSubmitting(true);
    try {
      const voucherId = nextVoucherId;
      const formattedDate = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      // Transform items for handleIssueMaterials
      const issuedItemsPayload = validItems.map(i => {
        const effectiveType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
        const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
        const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
        return {
          materialId: i.materialId || '',
          materialName: effectiveName,
          multiplier: i.multiplier ? Number(i.multiplier) : 1,
          calcMode: i.calcMode || 'direct',
          bomItemName: effectiveType,
          totalRequired: Number(i.totalQty),
          unit: i.unit || 'Pcs',
          itemCode: getItemCodeDisplay(i, materials) || (i.itemCode && !i.itemCode.toUpperCase().startsWith('ITM-') ? i.itemCode : '') || (i.entryMode === 'manual' ? 'MANUAL' : ''),
          color: i.color || '',
          availableStock: i.availableStock || 0,
          location: i.location || (i.entryMode === 'manual' ? 'Custom Entry' : ''),
          imageUrl: i.imageUrl || (liveMat ? (liveMat.imageUrl || liveMat.image || liveMat.photo || liveMat.imgUrl || '') : '') || '',
          multiplier: i.multiplier ? Number(i.multiplier) : 1,
          calcMode: i.calcMode || 'direct'
        };
      });

      // Call parent handleIssueMaterials (isWithoutBom = true, customId = voucherId)
      if (typeof onIssueMaterials === 'function') {
        await onIssueMaterials(
          effectiveLot,
          issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
          issuedItemsPayload,
          false, // isReissue
          personName.trim(),
          receiverName.trim(),
          receiverDept.trim(),
          true, // isWithoutBom
          voucherId, // customId
          remarks.trim() // remarks
        );
      }

      // Prepare issue Data
      const issueData = {
        voucherId,
        date: formattedDate,
        issueMode,
        lotId: effectiveLot,
        brand: brandName.trim(),
        brandName: brandName.trim(),
        style: styleName || (issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Issue'),
        pieces: issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
        cuttingPieces: cuttingPieces || (parseInt(pieces, 10) > 1 ? parseInt(pieces, 10) : 0),
        onePercentAllowance: onePercentAllowance || 0,
        defaultAutoIssueQty: defaultAutoIssueQty || 0,
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim(),
        remarks: remarks.trim() + (isAdminOverride ? ' [Admin Approved Excess Over 1%]' : ''),
        items: validItems.map(i => {
          const rawType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
          if (rawType && rawType !== 'Custom Accessory') {
            addCustomComponentType(rawType);
          }
          const effectiveType = rawType;
          const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
          const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
          const { factor } = computeEffectiveFactor(i.multiplier, i.multiplierOp);
          return {
            ...i,
            componentType: effectiveType,
            materialName: effectiveName,
            multiplier: factor,
            multiplierStr: String(i.multiplier || 1),
            multiplierOp: i.multiplierOp || 'multiply',
            calcMode: i.calcMode || 'multiplier',
            imageUrl: i.imageUrl || (liveMat ? (liveMat.imageUrl || liveMat.image || liveMat.photo || liveMat.imgUrl || '') : '') || '',
            itemCode: getItemCodeDisplay(i, materials) || (i.itemCode && !i.itemCode.toUpperCase().startsWith('ITM-') ? i.itemCode : '') || (i.entryMode === 'manual' ? 'MANUAL' : '')
          };
        })
      };

      // Generate PDF Document
      const doc = generatePDFVoucher(issueData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      playFeedbackSound('success');

      // Do NOT block screen with preview modal on confirm; keep the reset form visible for the next bill
      setPreviewModal(null);
      setFormError('');
      setFormSuccess(`✓ Bill #${voucherId} (Lot #${effectiveLot}${brandName ? ` • ${brandName}` : ''}) confirmed & stock deducted. Printing window opened. Form is reset & ready for next bill.`);

      // Automatically launch the printing window directly
      setTimeout(() => {
        handleDirectPrintWindow(issueData, voucherId);
      }, 100);

      // Process complete: refill and reset all columns/inputs back to clean state for next bill
      handleResetForm();

      // Focus Lot Number input so user can type the next bill immediately
      setTimeout(() => {
        if (lotNoInputRef.current) {
          lotNoInputRef.current.focus();
        }
      }, 350);
    } catch (err) {
      console.error('Issue error:', err);
      playFeedbackSound('error');
      setFormError('Failed to record without-BOM material issue: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Issue with 1% Cutting Allowance Verification
  const handleSubmitIssue = async () => {
    setFormError('');
    setFormSuccess('');

    const effectiveLot = lotNo.trim();
    if (!effectiveLot) {
      setFormError('Please enter or select a Lot Number. Lot Number is required to issue materials.');
      playFeedbackSound('error');
      lotNoInputRef.current?.focus();
      lotNoInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!personName.trim()) {
      setFormError('Please enter Person Name (Issuer).');
      playFeedbackSound('error');
      personNameInputRef.current?.focus();
      personNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!receiverName.trim()) {
      setFormError('Please enter Received By (Cutting Master / Tailor).');
      playFeedbackSound('error');
      receiverNameInputRef.current?.focus();
      receiverNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
    if (validItems.length === 0) {
      const fullyIssuedItem = items.find(i => {
        if (!i.materialId && !i.materialName) return false;
        const prior = getMaterialPriorIssueInfo(i, i.id);
        return prior && prior.isFullyIssued;
      });
      if (fullyIssuedItem) {
        const prior = getMaterialPriorIssueInfo(fullyIssuedItem, fullyIssuedItem.id);
        const msg = prior && prior.isCategoryPooling
          ? `⛔ Category "${prior.categoryKey}" is already fully issued for Lot #${effectiveLot} (${(Number(prior.alreadyIssued) || 0).toLocaleString()} Pcs across brands). ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.`
          : `⛔ "${fullyIssuedItem.materialName || 'Item'}" [${fullyIssuedItem.itemCode || ''}] is already issued for Lot #${effectiveLot}. ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.`;
        setFormError(msg);
        playFeedbackSound('error');
        alert(msg);
        return;
      }
      setFormError('Please select at least one material item with an issue quantity greater than 0.');
      playFeedbackSound('error');
      return;
    }

    // ── STRICT STORE RACK INVENTORY VERIFICATION ──
    // If the rack does not have enough bundles, rolls, or pieces, strictly block the issue!
    const stockShortageItems = validItems.filter(i => {
      if (!i.materialId || i.entryMode === 'manual') return false;
      const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
      const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(i.availableStock) || 0);
      return Number(i.totalQty) > rackStock;
    });

    if (stockShortageItems.length > 0) {
      const errorList = stockShortageItems.map(s => {
        const liveMat = (materials || []).find(m => String(m.id) === String(s.materialId));
        const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(s.availableStock) || 0);
        return `• "${s.materialName}" [${s.itemCode || 'ST'}]: Store rack (${s.location || 'Rack'}) only has ${rackStock} ${s.unit}, but tried to issue ${s.totalQty} ${s.unit}`;
      }).join('\n');

      const msg = `⛔ CANNOT ISSUE — INSUFFICIENT STORE RACK STOCK!\n\nStore rack me utna stock available nahi hai:\n${errorList}\n\nPlease issue quantity ko rack stock (${stockShortageItems[0].availableStock || 0}) ke barabar ya kam karein.`;
      setFormError(msg);
      playFeedbackSound('error');
      alert(msg);
      return;
    }

    // ── 1% CUTTING THRESHOLD VERIFICATION ──
    // e.g. Cutting = 1,000 Pcs -> 1% = 10 Pcs -> Max = 1,010 Pcs.
    // If quantity is <= 1,010 Pcs, it is OK and issues normally.
    // If quantity > 1,010 Pcs, it requires Supervisor / Admin Approval!
    if (cuttingPieces > 0) {
      // 1% restriction applies strictly to Base Quantity, not to multiplied Total Quantity
      const exceeded = validItems.filter(i => {
        const prior = getMaterialPriorIssueInfo(i, i.id);
        const maxAllowed = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
        const b = (i.baseQty !== undefined && i.baseQty !== null && i.baseQty !== '')
          ? Number(i.baseQty)
          : maxAllowed;
        return b > maxAllowed;
      });
      if (exceeded.length > 0) {
        setApprovalModalData({
          lotNo: effectiveLot,
          cuttingPieces,
          onePercentAllowance,
          defaultAutoIssueQty,
          exceededItems: exceeded.map(i => {
            const prior = getMaterialPriorIssueInfo(i, i.id);
            const maxAllowed = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
            const b = (i.baseQty !== undefined && i.baseQty !== null && i.baseQty !== '')
              ? Number(i.baseQty)
              : maxAllowed;
            const excess = b - maxAllowed;
            const excessPct = cuttingPieces > 0 ? ((excess / cuttingPieces) * 100).toFixed(1) : '0';
            return {
              ...i,
              qty: b,
              baseQty: b,
              alreadyIssued: prior.alreadyIssued,
              maxAllowed,
              excess,
              excessPct
            };
          }),
          allItems: validItems
        });
        return;
      }
    }

    await executeConfirmedIssue();
  };

  // Handle Submit Approval for >1% Requisition
  const handleConfirmSubmitApproval = async () => {
    if (!approvalModalData) return;
    setApprovalSubmitting(true);
    const { lotNo: reqLot, cuttingPieces: pcs, defaultAutoIssueQty: maxAllowed, exceededItems } = approvalModalData;

    const payloadItems = exceededItems.map(it => ({
      materialId: it.materialId || '',
      materialName: it.materialName || `${it.componentType} Item`,
      bomItemName: it.componentType || 'Accessory',
      totalRequired: it.qty,
      unit: it.unit || 'Pcs',
      itemCode: it.itemCode || '',
      color: it.color || '',
      availableStock: it.availableStock || 0,
      location: it.location || '',
      excessQty: it.excess,
      excessPct: it.excessPct
    }));

    const maxExcess = Math.max(...exceededItems.map(i => i.excess));
    const exceededSummary = exceededItems.map(i => `${i.materialName || i.componentType}: ${i.qty} ${i.unit} (1% max: ${maxAllowed}, +${i.excess} excess)`).join(', ');

    const approvalRequestData = {
      id: `AR${Date.now()}`,
      type: 'material_issue',
      subType: 'without_bom_excess_1pct',
      lotId: reqLot,
      category: styleName || 'Without-BOM Issue',
      brand: brandName || 'Mohit Hosiery',
      pieces: pcs,
      cuttingPieces: pcs,
      onePercentLimit: maxAllowed,
      items: payloadItems,
      isReissue: false,
      isWithoutBom: true,
      personName: personName.trim() || 'Store Staff',
      receiverName: receiverName.trim() || 'Cutting Master',
      receiverDept: receiverDept.trim() || 'Cutting',
      exceedsLimit: true,
      extraPercentage: ((maxExcess / pcs) * 100).toFixed(1),
      reason: approvalReason || `Without-BOM Issue Exceeds 1% Limit: ${exceededSummary}`,
      requesterName: currentUser?.name || personName || 'Store Staff',
      requesterRole: currentUser?.role || 'Store',
      status: 'pending',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };

    try {
      if (typeof onSubmitApproval === 'function') {
        onSubmitApproval('material_issue', approvalRequestData, currentUser);
      } else {
        await fetch(`${getBackendUrl()}/api/approval-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approvalRequestData)
        });
      }

      setFormSuccess(`✓ Approval Request submitted to Admin! Lot #${reqLot} issue (${exceededSummary}) is now pending Admin approval. Material can be issued after approval.`);
      setApprovalModalData(null);
      handleResetForm();
      setTimeout(() => setFormSuccess(''), 8000);
    } catch (err) {
      console.error('Failed to submit approval request:', err);
      setFormError('Failed to submit approval request: ' + err.message);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  // Adjust all items back to 1% limit
  const handleAdjustAllTo1Percent = () => {
    if (!approvalModalData) return;
    const maxAllowed = approvalModalData.defaultAutoIssueQty;
    setItems(prev => prev.map(item => {
      const b = (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '')
        ? Number(item.baseQty)
        : (cuttingPieces > 0 ? defaultAutoIssueQty : Number(item.totalQty) || 0);
      if (b > maxAllowed) {
        const { factor } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
        const total = Math.ceil(maxAllowed * factor);
        return { ...item, baseQty: maxAllowed, totalQty: total > 0 ? total : 1 };
      }
      return item;
    }));
    setApprovalModalData(null);
    setFormSuccess(`✓ Base quantities adjusted to 1% limit (${maxAllowed.toLocaleString()} Pcs). You can now issue directly.`);
    setTimeout(() => setFormSuccess(''), 4000);
  };

  // Admin Override
  const handleAdminOverrideIssue = async () => {
    setApprovalModalData(null);
    await executeConfirmedIssue(true);
  };

  // Clear and refill all form columns/inputs for a fresh issue
  const handleResetForm = () => {
    setLotNo('');
    setBrandName('');
    setReceiverName('');
    setReceiverDept('Cutting');
    setStyleName('Direct Item Requisition');
    setPieces(1);
    setRemarks('');
    setBarcodeInput('');
    setFormError('');
    setFormSuccess('');
    setActiveLotCutting(null);
    setItems([
      {
        id: Date.now(),
        multiplier: 1,
        multiplierOp: 'multiply',
        baseQty: 1,
        componentType: '',
        customComponentType: '',
        isCustomType: false,
        entryMode: 'choose',
        materialId: '',
        materialName: '',
        itemCode: '',
        color: '',
        unit: 'Mtr',
        availableStock: 0,
        location: '',
        calcMode: 'multiplier',
        perPcReq: 0,
        totalQty: 1
      }
    ]);
    setTimeout(() => {
      if (lotNoInputRef?.current) {
        try { lotNoInputRef.current.focus(); } catch (_) { }
      }
    }, 150);
  };

  // Helper to build issueData from a history log
  const buildIssueDataFromLog = (log) => {
    const rawLot = String(log.lotId || '').trim();
    const cleanLot = rawLot.replace(/^LOT\s*#?/i, '').trim().toLowerCase();
    const isDirect = !cleanLot ||
      cleanLot === 'direct-item' ||
      cleanLot === 'w/o lot' ||
      cleanLot === 'without lot' ||
      cleanLot === 'no lot' ||
      cleanLot === 'none' ||
      cleanLot === 'n/a' ||
      cleanLot.includes('direct') ||
      cleanLot.includes('w/o') ||
      cleanLot.includes('without') ||
      cleanLot.includes('no lot');

    const resolvedCutting = isDirect ? 0 : ((effectiveCuttingMap && effectiveCuttingMap[cleanLot] ? Number(effectiveCuttingMap[cleanLot]) : 0) ||
      (log.volume > 1 ? Number(log.volume) : 0));
    const onePct = resolvedCutting > 0 ? Math.round(resolvedCutting * 0.01) : 0;
    const defaultQty = resolvedCutting + onePct;

    return {
      voucherId: log.id,
      date: log.date || new Date().toLocaleDateString('en-GB'),
      issueMode: isDirect ? 'item_only' : 'floor_lot',
      lotId: isDirect ? (rawLot || 'DIRECT-ITEM') : log.lotId,
      isDirect,
      brand: log.brand || log.brandName || '',
      brandName: log.brandName || log.brand || '',
      style: log.style || log.category || (isDirect ? 'Direct Material Requisition' : 'Store Floor Issue'),
      pieces: isDirect ? 1 : (log.volume || 1),
      cuttingPieces: resolvedCutting,
      onePercentAllowance: onePct,
      defaultAutoIssueQty: defaultQty,
      personName: log.personName || 'Store In-charge',
      receiverName: log.receiverName || 'Cutting Master',
      receiverDept: log.receiverDept || 'Cutting',
      remarks: log.remarks || '',
      items: (log.materials || []).map((m, idx) => {
        const itemCodeResolved = getItemCodeDisplay(m, materials) ||
          (m.itemCode && !m.itemCode.toUpperCase().startsWith('ITM-') ? m.itemCode : '') ||
          (m.materialId && String(m.materialId).toUpperCase().startsWith('ST') ? String(m.materialId) : '') ||
          (m.materialId && /^\d+$/.test(String(m.materialId)) ? `ST${String(m.materialId).padStart(5, '0')}` : '-');
        return {
          componentType: m.bomItemName || 'Accessory',
          materialName: m.name || 'Material Item',
          itemCode: itemCodeResolved,
          color: m.color || 'Standard',
          location: getMaterialLocation(m) || m.location || 'Main Store',
          availableStock: m.qty || 0,
          totalQty: m.qty || 1,
          multiplier: m.multiplier ? Number(m.multiplier) : 1,
          calcMode: m.calcMode || 'direct',
          unit: m.unit || 'Pcs',
          imageUrl: getMaterialPhoto(m) || m.imageUrl || ''
        };
      })
    };
  };

  // Generate complete, robust HTML for printable challan sheet (Dual Copy - Pure Black & White)
  const generatePrintHtml = (issueData) => {
    const rawLot = String(issueData.lotId || '').trim();
    const cleanLot = rawLot.replace(/^LOT\s*#?/i, '').trim().toLowerCase();
    const isDirectLot = issueData.isDirect || !cleanLot ||
      cleanLot === 'direct-item' ||
      cleanLot === 'w/o lot' ||
      cleanLot === 'without lot' ||
      cleanLot === 'no lot' ||
      cleanLot === 'none' ||
      cleanLot === 'n/a' ||
      cleanLot.includes('direct') ||
      cleanLot.includes('w/o') ||
      cleanLot.includes('without') ||
      cleanLot.includes('no lot');

    const lotText = isDirectLot ? 'WITHOUT LOT (DIRECT REQUISITION)' : (issueData.lotId ? `LOT #${issueData.lotId}` : 'LOT REQUIRED');
    const voucherId = issueData.voucherId || nextVoucherId || 'CHALLAN';
    const dateStr = issueData.date || new Date().toLocaleDateString('en-GB');
    const items = issueData.items || [];
    const remarksHtml = issueData.remarks ? `<div class="remarks"><strong>Remarks / Allocation Notes:</strong> ${issueData.remarks}</div>` : '';

    const resolvedCutting = isDirectLot ? 0 : (Number(issueData.cuttingPieces) ||
      (effectiveCuttingMap && effectiveCuttingMap[cleanLot] ? Number(effectiveCuttingMap[cleanLot]) : 0) ||
      (activeLotCutting && String(activeLotCutting.lotNumber).trim().toLowerCase() === cleanLot ? Number(activeLotCutting.totalPieces) : 0) ||
      (Number(issueData.pieces) > 1 ? Number(issueData.pieces) : 0));

    const onePct = resolvedCutting > 0 ? Math.round(resolvedCutting * 0.01) : 0;
    const totalAllowedWith1Pct = resolvedCutting + onePct;

    // Check if any issued item includes 1% extra
    const isOnePercentExtraIssued = items.some(it => {
      const q = Number(it.totalQty);
      return (resolvedCutting > 0 && q >= totalAllowedWith1Pct) || (resolvedCutting > 0 && q > resolvedCutting);
    });

    const renderChallanCopy = (copyTitle) => `
      <div class="challan-card">
        <div class="header">
          <div class="brand">
            <h1>MOHIT HOSIERY</h1>
            <div class="dept">CENTRAL STORE & PRODUCTION ACCESSORIES DEPARTMENT</div>
            <div class="main-heading">MATERIAL ISSUE WITHOUT BOM</div>
            <div class="sub-heading">OFFICIAL STORE CHALLAN / ISSUE BILL</div>
          </div>
          <div class="meta">
            <div class="challan-no">CHALLAN NO: ${voucherId}</div>
            <div class="date">DATE: ${dateStr}</div>
            <div class="copy-badge">${copyTitle}</div>
            <div class="status-badge">${issueData.isPreviewOnly ? '[ DRAFT PREVIEW ]' : '[ STOCK DEDUCTED ]'}</div>
          </div>
        </div>

        <div class="particulars-grid">
          <div class="field"><span class="lbl">LOT NO:</span> <strong class="lot-val">${lotText}</strong></div>
          <div class="field"><span class="lbl">ISSUED BY (STORE):</span> <strong>${issueData.personName || 'Store In-charge'}</strong></div>
          <div class="field"><span class="lbl">RECEIVED BY:</span> <strong>${issueData.receiverName || 'Floor Master'} (${issueData.receiverDept || 'Cutting'})</strong></div>
          <div class="field"><span class="lbl">REQUISITION TYPE:</span> <span>${issueData.style || 'Direct Requisition'}</span></div>
          <div class="field">
            <span class="lbl">CUTTING PIECES / VOLUME:</span>
            ${isDirectLot ? `
              <strong class="volume-val">Direct Store Issue (No Lot Cutting)</strong>
            ` : resolvedCutting > 0 ? `
              <strong class="volume-val">${resolvedCutting.toLocaleString()} Pcs</strong>
              ${isOnePercentExtraIssued ? `
                <div class="extra-badge">✓ +1% EXTRA MATERIAL ISSUED: ${totalAllowedWith1Pct.toLocaleString()} PCS</div>
              ` : (onePct > 0 ? `
                <div class="extra-badge-subtle">(1% Max Allowed: ${totalAllowedWith1Pct.toLocaleString()} Pcs)</div>
              ` : '')}
            ` : `
              <strong class="volume-val">${issueData.pieces > 1 ? `${issueData.pieces} Pcs` : 'Ad-Hoc Issue'}</strong>
            `}
          </div>
          <div class="field"><span class="lbl">TOTAL LINE ITEMS:</span> <span>${items.length} Material Item(s)</span></div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th style="width: 110px;">Component</th>
              <th>Store Material Description</th>
              <th style="width: 90px;">Item Code</th>
              <th style="width: 90px;">Rack Loc</th>
              <th style="width: 120px; text-align: right;">Issued Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
      const code = getItemCodeDisplay(item, materials) ||
        (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '') ||
        '-';
      const qty = Number(item.totalQty);
      const isItemExtra = resolvedCutting > 0 && (qty >= totalAllowedWith1Pct || qty > resolvedCutting);
      const mult = Number(item.multiplier) || 1;
      return `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td><strong>${item.componentType || 'Accessory'}</strong></td>
                  <td>
                    ${item.materialName || 'Material'}
                    ${mult > 1 ? `<span style="display: inline-block; margin-left: 6px; font-size: 8.5px; font-weight: 800; padding: 1px 4px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px;">(×${mult} Multiplier)</span>` : ''}
                  </td>
                  <td style="font-family: monospace; font-weight: bold;">${code}</td>
                  <td>${item.location || 'Store'}</td>
                  <td style="text-align: right;">
                    <span style="font-weight: 900; font-size: 11px;">${item.totalQty} ${item.unit || 'Pcs'}</span>
                    ${mult > 1 ? `<div style="font-size: 8px; font-weight: 800; color: #475569;">[ Multiplier: ×${mult} ]</div>` : ''}
                    ${isItemExtra ? `<div style="font-size: 8.5px; font-weight: 900; color: #000000; text-transform: uppercase;">[ +1% Extra Added ]</div>` : ''}
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>

        ${remarksHtml}

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Issued By (Store)</strong>
            <div>${issueData.personName || 'Store In-charge'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Received By (Floor)</strong>
            <div>${issueData.receiverName || 'Floor Master'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Authorized Supervisor</strong>
            <div>Sign & Stamp</div>
          </div>
        </div>

        <div class="footer-note">
          Official Material Issue Without BOM Challan • Mohit Hosiery Central Store Quality System
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>MATERIAL ISSUE WITHOUT BOM - ${voucherId}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 6px;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4 portrait;
            margin: 7mm 7mm;
          }
          .challan-card {
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 12px;
            page-break-inside: avoid;
            background: #ffffff;
          }
          .cut-divider {
            border-top: 1.5px dashed #000000;
            text-align: center;
            margin: 12px 0;
            position: relative;
          }
          .cut-divider span {
            background: #ffffff;
            padding: 2px 10px;
            font-size: 9px;
            font-weight: 900;
            color: #000000;
            position: relative;
            top: -9px;
            letter-spacing: 0.8px;
            border: 1px solid #000000;
            border-radius: 3px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid #000000;
            padding-bottom: 3px;
            margin-bottom: 4px;
          }
          .brand h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.3px;
            color: #000000;
          }
          .brand .dept {
            font-size: 9.5px;
            font-weight: 700;
            color: #000000;
            margin-top: 1px;
          }
          .brand .main-heading {
            display: inline-block;
            background: #000000;
            color: #ffffff;
            font-weight: 900;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 3px;
            margin-top: 4px;
            letter-spacing: 0.3px;
            border: 1px solid #000000;
          }
          .brand .sub-heading {
            font-size: 9.5px;
            font-weight: 700;
            color: #000000;
            margin-top: 2px;
          }
          .meta {
            text-align: right;
          }
          .meta .challan-no {
            font-family: monospace;
            font-size: 14px;
            font-weight: 900;
            color: #000000;
          }
          .meta .date {
            font-size: 10px;
            color: #000000;
            font-weight: 600;
            margin-top: 2px;
          }
          .copy-badge {
            display: inline-block;
            margin-top: 4px;
            padding: 2px 7px;
            background: #000000;
            color: #ffffff;
            font-size: 9px;
            font-weight: 900;
            border-radius: 3px;
            border: 1px solid #000000;
          }
          .status-badge {
            font-size: 9px;
            font-weight: 900;
            color: #000000;
            margin-top: 2px;
          }
          .particulars-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            background: #ffffff;
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 10px;
            font-size: 11px;
          }
          .particulars-grid .field {
            line-height: 1.35;
          }
          .particulars-grid .lbl {
            font-size: 9px;
            color: #000000;
            font-weight: 900;
            display: block;
            text-transform: uppercase;
          }
          .lot-val {
            color: #000000;
            font-size: 12px;
            font-weight: 900;
          }
          .volume-val {
            color: #000000;
            font-size: 12px;
            font-weight: 900;
          }
          .extra-badge {
            display: inline-block;
            margin-top: 2px;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 900;
            color: #000000;
            border: 1px solid #000000;
            background: #f0f0f0;
            border-radius: 2px;
          }
          .extra-badge-subtle {
            font-size: 9px;
            color: #000000;
            font-weight: 700;
            margin-top: 2px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            margin-bottom: 4px;
            border: 1.5px solid #000000;
          }
          .items-table th {
            background: #f0f0f0;
            border: 1px solid #000000;
            padding: 5px 6px;
            text-align: left;
            font-size: 9.5px;
            text-transform: uppercase;
            color: #000000;
            font-weight: 900;
          }
          .items-table td {
            border: 1px solid #000000;
            padding: 5px 6px;
            vertical-align: middle;
            color: #000000;
          }
          .items-table tbody tr {
            background: #ffffff !important;
          }
          .remarks {
            background: #ffffff;
            border: 1px solid #000000;
            border-left: 4px solid #000000;
            padding: 4px 8px;
            font-size: 10px;
            margin-bottom: 4px;
            color: #000000;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1.5px solid #000000;
            text-align: center;
            font-size: 9.5px;
            color: #000000;
          }
          .sig-box .sig-line {
            height: 22px;
            border-bottom: 1.5px solid #000000;
            width: 75%;
            margin: 0 auto 4px auto;
          }
          .footer-note {
            text-align: center;
            font-size: 8.5px;
            color: #000000;
            margin-top: 8px;
            font-weight: 600;
          }
          .print-btn-bar {
            text-align: center;
            padding: 10px;
            background: #f0f0f0;
            margin-bottom: 12px;
            border-radius: 6px;
            border: 1px solid #000000;
          }
          .btn-print {
            background: #000000;
            color: #ffffff;
            border: 1px solid #000000;
            padding: 8px 24px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .print-btn-bar, .cut-divider { page-break-after: avoid; }
            .print-btn-bar { display: none !important; }
            body { padding: 0; }
            * { color: #000000 !important; }
            .brand .main-heading, .copy-badge {
              background: #000000 !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .items-table th {
              background: #f0f0f0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Print Challan Now</button>
        </div>

        ${renderChallanCopy('ORIGINAL - STORE COPY')}

        <div class="cut-divider">
          <span>✂ CUT ALONG DOTTED LINE FOR DUPLICATE COPY</span>
        </div>

        ${renderChallanCopy('DUPLICATE - RECEIVER / FLOOR COPY')}
      </body>
      </html>
    `;
  };

  // Dedicated Print Window Function (Instant, Clean & Foolproof via Hidden Iframe)
  const handleDirectPrintWindow = (issueData, customVoucherId) => {
    if (!issueData) return;
    const vid = customVoucherId || issueData.voucherId || nextVoucherId;
    const payload = { ...issueData, voucherId: vid };
    setActivePrintData(payload);

    try {
      const printHtml = generatePrintHtml(payload);

      // Clean up previous print iframe if existing
      const oldFrame = document.getElementById('without-bom-print-iframe');
      if (oldFrame) {
        try { document.body.removeChild(oldFrame); } catch (e) { }
      }

      // Create invisible iframe to trigger native browser print window without popup blocking
      const printFrame = document.createElement('iframe');
      printFrame.id = 'without-bom-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      // Trigger the browser's native print window directly
      setTimeout(() => {
        try {
          if (printFrame.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          }
        } catch (err) {
          console.warn('Iframe print failed:', err);
        }
      }, 250);

      return true;
    } catch (e) {
      console.warn('Direct print frame failed, falling back to on-page print:', e);
      handlePrintChallan();
      return false;
    }
  };

  // Direct 1-Click Print from the Main Form
  const handleDirectPrintFromForm = () => {
    setFormError('');
    const fullyIssuedItem = items.find(i => {
      if (!i.materialId && !i.materialName) return false;
      const prior = getMaterialPriorIssueInfo(i, i.id);
      return prior && prior.isFullyIssued;
    });
    if (fullyIssuedItem) {
      const prior = getMaterialPriorIssueInfo(fullyIssuedItem, fullyIssuedItem.id);
      const msg = prior && prior.isCategoryPooling
        ? `⛔ Category "${prior.categoryKey}" is already fully issued for Lot #${lotNo} (${(Number(prior.alreadyIssued) || 0).toLocaleString()} Pcs across brands). ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.`
        : `⛔ "${fullyIssuedItem.materialName || 'Item'}" [${fullyIssuedItem.itemCode || ''}] is already issued for Lot #${lotNo}. ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.`;
      setFormError(msg);
      playFeedbackSound('error');
      alert(msg);
      return;
    }
    if (cuttingPieces > 0) {
      const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
      const exceeded = validItems.filter(i => {
        const prior = getMaterialPriorIssueInfo(i, i.id);
        const maxAllowed = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
        const b = (i.baseQty !== undefined && i.baseQty !== null && i.baseQty !== '')
          ? Number(i.baseQty)
          : maxAllowed;
        return b > maxAllowed;
      });
      if (exceeded.length > 0) {
        setApprovalModalData({
          lotNo: lotNo.trim(),
          cuttingPieces,
          onePercentAllowance,
          defaultAutoIssueQty,
          exceededItems: exceeded.map(i => {
            const prior = getMaterialPriorIssueInfo(i, i.id);
            const maxAllowed = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
            const b = (i.baseQty !== undefined && i.baseQty !== null && i.baseQty !== '')
              ? Number(i.baseQty)
              : maxAllowed;
            const excess = b - maxAllowed;
            const excessPct = cuttingPieces > 0 ? ((excess / cuttingPieces) * 100).toFixed(1) : '0';
            return { ...i, qty: b, baseQty: b, alreadyIssued: prior.alreadyIssued, maxAllowed, excess, excessPct };
          }),
          allItems: validItems
        });
        return;
      }
    }
    const issueData = buildIssueDataFromForm();
    if (!issueData) return;
    handleDirectPrintWindow(issueData, issueData.voucherId);
  };

  // Direct 1-Click On-Page Print Dialog
  const handlePrintChallan = () => {
    document.body.classList.add('print-without-bom-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-without-bom-mode');
    }, 150);
  };

  // Reprint from History
  const handleReprintHistory = (log) => {
    try {
      const issueData = buildIssueDataFromLog(log);
      const doc = generatePDFVoucher(issueData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setPreviewModal({ doc, pdfUrl, voucherId: log.id, issueData, isPreviewOnly: false });
    } catch (err) {
      alert('Failed to generate reprint: ' + err.message);
    }
  };

  // Direct 1-Click Export of Individual Challan / Bill as PDF File
  const handleDownloadChallanPdf = (log) => {
    try {
      const issueData = buildIssueDataFromLog(log);
      const doc = generatePDFVoucher(issueData);
      doc.save(`${log.id || 'Challan'}_Material_Issue_Slip.pdf`);
    } catch (err) {
      alert('Failed to export Challan PDF: ' + err.message);
    }
  };

  // Direct 1-Click Export of Current Form Challan as PDF File
  const handleSavePdfFromForm = () => {
    setFormError('');
    const fullyIssuedItem = items.find(i => {
      if (!i.materialId && !i.materialName) return false;
      const prior = getMaterialPriorIssueInfo(i, i.id);
      return prior && prior.isFullyIssued;
    });
    if (fullyIssuedItem) {
      const prior = getMaterialPriorIssueInfo(fullyIssuedItem, fullyIssuedItem.id);
      const msg = prior && prior.isCategoryPooling
        ? `⛔ Category "${prior.categoryKey}" is already fully issued for Lot #${lotNo} (${(Number(prior.alreadyIssued) || 0).toLocaleString()} Pcs across brands). ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.`
        : `⛔ "${fullyIssuedItem.materialName || 'Item'}" [${fullyIssuedItem.itemCode || ''}] is already issued for Lot #${lotNo}. ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.`;
      setFormError(msg);
      playFeedbackSound('error');
      alert(msg);
      return;
    }
    if (cuttingPieces > 0) {
      const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
      const exceeded = validItems.filter(i => {
        const prior = getMaterialPriorIssueInfo(i, i.id);
        const maxAllowed = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
        const b = (i.baseQty !== undefined && i.baseQty !== null && i.baseQty !== '')
          ? Number(i.baseQty)
          : maxAllowed;
        return b > maxAllowed;
      });
      if (exceeded.length > 0) {
        setApprovalModalData({
          lotNo: lotNo.trim(),
          cuttingPieces,
          onePercentAllowance,
          defaultAutoIssueQty,
          exceededItems: exceeded.map(i => {
            const prior = getMaterialPriorIssueInfo(i, i.id);
            const maxAllowed = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
            const b = (i.baseQty !== undefined && i.baseQty !== null && i.baseQty !== '')
              ? Number(i.baseQty)
              : maxAllowed;
            const excess = b - maxAllowed;
            const excessPct = cuttingPieces > 0 ? ((excess / cuttingPieces) * 100).toFixed(1) : '0';
            return { ...i, qty: b, baseQty: b, alreadyIssued: prior.alreadyIssued, maxAllowed, excess, excessPct };
          }),
          allItems: validItems
        });
        return;
      }
    }
    const issueData = buildIssueDataFromForm();
    if (!issueData) return;
    try {
      const doc = generatePDFVoucher(issueData);
      doc.save(`${issueData.voucherId || 'Challan'}_Material_Issue_Slip.pdf`);
    } catch (err) {
      setFormError('Failed to export Challan PDF: ' + err.message);
    }
  };

  // Export Full History Audit Register as a Beautiful Multi-Page PDF Document
  const handleExportFullReportPdf = () => {
    if (!withoutBomLogs || withoutBomLogs.length === 0) {
      alert('No Without-BOM challan records found to export.');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Header Area (Clean Black & White Normal)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('MOHIT HOSIERY — CENTRAL STORE & PRODUCTION ACCESSORIES', margin, margin + 5);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('WITHOUT-BOM & ITEM ISSUE AUDIT REGISTER', margin, margin + 11);

      const nowStr = new Date().toLocaleString('en-GB');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated: ${nowStr}  |  Total Records: ${withoutBomLogs.length}`, pw - margin, margin + 11, { align: 'right' });

      // Clean divider line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(margin, margin + 14, pw - margin, margin + 14);

      let startTableY = margin + 18;

      // Active Filter Summary
      const filterParts = [];
      if (historyDateFrom || historyDateTo) {
        filterParts.push(`Dates: ${historyDateFrom || 'Start'} to ${historyDateTo || 'Today'}`);
      }
      if (historyCategories.length > 0) {
        filterParts.push(`Categories: ${historyCategories.join(', ')}`);
      }
      if (historyPersons.length > 0) {
        filterParts.push(`Persons: ${historyPersons.map(p => formatPersonKey(p)).join(', ')}`);
      }
      if (historySearch) {
        filterParts.push(`Search: "${historySearch}"`);
      }

      if (filterParts.length > 0) {
        doc.setFillColor(248, 248, 248);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);
        doc.rect(margin, startTableY, pw - (margin * 2), 6, 'FD');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Active Filters: ${filterParts.join('  |  ')}`, margin + 3, startTableY + 4.2);
        startTableY += 9;
      }

      // Prepare Table Data
      let grandTotalPieces = 0;
      let grandIssuePcs = 0;

      const tableRows = [];

      withoutBomLogs.forEach((log, idx) => {
        const dateStr = log.date || '—';
        const rawLot = String(log.lotId || '').trim();
        const cleanLot = rawLot.toLowerCase();
        const isDirect = !cleanLot ||
          cleanLot === 'direct-item' ||
          cleanLot === 'w/o lot' ||
          cleanLot === 'without lot' ||
          cleanLot === 'no lot' ||
          cleanLot === 'none' ||
          cleanLot === 'n/a' ||
          cleanLot.includes('direct') ||
          cleanLot.includes('w/o') ||
          cleanLot.includes('without') ||
          cleanLot.includes('no lot');

        const lotDisplay = isDirect ? 'DIRECT REQUISITION' : `LOT #${rawLot}`;
        const brandDisplay = log.brand || log.brandName || (isDirect ? 'Direct Material' : '—');
        const issuer = log.personName || 'Store Incharge';
        const receiver = log.receiverName ? `${log.receiverName}${log.receiverDept ? `\n(${log.receiverDept})` : ''}` : 'Floor Master';
        const remarks = log.remarks ? log.remarks : '';

        const mats = (Array.isArray(log.materials) && log.materials.length > 0) ? log.materials : [null];
        const matCount = mats.length;

        mats.forEach((m, mIdx) => {
          if (!m) {
            tableRows.push([
              idx + 1,
              log.id || `BILL-${idx + 1}`,
              dateStr,
              lotDisplay,
              brandDisplay,
              '—',
              '—',
              '0 Pcs',
              '—',
              issuer,
              receiver,
              remarks
            ]);
            return;
          }

          const matMetrics = getMaterialItemMetrics(m, log, materials, effectiveCuttingMap, designs);
          if (mIdx === 0 && !isDirect) {
            grandTotalPieces += matMetrics.cuttingPieces;
          }
          if (matMetrics.unit === 'Pcs') {
            grandIssuePcs += matMetrics.qty;
          }

          const c = getItemCodeDisplay(m);
          const cat = getMaterialCategory(m);
          const name = m.name || m.bomItemName || 'Material';
          const qtyStr = `${m.qty || 0} ${m.unit || 'Pcs'}`;
          const loc = getMaterialLocation(m) || m.location;
          const mult = getMaterialMultiplier(m, log, matMetrics.cuttingPieces);
          const multSuffix = mult > 1 ? ` (×${mult} Mult)` : '';
          const multDisplay = mult === 1 ? '1 / Pc' : (mult < 1 ? `÷${Math.round(1 / mult)}` : `×${mult}\n(${mult}/Pc)`);
          const matDisplay = `${cat ? `[${cat.toUpperCase()}] ` : ''}${name}${c ? ` [${c}]` : ''}: ${qtyStr}${multSuffix}${loc ? ` (${loc})` : ''}`;

          const cuttingDisplay = !isDirect && matMetrics.cuttingPieces > 0
            ? `${matMetrics.cuttingPieces.toLocaleString()} Pcs\n(Cutting Qty)`
            : (isDirect ? '—\n(Direct)' : '—');

          const varDisplay = matMetrics.hasVariance
            ? `${matMetrics.varianceText}\n(${matMetrics.varianceBadge})`
            : (matMetrics.varianceBadge || '—');

          tableRows.push([
            matCount > 1 ? `${idx + 1}.${mIdx + 1}` : idx + 1,
            matCount > 1 ? `${log.id || `BILL-${idx + 1}`} (#${mIdx + 1})` : (log.id || `BILL-${idx + 1}`),
            dateStr,
            lotDisplay,
            brandDisplay,
            matDisplay,
            cuttingDisplay,
            multDisplay,
            mult > 1 ? `${matMetrics.formattedQty} (×${mult})` : matMetrics.formattedQty,
            varDisplay,
            issuer,
            receiver,
            remarks
          ]);
        });
      });

      const grandVariance = grandTotalPieces - grandIssuePcs;
      const grandVarStr = grandVariance > 0 ? `+${grandVariance.toLocaleString()}` : `${grandVariance.toLocaleString()}`;

      autoTable(doc, {
        startY: startTableY,
        head: [['#', 'Challan No', 'Date', 'Lot Reference', 'Brand', 'Issued Materials', 'Total Pieces\n(Cutting)', 'Per Pc / Mult', 'Issue Pcs', 'Variance\n(Cutting - Issue)', 'Issued By', 'Received By', 'Remarks']],
        body: tableRows,
        foot: [['', 'TOTALS', '', '', '', `${withoutBomLogs.length} Challan(s)`, `${grandTotalPieces.toLocaleString()} Pcs Cutting`, '', `${grandIssuePcs.toLocaleString()} Pcs`, `${grandVarStr} Pcs Balance`, '', '', '']],
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'middle',
          overflow: 'linebreak',
          textColor: [0, 0, 0],
          lineColor: [180, 180, 180],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          lineColor: [0, 0, 0],
          lineWidth: 0.2
        },
        footStyles: {
          fillColor: [245, 245, 245],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineColor: [0, 0, 0],
          lineWidth: 0.2
        },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center', textColor: [0, 0, 0] },
          1: { cellWidth: 20, fontStyle: 'bold', textColor: [0, 0, 0] },
          2: { cellWidth: 19, textColor: [0, 0, 0] },
          3: { cellWidth: 23, fontStyle: 'bold', textColor: [0, 0, 0] },
          4: { cellWidth: 19, textColor: [0, 0, 0] },
          5: { cellWidth: 52, textColor: [0, 0, 0] },
          6: { cellWidth: 18, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
          7: { cellWidth: 16, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0] },
          8: { cellWidth: 18, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
          9: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
          10: { cellWidth: 18, textColor: [0, 0, 0] },
          11: { cellWidth: 20, textColor: [0, 0, 0] },
          12: { cellWidth: 19, textColor: [0, 0, 0] }
        }
      });

      // Add page numbers on all pages (Clean Black & White Normal)
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text(`Page ${i} of ${totalPages}`, pw - margin, ph - 4, { align: 'right' });
        doc.text('Mohit Hosiery Central Store • Material Issue Without BOM Official Audit Register', margin, ph - 4);
      }

      const fileName = `Without_BOM_Challan_Register_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF Export failed:', err);
      alert('Failed to export PDF: ' + err.message);
    }
  };

  // Handler to print full page report with detailed table, brand-wise, lot-wise summaries and photos
  const handlePrintFullHistoryReport = () => {
    if (!withoutBomLogs || withoutBomLogs.length === 0) {
      alert('No Without-BOM challan records found to print.');
      return;
    }

    // Filter summary text for printed report
    const filterParts = [];
    if (historyDateFrom || historyDateTo) {
      filterParts.push(`Dates: ${historyDateFrom || 'Start'} to ${historyDateTo || 'Today'}`);
    }
    if (historyCategories.length > 0) {
      filterParts.push(`Categories: ${historyCategories.join(', ')}`);
    }
    if (historyPersons.length > 0) {
      filterParts.push(`Persons: ${historyPersons.map(p => formatPersonKey(p)).join(', ')}`);
    }
    if (historySearch) {
      filterParts.push(`Search: "${historySearch}"`);
    }
    const filterBannerHtml = filterParts.length > 0
      ? `<div style="margin-top: 2px; font-size: 8px; font-weight: 700; color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; padding: 1px 5px; border-radius: 3px;">Filtered By: ${filterParts.join(' &nbsp;|&nbsp; ')}</div>`
      : '';

    const printWin = window.open('', '_blank', 'width=1200,height=850');
    if (!printWin) {
      alert('Popup was blocked by your browser. Please allow popups to open the print report.');
      return;
    }

    const totalChallans = withoutBomLogs.length;
    let totalLineItems = 0;
    let totalQtyIssued = 0;
    let grandTotalPieces = 0;
    const uniqueLots = new Set();
    const uniqueBrands = new Set();

    // Data structures for summaries
    const brandSummaryMap = {};
    const lotSummaryMap = {};
    const materialSummaryMap = {};

    withoutBomLogs.forEach((log) => {
      const rawBrand = (log.brand || log.brandName || '').trim();
      const rawLot = String(log.lotId || '').trim();
      const cleanLot = rawLot.toLowerCase();
      const isDirect = !cleanLot ||
        cleanLot === 'direct-item' ||
        cleanLot === 'w/o lot' ||
        cleanLot === 'without lot' ||
        cleanLot === 'no lot' ||
        cleanLot === 'none' ||
        cleanLot === 'n/a' ||
        cleanLot.includes('direct') ||
        cleanLot.includes('w/o') ||
        cleanLot.includes('without') ||
        cleanLot.includes('no lot');

      const effectiveLot = isDirect ? 'WITHOUT LOT REQUISITION' : `LOT #${rawLot}`;
      const { totalPieces: logVol } = getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs);
      if (!isDirect) {
        grandTotalPieces += logVol;
      }

      if (rawBrand) {
        uniqueBrands.add(rawBrand);
        if (!brandSummaryMap[rawBrand]) {
          brandSummaryMap[rawBrand] = {
            brand: rawBrand,
            lots: new Set(),
            materials: {}
          };
        }
        if (!isDirect) brandSummaryMap[rawBrand].lots.add(rawLot);
      }

      if (!isDirect) uniqueLots.add(rawLot);

      if (!lotSummaryMap[effectiveLot]) {
        lotSummaryMap[effectiveLot] = {
          lot: effectiveLot,
          rawLot: rawLot,
          isDirect: isDirect,
          brand: rawBrand || '',
          challans: new Set(),
          materials: {},
          totalPieces: isDirect ? 0 : logVol
        };
      } else {
        if (!isDirect && logVol > lotSummaryMap[effectiveLot].totalPieces) {
          lotSummaryMap[effectiveLot].totalPieces = logVol;
        }
      }
      if (rawBrand && !lotSummaryMap[effectiveLot].brand) {
        lotSummaryMap[effectiveLot].brand = rawBrand;
      }
      if (log.id) lotSummaryMap[effectiveLot].challans.add(log.id);

      (log.materials || []).forEach(m => {
        totalLineItems += 1;
        const q = Number(m.qty) || 0;
        totalQtyIssued += q;
        const matName = m.name || m.bomItemName || 'Material';
        const unit = m.unit || 'Pcs';
        const matKey = `${matName.toLowerCase()}__${unit.toLowerCase()}`;
        const photo = getMaterialPhoto(m);
        const code = getItemCodeDisplay(m) || m.itemCode || '';
        const cat = getMaterialCategory(m);

        // Brand map (only when genuine brand exists)
        if (rawBrand) {
          if (!brandSummaryMap[rawBrand].materials[matKey]) {
            brandSummaryMap[rawBrand].materials[matKey] = {
              name: matName,
              componentType: cat || m.bomItemName || 'Accessory',
              itemCode: code,
              unit,
              photo,
              totalQty: 0
            };
          }
          brandSummaryMap[rawBrand].materials[matKey].totalQty += q;
        }

        const loc = getMaterialLocation(m);

        // Lot map
        if (!lotSummaryMap[effectiveLot].materials[matKey]) {
          lotSummaryMap[effectiveLot].materials[matKey] = {
            name: matName,
            componentType: cat || m.bomItemName || 'Accessory',
            itemCode: code,
            location: loc,
            unit,
            photo,
            totalQty: 0
          };
        }
        lotSummaryMap[effectiveLot].materials[matKey].totalQty += q;

        // Overall material map
        if (!materialSummaryMap[matKey]) {
          materialSummaryMap[matKey] = {
            name: matName,
            componentType: cat || m.bomItemName || 'Accessory',
            itemCode: code,
            location: loc,
            unit,
            photo,
            totalQty: 0,
            challanCount: 0
          };
        }
        materialSummaryMap[matKey].totalQty += q;
        materialSummaryMap[matKey].challanCount += 1;
      });
    });

    const grandVariance = grandTotalPieces - totalQtyIssued;

    // Build Rows for Main Log Table with Category-Wise Pooling & Professional Spacing
    const tableRowsHtml = withoutBomLogs.map((log, idx) => {
      const rawLot = String(log.lotId || '').trim();
      const cleanLot = rawLot.toLowerCase();
      const isDirect = !cleanLot ||
        cleanLot === 'direct-item' ||
        cleanLot === 'w/o lot' ||
        cleanLot === 'without lot' ||
        cleanLot === 'no lot' ||
        cleanLot === 'none' ||
        cleanLot === 'n/a' ||
        cleanLot.includes('direct') ||
        cleanLot.includes('w/o') ||
        cleanLot.includes('without') ||
        cleanLot.includes('no lot');
      const lotDisplay = isDirect ? 'WITHOUT LOT' : `LOT #${rawLot}`;
      const brandDisplay = (log.brand || log.brandName) ? `${log.brand || log.brandName}` : '';

      const mats = (Array.isArray(log.materials) && log.materials.length > 0) ? log.materials : [null];
      const matCount = mats.length;

      // Group items by category for same-lot same-category pooling
      const categoryBatches = [];
      const catBatchMap = {};

      mats.forEach((m, mIdx) => {
        if (!m) {
          categoryBatches.push({ catKey: '', isPc: false, items: [{ m: null, mIdx: 0 }], totalQty: 0, isPooled: false });
          return;
        }
        const unit = String(m.unit || 'Pcs').trim().toLowerCase();
        const isPc = unit === 'pcs' || unit === 'pc' || unit === 'piece' || unit === 'pieces';
        const rawCat = getMaterialCategory(m);
        const catKey = isPc ? normalizeCategoryKey(rawCat, m.name || m.bomItemName) : '';

        // SAME CATEGORY -> SAME GROUP KEY (PLUS IT!)
        // DIFFERENT CATEGORY -> DIFFERENT GROUP KEY (NOT PLUS!)
        const groupKey = (!isDirect && isPc && catKey && catKey !== 'GENERAL') ? `${catKey}` : `__single_${mIdx}__`;

        if (!catBatchMap[groupKey]) {
          catBatchMap[groupKey] = {
            groupKey,
            catKey,
            rawCat: rawCat || catKey,
            unit: m.unit || 'Pcs',
            isPc,
            items: [],
            totalQty: 0,
            isPooled: false
          };
          categoryBatches.push(catBatchMap[groupKey]);
        }
        catBatchMap[groupKey].items.push({ m, mIdx });
        catBatchMap[groupKey].totalQty += (Number(m.qty) || 0);
        if (catBatchMap[groupKey].items.length > 1) {
          catBatchMap[groupKey].isPooled = true;
        }
      });

      let currentGlobalItemIdx = 0;

      return categoryBatches.map((batch) => {
        const batchItemCount = batch.items.length;
        return batch.items.map((itemObj, itemInBatchIdx) => {
          const { m, mIdx } = itemObj;
          const isFirstInChallan = currentGlobalItemIdx === 0;
          const isLastInChallan = currentGlobalItemIdx === matCount - 1;
          const isFirstInBatch = itemInBatchIdx === 0;
          const isLastInBatch = itemInBatchIdx === batchItemCount - 1;
          currentGlobalItemIdx++;

          const matMetrics = getMaterialItemMetrics(m, log, materials, effectiveCuttingMap, designs);
          const photo = m ? getMaterialPhoto(m) : null;
          const code = m ? (getItemCodeDisplay(m) || m.itemCode || '') : '';
          const cat = m ? getMaterialCategory(m) : '';
          const loc = m ? getMaterialLocation(m) : '';
          const mult = m && m.multiplier ? Number(m.multiplier) : 1;

          // Category batch metrics with Multiplier Target calculation
          const cuttingPieces = isDirect ? 0 : matMetrics.cuttingPieces;
          const catIssueQty = batch.totalQty;
          const batchTargetRequired = (!isDirect && cuttingPieces > 0)
            ? batch.items.reduce((sum, it) => sum + Math.round(cuttingPieces * getMaterialMultiplier(it.m, log, cuttingPieces)), 0)
            : 0;
          const effectiveBatchMult = cuttingPieces > 0 && batchTargetRequired > 0
            ? Number((batchTargetRequired / cuttingPieces).toFixed(2))
            : (batch.items.length === 1 ? getMaterialMultiplier(batch.items[0].m, log, cuttingPieces) : 1);
          const catVariance = cuttingPieces > 0 ? (batchTargetRequired - catIssueQty) : 0;
          const hasCatVariance = !isDirect && cuttingPieces > 0 && batch.isPc;
          const catVarianceText = catVariance > 0 ? `+${catVariance.toLocaleString('en-IN')} Pcs` : `${catVariance.toLocaleString('en-IN')} Pcs`;
          const catVarianceBadge = catVariance === 0 ? 'BALANCED' : catVariance > 0 ? 'CUTTING BALANCE' : 'OVER ISSUED';

          const challanRowBorder = isLastInChallan ? 'border-bottom: 2px solid #64748b;' : (isLastInBatch ? 'border-bottom: 1px solid #cbd5e1;' : 'border-bottom: 1px dashed #e2e8f0;');

          return `
            <tr style="${challanRowBorder} background: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
              ${isFirstInChallan ? `
                <td rowspan="${matCount}" style="text-align: center; font-weight: 800; font-family: monospace; font-size: 9.5px; vertical-align: middle; padding: 6px 4px; background: #f8fafc; border-right: 1px solid #cbd5e1;">
                  #${idx + 1}
                </td>
                <td rowspan="${matCount}" style="vertical-align: middle; padding: 6px 6px; border-right: 1px solid #cbd5e1;">
                  <span class="challan-badge">${log.id}</span>
                  ${matCount > 1 ? `<div style="font-size: 8px; color: #0284c7; font-weight: 800; margin-top: 3px;">(${matCount} Items)</div>` : ''}
                </td>
                <td rowspan="${matCount}" style="white-space: nowrap; font-size: 9px; vertical-align: middle; padding: 6px 5px; color: #334155; border-right: 1px solid #cbd5e1;">
                  <div style="font-weight: 700;">${log.date || '—'}</div>
                </td>
                <td rowspan="${matCount}" style="vertical-align: middle; padding: 6px 6px; line-height: 1.25; border-right: 1px solid #cbd5e1;">
                  <div style="font-size: 10.5px; font-weight: 900; color: #0f172a;">${lotDisplay}</div>
                  <div style="font-size: 8px; color: #475569; font-weight: 700; margin-top: 1px;">
                    ${brandDisplay ? `<span style="color: #0369a1; font-weight: 800;">${brandDisplay}</span> • ` : ''}W/O BOM
                  </div>
                </td>
              ` : ''}

              <td style="vertical-align: middle; padding: 5px 6px; border-right: 1px solid #cbd5e1;">
                ${m ? `
                  <div class="mat-item-row">
                    ${photo ? `<img src="${photo}" alt="${m.name || 'material'}" class="mat-thumb" onerror="this.style.display='none'" />` : ''}
                    <div class="mat-info">
                      <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                        ${cat ? `<span class="cat-badge">${cat.toUpperCase()}</span>` : ''}
                        ${batch.isPooled ? `<span class="pooled-badge">🏷️ POOLED ${batch.catKey.toUpperCase()}</span>` : ''}
                        <span class="mat-name"><strong>${m.name || m.bomItemName || 'Material'}</strong>${code ? ` <span class="mat-code">[${code}]</span>` : ''}</span>
                      </div>
                      <div class="mat-line-2">
                        <span class="mat-qty-badge">${matMetrics.formattedQty}${mult > 1 ? ` (×${mult})` : ''}</span>
                        ${loc ? `<span class="rack-badge">📍 ${loc}</span>` : ''}
                      </div>
                    </div>
                  </div>
                ` : '<span style="color: #94a3b8; font-style: italic;">No materials listed</span>'}
              </td>

              ${isFirstInBatch ? `
                <td rowspan="${batchItemCount}" style="text-align: right; vertical-align: middle; white-space: nowrap; padding: 6px 6px; background: ${batch.isPooled ? '#f8fafc' : 'inherit'}; border-right: 1px solid #cbd5e1;">
                  ${!isDirect && cuttingPieces > 0 ? `
                    <div style="font-weight: 900; font-size: 10.5px; color: #0f172a; line-height: 1.1;">
                      ${cuttingPieces.toLocaleString('en-IN')} <span style="font-size: 8.5px; color: #64748b;">Pcs</span>
                    </div>
                    <div style="font-size: 7.5px; font-weight: 800; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 2px; padding: 0.5px 3px; display: inline-block; margin-top: 2px;">
                      CUTTING
                    </div>
                  ` : `
                    <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">—</div>
                    <div style="font-size: 7.5px; color: #64748b;">${isDirect ? 'Direct' : 'No Lot Qty'}</div>
                  `}
                </td>

                <td rowspan="${batchItemCount}" style="text-align: center; vertical-align: middle; white-space: nowrap; padding: 6px 4px; background: ${batch.isPooled ? '#f8fafc' : 'inherit'}; border-right: 1px solid #cbd5e1;">
                  <div style="font-weight: 900; font-size: 10px; color: #0f172a;">
                    ${effectiveBatchMult === 1 ? '1 / Pc' : (effectiveBatchMult < 1 ? `÷${Math.round(1 / effectiveBatchMult)}` : `×${effectiveBatchMult}`)}
                  </div>
                  ${effectiveBatchMult !== 1 ? `<div style="font-size: 7.5px; color: #64748b; font-weight: 700; margin-top: 1px;">(${effectiveBatchMult} / Pc)</div>` : ''}
                  ${batch.isPooled ? `<div style="font-size: 7px; color: #1d4ed8; font-weight: 800; margin-top: 2px; text-transform: uppercase;">${batch.catKey} POOLED</div>` : ''}
                </td>

                <td rowspan="${batchItemCount}" style="text-align: right; font-weight: 900; vertical-align: middle; white-space: nowrap; padding: 6px 6px; background: ${batch.isPooled ? '#fff7ed' : 'inherit'}; border-right: 1px solid #cbd5e1;">
                  ${batch.isPooled ? `
                    <div style="font-size: 11px; font-weight: 900; color: #c2410c; line-height: 1.1;">
                      ${catIssueQty.toLocaleString('en-IN')} <span style="font-size: 8.5px;">Pcs</span>
                    </div>
                    <div style="font-size: 7.5px; font-weight: 800; color: #9a3412; text-transform: uppercase; margin-top: 2px;">
                      ${batch.catKey} TOTAL (${batch.items.length} ITEMS)
                    </div>
                    <div style="font-size: 7.5px; color: #64748b; font-weight: 600; margin-top: 1px;">
                      (${batch.items.map(it => it.m?.qty || 0).join(' + ')} Pcs)
                    </div>
                  ` : `
                    <div style="font-size: 10.5px; font-weight: 900; color: #ea580c; line-height: 1.1;">
                      ${matMetrics.formattedQty}
                    </div>
                    <div style="font-size: 7.5px; color: #9a3412; font-weight: 800; margin-top: 2px;">
                      ISSUED
                    </div>
                  `}
                </td>

                <td rowspan="${batchItemCount}" style="text-align: right; vertical-align: middle; white-space: nowrap; padding: 6px 6px; background: ${batch.isPooled ? '#f8fafc' : 'inherit'}; border-right: 1px solid #cbd5e1;">
                  ${hasCatVariance ? `
                    <div style="display: inline-block; padding: 1.5px 5px; border-radius: 3px; border: 1px solid ${catVariance === 0 ? '#bbf7d0' : catVariance > 0 ? '#bfdbfe' : '#fecaca'}; background: ${catVariance === 0 ? '#f0fdf4' : catVariance > 0 ? '#eff6ff' : '#fef2f2'}; color: ${catVariance === 0 ? '#15803d' : catVariance > 0 ? '#1d4ed8' : '#b91c1c'}; font-size: 9.5px; font-weight: 900; line-height: 1.1;">
                      ${catVarianceText}
                    </div>
                    <div style="font-size: 7.5px; font-weight: 800; color: ${catVariance === 0 ? '#166534' : catVariance > 0 ? '#1e40af' : '#991b1b'}; margin-top: 2px;">
                      ${catVarianceBadge}
                    </div>
                    ${batch.isPooled ? `<div style="font-size: 7px; color: #4338ca; font-weight: 800; margin-top: 1px;">${batch.catKey} POOLED</div>` : ''}
                  ` : `
                    <div style="color: #94a3b8; font-size: 10px; font-weight: 700;">—</div>
                    <div style="font-size: 7.5px; color: #64748b; margin-top: 1px;">${matMetrics.varianceBadge || (isDirect ? 'Direct Issue' : `Issued in ${matMetrics.unit}`)}</div>
                  `}
                </td>
              ` : ''}

              ${isFirstInChallan ? `
                <td rowspan="${matCount}" style="font-size: 9px; vertical-align: middle; padding: 6px 5px; color: #334155; font-weight: 600; white-space: nowrap; border-right: 1px solid #cbd5e1;">
                  ${log.personName || 'Store In-charge'}
                </td>
                <td rowspan="${matCount}" style="font-size: 9px; font-weight: 700; vertical-align: middle; padding: 6px 5px; color: #0f172a; border-right: 1px solid #cbd5e1;">
                  <div>${log.receiverName || 'Cutting Master'}</div>
                  ${log.receiverDept ? `<div style="font-weight: 600; color: #64748b; font-size: 7.5px; text-transform: uppercase;">(${log.receiverDept})</div>` : ''}
                </td>
                <td rowspan="${matCount}" style="font-size: 8.5px; color: #475569; max-width: 95px; word-break: break-word; vertical-align: middle; padding: 6px 5px; line-height: 1.2;">
                  ${log.remarks || '—'}
                </td>
              ` : ''}
            </tr>
          `;
        }).join('');
      }).join('');
    }).join('');

    // Check if there are real brands
    const hasRealBrands = Object.keys(brandSummaryMap).length > 0;

    // Build Brand-Wise Summary Section (Only when actual brands exist)
    const brandSectionsHtml = hasRealBrands ? Object.values(brandSummaryMap).map(bData => {
      const lotsArr = Array.from(bData.lots);
      const matItems = Object.values(bData.materials);
      const brandTotalQty = matItems.reduce((acc, m) => acc + m.totalQty, 0);

      return `
        <div class="summary-group-box">
          <div class="group-header">
            <div>
              <span class="group-title">BRAND: ${bData.brand.toUpperCase()}</span>
              ${lotsArr.length > 0 ? `<span class="group-sub">• Lots: ${lotsArr.map(l => `LOT #${l}`).join(', ')}</span>` : ''}
            </div>
            <div class="group-badge">
              Total Materials: <strong>${brandTotalQty.toLocaleString('en-IN')} Units / Pcs</strong>
            </div>
          </div>
          <table class="sub-table">
            <thead>
              <tr>
                <th style="width: 28px; text-align: center;">PHOTO</th>
                <th>MATERIAL / ACCESSORY NAME</th>
                <th style="width: 100px;">CATEGORY</th>
                <th style="width: 90px;">ITEM CODE</th>
                <th style="width: 120px; text-align: right;">TOTAL ISSUE QTY</th>
              </tr>
            </thead>
            <tbody>
              ${matItems.map(m => `
                <tr>
                  <td style="text-align: center;">
                    ${m.photo ? `<img src="${m.photo}" alt="${m.name}" class="mat-thumb" onerror="this.style.display='none'" />` : ''}
                  </td>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.componentType}</td>
                  <td style="font-family: monospace; font-weight: 700;">${m.itemCode || '—'}</td>
                  <td style="text-align: right; font-weight: 900; font-size: 8.5px; color: #000000;">
                    ${(Number(m?.totalQty) || 0).toLocaleString('en-IN')} ${m.unit}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('') : '';



    // Build Consolidated Material Summary (With Location / Rack No column)
    const materialListHtml = Object.values(materialSummaryMap).map(m => `
      <tr>
        <td style="text-align: center;">
          ${m.photo ? `<img src="${m.photo}" alt="${m.name}" class="mat-thumb" onerror="this.style.display='none'" />` : ''}
        </td>
        <td><strong>${m.name}</strong></td>
        <td style="font-family: monospace; font-weight: 700;">${m.itemCode || '—'}</td>
        <td style="font-weight: 700; color: #000000;">
          ${m.location ? `<span class="rack-badge">📍 ${m.location}</span>` : '<span style="color: #94a3b8;">—</span>'}
        </td>
        <td style="text-align: center; font-weight: 700;">${m.challanCount} Challan(s)</td>
        <td style="text-align: right; font-weight: 900; font-size: 8.5px; color: #000000;">
          ${(Number(m?.totalQty) || 0).toLocaleString('en-IN')} ${m.unit}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Without-BOM Material Issue Register &amp; Summary Report - Mohit Hosiery</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm 6mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          body {
            margin: 0;
            padding: 8px 10px;
            color: #0f172a;
            background: #ffffff;
            font-size: 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print-bar {
            background: #0f172a;
            color: #ffffff;
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          }
          .btn-print {
            background: #ea580c;
            color: #ffffff;
            border: none;
            padding: 8px 20px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          }
          .btn-close {
            background: #334155;
            color: #ffffff;
            border: none;
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0 !important; }
            thead { display: table-header-group !important; }
            tfoot { display: table-footer-group !important; }
            tr { page-break-inside: avoid !important; }
            .page-break { page-break-before: always; }
            .summary-group-box { page-break-inside: avoid !important; }
          }
          .header-box {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 6px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .company-title {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
            line-height: 1.1;
          }
          .doc-title {
            font-size: 12px;
            font-weight: 800;
            color: #1e293b;
            margin: 0;
            letter-spacing: 0.2px;
            line-height: 1.2;
          }
          .doc-sub {
            font-size: 9px;
            color: #475569;
            margin-top: 2px;
            line-height: 1.2;
            font-weight: 500;
          }
          .meta-info {
            text-align: right;
            font-size: 9px;
            color: #334155;
            line-height: 1.35;
          }
          .summary-strip {
            display: flex;
            gap: 6px;
            margin-bottom: 10px;
          }
          .summary-card {
            flex: 1;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            padding: 5px 8px;
            text-align: center;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          }
          .summary-card span {
            display: block;
            font-size: 7.5px;
            color: #64748b;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            line-height: 1;
          }
          .summary-card strong {
            display: block;
            font-size: 12.5px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 3px;
            line-height: 1.1;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            margin-bottom: 10px;
            border: 1px solid #94a3b8;
          }
          table.report-table th, table.report-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            vertical-align: middle;
            color: #0f172a;
            line-height: 1.25;
          }
          table.report-table th {
            background-color: #0f172a;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 8px;
            letter-spacing: 0.04em;
            text-align: left;
            color: #ffffff;
            padding: 6px 6px;
            border: 1px solid #1e293b;
          }
          .challan-badge {
            font-family: monospace;
            font-weight: 800;
            font-size: 9.5px;
            background: #fff7ed;
            color: #c2410c;
            padding: 1.5px 5px;
            border: 1px solid #fed7aa;
            border-radius: 3px;
            display: inline-block;
            white-space: nowrap;
          }
          .mat-item-row {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .mat-thumb {
            width: 24px;
            height: 24px;
            object-fit: cover;
            border-radius: 3px;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            flex-shrink: 0;
          }
          .mat-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
          }
          .mat-name {
            font-size: 9.5px;
            color: #0f172a;
            line-height: 1.2;
          }
          .mat-code {
            font-family: monospace;
            font-size: 8px;
            color: #64748b;
            font-weight: 700;
          }
          .mat-qty-badge {
            font-weight: 800;
            font-size: 8.5px;
            background: #f0fdf4;
            color: #15803d;
            border: 1px solid #bbf7d0;
            padding: 1px 5px;
            border-radius: 3px;
            display: inline-block;
          }
          .cat-badge {
            font-size: 7.5px;
            font-weight: 800;
            background: #f1f5f9;
            color: #1e293b;
            border: 1px solid #cbd5e1;
            padding: 1px 4px;
            border-radius: 3px;
            text-transform: uppercase;
            white-space: nowrap;
            letter-spacing: 0.3px;
            display: inline-block;
          }
          .pooled-badge {
            font-size: 7.5px;
            font-weight: 800;
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            padding: 1px 5px;
            border-radius: 3px;
            white-space: nowrap;
            display: inline-block;
          }
          .rack-badge {
            font-size: 7.5px;
            font-weight: 700;
            background: #fff7ed;
            color: #c2410c;
            border: 1px solid #fed7aa;
            padding: 1px 4px;
            border-radius: 3px;
            white-space: nowrap;
            display: inline-block;
          }
          .section-banner {
            background: #0f172a;
            color: #ffffff;
            padding: 5px 10px;
            font-size: 9.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin: 12px 0 6px 0;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .summary-group-box {
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            margin-bottom: 8px;
            background: #ffffff;
            overflow: hidden;
          }
          .group-header {
            background: #f8fafc;
            border-bottom: 1px solid #cbd5e1;
            padding: 5px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .group-title {
            font-weight: 900;
            font-size: 9.5px;
            color: #0f172a;
          }
          .group-sub {
            font-size: 8.5px;
            color: #475569;
            margin-left: 6px;
          }
          .group-badge {
            font-size: 9px;
            color: #0f172a;
          }
          table.sub-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          table.sub-table th, table.sub-table td {
            border: 1px solid #e2e8f0;
            padding: 4px 6px;
            vertical-align: middle;
            line-height: 1.2;
          }
          table.sub-table th {
            background: #f1f5f9;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 8px;
            color: #334155;
          }
          .footer-signs {
            margin-top: 18px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            page-break-inside: avoid;
          }
          .sign-box {
            border-top: 1.5px solid #0f172a;
            width: 170px;
            text-align: center;
            padding-top: 5px;
            font-weight: 800;
            color: #0f172a;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn-print" onclick="window.print()">🖨️ Print Full Report Now</button>
            <span style="font-size: 12px; color: #cbd5e1;">A4 Landscape • High-Contrast Black &amp; White with Photos</span>
          </div>
          <button class="btn-close" onclick="window.close()">✕ Close Preview</button>
        </div>

        <!-- 1. Header Box -->
        <div class="header-box">
          <div>
            <div class="company-title">MOHIT HOSIERY</div>
            <div class="doc-title">WITHOUT-BOM &amp; MATERIAL ISSUE REGISTER (AUDIT REPORT)</div>
            <div class="doc-sub">Central Store &amp; Accessories Department • Complete Floor Issue Track</div>
            ${filterBannerHtml}
          </div>
          <div class="meta-info">
            <div><strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Total Challans:</strong> ${totalChallans} Records</div>
            <div><strong>Total Units:</strong> ${totalQtyIssued.toLocaleString('en-IN')} Units / Pcs</div>
            <div><strong>Printed By:</strong> ${(currentUser?.name || 'STORE STAFF').toUpperCase()}</div>
          </div>
        </div>

        <!-- 2. Summary Metric Strip -->
        <div class="summary-strip">
          <div class="summary-card">
            <span>TOTAL CHALLANS</span>
            <strong>${totalChallans}</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL LINE ITEMS</span>
            <strong>${totalLineItems}</strong>
          </div>
          <div class="summary-card" style="background: #f8fafc;">
            <span style="color: #0f172a;">TOTAL PIECES (CUTTING)</span>
            <strong style="color: #0f172a;">${grandTotalPieces.toLocaleString('en-IN')} Pcs</strong>
          </div>
          <div class="summary-card" style="background: #fff7ed;">
            <span style="color: #c2410c;">TOTAL ISSUED</span>
            <strong style="color: #c2410c;">${totalQtyIssued.toLocaleString('en-IN')} Units / Pcs</strong>
          </div>
          <div class="summary-card" style="background: #f8fafc;">
            <span style="color: #0f172a;">TOTAL UNIQUE LOTS</span>
            <strong style="color: #0f172a;">${uniqueLots.size} Lot(s)</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL BRANDS</span>
            <strong>${uniqueBrands.size} Brand(s)</strong>
          </div>
        </div>

        <!-- 3. Main Challans Register Table -->
        <div style="margin-bottom: 3px; font-weight: 800; font-size: 9px; text-transform: uppercase;">
          1. Issue Challans / Bill Logs Register
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 28px; text-align: center;">SEQ #</th>
              <th style="width: 85px;">CHALLAN NO</th>
              <th style="width: 62px;">DATE</th>
              <th style="width: 95px;">LOT &amp; BRAND</th>
              <th>ISSUED MATERIALS (WITH PHOTO &amp; QTY)</th>
              <th style="width: 78px; text-align: right;">TOTAL PIECES (CUTTING)</th>
              <th style="width: 65px; text-align: center;">PER PC / MULT</th>
              <th style="width: 68px; text-align: right;">ISSUED QTY</th>
              <th style="width: 85px; text-align: right;">VARIANCE (CUTTING - ISSUE)</th>
              <th style="width: 65px;">ISSUED BY</th>
              <th style="width: 75px;">RECEIVED BY</th>
              <th style="width: 75px;">REMARKS</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 900; font-size: 9.5px; border-top: 2px solid #0f172a;">
              <td colspan="5" style="text-align: right; text-transform: uppercase; font-size: 9.5px; padding: 6px 6px; color: #0f172a;">
                REGISTER TOTAL (${totalChallans} CHALLANS):
              </td>
              <td style="text-align: right; font-weight: 900; font-size: 10px; white-space: nowrap; background: #f8fafc; padding: 6px 6px; color: #0f172a;">
                ${grandTotalPieces.toLocaleString('en-IN')} Pcs Cutting
              </td>
              <td style="text-align: right; font-weight: 900; font-size: 10px; color: #ea580c; white-space: nowrap; background: #fff7ed; padding: 6px 6px;">
                ${totalQtyIssued.toLocaleString('en-IN')} Units
              </td>
              <td style="text-align: right; font-weight: 900; font-size: 9px; white-space: nowrap; color: #166534; background: #f0fdf4; padding: 6px 6px;">
                Verified
              </td>
              <td colspan="3" style="font-size: 8.5px; color: #475569; font-weight: 700; padding: 6px 6px;">
                ${totalLineItems} Material Item Rows Across ${uniqueLots.size} Lot(s)
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- 2. Consolidated Material Grand Totals (With Location / Rack No) -->
        <div class="section-banner" style="margin-top: 12px;">
          <span>2. CONSOLIDATED MATERIAL GRAND TOTALS</span>
          <span style="font-size: 8.5px; font-weight: 600;">(Complete Material-wise Issue Volume Across All Lots)</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">PHOTO</th>
              <th>MATERIAL / ACCESSORY NAME</th>
              <th style="width: 90px;">ITEM CODE</th>
              <th style="width: 120px;">LOCATION / RACK NO</th>
              <th style="width: 95px; text-align: center;">CHALLAN COUNT</th>
              <th style="width: 120px; text-align: right;">GRAND TOTAL ISSUED</th>
            </tr>
          </thead>
          <tbody>
            ${materialListHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 900; font-size: 9.5px; border-top: 2px solid #0f172a;">
              <td colspan="4" style="text-align: right; text-transform: uppercase; padding: 6px 6px;">Overall Register Grand Total:</td>
              <td style="text-align: center; padding: 6px 6px;">${totalChallans} Challans</td>
              <td style="text-align: right; font-size: 10px; color: #0f172a; background: #f0fdf4; padding: 6px 6px;">
                <strong>${totalQtyIssued.toLocaleString('en-IN')} Units / Pcs</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- 7. Footer Signatures -->
        <div class="footer-signs">
          <div class="sign-box">Prepared / Issued By<br/><small style="font-weight: normal; color: #444;">Store In-charge</small></div>
          <div class="sign-box">Received By<br/><small style="font-weight: normal; color: #444;">Cutting Master</small></div>
          <div class="sign-box">Verified By<br/><small style="font-weight: normal; color: #444;">Floor Supervisor</small></div>
          <div class="sign-box">Authorized Signatory<br/><small style="font-weight: normal; color: #444;">Production Manager</small></div>
        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  return (
    <div className="without-bom-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ── TOP HERO HEADER & SUB-TABS ── */}
      <div className="panel" style={{
        padding: '14px 20px',
        borderRadius: '12px',
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(234, 88, 12, 0.25)',
            fontSize: '22px'
          }}>
            📦
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.2px' }}>
                {isMovementReport ? 'Material Issue' : 'Material Issue Without BOM'}
              </h3>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Direct material &amp; accessory issue with mandatory Lot Number allocation. Generates official printed Material Issue Without BOM Challan.
            </p>
          </div>
        </div>

        {/* Action Controls, Next Challan No & Requisition Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Next Challan No. Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            padding: '6px 14px',
            borderRadius: '10px'
          }}>
            <FileText size={16} style={{ color: '#2563eb' }} />
            <div>
              <div style={{ fontSize: '9px', fontWeight: '800', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Next Challan No.
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '900', color: '#1d4ed8' }}>
                {nextVoucherId}
              </div>
            </div>
          </div>

          {/* Requisition Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Requisition Type:</span>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              color: '#166534',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '800'
            }}>
              <Tag size={13} />
              <span>Direct Item Issue</span>
            </div>
          </div>

          {/* Sub-tab navigation */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              onClick={() => setActiveTab('issue')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'issue' ? '#0f172a' : 'transparent',
                color: activeTab === 'issue' ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} />
              <span>Issue Form</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'history' ? '#0f172a' : 'transparent',
                color: activeTab === 'history' ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Clock size={14} />
              <span>Challan / Bill Logs ({withoutBomLogs.length})</span>
            </button>
          </div>

          {/* Switch back to With BOM */}
          {typeof onSwitchToWithBom === 'function' && (
            <button
              type="button"
              onClick={onSwitchToWithBom}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Return to standard Approved Lot BOM Issue"
            >
              <ShieldCheck size={14} style={{ color: '#059669' }} />
              <span>Approved BOM Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* ── HIGH-VISIBILITY FLOATING ERROR TOAST (Portaled to document.body, positioned safely below top navbar) ── */}
      {formError && typeof document !== 'undefined' && createPortal(
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999999,
            maxWidth: 'min(92vw, 640px)',
            background: '#ffffff',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '12px 18px',
            boxShadow: '0 20px 45px rgba(220, 38, 38, 0.28), 0 4px 14px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Action Required
            </div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', marginTop: '2px', lineHeight: '1.3' }}>
              {formError}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormError('')}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              color: '#64748b',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>,
        document.body
      )}

      {/* In-Page Alerts Banner */}
      {formError && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: '#fef2f2',
          border: '1.5px solid #fca5a5',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Please Check Form
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b', marginTop: '1px' }}>
                {formError}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormError('')}
            style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#991b1b',
              cursor: 'pointer',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '800'
            }}
            title="Dismiss error"
          >
            <X size={13} />
            <span>Dismiss</span>
          </button>
        </div>
      )}

      {formSuccess && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={17} />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* ── TAB CONTENT: ISSUE FORM ── */}
      {activeTab === 'issue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── TOP 4 KPI / METRIC SUMMARY CARDS ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '14px'
          }}>
            {/* 1. Lot Number Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: '#f3e8ff',
                color: '#9333ea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Tag size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Lot Number
                </span>
                <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lotNo.trim() || '—'}
                </span>
                <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                  Mandatory Lot Number for allocation
                </span>
              </div>
            </div>

            {/* 2. Total Cutting Quantity Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Layers size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Cutting Quantity
                </span>
                <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                  {(Number(cuttingPieces) || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '700' }}>Pcs</span>
                </span>
                <span style={{ display: 'block', fontSize: '10.5px', color: activeLotCutting?.hasDetails ? '#15803d' : '#64748b', fontWeight: '600', marginTop: '2px' }}>
                  {activeLotCutting?.hasDetails ? '✓ Verified Cutting Sheet' : (cuttingPieces > 0 ? 'Batch quantity synced' : 'Enter lot # to fetch cutting')}
                </span>
              </div>
            </div>

            {/* 3. Base Quantity (+1%) Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Calculator size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Base Quantity (+1%)
                </span>
                <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                  {(Number(defaultAutoIssueQty) || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '700' }}>Pcs</span>
                </span>
                <span style={{ display: 'block', fontSize: '10.5px', color: '#16a34a', fontWeight: '600', marginTop: '2px' }}>
                  {cuttingPieces > 0 ? `(Cutting: ${(Number(cuttingPieces) || 0).toLocaleString()} + 1% = ${(Number(defaultAutoIssueQty) || 0).toLocaleString()})` : 'Default 1 unit base'}
                </span>
              </div>
            </div>

            {/* 4. Previously Issued Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: '#ffedd5',
                color: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Boxes size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Previously Issued
                </span>
                <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                  {previouslyIssuedForCurrentLot ? `${previouslyIssuedForCurrentLot.totalChallans} Challan${previouslyIssuedForCurrentLot.totalChallans > 1 ? 's' : ''}` : '0 Challans'}
                </span>
                <span style={{ display: 'block', fontSize: '10.5px', color: '#c2410c', fontWeight: '700', marginTop: '2px' }}>
                  {previouslyIssuedForCurrentLot ? `${(Number(previouslyIssuedForCurrentLot?.totalIssuedQty) || 0).toLocaleString('en-IN')} Pcs` : 'No prior issues'}
                </span>
              </div>
              {previouslyIssuedForCurrentLot && (
                <button
                  type="button"
                  onClick={() => {
                    const isDismissed = dismissedAlreadyIssuedLots.includes(previouslyIssuedForCurrentLot.lotNo);
                    if (isDismissed) {
                      setDismissedAlreadyIssuedLots(prev => prev.filter(l => l !== previouslyIssuedForCurrentLot.lotNo));
                      setShowAlreadyIssued(true);
                    } else {
                      setShowAlreadyIssued(prev => !prev);
                    }
                  }}
                  title="Toggle previously issued materials"
                  style={{
                    border: '1px solid #fed7aa',
                    background: (showAlreadyIssued && !dismissedAlreadyIssuedLots.includes(previouslyIssuedForCurrentLot.lotNo)) ? '#fff7ed' : '#ea580c',
                    color: (showAlreadyIssued && !dismissedAlreadyIssuedLots.includes(previouslyIssuedForCurrentLot.lotNo)) ? '#c2410c' : '#ffffff',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  {(showAlreadyIssued && !dismissedAlreadyIssuedLots.includes(previouslyIssuedForCurrentLot.lotNo)) ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{(showAlreadyIssued && !dismissedAlreadyIssuedLots.includes(previouslyIssuedForCurrentLot.lotNo)) ? 'Hide' : 'Show'}</span>
                </button>
              )}
            </div>
          </div>

          {/* ── 2-COLUMN SIDE-BY-SIDE SECTION: 1. ISSUE HEADER & 2. CUTTING DETAILS ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
            gap: '16px',
            alignItems: 'start'
          }}>
            {/* LEFT BOX: 1. Issue Header & Receiver Particulars */}
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}>
              {/* Header Bar */}
              <div style={{
                background: '#1e40af',
                color: '#ffffff',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '800' }}>
                  <User size={16} />
                  <span>1. Issue Header &amp; Receiver Particulars</span>
                </div>

              </div>

              {/* Form Grid */}
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Row 1: Lot Number, Brand Name, Requisition Purpose/Style */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  {/* Lot Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                      Lot Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={lotNoInputRef}
                        type="text"
                        list="existing-lots-list"
                        placeholder="e.g. 73088..."
                        value={lotNo}
                        onChange={(e) => {
                          setLotNo(e.target.value);
                          if (formError) setFormError('');
                        }}
                        required
                        style={{
                          width: '100%',
                          height: '36px',
                          padding: '0 10px 0 30px',
                          fontSize: '13px',
                          fontWeight: '800',
                          border: (formError && !lotNo.trim()) ? '2px solid #ef4444' : '1.5px solid #ea580c',
                          background: (formError && !lotNo.trim()) ? '#fef2f2' : '#fff7ed',
                          color: '#0f172a',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#ea580c' }} />
                      <datalist id="existing-lots-list">
                        {(designs || []).slice(0, 50).map(d => (
                          <option key={d.id} value={d.id}>{`Lot ${d.id} — ${d.category} (${d.brand || 'No Brand'})`}</option>
                        ))}
                      </datalist>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', marginTop: '3px', display: 'block' }}>
                      * Required: lot / cutting batch number
                    </span>
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                      Brand Name
                    </label>
                    <input
                      type="text"
                      list="existing-brands-list"
                      placeholder="e.g. Barbour..."
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                    <datalist id="existing-brands-list">
                      {availableBrands.map(b => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>

                  </div>

                  {/* Requisition Purpose / Style */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                      Requisition Purpose / Style
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LEATHER JACKET"
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Row 2: Person Name (Issuer), Received By (Receiver Person), Receiver Department / Line */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  {/* Person Name (Issuer) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                      Person Name (Issuer) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      ref={personNameInputRef}
                      type="text"
                      placeholder="e.g. ayush"
                      value={personName}
                      onChange={(e) => {
                        setPersonName(e.target.value);
                        if (formError) setFormError('');
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 10px',
                        fontSize: '12.5px',
                        border: (formError && !personName.trim()) ? '2px solid #ef4444' : '1px solid #cbd5e1',
                        background: (formError && !personName.trim()) ? '#fef2f2' : '#ffffff',
                        borderRadius: '6px',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                    {formError && !personName.trim() && (
                      <span style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: '800', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        ⚠️ Required: Please enter Person Name (Issuer)
                      </span>
                    )}
                  </div>

                  {/* Received By */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                      Received By (Receiver Person) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      ref={receiverNameInputRef}
                      type="text"
                      placeholder="e.g. Ramesh Master / Tailor / Floor Master"
                      value={receiverName}
                      onChange={(e) => {
                        setReceiverName(e.target.value);
                        if (formError) setFormError('');
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 10px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        border: (formError && !receiverName.trim()) ? '2px solid #ef4444' : '1.5px solid #fed7aa',
                        background: (formError && !receiverName.trim()) ? '#fef2f2' : '#ffffff',
                        borderRadius: '6px',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                    {formError && !receiverName.trim() && (
                      <span style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: '800', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        ⚠️ Required: Please enter Received By (Cutting Master / Tailor)
                      </span>
                    )}
                  </div>

                  {/* Receiver Department */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                      Receiver Department / Line
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cutting"
                      value={receiverDept}
                      onChange={(e) => setReceiverDept(e.target.value)}
                      style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {commonDepts.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setReceiverDept(dept)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: receiverDept === dept ? '#0f172a' : '#f8fafc',
                            color: receiverDept === dept ? '#ffffff' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 3: Issue Date */}
                <div style={{ width: '200px' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT BOX: 2. Cutting Details & Batch Metrics */}
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}>
              {/* Header Bar */}
              <div style={{
                background: '#1e40af',
                color: '#ffffff',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '800' }}>
                  <Scissors size={16} />
                  <span>2. Cutting Details &amp; Batch Metrics</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: 'monospace', background: '#0f172a', color: '#ffffff', padding: '2px 8px', borderRadius: '5px' }}>
                    Lot #{lotNo.trim() || '—'}
                  </span>
                  {activeLotCutting?.hasDetails ? (
                    <span style={{ fontSize: '10.5px', fontWeight: '700', background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={11} /> Verified Cutting Sheet
                    </span>
                  ) : loadingActiveLotCutting ? (
                    <span style={{ fontSize: '10.5px', color: '#bae6fd', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <RefreshCw size={11} className="animate-spin" /> Checking...
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => reloadCuttingCache(true)}
                    disabled={isReloadingCuttingCache}
                    title="Reload cutting database"
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
                      borderRadius: '5px',
                      cursor: isReloadingCuttingCache ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={10} className={isReloadingCuttingCache ? "animate-spin" : ""} />
                    <span>{isReloadingCuttingCache ? 'Reloading...' : 'Reload (30m Auto)'}</span>
                  </button>
                </div>
              </div>

              {/* Sub-notice */}
              <div style={{ padding: '6px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                Lot #{lotNo.trim() || '—'} &bull; Auto-refreshes every 30m
              </div>

              {/* Body */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'start' }}>
                  {/* Specs Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Garment Style</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting?.style || styleName || '—'}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Fabric</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting?.fabric || '—'}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Brand / Buyer</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting?.brand || brandName || '—'}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Party Name</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting?.partyName || '—'}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Shades</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a' }}>{activeLotCutting?.shades || '—'}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Sizes</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a' }}>{activeLotCutting?.sizes || '—'}</span>
                    </div>
                  </div>

                  {/* Hero Total Cutting Quantity Box */}
                  <div style={{
                    minWidth: '135px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#15803d', marginBottom: '4px' }}>
                      <Shirt size={16} />
                      <span style={{ fontSize: '9.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Total Cutting Qty
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#14532d' }}>
                      {(Number(cuttingPieces) || 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '700' }}>Pcs</span>
                    </div>
                  </div>
                </div>

                {/* Matrix Toggle Button */}
                {activeLotCutting?.rows?.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setShowActiveCuttingMatrix(prev => !prev)}
                      style={{
                        width: '100%',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: '1px solid #bae6fd',
                        background: showActiveCuttingMatrix ? '#0284c7' : '#f0f9ff',
                        color: showActiveCuttingMatrix ? '#ffffff' : '#0369a1',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Eye size={13} />
                        <span>Cutting Ratio &amp; Color Matrix Breakdown ({activeLotCutting?.rows?.length || 0} Colors &bull; Total {(Number(activeLotCutting?.totalPieces) || 0).toLocaleString()} Pcs)</span>
                      </span>
                      <span>{showActiveCuttingMatrix ? 'Hide Matrix' : 'Show Matrix'}</span>
                    </button>

                    {/* Expandable Table */}
                    {showActiveCuttingMatrix && (
                      <div style={{ marginTop: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', overflowX: 'auto', maxHeight: '200px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                              <th style={{ padding: '5px 8px', fontWeight: '800' }}>Color / Shade</th>
                              <th style={{ padding: '5px 6px', fontWeight: '800', textAlign: 'center' }}>Table</th>
                              {activeSizes.map(sz => (
                                <th key={sz} style={{ padding: '5px 6px', fontWeight: '800', textAlign: 'center' }}>{sz}</th>
                              ))}
                              <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'right' }}>Total Pcs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeLotCutting.rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                <td style={{ padding: '5px 8px', fontWeight: '700', color: '#0f172a' }}>{row.color || '—'}</td>
                                <td style={{ padding: '5px 6px', textAlign: 'center', color: '#64748b' }}>{row.cuttingTable || '—'}</td>
                                {activeSizes.map(sz => (
                                  <td key={sz} style={{ padding: '5px 6px', textAlign: 'center', fontWeight: '600', color: Number(row.sizes?.[sz]) > 0 ? '#0f172a' : '#cbd5e1' }}>
                                    {row.sizes?.[sz] || 0}
                                  </td>
                                ))}
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>
                                  {(Number(row.totalPcs) || 0).toLocaleString()}
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
            </div>
          </div>

          {/* ── ALREADY ISSUED MATERIALS STANDALONE CARD WITH EYE HIDE/SHOW TOGGLE & CLOSE ── */}
          {previouslyIssuedForCurrentLot && !dismissedAlreadyIssuedLots.includes(previouslyIssuedForCurrentLot.lotNo) && (
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1.5px solid #fed7aa',
              padding: showAlreadyIssued ? '14px 18px' : '10px 18px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: showAlreadyIssued ? '12px' : '0',
                borderBottom: showAlreadyIssued ? '1px solid #fed7aa' : 'none',
                paddingBottom: showAlreadyIssued ? '10px' : '0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Boxes size={18} style={{ color: '#ea580c' }} />
                  <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#9a3412' }}>
                    Already Issued Materials for Lot #{previouslyIssuedForCurrentLot.lotNo}
                  </span>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '1px 8px', borderRadius: '12px' }}>
                    {previouslyIssuedForCurrentLot.materials.length} Item Issued
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11.5px', color: '#9a3412' }}>
                    ({previouslyIssuedForCurrentLot.totalChallans} challans):
                  </span>
                  {/* Eye Hide / Show Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowAlreadyIssued(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid #ea580c',
                      background: showAlreadyIssued ? '#fff7ed' : '#ea580c',
                      color: showAlreadyIssued ? '#c2410c' : '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title={showAlreadyIssued ? "Hide already issued items" : "Show already issued items"}
                  >
                    {showAlreadyIssued ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showAlreadyIssued ? 'Hide' : `Show (${previouslyIssuedForCurrentLot.materials.length} Items)`}</span>
                  </button>
                  {/* Close / Dismiss Button: If user clicks then NOT SHOW */}
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedAlreadyIssuedLots(prev => [...prev, previouslyIssuedForCurrentLot.lotNo]);
                      setShowAlreadyIssued(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid #fed7aa',
                      background: '#fff7ed',
                      color: '#9a3412',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Close and do not show this banner"
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {/* Items row - Shown when showAlreadyIssued is true */}
              {showAlreadyIssued && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {previouslyIssuedForCurrentLot.materials.map((m, mIdx) => (
                    <div
                      key={m.key || mIdx}
                      style={{
                        background: '#fffdfa',
                        border: '1px solid #fed7aa',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{m.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {m.category && <span style={{ fontWeight: '700', color: '#ea580c' }}>Label: {m.category} • </span>}
                          {m.itemCode && <span>Code: {m.itemCode}</span>}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                          Challan: <strong>{m.challans.map(c => c.id).join(', ')}</strong> {m.challans[0]?.date && `• ${m.challans[0].date.split(' ')[0]}`}
                        </div>
                      </div>
                      <div style={{
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        textAlign: 'right',
                        flexShrink: 0
                      }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#c2410c' }}>
                          {(Number(m?.totalQty) || 0).toLocaleString('en-IN')} {m.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SECTION 3: MATERIAL ALLOCATION & STOCK DEDUCTION GRID ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Toolbar Above Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '0 2px'
            }}>
              {/* Left: Barcode Scanner */}
              <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan Barcode / Enter Code..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    style={{
                      padding: '7px 10px 7px 30px',
                      borderRadius: '7px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '12.5px',
                      width: '240px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Scan size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  <Zap size={13} />
                  <span>Scan Add</span>
                </button>
              </form>

              {/* Right: Quick Component Select + Add Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={quickSelectedComponent}
                  onChange={(e) => setQuickSelectedComponent(e.target.value)}
                  style={{
                    height: '35px',
                    padding: '0 10px',
                    borderRadius: '7px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#0f172a',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Component --</option>
                  {allComponentTypes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    handleAddItemRow(quickSelectedComponent, '', 'choose');
                  }}
                  style={{
                    height: '35px',
                    padding: '0 16px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  <Plus size={14} />
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Table Container Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}>
              {/* Navy Banner */}
              <div style={{
                background: '#1e40af',
                color: '#ffffff',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '800' }}>
                  <Package size={16} />
                  <span>3. Material Allocation &amp; Stock Deduction Grid</span>
                </div>
                <span style={{ fontSize: '11px', color: '#bfdbfe' }}>
                  Select one or multiple items to issue. Inventory stock will be deducted and recorded on the official Challan / Bill.
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#1e3a8a', color: '#ffffff', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '10px 8px', width: '36px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px 12px', minWidth: '240px' }}>
                        Component / Type ({items.length})
                      </th>
                      <th style={{ padding: '10px 10px', width: '130px', textAlign: 'right' }}>Current Stock</th>
                      <th style={{ padding: '10px 8px', width: '120px', textAlign: 'center' }}>
                        <div>Base Qty</div>
                        <div style={{ fontSize: '9px', color: '#86efac', fontWeight: '700', textTransform: 'none' }}>
                          ({(Number(defaultAutoIssueQty) || 0).toLocaleString()})
                        </div>
                      </th>
                      <th style={{ padding: '10px 6px', width: '85px', textAlign: 'center' }}>
                        <div>Mult / Per Pc</div>
                        <div style={{ fontSize: '8.5px', color: '#cbd5e1', fontWeight: '600', textTransform: 'none' }}>
                          (× / ÷)
                        </div>
                      </th>
                      <th style={{ padding: '10px 6px', width: '90px', textAlign: 'center' }}>
                        <div>Multiplier</div>
                        <div style={{ fontSize: '8.5px', color: '#cbd5e1', fontWeight: '600', textTransform: 'none' }}>
                          (e.g. 10 / Pc)
                        </div>
                      </th>
                      <th style={{ padding: '10px 10px', width: '130px', textAlign: 'right' }}>
                        <div>Total Issue Qty</div>
                      </th>
                      <th style={{ padding: '10px 8px', width: '75px', textAlign: 'center' }}>Unit</th>
                      <th style={{ padding: '10px 10px', width: '110px', textAlign: 'right' }}>Balance</th>
                      <th style={{ padding: '10px 8px', width: '45px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const balance = Math.round(((item.availableStock || 0) - (Number(item.totalQty) || 0)) * 100) / 100;
                      const isShortage = item.materialId && balance < 0;
                      const photoUrl = getMaterialPhoto(item);
                      const hasSelectedAny = Boolean(String(item.componentType || '').trim() || String(item.materialId || '').trim() || String(item.materialName || '').trim());
                      const prior = getMaterialPriorIssueInfo(item, item.id);
                      const isFullyIssued = hasSelectedAny && Boolean(prior && prior.isFullyIssued);

                      return (
                        <React.Fragment key={item.id}>
                          <tr style={{ borderBottom: isFullyIssued ? 'none' : '1px solid #e2e8f0', background: isFullyIssued ? '#fff1f2' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc') }}>
                            {/* 1. Sequence # */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 8px', textAlign: 'center', fontWeight: '800', color: '#64748b' }}>
                              {idx + 1}
                            </td>

                            {/* 2. Component / Type & Store Material Item */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {/* Row 1: Component Selector */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <select
                                    value={item.componentType}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '__custom__') {
                                        handleUpdateItem(item.id, 'isCustomType', true);
                                        handleUpdateItem(item.id, 'customComponentType', '');
                                      } else if (val === '__manage__') {
                                        setShowManageTypesModal(true);
                                      } else {
                                        const nextPrior = getMaterialPriorIssueInfo({ componentType: val }, item.id);
                                        const targetBase = nextPrior.alreadyIssued > 0
                                          ? (nextPrior.isFullyIssued ? 0 : nextPrior.remainingBase)
                                          : (defaultAutoIssueQty > 0 ? defaultAutoIssueQty : 1);
                                        const { factor: mult } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
                                        const targetTotal = Math.ceil(targetBase * mult);

                                        handleUpdateItem(item.id, {
                                          componentType: val,
                                          isCustomType: false,
                                          materialId: '',
                                          materialName: '',
                                          itemCode: '',
                                          imageUrl: '',
                                          availableStock: 0,
                                          unit: (val === 'DORI' || val === 'ELASTIC') ? 'Mtr' : 'Pcs',
                                          baseQty: targetBase,
                                          totalQty: targetTotal
                                        });
                                      }
                                    }}
                                    style={{
                                      flex: 1,
                                      height: '32px',
                                      padding: '0 8px',
                                      borderRadius: '6px',
                                      border: !item.componentType ? '1.5px dashed #ea580c' : '1.5px solid #cbd5e1',
                                      fontSize: '11.5px',
                                      fontWeight: '700',
                                      background: !item.componentType ? '#fff7ed' : '#ffffff',
                                      color: !item.componentType ? '#c2410c' : '#0f172a',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {componentTypeOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Row 2: Searchable Material Dropdown OR Selected Material Card */}
                                {item.materialId ? (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    gap: '8px'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                      {photoUrl ? (
                                        <img
                                          src={photoUrl}
                                          alt={item.materialName}
                                          style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                          <Package size={14} />
                                        </div>
                                      )}
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {item.materialName}
                                        </div>
                                        {item.itemCode && (
                                          <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', fontWeight: '700' }}>
                                            {item.itemCode}
                                          </span>
                                        )}
                                        {prior.alreadyIssued > 0 && !isFullyIssued && (
                                          <div style={{
                                            marginTop: '3px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: '#fff7ed',
                                            border: '1px solid #fdba74',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            color: '#c2410c'
                                          }}>
                                            <span>⚠️ {(Number(prior.alreadyIssued) || 0).toLocaleString()} Pcs Already Issued {prior.isCategoryPooling ? `in Category (${prior.categoryKey})` : ''} • Rem Cutting: {(Number(prior.remainingBase) || 0).toLocaleString()} Pcs (Max with 1%: {(Number(prior.allowedWith1Pct) || 0).toLocaleString()} Pcs)</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(item.id, { materialId: '', materialName: '', itemCode: '', availableStock: 0 })}
                                      title="Change material"
                                      style={{
                                        fontSize: '10.5px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        background: '#ffffff',
                                        color: '#0284c7',
                                        cursor: 'pointer',
                                        fontWeight: '700'
                                      }}
                                    >
                                      Change
                                    </button>
                                  </div>
                                ) : (
                                  <SearchableMaterialDropdown
                                    materials={materials}
                                    value={item.materialId}
                                    componentType={item.isCustomType ? (item.customComponentType || '') : item.componentType}
                                    onChange={(matId) => handleSelectMaterial(item.id, matId)}
                                    placeholder={item.componentType ? `🔍 Select ${item.componentType}...` : "⚠️ Choose Category First..."}
                                    getPriorIssueInfo={getMaterialPriorIssueInfo}
                                  />
                                )}
                              </div>
                            </td>

                            {/* 3. Current Stock */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 10px', textAlign: 'right' }}>
                              {item.materialId ? (
                                <div>
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: '900',
                                    color: item.availableStock > 0 ? '#15803d' : '#dc2626'
                                  }}>
                                    {(Number(item?.availableStock) || 0).toLocaleString()} {item.unit}
                                  </span>
                                  {item.location && (
                                    <div style={{ fontSize: '10px', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', marginTop: '2px' }}>
                                      <span>📍 {item.location}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontWeight: '700' }}>—</span>
                              )}
                            </td>

                            {/* 4. Base Qty */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 8px', textAlign: 'center' }}>
                              {isFullyIssued ? (
                                <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: '800' }}>—</span>
                              ) : (() => {
                                const hasPrior = prior.alreadyIssued > 0;
                                const maxAllowed = hasPrior ? prior.allowedWith1Pct : defaultAutoIssueQty;
                                const remBase = hasPrior ? prior.remainingBase : cuttingPieces;

                                const rawBase = (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '')
                                  ? Number(item.baseQty)
                                  : (hasPrior ? prior.remainingBase : (cuttingPieces > 0 ? defaultAutoIssueQty : 1));

                                const isBaseExceeded = cuttingPieces > 0 && rawBase > maxAllowed;
                                const isBaseWithin = cuttingPieces > 0 && rawBase >= 0 && rawBase <= maxAllowed;
                                const excess = rawBase - maxAllowed;

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <input
                                      type="number"
                                      className="no-spin"
                                      step="any"
                                      min="0"
                                      value={item.baseQty !== undefined && item.baseQty !== null ? item.baseQty : (hasPrior ? prior.remainingBase : (cuttingPieces > 0 ? defaultAutoIssueQty : 1))}
                                      onChange={(e) => handleUpdateItem(item.id, 'baseQty', e.target.value)}
                                      style={{
                                        width: '80px',
                                        height: '34px',
                                        padding: '0 6px',
                                        borderRadius: '6px',
                                        border: isBaseExceeded ? '2px solid #ef4444' : isBaseWithin ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
                                        background: isBaseExceeded ? '#fef2f2' : isBaseWithin ? '#f0fdf4' : '#ffffff',
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        color: isBaseExceeded ? '#b91c1c' : '#0f172a',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                    {isBaseExceeded && (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#dc2626', background: '#fee2e2', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                                          ⚠️ &gt;1% (+{excess}) Req
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateItem(item.id, 'baseQty', maxAllowed)}
                                          style={{ fontSize: '9px', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '3px', cursor: 'pointer', fontWeight: '800', padding: '1px 4px' }}
                                          title={"Reset to remaining 1% allowance (" + maxAllowed + ")"}
                                        >
                                          Set 1% ({maxAllowed})
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* 5. Mult / Divide Operator */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 6px', textAlign: 'center' }}>
                              {isFullyIssued ? (
                                <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: '800' }}>—</span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextOp = item.multiplierOp === 'divide' ? 'multiply' : 'divide';
                                      handleUpdateItem(item.id, 'multiplierOp', nextOp);
                                    }}
                                    title={"Toggle Multiply (×) / Divide (÷). Currently: " + (item.multiplierOp === 'divide' ? 'Divide (÷)' : 'Multiply (×)')}
                                    style={{
                                      border: item.multiplierOp === 'divide' ? '1.5px solid #f59e0b' : '1.5px solid #6366f1',
                                      background: item.multiplierOp === 'divide' ? '#fef3c7' : '#e0e7ff',
                                      color: item.multiplierOp === 'divide' ? '#b45309' : '#4338ca',
                                      borderRadius: '6px',
                                      fontSize: '15px',
                                      fontWeight: '900',
                                      cursor: 'pointer',
                                      height: '34px',
                                      width: '34px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {item.multiplierOp === 'divide' ? '÷' : '×'}
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* 6. Multiplier / Divide Value */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 6px', textAlign: 'center' }}>
                              {isFullyIssued ? (
                                <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: '800' }}>—</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <input
                                    type="text"
                                    placeholder={item.multiplierOp === 'divide' ? '12 or 1/12' : '1'}
                                    value={item.multiplier !== undefined && item.multiplier !== null ? item.multiplier : 1}
                                    onChange={(e) => handleUpdateItem(item.id, 'multiplier', e.target.value)}
                                    style={{
                                      width: '68px',
                                      height: '34px',
                                      padding: '0 6px',
                                      borderRadius: '6px',
                                      border: item.multiplierOp === 'divide' ? '1.5px solid #f59e0b' : '1.5px solid #6366f1',
                                      background: item.multiplierOp === 'divide' ? '#fffbeb' : '#f5f3ff',
                                      fontSize: '13px',
                                      fontWeight: '800',
                                      color: item.multiplierOp === 'divide' ? '#b45309' : '#4338ca',
                                      textAlign: 'center',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                  {(() => {
                                    const compCat = String(item.componentType || item.category || '').toUpperCase();
                                    const matName = String(item.name || item.bomItemName || item.materialName || '').toUpperCase();
                                    const isBtn = compCat.includes('BUTTON') || matName.includes('BUTTON');
                                    return (
                                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        {(isBtn ? [10, 9, 8, 14, 1] : [1, 10]).map(val => (
                                          <button
                                            key={val}
                                            type="button"
                                            onClick={() => handleUpdateItem(item.id, { multiplier: val, multiplierOp: 'multiply' })}
                                            style={{
                                              fontSize: '8px',
                                              fontWeight: '800',
                                              padding: '1px 3px',
                                              borderRadius: '3px',
                                              border: Number(item.multiplier) === val && item.multiplierOp !== 'divide' ? '1px solid #4338ca' : '1px solid #cbd5e1',
                                              background: Number(item.multiplier) === val && item.multiplierOp !== 'divide' ? '#4338ca' : '#f8fafc',
                                              color: Number(item.multiplier) === val && item.multiplierOp !== 'divide' ? '#ffffff' : '#475569',
                                              cursor: 'pointer'
                                            }}
                                            title={`Set Multiplier to ${val} / Pc`}
                                          >
                                            {val === 1 ? '1/Pc' : `×${val}`}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </td>

                            {/* 7. Total Issue Qty */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 10px', textAlign: 'right' }}>
                              {isFullyIssued ? (
                                <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: '800' }}>—</span>
                              ) : (() => {
                                const qty = Number(item.totalQty) || 0;
                                const liveMat = (materials || []).find(m => String(m.id) === String(item.materialId));
                                const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(item.availableStock) || 0);
                                const hasMaterial = Boolean(item.materialId && item.entryMode !== 'manual');
                                const isStockShortage = hasMaterial && qty > rackStock;
                                const baseVal = (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '')
                                  ? Number(item.baseQty)
                                  : (cuttingPieces > 0 ? defaultAutoIssueQty : 1);

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                    <input
                                      type="number"
                                      className="no-spin"
                                      step="1"
                                      min="1"
                                      value={item.totalQty || ''}
                                      onChange={(e) => handleUpdateItem(item.id, 'totalQty', Math.ceil(parseFloat(e.target.value) || 0))}
                                      style={{
                                        width: '90px',
                                        height: '34px',
                                        padding: '0 8px',
                                        borderRadius: '6px',
                                        border: isStockShortage ? '2px solid #dc2626' : '1.5px solid #cbd5e1',
                                        background: isStockShortage ? '#fef2f2' : '#ffffff',
                                        textAlign: 'right',
                                        fontSize: '13px',
                                        fontWeight: '900',
                                        color: isStockShortage ? '#b91c1c' : '#0f172a',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                    {(() => {
                                      const { factor } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
                                      const rawCalc = Math.round(baseVal * factor * 100) / 100;
                                      const hasDec = rawCalc % 1 !== 0;
                                      return (
                                        <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '700', marginTop: '1px', whiteSpace: 'nowrap' }}>
                                          {item.multiplierOp === 'divide'
                                            ? `(= ${baseVal.toLocaleString('en-IN')} ÷ ${item.multiplier || 12} = ${rawCalc}${hasDec ? ` → ${qty}` : ''})`
                                            : `(= ${baseVal.toLocaleString('en-IN')} × ${item.multiplier !== undefined ? item.multiplier : 1} = ${rawCalc}${hasDec ? ` → ${qty}` : ''})`}
                                        </span>
                                      );
                                    })()}
                                    {isStockShortage && (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                                          ⛔ Shortage!
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateItem(item.id, 'totalQty', rackStock)}
                                          style={{ fontSize: '9px', color: '#b91c1c', background: '#ffffff', border: '1px solid #f87171', borderRadius: '3px', cursor: 'pointer', fontWeight: '800', padding: '1px 4px' }}
                                        >
                                          Set to Rack ({rackStock})
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* 8. Unit (Locked) */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 8px', textAlign: 'center' }}>
                              {isFullyIssued ? (
                                <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '700' }}>{item.unit || 'Pcs'}</span>
                              ) : (
                                <span
                                  style={{
                                    minWidth: '55px',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#334155',
                                    fontSize: '11.5px',
                                    fontWeight: '800',
                                    textAlign: 'center',
                                    display: 'inline-block',
                                    userSelect: 'none',
                                    cursor: 'not-allowed',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Unit is locked from material inventory and cannot be changed"
                                >
                                  {item.unit || 'Pcs'}
                                </span>
                              )}
                            </td>

                            {/* 9. Balance */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 10px', textAlign: 'right' }}>
                              {isFullyIssued ? (
                                <span style={{ color: '#94a3b8', fontWeight: '800', fontSize: '16px' }}>—</span>
                              ) : item.materialId ? (
                                <span style={{
                                  fontWeight: '900',
                                  color: isShortage ? '#dc2626' : '#1e3a8a',
                                  fontSize: '12.5px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {(Number(balance) || 0).toLocaleString()} {item.unit}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontWeight: '700' }}>—</span>
                              )}
                            </td>

                            {/* 10. Action: Delete */}
                            <td style={{ verticalAlign: 'middle', padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(item.id)}
                                style={{
                                  height: '32px',
                                  width: '32px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Delete row"
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>

                          {/* IF ALREADY FULLY ISSUED ACCORDING TO LOT: SHOW OUTSIDE THE BOX COMPLETELY ACROSS THE FULL ROW */}
                          {isFullyIssued && (
                            <tr key={`${item.id}-already-issued-alert`} style={{ background: '#fff1f2' }}>
                              <td colSpan={10} style={{ padding: '10px 16px', borderBottom: '2px solid #fecdd3' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px',
                                  flexWrap: 'wrap',
                                  background: '#ffffff',
                                  border: '1.5px solid #f43f5e',
                                  borderRadius: '8px',
                                  padding: '8px 14px',
                                  boxShadow: '0 2px 4px rgba(244, 63, 94, 0.08)'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: '#e11d48',
                                      color: '#ffffff',
                                      fontSize: '13px',
                                      fontWeight: '900',
                                      flexShrink: 0
                                    }}>⛔</span>
                                    <div>
                                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#9f1239', letterSpacing: '0.2px' }}>
                                        ALREADY FULL ISSUE ACCORDING TO LOT. IF YOU WANT EXTRA, GO TO EXTRA MATERIAL ISSUE AND ISSUE MATERIAL.
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#be123c', fontWeight: '700', marginTop: '2px' }}>
                                        Lot #{lotNo || 'N/A'} • {prior.isCategoryPooling ? `Category: ${prior.categoryKey} • Already Issued in Category: ${(Number(prior.alreadyIssued) || 0).toLocaleString()} Pcs (Across Brands) • Rem Cutting: 0 Pcs` : `Already Issued: ${(Number(prior.alreadyIssued) || 0).toLocaleString()} Pcs • Item Code: ${item.itemCode || 'N/A'}`} • Material: {item.materialName || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sessionStorage.setItem('extra_issue_prefill_lot', lotNo || '');
                                      sessionStorage.setItem('extra_issue_prefill_code', item.itemCode || '');
                                      sessionStorage.setItem('extra_issue_prefill_material', item.materialName || '');
                                      if (typeof onRedirectToTab === 'function') {
                                        onRedirectToTab('extra_material_issue');
                                      } else {
                                        alert('Please open "Extra Material Issue" from the sidebar menu to issue additional material.');
                                      }
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '7px 16px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                                      color: '#ffffff',
                                      fontSize: '12px',
                                      fontWeight: '900',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      boxShadow: '0 2px 4px rgba(225, 29, 72, 0.35)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Open Extra Material Issue"
                                  >
                                    <span>⚡ Go to Extra Material Issue &rarr;</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Bottom Action: Add Row & Remarks */}
              <div style={{
                padding: '12px 16px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleAddItemRow('', '', 'choose')}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '7px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Row</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setItems(prev => prev.map(item => {
                        const prior = getMaterialPriorIssueInfo(item, item.id);
                        const targetBase = prior.alreadyIssued > 0 ? prior.allowedWith1Pct : defaultAutoIssueQty;
                        const { factor } = computeEffectiveFactor(item.multiplier, item.multiplierOp);
                        const total = Math.ceil(targetBase * factor);
                        return { ...item, baseQty: targetBase, totalQty: total > 0 ? total : (targetBase === 0 ? 0 : 1) };
                      }));
                      setFormSuccess(`✓ Reset all items to 1% cutting allowance (${(Number(defaultAutoIssueQty) || 0).toLocaleString()} Pcs)`);
                      setTimeout(() => setFormSuccess(''), 3000);
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RotateCcw size={13} />
                    <span>Reset Base to 1% ({(Number(defaultAutoIssueQty) || 0).toLocaleString()})</span>
                  </button>
                </div>

                {/* Remarks input */}
                <div style={{ minWidth: '240px', flex: '1', maxWidth: '380px' }}>
                  <input
                    type="text"
                    placeholder="Optional allocation notes / floor remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                      background: '#ffffff'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. BOTTOM ACTION & SUMMARY BAR ── */}
          <div style={{
            position: 'relative',
            marginTop: '16px',
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            {/* Left Metrics */}
            <div style={{ display: 'flex', gap: '22px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                    Total Items
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a' }}>
                    {items.filter(i => i.materialId || i.materialName).length} Materials
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                    Total Issue Quantity
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a' }}>
                    {(Number(totalIssueQuantitySum) || 0).toLocaleString()} Pcs
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                    Destination
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#15803d' }}>
                    {receiverDept || 'Cutting'} &bull; {receiverName || 'To Be Assigned'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tag size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                    Mode
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#ea580c' }}>
                    {lotNo.trim() ? `Lot #${lotNo.trim()}` : '⚠️ Lot # Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Preview Button */}
              <button
                type="button"
                onClick={handlePreviewOnly}
                style={{
                  padding: '9px 15px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={15} />
                <span>Preview Challan</span>
              </button>

              {/* Direct Print Button */}
              <button
                type="button"
                onClick={handleDirectPrintFromForm}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Print official Material Issue Without BOM Challan"
              >
                <Printer size={15} style={{ color: '#ea580c' }} />
                <span>Print Challan</span>
              </button>

              {/* Direct Save PDF Button */}
              <button
                type="button"
                onClick={handleSavePdfFromForm}
                style={{
                  padding: '9px 15px',
                  borderRadius: '8px',
                  border: '1.5px solid #dc2626',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Save & Download Challan Slip as PDF"
              >
                <Download size={15} style={{ color: '#dc2626' }} />
                <span>Save PDF</span>
              </button>

              {/* Error Notice in bottom bar if error exists */}
              {formError && (
                <div style={{
                  background: '#fee2e2',
                  border: '1.5px solid #ef4444',
                  color: '#9f1239',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  maxWidth: '380px'
                }}>
                  <span style={{ fontSize: '14px' }}>⛔</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError('')}
                    style={{ background: 'transparent', border: 'none', color: '#9f1239', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Confirm & Issue Button */}
              <button
                type="button"
                disabled={submitting || hasShortageItems}
                onClick={handleSubmitIssue}
                style={{
                  padding: '11px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: hasShortageItems
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  cursor: (submitting || hasShortageItems) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: hasShortageItems ? 'none' : '0 4px 14px rgba(22, 163, 74, 0.35)',
                  transition: 'all 0.2s',
                  opacity: hasShortageItems ? 0.75 : 1
                }}
              >
                <Zap size={16} />
                <span>
                  {hasShortageItems
                    ? '⛔ Stock Shortage in Rack'
                    : submitting
                      ? 'Issuing Challan...'
                      : '⚡ Confirm Issue & Give Challan / Bill'}
                </span>
              </button>

              {/* Reset / Clear Form */}
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title="Clear and refill all columns for a fresh issue"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── TAB CONTENT: WITHOUT-BOM HISTORY ── */}
      {activeTab === 'history' && (
        <div className="panel" style={{ padding: '14px 14px', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                {isMovementReport ? 'Material Issue Challan / Bill Logs' : 'Without-BOM & Item Issue Challan / Bill Logs'}
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                {isMovementReport ? 'Audit history and cutting variance of all store material issue slips and challans.' : 'Audit history of all material issue slips and challans generated without approved BOM.'}
              </p>
            </div>

            {/* Search & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '260px' }}>
                <input
                  type="text"
                  placeholder="Search Bill No, Material, Receiver..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 30px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handlePrintFullHistoryReport}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #0f172a',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Print full audit register with material photos, brand-wise and lot-wise summaries"
              >
                <Printer size={14} style={{ color: '#ea580c' }} />
                <span>Print Full Report ({withoutBomLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={handleExportFullReportPdf}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #dc2626',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Export full filtered audit register with items, quantities, and departments to PDF document"
              >
                <Download size={14} style={{ color: '#ffffff' }} />
                <span>Export PDF ({withoutBomLogs.length})</span>
              </button>
            </div>
          </div>

          {/* ── INTERACTIVE MULTI-FILTER PANEL (Dates, Categories Multi-Select, Person) ── */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* ROW 1: Date Filter + Person Filter + Reset Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>

              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={14} style={{ color: '#ea580c' }} />
                  Dates Wise:
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ffffff', padding: '3px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    title="From Date"
                    style={{ border: 'none', background: 'transparent', fontSize: '11.5px', color: '#0f172a', fontWeight: '600', outline: 'none' }}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>to</span>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    title="To Date"
                    style={{ border: 'none', background: 'transparent', fontSize: '11.5px', color: '#0f172a', fontWeight: '600', outline: 'none' }}
                  />
                  {(historyDateFrom || historyDateTo) && (
                    <button
                      type="button"
                      onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }}
                      title="Clear Dates"
                      style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Quick Date Presets */}
                <div style={{ display: 'inline-flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleSetToday}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: (historyDateFrom && historyDateFrom === new Date().toISOString().split('T')[0] && historyDateTo === historyDateFrom) ? '#0f172a' : '#ffffff',
                      color: (historyDateFrom && historyDateFrom === new Date().toISOString().split('T')[0] && historyDateTo === historyDateFrom) ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleSetYesterday}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={handleSetLast7Days}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Last 7 Days
                  </button>
                </div>
              </div>

              {/* Person Filter - Multi-Select Choose Option */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <User size={14} style={{ color: '#0284c7' }} />
                  Person Wise:
                </span>

                {/* Multi-Select Person Dropdown Menu Trigger Container */}
                <div ref={personDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    onClick={() => setPersonDropdownOpen(prev => !prev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: historyPersons.length > 0 ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: historyPersons.length > 0 ? '#f0f9ff' : '#ffffff',
                      color: historyPersons.length > 0 ? '#0369a1' : '#0f172a',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: historyPersons.length > 0 ? '0 1px 4px rgba(2,132,199,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    title="Click to select multiple Store Issuers or Floor Receivers"
                  >
                    <User size={13} style={{ color: historyPersons.length > 0 ? '#0284c7' : '#64748b' }} />
                    <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {historyPersons.length === 0
                        ? `All Persons (${availablePeople.total})`
                        : historyPersons.length === 1
                          ? formatPersonKey(historyPersons[0])
                          : `${formatPersonKey(historyPersons[0])} +${historyPersons.length - 1} more`}
                    </span>
                    {historyPersons.length > 0 && (
                      <span style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '1px 6px',
                        borderRadius: '10px'
                      }}>
                        {historyPersons.length}
                      </span>
                    )}
                    <ChevronDown size={13} style={{ transform: personDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: '#64748b', marginLeft: '2px' }} />
                  </button>

                  {/* The Floating Scrollable Person Dropdown Menu (Right-Aligned to prevent overflow) */}
                  {personDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 150,
                      width: '300px',
                      maxWidth: 'calc(100vw - 24px)',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.22), 0 8px 16px -6px rgba(15, 23, 42, 0.12)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      {/* Search & Quick Action Buttons */}
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                          <input
                            type="text"
                            placeholder="Search Store or Floor person..."
                            value={personSearchTerm}
                            onChange={(e) => setPersonSearchTerm(e.target.value)}
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '6px 26px 6px 26px',
                              fontSize: '11.5px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              boxSizing: 'border-box',
                              outline: 'none',
                              background: '#ffffff'
                            }}
                          />
                          <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          {personSearchTerm && (
                            <X
                              size={12}
                              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }}
                              onClick={() => setPersonSearchTerm('')}
                            />
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const allKeys = [
                                ...availablePeople.issuers.map(p => p.key),
                                ...availablePeople.receivers.map(p => p.key)
                              ];
                              setHistoryPersons(allKeys);
                            }}
                            style={{
                              border: 'none',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              transition: 'background 0.1s ease'
                            }}
                          >
                            Select All ({availablePeople.total})
                          </button>
                          {historyPersons.length > 0 && (
                            <span style={{ fontSize: '10.5px', color: '#0369a1', fontWeight: '800' }}>
                              {historyPersons.length} selected
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setHistoryPersons([])}
                            style={{
                              border: 'none',
                              background: historyPersons.length > 0 ? '#fee2e2' : 'transparent',
                              color: historyPersons.length > 0 ? '#b91c1c' : '#64748b',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              transition: 'background 0.1s ease'
                            }}
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>

                      {/* Scrollable Person List */}
                      <div style={{
                        maxHeight: '260px',
                        overflowY: 'auto',
                        padding: '6px 8px'
                      }}>
                        {/* Store Team Section */}
                        {filteredPeople.issuers.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: '#0369a1',
                              background: '#f0f9ff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              marginBottom: '3px'
                            }}>
                              <span>Issued By (Store Team)</span>
                              <span>{filteredPeople.issuers.length}</span>
                            </div>
                            {filteredPeople.issuers.map(p => {
                              const isChecked = historyPersons.includes(p.key);
                              return (
                                <div
                                  key={p.key}
                                  onClick={() => handleToggleHistoryPerson(p.key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    background: isChecked ? '#e0f2fe' : 'transparent',
                                    transition: 'background 0.1s ease',
                                    fontSize: '12px',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                                    />
                                    <span style={{ fontWeight: isChecked ? '800' : '600', color: isChecked ? '#0369a1' : '#334155' }}>
                                      Store: {p.name}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    color: isChecked ? '#0284c7' : '#64748b',
                                    background: isChecked ? '#bae6fd' : '#f1f5f9',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: '700'
                                  }}>
                                    {p.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Floor / Masters Section */}
                        {filteredPeople.receivers.length > 0 && (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: '#4338ca',
                              background: '#eef2ff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              marginBottom: '3px'
                            }}>
                              <span>Received By (Floor / Masters)</span>
                              <span>{filteredPeople.receivers.length}</span>
                            </div>
                            {filteredPeople.receivers.map(p => {
                              const isChecked = historyPersons.includes(p.key);
                              return (
                                <div
                                  key={p.key}
                                  onClick={() => handleToggleHistoryPerson(p.key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    background: isChecked ? '#ede9fe' : 'transparent',
                                    transition: 'background 0.1s ease',
                                    fontSize: '12px',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      style={{ cursor: 'pointer', accentColor: '#4338ca' }}
                                    />
                                    <span style={{ fontWeight: isChecked ? '800' : '600', color: isChecked ? '#4338ca' : '#334155' }}>
                                      Floor: {p.name}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    color: isChecked ? '#4338ca' : '#64748b',
                                    background: isChecked ? '#ddd6fe' : '#f1f5f9',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: '700'
                                  }}>
                                    {p.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {filteredPeople.issuers.length === 0 && filteredPeople.receivers.length === 0 && (
                          <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                            No person found matching "{personSearchTerm}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset Filters button if any filter active */}
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fca5a5',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Clear all active filters"
                  >
                    <RefreshCw size={12} />
                    <span>Reset Filters ({activeFiltersCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* ROW 2: Category Multi-Select Scrollable Dropdown Menu */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              borderTop: '1px dashed #e2e8f0',
              paddingTop: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Tag size={13} style={{ color: '#7c3aed' }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap' }}>
                  Category Wise:
                </span>
              </div>

              {/* Scrollable Dropdown Menu Trigger Container */}
              <div ref={categoryDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(prev => !prev)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: historyCategories.length > 0 ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: historyCategories.length > 0 ? '#eff6ff' : '#ffffff',
                    color: historyCategories.length > 0 ? '#1d4ed8' : '#0f172a',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: historyCategories.length > 0 ? '0 1px 3px rgba(37,99,235,0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Click to open scrollable category multi-select menu"
                >
                  <Tag size={12} style={{ color: historyCategories.length > 0 ? '#2563eb' : '#64748b' }} />
                  <span>
                    {historyCategories.length === 0
                      ? `All Categories (${rawWithoutBomLogs.length})`
                      : historyCategories.length === 1
                        ? `${historyCategories[0]}`
                        : `${historyCategories.slice(0, 2).join(', ')}${historyCategories.length > 2 ? ` +${historyCategories.length - 2}` : ''}`}
                  </span>
                  {historyCategories.length > 0 && (
                    <span style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}>
                      {historyCategories.length}
                    </span>
                  )}
                  <ChevronDown size={13} style={{ transform: categoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: '#64748b' }} />
                </button>

                {/* The Floating Scrollable Dropdown Menu */}
                {categoryDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    left: 0,
                    zIndex: 100,
                    width: '300px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.2), 0 8px 12px -6px rgba(15, 23, 42, 0.12)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Header with Search and Quick Actions */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={categorySearchTerm}
                          onChange={(e) => setCategorySearchTerm(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px 8px 6px 26px',
                            fontSize: '11.5px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                        <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        {categorySearchTerm && (
                          <X
                            size={12}
                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }}
                            onClick={() => setCategorySearchTerm('')}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const allNames = availableHistoryCategories.map(c => c.name);
                            setHistoryCategories(allNames);
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}
                        >
                          Select All ({availableHistoryCategories.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryCategories([])}
                          style={{ border: 'none', background: 'transparent', color: '#64748b', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Category List */}
                    <div style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      padding: '4px 6px'
                    }}>
                      {/* "All Categories" row option */}
                      <div
                        onClick={() => setHistoryCategories([])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: historyCategories.length === 0 ? '#f1f5f9' : 'transparent',
                          transition: 'background 0.1s ease',
                          fontSize: '12px'
                        }}
                        onMouseEnter={(e) => { if (historyCategories.length !== 0) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (historyCategories.length !== 0) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={historyCategories.length === 0}
                            onChange={() => setHistoryCategories([])}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: historyCategories.length === 0 ? '800' : '600', color: historyCategories.length === 0 ? '#0f172a' : '#334155' }}>
                            All Categories (No Filter)
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '8px', fontWeight: '700' }}>
                          {rawWithoutBomLogs.length}
                        </span>
                      </div>

                      {filteredCategoryOptions.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                          No categories found matching "{categorySearchTerm}"
                        </div>
                      ) : (
                        filteredCategoryOptions.map(catItem => {
                          const isChecked = historyCategories.includes(catItem.name);
                          return (
                            <div
                              key={catItem.name}
                              onClick={() => handleToggleHistoryCategory(catItem.name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: isChecked ? '#eff6ff' : 'transparent',
                                transition: 'background 0.1s ease',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                              onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => { }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: isChecked ? '800' : '600', color: isChecked ? '#1d4ed8' : '#0f172a' }}>
                                  {catItem.name}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                color: isChecked ? '#ffffff' : '#64748b',
                                background: isChecked ? '#2563eb' : '#e2e8f0',
                                padding: '1px 6px',
                                borderRadius: '8px'
                              }}>
                                {catItem.count}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                        {historyCategories.length === 0 ? 'Showing all categories' : `${historyCategories.length} selected`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryDropdownOpen(false)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#0f172a',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Categories Display Tags */}
              {historyCategories.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Selected:</span>
                  {historyCategories.map(cat => (
                    <span
                      key={cat}
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#1d4ed8',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {cat}
                      <X
                        size={11}
                        style={{ cursor: 'pointer', opacity: 0.8 }}
                        onClick={() => handleToggleHistoryCategory(cat)}
                        title={`Remove ${cat}`}
                      />
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHistoryCategories([])}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* ROW 3: Active Filters Summary & Count Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11.5px',
              color: '#64748b',
              paddingTop: '6px',
              borderTop: '1px dashed #e2e8f0',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>
                  Showing <span style={{ color: '#ea580c', fontWeight: '900' }}>{withoutBomLogs.length}</span> of {rawWithoutBomLogs.length} Challans
                </span>

                {/* Badges for active filters */}
                {historyDateFrom && (
                  <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Calendar size={11} /> {historyDateFrom} to {historyDateTo || 'Today'}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }} />
                  </span>
                )}
                {historyCategories.length > 0 && (
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Tag size={11} /> {historyCategories.join(', ')}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setHistoryCategories([])} />
                  </span>
                )}
                {historyPersons.map(pKey => (
                  <span
                    key={pKey}
                    style={{
                      background: pKey.startsWith('iss:') ? '#e0f2fe' : '#ede9fe',
                      color: pKey.startsWith('iss:') ? '#0369a1' : '#4338ca',
                      border: pKey.startsWith('iss:') ? '1px solid #bae6fd' : '1px solid #ddd6fe',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <User size={11} /> {formatPersonKey(pKey)}
                    <X
                      size={10}
                      style={{ cursor: 'pointer', strokeWidth: 2.5 }}
                      onClick={() => handleToggleHistoryPerson(pKey)}
                      title={`Remove ${formatPersonKey(pKey)}`}
                    />
                  </span>
                ))}
                {historySearch && (
                  <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Search size={11} /> "{historySearch}"
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setHistorySearch('')} />
                  </span>
                )}
              </div>

              {activeFiltersCount > 0 && (
                <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: '700' }}>
                  Print button will export only these {withoutBomLogs.length} filtered records.
                </span>
              )}
            </div>
          </div>

          {withoutBomLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <FileText size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#475569' }}>
                {activeFiltersCount > 0 ? 'No Without-BOM challans match your selected filters.' : 'No Without-BOM issue slips found.'}
              </div>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                {activeFiltersCount > 0
                  ? 'Try broadening your dates, clearing category selection, or resetting filters.'
                  : 'Issue materials above to track them in this audit log.'}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  style={{
                    marginTop: '12px',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1.5px solid #0f172a',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* ── TABLE VIEW & DISPLAY CONTROLS BAR ── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '10px',
                padding: '8px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}>
                {/* Left: View Mode (Item-Wise vs Compact 1-Row) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    View Mode:
                  </span>
                  <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('item_wise')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '5px',
                        border: 'none',
                        background: historyViewMode === 'item_wise' ? '#0f172a' : 'transparent',
                        color: historyViewMode === 'item_wise' ? '#ffffff' : '#475569',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      title="Item-wise view: multi-item challans grouped together with merged columns (no repeated challan / buttons)"
                    >
                      <span>📑 Item-Wise (Merged Grouping)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('compact_row')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '5px',
                        border: 'none',
                        background: historyViewMode === 'compact_row' ? '#0f172a' : 'transparent',
                        color: historyViewMode === 'compact_row' ? '#ffffff' : '#475569',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      title="Compact 1-row view: strictly 1 row per challan with material tags & expandable accordion (ideal for 200+ overall history)"
                    >
                      <span>📋 Compact (1 Row / Challan)</span>
                    </button>
                  </div>
                </div>

                {/* Right: Expand All (in compact mode) + Density + Page Size */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {historyViewMode === 'compact_row' && (
                    <button
                      type="button"
                      onClick={handleToggleAllExpanded}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title="Expand or collapse details for all challans on screen"
                    >
                      {withoutBomLogs.length > 0 && withoutBomLogs.every(l => expandedChallanIds[l.id]) ? '▲ Collapse All' : '▼ Expand All Details'}
                    </button>
                  )}

                  {/* Spacing Density Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Density:</span>
                    <button
                      type="button"
                      onClick={() => handleSetDensity(historyDensity === 'compact' ? 'standard' : 'compact')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: historyDensity === 'compact' ? '#eff6ff' : '#ffffff',
                        color: historyDensity === 'compact' ? '#1d4ed8' : '#475569',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                      title="Toggle tight compact padding vs standard padding"
                    >
                      <span>{historyDensity === 'compact' ? '📏 Tight (Compact)' : '📐 Standard'}</span>
                    </button>
                  </div>

                  {/* Page Size Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Per Page:</span>
                    <div style={{ display: 'inline-flex', gap: '3px' }}>
                      {[25, 50, 100, 'all'].map(sz => {
                        const isSelected = String(historyPageSize) === String(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleSetPageSize(sz)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                              background: isSelected ? '#0f172a' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#475569',
                              fontSize: '11px',
                              fontWeight: isSelected ? '800' : '600',
                              cursor: 'pointer'
                            }}
                          >
                            {sz === 'all' ? 'All' : sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: totalPages > 1 ? '10px 10px 0 0' : '10px', background: '#ffffff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: historyDensity === 'compact' ? '11px' : '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 6px' : '8px 8px', width: '92px' }}>Challan #</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '78px' }}>Date</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 6px' : '8px 8px', width: '102px' }}>Lot / Type</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 8px' : '8px 10px', minWidth: '180px' }}>Issued Materials</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '82px', textAlign: 'right' }}>Cutting</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '80px', textAlign: 'center' }}>Per Pc / Mult</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '78px', textAlign: 'right' }}>Issued</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '88px', textAlign: 'right' }}>Variance</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '72px' }}>Issued By</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '82px' }}>Received By</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', minWidth: '95px' }}>Remarks</th>
                      <th style={{ padding: historyDensity === 'compact' ? '6px 5px' : '8px 6px', width: '112px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log, idx) => {
                      const rawLot = String(log.lotId || '').trim();
                      const cleanLot = rawLot.toLowerCase();
                      const isDirectLot = !cleanLot || cleanLot === 'w/o lot' || cleanLot.includes('w/o') || cleanLot.includes('without') || cleanLot.includes('no lot') || cleanLot.includes('direct');

                      const dateParts = String(log.date || '').split(' ');
                      const dateStr = dateParts[0] || '—';
                      const timeStr = dateParts.slice(1).join(' ');

                      const mats = (Array.isArray(log.materials) && log.materials.length > 0) ? log.materials : [null];
                      const matCount = mats.length;
                      const challanBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const padY = historyDensity === 'compact' ? '4px' : '7px';
                      const padX = historyDensity === 'compact' ? '6px' : '8px';
                      const cellPad = `${padY} ${padX}`;
                      const isExpanded = Boolean(expandedChallanIds[log.id]);

                      // ─────────── MODE 2: COMPACT 1-ROW / CHALLAN WITH ACCORDION ───────────
                      if (historyViewMode === 'compact_row') {
                        const challanMetrics = getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs);
                        return (
                          <React.Fragment key={log.id || idx}>
                            <tr
                              style={{
                                background: isExpanded ? '#f0fdf4' : challanBg,
                                borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              {/* Challan # */}
                              <td style={{ padding: cellPad, fontWeight: '800', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                                  <span style={{ fontFamily: 'monospace', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 5px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                    {log.id}
                                  </span>
                                  {matCount > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandChallan(log.id)}
                                      style={{
                                        fontSize: '9.5px',
                                        background: isExpanded ? '#0f172a' : '#f1f5f9',
                                        color: isExpanded ? '#ffffff' : '#475569',
                                        border: '1px solid #cbd5e1',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={isExpanded ? 'Collapse material items' : 'Expand material items'}
                                    >
                                      {isExpanded ? '▲' : '▼'} {matCount} items
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Date */}
                              <td style={{ padding: cellPad, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <div style={{ lineHeight: '1.2' }}>
                                  <div style={{ fontWeight: '700', color: '#334155', fontSize: '11px' }}>{dateStr}</div>
                                  {timeStr && <div style={{ fontSize: '9px', color: '#94a3b8' }}>{timeStr}</div>}
                                </div>
                              </td>

                              {/* Lot Reference */}
                              <td style={{ padding: cellPad, verticalAlign: 'middle' }}>
                                {isDirectLot ? (
                                  <span style={{ fontSize: '9.5px', background: '#f0fdf4', color: '#166534', padding: '1px 4px', borderRadius: '3px', fontWeight: '800', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                                    WITHOUT LOT
                                  </span>
                                ) : (
                                  <div style={{ lineHeight: '1.2' }}>
                                    <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                                      LOT #{log.lotId}
                                    </span>
                                    {(log.brand || log.brandName) && (
                                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '600' }}>
                                        {log.brand || log.brandName}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Issued Materials - Clean Inline Tags */}
                              <td style={{ padding: cellPad, verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {mats.slice(0, 2).map((m, mIdx) => {
                                    if (!m) return null;
                                    const cat = getMaterialCategory(m);
                                    return (
                                      <span
                                        key={mIdx}
                                        style={{
                                          fontSize: '10.5px',
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          color: '#1e293b',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {cat && <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '800' }}>[{cat}]</span>}
                                        <span><strong>{m.name || m.bomItemName || 'Item'}:</strong> {m.qty} {m.unit || 'Pcs'}{m.multiplier && Number(m.multiplier) > 1 ? ` (×${m.multiplier})` : ''}</span>
                                      </span>
                                    );
                                  })}
                                  {mats.length > 2 && (
                                    <span
                                      onClick={() => toggleExpandChallan(log.id)}
                                      style={{
                                        fontSize: '9.5px',
                                        color: '#0284c7',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        background: '#f0f9ff',
                                        border: '1px solid #bae6fd',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title="Click to view all items"
                                    >
                                      +{mats.length - 2} more...
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Cutting Total Pieces */}
                              <td style={{ padding: cellPad, textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {!isDirectLot && challanMetrics.totalPieces > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                    <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '11.5px' }}>
                                      {challanMetrics.totalPieces.toLocaleString('en-IN')} <span style={{ fontSize: '9.5px', color: '#64748b' }}>Pcs</span>
                                    </span>
                                    <span style={{ fontSize: '8px', fontWeight: '700', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0 3px', borderRadius: '2px' }}>
                                      Cutting
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>—</span>
                                )}
                              </td>

                              {/* Per Pc / Mult */}
                              <td style={{ padding: cellPad, textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                  <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '11px' }}>
                                    {challanMetrics.multDisplay || '1 / Pc'}
                                  </span>
                                  {challanMetrics.effectiveMult && challanMetrics.effectiveMult !== 1 && (
                                    <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '700' }}>
                                      ({challanMetrics.effectiveMult} / Pc)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Issued Total Qty */}
                              <td style={{ padding: cellPad, textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: '900', color: '#ea580c', fontSize: '11.5px' }}>
                                  {challanMetrics.formattedIssueQty}
                                </span>
                              </td>

                              {/* Variance */}
                              <td style={{ padding: cellPad, textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {challanMetrics.hasVariance ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      fontSize: '10.5px',
                                      fontWeight: '800',
                                      border: '1px solid',
                                      background: challanMetrics.variance === 0 ? '#f0fdf4' : challanMetrics.variance > 0 ? '#eff6ff' : '#fef2f2',
                                      borderColor: challanMetrics.variance === 0 ? '#bbf7d0' : challanMetrics.variance > 0 ? '#bfdbfe' : '#fecaca',
                                      color: challanMetrics.variance === 0 ? '#15803d' : challanMetrics.variance > 0 ? '#1d4ed8' : '#b91c1c'
                                    }}>
                                      {challanMetrics.varianceText}
                                    </span>
                                    <span style={{ fontSize: '8px', fontWeight: '800', color: challanMetrics.variance === 0 ? '#166534' : challanMetrics.variance > 0 ? '#1e40af' : '#991b1b' }}>
                                      {challanMetrics.varianceBadge}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                                )}
                              </td>

                              {/* Issued By */}
                              <td style={{ padding: cellPad, color: '#334155', fontWeight: '700', fontSize: '11px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {log.personName || 'Store'}
                              </td>

                              {/* Received By */}
                              <td style={{ padding: cellPad, color: '#0f172a', fontWeight: '700', fontSize: '11px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <div>{log.receiverName || 'Cutting'}</div>
                                {log.receiverDept && <div style={{ fontSize: '9px', color: '#64748b' }}>{log.receiverDept}</div>}
                              </td>

                              {/* Actions */}
                              {/* Remarks */}
                              <td style={{ padding: cellPad, color: '#475569', fontSize: '11px', verticalAlign: 'middle', maxWidth: '160px' }}>
                                {log.remarks ? (
                                  <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.remarks}>
                                    {log.remarks}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>

                              <td style={{ padding: cellPad, textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const issueData = buildIssueDataFromLog(log);
                                      handleDirectPrintWindow(issueData, log.id);
                                    }}
                                    style={{
                                      padding: '3px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #0f172a',
                                      background: '#0f172a',
                                      color: '#ffffff',
                                      fontSize: '10.5px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}
                                    title="Direct 1-Click Print"
                                  >
                                    <Printer size={11} style={{ color: '#ea580c' }} />
                                    <span>Print</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadChallanPdf(log)}
                                    style={{
                                      padding: '3px 5px',
                                      borderRadius: '4px',
                                      border: '1px solid #f87171',
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      fontSize: '10.5px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}
                                    title="Download Challan PDF"
                                  >
                                    <Download size={11} />
                                    <span>PDF</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReprintHistory(log)}
                                    style={{
                                      padding: '3px 5px',
                                      borderRadius: '4px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: '#475569',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    title="Preview on-screen"
                                  >
                                    <Eye size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Accordion Expanded Detail Drawer */}
                            {isExpanded && (
                              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                <td colSpan={12} style={{ padding: '8px 12px' }}>
                                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>
                                        Material Items in Challan <strong style={{ color: '#ea580c' }}>{log.id}</strong> ({matCount} items)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandChallan(log.id)}
                                        style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                      >
                                        Close ▲
                                      </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                                      {mats.map((m, mIdx) => {
                                        const matMetrics = getMaterialItemMetrics(m, log, materials, effectiveCuttingMap, designs);
                                        const photoSrc = m ? getMaterialPhoto(m) : null;
                                        const cat = m ? getMaterialCategory(m) : '';
                                        const loc = m ? getMaterialLocation(m) : '';
                                        return (
                                          <div
                                            key={mIdx}
                                            style={{
                                              border: '1px solid #cbd5e1',
                                              borderRadius: '6px',
                                              padding: '8px',
                                              background: '#fdfdfe',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px'
                                            }}
                                          >
                                            {photoSrc ? (
                                              <img
                                                src={photoSrc}
                                                alt={m?.name || 'material'}
                                                onClick={() => setMainPreviewPhoto({ url: photoSrc, name: m?.name || 'Material', itemCode: getItemCodeDisplay(m) || '' })}
                                                style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #059669', cursor: 'zoom-in', flexShrink: 0 }}
                                              />
                                            ) : (
                                              <div style={{ width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                                                <Package size={16} style={{ color: '#94a3b8' }} />
                                              </div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0, fontSize: '11px', lineHeight: '1.3' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                {cat && <span style={{ fontSize: '8.5px', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontWeight: '800', color: '#334155' }}>{cat}</span>}
                                                <strong style={{ color: '#0f172a' }}>{m?.name || m?.bomItemName || 'Material'}</strong>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: '800', color: '#ea580c' }}>{matMetrics.formattedQty}</span>
                                                {loc && <span style={{ fontSize: '9px', color: '#c2410c', background: '#fff7ed', padding: '0 4px', borderRadius: '2px', border: '1px solid #fed7aa' }}>{loc}</span>}
                                                {matMetrics.hasVariance && (
                                                  <span style={{ fontSize: '9px', fontWeight: '800', color: matMetrics.variance === 0 ? '#15803d' : matMetrics.variance > 0 ? '#1d4ed8' : '#b91c1c' }}>
                                                    {matMetrics.varianceText} ({matMetrics.varianceBadge})
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }

                      // ─────────── MODE 1: ITEM-WISE ROWS (MERGED GROUPING) ───────────
                      // Group materials by category for pooling same-category items in the same lot
                      const categoryBatches = [];
                      const catBatchMap = {};

                      mats.forEach((m, mIdx) => {
                        if (!m) {
                          categoryBatches.push({ catKey: '', isPc: false, items: [{ m: null, mIdx: 0 }], totalQty: 0, isPooled: false });
                          return;
                        }
                        const unit = String(m.unit || 'Pcs').trim().toLowerCase();
                        const isPc = unit === 'pcs' || unit === 'pc' || unit === 'piece' || unit === 'pieces';
                        const rawCat = getMaterialCategory(m);
                        const catKey = isPc ? normalizeCategoryKey(rawCat, m.name || m.bomItemName) : '';

                        // SAME CATEGORY -> SAME GROUP KEY (PLUS IT!)
                        // DIFFERENT CATEGORY -> DIFFERENT GROUP KEY (NOT PLUS!)
                        const groupKey = (!isDirectLot && isPc && catKey && catKey !== 'GENERAL') ? `${catKey}` : `__single_${mIdx}__`;

                        if (!catBatchMap[groupKey]) {
                          catBatchMap[groupKey] = {
                            groupKey,
                            catKey,
                            rawCat: rawCat || catKey,
                            unit: m.unit || 'Pcs',
                            isPc,
                            items: [],
                            totalQty: 0,
                            isPooled: false
                          };
                          categoryBatches.push(catBatchMap[groupKey]);
                        }
                        catBatchMap[groupKey].items.push({ m, mIdx });
                        catBatchMap[groupKey].totalQty += (Number(m.qty) || 0);
                        if (catBatchMap[groupKey].items.length > 1) {
                          catBatchMap[groupKey].isPooled = true;
                        }
                      });

                      let currentGlobalItemIdx = 0;

                      return (
                        <React.Fragment key={log.id || idx}>
                          {categoryBatches.map((batch, batchIdx) => {
                            const batchItemCount = batch.items.length;
                            return batch.items.map((itemObj, itemInBatchIdx) => {
                              const { m, mIdx } = itemObj;
                              const isFirstMat = currentGlobalItemIdx === 0;
                              const isLastMat = currentGlobalItemIdx === matCount - 1;
                              const isFirstInBatch = itemInBatchIdx === 0;
                              const isLastInBatch = itemInBatchIdx === batchItemCount - 1;
                              currentGlobalItemIdx++;

                              const matMetrics = getMaterialItemMetrics(m, log, materials, effectiveCuttingMap, designs);
                              const photoSrc = m ? getMaterialPhoto(m) : null;
                              const categoryName = m ? getMaterialCategory(m) : '';
                              const loc = m ? getMaterialLocation(m) : '';

                              // Category-wise totals & variance with Multiplier Target calculation
                              const cuttingPieces = isDirectLot ? 0 : matMetrics.cuttingPieces;
                              const categoryIssueQty = batch.totalQty;
                              const batchTargetRequired = (!isDirectLot && cuttingPieces > 0)
                                ? batch.items.reduce((sum, it) => sum + Math.round(cuttingPieces * getMaterialMultiplier(it.m, log, cuttingPieces)), 0)
                                : 0;
                              const effectiveBatchMult = cuttingPieces > 0 && batchTargetRequired > 0
                                ? Number((batchTargetRequired / cuttingPieces).toFixed(2))
                                : (batch.items.length === 1 ? getMaterialMultiplier(batch.items[0].m, log, cuttingPieces) : 1);
                              const categoryVariance = cuttingPieces > 0 ? (batchTargetRequired - categoryIssueQty) : 0;
                              const hasCategoryVariance = !isDirectLot && cuttingPieces > 0 && batch.isPc;
                              const categoryVarianceText = categoryVariance > 0 ? `+${categoryVariance.toLocaleString('en-IN')} Pcs` : `${categoryVariance.toLocaleString('en-IN')} Pcs`;
                              const categoryVarianceBadge = categoryVariance === 0 ? 'BALANCED' : categoryVariance > 0 ? 'CUTTING BALANCE' : 'OVER ISSUED';

                              return (
                                <tr
                                  key={`${log.id || idx}-${mIdx}`}
                                  style={{
                                    background: challanBg,
                                    borderBottom: isLastMat ? '1.5px solid #cbd5e1' : undefined
                                  }}
                                >
                                  {/* Challan # - Merged with rowSpan for clean grouping */}
                                  {isFirstMat && (
                                    <td
                                      rowSpan={matCount}
                                      style={{
                                        padding: cellPad,
                                        fontWeight: '800',
                                        verticalAlign: 'middle',
                                        background: challanBg,
                                        borderBottom: '2px solid #cbd5e1',
                                        borderRight: '1px solid #f1f5f9'
                                      }}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <span style={{ fontFamily: 'monospace', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 5px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', width: 'fit-content' }}>
                                          {log.id}
                                        </span>
                                        {matCount > 1 && (
                                          <span style={{ fontSize: '9px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '1px 4px', borderRadius: '3px', fontWeight: '800', width: 'fit-content' }}>
                                            {matCount} items
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  {/* Date & Time - Merged with rowSpan */}
                                  {isFirstMat && (
                                    <td
                                      rowSpan={matCount}
                                      style={{
                                        padding: cellPad,
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap',
                                        background: challanBg,
                                        borderBottom: '2px solid #cbd5e1',
                                        borderRight: '1px solid #f1f5f9'
                                      }}
                                    >
                                      <div style={{ lineHeight: '1.25' }}>
                                        <div style={{ fontWeight: '700', color: '#334155', fontSize: '11.5px' }}>{dateStr}</div>
                                        {timeStr && <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '600' }}>{timeStr}</div>}
                                      </div>
                                    </td>
                                  )}

                                  {/* Lot Reference - Merged with rowSpan */}
                                  {isFirstMat && (
                                    <td
                                      rowSpan={matCount}
                                      style={{
                                        padding: cellPad,
                                        verticalAlign: 'middle',
                                        background: challanBg,
                                        borderBottom: '2px solid #cbd5e1',
                                        borderRight: '1px solid #f1f5f9'
                                      }}
                                    >
                                      {isDirectLot ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontSize: '10px', background: '#f0fdf4', color: '#166534', padding: '1.5px 5px', borderRadius: '4px', fontWeight: '800', width: 'fit-content', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                                            WITHOUT LOT
                                          </span>
                                          {log.style && log.style !== 'Direct Item Requisition' && (
                                            <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>
                                              {log.style}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                            LOT #{log.lotId}
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '9px', background: '#f1f5f9', padding: '0px 4px', borderRadius: '3px', color: '#475569', fontWeight: '800' }}>
                                              W/O BOM
                                            </span>
                                            {(log.brand || log.brandName) && (
                                              <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>
                                                {log.brand || log.brandName}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  )}

                                  {/* Issued Material Detail (individual row per material) */}
                                  <td style={{
                                    padding: cellPad,
                                    verticalAlign: 'middle',
                                    borderTop: !isFirstMat ? '1px dashed #e2e8f0' : undefined,
                                    borderBottom: isLastMat ? '2px solid #cbd5e1' : undefined
                                  }}>
                                    {m ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                        {photoSrc ? (
                                          <img
                                            src={photoSrc}
                                            alt={m.name || 'material'}
                                            onClick={() => setMainPreviewPhoto({ url: photoSrc, name: m.name || m.bomItemName || 'Material', itemCode: getItemCodeDisplay(m) || m.itemCode || '' })}
                                            title="Click to zoom photo"
                                            style={{
                                              width: '24px',
                                              height: '24px',
                                              objectFit: 'cover',
                                              borderRadius: '4px',
                                              border: '1.5px solid #059669',
                                              flexShrink: 0,
                                              cursor: 'zoom-in',
                                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                          />
                                        ) : null}
                                        {categoryName && (
                                          <span style={{
                                            fontSize: '9px',
                                            fontWeight: '800',
                                            background: '#f1f5f9',
                                            color: '#1e293b',
                                            border: '1px solid #cbd5e1',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            {categoryName}
                                          </span>
                                        )}
                                        {batch.isPooled && (
                                          <span style={{
                                            fontSize: '8.5px',
                                            fontWeight: '800',
                                            background: '#eff6ff',
                                            color: '#1d4ed8',
                                            border: '1px solid #bfdbfe',
                                            padding: '0.5px 4px',
                                            borderRadius: '3px',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            🏷️ Pooled {batch.catKey}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '11.5px', color: '#0f172a' }}>
                                          <strong>{m.name || m.bomItemName || 'Material'}:</strong> {m.qty} {m.unit || 'pcs'}
                                        </span>
                                        {loc && (
                                          <span style={{
                                            fontSize: '9px',
                                            fontWeight: '800',
                                            background: '#fff7ed',
                                            color: '#c2410c',
                                            border: '1px solid #fed7aa',
                                            padding: '0px 4px',
                                            borderRadius: '3px',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            {loc}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>No materials listed</span>
                                    )}
                                  </td>

                                  {/* Total Pieces (Cutting) - Category Merged with rowSpan */}
                                  {isFirstInBatch && (
                                    <td
                                      rowSpan={batchItemCount}
                                      style={{
                                        padding: cellPad,
                                        textAlign: 'right',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap',
                                        background: batch.isPooled ? '#f8fafc' : 'inherit',
                                        borderTop: !isFirstMat ? '1px dashed #e2e8f0' : undefined,
                                        borderBottom: (isLastMat || isLastInBatch) ? '2px solid #cbd5e1' : undefined
                                      }}
                                    >
                                      {!isDirectLot && cuttingPieces > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                          <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '12px' }}>
                                            {cuttingPieces.toLocaleString('en-IN')} <span style={{ fontSize: '10px', color: '#64748b' }}>Pcs</span>
                                          </span>
                                          <span style={{
                                            fontSize: '8.5px',
                                            fontWeight: '700',
                                            background: '#eff6ff',
                                            color: '#1d4ed8',
                                            border: '1px solid #bfdbfe',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            Cutting
                                          </span>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                          <span style={{ fontWeight: '700', color: '#94a3b8', fontSize: '11.5px' }}>—</span>
                                          <span style={{ fontSize: '8.5px', color: '#64748b', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                                            {isDirectLot ? 'Direct' : 'No Lot Qty'}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  )}

                                  {/* Multiplier / Per Pc Consumption - Merged with rowSpan */}
                                  {isFirstInBatch && (
                                    <td
                                      rowSpan={batchItemCount}
                                      style={{
                                        padding: cellPad,
                                        textAlign: 'center',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap',
                                        background: batch.isPooled ? '#f8fafc' : 'inherit',
                                        borderTop: !isFirstMat ? '1px dashed #e2e8f0' : undefined,
                                        borderBottom: (isLastMat || isLastInBatch) ? '2px solid #cbd5e1' : undefined
                                      }}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                        <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '11.5px' }}>
                                          {effectiveBatchMult === 1 ? '1 / Pc' : (effectiveBatchMult < 1 ? `÷${Math.round(1 / effectiveBatchMult)}` : `×${effectiveBatchMult}`)}
                                        </span>
                                        {effectiveBatchMult !== 1 && (
                                          <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '700' }}>
                                            ({effectiveBatchMult} / Pc)
                                          </span>
                                        )}
                                        {batch.isPooled && (
                                          <span style={{ fontSize: '7.5px', color: '#1d4ed8', fontWeight: '800', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0 3px', borderRadius: '2px', textTransform: 'uppercase' }}>
                                            {batch.catKey} POOLED
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  {/* Issued Qty - Category Pooled Total with rowSpan */}
                                  {isFirstInBatch && (
                                    <td
                                      rowSpan={batchItemCount}
                                      style={{
                                        padding: cellPad,
                                        textAlign: 'right',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap',
                                        background: batch.isPooled ? '#fff7ed' : 'inherit',
                                        borderTop: !isFirstMat ? '1px dashed #e2e8f0' : undefined,
                                        borderBottom: (isLastMat || isLastInBatch) ? '2px solid #cbd5e1' : undefined
                                      }}
                                    >
                                      {batch.isPooled ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                          <span style={{ fontWeight: '900', color: '#c2410c', fontSize: '12.5px' }}>
                                            {categoryIssueQty.toLocaleString('en-IN')} <span style={{ fontSize: '10px' }}>Pcs</span>
                                          </span>
                                          <span style={{
                                            fontSize: '8px',
                                            fontWeight: '800',
                                            background: '#ffedd5',
                                            color: '#9a3412',
                                            border: '1px solid #fed7aa',
                                            padding: '0.5px 4px',
                                            borderRadius: '3px',
                                            textTransform: 'uppercase',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            {batch.catKey} TOTAL ({batch.items.length} ITEMS)
                                          </span>
                                          <span style={{ fontSize: '7.5px', color: '#64748b', fontWeight: '600' }}>
                                            ({batch.items.map(it => `${it.m?.qty || 0}`).join(' + ')} Pcs)
                                          </span>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                          <span style={{ fontWeight: '900', color: '#ea580c', fontSize: '12px' }}>{matMetrics.formattedQty}</span>
                                          <div style={{ fontSize: '8.5px', color: '#9a3412', fontWeight: '800' }}>
                                            ISSUED
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  )}

                                  {/* Variance - Category Pooled Variance with rowSpan */}
                                  {isFirstInBatch && (
                                    <td
                                      rowSpan={batchItemCount}
                                      style={{
                                        padding: cellPad,
                                        textAlign: 'right',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap',
                                        background: batch.isPooled ? '#f8fafc' : 'inherit',
                                        borderTop: !isFirstMat ? '1px dashed #e2e8f0' : undefined,
                                        borderBottom: (isLastMat || isLastInBatch) ? '2px solid #cbd5e1' : undefined
                                      }}
                                    >
                                      {hasCategoryVariance ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                          <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '1.5px 5px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            border: '1px solid',
                                            background: categoryVariance === 0 ? '#f0fdf4' : categoryVariance > 0 ? '#eff6ff' : '#fef2f2',
                                            borderColor: categoryVariance === 0 ? '#bbf7d0' : categoryVariance > 0 ? '#bfdbfe' : '#fecaca',
                                            color: categoryVariance === 0 ? '#15803d' : categoryVariance > 0 ? '#1d4ed8' : '#b91c1c'
                                          }}>
                                            {categoryVarianceText}
                                          </span>
                                          <span style={{
                                            fontSize: '8.5px',
                                            fontWeight: '800',
                                            color: categoryVariance === 0 ? '#166534' : categoryVariance > 0 ? '#1e40af' : '#991b1b'
                                          }}>
                                            {categoryVarianceBadge}
                                          </span>
                                          {batch.isPooled && (
                                            <span style={{ fontSize: '7.5px', color: '#4338ca', fontWeight: '700' }}>
                                              {batch.catKey} POOLED
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                                          <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '700' }}>—</span>
                                          <span style={{
                                            fontSize: '8.5px',
                                            color: isDirectLot ? '#64748b' : matMetrics.isAuxiliary ? '#475569' : '#0369a1',
                                            background: isDirectLot ? '#f1f5f9' : matMetrics.isAuxiliary ? '#f8fafc' : '#e0f2fe',
                                            border: matMetrics.isAuxiliary ? '1px solid #e2e8f0' : 'none',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            fontWeight: '700'
                                          }}>
                                            {matMetrics.varianceBadge || (isDirectLot ? 'Direct Issue' : `Issued in ${matMetrics.unit}`)}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  )}

                                {/* Issued By - Merged with rowSpan */}
                                {isFirstMat && (
                                  <td
                                    rowSpan={matCount}
                                    style={{
                                      padding: cellPad,
                                      color: '#334155',
                                      fontWeight: '700',
                                      fontSize: '11px',
                                      verticalAlign: 'middle',
                                      whiteSpace: 'nowrap',
                                      background: challanBg,
                                      borderBottom: '2px solid #cbd5e1',
                                      borderLeft: '1px solid #f1f5f9'
                                    }}
                                  >
                                    {log.personName || 'Store'}
                                  </td>
                                )}

                                {/* Received By - Merged with rowSpan */}
                                {isFirstMat && (
                                  <td
                                    rowSpan={matCount}
                                    style={{
                                      padding: cellPad,
                                      color: '#0f172a',
                                      fontWeight: '700',
                                      fontSize: '11px',
                                      verticalAlign: 'middle',
                                      background: challanBg,
                                      borderBottom: '2px solid #cbd5e1'
                                    }}
                                  >
                                    <div style={{ lineHeight: '1.2' }}>
                                      <div style={{ whiteSpace: 'nowrap' }}>{log.receiverName || 'Cutting'}</div>
                                      {log.receiverDept && (
                                        <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                                          {log.receiverDept}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )}

                                {/* Remarks - Merged with rowSpan */}
                                {isFirstMat && (
                                  <td
                                    rowSpan={matCount}
                                    style={{
                                      padding: cellPad,
                                      color: '#475569',
                                      fontSize: '11px',
                                      verticalAlign: 'middle',
                                      background: challanBg,
                                      borderBottom: '2px solid #cbd5e1',
                                      maxWidth: '160px'
                                    }}
                                  >
                                    {log.remarks ? (
                                      <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.remarks}>
                                        {log.remarks}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                )}

                                {/* Actions - Merged with rowSpan */}
                                {isFirstMat && (
                                  <td
                                    rowSpan={matCount}
                                    style={{
                                      padding: cellPad,
                                      textAlign: 'center',
                                      verticalAlign: 'middle',
                                      background: challanBg,
                                      borderBottom: '2px solid #cbd5e1'
                                    }}
                                  >
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const issueData = buildIssueDataFromLog(log);
                                          handleDirectPrintWindow(issueData, log.id);
                                        }}
                                        style={{
                                          padding: '4px 7px',
                                          borderRadius: '5px',
                                          border: '1px solid #0f172a',
                                          background: '#0f172a',
                                          color: '#ffffff',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          whiteSpace: 'nowrap'
                                        }}
                                        title="Direct 1-Click Print"
                                      >
                                        <Printer size={12} style={{ color: '#ea580c' }} />
                                        <span>Print</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadChallanPdf(log)}
                                        style={{
                                          padding: '4px 6px',
                                          borderRadius: '5px',
                                          border: '1px solid #f87171',
                                          background: '#fef2f2',
                                          color: '#dc2626',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                          whiteSpace: 'nowrap'
                                        }}
                                        title="Direct 1-Click Export Challan to PDF"
                                      >
                                        <Download size={12} />
                                        <span>PDF</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleReprintHistory(log)}
                                        style={{
                                          padding: '4px 5px',
                                          borderRadius: '5px',
                                          border: '1px solid #cbd5e1',
                                          background: '#ffffff',
                                          color: '#475569',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        title="Preview on-screen and download PDF"
                                      >
                                        <Eye size={12} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {(() => {
                    const metricsList = withoutBomLogs.map(log => getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs));
                    const screenTotalPieces = metricsList.reduce((sum, m) => sum + m.totalPieces, 0);

                    const grandUnitTotals = {};
                    let totalLineItems = 0;
                    withoutBomLogs.forEach(log => {
                      const mats = (Array.isArray(log.materials) && log.materials.length > 0) ? log.materials : [null];
                      mats.forEach(m => {
                        if (!m) return;
                        totalLineItems++;
                        const rawU = m.unit || 'Pcs';
                        const normU = normalizeUnitName(rawU);
                        const q = Number(m.qty) || 0;
                        grandUnitTotals[normU] = (grandUnitTotals[normU] || 0) + q;
                      });
                    });

                    const grandPcsIssued = grandUnitTotals['Pcs'] || 0;
                    const nonPcsEntries = Object.entries(grandUnitTotals)
                      .filter(([u]) => u !== 'Pcs')
                      .sort((a, b) => b[1] - a[1]);

                    const nonPcsSummary = nonPcsEntries
                      .map(([u, q]) => {
                        const formattedQ = (q % 1 === 0 ? q : Number(q.toFixed(2))).toLocaleString('en-IN');
                        return `${formattedQ} ${u}`;
                      })
                      .join(' • ');

                    const pcsVariance = screenTotalPieces - grandPcsIssued;

                    return (
                      <tfoot>
                        <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: '800', fontSize: '11.5px' }}>
                          <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right', color: '#475569', textTransform: 'uppercase' }}>
                            Grand Total ({withoutBomLogs.length.toLocaleString('en-IN')} Challans{totalLineItems > withoutBomLogs.length ? `, ${totalLineItems.toLocaleString('en-IN')} Items` : ''}):
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: '900', color: '#0f172a' }}>{screenTotalPieces.toLocaleString('en-IN')}</span> <span style={{ fontSize: '10px', color: '#64748b' }}>Pcs</span>
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {grandPcsIssued > 0 && (
                              <div>
                                <span style={{ fontWeight: '900', color: '#ea580c' }}>{grandPcsIssued.toLocaleString('en-IN')}</span> <span style={{ fontSize: '10px', color: '#64748b' }}>Pcs</span>
                              </div>
                            )}
                            {nonPcsSummary && (
                              <div style={{ fontSize: '9.5px', color: '#0369a1', fontWeight: '800', marginTop: grandPcsIssued > 0 ? '2px' : 0 }}>
                                {nonPcsSummary}
                              </div>
                            )}
                            {!grandPcsIssued && !nonPcsSummary && (
                              <span style={{ fontWeight: '900', color: '#ea580c' }}>0</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {screenTotalPieces > 0 && grandPcsIssued > 0 ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '2px 6px',
                                borderRadius: '5px',
                                fontSize: '11px',
                                fontWeight: '900',
                                border: '1px solid',
                                background: pcsVariance === 0 ? '#f0fdf4' : pcsVariance > 0 ? '#eff6ff' : '#fef2f2',
                                borderColor: pcsVariance === 0 ? '#bbf7d0' : pcsVariance > 0 ? '#bfdbfe' : '#fecaca',
                                color: pcsVariance === 0 ? '#15803d' : pcsVariance > 0 ? '#1d4ed8' : '#b91c1c'
                              }}>
                                {pcsVariance > 0 ? `+${pcsVariance.toLocaleString('en-IN')}` : pcsVariance.toLocaleString('en-IN')} Pcs Bal
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                                —
                              </span>
                            )}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  fontSize: '11.5px',
                  color: '#475569',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div>
                    Showing <strong>{((safeCurrentPage - 1) * (historyPageSize === 'all' ? withoutBomLogs.length : Number(historyPageSize))) + 1}</strong> to <strong>{Math.min(safeCurrentPage * (historyPageSize === 'all' ? withoutBomLogs.length : Number(historyPageSize)), withoutBomLogs.length)}</strong> of <strong>{withoutBomLogs.length.toLocaleString('en-IN')}</strong> challans
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage <= 1 ? '#f1f5f9' : '#ffffff',
                        color: safeCurrentPage <= 1 ? '#94a3b8' : '#0f172a',
                        fontWeight: '700',
                        fontSize: '11px',
                        cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ‹ Previous
                    </button>
                    <span style={{ fontWeight: '700', color: '#1e293b' }}>
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setHistoryCurrentPage(p => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                        color: safeCurrentPage >= totalPages ? '#94a3b8' : '#0f172a',
                        fontWeight: '700',
                        fontSize: '11px',
                        cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: BEAUTIFUL ON-SCREEN CHALLAN / BILL PREVIEW WITH PRINT & DOWNLOAD ── */}
      {previewModal && (
        <div
          className="without-bom-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          }}>
            {/* Modal Top Bar */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0f172a',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={20} style={{ color: '#ea580c' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                    MATERIAL ISSUE WITHOUT BOM &bull; {previewModal.voucherId}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {previewModal.isPreviewOnly ? 'Draft Preview — Click "Confirm Issue" on form to record stock deduction' : 'Official Material Issue Slip saved to inventory records'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Challan Sheet View */}
            <div style={{ flex: '1', overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>

              {/* Printable Challan Box */}
              <div style={{
                background: '#ffffff',
                border: '2px solid #0f172a',
                borderRadius: '8px',
                padding: '24px 28px',
                color: '#0f172a',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '0.5px' }}>MOHIT HOSIERY</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                      CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT
                    </p>
                    <div style={{ display: 'inline-block', marginTop: '6px', padding: '4px 10px', background: '#ea580c', color: '#ffffff', borderRadius: '4px', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      MATERIAL ISSUE WITHOUT BOM
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: '900', color: '#ea580c' }}>
                      {previewModal.voucherId}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginTop: '2px' }}>
                      Date: {previewModal.issueData?.date || new Date().toLocaleDateString('en-GB')}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '800', marginTop: '4px', color: '#059669' }}>
                      {previewModal.isPreviewOnly ? '[ PREVIEW COPY ]' : '[ REAL STOCK DEDUCTED ]'}
                    </div>
                  </div>
                </div>

                {/* Particulars Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>LOT REFERENCE:</span>
                    <strong style={{ color: '#ea580c', fontSize: '13px' }}>
                      LOT #{previewModal.issueData?.lotId}
                      {(previewModal.issueData?.brandName || previewModal.issueData?.brand) && (
                        <span style={{ fontSize: '11px', color: '#0284c7', marginLeft: '6px' }}>
                          ({previewModal.issueData.brandName || previewModal.issueData.brand})
                        </span>
                      )}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>ISSUED BY (STORE):</span>
                    <strong>{previewModal.issueData?.personName || 'Store In-charge'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>RECEIVED BY:</span>
                    <strong>{previewModal.issueData?.receiverName || 'Floor Master'} ({previewModal.issueData?.receiverDept || 'Cutting'})</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>REQUISITION TYPE:</span>
                    <span>{previewModal.issueData?.style || 'Direct Store Requisition'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>PRODUCTION VOLUME:</span>
                    <span>{previewModal.issueData?.pieces > 1 ? `${previewModal.issueData?.pieces} Pcs` : 'Ad-Hoc Issue'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>TOTAL LINE ITEMS:</span>
                    <span>{(previewModal.issueData?.items || []).length} Material Item(s)</span>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #0f172a', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                      <th style={{ padding: '8px 10px' }}>Component / Type</th>
                      <th style={{ padding: '8px 10px' }}>Store Material Description</th>
                      <th style={{ padding: '8px 10px' }}>Shade/Color</th>
                      <th style={{ padding: '8px 10px' }}>Rack Loc</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Prev Stock</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#ea580c' }}>Issued Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewModal.issueData?.items || []).map((item, idx) => {
                      const balance = item.availableStock !== undefined ? Math.max(0, item.availableStock - item.totalQty).toFixed(2) : '—';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '700' }}>{item.componentType || 'Accessory'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {(() => {
                              const c = getItemCodeDisplay(item);
                              return (
                                <>
                                  {c && <strong style={{ color: '#0284c7', marginRight: '6px' }}>[{c}]</strong>}
                                  <span>{item.materialName || 'Material Item'}</span>
                                </>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '8px 10px' }}>{item.color || 'Standard'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.location || 'Store'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                            {item.availableStock !== undefined ? `${item.availableStock} ${item.unit}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#ea580c', fontSize: '13px' }}>
                            {item.totalQty} {item.unit}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                            {balance} {item.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Remarks */}
                {previewModal.issueData?.remarks && (
                  <div style={{ marginBottom: '18px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11.5px' }}>
                    <strong>Allocation Notes:</strong> {previewModal.issueData.remarks}
                  </div>
                )}

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', paddingTop: '16px', borderTop: '1.5px solid #0f172a' }}>
                  <div style={{ textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ height: '32px' }}></div>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong>Issued By: {previewModal.issueData?.personName || 'Store In-charge'}</strong>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Store Incharge Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ height: '32px' }}></div>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong>Received By: {previewModal.issueData?.receiverName || 'Floor Master'}</strong>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>{previewModal.issueData?.receiverDept || 'Cutting'} Dept Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ height: '32px' }}></div>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong>Authorized Signatory</strong>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Supervisor / Lead Clearance</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                Official Mohit Hosiery Material Issue Challan &bull; Dual-Copy Print Format
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Direct 1-Click Print Button */}
                <button
                  type="button"
                  onClick={() => handleDirectPrintWindow(previewModal.issueData, previewModal.voucherId)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1.5px solid #0f172a',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)'
                  }}
                >
                  <Printer size={16} />
                  <span>🖨️ Print Challan Now</span>
                </button>

                {/* PDF Download */}
                <button
                  type="button"
                  onClick={() => {
                    if (previewModal.doc) {
                      previewModal.doc.save(`${previewModal.voucherId}_Challan_Bill.pdf`);
                    }
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>

                {/* Done Button */}
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Custom Types Modal */}
      {showManageTypesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Manage Component / Types
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setNewTypeNameInput('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748b' }}>
                All custom accessory types entered are saved and shown in your dropdown list across bills.
              </p>

              {/* Add New Type input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newTypeNameInput.trim()) {
                    addCustomComponentType(newTypeNameInput.trim().toUpperCase());
                    setNewTypeNameInput('');
                  }
                }}
                style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}
              >
                <input
                  type="text"
                  placeholder="Type new component name (e.g. BUTTON)..."
                  value={newTypeNameInput}
                  onChange={(e) => setNewTypeNameInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '7px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '600'
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newTypeNameInput.trim()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: newTypeNameInput.trim() ? '#0f172a' : '#cbd5e1',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: newTypeNameInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  + Add
                </button>
              </form>

              {/* Types List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {/* Default Types */}
                {BASE_COMPONENT_TYPES.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#f8fafc',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: '#475569'
                    }}
                  >
                    <span>{idx + 1}. {t}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                      Standard
                    </span>
                  </div>
                ))}

                {/* Custom Types */}
                {customComponentTypes.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      color: '#0f172a'
                    }}
                  >
                    <span>{BASE_COMPONENT_TYPES.length + idx + 1}. {t}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomComponentType(t)}
                      title={`Delete "${t}" from list`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                ))}

                {customComponentTypes.length === 0 && (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No custom types added yet. Use "+ Add Manually" in the table or add one above!
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setNewTypeNameInput('');
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN PRINT CONTAINER (FOR WINDOW.PRINT DUAL COPY) ── */}
      {(previewModal || activePrintData) && (() => {
        const printIssue = previewModal?.issueData || activePrintData;
        const printVid = previewModal?.voucherId || activePrintData?.voucherId || nextVoucherId;
        if (!printIssue) return null;

        const cleanLot = String(printIssue.lotId || '').replace(/^LOT\s*#?/i, '').trim().toLowerCase();
        const resolvedCutting = Number(printIssue.cuttingPieces) ||
          (effectiveCuttingMap && effectiveCuttingMap[cleanLot] ? Number(effectiveCuttingMap[cleanLot]) : 0) ||
          (activeLotCutting && String(activeLotCutting.lotNumber).trim().toLowerCase() === cleanLot ? Number(activeLotCutting.totalPieces) : 0) ||
          (Number(printIssue.pieces) > 1 ? Number(printIssue.pieces) : 0);
        const onePct = resolvedCutting > 0 ? Math.round(resolvedCutting * 0.01) : 0;
        const totalAllowedWith1Pct = resolvedCutting + onePct;
        const isOnePercentExtraIssued = (printIssue.items || []).some(it => {
          const q = Number(it.totalQty);
          return (resolvedCutting > 0 && q >= totalAllowedWith1Pct) || (resolvedCutting > 0 && q > resolvedCutting);
        });

        const renderVolumeContent = () => {
          if (resolvedCutting > 0) {
            return (
              <span>
                <strong>{resolvedCutting.toLocaleString()} Pcs</strong>
                {isOnePercentExtraIssued ? (
                  <span style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                    (+1% Extra: {totalAllowedWith1Pct.toLocaleString()} Pcs)
                  </span>
                ) : (
                  <span style={{ marginLeft: '4px' }}>(1% Max: {totalAllowedWith1Pct.toLocaleString()} Pcs)</span>
                )}
              </span>
            );
          }
          return <span>{printIssue.pieces > 1 ? `${printIssue.pieces} Pcs` : 'Ad-Hoc Issue'}</span>;
        };

        return (
          <div className="without-bom-print-container">
            {/* Copy 1: ORIGINAL (STORE COPY) */}
            <div className="without-bom-challan-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#000000' }}>MOHIT HOSIERY</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT</div>
                  <div style={{ fontSize: '12px', fontWeight: '900', marginTop: '3px', letterSpacing: '0.5px', color: '#000000' }}>
                    MATERIAL ISSUE WITHOUT BOM
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>
                    OFFICIAL STORE CHALLAN / STORE ISSUE BILL
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#000000' }}>CHALLAN NO: {printVid}</div>
                  <div style={{ fontSize: '10px', color: '#000000', fontWeight: '600' }}>DATE: {printIssue.date}</div>
                  <div style={{ fontSize: '10px', fontWeight: '900', marginTop: '3px', color: '#000000' }}>[ ORIGINAL - STORE COPY ]</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', border: '1.5px solid #000', padding: '8px', marginBottom: '10px', color: '#000000' }}>
                <div><strong>LOT NO:</strong> LOT #{printIssue.lotId}{(printIssue.brandName || printIssue.brand) ? ` • BRAND: ${printIssue.brandName || printIssue.brand}` : ''}</div>
                <div><strong>ISSUED BY:</strong> {printIssue.personName}</div>
                <div><strong>RECEIVED BY:</strong> {printIssue.receiverName} ({printIssue.receiverDept})</div>
                <div><strong>REQUISITION:</strong> {printIssue.style}</div>
                <div><strong>CUTTING PIECES / VOLUME:</strong> {renderVolumeContent()}</div>
                <div><strong>STATUS:</strong> {printIssue.isPreviewOnly ? 'DRAFT PREVIEW' : 'REAL STOCK DEDUCTED'}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px', border: '1.5px solid #000' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f0f0f0', color: '#000000' }}>
                    <th style={{ padding: '5px', textAlign: 'center', width: '25px', border: '1px solid #000' }}>#</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Component</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Material Description</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Item Code</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Rack Loc</th>
                    <th style={{ padding: '5px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Issued Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printIssue.items || []).map((item, idx) => {
                    const qty = Number(item.totalQty);
                    const isItemExtra = resolvedCutting > 0 && (qty >= totalAllowedWith1Pct || qty > resolvedCutting);
                    const mult = Number(item.multiplier) || 1;
                    return (
                      <tr key={idx} style={{ color: '#000000' }}>
                        <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #000', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}><strong>{item.componentType}</strong></td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.materialName}</td>
                        <td style={{ padding: '5px', border: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {getItemCodeDisplay(item, materials) || (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '') || '-'}
                        </td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.location || 'Store'}</td>
                        <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #000' }}>
                          <div>{item.totalQty} {item.unit || 'Pcs'}</div>
                          {isItemExtra && (
                            <div style={{ fontSize: '8.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>
                              [ +1% Extra Added ]
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {printIssue.remarks && (
                <div style={{ fontSize: '10px', marginBottom: '12px', border: '1px solid #000', borderLeft: '4px solid #000', padding: '5px 8px', color: '#000000' }}>
                  <strong>Remarks:</strong> {printIssue.remarks}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '10px', borderTop: '1.5px solid #000', fontSize: '10px', textAlign: 'center', color: '#000000' }}>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Issued By ({printIssue.personName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Received By ({printIssue.receiverName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Supervisor Sign &amp; Stamp</strong>
                </div>
              </div>
            </div>

            <div style={{ height: '18px' }}></div>

            {/* Copy 2: DUPLICATE (DEPARTMENT / RECEIVER COPY) */}
            <div className="without-bom-challan-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#000000' }}>MOHIT HOSIERY</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT</div>
                  <div style={{ fontSize: '12px', fontWeight: '900', marginTop: '3px', letterSpacing: '0.5px', color: '#000000' }}>
                    MATERIAL ISSUE WITHOUT BOM
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>
                    DUPLICATE DEPARTMENT COPY
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#000000' }}>CHALLAN NO: {printVid}</div>
                  <div style={{ fontSize: '10px', color: '#000000', fontWeight: '600' }}>DATE: {printIssue.date}</div>
                  <div style={{ fontSize: '10px', fontWeight: '900', marginTop: '3px', color: '#000000' }}>[ DUPLICATE - RECEIVER COPY ]</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', border: '1.5px solid #000', padding: '8px', marginBottom: '10px', color: '#000000' }}>
                <div><strong>LOT NO:</strong> LOT #{printIssue.lotId}{(printIssue.brandName || printIssue.brand) ? ` • BRAND: ${printIssue.brandName || printIssue.brand}` : ''}</div>
                <div><strong>ISSUED BY:</strong> {printIssue.personName}</div>
                <div><strong>RECEIVED BY:</strong> {printIssue.receiverName} ({printIssue.receiverDept})</div>
                <div><strong>REQUISITION:</strong> {printIssue.style}</div>
                <div><strong>CUTTING PIECES / VOLUME:</strong> {renderVolumeContent()}</div>
                <div><strong>STATUS:</strong> {printIssue.isPreviewOnly ? 'DRAFT PREVIEW' : 'REAL STOCK DEDUCTED'}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px', border: '1.5px solid #000' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f0f0f0', color: '#000000' }}>
                    <th style={{ padding: '5px', textAlign: 'center', width: '25px', border: '1px solid #000' }}>#</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Component</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Material Description</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Item Code</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Rack Loc</th>
                    <th style={{ padding: '5px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Issued Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printIssue.items || []).map((item, idx) => {
                    const qty = Number(item.totalQty);
                    const isItemExtra = resolvedCutting > 0 && (qty >= totalAllowedWith1Pct || qty > resolvedCutting);
                    const mult = Number(item.multiplier) || 1;
                    return (
                      <tr key={idx} style={{ color: '#000000' }}>
                        <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #000', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}><strong>{item.componentType}</strong></td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.materialName}</td>
                        <td style={{ padding: '5px', border: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {getItemCodeDisplay(item, materials) || (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '') || '-'}
                        </td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.location || 'Store'}</td>
                        <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #000' }}>
                          <div>{item.totalQty} {item.unit || 'Pcs'}</div>
                          {isItemExtra && (
                            <div style={{ fontSize: '8.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>
                              [ +1% Extra Added ]
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {printIssue.remarks && (
                <div style={{ fontSize: '10px', marginBottom: '12px', border: '1px solid #000', borderLeft: '4px solid #000', padding: '5px 8px', color: '#000000' }}>
                  <strong>Remarks:</strong> {printIssue.remarks}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '10px', borderTop: '1.5px solid #000', fontSize: '10px', textAlign: 'center', color: '#000000' }}>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Issued By ({printIssue.personName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Received By ({printIssue.receiverName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Supervisor Sign &amp; Stamp</strong>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 1% CUTTING THRESHOLD EXCEEDED - APPROVAL MODAL ── */}
      {approvalModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '620px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '2px solid #f87171',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)',
              padding: '16px 20px',
              borderBottom: '1.5px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#991b1b' }}>
                    Approval Required: Issue Exceeds 1% Cutting Allowance
                  </h3>
                  <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
                    Lot #{approvalModalData.lotNo} • Cutting Pieces: {approvalModalData.cuttingPieces.toLocaleString()} Pcs
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalData(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  color: '#991b1b',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Allowance Summary Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>CUTTING PIECES</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                    {approvalModalData.cuttingPieces.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700' }}>1% ALLOWED EXTRA</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669', marginTop: '2px' }}>
                    +{approvalModalData.onePercentAllowance.toLocaleString()} Pcs
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: '700' }}>MAX PERMITTED (1%)</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#ea580c', marginTop: '2px' }}>
                    {approvalModalData.defaultAutoIssueQty.toLocaleString()} Pcs
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#9f1239',
                lineHeight: '1.5'
              }}>
                <strong>Store Issue Policy:</strong> Requisitions up to <strong>1% ({approvalModalData.defaultAutoIssueQty.toLocaleString()} Pcs)</strong> are issued automatically. The following item(s) exceed the 1% threshold and require official Admin approval or adjustment back to the 1% limit.
              </div>

              {/* Exceeded Items Table */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                  ITEMS EXCEEDING 1% THRESHOLD:
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: '800', textTransform: 'uppercase', fontSize: '10.5px' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item / Component</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Requested Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>1% Allowed Limit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Excess (+%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalModalData.exceededItems.map((exItem, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: '800', color: '#0f172a' }}>{exItem.materialName || exItem.componentType}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{exItem.componentType} {exItem.color ? `• ${exItem.color}` : ''}</div>
                            {Number(exItem.alreadyIssued) > 0 && (
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#ea580c', marginTop: '2px' }}>
                                Already Issued: {(Number(exItem.alreadyIssued) || 0).toLocaleString()} {exItem.unit}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#dc2626' }}>
                            <div>{exItem.baseQty || exItem.qty} {exItem.unit}</div>
                            {Number(exItem.multiplier) > 1 && (
                              <div style={{ fontSize: '10px', color: '#4338ca', fontWeight: '700' }}>
                                Total Issue: {exItem.totalQty} (×{exItem.multiplier})
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                            {(Number(exItem.maxAllowed !== undefined ? exItem.maxAllowed : approvalModalData.defaultAutoIssueQty) || 0).toLocaleString()} {exItem.unit}
                            {Number(exItem.alreadyIssued) > 0 && (
                              <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>(Rem allowance)</div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: '900',
                              color: '#b91c1c',
                              background: '#fee2e2',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}>
                              +{exItem.excess} ({exItem.excessPct}%)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Justification / Note for Admin */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  REASON / JUSTIFICATION FOR ADMIN APPROVAL:
                </label>
                <textarea
                  rows={2}
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Enter reason for requesting more than 1% cutting extra..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              background: '#f8fafc',
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setApprovalModalData(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '7px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ✕ Cancel / Edit Quantities
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAdjustAllTo1Percent}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '7px',
                    border: '1.5px solid #86efac',
                    background: '#f0fdf4',
                    color: '#065f46',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ⚡ Auto-Adjust to 1% ({approvalModalData.defaultAutoIssueQty}) &amp; Issue
                </button>

                {(currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'owner') && (
                  <button
                    type="button"
                    onClick={handleAdminOverrideIssue}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '7px',
                      border: 'none',
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    👑 Admin Direct Override
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmSubmitApproval}
                  disabled={approvalSubmitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: approvalSubmitting ? 'not-allowed' : 'pointer',
                    opacity: approvalSubmitting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  {approvalSubmitting ? 'Submitting...' : '📤 Submit for Admin Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EMBEDDED STYLESHEET ── */}
      <style>{`
        .no-spin::-webkit-inner-spin-button,
        .no-spin::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spin {
          -moz-appearance: textfield;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, nav, aside, .app-header, .navbar, .without-bom-modal-overlay {
            display: none !important;
            visibility: hidden !important;
          }
          body.print-without-bom-mode #root > *:not(.without-bom-print-container) {
            display: none !important;
          }
          .without-bom-container > *:not(.without-bom-print-container) {
            display: none !important;
          }
          .without-bom-print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            visibility: visible !important;
            z-index: 99999999 !important;
          }
          .without-bom-print-container * {
            visibility: visible !important;
          }
          .without-bom-challan-sheet {
            page-break-inside: avoid !important;
            border: 1.5px solid #000000 !important;
            padding: 12px 16px !important;
            margin-bottom: 12px !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
        @media screen {
          .without-bom-print-container {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
