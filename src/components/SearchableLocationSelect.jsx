import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, Check, ChevronDown, X, Plus } from 'lucide-react';

export default function SearchableLocationSelect({
  locations = [],
  value = '',
  onChange,
  placeholder = '-- Select Configured Location Slot --',
  required = false,
  allowCustom = true,
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

  // Normalize locations array to standard objects { code, label, warehouse }
  const normalizedLocations = useMemo(() => {
    const list = [];
    const seen = new Set();

    (locations || []).forEach(loc => {
      if (!loc) return;
      let code = '';
      let label = '';
      let warehouse = 'General';

      if (typeof loc === 'string') {
        code = loc.trim();
        label = loc.trim();
        if (code.includes(' - ')) {
          warehouse = code.split(' - ')[0].trim();
        } else if (code.toLowerCase().includes('hall')) {
          const match = code.match(/hall\s*\d+/i);
          if (match) warehouse = match[0];
        }
      } else if (typeof loc === 'object') {
        code = String(loc.code || loc.label || '').trim();
        label = String(loc.label || loc.code || '').trim();
        warehouse = loc.warehouse || (label.includes(' - ') ? label.split(' - ')[0].trim() : 'General');
      }

      if (code && !seen.has(code)) {
        seen.add(code);
        list.push({ code, label, warehouse });
      }
    });

    // If current value is set but not in list, add it as a preserved entry
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

  // Extract unique warehouses for filter tabs
  const warehouseList = useMemo(() => {
    const set = new Set();
    normalizedLocations.forEach(l => {
      if (l.warehouse && l.warehouse !== 'Current') set.add(l.warehouse);
    });
    return Array.from(set);
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

  const handleCustomApply = () => {
    if (searchQuery.trim()) {
      handleSelect(searchQuery.trim());
    }
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
                    } else if (allowCustom && searchQuery.trim()) {
                      handleCustomApply();
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="Search rack / slot (e.g. RACK 12, Hall 1)..."
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
              <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '8px' }}>
                  No configured location matched "{searchQuery}"
                </span>
                {allowCustom && searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={handleCustomApply}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #3b82f6',
                      background: 'rgba(59, 130, 246, 0.08)',
                      color: '#2563eb',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={13} /> Use custom: "{searchQuery.trim()}"
                  </button>
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
              padding: '6px 10px',
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
            {allowCustom && searchQuery.trim() && (
              <span
                onClick={handleCustomApply}
                style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '700' }}
              >
                + Custom slot
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
