import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Zap, 
  Layers, 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Scan, 
  FileText, 
  Calendar, 
  User, 
  Building, 
  MapPin, 
  Package, 
  Sparkles, 
  Download, 
  X, 
  RefreshCw, 
  ArrowRight, 
  Clock, 
  Tag, 
  ShieldCheck, 
  Check, 
  Eye,
  AlertCircle,
  Copy,
  Scissors,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to get official Item Code (suppressing any internal MT code)
export const getItemCodeDisplay = (m) => {
  if (!m) return '';
  const code = String(m.itemCode || m.stCode || m.item_code || m.materialCode || '').trim();
  if (!code || code.toUpperCase().startsWith('MT')) return '';
  return code;
};

// Sound feedback helper
const playFeedbackSound = (type = 'success') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.36);
    } else if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch (err) {
    // Audio feedback not supported or user gesture required
  }
};

// Searchable Material Dropdown Component with dedicated search bar
function SearchableMaterialDropdown({
  materials = [],
  value,
  onChange,
  onSwitchToManual = null,
  componentType = '',
  placeholder = "🔍 Search & Choose Material..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 360, isAbove: false });
  const [previewPhoto, setPreviewPhoto] = useState(null); // { url, name, itemCode }
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const selectedMaterial = useMemo(() => {
    if (!value) return null;
    const vStr = String(value).trim().toLowerCase();
    return materials.find(m => 
      String(m.id).trim().toLowerCase() === vStr || 
      String(m.itemCode || '').trim().toLowerCase() === vStr ||
      String(m.stCode || '').trim().toLowerCase() === vStr
    );
  }, [materials, value]);

  const selectedItemCode = useMemo(() => {
    return getItemCodeDisplay(selectedMaterial);
  }, [selectedMaterial]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isAbove = spaceBelow < 320 && rect.top > 320;
      const desiredWidth = Math.min(680, Math.max(rect.width, 460));
      setCoords({
        top: isAbove ? rect.top : rect.bottom + 4,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - desiredWidth - 12)),
        width: desiredWidth,
        isAbove
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleReposition = () => updateCoords();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);
      const timer = setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      if (!componentType) return materials || [];
      const ct = String(componentType).toLowerCase();
      let matchKeywords = [];
      if (ct.includes('dori')) matchKeywords = ['dori', 'drawcord', 'cord', 'string'];
      else if (ct.includes('elastic')) matchKeywords = ['elastic', 'waistband'];
      else if (ct.includes('zip')) matchKeywords = ['zip', 'zipper', 'slider'];

      if (matchKeywords.length === 0) return materials || [];

      return [...(materials || [])].sort((a, b) => {
        const aText = `${a.name || ''} ${a.category || ''}`.toLowerCase();
        const bText = `${b.name || ''} ${b.category || ''}`.toLowerCase();
        const aMatch = matchKeywords.some(kw => aText.includes(kw));
        const bMatch = matchKeywords.some(kw => bText.includes(kw));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }
    return (materials || []).filter(m => {
      const idStr = String(m.id || '').toLowerCase();
      const nameStr = String(m.name || '').toLowerCase();
      const colorStr = String(m.color || m.shade || '').toLowerCase();
      const catStr = String(m.category || '').toLowerCase();
      const locStr = String(m.location || m.warehouseLocation || '').toLowerCase();
      const codeStr = String(m.itemCode || '').toLowerCase();
      return idStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q) || locStr.includes(q) || codeStr.includes(q);
    });
  }, [materials, searchQuery, componentType]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [searchQuery]);

  const scrollHighlightedIntoView = (index) => {
    if (!listRef.current) return;
    const itemEl = listRef.current.children[index];
    if (itemEl && typeof itemEl.scrollIntoView === 'function') {
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => {
        const next = Math.min(prev + 1, filtered.length - 1);
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => {
        const next = Math.max(prev - 1, 0);
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        onChange(filtered[highlightIndex].id);
        setIsOpen(false);
        setSearchQuery('');
        playFeedbackSound('scan');
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: '240px' }}>
      {/* Trigger Box */}
      <div
        onClick={() => {
          if (!isOpen) {
            updateCoords();
            setSearchQuery('');
          }
          setIsOpen(!isOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          width: '100%',
          minHeight: '36px',
          padding: '5px 10px',
          borderRadius: '7px',
          border: selectedMaterial ? '1.5px solid #059669' : isOpen ? '1.5px solid #ea580c' : '1.5px solid #cbd5e1',
          background: selectedMaterial ? '#f0fdf4' : '#ffffff',
          color: selectedMaterial ? '#0f172a' : '#64748b',
          fontSize: '12px',
          fontWeight: '600',
          boxSizing: 'border-box',
          boxShadow: isOpen ? '0 0 0 3px rgba(234, 88, 12, 0.15)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          {selectedMaterial ? (
            <>
              {/* Photo Thumbnail */}
              {(() => {
                const rawImg = selectedMaterial.imageUrl || selectedMaterial.image || selectedMaterial.photo || selectedMaterial.imgUrl;
                const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                return cleanImg ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewPhoto({ url: cleanImg, name: selectedMaterial.name, itemCode: selectedItemCode });
                    }}
                    title="Click to view material photo"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1.5px solid #059669',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    <img
                      src={cleanImg}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '5px',
                    backgroundColor: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #cbd5e1',
                    flexShrink: 0,
                    color: '#64748b'
                  }}>
                    <Package size={14} />
                  </div>
                );
              })()}

              {/* Item Code Badge (NO MT CODE) */}
              {selectedItemCode && (
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: '800',
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '1.5px 6px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)'
                }}>
                  {selectedItemCode}
                </span>
              )}

              <span style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedMaterial.name}
              </span>
              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                  ({selectedMaterial.color})
                </span>
              )}
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                color: (selectedMaterial.stock || 0) > 0 ? '#15803d' : '#dc2626',
                background: (selectedMaterial.stock || 0) > 0 ? '#dcfce7' : '#fee2e2',
                padding: '1.5px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.stock || 0} {selectedMaterial.unit || 'Pcs'}
              </span>
              {selectedMaterial.location && (
                <span style={{
                  fontSize: '10px',
                  color: '#0284c7',
                  background: '#e0f2fe',
                  padding: '1.5px 6px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 0
                }}>
                  📍 {selectedMaterial.location}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} style={{ color: '#ea580c' }} />
              <span style={{ fontWeight: '500' }}>{placeholder}</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {selectedMaterial && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchQuery('');
              }}
              title="Clear selection"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ✕
            </button>
          )}
          <ChevronDown
            size={14}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Floating Dropdown with Dedicated Search Bar */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.isAbove
              ? { bottom: `${window.innerHeight - coords.top + 4}px` }
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 20px)',
            background: '#ffffff',
            border: '1.5px solid #ea580c',
            borderRadius: '10px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08)',
            zIndex: 9999999,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* SEARCH BAR INPUT */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#ea580c'
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="🔍 Search material by Name, Item Code (e.g. ST00001), Color, Rack Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '36px',
                padding: '6px 30px 6px 32px',
                fontSize: '12.5px',
                fontWeight: '600',
                borderRadius: '8px',
                border: '1.5px solid #ea580c',
                outline: 'none',
                background: '#fff7ed',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Result Info Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', padding: '0 4px' }}>
            <span>
              {searchQuery ? `Matching: ${filtered.length} material(s)` : `All Inventory Materials (${materials.length} items)`}
            </span>
            <span style={{ fontSize: '10.5px' }}>&uarr; &darr; navigate &bull; Enter to select &bull; Esc to close</span>
          </div>

          {/* List of Materials */}
          <div
            ref={listRef}
            style={{
              maxHeight: '270px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '6px'
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                <Package size={28} style={{ margin: '0 auto 6px auto', opacity: 0.5 }} />
                <div>No materials matching &quot;{searchQuery}&quot;</div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '8px',
                    padding: '4px 10px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              filtered.map((mat, idx) => {
                const isSelected = String(mat.id) === String(value);
                const isHighlighted = idx === highlightIndex;
                const hasStock = Number(mat.stock) > 0;
                const displayCode = getItemCodeDisplay(mat);

                return (
                  <div
                    key={mat.id}
                    onClick={() => {
                      onChange(mat.id);
                      setIsOpen(false);
                      setSearchQuery('');
                      playFeedbackSound('scan');
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      background: isHighlighted
                        ? '#ffedd5'
                        : isSelected
                        ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                        : '#ffffff',
                      border: isHighlighted
                        ? '1px solid #ea580c'
                        : isSelected
                        ? '1px solid #fed7aa'
                        : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      fontSize: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      {/* Photo Thumbnail */}
                      {(() => {
                        const rawImg = mat.imageUrl || mat.image || mat.photo || mat.imgUrl;
                        const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                        return cleanImg ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto({ url: cleanImg, name: mat.name, itemCode: displayCode });
                            }}
                            title="Click to view & zoom material photo"
                            style={{
                              position: 'relative',
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: isSelected ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              flexShrink: 0,
                              cursor: 'zoom-in',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              transition: 'transform 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.12)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <img
                              src={cleanImg}
                              alt={mat.name}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                              }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              backgroundColor: 'rgba(15, 23, 42, 0.72)',
                              color: '#ffffff',
                              width: '11px',
                              height: '11px',
                              borderRadius: '3px 0 0 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '7px',
                              pointerEvents: 'none'
                            }}>
                              🔍
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? '#ffedd5' : '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: isSelected ? '#ea580c' : '#94a3b8'
                            }}
                          >
                            <Package size={18} />
                          </div>
                        );
                      })()}

                      {/* Item Code badge (ST00001 etc.) - Absolutely NO MT CODE */}
                      {displayCode && (
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: '800',
                          fontSize: '11px',
                          background: '#0284c7',
                          color: '#ffffff',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                          boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)'
                        }}>
                          {displayCode}
                        </span>
                      )}

                      <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '700',
                          fontSize: '12.5px',
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {mat.name}
                          {mat.color && mat.color !== 'Default' && (
                            <span style={{ fontWeight: '500', color: '#64748b', marginLeft: '6px', fontSize: '11px' }}>
                              ({mat.color})
                            </span>
                          )}
                        </div>
                        {mat.location && (
                          <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                            <MapPin size={10} style={{ color: '#0284c7' }} />
                            <span>{mat.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: hasStock ? '#15803d' : '#dc2626',
                        background: hasStock ? '#dcfce7' : '#fee2e2',
                        padding: '2px 7px',
                        borderRadius: '4px'
                      }}>
                        {mat.stock || 0} {mat.unit || 'Pcs'}
                      </span>
                      {isSelected && (
                        <Check size={14} style={{ color: '#ea580c', fontWeight: 'bold' }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {onSwitchToManual && (
            <div style={{
              paddingTop: '6px',
              borderTop: '1px dashed #fed7aa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Item not in store stock?</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onSwitchToManual();
                }}
                style={{
                  padding: '3px 9px',
                  borderRadius: '5px',
                  border: '1px solid #ea580c',
                  background: '#fff7ed',
                  color: '#c2410c',
                  fontWeight: '700',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ✏️ + Enter Custom Item Manually
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Lightbox Photo Preview Modal */}
      {previewPhoto && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999999,
            padding: '20px'
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              overflow: 'hidden',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              padding: '10px 16px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {previewPhoto.itemCode && (
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: '800',
                    fontSize: '11px',
                    background: '#0284c7',
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {previewPhoto.itemCode}
                  </span>
                )}
                <span style={{ fontWeight: '700', fontSize: '13px' }}>{previewPhoto.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', background: '#f8fafc' }}>
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function WithoutBomMaterialIssueView({
  materials = [],
  designs = [],
  onIssueMaterials,
  issueLogs = [],
  currentUser = null,
  currencySymbol = '₹',
  onSwitchToWithBom,
  onRedirectToTab
}) {
  const [activeTab, setActiveTab] = useState('issue'); // 'issue' | 'history'

  // Issue Workflow Mode: 'item_only' (Direct single/multiple items issue without lot) vs 'floor_lot' (Batch issue against lot)
  const [issueMode, setIssueMode] = useState('item_only'); // 'item_only' | 'floor_lot'

  // Form Fields
  const [lotNo, setLotNo] = useState('');
  const [styleName, setStyleName] = useState('Direct Item Requisition');
  const [pieces, setPieces] = useState(1);
  const [personName, setPersonName] = useState(currentUser?.name || 'paras');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDept, setReceiverDept] = useState('Cutting');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Barcode quick-input
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);
  const lotNoInputRef = useRef(null);

  // Material Line Items
  const [items, setItems] = useState([
    {
      id: 1,
      componentType: 'DORI',
      customComponentType: '',
      isCustomType: false,
      entryMode: 'choose', // 'choose' (from inventory) | 'manual' (custom entered)
      materialId: '',
      materialName: '',
      itemCode: '',
      color: '',
      unit: 'Mtr',
      availableStock: 0,
      location: '',
      calcMode: 'direct', // 'direct' | 'per_piece'
      perPcReq: 0,
      totalQty: 1
    }
  ]);

  // Form state
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewModal, setPreviewModal] = useState(null); // { doc, pdfUrl, voucherId, issueData, isPreviewOnly }
  const [activePrintData, setActivePrintData] = useState(null);

  // Search filter for history tab
  const [historySearch, setHistorySearch] = useState('');

  // Auto-generate clean sequential Challan / Bill No (e.g. BILL-MI-1, BILL-MI-2...)
  const nextVoucherId = useMemo(() => {
    let max = 0;
    (issueLogs || []).forEach(log => {
      const idStr = String(log.id || '').toUpperCase();
      if (
        idStr.startsWith('BILL-MI-') || 
        idStr.startsWith('CH-MI-') || 
        idStr.startsWith('WO-MI-') || 
        idStr.startsWith('MI-WO-') ||
        idStr.startsWith('BILL-')
      ) {
        const match = idStr.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (!isNaN(n) && n > max) max = n;
        }
      }
    });
    return `BILL-MI-${max + 1}`;
  }, [issueLogs]);

  // Filter without-bom issue logs for history tab
  const withoutBomLogs = useMemo(() => {
    return (issueLogs || []).filter(l => {
      const isWo = Boolean(
        l.isWithoutBom ||
        String(l.id || '').toUpperCase().startsWith('BILL-MI-') ||
        String(l.id || '').toUpperCase().startsWith('CH-MI-') ||
        String(l.id || '').toUpperCase().startsWith('WO-MI-') ||
        String(l.id || '').toUpperCase().startsWith('MI-WO-') ||
        String(l.category || '').toUpperCase().includes('WITHOUT BOM') ||
        String(l.lotId || '').toUpperCase().includes('DIRECT')
      );
      if (!isWo) return false;
      if (!historySearch) return true;
      const q = historySearch.toLowerCase();
      return (
        String(l.id || '').toLowerCase().includes(q) ||
        String(l.lotId || '').toLowerCase().includes(q) ||
        String(l.receiverName || '').toLowerCase().includes(q) ||
        String(l.personName || '').toLowerCase().includes(q) ||
        String(l.category || '').toLowerCase().includes(q) ||
        (l.materials || []).some(m => String(m.name || '').toLowerCase().includes(q))
      );
    });
  }, [issueLogs, historySearch]);

  // Specific accessory component types (1. DORI, 2. ELASTIC, 3. ZIP, + Add Manually)
  const componentTypeOptions = [
    { value: 'DORI', label: '1. DORI' },
    { value: 'ELASTIC', label: '2. ELASTIC' },
    { value: 'ZIP', label: '3. ZIP' },
    { value: '__custom__', label: '✏️ + Add Manually (Custom Type)' }
  ];

  // Quick department choices
  const commonDepts = ['Cutting', 'Stitching', 'Finishing', 'Packing', 'Sampling', 'Main Store'];

  // Add Item Row
  const handleAddItemRow = (compType = 'DORI', defaultMaterialId = '', entryMode = 'choose') => {
    const mat = defaultMaterialId ? materials.find(m => String(m.id) === String(defaultMaterialId)) : null;
    let defUnit = 'Pcs';
    if (compType === 'DORI' || compType === 'ELASTIC') defUnit = 'Mtr';
    else if (compType === 'ZIP') defUnit = 'Pcs';

    setItems(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        componentType: compType,
        customComponentType: '',
        isCustomType: false,
        entryMode: entryMode, // 'choose' | 'manual'
        materialId: mat ? mat.id : '',
        materialName: mat ? mat.name : (entryMode === 'manual' ? `${compType} Item` : ''),
        itemCode: mat ? getItemCodeDisplay(mat) : '',
        imageUrl: mat ? (mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '') : '',
        color: mat ? (mat.color || mat.shade || '') : '',
        unit: mat ? (mat.unit || defUnit) : defUnit,
        availableStock: mat ? (Number(mat.stock) || 0) : 0,
        location: mat ? (mat.location || mat.warehouseLocation || 'Main Store') : (entryMode === 'manual' ? 'Custom Entry' : ''),
        calcMode: 'direct',
        perPcReq: 0,
        totalQty: 1
      }
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (id) => {
    if (items.length <= 1) {
      setFormError('At least one material item is required to issue.');
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Update Item Row Field
  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      if (field === 'calcMode' && value === 'per_piece') {
        const perPc = parseFloat(updated.perPcReq) || 0;
        const total = Math.round(perPc * (parseInt(pieces, 10) || 1) * 100) / 100;
        updated.totalQty = total > 0 ? total : 1;
      } else if (field === 'perPcReq') {
        const perPc = parseFloat(value) || 0;
        const total = Math.round(perPc * (parseInt(pieces, 10) || 1) * 100) / 100;
        updated.totalQty = total > 0 ? total : 1;
      }

      return updated;
    }));
  };

  // Recalculate all per_piece items when pieces count changes
  useEffect(() => {
    if (issueMode === 'floor_lot') {
      setItems(prev => prev.map(item => {
        if (item.calcMode === 'per_piece') {
          const perPc = parseFloat(item.perPcReq) || 0;
          const total = Math.round(perPc * (parseInt(pieces, 10) || 1) * 100) / 100;
          return { ...item, totalQty: total > 0 ? total : 1 };
        }
        return item;
      }));
    }
  }, [pieces, issueMode]);

  // Handle Material Selection for a Row
  const handleSelectMaterial = (rowId, materialId) => {
    const mat = (materials || []).find(m => String(m.id) === String(materialId));
    setItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      if (!mat) {
        return {
          ...item,
          materialId: '',
          materialName: '',
          itemCode: '',
          imageUrl: '',
          color: '',
          unit: 'Pcs',
          availableStock: 0,
          location: ''
        };
      }
      return {
        ...item,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: getItemCodeDisplay(mat),
        imageUrl: mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '',
        color: mat.color || mat.shade || '',
        unit: mat.unit || 'Pcs',
        availableStock: Number(mat.stock) || 0,
        location: mat.location || mat.warehouseLocation || 'Main Store',
        componentType: item.componentType || 'DORI'
      };
    }));
  };

  // Barcode Scan Handler
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const query = barcodeInput.trim().toLowerCase();
    if (!query) return;

    const matched = (materials || []).find(m => 
      String(m.id || '').toLowerCase() === query ||
      String(m.barcode || '').toLowerCase() === query ||
      String(m.itemCode || '').toLowerCase() === query ||
      String(m.stCode || '').toLowerCase() === query
    );

    if (matched) {
      const codeDisp = getItemCodeDisplay(matched);
      const emptyRow = items.find(i => !i.materialId);
      if (emptyRow) {
        handleSelectMaterial(emptyRow.id, matched.id);
      } else {
        const newId = Date.now() + Math.random();
        const catUpper = String(matched.category || '').toUpperCase();
        const inferredType = catUpper.includes('ELASTIC') ? 'ELASTIC' : catUpper.includes('ZIP') ? 'ZIP' : 'DORI';
        setItems(prev => [
          ...prev,
          {
            id: newId,
            componentType: inferredType,
            customComponentType: '',
            isCustomType: false,
            entryMode: 'choose',
            materialId: matched.id,
            materialName: matched.name,
            itemCode: codeDisp,
            imageUrl: matched.imageUrl || matched.image || matched.photo || matched.imgUrl || '',
            color: matched.color || '',
            unit: matched.unit || (inferredType === 'ZIP' ? 'Pcs' : 'Mtr'),
            availableStock: Number(matched.stock) || 0,
            location: matched.location || 'Main Store',
            calcMode: 'direct',
            perPcReq: 0,
            totalQty: 1
          }
        ]);
      }
      playFeedbackSound('scan');
      setFormSuccess(`Scanned & Added: ${matched.name}${codeDisp ? ` [${codeDisp}]` : ''}`);
      setTimeout(() => setFormSuccess(''), 3000);
      setBarcodeInput('');
    } else {
      playFeedbackSound('error');
      setFormError(`Barcode / Item "${barcodeInput}" not found in inventory.`);
      setTimeout(() => setFormError(''), 4000);
    }
  };

  // Generate Official PDF Document
  const generatePDFVoucher = (issueData) => {
    const isDirect = issueData?.issueMode === 'item_only' || String(issueData?.lotId || '').toLowerCase().includes('direct');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const im = 14;
    const iw = pw - im * 2;

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 26, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('MOHIT HOSIERY • QUALITY & PRODUCTION MANAGEMENT', pw / 2, 10, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('CENTRAL STORE INVENTORY & MATERIAL ALLOCATION SYSTEM', pw / 2, 16, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(254, 215, 170);
    doc.text('MATERIAL ISSUE WITHOUT BOM (ORIGINAL & DUPLICATE STORE BILL)', pw / 2, 22, { align: 'center' });

    // Title Tag
    let y = 33;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(234, 88, 12);
    const modeTitle = `MATERIAL ISSUE WITHOUT BOM (LOT #${issueData.lotId})`;
    doc.text(modeTitle, im, y);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL COPY', pw - im, y, { align: 'right' });

    // Batch & Info Card
    y += 5;
    const cardH = 36;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.roundedRect(im, y, iw, cardH, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    // Row 1
    doc.setFont('helvetica', 'bold');
    doc.text('Challan / Bill No:', im + 4, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(issueData.voucherId, im + 32, y + 8);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Issue Date:', im + 72, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(issueData.date, im + 90, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Lot Reference:', im + 128, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(`LOT #${issueData.lotId}`, im + 152, y + 8);
    doc.setTextColor(15, 23, 42);

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Type:', im + 4, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(issueData.style || (isDirect ? 'Store Item Requisition' : 'Floor Issue'), im + 26, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.text('Batch Volume:', im + 72, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(isDirect ? 'Ad-Hoc Store Issue' : `${(issueData.pieces || 0).toLocaleString()} Garment Pieces`, im + 95, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.text('Status:', im + 128, y + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text('[ REAL STOCK DEDUCTED ]', im + 142, y + 17);
    doc.setTextColor(15, 23, 42);

    // Row 3
    doc.setFont('helvetica', 'bold');
    doc.text('Issued By:', im + 4, y + 26);
    doc.setFont('helvetica', 'normal');
    doc.text(issueData.personName || 'Store In-charge', im + 24, y + 26);

    doc.setFont('helvetica', 'bold');
    doc.text('Received By:', im + 72, y + 26);
    doc.setFont('helvetica', 'normal');
    doc.text(`${issueData.receiverName || 'Floor Master'} (${issueData.receiverDept || 'Cutting'})`, im + 94, y + 26);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Items:', im + 128, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(issueData.items || []).length} Materials Issued`, im + 148, y + 26);

    // Materials Table
    const tableRows = (issueData.items || []).map((item, idx) => {
      const c = getItemCodeDisplay(item);
      const desc = c ? `[${c}] ${item.materialName || 'Material Item'}` : (item.materialName || 'Material Item');
      return [
        idx + 1,
        item.componentType || 'Accessory',
        desc,
        item.color || 'Standard',
        item.location || 'Main Store',
        `${item.availableStock !== undefined ? item.availableStock : '—'} ${item.unit || ''}`,
        `${item.totalQty} ${item.unit || ''}`,
        `${item.availableStock !== undefined ? Math.max(0, item.availableStock - item.totalQty).toFixed(2) : '—'} ${item.unit || ''}`
      ];
    });

    autoTable(doc, {
      startY: y + cardH + 5,
      head: [['#', 'Component', 'Material Description & Code', 'Shade/Color', 'Rack Location', 'Prev Stock', 'Issued Qty', 'Remaining Balance']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [234, 88, 12],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 48 },
        3: { cellWidth: 20 },
        4: { cellWidth: 24 },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [234, 88, 12] },
        7: { cellWidth: 18, halign: 'right', textColor: [100, 116, 139] }
      }
    });

    let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 140) + 8;

    // Remarks Note
    if (issueData.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Remarks / Allocation Notes:', im, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(issueData.remarks, im + 44, currentY);
      currentY += 8;
    }

    // Verification & Signatures Boxes (3 Signature boxes)
    const sigBoxW = (iw - 16) / 3;
    const sigBoxH = 26;

    // Box 1: Store Staff
    doc.setDrawColor(203, 213, 225);
    doc.rect(im, currentY, sigBoxW, sigBoxH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ISSUED BY (STORE STAFF)', im + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${issueData.personName || 'Store In-charge'}`, im + 4, currentY + 13);
    doc.text('Sign: ____________________', im + 4, currentY + 21);

    // Box 2: Receiver
    const x2 = im + sigBoxW + 8;
    doc.rect(x2, currentY, sigBoxW, sigBoxH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('RECEIVED BY (CUTTING / TAILOR)', x2 + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${issueData.receiverName || 'Floor Master'}`, x2 + 4, currentY + 13);
    doc.text('Sign: ____________________', x2 + 4, currentY + 21);

    // Box 3: Supervisor Approval
    const x3 = x2 + sigBoxW + 8;
    doc.rect(x3, currentY, sigBoxW, sigBoxH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('SUPERVISOR / AUTHORIZED', x3 + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Sign / Stamp: ______________', x3 + 4, currentY + 13);
    doc.text('Date: ____________________', x3 + 4, currentY + 21);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Material Issue Without BOM • Official Store Challan & Inventory Voucher • Mohit Hosiery Central Store', pw / 2, ph - 8, { align: 'center' });

    return doc;
  };

  // Extract issueData payload from current form fields
  const buildIssueDataFromForm = () => {
    if (!lotNo.trim()) {
      setFormError('Please enter or select a Lot Number. Lot Number is required to issue materials.');
      playFeedbackSound('error');
      return null;
    }

    const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
    if (validItems.length === 0) {
      setFormError('Please select at least one material item with an issue quantity greater than 0.');
      playFeedbackSound('error');
      return null;
    }

    const effectiveLot = lotNo.trim();
    const voucherId = nextVoucherId;
    const formattedDate = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    return {
      voucherId,
      date: formattedDate,
      issueMode,
      lotId: effectiveLot,
      style: styleName || (issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Issue'),
      pieces: issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
      personName: personName.trim() || 'Store In-charge',
      receiverName: receiverName.trim() || 'Floor Master',
      receiverDept: receiverDept.trim() || 'Cutting',
      remarks: remarks.trim(),
      items: validItems.map(i => {
        const effectiveType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
        const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
        return {
          ...i,
          componentType: effectiveType,
          materialName: effectiveName
        };
      })
    };
  };

  // Preview Challan without submitting
  const handlePreviewOnly = () => {
    setFormError('');
    const issueData = buildIssueDataFromForm();
    if (!issueData) return;

    try {
      const doc = generatePDFVoucher(issueData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPreviewModal({ doc, pdfUrl, voucherId: issueData.voucherId, issueData, isPreviewOnly: true });
    } catch (err) {
      setFormError('Failed to generate preview: ' + err.message);
    }
  };

  // Submit Issue
  const handleSubmitIssue = async () => {
    setFormError('');
    setFormSuccess('');

    const effectiveLot = lotNo.trim();
    if (!effectiveLot) {
      setFormError('Please enter or select a Lot Number. Lot Number is required to issue materials.');
      playFeedbackSound('error');
      return;
    }

    if (!personName.trim()) {
      setFormError('Please specify the Person Name (Issuer).');
      playFeedbackSound('error');
      return;
    }

    if (!receiverName.trim()) {
      setFormError('Please specify the Receiver Name (Cutting Master / Tailor).');
      playFeedbackSound('error');
      return;
    }

    const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
    if (validItems.length === 0) {
      setFormError('Please select at least one material item with an issue quantity greater than 0.');
      playFeedbackSound('error');
      return;
    }

    // Check shortage warnings
    const shortageItems = validItems.filter(i => i.materialId && i.availableStock < i.totalQty);
    if (shortageItems.length > 0) {
      const confirmShortage = window.confirm(
        `Warning: ${shortageItems.length} item(s) exceed available stock (${shortageItems.map(s => `${s.materialName}: Needs ${s.totalQty}, Has ${s.availableStock}`).join('; ')}).\n\nDo you want to proceed with issuing anyway?`
      );
      if (!confirmShortage) return;
    }

    setSubmitting(true);
    try {
      const voucherId = nextVoucherId;
      const formattedDate = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      // Transform items for handleIssueMaterials
      const issuedItemsPayload = validItems.map(i => {
        const effectiveType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
        const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
        return {
          materialId: i.materialId || '',
          materialName: effectiveName,
          bomItemName: effectiveType,
          totalRequired: Number(i.totalQty),
          unit: i.unit || 'Pcs',
          itemCode: i.itemCode || (i.entryMode === 'manual' ? 'MANUAL' : ''),
          color: i.color || '',
          availableStock: i.availableStock || 0,
          location: i.location || (i.entryMode === 'manual' ? 'Custom Entry' : '')
        };
      });

      // Call parent handleIssueMaterials (isWithoutBom = true, customId = voucherId)
      if (typeof onIssueMaterials === 'function') {
        await onIssueMaterials(
          effectiveLot,
          issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
          issuedItemsPayload,
          false, // isReissue
          personName.trim(),
          receiverName.trim(),
          receiverDept.trim(),
          true, // isWithoutBom
          voucherId // customId
        );
      }

      // Prepare issue Data
      const issueData = {
        voucherId,
        date: formattedDate,
        issueMode,
        lotId: effectiveLot,
        style: styleName || (issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Issue'),
        pieces: issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim(),
        remarks: remarks.trim(),
        items: validItems.map(i => {
          const effectiveType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
          const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
          return {
            ...i,
            componentType: effectiveType,
            materialName: effectiveName
          };
        })
      };

      // Generate PDF Document
      const doc = generatePDFVoucher(issueData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      playFeedbackSound('success');

      // Do NOT block screen with preview modal on confirm; keep the reset form visible for the next bill
      setPreviewModal(null);
      setFormError('');
      setFormSuccess(`✓ Bill #${voucherId} (Lot #${effectiveLot}) confirmed & stock deducted. Printing window opened. Form is reset & ready for next bill.`);

      // Automatically launch the printing window directly
      setTimeout(() => {
        handleDirectPrintWindow(issueData, voucherId);
      }, 100);

      // Process complete: refill and reset all columns/inputs back to clean state for next bill
      setLotNo('');
      setReceiverName('');
      setReceiverDept('Cutting');
      setStyleName(issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Batch Issue');
      setPieces(1);
      setRemarks('');
      setBarcodeInput('');
      setItems([
        {
          id: Date.now(),
          componentType: 'DORI',
          customComponentType: '',
          isCustomType: false,
          entryMode: 'choose',
          materialId: '',
          materialName: '',
          itemCode: '',
          color: '',
          unit: 'Mtr',
          availableStock: 0,
          location: '',
          calcMode: 'direct',
          perPcReq: 0,
          totalQty: 1
        }
      ]);

      // Focus Lot Number input so user can type the next bill immediately
      setTimeout(() => {
        if (lotNoInputRef.current) {
          lotNoInputRef.current.focus();
        }
      }, 350);
    } catch (err) {
      console.error('Issue error:', err);
      playFeedbackSound('error');
      setFormError('Failed to record without-BOM material issue: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Clear and refill all form columns/inputs for a fresh issue
  const handleResetForm = () => {
    setLotNo('');
    setReceiverName('');
    setReceiverDept('Cutting');
    setStyleName(issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Batch Issue');
    setPieces(1);
    setRemarks('');
    setBarcodeInput('');
    setFormError('');
    setFormSuccess('');
    setItems([
      {
        id: Date.now(),
        componentType: 'DORI',
        customComponentType: '',
        isCustomType: false,
        entryMode: 'choose',
        materialId: '',
        materialName: '',
        itemCode: '',
        color: '',
        unit: 'Mtr',
        availableStock: 0,
        location: '',
        calcMode: 'direct',
        perPcReq: 0,
        totalQty: 1
      }
    ]);
  };

  // Helper to build issueData from a history log
  const buildIssueDataFromLog = (log) => {
    return {
      voucherId: log.id,
      date: log.date || new Date().toLocaleDateString('en-GB'),
      issueMode: String(log.lotId || '').toLowerCase().includes('direct') ? 'item_only' : 'floor_lot',
      lotId: log.lotId || 'DIRECT-ITEM',
      style: log.style || log.category || 'Store Issue',
      pieces: log.volume || 1,
      personName: log.personName || 'Store In-charge',
      receiverName: log.receiverName || 'Cutting Master',
      receiverDept: log.receiverDept || 'Cutting',
      remarks: log.remarks || '',
      items: (log.materials || []).map((m, idx) => ({
        componentType: m.bomItemName || 'Accessory',
        materialName: m.name || 'Material Item',
        itemCode: getItemCodeDisplay(m) || `ITM-${idx + 1}`,
        color: m.color || 'Standard',
        location: m.location || 'Main Store',
        availableStock: m.qty || 0,
        totalQty: m.qty || 1,
        unit: m.unit || 'Pcs'
      }))
    };
  };

  // Generate complete, robust HTML for printable challan sheet (Dual Copy)
  const generatePrintHtml = (issueData) => {
    const lotText = issueData.lotId ? `LOT #${issueData.lotId}` : 'LOT REQUIRED';
    const voucherId = issueData.voucherId || nextVoucherId || 'CHALLAN';
    const dateStr = issueData.date || new Date().toLocaleDateString('en-GB');
    const items = issueData.items || [];
    const remarksHtml = issueData.remarks ? `<div class="remarks"><strong>Remarks / Allocation Notes:</strong> ${issueData.remarks}</div>` : '';

    const renderChallanCopy = (copyTitle) => `
      <div class="challan-card">
        <div class="header">
          <div class="brand">
            <h1>MOHIT HOSIERY</h1>
            <div class="dept">CENTRAL STORE & PRODUCTION ACCESSORIES DEPARTMENT</div>
            <div class="main-heading">MATERIAL ISSUE WITHOUT BOM</div>
            <div class="sub-heading">OFFICIAL STORE CHALLAN / ISSUE BILL</div>
          </div>
          <div class="meta">
            <div class="challan-no">CHALLAN NO: ${voucherId}</div>
            <div class="date">DATE: ${dateStr}</div>
            <div class="copy-badge">${copyTitle}</div>
            <div class="status-badge">${issueData.isPreviewOnly ? '[ DRAFT PREVIEW ]' : '[ STOCK DEDUCTED ]'}</div>
          </div>
        </div>

        <div class="particulars-grid">
          <div class="field"><span class="lbl">LOT NO:</span> <strong class="lot-val">${lotText}</strong></div>
          <div class="field"><span class="lbl">ISSUED BY (STORE):</span> <strong>${issueData.personName || 'Store In-charge'}</strong></div>
          <div class="field"><span class="lbl">RECEIVED BY:</span> <strong>${issueData.receiverName || 'Floor Master'} (${issueData.receiverDept || 'Cutting'})</strong></div>
          <div class="field"><span class="lbl">REQUISITION TYPE:</span> <span>${issueData.style || 'Direct Requisition'}</span></div>
          <div class="field"><span class="lbl">BATCH VOLUME:</span> <span>${issueData.pieces > 1 ? `${issueData.pieces} Pcs` : 'Ad-Hoc Issue'}</span></div>
          <div class="field"><span class="lbl">TOTAL LINE ITEMS:</span> <span>${items.length} Material Item(s)</span></div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th style="width: 100px;">Component</th>
              <th>Store Material Description</th>
              <th style="width: 90px;">Item Code</th>
              <th style="width: 80px;">Rack Loc</th>
              <th style="width: 90px; text-align: right;">Issued Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
              const code = getItemCodeDisplay(item) || item.itemCode || '-';
              return `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td><strong>${item.componentType || 'Accessory'}</strong></td>
                  <td>${item.materialName || 'Material'}</td>
                  <td style="font-family: monospace; font-weight: bold;">${code}</td>
                  <td>${item.location || 'Store'}</td>
                  <td style="text-align: right; font-weight: bold;">${item.totalQty} ${item.unit || 'Pcs'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        ${remarksHtml}

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Issued By (Store)</strong>
            <div>${issueData.personName || 'Store In-charge'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Received By (Floor)</strong>
            <div>${issueData.receiverName || 'Floor Master'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Authorized Supervisor</strong>
            <div>Sign & Stamp</div>
          </div>
        </div>

        <div class="footer-note">
          Official Material Issue Without BOM Challan • Mohit Hosiery Central Store Quality System
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>MATERIAL ISSUE WITHOUT BOM - ${voucherId}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            margin: 0;
            padding: 12px;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 8mm;
          }
          .challan-card {
            border: 1.5px solid #0f172a;
            border-radius: 4px;
            padding: 14px 18px;
            margin-bottom: 12px;
            page-break-inside: avoid;
            background: #ffffff;
          }
          .cut-divider {
            border-top: 1.5px dashed #64748b;
            text-align: center;
            margin: 14px 0;
            position: relative;
          }
          .cut-divider span {
            background: #ffffff;
            padding: 0 10px;
            font-size: 9px;
            font-weight: bold;
            color: #64748b;
            position: relative;
            top: -8px;
            letter-spacing: 1px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .brand h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #0f172a;
          }
          .brand .dept {
            font-size: 9.5px;
            font-weight: 700;
            color: #475569;
            margin-top: 1px;
          }
          .brand .main-heading {
            display: inline-block;
            background: #ea580c;
            color: #ffffff;
            font-weight: 900;
            font-size: 12px;
            padding: 3px 8px;
            border-radius: 3px;
            margin-top: 4px;
            letter-spacing: 0.5px;
          }
          .brand .sub-heading {
            font-size: 9.5px;
            font-weight: 700;
            color: #64748b;
            margin-top: 2px;
          }
          .meta {
            text-align: right;
          }
          .meta .challan-no {
            font-family: monospace;
            font-size: 14px;
            font-weight: 900;
            color: #ea580c;
          }
          .meta .date {
            font-size: 10px;
            color: #334155;
            font-weight: 600;
            margin-top: 2px;
          }
          .copy-badge {
            display: inline-block;
            margin-top: 4px;
            padding: 2px 6px;
            background: #0f172a;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            border-radius: 3px;
          }
          .status-badge {
            font-size: 9px;
            font-weight: 800;
            color: #059669;
            margin-top: 2px;
          }
          .particulars-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 10px;
            font-size: 11px;
          }
          .particulars-grid .field {
            line-height: 1.3;
          }
          .particulars-grid .lbl {
            font-size: 9.5px;
            color: #64748b;
            font-weight: 700;
            display: block;
          }
          .lot-val {
            color: #ea580c;
            font-size: 12px;
            font-weight: 900;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            margin-bottom: 8px;
          }
          .items-table th {
            background: #f1f5f9;
            border: 1px solid #0f172a;
            padding: 5px 6px;
            text-align: left;
            font-size: 9.5px;
            text-transform: uppercase;
            color: #0f172a;
          }
          .items-table td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            vertical-align: middle;
          }
          .items-table tbody tr:nth-child(even) {
            background: #f8fafc;
          }
          .remarks {
            background: #fff7ed;
            border-left: 3px solid #ea580c;
            padding: 4px 8px;
            font-size: 10px;
            margin-bottom: 8px;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
            font-size: 9.5px;
          }
          .sig-box .sig-line {
            height: 22px;
            border-bottom: 1px solid #0f172a;
            width: 75%;
            margin: 0 auto 4px auto;
          }
          .footer-note {
            text-align: center;
            font-size: 8.5px;
            color: #94a3b8;
            margin-top: 8px;
          }
          .print-btn-bar {
            text-align: center;
            padding: 10px;
            background: #f1f5f9;
            margin-bottom: 12px;
            border-radius: 6px;
          }
          .btn-print {
            background: #ea580c;
            color: #ffffff;
            border: none;
            padding: 8px 24px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(234, 88, 12, 0.3);
          }
          @media print {
            .print-btn-bar, .cut-divider { page-break-after: avoid; }
            .print-btn-bar { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Print Challan Now</button>
        </div>

        ${renderChallanCopy('ORIGINAL - STORE COPY')}

        <div class="cut-divider">
          <span>✂ CUT ALONG DOTTED LINE FOR DUPLICATE COPY</span>
        </div>

        ${renderChallanCopy('DUPLICATE - RECEIVER / FLOOR COPY')}
      </body>
      </html>
    `;
  };

  // Dedicated Print Window Function (Instant, Clean & Foolproof via Hidden Iframe)
  const handleDirectPrintWindow = (issueData, customVoucherId) => {
    if (!issueData) return;
    const vid = customVoucherId || issueData.voucherId || nextVoucherId;
    const payload = { ...issueData, voucherId: vid };
    setActivePrintData(payload);

    try {
      const printHtml = generatePrintHtml(payload);

      // Clean up previous print iframe if existing
      const oldFrame = document.getElementById('without-bom-print-iframe');
      if (oldFrame) {
        try { document.body.removeChild(oldFrame); } catch (e) {}
      }

      // Create invisible iframe to trigger native browser print window without popup blocking
      const printFrame = document.createElement('iframe');
      printFrame.id = 'without-bom-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      // Trigger the browser's native print window directly
      setTimeout(() => {
        try {
          if (printFrame.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          }
        } catch (err) {
          console.warn('Iframe print failed:', err);
        }
      }, 250);

      return true;
    } catch (e) {
      console.warn('Direct print frame failed, falling back to on-page print:', e);
      handlePrintChallan();
      return false;
    }
  };

  // Direct 1-Click Print from the Main Form
  const handleDirectPrintFromForm = () => {
    setFormError('');
    const issueData = buildIssueDataFromForm();
    if (!issueData) return;
    handleDirectPrintWindow(issueData, issueData.voucherId);
  };

  // Direct 1-Click On-Page Print Dialog
  const handlePrintChallan = () => {
    document.body.classList.add('print-without-bom-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-without-bom-mode');
    }, 150);
  };

  // Reprint from History
  const handleReprintHistory = (log) => {
    try {
      const issueData = buildIssueDataFromLog(log);
      const doc = generatePDFVoucher(issueData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setPreviewModal({ doc, pdfUrl, voucherId: log.id, issueData, isPreviewOnly: false });
    } catch (err) {
      alert('Failed to generate reprint: ' + err.message);
    }
  };

  return (
    <div className="without-bom-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* ── TOP HERO HEADER & SUB-TABS ── */}
      <div className="panel" style={{
        padding: '16px 20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
        border: '1.5px solid #fed7aa',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
          }}>
            <Zap size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.3px' }}>
                MATERIAL ISSUE WITHOUT BOM
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                background: '#ea580c',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                Instant Store Challan &amp; Print System
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Direct material &amp; accessory issue with mandatory Lot Number allocation. Generates official printed Material Issue Without BOM Challan.
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sub-tab navigation */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              onClick={() => setActiveTab('issue')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'issue' ? '#0f172a' : 'transparent',
                color: activeTab === 'issue' ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} />
              <span>Issue Material &amp; Challan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'history' ? '#0f172a' : 'transparent',
                color: activeTab === 'history' ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Clock size={14} />
              <span>Challan / Bill Logs ({withoutBomLogs.length})</span>
            </button>
          </div>

          {/* Switch back to With BOM */}
          {typeof onSwitchToWithBom === 'function' && (
            <button
              type="button"
              onClick={onSwitchToWithBom}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Return to standard Approved Lot BOM Issue"
            >
              <ShieldCheck size={14} style={{ color: '#059669' }} />
              <span>Approved BOM Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {formError && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={17} />
          <span>{formError}</span>
        </div>
      )}

      {formSuccess && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={17} />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* ── TAB CONTENT: ISSUE FORM ── */}
      {activeTab === 'issue' && (
        <>
          {/* Issue Mode Toggle Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1.5px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>Select Requisition Type:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIssueMode('item_only');
                    setStyleName('Direct Item Requisition');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: issueMode === 'item_only' ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : '#f1f5f9',
                    color: issueMode === 'item_only' ? '#ffffff' : '#475569',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: issueMode === 'item_only' ? '0 2px 6px rgba(234, 88, 12, 0.25)' : 'none'
                  }}
                >
                  <Tag size={14} />
                  <span>🏷️ Direct Item Issue</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIssueMode('floor_lot');
                    setStyleName('Floor Batch Issue');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: issueMode === 'floor_lot' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#f1f5f9',
                    color: issueMode === 'floor_lot' ? '#ffffff' : '#475569',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: issueMode === 'floor_lot' ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none'
                  }}
                >
                  <Package size={14} />
                  <span>📦 Floor Batch Issue</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>NEXT CHALLAN NO:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '800', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '6px', fontSize: '12.5px' }}>
                {nextVoucherId}
              </span>
            </div>
          </div>

          {/* 1. Production Batch Setup Card */}
          <div className="panel" style={{ padding: '18px 22px', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={17} style={{ color: '#ea580c' }} />
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#0f172a' }}>
                  1. Issue Header &amp; Receiver Particulars
                </h4>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                All material issues require an official Lot Number for inventory allocation
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              {/* Lot Number (Mandatory & Required!) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Lot Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={lotNoInputRef}
                    type="text"
                    list="existing-lots-list"
                    className="form-input"
                    placeholder="Enter or select Lot Number (e.g. 101, LOT-542)..."
                    value={lotNo}
                    onChange={(e) => setLotNo(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '38px',
                      fontSize: '13px',
                      fontWeight: '700',
                      border: '1.5px solid #ea580c',
                      background: '#fff7ed',
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                  <datalist id="existing-lots-list">
                    {(designs || []).slice(0, 50).map(d => (
                      <option key={d.id} value={d.id}>{`Lot ${d.id} — ${d.category} (${d.brand || 'No Brand'})`}</option>
                    ))}
                  </datalist>
                </div>
                <span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '600', marginTop: '3px', display: 'block' }}>
                  * Required: Specify production lot or cutting batch number
                </span>
              </div>

              {/* Garment Style / Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Requisition Purpose / Style
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Store Requisition / Lower / T-Shirt"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Garment Pieces (Only needed if scaling formula or floor_lot) */}
              {issueMode === 'floor_lot' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Garment Pieces (Cutting Qty)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 100"
                    value={pieces}
                    onChange={(e) => setPieces(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ width: '100%', height: '38px', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* Person Name (Issuer) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Person Name (Issuer) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. paras / Store Incharge"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '13px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              {/* Receiver Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Received By (Receiver Person) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Master / Tailor / Floor Master"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '13px', fontWeight: '700', borderColor: '#fed7aa', boxSizing: 'border-box' }}
                  required
                />
              </div>

              {/* Receiver Department */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Receiver Department / Line
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cutting / Stitching / Packing"
                  value={receiverDept}
                  onChange={(e) => setReceiverDept(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {commonDepts.map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setReceiverDept(dept)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10.5px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: receiverDept === dept ? '#0f172a' : '#f8fafc',
                        color: receiverDept === dept ? '#ffffff' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Issue Date */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Issue Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* 2. Materials Allocation Grid */}
          <div className="panel" style={{ padding: '18px 22px', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            
            {/* Grid Header & Quick Barcode Scanner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={17} style={{ color: '#ea580c' }} />
                  <span>2. Material Allocation &amp; Stock Deduction Grid</span>
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Select one or multiple items to issue. Inventory stock will be deducted and recorded on the official Challan / Bill.
                </p>
              </div>

              {/* Barcode Quick Scan */}
              <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan Barcode / Enter Code..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    style={{
                      padding: '7px 10px 7px 30px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '12.5px',
                      width: '230px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Scan size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Scan Add
                </button>
              </form>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '10px 12px', width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '10px 12px', width: '160px' }}>Component / Type</th>
                    <th style={{ padding: '10px 12px', minWidth: '260px' }}>Store Material Item</th>
                    <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Current Stock</th>
                    <th style={{ padding: '10px 12px', width: '130px' }}>Method</th>
                    <th style={{ padding: '10px 12px', width: '130px', textAlign: 'right' }}>Issue Quantity</th>
                    <th style={{ padding: '10px 12px', width: '80px' }}>Unit</th>
                    <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Balance</th>
                    <th style={{ padding: '10px 12px', width: '45px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const balance = Math.round(((item.availableStock || 0) - (Number(item.totalQty) || 0)) * 100) / 100;
                    const isShortage = item.materialId && balance < 0;

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        {/* Sequence # */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '800', color: '#94a3b8' }}>
                          {idx + 1}
                        </td>

                        {/* Component Type */}
                        <td style={{ padding: '10px 12px' }}>
                          {item.isCustomType ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Type custom accessory type..."
                                value={item.customComponentType || ''}
                                onChange={(e) => {
                                  handleUpdateItem(item.id, 'customComponentType', e.target.value);
                                  handleUpdateItem(item.id, 'componentType', e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #ea580c',
                                  background: '#fff7ed',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  color: '#0f172a',
                                  boxSizing: 'border-box'
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateItem(item.id, 'isCustomType', false);
                                  handleUpdateItem(item.id, 'customComponentType', '');
                                  handleUpdateItem(item.id, 'componentType', 'DORI');
                                }}
                                title="Revert back to standard types"
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  padding: '4px 6px',
                                  fontSize: '11px',
                                  color: '#64748b'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <select
                              value={item.componentType}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                  handleUpdateItem(item.id, 'isCustomType', true);
                                  handleUpdateItem(item.id, 'customComponentType', '');
                                } else {
                                  handleUpdateItem(item.id, 'componentType', e.target.value);
                                  handleUpdateItem(item.id, 'isCustomType', false);
                                  if (e.target.value === 'DORI' || e.target.value === 'ELASTIC') {
                                    if (!item.materialId) handleUpdateItem(item.id, 'unit', 'Mtr');
                                  } else if (e.target.value === 'ZIP') {
                                    if (!item.materialId) handleUpdateItem(item.id, 'unit', 'Pcs');
                                  }
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1.5px solid #cbd5e1',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: '#ffffff',
                                color: '#0f172a',
                                boxSizing: 'border-box'
                              }}
                            >
                              {componentTypeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          )}
                        </td>

                        {/* Material Searchable Dropdown with Search Bar OR Manual Entry */}
                        <td style={{ padding: '8px 12px' }}>
                          {item.entryMode === 'manual' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="text"
                                  placeholder="✏️ Type Material Name (e.g. 5mm White Dori)..."
                                  value={item.materialName || ''}
                                  onChange={(e) => handleUpdateItem(item.id, 'materialName', e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    border: '1.5px solid #ea580c',
                                    background: '#fff7ed',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: '#0f172a',
                                    boxSizing: 'border-box'
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateItem(item.id, 'entryMode', 'choose');
                                    handleUpdateItem(item.id, 'materialName', '');
                                  }}
                                  title="Switch back to Store Inventory"
                                  style={{
                                    padding: '5px 8px',
                                    fontSize: '11px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  📋 Inventory
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                  type="text"
                                  placeholder="Color / Shade (e.g. White)"
                                  value={item.color || ''}
                                  onChange={(e) => handleUpdateItem(item.id, 'color', e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '11px',
                                    background: '#ffffff',
                                    boxSizing: 'border-box'
                                  }}
                                />
                                <input
                                  type="text"
                                  placeholder="Item Code (optional)"
                                  value={item.itemCode || ''}
                                  onChange={(e) => handleUpdateItem(item.id, 'itemCode', e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '11px',
                                    background: '#ffffff',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <SearchableMaterialDropdown
                                  materials={materials}
                                  value={item.materialId}
                                  componentType={item.isCustomType ? (item.customComponentType || '') : item.componentType}
                                  onChange={(matId) => handleSelectMaterial(item.id, matId)}
                                  onSwitchToManual={() => {
                                    handleUpdateItem(item.id, 'entryMode', 'manual');
                                    handleUpdateItem(item.id, 'materialId', '');
                                    handleUpdateItem(item.id, 'availableStock', 0);
                                  }}
                                  placeholder="🔍 Search & Choose Material (Name / Code)..."
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateItem(item.id, 'entryMode', 'manual');
                                  handleUpdateItem(item.id, 'materialId', '');
                                  handleUpdateItem(item.id, 'availableStock', 0);
                                }}
                                title="Type custom material manually"
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '11px',
                                  borderRadius: '6px',
                                  border: '1px dashed #ea580c',
                                  background: '#fff7ed',
                                  color: '#c2410c',
                                  cursor: 'pointer',
                                  fontWeight: '700',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                ✏️ Manual
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Stock Available */}
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {item.entryMode === 'manual' ? (
                            <span style={{
                              fontWeight: '700',
                              color: '#c2410c',
                              background: '#fff7ed',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              fontSize: '11px',
                              border: '1px dashed #fed7aa',
                              whiteSpace: 'nowrap'
                            }}>
                              ✏️ Manual Item
                            </span>
                          ) : item.materialId ? (
                            <span style={{
                              fontWeight: '800',
                              color: item.availableStock > 0 ? '#059669' : '#dc2626',
                              background: item.availableStock > 0 ? '#f0fdf4' : '#fef2f2',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              fontSize: '12px'
                            }}>
                              {item.availableStock} {item.unit}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Method: Direct vs Per Piece */}
                        <td style={{ padding: '10px 12px' }}>
                          <select
                            value={item.calcMode}
                            onChange={(e) => handleUpdateItem(item.id, 'calcMode', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 6px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '11.5px',
                              background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="direct">Direct Qty</option>
                            {issueMode === 'floor_lot' && <option value="per_piece">Per Pc &times; Batch</option>}
                          </select>
                        </td>

                        {/* Issue Qty Input */}
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {item.calcMode === 'per_piece' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                placeholder="Req/Pc"
                                value={item.perPcReq || ''}
                                onChange={(e) => handleUpdateItem(item.id, 'perPcReq', e.target.value)}
                                style={{
                                  width: '85px',
                                  padding: '5px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  boxSizing: 'border-box'
                                }}
                              />
                              <span style={{ fontSize: '10.5px', color: '#ea580c', fontWeight: '800' }}>
                                = {item.totalQty} {item.unit}
                              </span>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.totalQty || ''}
                              onChange={(e) => handleUpdateItem(item.id, 'totalQty', parseFloat(e.target.value) || 0)}
                              style={{
                                width: '90px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1.5px solid #cbd5e1',
                                textAlign: 'right',
                                fontSize: '13px',
                                fontWeight: '800',
                                color: '#0f172a',
                                boxSizing: 'border-box'
                              }}
                            />
                          )}
                        </td>

                        {/* Unit */}
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                            style={{
                              width: '65px',
                              padding: '5px 6px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: '600',
                              boxSizing: 'border-box'
                            }}
                          />
                        </td>

                        {/* Balance After Issue */}
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {item.entryMode === 'manual' ? (
                            <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Custom Issue</span>
                          ) : item.materialId ? (
                            <span style={{
                              fontWeight: '800',
                              color: isShortage ? '#dc2626' : '#475569',
                              fontSize: '11.5px'
                            }}>
                              {balance} {item.unit}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Action: Delete Row */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(item.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                            title="Remove row"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Action: Add Row & Remarks */}
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleAddItemRow('DORI', '', 'choose')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1.5px solid #0f172a',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={15} />
                  <span>Add Row</span>
                </button>
              </div>

              {/* Remarks input */}
              <div style={{ minWidth: '260px', flex: '1', maxWidth: '380px' }}>
                <input
                  type="text"
                  placeholder="Optional allocation notes / floor remarks..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    background: '#ffffff'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3. Bottom Action & KPI Summary */}
          <div className="panel" style={{
            padding: '18px 22px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                  Total Items
                </span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {items.filter(i => i.materialId || i.materialName).length} Materials
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                  Destination
                </span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>
                  {receiverDept || 'Cutting'} &bull; {receiverName || 'To Be Assigned'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                  Mode
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#ea580c' }}>
                  {lotNo ? `Lot #${lotNo}` : '⚠️ Lot # Required'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Preview Button */}
              <button
                type="button"
                onClick={handlePreviewOnly}
                style={{
                  padding: '11px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={16} />
                <span>Preview Challan</span>
              </button>

              {/* Direct Print Button */}
              <button
                type="button"
                onClick={handleDirectPrintFromForm}
                style={{
                  padding: '11px 20px',
                  borderRadius: '10px',
                  border: '1.5px solid #0f172a',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)'
                }}
                title="Print official Material Issue Without BOM Challan"
              >
                <Printer size={16} style={{ color: '#ea580c' }} />
                <span>🖨️ Print Challan</span>
              </button>

              {/* Confirm & Issue Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitIssue}
                style={{
                  padding: '12px 28px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: submitting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <Zap size={18} />
                <span>{submitting ? 'Issuing & Generating Challan...' : '⚡ Confirm Issue & Give Challan / Bill'}</span>
              </button>

              {/* Reset / Clear Form */}
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  padding: '11px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Clear and refill all columns for a fresh issue"
              >
                <RefreshCw size={15} />
                <span>Reset Form</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── TAB CONTENT: WITHOUT-BOM HISTORY ── */}
      {activeTab === 'history' && (
        <div className="panel" style={{ padding: '18px 22px', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                Without-BOM &amp; Item Issue Challan / Bill Logs
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Audit history of all material issue slips and challans generated without approved BOM.
              </p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', width: '270px' }}>
              <input
                type="text"
                placeholder="Search Bill No, Material, Receiver..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  boxSizing: 'border-box'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          {withoutBomLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <FileText size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontWeight: '700', fontSize: '14px' }}>No Without-BOM issue slips found.</div>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Issue materials above to track them in this audit log.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Challan / Bill No</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Lot Reference</th>
                    <th style={{ padding: '10px 12px' }}>Issued Materials</th>
                    <th style={{ padding: '10px 12px' }}>Issued By</th>
                    <th style={{ padding: '10px 12px' }}>Received By</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withoutBomLogs.map((log, idx) => (
                    <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                        <span style={{ fontFamily: 'monospace', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {log.id}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {log.date}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                        {!log.lotId || log.lotId === 'DIRECT-ITEM' || String(log.lotId).toLowerCase().includes('direct') ? (
                          <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                            DIRECT ITEM REQUISITION
                          </span>
                        ) : (
                          <span>LOT #{log.lotId}</span>
                        )}
                        <span style={{ marginLeft: '6px', fontSize: '10px', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#475569', fontWeight: '800' }}>
                          W/O BOM
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {(log.materials || []).slice(0, 3).map((m, mIdx) => (
                            <span key={mIdx} style={{ fontSize: '11.5px', color: '#334155' }}>
                              &bull; <strong>{m.name || m.bomItemName}:</strong> {m.qty} {m.unit || 'pcs'}
                            </span>
                          ))}
                          {(log.materials || []).length > 3 && (
                            <span style={{ fontSize: '10.5px', color: '#ea580c', fontWeight: '700' }}>
                              +{(log.materials || []).length - 3} more item(s)
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                        {log.personName || 'Store In-charge'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: '700' }}>
                        {log.receiverName || 'Cutting Master'}
                        {log.receiverDept && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                            {log.receiverDept}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const issueData = buildIssueDataFromLog(log);
                              handleDirectPrintWindow(issueData, log.id);
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: '1.5px solid #0f172a',
                              background: '#0f172a',
                              color: '#ffffff',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Direct 1-Click Print"
                          >
                            <Printer size={13} style={{ color: '#ea580c' }} />
                            <span>Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReprintHistory(log)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Preview on-screen and download PDF"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: BEAUTIFUL ON-SCREEN CHALLAN / BILL PREVIEW WITH PRINT & DOWNLOAD ── */}
      {previewModal && (
        <div 
          className="without-bom-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          }}>
            {/* Modal Top Bar */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0f172a',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={20} style={{ color: '#ea580c' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                    MATERIAL ISSUE WITHOUT BOM &bull; {previewModal.voucherId}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {previewModal.isPreviewOnly ? 'Draft Preview — Click "Confirm Issue" on form to record stock deduction' : 'Official Material Issue Slip saved to inventory records'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Challan Sheet View */}
            <div style={{ flex: '1', overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
              
              {/* Printable Challan Box */}
              <div style={{
                background: '#ffffff',
                border: '2px solid #0f172a',
                borderRadius: '8px',
                padding: '24px 28px',
                color: '#0f172a',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '0.5px' }}>MOHIT HOSIERY</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                      CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT
                    </p>
                    <div style={{ display: 'inline-block', marginTop: '6px', padding: '4px 10px', background: '#ea580c', color: '#ffffff', borderRadius: '4px', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      MATERIAL ISSUE WITHOUT BOM
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: '900', color: '#ea580c' }}>
                      {previewModal.voucherId}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginTop: '2px' }}>
                      Date: {previewModal.issueData?.date || new Date().toLocaleDateString('en-GB')}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '800', marginTop: '4px', color: '#059669' }}>
                      {previewModal.isPreviewOnly ? '[ PREVIEW COPY ]' : '[ REAL STOCK DEDUCTED ]'}
                    </div>
                  </div>
                </div>

                {/* Particulars Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>LOT REFERENCE:</span>
                    <strong style={{ color: '#ea580c', fontSize: '13px' }}>
                      LOT #{previewModal.issueData?.lotId}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>ISSUED BY (STORE):</span>
                    <strong>{previewModal.issueData?.personName || 'Store In-charge'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>RECEIVED BY:</span>
                    <strong>{previewModal.issueData?.receiverName || 'Floor Master'} ({previewModal.issueData?.receiverDept || 'Cutting'})</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>REQUISITION TYPE:</span>
                    <span>{previewModal.issueData?.style || 'Direct Store Requisition'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>PRODUCTION VOLUME:</span>
                    <span>{previewModal.issueData?.pieces > 1 ? `${previewModal.issueData?.pieces} Pcs` : 'Ad-Hoc Issue'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block', fontWeight: '700' }}>TOTAL LINE ITEMS:</span>
                    <span>{(previewModal.issueData?.items || []).length} Material Item(s)</span>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #0f172a', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                      <th style={{ padding: '8px 10px' }}>Component / Type</th>
                      <th style={{ padding: '8px 10px' }}>Store Material Description</th>
                      <th style={{ padding: '8px 10px' }}>Shade/Color</th>
                      <th style={{ padding: '8px 10px' }}>Rack Loc</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Prev Stock</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#ea580c' }}>Issued Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewModal.issueData?.items || []).map((item, idx) => {
                      const balance = item.availableStock !== undefined ? Math.max(0, item.availableStock - item.totalQty).toFixed(2) : '—';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '700' }}>{item.componentType || 'Accessory'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {(() => {
                              const c = getItemCodeDisplay(item);
                              return (
                                <>
                                  {c && <strong style={{ color: '#0284c7', marginRight: '6px' }}>[{c}]</strong>}
                                  <span>{item.materialName || 'Material Item'}</span>
                                </>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '8px 10px' }}>{item.color || 'Standard'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.location || 'Store'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                            {item.availableStock !== undefined ? `${item.availableStock} ${item.unit}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#ea580c', fontSize: '13px' }}>
                            {item.totalQty} {item.unit}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                            {balance} {item.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Remarks */}
                {previewModal.issueData?.remarks && (
                  <div style={{ marginBottom: '18px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11.5px' }}>
                    <strong>Allocation Notes:</strong> {previewModal.issueData.remarks}
                  </div>
                )}

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', paddingTop: '16px', borderTop: '1.5px solid #0f172a' }}>
                  <div style={{ textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ height: '32px' }}></div>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong>Issued By: {previewModal.issueData?.personName || 'Store In-charge'}</strong>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Store Incharge Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ height: '32px' }}></div>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong>Received By: {previewModal.issueData?.receiverName || 'Floor Master'}</strong>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>{previewModal.issueData?.receiverDept || 'Cutting'} Dept Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ height: '32px' }}></div>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong>Authorized Signatory</strong>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Supervisor / Lead Clearance</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                Official Mohit Hosiery Material Issue Challan &bull; Dual-Copy Print Format
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Direct 1-Click Print Button */}
                <button
                  type="button"
                  onClick={() => handleDirectPrintWindow(previewModal.issueData, previewModal.voucherId)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1.5px solid #0f172a',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)'
                  }}
                >
                  <Printer size={16} /> 
                  <span>🖨️ Print Challan Now</span>
                </button>

                {/* PDF Download */}
                <button
                  type="button"
                  onClick={() => {
                    if (previewModal.doc) {
                      previewModal.doc.save(`${previewModal.voucherId}_Challan_Bill.pdf`);
                    }
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={15} /> 
                  <span>Download PDF</span>
                </button>

                {/* Done Button */}
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN PRINT CONTAINER (FOR WINDOW.PRINT DUAL COPY) ── */}
      {(previewModal || activePrintData) && (() => {
        const printIssue = previewModal?.issueData || activePrintData;
        const printVid = previewModal?.voucherId || activePrintData?.voucherId || nextVoucherId;
        if (!printIssue) return null;

        return (
          <div className="without-bom-print-container">
            {/* Copy 1: ORIGINAL (STORE COPY) */}
            <div className="without-bom-challan-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>MOHIT HOSIERY</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold' }}>CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT</div>
                  <div style={{ fontSize: '13px', fontWeight: '900', marginTop: '4px', letterSpacing: '0.5px' }}>
                    MATERIAL ISSUE WITHOUT BOM
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>
                    OFFICIAL STORE CHALLAN / STORE ISSUE BILL
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>CHALLAN NO: {printVid}</div>
                  <div style={{ fontSize: '10px' }}>DATE: {printIssue.date}</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '3px' }}>[ ORIGINAL - STORE COPY ]</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', border: '1px solid #000', padding: '8px', marginBottom: '10px' }}>
                <div><strong>LOT NO:</strong> LOT #{printIssue.lotId}</div>
                <div><strong>ISSUED BY:</strong> {printIssue.personName}</div>
                <div><strong>RECEIVED BY:</strong> {printIssue.receiverName} ({printIssue.receiverDept})</div>
                <div><strong>REQUISITION:</strong> {printIssue.style}</div>
                <div><strong>VOLUME:</strong> {printIssue.pieces > 1 ? `${printIssue.pieces} Pcs` : 'Ad-Hoc'}</div>
                <div><strong>STATUS:</strong> {printIssue.isPreviewOnly ? 'DRAFT PREVIEW' : 'REAL STOCK DEDUCTED'}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '4px', textAlign: 'center', width: '25px', border: '1px solid #000' }}>#</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Component</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Material Description</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Item Code</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Rack Loc</th>
                    <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Issued Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printIssue.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #000' }}>{idx + 1}</td>
                      <td style={{ padding: '4px', border: '1px solid #000' }}>{item.componentType}</td>
                      <td style={{ padding: '4px', border: '1px solid #000' }}>{item.materialName}</td>
                      <td style={{ padding: '4px', border: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {getItemCodeDisplay(item) || item.itemCode || '-'}
                      </td>
                      <td style={{ padding: '4px', border: '1px solid #000' }}>{item.location || 'Store'}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #000' }}>
                        {item.totalQty} {item.unit || 'Pcs'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {printIssue.remarks && (
                <div style={{ fontSize: '10px', marginBottom: '12px' }}>
                  <strong>Remarks:</strong> {printIssue.remarks}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #000', fontSize: '10px', textAlign: 'center' }}>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Issued By ({printIssue.personName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Received By ({printIssue.receiverName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Supervisor Sign &amp; Stamp</strong>
                </div>
              </div>
            </div>

            <div style={{ height: '20px' }}></div>

            {/* Copy 2: DUPLICATE (DEPARTMENT / RECEIVER COPY) */}
            <div className="without-bom-challan-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>MOHIT HOSIERY</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold' }}>CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT</div>
                  <div style={{ fontSize: '13px', fontWeight: '900', marginTop: '4px', letterSpacing: '0.5px' }}>
                    MATERIAL ISSUE WITHOUT BOM
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>
                    DUPLICATE DEPARTMENT COPY
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>CHALLAN NO: {printVid}</div>
                  <div style={{ fontSize: '10px' }}>DATE: {printIssue.date}</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '3px' }}>[ DUPLICATE - RECEIVER COPY ]</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', border: '1px solid #000', padding: '8px', marginBottom: '10px' }}>
                <div><strong>LOT NO:</strong> LOT #{printIssue.lotId}</div>
                <div><strong>ISSUED BY:</strong> {printIssue.personName}</div>
                <div><strong>RECEIVED BY:</strong> {printIssue.receiverName} ({printIssue.receiverDept})</div>
                <div><strong>REQUISITION:</strong> {printIssue.style}</div>
                <div><strong>VOLUME:</strong> {printIssue.pieces > 1 ? `${printIssue.pieces} Pcs` : 'Ad-Hoc'}</div>
                <div><strong>STATUS:</strong> {printIssue.isPreviewOnly ? 'DRAFT PREVIEW' : 'REAL STOCK DEDUCTED'}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '4px', textAlign: 'center', width: '25px', border: '1px solid #000' }}>#</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Component</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Material Description</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Item Code</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #000' }}>Rack Loc</th>
                    <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Issued Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printIssue.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #000' }}>{idx + 1}</td>
                      <td style={{ padding: '4px', border: '1px solid #000' }}>{item.componentType}</td>
                      <td style={{ padding: '4px', border: '1px solid #000' }}>{item.materialName}</td>
                      <td style={{ padding: '4px', border: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {getItemCodeDisplay(item) || item.itemCode || '-'}
                      </td>
                      <td style={{ padding: '4px', border: '1px solid #000' }}>{item.location || 'Store'}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #000' }}>
                        {item.totalQty} {item.unit || 'Pcs'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {printIssue.remarks && (
                <div style={{ fontSize: '10px', marginBottom: '12px' }}>
                  <strong>Remarks:</strong> {printIssue.remarks}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #000', fontSize: '10px', textAlign: 'center' }}>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Issued By ({printIssue.personName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Received By ({printIssue.receiverName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Supervisor Sign &amp; Stamp</strong>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EMBEDDED PRINT STYLESHEET ── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, nav, aside, .app-header, .navbar, .without-bom-modal-overlay {
            display: none !important;
            visibility: hidden !important;
          }
          body.print-without-bom-mode #root > *:not(.without-bom-print-container) {
            display: none !important;
          }
          .without-bom-container > *:not(.without-bom-print-container) {
            display: none !important;
          }
          .without-bom-print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            visibility: visible !important;
            z-index: 99999999 !important;
          }
          .without-bom-print-container * {
            visibility: visible !important;
          }
          .without-bom-challan-sheet {
            page-break-inside: avoid !important;
            border: 1.5px solid #000000 !important;
            padding: 12px 16px !important;
            margin-bottom: 12px !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
        @media screen {
          .without-bom-print-container {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
