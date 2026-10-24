import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import useDebounce from '../utils/useDebounce';
import {
  Package, Save, RefreshCw, Download, Search, Filter,
  MapPin, User, ChevronDown, ChevronRight, CheckCircle2,
  AlertTriangle, X, Printer, Menu, Edit3, Layers, FileText,
  Camera, Upload, Image as ImageIcon, Eye, Plus, Check
} from 'lucide-react';
import SearchableLocationSelect from './SearchableLocationSelect';

const BASE_CODE = 1000;

const DEFAULT_UNITS = [
  'Pcs', 'Mtr', 'Kg', 'Gm', 'Pair', 'Cone', 'Roll', 'Set', 'Doz', 'Box', 'Pkt', 'Bundle', 'Yds', 'Cm', 'Inch'
];

const MATERIAL_OPTIONS = [
  '18L Metal Button', 'YKK Zipper 20cm', 'Elastic Tape 2cm', 'Hook & Eye Set',
  'Drawstring Cord', 'Snap Button 15mm', 'Velcro Tape 2cm', 'Satin Ribbon',
  'Toggle Button', 'Lace Trim 1cm', 'D-Ring 25mm', 'Rivets 10mm',
];

const parseMTNum = (code) => {
  const m = String(code || '').match(/MT(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
};

export default function ManuallyWeightCapture({ racks = [], currentUser = null, onNavigate }) {
  const [captures, setCaptures] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const [liveLocations, setLiveLocations] = useState([]);
  const [dbMaterials, setDbMaterials] = useState([]);
  const [itemCodesList, setItemCodesList] = useState([]);
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [itemCodeSearch, setItemCodeSearch] = useState('');
  const [icDropdownOpen, setIcDropdownOpen] = useState(false);
  const [fcfsInfo, setFcfsInfo] = useState(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/warehouse-locations`);
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : (json.data || []);
          if (items.length > 0) {
            setLiveLocations(items);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    fetchLocations();
  }, []);

  // Dynamic slot options from the racks configuration or live locations
  const generatedLocations = useMemo(() => {
    const slotMap = new Map();
    const canonicalizeLocation = (rawStr, defaultWarehouse = 'Main Store') => {
      if (!rawStr) return '';
      let str = String(rawStr).trim();
      if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return '';

      str = str.replace(/\(\d+\s*pkts?\)/gi, '').trim();

      let warehouse = defaultWarehouse || 'Main Store';
      if (/^([a-z0-9\s]+?)\s*[-–]\s*/i.test(str)) {
        const parts = str.split(/[-–]/);
        const potentialWh = parts[0].trim();
        if (potentialWh) {
          warehouse = potentialWh;
        }
      }

      let remainder = str;
      let prev = '';
      while (prev !== remainder) {
        prev = remainder;
        remainder = remainder
          .replace(new RegExp(`^${warehouse}\\s*[-–]?\\s*`, 'i'), '')
          .replace(/^rack\s*[-–]?\s*/i, '')
          .replace(new RegExp(`^${warehouse}\\s*[-–]?\\s*`, 'i'), '')
          .replace(/^rack\s*[-–]?\s*/i, '')
          .trim();
      }

      let rackPart = remainder || '1';
      if (/^\d+$/i.test(rackPart)) {
        rackPart = `RACK ${rackPart}`;
      } else if (!rackPart.toLowerCase().startsWith('rack') && !rackPart.toLowerCase().startsWith('hall') && !rackPart.toLowerCase().startsWith('shelf') && !rackPart.toLowerCase().startsWith('bin')) {
        rackPart = `RACK ${rackPart}`;
      }

      return `${warehouse} - ${rackPart}`;
    };

    const source = (racks && racks.length > 0) ? racks : liveLocations;

    if (source && source.length > 0) {
      source.forEach(rack => {
        const rawCode = String(rack.code || rack.name || '').trim();
        const displayLabel = canonicalizeLocation(rawCode, rack.warehouse || 'Main Store');
        if (!displayLabel) return;
        const key = displayLabel.toUpperCase();
        const warehouse = displayLabel.includes(' - ') ? displayLabel.split(' - ')[0].trim() : (rack.warehouse || 'Main Store');

        if (!slotMap.has(key)) {
          slotMap.set(key, {
            code: displayLabel,
            label: displayLabel,
            rawCode: rawCode,
            warehouse: warehouse
          });
        }
      });
    }

    // Ensure common structured rack options are available if list is empty or minimal
    if (slotMap.size === 0) {
      ['Main Store - Rack 1', 'Main Store - Rack 2', 'Main Store - Rack 3', 'Main Store - Rack 4', 'Main Store - Rack 5', 'Hall 1 - Rack 1', 'Hall 1 - Rack 2', 'Hall 2 - Rack 1'].forEach(loc => {
        slotMap.set(loc, {
          code: loc,
          label: loc,
          rawCode: loc,
          warehouse: loc.split(' - ')[0]
        });
      });
    }

    const list = Array.from(slotMap.values());
    list.sort((a, b) => {
      const whComp = String(a.warehouse || '').localeCompare(String(b.warehouse || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (whComp !== 0) return whComp;
      return String(a.label || a.code).localeCompare(String(b.label || b.code), undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [racks, liveLocations]);

  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 300);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPo, setFilterPo] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  // Printer status & Sticker Print Dialog State
  const [printerStatus, setPrinterStatus] = useState('offline');
  const [printerName, setPrinterName] = useState('');
  const printerWsRef = useRef(null);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printTargetData, setPrintTargetData] = useState(null);
  const [stickerCountToPrint, setStickerCountToPrint] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgressText, setPrintProgressText] = useState('');

  // Counter
  const [nextCodeNum, setNextCodeNum] = useState(BASE_CODE);

  // Packet Location Breakdown State ('same' | 'multiple')
  const [locationMode, setLocationMode] = useState('same');
  const [locationGroups, setLocationGroups] = useState([
    { location: '', count: 1 }
  ]);

  const [form, setForm] = useState({
    materialName: '',
    materialCode: `MT${BASE_CODE}`,
    brand: '',
    category: '',
    rate: '',
    price: '',
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
    imageUrl: '',
    remarks: '',
  });

  useEffect(() => {
    const code = form.materialCode || selectedItemCode;
    if (!code) {
      setFcfsInfo(null);
      return;
    }
    let cancelled = false;
    fetch(`${getBackendUrl()}/api/materials/${encodeURIComponent(code)}/fcfs-batches`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d && d.success) {
          setFcfsInfo(d);
        }
      })
      .catch(() => {
        if (!cancelled) setFcfsInfo(null);
      });
    return () => { cancelled = true; };
  }, [form.materialCode, selectedItemCode]);

  // Custom Units State (Persisted in localStorage)
  const [customUnits, setCustomUnits] = useState(() => {
    try {
      const saved = localStorage.getItem('gpdms_custom_units');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [showAddUnitInput, setShowAddUnitInput] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');

  // All available units combining default + custom + currently selected unit
  const allUnits = useMemo(() => {
    const combined = [...DEFAULT_UNITS];
    (customUnits || []).forEach(u => {
      if (u && !combined.some(c => c.toLowerCase() === u.toLowerCase())) {
        combined.push(u);
      }
    });
    if (form.unit && !combined.some(c => c.toLowerCase() === form.unit.toLowerCase())) {
      combined.push(form.unit);
    }
    return combined;
  }, [customUnits, form.unit]);

  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [metadataFlash, setMetadataFlash] = useState(false);
  const numPieces = parseInt(form.pieces, 10) || 0;

  // Indexed map for fast O(1) metadata lookup (photo, total pieces, rack no)
  const itemCodeMetaMap = useMemo(() => {
    const map = new Map();

    const matByCode = new Map();
    const matByName = new Map();
    (dbMaterials || []).forEach(m => {
      const code1 = String(m.itemCode || '').trim().toLowerCase();
      const code2 = String(m.stCode || '').trim().toLowerCase();
      const code3 = String(m.materialCode || '').trim().toLowerCase();
      const mId = String(m.id || '').trim().toLowerCase();
      const mName = String(m.name || '').trim().toLowerCase();
      if (code1) matByCode.set(code1, m);
      if (code2) matByCode.set(code2, m);
      if (code3) matByCode.set(code3, m);
      if (mId) matByCode.set(mId, m);
      if (mName) matByName.set(mName, m);
    });

    const capByCode = new Map();
    const capByName = new Map();
    (captures || []).forEach(c => {
      const cCode = String(c.materialCode || c.itemCode || '').trim().toLowerCase();
      const cName = String(c.materialName || '').trim().toLowerCase();
      if (cCode) {
        if (!capByCode.has(cCode)) capByCode.set(cCode, []);
        capByCode.get(cCode).push(c);
      }
      if (cName) {
        if (!capByName.has(cName)) capByName.set(cName, []);
        capByName.get(cName).push(c);
      }
    });

    (itemCodesList || []).forEach(item => {
      const ic = String(item.item_code || '').trim().toLowerCase();
      const iname = String(item.item_name || '').trim().toLowerCase();
      const mtCode = String(item.mt_code || '').trim().toLowerCase();

      const mat = (ic && matByCode.get(ic)) || (mtCode && matByCode.get(mtCode)) || (iname && matByName.get(iname));
      const caps = (ic && capByCode.get(ic)) || (mtCode && capByCode.get(mtCode)) || (iname && capByName.get(iname)) || [];

      let photo = item.image_url || item.imageUrl || item.photo || item.image || '';
      if (!photo && mat) {
        photo = mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '';
      }
      if (!photo && caps.length > 0) {
        const withImg = caps.find(c => c.imageUrl || c.photo || c.image);
        if (withImg) photo = withImg.imageUrl || withImg.photo || withImg.image;
      }
      if (photo) photo = getCleanImageUrl(photo);

      let stock = 0;
      if (mat && mat.stock != null) {
        stock = Number(mat.stock) || 0;
      } else if (caps.length > 0) {
        stock = caps.reduce((sum, c) => sum + (Number(c.pieces) || 0), 0);
      } else if (item.stock != null || item.pieces != null) {
        stock = Number(item.stock || item.pieces) || 0;
      }

      let location = '';
      if (mat && mat.location && mat.location !== 'Main Store') {
        location = mat.location;
      }
      if (!location && caps.length > 0) {
        const withLoc = [...caps].reverse().find(c => c.storeLocation && c.storeLocation !== 'Main Store');
        if (withLoc) location = withLoc.storeLocation;
        else if (caps[caps.length - 1]?.storeLocation) {
          location = caps[caps.length - 1].storeLocation;
        }
      }
      if (!location && mat && mat.location) {
        location = mat.location;
      }
      if (!location && (item.location || item.rack || item.storeLocation)) {
        location = item.location || item.rack || item.storeLocation;
      }

      const unit = item.uom || mat?.unit || 'PCS';

      map.set(item.item_code, { photo, stock, location, unit });
    });

    return map;
  }, [itemCodesList, dbMaterials, captures]);

  const getItemCodeMeta = (item) => {
    if (!item) return { photo: '', stock: 0, location: '', unit: 'PCS' };
    return itemCodeMetaMap.get(item.item_code) || {
      photo: getCleanImageUrl(item.image_url || item.imageUrl || item.photo || ''),
      stock: Number(item.stock || item.pieces) || 0,
      location: item.location || item.rack || item.storeLocation || '',
      unit: item.uom || 'PCS'
    };
  };

  const handleItemCodeSelect = (code) => {
    setSelectedItemCode(code);
    const matched = itemCodesList.find(i => i.item_code === code);
    if (matched) {
      const meta = getItemCodeMeta(matched);
      const codeRate = (matched.rate != null && matched.rate !== '') ? String(matched.rate) : '';
      setForm(prev => ({
        ...prev,
        materialCode: matched.item_code,
        materialName: matched.item_name,
        brand: matched.brand || prev.brand || '',
        category: matched.category || prev.category,
        unit: matched.uom || prev.unit,
        rate: codeRate || prev.rate || '',
        price: codeRate || prev.price || '',
        storeLocation: (meta.location && (!prev.storeLocation || prev.storeLocation === 'Main Store - Rack 1')) ? meta.location : prev.storeLocation,
        imageUrl: (meta.photo && !prev.imageUrl) ? meta.photo : prev.imageUrl
      }));
    }
  };

  const areDetailsFilled = () => {
    const hasItemCode = (form.materialCode || '').trim() !== '' &&
      (selectedItemCode || itemCodesList.some(i => i.item_code === form.materialCode || i.item_name.toLowerCase() === (form.materialName || '').trim().toLowerCase()));
    return (
      hasItemCode &&
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

  const getPacketLocationForIndex = (packetNo, targetLoc = '') => {
    const fallback = targetLoc || form.storeLocation || 'Main Store - Rack 1';
    if (locationMode === 'same' || !locationGroups || locationGroups.length === 0) {
      return fallback;
    }
    let offset = 0;
    for (const group of locationGroups) {
      const cnt = parseInt(group.count, 10) || 0;
      if (packetNo > offset && packetNo <= offset + cnt) {
        return group.location?.trim() || fallback;
      }
      offset += cnt;
    }
    return fallback;
  };

  const getCombinedLocationSummary = () => {
    if (locationMode === 'same' || !locationGroups || locationGroups.length === 0) {
      return form.storeLocation || 'Main Store - Rack 1';
    }
    const parts = locationGroups
      .filter(g => g.location?.trim() && parseInt(g.count, 10) > 0)
      .map(g => `${g.location.trim()} (${g.count} pkt${parseInt(g.count, 10) > 1 ? 's' : ''})`);
    return parts.length > 0 ? parts.join(', ') : (form.storeLocation || 'Main Store - Rack 1');
  };

  // Fetch item codes, captures log and highest material code from DB on mount
  useEffect(() => {
    fetch(`${getBackendUrl()}/api/item-codes`)
      .then(r => r.json())
      .then(res => {
        const raw = res.data || res.itemCodes || (Array.isArray(res) ? res : []);
        const list = Array.isArray(raw) ? raw.filter(ic => !String(ic.item_code || '').startsWith('_TMP_') && !String(ic.item_code || '').startsWith('__TEMP_')) : [];
        if (list.length > 0) {
          setItemCodesList(list);
        } else {
          // Fallback to localStorage cache if DB fetch returns empty or fails
          try {
            const cached = JSON.parse(localStorage.getItem('po_saved_item_codes') || '[]');
            const cleanCached = Array.isArray(cached) ? cached.filter(ic => !String(ic.item_code || '').startsWith('_TMP_') && !String(ic.item_code || '').startsWith('__TEMP_')) : [];
            if (cleanCached.length > 0) setItemCodesList(cleanCached);
          } catch (e) {}
        }
      })
      .catch(() => {
        try {
          const cached = JSON.parse(localStorage.getItem('po_saved_item_codes') || '[]');
          const cleanCached = Array.isArray(cached) ? cached.filter(ic => !String(ic.item_code || '').startsWith('_TMP_') && !String(ic.item_code || '').startsWith('__TEMP_')) : [];
          if (cleanCached.length > 0) setItemCodesList(cleanCached);
        } catch (e) {}
      });

    fetch(`${getBackendUrl()}/api/materials`)
      .then(r => r.json())
      .then(mats => {
        if (Array.isArray(mats)) {
          setDbMaterials(mats);
        }
      })
      .catch(() => {});

    const fetchCaptures = async () => {
      try {
        const r = await fetch(`${getBackendUrl()}/api/weight-capture`);
        const res = await r.json();
        if (res.success && res.data && Array.isArray(res.data)) {
          const map = new Map();
          res.data.forEach(item => {
            if (item && item.id != null && !map.has(item.id)) {
              map.set(item.id, {
                id: item.id,
                materialCode: item.itemCode || item.materialCode,
                itemCode: item.itemCode || item.materialCode,
                brand: item.brand || '',
                rate: item.rate != null ? item.rate : (item.cost || 0),
                price: item.rate != null ? item.rate : (item.cost || 0),
                time: item.capturedAt ? new Date(item.capturedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00',
                date: item.capturedAt ? new Date(item.capturedAt).toLocaleDateString('en-IN') : '',
                po: item.poNumber || 'N/A',
                material: item.materialName,
                category: item.category || '',
                weight: item.grossWeightKg ? Number(item.grossWeightKg).toFixed(3) : '0.000',
                netWeightKg: item.netWeightKg || 0,
                pieces: item.pieces || 0,
                packets: item.packets || 1,
                unit: item.unit || 'Pcs',
                barcodeId: item.itemCode || item.barcodeId || item.materialCode || '',
                invoiceNo: item.invoiceNo || 'N/A',
                location: item.storeLocation || 'Main Store',
                operator: item.storeIncharge || 'Pooja',
                imageUrl: item.imageUrl || '',
                entryMode: (item.entryMode === 'Manual' || item.entryMode === 'Manually' || item.status === 'Manual' || item.status === 'Manually') ? 'Manually' : 'Weight Machine',
                status: (item.entryMode === 'Manual' || item.entryMode === 'Manually' || item.status === 'Manual' || item.status === 'Manually') ? 'Manually' : 'Weight Machine',
                approvalStatus: item.approvalStatus || 'Approved'
              });
            }
          });
          setCaptures(Array.from(map.values()));

          const nums = res.data
            .map(row => parseMTNum(row.materialCode))
            .filter(n => !isNaN(n));
          if (nums.length > 0) {
            const highest = Math.max(...nums);
            const next = highest + 1;
            setNextCodeNum(next);
          }
        }
      } catch (e) {}
    };

    fetchCaptures();
  }, []);

  // Autocomplete suggestions for Material Name & Category
  const materialSuggestions = useMemo(() => {
    const set = new Set();
    (captures || []).forEach(c => {
      const n = c.material || c.materialName;
      if (n && n.trim()) set.add(n.trim());
    });
    (dbMaterials || []).forEach(m => {
      if (m.name && m.name.trim()) set.add(m.name.trim());
    });
    MATERIAL_OPTIONS.forEach(p => set.add(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [captures, dbMaterials]);

  const categorySuggestions = useMemo(() => {
    const set = new Set();
    (captures || []).forEach(c => {
      if (c.category && c.category.trim()) set.add(c.category.trim().toUpperCase());
    });
    (dbMaterials || []).forEach(m => {
      if (m.category && m.category.trim()) set.add(m.category.trim().toUpperCase());
    });
    [
      'ZIPPERS', 'BUTTONS', 'ELASTICS', 'TRIMS', 'FABRICS', 'ACCESSORIES',
      'LABELS', 'PACKAGING', 'THREADS', 'CORDS', 'BUCKLES', 'RIVETS', 'TAPES', 'HOOKS'
    ].forEach(p => set.add(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [captures, dbMaterials]);

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

  const handleUnitChange = (e) => {
    const val = e.target.value;
    if (val === '__add_manual__') {
      setShowAddUnitInput(true);
      setNewUnitInput('');
    } else {
      setShowAddUnitInput(false);
      setForm(p => ({ ...p, unit: val }));
    }
  };

  const handleSaveNewUnit = () => {
    const trimmed = (newUnitInput || '').trim();
    if (!trimmed) {
      showToast('⚠️ Please enter a valid unit name.', 'error');
      return;
    }
    // Clean and format: Capitalize nicely if lowercase
    const formattedUnit = trimmed.length > 1 && trimmed === trimmed.toLowerCase()
      ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
      : trimmed;

    let updated = [...customUnits];
    if (
      !updated.some(u => u.toLowerCase() === formattedUnit.toLowerCase()) &&
      !DEFAULT_UNITS.some(u => u.toLowerCase() === formattedUnit.toLowerCase())
    ) {
      updated = [...updated, formattedUnit];
      try {
        localStorage.setItem('gpdms_custom_units', JSON.stringify(updated));
      } catch (_) {}
      setCustomUnits(updated);
    }
    setForm(p => ({ ...p, unit: formattedUnit }));
    setShowAddUnitInput(false);
    setNewUnitInput('');
    showToast(`✅ Added & selected new unit: "${formattedUnit}"`);
  };

  const handleRemoveCustomUnit = (e, unitToRemove) => {
    e.stopPropagation();
    const updated = customUnits.filter(u => u.toLowerCase() !== unitToRemove.toLowerCase());
    try {
      localStorage.setItem('gpdms_custom_units', JSON.stringify(updated));
    } catch (_) {}
    setCustomUnits(updated);
    if (form.unit === unitToRemove) {
      setForm(p => ({ ...p, unit: 'Pcs' }));
    }
    showToast(`Removed custom unit "${unitToRemove}"`, 'info');
  };

  const handleAutoFillDemo = () => {
    const loc = generatedLocations[0]?.code || 'Main Store - Rack 1';
    setForm(prev => ({
      ...prev,
      materialName: 'YKK #5 Brass Zipper 28"',
      category: 'ZIPPERS / TRIMS',
      supplier: 'YKK India Pvt Ltd',
      poNumber: 'PO-2026-008',
      invoiceNo: 'INV-99214',
      storeLocation: loc,
      storeIncharge: currentUser?.name || 'Pooja',
      imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&auto=format&fit=crop&q=60',
      pieces: '3000',
      packets: '10',
      unit: 'Pcs',
      remarks: 'Manual Raw Material Inward Entry'
    }));
    showToast('✨ Sample manual metadata & quantity autofilled!');
  };

  const handleSaveClick = () => {
    if (!selectedItemCode && !itemCodesList.some(i => i.item_code === form.materialCode)) {
      showToast('⚠️ Item Code is required! Please select a registered Item Code before adding material.', 'error');
      setMetadataFlash(true);
      setTimeout(() => setMetadataFlash(false), 2000);
      return;
    }
    if (!areDetailsFilled()) {
      showToast('⚠️ Please fill in all required metadata fields and a valid quantity before saving!', 'error');
      setMetadataFlash(true);
      setTimeout(() => setMetadataFlash(false), 2000);
      return;
    }

    setSaveDialog(true);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const totalPackets = parseInt(form.packets, 10) || 1;
      const totalPieces = parseInt(form.pieces, 10) || 0;
      const barcodeId = form.materialCode;
      const finalLocation = getCombinedLocationSummary();

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newEntry = {
        id: tempId,
        _tempId: tempId,
        materialCode: form.materialCode,
        itemCode: form.materialCode,
        time: now.toTimeString().slice(0, 8),
        date: now.toLocaleDateString('en-IN'),
        po: form.poNumber || 'N/A',
        material: form.materialName,
        category: form.category || '',
        weight: '0.000',
        netWeightKg: 0,
        pieces: totalPieces,
        packets: totalPackets,
        unit: form.unit,
        barcodeId,
        invoiceNo: form.invoiceNo || 'N/A',
        location: finalLocation,
        operator: form.storeIncharge || currentUser?.name || 'Operator',
        imageUrl: form.imageUrl || '',
        entryMode: 'Manually',
        status: 'Manually',
      };

      setCaptures(prev => [newEntry, ...prev.filter(c => c.id !== tempId)]);
      setSaving(false);
      setSaveDialog(false);

      setForm(p => ({ ...p, pieces: '', packets: '1', imageUrl: '', remarks: '' }));

      showToast(`✅ Manual Material Inward Saved: ${totalPieces.toLocaleString()} ${form.unit}`);

      // Setup print dialog with saved data
      setPrintTargetData({
        materialName: form.materialName,
        materialCode: form.materialCode,
        brand: form.brand || '',
        rate: form.rate || form.price || 0,
        price: form.rate || form.price || 0,
        category: form.category || 'ACCESSORY',
        supplier: form.supplier || 'Vendor',
        poNumber: form.poNumber || 'N/A',
        invoiceNo: form.invoiceNo || 'N/A',
        pieces: totalPieces,
        unit: form.unit || 'Pcs',
        totalPackets: totalPackets,
        barcodeId: barcodeId,
        location: finalLocation,
        storeIncharge: form.storeIncharge || currentUser?.name || 'Operator',
        date: now.toLocaleDateString('en-GB')
      });
      setStickerCountToPrint(totalPackets || 1);
      setPrintProgressText('');
      setPrintModalOpen(true);

      // Save entry into weight_capture log (automatically updates stock and writes to item_code_ledger)
      fetch(`${getBackendUrl()}/api/weight-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialCode: form.materialCode,
          materialName: form.materialName,
          brand: form.brand || '',
          rate: Number(form.rate || form.price) || 0,
          price: Number(form.rate || form.price) || 0,
          unit: form.unit,
          category: form.category,
          supplier: form.supplier,
          lotNo: form.lotNo,
          poNumber: form.poNumber,
          invoiceNo: form.invoiceNo,
          storeLocation: finalLocation,
          storeIncharge: form.storeIncharge,
          imageUrl: form.imageUrl || '',
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
            setCaptures(prev => prev.map(item => item._tempId === tempId ? { ...item, id: res.id, _tempId: undefined } : item));
          }
        })
        .catch(() => { });
    }, 400);
  };

  const handleOpenPrintModalForRow = (row) => {
    const pkts = parseInt(row.packets, 10) || 1;
    setPrintTargetData({
      materialName: row.material,
      materialCode: row.materialCode || row.barcodeId?.split('-A')[0] || `MT${row.id}`,
      category: row.category || 'ACCESSORY',
      supplier: row.supplier || 'Vendor',
      poNumber: row.po || 'N/A',
      invoiceNo: row.invoiceNo || 'N/A',
      pieces: row.pieces,
      unit: row.unit || 'Pcs',
      totalPackets: pkts,
      barcodeId: row.barcodeId,
      location: row.location,
      storeIncharge: row.operator,
      date: row.date || new Date().toLocaleDateString('en-GB')
    });
    setStickerCountToPrint(pkts);
    setPrintProgressText('');
    setPrintModalOpen(true);
  };

  const handleExecutePrint = () => {
    if (!printTargetData) return;
    const numStickers = Math.max(1, parseInt(stickerCountToPrint, 10) || 1);
    setIsPrinting(true);
    setPrintProgressText(`Connecting to Python Printer Service (ws://localhost:8765)...`);

    try {
      const pws = new WebSocket('ws://localhost:8765');
      let currentPkt = 1;

      const sendNextSticker = () => {
        if (currentPkt > numStickers) {
          showToast(`✅ Successfully sent ${numStickers} sticker(s) to thermal printer!`);
          setIsPrinting(false);
          setPrintProgressText('');
          setPrintModalOpen(false);
          pws.close();
          return;
        }

        let pktLoc = printTargetData.location;
        if (locationMode === 'multiple' && locationGroups && locationGroups.length > 0) {
          pktLoc = getPacketLocationForIndex(currentPkt, printTargetData.location);
        }
        if (!pktLoc || pktLoc === 'Default' || pktLoc === 'Main Store') {
          pktLoc = (printTargetData.location && printTargetData.location !== 'Default') ? printTargetData.location : (form.storeLocation || 'Main Store - Rack 1');
        }
        const pktBarcodeId = printTargetData.itemCode || printTargetData.materialCode;

        pws.send(JSON.stringify({
          type: 'print_accessory',
          data: {
            cmp: printTargetData.supplier || 'Vendor',
            materialName: printTargetData.materialName,
            materialCode: printTargetData.itemCode || printTargetData.materialCode,
            category: printTargetData.category || 'ACCESSORY',
            weight: `${printTargetData.pieces} ${printTargetData.unit || 'Pcs'}`,
            pieces: String(printTargetData.pieces),
            quantity: `${printTargetData.pieces} ${printTargetData.unit || 'Pcs'}`,
            unit: printTargetData.unit || 'Pcs',
            operator: printTargetData.storeIncharge || 'Operator',
            receivedBy: printTargetData.storeIncharge || 'Operator',
            authorized: printTargetData.storeIncharge || 'Operator',
            poNumber: printTargetData.poNumber || 'N/A',
            billNo: printTargetData.invoiceNo || 'N/A',
            lotNo: printTargetData.itemCode || printTargetData.materialCode || 'N/A',
            totalPackets: numStickers,
            barcodeId: pktBarcodeId,
            location: pktLoc || 'Main Store - Rack 1',
            packetNo: currentPkt,
            date: printTargetData.date || new Date().toLocaleString('en-GB')
          }
        }));

        setPrintProgressText(`🖨️ Printing barcode sticker ${currentPkt} of ${numStickers}...`);
        currentPkt++;
      };

      pws.onopen = () => {
        pws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
      };

      pws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'auth_success') {
            setPrinterStatus('online');
            sendNextSticker();
          } else if (msg.type === 'print_accessory_result' || msg.type === 'print_result') {
            if (msg.success !== false) {
              if (currentPkt > numStickers) {
                showToast(`✅ All ${numStickers} barcode sticker(s) printed!`);
                setIsPrinting(false);
                setPrintProgressText('');
                setPrintModalOpen(false);
                pws.close();
              } else {
                sendNextSticker();
              }
            } else {
              showToast(`⚠️ Print warning: ${msg.message || 'Sticker output issue'}`, 'error');
              sendNextSticker();
            }
          } else if (msg.type === 'auth_failed' || msg.type === 'error') {
            showToast(`Print service error: ${msg.message}`, 'error');
            setIsPrinting(false);
            setPrintProgressText('');
            pws.close();
          }
        } catch (e) {
          sendNextSticker();
        }
      };

      pws.onerror = () => {
        setIsPrinting(false);
        setPrintProgressText('');
        setPrinterStatus('offline');
        showToast('⚠️ Python Print Service is offline on ws://localhost:8765. Run "python print_service.py" in terminal.', 'error');
      };

      pws.onclose = () => {
        if (isPrinting) {
          setIsPrinting(false);
          setPrintProgressText('');
        }
      };

      setTimeout(() => {
        if (pws.readyState === WebSocket.CONNECTING) {
          pws.close();
          setIsPrinting(false);
          setPrintProgressText('');
          setPrinterStatus('offline');
          showToast('⚠️ Python Print Service connection timed out. Check print_service.py.', 'error');
        }
      }, 5000);

    } catch (err) {
      setIsPrinting(false);
      setPrintProgressText('');
      setPrinterStatus('offline');
      showToast(`⚠️ Print error: ${err.message}`, 'error');
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
      imageUrl: '',
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
      'ID', 'Material Code', 'Date', 'Time', 'PO Number', 'Material Name', 'Category',
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
      row.category || '',
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

  const handlePrintLogs = () => {
    if (filteredCaptures.length === 0) {
      showToast('No log data available to print.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1150,height=800');
    if (!printWindow) {
      showToast('Pop-up blocked. Please allow pop-ups for printing.', 'error');
      return;
    }

    let totalPieces = 0;
    let totalPackets = 0;
    filteredCaptures.forEach(r => {
      totalPieces += Number(r.pieces) || 0;
      totalPackets += Number(r.packets) || 0;
    });

    const rowsHtml = filteredCaptures.map((r, i) => {
      const photoRaw = r.imageUrl || itemCodesList.find(item => item.item_code === r.itemCode || item.item_code === r.materialCode || (item.item_name && r.material && item.item_name.toLowerCase() === r.material.toLowerCase()))?.imageUrl || itemCodesList.find(item => item.item_code === r.itemCode || item.item_code === r.materialCode || (item.item_name && r.material && item.item_name.toLowerCase() === r.material.toLowerCase()))?.image_url || '';
      const cleanPhoto = photoRaw ? getCleanImageUrl(photoRaw) : '';
      const displayBrand = r.brand || itemCodesList.find(item => item.item_code === r.itemCode || item.item_code === r.materialCode || (item.item_name && r.material && item.item_name.toLowerCase() === r.material.toLowerCase()))?.brand || '-';

      return `
      <tr>
        <td style="text-align: center; font-weight: bold;">${i + 1}</td>
        <td style="font-weight: bold; font-family: monospace; font-size: 11px;">${r.materialCode || '-'}</td>
        <td style="text-align: center; vertical-align: middle; padding: 3px;">
          ${cleanPhoto ? `
            <img src="${cleanPhoto}" alt="Photo" class="material-thumb" onerror="this.style.display='none'" />
          ` : `<span style="color: #999; font-size: 8px;">—</span>`}
        </td>
        <td>
          <div style="font-weight: 600;">${r.time || ''}</div>
          <div style="font-size: 9px; color: #444;">${r.date || ''}</div>
        </td>
        <td>${r.po || 'N/A'}</td>
        <td style="font-weight: 600;">${r.material || '-'}</td>
        <td style="font-weight: 600;">${displayBrand}</td>
        <td>${r.category || '-'}</td>
        <td style="text-align: right; font-weight: bold;">${r.pieces !== undefined ? Number(r.pieces).toLocaleString() : '-'} ${r.unit || 'Pcs'}</td>
        <td style="text-align: right; font-weight: bold;">${r.packets || 1} Pkts</td>
        <td>${r.location || 'Main Store'}</td>
        <td>${r.invoiceNo || 'N/A'}</td>
        <td>${r.operator || 'Store'}</td>
        <td style="text-align: center; font-weight: 600;">${r.status || 'Manually'}</td>
      </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Material Inward Logs Report</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 16px;
            font-size: 11px;
            line-height: 1.35;
          }
          .no-print-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f1f5f9;
            border: 1.5px solid #0f172a;
            padding: 10px 18px;
            border-radius: 8px;
            margin-bottom: 16px;
          }
          .btn-print {
            background: #000000;
            color: #ffffff;
            border: none;
            padding: 8px 20px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-close {
            background: #ffffff;
            color: #000000;
            border: 1.5px solid #000000;
            padding: 8px 16px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
            margin-left: 8px;
          }
          @media print {
            .no-print-bar {
              display: none !important;
            }
            body {
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            img {
              max-width: 100% !important;
              page-break-inside: avoid;
            }
          }
          .material-thumb {
            width: 36px;
            height: 36px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #777;
            display: block;
            margin: 0 auto;
          }
          .print-frame {
            border: 2px solid #000000;
            padding: 14px 16px;
            border-radius: 4px;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000000;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .doc-title {
            font-size: 17px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 3px 0;
          }
          .doc-sub {
            font-size: 11px;
            color: #222;
            font-weight: 500;
          }
          .meta-info {
            text-align: right;
            font-size: 10.5px;
          }
          .summary-box {
            display: flex;
            gap: 22px;
            background: #f4f4f4;
            border: 1px solid #000000;
            padding: 6px 12px;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 12px;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          table.data-table th {
            background: #e8e8e8;
            color: #000000;
            border: 1px solid #000000;
            padding: 6px 6px;
            text-align: left;
            font-weight: bold;
            font-size: 10px;
          }
          table.data-table td {
            border: 1px solid #888888;
            padding: 5px 6px;
            vertical-align: middle;
          }
          table.data-table tr:nth-child(even) td {
            background: #fafafa;
          }
          .footer-sigs {
            margin-top: 32px;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
          }
          .sig-item {
            width: 28%;
            text-align: center;
          }
          .sig-line {
            border-top: 1.5px solid #000000;
            margin-bottom: 5px;
          }
          .sig-label {
            font-size: 10.5px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <strong>Print Preview:</strong> Material Inward Logs (${filteredCaptures.length} records)
          </div>
          <div>
            <button class="btn-print" onclick="window.print()">🖨️ Print Document</button>
            <button class="btn-close" onclick="window.close()">✖ Close Window</button>
          </div>
        </div>

        <div class="print-frame">
          <div class="header-row">
            <div>
              <h1 class="doc-title">MATERIAL INWARD LOGS REPORT</h1>
              <div class="doc-sub">Official Warehouse Inward & Verification Logs (Black & White Format)</div>
            </div>
            <div class="meta-info">
              <div><strong>Date & Time:</strong> ${new Date().toLocaleString('en-IN')}</div>
              <div><strong>Generated By:</strong> ${currentUser?.name || 'Store In-Charge'}</div>
            </div>
          </div>

          <div class="summary-box">
            <div>Total Records: <strong>${filteredCaptures.length}</strong></div>
            <div>Total Pieces: <strong>${totalPieces.toLocaleString()}</strong></div>
            <div>Total Packets: <strong>${totalPackets} pkts</strong></div>
            ${q ? `<div>Search: <em>"${q}"</em></div>` : ''}
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 22px; text-align: center;">#</th>
                <th style="width: 65px;">Code</th>
                <th style="width: 44px; text-align: center;">Photo</th>
                <th style="width: 70px;">Time / Date</th>
                <th style="width: 75px;">PO Number</th>
                <th>Material Name</th>
                <th style="width: 75px;">Brand</th>
                <th style="width: 75px;">Category</th>
                <th style="width: 75px; text-align: right;">Quantity</th>
                <th style="width: 55px; text-align: right;">Packets</th>
                <th style="width: 90px;">Location</th>
                <th style="width: 65px;">Bill No</th>
                <th style="width: 65px;">Operator</th>
                <th style="width: 60px; text-align: center;">Mode</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer-sigs">
            <div class="sig-item">
              <div class="sig-line"></div>
              <div class="sig-label">Store In-Charge Signature & Date</div>
            </div>
            <div class="sig-item">
              <div class="sig-line"></div>
              <div class="sig-label">Audited / Verified By</div>
            </div>
            <div class="sig-item">
              <div class="sig-line"></div>
              <div class="sig-label">Authorized Signatory</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
    const ql = debouncedQ.toLowerCase();
    const getRowBrand = (r) => r.brand || itemCodesList.find(i => i.item_code === r.itemCode || i.item_code === r.materialCode || (i.item_name && r.material && i.item_name.toLowerCase() === r.material.toLowerCase()))?.brand || '';

    return captures
      .filter(r => {
        const rowBrand = getRowBrand(r);
        const matchesQ = !ql ||
          (r.material && r.material.toLowerCase().includes(ql)) ||
          (r.category && r.category.toLowerCase().includes(ql)) ||
          (r.po && r.po.toLowerCase().includes(ql)) ||
          (r.operator && r.operator.toLowerCase().includes(ql)) ||
          (r.status && r.status.toLowerCase().includes(ql)) ||
          (rowBrand && rowBrand.toLowerCase().includes(ql)) ||
          (r.materialCode && r.materialCode.toLowerCase().includes(ql));

        const matchesCategory = !filterCategory || (r.category && r.category.toLowerCase() === filterCategory.toLowerCase());
        const matchesPo = !filterPo || r.po === filterPo;
        const matchesLocation = !filterLocation || r.location === filterLocation;
        const matchesOperator = !filterOperator || r.operator === filterOperator;
        const matchesDate = !filterDate || isSameDate(r.date, filterDate);

        return matchesQ && matchesCategory && matchesPo && matchesLocation && matchesOperator && matchesDate;
      })
      .sort((a, b) => {
        let av = orderBy === 'brand' ? getRowBrand(a) : (a[orderBy] ?? '');
        let bv = orderBy === 'brand' ? getRowBrand(b) : (b[orderBy] ?? '');
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return order === 'asc' ? -1 : 1;
        if (av > bv) return order === 'asc' ? 1 : -1;
        return 0;
      });
  }, [captures, debouncedQ, orderBy, order, filterCategory, filterPo, filterLocation, filterOperator, filterDate, itemCodesList]);

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

          {/* ── Registered Item Code Selector (Mandatory Step) ── */}
          <div className="form-group" style={{ gridColumn: '1 / -1', background: '#eff6ff', padding: '16px', borderRadius: '10px', border: '1.5px solid #93c5fd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <label className="wcs-label" style={{ color: '#1e40af', margin: 0, fontSize: '13px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} /> SELECT REGISTERED ITEM CODE (REQUIRED BEFORE ADDING MATERIAL) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('item_codes')}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  + Create New Item Code
                </button>
              )}
            </div>
            {/* ── Searchable Item Code Dropdown ── */}
            <div style={{ position: 'relative' }}>
              {/* Search Input */}
              <div style={{ position: 'relative', marginBottom: '4px' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>🔍</span>
                <input
                  type="text"
                  className="wcs-input"
                  placeholder="🔍 Search item code, name, brand, category..."
                  value={itemCodeSearch}
                  onChange={e => { setItemCodeSearch(e.target.value); setIcDropdownOpen(true); }}
                  onFocus={() => setIcDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIcDropdownOpen(false), 200)}
                  style={{
                    height: '44px', fontSize: '13.5px', fontWeight: '700',
                    paddingLeft: '36px',
                    background: '#ffffff', color: '#0f172a',
                    borderColor: selectedItemCode ? '#10b981' : '#3b82f6',
                    borderWidth: '1.5px', borderStyle: 'solid', borderRadius: '8px',
                    width: '100%', boxSizing: 'border-box'
                  }}
                />
                {selectedItemCode && (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', pointerEvents: 'none' }}>
                    ✓ {selectedItemCode}
                  </span>
                )}
              </div>

              {/* Selected Item Quick Details Pill */}
              {selectedItemCode && (() => {
                const selectedItemObj = itemCodesList.find(i => i.item_code === selectedItemCode);
                const selectedMeta = getItemCodeMeta(selectedItemObj || { item_code: selectedItemCode, item_name: form.materialName });
                return (
                  <div style={{
                    marginBottom: '6px',
                    padding: '6px 10px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    fontSize: '11.5px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedMeta.photo ? (
                        <div
                          title="Click to view full photo"
                          onClick={() => setPreviewModalImage({
                            photo: selectedMeta.photo,
                            item_code: selectedItemCode,
                            item_name: form.materialName || selectedItemObj?.item_name,
                            brand: selectedItemObj?.brand,
                            category: form.category || selectedItemObj?.category,
                            uom: form.unit || selectedItemObj?.uom,
                            stock: selectedMeta.stock,
                            unit: selectedMeta.unit,
                            location: selectedMeta.location || form.storeLocation
                          })}
                          style={{
                            position: 'relative', width: '32px', height: '32px', borderRadius: '6px',
                            overflow: 'hidden', border: '1.5px solid #cbd5e1', cursor: 'zoom-in', flexShrink: 0
                          }}
                        >
                          <img src={selectedMeta.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                          <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '7px', padding: '0 2px' }}>🔍</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '14px' }}>📦</span>
                      )}
                      <span style={{ fontWeight: '800', color: '#0f172a' }}>
                        {selectedItemCode} &bull; {form.materialName || selectedItemObj?.item_name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: '6px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Package size={11} style={{ color: '#16a34a' }} />
                        Total Pieces: {selectedMeta.stock.toLocaleString('en-IN')} {selectedMeta.unit}
                      </span>
                      <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 7px', borderRadius: '6px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} style={{ color: '#ea580c' }} />
                        Rack: {selectedMeta.location || form.storeLocation || 'Main Store'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Dropdown Panel */}
              {icDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                  background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: '10px',
                  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.22)', maxHeight: '340px',
                  overflowY: 'auto', marginTop: '4px'
                }}>
                  {/* Clear selection option */}
                  <div
                    onMouseDown={() => { handleItemCodeSelect(''); setItemCodeSearch(''); setIcDropdownOpen(false); }}
                    style={{ padding: '9px 14px', fontSize: '12px', color: '#94a3b8', fontWeight: '700', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}
                  >
                    — Choose Item Code from Master (e.g. ST00001) —
                  </div>
                  {itemCodesList
                    .filter(item => {
                      const q = itemCodeSearch.toLowerCase().trim();
                      if (!q) return true;
                      const meta = getItemCodeMeta(item);
                      return (
                        (item.item_code || '').toLowerCase().includes(q) ||
                        (item.item_name || '').toLowerCase().includes(q) ||
                        (item.brand || '').toLowerCase().includes(q) ||
                        (item.category || '').toLowerCase().includes(q) ||
                        (item.uom || '').toLowerCase().includes(q) ||
                        (meta.location || '').toLowerCase().includes(q)
                      );
                    })
                    .map(item => {
                      const isSelected = selectedItemCode === item.item_code;
                      const meta = getItemCodeMeta(item);
                      return (
                        <div
                          key={item.id || item.item_code}
                          onMouseDown={() => { handleItemCodeSelect(item.item_code); setItemCodeSearch(''); setIcDropdownOpen(false); }}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px',
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.12s'
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f9ff'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* 1. PHOTO THUMBNAIL (CLICKABLE TO PREVIEW) */}
                          {meta.photo ? (
                            <div
                              title="Click to view full photo"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setPreviewModalImage({
                                  photo: meta.photo,
                                  item_code: item.item_code,
                                  item_name: item.item_name,
                                  brand: item.brand,
                                  category: item.category,
                                  uom: item.uom,
                                  stock: meta.stock,
                                  unit: meta.unit,
                                  location: meta.location
                                });
                              }}
                              style={{
                                position: 'relative',
                                width: '38px',
                                height: '38px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                border: '1.5px solid #cbd5e1',
                                flexShrink: 0,
                                cursor: 'zoom-in',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                              }}
                            >
                              <img
                                src={meta.photo}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                              />
                              <div style={{
                                position: 'absolute', bottom: 0, right: 0, background: 'rgba(15,23,42,0.7)',
                                color: '#fff', fontSize: '8px', padding: '1px 3px', borderTopLeftRadius: '4px'
                              }}>
                                🔍
                              </div>
                            </div>
                          ) : (
                            <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                              📦
                            </div>
                          )}

                          {/* 2. ITEM CONTENT - 2 Lines so Total Pieces & Rack are NEVER clipped */}
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '5px', fontWeight: '900', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0 }}>
                                {item.item_code}
                              </span>
                              <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.item_name}
                              </span>
                              {item.brand && (
                                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', flexShrink: 0 }}>
                                  • {item.brand}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', flexWrap: 'wrap' }}>
                              <span style={{ color: '#475569', fontWeight: '700', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                                [{item.category || 'General'}]
                              </span>
                              {item.uom && <span style={{ color: '#94a3b8' }}>&bull; {item.uom}</span>}

                              {/* Total Pieces Badge */}
                              <span style={{
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                padding: '1px 6px',
                                borderRadius: '5px',
                                fontWeight: '800',
                                fontSize: '10.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }} title="Total in-stock pieces">
                                <Package size={11} style={{ color: '#16a34a' }} />
                                <span>{meta.stock.toLocaleString('en-IN')} {meta.unit}</span>
                              </span>

                              {/* Rack No Badge */}
                              <span style={{
                                background: meta.location ? '#fff7ed' : '#f8fafc',
                                color: meta.location ? '#c2410c' : '#94a3b8',
                                border: meta.location ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                padding: '1px 6px',
                                borderRadius: '5px',
                                fontWeight: '700',
                                fontSize: '10.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }} title="Storage Rack / Location Slot">
                                <MapPin size={10} style={{ color: meta.location ? '#ea580c' : '#94a3b8' }} />
                                <span>Rack: {meta.location || 'No Rack'}</span>
                              </span>
                            </div>
                          </div>

                          {isSelected && <span style={{ color: '#10b981', fontWeight: '900', fontSize: '14px', flexShrink: 0 }}>✓</span>}
                        </div>
                      );
                    })
                  }
                  {itemCodesList.filter(item => {
                    const q = itemCodeSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      (item.item_code || '').toLowerCase().includes(q) ||
                      (item.item_name || '').toLowerCase().includes(q) ||
                      (item.brand || '').toLowerCase().includes(q) ||
                      (item.category || '').toLowerCase().includes(q) ||
                      (item.uom || '').toLowerCase().includes(q)
                    );
                  }).length === 0 && (
                    <div style={{ padding: '18px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: '700' }}>
                      No item codes match "<strong>{itemCodeSearch}</strong>"
                    </div>
                  )}
                </div>
              )}
            </div>

            {!selectedItemCode ? (
              <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '6px', fontWeight: '700' }}>
                ⚠️ Before adding material, user must create and select the Item Code of that item.
              </div>
            ) : (
              <div style={{ fontSize: '11.5px', color: '#059669', marginTop: '6px', fontWeight: '700' }}>
                ✓ Mapped: Material Code = <strong>{selectedItemCode}</strong> | Material Name = <strong>{form.materialName}</strong> | Brand = <strong>{form.brand || 'N/A'}</strong> | Category = <strong>{form.category}</strong> | UOM = <strong>{form.unit}</strong>{Number(form.rate || form.price) > 0 ? ` | Price = ₹${form.rate || form.price}` : ''}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="wcs-label">
              Material Name <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px', fontWeight: 'bold' }}>(Locked)</span>
            </label>
            <input
              type="text"
              className="wcs-input"
              value={form.materialName}
              readOnly={true}
              placeholder="Auto-mapped from Item Code"
              style={{ height: '40px', fontSize: '14px', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#1e293b', cursor: 'not-allowed', border: '1.5px solid #cbd5e1' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">
              Material Code (Item Code) <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px', fontWeight: 'bold' }}>(Locked)</span>
            </label>
            <input
              type="text"
              className="wcs-input"
              value={form.materialCode}
              readOnly={true}
              placeholder="Auto-mapped from Item Code"
              style={{ height: '40px', fontFamily: 'monospace', fontWeight: '900', backgroundColor: '#f1f5f9', color: '#1e293b', cursor: 'not-allowed', border: '1.5px solid #cbd5e1' }}
            />
          </div>

          {/* Brand Name Auto-mapped from Item Code */}
          <div className="form-group">
            <label className="wcs-label">
              Brand Name
              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px', fontWeight: 'bold' }}>(Locked)</span>
            </label>
            <input
              type="text"
              className="wcs-input"
              value={form.brand || ''}
              readOnly={true}
              placeholder="Auto-mapped from Item Code"
              style={{ height: '40px', fontSize: '14px', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#1e293b', cursor: 'not-allowed', border: '1.5px solid #cbd5e1' }}
            />
          </div>

          <div className="form-group">
            <label className="wcs-label">
              Category <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px', fontWeight: 'bold' }}>(Locked)</span>
            </label>
            <input
              type="text"
              className="wcs-input"
              value={form.category}
              readOnly={true}
              placeholder="Auto-mapped from Item Code"
              style={{ height: '40px', fontSize: '14px', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#1e293b', cursor: 'not-allowed', border: '1.5px solid #cbd5e1' }}
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

          {/* Price / Rate of Item Input */}
          <div className="form-group" style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1.5px solid #a7f3d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="wcs-label" style={{ color: '#047857', fontWeight: '900', margin: 0 }}>
                Price of Item (Rate / Unit ₹)
              </label>
              {Number(form.rate || form.price) > 0 && Number(form.pieces) > 0 && (
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: '800' }}>
                  Total: ₹{(Number(form.pieces) * Number(form.rate || form.price)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              className="wcs-input"
              value={form.rate ?? form.price ?? ''}
              onChange={e => setForm(p => ({ ...p, rate: e.target.value, price: e.target.value }))}
              placeholder="e.g. 25.50"
              style={{ height: '42px', fontSize: '15px', fontWeight: '800', color: '#065f46' }}
            />

            {/* Live FCFS Inventory Valuation Badge */}
            {fcfsInfo && fcfsInfo.stock > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1.2px solid #86efac',
                fontSize: '11.5px',
                color: '#065f46'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={13} style={{ color: '#059669' }} />
                    <span>⚡ FCFS Inventory Policy Active</span>
                  </span>
                  <span style={{ fontWeight: '800', color: '#1d4ed8', background: '#dbeafe', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px' }}>
                    Old Stock: {fcfsInfo.stock.toLocaleString()} {form.unit || 'Pcs'} @ ₹{fcfsInfo.currentRate}/u
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.35' }}>
                  {Number(form.rate || form.price) > 0 && Number(form.rate || form.price) !== Number(fcfsInfo.currentRate) ? (
                    <span>
                      Existing <strong>{fcfsInfo.stock.toLocaleString()} {form.unit || 'Pcs'}</strong> remains costed at <strong>₹{fcfsInfo.currentRate}</strong>. This incoming batch ({Number(form.pieces || 0).toLocaleString()} {form.unit || 'Pcs'}) will be costed at <strong>₹{form.rate || form.price}</strong> once old stock is finished.
                    </span>
                  ) : (
                    <span>
                      Existing inventory of {fcfsInfo.stock.toLocaleString()} {form.unit || 'Pcs'} is currently valued at ₹{fcfsInfo.currentRate}/unit.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Unit of Measure Selection */}
          <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="wcs-label" style={{ margin: 0, fontWeight: '800' }}>
                Unit of Measure <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {!showAddUnitInput ? (
                <button
                  type="button"
                  onClick={() => { setShowAddUnitInput(true); setNewUnitInput(''); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    border: '1.5px solid #93c5fd',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Add custom unit manually"
                >
                  <Plus size={13} /> Add Manually
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddUnitInput(false)}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    color: '#64748b',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                >
                  ✕ Cancel
                </button>
              )}
            </div>

            {!showAddUnitInput ? (
              <select
                className="wcs-input"
                value={form.unit}
                onChange={handleUnitChange}
                style={{ height: '42px', cursor: 'pointer', fontWeight: '800' }}
              >
                {allUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value="__add_manual__" style={{ color: '#1d4ed8', fontWeight: 'bold' }}>
                  ➕ + Add Manually / New Unit...
                </option>
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new unit (e.g. Cartoon, Bag, Gross, Ltr)..."
                    value={newUnitInput}
                    onChange={(e) => setNewUnitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewUnit();
                      } else if (e.key === 'Escape') {
                        setShowAddUnitInput(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '2px solid #2563eb',
                      fontSize: '14px',
                      fontWeight: '700',
                      outline: 'none',
                      background: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewUnit}
                    style={{
                      padding: '0 16px',
                      height: '42px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Check size={14} /> Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitInput(false)}
                    style={{
                      padding: '0 12px',
                      height: '42px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  💡 Tip: Press <strong>Enter</strong> to save. The new unit will be remembered for all future entries.
                </div>
              </div>
            )}

            {/* Custom units quick-select pills */}
            {customUnits.length > 0 && !showAddUnitInput && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>Custom Units:</span>
                {customUnits.map(cu => (
                  <span
                    key={cu}
                    onClick={() => setForm(p => ({ ...p, unit: cu }))}
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: form.unit === cu ? '#2563eb' : '#eff6ff',
                      color: form.unit === cu ? '#ffffff' : '#1d4ed8',
                      border: form.unit === cu ? '1px solid #2563eb' : '1px solid #bfdbfe',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Click to select "${cu}"`}
                  >
                    <span>{cu}</span>
                    {form.unit === cu && <span>✓</span>}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveCustomUnit(e, cu)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '2px',
                        color: form.unit === cu ? '#bfdbfe' : '#94a3b8',
                        fontSize: '11px',
                        lineHeight: 1
                      }}
                      title={`Remove "${cu}" from custom list`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="wcs-label">Location Slot <span style={{ color: '#ef4444' }}>*</span></label>
            <SearchableLocationSelect
              locations={generatedLocations}
              value={form.storeLocation}
              onChange={(val) => setForm(p => ({ ...p, storeLocation: val }))}
              placeholder="-- Select Configured Location Slot --"
              required
            />
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

          {/* Material Photo / Image (Optional) */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="wcs-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={14} style={{ color: '#3b82f6' }} /> Material Photo / Image <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, imageUrl: '' }))}
                  style={{
                    background: 'none', border: 'none', color: '#ef4444',
                    fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <X size={13} /> Remove Image
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: form.imageUrl ? '1fr 140px' : '1fr', gap: '14px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* File Upload / Drag Drop Area */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '8px', border: '1.5px dashed #cbd5e1',
                      background: '#f8fafc', color: '#334155', fontSize: '12.5px', fontWeight: '700',
                      cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    <Upload size={14} style={{ color: '#3b82f6' }} /> Choose Photo / File
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setForm(p => ({ ...p, imageUrl: ev.target.result }));
                            showToast('📷 Material image attached successfully!');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>or paste Image link:</span>
                </div>

                <input
                  type="text"
                  className="wcs-input"
                  placeholder="Paste image URL or Google Drive link (optional)..."
                  value={form.imageUrl || ''}
                  onChange={setF('imageUrl')}
                  style={{ height: '38px', fontSize: '13px' }}
                />
              </div>

              {/* Live Preview Box */}
              {form.imageUrl && (
                <div style={{
                  width: '140px', height: '90px', borderRadius: '8px',
                  border: '1.5px solid #cbd5e1', background: '#f8fafc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative', cursor: 'pointer'
                }}
                  onClick={() => setPreviewModalImage(form.imageUrl)}
                  title="Click to zoom image"
                >
                  <img
                    src={getCleanImageUrl(form.imageUrl)}
                    alt="Material preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{
                    position: 'absolute', bottom: '3px', right: '3px',
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    borderRadius: '4px', padding: '2px 4px', fontSize: '9px', fontWeight: '700'
                  }}>
                    Zoom 🔍
                  </div>
                </div>
              )}
            </div>
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
              onClick={handlePrintLogs}
              title="Print Inward Logs (Black & White)"
            >
              <Printer size={16} />
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
                  ['# / ITEM CODE', 'materialCode'],
                  ['IMAGE', null],
                  ['TIME', 'time'],
                  ['PO NUMBER', 'po'],
                  ['MATERIAL NAME', 'material'],
                  ['CATEGORY', 'category'],
                  ['QUANTITY (PIECES)', 'pieces'],
                  ['BRAND NAME', 'brand'],
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
                  <td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontWeight: '600' }}>No inward logs found in database.</td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <React.Fragment key={row.id ? `cap-${row.id}` : `tmp-${idx}`}>
                    <tr style={{
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease'
                    }}>
                      {/* # / CODE */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '900', color: '#3b82f6', fontSize: '13px' }}>#{row.id}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', fontFamily: 'monospace', marginTop: '2px' }}>{row.itemCode || row.materialCode}</div>
                      </td>

                      {/* IMAGE */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {row.imageUrl ? (
                          <div
                            onClick={() => setPreviewModalImage(row.imageUrl)}
                            style={{
                              width: '38px', height: '38px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', overflow: 'hidden',
                              background: '#f8fafc', cursor: 'pointer', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              transition: 'transform 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                            title="Click to view material photo"
                          >
                            <img
                              src={getCleanImageUrl(row.imageUrl)}
                              alt="Material thumbnail"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        ) : (
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '6px',
                            border: '1px dashed #cbd5e1', background: '#f8fafc',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#94a3b8'
                          }} title="No image uploaded">
                            <Camera size={15} />
                          </div>
                        )}
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

                      {/* CATEGORY */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {row.category ? (
                          <span style={{
                            display: 'inline-block', padding: '4px 10px', borderRadius: '6px',
                            background: '#fef3c7', color: '#92400e', fontWeight: '800', fontSize: '11.5px',
                            border: '1px solid rgba(217, 119, 6, 0.25)', textTransform: 'uppercase'
                          }}>
                            🏷️ {row.category}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      {/* QUANTITY */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '900', color: '#2563eb', fontSize: '15px' }}>
                          {row.pieces.toLocaleString()} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>{row.unit || 'Pcs'}</span>
                        </div>
                        {parseInt(row.packets, 10) > 1 && (
                          <div style={{ fontSize: '10.5px', color: '#7e22ce', fontWeight: '700', marginTop: '2px' }}>
                            📦 {row.packets} Pkts
                          </div>
                        )}
                        {Number(row.rate || row.price) > 0 && (
                          <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700', marginTop: '2px' }}>
                            @ ₹{row.rate || row.price}/unit
                            {Number(row.pieces) > 0 && ` (₹${(Number(row.pieces) * Number(row.rate || row.price)).toLocaleString('en-IN', { maximumFractionDigits: 2 })})`}
                          </div>
                        )}
                      </td>

                      {/* BRAND NAME (in place of PACKETS) */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const displayBrand = row.brand || itemCodesList.find(i => i.item_code === row.itemCode || i.item_code === row.materialCode || (i.item_name && row.material && i.item_name.toLowerCase() === row.material.toLowerCase()))?.brand || '';
                          return displayBrand ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '6px',
                              background: '#eff6ff', color: '#1d4ed8', fontWeight: '800',
                              fontSize: '11.5px', border: '1px solid #bfdbfe'
                            }}>
                              🏢 {displayBrand}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>—</span>
                          );
                        })()}
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
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPrintModalForRow(row)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                              borderRadius: '6px', fontSize: '11.5px', fontWeight: '700',
                              border: '1.5px solid rgba(99, 102, 241, 0.3)', color: '#4338ca', background: '#eef2ff',
                              cursor: 'pointer'
                            }}
                            title="Print Barcode Stickers"
                          >
                            <Printer size={13} /> Print
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                              borderRadius: '6px', fontSize: '11.5px', fontWeight: '700',
                              border: '1.5px solid #cbd5e1', color: '#0f172a', background: '#ffffff',
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >
                            {expandedRow === row.id ? <><ChevronDown size={13} /> Hide</> : <><ChevronRight size={13} /> Details</>}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDED ROW DETAILS */}
                    {expandedRow === row.id && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan="11" style={{ padding: '16px 20px', borderBottom: '2px solid #e2e8f0' }}>
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
                                <div><strong style={{ color: '#64748b' }}>Category:</strong> <span style={{ fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>{row.category || 'N/A'}</span></div>
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

            {/* Store Location Confirmation */}
            <div style={{
              marginBottom: '20px',
              padding: '14px',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '8px'
            }}>
              <label style={{
                display: 'block', fontSize: '11.5px', fontWeight: '800',
                color: 'var(--text-main)', marginBottom: '8px',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                📍 Store Location Slot
              </label>

              <SearchableLocationSelect
                locations={generatedLocations}
                value={form.storeLocation}
                onChange={(val) => setForm(p => ({ ...p, storeLocation: val }))}
                placeholder="-- Select Configured Location Slot --"
                compact
              />
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

      {/* ── PRINT BARCODE STICKERS DIALOG ── */}
      {printModalOpen && printTargetData && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="panel animate-scale" style={{ maxWidth: '520px', width: '100%', margin: '20px', padding: '24px', borderRadius: '12px' }}>
            <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={20} className="text-accent" />
                Print Barcode Stickers
              </h3>
              <button
                type="button"
                onClick={() => { setPrintModalOpen(false); setIsPrinting(false); setPrintProgressText(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Inward Summary Card */}
            <div style={{
              background: 'var(--bg-primary)',
              padding: '14px 16px',
              borderRadius: '8px',
              border: '1.5px solid var(--border-color)',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                  {printTargetData.materialName}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-color)', fontFamily: 'monospace' }}>
                  {printTargetData.itemCode || printTargetData.materialCode}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>PO: <strong>{printTargetData.poNumber}</strong></span>
                <span>Qty: <strong style={{ color: 'var(--text-main)' }}>{Number(printTargetData.pieces).toLocaleString()} {printTargetData.unit}</strong></span>
                <span>Packets: <strong>{printTargetData.totalPackets}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                <span>📍 {printTargetData.location}</span>
                <span>👤 {printTargetData.storeIncharge}</span>
                <span>📅 {printTargetData.date}</span>
              </div>
            </div>

            {/* Barcode Preview Strip */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02))',
              border: '1.5px solid rgba(99,102,241,0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Barcode (Item Code)
                </span>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#4338ca', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                  {printTargetData.itemCode || printTargetData.materialCode}
                </div>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: '#e0e7ff',
                color: '#4338ca'
              }}>
                {stickerCountToPrint} Label{stickerCountToPrint > 1 ? 's' : ''}
              </span>
            </div>

            {/* Sticker Count Input & Presets */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
                How many barcode stickers do you want to print?
              </label>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStickerCountToPrint(prev => Math.max(1, (parseInt(prev, 10) || 1) - 1))}
                  style={{
                    width: '38px', height: '38px', borderRadius: '6px', border: '1.5px solid var(--border-color)',
                    background: 'var(--bg-secondary)', color: 'var(--text-main)', fontWeight: '800', fontSize: '16px', cursor: 'pointer'
                  }}
                  disabled={isPrinting}
                >
                  -
                </button>

                <input
                  type="number"
                  min="1"
                  max="500"
                  value={stickerCountToPrint}
                  onChange={(e) => setStickerCountToPrint(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={isPrinting}
                  style={{
                    flex: 1, height: '38px', textAlign: 'center', fontSize: '16px', fontWeight: '900',
                    fontFamily: 'monospace', border: '2px solid var(--accent-color)', borderRadius: '6px',
                    background: 'var(--bg-primary)', color: 'var(--text-main)'
                  }}
                />

                <button
                  type="button"
                  onClick={() => setStickerCountToPrint(prev => (parseInt(prev, 10) || 1) + 1)}
                  style={{
                    width: '38px', height: '38px', borderRadius: '6px', border: '1.5px solid var(--border-color)',
                    background: 'var(--bg-secondary)', color: 'var(--text-main)', fontWeight: '800', fontSize: '16px', cursor: 'pointer'
                  }}
                  disabled={isPrinting}
                >
                  +
                </button>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[1, 2, 5, printTargetData.totalPackets || 1].filter((val, idx, self) => self.indexOf(val) === idx).map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setStickerCountToPrint(cnt)}
                    disabled={isPrinting}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      background: stickerCountToPrint === cnt ? 'var(--accent-color)' : 'var(--bg-secondary)',
                      color: stickerCountToPrint === cnt ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {cnt === printTargetData.totalPackets && cnt > 1 ? `All Packets (${cnt})` : `${cnt} Sticker${cnt > 1 ? 's' : ''}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Python Printer Service Status Strip */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '11.5px',
              fontWeight: '700',
              backgroundColor: printerStatus === 'online' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${printerStatus === 'online' ? '#10b981' : '#ef4444'}`,
              color: printerStatus === 'online' ? '#065f46' : '#991b1b'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: printerStatus === 'online' ? '#10b981' : '#ef4444'
                }}></span>
                {printerStatus === 'online' ? `Python Printer: Online (${printerName || 'USB Thermal Printer'})` : 'Python Printer: Offline (ws://localhost:8765)'}
              </span>

              {printerStatus !== 'online' && (
                <button
                  type="button"
                  onClick={connectPrinter}
                  style={{
                    background: 'none', border: '1px solid #ef4444', color: '#991b1b',
                    fontSize: '10.5px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '800'
                  }}
                >
                  Reconnect
                </button>
              )}
            </div>

            {/* Live Printing Progress Message */}
            {printProgressText && (
              <div style={{
                marginBottom: '14px', padding: '10px 14px', borderRadius: '6px',
                background: '#eff6ff', border: '1px solid #3b82f6', color: '#1d4ed8',
                fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <div className="Spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span>{printProgressText}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setPrintModalOpen(false); setIsPrinting(false); setPrintProgressText(''); }}
                disabled={isPrinting}
              >
                Skip / Done
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecutePrint}
                disabled={isPrinting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', padding: '10px 18px' }}
              >
                {isPrinting ? (
                  <>
                    <div className="Spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                    <span>Sending to Printer...</span>
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    <span>Print {stickerCountToPrint} Barcode Sticker{stickerCountToPrint > 1 ? 's' : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {previewModalImage && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(4px)',
            padding: '16px'
          }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="panel animate-scale"
            style={{
              maxWidth: '580px',
              width: '100%',
              padding: '20px',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📷</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    {typeof previewModalImage === 'object' && previewModalImage.item_code
                      ? `${previewModalImage.item_code} • ${previewModalImage.item_name || 'Material Photo'}`
                      : 'Material Photo Preview'}
                  </h3>
                  {typeof previewModalImage === 'object' && previewModalImage.brand && (
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
                      Brand: {previewModalImage.brand} {previewModalImage.category ? `• Category: ${previewModalImage.category}` : ''}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Photo Container */}
            <div style={{
              width: '100%',
              maxHeight: '440px',
              minHeight: '220px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              padding: '12px'
            }}>
              <img
                src={getCleanImageUrl(typeof previewModalImage === 'object' ? previewModalImage.photo : previewModalImage)}
                alt="Material preview enlarged"
                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerHTML = '<div style="padding: 40px; text-align: center; color: #94a3b8; font-weight: 700;">⚠️ Image could not be loaded</div>';
                  }
                }}
              />
            </div>

            {/* Detail Chips if metadata present */}
            {typeof previewModalImage === 'object' && (previewModalImage.stock !== undefined || previewModalImage.location) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                background: '#f8fafc',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                {previewModalImage.category && (
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px' }}>
                    🏷️ {previewModalImage.category}
                  </span>
                )}
                {previewModalImage.stock !== undefined && (
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Package size={13} style={{ color: '#16a34a' }} />
                    Total Pieces: {previewModalImage.stock.toLocaleString('en-IN')} {previewModalImage.unit || 'PCS'}
                  </span>
                )}
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} style={{ color: '#ea580c' }} />
                  Rack: {previewModalImage.location || 'Not Configured'}
                </span>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewModalImage(null)}
                style={{ fontWeight: '700', padding: '8px 18px', borderRadius: '8px' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
