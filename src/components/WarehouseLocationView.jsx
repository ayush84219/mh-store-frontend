import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, Bell, Clock, Shield, ArrowLeftRight,
  CheckCircle, AlertTriangle, Layers, FileText, ChevronRight, X, Plus, LogOut, ChevronDown
} from 'lucide-react';

export default function WarehouseLocationView({ racks = [], materials = [], halls = [], onNavigate }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dbLocations, setDbLocations] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedRack, setSelectedRack] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
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
    fetchLiveLocations();
    const interval = setInterval(fetchLiveLocations, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Helper to parse how many packets of a material are stored in a specific location string.
   * Handles multi-location strings like "Hall 1 - Rack 2 (8 pkts), Hall 1 - Rack 3 (2 pkts)"
   */
  const getPacketsInLocation = (m, locCode) => {
    const locStr = String(m.location || '').trim();
    const pktsTotal = Math.max(1, Number(m.packets) || 1);
    if (!locStr) return 0;
    
    const parts = locStr.split(',');
    let count = 0;
    const cleanTarget = locCode.toLowerCase().replace(/^(hall|warehouse)\s*\d+\s*[-–]?\s*/i, '').trim();

    parts.forEach(part => {
      const cleanPart = part.trim().toLowerCase();
      // Remove packet quantity annotation "(X pkts)" for clean string comparison
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
   * Dynamically calculate slot locations based on:
   * 1. Official warehouse_locations DB table (Primary single source of truth)
   * 2. Configured racks from Settings
   * 3. Discovered locations from Materials inventory (normalized to avoid loose single-digit duplicates)
   */
  const locations = React.useMemo(() => {
    const slotMap = new Map(); // key -> slotObj

    // Helper: Normalize raw location strings like "1", "Rack 1", "Hall 1 - Rack 1" to unified format
    const normalizeSlotCode = (rawCode) => {
      const trimmed = String(rawCode || '').trim();
      if (!trimmed || trimmed === 'N/A' || trimmed === 'null') return null;
      
      // If it's just a raw number (e.g. "1", "2"), map to "Hall 1 - Rack X"
      if (/^\d+$/.test(trimmed)) {
        return `HALL 1 - RACK ${trimmed}`;
      }
      // If it's "Rack X", map to "Hall 1 - Rack X"
      if (/^rack\s*\d+$/i.test(trimmed)) {
        const num = trimmed.replace(/^rack\s*/i, '');
        return `HALL 1 - RACK ${num}`;
      }
      return trimmed.toUpperCase();
    };

    // 1. Add official locations from warehouse_locations DB table as primary source of truth
    dbLocations.forEach(d => {
      const rawCode = String(d.code || d.id || '').trim();
      const codeKey = normalizeSlotCode(rawCode);
      if (!codeKey) return;
      
      slotMap.set(codeKey, {
        code: d.code || codeKey,
        rack: d.code || codeKey,
        warehouse: d.warehouse || 'Hall 1',
        capacity: Number(d.capacity) || 10
      });
    });

    // 2. Add configured racks from settings if not already in DB
    racks.forEach(r => {
      const rawCode = String(r.code || '').trim();
      const codeKey = normalizeSlotCode(rawCode);
      if (!codeKey) return;
      
      if (!slotMap.has(codeKey)) {
        slotMap.set(codeKey, {
          code: r.code || codeKey,
          rack: r.code || codeKey,
          warehouse: r.warehouse || 'Hall 1',
          capacity: Number(r.capacity) || 10
        });
      }
    });

    // 3. Add locations discovered from materials inventory (normalized to prevent double cards)
    materials.forEach(m => {
      const locStr = String(m.location || '').trim();
      if (!locStr || locStr === 'N/A' || locStr === 'null') return;
      const parts = locStr.split(',');
      parts.forEach(p => {
        const clean = p.replace(/\(\d+\s*pkts?\)/i, '').trim();
        const codeKey = normalizeSlotCode(clean);
        if (!codeKey) return;
        
        if (!slotMap.has(codeKey)) {
          let wh = 'Hall 1';
          const whMatch = clean.match(/(hall|warehouse)\s*(\d+)/i);
          if (whMatch) {
            wh = `Hall ${whMatch[2]}`;
          } else if (clean.toLowerCase().includes('store')) {
            wh = 'Main Store';
          }
          slotMap.set(codeKey, {
            code: clean,
            rack: clean,
            warehouse: wh,
            capacity: 10
          });
        }
      });
    });

    // 4. If default halls are defined, ensure default rack slots exist for visualizer
    const defaultHalls = halls.length > 0 ? halls : ['Hall 1', 'Main Store'];
    defaultHalls.forEach(hallName => {
      const existingInHall = Array.from(slotMap.values()).filter(s => (s.warehouse || '').toLowerCase() === String(hallName).toLowerCase());
      if (existingInHall.length === 0 && hallName.toLowerCase().includes('hall')) {
        for (let i = 1; i <= 9; i++) {
          const rackCode = `${String(hallName).toUpperCase()} - RACK ${i}`;
          slotMap.set(rackCode, {
            code: rackCode,
            rack: `Rack ${i}`,
            warehouse: hallName,
            capacity: 10
          });
        }
      }
    });

    // Cross-reference all slots with materials and captures using exact location matching
    const result = [];
    slotMap.forEach((slot, codeKey) => {
      const code = slot.code || codeKey;
      const capacity = slot.capacity || 10;
      const cleanSlot = String(code).toLowerCase().trim();
      const normSlotKey = normalizeSlotCode(code)?.toLowerCase();
      
      // Match materials stored in this specific slot (prevent loose substring matches)
      const matchedMaterials = (materials || []).filter(m => {
        const mLoc = String(m.location || '').toLowerCase();
        if (!mLoc) return false;
        
        const mParts = mLoc.split(',').map(p => p.replace(/\(\d+\s*pkts?\)/i, '').trim());
        return mParts.some(p => {
          const normP = normalizeSlotCode(p)?.toLowerCase();
          return p === cleanSlot || normP === normSlotKey;
        });
      });

      // Match captures logged to this slot
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
      let materialNames = [];
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
        materialNames.push(m.color && m.color !== 'Default' ? `${m.name} (${m.color})` : m.name);
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
      if (currentPackets >= capacity) {
        status = 'Occupied';
      } else if (currentPackets > 0) {
        status = 'Picking';
      } else {
        status = 'Empty';
      }

      result.push({
        code,
        rack: slot.rack,
        warehouse: slot.warehouse || 'Hall 1',
        capacity,
        currentPackets,
        status,
        qty: totalQty,
        unit,
        materialName: materialNames.join(', ') || 'None',
        matchedMaterials,
        poNumber: poNumbers[0] || (matchedMaterials[0] ? `PO-2026-${matchedMaterials[0].id}` : 'N/A'),
        lotNumber: lotNumbers[0] || 'N/A',
        weight: totalWeightKg > 0 ? `${totalWeightKg.toFixed(1)} kg` : `${Math.round(totalQty * 0.05)} kg`,
        storeIncharge: storeIncharges[0] || 'Store Team',
        lastUpdated: lastUpdated || '2026-08-22'
      });
    });

    return result.sort((a, b) => (a.warehouse || '').localeCompare(b.warehouse || '') || (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));
  }, [racks, dbLocations, materials, captures, halls]);

  // Extract unique warehouses and racks dynamically
  const warehouses = React.useMemo(() => {
    return ['All', ...new Set(locations.map(r => r.warehouse))];
  }, [locations]);

  const uniqueRacks = React.useMemo(() => {
    return ['All', ...new Set(locations.map(r => r.rack))];
  }, [locations]);

  // Stats Card Calculations
  const stats = {
    total: locations.length,
    occupied: locations.filter(loc => loc.status === 'Occupied').length,
    empty: locations.filter(loc => loc.status === 'Empty').length,
    reserved: locations.filter(loc => loc.status === 'Reserved').length,
    picking: locations.filter(loc => loc.status === 'Picking').length,
  };

  const handleCardClick = (loc) => {
    setSelectedLocation(loc);
    setIsDrawerOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedWarehouse('All');
    setSelectedRack('All');
    setSelectedStatus('All');
  };

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.materialName && loc.materialName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesWarehouse = selectedWarehouse === 'All' || loc.warehouse === selectedWarehouse;
    const matchesRack = selectedRack === 'All' || loc.rack === selectedRack;
    const matchesStatus = selectedStatus === 'All' || loc.status === selectedStatus;

    return matchesSearch && matchesWarehouse && matchesRack && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Empty': return '#10B981'; // Green
      case 'Occupied': return '#EF4444'; // Red
      case 'Reserved': return '#F59E0B'; // Yellow
      case 'Picking': return '#8B5CF6'; // Purple
      default: return '#9CA3AF';
    }
  };

  return (
    <div className="animate-fade" style={{ paddingBottom: '60px', fontFamily: "'Inter', sans-serif" }}>
      {/* Filters & Actions Panel */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '300px' }}>
            {/* Search Location */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search Location or Material..."
                className="form-input"
                style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Warehouse Dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ height: '36px', paddingRight: '30px', fontSize: '13px', width: '160px', cursor: 'pointer' }}
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w} value={w}>{w === 'All' ? 'All Warehouses' : w}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {/* Rack Dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ height: '36px', paddingRight: '30px', fontSize: '13px', width: '110px', cursor: 'pointer' }}
                value={selectedRack}
                onChange={(e) => setSelectedRack(e.target.value)}
              >
                {uniqueRacks.map(r => (
                  <option key={r} value={r}>{r === 'All' ? 'All Racks' : `Rack ${r}`}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {/* Status Dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ height: '36px', paddingRight: '30px', fontSize: '13px', width: '130px', cursor: 'pointer' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Empty">Empty (Green)</option>
                <option value="Occupied">Occupied (Red)</option>
                <option value="Reserved">Reserved (Yellow)</option>
                <option value="Picking">Picking (Purple)</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>

            {/* Reset Button */}
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ height: '36px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              Reset
            </button>
          </div>

          {/* Legend indicator */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', fontWeight: '600' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981' }}></span> Empty
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#EF4444' }}></span> Occupied
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#F59E0B' }}></span> Reserved
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8B5CF6' }}></span> Picking
            </span>
          </div>

        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Card 1: Total */}
        <div className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)' }}>{stats.total}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' }}>Total Locations</div>
          </div>
          <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '10px', borderRadius: '12px' }}>
            <Database size={24} />
          </div>
        </div>

        {/* Card 2: Occupied */}
        <div className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#EF4444' }}>{stats.occupied}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' }}>Occupied Slots</div>
          </div>
          <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '12px' }}>
            <Layers size={24} />
          </div>
        </div>

        {/* Card 3: Empty */}
        <div className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#10B981' }}>{stats.empty}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' }}>Empty Slots</div>
          </div>
          <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '10px', borderRadius: '12px' }}>
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Card 4: Reserved */}
        <div className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#F59E0B' }}>{stats.reserved}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' }}>Reserved Slots</div>
          </div>
          <div style={{ backgroundColor: '#fef3c7', color: '#f59e0b', padding: '10px', borderRadius: '12px' }}>
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Warehouse Map Grid */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <Layers size={18} className="text-accent" />
            Rack Layout Matrix Visualizer
          </h3>
        </div>

        {filteredLocations.length > 0 ? (
          <div className="warehouse-grid-layout">
            {filteredLocations.map((loc) => (
              <motion.div
                key={loc.code}
                whileHover={{ scale: 1.05, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => handleCardClick(loc)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                    {loc.code}
                  </span>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(loc.status)
                  }}></span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {loc.qty > 0 ? `${loc.qty} ${loc.unit}` : 'Empty Slot'}
                </div>

                {/* Storage Utilization Bar */}
                {loc.status !== 'Empty' && (
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: '700' }}>
                      <span>Utilized</span>
                      <span>{loc.currentPackets} / {loc.capacity} Pkts ({Math.round((loc.currentPackets / loc.capacity) * 100)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.min(100, Math.round((loc.currentPackets / loc.capacity) * 100))}%`, 
                        height: '100%', 
                        backgroundColor: getStatusColor(loc.status),
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                )}

                {loc.status === 'Empty' && (
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: getStatusColor(loc.status),
                    textTransform: 'uppercase',
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    🟢 Free (0 / {loc.capacity} Pkts)
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
            <Layers size={48} strokeWidth={1} style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: '500' }}>No warehouse locations found matching selected filter criteria.</p>
          </div>
        )}
      </div>

      {/* Side Action Drawer using Framer Motion */}
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
                width: '420px',
                maxWidth: '90%',
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
                padding: '20px 24px',
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
                    Location: {selectedLocation.code}
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
                  <div style={{ border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Rack</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '4px' }}>{selectedLocation.rack}</div>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Capacity</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '4px' }}>{selectedLocation.capacity} Pkts</div>
                  </div>
                </div>

                {/* Storage Status Overview */}
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: `${getStatusColor(selectedLocation.status)}10`,
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
                      <span>{selectedLocation.currentPackets} / {selectedLocation.capacity} Packets ({Math.round((selectedLocation.currentPackets / selectedLocation.capacity) * 100)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
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
                    <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', margin: 0 }}>
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
                      <span>Last Updated: {selectedLocation.lastUpdated}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 0', border: '1.5px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                    <Layers size={36} strokeWidth={1} style={{ marginBottom: '8px', color: '#94a3b8' }} />
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>No Material Stored</div>
                    <div style={{ fontSize: '11px', marginTop: '2px' }}>This warehouse slot is currently empty and available for incoming stock.</div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div style={{
                padding: '24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <h4 style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)', 
                  fontWeight: '700', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em',
                  margin: '0 0 4px 0' 
                }}>
                  Location Actions
                </h4>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* Action 1: Issue Material */}
                  <div
                    onClick={() => {
                      if (onNavigate) onNavigate('material_issue');
                      else alert(`Issuing material from location ${selectedLocation.code}`);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'transparent',
                      userSelect: 'none',
                      border: '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--accent-color)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'translateX(3px)';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--text-main)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'none';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'none';
                    }}
                  >
                    <div 
                      className="action-icon-wrapper"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <Plus size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        className="action-title"
                        style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: 'var(--text-main)', 
                          transition: 'color 0.2s ease',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px'
                        }}
                      >
                        Issue Material
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Deduct stock from {selectedLocation.code}
                      </div>
                    </div>
                    <ChevronRight 
                      className="action-chevron"
                      size={14} 
                      style={{ color: 'var(--text-muted)', transition: 'transform 0.2s ease', marginLeft: '8px' }} 
                    />
                  </div>

                  {/* Action 2: Receive Stock */}
                  <div
                    onClick={() => {
                      if (onNavigate) onNavigate('weight_capture');
                      else alert(`Receiving material at location ${selectedLocation.code}`);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'transparent',
                      userSelect: 'none',
                      border: '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--accent-color)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'translateX(3px)';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--text-main)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'none';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'none';
                    }}
                  >
                    <div 
                      className="action-icon-wrapper"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <Plus size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        className="action-title"
                        style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: 'var(--text-main)', 
                          transition: 'color 0.2s ease',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px'
                        }}
                      >
                        Receive Stock
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Scan and add new stock to {selectedLocation.code}
                      </div>
                    </div>
                    <ChevronRight 
                      className="action-chevron"
                      size={14} 
                      style={{ color: 'var(--text-muted)', transition: 'transform 0.2s ease', marginLeft: '8px' }} 
                    />
                  </div>

                  {/* Action 3: Transfer */}
                  <div
                    onClick={() => {
                      if (onNavigate) onNavigate('material_transfer');
                      else alert(`Transferring stock from location ${selectedLocation.code}`);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'transparent',
                      userSelect: 'none',
                      border: '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--accent-color)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'translateX(3px)';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--text-main)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'none';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'none';
                    }}
                  >
                    <div 
                      className="action-icon-wrapper"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <ArrowLeftRight size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        className="action-title"
                        style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: 'var(--text-main)', 
                          transition: 'color 0.2s ease',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px'
                        }}
                      >
                        Transfer
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Move materials to another location
                      </div>
                    </div>
                    <ChevronRight 
                      className="action-chevron"
                      size={14} 
                      style={{ color: 'var(--text-muted)', transition: 'transform 0.2s ease', marginLeft: '8px' }} 
                    />
                  </div>

                  {/* Action 4: View Location Transaction Logs */}
                  <div
                    onClick={() => {
                      if (onNavigate) onNavigate('scanner_logs');
                      else alert(`Displaying transaction log history for ${selectedLocation.code}`);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'transparent',
                      userSelect: 'none',
                      border: '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--accent-color)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'translateX(3px)';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.querySelector('.action-title').style.color = 'var(--text-main)';
                      e.currentTarget.querySelector('.action-chevron').style.transform = 'none';
                      e.currentTarget.querySelector('.action-icon-wrapper').style.transform = 'none';
                    }}
                  >
                    <div 
                      className="action-icon-wrapper"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <FileText size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        className="action-title"
                        style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: 'var(--text-main)', 
                          transition: 'color 0.2s ease',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px'
                        }}
                      >
                        View Location Transaction Logs
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        History of changes for {selectedLocation.code}
                      </div>
                    </div>
                    <ChevronRight 
                      className="action-chevron"
                      size={14} 
                      style={{ color: 'var(--text-muted)', transition: 'transform 0.2s ease', marginLeft: '8px' }} 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
