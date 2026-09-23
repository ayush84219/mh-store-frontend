import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, Clock, ArrowLeftRight,
  CheckCircle, AlertTriangle, Layers, FileText, ChevronRight, X, Plus, ChevronDown,
  Warehouse, Box, LayoutGrid, List, Sparkles, Filter, RefreshCw, Eye, Package,
  Maximize2, ArrowUpRight, Trash2, Edit3, ShieldAlert, ArrowRight, Check, Grid,
  Sliders, TrendingUp, BarChart2, Info, Send
} from 'lucide-react';

export default function WarehouseLocationView({ racks = [], materials = [], halls = [], onNavigate, currentUser }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dbLocations, setDbLocations] = useState([]);
  const [dbMaterials, setDbMaterials] = useState(materials);
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sync props to state if props change
  useEffect(() => {
    if (materials && materials.length > 0) {
      setDbMaterials(materials);
    }
  }, [materials]);

  // View Mode: 'zone_layout' (by hall sections), 'grid' (flat matrix), 'table' (list view)
  const [viewMode, setViewMode] = useState('zone_layout');

  // Add Location Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('single'); // 'single' or 'bulk'
  const [targetHallForAdd, setTargetHallForAdd] = useState('');
  const [whName, setWhName] = useState('Hall 1');
  const [customWhName, setCustomWhName] = useState('');
  const [rackName, setRackName] = useState('');
  const [capacity, setCapacity] = useState(20);
  const [bulkPrefix, setBulkPrefix] = useState('Rack');
  const [bulkStartNum, setBulkStartNum] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkCapacity, setBulkCapacity] = useState(20);
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceLoc, setTransferSourceLoc] = useState('');
  const [transferMaterial, setTransferMaterial] = useState(null);
  const [transferPkts, setTransferPkts] = useState(1);
  const [transferTargetLoc, setTransferTargetLoc] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState('');

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All'); // 'All', 'Empty', 'Picking', 'Occupied', 'Overfilled'

  const fetchLiveLocations = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [locRes, capRes, matRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/warehouse-locations`).catch(() => null),
        fetch(`${getBackendUrl()}/api/weight-capture?summary=true`).catch(() => null),
        fetch(`${getBackendUrl()}/api/materials`).catch(() => null)
      ]);
      if (locRes && locRes.ok) {
        const lData = await locRes.json();
        const list = Array.isArray(lData) ? lData : (lData.data || []);
        setDbLocations(list);
      }
      if (capRes && capRes.ok) {
        const cData = await capRes.json();
        setCaptures(cData.data || (Array.isArray(cData) ? cData : []));
      }
      if (matRes && matRes.ok) {
        const mData = await matRes.json();
        const mList = Array.isArray(mData) ? mData : (mData.data || []);
        if (mList && mList.length > 0) {
          setDbMaterials(mList);
        }
      }
    } catch (err) {
      console.warn("Could not fetch warehouse locations from DB:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveLocations(true);
    const interval = setInterval(() => fetchLiveLocations(false), 12000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Robust Location Tokenizer & Matcher (Eliminates Rack 1 vs Rack 10 collisions)
   */
  const normalizeLoc = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/\(\d+\s*pkts?\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getLocTokens = (str) => {
    const norm = normalizeLoc(str);
    const hallMatch = norm.match(/(?:hall|warehouse|store)\s*(\d+)?/i);
    const rackMatch = norm.match(/rack\s*(\d+[a-z]?|\w+)/i) || norm.match(/bay\s*(\d+[a-z]?|\w+)/i);

    const hall = hallMatch ? hallMatch[0].replace(/\s+/g, '') : '';
    const rack = rackMatch ? rackMatch[1].trim() : norm.replace(/^(?:hall|warehouse|store)\s*\d*\s*[-–]?\s*/i, '').trim();

    return { hall, rack, full: norm };
  };

  const isLocMatch = (locA, locB) => {
    if (!locA || !locB) return false;
    const tA = getLocTokens(locA);
    const tB = getLocTokens(locB);

    if (tA.full === tB.full) return true;

    if (tA.rack && tB.rack && tA.rack === tB.rack) {
      if (tA.hall && tB.hall) {
        return tA.hall === tB.hall;
      }
      return true;
    }

    return false;
  };

  /**
   * Helper to parse how many packets of a material are stored in a specific location string.
   */
  const getPacketsInLocation = (m, locCode) => {
    const locStr = String(m.location || '').trim();
    const pktsTotal = Math.max(1, Number(m.packets) || 1);
    if (!locStr) return 0;

    const parts = locStr.split(',');
    let count = 0;

    parts.forEach(part => {
      const cleanPart = part.trim();
      const pureLoc = cleanPart.replace(/\(\d+\s*pkts?\)/i, '').trim();

      if (isLocMatch(pureLoc, locCode)) {
        const match = cleanPart.match(/\((\d+)\s*pkt/);
        if (match) {
          count += parseInt(match[1], 10) || 1;
        } else {
          count += pktsTotal;
        }
      }
    });
    return count;
  };

  /**
   * Construct locations array strictly from manually configured / DB entries
   * HIGH-PERFORMANCE PRE-INDEXED RESOLUTION FOR LARGE DATASETS
   */
  const locations = useMemo(() => {
    const slotMap = new Map();
    const activeMaterials = (dbMaterials && dbMaterials.length > 0) ? dbMaterials : materials;

    const normalizeSlotCode = (rawCode) => {
      const trimmed = String(rawCode || '').trim();
      if (!trimmed || trimmed === 'N/A' || trimmed === 'null') return null;
      return trimmed.toUpperCase();
    };

    // 1. Add official locations from warehouse_locations DB table
    dbLocations.forEach(d => {
      const rawCode = String(d.code || d.id || '').trim();
      const codeKey = normalizeSlotCode(rawCode);
      if (!codeKey) return;

      slotMap.set(codeKey, {
        id: d.id,
        code: d.code || codeKey,
        rack: d.code || codeKey,
        warehouse: d.warehouse || 'Main Store',
        capacity: Number(d.capacity) || 20
      });
    });

    // 2. Add configured racks from settings if not already in DB
    (racks || []).forEach(r => {
      const rawCode = String(r.name || r.code || '').trim();
      const fullDisplay = r.code && String(r.code).includes('-') ? r.code : `${r.warehouse || 'Main Store'} - ${r.name || `Rack ${r.code}`}`;
      const codeKey = normalizeSlotCode(fullDisplay);
      if (!codeKey) return;

      if (!slotMap.has(codeKey)) {
        slotMap.set(codeKey, {
          id: r.id,
          code: fullDisplay,
          rack: r.name || `Rack ${r.code || ''}`,
          warehouse: r.warehouse || 'Main Store',
          capacity: Number(r.capacity) || 20
        });
      }
    });

    // 3. Add active storage locations referenced by materials
    (activeMaterials || []).forEach(m => {
      const locStr = String(m.location || '').trim();
      if (!locStr || locStr === 'N/A' || locStr === 'null') return;
      const parts = locStr.split(',');
      parts.forEach(p => {
        const clean = p.replace(/\(\d+\s*pkts?\)/i, '').trim();
        const codeKey = normalizeSlotCode(clean);
        if (!codeKey) return;

        if (!slotMap.has(codeKey)) {
          let wh = 'Main Store';
          const whMatch = clean.match(/(hall\s*\d+|warehouse\s*\w+|store\w*)/i);
          if (whMatch) {
            wh = whMatch[1];
          }
          slotMap.set(codeKey, {
            id: codeKey.toLowerCase().replace(/\s+/g, '-'),
            code: clean,
            rack: clean,
            warehouse: wh,
            capacity: 20
          });
        }
      });
    });

    // ── Pre-Index Materials & Captures in O(N) for Instant Lookup ──
    const materialIndex = new Map();
    (activeMaterials || []).forEach(m => {
      const locStr = String(m.location || '').trim();
      if (!locStr) return;
      const totalPkts = Math.max(1, Number(m.packets) || 1);
      const parts = locStr.split(',');

      parts.forEach(part => {
        const cleanPart = part.trim();
        const pureLoc = cleanPart.replace(/\(\d+\s*pkts?\)/i, '').trim();
        const pktMatch = cleanPart.match(/\((\d+)\s*pkt/);
        const pktsCount = pktMatch ? (parseInt(pktMatch[1], 10) || 1) : totalPkts;

        const norm1 = normalizeSlotCode(pureLoc)?.toLowerCase();
        const norm2 = pureLoc.toLowerCase();
        const cleanTarget = pureLoc.toLowerCase().replace(/^(hall|warehouse)\s*\d*\s*[-–]?\s*/i, '').trim();
        const norm3 = cleanTarget ? `rack ${cleanTarget}` : '';

        [norm1, norm2, cleanTarget, norm3].filter(Boolean).forEach(k => {
          if (!materialIndex.has(k)) materialIndex.set(k, []);
          materialIndex.get(k).push({
            material: m,
            effectivePkts: pktsCount,
            totalPkts
          });
        });
      });
    });

    const captureIndex = new Map();
    (captures || []).forEach(c => {
      const cLoc = String(c.storeLocation || '').trim();
      if (!cLoc) return;
      const norm1 = normalizeSlotCode(cLoc)?.toLowerCase();
      const norm2 = cLoc.toLowerCase();
      const cleanTarget = cLoc.toLowerCase().replace(/^(hall|warehouse)\s*\d*\s*[-–]?\s*/i, '').trim();
      const norm3 = cleanTarget ? `rack ${cleanTarget}` : '';

      [norm1, norm2, cleanTarget, norm3].filter(Boolean).forEach(k => {
        if (!captureIndex.has(k)) captureIndex.set(k, []);
        captureIndex.get(k).push(c);
      });
    });

    // O(1) Fast Resolution Per Slot
    const result = [];
    slotMap.forEach((slot, codeKey) => {
      const code = slot.code || codeKey;
      const capacity = slot.capacity || 20;
      const cleanSlot = String(code).toLowerCase().trim();
      const normSlotKey = normalizeSlotCode(code)?.toLowerCase();
      const cleanTarget = cleanSlot.replace(/^(hall|warehouse)\s*\d*\s*[-–]?\s*/i, '').trim();

      const seenMatIds = new Set();
      const matchedMaterialsEntries = [];
      [cleanSlot, normSlotKey, cleanTarget, cleanTarget ? `rack ${cleanTarget}` : ''].filter(Boolean).forEach(k => {
        const list = materialIndex.get(k) || [];
        list.forEach(item => {
          if (!seenMatIds.has(item.material.id)) {
            seenMatIds.add(item.material.id);
            matchedMaterialsEntries.push(item);
          }
        });
      });

      const seenCapIds = new Set();
      const matchedCaptures = [];
      [cleanSlot, normSlotKey, cleanTarget, cleanTarget ? `rack ${cleanTarget}` : ''].filter(Boolean).forEach(k => {
        const list = captureIndex.get(k) || [];
        list.forEach(c => {
          const capId = c.id || c.barcodeId || (c.materialCode + c.capturedAt);
          if (!seenCapIds.has(capId)) {
            seenCapIds.add(capId);
            matchedCaptures.push(c);
          }
        });
      });

      let currentPackets = 0;
      let totalQty = 0;
      let totalWeightKg = 0;
      let unit = 'Pcs';
      let materialDetailsList = [];
      let poNumbers = [];
      let lotNumbers = [];
      let storeIncharges = [];
      let lastUpdated = '';

      matchedMaterialsEntries.forEach(({ material: m, effectivePkts, totalPkts }) => {
        currentPackets += effectivePkts;
        totalQty += Math.round((Number(m.stock) / totalPkts) * effectivePkts);
        unit = m.unit || 'Pcs';
        const matLabel = m.color && m.color !== 'Default' ? `${m.name} (${m.color})` : m.name;
        materialDetailsList.push({
          id: m.id,
          name: matLabel,
          rawName: m.name,
          color: m.color,
          packets: effectivePkts,
          stock: m.stock,
          unit: m.unit || 'Pcs',
          poNumber: m.poNumber,
          fullMaterial: m
        });
        if (m.poNumber && m.poNumber !== 'N/A') poNumbers.push(m.poNumber);
        lotNumbers.push(`Lot #${m.id}`);
      });

      matchedCaptures.forEach(c => {
        totalWeightKg += Number(c.netWeightKg) || 0;
        if (c.storeIncharge && !storeIncharges.includes(c.storeIncharge)) {
          storeIncharges.push(c.storeIncharge);
        }
        if (c.capturedAt) {
          lastUpdated = new Date(c.capturedAt).toLocaleString('en-GB');
        }
      });

      let status = 'Empty';
      if (currentPackets >= capacity && capacity > 0) {
        status = 'Occupied';
      } else if (currentPackets > 0) {
        status = 'Picking';
      } else {
        status = 'Empty';
      }

      // Format short rack name (e.g. from "Hall 1 - Rack 10" extract "Rack 10")
      let shortRack = slot.rack;
      if (shortRack.includes(' - ')) {
        shortRack = shortRack.split(' - ').slice(1).join(' - ');
      }

      result.push({
        id: slot.id || codeKey,
        code,
        rack: shortRack || code,
        warehouse: slot.warehouse || 'Main Store',
        capacity,
        currentPackets,
        status,
        qty: totalQty,
        unit,
        materialName: materialDetailsList.map(m => m.name).join(', ') || 'Empty Slot',
        materialDetailsList,
        matchedMaterials: matchedMaterialsEntries.map(e => e.material),
        poNumber: poNumbers[0] || (matchedMaterialsEntries[0] ? `PO-${matchedMaterialsEntries[0].material.id}` : 'N/A'),
        lotNumber: lotNumbers[0] || 'N/A',
        weight: totalWeightKg > 0 ? `${totalWeightKg.toFixed(1)} kg` : (totalQty > 0 ? `${Math.round(totalQty * 0.05)} kg` : '0 kg'),
        storeIncharge: storeIncharges[0] || 'Store Team',
        lastUpdated: lastUpdated || 'Active'
      });
    });

    return result.sort((a, b) =>
      (a.warehouse || '').localeCompare(b.warehouse || '') ||
      (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
    );
  }, [racks, dbLocations, dbMaterials, materials, captures]);

  // Extract unique warehouses
  const warehouses = useMemo(() => {
    const list = [...new Set(locations.map(r => r.warehouse).filter(Boolean))];
    if (list.length === 0) return ['All', 'Hall 1', 'Main Store'];
    return ['All', ...list];
  }, [locations]);

  // Stats Card Calculations
  const stats = useMemo(() => {
    const total = locations.length;
    const occupied = locations.filter(loc => loc.status === 'Occupied').length;
    const empty = locations.filter(loc => loc.status === 'Empty').length;
    const picking = locations.filter(loc => loc.status === 'Picking').length;
    const totalPackets = locations.reduce((sum, l) => sum + l.currentPackets, 0);
    const totalCapacity = locations.reduce((sum, l) => sum + l.capacity, 0);
    const totalPieces = locations.reduce((sum, l) => sum + l.qty, 0);
    const overallPct = totalCapacity > 0 ? Math.round((totalPackets / totalCapacity) * 100) : 0;

    return {
      total,
      occupied,
      empty,
      picking,
      totalPackets,
      totalCapacity,
      totalPieces,
      overallPct
    };
  }, [locations]);

  const handleCardClick = (loc) => {
    setSelectedLocation(loc);
    setIsDrawerOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedWarehouse('All');
    setSelectedStatus('All');
  };

  // Open Add modal prefilled for a specific hall
  const handleOpenAddModal = (presetHall = '') => {
    setAddError('');
    if (presetHall && presetHall !== 'All') {
      setWhName(presetHall);
    } else if (warehouses.length > 1 && warehouses[1] !== 'All') {
      setWhName(warehouses[1]);
    } else {
      setWhName('Hall 1');
    }
    setCustomWhName('');
    setRackName('');
    setCapacity(20);
    setAddMode('single');
    setIsAddModalOpen(true);
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (location = null, specificMaterial = null) => {
    setTransferError('');
    setTransferSuccess('');

    let srcCode = location ? location.code : '';
    let targetLocObj = location;

    if (!srcCode) {
      const firstWithMats = locations.find(l => l.materialDetailsList && l.materialDetailsList.length > 0);
      srcCode = firstWithMats ? firstWithMats.code : (locations[0]?.code || '');
      targetLocObj = firstWithMats || locations[0] || null;
    }

    setTransferSourceLoc(srcCode);

    if (specificMaterial) {
      setTransferMaterial(specificMaterial);
      setTransferPkts(Math.min(specificMaterial.packets || 1, 1));
    } else if (targetLocObj && targetLocObj.materialDetailsList && targetLocObj.materialDetailsList.length > 0) {
      setTransferMaterial(targetLocObj.materialDetailsList[0]);
      setTransferPkts(Math.min(targetLocObj.materialDetailsList[0].packets || 1, 1));
    } else {
      setTransferMaterial(null);
      setTransferPkts(1);
    }

    // Pick first different location as default target
    const otherLoc = locations.find(l => l.code !== srcCode);
    setTransferTargetLoc(otherLoc ? otherLoc.code : '');
    setIsTransferModalOpen(true);
  };

  // Handle Changing Source Location inside Transfer Modal
  const handleTransferSourceChange = (newSourceCode) => {
    setTransferSourceLoc(newSourceCode);
    setTransferError('');
    const locObj = locations.find(l => l.code === newSourceCode);
    if (locObj && locObj.materialDetailsList && locObj.materialDetailsList.length > 0) {
      setTransferMaterial(locObj.materialDetailsList[0]);
      setTransferPkts(Math.min(locObj.materialDetailsList[0].packets || 1, 1));
    } else {
      setTransferMaterial(null);
      setTransferPkts(1);
    }
    if (transferTargetLoc === newSourceCode) {
      const other = locations.find(l => l.code !== newSourceCode);
      setTransferTargetLoc(other ? other.code : '');
    }
  };

  // Robust Quick Transfer Submission
  const handleQuickTransferSubmit = async (e) => {
    e.preventDefault();
    setTransferError('');
    setTransferSuccess('');

    if (!transferSourceLoc) {
      setTransferError('Please select a source warehouse location.');
      return;
    }
    if (!transferTargetLoc) {
      setTransferError('Please select a destination warehouse rack.');
      return;
    }
    if (transferTargetLoc.toLowerCase().trim() === transferSourceLoc.toLowerCase().trim()) {
      setTransferError('Destination rack must be different from source rack.');
      return;
    }
    const qtyToMove = parseInt(transferPkts, 10) || 1;
    if (qtyToMove <= 0) {
      setTransferError('Please enter a valid packet count.');
      return;
    }

    // Resolve target material object from live materials
    const allMats = (dbMaterials && dbMaterials.length > 0) ? dbMaterials : materials;
    const targetMatId = transferMaterial ? (transferMaterial.id || transferMaterial.materialCode) : null;
    let matObj = allMats.find(m => String(m.id).toLowerCase() === String(targetMatId).toLowerCase()) || (transferMaterial && transferMaterial.fullMaterial);

    if (!matObj && transferMaterial?.name) {
      matObj = allMats.find(m => m.name.toLowerCase() === transferMaterial.name.toLowerCase());
    }

    if (!matObj) {
      setTransferError('Selected material could not be resolved from database.');
      return;
    }

    try {
      setIsTransferSubmitting(true);
      setTransferError('');

      const currentLocStr = String(matObj.location || '').trim();
      const totalPkts = Math.max(1, Number(matObj.packets) || 1);

      // 1. Parse current allocations into normalized groups
      const parts = currentLocStr ? currentLocStr.split(',') : [transferSourceLoc];
      let groups = [];

      parts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const match = trimmed.match(/^(.+?)\s*\(\s*(\d+)\s*pkts?\s*\)$/i);
        if (match) {
          groups.push({
            location: match[1].trim(),
            count: parseInt(match[2], 10) || 1
          });
        } else {
          groups.push({
            location: trimmed,
            count: totalPkts
          });
        }
      });

      if (groups.length === 0) {
        groups.push({ location: transferSourceLoc, count: totalPkts });
      }

      // 2. Deduct from source group
      let remainingToMove = qtyToMove;
      let sourceIndex = groups.findIndex(g => isLocMatch(g.location, transferSourceLoc));

      if (sourceIndex === -1 && groups.length > 0) {
        sourceIndex = 0;
      }

      if (sourceIndex !== -1) {
        const availableAtSource = groups[sourceIndex].count;
        const deduct = Math.min(availableAtSource, remainingToMove);
        groups[sourceIndex].count -= deduct;
        remainingToMove -= deduct;
      }

      // Filter out 0 count groups
      groups = groups.filter(g => g.count > 0);

      // 3. Add to destination group
      const destIndex = groups.findIndex(g => isLocMatch(g.location, transferTargetLoc));
      if (destIndex !== -1) {
        groups[destIndex].count += qtyToMove;
      } else {
        groups.push({ location: transferTargetLoc.trim(), count: qtyToMove });
      }

      // 4. Serialize back
      let newLocationSummary = 'Main Store';
      if (groups.length === 1 && groups[0].count === 1) {
        newLocationSummary = groups[0].location;
      } else if (groups.length > 0) {
        newLocationSummary = groups.map(g => `${g.location} (${g.count} Pkts)`).join(', ');
      }

      // 5. Send PUT request to update material's location in backend
      const updatedMaterial = {
        ...matObj,
        location: newLocationSummary
      };

      const putRes = await fetch(`${getBackendUrl()}/api/materials/${matObj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterial)
      });

      if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update material location on server');
      }

      // 6. Post transfer log to API
      await fetch(`${getBackendUrl()}/api/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialCode: matObj.id,
          materialName: matObj.name,
          fromLocation: transferSourceLoc,
          toLocation: transferTargetLoc.trim(),
          quantity: qtyToMove,
          transferType: 'packet',
          operator: currentUser?.name || 'Warehouse Store Team'
        })
      }).catch(err => console.warn('Transfer log error:', err));

      // 7. Update local state immediately & refetch live data
      setDbMaterials(prev => {
        return (prev || []).map(m => String(m.id) === String(matObj.id) ? updatedMaterial : m);
      });

      setTransferSuccess(`Successfully transferred ${qtyToMove} Pkt(s) of "${matObj.name}" to ${transferTargetLoc}!`);

      await fetchLiveLocations();

      setTimeout(() => {
        setIsTransferModalOpen(false);
        setIsDrawerOpen(false);
        setSelectedLocation(null);
        setTransferSuccess('');
      }, 1200);

    } catch (err) {
      console.error('Transfer execution error:', err);
      setTransferError(err.message || 'Transfer failed. Please check network connection.');
    } finally {
      setIsTransferSubmitting(false);
    }
  };

  // Add Single / Bulk Location Submit Handler
  const handleAddLocationSubmit = async (e) => {
    e.preventDefault();
    const targetWh = whName === '__CUSTOM__' ? customWhName.trim() : whName.trim();
    const finalWh = targetWh || 'Hall 1';

    if (addMode === 'bulk') {
      const count = Math.min(50, Math.max(1, parseInt(bulkCount, 10) || 10));
      const startNum = Math.max(1, parseInt(bulkStartNum, 10) || 1);
      const cap = Math.max(1, parseInt(bulkCapacity, 10) || 20);
      const prefix = (bulkPrefix || 'Rack').trim();

      const bulkPayload = [];
      for (let i = 0; i < count; i++) {
        const num = startNum + i;
        const rName = `${prefix} ${num}`;
        const fullCode = `${finalWh} - ${rName}`;
        bulkPayload.push({
          warehouse: finalWh,
          name: rName,
          code: fullCode,
          capacity: cap
        });
      }

      try {
        setIsSubmitting(true);
        setAddError('');
        const res = await fetch(`${getBackendUrl()}/api/warehouse-locations/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations: bulkPayload })
        });

        if (res.ok) {
          await fetchLiveLocations();
          setIsAddModalOpen(false);
        } else {
          const errData = await res.json();
          setAddError(errData.error || 'Failed to bulk save warehouse locations');
        }
      } catch (err) {
        setAddError('Server connection error: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cleanRack = rackName.trim();
    if (!cleanRack) {
      setAddError('Please enter a Rack / Shelf / Bin name (e.g. "Rack 1", "Section A").');
      return;
    }

    const capNum = parseInt(capacity, 10) > 0 ? parseInt(capacity, 10) : 20;
    const fullCode = cleanRack.toLowerCase().includes(finalWh.toLowerCase())
      ? cleanRack
      : `${finalWh} - ${cleanRack}`;

    if (locations.some(l => l.code.toLowerCase() === fullCode.toLowerCase())) {
      setAddError(`Location "${fullCode}" already exists in the warehouse layout!`);
      return;
    }

    try {
      setIsSubmitting(true);
      setAddError('');
      const res = await fetch(`${getBackendUrl()}/api/warehouse-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse: finalWh,
          code: fullCode,
          capacity: capNum
        })
      });

      if (res.ok) {
        await fetchLiveLocations();
        setIsAddModalOpen(false);
        setRackName('');
        setCustomWhName('');
      } else {
        const errData = await res.json();
        setAddError(errData.error || 'Failed to save warehouse location');
      }
    } catch (err) {
      setAddError('Server connection error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async (loc) => {
    if (!loc) return;
    if (window.confirm(`Are you sure you want to remove ${loc.code} from the warehouse layout?`)) {
      try {
        const res = await fetch(`${getBackendUrl()}/api/warehouse-locations/${encodeURIComponent(loc.id || loc.code)}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setIsDrawerOpen(false);
          setSelectedLocation(null);
          await fetchLiveLocations();
        } else {
          alert('Could not delete location.');
        }
      } catch (e) {
        alert('Error removing location: ' + e.message);
      }
    }
  };

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesSearch = loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.materialName && loc.materialName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        loc.warehouse.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWarehouse = selectedWarehouse === 'All' || loc.warehouse === selectedWarehouse;
      const matchesStatus = selectedStatus === 'All' ||
        (selectedStatus === 'Occupied' && loc.status === 'Occupied') ||
        (selectedStatus === 'Picking' && loc.status === 'Picking') ||
        (selectedStatus === 'Empty' && loc.status === 'Empty');

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [locations, searchQuery, selectedWarehouse, selectedStatus]);

  // Group filtered locations by Warehouse / Hall
  const groupedByWarehouse = useMemo(() => {
    const groups = {};
    filteredLocations.forEach(loc => {
      const wh = loc.warehouse || 'Main Store';
      if (!groups[wh]) groups[wh] = [];
      groups[wh].push(loc);
    });
    return groups;
  }, [filteredLocations]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Empty': return '#10B981'; // Emerald Green
      case 'Occupied': return '#6366F1'; // Indigo
      case 'Picking': return '#8B5CF6'; // Violet / Purple
      case 'Reserved': return '#F59E0B'; // Amber
      default: return '#64748B';
    }
  };

  const getStatusBadge = (status, currentPackets, capacity) => {
    const pct = capacity > 0 ? Math.round((currentPackets / capacity) * 100) : 0;
    switch (status) {
      case 'Empty':
        return {
          label: 'Free (0%)',
          bg: '#ecfdf5',
          color: '#059669',
          border: '#a7f3d0',
          dot: '#10b981',
          accentGradient: 'linear-gradient(135deg, #10b981, #059669)'
        };
      case 'Occupied':
        return {
          label: `Full (${pct}%)`,
          bg: '#eef2ff',
          color: '#4338ca',
          border: '#c7d2fe',
          dot: '#6366f1',
          accentGradient: 'linear-gradient(135deg, #6366f1, #4f46e5)'
        };
      case 'Picking':
        return {
          label: `In Use (${pct}%)`,
          bg: '#f5f3ff',
          color: '#7c3aed',
          border: '#ddd6fe',
          dot: '#8b5cf6',
          accentGradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
        };
      default:
        return {
          label: status,
          bg: '#f1f5f9',
          color: '#475569',
          border: '#cbd5e1',
          dot: '#64748b',
          accentGradient: 'linear-gradient(135deg, #64748b, #475569)'
        };
    }
  };

  const availableHallsList = useMemo(() => {
    const existing = [...new Set([...(halls || []), ...warehouses.filter(w => w !== 'All')])];
    return existing.length > 0 ? existing : ['Hall 1', 'Hall 2', 'Hall 3', 'Main Store', 'Warehouse A'];
  }, [halls, warehouses]);

  return (
    <div className="animate-fade" style={{ paddingBottom: '80px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>

      {/* ── Top Header & Hero Command Bar ───────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
        borderRadius: '20px',
        padding: '24px 28px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.35)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Subtle decorative glow orb */}
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-40px',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                backgroundColor: 'rgba(99, 102, 241, 0.25)',
                color: '#a5b4fc',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid rgba(165, 180, 252, 0.3)'
              }}>
                <Warehouse size={13} />
                Live WMS Floor Matrix
              </span>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>
                • {warehouses.filter(w => w !== 'All').length} Active Halls & Zones
              </span>
            </div>

            <h2 style={{
              fontSize: '26px',
              fontWeight: '800',
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              Warehouse Storage & Rack Matrix
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '560px' }}>
              Visual multi-hall rack layout, storage allocation, and real-time inventory tracking.
            </p>
          </div>

          {/* Quick Hero Actions & Stock Summary */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              padding: '9px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              <Box size={18} color="#a5b4fc" />
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.5px' }}>Total Active Stock</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                  {stats.totalPackets} <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600' }}>Pkts</span> <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>({stats.totalPieces.toLocaleString()} Pcs)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleOpenTransferModal()}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '10px 16px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              title="Quickly transfer material between racks"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              }}
            >
              <ArrowLeftRight size={15} />
              Stock Transfer
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              style={{
                backgroundColor: '#4f46e5',
                backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.55)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.4)';
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Warehouse Rack
            </button>

            <button
              onClick={() => fetchLiveLocations(true)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Refresh warehouse data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Metric Snapshot KPI Cards ───────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total Racks */}
        <div
          onClick={() => setSelectedStatus('All')}
          className="panel"
          style={{
            padding: '18px 20px',
            margin: 0,
            cursor: 'pointer',
            border: selectedStatus === 'All' ? '2px solid #6366f1' : '1.5px solid var(--border-color)',
            background: selectedStatus === 'All' ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-secondary)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Configured Racks
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                {stats.total}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#e0e7ff', color: '#4f46e5', borderRadius: '12px' }}>
              <Database size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Capacity: <strong>{stats.totalCapacity} Pkts</strong></span>
            <span>•</span>
            <span><strong>{stats.totalPieces.toLocaleString()} Pcs</strong></span>
          </div>
        </div>

        {/* Available / Free */}
        <div
          onClick={() => setSelectedStatus('Empty')}
          className="panel"
          style={{
            padding: '18px 20px',
            margin: 0,
            cursor: 'pointer',
            border: selectedStatus === 'Empty' ? '2px solid #10b981' : '1.5px solid var(--border-color)',
            background: selectedStatus === 'Empty' ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-secondary)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Free Slots
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                {stats.empty}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#ecfdf5', color: '#10b981', borderRadius: '12px' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            Ready for incoming stock
          </div>
        </div>

        {/* In Use / Picking */}
        <div
          onClick={() => setSelectedStatus('Picking')}
          className="panel"
          style={{
            padding: '18px 20px',
            margin: 0,
            cursor: 'pointer',
            border: selectedStatus === 'Picking' ? '2px solid #8b5cf6' : '1.5px solid var(--border-color)',
            background: selectedStatus === 'Picking' ? 'rgba(139, 92, 246, 0.04)' : 'var(--bg-secondary)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                In-Use / Partial
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#8b5cf6', marginTop: '4px' }}>
                {stats.picking}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f5f3ff', color: '#8b5cf6', borderRadius: '12px' }}>
              <Package size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></span>
            Active storage bays
          </div>
        </div>

        {/* Full Occupied */}
        <div
          onClick={() => setSelectedStatus('Occupied')}
          className="panel"
          style={{
            padding: '18px 20px',
            margin: 0,
            cursor: 'pointer',
            border: selectedStatus === 'Occupied' ? '2px solid #6366f1' : '1.5px solid var(--border-color)',
            background: selectedStatus === 'Occupied' ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-secondary)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fully Occupied
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#4f46e5', marginTop: '4px' }}>
                {stats.occupied}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#e0e7ff', color: '#4f46e5', borderRadius: '12px' }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#6366f1', marginTop: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
            Occupied storage slots
          </div>
        </div>
      </div>

      {/* ── Filters & View Switcher Bar ─────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: '24px', padding: '14px 20px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search location code, rack, material..."
                className="form-input"
                style={{ paddingLeft: '38px', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Warehouse Filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ height: '40px', paddingRight: '34px', fontSize: '13px', minWidth: '170px', cursor: 'pointer', borderRadius: '10px', fontWeight: '600' }}
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w} value={w}>{w === 'All' ? '🏢 All Warehouses & Halls' : `🏢 ${w}`}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {/* Status Filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ height: '40px', paddingRight: '34px', fontSize: '13px', minWidth: '160px', cursor: 'pointer', borderRadius: '10px', fontWeight: '600' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses ({stats.total})</option>
                <option value="Empty">🟢 Free Available ({stats.empty})</option>
                <option value="Picking">🟣 In-Use / Picking ({stats.picking})</option>
                <option value="Occupied">🔵 Fully Occupied ({stats.occupied})</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {(searchQuery || selectedWarehouse !== 'All' || selectedStatus !== 'All') && (
              <button
                onClick={handleResetFilters}
                className="btn btn-secondary"
                style={{ height: '40px', padding: '0 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', fontWeight: '600' }}
              >
                <RefreshCw size={13} />
                Reset
              </button>
            )}
          </div>

          {/* View Mode Toggle Buttons */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: '12px',
            border: '1.5px solid var(--border-color)',
            gap: '4px'
          }}>
            <button
              onClick={() => setViewMode('zone_layout')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: viewMode === 'zone_layout' ? '#4f46e5' : 'transparent',
                color: viewMode === 'zone_layout' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: viewMode === 'zone_layout' ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Warehouse size={14} />
              Hall Zones
            </button>

            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: viewMode === 'grid' ? '#4f46e5' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={14} />
              Matrix Grid
            </button>

            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: viewMode === 'table' ? '#4f46e5' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: viewMode === 'table' ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <List size={14} />
              Table View
            </button>
          </div>

        </div>
      </div>

      {/* ── Main Layout Visualization Content ────────────────────────────── */}
      {filteredLocations.length > 0 ? (
        <>
          {/* VIEW 1: Hall Sections View (Grouped by Hall with Visual Header & 3D Rack Cards) */}
          {viewMode === 'zone_layout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {Object.entries(groupedByWarehouse).map(([whNameKey, whLocations]) => {
                const totalWhCapacity = whLocations.reduce((s, l) => s + l.capacity, 0);
                const totalWhPackets = whLocations.reduce((s, l) => s + l.currentPackets, 0);
                const totalWhPieces = whLocations.reduce((s, l) => s + l.qty, 0);
                const whUtilPct = totalWhCapacity > 0 ? Math.round((totalWhPackets / totalWhCapacity) * 100) : 0;
                const isHallOverloaded = whUtilPct > 100;
                const overfillCount = Math.max(0, totalWhPackets - totalWhCapacity);

                return (
                  <div
                    key={whNameKey}
                    className="panel"
                    style={{
                      borderRadius: '20px',
                      padding: '24px 26px',
                      border: isHallOverloaded ? '1.5px solid rgba(225, 29, 72, 0.35)' : '1.5px solid var(--border-color)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
                      background: 'var(--bg-secondary)',
                      position: 'relative'
                    }}
                  >
                    {/* Hall Section Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px',
                      paddingBottom: '20px',
                      borderBottom: '1px solid var(--border-color)',
                      marginBottom: '22px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '14px',
                          background: isHallOverloaded
                            ? 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)'
                            : 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
                          color: isHallOverloaded ? '#e11d48' : '#4f46e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                        }}>
                          <Warehouse size={24} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                              {whNameKey}
                            </h3>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: '#4f46e5',
                              border: '1px solid rgba(99, 102, 241, 0.2)'
                            }}>
                              {whLocations.length} Racks
                            </span>
                            {isHallOverloaded && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                backgroundColor: '#fff1f2',
                                color: '#e11d48',
                                border: '1px solid #fecdd3',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <AlertTriangle size={12} />
                                Over capacity (+{overfillCount} Pkts)
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Storage Load: <strong>{totalWhPackets} / {totalWhCapacity} Packets</strong> ({whUtilPct}%)</span>
                            <span>•</span>
                            <span><strong>{totalWhPieces.toLocaleString()}</strong> Total Pieces</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Hall Actions & Load Gauge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        {/* Smooth Progress Bar for Hall */}
                        <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                            <span>Total Load</span>
                            <span style={{ color: isHallOverloaded ? '#e11d48' : whUtilPct > 80 ? '#f59e0b' : '#10b981', fontWeight: '800' }}>
                              {whUtilPct}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, whUtilPct)}%`,
                              height: '100%',
                              background: isHallOverloaded
                                ? 'linear-gradient(90deg, #f43f5e, #be123c)'
                                : whUtilPct > 80
                                  ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                  : 'linear-gradient(90deg, #10b981, #059669)',
                              borderRadius: '4px',
                              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenAddModal(whNameKey)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: '1.5px solid #4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.06)',
                            color: '#4f46e5',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#4f46e5';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.06)';
                            e.currentTarget.style.color = '#4f46e5';
                          }}
                        >
                          <Plus size={15} />
                          Add Rack to {whNameKey}
                        </button>
                      </div>
                    </div>

                    {/* Cards Grid for this Hall */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '18px'
                    }}>
                      {whLocations.map((loc) => {
                        const badge = getStatusBadge(loc.status, loc.currentPackets, loc.capacity);
                        const utilPct = loc.capacity > 0 ? Math.round((loc.currentPackets / loc.capacity) * 100) : 0;

                        return (
                          <motion.div
                            key={loc.code}
                            whileHover={{ y: -4, boxShadow: '0 16px 30px -6px rgba(0, 0, 0, 0.12)' }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            onClick={() => handleCardClick(loc)}
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              border: loc.status === 'Picking'
                                ? '1.5px solid rgba(139, 92, 246, 0.35)'
                                : '1.5px solid var(--border-color)',
                              borderRadius: '16px',
                              padding: '18px',
                              cursor: 'pointer',
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                              transition: 'all 0.2s ease',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Top Accent Strip */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '4px',
                              background: badge.accentGradient
                            }} />

                            {/* Card Top Row: Title & Status Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '10px',
                                  backgroundColor: loc.status === 'Empty' ? '#ecfdf5' : '#f5f3ff',
                                  color: loc.status === 'Empty' ? '#10b981' : '#7c3aed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '800'
                                }}>
                                  <Grid size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                                    {loc.rack}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                    {loc.code}
                                  </div>
                                </div>
                              </div>

                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '3px 9px',
                                borderRadius: '20px',
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: badge.dot
                                }} />
                                {badge.label}
                              </span>
                            </div>

                            {/* Visual Multi-Shelf Level Preview (Simulated 4-Tier Rack Shelf) */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '4px',
                              padding: '6px',
                              backgroundColor: 'rgba(0, 0, 0, 0.03)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)'
                            }} title={`Visual Rack Bay Slots (Stored ${loc.currentPackets} of ${loc.capacity} Pkts)`}>
                              {[0, 1, 2, 3].map((slotIdx) => {
                                const slotCapacityQuarter = loc.capacity / 4;
                                const filledInSlot = Math.min(slotCapacityQuarter, Math.max(0, loc.currentPackets - (slotIdx * slotCapacityQuarter)));
                                const slotFillRatio = slotCapacityQuarter > 0 ? (filledInSlot / slotCapacityQuarter) : 0;

                                return (
                                  <div
                                    key={slotIdx}
                                    style={{
                                      height: '8px',
                                      borderRadius: '4px',
                                      backgroundColor: slotFillRatio > 0
                                        ? (loc.status === 'Picking' ? '#8b5cf6' : '#6366f1')
                                        : '#e2e8f0',
                                      opacity: slotFillRatio > 0 ? (0.6 + (slotFillRatio * 0.4)) : 0.4,
                                      transition: 'all 0.3s ease'
                                    }}
                                  />
                                );
                              })}
                            </div>

                            {/* Stored Content Preview Section */}
                            <div style={{
                              backgroundColor: 'var(--bg-primary)',
                              padding: '12px 14px',
                              borderRadius: '12px',
                              minHeight: '54px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              border: '1px solid var(--border-color)'
                            }}>
                              {loc.status !== 'Empty' ? (
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Box size={16} style={{ color: '#4f46e5' }} />
                                    <span>{loc.qty.toLocaleString()} {loc.unit}</span>
                                    {loc.weight && loc.weight !== '0 kg' && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginLeft: 'auto' }}>
                                        ⚖️ {loc.weight}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    marginTop: '4px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontWeight: '500'
                                  }}>
                                    {loc.materialName}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <CheckCircle size={15} />
                                  <span>Slot Free • Ready for Putaway</span>
                                </div>
                              )}
                            </div>

                            {/* Bottom Utilization Progress Bar */}
                            <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '700' }}>
                                <span>Utilization</span>
                                <span>
                                  <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{loc.currentPackets}</strong>
                                  <span style={{ color: 'var(--text-muted)' }}> / {loc.capacity} Pkts</span>
                                </span>
                              </div>
                              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.min(100, utilPct)}%`,
                                  height: '100%',
                                  background: badge.accentGradient,
                                  borderRadius: '4px',
                                  transition: 'width 0.4s ease'
                                }} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 2: Flat Compact Grid Matrix View */}
          {viewMode === 'grid' && (
            <div className="panel" style={{ borderRadius: '20px', padding: '24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '16px'
              }}>
                {filteredLocations.map((loc) => {
                  const badge = getStatusBadge(loc.status, loc.currentPackets, loc.capacity);
                  const utilPct = loc.capacity > 0 ? Math.round((loc.currentPackets / loc.capacity) * 100) : 0;

                  return (
                    <motion.div
                      key={loc.code}
                      whileHover={{ scale: 1.02, boxShadow: '0 10px 24px -4px rgba(0, 0, 0, 0.1)' }}
                      onClick={() => handleCardClick(loc)}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '14px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: badge.accentGradient
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {loc.warehouse}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                            {loc.rack}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '12px',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.label}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', minHeight: '20px' }}>
                        {loc.status !== 'Empty' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: '700' }}>
                            <Box size={14} color="#4f46e5" />
                            <span>{loc.qty.toLocaleString()} {loc.unit}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#10b981' }}>Free Slot</span>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700' }}>
                          <span>{loc.currentPackets} / {loc.capacity} Pkts</span>
                          <span style={{ color: badge.color }}>{utilPct}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, utilPct)}%`, height: '100%', background: badge.accentGradient, borderRadius: '3px' }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 3: Table List View */}
          {viewMode === 'table' && (
            <div className="panel" style={{ borderRadius: '20px', padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '16px 22px' }}>Location Code</th>
                      <th style={{ padding: '16px 18px' }}>Warehouse / Hall</th>
                      <th style={{ padding: '16px 18px' }}>Status</th>
                      <th style={{ padding: '16px 18px' }}>Stored Material</th>
                      <th style={{ padding: '16px 18px' }}>Quantity</th>
                      <th style={{ padding: '16px 18px' }}>Packet Capacity</th>
                      <th style={{ padding: '16px 22px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocations.map((loc) => {
                      const badge = getStatusBadge(loc.status, loc.currentPackets, loc.capacity);
                      return (
                        <tr
                          key={loc.code}
                          onClick={() => handleCardClick(loc)}
                          style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '15px 22px', fontWeight: '800', color: 'var(--text-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Grid size={15} color="#4f46e5" />
                              <span>{loc.code}</span>
                            </div>
                          </td>
                          <td style={{ padding: '15px 18px', color: 'var(--text-muted)', fontWeight: '600' }}>
                            {loc.warehouse}
                          </td>
                          <td style={{ padding: '15px 18px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`
                            }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '15px 18px', color: 'var(--text-main)', fontWeight: '500', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {loc.materialName}
                          </td>
                          <td style={{ padding: '15px 18px', fontWeight: '800', color: 'var(--text-main)' }}>
                            {loc.qty > 0 ? `${loc.qty.toLocaleString()} ${loc.unit}` : '-'}
                          </td>
                          <td style={{ padding: '15px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span><strong>{loc.currentPackets}</strong> / {loc.capacity} Pkts</span>
                              <div style={{ width: '70px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.min(100, Math.round((loc.currentPackets / loc.capacity) * 100))}%`,
                                  height: '100%',
                                  background: badge.accentGradient
                                }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '15px 22px', textAlign: 'right' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardClick(loc);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '8px' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '70px 20px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '20px',
          border: '2px dashed var(--border-color)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <Warehouse size={40} />
          </div>
          <h4 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
            {locations.length === 0 ? 'No Warehouse Locations Added' : 'No Locations Found Matching Filter'}
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 0 24px 0', lineHeight: 1.6 }}>
            {locations.length === 0
              ? 'Organize your physical inventory across halls and aisles. Add single racks or use the bulk rack generator.'
              : 'Try clearing your search query or reset filters to see all available storage slots.'}
          </p>
          {locations.length === 0 ? (
            <button
              onClick={() => handleOpenAddModal()}
              style={{
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                padding: '12px 26px',
                fontSize: '14px',
                fontWeight: '700',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
              }}
            >
              <Plus size={18} />
              Add Your First Warehouse Location
            </button>
          ) : (
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ padding: '10px 24px', fontSize: '13px', borderRadius: '10px', fontWeight: '700' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── Add Location Modal (Single / Bulk Generator) ──────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div
            className="modal-overlay"
            style={{
              zIndex: 20000,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="modal-content"
              style={{
                maxWidth: '540px',
                borderRadius: '20px',
                padding: '28px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                boxShadow: '0 25px 60px -10px rgba(0,0,0,0.5)',
                border: '1px solid #e2e8f0',
                position: 'relative',
                zIndex: 20001
              }}
            >
              {/* Modal Header */}
              <div className="modal-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', margin: 0 }}>
                    <Plus size={22} color="#4f46e5" />
                    Configure Warehouse Locations
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    Add single rack or bulk generate storage bays across halls.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Add Mode Selector (Single vs Bulk) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginTop: '16px',
                padding: '4px',
                backgroundColor: '#f1f5f9',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <button
                  type="button"
                  onClick={() => setAddMode('single')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    backgroundColor: addMode === 'single' ? '#ffffff' : 'transparent',
                    color: addMode === 'single' ? '#4f46e5' : '#64748b',
                    boxShadow: addMode === 'single' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Single Location
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('bulk')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    backgroundColor: addMode === 'bulk' ? '#ffffff' : 'transparent',
                    color: addMode === 'bulk' ? '#4f46e5' : '#64748b',
                    boxShadow: addMode === 'bulk' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ⚡ Bulk Bay Generator
                </button>
              </div>

              <form onSubmit={handleAddLocationSubmit} style={{ marginTop: '18px' }}>
                {addError && (
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    borderRadius: '10px',
                    fontSize: '13px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={16} />
                    <span>{addError}</span>
                  </div>
                )}

                {/* Warehouse / Hall Selection */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#0f172a' }}>
                    <span>Target Warehouse / Hall *</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Location grouping</span>
                  </label>

                  {/* Preset Quick Chips */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {availableHallsList.map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setWhName(h)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          border: whName === h ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                          backgroundColor: whName === h ? 'rgba(79, 70, 229, 0.1)' : '#f8fafc',
                          color: whName === h ? '#4f46e5' : '#334155',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {h}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setWhName('__CUSTOM__')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        border: whName === '__CUSTOM__' ? '1.5px solid #4f46e5' : '1px dashed #cbd5e1',
                        backgroundColor: whName === '__CUSTOM__' ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                        color: whName === '__CUSTOM__' ? '#4f46e5' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      + Custom Hall
                    </button>
                  </div>

                  {whName === '__CUSTOM__' && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Building B, Main Godown, Section 2"
                      value={customWhName}
                      onChange={(e) => setCustomWhName(e.target.value)}
                      required
                      autoFocus
                      style={{ marginTop: '8px', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                    />
                  )}
                </div>

                {/* SINGLE MODE FIELDS */}
                {addMode === 'single' ? (
                  <>
                    {/* Rack / Shelf Name */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', color: '#0f172a' }}>
                        Rack / Shelf / Bin Name *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Rack 1, Shelf A, Bin 101, Row 3"
                        value={rackName}
                        onChange={(e) => setRackName(e.target.value)}
                        required
                        style={{ borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                      />

                      {/* Common Quick Fill Helper */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Quick picks:</span>
                        {['Rack 1', 'Rack 2', 'Shelf A', 'Shelf B', 'Bin 101'].map(tag => (
                          <span
                            key={tag}
                            onClick={() => setRackName(tag)}
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: '1px solid #cbd5e1',
                              fontWeight: '600'
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Storage Capacity */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label className="form-label" style={{ fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#0f172a' }}>
                        <span>Default Storage Capacity (Packets)</span>
                        <span style={{ color: '#4f46e5', fontWeight: '800' }}>{capacity} Packets</span>
                      </label>

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={capacity}
                          onChange={(e) => setCapacity(Number(e.target.value) || 20)}
                          style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <input
                          type="number"
                          min="1"
                          max="500"
                          className="form-input"
                          style={{ width: '85px', textAlign: 'center', fontWeight: '800', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                          value={capacity}
                          onChange={(e) => setCapacity(Number(e.target.value) || 20)}
                          required
                        />
                      </div>
                    </div>

                    {/* Live Location Code Preview */}
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      marginBottom: '22px'
                    }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LIVE LOCATION IDENTIFIER</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#4f46e5', marginTop: '2px' }}>
                        {whName === '__CUSTOM__' ? (customWhName || 'Warehouse') : whName} - {rackName || 'Rack Name'}
                      </div>
                    </div>
                  </>
                ) : (
                  /* BULK GENERATOR FIELDS */
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>Rack Name Prefix</label>
                        <input
                          type="text"
                          className="form-input"
                          value={bulkPrefix}
                          onChange={(e) => setBulkPrefix(e.target.value)}
                          placeholder="e.g. Rack, Bay, Shelf"
                          style={{ borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>Start Number</label>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          value={bulkStartNum}
                          onChange={(e) => setBulkStartNum(Number(e.target.value) || 1)}
                          style={{ borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                      <div>
                        <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>Total Racks to Create</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          className="form-input"
                          value={bulkCount}
                          onChange={(e) => setBulkCount(Number(e.target.value) || 10)}
                          style={{ borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>Capacity Per Rack (Pkts)</label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          className="form-input"
                          value={bulkCapacity}
                          onChange={(e) => setBulkCapacity(Number(e.target.value) || 20)}
                          style={{ borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: 'rgba(79, 70, 229, 0.06)',
                      border: '1px solid rgba(79, 70, 229, 0.2)',
                      borderRadius: '12px',
                      marginBottom: '22px'
                    }}>
                      <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '800' }}>⚡ BULK GENERATION PREVIEW</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '4px' }}>
                        Will create {bulkCount} slots: <strong>{whName === '__CUSTOM__' ? (customWhName || 'Hall') : whName} - {bulkPrefix} {bulkStartNum}</strong> to <strong>{bulkPrefix} {bulkStartNum + bulkCount - 1}</strong>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsAddModalOpen(false)}
                    style={{ padding: '9px 18px', borderRadius: '10px', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 22px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      backgroundColor: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)'
                    }}
                  >
                    <Plus size={16} />
                    {isSubmitting ? 'Saving...' : addMode === 'bulk' ? `Generate ${bulkCount} Racks` : 'Save Location'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Quick Stock Transfer Modal (High z-index 20000) ────────────────── */}
      <AnimatePresence>
        {isTransferModalOpen && (() => {
          const currentSourceObj = locations.find(l => isLocMatch(l.code, transferSourceLoc)) || locations.find(l => l.code === transferSourceLoc);
          const sourceMaterials = currentSourceObj?.materialDetailsList || [];
          const maxPkts = transferMaterial ? (transferMaterial.packets || 1) : 1;

          return (
            <div
              className="modal-overlay"
              style={{
                zIndex: 20000,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="modal-content"
                style={{
                  maxWidth: '540px',
                  width: '100%',
                  borderRadius: '20px',
                  padding: '26px 28px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxShadow: '0 25px 60px -10px rgba(0,0,0,0.5)',
                  border: '1px solid #e2e8f0',
                  position: 'relative',
                  zIndex: 20001
                }}
              >
                {/* Modal Header */}
                <div className="modal-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="modal-title" style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', margin: 0 }}>
                      <ArrowLeftRight size={22} color="#4f46e5" />
                      Transfer Material Stock
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                      Relocate stock packets across warehouse racks seamlessly.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsTransferModalOpen(false)}
                    style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleQuickTransferSubmit} style={{ marginTop: '18px' }}>
                  {transferError && (
                    <div style={{
                      padding: '10px 14px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      borderRadius: '10px',
                      fontSize: '13px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={16} />
                      <span>{transferError}</span>
                    </div>
                  )}

                  {transferSuccess && (
                    <div style={{
                      padding: '10px 14px',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      borderRadius: '10px',
                      fontSize: '13px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <CheckCircle size={16} />
                      <span>{transferSuccess}</span>
                    </div>
                  )}

                  {/* Visual Movement Route Indicator */}
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(79, 70, 229, 0.05)',
                    border: '1px solid rgba(79, 70, 229, 0.15)',
                    borderRadius: '14px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SOURCE RACK</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {transferSourceLoc || 'Select Source'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#4f46e5', backgroundColor: '#ffffff', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(79,70,229,0.2)', whiteSpace: 'nowrap' }}>
                        {transferPkts} Pkt{transferPkts > 1 ? 's' : ''}
                      </div>
                      <ArrowRight size={16} color="#4f46e5" style={{ marginTop: '2px' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DESTINATION</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {transferTargetLoc || 'Select Dest'}
                      </div>
                    </div>
                  </div>

                  {/* 1. Source Location Selector */}
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', marginBottom: '6px', color: '#0f172a' }}>
                      Source Warehouse Rack *
                    </label>
                    <select
                      className="form-input"
                      style={{ borderRadius: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                      value={transferSourceLoc}
                      onChange={(e) => handleTransferSourceChange(e.target.value)}
                      required
                    >
                      {locations.map((loc) => {
                        const hasItems = loc.materialDetailsList && loc.materialDetailsList.length > 0;
                        return (
                          <option key={loc.code} value={loc.code}>
                            {loc.code} {hasItems ? `(${loc.currentPackets} Pkts stored)` : '— (Empty Rack)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 2. Material Selection at Source */}
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', marginBottom: '6px', color: '#0f172a' }}>
                      Select Material to Relocate *
                    </label>
                    <select
                      className="form-input"
                      style={{ borderRadius: '10px', fontWeight: '600', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                      value={transferMaterial ? transferMaterial.id : ''}
                      onChange={(e) => {
                        const m = sourceMaterials.find(item => String(item.id) === String(e.target.value));
                        if (m) {
                          setTransferMaterial(m);
                          setTransferPkts(Math.min(m.packets || 1, 1));
                        }
                      }}
                      required
                    >
                      {sourceMaterials.length > 0 ? (
                        sourceMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.color && m.color !== 'Default' ? `(${m.color})` : ''} — Lot #{m.id} {m.poNumber && m.poNumber !== 'N/A' ? `• PO: ${m.poNumber} ` : ''}• ({m.packets} Pkts Available)
                          </option>
                        ))
                      ) : (
                        <option value="">No materials found in {transferSourceLoc}</option>
                      )}
                    </select>
                  </div>

                  {/* 3. Quantity to Relocate Slider */}
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    {(() => {
                      const approxPcsPerPkt = transferMaterial ? Math.round(Number(transferMaterial.stock || 0) / Math.max(1, Number(transferMaterial.packets || maxPkts || 1))) : 0;
                      const currentPkts = Number(transferPkts) || 1;
                      const movingPcs = currentPkts * approxPcsPerPkt;
                      const remainingAfter = Math.max(0, maxPkts - currentPkts);

                      return (
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          backgroundColor: '#f8fafc',
                          border: '1.5px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="form-label" style={{ fontWeight: '800', fontSize: '12px', color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Quantity to Relocate
                            </label>
                            <span style={{ color: '#64748b', fontWeight: '700', fontSize: '11px' }}>
                              Available: <strong style={{ color: '#0f172a' }}>{maxPkts} Pkt{maxPkts > 1 ? 's' : ''}</strong>
                            </span>
                          </div>

                          {/* Selected Quantity Readout */}
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#4f46e5' }}>
                                {currentPkts}
                              </span>
                              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                                {currentPkts === 1 ? 'Packet' : 'Packets'}
                              </span>
                              {approxPcsPerPkt > 0 && (
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6366f1' }}>
                                  • ~{movingPcs.toLocaleString()} {transferMaterial?.unit || 'Pcs'}
                                </span>
                              )}
                            </div>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: remainingAfter > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: remainingAfter > 0 ? '#059669' : '#d97706'
                            }}>
                              Remaining: {remainingAfter} pkt{remainingAfter !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Smooth Clean Scroll Slider */}
                          <div style={{ position: 'relative', width: '100%' }}>
                            <input
                              type="range"
                              min="1"
                              max={maxPkts}
                              value={currentPkts}
                              onChange={(e) => setTransferPkts(Number(e.target.value) || 1)}
                              style={{
                                width: '100%',
                                height: '8px',
                                accentColor: '#4f46e5',
                                cursor: 'pointer',
                                display: 'block'
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px', fontWeight: '600' }}>
                              <span>1 Pkt</span>
                              {maxPkts > 1 && <span>Scroll slider to adjust (1 — {maxPkts})</span>}
                              <span>{maxPkts} Pkts</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 4. Target Destination Location */}
                  <div className="form-group" style={{ marginBottom: '22px' }}>
                    <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', marginBottom: '6px', color: '#0f172a' }}>
                      Destination Warehouse Rack / Bay *
                    </label>
                    <select
                      className="form-input"
                      style={{ borderRadius: '10px', fontWeight: '600', backgroundColor: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                      value={transferTargetLoc}
                      onChange={(e) => setTransferTargetLoc(e.target.value)}
                      required
                    >
                      <option value="">— Select Target Destination Slot —</option>
                      {locations
                        .filter(l => !isLocMatch(l.code, transferSourceLoc))
                        .map(l => (
                          <option key={l.code} value={l.code}>
                            🏢 {l.code} — {l.status} ({l.currentPackets}/{l.capacity} Pkts • {Math.max(0, l.capacity - l.currentPackets)} Free)
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferModalOpen(false);
                        if (onNavigate) onNavigate('material_transfer');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Open Full Transfer Module <ArrowRight size={13} />
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsTransferModalOpen(false)}
                        style={{ padding: '9px 18px', borderRadius: '10px', fontWeight: '600' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isTransferSubmitting || sourceMaterials.length === 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '9px 22px',
                          borderRadius: '10px',
                          fontWeight: '700',
                          backgroundColor: '#4f46e5',
                          color: '#ffffff',
                          border: 'none',
                          cursor: (isTransferSubmitting || sourceMaterials.length === 0) ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                          opacity: sourceMaterials.length === 0 ? 0.6 : 1
                        }}
                      >
                        <ArrowLeftRight size={16} />
                        {isTransferSubmitting ? 'Transferring...' : 'Confirm Transfer'}
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── High-Tech Side Action Drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {isDrawerOpen && selectedLocation && (
          <>
            {/* Solid Dark Backdrop overlay with Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 9999
              }}
            />

            {/* Right Drawer (Solid, Opaque Background) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '470px',
                maxWidth: '92%',
                backgroundColor: '#ffffff',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.3)',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                borderLeft: '1px solid var(--border-color)'
              }}
            >
              {/* Drawer Header */}
              <div style={{
                padding: '22px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {selectedLocation.warehouse}
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                    <Grid size={18} color="#4f46e5" />
                    {selectedLocation.code}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    border: '1px solid var(--border-color)',
                    background: '#ffffff',
                    borderRadius: '50%',
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#0f172a'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#ffffff' }}>

                {/* Physical Position Specs & Capacity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '22px' }}>
                  <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Rack / Shelf</div>
                    <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#0f172a' }}>{selectedLocation.rack}</div>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Configured Capacity</div>
                    <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#4f46e5' }}>{selectedLocation.capacity} Pkts</div>
                  </div>
                </div>

                {/* Storage Status Overview */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: `${getStatusColor(selectedLocation.status)}12`,
                  borderLeft: `4px solid ${getStatusColor(selectedLocation.status)}`,
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: getStatusColor(selectedLocation.status) }}>
                      Status: {selectedLocation.status}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      {selectedLocation.qty.toLocaleString()} {selectedLocation.unit}
                    </span>
                  </div>

                  {/* Utilization gauge in drawer */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>
                      <span>Space Utilization:</span>
                      <span><strong>{selectedLocation.currentPackets}</strong> / {selectedLocation.capacity} Packets ({Math.round((selectedLocation.currentPackets / selectedLocation.capacity) * 100)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.round((selectedLocation.currentPackets / selectedLocation.capacity) * 100))}%`,
                        height: '100%',
                        backgroundColor: getStatusColor(selectedLocation.status),
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                </div>

                {/* Material Details Block */}
                {selectedLocation.status !== 'Empty' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <h4 style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        STORED MATERIAL INVENTORY
                      </h4>
                      <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '700' }}>
                        {selectedLocation.materialDetailsList.length} Items
                      </span>
                    </div>

                    {selectedLocation.materialDetailsList && selectedLocation.materialDetailsList.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedLocation.materialDetailsList.map((item, idx) => (
                          <div key={idx} style={{
                            padding: '12px 14px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                                {item.name}
                              </div>
                              {item.poNumber && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  PO: <strong>{item.poNumber}</strong>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#4f46e5' }}>
                                  {item.packets} Pkts
                                </div>
                              </div>
                              {/* Quick Transfer Item Button */}
                              <button
                                onClick={() => handleOpenTransferModal(selectedLocation, item)}
                                style={{
                                  padding: '5px 9px',
                                  borderRadius: '8px',
                                  border: '1px solid #4f46e5',
                                  backgroundColor: 'rgba(79, 70, 229, 0.08)',
                                  color: '#4f46e5',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Transfer this material to another rack"
                              >
                                <ArrowLeftRight size={12} />
                                Move
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Material Name</label>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>{selectedLocation.materialName}</div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '2px' }}>PO Number</label>
                        <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'monospace' }}>{selectedLocation.poNumber}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Lot Number</label>
                        <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'monospace' }}>{selectedLocation.lotNumber}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Stored Weight</label>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedLocation.weight}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Store In-Charge</label>
                        <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'capitalize' }}>{selectedLocation.storeIncharge}</div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                      <Clock size={13} />
                      <span>Status: {selectedLocation.lastUpdated}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 16px', border: '1.5px dashed var(--border-color)', borderRadius: '14px', color: '#64748b' }}>
                    <Layers size={40} strokeWidth={1} style={{ marginBottom: '10px', color: '#94a3b8' }} />
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>No Material Stored</div>
                    <div style={{ fontSize: '12px', marginTop: '4px', maxWidth: '280px', margin: '4px auto 0' }}>This warehouse slot is currently free and ready to receive incoming stock.</div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions (Issue, Transfer, Receive) */}
              <div style={{
                padding: '18px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: '#f8fafc'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {/* Issue Stock */}
                  <button
                    onClick={() => {
                      if (onNavigate) onNavigate('material_issue');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '10px 8px', borderRadius: '10px', fontWeight: '700', fontSize: '12px' }}
                  >
                    <Box size={14} />
                    Issue
                  </button>

                  {/* Transfer Stock */}
                  <button
                    onClick={() => handleOpenTransferModal(selectedLocation)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '10px 8px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '12px',
                      backgroundColor: 'rgba(79, 70, 229, 0.12)',
                      color: '#4f46e5',
                      border: '1.5px solid #4f46e5',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Transfer stock to another rack"
                  >
                    <ArrowLeftRight size={14} />
                    Transfer
                  </button>

                  {/* Receive Stock */}
                  <button
                    onClick={() => {
                      if (onNavigate) onNavigate('weight_capture');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '10px 8px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '12px',
                      backgroundColor: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                    }}
                  >
                    <Plus size={15} />
                    Receive
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
                  <button
                    onClick={() => handleDeleteLocation(selectedLocation)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={13} />
                    Remove this rack from warehouse
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
