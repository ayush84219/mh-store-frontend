import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, Clock, ArrowLeftRight,
  CheckCircle, AlertTriangle, Layers, FileText, ChevronRight, X, Plus, ChevronDown,
  Warehouse, Box, LayoutGrid, List, Sparkles, Filter, RefreshCw, Eye, Package,
  Maximize2, ArrowUpRight
} from 'lucide-react';

export default function WarehouseLocationView({ racks = [], materials = [], halls = [], onNavigate }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dbLocations, setDbLocations] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(false);

  // View Mode: 'zone_layout' (by hall sections), 'grid' (flat matrix), 'table' (list view)
  const [viewMode, setViewMode] = useState('zone_layout');

  // Add Location Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetHallForAdd, setTargetHallForAdd] = useState('');
  const [whName, setWhName] = useState('Main Store');
  const [customWhName, setCustomWhName] = useState('');
  const [rackName, setRackName] = useState('');
  const [capacity, setCapacity] = useState(20);
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const fetchLiveLocations = async () => {
    try {
      setLoading(true);
      const [locRes, capRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/warehouse-locations`).catch(() => null),
        fetch(`${getBackendUrl()}/api/weight-capture`).catch(() => null)
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
    } catch (err) {
      console.warn("Could not fetch warehouse locations from DB:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveLocations();
    const interval = setInterval(fetchLiveLocations, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Helper to parse how many packets of a material are stored in a specific location string.
   */
  const getPacketsInLocation = (m, locCode) => {
    const locStr = String(m.location || '').trim();
    const pktsTotal = Math.max(1, Number(m.packets) || 1);
    if (!locStr) return 0;

    const parts = locStr.split(',');
    let count = 0;
    const cleanTarget = locCode.toLowerCase().replace(/^(hall|warehouse)\s*\d*\s*[-–]?\s*/i, '').trim();

    parts.forEach(part => {
      const cleanPart = part.trim().toLowerCase();
      const pureLoc = cleanPart.replace(/\(\d+\s*pkts?\)/i, '').trim();

      const isMatch = pureLoc === locCode.toLowerCase() ||
        pureLoc === `rack ${locCode.toLowerCase()}` ||
        (cleanTarget && (pureLoc === cleanTarget || pureLoc === `rack ${cleanTarget}`));

      if (isMatch) {
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
   */
  const locations = useMemo(() => {
    const slotMap = new Map();

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
    (materials || []).forEach(m => {
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

    // Cross-reference all slots with materials and captures
    const result = [];
    slotMap.forEach((slot, codeKey) => {
      const code = slot.code || codeKey;
      const capacity = slot.capacity || 20;
      const cleanSlot = String(code).toLowerCase().trim();
      const normSlotKey = normalizeSlotCode(code)?.toLowerCase();

      const matchedMaterials = (materials || []).filter(m => {
        const mLoc = String(m.location || '').toLowerCase();
        if (!mLoc) return false;

        const mParts = mLoc.split(',').map(p => p.replace(/\(\d+\s*pkts?\)/i, '').trim());
        return mParts.some(p => {
          const normP = normalizeSlotCode(p)?.toLowerCase();
          return p === cleanSlot || normP === normSlotKey;
        });
      });

      const matchedCaptures = (captures || []).filter(c => {
        const cLoc = String(c.storeLocation || '').toLowerCase().trim();
        if (!cLoc) return false;
        const normC = normalizeSlotCode(cLoc)?.toLowerCase();
        return cLoc === cleanSlot || normC === normSlotKey;
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

      matchedMaterials.forEach(m => {
        const pkts = getPacketsInLocation(m, code);
        const totalPkts = Math.max(1, Number(m.packets) || 1);
        const mLoc = String(m.location || '').toLowerCase();
        const effectivePkts = Math.min(totalPkts, pkts > 0 ? pkts : (mLoc.includes(String(code).toLowerCase()) ? totalPkts : 1));
        currentPackets += effectivePkts;
        totalQty += Math.round((Number(m.stock) / totalPkts) * effectivePkts);
        unit = m.unit || 'Pcs';
        const matLabel = m.color && m.color !== 'Default' ? `${m.name} (${m.color})` : m.name;
        materialDetailsList.push({
          name: matLabel,
          packets: effectivePkts,
          stock: m.stock,
          unit: m.unit || 'Pcs',
          color: m.color
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
      if (currentPackets > capacity) {
        status = 'Overfilled';
      } else if (currentPackets === capacity) {
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
        matchedMaterials,
        poNumber: poNumbers[0] || (matchedMaterials[0] ? `PO-${matchedMaterials[0].id}` : 'N/A'),
        lotNumber: lotNumbers[0] || 'N/A',
        weight: totalWeightKg > 0 ? `${totalWeightKg.toFixed(1)} kg` : `${Math.round(totalQty * 0.05)} kg`,
        storeIncharge: storeIncharges[0] || 'Store Team',
        lastUpdated: lastUpdated || 'Active'
      });
    });

    return result.sort((a, b) =>
      (a.warehouse || '').localeCompare(b.warehouse || '') ||
      (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
    );
  }, [racks, dbLocations, materials, captures]);

  // Extract unique warehouses
  const warehouses = useMemo(() => {
    const list = [...new Set(locations.map(r => r.warehouse).filter(Boolean))];
    if (list.length === 0) return ['All', 'Main Store'];
    return ['All', ...list];
  }, [locations]);

  // Stats Card Calculations
  const stats = useMemo(() => ({
    total: locations.length,
    occupied: locations.filter(loc => loc.status === 'Occupied' || loc.status === 'Overfilled').length,
    empty: locations.filter(loc => loc.status === 'Empty').length,
    picking: locations.filter(loc => loc.status === 'Picking').length,
    totalPackets: locations.reduce((sum, l) => sum + l.currentPackets, 0),
    totalCapacity: locations.reduce((sum, l) => sum + l.capacity, 0)
  }), [locations]);

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
      setWhName('Main Store');
    }
    setCustomWhName('');
    setRackName('');
    setCapacity(20);
    setIsAddModalOpen(true);
  };

  // Add Location Submit Handler
  const handleAddLocationSubmit = async (e) => {
    e.preventDefault();
    const targetWh = whName === '__CUSTOM__' ? customWhName.trim() : whName.trim();
    const finalWh = targetWh || 'Main Store';
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

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesSearch = loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.materialName && loc.materialName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        loc.warehouse.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWarehouse = selectedWarehouse === 'All' || loc.warehouse === selectedWarehouse;
      const matchesStatus = selectedStatus === 'All' ||
        (selectedStatus === 'Occupied' && (loc.status === 'Occupied' || loc.status === 'Overfilled')) ||
        loc.status === selectedStatus;

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
      case 'Occupied': return '#EF4444'; // Red
      case 'Overfilled': return '#E11D48'; // Rose
      case 'Picking': return '#8B5CF6'; // Violet / Purple
      case 'Reserved': return '#F59E0B'; // Amber
      default: return '#64748B';
    }
  };

  const getStatusBadge = (status, currentPackets, capacity) => {
    const pct = capacity > 0 ? Math.round((currentPackets / capacity) * 100) : 0;
    switch (status) {
      case 'Empty':
        return { label: 'Empty (0%)', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
      case 'Overfilled':
        return { label: `Over capacity (${pct}%)`, bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' };
      case 'Occupied':
        return { label: `Full (${pct}%)`, bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
      case 'Picking':
        return { label: `In Use (${pct}%)`, bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' };
      default:
        return { label: status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }
  };

  const availableHallsList = useMemo(() => {
    const existing = [...new Set([...(halls || []), ...warehouses.filter(w => w !== 'All')])];
    return existing.length > 0 ? existing : ['Main Store', 'Hall 1', 'Hall 2', 'Warehouse A'];
  }, [halls, warehouses]);

  return (
    <div className="animate-fade" style={{ paddingBottom: '80px', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top Header & Hero Command Bar ───────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              backgroundColor: 'rgba(59, 130, 246, 0.25)',
              color: '#60a5fa',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Warehouse size={13} />
              Inventory Storage Layout
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              • {stats.total} Custom Racks Active
            </span>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
            Warehouse Layout Matrix Visualizer
          </h2>

        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleOpenAddModal()}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.4)';
            }}
          >
            <Plus size={18} />
            + Add Warehouse Location
          </button>
        </div>
      </div>

      {/* ── Metric Snapshot Cards ───────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
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
            border: selectedStatus === 'All' ? '2px solid #3b82f6' : '1.5px solid var(--border-color)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            borderRadius: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configured Slots
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                {stats.total}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '10px' }}>
              <Database size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Capacity: <strong>{stats.totalCapacity} Pkts</strong></span>
          </div>
        </div>

        {/* Occupied / Full */}
        <div
          onClick={() => setSelectedStatus('Occupied')}
          className="panel"
          style={{
            padding: '18px 20px',
            margin: 0,
            cursor: 'pointer',
            border: selectedStatus === 'Occupied' ? '2px solid #ef4444' : '1.5px solid var(--border-color)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            borderRadius: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Occupied / Full
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>
                {stats.occupied}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '10px' }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '10px', fontWeight: '600' }}>
            ● High density storage
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
            transition: 'transform 0.2s, box-shadow 0.2s',
            borderRadius: '14px'
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
            <div style={{ padding: '10px', backgroundColor: '#f5f3ff', color: '#8b5cf6', borderRadius: '10px' }}>
              <Package size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '10px', fontWeight: '600' }}>
            ● Active picking slots
          </div>
        </div>

        {/* Empty Available */}
        <div
          onClick={() => setSelectedStatus('Empty')}
          className="panel"
          style={{
            padding: '18px 20px',
            margin: 0,
            cursor: 'pointer',
            border: selectedStatus === 'Empty' ? '2px solid #10b981' : '1.5px solid var(--border-color)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            borderRadius: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Free
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                {stats.empty}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#ecfdf5', color: '#10b981', borderRadius: '10px' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '10px', fontWeight: '600' }}>
            ● Ready for incoming stock
          </div>
        </div>
      </div>

      {/* ── Filters & View Switcher Bar ─────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: '24px', padding: '16px 20px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search location code, rack, material..."
                className="form-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '13px', borderRadius: '8px' }}
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
                style={{ height: '38px', paddingRight: '32px', fontSize: '13px', minWidth: '160px', cursor: 'pointer', borderRadius: '8px' }}
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w} value={w}>{w === 'All' ? '🏢 All Warehouses & Halls' : `🏢 ${w}`}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {/* Status Filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ height: '38px', paddingRight: '32px', fontSize: '13px', minWidth: '140px', cursor: 'pointer', borderRadius: '8px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Empty">🟢 Empty / Available</option>
                <option value="Picking">🟣 In Use / Picking</option>
                <option value="Occupied">🔴 Full / Occupied</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {(searchQuery || selectedWarehouse !== 'All' || selectedStatus !== 'All') && (
              <button
                onClick={handleResetFilters}
                className="btn btn-secondary"
                style={{ height: '38px', padding: '0 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
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
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            gap: '4px'
          }}>
            <button
              onClick={() => setViewMode('zone_layout')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: viewMode === 'zone_layout' ? '#ffffff' : 'transparent',
                color: viewMode === 'zone_layout' ? '#2563eb' : 'var(--text-muted)',
                boxShadow: viewMode === 'zone_layout' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Warehouse size={14} />
              Hall Sections
            </button>

            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent',
                color: viewMode === 'grid' ? '#2563eb' : 'var(--text-muted)',
                boxShadow: viewMode === 'grid' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={14} />
              Compact Matrix
            </button>

            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#2563eb' : 'var(--text-muted)',
                boxShadow: viewMode === 'table' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
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
          {/* VIEW 1: Hall Sections View (Grouped by Hall with Visual Aisle Header) */}
          {viewMode === 'zone_layout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {Object.entries(groupedByWarehouse).map(([whNameKey, whLocations]) => {
                const totalWhCapacity = whLocations.reduce((s, l) => s + l.capacity, 0);
                const totalWhPackets = whLocations.reduce((s, l) => s + l.currentPackets, 0);
                const whUtilPct = totalWhCapacity > 0 ? Math.round((totalWhPackets / totalWhCapacity) * 100) : 0;

                return (
                  <div
                    key={whNameKey}
                    className="panel"
                    style={{
                      borderRadius: '16px',
                      padding: '24px',
                      border: '1.5px solid var(--border-color)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* Hall Section Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingBottom: '18px',
                      borderBottom: '1px solid var(--border-color)',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800'
                        }}>
                          <Warehouse size={22} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 2px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {whNameKey}
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)'
                            }}>
                              {whLocations.length} Racks
                            </span>
                          </h3>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Storage Utilization: <strong>{totalWhPackets} / {totalWhCapacity} Packets ({whUtilPct}%)</strong>
                          </div>
                        </div>
                      </div>

                      {/* Right Hall Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Progress Bar for Hall */}
                        <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>
                            <span>Total Load</span>
                            <span>{whUtilPct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, whUtilPct)}%`,
                              height: '100%',
                              backgroundColor: whUtilPct > 100 ? '#ef4444' : whUtilPct > 60 ? '#8b5cf6' : '#10b981',
                              borderRadius: '3px'
                            }} />
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenAddModal(whNameKey)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderColor: '#3b82f6',
                            color: '#2563eb'
                          }}
                        >
                          <Plus size={14} />
                          + Add Rack in {whNameKey}
                        </button>
                      </div>
                    </div>

                    {/* Cards Grid for this Hall */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '16px'
                    }}>
                      {whLocations.map((loc) => {
                        const badge = getStatusBadge(loc.status, loc.currentPackets, loc.capacity);
                        const utilPct = loc.capacity > 0 ? Math.round((loc.currentPackets / loc.capacity) * 100) : 0;

                        return (
                          <motion.div
                            key={loc.code}
                            whileHover={{ y: -3, boxShadow: '0 12px 24px -6px rgba(0, 0, 0, 0.12)' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => handleCardClick(loc)}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1.5px solid var(--border-color)',
                              borderRadius: '14px',
                              padding: '16px',
                              cursor: 'pointer',
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {/* Card Top Row: Title & Status Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>
                                  {loc.rack}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                  {loc.code}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  padding: '3px 8px',
                                  borderRadius: '20px',
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: badge.color }}></span>
                                  {badge.label}
                                </span>
                              </div>
                            </div>

                            {/* Stored Content Preview Section */}
                            <div style={{
                              backgroundColor: 'var(--bg-secondary)',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              minHeight: '44px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center'
                            }}>
                              {loc.status !== 'Empty' ? (
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Box size={14} style={{ color: '#2563eb' }} />
                                    <span>{loc.qty} {loc.unit}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {loc.materialName}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <CheckCircle size={14} />
                                  <span>Empty & Ready for Stock</span>
                                </div>
                              )}
                            </div>

                            {/* Bottom Utilization Progress */}
                            <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700' }}>
                                <span>Utilization</span>
                                <span><strong>{loc.currentPackets}</strong> / {loc.capacity} Pkts</span>
                              </div>
                              <div style={{ width: '100%', height: '7px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.min(100, utilPct)}%`,
                                  height: '100%',
                                  backgroundColor: getStatusColor(loc.status),
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

          {/* VIEW 2: Flat Compact Grid View */}
          {viewMode === 'grid' && (
            <div className="panel" style={{ borderRadius: '16px', padding: '24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px'
              }}>
                {filteredLocations.map((loc) => {
                  const badge = getStatusBadge(loc.status, loc.currentPackets, loc.capacity);
                  const utilPct = loc.capacity > 0 ? Math.round((loc.currentPackets / loc.capacity) * 100) : 0;

                  return (
                    <motion.div
                      key={loc.code}
                      whileHover={{ scale: 1.02, boxShadow: '0 10px 20px -4px rgba(0, 0, 0, 0.1)' }}
                      onClick={() => handleCardClick(loc)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>
                            {loc.warehouse}
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                            {loc.rack}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', minHeight: '18px' }}>
                        {loc.status !== 'Empty' ? `${loc.qty} ${loc.unit}` : 'Empty Slot'}
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: '700' }}>
                          <span>{loc.currentPackets} / {loc.capacity} Pkts</span>
                          <span style={{ color: badge.color }}>{utilPct}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, utilPct)}%`, height: '100%', backgroundColor: getStatusColor(loc.status), borderRadius: '3px' }} />
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
            <div className="panel" style={{ borderRadius: '16px', padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '14px 20px' }}>Location Code</th>
                      <th style={{ padding: '14px 16px' }}>Warehouse / Hall</th>
                      <th style={{ padding: '14px 16px' }}>Status</th>
                      <th style={{ padding: '14px 16px' }}>Stored Material</th>
                      <th style={{ padding: '14px 16px' }}>Quantity</th>
                      <th style={{ padding: '14px 16px' }}>Packet Capacity</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
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
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '14px 20px', fontWeight: '700', color: 'var(--text-main)' }}>
                            {loc.code}
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>
                            {loc.warehouse}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`
                            }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-main)', fontWeight: '500', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {loc.materialName}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: '700' }}>
                            {loc.qty > 0 ? `${loc.qty} ${loc.unit}` : '-'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span><strong>{loc.currentPackets}</strong> / {loc.capacity} Pkts</span>
                              <div style={{ width: '60px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, Math.round((loc.currentPackets / loc.capacity) * 100))}%`, height: '100%', backgroundColor: getStatusColor(loc.status) }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCardClick(loc);
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                View
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
        </>
      ) : (
        /* Empty State */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '2px dashed var(--border-color)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Warehouse size={36} />
          </div>
          <h4 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            {locations.length === 0 ? 'No Warehouse Locations Added' : 'No Locations Found Matching Filter'}
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            {locations.length === 0
              ? 'Add your storage racks and inventory bins manually to organize your materials across halls and warehouses.'
              : 'Try clearing your search query or reset filters to see all available storage slots.'}
          </p>
          {locations.length === 0 ? (
            <button
              onClick={() => handleOpenAddModal()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '14px', borderRadius: '10px' }}
            >
              <Plus size={18} />
              + Add Your First Warehouse Location
            </button>
          ) : (
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '8px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── Modern Add Location Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
              style={{ maxWidth: '520px', borderRadius: '18px', padding: '28px' }}
            >
              {/* Modal Header */}
              <div className="modal-header" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Plus size={22} className="text-accent" />
                    Add Warehouse Location
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Configure a new storage rack, shelf, or bin location.
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

              <form onSubmit={handleAddLocationSubmit} style={{ marginTop: '20px' }}>
                {addError && (
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    borderRadius: '8px',
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
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Warehouse / Hall / Zone *</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Where is this rack located?</span>
                  </label>

                  {/* Preset Quick Chips */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {availableHallsList.map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setWhName(h)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: whName === h ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                          backgroundColor: whName === h ? '#eff6ff' : 'var(--bg-secondary)',
                          color: whName === h ? '#2563eb' : 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                      >
                        {h}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setWhName('__CUSTOM__')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        border: whName === '__CUSTOM__' ? '1.5px solid #2563eb' : '1px dashed var(--border-color)',
                        backgroundColor: whName === '__CUSTOM__' ? '#eff6ff' : 'transparent',
                        color: whName === '__CUSTOM__' ? '#2563eb' : 'var(--text-muted)',
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
                      style={{ marginTop: '6px' }}
                    />
                  )}
                </div>

                {/* Rack / Shelf Name */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '13px' }}>
                    Rack / Shelf / Bin Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rack 1, Shelf A, Bin 101, Row 3"
                    value={rackName}
                    onChange={(e) => setRackName(e.target.value)}
                    required
                  />

                  {/* Common Quick Fill Helper */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quick templates:</span>
                    {['Rack 1', 'Rack 2', 'Shelf A', 'Shelf B', 'Bin 1'].map(tag => (
                      <span
                        key={tag}
                        onClick={() => setRackName(tag)}
                        style={{
                          fontSize: '10px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Storage Capacity */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Storage Capacity (Packets / Boxes)</span>
                    <span style={{ color: '#2563eb', fontWeight: '800' }}>{capacity} Packets</span>
                  </label>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                      style={{ width: '80px', textAlign: 'center', fontWeight: '700' }}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value) || 20)}
                      required
                    />
                  </div>
                </div>

                {/* Live Location Code Preview */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  marginBottom: '22px'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>LIVE LOCATION IDENTIFIER</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#2563eb', marginTop: '2px' }}>
                    {whName === '__CUSTOM__' ? (customWhName || 'Warehouse') : whName} - {rackName || 'Rack Name'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsAddModalOpen(false)}
                    style={{ padding: '8px 18px', borderRadius: '8px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 22px', borderRadius: '8px', fontWeight: '700' }}
                  >
                    <Plus size={16} />
                    {isSubmitting ? 'Saving...' : 'Add Location'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Side Action Drawer ───────────────────────────────────────────── */}
      <AnimatePresence>
        {isDrawerOpen && selectedLocation && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#000000',
                zIndex: 9999
              }}
            />

            {/* Right Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '440px',
                maxWidth: '92%',
                backgroundColor: '#ffffff',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
              }}
            >
              {/* Drawer Header */}
              <div style={{
                padding: '22px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {selectedLocation.warehouse}
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedLocation.code}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    border: '1px solid var(--border-color)',
                    background: '#ffffff',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-main)'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

                {/* Physical Position Specs & Capacity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Rack / Shelf</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '4px' }}>{selectedLocation.rack}</div>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Capacity</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '4px' }}>{selectedLocation.capacity} Pkts</div>
                  </div>
                </div>

                {/* Storage Status Overview */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: `${getStatusColor(selectedLocation.status)}12`,
                  borderLeft: `4px solid ${getStatusColor(selectedLocation.status)}`,
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: getStatusColor(selectedLocation.status) }}>
                      Status: {selectedLocation.status}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '800' }}>
                      {selectedLocation.qty} {selectedLocation.unit}
                    </span>
                  </div>

                  {/* Utilization gauge in drawer */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      STORED MATERIAL METADATA
                    </h4>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Material Name</label>
                      <div style={{ fontSize: '14px', fontWeight: '700' }}>{selectedLocation.materialName}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>PO Number</label>
                        <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'monospace' }}>{selectedLocation.poNumber}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Lot Number</label>
                        <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'monospace' }}>{selectedLocation.lotNumber}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Stored Weight</label>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedLocation.weight}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Store In-Charge</label>
                        <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'capitalize' }}>{selectedLocation.storeIncharge}</div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      <span>Status: {selectedLocation.lastUpdated}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 16px', border: '1.5px dashed var(--border-color)', borderRadius: '14px', color: 'var(--text-muted)' }}>
                    <Layers size={40} strokeWidth={1} style={{ marginBottom: '10px', color: '#94a3b8' }} />
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>No Material Stored</div>
                    <div style={{ fontSize: '12px', marginTop: '4px', maxWidth: '280px', margin: '4px auto 0' }}>This warehouse slot is currently free and ready to receive incoming stock.</div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div style={{
                padding: '20px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      if (onNavigate) onNavigate('material_issue');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 12px', borderRadius: '8px' }}
                  >
                    <Box size={14} />
                    Issue Stock
                  </button>

                  <button
                    onClick={() => {
                      if (onNavigate) onNavigate('weight_capture');
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 12px', borderRadius: '8px' }}
                  >
                    <Plus size={14} />
                    Receive Stock
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
