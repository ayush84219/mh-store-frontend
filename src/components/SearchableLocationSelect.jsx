import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, Check, ChevronDown, X } from 'lucide-react';

export default function SearchableLocationSelect({
  locations = [],
  value = '',
  onChange,
  placeholder = '-- Select Configured Location Slot --',
  required = false,
  allowCustom = false,
  disabled = false,
  className = '',
  style = {},
  buttonStyle = {},
  compact = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Helper for natural ascending sorting (e.g., Rack 1, Rack 2, ... Rack 10, ... Rack 100)
  const naturalCompare = (aStr, bStr) => {
    return String(aStr || '').localeCompare(String(bStr || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  };

  // Canonicalize location helper to eliminate corrupted duplicate strings
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

  // Normalize locations array to standard objects { code, label, warehouse }
  const normalizedLocations = useMemo(() => {
    const list = [];
    const seen = new Set();

    (locations || []).forEach(loc => {
      if (!loc) return;
      const raw = typeof loc === 'string' ? loc : (loc.code || loc.label || '');
      const defaultWh = (typeof loc === 'object' && loc.warehouse) ? loc.warehouse : 'Main Store';
      const clean = canonicalizeLocation(raw, defaultWh);
      if (!clean) return;

      const wh = clean.includes(' - ') ? clean.split(' - ')[0].trim() : defaultWh;
      const key = clean.toUpperCase();

      if (!seen.has(key)) {
        seen.add(key);
        list.push({ code: clean, label: clean, warehouse: wh });
      }
    });

    // Natural alphanumeric ascending sort: 1, 2, 3... 10... 100
    list.sort((a, b) => {
      const whCompare = naturalCompare(a.warehouse, b.warehouse);
      if (whCompare !== 0) return whCompare;
      return naturalCompare(a.label || a.code, b.label || b.code);
    });

    // If current value is set but not in list, add it as a preserved entry at the top
    if (value && !seen.has(String(value).trim())) {
      const customVal = String(value).trim();
      list.unshift({
        code: customVal,
        label: `${customVal} (Current)`,
        warehouse: customVal.includes(' - ') ? customVal.split(' - ')[0].trim() : 'Current'
      });
    }

    return list;
  }, [locations, value]);

  // Extract unique warehouses for filter tabs (sorted naturally)
  const warehouseList = useMemo(() => {
    const set = new Set();
    normalizedLocations.forEach(l => {
      if (l.warehouse && l.warehouse !== 'Current') set.add(l.warehouse);
    });
    return Array.from(set).sort((a, b) => naturalCompare(a, b));
  }, [normalizedLocations]);

  // Filter locations based on search query and warehouse tab
  const filteredLocations = useMemo(() => {
    let result = normalizedLocations;
    if (selectedWarehouse !== 'All') {
      result = result.filter(l => l.warehouse === selectedWarehouse || l.code === value);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l =>
        l.code.toLowerCase().includes(q) ||
        l.label.toLowerCase().includes(q) ||
        l.warehouse.toLowerCase().includes(q)
      );
    }
    return result;
  }, [normalizedLocations, selectedWarehouse, searchQuery, value]);

  // Find currently selected item display
  const currentItem = normalizedLocations.find(l => l.code === value);
  const displayLabel = currentItem ? (currentItem.label.replace(' (Current)', '') || currentItem.code) : value;

  // Handle outside click
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

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (code) => {
    if (onChange) onChange(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-location-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: isOpen ? 99999 : 1,
        ...style
      }}
    >
      {/* Trigger Button */}
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
          padding: compact ? '6px 10px' : '9px 12px',
          minHeight: compact ? '32px' : '40px',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #3b82f6' : '1.5px solid var(--border-color, #cbd5e1)',
          background: 'var(--bg-primary, #ffffff)',
          color: value ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94a3b8)',
          fontSize: compact ? '12px' : '13.5px',
          fontWeight: '700',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
          transition: 'all 0.2s ease',
          ...buttonStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <MapPin size={compact ? 13 : 15} style={{ color: value ? '#3b82f6' : 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayLabel || placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onChange) onChange('');
              }}
              title="Clear selection"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '50%',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={compact ? 13 : 15}
            style={{
              color: 'var(--text-muted, #64748b)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Hidden input for HTML form validation if required */}
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

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            minWidth: '280px',
            background: 'var(--panel-bg, #ffffff)',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(0,0,0,0.08)',
            zIndex: 999999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '340px',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Seamless Search Header (No box-in-a-box) */}
          <div style={{
            padding: '10px 14px 8px',
            background: 'var(--bg-secondary, #ffffff)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Search size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredLocations.length > 0) {
                      handleSelect(filteredLocations[0].code);
                    } else if (searchQuery.trim()) {
                      handleSelect(searchQuery.trim());
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="Search or type rack (e.g. Main Store - Rack 1, Rack 12)..."
                className="seamless-search-input"
                style={{
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  background: 'transparent',
                  backgroundColor: 'transparent',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  width: '100%',
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-main, #0f172a)',
                  padding: '0',
                  margin: '0',
                  height: 'auto',
                  lineHeight: '1.4'
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
                    color: 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Custom Location Action if typed */}
            {searchQuery.trim() && !filteredLocations.some(l => l.code.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <div
                onClick={() => handleSelect(searchQuery.trim())}
                style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px dashed #3b82f6',
                  color: '#1d4ed8',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>➕ Use "<strong>{searchQuery.trim()}</strong>" as Location / Rack</span>
              </div>
            )}

            {/* Warehouse Filter Chips */}
            {warehouseList.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  marginTop: '8px',
                  overflowX: 'auto',
                  paddingBottom: '2px',
                  scrollbarWidth: 'none'
                }}
              >
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
                      background: selectedWarehouse === wh ? '#3b82f6' : 'rgba(100, 116, 139, 0.1)',
                      color: selectedWarehouse === wh ? '#ffffff' : 'var(--text-muted, #64748b)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {wh}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location List */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '6px',
              maxHeight: '230px'
            }}
          >
            {filteredLocations.length === 0 ? (
              <div style={{ padding: '16px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: '600' }}>
                  No configured location matched "{searchQuery}"
                </span>
                {searchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchQuery.trim())}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Use "{searchQuery.trim()}" as Rack Location
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '6px' }}>
                    Please select an existing configured rack or location
                  </span>
                )}
              </div>
            ) : (
              filteredLocations.map(loc => {
                const isSelected = String(value) === String(loc.code);
                return (
                  <div
                    key={loc.code}
                    onClick={() => handleSelect(loc.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? '800' : '600',
                      color: isSelected ? '#1d4ed8' : 'var(--text-main, #0f172a)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      transition: 'all 0.15s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={13} style={{ color: isSelected ? '#3b82f6' : 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
                      <span>{loc.label}</span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: '#2563eb', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer info showing total locations */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-secondary, #f8fafc)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-muted, #64748b)'
            }}
          >
            <span>{filteredLocations.length} locations available</span>
          </div>
        </div>
      )}
    </div>
  );
}
