import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import useDebounce from '../utils/useDebounce';
import {
  Scale, Wifi, WifiOff, Play, Square, Camera, Calculator,
  Save, RefreshCw, Download, FileSpreadsheet, Search, Filter,
  MapPin, User, ChevronDown, ChevronRight, BarChart2, CheckCircle2,
  AlertTriangle, PlaySquare, X, HelpCircle, HardDrive, Package,
  Receipt, Printer, List, Menu, ClipboardList, Upload, Image as ImageIcon, Eye
} from 'lucide-react';
import SearchableLocationSelect from './SearchableLocationSelect';

// ─── Helper: parse number from MT-code string ─────────────────────────────
const parseMTNum = (code) => {
  const m = String(code || '').match(/MT(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
};
const BASE_CODE = 1000;


const MATERIAL_OPTIONS = [
  '18L Metal Button', 'YKK Zipper 20cm', 'Elastic Tape 2cm', 'Hook & Eye Set',
  'Drawstring Cord', 'Snap Button 15mm', 'Velcro Tape 2cm', 'Satin Ribbon',
  'Toggle Button', 'Lace Trim 1cm', 'D-Ring 25mm', 'Rivets 10mm',
];


export default function WeightCapture({ racks = [], currentUser = null }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stable, setStable] = useState(false);
  const [liveWeight, setLiveWeight] = useState('00.000');
  const [grossWeight, setGrossWeight] = useState('30.250');
  const [tareWeight, setTareWeight] = useState('0.250');
  const [useTareWeight, setUseTareWeight] = useState(true);
  const [captures, setCaptures] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const [liveLocations, setLiveLocations] = useState([]);

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

  // Compute dynamic slot options from the racks configuration or live locations
  const generatedLocations = useMemo(() => {
    const slotMap = new Map();
    const source = (racks && racks.length > 0) ? racks : liveLocations;

    if (source && source.length > 0) {
      source.forEach(rack => {
        const warehouse = rack.warehouse || 'Main Store';
        const rawCode = String(rack.code || '').trim();
        const displayLabel = rack.warehouse && rawCode.includes(rack.warehouse)
          ? rawCode
          : `${warehouse} - Rack ${rawCode.replace(/^rack\s*/i, '')}`;
        if (!slotMap.has(displayLabel)) {
          slotMap.set(displayLabel, {
            code: displayLabel,
            label: displayLabel,
            rawCode: rawCode,
            warehouse: warehouse
          });
        }
      });
    }



    return Array.from(slotMap.values());
  }, [racks, liveLocations]);
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(5);
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
  const [mode, setMode] = useState('original'); // 'demo' or 'original'
  const [printerStatus, setPrinterStatus] = useState('offline');
  const [printerName, setPrinterName] = useState('');
  // nextCodeNum: the running MT-series counter — only ever increases
  const [nextCodeNum, setNextCodeNum] = useState(BASE_CODE);
  const printerWsRef = useRef(null);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const [wppLocked, setWppLocked] = useState(false);
  const [sampleQty, setSampleQty] = useState(10);
  const [weightPerPiece, setWeightPerPiece] = useState('10.000');
  const [weightConfirmed, setWeightConfirmed] = useState(false);
  const [baseWeight, setBaseWeight] = useState(30.250);
  const [sampleWeightKg, setSampleWeightKg] = useState(0);
  const [pieces, setPieces] = useState(0);
  // Packet Location Breakdown State ('same' | 'multiple')
  const [locationMode, setLocationMode] = useState('same');
  const [locationGroups, setLocationGroups] = useState([
    { location: '', count: 1 }
  ]);
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [form, setForm] = useState({
    materialName: '',
    materialCode: `MT${BASE_CODE}`,
    category: '',
    unit: 'Pcs',
    weightPerPiece: '10.000',
    sampleQty: '10',
    supplier: '',
    lotNo: '',
    qrCode: '',
    poNumber: '',
    invoiceNo: '',
    storeLocation: '',
    storeIncharge: '',
    packets: '',
    remarks: '',
    imageUrl: '',
  });

  const [metadataFlash, setMetadataFlash] = useState(false);

  const areDetailsFilled = () => {
    return (
      (form.materialName || '').trim() !== '' &&
      (form.category || '').trim() !== '' &&
      (form.supplier || '').trim() !== '' &&
      (form.poNumber || '').trim() !== '' &&
      (form.invoiceNo || '').trim() !== '' &&
      (form.storeLocation || '').trim() !== '' &&
      (form.storeIncharge || '').trim() !== ''
    );
  };

  // Get specific location for 1-indexed packet (e.g. Packet #3 out of 10)
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

  // Build combined location string summary for database & table display
  const getCombinedLocationSummary = () => {
    if (locationMode === 'same' || !locationGroups || locationGroups.length === 0) {
      return form.storeLocation || 'Main Store';
    }
    const parts = locationGroups
      .filter(g => g.location.trim() && parseInt(g.count, 10) > 0)
      .map(g => `${g.location.trim()} (${g.count} pkt${parseInt(g.count, 10) > 1 ? 's' : ''})`);
    return parts.length > 0 ? parts.join(', ') : (form.storeLocation || 'Main Store');
  };

  // Auto-connect and display live weight when in Demo mode
  useEffect(() => {
    if (mode === 'demo') {
      setConnected(true);
      setStable(true);
      setLiveWeight('30.250');
      setGrossWeight('30.250');
    } else {
      setConnected(false);
      setStable(false);
      setLiveWeight('00.000');
    }
  }, [mode]);

  // ── Fetch captures log and highest material code from DB on mount ───────────────
  const [dbMaterials, setDbMaterials] = useState([]);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/materials`)
      .then(r => r.json())
      .then(mats => {
        if (Array.isArray(mats)) {
          setDbMaterials(mats);
        }
      })
      .catch(() => {});

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
            wpp: item.weightPerPieceG ? item.weightPerPieceG.toFixed(3) : '10.000',
            sampleQty: item.sampleQty || 10,
            sampleWeightKg: item.sampleWeightKg || 0,
            pieces: item.pieces || 0,
            packets: item.packets || 1,
            unit: item.unit || 'Pcs',
            barcodeId: item.barcodeId || '',
            invoiceNo: item.invoiceNo || 'N/A',
            location: item.storeLocation || 'Main Store',
            operator: item.storeIncharge || 'Pooja',
            entryMode: (item.entryMode === 'Manual' || item.entryMode === 'Manually' || item.status === 'Manual' || item.status === 'Manually') ? 'Manually' : 'Weight Machine',
            status: (item.entryMode === 'Manual' || item.entryMode === 'Manually' || item.status === 'Manual' || item.status === 'Manually') ? 'Manually' : 'Weight Machine',
            approvalStatus: item.approvalStatus || 'Approved',
            imageUrl: item.imageUrl || ''
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
      .catch(() => { }); // silently ignore if backend not reachable
  }, []);

  // Compute unique autocomplete suggestions for Material Name & Category from previous entries
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

  // ── Printer connection (ping every 10 s) ────────────────────────────────
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
      // Auto-detect printer name from status response
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          setPrinterStatus('online');
          setPrinterName('USB Printer');
          ws.close();
        }
      }, 3000);
    } catch (e) {
      setPrinterStatus('offline');
    }
  };

  useEffect(() => {
    connectPrinter();
    const interval = setInterval(connectPrinter, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);;

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Simulated live weight
  useEffect(() => {
    if (!connected || mode !== 'demo') return;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const noise = (Math.random() - 0.5) * (tick < 10 ? 0.12 : 0.006);
      setLiveWeight((baseWeight + noise).toFixed(3));
      if (tick === 14) setStable(true);
    }, 280);
    return () => clearInterval(id);
  }, [connected, mode, baseWeight]);

  // Sync live scale weight to gross weight state dynamically before locking
  useEffect(() => {
    if (connected && !weightConfirmed) {
      setGrossWeight(liveWeight);
    }
  }, [liveWeight, connected, weightConfirmed]);

  // Derived calculations
  const netWeight = useMemo(() => {
    const gw = parseFloat(grossWeight) || 0;
    const tw = useTareWeight ? (parseFloat(tareWeight) || 0) : 0;
    return Math.max(0, gw - tw).toFixed(3);
  }, [grossWeight, tareWeight, useTareWeight]);

  useEffect(() => {
    const nwg = parseFloat(netWeight) * 1000;
    const wpp = parseFloat(weightPerPiece) || 1;
    setPieces(Math.floor(nwg / wpp));
  }, [netWeight, weightPerPiece]);

  const formula = useMemo(() => {
    const nwg = Math.round(parseFloat(netWeight) * 1000);
    const wpp = parseFloat(weightPerPiece) || 1;
    return `${nwg.toLocaleString()} g ÷ ${wpp} g = ${pieces.toLocaleString()} pcs`;
  }, [netWeight, weightPerPiece, pieces]);

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

  const stats = useMemo(() => ({
    count: captures.length,
    weight: captures.reduce((s, r) => s + parseFloat(r.weight), 0).toFixed(2),
    pieces: captures.reduce((s, r) => s + r.pieces, 0),
  }), [captures]);

  const filteredCaptures = useMemo(() => {
    const ql = debouncedQ.toLowerCase();
    return captures
      .filter(r => {
        const matchesQ = !ql ||
          (r.material && r.material.toLowerCase().includes(ql)) ||
          (r.category && r.category.toLowerCase().includes(ql)) ||
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
  }, [captures, debouncedQ, orderBy, order, filterCategory, filterPo, filterLocation, filterOperator, filterDate]);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const downloadCSV = () => {
    if (filteredCaptures.length === 0) {
      showToast('No log data available to export.', 'error');
      return;
    }
    const csvHeaders = [
      'ID', 'Material Code', 'Date', 'Time', 'PO Number', 'Material Name', 'Category',
      'Gross Weight (KG)', 'Net Weight (KG)', 'Avg Wt/Piece (g)',
      'Sample Qty (Pcs)', 'Sample Wt (KG)', 'Total Pieces',
      'Packets', 'Unit', 'Barcode ID', 'Invoice Number',
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
      row.weight || '',
      row.netWeightKg ?? '',
      row.wpp || '',
      row.sampleQty ?? '',
      row.sampleWeightKg ?? '',
      row.pieces ?? '',
      row.packets ?? '',
      row.unit || '',
      row.barcodeId || '',
      row.invoiceNo || '',
      row.location || '',
      row.operator || '',
      row.status || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Weight_Capture_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Downloaded successfully!');
  };

  const handleOriginalConnect = async () => {
    if (!('serial' in navigator)) {
      showToast('Web Serial API not supported. Please use Chrome or Edge.', 'error');
      return;
    }
    setConnecting(true);
    try {
      const serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 9600 });
      portRef.current = serialPort;
      setConnected(true);
      setConnecting(false);
      showToast('Weighbridge connected via USB COM port!');

      // Read loop setup
      const decoder = new TextDecoderStream();
      const readableStreamClosed = serialPort.readable.pipeTo(decoder.writable);
      const serialReader = decoder.readable.getReader();
      readerRef.current = serialReader;

      let buffer = '';
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) {
          serialReader.releaseLock();
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const match = lastLine.match(/(-?\d+\.\d+)/);
            if (match) {
              const weightVal = parseFloat(match[1]).toFixed(3);
              setLiveWeight(weightVal);
              setStable(lastLine.toLowerCase().includes('s') || lastLine.toLowerCase().includes('st') || lastLine.toLowerCase().includes('stable'));
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setConnecting(false);
      showToast(`Connection failed: ${err.message}`, 'error');
    }
  };

  const handleOriginalDisconnect = async () => {
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) { }
      readerRef.current = null;
    }
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (e) { }
      portRef.current = null;
    }
    setConnected(false);
    setStable(false);
    setLiveWeight('00.000');
    showToast('Weighbridge disconnected.', 'info');
  };

  const handleStartDemo = () => {
    setMode('demo');
    setConnecting(true);
    setStable(false);
    setTimeout(() => {
      setConnected(true);
      setConnecting(false);
      setBaseWeight(30.250);
      showToast('⚡ Demo Scale connected on COM3 (Simulated)');
    }, 300);
  };

  const handleAutoFillDemo = () => {
    const loc = generatedLocations[0]?.code || 'A1-R01';
    setForm(prev => ({
      ...prev,
      materialName: 'YKK #5 Brass Zipper 28"',
      category: 'ZIPPERS / TRIMS',
      supplier: 'YKK India Pvt Ltd',
      poNumber: 'PO-2026-008',
      invoiceNo: 'INV-99214',
      storeLocation: loc,
      storeIncharge: 'Pooja (Demo)',
      packets: '1',
      unit: 'Pcs',
      remarks: 'Demo Test Inward Entry',
      imageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=60'
    }));
    showToast('✨ Demo metadata autofilled! Ready for calibration.');
  };

  const handleConnect = () => {
    if (mode === 'demo') {
      handleStartDemo();
    } else {
      handleOriginalConnect();
    }
  };

  const handleDisconnect = () => {
    if (mode === 'demo') {
      setConnected(false); setStable(false); setLiveWeight('00.000');
      showToast('Demo disconnected.', 'info');
    } else {
      handleOriginalDisconnect();
    }
  };

  const handleCapture = () => {
    if (!connected) { showToast('Connect machine first.', 'error'); return; }
    setGrossWeight(liveWeight);
    showToast(`Weight captured: ${liveWeight} KG`);
  };

  const handleWeighSample = (qty) => {
    if (!areDetailsFilled()) {
      showToast('⚠️ Please fill in all Metadata Details first before weighing samples!', 'error');
      setMetadataFlash(true);
      setTimeout(() => setMetadataFlash(false), 2000);
      return;
    }
    if (!connected) {
      showToast('Scale must be connected to weigh samples.', 'error');
      return;
    }
    let currentWeight = parseFloat(liveWeight) || 0;
    // In Demo mode, if base weight is on a large bulk setting (> 1.0 KG), auto-simulate realistic sample weight
    if (mode === 'demo' && currentWeight > 1.000) {
      currentWeight = parseFloat(((qty * 10) / 1000).toFixed(3)); // e.g. 10 pcs = 0.100 KG (10g / pc)
      setBaseWeight(currentWeight);
      showToast(`⚡ Demo Sample Weight captured: ${currentWeight.toFixed(3)} KG (${qty} pcs = 10g/pc)`);
    } else {
      if (currentWeight < 0.010) {
        showToast('Minimum weight required to register sample: 10g (0.010 KG)', 'error');
        return;
      }
      showToast(`Weighed ${qty} pcs: captured ${currentWeight.toFixed(3)} KG`);
    }
    setSampleQty(qty);
    setSampleWeightKg(currentWeight);
  };

  const handleCalibrateWPP = () => {
    if (!areDetailsFilled()) {
      showToast('⚠️ Please fill in all Metadata Details first before calibrating!', 'error');
      setMetadataFlash(true);
      setTimeout(() => setMetadataFlash(false), 2000);
      return;
    }
    if (sampleWeightKg <= 0) {
      showToast('Please capture sample weight first.', 'error');
      return;
    }
    const unitWeightGrams = (sampleWeightKg * 1000) / sampleQty;
    const finalWpp = unitWeightGrams.toFixed(3);

    setWeightPerPiece(finalWpp);
    setWppLocked(true);
    showToast(`Unit weight calibrated: ${finalWpp} g per piece! (Locked)`);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const totalPackets = parseInt(form.packets) || 1;
      const grossKg = parseFloat(grossWeight) || 0;
      const tareKg = useTareWeight ? (parseFloat(tareWeight) || 0) : 0;
      const netKg = parseFloat((grossKg - tareKg).toFixed(3));
      const wppG = parseFloat(weightPerPiece) || 0;
      const barcodeId = `${form.materialCode}-A${String(totalPackets).padStart(2, '0')}`;
      const finalLocation = getCombinedLocationSummary();

      const newEntry = {
        id: captures.length + 1,
        materialCode: form.materialCode,
        time: now.toTimeString().slice(0, 8),
        date: now.toLocaleDateString('en-IN'),
        po: form.poNumber || 'N/A',
        material: form.materialName,
        category: form.category || '',
        weight: grossWeight,
        netWeightKg: netKg,
        wpp: weightPerPiece,
        sampleQty: sampleQty,
        sampleWeightKg: sampleWeightKg,
        pieces,
        packets: totalPackets,
        unit: form.unit,
        barcodeId,
        invoiceNo: form.invoiceNo || 'N/A',
        location: finalLocation,
        operator: form.storeIncharge || 'Paras',
        status: stable ? 'Stable' : 'Captured',
        imageUrl: form.imageUrl || ''
      };
      setCaptures(prev => [newEntry, ...prev]);

      setSaving(false); setSaveDialog(false);
      setWppLocked(false);
      setWeightConfirmed(false);
      setSampleWeightKg(0);
      setSampleQty(10);
      // ── Increment material code — never goes backwards ──────────────
      const nextNum = nextCodeNum + 1;
      setNextCodeNum(nextNum);
      setForm(p => ({ ...p, packets: '', imageUrl: '', remarks: '', materialCode: `MT${nextNum}` }));
      showToast(`Record saved: ${pieces.toLocaleString()} ${form.unit}`);

      // ── Save to MySQL via backend API ──────────────────────────────────
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
          grossWeightKg: grossKg,
          tareWeightKg: tareKg,
          netWeightKg: netKg,
          weightPerPieceG: wppG,
          sampleQty: sampleQty,
          sampleWeightKg: sampleWeightKg,
          pieces: pieces,
          packets: totalPackets,
          barcodeId: barcodeId,
          entryMode: 'Weight Machine',
          status: stable ? 'Stable' : 'Captured',
          remarks: form.remarks,
          imageUrl: form.imageUrl || '',
        })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success && res.id) {
            showToast(`✅ Saved to MySQL (ID: ${res.id})`);
            // Update local ID with MySQL DB id
            setCaptures(prev => prev.map(item => item.materialCode === newEntry.materialCode ? { ...item, id: res.id } : item));
          } else {
            showToast('DB save failed: ' + (res.error || 'Unknown error'), 'error');
          }
        })
        .catch(() => showToast('Could not reach backend server.', 'error'));


      const totalPkts = totalPackets;
      const d = now;
      const printDate =
        String(d.getDate()).padStart(2, '0') + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        d.getFullYear() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');

      const stickerBase = {
        cmp: form.supplier || 'paras',
        materialName: form.materialName || 'KT-5060',
        materialCode: form.materialCode,
        category: form.category || 'summer',
        shade: form.color || 'Black',
        weight: `${netKg || grossKg} KG`,
        pieces: String(pieces),
        unit: form.unit,
        operator: form.storeIncharge || 'Paras',
        authorized: form.storeIncharge || 'Paras',
        poNumber: form.poNumber || 'N/A',
        billNo: form.invoiceNo || form.poNumber || 'N/A',
        lotNo: form.lotNo || form.materialCode || '4569',
        totalPackets: totalPkts,
        date: printDate.split(' ')[0],
      };

      // Open one persistent WebSocket, send stickers one-by-one with packet-specific location
      try {
        const pws = new WebSocket('ws://localhost:8765');
        let nextPkt = 1;   // which packet to send next after auth

        const sendNext = () => {
          if (nextPkt > totalPkts) { pws.close(); return; }
          const pktLoc = getPacketLocationForIndex(nextPkt);
          const pktBarcodeId = `${form.materialCode}-A${String(nextPkt).padStart(2, '0')}`;
          pws.send(JSON.stringify({
            type: 'print_accessory',
            data: {
              ...stickerBase,
              barcodeId: pktBarcodeId,
              location: pktLoc,
              packetNo: nextPkt
            }
          }));
          showToast(`🖨️ Printing sticker ${nextPkt}/${totalPkts} (${pktLoc})…`, 'info');
          nextPkt++;
        };

        pws.onopen = () => {
          pws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
        };

        pws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'auth_success') {
            sendNext();                      // start sending on auth OK
          } else if (msg.type === 'print_accessory_result') {
            if (msg.success) {
              if (nextPkt > totalPkts) {
                showToast(`✅ All ${totalPkts} sticker(s) printed!`);
                pws.close();
              } else {
                sendNext();                  // send next only after previous ack
              }
            } else {
              showToast(`⚠️ Sticker ${msg.packetNo} failed: ${msg.message}`, 'error');
              sendNext();                    // try next anyway
            }
          } else if (msg.type === 'auth_failed' || msg.type === 'error') {
            showToast('Print service: ' + msg.message, 'error');
            pws.close();
          }
        };

        pws.onerror = () =>
          showToast('Printer not connected — start print service & retry.', 'error');
      } catch (_) {
        showToast('Could not connect to print service.', 'error');
      }
    }, 1000);
  };


  const handleSaveClick = () => {
    if (!areDetailsFilled()) {
      showToast('⚠️ Please fill in all required Metadata Details before saving!', 'error');
      setMetadataFlash(true);
      setTimeout(() => setMetadataFlash(false), 2000);
      return;
    }
    const wppVal = parseFloat(weightPerPiece) || 0;
    if (wppVal <= 0) {
      showToast('⚠️ Please enter or calibrate a valid Piece Weight (g/pc)!', 'error');
      return;
    }
    let gw = parseFloat(grossWeight) || 0;
    const tw = useTareWeight ? (parseFloat(tareWeight) || 0) : 0;

    // If in Demo mode and gross weight is <= tare or zero, auto-apply demo bulk weight (30.250 KG)
    if (mode === 'demo' && gw <= tw) {
      gw = 30.250;
      setBaseWeight(30.250);
      setGrossWeight('30.250');
      setLiveWeight('30.250');
      setConnected(true);
      setStable(true);
      showToast('⚡ Auto-applied demo gross weight: 30.250 KG');
    }

    const netKg = gw - tw;
    if (netKg <= 0) {
      showToast('⚠️ Scale gross weight (' + gw.toFixed(2) + ' KG) is not greater than Tare Weight (' + tw.toFixed(2) + ' KG). Please select a weight preset (e.g. 30.25 KG)!', 'error');
      return;
    }
    // Auto-set sample weight from piece weight if not calibrated from live scale
    if (sampleWeightKg <= 0) {
      const autoSampleWeight = parseFloat(((sampleQty * wppVal) / 1000).toFixed(3));
      setSampleWeightKg(autoSampleWeight);
    }

    setSaveDialog(true);
  };


  const handleClear = () => {
    setGrossWeight('00.000'); setTareWeight('0.000'); setStable(false);
    setWppLocked(false); // unlock WPP
    setWeightConfirmed(false); // unlock bulk weight
    setWeightPerPiece('10.000'); // reset WPP to default 10g
    setSampleWeightKg(0); // reset sample weight
    setSampleQty(10); // reset sample qty
    showToast('Cleared inputs.', 'info');
  };

  const handleSort = (col) => {
    setOrderBy(col);
    setOrder(o => orderBy === col ? (o === 'asc' ? 'desc' : 'asc') : 'asc');
  };

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Pagination bounds
  const paginatedData = useMemo(() => {
    const start = page * rpp;
    return filteredCaptures.slice(start, start + rpp);
  }, [filteredCaptures, page, rpp]);

  const totalPages = Math.ceil(filteredCaptures.length / rpp) || 1;

  return (
    <div className="page-container" style={{ padding: '16px', maxWidth: '100%', fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Local styles for wcs-input elements to replicate G-PDMS UI parameters */}
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
          font-family: 'Times New Roman', Times, serif !important;
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
          font-family: 'Times New Roman', Times, serif !important;
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
          font-family: 'Times New Roman', Times, serif !important;
        }
        .btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
          pointer-events: none !important;
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
            <Scale size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>Material Add</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Digital Counting Weighbridge Interface</span>
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
            <div style={{ width: '32px', height: '32px', background: '#10b981', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px' }}>A</div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Operator</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Pooja</span>
            </div>
          </div>

          <div className="status-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px',
            backgroundColor: connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: connected ? '#10b981' : '#ef4444',
            border: `1.5px solid ${connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            fontWeight: '700', fontSize: '12px'
          }}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connecting ? 'Connecting...' : (connected ? (mode === 'demo' ? 'Demo Active' : 'USB Scale Connected') : 'Machine Offline')}
          </div>

          {/* ── Printer Status Badge ── */}
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
            {/* Printer icon inline SVG */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            {printerStatus === 'connecting'
              ? 'Connecting...'
              : printerStatus === 'online'
                ? (printerName || 'USB Printer Connected')
                : 'Printer Offline'}
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh Page"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              padding: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-color)';
              e.currentTarget.style.color = 'var(--accent-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── TOP HEADER / STATUS PILLS ──────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 18px', backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px', border: '1px solid var(--border-color)',
        marginBottom: '20px', flexWrap: 'wrap', gap: '12px'
      }}>
        {/* Left Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '20px',
            backgroundColor: connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
            color: connected ? '#10b981' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: '700'
          }}>
            <Scale size={14} />
            USB Scale: <span style={{ textTransform: 'uppercase', padding: '1px 6px', borderRadius: '4px', background: connected ? '#10b981' : '#94a3b8', color: '#fff', fontSize: '10px' }}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '20px',
            backgroundColor: printerStatus === 'online' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
            color: printerStatus === 'online' ? '#10b981' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: '700', cursor: 'pointer'
          }}
            onClick={() => printerStatus !== 'online' && connectPrinter()}
            title="Click to check thermal printer connection"
          >
            <Printer size={14} />
            Printer: <span style={{ textTransform: 'uppercase', padding: '1px 6px', borderRadius: '4px', background: printerStatus === 'online' ? '#10b981' : '#94a3b8', color: '#fff', fontSize: '10px' }}>{printerStatus === 'online' ? `CONNECTED: ${printerName || 'USB Printer'}` : 'DISCONNECTED'}</span>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '20px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
            fontSize: '12px', fontWeight: '700'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            NETWORK OK
          </div>
        </div>

        {/* Right warning banner if printer is offline */}
        {printerStatus !== 'online' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: '8px',
            backgroundColor: '#fffbe6', border: '1px solid #ffe58f',
            color: '#d48806', fontSize: '12px', fontWeight: '600'
          }}>
            <AlertTriangle size={15} style={{ color: '#d48806' }} />
            Print service disconnected. Run: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '4px' }}>python print_service.py</code>
          </div>
        )}
      </div>

      {/* ── WORKFLOW INSTRUCTIONS BANNER ── */}
      <div className="panel" style={{
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1.5px solid var(--border-color)',
        marginBottom: '20px',
        background: 'var(--bg-secondary)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-main)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📋 Operating Instructions: Step-by-Step Material Add Workflow
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
              Fill in all fields with red asterisk (*) in the <strong>Metadata Details</strong> form first.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${wppLocked ? '#10b981' : (areDetailsFilled() ? 'var(--accent-color)' : 'var(--border-color)')}`,
            background: wppLocked ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)', transition: 'all 0.3s',
            opacity: areDetailsFilled() ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: wppLocked ? '#10b981' : (areDetailsFilled() ? 'var(--accent-color)' : '#94a3b8'), color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>2</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Calibrate Sample Weight</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Weigh sample (e.g. 10 pcs), click <strong>Weigh Pcs</strong>, then <strong>Calibrate Avg Wt</strong> to lock.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${weightConfirmed ? '#10b981' : (wppLocked ? 'var(--accent-color)' : 'var(--border-color)')}`,
            background: weightConfirmed ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)', transition: 'all 0.3s',
            opacity: wppLocked ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: weightConfirmed ? '#10b981' : (wppLocked ? 'var(--accent-color)' : '#94a3b8'), color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>3</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Weigh Bulk Packets</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Place bulk roll/packets on scale. Total count calculates automatically. Confirm bulk weight.
            </p>
          </div>

          {/* Step 4 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${saveDialog ? '#10b981' : 'var(--border-color)'}`,
            background: 'var(--bg-primary)', opacity: wppLocked ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: wppLocked ? 'var(--accent-color)' : '#94a3b8', color: '#fff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>4</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Save & Print Add</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Verify total packets, location, then click <strong>Save & Print Material Add</strong> to finalize.
            </p>
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN GRID LAYOUT ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', marginBottom: '24px' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Scale Reading Dark Card */}
          <div style={{
            background: '#242e42',
            borderRadius: '14px',
            padding: '24px 20px',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '11px', fontWeight: '800', letterSpacing: '1.2px',
              color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px'
            }}>
              WEIGHING SCALE READING
            </span>

            <div style={{
              fontSize: '56px', fontWeight: '900', fontFamily: 'monospace',
              letterSpacing: '2px', color: stable ? '#10b981' : '#ffffff',
              margin: '8px 0 16px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'center'
            }}>
              {connected ? liveWeight : '0.00'}
              <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: '700', marginLeft: '10px' }}>KG</span>
            </div>

            {/* Status dot */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                backgroundColor: stable ? '#10b981' : (connected ? '#f59e0b' : '#64748b'),
                boxShadow: stable ? '0 0 8px #10b981' : 'none'
              }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: stable ? '#10b981' : (connected ? '#f59e0b' : '#94a3b8') }}>
                {stable ? 'Weight Stable' : (connected ? 'Stabilizing Weight...' : 'Scale Offline')}
              </span>
            </div>

            {/* Control buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              {connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                    border: 'none', background: '#ef4444', color: '#ffffff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <WifiOff size={14} /> Disconnect Scale
                </button>
              ) : (
                <button
                  type="button"
                  onClick={mode === 'demo' ? handleStartDemo : handleConnect}
                  disabled={connecting}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                    border: 'none',
                    background: mode === 'demo' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#3b82f6',
                    color: '#ffffff',
                    cursor: connecting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {connecting ? 'Connecting...' : (mode === 'demo' ? '⚡ Start Demo Scale' : '🔌 Connect USB Scale')}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (mode === 'demo') {
                    // Switch to physical USB mode
                    setMode('original');
                    setConnected(false);
                    setStable(false);
                    setLiveWeight('00.000');
                    showToast('Switched to physical USB Scale mode.');
                  } else {
                    // Switch to Demo Mode and auto-start live simulated weight
                    setMode('demo');
                    handleStartDemo();
                  }
                }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                  border: '1px solid #475569', background: mode === 'demo' ? '#1e293b' : '#334155', color: '#ffffff',
                  cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {mode === 'demo' ? '🎮 Demo Mode (Active)' : '🔌 Switch to Demo Mode'}
              </button>
            </div>

            {/* Quick Demo Simulator trigger if in demo mode */}
            {mode === 'demo' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '10.5px', color: '#94a3b8', width: '100%', fontWeight: '700' }}>Simulate Weight Load:</span>
                {[
                  { label: 'Sample (0.100 KG)', wt: 0.100 },
                  { label: '5 KG', wt: 5.000 },
                  { label: '15.25 KG', wt: 15.250 },
                  { label: '30.25 KG', wt: 30.250 },
                  { label: '50 KG', wt: 50.000 }
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMode('demo');
                      setConnected(true);
                      setBaseWeight(item.wt);
                      setGrossWeight(item.wt.toFixed(3));
                      setLiveWeight(item.wt.toFixed(3));
                      setStable(true);
                      showToast(`Scale weight set: ${item.wt.toFixed(3)} KG`);
                    }}
                    style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700',
                      border: Math.abs(baseWeight - item.wt) < 0.05 ? '1px solid #10b981' : '1px solid #475569',
                      background: Math.abs(baseWeight - item.wt) < 0.05 ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                      color: Math.abs(baseWeight - item.wt) < 0.05 ? '#10b981' : '#cbd5e1',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tare Weight Configuration Card */}
          <div className="panel" style={{ margin: 0, padding: '16px 20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Scale size={15} style={{ color: '#3b82f6' }} /> Tare Weight Options
              </h3>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={useTareWeight}
                  onChange={(e) => setUseTareWeight(e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                Deduct Tare
              </label>
            </div>

            {useTareWeight ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Tare Weight (KG):</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="wcs-input"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(e.target.value)}
                  style={{
                    width: '100px', height: '30px', padding: '4px 8px', fontSize: '13px', fontWeight: '800',
                    textAlign: 'right', borderRadius: '6px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)', color: 'var(--text-main)'
                  }}
                />
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                Gross weight is used directly (container weight = 0).
              </div>
            )}
          </div>

          {/* Piece Weight & Sample Calibration Panel */}
          <div className="panel" style={{ margin: 0, padding: '18px 20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calculator size={16} style={{ color: '#6366f1' }} /> Piece Weight Calibration
              </h3>
              <span style={{
                fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px',
                background: wppLocked ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: wppLocked ? '#10b981' : '#f59e0b',
                border: `1px solid ${wppLocked ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`
              }}>
                {wppLocked ? '🔒 Calibrated' : 'Step 1: Calibration'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Sample Qty & Sample Weight */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="wcs-label" style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>Sample Qty (Pcs)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      className="wcs-input"
                      disabled={wppLocked}
                      value={sampleQty}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setSampleQty(isNaN(val) || val < 1 ? 1 : val);
                      }}
                      style={{ height: '32px', fontSize: '13px', fontWeight: '800', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>pcs</span>
                  </div>
                </div>

                <div>
                  <label className="wcs-label" style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>Sample Weight</label>
                  <div style={{
                    height: '32px', padding: '0 10px', borderRadius: '6px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '12px', fontWeight: '800', color: sampleWeightKg > 0 ? '#3b82f6' : 'var(--text-muted)'
                  }}>
                    {sampleWeightKg > 0 ? `${sampleWeightKg.toFixed(3)} KG` : '0.000 KG'}
                  </div>
                </div>
              </div>

              {/* Weigh & Calibrate Buttons */}
              {!wppLocked ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleWeighSample(sampleQty)}
                    disabled={!connected}
                    style={{
                      flex: 1, padding: '7px 10px', fontSize: '11.5px', fontWeight: '700',
                      borderRadius: '6px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.08)',
                      color: '#4f46e5', cursor: connected ? 'pointer' : 'not-allowed', opacity: connected ? 1 : 0.6
                    }}
                  >
                    ⚖️ Weigh {sampleQty} Pcs
                  </button>

                  <button
                    type="button"
                    onClick={handleCalibrateWPP}
                    disabled={sampleWeightKg <= 0}
                    style={{
                      flex: 1, padding: '7px 10px', fontSize: '11.5px', fontWeight: '700',
                      borderRadius: '6px', border: 'none', background: sampleWeightKg > 0 ? '#10b981' : '#cbd5e1',
                      color: '#ffffff', cursor: sampleWeightKg > 0 ? 'pointer' : 'not-allowed'
                    }}
                  >
                    🧮 Calibrate Avg Wt
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Calibrated Piece Weight</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: '#10b981' }}>{weightPerPiece} g / pc</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWppLocked(false)}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: '700' }}
                  >
                    Unlock
                  </button>
                </div>
              )}

              {/* Unit Weight Manual Edit & Calculated Pieces */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>Weight / Piece (Gram):</span>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    disabled={wppLocked}
                    value={weightPerPiece}
                    onChange={(e) => setWeightPerPiece(e.target.value)}
                    style={{
                      width: '85px', padding: '4px 8px', fontSize: '12px', fontWeight: '800',
                      textAlign: 'right', borderRadius: '6px', border: '1px solid var(--border-color)',
                      background: wppLocked ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: 'var(--text-main)'
                    }}
                  />
                </div>

                <div style={{
                  padding: '10px', borderRadius: '8px', textAlign: 'center',
                  background: 'rgba(99, 102, 241, 0.06)', border: '1px dashed rgba(99, 102, 241, 0.25)'
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Calculated Total Pieces
                  </span>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: '#4f46e5', fontFamily: 'monospace' }}>
                    {pieces.toLocaleString()} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>pcs</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {formula}
                  </span>
                </div>
              </div>

            </div>
          </div>



        </div>

        {/* ── RIGHT COLUMN: BATCH SETUP & METADATA FORM ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Batch Setup & Process Control Panel */}
          <div className="panel" style={{ margin: 0, padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 16px 0', color: 'var(--text-main)' }}>
              Batch Setup & Process Control
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label className="wcs-label" style={{ fontWeight: '700', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Total Packets
                </label>
                <input
                  type="number"
                  min="1"
                  className="wcs-input"
                  value={form.packets}
                  onChange={setF('packets')}
                  placeholder="1"
                  style={{ height: '38px', fontSize: '14px', fontWeight: '700' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '180px' }}>
                <label className="wcs-label" style={{ fontWeight: '700', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Unit of Measurement
                </label>
                <select
                  className="wcs-input"
                  value={form.unit}
                  onChange={setF('unit')}
                  style={{ height: '38px', fontSize: '13px', cursor: 'pointer' }}
                >
                  {['Pcs', 'Mtr', 'Kg', 'Gm', 'Pair', 'Cone', 'Roll', 'Set', 'Doz', 'Box', 'Pkt', 'Bundle', 'Yds', 'Cm', 'Inch'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => showToast(`Batch set to ${form.packets || 1} packet(s).`)}
                style={{ height: '38px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700' }}
              >
                <Play size={15} /> Start Batch
              </button>
            </div>
          </div>

          {/* Metadata Details Form */}
          <div className="panel" style={{
            margin: 0,
            padding: '24px',
            borderRadius: '12px',
            border: metadataFlash ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
            boxShadow: metadataFlash ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 4px 16px rgba(0,0,0,0.05)',
            transform: metadataFlash ? 'scale(1.01)' : 'scale(1)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0, color: '#0f172a', letterSpacing: '0.2px' }}>
                Roll / Item Metadata Details
              </h3>
              {mode === 'demo' && (
                <button
                  type="button"
                  onClick={handleAutoFillDemo}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '800',
                    border: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.16)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'; }}
                >
                  ⚡ Autofill Demo Details
                </button>
              )}
            </div>

            {/* Live PO Requirement, Duplicate Invoice & 3% Tolerance Status Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>
                  Material Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.materialName}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(prev => {
                      const matched = (dbMaterials || []).find(m => m.name && m.name.toLowerCase() === val.trim().toLowerCase())
                                   || (captures || []).find(c => (c.material || c.materialName) && (c.material || c.materialName).toLowerCase() === val.trim().toLowerCase());
                      const newCat = (!prev.category.trim() && matched?.category) ? matched.category.toUpperCase() : prev.category;
                      return {
                        ...prev,
                        materialName: val,
                        category: newCat
                      };
                    });
                  }}
                  list="weight-capture-material-suggestions"
                  placeholder="e.g. YKK Brass Zipper (type to search)"
                  autoComplete="on"
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
                />
                <datalist id="weight-capture-material-suggestions">
                  {materialSuggestions.map((name, idx) => (
                    <option key={idx} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>Material Code (Auto) <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.materialCode}
                  onChange={setF('materialCode')}
                  style={{ height: '40px', fontSize: '14px', fontFamily: 'monospace', fontWeight: '900', color: '#0f172a', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1' }}
                />
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>
                  Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.category}
                  onChange={setF('category')}
                  list="weight-capture-category-suggestions"
                  placeholder="e.g. ZIPPERS / TRIMS (type or select)"
                  autoComplete="on"
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
                />
                <datalist id="weight-capture-category-suggestions">
                  {categorySuggestions.map((cat, idx) => (
                    <option key={idx} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>Supplier / Vendor <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.supplier}
                  onChange={setF('supplier')}
                  placeholder="e.g. CMF Fabric Ltd"
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
                />
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>PO Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.poNumber}
                  onChange={setF('poNumber')}
                  placeholder="e.g. PO-0007"
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
                />
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>Bill / Invoice Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.invoiceNo}
                  onChange={setF('invoiceNo')}
                  placeholder="e.g. BILL-9921"
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
                />
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>Location Slot <span style={{ color: '#ef4444' }}>*</span></label>
                <SearchableLocationSelect
                  locations={generatedLocations}
                  value={form.storeLocation}
                  onChange={(val) => setForm(p => ({ ...p, storeLocation: val }))}
                  placeholder="-- Select Configured Location Slot --"
                  required
                />
              </div>

              <div className="form-group">
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>Store Incharge / Authorized Person <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="wcs-input"
                  value={form.storeIncharge}
                  onChange={setF('storeIncharge')}
                  placeholder="e.g. Pooja"
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
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

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="wcs-label" style={{ color: '#0f172a', fontWeight: '800' }}>Remarks / Operational Notes</label>
                <textarea
                  className="wcs-textarea"
                  value={form.remarks}
                  onChange={setF('remarks')}
                  placeholder="Add operational notes here..."
                  style={{ height: '60px', fontSize: '13.5px', fontWeight: '700', color: '#0f172a', resize: 'vertical' }}
                />
              </div>

            </div>

            {/* Action Bar */}
            <div style={{ marginTop: '22px' }}>
              <button
                type="button"
                onClick={handleSaveClick}
                style={{
                  width: '100%',
                  padding: '14px 20px',
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.35)';
                }}
              >
                <CheckCircle2 size={19} /> Save & Print Material Add
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ── RECENT CAPTURES TABLE ───────────────────────────────────────── */}
      <div className="panel" style={{ padding: '24px', borderRadius: '12px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', background: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Menu size={20} style={{ color: '#334155' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
              Recent captures Log
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
                style={{ paddingLeft: '36px', height: '38px', width: '220px', fontSize: '13px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
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
                alignItems: 'center',
                transition: 'all 0.2s'
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
                alignItems: 'center',
                transition: 'all 0.2s'
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
            gap: '12px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
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
                  height: '36px',
                  width: '100%',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '10px' }}>
          <table style={{ width: '100%', minWidth: '1180px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {[
                  ['# / CODE', 'materialCode'],
                  ['IMAGE', null],
                  ['TIME', 'time'],
                  ['PO NUMBER', 'po'],
                  ['MATERIAL NAME', 'material'],
                  ['CATEGORY', 'category'],
                  ['SAMPLE (PCS / WT)', null],
                  ['AVG WT / PC', null],
                  ['GROSS WEIGHT', 'weight'],
                  ['TOTAL PIECES', 'pieces'],
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
                  <td colSpan="13" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontWeight: '600' }}>No weight logs found in database.</td>
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

                      {/* SAMPLE (PCS / WT) */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>{row.sampleQty || 10} Pcs</div>
                        <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: '800', marginTop: '2px' }}>
                          {parseFloat(row.sampleWeightKg || 0).toFixed(3)} KG
                        </div>
                      </td>

                      {/* AVG WT / PC */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{
                          display: 'inline-block', padding: '6px 12px', borderRadius: '6px',
                          background: '#dcfce7', border: '1px solid #bbf7d0',
                          color: '#15803d', fontWeight: '900', fontSize: '12.5px', fontFamily: 'monospace'
                        }}>
                          {row.wpp || '10.000'} g/pc
                        </div>
                      </td>

                      {/* GROSS WEIGHT */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '13px', fontFamily: 'monospace' }}>
                          {row.weight} KG
                        </div>
                      </td>

                      {/* TOTAL PIECES */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '900', color: '#3b82f6', fontSize: '14px' }}>
                          {row.pieces.toLocaleString()} Pcs
                        </div>
                        {row.packets > 1 && (
                          <div style={{ marginTop: '3px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '2px 7px', borderRadius: '4px', background: '#f3e8ff',
                              color: '#7e22ce', fontSize: '10.5px', fontWeight: '800'
                            }}>
                              📦 {row.packets} Packets
                            </span>
                          </div>
                        )}
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
                          border: `1.5px solid ${(row.status === 'Manually' || row.status === 'Manual' || row.entryMode === 'Manually' || row.entryMode === 'Manual') ? '#bfdbfe' : '#bbf7d0'}`
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
                        <td colSpan="13" style={{ padding: '16px 20px', borderBottom: '2px solid #e2e8f0' }}>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px',
                            background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1.5px solid #cbd5e1'
                          }}>
                            {/* Sample & Calibration Details */}
                            <div style={{ borderRight: '1px dashed #cbd5e1', paddingRight: '16px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                🔬 Calibration & Sample Details
                              </span>
                              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><strong style={{ color: '#64748b' }}>Sample Pieces:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.sampleQty || 10} Pcs</span></div>
                                <div><strong style={{ color: '#64748b' }}>Sample Weight:</strong> <span style={{ fontWeight: '800', color: '#2563eb' }}>{parseFloat(row.sampleWeightKg || 0).toFixed(3)} KG ({((parseFloat(row.sampleWeightKg || 0)) * 1000).toFixed(1)} g)</span></div>
                                <div><strong style={{ color: '#64748b' }}>Average / Piece:</strong> <span style={{ fontWeight: '800', color: '#16a34a' }}>{row.wpp} grams / pc</span></div>
                                <div style={{ marginTop: '4px', padding: '6px', background: '#fef3c7', borderRadius: '4px', fontSize: '11px', color: '#d97706', fontWeight: '700' }}>
                                  📐 Formula: {((parseFloat(row.sampleWeightKg || 0)) * 1000).toFixed(1)} g ÷ {row.sampleQty || 10} pcs = {row.wpp} g/pc
                                </div>
                              </div>
                            </div>

                            {/* Batch & Barcode Info */}
                            <div style={{ borderRight: '1px dashed #cbd5e1', paddingRight: '16px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                🏷️ Barcode & Package Ref
                              </span>
                              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><strong style={{ color: '#64748b' }}>Material Code:</strong> <span style={{ fontWeight: '800', fontFamily: 'monospace', color: '#0f172a' }}>{row.materialCode}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Category:</strong> <span style={{ fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>{row.category || 'N/A'}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Barcode ID:</strong> <span style={{ fontWeight: '800', color: '#4338ca', fontFamily: 'monospace' }}>{row.barcodeId || 'N/A'}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Total Packets:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.packets || 1} packet(s)</span></div>
                                <div><strong style={{ color: '#64748b' }}>PO Number:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.po}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Invoice:</strong> <span style={{ fontWeight: '700', color: '#0f172a' }}>{row.invoiceNo || 'N/A'}</span></div>
                              </div>
                            </div>

                            {/* Operational Summary */}
                            <div>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                🧮 Quantity & Weight Summary
                              </span>
                              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><strong style={{ color: '#64748b' }}>Gross Weight:</strong> <span style={{ fontWeight: '800', color: '#0f172a' }}>{row.weight} KG</span></div>
                                <div><strong style={{ color: '#64748b' }}>Net Weight:</strong> <span style={{ fontWeight: '800', color: '#2563eb' }}>{row.netWeightKg || row.weight} KG</span></div>
                                <div><strong style={{ color: '#64748b' }}>Total Calculated:</strong> <span style={{ fontWeight: '900', color: '#2563eb', fontSize: '13px' }}>{row.pieces.toLocaleString()} {row.unit || 'Pcs'}</span></div>
                                <div><strong style={{ color: '#64748b' }}>Incharge & Store:</strong> <span style={{ fontWeight: '700', color: '#0f172a' }}>{row.operator} @ {row.location}</span></div>
                                <div style={{ marginTop: '4px' }}><span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>✔ AUDITED & STORED IN MYSQL</span></div>
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

        {/* Custom Pagination Footer */}
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

      {/* ── BOTTOM STATUS BAR ───────────────────────────────────────────── */}
      <div className="panel" style={{ padding: '12px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', marginTop: '24px' }}>
        {[
          { label: 'Weighbridge Status', value: connected ? 'ONLINE' : 'OFFLINE', ok: connected },
          { label: 'Stable Indicator', value: stable ? 'STABLE' : 'UNSTABLE', ok: stable },
          { label: 'Database Status', value: 'CONNECTED', ok: true },
          { label: 'Host Network', value: '192.168.1.10', ok: true }
        ].map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.ok ? '#10b981' : '#ef4444' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}:</span>
            <span style={{ fontSize: '11px', fontWeight: '800', color: item.ok ? '#10b981' : '#ef4444' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── SAVE CONFIRMATION DIALOG ────────────────────────────────────── */}
      {saveDialog && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="panel animate-scale" style={{ maxWidth: '480px', width: '100%', margin: '20px', padding: '24px' }}>
            <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ margin: 0 }}><Save size={18} /> Confirm Weight Log Save</h3>
              <button onClick={() => setSaveDialog(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {[
                ['Material', form.materialName],
                ['Unit', form.unit],
                ['PO Number', form.poNumber],
                ['Sample Qty', `${sampleQty} pcs`],
                ['Sample Weight', `${parseFloat(sampleWeightKg || 0).toFixed(3)} KG`],
                ['Weight Per Piece', `${weightPerPiece} g`],
                ['Gross Wt.', `${grossWeight} KG`],
                ['Tare Wt.', useTareWeight ? `${tareWeight} KG` : '0.000 KG'],
                ['Pieces Count', `${pieces.toLocaleString()} ${form.unit}`],
                ['Store Location', form.storeLocation],
                ['Incharge / Operator', form.storeIncharge]
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{l}:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '800' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Step 1: Total Packets Count */}
            <div style={{
              marginBottom: '14px',
              padding: '12px 14px',
              background: 'rgba(99,102,241,0.06)',
              border: '1.5px solid rgba(99,102,241,0.2)',
              borderRadius: '8px'
            }}>
              <label style={{
                display: 'block', fontSize: '11.5px', fontWeight: '800',
                color: 'var(--accent-color)', marginBottom: '6px',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                📦 Step 1: Total Packets / Bags Count
              </label>
              <input
                type="number"
                min="1"
                placeholder="Enter total packet count (e.g. 10)"
                className="wcs-input"
                value={form.packets}
                onChange={e => {
                  setF('packets')(e);
                  const total = parseInt(e.target.value, 10) || 1;
                  if (locationMode === 'same') {
                    setLocationGroups([{ location: form.storeLocation || '', count: total }]);
                  }
                }}
                style={{ fontWeight: '800', fontSize: '16px', textAlign: 'center', background: 'var(--bg-secondary)' }}
                autoFocus
              />
            </div>

            {/* Step 2: Packet Location Assignment */}
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
                📍 Step 2: Location Assignment for Packets
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
                  <SearchableLocationSelect
                    locations={generatedLocations}
                    value={form.storeLocation}
                    onChange={(val) => setForm(p => ({ ...p, storeLocation: val }))}
                    placeholder="-- Select Configured Location Slot --"
                    compact
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {locationGroups.map((grp, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Location #{idx + 1}</label>
                        <SearchableLocationSelect
                          locations={generatedLocations}
                          value={grp.location}
                          onChange={(val) => {
                            setLocationGroups(prev => prev.map((g, i) => i === idx ? { ...g, location: val } : g));
                          }}
                          placeholder="-- Select Slot --"
                          compact
                        />
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

      {/* ── IMAGE ENLARGED PREVIEW MODAL ─────────────────────────────── */}
      {previewModalImage && (
        <div
          className="modal-overlay"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="panel animate-scale"
            style={{
              maxWidth: '650px', width: '90%', padding: '20px',
              borderRadius: '12px', background: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📷 Material Photo Preview
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              width: '100%', maxHeight: '450px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#f8fafc', borderRadius: '8px', overflow: 'hidden', padding: '10px'
            }}>
              <img
                src={getCleanImageUrl(previewModalImage)}
                alt="Material preview enlarged"
                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '6px' }}
                onError={(e) => { e.target.alt = 'Image failed to load'; }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewModalImage(null)}
                style={{ fontWeight: '700', padding: '8px 16px' }}
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
