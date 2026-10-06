import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, 
  Scissors, 
  Ruler, 
  Check, 
  ChevronDown, 
  X, 
  Plus, 
  Edit3, 
  List, 
  Sparkles, 
  Trash2, 
  Search,
  CheckCircle2,
  ShieldCheck,
  Building2
} from 'lucide-react';

/**
 * SmartSelectWithManual - A premium dropdown component with preset options,
 * search filtering, seamless "+ Manual Entry" mode, and persistent custom entries.
 */
export default function SmartSelectWithManual({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select option...',
  manualPlaceholder = 'Type custom value...',
  manualLabel = '+ Manual Entry',
  icon = 'user', // 'user', 'scissors', 'ruler', 'shield', 'building', or custom React element
  localStorageKey = null,
  required = false,
  disabled = false,
  theme = 'blue', // 'blue', 'emerald', 'indigo', 'purple', 'slate'
  unitMode = false,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customSavedEntries, setCustomSavedEntries] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const manualInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Load custom entries from localStorage
  useEffect(() => {
    if (localStorageKey) {
      try {
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCustomSavedEntries(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to parse localStorage for', localStorageKey, e);
      }
    }
  }, [localStorageKey]);

  // Combine default options and custom saved entries
  const allOptions = useMemo(() => {
    const rawOptions = options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt);
    const customOptions = customSavedEntries.map(opt => ({
      label: typeof opt === 'string' ? opt : opt.label,
      value: typeof opt === 'string' ? opt : opt.value,
      isCustom: true
    }));

    // Deduplicate
    const combined = [...rawOptions];
    customOptions.forEach(custom => {
      if (!combined.some(o => o.value.toLowerCase() === custom.value.toLowerCase())) {
        combined.push(custom);
      }
    });

    return combined;
  }, [options, customSavedEntries]);

  // Determine if the current value is not in default options
  const isCurrentValueCustom = useMemo(() => {
    if (!value) return false;
    const isDefault = options.some(opt => {
      const val = typeof opt === 'string' ? opt : opt.value;
      return String(val).toLowerCase().trim() === String(value).toLowerCase().trim();
    });
    return !isDefault;
  }, [value, options]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return allOptions;
    const q = searchQuery.toLowerCase().trim();
    return allOptions.filter(opt => 
      opt.label.toLowerCase().includes(q) || 
      opt.value.toLowerCase().includes(q)
    );
  }, [allOptions, searchQuery]);

  // Theme color maps
  const themeColors = {
    blue: {
      primary: '#0284c7',
      primaryHover: '#0369a1',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      ring: 'rgba(2, 132, 199, 0.2)',
      badgeBg: '#e0f2fe',
      badgeColor: '#0369a1'
    },
    emerald: {
      primary: '#059669',
      primaryHover: '#047857',
      bgLight: '#ecfdf5',
      borderLight: '#a7f3d0',
      ring: 'rgba(5, 150, 105, 0.2)',
      badgeBg: '#d1fae5',
      badgeColor: '#047857'
    },
    indigo: {
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      bgLight: '#eef2ff',
      borderLight: '#c7d2fe',
      ring: 'rgba(99, 102, 241, 0.2)',
      badgeBg: '#e0e7ff',
      badgeColor: '#4338ca'
    },
    purple: {
      primary: '#9333ea',
      primaryHover: '#7e22ce',
      bgLight: '#faf5ff',
      borderLight: '#e9d5ff',
      ring: 'rgba(147, 51, 234, 0.2)',
      badgeBg: '#f3e8ff',
      badgeColor: '#7e22ce'
    },
    slate: {
      primary: '#475569',
      primaryHover: '#334155',
      bgLight: '#f8fafc',
      borderLight: '#cbd5e1',
      ring: 'rgba(71, 85, 105, 0.2)',
      badgeBg: '#f1f5f9',
      badgeColor: '#334155'
    }
  };

  const currentTheme = themeColors[theme] || themeColors.blue;

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

  // Focus input when manual mode activated
  useEffect(() => {
    if (isManualMode && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [isManualMode]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current && allOptions.length > 3) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, allOptions.length]);

  const saveCustomEntry = (entryVal) => {
    if (!entryVal || !entryVal.trim() || !localStorageKey) return;
    const clean = entryVal.trim();
    if (allOptions.some(o => o.value.toLowerCase() === clean.toLowerCase())) return;

    const updated = [clean, ...customSavedEntries.slice(0, 15)];
    setCustomSavedEntries(updated);
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  };

  const removeCustomEntry = (e, entryVal) => {
    e.stopPropagation();
    if (!localStorageKey) return;
    const updated = customSavedEntries.filter(
      item => (typeof item === 'string' ? item : item.value).toLowerCase() !== entryVal.toLowerCase()
    );
    setCustomSavedEntries(updated);
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to remove entry from localStorage', err);
    }
  };

  const handleSelectOption = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
    setIsManualMode(false);
    setSearchQuery('');
  };

  const handleManualSwitch = () => {
    setIsOpen(false);
    setIsManualMode(true);
  };

  const handleManualBlur = () => {
    if (value && value.trim()) {
      saveCustomEntry(value);
    }
  };

  const handleManualKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value && value.trim()) {
        saveCustomEntry(value);
      }
      manualInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsManualMode(false);
    }
  };

  // Render icon based on type
  const renderIcon = () => {
    if (React.isValidElement(icon)) return icon;
    const iconProps = { size: unitMode ? 14 : 16, style: { color: currentTheme.primary, flexShrink: 0 } };
    switch (icon) {
      case 'user': return <User {...iconProps} />;
      case 'scissors': return <Scissors {...iconProps} />;
      case 'ruler': return <Ruler {...iconProps} />;
      case 'shield': return <ShieldCheck {...iconProps} />;
      case 'building': return <Building2 {...iconProps} />;
      default: return <User {...iconProps} />;
    }
  };

  // ==========================================
  // VIEW 1: MANUAL ENTRY INPUT VIEW
  // ==========================================
  if (isManualMode) {
    return (
      <div
        ref={containerRef}
        className={`smart-select-container manual-active ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          ...style
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
          padding: unitMode ? '6px 10px' : '8px 12px',
          borderRadius: '10px',
          border: `2px solid ${currentTheme.primary}`,
          background: '#ffffff',
          boxShadow: `0 0 0 3px ${currentTheme.ring}`,
          transition: 'all 0.2s ease'
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <Edit3 size={unitMode ? 14 : 16} style={{ color: currentTheme.primary, flexShrink: 0 }} />
          </span>

          <input
            ref={manualInputRef}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleManualBlur}
            onKeyDown={handleManualKeyDown}
            placeholder={manualPlaceholder}
            autoComplete="off"
            required={required}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              flex: 1,
              fontSize: unitMode ? '13px' : '13.5px',
              fontWeight: '700',
              color: '#0f172a',
              background: 'transparent',
              padding: '0',
              margin: '0'
            }}
          />

          {/* Action to switch back to list */}
          <button
            type="button"
            onClick={() => {
              setIsManualMode(false);
              setIsOpen(true);
            }}
            title="Switch back to preset list"
            style={{
              border: `1px solid ${currentTheme.borderLight}`,
              background: currentTheme.bgLight,
              color: currentTheme.primary,
              fontSize: '11px',
              fontWeight: '800',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentTheme.primary;
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = currentTheme.bgLight;
              e.currentTarget.style.color = currentTheme.primary;
            }}
          >
            <List size={12} />
            <span>List</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DROPDOWN SELECTOR VIEW
  // ==========================================
  return (
    <div
      ref={containerRef}
      className={`smart-select-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
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
          padding: unitMode ? '7px 10px' : '9px 12px',
          minHeight: unitMode ? '34px' : '40px',
          borderRadius: '10px',
          border: isOpen ? `2px solid ${currentTheme.primary}` : '1.5px solid #cbd5e1',
          background: '#ffffff',
          color: value ? '#0f172a' : '#94a3b8',
          fontSize: unitMode ? '13px' : '13.5px',
          fontWeight: '700',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? `0 0 0 3px ${currentTheme.ring}` : '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {renderIcon()}
          
          {value ? (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a', fontWeight: '800' }}>
              {value}
            </span>
          ) : (
            <span style={{ color: '#94a3b8', fontWeight: '600' }}>
              {placeholder}
            </span>
          )}

          {isCurrentValueCustom && value && (
            <span style={{
              fontSize: '10.5px',
              padding: '1px 6px',
              borderRadius: '4px',
              background: currentTheme.badgeBg,
              color: currentTheme.badgeColor,
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              flexShrink: 0
            }}>
              Manual
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              title="Clear"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '50%',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              <X size={13} />
            </span>
          )}

          <ChevronDown
            size={unitMode ? 14 : 16}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Hidden input for HTML form validation */}
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

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            minWidth: unitMode ? '180px' : '260px',
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 14px 34px -4px rgba(15, 23, 42, 0.18), 0 6px 14px rgba(0,0,0,0.06)',
            zIndex: 999999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '320px',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Search Header (if options > 3) */}
          {allOptions.length > 3 && (
            <div style={{
              padding: '8px 10px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Search size={14} color="#64748b" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search list..."
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#0f172a',
                  background: 'transparent'
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
                    color: '#94a3b8',
                    padding: '0'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Quick Section Label */}
          <div style={{
            padding: '6px 12px 4px',
            fontSize: '10.5px',
            fontWeight: '800',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            background: '#ffffff'
          }}>
            Saved / Preset Options
          </div>

          {/* List of Options */}
          <div
            ref={listRef}
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '4px 6px',
              maxHeight: '200px'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                No match found for "{searchQuery}"
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value).toLowerCase().trim() === String(value).toLowerCase().trim();
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectOption(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isSelected ? '800' : '600',
                      color: isSelected ? currentTheme.primary : '#1e293b',
                      background: isSelected ? currentTheme.bgLight : 'transparent',
                      transition: 'all 0.15s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isSelected ? currentTheme.primary : '#cbd5e1',
                        flexShrink: 0
                      }}></span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {opt.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => removeCustomEntry(e, opt.value)}
                          title="Remove custom entry"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      {isSelected && <Check size={15} style={{ color: currentTheme.primary, flexShrink: 0 }} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* + MANUAL ENTRY ACTION BUTTON AT BOTTOM */}
          <div style={{
            padding: '8px 10px',
            borderTop: '1.5px dashed #cbd5e1',
            background: currentTheme.bgLight,
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={handleManualSwitch}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${currentTheme.borderLight}`,
                background: '#ffffff',
                color: currentTheme.primary,
                fontSize: '12.5px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = currentTheme.primary;
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = currentTheme.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = currentTheme.primary;
                e.currentTarget.style.borderColor = currentTheme.borderLight;
              }}
            >
              <Plus size={15} />
              <span>{manualLabel}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
