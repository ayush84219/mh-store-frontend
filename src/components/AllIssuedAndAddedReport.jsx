import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import {
  Calendar as CalendarIcon, Search, Filter, Download, Printer, RefreshCw,
  Layers, Package, Scissors, Scale, FileText, CheckCircle, AlertTriangle,
  Clock, Users, Sliders, ChevronDown, ChevronUp, Eye, Tag, ArrowRight,
  TrendingUp, BarChart3, Check, X, FileSpreadsheet, Sparkles, ExternalLink,
  Boxes, ShieldCheck, PieChart, Activity, ArrowUpRight, Camera, Image as ImageIcon,
  Plus, User, Copy, ArrowDownRight, Hash, MapPin, Building, Info,
  ListFilter, LayoutGrid, CalendarDays
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Date & Time Utilities ────────────────────────────────────────────────────────

const parseToDateObject = (dateVal, timeVal = '') => {
  if (!dateVal) return new Date(0);
  const str = String(dateVal).trim();

  // Try parsing ISO/MySQL format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  if (str.includes('-') && str.length >= 10 && !str.includes('/')) {
    const parsed = new Date(str.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY with optional time
  const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*(AM|PM))?/i;
  const match = str.match(dmyRegex);

  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    let hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;
    const ampm = match[7];

    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }

    if (timeVal && (!match[4] || hour === 0)) {
      const timeMatch = String(timeVal).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let th = parseInt(timeMatch[1], 10);
        const tm = parseInt(timeMatch[2], 10);
        const ts = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        const tampm = timeMatch[4];
        if (tampm) {
          if (tampm.toLowerCase() === 'pm' && th < 12) th += 12;
          if (tampm.toLowerCase() === 'am' && th === 12) th = 0;
        }
        return new Date(year, month, day, th, tm, ts);
      }
    }

    return new Date(year, month, day, hour, minute, second);
  }

  const standard = new Date(dateVal);
  if (!isNaN(standard.getTime())) return standard;

  return new Date(0);
};

const formatDateToYMD = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) return '—';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDisplayTime = (dateObj, fallbackTime = '') => {
  if (fallbackTime && String(fallbackTime).trim()) return String(fallbackTime).trim();
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) return '';
  return dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatPersonName = (name) => {
  if (!name || name === '—') return '—';
  const trimmed = String(name).trim();
  return trimmed
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

// ── Component Definition ─────────────────────────────────────────────────────────

export default function AllIssuedAndAddedReport({
  currencySymbol = '₹',
  currentUser = null,
  onNavigateToLot = () => {}
}) {
  // Master Raw Data States
  const [boneIssues, setBoneIssues] = useState([]);
  const [elasticIssues, setElasticIssues] = useState([]);
  const [extraIssues, setExtraIssues] = useState([]);
  const [issueLogs, setIssueLogs] = useState([]);
  const [weightCaptures, setWeightCaptures] = useState([]);
  const [materialsList, setMaterialsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [quickDateFilter, setQuickDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'last7', 'thisMonth', 'custom'
  const [specificDate, setSpecificDate] = useState(''); // Specific calendar date (YYYY-MM-DD)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movementFilter, setMovementFilter] = useState('all'); // 'all', 'all_issues', 'add_material', 'bone_issue', 'elastic_issue', 'tape_issue', 'extra_pic_issue', 'general_issue'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState('table'); // 'table' | 'daily_grouped'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'

  // Modal & Preview States
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [collapsedDays, setCollapsedDays] = useState({});

  // ── Fetch All Datasets ─────────────────────────────────────────────────────────
  const fetchAllMovementData = async () => {
    setIsLoading(true);
    const backendUrl = getBackendUrl();
    try {
      const [bRes, elRes, exRes, issRes, wtRes, matRes] = await Promise.all([
        fetch(`${backendUrl}/api/bone-issues`).catch(() => ({ ok: false })),
        fetch(`${backendUrl}/api/elastic-issues`).catch(() => ({ ok: false })),
        fetch(`${backendUrl}/api/extra-material-issues`).catch(() => ({ ok: false })),
        fetch(`${backendUrl}/api/issue-logs`).catch(() => ({ ok: false })),
        fetch(`${backendUrl}/api/weight-capture`).catch(() => ({ ok: false })),
        fetch(`${backendUrl}/api/materials`).catch(() => ({ ok: false }))
      ]);

      if (bRes.ok) {
        const d = await bRes.json();
        setBoneIssues(Array.isArray(d) ? d : []);
      }
      if (elRes.ok) {
        const d = await elRes.json();
        setElasticIssues(Array.isArray(d) ? d : []);
      }
      if (exRes.ok) {
        const d = await exRes.json();
        setExtraIssues(Array.isArray(d) ? d : []);
      }
      if (issRes.ok) {
        const d = await issRes.json();
        setIssueLogs(Array.isArray(d) ? d : []);
      }
      if (wtRes.ok) {
        const d = await wtRes.json();
        setWeightCaptures(Array.isArray(d) ? d : (d?.data || []));
      }
      if (matRes.ok) {
        const d = await matRes.json();
        setMaterialsList(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      console.error('Error fetching movement report datasets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMovementData();
  }, []);

  // Material Photo lookup helper
  const materialPhotoMap = useMemo(() => {
    const map = {};
    (materialsList || []).forEach(m => {
      const photo = m.materialPhoto || m.photo || m.image || m.imageUrl;
      if (photo) {
        if (m.id) map[String(m.id).toLowerCase()] = photo;
        if (m.itemCode) map[String(m.itemCode).toLowerCase()] = photo;
        if (m.name) map[String(m.name).toLowerCase()] = photo;
      }
    });
    return map;
  }, [materialsList]);

  // ── Normalize & Consolidate All Movements ──────────────────────────────────────
  const normalizedRecords = useMemo(() => {
    const list = [];
    const seenIssueKeys = new Set();

    // 1. INGEST DEDICATED BONE ISSUES
    (boneIssues || []).forEach(b => {
      const docNo = b.slipNo || b.slip_no || `BONE-${b.id}`;
      seenIssueKeys.add(String(docNo).toLowerCase());

      const dObj = parseToDateObject(b.issueDate || b.issue_date || b.createdAt || b.created_at);
      const isTape = String(docNo).toLowerCase().startsWith('tape') ||
                     String(b.style || '').toLowerCase().includes('tape') ||
                     String(b.remarks || '').toLowerCase().includes('tape');

      const matPhoto = materialPhotoMap[String(b.shade || '').toLowerCase()] ||
                       materialPhotoMap[String(b.style || '').toLowerCase()] || null;

      list.push({
        id: `bone-table-${b.id || docNo}`,
        docNo,
        type: isTape ? 'tape_issue' : 'bone_issue',
        typeLabel: isTape ? 'Tape Issue' : 'Bone Issue',
        typeIcon: isTape ? '📏' : '🦴',
        typeGroup: 'issue',
        dateObj: dObj,
        dateYmd: formatDateToYMD(dObj),
        displayDate: formatDisplayDate(dObj),
        displayTime: formatDisplayTime(dObj),
        lotNo: b.lotNo || b.lot_no || 'N/A',
        poNo: b.poNo || b.po_no || '—',
        style: b.style || b.garmentType || b.garment_type || '—',
        brand: b.brand || '—',
        itemCode: b.shade || b.size || 'BONE-ACC',
        materialName: isTape ? 'Drawcord Tape Roll' : (b.style ? `Bone Pocketing (${b.style})` : 'Bone Pocketing Roll'),
        category: isTape ? 'Tape' : 'Bone',
        qty: Number(b.quantity || b.rolls || 1),
        unit: 'Rolls',
        extraDetails: {
          rolls: b.rolls || 1,
          quantity: b.quantity || 0,
          shade: b.shade || '—',
          size: b.size || '—',
          fabric: b.fabric || '—'
        },
        issuerName: b.issuerName || b.issuer_name || '—',
        receiverName: b.receiverName || b.receiver_name || '—',
        receiverDept: 'Cutting Floor',
        supplier: '—',
        location: 'Store / Floor',
        remarks: b.remarks || '',
        photo: matPhoto,
        raw: b
      });
    });

    // 2. INGEST DEDICATED ELASTIC ISSUES
    (elasticIssues || []).forEach(e => {
      const docNo = e.slipNo || e.slip_no || `ELASTIC-${e.id}`;
      seenIssueKeys.add(String(docNo).toLowerCase());

      const dObj = parseToDateObject(e.issueDate || e.issue_date || e.createdAt || e.created_at);
      const isTape = String(docNo).toLowerCase().startsWith('tape') ||
                     (Number(e.totalTapeMtr || e.total_tape_mtr || 0) > 0 && Number(e.totalElasticMtr || e.total_elastic_mtr || 0) === 0);

      const mtr = isTape
        ? Number(e.totalTapeMtr || e.total_tape_mtr || 0)
        : Number(e.totalElasticMtr || e.total_elastic_mtr || 0);

      list.push({
        id: `elastic-table-${e.id || docNo}`,
        docNo,
        type: isTape ? 'tape_issue' : 'elastic_issue',
        typeLabel: isTape ? 'Tape Issue' : 'Elastic Issue',
        typeIcon: isTape ? '📏' : '🧵',
        typeGroup: 'issue',
        dateObj: dObj,
        dateYmd: formatDateToYMD(dObj),
        displayDate: formatDisplayDate(dObj),
        displayTime: formatDisplayTime(dObj),
        lotNo: e.lotNo || e.lot_no || 'N/A',
        poNo: e.poNo || e.po_no || '—',
        style: e.style || e.garmentType || e.garment_type || '—',
        brand: e.brand || '—',
        itemCode: e.elasticWidth || e.width || 'ELASTIC-ACC',
        materialName: isTape ? `Tape (${e.elasticWidth || 'Standard'})` : `Elastic Waistband (${e.elasticWidth || 'Standard'})`,
        category: isTape ? 'Tape' : 'Elastic',
        qty: mtr > 0 ? mtr : Number(e.rolls || 1),
        unit: mtr > 0 ? 'Meters' : 'Rolls',
        extraDetails: {
          rolls: e.rolls || 1,
          meters: mtr,
          elasticPerPcMtr: e.elasticPerPcMtr || e.elastic_per_pc_mtr || 0,
          elasticWidth: e.elasticWidth || e.width || '',
          supervisor: e.supervisorName || e.supervisor_name || ''
        },
        issuerName: e.issuerName || e.issuer_name || '—',
        receiverName: e.receiverName || e.receiver_name || '—',
        receiverDept: 'Cutting / Stitching Floor',
        supplier: '—',
        location: 'Store / Floor',
        remarks: e.remarks || '',
        photo: null,
        raw: e
      });
    });

    // 3. INGEST DEDICATED EXTRA MATERIAL ISSUES (EXTRA PIC ISSUE)
    (extraIssues || []).forEach(ex => {
      const docNo = ex.voucher_id || ex.voucherId || `EMI-${ex.id}`;
      seenIssueKeys.add(String(docNo).toLowerCase());

      const dObj = parseToDateObject(ex.issue_date || ex.created_at || ex.createdAt);
      const matName = ex.material_name || ex.bom_item_name || 'Extra Material';
      const catLower = String(ex.category || '').toLowerCase();
      const matLower = String(matName).toLowerCase();

      // Check if item itself is bone, elastic or tape issued as extra
      let subtype = 'extra_pic_issue';
      let subtypeLabel = 'Extra Pic Issue';
      let subtypeIcon = '➕';

      if (catLower.includes('bone') || matLower.includes('bone')) {
        subtype = 'bone_issue';
        subtypeLabel = 'Bone Extra Issue';
        subtypeIcon = '🦴';
      } else if (catLower.includes('tape') || matLower.includes('tape')) {
        subtype = 'tape_issue';
        subtypeLabel = 'Tape Extra Issue';
        subtypeIcon = '📏';
      } else if (catLower.includes('elastic') || matLower.includes('elastic')) {
        subtype = 'elastic_issue';
        subtypeLabel = 'Elastic Extra Issue';
        subtypeIcon = '🧵';
      }

      const matPhoto = materialPhotoMap[String(ex.material_id || '').toLowerCase()] ||
                       materialPhotoMap[String(ex.material_name || '').toLowerCase()] || null;

      list.push({
        id: `extra-table-${ex.id || docNo}`,
        docNo,
        type: subtype,
        typeLabel: subtypeLabel,
        typeIcon: subtypeIcon,
        typeGroup: 'issue',
        dateObj: dObj,
        dateYmd: formatDateToYMD(dObj),
        displayDate: formatDisplayDate(dObj),
        displayTime: formatDisplayTime(dObj),
        lotNo: ex.lot_id || ex.lotId || 'N/A',
        poNo: '—',
        style: ex.style || 'Extra Requisition',
        brand: ex.brand || '—',
        itemCode: ex.material_id || ex.materialCode || ex.itemCode || 'EMI-ITEM',
        materialName: matName,
        category: ex.category || 'Extra Accessory',
        qty: Number(ex.extra_qty || ex.extraQty || ex.pieces || 0),
        unit: ex.unit || 'Pcs',
        extraDetails: {
          pieces: ex.pieces || 0,
          baseQty: ex.base_qty || 0,
          extraQty: ex.extra_qty || 0,
          excessQty: ex.excess_qty || 0,
          extraPercentage: ex.extra_percentage || 0,
          status: ex.status || 'Issued'
        },
        issuerName: ex.issuer_name || '—',
        receiverName: ex.receiver_name || '—',
        receiverDept: ex.receiver_dept || 'Floor Requisition',
        supplier: '—',
        location: 'Accessories Store',
        remarks: ex.reason ? `${ex.reason}${ex.remarks ? ` (${ex.remarks})` : ''}` : (ex.remarks || ''),
        photo: matPhoto,
        raw: ex
      });
    });

    // 4. INGEST GENERAL & LEGACY ISSUE LOGS (issue_logs)
    (issueLogs || []).forEach(l => {
      const docNo = l.id || `LOG-${l.lotId || ''}`;
      // Skip if already ingested from dedicated tables
      if (seenIssueKeys.has(String(docNo).toLowerCase())) {
        return;
      }
      seenIssueKeys.add(String(docNo).toLowerCase());

      const dObj = parseToDateObject(l.date || l.created_at);
      const idUpper = String(docNo).toUpperCase();
      const catUpper = String(l.category || '').toUpperCase();

      // De-aggregate materials array if present
      let rawMats = [];
      try {
        rawMats = Array.isArray(l.materials) ? l.materials : (typeof l.materials === 'string' ? JSON.parse(l.materials) : []);
      } catch (_) {
        rawMats = [];
      }

      if (rawMats.length > 0) {
        rawMats.forEach((mat, mIdx) => {
          const matName = mat.name || mat.bomItemName || 'Issued Material';
          const matUpper = String(matName).toUpperCase();

          let itemType = 'general_issue';
          let itemLabel = 'General BOM Issue';
          let itemIcon = '📦';
          let itemGroup = 'issue';

          const isReturn = l.isReturn === true || l.isReturn === 1 || String(l.isReturn).toLowerCase() === 'true' || idUpper.startsWith('MR') || String(l.type).toLowerCase() === 'return';

          if (isReturn) {
            itemType = 'return_material';
            itemLabel = 'Material Return';
            itemIcon = '🔄';
            itemGroup = 'return';
          } else if (idUpper.startsWith('BONE') || catUpper.includes('BONE') || matUpper.includes('BONE')) {
            itemType = 'bone_issue';
            itemLabel = 'Bone Issue';
            itemIcon = '🦴';
          } else if (idUpper.startsWith('TAPE') || catUpper.includes('TAPE') || matUpper.includes('TAPE')) {
            itemType = 'tape_issue';
            itemLabel = 'Tape Issue';
            itemIcon = '📏';
          } else if (idUpper.startsWith('ELASTIC') || catUpper.includes('ELASTIC') || matUpper.includes('ELASTIC')) {
            itemType = 'elastic_issue';
            itemLabel = 'Elastic Issue';
            itemIcon = '🧵';
          } else if (idUpper.startsWith('EMI') || catUpper.includes('EXTRA')) {
            itemType = 'extra_pic_issue';
            itemLabel = 'Extra Pic Issue';
            itemIcon = '➕';
          }

          const photo = mat.photo || mat.imageUrl ||
                        materialPhotoMap[String(mat.itemCode || mat.id || '').toLowerCase()] ||
                        materialPhotoMap[String(matName).toLowerCase()] || null;

          list.push({
            id: `log-${docNo}-${mIdx}`,
            docNo,
            type: itemType,
            typeLabel: itemLabel,
            typeIcon: itemIcon,
            typeGroup: itemGroup,
            dateObj: dObj,
            dateYmd: formatDateToYMD(dObj),
            displayDate: formatDisplayDate(dObj),
            displayTime: formatDisplayTime(dObj),
            lotNo: l.lotId || 'N/A',
            poNo: '—',
            style: l.category || '—',
            brand: '—',
            itemCode: mat.itemCode || mat.id || 'ACC-MAT',
            materialName: matName,
            category: mat.category || l.category || 'Trims',
            qty: Number(mat.qty || mat.issuedQty || mat.volume || l.volume || 1),
            unit: mat.unit || 'Pcs',
            extraDetails: {
              requiredQty: mat.requiredQty || mat.totalRequired || 0,
              issuedQty: mat.issuedQty || mat.qty || 0,
              bomItemName: mat.bomItemName || ''
            },
            issuerName: l.personName || l.issuer_name || '—',
            receiverName: l.receiverName || '—',
            receiverDept: l.receiverDept || 'Cutting / Stitching',
            supplier: '—',
            location: 'Main Store',
            remarks: l.isReissue ? 'Re-Issue' : (l.isReturn ? 'Return' : ''),
            photo,
            raw: { ...l, materialItem: mat }
          });
        });
      } else {
        // Single row fallback
        let itemType = 'general_issue';
        let itemLabel = 'General BOM Issue';
        let itemIcon = '📦';
        let itemGroup = 'issue';

        const isReturn = l.isReturn === true || l.isReturn === 1 || String(l.isReturn).toLowerCase() === 'true' || idUpper.startsWith('MR') || String(l.type).toLowerCase() === 'return';

        if (isReturn) {
          itemType = 'return_material';
          itemLabel = 'Material Return';
          itemIcon = '🔄';
          itemGroup = 'return';
        } else if (idUpper.startsWith('BONE') || catUpper.includes('BONE')) {
          itemType = 'bone_issue';
          itemLabel = 'Bone Issue';
          itemIcon = '🦴';
        } else if (idUpper.startsWith('TAPE') || catUpper.includes('TAPE')) {
          itemType = 'tape_issue';
          itemLabel = 'Tape Issue';
          itemIcon = '📏';
        } else if (idUpper.startsWith('ELASTIC') || catUpper.includes('ELASTIC')) {
          itemType = 'elastic_issue';
          itemLabel = 'Elastic Issue';
          itemIcon = '🧵';
        } else if (idUpper.startsWith('EMI') || catUpper.includes('EXTRA')) {
          itemType = 'extra_pic_issue';
          itemLabel = 'Extra Pic Issue';
          itemIcon = '➕';
        }

        list.push({
          id: `log-${docNo}`,
          docNo,
          type: itemType,
          typeLabel: itemLabel,
          typeIcon: itemIcon,
          typeGroup: itemGroup,
          dateObj: dObj,
          dateYmd: formatDateToYMD(dObj),
          displayDate: formatDisplayDate(dObj),
          displayTime: formatDisplayTime(dObj),
          lotNo: l.lotId || 'N/A',
          poNo: '—',
          style: l.category || '—',
          brand: '—',
          itemCode: 'LOG-ISSUE',
          materialName: l.category ? `${l.category} Issue` : 'Material Issue',
          category: l.category || 'Trims',
          qty: Number(l.volume || 1),
          unit: 'Units',
          extraDetails: {},
          issuerName: l.personName || '—',
          receiverName: l.receiverName || '—',
          receiverDept: l.receiverDept || 'Floor',
          supplier: '—',
          location: 'Store',
          remarks: l.isReissue ? 'Re-Issue' : '',
          photo: null,
          raw: l
        });
      }
    });

    // 5. INGEST ADD MATERIAL (WEIGHT CAPTURE & INWARD ADDITIONS)
    (weightCaptures || []).forEach(w => {
      const docNo = w.barcodeId || w.invoiceNo || `ADD-${w.id}`;
      const dObj = parseToDateObject(w.capturedAt || w.createdAt || w.created_at);

      const photo = w.imageUrl || w.materialPhoto ||
                    materialPhotoMap[String(w.materialCode || w.itemCode || w.barcodeId || '').toLowerCase()] ||
                    materialPhotoMap[String(w.materialName || '').toLowerCase()] || null;

      list.push({
        id: `wt-${w.id || docNo}`,
        docNo,
        type: 'added_material',
        typeLabel: 'Add Material (Inward)',
        typeIcon: '📥',
        typeGroup: 'add',
        dateObj: dObj,
        dateYmd: formatDateToYMD(dObj),
        displayDate: formatDisplayDate(dObj),
        displayTime: formatDisplayTime(dObj),
        lotNo: w.lotNo || '—',
        poNo: w.poNumber || '—',
        style: w.category || '—',
        brand: '—',
        itemCode: w.materialCode || w.itemCode || w.barcodeId || 'INWARD-ACC',
        materialName: w.materialName || 'New Added Material',
        category: w.category || 'Store Inward',
        qty: Number(w.pieces || w.packets || (w.netWeightKg ? `${w.netWeightKg} Kg` : 1)),
        unit: w.unit || (w.pieces ? 'Pcs' : 'Kg'),
        extraDetails: {
          pieces: w.pieces || 0,
          packets: w.packets || 0,
          netWeightKg: w.netWeightKg || 0,
          grossWeightKg: w.grossWeightKg || 0,
          tareWeightKg: w.tareWeightKg || 0,
          invoiceNo: w.invoiceNo || '—',
          entryMode: w.entryMode || w.status || 'Weight Capture'
        },
        issuerName: w.storeIncharge || 'Store Team',
        receiverName: 'Accessories Warehouse',
        receiverDept: 'Main Warehouse',
        supplier: w.supplier || '—',
        location: w.storeLocation || 'Main Store',
        remarks: w.remarks || '',
        photo,
        raw: w
      });
    });

    return list;
  }, [boneIssues, elasticIssues, extraIssues, issueLogs, weightCaptures, materialPhotoMap]);

  // ── Apply Filtering (DAILY WISE, DATE WISE, TYPE, SEARCH) ──────────────────────

  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return formatDateToYMD(y);
  }, []);

  const filteredRecords = useMemo(() => {
    let result = [...normalizedRecords];

    // 1. Date Wise Filtering
    if (quickDateFilter === 'today') {
      result = result.filter(r => r.dateYmd === todayStr);
    } else if (quickDateFilter === 'yesterday') {
      result = result.filter(r => r.dateYmd === yesterdayStr);
    } else if (quickDateFilter === 'last7') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const minDate = formatDateToYMD(sevenDaysAgo);
      result = result.filter(r => r.dateYmd >= minDate && r.dateYmd <= todayStr);
    } else if (quickDateFilter === 'thisMonth') {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      result = result.filter(r => r.dateYmd >= firstDay);
    }

    // Specific Single Day Picker
    if (specificDate) {
      result = result.filter(r => r.dateYmd === specificDate);
    }

    // Custom Date Range (From Date -> To Date)
    if (dateFrom) {
      result = result.filter(r => r.dateYmd >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(r => r.dateYmd <= dateTo);
    }

    // 2. Movement / Issue Type Filtering
    if (movementFilter === 'all_issues') {
      result = result.filter(r => r.typeGroup === 'issue');
    } else if (movementFilter === 'add_material') {
      result = result.filter(r => r.type === 'added_material');
    } else if (movementFilter === 'return_material') {
      result = result.filter(r => r.type === 'return_material');
    } else if (movementFilter === 'bone_issue') {
      result = result.filter(r => r.type === 'bone_issue');
    } else if (movementFilter === 'elastic_issue') {
      result = result.filter(r => r.type === 'elastic_issue');
    } else if (movementFilter === 'tape_issue') {
      result = result.filter(r => r.type === 'tape_issue');
    } else if (movementFilter === 'extra_pic_issue') {
      result = result.filter(r => r.type === 'extra_pic_issue');
    } else if (movementFilter === 'general_issue') {
      result = result.filter(r => r.type === 'general_issue');
    }

    // 3. Search Query Filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        (r.docNo && r.docNo.toLowerCase().includes(q)) ||
        (r.materialName && r.materialName.toLowerCase().includes(q)) ||
        (r.itemCode && r.itemCode.toLowerCase().includes(q)) ||
        (r.lotNo && r.lotNo.toLowerCase().includes(q)) ||
        (r.poNo && r.poNo.toLowerCase().includes(q)) ||
        (r.style && r.style.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.issuerName && r.issuerName.toLowerCase().includes(q)) ||
        (r.receiverName && r.receiverName.toLowerCase().includes(q)) ||
        (r.supplier && r.supplier.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }

    // 4. Sort Records
    result.sort((a, b) => {
      const timeA = a.dateObj.getTime();
      const timeB = b.dateObj.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [normalizedRecords, quickDateFilter, specificDate, dateFrom, dateTo, movementFilter, searchQuery, sortOrder, todayStr, yesterdayStr]);

  // ── KPI Summary Calculations ───────────────────────────────────────────────────
  const summaryKpis = useMemo(() => {
    let totalAdded = 0;
    let totalAddedPcs = 0;
    let totalAddedKg = 0;

    let totalIssued = 0;
    let boneCount = 0;
    let boneRolls = 0;
    let elasticCount = 0;
    let elasticMeters = 0;
    let tapeCount = 0;
    let tapeMeters = 0;
    let extraPicCount = 0;
    let extraPicQty = 0;
    let generalIssueCount = 0;

    filteredRecords.forEach(r => {
      if (r.type === 'added_material') {
        totalAdded += 1;
        totalAddedPcs += Number(r.extraDetails?.pieces || (r.unit === 'Pcs' ? r.qty : 0));
        totalAddedKg += Number(r.extraDetails?.netWeightKg || (r.unit === 'Kg' ? r.qty : 0));
      } else {
        totalIssued += 1;
        if (r.type === 'bone_issue') {
          boneCount += 1;
          boneRolls += Number(r.extraDetails?.rolls || r.qty || 1);
        } else if (r.type === 'elastic_issue') {
          elasticCount += 1;
          elasticMeters += Number(r.extraDetails?.meters || r.qty || 0);
        } else if (r.type === 'tape_issue') {
          tapeCount += 1;
          tapeMeters += Number(r.extraDetails?.meters || r.qty || 0);
        } else if (r.type === 'extra_pic_issue') {
          extraPicCount += 1;
          extraPicQty += Number(r.extraDetails?.extraQty || r.qty || 0);
        } else if (r.type === 'general_issue') {
          generalIssueCount += 1;
        }
      }
    });

    return {
      totalTransactions: filteredRecords.length,
      totalAdded,
      totalAddedPcs,
      totalAddedKg: totalAddedKg.toFixed(2),
      totalIssued,
      boneCount,
      boneRolls,
      elasticCount,
      elasticMeters: Math.round(elasticMeters),
      tapeCount,
      tapeMeters: Math.round(tapeMeters),
      extraPicCount,
      extraPicQty: Math.round(extraPicQty),
      generalIssueCount
    };
  }, [filteredRecords]);

  // ── Group by Day Structure (Daily Wise Mode) ──────────────────────────────────
  const dailyGroups = useMemo(() => {
    const groups = {};
    filteredRecords.forEach(rec => {
      const key = rec.dateYmd || 'Undated';
      if (!groups[key]) {
        groups[key] = {
          dateYmd: key,
          displayDate: rec.displayDate,
          records: [],
          addedCount: 0,
          issuedCount: 0,
          boneCount: 0,
          elasticCount: 0,
          tapeCount: 0,
          extraPicCount: 0
        };
      }
      groups[key].records.push(rec);
      if (rec.type === 'added_material') {
        groups[key].addedCount += 1;
      } else {
        groups[key].issuedCount += 1;
        if (rec.type === 'bone_issue') groups[key].boneCount += 1;
        if (rec.type === 'elastic_issue') groups[key].elasticCount += 1;
        if (rec.type === 'tape_issue') groups[key].tapeCount += 1;
        if (rec.type === 'extra_pic_issue') groups[key].extraPicCount += 1;
      }
    });

    return Object.values(groups).sort((a, b) => {
      return sortOrder === 'desc'
        ? b.dateYmd.localeCompare(a.dateYmd)
        : a.dateYmd.localeCompare(b.dateYmd);
    });
  }, [filteredRecords, sortOrder]);

  // Toggle Collapse on Day Card
  const toggleDayCollapse = (dateYmd) => {
    setCollapsedDays(prev => ({
      ...prev,
      [dateYmd]: !prev[dateYmd]
    }));
  };

  // ── Export to Excel (.xlsx) with Full Details ──────────────────────────────
  const exportToExcel = () => {

    if (filteredRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    const rows = filteredRecords.map((r, idx) => ({
      'S.No': idx + 1,
      'Date': r.displayDate,
      'Time': r.displayTime || '—',
      'Movement Type': r.typeLabel,
      'Doc / Slip #': r.docNo,
      'Lot Number': r.lotNo && r.lotNo !== 'N/A' ? r.lotNo : 'Without Lot',
      'PO Number': r.poNo && r.poNo !== '—' ? r.poNo : '—',
      'Item Code': r.itemCode,
      'Material Name': r.materialName,
      'Category': r.category,
      'Style / Garment': r.style && r.style !== '—' ? r.style : '—',
      'Brand': r.brand && r.brand !== '—' ? r.brand : '—',
      'Quantity': r.qty,
      'Unit': r.unit,
      'Rolls': r.extraDetails?.rolls || '',
      'Meters': r.extraDetails?.meters || '',
      'Net Weight (Kg)': r.extraDetails?.netWeightKg || '',
      'Gross Weight (Kg)': r.extraDetails?.grossWeightKg || '',
      'Tare Weight (Kg)': r.extraDetails?.tareWeightKg || '',
      'Pieces': r.extraDetails?.pieces || '',
      'Packets': r.extraDetails?.packets || '',
      'Issued By / Incharge': r.issuerName,
      'Issued To / Receiver': r.receiverName,
      'Department': r.receiverDept,
      'Supplier / Vendor': r.supplier && r.supplier !== '—' ? r.supplier : '—',
      'Location / Rack': r.location,
      'Remarks / Reason': r.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movement_Details');

    const fileName = `Material_Movement_Details_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // ── Download Single Record as Excel ──────────────────────────────────────────
  const exportSingleRecordExcel = (r) => {
    if (!r) return;
    const rows = [
      { Field: 'Document / Slip #', Value: r.docNo },
      { Field: 'Movement Type', Value: r.typeLabel },
      { Field: 'Date', Value: r.displayDate },
      { Field: 'Time', Value: r.displayTime || '—' },
      { Field: 'Material Name', Value: r.materialName },
      { Field: 'Item Code', Value: r.itemCode },
      { Field: 'Category', Value: r.category },
      { Field: 'Quantity', Value: `${r.qty} ${r.unit}` },
      { Field: 'Lot Number', Value: r.lotNo && r.lotNo !== 'N/A' ? r.lotNo : 'Without Lot' },
      { Field: 'PO Number', Value: r.poNo || '—' },
      { Field: 'Style / Garment', Value: r.style || '—' },
      { Field: 'Brand', Value: r.brand || '—' },
      { Field: 'Issued To / Receiver', Value: r.receiverName || '—' },
      { Field: 'Receiver Department', Value: r.receiverDept || '—' },
      { Field: 'Issued By / Incharge', Value: r.issuerName || '—' },
      { Field: 'Supplier / Vendor', Value: r.supplier || '—' },
      { Field: 'Store Location / Rack', Value: r.location || '—' },
      { Field: 'Remarks / Reason', Value: r.remarks || '—' }
    ];
    if (r.extraDetails?.rolls) rows.push({ Field: 'Rolls', Value: r.extraDetails.rolls });
    if (r.extraDetails?.meters) rows.push({ Field: 'Meters', Value: r.extraDetails.meters });
    if (r.extraDetails?.netWeightKg) rows.push({ Field: 'Net Weight (Kg)', Value: r.extraDetails.netWeightKg });
    if (r.extraDetails?.pieces) rows.push({ Field: 'Pieces', Value: r.extraDetails.pieces });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaction_Details');
    XLSX.writeFile(wb, `${r.type}_${r.docNo}_details.xlsx`);
  };

  // ── Download Day Group as Excel ──────────────────────────────────────────────
  const exportGroupExcel = (group) => {
    if (!group || !group.records || group.records.length === 0) return;
    const rows = group.records.map((r, idx) => ({
      'S.No': idx + 1,
      'Date': r.displayDate,
      'Time': r.displayTime || '—',
      'Movement Type': r.typeLabel,
      'Doc / Slip #': r.docNo,
      'Lot Number': r.lotNo && r.lotNo !== 'N/A' ? r.lotNo : 'Without Lot',
      'PO Number': r.poNo && r.poNo !== '—' ? r.poNo : '—',
      'Item Code': r.itemCode,
      'Material Name': r.materialName,
      'Category': r.category,
      'Quantity': r.qty,
      'Unit': r.unit,
      'Issued By / Incharge': r.issuerName,
      'Issued To / Receiver': r.receiverName,
      'Department': r.receiverDept,
      'Supplier / Vendor': r.supplier,
      'Location / Rack': r.location,
      'Remarks / Reason': r.remarks
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Day_${group.dateYmd}`);
    XLSX.writeFile(wb, `Movement_Details_${group.dateYmd}.xlsx`);
  };

  // ── Export to CSV (.csv) ──────────────────────────────────────────────────
  const exportToCsv = () => {
    if (filteredRecords.length === 0) {
      alert('No records available to export.');
      return;
    }
    const headers = [
      'S.No', 'Date', 'Time', 'Movement Type', 'Doc / Slip #',
      'Material Name', 'Item Code', 'Category', 'Lot #', 'PO #',
      'Quantity', 'Unit', 'Issued To', 'Department', 'Issued By',
      'Supplier', 'Location', 'Remarks'
    ];
    const rows = filteredRecords.map((r, i) => [
      i + 1,
      `"${r.displayDate}"`,
      `"${r.displayTime || ''}"`,
      `"${r.typeLabel}"`,
      `"${r.docNo}"`,
      `"${(r.materialName || '').replace(/"/g, '""')}"`,
      `"${r.itemCode || ''}"`,
      `"${r.category || ''}"`,
      `"${r.lotNo && r.lotNo !== 'N/A' ? r.lotNo : ''}"`,
      `"${r.poNo && r.poNo !== '—' ? r.poNo : ''}"`,
      r.qty,
      `"${r.unit || ''}"`,
      `"${(r.receiverName || '').replace(/"/g, '""')}"`,
      `"${(r.receiverDept || '').replace(/"/g, '""')}"`,
      `"${(r.issuerName || '').replace(/"/g, '""')}"`,
      `"${(r.supplier && r.supplier !== '—' ? r.supplier : '').replace(/"/g, '""')}"`,
      `"${(r.location || '').replace(/"/g, '""')}"`,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Material_Movement_Details_${todayStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Download Single Record as PDF Slip (Crisp B&W Ink-Saver) ───────────────
  const downloadRecordPdf = (r, isBW = true) => {
    if (!r) return;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Header Banner
      doc.setFillColor(isBW ? 0 : 15, isBW ? 0 : 23, isBW ? 0 : 42);
      doc.rect(0, 0, pageWidth, 55, 'F');

      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('MH TEXTILES - MATERIAL MOVEMENT SLIP', 40, 30);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 220, 220);
      doc.text(`Official Transaction Record | ${r.typeLabel.toUpperCase()} | ${isBW ? 'B&W INK-SAVER' : 'COLOR'}`, 40, 46);

      // Subheader Box
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Document No: ${r.docNo}`, 40, 80);
      doc.text(`Date & Time: ${r.displayDate} ${r.displayTime || ''}`, 340, 80);

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.line(40, 90, pageWidth - 40, 90);

      // AutoTable
      autoTable(doc, {
        startY: 100,
        margin: { left: 40, right: 40 },
        theme: 'grid',
        headStyles: {
          fillColor: isBW ? [235, 235, 235] : [3, 105, 161],
          textColor: isBW ? [0, 0, 0] : [255, 255, 255],
          fontStyle: 'bold',
          lineColor: [0, 0, 0],
          lineWidth: 0.8
        },
        styles: {
          font: 'helvetica',
          fontSize: 10,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          cellPadding: 6
        },
        head: [['Field / Attribute', 'Transaction Details']],
        body: [
          ['Movement Type', r.typeLabel],
          ['Document / Slip #', r.docNo],
          ['Date & Time', `${r.displayDate} ${r.displayTime || ''}`],
          ['Material Name', r.materialName || '—'],
          ['Item Code / Barcode', r.itemCode || '—'],
          ['Category', r.category || '—'],
          ['Quantity & Unit', `${r.qty} ${r.unit}`],
          ['Lot Number', r.lotNo && r.lotNo !== 'N/A' ? `Lot ${r.lotNo}` : 'Without Lot'],
          ['PO Number', r.poNo || '—'],
          ['Style / Garment', r.style || '—'],
          ['Brand', r.brand || '—'],
          ['Issued To / Receiver', `${r.receiverName || '—'} (${r.receiverDept || '—'})`],
          ['Issued By / Incharge', r.issuerName || '—'],
          ['Supplier / Vendor', r.supplier || '—'],
          ['Location / Store Rack', r.location || '—'],
          ['Remarks / Reason', r.remarks || '—']
        ]
      });

      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 45 : 450;
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 40, finalY);
      doc.text('Receiver Sign: _____________________', 40, finalY + 30);
      doc.text('Authorized Sign: _____________________', pageWidth - 240, finalY + 30);

      doc.save(`${r.type}_${r.docNo}_slip.pdf`);
    } catch (err) {
      console.error('Failed to generate record PDF:', err);
      alert('Error generating PDF slip: ' + err.message);
    }
  };

  // ── Download Entire Filtered Report as B&W PDF ──────────────────────────────
  const downloadReportPdf = (isBW = true) => {
    if (filteredRecords.length === 0) {
      alert('No records available to download.');
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Banner
      doc.setFillColor(isBW ? 0 : 15, isBW ? 0 : 23, isBW ? 0 : 42);
      doc.rect(0, 0, pageWidth, 48, 'F');

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('MH TEXTILES & ACCESSORIES - MATERIAL MOVEMENT REGISTER', 30, 24);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 220, 220);
      doc.text(
        `CONSOLIDATED REGISTER (BONE, ELASTIC, TAPE, EXTRA PIC & ADDED) | ${isBW ? 'B&W INK-SAVER' : 'COLOR'} | Date: ${new Date().toLocaleDateString('en-IN')} | Records: ${filteredRecords.length}`,
        30,
        38
      );

      const tableBody = filteredRecords.map((r, i) => [
        i + 1,
        `${r.displayDate}\n${r.displayTime || ''}`,
        r.typeLabel,
        r.docNo,
        `${r.materialName}\nCode: ${r.itemCode}`,
        r.lotNo !== 'N/A' && r.lotNo !== '—' ? `Lot ${r.lotNo}${r.poNo !== '—' ? `\nPO: ${r.poNo}` : ''}` : '—',
        `${r.qty} ${r.unit}${r.extraDetails?.rolls ? `\n(${r.extraDetails.rolls} Rolls)` : ''}`,
        `${r.receiverName || '—'}\n${r.receiverDept || ''}`,
        r.issuerName || '—',
        r.location || '—',
        r.remarks || '—'
      ]);

      autoTable(doc, {
        startY: 56,
        margin: { left: 20, right: 20 },
        theme: 'grid',
        headStyles: {
          fillColor: isBW ? [240, 240, 240] : [2, 132, 199],
          textColor: isBW ? [0, 0, 0] : [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          lineColor: isBW ? [0, 0, 0] : [200, 200, 200],
          lineWidth: isBW ? 0.8 : 0.5
        },
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          textColor: [0, 0, 0],
          lineColor: isBW ? [0, 0, 0] : [220, 220, 220],
          lineWidth: isBW ? 0.6 : 0.4,
          cellPadding: 4,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 58 },
          2: { cellWidth: 62 },
          3: { cellWidth: 70 },
          4: { cellWidth: 120 },
          5: { cellWidth: 65 },
          6: { cellWidth: 55, halign: 'center' },
          7: { cellWidth: 80 },
          8: { cellWidth: 65 },
          9: { cellWidth: 65 },
          10: { cellWidth: 'auto' }
        },
        head: [['#', 'Date & Time', 'Type', 'Doc/Slip #', 'Material Item', 'Lot # / PO #', 'Quantity', 'Issued To', 'Issued By', 'Location', 'Remarks']],
        body: tableBody
      });

      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 25 : 500;
      if (finalY < doc.internal.pageSize.getHeight() - 30) {
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(`Report Generated By: ${currentUser?.name || 'Authorized Store User'} | Printed On: ${new Date().toLocaleString('en-IN')}`, 30, finalY);
        doc.text('Store Incharge Signature: _______________________', pageWidth - 250, finalY);
      }

      doc.save(`Material_Movement_Report_${isBW ? 'BW_' : ''}${todayStr}.pdf`);
    } catch (err) {
      console.error('Failed to generate report PDF:', err);
      alert('Error generating PDF report: ' + err.message);
    }
  };

  // ── Dedicated Clean Print Report (Black & White Ink-Saver Window) ────────────
  const handlePrint = (isBW = true) => {
    if (filteredRecords.length === 0) {
      alert('No records available to print.');
      return;
    }

    const printWin = window.open('', '_blank', 'width=1150,height=850');
    if (!printWin) {
      alert('Popup was blocked by browser. Please allow popups to print report.');
      return;
    }

    const tableRowsHtml = filteredRecords.map((r, i) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${i + 1}</td>
        <td style="white-space: nowrap;"><strong>${r.displayDate}</strong><br/><small style="color: #333;">${r.displayTime || ''}</small></td>
        <td><span class="badge">${r.typeLabel}</span></td>
        <td style="font-weight: bold; white-space: nowrap;">${r.docNo}</td>
        <td><strong>${r.materialName}</strong><br/><small>Code: ${r.itemCode} | ${r.category}</small></td>
        <td style="white-space: nowrap;">${r.lotNo && r.lotNo !== 'N/A' ? `<strong>Lot ${r.lotNo}</strong>` : '—'}${r.poNo && r.poNo !== '—' ? `<br/><small>PO: ${r.poNo}</small>` : ''}</td>
        <td style="text-align: center; font-weight: 800; white-space: nowrap;">${r.qty} ${r.unit}${r.extraDetails?.rolls > 1 ? `<br/><small>(${r.extraDetails.rolls} Rolls)</small>` : ''}</td>
        <td><strong>${formatPersonName(r.receiverName)}</strong><br/><small>${r.receiverDept}</small></td>
        <td>${formatPersonName(r.issuerName)}</td>
        <td>${r.location}</td>
        <td style="max-width: 140px; word-break: break-word;">${r.remarks || '—'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Material Movement Register (B&W Print) - MH Store</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 6mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }
          body {
            margin: 0;
            padding: 12px;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
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
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .btn-print {
            background: #000000;
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.4);
            padding: 7px 16px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-close {
            background: #475569;
            color: #ffffff;
            border: none;
            padding: 7px 14px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0 !important; }
            thead { display: table-header-group !important; }
            tr { page-break-inside: avoid !important; }
          }
          .header-box {
            border-bottom: 2px solid #000000;
            padding-bottom: 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .company-title {
            font-size: 17px;
            font-weight: 900;
            color: #000000;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
          }
          .doc-title {
            font-size: 12.5px;
            font-weight: 800;
            color: #000000;
            margin: 0;
          }
          .doc-sub {
            font-size: 10px;
            color: #333333;
            margin-top: 2px;
          }
          .meta-info {
            text-align: right;
            font-size: 10px;
            color: #000000;
            line-height: 1.4;
          }
          .summary-strip {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
          }
          .summary-card {
            flex: 1;
            border: 1px solid #000000;
            padding: 6px 8px;
            font-size: 10px;
            text-align: center;
          }
          .summary-card strong {
            display: block;
            font-size: 13px;
            color: #000000;
            margin-top: 2px;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          table.report-table th, table.report-table td {
            border: 1px solid #000000;
            padding: 5px 6px;
            vertical-align: top;
          }
          table.report-table th {
            background-color: #f1f5f9;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.03em;
            text-align: left;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #000000;
            font-size: 9.5px;
            font-weight: 700;
            white-space: nowrap;
          }
          .footer-signs {
            margin-top: 18px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn-print" onclick="window.print()">🖨️ Print Now (Black &amp; White)</button>
            <span style="font-size: 12px; color: #cbd5e1;">A4 Landscape Format &bull; High Contrast Ink-Saver</span>
          </div>
          <button class="btn-close" onclick="window.close()">✕ Close Preview</button>
        </div>

        <div class="header-box">
          <div>
            <div class="company-title">MH TEXTILES &amp; ACCESSORIES WAREHOUSE</div>
            <div class="doc-title">ALL ISSUED &amp; ADDED MATERIAL MOVEMENT REGISTER</div>
            <div class="doc-sub">Consolidated: Bone Issue, Elastic Issue, Tape Issue, Extra Pic Issue, General BOM Issue &amp; Added Material</div>
          </div>
          <div class="meta-info">
            <div><strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
            <div><strong>Filter Type:</strong> ${movementFilter.toUpperCase()}</div>
            <div><strong>Date Filter:</strong> ${quickDateFilter.toUpperCase()}${dateFrom ? ` (${dateFrom} to ${dateTo})` : ''}</div>
            <div><strong>Total Records:</strong> ${filteredRecords.length}</div>
          </div>
        </div>

        <div class="summary-strip">
          <div class="summary-card">
            Filtered Movements
            <strong>${summaryKpis.totalTransactions}</strong>
          </div>
          <div class="summary-card">
            Added Material (Inward)
            <strong>${summaryKpis.totalAdded} (${summaryKpis.totalAddedPcs} pcs)</strong>
          </div>
          <div class="summary-card">
            Total Material Issued
            <strong>${summaryKpis.totalIssued}</strong>
          </div>
          <div class="summary-card">
            Bone Issue
            <strong>${summaryKpis.boneCount} (${summaryKpis.boneRolls} Rolls)</strong>
          </div>
          <div class="summary-card">
            Elastic Issue
            <strong>${summaryKpis.elasticCount} (${summaryKpis.elasticMeters} m)</strong>
          </div>
          <div class="summary-card">
            Tape Issue
            <strong>${summaryKpis.tapeCount} (${summaryKpis.tapeMeters} m)</strong>
          </div>
          <div class="summary-card">
            Extra Pic Issue
            <strong>${summaryKpis.extraPicCount} (${summaryKpis.extraPicQty} pcs)</strong>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 26px; text-align: center;">#</th>
              <th style="width: 70px;">Date &amp; Time</th>
              <th style="width: 80px;">Type</th>
              <th style="width: 85px;">Doc / Slip #</th>
              <th>Material Name &amp; Code</th>
              <th style="width: 75px;">Lot / PO #</th>
              <th style="width: 65px; text-align: center;">Quantity</th>
              <th style="width: 90px;">Issued To / Dept</th>
              <th style="width: 75px;">Issued By</th>
              <th style="width: 75px;">Location</th>
              <th style="width: 100px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer-signs">
          <div>Prepared By: __________________________</div>
          <div>Verified By: __________________________</div>
          <div>Authorized Store Incharge: __________________________</div>
        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };


  // Copy Doc No Handler
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text).trim());
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper Badge Color Styles
  const getTypeBadgeStyle = (type) => {
    switch (type) {
      case 'bone_issue':
        return {
          bg: '#fff7ed',
          border: '#fdba74',
          color: '#c2410c',
          glow: 'rgba(234, 88, 12, 0.15)'
        };
      case 'elastic_issue':
        return {
          bg: '#eef2ff',
          border: '#a5b4fc',
          color: '#4338ca',
          glow: 'rgba(79, 70, 229, 0.15)'
        };
      case 'tape_issue':
        return {
          bg: '#f0fdfa',
          border: '#5eead4',
          color: '#0f766e',
          glow: 'rgba(13, 148, 136, 0.15)'
        };
      case 'extra_pic_issue':
        return {
          bg: '#fff1f2',
          border: '#fda4af',
          color: '#be123c',
          glow: 'rgba(225, 29, 72, 0.15)'
        };
      case 'added_material':
        return {
          bg: '#f0fdf4',
          border: '#86efac',
          color: '#15803d',
          glow: 'rgba(22, 163, 74, 0.15)'
        };
      case 'return_material':
        return {
          bg: '#ecfdf5',
          border: '#a7f3d0',
          color: '#047857',
          glow: 'rgba(16, 185, 129, 0.15)'
        };
      default:
        return {
          bg: '#f8fafc',
          border: '#cbd5e1',
          color: '#334155',
          glow: 'rgba(100, 116, 139, 0.1)'
        };
    }
  };

  return (
    <div className="movement-report-root" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      color: 'var(--text-main, #0f172a)',
      fontFamily: 'inherit'
    }}>
      {/* ── PRINT STYLES FOR CRISP BLACK & WHITE INK-SAVER PRINTING ────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 6mm;
          }

          /* Hide global app layout components & screen-only controls */
          nav, aside, header, .sidebar, .navbar, .top-nav, button.sidebar-toggle, .antigravity-header,
          .no-print, .print-hide, .top-header-banner-screen, .kpi-cards-grid, .filter-control-panel,
          .action-col, .action-cell, .no-print-element, button {
            display: none !important;
          }

          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .movement-report-root {
            gap: 8px !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }

          /* Show Print Only Header & Summary Box */
          .print-only-header {
            display: block !important;
          }
          .print-only-summary {
            display: flex !important;
          }
          .print-only-footer {
            display: flex !important;
          }

          /* Expand all day accordions in daily grouped view */
          .daily-group-body {
            display: block !important;
          }
          .daily-group-card {
            break-inside: avoid !important;
            border: 1px solid #000000 !important;
            margin-bottom: 12px !important;
            box-shadow: none !important;
          }
          .daily-group-header {
            background: #f1f5f9 !important;
            border-bottom: 1px solid #000000 !important;
            color: #000000 !important;
            padding: 6px 10px !important;
          }

          /* High contrast black & white table styles */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
            color: #000000 !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 4px 6px !important;
            color: #000000 !important;
            background: transparent !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            font-size: 7.5pt !important;
            color: #000000 !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }

          .badge {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            font-weight: 700 !important;
          }

          .report-table-container {
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* ── PRINT-ONLY B&W HEADER (VISIBLE ONLY IN PRINT / PDF) ─────────────── */}
      <div className="print-only-header" style={{
        display: 'none',
        borderBottom: '2px solid #000000',
        paddingBottom: '8px',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: '0 0 2px 0', fontSize: '16pt', fontWeight: '900', color: '#000000', letterSpacing: '0.5px' }}>
              MH TEXTILES &amp; ACCESSORIES WAREHOUSE
            </h1>
            <div style={{ fontSize: '11pt', fontWeight: '800', color: '#000000', margin: '2px 0' }}>
              ALL ISSUED &amp; ADDED MATERIAL MOVEMENT REGISTER (B&amp;W INK-SAVER)
            </div>
            <div style={{ fontSize: '8.5pt', color: '#333333' }}>
              Consolidated Record: Bone Issue, Elastic Issue, Tape Issue, Extra Pic Issue, General BOM Issue &amp; Added Material
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8pt', color: '#000000', lineHeight: '1.4' }}>
            <div><strong>Report Date:</strong> {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Movement Filter:</strong> {movementFilter.toUpperCase()}</div>
            <div><strong>Date Filter:</strong> {quickDateFilter.toUpperCase()}{dateFrom ? ` (${dateFrom} to ${dateTo})` : ''}</div>
            <div><strong>Total Movements:</strong> {filteredRecords.length} records</div>
          </div>
        </div>
      </div>

      {/* ── PRINT-ONLY 1-ROW SUMMARY STRIP (MONOCHROME INK-SAVER) ───────────── */}
      <div className="print-only-summary" style={{
        display: 'none',
        gap: '6px',
        marginBottom: '10px'
      }}>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Movements: <strong>{summaryKpis.totalTransactions}</strong>
        </div>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Added (Inward): <strong>{summaryKpis.totalAdded} ({summaryKpis.totalAddedPcs} pcs)</strong>
        </div>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Total Issued: <strong>{summaryKpis.totalIssued}</strong>
        </div>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Bone Issue: <strong>{summaryKpis.boneCount} ({summaryKpis.boneRolls} Rolls)</strong>
        </div>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Elastic: <strong>{summaryKpis.elasticCount} ({summaryKpis.elasticMeters}m)</strong>
        </div>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Tape Issue: <strong>{summaryKpis.tapeCount} ({summaryKpis.tapeMeters}m)</strong>
        </div>
        <div style={{ flex: 1, border: '1px solid #000000', background: '#f8fafc', padding: '4px 6px', fontSize: '7.5pt', textAlign: 'center' }}>
          Extra Pic: <strong>{summaryKpis.extraPicCount} ({summaryKpis.extraPicQty} pcs)</strong>
        </div>
      </div>

      {/* ── TOP HEADER CARD (SCREEN ONLY) ──────────────────────────────────────── */}
      <div className="top-header-banner-screen no-print" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
        color: '#ffffff',
        padding: '24px 28px',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative background circles */}
        <div style={{
          position: 'absolute',
          right: '-40px',
          top: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ zIndex: 1, maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(56, 189, 248, 0.25)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '20px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Sparkles size={12} /> Unified Register
            </span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              Total: <strong>{normalizedRecords.length}</strong> movements tracked
            </span>
          </div>

          <h1 style={{
            fontSize: '26px',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span>All Issued &amp; Added Material Report</span>
          </h1>

          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#cbd5e1',
            lineHeight: '1.5'
          }}>
            Complete unified tracking of <strong>Bone Issue</strong>, <strong>Elastic Issue</strong>, <strong>Tape Issue</strong>, <strong>Extra Pic Issue</strong>, General BOM Issues &amp; <strong>Added Materials (Inward)</strong> with daily &amp; date-wise filtering.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          zIndex: 1
        }}>
          <button
            onClick={fetchAllMovementData}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)'
            }}
            title="Refresh All Data"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => handlePrint(true)}
            style={{
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.2s'
            }}
            title="Print clean high-contrast Black & White Ink-Saver report"
          >
            <Printer size={15} />
            <span>Print Report (B&amp;W)</span>
          </button>

          <button
            onClick={() => downloadReportPdf(true)}
            style={{
              background: '#dc2626',
              border: 'none',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
              transition: 'all 0.2s'
            }}
            title="Download full report as Black & White PDF"
          >
            <FileText size={15} />
            <span>Download B&amp;W PDF</span>
          </button>

          <button
            onClick={exportToExcel}
            style={{
              background: '#10b981',
              border: 'none',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s'
            }}
            title="Export filtered records to Microsoft Excel"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={exportToCsv}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Export filtered records to CSV"
          >
            <Download size={15} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI METRICS STRIP (SCREEN ONLY) ────────────────────────────────────── */}
      <div className="kpi-cards-grid no-print" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        {/* Metric 1: Total Movements */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Filtered Records</span>
            <Activity size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
            {summaryKpis.totalTransactions}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {summaryKpis.totalIssued} Issued &bull; {summaryKpis.totalAdded} Added
          </span>
        </div>

        {/* Metric 2: Added Material (Inward) */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid #86efac',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(22, 163, 74, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>📥 Add Material</span>
            <Package size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>
            {summaryKpis.totalAdded}
          </div>
          <span style={{ fontSize: '11px', color: '#15803d' }}>
            {summaryKpis.totalAddedPcs.toLocaleString()} pcs &bull; {summaryKpis.totalAddedKg} kg
          </span>
        </div>

        {/* Metric 3: Total Issued */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid #93c5fd',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase' }}>📤 Total Issued</span>
            <ArrowUpRight size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8' }}>
            {summaryKpis.totalIssued}
          </div>
          <span style={{ fontSize: '11px', color: '#2563eb' }}>
            Across all issue channels
          </span>
        </div>

        {/* Metric 4: Bone Issue */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid #fdba74',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(234, 88, 12, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#c2410c', textTransform: 'uppercase' }}>🦴 Bone Issue</span>
            <span style={{ fontSize: '16px' }}>🦴</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#ea580c' }}>
            {summaryKpis.boneCount}
          </div>
          <span style={{ fontSize: '11px', color: '#9a3412' }}>
            {summaryKpis.boneRolls} total rolls issued
          </span>
        </div>

        {/* Metric 5: Elastic Issue */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid #a5b4fc',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(79, 70, 229, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#4338ca', textTransform: 'uppercase' }}>🧵 Elastic Issue</span>
            <span style={{ fontSize: '16px' }}>🧵</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#4f46e5' }}>
            {summaryKpis.elasticCount}
          </div>
          <span style={{ fontSize: '11px', color: '#3730a3' }}>
            {summaryKpis.elasticMeters.toLocaleString()} meters issued
          </span>
        </div>

        {/* Metric 6: Tape Issue */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid #5eead4',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(13, 148, 136, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f766e', textTransform: 'uppercase' }}>📏 Tape Issue</span>
            <span style={{ fontSize: '16px' }}>📏</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0d9488' }}>
            {summaryKpis.tapeCount}
          </div>
          <span style={{ fontSize: '11px', color: '#115e59' }}>
            {summaryKpis.tapeMeters.toLocaleString()} meters issued
          </span>
        </div>

        {/* Metric 7: Extra Pic Issue */}
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid #fda4af',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(225, 29, 72, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#be123c', textTransform: 'uppercase' }}>➕ Extra Pic Issue</span>
            <span style={{ fontSize: '16px' }}>➕</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#e11d48' }}>
            {summaryKpis.extraPicCount}
          </div>
          <span style={{ fontSize: '11px', color: '#9f1239' }}>
            {summaryKpis.extraPicQty.toLocaleString()} extra pcs
          </span>
        </div>
      </div>

      {/* ── FILTER CONTROL PANEL (SCREEN ONLY) ─────────────────────────────────── */}
      <div className="filter-control-panel no-print" style={{
        background: 'var(--bg-secondary, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* ROW 1: Movement Type Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
              Filter By Type:
            </span>

            {[
              { id: 'all', label: 'All Transactions', icon: '⚡' },
              { id: 'add_material', label: 'Add Material (Inward)', icon: '📥' },
              { id: 'all_issues', label: 'All Issued Material', icon: '📤' },
              { id: 'return_material', label: 'Material Return', icon: '🔄' },
              { id: 'bone_issue', label: 'Bone Issue', icon: '🦴' },
              { id: 'elastic_issue', label: 'Elastic Issue', icon: '🧵' },
              { id: 'tape_issue', label: 'Tape Issue', icon: '📏' },
              { id: 'extra_pic_issue', label: 'Extra Pic Issue', icon: '➕' },
              { id: 'general_issue', label: 'General BOM Issue', icon: '📦' }
            ].map(tab => {
              const active = movementFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMovementFilter(tab.id)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: active ? '700' : '600',
                    border: active ? '1px solid #2563eb' : '1px solid var(--border-color, #cbd5e1)',
                    background: active ? '#2563eb' : 'var(--bg-primary, #ffffff)',
                    color: active ? '#ffffff' : 'var(--text-main, #334155)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s',
                    boxShadow: active ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none'
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle: Table Register vs Daily Wise Grouped Accordion */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-primary, #f1f5f9)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e2e8f0)'
          }}>
            <button
              onClick={() => setViewLayout('table')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewLayout === 'table' ? 'var(--bg-secondary, #ffffff)' : 'transparent',
                color: viewLayout === 'table' ? '#2563eb' : '#64748b',
                fontWeight: viewLayout === 'table' ? '700' : '600',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: viewLayout === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <LayoutGrid size={14} />
              <span>Table View</span>
            </button>

            <button
              onClick={() => setViewLayout('daily_grouped')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewLayout === 'daily_grouped' ? 'var(--bg-secondary, #ffffff)' : 'transparent',
                color: viewLayout === 'daily_grouped' ? '#2563eb' : '#64748b',
                fontWeight: viewLayout === 'daily_grouped' ? '700' : '600',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: viewLayout === 'daily_grouped' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <CalendarDays size={14} />
              <span>Daily Wise Breakdown ({dailyGroups.length} Days)</span>
            </button>
          </div>
        </div>

        {/* ROW 2: DAILY WISE & DATE WISE FILTERS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          paddingTop: '12px',
          borderTop: '1px dashed var(--border-color, #e2e8f0)'
        }}>
          {/* Quick Date Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
              Daily / Date Wise:
            </span>

            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today (Daily)' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'thisMonth', label: 'This Month' }
            ].map(q => {
              const active = quickDateFilter === q.id && !specificDate && !dateFrom && !dateTo;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setQuickDateFilter(q.id);
                    setSpecificDate('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: active ? '700' : '500',
                    border: active ? '1px solid #0284c7' : '1px solid var(--border-color, #e2e8f0)',
                    background: active ? '#0284c7' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-main, #334155)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Specific Day Picker & Custom Range Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Specific Single Day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Specific Day:</span>
              <input
                type="date"
                value={specificDate}
                onChange={(e) => {
                  setSpecificDate(e.target.value);
                  setQuickDateFilter('custom');
                }}
                style={{
                  height: '34px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-primary, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '12px'
                }}
              />
            </div>

            {/* Custom Range: From -> To */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setQuickDateFilter('custom');
                  setSpecificDate('');
                }}
                style={{
                  height: '34px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-primary, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '12px'
                }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setQuickDateFilter('custom');
                  setSpecificDate('');
                }}
                style={{
                  height: '34px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-primary, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '12px'
                }}
              />
            </div>

            {(specificDate || dateFrom || dateTo || quickDateFilter !== 'all') && (
              <button
                onClick={() => {
                  setQuickDateFilter('all');
                  setSpecificDate('');
                  setDateFrom('');
                  setDateTo('');
                }}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Reset Date Filters"
              >
                <X size={13} />
                <span>Reset Dates</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 3: SEARCH BAR, DOWNLOAD DETAILS & SORT */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '10px'
        }}>
          {/* Live Search Input */}
          <div style={{
            position: 'relative',
            flex: '1 1 260px',
            maxWidth: '460px'
          }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8'
            }} />
            <input
              type="text"
              placeholder="Search by Material Name, Item Code, Lot #, PO #, Slip #, Receiver, Issuer, Supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '36px',
                paddingRight: searchQuery ? '32px' : '12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-primary, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* DOWNLOAD DETAILS BUTTONS (Directly on Toolbar!) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={exportToExcel}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s'
              }}
              title="Download all filtered transaction details to Excel (.xlsx)"
            >
              <FileSpreadsheet size={16} />
              <span>Download Details (Excel)</span>
            </button>

            <button
              onClick={() => downloadReportPdf(true)}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: '10px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.15s'
              }}
              title="Download full report as Black & White Ink-Saver PDF"
            >
              <FileText size={15} />
              <span>Download B&amp;W PDF</span>
            </button>

            <button
              onClick={() => handlePrint(true)}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid #000000',
                background: '#000000',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.15s'
              }}
              title="Print report in high-contrast Black & White"
            >
              <Printer size={15} />
              <span>Print Report (B&amp;W)</span>
            </button>

            <button
              onClick={exportToCsv}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-secondary, #ffffff)',
                color: 'var(--text-main, #334155)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Download details as CSV"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          </div>

          {/* Sort Order Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-secondary, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <option value="desc">Latest First (Newest)</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── REPORT CONTENT (TABLE OR DAILY ACCORDION VIEW) ─────────────────────── */}

      {isLoading ? (
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px auto', color: '#2563eb' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: 'var(--text-main)' }}>Aggregating Movement Records...</h3>
          <p style={{ margin: 0, fontSize: '13px' }}>Fetching Bone Issues, Elastic Issues, Tape Issues, Extra Pic Issues &amp; Added Materials</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <AlertTriangle size={40} style={{ margin: '0 auto 16px auto', color: '#f59e0b' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: 'var(--text-main)' }}>No Movement Records Found</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px' }}>No records match your selected date, type, or search filters.</p>
          <button
            onClick={() => {
              setQuickDateFilter('all');
              setSpecificDate('');
              setDateFrom('');
              setDateTo('');
              setMovementFilter('all');
              setSearchQuery('');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Clear All Filters
          </button>
        </div>
      ) : viewLayout === 'daily_grouped' ? (
        /* ── DAILY GROUPED BREAKDOWN VIEW ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {dailyGroups.map((group) => {
            const isCollapsed = collapsedDays[group.dateYmd];
            return (
              <div
                key={group.dateYmd}
                className="daily-group-card"
                style={{
                  background: 'var(--bg-secondary, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
                }}
              >
                {/* Day Header Bar */}
                <div
                  className="daily-group-header"
                  onClick={() => toggleDayCollapse(group.dateYmd)}
                  style={{
                    padding: '14px 20px',
                    background: 'var(--bg-primary, #f8fafc)',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '13px'
                    }}>
                      <CalendarIcon size={18} />
                    </div>

                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                        Date: {group.displayDate} ({group.dateYmd})
                        {group.dateYmd === todayStr && (
                          <span style={{
                            marginLeft: '8px',
                            background: '#dcfce7',
                            color: '#15803d',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '12px'
                          }}>TODAY</span>
                        )}
                        {group.dateYmd === yesterdayStr && (
                          <span style={{
                            marginLeft: '8px',
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '12px'
                          }}>YESTERDAY</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {group.records.length} Total Movements Recorded
                      </div>
                    </div>
                  </div>

                  {/* Day Badges */}
                  <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {group.addedCount > 0 && (
                      <span style={{
                        background: '#f0fdf4',
                        border: '1px solid #86efac',
                        color: '#15803d',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        📥 {group.addedCount} Added
                      </span>
                    )}
                    {group.issuedCount > 0 && (
                      <span style={{
                        background: '#eff6ff',
                        border: '1px solid #93c5fd',
                        color: '#1d4ed8',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        📤 {group.issuedCount} Issued
                      </span>
                    )}
                    {group.boneCount > 0 && (
                      <span style={{
                        background: '#fff7ed',
                        border: '1px solid #fdba74',
                        color: '#c2410c',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        🦴 {group.boneCount} Bone
                      </span>
                    )}
                    {group.elasticCount > 0 && (
                      <span style={{
                        background: '#eef2ff',
                        border: '1px solid #a5b4fc',
                        color: '#4338ca',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        🧵 {group.elasticCount} Elastic
                      </span>
                    )}
                    {group.tapeCount > 0 && (
                      <span style={{
                        background: '#f0fdf4',
                        border: '1px solid #5eead4',
                        color: '#0f766e',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        📏 {group.tapeCount} Tape
                      </span>
                    )}
                    {group.extraPicCount > 0 && (
                      <span style={{
                        background: '#fff1f2',
                        border: '1px solid #fda4af',
                        color: '#be123c',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        ➕ {group.extraPicCount} Extra Pic
                      </span>
                    )}

                    {/* Day Export Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportGroupExcel(group);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #86efac',
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Download this day's details to Excel"
                    >
                      <FileSpreadsheet size={12} />
                      <span>Download Day Excel</span>
                    </button>

                    <div style={{ marginLeft: '8px', color: '#64748b' }}>
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </div>
                  </div>
                </div>

                {/* Day Table Body */}
                <div
                  className={`daily-group-body ${isCollapsed ? 'collapsed-screen-only' : ''}`}
                  style={{
                    display: isCollapsed ? 'none' : 'block',
                    overflowX: 'auto'
                  }}
                >
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                    textAlign: 'left'
                  }}>
                    <thead>
                      <tr style={{
                        background: 'var(--bg-secondary, #f8fafc)',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        color: '#64748b',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        <th style={{ padding: '10px 14px' }}>Time</th>
                        <th style={{ padding: '10px 14px' }}>Type</th>
                        <th style={{ padding: '10px 14px' }}>Doc / Slip #</th>
                        <th style={{ padding: '10px 14px' }}>Material Item</th>
                        <th style={{ padding: '10px 14px' }}>Lot # / PO #</th>
                        <th style={{ padding: '10px 14px' }}>Quantity</th>
                        <th style={{ padding: '10px 14px' }}>Issued To / Receiver</th>
                        <th style={{ padding: '10px 14px' }}>Issued By / Incharge</th>
                        <th style={{ padding: '10px 14px' }}>Remarks</th>
                        <th className="no-print action-col" style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.records.map((r, rIdx) => {
                          const badge = getTypeBadgeStyle(r.type);
                          return (
                            <tr
                              key={r.id}
                              style={{
                                borderBottom: rIdx === group.records.length - 1 ? 'none' : '1px solid var(--border-color, #f1f5f9)',
                                transition: 'background 0.1s'
                              }}
                              className="hover-row"
                            >
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                {r.displayTime || '—'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{
                                  background: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                  color: badge.color,
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <span>{r.typeIcon}</span>
                                  <span>{r.typeLabel}</span>
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>{r.docNo}</span>
                                  <button
                                    onClick={() => handleCopy(r.docNo)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: copiedId === r.docNo ? '#16a34a' : '#94a3b8',
                                      padding: '2px'
                                    }}
                                    title="Copy document number"
                                  >
                                    {copiedId === r.docNo ? <Check size={12} /> : <Copy size={12} />}
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {r.photo ? (
                                    <img
                                      src={getCleanImageUrl(r.photo)}
                                      alt=""
                                      onClick={() => setPreviewImage(r.photo)}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        objectFit: 'cover',
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer'
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      background: 'var(--bg-primary, #f1f5f9)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#94a3b8'
                                    }}>
                                      <Package size={14} />
                                    </div>
                                  )}
                                  <div>
                                    <div style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                                      {r.materialName}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      Code: {r.itemCode}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: '600' }}>
                                  {r.lotNo && r.lotNo !== 'N/A' && r.lotNo !== '—' ? (
                                    <span style={{
                                      background: 'var(--bg-primary, #f1f5f9)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-color, #e2e8f0)',
                                      fontSize: '11px'
                                    }}>Lot {r.lotNo}</span>
                                  ) : '—'}
                                </div>
                                {r.poNo && r.poNo !== '—' && (
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>PO: {r.poNo}</div>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: '800', color: r.type === 'added_material' ? '#16a34a' : '#0284c7' }}>
                                  {r.qty} {r.unit}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: '600' }}>{formatPersonName(r.receiverName)}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{r.receiverDept}</div>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                {formatPersonName(r.issuerName)}
                              </td>
                              <td style={{ padding: '10px 14px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>
                                {r.remarks || '—'}
                              </td>
                              <td className="no-print action-cell" style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <button
                                    onClick={() => setSelectedRecord(r)}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color, #cbd5e1)',
                                      background: 'var(--bg-secondary, #ffffff)',
                                      color: '#2563eb',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="View Full Details"
                                  >
                                    <Eye size={12} />
                                    <span>View</span>
                                  </button>
                                  <button
                                    onClick={() => downloadRecordPdf(r)}
                                    style={{
                                      padding: '4px 7px',
                                      borderRadius: '6px',
                                      border: '1px solid #fecaca',
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    title="Download Details (PDF Slip)"
                                  >
                                    <Download size={12} />
                                  </button>
                                  <button
                                    onClick={() => exportSingleRecordExcel(r)}
                                    style={{
                                      padding: '4px 7px',
                                      borderRadius: '6px',
                                      border: '1px solid #86efac',
                                      background: '#f0fdf4',
                                      color: '#15803d',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    title="Download Details (Excel)"
                                  >
                                    <FileSpreadsheet size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE REGISTER VIEW ── */
        <div style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
        }}>
          {/* Header count info */}
          <div style={{
            padding: '14px 20px',
            background: 'var(--bg-primary, #f8fafc)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#64748b'
          }}>
            <div>
              Showing <strong>{filteredRecords.length}</strong> matching transaction records
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a' }}>📥 {summaryKpis.totalAdded} Added</span>
              <span>&bull;</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb' }}>📤 {summaryKpis.totalIssued} Issued</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '720px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{
                  background: 'var(--bg-secondary, #ffffff)',
                  borderBottom: '2px solid var(--border-color, #e2e8f0)',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <th style={{ padding: '12px 14px', width: '40px' }}>#</th>
                  <th style={{ padding: '12px 14px', width: '130px' }}>Date &amp; Time</th>
                  <th style={{ padding: '12px 14px', width: '150px' }}>Movement Type</th>
                  <th style={{ padding: '12px 14px', width: '140px' }}>Doc / Slip #</th>
                  <th style={{ padding: '12px 14px', minWidth: '220px' }}>Material Item</th>
                  <th style={{ padding: '12px 14px', width: '130px' }}>Lot # / Style</th>
                  <th style={{ padding: '12px 14px', width: '120px' }}>Quantity</th>
                  <th style={{ padding: '12px 14px', width: '160px' }}>Issued To / Receiver</th>
                  <th style={{ padding: '12px 14px', width: '140px' }}>Issued By / Incharge</th>
                  <th style={{ padding: '12px 14px', width: '130px' }}>Location / Rack</th>
                  <th style={{ padding: '12px 14px', minWidth: '150px' }}>Remarks / Reason</th>
                  <th className="no-print action-col" style={{ padding: '12px 14px', width: '70px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const badge = getTypeBadgeStyle(r.type);
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, #f1f5f9)',
                        transition: 'background 0.1s'
                      }}
                      className="hover-row"
                    >
                      {/* S.No */}
                      <td style={{ padding: '12px 14px', color: '#94a3b8', fontWeight: '600' }}>
                        {idx + 1}
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                          {r.displayDate}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {r.displayTime || '—'}
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap',
                          boxShadow: `0 1px 3px ${badge.glow}`
                        }}>
                          <span>{r.typeIcon}</span>
                          <span>{r.typeLabel}</span>
                        </span>
                      </td>

                      {/* Doc / Slip No */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>{r.docNo}</span>
                          <button
                            onClick={() => handleCopy(r.docNo)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: copiedId === r.docNo ? '#16a34a' : '#94a3b8',
                              padding: '2px'
                            }}
                            title="Copy Document / Slip Number"
                          >
                            {copiedId === r.docNo ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Material Details (Photo + Name + Code) */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {r.photo ? (
                            <img
                              src={getCleanImageUrl(r.photo)}
                              alt=""
                              onClick={() => setPreviewImage(r.photo)}
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                              title="Click to view large photo"
                            />
                          ) : (
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: 'var(--bg-primary, #f1f5f9)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                              flexShrink: 0
                            }}>
                              <Package size={16} />
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: '700',
                              color: 'var(--text-main, #0f172a)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {r.materialName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              <span style={{ fontWeight: '600' }}>Code:</span> {r.itemCode}
                              {r.category && <span> &bull; {r.category}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Lot / Style */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div>
                          {r.lotNo && r.lotNo !== 'N/A' && r.lotNo !== '—' ? (
                            <span
                              onClick={() => onNavigateToLot(r.lotNo)}
                              style={{
                                background: 'var(--bg-primary, #f1f5f9)',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color, #cbd5e1)',
                                fontWeight: '700',
                                color: '#0369a1',
                                cursor: 'pointer'
                              }}
                              title="Click to inspect this Lot"
                            >
                              Lot {r.lotNo}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Without Lot</span>
                          )}
                        </div>
                        {r.style && r.style !== '—' && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {r.style}
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{
                          fontWeight: '800',
                          fontSize: '13px',
                          color: r.type === 'added_material' ? '#16a34a' : '#2563eb'
                        }}>
                          {r.qty} <span style={{ fontSize: '11px', fontWeight: '600' }}>{r.unit}</span>
                        </div>
                        {r.extraDetails?.rolls > 1 && (
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            {r.extraDetails.rolls} Rolls
                          </div>
                        )}
                      </td>

                      {/* Issued To / Receiver */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>
                          {formatPersonName(r.receiverName)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {r.receiverDept}
                        </div>
                      </td>

                      {/* Issued By / Store Incharge */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '600', color: '#475569' }}>
                          {formatPersonName(r.issuerName)}
                        </div>
                        {r.supplier && r.supplier !== '—' && (
                          <div style={{ fontSize: '11px', color: '#16a34a' }}>
                            Vendor: {r.supplier}
                          </div>
                        )}
                      </td>

                      {/* Location / Rack */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#0284c7" />
                          <span>{r.location}</span>
                        </div>
                      </td>

                      {/* Remarks / Reason */}
                      <td style={{
                        padding: '12px 14px',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#64748b'
                      }}>
                        {r.remarks || '—'}
                      </td>

                      {/* Action View & Download Buttons */}
                      <td className="no-print action-cell" style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <button
                            onClick={() => setSelectedRecord(r)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color, #cbd5e1)',
                              background: 'var(--bg-secondary, #ffffff)',
                              color: '#2563eb',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s'
                            }}
                            title="View Full Transaction Details"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => downloadRecordPdf(r)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '8px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Download Details (PDF Slip)"
                          >
                            <Download size={12} />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => exportSingleRecordExcel(r)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '8px',
                              border: '1px solid #86efac',
                              background: '#f0fdf4',
                              color: '#15803d',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title="Download Details (Excel)"
                          >
                            <FileSpreadsheet size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RECORD DETAILS MODAL ──────────────────────────────────────────────── */}
      {selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary, #ffffff)',
            borderRadius: '16px',
            maxWidth: '620px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-primary, #f8fafc)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{selectedRecord.typeIcon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    {selectedRecord.typeLabel} Details
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Document: <strong>{selectedRecord.docNo}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Photo & Material Header */}
              <div style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                padding: '16px',
                background: 'var(--bg-primary, #f8fafc)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #e2e8f0)'
              }}>
                {selectedRecord.photo ? (
                  <img
                    src={getCleanImageUrl(selectedRecord.photo)}
                    alt=""
                    onClick={() => setPreviewImage(selectedRecord.photo)}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '10px',
                      objectFit: 'cover',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '10px',
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}>
                    <Package size={28} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {selectedRecord.materialName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Item Code: <strong>{selectedRecord.itemCode}</strong> &bull; Category: {selectedRecord.category}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: '800', color: selectedRecord.type === 'added_material' ? '#16a34a' : '#2563eb' }}>
                    Quantity: {selectedRecord.qty} {selectedRecord.unit}
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '13px'
              }}>
                <div style={{ padding: '10px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Date &amp; Time</span>
                  <strong>{selectedRecord.displayDate} {selectedRecord.displayTime}</strong>
                </div>

                <div style={{ padding: '10px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Lot / PO #</span>
                  <strong>Lot {selectedRecord.lotNo} {selectedRecord.poNo !== '—' ? `| PO: ${selectedRecord.poNo}` : ''}</strong>
                </div>

                <div style={{ padding: '10px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Issued / Received By</span>
                  <strong>{selectedRecord.issuerName}</strong>
                </div>

                <div style={{ padding: '10px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Receiver / Department</span>
                  <strong>{selectedRecord.receiverName} ({selectedRecord.receiverDept})</strong>
                </div>

                <div style={{ padding: '10px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Store Location / Rack</span>
                  <strong>{selectedRecord.location}</strong>
                </div>

                <div style={{ padding: '10px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Supplier / Vendor</span>
                  <strong>{selectedRecord.supplier || '—'}</strong>
                </div>
              </div>

              {/* Remarks / Reason */}
              {selectedRecord.remarks && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px'
                }}>
                  <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Remarks / Reason:
                  </span>
                  <div>{selectedRecord.remarks}</div>
                </div>
              )}
            </div>

            {/* Modal Footer with Download Buttons */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              background: 'var(--bg-primary, #f8fafc)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => printRecordSlip(selectedRecord)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #000000',
                    background: '#000000',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
                  }}
                  title="Print Black & White physical transaction slip"
                >
                  <Printer size={15} />
                  <span>Print Slip (B&amp;W)</span>
                </button>

                <button
                  onClick={() => downloadRecordPdf(selectedRecord, true)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                  }}
                  title="Download printable Black & White PDF slip"
                >
                  <Download size={15} />
                  <span>Download B&amp;W PDF Slip</span>
                </button>

                <button
                  onClick={() => exportSingleRecordExcel(selectedRecord)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Download Record Details as Excel spreadsheet"
                >
                  <FileSpreadsheet size={15} />
                  <span>Download Excel Details</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleCopy(selectedRecord.docNo)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--bg-secondary, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Copy size={14} />
                  <span>Copy Doc #</span>
                </button>

                <button
                  onClick={() => setSelectedRecord(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
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
        </div>
      )}

      {/* ── PHOTO LIGHTBOX PREVIEW MODAL ──────────────────────────────────────── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={getCleanImageUrl(previewImage)}
              alt="Material preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                objectFit: 'contain'
              }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {/* ── PRINT-ONLY FOOTER SIGNATURES ──────────────────────────────────── */}
      <div className="print-only-footer" style={{
        display: 'none',
        marginTop: '24px',
        paddingTop: '12px',
        borderTop: '1px solid #000000',
        justifyContent: 'space-between',
        fontSize: '9pt',
        fontWeight: '700',
        pageBreakInside: 'avoid'
      }}>
        <div>Prepared By: __________________________</div>
        <div>Verified By: __________________________</div>
        <div>Authorized Store Incharge: __________________________</div>
      </div>
    </div>
  );
}
