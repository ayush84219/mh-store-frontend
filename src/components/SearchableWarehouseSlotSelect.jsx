import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Building2, Package, Check, ChevronDown, X, Layers, Box } from 'lucide-react';

/**
 * Natural comparison helper for sorting rack identifiers:
 * e.g., "RACK 1", "RACK 2", ... "RACK 10", "RACK 100"
 */
const naturalCompare = (aStr, bStr) => {
  return String(aStr || '').localeCompare(String(bStr || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

/**
 * Helper to highlight matching query text within a string
 */
const highlightMatch = (text, query) => {
  if (!text || !query) return text;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;

  return (
    <>
      {text.substring(0, idx)}
      <span style={{ backgroundColor: 'rgba(254, 240, 138, 0.9)', color: '#854d0e', borderRadius: '3px', padding: '0 2px', fontWeight: '800' }}>
        {text.substring(idx, idx + q.length)}
      </span>
      {text.substring(idx + q.length)}
    </>
  );
};

export default function SearchableWarehouseSlotSelect({
  slots = [],
  value = '',
  onChange,
  placeholder = '— Select Target Destination Slot —',
  excludeSlotCode = '',
  isSource = false,
  required = false,
  disabled = false,
  className = '',
  style = {},
  buttonStyle = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Empty', 'Picking', 'Occupied'
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 350 && rect.top > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  }, [isOpen]);

  // Normalize raw slot items into standard structured objects
  const normalizedSlots = useMemo(() => {
    const list = [];
    const seen = new Set();
    const excludeNormalized = (excludeSlotCode || '').trim().toLowerCase();

    (slots || []).forEach(item => {
      if (!item) return;
      const code = typeof item === 'string' ? item.trim() : (item.code || item.name || '').trim();
      if (!code) return;

      // Exclude source location if specified
      if (excludeNormalized && code.toLowerCase() === excludeNormalized) return;

      const key = code.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);

      const warehouse = (typeof item === 'object' && item.warehouse)
        ? item.warehouse
        : (code.includes(' - ') ? code.split(' - ')[0].trim() : 'Main Store');

      const rack = (typeof item === 'object' && item.rack)
        ? item.rack
        : (code.includes(' - ') ? code.split(' - ').slice(1).join(' - ').trim() : code);

      const capacity = Number(item.capacity) || 20;
      const currentPackets = Number(item.currentPackets) || 0;
      const freePackets = Math.max(0, capacity - currentPackets);
      const status = item.status || (currentPackets <= 0 ? 'Empty' : currentPackets >= capacity ? 'Occupied' : 'Picking');
      const materialDetailsList = Array.isArray(item.materialDetailsList) ? item.materialDetailsList : [];
      const hasStoredMaterials = materialDetailsList.length > 0 || currentPackets > 0;

      list.push({
        code,
        warehouse,
        rack,
        capacity,
        currentPackets,
        freePackets,
        status,
        materialDetailsList,
        hasStoredMaterials,
        raw: item
      });
    });

    // Natural alphanumeric ascending sort: Hall 1 Rack 1, Rack 2 ... Rack 10 ... Rack 100
    list.sort((a, b) => {
      const whCompare = naturalCompare(a.warehouse, b.warehouse);
      if (whCompare !== 0) return whCompare;
      return naturalCompare(a.code, b.code);
    });

    // If current value is set but not in list, preserve it as an option at top
    if (value && !seen.has(String(value).trim().toUpperCase())) {
      const customVal = String(value).trim();
      list.unshift({
        code: customVal,
        warehouse: customVal.includes(' - ') ? customVal.split(' - ')[0].trim() : 'Current',
        rack: customVal.includes(' - ') ? customVal.split(' - ').slice(1).join(' - ').trim() : customVal,
        capacity: 20,
        currentPackets: 0,
        freePackets: 20,
        status: 'Active',
        materialDetailsList: [],
        hasStoredMaterials: false,
        isCustom: true
      });
    }

    return list;
  }, [slots, value, excludeSlotCode]);

  // Extract unique warehouses for filter tabs
  const warehouseList = useMemo(() => {
    const set = new Set();
    normalizedSlots.forEach(s => {
      if (s.warehouse && s.warehouse !== 'Current') set.add(s.warehouse);
    });
    return Array.from(set).sort((a, b) => naturalCompare(a, b));
  }, [normalizedSlots]);

  // Status counts for status filter pills
  const statusCounts = useMemo(() => {
    let empty = 0;
    let picking = 0;
    let occupied = 0;
    let withStock = 0;

    normalizedSlots.forEach(s => {
      if (s.status === 'Empty' || s.currentPackets <= 0) empty++;
      else if (s.status === 'Occupied' || s.currentPackets >= s.capacity) occupied++;
      else picking++;

      if (s.hasStoredMaterials) withStock++;
    });

    return { total: normalizedSlots.length, empty, picking, occupied, withStock };
  }, [normalizedSlots]);

  // Filter slots based on query, warehouse chip, and status chip
  const filteredSlots = useMemo(() => {
    let result = normalizedSlots;

    if (selectedWarehouse !== 'All') {
      result = result.filter(s => s.warehouse === selectedWarehouse || s.code === value);
    }

    if (statusFilter !== 'All') {
      if (isSource) {
        if (statusFilter === 'With Stock') result = result.filter(s => s.hasStoredMaterials);
        else if (statusFilter === 'Empty') result = result.filter(s => !s.hasStoredMaterials);
      } else {
        if (statusFilter === 'Empty') result = result.filter(s => s.status === 'Empty' || s.currentPackets <= 0);
        else if (statusFilter === 'Picking') result = result.filter(s => s.status === 'Picking');
        else if (statusFilter === 'Occupied') result = result.filter(s => s.status === 'Occupied');
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => {
        if (s.code.toLowerCase().includes(q)) return true;
        if (s.rack.toLowerCase().includes(q)) return true;
        if (s.warehouse.toLowerCase().includes(q)) return true;
        if (s.status.toLowerCase().includes(q)) return true;
        if (String(s.capacity).includes(q) || String(s.currentPackets).includes(q) || String(s.freePackets).includes(q)) return true;
        if (s.materialDetailsList.some(m => (m.name && m.name.toLowerCase().includes(q)) || (m.id && String(m.id).toLowerCase().includes(q)))) return true;
        return false;
      });
    }

    return result;
  }, [normalizedSlots, selectedWarehouse, statusFilter, searchQuery, value, isSource]);

  // Resolve currently selected slot details
  const currentSlot = useMemo(() => {
    if (!value) return null;
    const cleanVal = String(value).trim().toLowerCase();
    return normalizedSlots.find(s => s.code.toLowerCase() === cleanVal);
  }, [normalizedSlots, value]);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (slotCode) => {
    if (onChange) onChange(slotCode);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getStatusBadgeStyle = (status, currentPackets, capacity) => {
    const isOccupied = status === 'Occupied' || (capacity > 0 && currentPackets >= capacity);
    const isEmpty = status === 'Empty' || currentPackets <= 0;

    if (isEmpty) {
      return {
        bg: '#ecfdf5',
        color: '#059669',
        border: '#a7f3d0',
        label: 'Empty'
      };
    }
    if (isOccupied) {
      return {
        bg: '#eef2ff',
        color: '#4338ca',
        border: '#c7d2fe',
        label: 'Occupied'
      };
    }
    return {
      bg: '#f5f3ff',
      color: '#7c3aed',
      border: '#ddd6fe',
      label: 'Picking'
    };
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-warehouse-slot-select ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        ...style
      }}
    >
      {/* ── Main Trigger Button ─────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen(prev => !prev);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
          padding: '9px 12px',
          minHeight: '42px',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #4f46e5' : '1.5px solid #cbd5e1',
          background: '#ffffff',
          color: value ? '#0f172a' : '#64748b',
          fontSize: '13px',
          fontWeight: '600',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.15)' : 'none',
          transition: 'all 0.2s ease',
          ...buttonStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <Building2 size={16} style={{ color: value ? '#4f46e5' : '#94a3b8', flexShrink: 0 }} />

          {currentSlot ? (
            <span style={{ fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSlot.code}
            </span>
          ) : (
            <span style={{ color: '#64748b', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {placeholder}
            </span>
          )}
        </div>

        {/* Right Actions: Clear Selection & Chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onChange) onChange('');
              }}
              title="Clear selected slot"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.backgroundColor = '#fee2e2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={13} />
            </span>
          )}

          <ChevronDown
            size={16}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Hidden input for standard HTML form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          required={required}
          onChange={() => {}}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            left: 0,
            bottom: 0,
            width: '100%',
            height: '1px'
          }}
        />
      )}

      {/* ── Dropdown Search & Filter Popover Panel ──────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: dropUp ? 'auto' : 'calc(100% + 6px)',
            bottom: dropUp ? 'calc(100% + 6px)' : 'auto',
            left: 0,
            right: 0,
            width: '100%',
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '14px',
            boxShadow: '0 18px 40px -6px rgba(15, 23, 42, 0.25), 0 8px 16px rgba(0, 0, 0, 0.08)',
            zIndex: 999999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '340px',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* 1. Search Bar Header */}
          <div style={{
            padding: '10px 12px 8px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 10px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <Search size={15} style={{ color: '#4f46e5', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredSlots.length > 0) {
                      handleSelect(filteredSlots[0].code);
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="Type to search rack (e.g. 177, RACK 4, Empty, Main Store)..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#0f172a',
                  padding: 0
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Warehouse Filter Chips */}
            {warehouseList.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '4px',
                marginTop: '8px',
                overflowX: 'auto',
                paddingBottom: '2px',
                scrollbarWidth: 'none'
              }}>
                {['All', ...warehouseList].map(wh => (
                  <button
                    key={wh}
                    type="button"
                    onClick={() => setSelectedWarehouse(wh)}
                    style={{
                      border: 'none',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: selectedWarehouse === wh ? '#4f46e5' : '#e2e8f0',
                      color: selectedWarehouse === wh ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {wh === 'All' ? 'All Halls' : wh}
                  </button>
                ))}
              </div>
            )}

            {/* Status Filter Chips (Quickly find Empty or Available slots!) */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginTop: '6px',
              overflowX: 'auto',
              scrollbarWidth: 'none'
            }}>
              {isSource ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('All')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'All' ? '#0f172a' : '#f1f5f9',
                      color: statusFilter === 'All' ? '#ffffff' : '#64748b'
                    }}
                  >
                    All ({statusCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('With Stock')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'With Stock' ? '#4f46e5' : '#f1f5f9',
                      color: statusFilter === 'With Stock' ? '#ffffff' : '#4f46e5'
                    }}
                  >
                    📦 Stored Material ({statusCounts.withStock})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Empty')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'Empty' ? '#059669' : '#f1f5f9',
                      color: statusFilter === 'Empty' ? '#ffffff' : '#059669'
                    }}
                  >
                    Empty ({statusCounts.empty})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('All')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'All' ? '#0f172a' : '#f1f5f9',
                      color: statusFilter === 'All' ? '#ffffff' : '#64748b'
                    }}
                  >
                    All ({statusCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Empty')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'Empty' ? '#059669' : '#f1f5f9',
                      color: statusFilter === 'Empty' ? '#ffffff' : '#059669'
                    }}
                  >
                    🟢 Empty / Free ({statusCounts.empty})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Picking')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'Picking' ? '#7c3aed' : '#f1f5f9',
                      color: statusFilter === 'Picking' ? '#ffffff' : '#7c3aed'
                    }}
                  >
                    🟣 In Use ({statusCounts.picking})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Occupied')}
                    style={{
                      border: 'none',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: statusFilter === 'Occupied' ? '#4338ca' : '#f1f5f9',
                      color: statusFilter === 'Occupied' ? '#ffffff' : '#4338ca'
                    }}
                  >
                    🔵 Full ({statusCounts.occupied})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 2. Scrollable Slots List */}
          <div style={{
            overflowY: 'auto',
            flex: 1,
            padding: '6px',
            maxHeight: '260px'
          }}>
            {filteredSlots.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b', display: 'block', fontWeight: '700' }}>
                  No warehouse slots matched "{searchQuery}"
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                  Try adjusting your search terms or filter selection.
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedWarehouse('All');
                      setStatusFilter('All');
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              filteredSlots.map(slot => {
                const isSelected = String(value).trim().toLowerCase() === slot.code.toLowerCase();
                const badge = getStatusBadgeStyle(slot.status, slot.currentPackets, slot.capacity);

                return (
                  <div
                    key={slot.code}
                    onClick={() => handleSelect(slot.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.09)' : 'transparent',
                      border: isSelected ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid transparent',
                      marginBottom: '3px',
                      transition: 'all 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Left: Slot name & Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <Building2 size={15} style={{ color: isSelected ? '#4f46e5' : '#64748b', flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: '12.5px',
                          fontWeight: isSelected ? '800' : '700',
                          color: isSelected ? '#4f46e5' : '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {highlightMatch(slot.code, searchQuery)}
                        </div>

                        {/* Subtitle with packets info */}
                        <div style={{
                          fontSize: '11px',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '2px',
                          flexWrap: 'wrap'
                        }}>
                          {isSource ? (
                            slot.hasStoredMaterials ? (
                              <span style={{ color: '#4f46e5', fontWeight: '700' }}>
                                📦 {slot.currentPackets} Pkt{slot.currentPackets > 1 ? 's' : ''} stored
                                {slot.materialDetailsList.length > 0 && ` (${slot.materialDetailsList.length} mat)`}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Empty Rack</span>
                            )
                          ) : (
                            <>
                              <span>{slot.currentPackets}/{slot.capacity} Pkts</span>
                              <span>•</span>
                              <span style={{
                                fontWeight: '700',
                                color: slot.freePackets > 0 ? '#059669' : '#dc2626'
                              }}>
                                {slot.freePackets > 0 ? `${slot.freePackets} Free` : 'Full'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Pill & Checkmark */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {badge.label}
                      </span>

                      {isSelected && (
                        <Check size={15} style={{ color: '#4f46e5', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 3. Footer Bar */}
          <div style={{
            padding: '7px 12px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontWeight: '600',
            color: '#64748b',
            flexShrink: 0
          }}>
            <span>Showing {filteredSlots.length} of {normalizedSlots.length} racks</span>
            {!isSource && (
              <span style={{ color: '#059669', fontWeight: '700' }}>
                {normalizedSlots.filter(s => s.freePackets > 0).length} available with space
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
