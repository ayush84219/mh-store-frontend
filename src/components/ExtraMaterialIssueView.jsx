import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers, Search, CheckCircle2, AlertTriangle, Printer,
  FileText, Shield, ShieldAlert, ArrowRight, RotateCcw, Clock,
  Package, ChevronDown, CheckCircle, HelpCircle,
  TrendingUp, Sparkles, Filter, RefreshCw, Eye, BarChart3,
  User, Send, Box, Scissors, Tag, Info, Calendar, Barcode, QrCode,
  Zap, Plus, Trash2, Image as ImageIcon, X, ZoomIn, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Standard Component Name Presets (Tag, Label, Tape, Elastic, etc.)
const COMPONENT_PRESETS = [
  'Label',
  'Tag',
  'Tape',
  'Elastic',
  'Zipper',
  'Button',
  'Drawcord',
  'Pocketing',
  'Thread',
  'Interlining',
  'Patch',
  'Polybag'
];

// Reusable Searchable Material Select with Portal & Smart Positioning
function SearchableMaterialSelect({ materials = [], value, onChange, disabled = false, placeholder = "-- Select Material --", hasError = false, brandHint = '', categoryHint = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllOverride, setShowAllOverride] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320, isAbove: false });
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedMaterial = materials.find(m => String(m.id) === String(value));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewMaterial) {
          setPreviewMaterial(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMaterial, isOpen]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isAbove = spaceBelow < 250 && rect.top > 250;
      
      const desiredWidth = Math.min(640, Math.max(rect.width, 520));
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
      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
      };
    } else {
      setShowAllOverride(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
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

  // ─── Smart Dynamic Brand Matching ─────────────────────────────────────────
  // Works for ANY brand name — current or future — with zero code changes.
  // Handles: "Gym Shark" ↔ "gymshark", "H&M" ↔ "hm", "Brooks Brothers" ↔ "brooksbrothers"
  const brandKeyword = (brandHint || '').toLowerCase().trim();

  // Normalize a string: lowercase, strip all non-alphanumeric chars, collapse spaces
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normCompact = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const isBrandMatch = (m) => {
    if (!brandKeyword) return false;
    const mName = norm(m.name || '');
    const mCat  = norm(m.category || '');
    const mNameCompact = normCompact(m.name || '');
    const brandCompact = normCompact(brandKeyword);
    const brandNorm    = norm(brandKeyword);

    // Strategy 1: full brand phrase match (space-joined words must appear in name)
    if (mName.includes(brandNorm) || mCat.includes(brandNorm)) return true;

    // Strategy 2: compact (no-space) match — "gymshark" matches "gym shark" brand
    if (brandCompact.length >= 2 && (mNameCompact.includes(brandCompact) || normCompact(m.category || '').includes(brandCompact))) return true;

    // Strategy 3: every significant word (>=2 chars) of the brand appears in material
    const brandWords = brandNorm.split(' ').filter(w => w.length >= 2);
    if (brandWords.length > 0 && brandWords.some(w => mName.includes(w) || mCat.includes(w))) return true;

    // Strategy 4: any single-word chunk of brand name found compactly in material
    return brandWords.some(w => mNameCompact.includes(w));
  };

  // ─── Category / Component Smart Matching ──────────────────────────────────
  const matchesCategory = (m) => {
    if (!categoryHint || !categoryHint.trim()) return true;
    const catTarget = categoryHint.toLowerCase().trim();
    const targetRoot = catTarget.endsWith('s') ? catTarget.slice(0, -1) : catTarget;
    const mCat = (m.category || '').toLowerCase().trim();
    const mName = (m.name || '').toLowerCase().trim();

    if (mCat.includes(catTarget) || mCat.includes(targetRoot)) return true;
    if (mName.includes(catTarget) || mName.includes(targetRoot)) return true;

    // Common synonyms
    if (targetRoot === 'tap' && (mCat.includes('tape') || mName.includes('tape'))) return true;
    if (targetRoot === 'zip' && (mCat.includes('zipper') || mName.includes('zipper'))) return true;
    if (targetRoot === 'cord' && (mCat.includes('drawcord') || mName.includes('drawcord'))) return true;
    if (targetRoot === 'pocket' && (mCat.includes('pocket') || mName.includes('pocket'))) return true;

    return false;
  };

  const categoryMatchedList = (materials || []).filter(m => matchesCategory(m));
  const hasCategoryFilter = Boolean(categoryHint && categoryHint.trim() && categoryMatchedList.length > 0 && !showAllOverride);
  const activeMaterialsPool = hasCategoryFilter ? categoryMatchedList : (materials || []);

  const filtered = activeMaterialsPool
    .filter(m => {
      if (Number(m.stock) <= 0) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const itemCodeStr = String(m.itemCode || m.item_code || m.materialCode || m.code || '').toLowerCase();
      const codeStr = String(m.id || '').toLowerCase();
      const nameStr = String(m.name || '').toLowerCase();
      const colorStr = String(m.color || '').toLowerCase();
      const catStr = String(m.category || '').toLowerCase();
      const locStr = String(m.location || '').toLowerCase();
      return itemCodeStr.includes(q) || codeStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q) || locStr.includes(q);
    })
    .sort((a, b) => {
      const aMatch = isBrandMatch(a) ? 1 : 0;
      const bMatch = isBrandMatch(b) ? 1 : 0;
      return bMatch - aMatch;
    });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => {
          if (disabled) return;
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
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          height: '38px',
          padding: '6px 12px',
          borderRadius: '7px',
          border: '1px solid',
          borderColor: hasError ? 'var(--danger, #ef4444)' : isOpen ? '#6366f1' : 'var(--border-color, #cbd5e1)',
          background: disabled ? 'var(--bg-secondary, #f1f5f9)' : 'var(--bg-primary, #ffffff)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
          fontSize: '13px',
          fontWeight: '500',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          paddingRight: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px'
        }}>
          {selectedMaterial ? (
            <>
              {/* Photo thumbnail with zoom/verification */}
              {(() => {
                const rawImg = selectedMaterial.imageUrl || selectedMaterial.image || selectedMaterial.photo || selectedMaterial.imgUrl;
                const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                return cleanImg ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewMaterial(selectedMaterial);
                    }}
                    title="Click to view & verify material photo"
                    style={{
                      position: 'relative',
                      width: '26px',
                      height: '26px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: 'zoom-in',
                      border: '1.5px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <img
                      src={cleanImg}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '4px',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e2e8f0',
                    flexShrink: 0,
                    color: '#94a3b8'
                  }}>
                    <Package size={13} />
                  </div>
                );
              })()}
              <span style={{
                fontFamily: 'monospace',
                fontWeight: '700',
                fontSize: '12px',
                backgroundColor: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                padding: '2px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.itemCode || selectedMaterial.item_code || selectedMaterial.materialCode || selectedMaterial.code || selectedMaterial.id}
              </span>
              <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>
                {selectedMaterial.name}
              </span>
              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  ({selectedMaterial.color})
                </span>
              )}
              {selectedMaterial.category && (
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: '700',
                  letterSpacing: '0.04em',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1'
                }}>
                  {selectedMaterial.category}
                </span>
              )}
              {selectedMaterial.stock !== undefined && (
                <span style={{ fontSize: '12px', color: '#334155', fontWeight: '700' }}>
                  • {selectedMaterial.stock} {selectedMaterial.unit || 'Pcs'}
                </span>
              )}
              {selectedMaterial.location && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: '#0284c7',
                  backgroundColor: 'rgba(2,132,199,0.08)',
                  border: '1px solid rgba(2,132,199,0.2)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  letterSpacing: '0.01em'
                }}>
                  📍 {selectedMaterial.location.split(',')[0].trim()}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown size={16} style={{ 
          color: 'var(--text-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
          flexShrink: 0
        }} />
      </div>

      {isOpen && !disabled && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.isAbove
              ? { bottom: `${window.innerHeight - coords.top + 4}px` }
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 24px)',
            border: '1.5px solid var(--border-color, #cbd5e1)',
            borderRadius: '8px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08)',
            backgroundColor: 'var(--bg-primary, #ffffff)',
            color: 'var(--text-main, #0f172a)',
            zIndex: 9999999,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b'
            }} />
            <input
              type="text"
              autoFocus
              placeholder="Search Material Code, Name, Color, Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '36px',
                padding: '6px 12px 6px 34px',
                borderRadius: '7px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-secondary, #f8fafc)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Category Filter Banner */}
          {hasCategoryFilter && (
            <div style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#9a3412',
              backgroundColor: '#fff7ed',
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>🎯</span>
                <span>Filtered for: <strong style={{ color: '#c2410c' }}>"{categoryHint}"</strong> ({categoryMatchedList.length} items)</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllOverride(true);
                }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #fdba74',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#ea580c',
                  cursor: 'pointer'
                }}
              >
                Show All ({materials.length})
              </button>
            </div>
          )}
          {showAllOverride && categoryHint && categoryMatchedList.length > 0 && (
            <div style={{
              padding: '5px 10px',
              fontSize: '11px',
              color: '#64748b',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}>
              <span>Showing all inventory materials</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllOverride(false);
                }}
                style={{
                  background: '#fff7ed',
                  border: '1px solid #fdba74',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#c2410c',
                  cursor: 'pointer'
                }}
              >
                Filter to "{categoryHint}"
              </button>
            </div>
          )}

          <div style={{
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No materials match search
              </div>
            ) : (
              <>
                {/* Special Green Brand-match section header */}
                {brandKeyword && filtered.some(m => isBrandMatch(m)) && (
                  <div style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#065f46',
                    backgroundColor: '#ecfdf5',
                    borderRadius: '5px',
                    border: '1px solid #a7f3d0',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      display: 'inline-block',
                      boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)'
                    }} />
                    <span>RECOMMENDED FOR: <strong style={{ color: '#047857', fontWeight: '800' }}>{brandHint}</strong></span>
                  </div>
                )}
                {filtered.map((m, mIdx) => {
                  const isSelected = String(m.id) === String(value);
                  const isBrand = isBrandMatch(m);
                  const prevIsBrand = mIdx > 0 ? isBrandMatch(filtered[mIdx - 1]) : false;
                  const showSeparator = brandKeyword && mIdx > 0 && !isBrand && prevIsBrand;
                  return (
                    <React.Fragment key={m.id}>
                      {showSeparator && (
                        <div style={{
                          padding: '6px 10px 3px 10px',
                          fontSize: '10px',
                          fontWeight: '700',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderTop: '1px solid #e2e8f0',
                          marginTop: '4px'
                        }}>
                          Other Materials
                        </div>
                      )}
                      <div
                        onClick={() => {
                          onChange(m.id);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          backgroundColor: isSelected
                            ? '#6366f1'
                            : isBrand
                            ? 'rgba(16, 185, 129, 0.05)'
                            : 'transparent',
                          color: isSelected ? '#ffffff' : '#0f172a',
                          fontWeight: isSelected ? '700' : '400',
                          transition: 'background-color 0.15s',
                          gap: '10px',
                          border: isSelected 
                            ? '1px solid #6366f1' 
                            : isBrand 
                            ? '1px solid #d1fae5' 
                            : '1px solid #f1f5f9',
                          borderLeft: isBrand && !isSelected ? '3px solid #10b981' : undefined,
                          marginBottom: '1px'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = isBrand ? '#f0fdf4' : 'var(--bg-hover, #f1f5f9)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = isBrand ? 'rgba(16, 185, 129, 0.05)' : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          {/* Photo thumbnail with zoom-to-verify click */}
                          {(() => {
                            const rawImg = m.imageUrl || m.image || m.photo || m.imgUrl;
                            const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                            return cleanImg ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewMaterial(m);
                                }}
                                title="Click to view & verify photo"
                                style={{
                                  position: 'relative',
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  border: isSelected ? '1.5px solid #ffffff' : '1.5px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  flexShrink: 0,
                                  cursor: 'zoom-in',
                                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.12)';
                                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <img
                                  src={cleanImg}
                                  alt=""
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
                                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                  color: '#ffffff',
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '3px 0 0 0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '8px',
                                  pointerEvents: 'none'
                                }}>
                                  🔍
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '6px',
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: isSelected ? 'none' : '1px solid #e2e8f0',
                                flexShrink: 0,
                                color: isSelected ? '#ffffff' : '#94a3b8'
                              }}>
                                <Package size={16} />
                              </div>
                            );
                          })()}
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            fontSize: '11.5px',
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : isBrand ? '#d1fae5' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : isBrand ? '#065f46' : '#0f172a',
                            border: isSelected ? 'none' : isBrand ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}>
                            {m.itemCode || m.item_code || m.materialCode || m.code || m.id}
                          </span>
                          <span style={{
                            fontWeight: isSelected ? '700' : isBrand ? '700' : '600',
                            fontSize: '12.5px',
                            color: isSelected ? '#ffffff' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            minWidth: 0
                          }}>
                            {m.name}
                            {m.color && m.color !== 'Default' && ` (${m.color})`}
                          </span>
                          {m.category && (
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: '700',
                              letterSpacing: '0.04em',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                              textTransform: 'uppercase',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#334155',
                              border: isSelected ? 'none' : '1px solid #cbd5e1'
                            }}>
                              {m.category}
                            </span>
                          )}
                          {isBrand && !isSelected && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: '800',
                              color: '#047857',
                              backgroundColor: '#d1fae5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              border: '1px solid #a7f3d0'
                            }}>
                              MATCH
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0, marginLeft: '6px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: '700',
                            color: isSelected ? '#fff' : Number(m.stock) <= 0 ? '#ef4444' : '#0f172a'
                          }}>
                            {m.stock} {m.unit || 'Pcs'}
                          </span>
                          {m.location && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '600',
                              color: isSelected ? 'rgba(255,255,255,0.9)' : '#0284c7',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(2,132,199,0.08)',
                              border: isSelected ? 'none' : '1px solid rgba(2,132,199,0.2)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.01em',
                              whiteSpace: 'nowrap'
                            }}>
                              📍 {m.location.split(',')[0].trim()}
                            </span>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ─── Large Photo Verification Lightbox Modal ─────────────────── */}
      {previewMaterial && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999999,
            padding: '16px',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.15s ease'
          }}
          onClick={() => setPreviewMaterial(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              boxSizing: 'border-box'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🔍</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    Material Photo Verification
                  </h4>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                    Verify label / trim photo & details before issuing
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMaterial(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '18px',
                  fontWeight: '700',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Large Image Canvas */}
            <div style={{
              padding: '20px',
              backgroundColor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '260px',
              maxHeight: '420px',
              position: 'relative'
            }}>
              {(() => {
                const raw = previewMaterial.imageUrl || previewMaterial.image || previewMaterial.photo || previewMaterial.imgUrl;
                const clean = raw ? getCleanImageUrl(raw) : '';
                return clean ? (
                  <img
                    src={clean}
                    alt={previewMaterial.name || 'Material photo'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '380px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                    }}
                  />
                ) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
                    <Package size={48} style={{ opacity: 0.4, marginBottom: '8px' }} />
                    <div style={{ fontSize: '13px' }}>No photo available for this material</div>
                  </div>
                );
              })()}
            </div>

            {/* Material Verification Details */}
            <div style={{ padding: '16px 18px', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: '800',
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      padding: '2px 8px',
                      borderRadius: '5px'
                    }}>
                      {previewMaterial.itemCode || previewMaterial.item_code || previewMaterial.materialCode || previewMaterial.code || previewMaterial.id}
                    </span>
                    {previewMaterial.category && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {previewMaterial.category}
                      </span>
                    )}
                    {previewMaterial.color && previewMaterial.color !== 'Default' && (
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                        • Color: <strong>{previewMaterial.color}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', wordBreak: 'break-word' }}>
                    {previewMaterial.name}
                  </div>
                </div>

                {/* Stock Badge */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Available Stock</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '900',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: Number(previewMaterial.stock) <= 0 ? '#fef2f2' : '#ecfdf5',
                    color: Number(previewMaterial.stock) <= 0 ? '#dc2626' : '#059669',
                    border: `1.5px solid ${Number(previewMaterial.stock) <= 0 ? '#fca5a5' : '#a7f3d0'}`
                  }}>
                    {Number(previewMaterial.stock || 0).toLocaleString()} {previewMaterial.unit || 'Pcs'}
                  </span>
                </div>
              </div>

              {/* Warehouse Location Info */}
              {previewMaterial.location && (
                <div style={{
                  fontSize: '11.5px',
                  color: '#0369a1',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '12px'
                }}>
                  <span>📍</span>
                  <span>Storage Location: <strong>{previewMaterial.location}</strong></span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMaterial(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Close & Back to List
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(previewMaterial.id);
                    setPreviewMaterial(null);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  ✓ Select & Use This Material
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const EXTRA_REASONS = [
  'Cutting Wastage / Excess Loss',
  'Defective Trim Replacement',
  'Machine Damage / Jamming',
  'Sampling & Size Modification',
  'Worker Stitching Mistake',
  'Quality Audit Rejection',
  'Shortage in Original Batch',
  'Extra Garment Pieces Cut',
  'Other / Custom Requirement'
];

export default function ExtraMaterialIssueView({
  designs = [],
  materials = [],
  onIssueMaterials,
  issueLogs = [],
  currencySymbol = '₹',
  currentUser = null,
  onSubmitApproval = null
}) {
  const isAdmin = currentUser?.role === 'Admin';


  // Main UI states
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [searchLotQuery, setSearchLotQuery] = useState('');
  const [pieces, setPieces] = useState(100);
  const [isLoadingPieces, setIsLoadingPieces] = useState(false);
  const [bomMappings, setBomMappings] = useState([]);
  const [personName, setPersonName] = useState(currentUser?.name || 'Store Keeper');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDept, setReceiverDept] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('issue'); // 'issue', 'history', or 'combined_audit'
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState('all'); // 'all' | 'extra' | 'reissue'
  const [historyDateFrom, setHistoryDateFrom] = useState(''); // 'YYYY-MM-DD'
  const [historyDateTo, setHistoryDateTo] = useState(''); // 'YYYY-MM-DD'
  const [showAllDetailsInTable, setShowAllDetailsInTable] = useState(false);
  const [auditLotSearch, setAuditLotSearch] = useState('');
  const [expandedAuditLots, setExpandedAuditLots] = useState({});
  const toggleAuditLotExpand = (lotId) => {
    setExpandedAuditLots(prev => ({ ...prev, [lotId]: !prev[lotId] }));
  };
  const [showAllBom, setShowAllBom] = useState(false);

  // ── Without BOM Mode State & Handlers ─────────────────────────────────────
  const [issueMethod, setIssueMethod] = useState('with_bom'); // 'with_bom' | 'without_bom'
  const [woLotId, setWoLotId] = useState('');
  const [woLotStyle, setWoLotStyle] = useState('Floor Issue');
  const [woBrand, setWoBrand] = useState('Mohit Hosiery');
  const [woCategory, setWoCategory] = useState('Floor Requisition');
  const [woPieces, setWoPieces] = useState(100);
  const [woReceiverName, setWoReceiverName] = useState('');
  const [woReceiverDept, setWoReceiverDept] = useState('Cutting Floor');
  const [showAddWoModal, setShowAddWoModal] = useState(false);
  const [addWoInputName, setAddWoInputName] = useState('Label');
  const [woItems, setWoItems] = useState([
    {
      id: 1,
      componentName: 'Label',
      materialId: '',
      extraQty: '',
      unit: 'Pcs',
      reason: EXTRA_REASONS[0],
      remarks: ''
    }
  ]);

  const confirmAddWoItem = (compName = '') => {
    const finalComp = (compName !== undefined && compName !== null ? String(compName) : '').trim();
    setWoItems(prev => [
      ...prev,
      {
        id: Date.now(),
        componentName: finalComp,
        materialId: '',
        extraQty: '',
        unit: 'Pcs',
        reason: EXTRA_REASONS[0],
        remarks: ''
      }
    ]);
    setShowAddWoModal(false);
    setAddWoInputName('Label');
  };

  const handleAddWoItem = () => {
    setShowAddWoModal(true);
  };

  const handleRemoveWoItem = (id) => {
    setWoItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);
  };

  const handleUpdateWoItem = (id, field, value) => {
    setWoItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      if (field === 'materialId') {
        const mat = materials.find(m => String(m.id) === String(value));
        if (mat) {
          updated.unit = mat.unit || it.unit || 'Pcs';
          if (!it.componentName || it.componentName === 'Label' || it.componentName === 'Tag' || it.componentName === 'Tape') {
            const cat = (mat.category || '').toLowerCase();
            const nm = (mat.name || '').toLowerCase();
            if (cat.includes('tag') || nm.includes('tag')) updated.componentName = 'Tag';
            else if (cat.includes('label') || nm.includes('label')) updated.componentName = 'Label';
            else if (cat.includes('tape') || nm.includes('tape')) updated.componentName = 'Tape';
            else if (cat.includes('elastic') || nm.includes('elastic')) updated.componentName = 'Elastic';
            else if (cat.includes('zipper') || nm.includes('zipper')) updated.componentName = 'Zipper';
            else if (cat.includes('button') || nm.includes('button')) updated.componentName = 'Button';
            else if (cat.includes('drawcord') || cat.includes('cord') || nm.includes('drawcord')) updated.componentName = 'Drawcord';
            else if (cat.includes('pocket') || nm.includes('pocket')) updated.componentName = 'Pocketing';
            else if (mat.category) updated.componentName = mat.category;
          }
        }
      }
      return updated;
    }));
  };

  const handleIssueWithoutBom = () => {
    setFormError('');
    setFormSuccess('');

    if (!woLotId.trim()) {
      setFormError('Please enter a Lot Number for this Without BOM extra issue.');
      return;
    }

    if (!personName.trim()) {
      setFormError('Please provide Issuer Person name.');
      return;
    }

    if (!woReceiverName.trim()) {
      setFormError('Please enter Receiver Person name.');
      return;
    }

    if (!woReceiverDept.trim()) {
      setFormError('Please enter Receiver Department / Line.');
      return;
    }

    if (woItems.length === 0) {
      setFormError('Please add at least one material to issue.');
      return;
    }

    for (let i = 0; i < woItems.length; i++) {
      const it = woItems[i];
      if (!it.componentName || !it.componentName.trim()) {
        setFormError(`Please enter or select a Component Name (e.g. Tag, Label, Tape) for Row #${i + 1}.`);
        return;
      }
      if (!it.materialId) {
        setFormError(`Please select an Inventory Material for Row #${i + 1}.`);
        return;
      }
      const qty = parseFloat(it.extraQty);
      if (!qty || isNaN(qty) || qty <= 0) {
        setFormError(`Please enter a valid Extra Quantity (> 0) for Row #${i + 1}.`);
        return;
      }
      const mat = materials.find(m => String(m.id) === String(it.materialId));
      if (!mat) {
        setFormError(`Selected material not found for Row #${i + 1}.`);
        return;
      }
      const currentStock = parseFloat(mat.stock || mat.totalStock || 0);
      if (currentStock < qty) {
        setFormError(`Insufficient stock for "${mat.name}". Available: ${currentStock} ${mat.unit || 'Pcs'}, Requested: ${qty}.`);
        return;
      }
    }

    const voucherId = `EMI-WO-${Date.now().toString().slice(-6)}`;
    const issueDateStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const issuedPayloadItems = woItems.map(it => {
      const mat = materials.find(m => String(m.id) === String(it.materialId));
      const matCode = mat.itemCode || mat.item_code || mat.materialCode || mat.code || mat.id;
      const compName = (it.componentName || '').trim() || mat.category || 'Accessory';
      return {
        materialId: mat.id,
        materialCode: matCode,
        itemCode: matCode,
        materialName: mat.color && mat.color !== 'Default' ? `${mat.name} (${mat.color})` : mat.name,
        bomItemName: compName,
        bomItemDetail: `Direct Extra Issue (Without BOM) - [${compName}]`,
        totalRequired: parseFloat(it.extraQty),
        unit: mat.unit || it.unit || 'Pcs',
        reason: it.reason + (it.remarks ? ` - ${it.remarks}` : ''),
        previouslyIssued: 0,
        receiverDept: woReceiverDept.trim(),
        receiverName: woReceiverName.trim()
      };
    });

    if (onIssueMaterials) {
      onIssueMaterials(
        woLotId.trim(),
        parseInt(woPieces, 10) || 100,
        issuedPayloadItems,
        false, // isReissue: false (Extra Material Issue)
        personName.trim(),
        woReceiverName.trim(),
        woReceiverDept.trim(),
        true, // isWithoutBom
        voucherId // customId
      );
    }

    saveExtraMaterialIssueToDb({
      voucherId,
      lotId: woLotId.trim(),
      style: woLotStyle.trim() || 'Floor Issue',
      brand: woBrand.trim() || 'Mohit Hosiery',
      category: woCategory.trim() || 'Extra Material Issue',
      season: 'Current',
      pieces: parseInt(woPieces, 10) || 100,
      personName: personName.trim(),
      receiverName: woReceiverName.trim(),
      receiverDept: woReceiverDept.trim(),
      issueDate: issueDateStr,
      status: 'Issued',
      isWithoutBom: true,
      isReissue: false,
      is_reissue: 0,
      items: issuedPayloadItems.map(it => ({
        ...it,
        baseQty: 0,
        issuePercentage: 100,
        maxAllowedQty: 0,
        excessQty: it.totalRequired,
        exceedsLimit: false
      }))
    });

    setPrintSlipData({
      voucherId,
      issueDate: issueDateStr,
      lotId: woLotId.trim(),
      design: {
        id: woLotId.trim(),
        style: woLotStyle.trim() || 'Floor Issue',
        brand: woBrand.trim() || 'Mohit Hosiery',
        category: woCategory.trim() || 'Floor Requisition'
      },
      pieces: parseInt(woPieces, 10) || 100,
      personName: personName.trim(),
      receiverName: woReceiverName.trim(),
      receiverDept: woReceiverDept.trim(),
      items: issuedPayloadItems,
      isWithoutBom: true
    });

    setFormSuccess(`Successfully issued ${issuedPayloadItems.length} extra material item(s) Without BOM for Lot #${woLotId.trim()}! Voucher: ${voucherId}`);

    setWoItems([
      {
        id: Date.now(),
        componentName: 'Label',
        materialId: '',
        extraQty: '',
        unit: 'Pcs',
        reason: EXTRA_REASONS[0],
        remarks: ''
      }
    ]);
    setWoLotId('');
    setWoReceiverName('');
    setTimeout(() => setFormSuccess(''), 6000);
  };

  // ── Barcode Scanner State & Handlers ─────────────────────────────────────
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeScanFeedback, setBarcodeScanFeedback] = useState(null); // { type: 'success'|'error', msg: '' }
  const [highlightedRowIndex, setHighlightedRowIndex] = useState(null);
  const barcodeInputRef = useRef(null);

  // Audio chirp sound for instant scan feedback
  const playScanChirp = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  // Process Scanned Barcode and Map to BOM Component Row
  const handleBarcodeScanSubmit = (e) => {
    if (e) e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;

    setBarcodeScanFeedback(null);
    const upperRaw = raw.toUpperCase();

    // 1. Find material in inventory matching itemCode, id, materialCode, barcodeId, or name
    const matchedMat = materials.find(m => {
      const itemCode = String(m.itemCode || '').toUpperCase();
      const id = String(m.id || '').toUpperCase();
      const code = String(m.materialCode || m.code || '').toUpperCase();
      const bar = String(m.barcodeId || '').toUpperCase();
      const name = String(m.name || '').toUpperCase();
      const category = String(m.category || '').toUpperCase();

      return itemCode === upperRaw || id === upperRaw || code === upperRaw || bar === upperRaw ||
             name.includes(upperRaw) || category.includes(upperRaw);
    });

    if (!matchedMat) {
      setBarcodeScanFeedback({
        type: 'error',
        msg: `❌ No material found matching barcode/ID "${raw}". Please verify inventory.`
      });
      return;
    }

    // Play crisp scan audio chirp
    playScanChirp();

    // 2. Auto-map or select row in BOM component table
    let matchedRowId = null;

    setBomMappings(prev => {
      const next = [...prev];
      // Check if material is already assigned to a BOM row
      const existingIdx = next.findIndex(item => String(item.materialId) === String(matchedMat.id));

      if (existingIdx !== -1) {
        matchedRowId = next[existingIdx].id;
        const currentQty = parseFloat(next[existingIdx].extraQty) || 0;
        next[existingIdx] = {
          ...next[existingIdx],
          selectedForExtra: true,
          extraQty: currentQty > 0 ? currentQty + 1 : 1
        };
      } else {
        // Find first row without assigned material or matching component name
        const unassignedIdx = next.findIndex(item => !item.materialId || item.materialId === '');
        if (unassignedIdx !== -1) {
          matchedRowId = next[unassignedIdx].id;
          next[unassignedIdx] = {
            ...next[unassignedIdx],
            materialId: matchedMat.id,
            selectedForExtra: true,
            extraQty: 1
          };
        } else if (next.length > 0) {
          matchedRowId = next[0].id;
          next[0] = {
            ...next[0],
            selectedForExtra: true,
            extraQty: (parseFloat(next[0].extraQty) || 0) + 1
          };
        }
      }
      return next;
    });

    setHighlightedRowIndex(matchedRowId);
    setBarcodeScanFeedback({
      type: 'success',
      msg: `✅ Barcode Scanned: Matched "${matchedMat.name || matchedMat.itemCode || matchedMat.materialCode}" (Stock: ${matchedMat.totalStock || matchedMat.stock || 0} ${matchedMat.unit || 'Pcs'}). Row selected for Extra Issue.`
    });

    setBarcodeInput('');
    setTimeout(() => {
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, 100);
  };
  
  // Printable slip modal
  const [printSlipData, setPrintSlipData] = useState(null);
  const [printAuditModalData, setPrintAuditModalData] = useState(null);
  const activeLotIdRef = useRef(null);

  // 5% Threshold Exceeded Approval Modal State
  const [extraApprovalModal, setExtraApprovalModal] = useState(null);

  // Issue Confirmation Modal State (shows summary & confirmation before final dispatch)
  const [confirmIssueModal, setConfirmIssueModal] = useState(null);

  // Calculate extra issue percentage and 1% threshold compliance
  const getComponentExtraPercentage = (item) => {
    if (!item) return { baseQty: 0, extraQty: 0, percentage: 0, exceedsLimit: false, maxAllowedQty: 0, excessQty: 0 };
    const extraQty = parseFloat(item.extraQty) || 0;
    const baseQty = item.previouslyIssuedQty > 0
      ? item.previouslyIssuedQty
      : ((Number(pieces) || Number(selectedDesign?.quantity) || 100) * (Number(item.qtyPerPiece) || 1));
    
    const percentage = baseQty > 0 ? (extraQty / baseQty) * 100 : (extraQty > 0 ? 100 : 0);
    const maxAllowedQty = Math.round((baseQty * 0.01) * 100) / 100;
    const exceedsLimit = percentage > 1.0;

    return {
      baseQty: Math.round(baseQty * 100) / 100,
      extraQty,
      percentage: Number(percentage.toFixed(1)),
      exceedsLimit,
      maxAllowedQty,
      excessQty: Math.max(0, Math.round((extraQty - maxAllowedQty) * 100) / 100)
    };
  };

  // Selected design object
  const selectedDesign = useMemo(() => {
    return designs.find(d => String(d.id) === String(selectedDesignId));
  }, [designs, selectedDesignId]);

  // Extra Material Issues Table State from Database
  const [dbExtraIssues, setDbExtraIssues] = useState([]);

  // Fetch extra material issues directly from database table
  const fetchDbExtraIssues = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/extra-material-issues`);
      if (res.ok) {
        const data = await res.json();
        setDbExtraIssues(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch extra material issues from database table:', err);
    }
  };

  useEffect(() => {
    fetchDbExtraIssues();
  }, []);

  // Issue logs fetched from backend to guarantee fresh records
  const [fetchedIssueLogs, setFetchedIssueLogs] = useState([]);

  const fetchDbIssueLogs = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/issue-logs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setFetchedIssueLogs(data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch issue logs from backend:', err);
    }
  };

  useEffect(() => {
    fetchDbIssueLogs();
  }, []);

  // Combined issue logs (props + backend)
  const allIssueLogs = useMemo(() => {
    const map = new Map();
    (issueLogs || []).forEach(log => {
      if (log && (log.id || log.lotId)) {
        map.set(String(log.id || `${log.lotId}-${log.date}`), log);
      }
    });
    (fetchedIssueLogs || []).forEach(log => {
      if (log && (log.id || log.lotId)) {
        const key = String(log.id || `${log.lotId}-${log.date}`);
        if (!map.has(key)) {
          map.set(key, log);
        }
      }
    });
    const merged = Array.from(map.values());
    if (merged.length > 0) return merged;
    return (issueLogs && issueLogs.length > 0) ? issueLogs : fetchedIssueLogs;
  }, [issueLogs, fetchedIssueLogs]);

  // Set of Lot IDs that have already had material issued (non-return)
  const alreadyIssuedLotIds = useMemo(() => {
    const set = new Set();
    allIssueLogs.forEach(log => {
      const isReturn = log.isReturn === true || log.isReturn === 1 || String(log.isReturn).toLowerCase() === 'true';
      if (!isReturn && log.lotId) {
        set.add(String(log.lotId).toLowerCase().trim());
      }
    });
    dbExtraIssues.forEach(item => {
      if (item.lotId) {
        set.add(String(item.lotId).toLowerCase().trim());
      }
    });
    return set;
  }, [allIssueLogs, dbExtraIssues]);

  // Only show lots that are Approved AND have already had material issued
  const alreadyIssuedDesigns = useMemo(() => {
    return designs.filter(d => {
      if (d.status !== 'Approved') return false;
      const idStr = String(d.id || '').toLowerCase().trim();
      const lot2Str = String(d.lotNo2 || '').toLowerCase().trim();
      const hasBeenIssued = (idStr && alreadyIssuedLotIds.has(idStr)) ||
                            (lot2Str && alreadyIssuedLotIds.has(lot2Str));
      return hasBeenIssued;
    });
  }, [designs, alreadyIssuedLotIds]);

  // Helper to persist extra material issues to database table
  const saveExtraMaterialIssueToDb = async (payload) => {
    try {
      await fetch(`${getBackendUrl()}/api/extra-material-issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchDbExtraIssues();
      fetchDbIssueLogs();
    } catch (err) {
      console.error('Failed to save extra material issue to database table:', err);
    }
  };

  // Auto-fill personName from currentUser
  useEffect(() => {
    if (currentUser?.name) {
      setPersonName(currentUser.name);
    }
  }, [currentUser]);

  // Filter already issued designs by search query
  const filteredDesigns = useMemo(() => {
    const q = searchLotQuery.toLowerCase().trim();
    if (!q) return alreadyIssuedDesigns;
    return alreadyIssuedDesigns.filter(d => {
      const idMatch = String(d.id || '').toLowerCase().includes(q);
      const lot2Match = String(d.lotNo2 || '').toLowerCase().includes(q);
      const brandMatch = String(d.brand || '').toLowerCase().includes(q);
      const catMatch = String(d.category || '').toLowerCase().includes(q);
      const styleMatch = String(d.style || '').toLowerCase().includes(q);
      const fabricMatch = String(d.fabricType || '').toLowerCase().includes(q);
      return idMatch || lot2Match || brandMatch || catMatch || styleMatch || fabricMatch;
    });
  }, [alreadyIssuedDesigns, searchLotQuery]);

  // Clear selected lot if not among already issued designs
  useEffect(() => {
    if (selectedDesignId && alreadyIssuedDesigns.length > 0) {
      const exists = alreadyIssuedDesigns.some(d => String(d.id) === String(selectedDesignId));
      if (!exists) {
        setSelectedDesignId('');
      }
    }
  }, [alreadyIssuedDesigns, selectedDesignId]);

  // Calculate previous issues for the selected lot
  const lotPreviousIssues = useMemo(() => {
    if (!selectedDesignId) return [];
    return allIssueLogs.filter(log => String(log.lotId) === String(selectedDesignId));
  }, [allIssueLogs, selectedDesignId]);

  // Summary of already issued quantities per component
  const issuedSummaryPerBom = useMemo(() => {
    const summary = {};
    lotPreviousIssues.forEach(log => {
      if (log.materials) {
        log.materials.forEach(m => {
          const key = (m.bomItemName || m.name || '').toLowerCase().trim();
          if (!summary[key]) {
            summary[key] = { totalQty: 0, unit: m.unit || 'Pcs', count: 0, logs: [] };
          }
          summary[key].totalQty += (Number(m.qty) || 0);
          summary[key].count += 1;
          summary[key].logs.push({
            logId: log.id,
            date: log.date,
            qty: m.qty,
            unit: m.unit,
            personName: log.personName,
            isReissue: log.isReissue
          });
        });
      }
    });
    return summary;
  }, [lotPreviousIssues]);

  // Fetch pieces from cutting records or design default
  useEffect(() => {
    if (!selectedDesignId) {
      setPieces(100);
      setBomMappings([]);
      return;
    }

    const fetchPieces = async () => {
      setIsLoadingPieces(true);
      try {
        const res = await fetch(`${getBackendUrl()}/api/cutting/${encodeURIComponent(selectedDesignId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.header && Number(data.header.Total_Cutting_Pcs) > 0) {
            setPieces(Number(data.header.Total_Cutting_Pcs));
          } else if (data && data.totalPcs > 0) {
            setPieces(Number(data.totalPcs));
          } else {
            setPieces(100);
          }
        } else {
          setPieces(100);
        }
      } catch (err) {
        setPieces(100);
      } finally {
        setIsLoadingPieces(false);
      }
    };

    fetchPieces();
  }, [selectedDesignId]);

  // Build BOM mappings when selected design changes
  useEffect(() => {
    if (!selectedDesignId || !selectedDesign || !selectedDesign.bom) {
      setBomMappings([]);
      activeLotIdRef.current = null;
      return;
    }

    const isDifferentLot = String(activeLotIdRef.current) !== String(selectedDesignId);
    activeLotIdRef.current = selectedDesignId;

    if (isDifferentLot) {
      setReceiverName('');
      setReceiverDept('');
    }

    setBomMappings(prev => {
      // If staying on the same lot, preserve all user selections and inputs!
      const prevMap = isDifferentLot ? new Map() : new Map(prev.map(p => [p.id, p]));

      return selectedDesign.bom.map((bomItem, idx) => {
        const rawPerPiece = parseFloat(bomItem.detail) || 1;
        const isYes = String(bomItem.status).toLowerCase() === 'yes';

        let matchedMat = null;
        if (bomItem.materialId) {
          matchedMat = materials.find(m => String(m.id) === String(bomItem.materialId));
        }
        if (isYes && !matchedMat && bomItem.description) {
          matchedMat = materials.find(m => m.name.toLowerCase() === bomItem.description.toLowerCase());
        }
        if (isYes && !matchedMat && bomItem.name) {
          matchedMat = materials.find(m => m.name.toLowerCase().includes(bomItem.name.toLowerCase()));
        }

        const key = (bomItem.name || '').toLowerCase().trim();
        const prevSummary = issuedSummaryPerBom[key] || { totalQty: 0, logs: [] };

        const existing = prevMap.get(idx);
        if (existing) {
          return {
            ...existing,
            bomItemName: bomItem.name,
            bomItemDetail: bomItem.description || bomItem.detail || '',
            status: bomItem.status,
            isRequired: isYes,
            qtyPerPiece: rawPerPiece,
            previouslyIssuedQty: prevSummary.totalQty,
            previousLogsCount: prevSummary.logs.length
          };
        }

        return {
          id: idx,
          bomItemName: bomItem.name,
          bomItemDetail: bomItem.description || bomItem.detail || '',
          status: bomItem.status,
          isRequired: isYes,
          selectedForExtra: false,
          materialId: matchedMat ? matchedMat.id : (bomItem.materialId || ''),
          qtyPerPiece: rawPerPiece,
          unit: matchedMat ? (matchedMat.unit || 'Pcs') : 'Pcs',
          previouslyIssuedQty: prevSummary.totalQty,
          previousLogsCount: prevSummary.logs.length,
          extraQty: '',
          extraReason: 'Cutting Wastage / Excess Loss',
          extraRemarks: ''
        };
      });
    });
  }, [selectedDesignId, selectedDesign, materials, issuedSummaryPerBom]);

  // Count active/required BOM items
  const activeBomCount = useMemo(() => {
    return bomMappings.filter(m => m.isRequired || m.previouslyIssuedQty > 0).length;
  }, [bomMappings]);

  // Filter displayed BOM components (only show required / active items by default)
  const displayedBomMappings = useMemo(() => {
    return bomMappings.filter(item => {
      if (!showAllBom && !item.isRequired && !item.previouslyIssuedQty) {
        return false;
      }
      return true;
    });
  }, [bomMappings, showAllBom]);

  // Handle updates to individual row mapping
  const handleMappingChange = (originalIndex, field, value) => {
    setBomMappings(prev => prev.map((item, idx) => {
      if (idx !== originalIndex) return item;
      const updated = { ...item, [field]: value };

      // When user chooses an inventory material, auto-update unit and auto-check the item for issue!
      if (field === 'materialId') {
        const mat = materials.find(m => String(m.id) === String(value));
        if (mat) {
          updated.unit = mat.unit || item.unit || 'Pcs';
        }
        if (value) {
          updated.selectedForExtra = true;
        }
      }

      // When user inputs extra quantity > 0, auto-check the item!
      if (field === 'extraQty' && parseFloat(value) > 0) {
        updated.selectedForExtra = true;
      }

      return updated;
    }));
  };

  // Quick increment extra quantity
  const handleQuickAddQty = (originalIndex, addAmount) => {
    setBomMappings(prev => prev.map((item, idx) => {
      if (idx === originalIndex) {
        const current = parseFloat(item.extraQty) || 0;
        const newQty = Math.max(0, current + addAmount);
        return { 
          ...item, 
          extraQty: newQty > 0 ? newQty : '',
          selectedForExtra: newQty > 0
        };
      }
      return item;
    }));
  };

  // Handle Confirmation & Submission of >5% Requisition for Admin Approval
  const handleConfirmSubmitApproval = async () => {
    if (!extraApprovalModal) return;
    const { items, selectedDesign: design, pieces: pcs, personName: pName, receiverName: rName, receiverDept: rDept, isSingle, singleIdx, allItems } = extraApprovalModal;

    const itemsToSubmit = (allItems || items);
    const payloadItems = itemsToSubmit.map(it => {
      const mat = materials.find(m => String(m.id) === String(it.item?.materialId || it.materialId)) || it.mat;
      const extraQty = it.extraQty !== undefined ? it.extraQty : parseFloat(it.item?.extraQty || 0);
      return {
        materialId: mat ? mat.id : (it.item?.materialId || 'MAT'),
        materialName: mat ? (mat.color && mat.color !== 'Default' ? `${mat.name} (${mat.color})` : mat.name) : (it.item?.bomItemName || 'Material'),
        bomItemName: it.item?.bomItemName || it.bomItemName,
        bomItemDetail: it.item?.bomItemDetail || it.bomItemDetail || '',
        totalRequired: extraQty,
        unit: mat?.unit || it.item?.unit || 'Pcs',
        reason: it.reason || (it.item?.extraReason + (it.item?.extraRemarks ? ` - ${it.item.extraRemarks}` : '')),
        previouslyIssued: it.item?.previouslyIssuedQty || 0,
        receiverDept: rDept,
        receiverName: rName,
        issuePercentage: it.percentage,
        baseQty: it.baseQty,
        maxAllowedQty: it.maxAllowedQty,
        excessQty: it.excessQty,
        exceedsLimit: it.exceedsLimit
      };
    });

    const maxExceededPct = Math.max(...items.map(i => i.percentage));
    const exceededSummary = items.map(i => `${i.item.bomItemName}: +${i.extraQty} ${i.item.unit} (+${i.percentage}%)`).join(', ');

    const approvalRequestData = {
      lotId: design.id,
      category: design.category,
      brand: design.brand,
      pieces: pcs,
      items: payloadItems,
      isReissue: true,
      personName: pName,
      receiverName: rName,
      receiverDept: rDept,
      exceedsLimit: true,
      extraPercentage: maxExceededPct,
      reason: `Extra Material Requisition Exceeds 1% Limit: ${exceededSummary}`,
      requesterName: currentUser?.name || pName || 'Store Staff',
      requesterRole: currentUser?.role || 'Store'
    };

    if (onSubmitApproval) {
      onSubmitApproval('material_issue', approvalRequestData, currentUser);
    } else {
      try {
        await fetch(`${getBackendUrl()}/api/approval-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `AR${Date.now()}`,
            type: 'material_issue',
            status: 'pending',
            date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            ...approvalRequestData
          })
        });
      } catch (err) {
        console.error('Failed to submit approval request:', err);
      }
    }

    // Save Requisition into extra_material_issues database table with status: Pending Approval
    saveExtraMaterialIssueToDb({
      voucherId: `AR-${Date.now().toString().slice(-6)}`,
      lotId: design.id,
      style: design.style || '',
      brand: design.brand || '',
      category: design.category || '',
      season: design.season || '',
      pieces: pcs,
      personName: pName,
      receiverName: rName,
      receiverDept: rDept,
      status: 'Pending Approval',
      exceedsLimit: true,
      items: payloadItems
    });

    setFormSuccess(`Approval Request submitted to Admin! Lot ${design.id} extra requisition (${exceededSummary}) is now pending Admin approval. Material will be issued after Admin approval.`);

    // Reset ALL row inputs completely to clean empty state
    setBomMappings(prev => prev.map(m => ({
      ...m,
      extraQty: '',
      extraRemarks: '',
      selectedForExtra: false
    })));

    setReceiverName('');
    setReceiverDept('');
    setExtraApprovalModal(null);
    setTimeout(() => setFormSuccess(''), 8000);
  };

  // Issue SINGLE component - Opens Confirmation Modal
  const handleIssueSingleComponent = (index) => {
    setFormError('');
    setFormSuccess('');

    const item = bomMappings[index];
    if (!item) return;

    if (!selectedDesign) {
      setFormError('Please select an approved lot first.');
      return;
    }

    if (!item.materialId) {
      setFormError(`Please select an Inventory Material for "${item.bomItemName}".`);
      return;
    }

    const extraQty = parseFloat(item.extraQty);
    if (!extraQty || isNaN(extraQty) || extraQty <= 0) {
      setFormError(`Please enter a valid extra quantity (> 0) for "${item.bomItemName}".`);
      return;
    }

    const mat = materials.find(m => String(m.id) === String(item.materialId));
    if (!mat) {
      setFormError(`Selected inventory material [${item.materialId}] was not found.`);
      return;
    }

    if (mat.stock < extraQty) {
      setFormError(`Insufficient stock for "${mat.name}". Available: ${mat.stock} ${mat.unit || 'Pcs'}, Requested: ${extraQty} ${mat.unit || 'Pcs'}.`);
      return;
    }

    if (!personName.trim()) {
      setFormError('Please provide Issuer Person name.');
      return;
    }

    if (!receiverName.trim()) {
      setFormError('Please enter Receiver Person name before issuing material.');
      return;
    }

    if (!receiverDept.trim()) {
      setFormError('Please enter Receiver Department / Line before issuing material.');
      return;
    }

    // ── 5% Threshold Check ──
    const pctInfo = getComponentExtraPercentage(item);
    if (pctInfo.exceedsLimit) {
      // Trigger Warning & Approval Modal
      setExtraApprovalModal({
        isSingle: true,
        singleIdx: index,
        items: [{
          originalIdx: index,
          item,
          mat,
          extraQty,
          baseQty: pctInfo.baseQty,
          percentage: pctInfo.percentage,
          maxAllowedQty: pctInfo.maxAllowedQty,
          excessQty: pctInfo.excessQty,
          exceedsLimit: true,
          reason: item.extraReason + (item.extraRemarks ? ` - ${item.extraRemarks}` : '')
        }],
        selectedDesign,
        pieces,
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim()
      });
      return;
    }

    // Standard Issue (<= 5%) -> Show Confirmation Modal first
    setConfirmIssueModal({
      isSingle: true,
      singleIdx: index,
      items: [{
        originalIdx: index,
        item,
        mat,
        extraQty,
        baseQty: pctInfo.baseQty,
        percentage: pctInfo.percentage,
        maxAllowedQty: pctInfo.maxAllowedQty,
        excessQty: pctInfo.excessQty,
        exceedsLimit: false,
        reason: item.extraReason + (item.extraRemarks ? ` - ${item.extraRemarks}` : '')
      }],
      selectedDesign,
      pieces,
      personName: personName.trim(),
      receiverName: receiverName.trim(),
      receiverDept: receiverDept.trim()
    });
  };

  // Issue ALL SELECTED components - Opens Confirmation Modal
  const handleIssueSelectedComponents = () => {
    setFormError('');
    setFormSuccess('');

    if (!selectedDesign) {
      setFormError('Please select an approved lot first.');
      return;
    }

    const selectedItems = bomMappings.filter(m => m.selectedForExtra);
    if (selectedItems.length === 0) {
      setFormError('Please select at least one BOM component checkbox to issue extra material.');
      return;
    }

    // Validate all selected
    for (const item of selectedItems) {
      if (!item.materialId) {
        setFormError(`Please select an Inventory Material for "${item.bomItemName}".`);
        return;
      }
      const qty = parseFloat(item.extraQty);
      if (!qty || isNaN(qty) || qty <= 0) {
        setFormError(`Please enter a valid extra quantity (> 0) for "${item.bomItemName}".`);
        return;
      }
      const mat = materials.find(m => String(m.id) === String(item.materialId));
      if (!mat) {
        setFormError(`Material not found for "${item.bomItemName}".`);
        return;
      }
      if (mat.stock < qty) {
        setFormError(`Insufficient stock for "${mat.name}". Available: ${mat.stock}, Requested: ${qty}.`);
        return;
      }
    }

    if (!personName.trim()) {
      setFormError('Please provide Issuer Person name.');
      return;
    }

    if (!receiverName.trim()) {
      setFormError('Please enter Receiver Person name before issuing material.');
      return;
    }

    if (!receiverDept.trim()) {
      setFormError('Please enter Receiver Department / Line before issuing material.');
      return;
    }

    // ── 5% Threshold Check Across Selected Items ──
    const itemsWithPct = selectedItems.map(item => {
      const mat = materials.find(m => String(m.id) === String(item.materialId));
      const pctInfo = getComponentExtraPercentage(item);
      return {
        originalIdx: item.id,
        item,
        mat,
        extraQty: parseFloat(item.extraQty),
        baseQty: pctInfo.baseQty,
        percentage: pctInfo.percentage,
        maxAllowedQty: pctInfo.maxAllowedQty,
        excessQty: pctInfo.excessQty,
        exceedsLimit: pctInfo.exceedsLimit,
        reason: item.extraReason + (item.extraRemarks ? ` - ${item.extraRemarks}` : '')
      };
    });

    const exceedingItems = itemsWithPct.filter(it => it.exceedsLimit);
    if (exceedingItems.length > 0) {
      // Trigger Warning & Approval Modal
      setExtraApprovalModal({
        isSingle: false,
        items: exceedingItems,
        allItems: itemsWithPct,
        selectedDesign,
        pieces,
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim()
      });
      return;
    }

    // Standard Issue (all <= 5%) -> Show Confirmation Modal first
    setConfirmIssueModal({
      isSingle: false,
      items: itemsWithPct,
      selectedDesign,
      pieces,
      personName: personName.trim(),
      receiverName: receiverName.trim(),
      receiverDept: receiverDept.trim()
    });
  };

  // Execute Issue after User Confirms in Modal
  const handleExecuteConfirmedIssue = () => {
    if (!confirmIssueModal) return;
    const { isSingle, singleIdx, items, selectedDesign: design, pieces: pcs, personName: pName, receiverName: rName, receiverDept: rDept } = confirmIssueModal;

    const voucherId = `EMI-${Date.now().toString().slice(-6)}`;
    const issueDateStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const issuedPayloadItems = items.map(it => ({
      materialId: it.mat.id,
      materialName: it.mat.color && it.mat.color !== 'Default' ? `${it.mat.name} (${it.mat.color})` : it.mat.name,
      bomItemName: it.item.bomItemName,
      bomItemDetail: it.item.bomItemDetail,
      totalRequired: it.extraQty,
      unit: it.mat.unit || it.item.unit || 'Pcs',
      reason: it.reason,
      previouslyIssued: it.item.previouslyIssuedQty,
      receiverDept: rDept,
      receiverName: rName
    }));

    if (onIssueMaterials) {
      onIssueMaterials(
        design.id,
        pcs,
        issuedPayloadItems,
        false, // isReissue: false (Extra Material Issue)
        isSingle
          ? `${pName} (Extra: ${items[0]?.item?.extraReason || 'Requisition'})`
          : `${pName} (Extra Batch Issue)`,
        rName,
        rDept,
        false, // isWithoutBom
        voucherId // customId
      );
    }

    // Save directly to extra_material_issues database table
    saveExtraMaterialIssueToDb({
      voucherId,
      lotId: design.id,
      style: design.style || '',
      brand: design.brand || '',
      category: design.category || 'Extra Material Issue',
      season: design.season || '',
      pieces: pcs,
      personName: pName,
      receiverName: rName,
      receiverDept: rDept,
      issueDate: issueDateStr,
      status: 'Issued',
      isReissue: false,
      is_reissue: 0,
      items: items.map(it => ({
        materialId: it.mat.id,
        materialName: it.mat.color && it.mat.color !== 'Default' ? `${it.mat.name} (${it.mat.color})` : it.mat.name,
        bomItemName: it.item.bomItemName,
        bomItemDetail: it.item.bomItemDetail,
        totalRequired: it.extraQty,
        unit: it.mat.unit || it.item.unit || 'Pcs',
        reason: it.reason,
        previouslyIssued: it.item.previouslyIssuedQty,
        receiverDept: rDept,
        receiverName: rName,
        baseQty: it.baseQty,
        issuePercentage: it.percentage,
        maxAllowedQty: it.maxAllowedQty,
        excessQty: it.excessQty,
        exceedsLimit: it.exceedsLimit
      }))
    });

    const slipPayload = {
      voucherId,
      issueDate: issueDateStr,
      design,
      pieces: pcs,
      personName: pName,
      receiverName: rName,
      receiverDept: rDept,
      items: issuedPayloadItems,
      isSingle
    };

    setPrintSlipData(slipPayload);
    setFormSuccess(`Successfully issued ${issuedPayloadItems.length} extra material component(s) for Lot ${design.id}!`);

    // Reset ALL row inputs completely to clean empty state
    setBomMappings(prev => prev.map(m => ({
      ...m,
      extraQty: '',
      extraRemarks: '',
      selectedForExtra: false
    })));

    setReceiverName('');
    setReceiverDept('');

    setConfirmIssueModal(null);
    setTimeout(() => setFormSuccess(''), 6000);
  };

  // PDF Download handler
  const handleDownloadSlipPdf = (data) => {
    if (!data) return;
    const doc = new jsPDF();

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('MH ACCESSORIES & BOM STORE', 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('G-PDMS Secure Systems — Garment Product Data Management', 14, 25);

    // Title Badge
    doc.setFillColor(data.isWithoutBom ? 234 : 99, data.isWithoutBom ? 88 : 102, data.isWithoutBom ? 12 : 241);
    doc.roundedRect(14, 30, 182, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const slipTitle = data.isWithoutBom
      ? 'EXTRA MATERIAL ISSUE VOUCHER (WITHOUT BOM - DIRECT FLOOR)'
      : 'EXTRA MATERIAL REQUISITION & ISSUE VOUCHER';
    doc.text(slipTitle, 16, 37);

    // Info Grid
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 182, 34, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text(`Voucher No:`, 18, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(data.voucherId || 'EMI-0000', 44, 51);

    doc.setFont('helvetica', 'bold');
    doc.text(`Issue Date:`, 110, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(data.issueDate || '—', 135, 51);

    doc.setFont('helvetica', 'bold');
    doc.text(`Lot Number:`, 18, 59);
    doc.setFont('helvetica', 'normal');
    const lotLabel = data.isWithoutBom
      ? `Lot #${data.lotId || data.design?.id || '—'} [WITHOUT BOM]`
      : `Lot ${data.design?.id || '—'} ${data.design?.lotNo2 ? `(${data.design.lotNo2})` : ''}`;
    doc.text(lotLabel, 44, 59);

    doc.setFont('helvetica', 'bold');
    doc.text(`Category / Style:`, 110, 59);
    doc.setFont('helvetica', 'normal');
    const catLabel = data.isWithoutBom
      ? `${data.design?.style || data.style || 'Floor Issue'} [${data.design?.brand || data.brand || 'Mohit Hosiery'}]`
      : `${data.design?.category || '—'} [${data.design?.brand || 'Generic'}]`;
    doc.text(catLabel, 135, 59);

    doc.setFont('helvetica', 'bold');
    doc.text(`Issued By:`, 18, 67);
    doc.setFont('helvetica', 'normal');
    doc.text(data.personName || 'Store In-charge', 44, 67);

    doc.setFont('helvetica', 'bold');
    doc.text(`Received By:`, 110, 67);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.receiverName || 'Dept Master'} (${data.receiverDept || 'Cutting'})`, 135, 67);

    doc.setFont('helvetica', 'bold');
    doc.text(`Batch Volume:`, 18, 74);
    doc.setFont('helvetica', 'normal');
    doc.text(`${(data.pieces || 0).toLocaleString()} Garment Units`, 44, 74);

    doc.setFont('helvetica', 'bold');
    doc.text(`Issue Type:`, 110, 74);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(data.isWithoutBom ? 'WITHOUT BOM FLOOR ISSUE' : 'EXTRA / WASTAGE REQUISITION', 135, 74);

    // Items Table
    const tableRows = (data.items || []).map((item, idx) => [
      idx + 1,
      item.bomItemName || (data.isWithoutBom ? item.materialName : '—'),
      `[${item.itemCode || item.materialCode || item.materialId}] ${item.materialName}`,
      item.previouslyIssued ? `${item.previouslyIssued} ${item.unit}` : (data.isWithoutBom ? 'N/A' : '0 Pcs'),
      `${item.totalRequired} ${item.unit}`,
      item.reason || 'Extra Issue'
    ]);

    autoTable(doc, {
      startY: 82,
      head: [['#', data.isWithoutBom ? 'Item Description' : 'BOM Component', 'Inventory Material Code & Name', 'Prev Issued', 'Extra Issued', 'Reason / Remarks']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: data.isWithoutBom ? [194, 65, 12] : [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 32, fontStyle: 'bold' },
        2: { cellWidth: 50 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 44 }
      }
    });

    const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 28;

    // Signatures
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    doc.line(14, finalY, 65, finalY);
    doc.text('Store Keeper (Issuer)', 14, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(data.personName || '', 14, finalY + 10);

    doc.setFont('helvetica', 'normal');
    doc.line(78, finalY, 128, finalY);
    doc.text('Receiver (Master/Tailor)', 78, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(data.receiverName || '', 78, finalY + 10);

    doc.setFont('helvetica', 'normal');
    doc.line(140, finalY, 196, finalY);
    doc.text('Authorized Manager / Supervisor', 140, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text('Store / Production Sign', 140, finalY + 10);

    doc.save(`EXTRA_MATERIAL_SLIP_${data.voucherId}_LOT_${data.lotId || data.design?.id || 'DIRECT'}.pdf`);
  };

  // Browser print trigger
  const handleTriggerBrowserPrint = () => {
    document.body.classList.add('print-extra-issue-mode');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-extra-issue-mode');
    }, 1000);
  };

  // All extra/re-issue logs (unfiltered) - strictly Extra Material & Re-Issues ONLY
  const allExtraLogs = useMemo(() => {
    const combined = [];
    const seenVouchers = new Set();

    // 1. Logs from allIssueLogs (App.jsx state / /api/issue-logs)
    (allIssueLogs || []).forEach(log => {
      const vid = String(log.id || '').toUpperCase();
      // STRICT FILTER: Exclude Without-BOM issues (WO-MI, BILL-MI, CH-MI, MI-WO)
      const isWithoutBom = log.isWithoutBom || 
        vid.startsWith('WO-MI-') || 
        vid.startsWith('BILL-MI-') || 
        vid.startsWith('CH-MI-') || 
        vid.startsWith('MI-WO-') ||
        String(log.category || '').toLowerCase().includes('without bom');
      if (isWithoutBom) return;

      // STRICT FILTER: Only include Extra Material or Re-issues
      const isExtra = log.isReissue || 
        vid.startsWith('EMI') || 
        vid.startsWith('RI') || 
        String(log.personName || '').toLowerCase().includes('extra') ||
        String(log.category || '').toLowerCase().includes('extra');

      if (isExtra) {
        const vId = String(log.id || `${log.lotId}-${log.date}`);
        if (!seenVouchers.has(vId)) {
          seenVouchers.add(vId);
          const cleanLot = String(log.lotId || '').trim().toLowerCase();
          const dMatch = (designs || []).find(d => 
            String(d.id || '').trim().toLowerCase() === cleanLot ||
            String(d.lotNo2 || '').trim().toLowerCase() === cleanLot ||
            String(d.lotNumber || '').trim().toLowerCase() === cleanLot
          );
          const dbMatch = (dbExtraIssues || []).find(db => 
            String(db.voucher_id || db.voucherId || db.id) === vId ||
            String(db.lot_id || db.lotId).trim().toLowerCase() === cleanLot
          );
          const brand = log.brand || dbMatch?.brand || dMatch?.brand || 'Mohit Hosiery';
          combined.push({
            ...log,
            brand,
            category: log.category || dMatch?.category || dbMatch?.category || 'Garment'
          });
        }
      }
    });

    // 2. Also incorporate dbExtraIssues if not already in combined
    (dbExtraIssues || []).forEach(dbRow => {
      const vId = String(dbRow.voucher_id || dbRow.voucherId || dbRow.id || '');
      if (vId && !seenVouchers.has(vId)) {
        seenVouchers.add(vId);
        const cleanLot = String(dbRow.lot_id || dbRow.lotId || '').trim().toLowerCase();
        const dMatch = (designs || []).find(d => 
          String(d.id || '').trim().toLowerCase() === cleanLot ||
          String(d.lotNo2 || '').trim().toLowerCase() === cleanLot ||
          String(d.lotNumber || '').trim().toLowerCase() === cleanLot
        );
        combined.push({
          id: vId,
          lotId: dbRow.lot_id || dbRow.lotId,
          date: dbRow.issue_date || dbRow.issueDate || (dbRow.created_at ? new Date(dbRow.created_at).toLocaleString('en-GB') : ''),
          personName: dbRow.person_name || dbRow.personName,
          receiverName: dbRow.receiver_name || dbRow.receiverName,
          receiverDept: dbRow.receiver_dept || dbRow.receiverDept,
          materials: (dbRow.items || []).map(it => ({
            name: it.materialName || it.material_name || it.name,
            bomItemName: it.bomItemName || it.bom_item_name,
            qty: it.totalRequired || it.total_required || it.qty,
            unit: it.unit || 'Pcs',
            reason: it.reason
          })),
          isReissue: vId.startsWith('RI') ? true : false,
          category: dbRow.category || dMatch?.category || 'Extra Material Issue',
          brand: dbRow.brand || dMatch?.brand || 'Mohit Hosiery',
          volume: dbRow.pieces
        });
      }
    });

    return combined;
  }, [allIssueLogs, dbExtraIssues, designs]);

  // Helper to accurately determine if a transaction log is Re-Issue vs Extra Material Issue
  const isLogReissue = (log) => {
    if (!log) return false;
    const vid = String(log.id || '').toUpperCase().trim();
    // Anything starting with EMI or EMI-WO- was created in Extra Material Issue -> ALWAYS Extra Material Issue, NEVER Re-Issue!
    if (vid.startsWith('EMI')) return false;
    // Explicit Extra category or person notes
    const cat = String(log.category || '').toLowerCase();
    const pName = String(log.personName || '').toLowerCase();
    if (cat.includes('extra') || pName.includes('(extra') || pName.includes('extra:')) return false;
    // Vouchers starting with RI or marked isReissue (and not EMI) are Re-Issues
    if (vid.startsWith('RI')) return true;
    return Boolean(log.isReissue);
  };

  // Parse date string (DD/MM/YYYY HH:mm, ISO, or YYYY-MM-DD) into Date object
  const parseDateToObj = (dateVal) => {
    if (!dateVal) return new Date(0);
    const str = String(dateVal).trim();
    const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?(?:\s*(AM|PM))?/i;
    const match = str.match(dmyRegex);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      let hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      const ampm = match[6];
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }
      return new Date(year, month, day, hour, minute);
    }
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  // Quick Date Range Presets helper
  const setQuickDatePreset = (preset) => {
    const today = new Date();
    const formatDateInput = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'today') {
      const tStr = formatDateInput(today);
      setHistoryDateFrom(tStr);
      setHistoryDateTo(tStr);
    } else if (preset === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yStr = formatDateInput(yest);
      setHistoryDateFrom(yStr);
      setHistoryDateTo(yStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setHistoryDateFrom(formatDateInput(past));
      setHistoryDateTo(formatDateInput(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setHistoryDateFrom(formatDateInput(firstDay));
      setHistoryDateTo(formatDateInput(today));
    } else if (preset === 'all') {
      setHistoryDateFrom('');
      setHistoryDateTo('');
    }
  };

  // Filter extra logs for History Tab Search + Category Sub-filter + Date Range
  const extraIssueLogs = useMemo(() => {
    let list = allExtraLogs;

    // 1. Filter by Category (Strict separation: Extra Material Issue vs Re-Issue)
    if (historyCategoryFilter === 'reissue') {
      list = list.filter(l => isLogReissue(l));
    } else if (historyCategoryFilter === 'extra') {
      list = list.filter(l => !isLogReissue(l));
    }

    // 2. Filter by Date Range (From - To)
    if (historyDateFrom) {
      const fromObj = new Date(historyDateFrom + 'T00:00:00');
      list = list.filter(l => {
        const dObj = parseDateToObj(l.date);
        return dObj >= fromObj;
      });
    }
    if (historyDateTo) {
      const toObj = new Date(historyDateTo + 'T23:59:59');
      list = list.filter(l => {
        const dObj = parseDateToObj(l.date);
        return dObj <= toObj;
      });
    }

    // 3. Filter by Search Query
    const q = historySearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(log => {
      const idMatch = String(log.id || '').toLowerCase().includes(q);
      const lotMatch = String(log.lotId || '').toLowerCase().includes(q);
      const personMatch = String(log.personName || '').toLowerCase().includes(q);
      const receiverMatch = String(log.receiverName || '').toLowerCase().includes(q);
      const deptMatch = String(log.receiverDept || '').toLowerCase().includes(q);
      const catMatch = String(log.category || '').toLowerCase().includes(q);
      const matMatch = log.materials && log.materials.some(m => 
        (m.name || '').toLowerCase().includes(q) || 
        (m.bomItemName || '').toLowerCase().includes(q) ||
        (m.reason || '').toLowerCase().includes(q)
      );
      return idMatch || lotMatch || personMatch || receiverMatch || deptMatch || catMatch || matMatch;
    });
  }, [allExtraLogs, historyCategoryFilter, historyDateFrom, historyDateTo, historySearch]);

  // Helper to build normalized slip data from log
  const buildSlipDataFromLog = (log) => {
    const matchedDesign = designs.find(d => String(d.id) === String(log.lotId));
    const cleanIssuer = (log.personName || 'Store In-charge').replace(/\s*\(.*?\)/, '').trim() || 'Store In-charge';
    const receiver = log.receiverName || 'Cutting Floor';
    const dept = log.receiverDept || 'Cutting Dept';

    return {
      voucherId: log.id,
      issueDate: log.date,
      lotId: log.lotId,
      design: matchedDesign || { id: log.lotId, category: log.category || 'Garment', brand: log.brand || '' },
      pieces: log.volume || matchedDesign?.quantity || 100,
      personName: cleanIssuer,
      receiverName: receiver,
      receiverDept: dept,
      isSingle: false,
      isReissue: isLogReissue(log),
      items: (log.materials || []).map(m => ({
        materialId: m.materialId || 'MT-ITEM',
        materialName: m.name || m.bomItemName,
        bomItemName: m.bomItemName || m.name,
        totalRequired: m.qty,
        unit: m.unit || 'Pcs',
        reason: m.reason || (isLogReissue(log) ? 'Re-Issue Requisition' : 'Extra Material Requisition')
      }))
    };
  };

  // Generate printable HTML for direct iframe printing (Store Copy + Production Copy)
  const generateExtraSlipPrintHtml = (slipData) => {
    const voucherId = slipData.voucherId || 'VOUCHER';
    const dateStr = slipData.issueDate || new Date().toLocaleDateString('en-GB');
    const lotId = slipData.lotId || slipData.design?.id || '—';
    const lotBadge = slipData.isWithoutBom ? 'WITHOUT BOM' : (slipData.isReissue ? 'RE-ISSUE' : 'EXTRA ISSUE');
    const brand = slipData.design?.brand || slipData.brand || 'Mohit Hosiery';
    const category = slipData.design?.category || slipData.design?.style || slipData.style || 'Garment';
    const pieces = slipData.pieces || 0;
    const personName = slipData.personName || 'Store In-charge';
    const receiverName = slipData.receiverName || 'Cutting Floor';
    const receiverDept = slipData.receiverDept || 'Cutting Dept';
    const items = slipData.items || [];

    const renderSlip = (copyTitle, isDashed = false) => `
      <div style="border: ${isDashed ? '1.5px dashed #000000' : '1.5px solid #000000'}; padding: 16px; border-radius: 4px; margin-bottom: 20px; background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000000; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <h2 style="margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000000;">MH ACCESSORIES & BOM STORE</h2>
            <span style="font-size: 10px; color: #000000; font-weight: 600;">Garment Product Data Management System (G-PDMS)</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; font-weight: 900; color: #000000; text-transform: uppercase;">EXTRA MATERIAL ISSUE VOUCHER</div>
            <span style="font-size: 10px; font-weight: 800; color: #000000;">[ ${copyTitle} ]</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; padding: 10px; background: #ffffff; border: 1.5px solid #000000; border-radius: 4px; font-size: 11px; margin-bottom: 12px; color: #000000;">
          <div><strong>Voucher No:</strong> <span style="font-family: monospace; font-weight: 900;">${voucherId}</span></div>
          <div><strong>Issue Date:</strong> <strong>${dateStr}</strong></div>
          <div><strong>Lot Number:</strong> <strong>Lot ${lotId}</strong> <span style="font-weight: 900; font-size: 9.5px; background: #ffffff; color: #000000; padding: 1px 5px; border-radius: 3px; border: 1.2px solid #000000;">${lotBadge}</span></div>
          <div><strong>Brand:</strong> ${brand}</div>
          <div><strong>Garment Type:</strong> ${category}</div>
          <div><strong>Order Volume:</strong> <strong>${Number(pieces).toLocaleString()} Units</strong></div>
          <div><strong>Issued By:</strong> <strong>${personName}</strong></div>
          <div><strong>Received By:</strong> <strong>${receiverName}</strong></div>
          <div><strong>Dept/Line:</strong> <strong>${receiverDept}</strong></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; border: 1.5px solid #000000;">
          <thead>
            <tr style="background-color: #f0f0f0; border-bottom: 1.5px solid #000000; color: #000000;">
              <th style="padding: 6px; text-align: center; width: 30px; border: 1px solid #000000; font-weight: 900;">#</th>
              <th style="padding: 6px; text-align: left; border: 1px solid #000000; font-weight: 900;">Component Name</th>
              <th style="padding: 6px; text-align: left; border: 1px solid #000000; font-weight: 900;">Material Description</th>
              <th style="padding: 6px; text-align: center; width: 90px; border: 1px solid #000000; font-weight: 900;">Extra Qty</th>
              <th style="padding: 6px; text-align: left; border: 1px solid #000000; font-weight: 900;">Reason / Cause</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => `
              <tr style="border-bottom: 1px solid #000000; color: #000000;">
                <td style="padding: 6px; text-align: center; border: 1px solid #000000; font-weight: 900;">${idx + 1}</td>
                <td style="padding: 6px; font-weight: 700; border: 1px solid #000000;"><span style="padding: 2px 6px; border-radius: 3px; background-color: #ffffff; color: #000000; border: 1.2px solid #000000; font-size: 11px; font-weight: 900;">${it.bomItemName || it.materialName}</span></td>
                <td style="padding: 6px; border: 1px solid #000000; font-weight: 600;">${it.materialName || it.bomItemName}</td>
                <td style="padding: 6px; text-align: center; font-weight: 900; color: #000000; border: 1px solid #000000;">${it.totalRequired || it.qty} ${it.unit || 'Pcs'}</td>
                <td style="padding: 6px; border: 1px solid #000000; font-weight: 600;">${it.reason || 'Extra Material Issue'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 11px; border-top: 1.5px solid #000000; padding-top: 16px; margin-top: 10px; color: #000000;">
          <div style="text-align: center;">
            <div style="height: 25px;"></div>
            <div style="border-bottom: 1.5px solid #000000; width: 85%; margin: 0 auto;"></div>
            <div style="margin-top: 4px; font-weight: 800; text-transform: uppercase;">Issued By (Store Keeper)</div>
            <div style="font-size: 10.5px; font-weight: 700;">${personName}</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 25px;"></div>
            <div style="border-bottom: 1.5px solid #000000; width: 85%; margin: 0 auto;"></div>
            <div style="margin-top: 4px; font-weight: 800; text-transform: uppercase;">Received By (Cutting/Master)</div>
            <div style="font-size: 10.5px; font-weight: 700;">${receiverName}</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 25px;"></div>
            <div style="border-bottom: 1.5px solid #000000; width: 85%; margin: 0 auto;"></div>
            <div style="margin-top: 4px; font-weight: 800; text-transform: uppercase;">Authorized / Supervisor</div>
            <div style="font-size: 10.5px; font-weight: 700;">Store / Production Head</div>
          </div>
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Extra Material Issue Slip - ${voucherId}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { margin: 0; padding: 0; background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${renderSlip('ORIGINAL STORE COPY', false)}
          ${renderSlip('DUPLICATE PRODUCTION COPY', true)}
        </body>
      </html>
    `;
  };

  // 1-Click Direct Print from History Table
  const handleDirectPrintLog = (log) => {
    const slipData = buildSlipDataFromLog(log);
    try {
      const printHtml = generateExtraSlipPrintHtml(slipData);
      const oldFrame = document.getElementById('extra-issue-print-iframe');
      if (oldFrame) {
        try { document.body.removeChild(oldFrame); } catch (e) {}
      }

      const printFrame = document.createElement('iframe');
      printFrame.id = 'extra-issue-print-iframe';
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

      setTimeout(() => {
        try {
          if (printFrame.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          }
        } catch (err) {
          console.warn('Iframe print error, falling back:', err);
          setPrintSlipData(slipData);
          handleTriggerBrowserPrint();
        }
      }, 250);
    } catch (err) {
      console.warn('Direct print error:', err);
      setPrintSlipData(slipData);
    }
  };

  // Preview on-screen and download PDF handler
  const handlePreviewSlip = (log) => {
    const slipData = buildSlipDataFromLog(log);
    setPrintSlipData(slipData);
  };

  // Calculate dynamic stats for History tab overview cards (reflecting active filters)
  const historyStats = useMemo(() => {
    let totalItemsCount = 0;
    let totalQtySum = 0;
    const uniqueLots = new Set();
    extraIssueLogs.forEach(log => {
      if (log.lotId) uniqueLots.add(String(log.lotId));
      if (log.materials && Array.isArray(log.materials)) {
        totalItemsCount += log.materials.length;
        log.materials.forEach(m => {
          totalQtySum += (parseFloat(m.qty) || 0);
        });
      }
    });
    return {
      totalVouchers: extraIssueLogs.length,
      totalItems: totalItemsCount,
      totalQty: totalQtySum,
      uniqueLotsCount: uniqueLots.size
    };
  }, [extraIssueLogs]);

  // Master Detailed Print Function - Prints full report of all filtered extra issue slips with all line items
  const handlePrintAllDetails = () => {
    if (extraIssueLogs.length === 0) {
      alert('No records available to print with the current filter.');
      return;
    }

    const dateFilterLabel = (historyDateFrom || historyDateTo)
      ? `${historyDateFrom || 'Start'} to ${historyDateTo || 'End'}`
      : 'All Dates (Full History)';

    const catLabel = historyCategoryFilter === 'reissue' 
      ? 'Re-Issue Only' 
      : historyCategoryFilter === 'extra' 
        ? 'Extra Material Issue Only' 
        : 'All Extra Material & Re-Issues';

    const totalPieces = extraIssueLogs.reduce((sum, log) => {
      return sum + (log.materials || []).reduce((mSum, m) => mSum + (parseFloat(m.qty) || 0), 0);
    }, 0);

    const totalLines = extraIssueLogs.reduce((sum, log) => sum + (log.materials || []).length, 0);

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Extra Material Issue Master Audit Report - ${new Date().toLocaleDateString('en-GB')}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #000000; font-size: 10px; background: #ffffff; }
            .header-bar { border-bottom: 2.5px solid #000000; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header-bar h1 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000000; }
            .header-bar .subtitle { font-size: 10.5px; color: #000000; margin-top: 2px; font-weight: 700; letter-spacing: 0.2px; }
            .meta-info { text-align: right; font-size: 9.5px; color: #000000; line-height: 1.45; font-weight: 600; }
            
            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
            .summary-card { padding: 6px 10px; background: #ffffff; border: 1.5px solid #000000; border-radius: 4px; }
            .summary-card .lbl { font-size: 9px; color: #000000; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
            .summary-card .val { font-size: 13.5px; font-weight: 900; color: #000000; margin-top: 2px; }

            table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 16px; border: 1.5px solid #000000; }
            th { background: #f0f0f0 !important; border: 1px solid #000000; border-bottom: 2px solid #000000; padding: 6px 7px; font-weight: 900; text-transform: uppercase; font-size: 9px; color: #000000; letter-spacing: 0.3px; }
            td { border: 1px solid #000000; padding: 6px 7px; vertical-align: top; color: #000000; background-color: #ffffff; }
            tr:nth-child(even) td { background-color: #fcfcfc !important; }

            .badge-voucher { font-family: monospace; font-weight: 900; color: #000000; background: #ffffff; border: 1.2px solid #000000; padding: 2px 5px; border-radius: 3px; font-size: 9.5px; display: inline-block; white-space: nowrap; }
            .badge-cat { font-weight: 900; font-size: 8.5px; padding: 2px 6px; border-radius: 3px; display: inline-block; white-space: nowrap; border: 1.2px solid #000000; color: #000000; background: #ffffff; text-transform: uppercase; }

            .mat-row { margin-bottom: 3.5px; line-height: 1.35; color: #000000; }
            .mat-row:last-child { margin-bottom: 0; }
            .mat-qty { font-weight: 900; color: #000000; margin-left: 2px; }
            .mat-reason { font-size: 9px; color: #000000; font-weight: 700; margin-left: 4px; display: inline-block; }

            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 24px; padding-top: 10px; page-break-inside: avoid; }
            .sig-box { text-align: center; font-size: 9.5px; color: #000000; }
            .sig-line { border-bottom: 1.5px solid #000000; width: 75%; margin: 32px auto 5px auto; }
            .sig-name { font-weight: 900; text-transform: uppercase; color: #000000; }
            .sig-sub { color: #000000; font-size: 8.5px; font-weight: 600; }

            @media print {
              body {
                color: #000000 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              th, td, div, span, strong, h1, h2 {
                color: #000000 !important;
              }
              table, th, td, .summary-card, .badge-voucher, .badge-cat, .sig-line {
                border-color: #000000 !important;
              }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1>MH ACCESSORIES & BOM STORE</h1>
              <div class="subtitle">EXTRA MATERIAL & RE-ISSUE MASTER AUDIT REPORT (DETAILED LOG)</div>
            </div>
            <div class="meta-info">
              <div><strong>Date Range:</strong> ${dateFilterLabel}</div>
              <div><strong>Category:</strong> ${catLabel}</div>
              <div><strong>Printed On:</strong> ${new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="summary-card">
              <div class="lbl">TOTAL ISSUE SLIPS</div>
              <div class="val">${extraIssueLogs.length} Vouchers</div>
            </div>
            <div class="summary-card">
              <div class="lbl">TOTAL EXTRA UNITS ISSUED</div>
              <div class="val">${totalPieces} Pcs</div>
            </div>
            <div class="summary-card">
              <div class="lbl">TOTAL LINE COMPONENTS</div>
              <div class="val">${totalLines} Line Items</div>
            </div>
            <div class="summary-card">
              <div class="lbl">PRODUCTION LOTS COVERED</div>
              <div class="val">${historyStats.uniqueLotsCount} Lots</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th style="width: 95px;">Challan / Bill No</th>
                <th style="width: 95px;">Date & Time</th>
                <th style="width: 110px;">Lot & Brand</th>
                <th style="width: 85px; text-align: center;">Category</th>
                <th>Issued Materials, Quantities & Specific Reasons</th>
                <th style="width: 95px;">Issued By</th>
                <th style="width: 115px;">Received By & Dept</th>
              </tr>
            </thead>
            <tbody>
              ${extraIssueLogs.map((log, idx) => {
                const isReissue = isLogReissue(log);
                const matchedDesign = designs.find(d => String(d.id) === String(log.lotId));
                const lotCategory = log.category || matchedDesign?.category || 'Garment';
                const cleanIssuer = (log.personName || 'Store In-charge').replace(/\\s*\\(.*?\\)/, '').trim() || 'Store In-charge';
                const receiver = log.receiverName || 'Cutting Floor';
                const brandName = log.brand || matchedDesign?.brand || 'Mohit Hosiery';

                return `
                  <tr>
                    <td style="text-align: center; font-weight: 900; color: #000000;">${idx + 1}</td>
                    <td><span class="badge-voucher">${log.id}</span></td>
                    <td style="white-space: nowrap; color: #000000; font-weight: 700;">${log.date}</td>
                    <td>
                      <strong style="color: #000000; font-size: 10px;">LOT #${log.lotId || 'DIRECT'}</strong>
                      <div style="font-size: 8.5px; color: #000000; font-weight: 800; margin-top: 1px;">Brand: ${brandName}</div>
                      <div style="font-size: 8px; color: #000000; font-weight: 600;">${lotCategory && lotCategory !== 'Unknown' ? lotCategory : 'Garment'}</div>
                    </td>
                    <td style="text-align: center;">
                      <span class="badge-cat">
                        ${isReissue ? 'RE-ISSUE' : 'EXTRA MATERIAL'}
                      </span>
                    </td>
                    <td>
                      ${(log.materials || []).map(m => `
                        <div class="mat-row">
                          <strong>&bull; ${m.bomItemName || m.name}:</strong> 
                          <span class="mat-qty">${m.qty} ${m.unit || 'Pcs'}</span>
                          ${m.reason ? `<span class="mat-reason">[${m.reason}]</span>` : ''}
                        </div>
                      `).join('')}
                    </td>
                    <td><strong style="color: #000000;">${cleanIssuer}</strong></td>
                    <td>
                      <strong style="color: #000000; text-transform: uppercase;">${receiver}</strong>
                      <div style="font-size: 8.5px; color: #000000; font-weight: 600;">${log.receiverDept || 'Cutting'}</div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-name">Prepared By (Store Clerk)</div>
              <div class="sig-sub">Accessories Central Store</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-name">Audited By (Store In-charge)</div>
              <div class="sig-sub">Inventory & Stock Control</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-name">Authorized Manager</div>
              <div class="sig-sub">Production / Plant Head</div>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const oldFrame = document.getElementById('extra-issue-detailed-report-iframe');
      if (oldFrame) {
        try { document.body.removeChild(oldFrame); } catch (e) {}
      }

      const printFrame = document.createElement('iframe');
      printFrame.id = 'extra-issue-detailed-report-iframe';
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

      setTimeout(() => {
        try {
          if (printFrame.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          }
        } catch (err) {
          console.warn('Detailed report print failed:', err);
        }
      }, 250);
    } catch (err) {
      console.warn('Print iframe error:', err);
    }
  };

  // Master PDF Download Function using jsPDF + autoTable
  const handleDownloadAllDetailsPdf = () => {
    if (extraIssueLogs.length === 0) {
      alert('No records available to download.');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MH ACCESSORIES & BOM STORE', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('EXTRA MATERIAL & RE-ISSUE MASTER AUDIT REPORT', 14, 20);

    const dateFilterLabel = (historyDateFrom || historyDateTo)
      ? `Date Range: ${historyDateFrom || 'Start'} to ${historyDateTo || 'End'}`
      : 'Date Range: All Dates (Full History)';
    doc.setFontSize(9);
    doc.text(dateFilterLabel, 14, 25);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')} | Total Records: ${extraIssueLogs.length}`, 190, 25);

    const tableRows = extraIssueLogs.map((log, idx) => {
      const isReissue = isLogReissue(log);
      const cleanIssuer = (log.personName || 'Store In-charge').replace(/\s*\(.*?\)/, '').trim() || 'Store In-charge';
      const itemsText = (log.materials || []).map(m => `• ${m.bomItemName || m.name}: ${m.qty} ${m.unit || 'Pcs'}${m.reason ? ` (${m.reason})` : ''}`).join('\n');
      return [
        idx + 1,
        log.id,
        log.date,
        `Lot #${log.lotId || 'DIRECT'}\nBrand: ${log.brand || 'Mohit Hosiery'}`,
        isReissue ? 'RE-ISSUE' : 'EXTRA MATERIAL',
        itemsText,
        cleanIssuer,
        `${log.receiverName || 'Cutting Floor'}${log.receiverDept ? `\n(${log.receiverDept})` : ''}`
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['#', 'Challan No', 'Date', 'Lot & Brand', 'Category', 'Issued Materials & Reasons', 'Issued By', 'Received By']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.15 },
      styles: { lineColor: [0, 0, 0], lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 26 },
        3: { cellWidth: 25, fontStyle: 'bold' },
        4: { cellWidth: 25, fontStyle: 'bold' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 25 },
        7: { cellWidth: 32 }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`EXTRA_MATERIAL_MASTER_REPORT_${historyDateFrom || 'ALL'}_TO_${historyDateTo || 'ALL'}.pdf`);
  };

  // Group all issue logs by Lot Number for complete 1st Time vs Extra Material audit
  const lotAuditSummary = useMemo(() => {
    const map = {};

    allIssueLogs.forEach(log => {
      const lotKey = String(log.lotId || 'N/A');
      if (!map[lotKey]) {
        const design = designs.find(d => String(d.id) === lotKey);
        map[lotKey] = {
          lotId: lotKey,
          design,
          category: log.category || design?.category || 'N/A',
          brand: design?.brand || '—',
          initialPieces: 0,
          reissuePieces: 0,
          totalPieces: 0,
          initialLogs: [],
          reissueLogs: [],
          returnLogs: [],
          allLogs: [],
          materialsSummary: {}
        };
      }

      const entry = map[lotKey];
      entry.allLogs.push(log);
      const vol = Number(log.volume) || 0;

      const isReturn = !!log.isReturn;
      const isReissue = !isReturn && (
        log.isReissue === true ||
        (log.id && (String(log.id).startsWith('RI') || String(log.id).startsWith('EMI'))) ||
        (log.personName && String(log.personName).toLowerCase().includes('extra'))
      );

      if (isReturn) {
        entry.returnLogs.push(log);
      } else if (isReissue) {
        entry.reissuePieces += vol;
        entry.reissueLogs.push(log);
      } else {
        entry.initialPieces += vol;
        entry.initialLogs.push(log);
      }

      entry.totalPieces = entry.initialPieces + entry.reissuePieces;

      if (log.materials && Array.isArray(log.materials)) {
        log.materials.forEach(m => {
          const key = m.bomItemName ? `${m.bomItemName}___${m.name}` : m.name;
          if (!entry.materialsSummary[key]) {
            entry.materialsSummary[key] = {
              bomItemName: m.bomItemName || 'General',
              materialName: m.name,
              unit: m.unit || 'pcs',
              initialQty: 0,
              reissueQty: 0,
              returnedQty: 0,
              totalIssuedQty: 0
            };
          }
          const mQty = parseFloat(m.qty) || 0;
          if (isReturn) {
            entry.materialsSummary[key].returnedQty += mQty;
          } else if (isReissue) {
            entry.materialsSummary[key].reissueQty += mQty;
          } else {
            entry.materialsSummary[key].initialQty += mQty;
          }
          entry.materialsSummary[key].totalIssuedQty =
            (entry.materialsSummary[key].initialQty + entry.materialsSummary[key].reissueQty) - entry.materialsSummary[key].returnedQty;
        });
      }
    });

    return Object.values(map);
  }, [issueLogs, designs]);

  // Filtered lots for Combined Audit tab
  const filteredLotAudits = useMemo(() => {
    const q = auditLotSearch.toLowerCase().trim();
    if (!q) return lotAuditSummary;
    return lotAuditSummary.filter(l => {
      const idMatch = String(l.lotId).toLowerCase().includes(q);
      const catMatch = String(l.category).toLowerCase().includes(q);
      const brandMatch = String(l.brand).toLowerCase().includes(q);
      const matMatch = Object.values(l.materialsSummary).some(m =>
        m.materialName.toLowerCase().includes(q) || m.bomItemName.toLowerCase().includes(q)
      );
      return idMatch || catMatch || brandMatch || matMatch;
    });
  }, [lotAuditSummary, auditLotSearch]);

  // Download PDF report for a Lot Audit with 3 Clear Sections (1st Time, Extra, Both Combined)
  const handleDownloadLotAuditPdf = (lotAudit) => {
    if (!lotAudit) return;
    try {
      const doc = new jsPDF();

      // Top Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('MH ACCESSORIES & BOM STORE', 14, 16);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Garment Product Data Management System (G-PDMS) — Material Issue Audit', 14, 21);

      // Header Banner
      doc.setFillColor(79, 70, 229);
      doc.roundedRect(14, 25, 182, 9, 2, 2, 'F');
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`COMBINED MATERIAL AUDIT REPORT — LOT ${lotAudit.lotId}`, 16, 31);

      // Info Box
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 37, 182, 20, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.text('Lot Number:', 18, 43);
      doc.setFont('helvetica', 'normal');
      doc.text(`Lot ${lotAudit.lotId} ${lotAudit.design?.lotNo2 ? `(${lotAudit.design.lotNo2})` : ''}`, 42, 43);

      doc.setFont('helvetica', 'bold');
      doc.text('Garment Style:', 105, 43);
      doc.setFont('helvetica', 'normal');
      doc.text(`${lotAudit.category} [${lotAudit.brand || 'Generic'}]`, 130, 43);

      doc.setFont('helvetica', 'bold');
      doc.text('1st Time Volume:', 18, 51);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(29, 78, 216);
      doc.text(`${lotAudit.initialPieces.toLocaleString()} pcs (${lotAudit.initialLogs.length} vouchers)`, 45, 51);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Extra Material Volume:', 105, 51);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text(`+${lotAudit.reissuePieces.toLocaleString()} pcs (${lotAudit.reissueLogs.length} vouchers)`, 140, 51);

      doc.setTextColor(15, 23, 42);

      // SECTION 1: 1st Time Issue Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(29, 78, 216);
      doc.text('1. FIRST-TIME ISSUE DETAILS (INITIAL ALLOCATION)', 14, 63);

      const initialRows = (lotAudit.initialLogs || []).map((l, idx) => [
        idx + 1,
        l.id,
        l.date,
        `${Number(l.volume || 0).toLocaleString()} pcs`,
        `${l.personName || 'Store'}${l.receiverName ? ` -> ${l.receiverName}` : ''}`,
        (l.materials || []).map(m => `${m.bomItemName || m.name}: ${m.qty} ${m.unit || 'pcs'}`).join(', ')
      ]);

      autoTable(doc, {
        startY: 66,
        head: [['#', 'Slip ID', 'Issue Date', 'Pieces', 'Issuer & Receiver', '1st Time Materials Dispatched']],
        body: initialRows.length > 0 ? initialRows : [['—', '—', '—', '0 pcs', '—', 'No 1st-time issue records']],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 22, fontStyle: 'bold' },
          2: { cellWidth: 26 },
          3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 32 },
          5: { cellWidth: 74 }
        }
      });

      // SECTION 2: Extra Material Issue Details
      let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 90) + 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text('2. EXTRA MATERIAL ISSUE DETAILS (WASTAGE & RE-ISSUES)', 14, currentY);

      if (lotAudit.reissueLogs && lotAudit.reissueLogs.length > 0) {
        const extraRows = lotAudit.reissueLogs.map((l, idx) => [
          idx + 1,
          l.id,
          l.date,
          `+${Number(l.volume || 0).toLocaleString()} pcs`,
          l.materials && l.materials[0]?.reason ? l.materials[0].reason : 'Extra Material Requisition',
          `${l.personName || 'Store'}${l.receiverName ? ` -> ${l.receiverName}` : ''}`,
          (l.materials || []).map(m => `${m.bomItemName || m.name}: +${m.qty} ${m.unit || 'pcs'}`).join(', ')
        ]);

        autoTable(doc, {
          startY: currentY + 3,
          head: [['#', 'Extra Slip ID', 'Issue Date', 'Extra Pcs', 'Reason / Cause', 'Issuer & Receiver', 'Extra Materials Issued']],
          body: extraRows,
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 22, fontStyle: 'bold', textColor: [220, 38, 38] },
            2: { cellWidth: 24 },
            3: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
            4: { cellWidth: 32 },
            5: { cellWidth: 28 },
            6: { cellWidth: 50 }
          }
        });
        currentY = doc.lastAutoTable.finalY + 7;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(22, 101, 52);
        doc.text('  [OK] Zero Extra Material Issued for this lot. Production completed on 100% initial dispatch (0% wastage).', 14, currentY + 5);
        currentY += 12;
      }

      // SECTION 3: Both Combined Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(79, 70, 229);
      doc.text('3. BOTH COMBINED DETAILS (CONSOLIDATED SOURCING & NET DISPATCHED MATRIX)', 14, currentY);

      const combinedRows = Object.values(lotAudit.materialsSummary || {}).map((m, idx) => {
        const variance = m.initialQty > 0 ? `${((m.reissueQty / m.initialQty) * 100).toFixed(1)}%` : (m.reissueQty > 0 ? '100%' : '0%');
        return [
          idx + 1,
          m.bomItemName,
          m.materialName,
          m.initialQty > 0 ? `${Number(m.initialQty.toFixed(2))} ${m.unit}` : '0',
          m.reissueQty > 0 ? `+${Number(m.reissueQty.toFixed(2))} ${m.unit}` : '0',
          m.returnedQty > 0 ? `-${Number(m.returnedQty.toFixed(2))} ${m.unit}` : '0',
          `${Number(m.totalIssuedQty.toFixed(2))} ${m.unit}`,
          m.reissueQty > 0 ? `+${variance}` : 'Standard'
        ];
      });

      autoTable(doc, {
        startY: currentY + 3,
        head: [['#', 'BOM Component', 'Inventory Item', '1st Time Qty', 'Extra Issue Qty', 'Returned', 'Combined Net Total', 'Variance %']],
        body: combinedRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 28, fontStyle: 'bold' },
          2: { cellWidth: 42 },
          3: { cellWidth: 22, halign: 'right', textColor: [29, 78, 216] },
          4: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
          5: { cellWidth: 18, halign: 'right', textColor: [22, 101, 52] },
          6: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
          7: { cellWidth: 14, halign: 'center' }
        }
      });

      const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 180) + 16;
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.line(14, finalY, 65, finalY);
      doc.text('Store Keeper (Issued)', 14, finalY + 4);

      doc.line(75, finalY, 125, finalY);
      doc.text('Cutting Master (Received)', 75, finalY + 4);

      doc.line(135, finalY, 185, finalY);
      doc.text('Supervisor / Admin (Audited)', 135, finalY + 4);

      doc.save(`COMBINED_AUDIT_REPORT_LOT_${lotAudit.lotId}.pdf`);
    } catch (err) {
      console.error('Failed to generate audit PDF:', err);
      alert('Could not generate PDF audit report: ' + err.message);
    }
  };

  const handleOpenPrintAudit = (lotAudit) => {
    setPrintAuditModalData(lotAudit);
  };

  return (
    <div className="extra-material-issue-container" style={{ padding: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Banner Header - Extra Material Issue Box */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '14px 20px',
        backgroundColor: 'var(--bg-secondary, #f8fafc)',
        borderRadius: '12px',
        border: '1.5px solid var(--border-color, #cbd5e1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Extra Material Issue
              </h1>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
                • Approved production lots & extra material requisition slips
              </span>
            </div>
          </div>
        </div>

        {/* Tab switcher: Issue Extra Material vs Extra Issue Logs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className={`btn ${activeSubTab === 'issue' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('issue')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '8px',
              boxShadow: activeSubTab === 'issue' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none'
            }}
          >
            <Layers size={16} />
            <span>Issue Extra Material</span>
          </button>
          <button
            type="button"
            className={`btn ${activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '8px',
              boxShadow: activeSubTab === 'history' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none'
            }}
          >
            <Clock size={16} />
            <span>Extra Issue Logs ({allExtraLogs.length})</span>
          </button>
          <button
            type="button"
            className={`btn ${activeSubTab === 'combined_audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('combined_audit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '8px',
              boxShadow: activeSubTab === 'combined_audit' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none'
            }}
          >
            <BarChart3 size={16} />
            <span>Combined Audit Report ({lotAuditSummary.length})</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {formError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#dc2626',
          borderRadius: '8px',
          border: '1.5px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '12px',
          fontSize: '13px',
          fontWeight: '700'
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{formError}</div>
          <button onClick={() => setFormError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {formSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: '#059669',
          borderRadius: '8px',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
          marginBottom: '12px',
          fontSize: '13px',
          fontWeight: '700'
        }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{formSuccess}</div>
          <button onClick={() => setFormSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {/* SUB TAB 1: ISSUE EXTRA MATERIAL */}
      {activeSubTab === 'issue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {/* Issue Method Selector: With BOM vs Without BOM */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 18px',
            borderRadius: '14px',
            background: issueMethod === 'without_bom' ? '#fff7ed' : '#f0f9ff',
            border: issueMethod === 'without_bom' ? '1.5px solid #fdba74' : '1.5px solid #bae6fd',
            marginBottom: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: issueMethod === 'without_bom' ? '#9a3412' : '#0369a1' }}>
                Select Issue Method:
              </span>
              <div style={{ display: 'inline-flex', background: '#ffffff', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIssueMethod('with_bom')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    background: issueMethod === 'with_bom' ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : 'transparent',
                    color: issueMethod === 'with_bom' ? '#ffffff' : '#64748b',
                    boxShadow: issueMethod === 'with_bom' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Shield size={15} /> With BOM (From Issued Lots)
                </button>
                <button
                  type="button"
                  onClick={() => setIssueMethod('without_bom')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    background: issueMethod === 'without_bom' ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'transparent',
                    color: issueMethod === 'without_bom' ? '#ffffff' : '#64748b',
                    boxShadow: issueMethod === 'without_bom' ? '0 2px 8px rgba(234, 88, 12, 0.35)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Zap size={15} /> Without BOM (Direct Floor Extra Issue)
                </button>
              </div>
            </div>

            <span style={{ fontSize: '12px', fontWeight: '700', color: issueMethod === 'without_bom' ? '#c2410c' : '#0369a1' }}>
              {issueMethod === 'without_bom'
                ? '⚡ Without BOM: Issue any material directly without pre-approved BOM restrictions.'
                : '🏷️ With BOM: Select an issued production lot to issue extra mapped BOM components.'}
            </span>
          </div>

          {issueMethod === 'with_bom' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '280px minmax(0, 1fr)',
              gap: '16px',
              alignItems: 'start',
              width: '100%',
              minWidth: 0
            }}>
          
          {/* Left Column: Approved Lots Browser with Search Bar */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
            borderRadius: '12px',
            border: '1.5px solid var(--border-color, #cbd5e1)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: 'calc(100vh - 120px)',
            position: 'sticky',
            top: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Issued Lots ({filteredDesigns.length})
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                Total: {alreadyIssuedDesigns.length}
              </span>
            </div>

            {/* Search Approved & Issued Lots */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Search Issued Lot, Brand, Style..."
                value={searchLotQuery}
                onChange={(e) => setSearchLotQuery(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  height: '38px',
                  paddingLeft: '32px',
                  paddingRight: '28px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  boxSizing: 'border-box',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1'
                }}
              />
              {searchLotQuery && (
                <button
                  type="button"
                  onClick={() => setSearchLotQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Lots List */}
            <div style={{
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 270px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingRight: '2px'
            }}>
              {filteredDesigns.length === 0 ? (
                <div style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '8px',
                  border: '1.5px dashed var(--border-color)',
                  lineHeight: 1.5
                }}>
                  {alreadyIssuedDesigns.length === 0 ? (
                    <>
                      <AlertTriangle size={24} style={{ color: '#f59e0b', margin: '0 auto 8px auto', display: 'block' }} />
                      <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '4px' }}>No Issued Lots Found</strong>
                      Extra material issue is only available for lots where initial material issue has already been completed in <strong>Material Issue</strong>.
                    </>
                  ) : (
                    'No issued lots match your search.'
                  )}
                </div>
              ) : (
                filteredDesigns.map(d => {
                  const isSelected = String(d.id) === String(selectedDesignId);
                  const bomCount = d.bom ? d.bom.filter(b => String(b.status).toLowerCase() === 'yes').length : 0;
                  
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDesignId(d.id)}
                      style={{
                        padding: '11px 13px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #3b82f6' : '1.5px solid var(--border-color, #cbd5e1)',
                        backgroundColor: isSelected ? '#eff6ff' : 'var(--bg-primary, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontWeight: '900',
                            fontSize: '13px',
                            color: isSelected ? '#1d4ed8' : 'var(--text-main, #0f172a)'
                          }}>
                            Lot {d.id}
                          </span>
                          {d.lotNo2 && (
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: '#4f46e5',
                              borderRadius: '4px',
                              fontWeight: '800'
                            }}>
                              MH: {d.lotNo2}
                            </span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#d1fae5',
                          color: '#065f46',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <CheckCircle size={11} /> Issued
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: '600' }}>
                          {d.brand || 'No Brand'} • {d.category}
                        </span>
                        <span style={{
                          fontWeight: '800',
                          fontSize: '11px',
                          color: '#4f46e5',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          flexShrink: 0
                        }}>
                          {bomCount} BOM
                        </span>
                      </div>

                      {d.fabricType && (
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Fabric: <strong>{d.fabricType}</strong>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Lot Header & BOM Components Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
            
            {!selectedDesign ? (
              <div style={{
                backgroundColor: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '12px',
                border: '1.5px dashed var(--border-color, #cbd5e1)',
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted, #64748b)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6366f1'
                }}>
                  <Layers size={28} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                  No Lot Selected
                </h3>
                <p style={{ margin: 0, fontSize: '13px', maxWidth: '420px', lineHeight: '1.5' }}>
                  Please select an already-issued production lot from the left sidebar to view BOM components and generate extra material requisitions.
                </p>
                <button
                  type="button"
                  onClick={() => setIssueMethod('without_bom')}
                  style={{
                    marginTop: '8px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1.5px solid #fdba74',
                    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                    color: '#c2410c',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.12)'
                  }}
                >
                  <Zap size={14} /> Need to issue without BOM? Click Here to Issue Extra Material (Without BOM)
                </button>
              </div>
            ) : (
              <>
                {/* Lot Header Info Box - Modern Card View */}
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color, #cbd5e1)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{
                        padding: '4px 10px',
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: '900',
                        fontSize: '12.5px',
                        letterSpacing: '0.5px'
                      }}>
                        LOT {selectedDesign.id}
                      </div>
                      {selectedDesign.lotNo2 && (
                        <div style={{
                          padding: '3px 8px',
                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                          color: '#4f46e5',
                          borderRadius: '6px',
                          fontWeight: '800',
                          fontSize: '11px'
                        }}>
                          MH: {selectedDesign.lotNo2}
                        </div>
                      )}
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>
                        {selectedDesign.brand ? `${selectedDesign.brand} — ` : ''}{selectedDesign.name || selectedDesign.category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', padding: '4px 12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: '700' }}>Garment Volume:</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#065f46' }}>
                        {isLoadingPieces ? 'Loading...' : `${pieces.toLocaleString()} Units`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Metadata Pill Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px 16px',
                    padding: '8px 14px',
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    fontSize: '12px'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Category: </span>
                      <strong style={{ color: '#0f172a' }}>{selectedDesign.category || 'N/A'}</strong>
                    </div>
                    <div style={{ borderLeft: '1px solid #cbd5e1', height: '14px' }}></div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Style Code: </span>
                      <strong style={{ color: '#0f172a' }}>{selectedDesign.style || 'N/A'}</strong>
                    </div>
                    <div style={{ borderLeft: '1px solid #cbd5e1', height: '14px' }}></div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Fabric: </span>
                      <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '180px', verticalAlign: 'bottom', color: '#0f172a' }}>
                        {selectedDesign.fabricType || 'N/A'}
                      </strong>
                    </div>
                    <div style={{ borderLeft: '1px solid #cbd5e1', height: '14px' }}></div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Prev Issues: </span>
                      <strong style={{ color: '#2563eb' }}>{lotPreviousIssues.length} records</strong>
                    </div>
                  </div>

                  {/* Issuer & Receiver Settings Bar - 3 Columns Side-by-Side */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '16px',
                    paddingTop: '12px',
                    borderTop: '1.5px solid var(--border-color, #e2e8f0)'
                  }}>
                    <div>
                      <label className="wcs-label" style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                        Issuer Person <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          height: '38px',
                          fontSize: '13.5px',
                          fontWeight: '700',
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          borderColor: !personName.trim() && formError ? '#ef4444' : '#cbd5e1'
                        }}
                        value={personName}
                        onChange={(e) => {
                          setPersonName(e.target.value);
                          if (formError) setFormError('');
                        }}
                        placeholder="Store Incharge"
                      />
                    </div>
                    <div>
                      <label className="wcs-label" style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                        Receiver Person <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          height: '38px',
                          fontSize: '13.5px',
                          fontWeight: '700',
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          borderColor: !receiverName.trim() && formError ? '#ef4444' : '#cbd5e1'
                        }}
                        value={receiverName}
                        onChange={(e) => {
                          setReceiverName(e.target.value);
                          if (formError) setFormError('');
                        }}
                        placeholder="Master / Tailor"
                      />
                    </div>
                    <div>
                      <label className="wcs-label" style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                        Receiver Dept / Line <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          height: '38px',
                          fontSize: '13.5px',
                          fontWeight: '700',
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          borderColor: !receiverDept.trim() && formError ? '#ef4444' : '#cbd5e1'
                        }}
                        value={receiverDept}
                        onChange={(e) => {
                          setReceiverDept(e.target.value);
                          if (formError) setFormError('');
                        }}
                        placeholder="Cutting Dept"
                      />
                    </div>
                  </div>
                </div>

                {/* BOM Components Table Card */}
                <div style={{
                  backgroundColor: 'var(--bg-secondary, #f8fafc)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  padding: '10px 12px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: 'var(--text-main)' }}>
                          BOM Components & Extra Material Requisition
                        </h3>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: '#4f46e5'
                        }}>
                          {displayedBomMappings.length} {showAllBom ? 'Total Components' : 'Active Components'}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {showAllBom ? 'Displaying all BOM template components for this lot.' : 'Showing only required BOM items for this lot.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Active Only / Show All Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setShowAllBom(prev => !prev)}
                        className="btn btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          borderRadius: '6px',
                          backgroundColor: showAllBom ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-primary, #ffffff)',
                          color: showAllBom ? '#4f46e5' : 'var(--text-main, #334155)',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          cursor: 'pointer'
                        }}
                        title={showAllBom ? "Switch to only required BOM components" : "Show all template components"}
                      >
                        <Filter size={13} style={{ color: showAllBom ? '#4f46e5' : '#64748b' }} />
                        <span>{showAllBom ? `Show Active Only (${activeBomCount})` : `Show All Templates (${bomMappings.length})`}</span>
                      </button>

                      {(() => {
                        const selectedCount = bomMappings.filter(m => m.selectedForExtra).length;
                        return (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleIssueSelectedComponents}
                            disabled={selectedCount === 0}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '7px 16px',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              borderRadius: '6px',
                              backgroundColor: selectedCount === 0
                                ? 'var(--bg-secondary, #cbd5e1)'
                                : '#6366f1',
                              color: selectedCount > 0 ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                              whiteSpace: 'nowrap',
                              border: 'none',
                              boxShadow: selectedCount > 0 ? '0 2px 6px rgba(99, 102, 241, 0.25)' : 'none'
                            }}
                            title="Issue selected extra materials"
                          >
                            <Send size={13} />
                            <span>Issue Selected ({selectedCount})</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Barcode Scanner Quick Input Bar */}
                  <div style={{
                    marginBottom: '14px',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #eef2ff 100%)',
                    borderRadius: '10px',
                    border: '1.5px solid #a5b4fc',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          padding: '7px 9px',
                          borderRadius: '8px',
                          backgroundColor: '#6366f1',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                        }}>
                          <Barcode size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Barcode Scanning & Quick Auto-Mapping</strong>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '1px' }}>
                            Scan material barcode (e.g. <code style={{ backgroundColor: '#ffffff', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#4f46e5', fontWeight: '700' }}>MT1001</code>, <code style={{ backgroundColor: '#ffffff', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#4f46e5', fontWeight: '700' }}>1001-A01</code>, <code style={{ backgroundColor: '#ffffff', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#4f46e5', fontWeight: '700' }}>ZIP62114</code>) or type ID & press Enter
                          </span>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleBarcodeScanSubmit} style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          className="form-input"
                          style={{
                            width: '100%',
                            height: '40px',
                            paddingLeft: '38px',
                            paddingRight: '12px',
                            fontSize: '13px',
                            fontWeight: '600',
                            borderRadius: '8px',
                            border: '1.5px solid',
                            borderColor: barcodeScanFeedback?.type === 'error' ? '#ef4444' : '#818cf8',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.1)'
                          }}
                          placeholder="Scan barcode or type Material ID (e.g. MT1001, 1001-A01, ZIP62114) and hit Enter..."
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                        />
                        <Barcode size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                          padding: '0 20px',
                          height: '40px',
                          fontSize: '12.5px',
                          fontWeight: '800',
                          borderRadius: '8px',
                          backgroundColor: '#6366f1',
                          color: '#ffffff',
                          border: 'none',
                          boxShadow: '0 3px 10px rgba(99, 102, 241, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          cursor: 'pointer'
                        }}
                      >
                        <Sparkles size={14} />
                        <span>Scan / Auto-Map</span>
                      </button>
                    </form>

                    {barcodeScanFeedback && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        fontWeight: '700',
                        backgroundColor: barcodeScanFeedback.type === 'error' ? '#fef2f2' : '#ecfdf5',
                        color: barcodeScanFeedback.type === 'error' ? '#dc2626' : '#047857',
                        border: `1px solid ${barcodeScanFeedback.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>{barcodeScanFeedback.msg}</span>
                        <button
                          type="button"
                          onClick={() => setBarcodeScanFeedback(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold', fontSize: '13px' }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Table Container */}
                  <div style={{
                    width: '100%',
                    maxWidth: '100%',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    overflowX: 'auto',
                    overflowY: 'visible',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    boxSizing: 'border-box',
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: '#ffffff' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', textAlign: 'left' }}>
                          <th style={{ width: '36px', minWidth: '36px', padding: '11px 6px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={displayedBomMappings.length > 0 && displayedBomMappings.every(m => m.selectedForExtra)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const displayedIds = new Set(displayedBomMappings.map(m => m.id));
                                setBomMappings(prev => prev.map(m => displayedIds.has(m.id) ? { ...m, selectedForExtra: checked } : m));
                              }}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#6366f1' }}
                              title="Select All"
                            />
                          </th>
                          <th style={{ width: '160px', minWidth: '160px', padding: '11px 10px', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>BOM Component</th>
                          <th style={{ minWidth: '280px', padding: '11px 10px', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Assigned Inventory Item Map</th>
                          <th style={{ width: '115px', minWidth: '115px', padding: '11px 8px', textAlign: 'center', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Stock</th>
                          <th style={{ width: '100px', minWidth: '100px', padding: '11px 8px', textAlign: 'center', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Prev Issued</th>
                          <th style={{ width: '150px', minWidth: '150px', padding: '11px 8px', textAlign: 'center', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Extra Qty</th>
                          <th style={{ width: '180px', minWidth: '180px', padding: '11px 10px', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Reason / Remarks</th>
                          <th style={{ width: '90px', minWidth: '90px', padding: '11px 8px', textAlign: 'center', fontWeight: '800', fontSize: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedBomMappings.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <Package size={28} style={{ opacity: 0.4, color: '#6366f1' }} />
                                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b' }}>No active BOM components mapped for this lot.</div>
                                <button
                                  type="button"
                                  onClick={() => setShowAllBom(true)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ marginTop: '6px', fontSize: '12px', padding: '6px 14px', borderRadius: '6px', fontWeight: '700', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                                >
                                  Show All {bomMappings.length} Template Components
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          displayedBomMappings.map((item) => {
                            const originalIdx = item.id;
                            const mat = materials.find(m => String(m.id) === String(item.materialId));
                            const stock = mat ? mat.stock : 0;
                            const isSelected = item.selectedForExtra;
                            const hasExtraQty = parseFloat(item.extraQty) > 0;
                            const isStockShortage = mat && hasExtraQty && (stock < parseFloat(item.extraQty));

                            return (
                              <tr
                                key={item.id}
                                style={{
                                  borderBottom: '1px solid #e2e8f0',
                                  backgroundColor: highlightedRowIndex === item.id
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : (isSelected ? '#f5f3ff' : '#ffffff'),
                                  transition: 'background-color 0.2s ease'
                                }}
                              >
                                {/* Checkbox */}
                                <td style={{ textAlign: 'center', padding: '12px 6px', verticalAlign: 'middle' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!item.selectedForExtra}
                                    onChange={(e) => handleMappingChange(originalIdx, 'selectedForExtra', e.target.checked)}
                                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#6366f1' }}
                                  />
                                </td>

                                {/* BOM Component Name & Details */}
                                <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <strong style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                                        {item.bomItemName}
                                      </strong>
                                      {item.isRequired && (
                                        <span style={{
                                          fontSize: '9.5px',
                                          fontWeight: '800',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          backgroundColor: '#d1fae5',
                                          color: '#047857',
                                          border: '1px solid #a7f3d0'
                                        }}>
                                          Required
                                        </span>
                                      )}
                                    </div>
                                    {item.bomItemDetail && (
                                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                                        {item.bomItemDetail}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                                      Req: <span style={{ color: '#1e293b', fontWeight: '700' }}>{item.qtyPerPiece}/pc</span> ({(pieces * item.qtyPerPiece).toFixed(0)} {item.unit})
                                    </span>
                                  </div>
                                </td>

                                {/* Material Select */}
                                <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                                  <SearchableMaterialSelect
                                    materials={materials}
                                    value={item.materialId}
                                    onChange={(val) => handleMappingChange(originalIdx, 'materialId', val)}
                                    hasError={!item.materialId && hasExtraQty}
                                    brandHint={selectedDesign?.brand || ''}
                                  />
                                </td>

                                {/* Stock Badge */}
                                <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle', width: '115px', minWidth: '115px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <span style={{
                                      fontWeight: '800',
                                      fontSize: '12.5px',
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      whiteSpace: 'nowrap',
                                      lineHeight: '1.2',
                                      backgroundColor: stock <= 0 ? '#fef2f2' : stock < 50 ? '#fffbeb' : '#ecfdf5',
                                      color: stock <= 0 ? '#dc2626' : stock < 50 ? '#d97706' : '#059669',
                                      border: `1.5px solid ${stock <= 0 ? '#fca5a5' : stock < 50 ? '#fde68a' : '#a7f3d0'}`,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                    }}>
                                      <span style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: stock <= 0 ? '#ef4444' : stock < 50 ? '#f59e0b' : '#10b981',
                                        display: 'inline-block',
                                        flexShrink: 0
                                      }} />
                                      <span>{Number(stock || 0).toLocaleString()}</span>
                                      <span style={{ fontSize: '11px', fontWeight: '700', opacity: 0.85 }}>{item.unit}</span>
                                    </span>
                                    {isStockShortage && (
                                      <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 5px', borderRadius: '4px', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                        Low Stock
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Previously Issued */}
                                <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{
                                      fontWeight: '800',
                                      fontSize: '13px',
                                      color: item.previouslyIssuedQty > 0 ? '#2563eb' : '#94a3b8'
                                    }}>
                                      {item.previouslyIssuedQty} <span style={{ fontSize: '11px', fontWeight: '600' }}>{item.unit}</span>
                                    </span>
                                    {item.previousLogsCount > 0 && (
                                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#6366f1', backgroundColor: '#e0e7ff', padding: '1px 6px', borderRadius: '10px', marginTop: '2px' }}>
                                        {item.previousLogsCount} {item.previousLogsCount === 1 ? 'log' : 'logs'}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Extra Quantity Input + Quick Add Buttons */}
                                <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0"
                                        className="form-input"
                                        style={{
                                          width: '78px',
                                          height: '36px',
                                          textAlign: 'center',
                                          fontWeight: '800',
                                          fontSize: '13.5px',
                                          padding: '2px 6px',
                                          borderRadius: '7px',
                                          border: '1.5px solid',
                                          borderColor: isStockShortage
                                            ? '#ef4444'
                                            : hasExtraQty
                                            ? '#6366f1'
                                            : '#cbd5e1',
                                          boxShadow: hasExtraQty ? '0 0 0 2px rgba(99, 102, 241, 0.15)' : 'none',
                                          backgroundColor: '#ffffff'
                                        }}
                                        value={item.extraQty === 0 || item.extraQty === '0' ? '' : (item.extraQty ?? '')}
                                        onChange={(e) => handleMappingChange(originalIdx, 'extraQty', e.target.value)}
                                      />
                                      <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '700' }}>
                                        {item.unit}
                                      </span>
                                    </div>

                                    {/* Quick +Buttons */}
                                    <div style={{ display: 'flex', gap: '3px' }}>
                                      {[5, 10, 25, 50].map(amt => (
                                        <button
                                          key={amt}
                                          type="button"
                                          onClick={() => handleQuickAddQty(originalIdx, amt)}
                                          style={{
                                            padding: '2px 5px',
                                            fontSize: '9.5px',
                                            fontWeight: '800',
                                            borderRadius: '4px',
                                            border: '1px solid #c7d2fe',
                                            backgroundColor: '#e0e7ff',
                                            color: '#3730a3',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                          title={`Add +${amt} ${item.unit}`}
                                        >
                                          +{amt}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </td>

                                {/* Reason & Remarks */}
                                <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <select
                                      className="form-input"
                                      style={{ height: '30px', fontSize: '11.5px', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', backgroundColor: '#ffffff' }}
                                      value={item.extraReason}
                                      onChange={(e) => handleMappingChange(originalIdx, 'extraReason', e.target.value)}
                                    >
                                      {EXTRA_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Remarks..."
                                      className="form-input"
                                      style={{ height: '28px', fontSize: '11.5px', fontWeight: '600', padding: '2px 7px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', backgroundColor: '#ffffff' }}
                                      value={item.extraRemarks}
                                      onChange={(e) => handleMappingChange(originalIdx, 'extraRemarks', e.target.value)}
                                    />
                                  </div>
                                </td>

                                {/* Single Component Issue Action */}
                                <td style={{ textAlign: 'center', padding: '10px 8px', verticalAlign: 'middle' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleIssueSingleComponent(originalIdx)}
                                    className="btn btn-sm"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '6px 12px',
                                      fontSize: '11.5px',
                                      fontWeight: '800',
                                      borderRadius: '6px',
                                      backgroundColor: !hasExtraQty
                                        ? '#e2e8f0'
                                        : '#6366f1',
                                      color: !hasExtraQty ? '#94a3b8' : '#ffffff',
                                      cursor: hasExtraQty ? 'pointer' : 'not-allowed',
                                      border: 'none',
                                      boxShadow: hasExtraQty ? '0 2px 6px rgba(99, 102, 241, 0.3)' : 'none',
                                      whiteSpace: 'nowrap'
                                    }}
                                    disabled={!hasExtraQty}
                                    title="Issue Extra Material"
                                  >
                                    <Send size={12} />
                                    <span>Issue</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
          ) : (
            /* WITHOUT BOM DIRECT EXTRA MATERIAL REQUISITION PANEL */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              width: '100%'
            }}>
              {/* Header Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                borderRadius: '14px',
                border: '1.5px solid #fdba74',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(234, 88, 12, 0.3)'
                  }}>
                    <Zap size={22} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#9a3412' }}>
                      Direct Extra Material Requisition (Without BOM)
                    </h2>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#c2410c', fontWeight: '600' }}>
                      Issue any inventory trims or accessories directly to cutting/production floor without requiring a pre-approved BOM.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    backgroundColor: '#ffffff',
                    color: '#ea580c',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid #fed7aa',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    ⚡ UNRESTRICTED FLOOR ISSUE
                  </span>
                </div>
              </div>

              {/* Floor Details Card */}
              <div style={{
                backgroundColor: 'var(--bg-primary, #ffffff)',
                borderRadius: '14px',
                border: '1.5px solid var(--border-color, #cbd5e1)',
                padding: '20px 22px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: '#ea580c' }} />
                  <span>1. Production & Floor Movement Details</span>
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px'
                }}>
                  {/* Lot Number */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      LOT NUMBER (REQUIRED) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 62116, LOT-104..."
                      value={woLotId}
                      onChange={(e) => setWoLotId(e.target.value)}
                      className="form-input"
                      list="recent-lots-list"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                    <datalist id="recent-lots-list">
                      {designs.map(d => (
                        <option key={d.id} value={d.id}>{d.name || d.style || d.category}</option>
                      ))}
                    </datalist>
                  </div>

                  {/* Style / Garment Name */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      STYLE / GARMENT ITEM
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lower, Tracksuit, T-Shirt..."
                      value={woLotStyle}
                      onChange={(e) => setWoLotStyle(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '600',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Brand */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      BUYER / BRAND
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mohit Hosiery, Hermes..."
                      value={woBrand}
                      onChange={(e) => setWoBrand(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '600',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Order Pieces */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      BATCH CUTTING VOLUME (PCS)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="100"
                      value={woPieces}
                      onChange={(e) => setWoPieces(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Issuer Person */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      ISSUER PERSON <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Store Incharge"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Receiver Person */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      RECEIVER PERSON <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rohit (Cutting Master)"
                      value={woReceiverName}
                      onChange={(e) => setWoReceiverName(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Receiver Department */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                      RECEIVER DEPT / LINE <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cutting Floor, Finishing..."
                      value={woReceiverDept}
                      onChange={(e) => setWoReceiverDept(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Material Items Requisition Table Card */}
              <div style={{
                backgroundColor: 'var(--bg-primary, #ffffff)',
                borderRadius: '14px',
                border: '1.5px solid var(--border-color, #cbd5e1)',
                padding: '20px 22px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={16} style={{ color: '#ea580c' }} />
                    <span>2. Materials to Issue ({woItems.length} Item{woItems.length > 1 ? 's' : ''})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddWoItem}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #fdba74',
                      background: '#fff7ed',
                      color: '#c2410c',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <Plus size={14} /> Add Another Material Row
                  </button>
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '38px', minWidth: '38px' }}>#</th>
                        <th style={{ padding: '10px 10px', textAlign: 'left', minWidth: '160px' }}>Component Name *</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '280px' }}>Inventory Material *</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: '140px', minWidth: '140px', whiteSpace: 'nowrap' }}>Stock Available</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: '140px', minWidth: '140px', whiteSpace: 'nowrap' }}>Issue Qty *</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px', minWidth: '85px', whiteSpace: 'nowrap' }}>Unit</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '180px' }}>Reason for Issue *</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '150px' }}>Remarks</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '45px', minWidth: '45px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {woItems.map((item, idx) => {
                        const selectedMat = materials.find(m => String(m.id) === String(item.materialId));
                        const currentStock = selectedMat ? parseFloat(selectedMat.stock || selectedMat.totalStock || 0) : null;
                        const qtyNum = parseFloat(item.extraQty) || 0;
                        const isStockLow = currentStock !== null && qtyNum > currentStock;

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', color: '#64748b', verticalAlign: 'middle' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                list={`comp-types-${item.id}`}
                                placeholder="e.g. Label, Tape, Tag..."
                                value={item.componentName || ''}
                                onChange={(e) => handleUpdateWoItem(item.id, 'componentName', e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '38px',
                                  padding: '7px 10px',
                                  borderRadius: '7px',
                                  border: !item.componentName?.trim() ? '1.5px solid #fdba74' : '1.5px solid #cbd5e1',
                                  background: '#ffffff',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: '#0f172a',
                                  boxSizing: 'border-box'
                                }}
                              />
                              <datalist id={`comp-types-${item.id}`}>
                                {COMPONENT_PRESETS.map(c => (
                                  <option key={c} value={c} />
                                ))}
                              </datalist>
                            </td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                              <SearchableMaterialSelect
                                materials={materials}
                                value={item.materialId}
                                onChange={(val) => handleUpdateWoItem(item.id, 'materialId', val)}
                                placeholder={item.componentName?.trim() ? `-- Select ${item.componentName} Material --` : "-- Search & Select Inventory Material --"}
                                categoryHint={item.componentName}
                              />
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', width: '140px', minWidth: '140px', verticalAlign: 'middle' }}>
                              {selectedMat ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    fontSize: '12.5px',
                                    fontWeight: '800',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: '1.2',
                                    background: currentStock <= 0 ? '#fef2f2' : currentStock < 20 ? '#fffbeb' : '#f0fdf4',
                                    color: currentStock <= 0 ? '#dc2626' : currentStock < 20 ? '#d97706' : '#16a34a',
                                    border: `1.5px solid ${currentStock <= 0 ? '#fecaca' : currentStock < 20 ? '#fde68a' : '#86efac'}`,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                  }}>
                                    <span style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '50%',
                                      backgroundColor: currentStock <= 0 ? '#ef4444' : currentStock < 20 ? '#f59e0b' : '#16a34a',
                                      display: 'inline-block',
                                      flexShrink: 0
                                    }} />
                                    <span style={{ fontSize: '13px', fontWeight: '900' }}>
                                      {Number(currentStock).toLocaleString()}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: '700', opacity: 0.85 }}>
                                      {selectedMat.unit || 'Pcs'}
                                    </span>
                                  </div>
                                  {currentStock <= 0 && (
                                    <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                      Out of Stock
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', width: '140px', minWidth: '140px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                <div style={{ position: 'relative', width: '100%', maxWidth: '120px' }}>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    placeholder="0.00"
                                    value={item.extraQty}
                                    onChange={(e) => handleUpdateWoItem(item.id, 'extraQty', e.target.value)}
                                    style={{
                                      width: '100%',
                                      height: '38px',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      border: isStockLow ? '2px solid #ef4444' : (parseFloat(item.extraQty) > 0 ? '2px solid #ea580c' : '1.5px solid #cbd5e1'),
                                      background: isStockLow ? '#fef2f2' : '#ffffff',
                                      fontSize: '14px',
                                      fontWeight: '800',
                                      textAlign: 'center',
                                      color: isStockLow ? '#dc2626' : (parseFloat(item.extraQty) > 0 ? '#c2410c' : '#0f172a'),
                                      boxSizing: 'border-box',
                                      outline: 'none',
                                      boxShadow: isStockLow
                                        ? '0 0 0 2px rgba(239, 68, 68, 0.15)'
                                        : (parseFloat(item.extraQty) > 0 ? '0 0 0 2px rgba(234, 88, 12, 0.15)' : 'none'),
                                      transition: 'all 0.15s ease'
                                    }}
                                  />
                                </div>
                                {isStockLow && (
                                  <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '800', marginTop: '1px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    ⚠ Exceeds stock!
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', width: '85px', minWidth: '85px', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                color: '#475569',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.unit || selectedMat?.unit || 'Pcs'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                              <select
                                value={item.reason}
                                onChange={(e) => handleUpdateWoItem(item.id, 'reason', e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '38px',
                                  padding: '7px 10px',
                                  borderRadius: '7px',
                                  border: '1.5px solid #cbd5e1',
                                  background: '#ffffff',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {EXTRA_REASONS.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                placeholder="e.g. Floor request..."
                                value={item.remarks}
                                onChange={(e) => handleUpdateWoItem(item.id, 'remarks', e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '38px',
                                  padding: '7px 10px',
                                  borderRadius: '7px',
                                  border: '1.5px solid #cbd5e1',
                                  background: '#ffffff',
                                  fontSize: '12px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', width: '45px', minWidth: '45px', verticalAlign: 'middle' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveWoItem(item.id)}
                                disabled={woItems.length <= 1}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: woItems.length <= 1 ? '#cbd5e1' : '#ef4444',
                                  cursor: woItems.length <= 1 ? 'not-allowed' : 'pointer',
                                  padding: '4px'
                                }}
                                title="Remove item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1.5px solid #f1f5f9',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>
                    Configured Items: <strong style={{ color: '#0f172a' }}>{woItems.filter(i => i.materialId && parseFloat(i.extraQty) > 0).length}</strong> of <strong>{woItems.length}</strong> items ready to issue
                  </div>

                  <button
                    type="button"
                    onClick={handleIssueWithoutBom}
                    style={{
                      padding: '11px 26px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Zap size={16} /> Issue Extra Material (Without BOM) & Generate Slip
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 2: EXTRA ISSUE HISTORY LOGS */}
      {activeSubTab === 'history' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          width: '100%'
        }}>
          {/* Executive Metric Overview Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            width: '100%'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Total Extra Vouchers</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  {historyStats.totalVouchers}
                </strong>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Total Extra Units Issued</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
                  {historyStats.totalQty.toLocaleString()} Pcs
                </strong>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Impacted Production Lots</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>
                  {historyStats.uniqueLotsCount} Lots
                </strong>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Package size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Total BOM Line Items</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: '#d97706' }}>
                  {historyStats.totalItems} Items
                </strong>
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            {/* Header & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    Extra Material Issue Transaction Logs
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    color: '#4f46e5'
                  }}>
                    {historySearch ? `${extraIssueLogs.length} of ${allExtraLogs.length} Records` : `${allExtraLogs.length} Records`}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  Audit records of all extra material / wastage re-issues with instant reprint vouchers.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Category Pills for Extra Material */}
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: 'var(--bg-secondary, #f1f5f9)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)'
                }}>
                  <button
                    type="button"
                    onClick={() => setHistoryCategoryFilter('all')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: historyCategoryFilter === 'all' ? '#0f172a' : 'transparent',
                      color: historyCategoryFilter === 'all' ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    All Extra ({allExtraLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryCategoryFilter('extra')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: historyCategoryFilter === 'extra' ? '#059669' : 'transparent',
                      color: historyCategoryFilter === 'extra' ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Extra Issue ({allExtraLogs.filter(l => !isLogReissue(l)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryCategoryFilter('reissue')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: historyCategoryFilter === 'reissue' ? '#dc2626' : 'transparent',
                      color: historyCategoryFilter === 'reissue' ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Re-Issue ({allExtraLogs.filter(l => isLogReissue(l)).length})
                  </button>
                </div>

                <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Filter by Lot No, Material, Person, Reason..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      height: '34px',
                      paddingLeft: '34px',
                      paddingRight: historySearch ? '30px' : '12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {historySearch && (
                    <button
                      type="button"
                      onClick={() => setHistorySearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range Filter & Master Actions Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e2e8f0)',
              marginBottom: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              {/* Left: Date Range Filter (From Date, To Date, Quick Presets) */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#334155', fontSize: '12px', fontWeight: '800' }}>
                  <Calendar size={15} style={{ color: '#4f46e5' }} />
                  <span>Choose Days:</span>
                </div>

                {/* From Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>From:</span>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* To Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>To:</span>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setQuickDatePreset('today')}
                    style={{
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDatePreset('yesterday')}
                    style={{
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDatePreset('7days')}
                    style={{
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDatePreset('thisMonth')}
                    style={{
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    This Month
                  </button>
                  {(historyDateFrom || historyDateTo) && (
                    <button
                      type="button"
                      onClick={() => setQuickDatePreset('all')}
                      style={{
                        padding: '3px 9px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '5px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                      title="Clear Date Range Filter"
                    >
                      <RotateCcw size={11} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Master Print & Export Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* On-screen expand toggle */}
                <button
                  type="button"
                  onClick={() => setShowAllDetailsInTable(!showAllDetailsInTable)}
                  style={{
                    padding: '6px 11px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: showAllDetailsInTable ? '#eff6ff' : '#ffffff',
                    color: showAllDetailsInTable ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Toggle expanding all items and reasons in the table"
                >
                  <Eye size={13} />
                  <span>{showAllDetailsInTable ? 'Collapse Details' : 'See All Detail'}</span>
                </button>

                {/* Print All Details Master Report Button */}
                <button
                  type="button"
                  onClick={handlePrintAllDetails}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '800',
                    borderRadius: '7px',
                    border: '1px solid #0f172a',
                    background: '#0f172a',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  title="Print full A4 landscape report with all items, reasons, issuers and receivers"
                >
                  <Printer size={14} style={{ color: '#ea580c' }} />
                  <span>Print All Detail</span>
                </button>

                {/* PDF Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadAllDetailsPdf}
                  style={{
                    padding: '6px 11px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Export detailed audit report as PDF"
                >
                  <Download size={13} style={{ color: '#4f46e5' }} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            {extraIssueLogs.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366f1'
                  }}>
                    <Clock size={24} />
                  </div>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>No Extra Issue Logs Found</strong>
                  <span style={{ fontSize: '12px', maxWidth: '350px' }}>
                    {historySearch ? 'No vouchers match your search filter.' : 'When extra materials are issued for production lots, their permanent audit logs will appear here.'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Challan / Bill No</th>
                      <th style={{ padding: '10px 12px' }}>Date</th>
                      <th style={{ padding: '10px 12px' }}>Lot & Brand</th>
                      <th style={{ padding: '10px 12px' }}>Issued Materials</th>
                      <th style={{ padding: '10px 12px' }}>Issued By</th>
                      <th style={{ padding: '10px 12px' }}>Received By</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraIssueLogs.map((log, idx) => {
                      const cleanIssuer = (log.personName || 'Store In-charge').replace(/\s*\(.*?\)/, '').trim() || 'Store In-charge';
                      const receiver = log.receiverName || 'Cutting Floor';
                      const dept = log.receiverDept || 'Cutting';

                      return (
                        <tr
                          key={log.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafafa'}
                        >
                          {/* Challan / Bill No */}
                          <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '800',
                              whiteSpace: 'nowrap'
                            }}>
                              {log.id}
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {log.date}
                          </td>

                          {/* Lot Reference & Distinct Category Badge & Brand */}
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>LOT #{log.lotId || 'DIRECT'}</span>
                                {(() => {
                                  const isReissue = isLogReissue(log);
                                  return (
                                    <span style={{
                                      fontSize: '10px',
                                      background: isReissue ? '#fef2f2' : '#f0fdf4',
                                      color: isReissue ? '#b91c1c' : '#15803d',
                                      border: `1px solid ${isReissue ? '#fecaca' : '#bbf7d0'}`,
                                      padding: '2px 7px',
                                      borderRadius: '5px',
                                      fontWeight: '800',
                                      letterSpacing: '0.3px',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}>
                                      {isReissue ? 'RE-ISSUE' : 'EXTRA MATERIAL'}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                                <span style={{ color: '#0f172a', fontWeight: '800' }}>Brand:</span> {log.brand || 'Mohit Hosiery'}
                              </div>
                            </div>
                          </td>

                          {/* Issued Materials */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {(showAllDetailsInTable ? (log.materials || []) : (log.materials || []).slice(0, 3)).map((m, mIdx) => (
                                <div key={mIdx} style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.35 }}>
                                  &bull; <strong>{m.bomItemName || m.name}:</strong> <span style={{ fontWeight: '700', color: '#0f172a' }}>{m.qty} {m.unit || 'Pcs'}</span>
                                  {m.reason && (
                                    <span style={{
                                      fontSize: '10px',
                                      color: '#b91c1c',
                                      marginLeft: '5px',
                                      backgroundColor: '#fef2f2',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      border: '1px solid #fee2e2',
                                      fontWeight: '600'
                                    }}>
                                      {m.reason}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {!showAllDetailsInTable && (log.materials || []).length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllDetailsInTable(true)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    textAlign: 'left',
                                    fontSize: '11px',
                                    color: '#ea580c',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                  }}
                                >
                                  +{(log.materials || []).length - 3} more item(s) (click to see all)
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Issued By */}
                          <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                            {cleanIssuer}
                          </td>

                          {/* Received By */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ color: '#0f172a', fontWeight: '800', fontSize: '12.5px', textTransform: 'uppercase' }}>
                                {receiver}
                              </strong>
                              {dept && (
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                                  {dept}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions: Print and Preview buttons matching user screenshot */}
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleDirectPrintLog(log)}
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
                                  gap: '4px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                                }}
                                title="Direct 1-Click Print"
                              >
                                <Printer size={13} style={{ color: '#ea580c' }} />
                                <span>Print</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePreviewSlip(log)}
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
                                  gap: '4px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                }}
                                title="Preview on-screen and download PDF"
                              >
                                <Eye size={13} />
                                <span>Preview</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 3: COMBINED AUDIT REPORT (1ST TIME VS EXTRA MATERIAL ISSUE) */}
      {activeSubTab === 'combined_audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {/* Executive Overview Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            width: '100%'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <BarChart3 size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Production Lots Audited</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  {lotAuditSummary.length} Lots
                </strong>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>1st Time Issue Volume</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: '#1d4ed8' }}>
                  {lotAuditSummary.reduce((sum, l) => sum + l.initialPieces, 0).toLocaleString()} Pcs
                </strong>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Extra Material Volume</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
                  +{lotAuditSummary.reduce((sum, l) => sum + l.reissuePieces, 0).toLocaleString()} Pcs
                </strong>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Total Combined Dispatched</span>
                <strong style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>
                  {lotAuditSummary.reduce((sum, l) => sum + l.totalPieces, 0).toLocaleString()} Pcs
                </strong>
              </div>
            </div>
          </div>

          {/* Search Header */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    First-Time vs Extra Material Issue Combined Audit
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    color: '#4f46e5'
                  }}>
                    {auditLotSearch ? `${filteredLotAudits.length} of ${lotAuditSummary.length} Lots` : `${lotAuditSummary.length} Production Lots`}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  Complete comparative matrix verifying initial first-time issues vs extra material re-issues and total consumption per component.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const allExpanded = filteredLotAudits.length > 0 && filteredLotAudits.every(l => !!expandedAuditLots[l.lotId]);
                    if (allExpanded) {
                      setExpandedAuditLots({});
                    } else {
                      const nextMap = {};
                      filteredLotAudits.forEach(l => { nextMap[l.lotId] = true; });
                      setExpandedAuditLots(nextMap);
                    }
                  }}
                  className="btn btn-secondary btn-xs"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    height: '36px'
                  }}
                  title="Expand or collapse all lot audit cards"
                >
                  <ChevronDown
                    size={14}
                    style={{
                      transform: (filteredLotAudits.length > 0 && filteredLotAudits.every(l => !!expandedAuditLots[l.lotId])) ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s'
                    }}
                  />
                  <span>
                    {(filteredLotAudits.length > 0 && filteredLotAudits.every(l => !!expandedAuditLots[l.lotId])) ? 'Collapse All' : 'Expand All'}
                  </span>
                </button>

                <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Filter by Lot No, Style, Component, Material..."
                    value={auditLotSearch}
                    onChange={(e) => setAuditLotSearch(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      height: '36px',
                      paddingLeft: '34px',
                      paddingRight: auditLotSearch ? '30px' : '12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {auditLotSearch && (
                    <button
                      type="button"
                      onClick={() => setAuditLotSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lot Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredLotAudits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {lotAuditSummary.length === 0 ? 'No material transactions recorded yet.' : 'No production lots match your search.'}
                </div>
              ) : (
                filteredLotAudits.map(lotAudit => {
                  const materialsList = Object.values(lotAudit.materialsSummary || {});
                  const hasReissues = lotAudit.reissuePieces > 0 || lotAudit.reissueLogs.length > 0;
                  const isExpanded = !!expandedAuditLots[lotAudit.lotId]; // Default collapsed: only show full detail when user clicks Expand

                  return (
                    <div
                      key={lotAudit.lotId}
                      style={{
                        backgroundColor: 'var(--bg-primary, #ffffff)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '9px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Lot Header */}
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-secondary, #f8fafc)',
                        borderBottom: isExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>
                            Lot {lotAudit.lotId}
                          </strong>
                          {lotAudit.design?.lotNo2 && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: '#4f46e5',
                              fontWeight: '700'
                            }}>
                              {lotAudit.design.lotNo2}
                            </span>
                          )}
                          <span style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748b)' }}>
                            • {lotAudit.category} {lotAudit.brand && lotAudit.brand !== '—' && `(${lotAudit.brand})`}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            color: '#4f46e5',
                            fontWeight: '700'
                          }}>
                            {materialsList.length} BOM Items
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Comparison Pills */}
                          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#1d4ed8', fontSize: '11.5px', fontWeight: '700' }}>
                            1st Time: {lotAudit.initialPieces.toLocaleString()} pcs
                          </span>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: hasReissues ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-secondary)', color: hasReissues ? '#dc2626' : 'var(--text-muted)', fontSize: '11.5px', fontWeight: '700' }}>
                            Extra: {hasReissues ? `+${lotAudit.reissuePieces.toLocaleString()} pcs` : '0 pcs'}
                          </span>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: '11.5px', fontWeight: '800' }}>
                            Combined: {lotAudit.totalPieces.toLocaleString()} pcs
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleAuditLotExpand(lotAudit.lotId)}
                            className="btn btn-secondary btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11.5px' }}
                          >
                            <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPrintAudit(lotAudit)}
                            className="btn btn-primary btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', fontSize: '11.5px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                            title="Preview & Print Full Lot Audit Report"
                          >
                            <Printer size={12} />
                            <span>Print Audit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadLotAuditPdf(lotAudit)}
                            className="btn btn-secondary btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', fontSize: '11.5px' }}
                            title="Download Combined Audit PDF"
                          >
                            <FileText size={12} />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* 3 Sequential Sections: 1st Time Issue -> Extra Issue -> Both Combined */}
                      {isExpanded && (
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          {/* 1. FIRST-TIME ISSUE DETAILS (GOOD / INITIAL ALLOCATION) */}
                          <div style={{ borderRadius: '6px', border: '1px solid #bfdbfe', overflow: 'hidden' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              backgroundColor: '#eff6ff',
                              borderBottom: '1px solid #bfdbfe',
                              fontSize: '11.5px',
                              fontWeight: '800',
                              color: '#1e40af'
                            }}>
                              <span>1. FIRST-TIME ISSUE DETAILS (GOOD / INITIAL ALLOCATION)</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px' }}>
                                {lotAudit.initialPieces.toLocaleString()} Pcs • {lotAudit.initialLogs.length} Slip(s)
                              </span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                                <thead>
                                  <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', textAlign: 'left' }}>
                                    <th style={{ padding: '7px 10px', width: '30px' }}>#</th>
                                    <th style={{ padding: '7px 10px', width: '110px' }}>Slip ID</th>
                                    <th style={{ padding: '7px 10px', width: '130px' }}>Issue Date</th>
                                    <th style={{ padding: '7px 10px', textAlign: 'right', width: '90px' }}>Pieces</th>
                                    <th style={{ padding: '7px 10px', width: '150px' }}>Issuer &amp; Receiver</th>
                                    <th style={{ padding: '7px 10px' }}>First-Time Dispatched Materials</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lotAudit.initialLogs.length === 0 ? (
                                    <tr>
                                      <td colSpan="6" style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No initial issue slip recorded for this lot.
                                      </td>
                                    </tr>
                                  ) : (
                                    lotAudit.initialLogs.map((l, lIdx) => (
                                      <tr key={lIdx} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', backgroundColor: lIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{lIdx + 1}</td>
                                        <td style={{ padding: '7px 10px', fontWeight: '700', fontFamily: 'monospace', color: '#2563eb' }}>{l.id}</td>
                                        <td style={{ padding: '7px 10px' }}>{l.date}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                                          {Number(l.volume || 0).toLocaleString()} pcs
                                        </td>
                                        <td style={{ padding: '7px 10px' }}>
                                          {l.personName || 'Store'}{l.receiverName ? ` → ${l.receiverName}` : ''}
                                        </td>
                                        <td style={{ padding: '7px 10px' }}>
                                          {(l.materials || []).map((m, mIdx) => (
                                            <span key={mIdx} style={{ marginRight: '8px', display: 'inline-block' }}>
                                              {m.bomItemName || m.name}: <strong style={{ color: 'var(--text-main)' }}>{m.qty} {m.unit || 'pcs'}</strong>{mIdx < l.materials.length - 1 ? ',' : ''}
                                            </span>
                                          ))}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 2. EXTRA MATERIAL ISSUE DETAILS (WASTAGE & RE-ISSUES) */}
                          <div style={{
                            borderRadius: '6px',
                            border: `1px solid ${lotAudit.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              backgroundColor: lotAudit.reissueLogs.length > 0 ? '#fef2f2' : '#f0fdf4',
                              borderBottom: `1px solid ${lotAudit.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                              fontSize: '11.5px',
                              fontWeight: '800',
                              color: lotAudit.reissueLogs.length > 0 ? '#991b1b' : '#166534'
                            }}>
                              <span>2. EXTRA MATERIAL ISSUE DETAILS (WASTAGE &amp; RE-ISSUES)</span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: lotAudit.reissueLogs.length > 0 ? '#fee2e2' : '#dcfce7',
                                color: lotAudit.reissueLogs.length > 0 ? '#b91c1c' : '#15803d',
                                padding: '2px 8px',
                                borderRadius: '10px'
                              }}>
                                {lotAudit.reissueLogs.length > 0
                                  ? `+${lotAudit.reissuePieces.toLocaleString()} Pcs • ${lotAudit.reissueLogs.length} Extra Slip(s)`
                                  : '0 Extra Pcs • Zero Wastage'}
                              </span>
                            </div>
                            {lotAudit.reissueLogs.length === 0 ? (
                              <div style={{
                                padding: '12px 14px',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <CheckCircle size={16} style={{ color: '#16a34a' }} />
                                <span>Zero Extra Material Issued — Standard 1st-Time Issue (0% Extra Wastage). All production pieces completed within original initial dispatch.</span>
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#fff5f5', borderBottom: '1px solid #fecaca', textAlign: 'left' }}>
                                      <th style={{ padding: '7px 10px', width: '30px' }}>#</th>
                                      <th style={{ padding: '7px 10px', width: '110px' }}>Extra Slip ID</th>
                                      <th style={{ padding: '7px 10px', width: '130px' }}>Issue Date</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'right', width: '90px' }}>Extra Pcs</th>
                                      <th style={{ padding: '7px 10px', width: '150px' }}>Reason / Cause</th>
                                      <th style={{ padding: '7px 10px', width: '150px' }}>Issuer &amp; Receiver</th>
                                      <th style={{ padding: '7px 10px' }}>Extra Dispatched Materials</th>
                                      <th style={{ padding: '7px 10px', width: '60px', textAlign: 'center' }}>Slip</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lotAudit.reissueLogs.map((rLog, rIdx) => (
                                      <tr key={rIdx} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(239, 68, 68, 0.02)' }}>
                                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{rIdx + 1}</td>
                                        <td style={{ padding: '7px 10px', fontWeight: '700', fontFamily: 'monospace', color: '#dc2626' }}>{rLog.id}</td>
                                        <td style={{ padding: '7px 10px' }}>{rLog.date}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', color: '#b91c1c' }}>
                                          +{Number(rLog.volume || 0).toLocaleString()} pcs
                                        </td>
                                        <td style={{ padding: '7px 10px', fontWeight: '600', color: '#7f1d1d' }}>
                                          {rLog.materials && rLog.materials[0]?.reason ? rLog.materials[0].reason : 'Extra Material Requisition'}
                                        </td>
                                        <td style={{ padding: '7px 10px' }}>
                                          {rLog.personName || 'Store'}{rLog.receiverName ? ` → ${rLog.receiverName}` : ''}
                                        </td>
                                        <td style={{ padding: '7px 10px' }}>
                                          {(rLog.materials || []).map((m, mIdx) => (
                                            <span key={mIdx} style={{ marginRight: '8px', display: 'inline-block' }}>
                                              {m.bomItemName || m.name}: <strong style={{ color: '#b91c1c' }}>+{m.qty} {m.unit || 'pcs'}</strong>{mIdx < rLog.materials.length - 1 ? ',' : ''}
                                            </span>
                                          ))}
                                        </td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const slipData = {
                                                voucherId: rLog.id,
                                                issueDate: rLog.date,
                                                design: lotAudit.design || { id: rLog.lotId, category: rLog.category, brand: '' },
                                                pieces: rLog.volume || 100,
                                                personName: rLog.personName || 'Store Staff',
                                                receiverName: 'Cutting Dept',
                                                receiverDept: 'Cutting Line',
                                                items: (rLog.materials || []).map(m => ({
                                                  materialId: 'MT-ITEM',
                                                  materialName: m.name,
                                                  bomItemName: m.bomItemName || m.name,
                                                  totalRequired: m.qty,
                                                  unit: m.unit || 'Pcs',
                                                  reason: 'Extra Material Issue Log'
                                                }))
                                              };
                                              setPrintSlipData(slipData);
                                            }}
                                            className="btn btn-secondary btn-xs"
                                            style={{ padding: '2px 6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                            title="Reprint Slip"
                                          >
                                            <Printer size={11} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* 3. BOTH DETAILS COMBINED (CONSOLIDATED SOURCING & DISPATCHED MATRIX) */}
                          <div style={{ borderRadius: '6px', border: '1px solid #c7d2fe', overflow: 'hidden' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              backgroundColor: '#eef2ff',
                              borderBottom: '1px solid #c7d2fe',
                              fontSize: '11.5px',
                              fontWeight: '800',
                              color: '#3730a3'
                            }}>
                              <span>3. BOTH DETAILS COMBINED (CONSOLIDATED SOURCING &amp; DISPATCHED MATRIX)</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '10px' }}>
                                Combined Total: {lotAudit.totalPieces.toLocaleString()} Pcs Net
                              </span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', borderBottom: '1.5px solid var(--border-color, #e2e8f0)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                                    <th style={{ padding: '8px 10px' }}>BOM Component</th>
                                    <th style={{ padding: '8px 10px' }}>Mapped Material</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: 'rgba(37, 99, 235, 0.05)', color: '#1d4ed8' }}>
                                      1st Time Issue Qty
                                    </th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#dc2626' }}>
                                      Extra Issue Qty
                                    </th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                      Returned Qty
                                    </th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', fontWeight: '800' }}>
                                      Combined Total Net
                                    </th>
                                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>
                                      Variance / Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {materialsList.length === 0 ? (
                                    <tr>
                                      <td colSpan={8} style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No material issues recorded for this lot yet.
                                      </td>
                                    </tr>
                                  ) : (
                                    materialsList.map((m, mIdx) => {
                                      const variancePercent = m.initialQty > 0 ? ((m.reissueQty / m.initialQty) * 100).toFixed(1) : (m.reissueQty > 0 ? '100.0' : '0.0');
                                      const hasExtra = m.reissueQty > 0;

                                      return (
                                        <tr key={mIdx} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{mIdx + 1}</td>
                                          <td style={{ padding: '8px 10px', fontWeight: '700', color: 'var(--text-main)' }}>
                                            {m.bomItemName}
                                          </td>
                                          <td style={{ padding: '8px 10px', color: 'var(--text-main)' }}>
                                            {m.materialName}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#1d4ed8', backgroundColor: 'rgba(37, 99, 235, 0.02)' }}>
                                            {m.initialQty > 0 ? `${Number(m.initialQty.toFixed(2))} ${m.unit}` : '—'}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: hasExtra ? '#dc2626' : 'var(--text-muted)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                                            {hasExtra ? (
                                              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                                +{Number(m.reissueQty.toFixed(2))} {m.unit}
                                              </span>
                                            ) : (
                                              '0'
                                            )}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', color: m.returnedQty > 0 ? '#059669' : 'var(--text-muted)' }}>
                                            {m.returnedQty > 0 ? `-${Number(m.returnedQty.toFixed(2))} ${m.unit}` : '0'}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#4f46e5', backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
                                            {Number(m.totalIssuedQty.toFixed(2))} {m.unit}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                            {hasExtra ? (
                                              <span style={{ fontSize: '10.5px', fontWeight: '700', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}>
                                                +{variancePercent}% Extra
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: '600' }}>
                                                Standard 1st Issue
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW / SLIP MODAL */}
      {printSlipData && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            color: '#0f172a',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: '#1e293b',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
                  Extra Material Requisition & Issue Slip
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleTriggerBrowserPrint}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none'
                  }}
                >
                  <Printer size={14} />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSlipPdf(printSlipData)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none'
                  }}
                >
                  <FileText size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSlipData(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '20px',
                    marginLeft: '8px'
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Printable Slip Body */}
            <div id="printable-extra-issue-slip" style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1,
              backgroundColor: '#ffffff'
            }}>
              {/* Slip 1: Original Store Copy */}
              <div style={{
                border: '1.5px solid #000000',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '20px',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000000', paddingBottom: '8px', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      MH ACCESSORIES & BOM STORE
                    </h2>
                    <span style={{ fontSize: '10px', color: '#475569' }}>Garment Product Data Management System (G-PDMS)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase' }}>
                      EXTRA MATERIAL ISSUE VOUCHER
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700' }}>[ ORIGINAL STORE COPY ]</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px 16px',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '11px',
                  marginBottom: '12px'
                }}>
                  <div><strong>Voucher No:</strong> {printSlipData.voucherId}</div>
                  <div><strong>Issue Date:</strong> {printSlipData.issueDate}</div>
                  <div><strong>Lot Number:</strong> Lot {printSlipData.lotId || printSlipData.design?.id || '—'} {printSlipData.isWithoutBom ? <span style={{ marginLeft: '4px', padding: '1px 5px', background: '#fff7ed', color: '#c2410c', borderRadius: '4px', fontWeight: '800', border: '1px solid #fdba74', fontSize: '10px' }}>WITHOUT BOM</span> : (printSlipData.design?.lotNo2 ? `(${printSlipData.design.lotNo2})` : '')}</div>
                  <div><strong>Brand:</strong> {printSlipData.design?.brand || printSlipData.brand || 'Mohit Hosiery'}</div>
                  <div><strong>Garment Type:</strong> {printSlipData.design?.category || printSlipData.design?.style || printSlipData.style || 'Floor Issue'}</div>
                  <div><strong>Order Volume:</strong> {(printSlipData.pieces || 0).toLocaleString()} Units</div>
                  <div><strong>Issued By:</strong> {printSlipData.personName}</div>
                  <div><strong>Received By:</strong> {printSlipData.receiverName}</div>
                  <div><strong>Dept/Line:</strong> {printSlipData.receiverDept}</div>
                </div>

                {/* Table of Issued Items */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1.5px solid #000000' }}>
                      <th style={{ padding: '6px', textAlign: 'center', width: '30px' }}>#</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Component Name</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Material Description</th>
                      <th style={{ padding: '6px', textAlign: 'center', width: '90px' }}>Extra Qty</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Reason / Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printSlipData.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '6px', fontWeight: '700' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {item.bomItemName}
                          </span>
                        </td>
                        <td style={{ padding: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700', marginRight: '6px', color: '#475569' }}>
                            [{item.itemCode || item.materialCode || item.materialId}]
                          </span>
                          {item.materialName}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: '800', color: '#b91c1c' }}>
                          {item.totalRequired} {item.unit}
                        </td>
                        <td style={{ padding: '6px' }}>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signatures */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  fontSize: '11px',
                  borderTop: '1px solid #000000',
                  paddingTop: '16px',
                  marginTop: '10px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Issued By (Store Keeper)</div>
                    <div style={{ fontSize: '10px' }}>{printSlipData.personName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Received By (Cutting/Master)</div>
                    <div style={{ fontSize: '10px' }}>{printSlipData.receiverName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Authorized / Supervisor</div>
                    <div style={{ fontSize: '10px' }}>Store / Production Head</div>
                  </div>
                </div>
              </div>

              {/* Slip 2: Duplicate Production Copy */}
              <div style={{
                border: '1.5px dashed #64748b',
                padding: '16px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000000', paddingBottom: '8px', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      MH ACCESSORIES & BOM STORE
                    </h2>
                    <span style={{ fontSize: '10px', color: '#475569' }}>Garment Product Data Management System (G-PDMS)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase' }}>
                      EXTRA MATERIAL ISSUE VOUCHER
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700' }}>[ DUPLICATE PRODUCTION COPY ]</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px 16px',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '11px',
                  marginBottom: '12px'
                }}>
                  <div><strong>Voucher No:</strong> {printSlipData.voucherId}</div>
                  <div><strong>Issue Date:</strong> {printSlipData.issueDate}</div>
                  <div><strong>Lot Number:</strong> Lot {printSlipData.lotId || printSlipData.design?.id || '—'} {printSlipData.isWithoutBom ? <span style={{ marginLeft: '4px', padding: '1px 5px', background: '#fff7ed', color: '#c2410c', borderRadius: '4px', fontWeight: '800', border: '1px solid #fdba74', fontSize: '10px' }}>WITHOUT BOM</span> : (printSlipData.design?.lotNo2 ? `(${printSlipData.design.lotNo2})` : '')}</div>
                  <div><strong>Brand:</strong> {printSlipData.design?.brand || printSlipData.brand || 'Mohit Hosiery'}</div>
                  <div><strong>Garment Type:</strong> {printSlipData.design?.category || printSlipData.design?.style || printSlipData.style || 'Floor Issue'}</div>
                  <div><strong>Order Volume:</strong> {(printSlipData.pieces || 0).toLocaleString()} Units</div>
                  <div><strong>Issued By:</strong> {printSlipData.personName}</div>
                  <div><strong>Received By:</strong> {printSlipData.receiverName}</div>
                  <div><strong>Dept/Line:</strong> {printSlipData.receiverDept}</div>
                </div>

                {/* Table of Issued Items */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1.5px solid #000000' }}>
                      <th style={{ padding: '6px', textAlign: 'center', width: '30px' }}>#</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Component Name</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Material Description</th>
                      <th style={{ padding: '6px', textAlign: 'center', width: '90px' }}>Extra Qty</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Reason / Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printSlipData.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '6px', fontWeight: '700' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {item.bomItemName}
                          </span>
                        </td>
                        <td style={{ padding: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700', marginRight: '6px', color: '#475569' }}>
                            [{item.itemCode || item.materialCode || item.materialId}]
                          </span>
                          {item.materialName}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: '800', color: '#b91c1c' }}>
                          {item.totalRequired} {item.unit}
                        </td>
                        <td style={{ padding: '6px' }}>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signatures */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  fontSize: '11px',
                  borderTop: '1px solid #000000',
                  paddingTop: '16px',
                  marginTop: '10px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Issued By (Store Keeper)</div>
                    <div style={{ fontSize: '10px' }}>{printSlipData.personName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Received By (Cutting/Master)</div>
                    <div style={{ fontSize: '10px' }}>{printSlipData.receiverName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Authorized / Supervisor</div>
                    <div style={{ fontSize: '10px' }}>Store / Production Head</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT REPORT PRINT PREVIEW MODAL */}
      {printAuditModalData && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            color: '#0f172a',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              backgroundColor: '#1e293b',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
                  Combined Material Audit Voucher — Lot {printAuditModalData.lotId}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleTriggerBrowserPrint}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={14} />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadLotAuditPdf(printAuditModalData)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintAuditModalData(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '22px',
                    marginLeft: '8px',
                    lineHeight: 1
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Printable Slip Body */}
            <div id="printable-extra-issue-slip" style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1,
              backgroundColor: '#ffffff'
            }}>
              <div style={{
                border: '1.5px solid #000000',
                padding: '16px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000000', paddingBottom: '8px', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      MH ACCESSORIES & BOM STORE
                    </h2>
                    <span style={{ fontSize: '10px', color: '#475569' }}>Garment Product Data Management System (G-PDMS)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase' }}>
                      COMBINED MATERIAL AUDIT REPORT
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700' }}>[ 1ST TIME & EXTRA ISSUE AUDIT ]</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px 16px',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '11px',
                  marginBottom: '12px'
                }}>
                  <div><strong>Lot Number:</strong> Lot {printAuditModalData.lotId} {printAuditModalData.design?.lotNo2 ? `(${printAuditModalData.design.lotNo2})` : ''}</div>
                  <div><strong>Garment Category:</strong> {printAuditModalData.category || '—'}</div>
                  <div><strong>Brand:</strong> {printAuditModalData.brand || '—'}</div>
                  <div><strong>1st Time Issue Volume:</strong> {printAuditModalData.initialPieces.toLocaleString()} Pcs ({printAuditModalData.initialLogs.length} vouchers)</div>
                  <div><strong>Extra Material Volume:</strong> +{printAuditModalData.reissuePieces.toLocaleString()} Pcs ({printAuditModalData.reissueLogs.length} vouchers)</div>
                  <div><strong>Total Net Dispatched:</strong> {printAuditModalData.totalPieces.toLocaleString()} Pcs</div>
                </div>

                {/* 1. FIRST-TIME ISSUE DETAILS (INITIAL PRODUCTION ALLOCATION) */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    backgroundColor: '#eff6ff',
                    borderLeft: '4px solid #2563eb',
                    borderTop: '1px solid #bfdbfe',
                    borderRight: '1px solid #bfdbfe',
                    borderBottom: '1px solid #bfdbfe',
                    borderRadius: '4px 4px 0 0',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#1e40af'
                  }}>
                    <span>1. FIRST-TIME ISSUE DETAILS (GOOD / INITIAL ALLOCATION)</span>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '1px 8px', borderRadius: '10px' }}>
                      {printAuditModalData.initialPieces.toLocaleString()} Pcs • {printAuditModalData.initialLogs.length} Slip(s)
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #bfdbfe', borderTop: 'none' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'center', width: '25px' }}>#</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', width: '100px' }}>Slip ID</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', width: '120px' }}>Issue Date</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', width: '80px' }}>Pieces</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', width: '120px' }}>Issuer & Receiver</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left' }}>First-Time Dispatched Materials</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printAuditModalData.initialLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>No initial issue slip recorded for this lot.</td>
                        </tr>
                      ) : (
                        printAuditModalData.initialLogs.map((l, lIdx) => (
                          <tr key={lIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: lIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{lIdx + 1}</td>
                            <td style={{ padding: '5px 8px', fontWeight: '700', fontFamily: 'monospace', color: '#1d4ed8' }}>{l.id}</td>
                            <td style={{ padding: '5px 8px' }}>{l.date}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                              {Number(l.volume || 0).toLocaleString()} pcs
                            </td>
                            <td style={{ padding: '5px 8px' }}>{l.personName || 'Store'}{l.receiverName ? ` → ${l.receiverName}` : ''}</td>
                            <td style={{ padding: '5px 8px' }}>
                              {(l.materials || []).map((m, mIdx) => (
                                <span key={mIdx} style={{ marginRight: '8px', display: 'inline-block' }}>
                                  {m.bomItemName || m.name}: <strong style={{ color: '#0f172a' }}>{m.qty} {m.unit || 'pcs'}</strong>{mIdx < l.materials.length - 1 ? ',' : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. EXTRA MATERIAL ISSUE DETAILS (WASTAGE / SUPPLEMENTARY ALLOCATIONS) */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    backgroundColor: printAuditModalData.reissueLogs.length > 0 ? '#fef2f2' : '#f0fdf4',
                    borderLeft: `4px solid ${printAuditModalData.reissueLogs.length > 0 ? '#dc2626' : '#16a34a'}`,
                    borderTop: `1px solid ${printAuditModalData.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                    borderRight: `1px solid ${printAuditModalData.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                    borderBottom: `1px solid ${printAuditModalData.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                    borderRadius: '4px 4px 0 0',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: printAuditModalData.reissueLogs.length > 0 ? '#991b1b' : '#166534'
                  }}>
                    <span>2. EXTRA MATERIAL ISSUE DETAILS (WASTAGE &amp; RE-ISSUES)</span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '700',
                      backgroundColor: printAuditModalData.reissueLogs.length > 0 ? '#fee2e2' : '#dcfce7',
                      color: printAuditModalData.reissueLogs.length > 0 ? '#b91c1c' : '#15803d',
                      padding: '1px 8px',
                      borderRadius: '10px'
                    }}>
                      {printAuditModalData.reissueLogs.length > 0
                        ? `+${printAuditModalData.reissuePieces.toLocaleString()} Pcs • ${printAuditModalData.reissueLogs.length} Extra Slip(s)`
                        : '0 Extra Pcs • Zero Wastage'}
                    </span>
                  </div>

                  {printAuditModalData.reissueLogs.length === 0 ? (
                    <div style={{
                      padding: '12px 14px',
                      border: '1px solid #bbf7d0',
                      borderTop: 'none',
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      fontSize: '11px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>✓ Zero Extra Material Issued — Standard 1st-Time Issue (0% Extra Wastage). All production pieces completed within original initial dispatch.</span>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #fecaca', borderTop: 'none' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fef2f2', borderBottom: '1.5px solid #fca5a5' }}>
                          <th style={{ padding: '5px 8px', textAlign: 'center', width: '25px' }}>#</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', width: '100px' }}>Extra Slip ID</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', width: '120px' }}>Issue Date</th>
                          <th style={{ padding: '5px 8px', textAlign: 'right', width: '80px' }}>Extra Pcs</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', width: '140px' }}>Reason / Cause</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', width: '120px' }}>Issuer & Receiver</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left' }}>Extra Dispatched Materials</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printAuditModalData.reissueLogs.map((l, lIdx) => (
                          <tr key={lIdx} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: lIdx % 2 === 0 ? '#ffffff' : '#fff5f5' }}>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{lIdx + 1}</td>
                            <td style={{ padding: '5px 8px', fontWeight: '700', fontFamily: 'monospace', color: '#dc2626' }}>{l.id}</td>
                            <td style={{ padding: '5px 8px' }}>{l.date}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700', color: '#b91c1c' }}>
                              +{Number(l.volume || 0).toLocaleString()} pcs
                            </td>
                            <td style={{ padding: '5px 8px', fontWeight: '600', color: '#7f1d1d' }}>
                              {l.materials && l.materials[0]?.reason ? l.materials[0].reason : 'Extra Material Requisition'}
                            </td>
                            <td style={{ padding: '5px 8px' }}>{l.personName || 'Store'}{l.receiverName ? ` → ${l.receiverName}` : ''}</td>
                            <td style={{ padding: '5px 8px' }}>
                              {(l.materials || []).map((m, mIdx) => (
                                <span key={mIdx} style={{ marginRight: '8px', display: 'inline-block' }}>
                                  {m.bomItemName || m.name}: <strong style={{ color: '#b91c1c' }}>+{m.qty} {m.unit || 'pcs'}</strong>{mIdx < l.materials.length - 1 ? ',' : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 3. BOTH DETAILS COMBINED (CONSOLIDATED SOURCING & NET DISPATCHED MATRIX) */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    backgroundColor: '#eef2ff',
                    borderLeft: '4px solid #4f46e5',
                    borderTop: '1px solid #c7d2fe',
                    borderRight: '1px solid #c7d2fe',
                    borderBottom: '1px solid #c7d2fe',
                    borderRadius: '4px 4px 0 0',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#3730a3'
                  }}>
                    <span>3. BOTH DETAILS COMBINED (CONSOLIDATED SOURCING &amp; DISPATCHED MATRIX)</span>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '1px 8px', borderRadius: '10px' }}>
                      Combined Total: {printAuditModalData.totalPieces.toLocaleString()} Pcs Net
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #c7d2fe', borderTop: 'none' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'center', width: '25px' }}>#</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left' }}>BOM Component</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left' }}>Inventory Material</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#1d4ed8' }}>1st Issue Qty</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#dc2626' }}>Extra Qty</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', color: '#059669' }}>Returned</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '800', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4338ca' }}>Combined Net Total</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center' }}>Variance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(printAuditModalData.materialsSummary || {}).map((m, mIdx) => {
                        const hasExtra = m.reissueQty > 0;
                        const variancePercent = m.initialQty > 0 ? ((m.reissueQty / m.initialQty) * 100).toFixed(1) : (hasExtra ? 100 : 0);
                        return (
                          <tr key={mIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: mIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{mIdx + 1}</td>
                            <td style={{ padding: '5px 8px', fontWeight: '700' }}>{m.bomItemName}</td>
                            <td style={{ padding: '5px 8px' }}>{m.materialName}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700', color: '#1d4ed8' }}>
                              {m.initialQty > 0 ? `${Number(m.initialQty.toFixed(2))} ${m.unit}` : '0'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700', color: hasExtra ? '#dc2626' : '#64748b' }}>
                              {hasExtra ? `+${Number(m.reissueQty.toFixed(2))} ${m.unit}` : '0'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#059669' }}>
                              {m.returnedQty > 0 ? `-${Number(m.returnedQty.toFixed(2))} ${m.unit}` : '0'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '800', color: '#4338ca' }}>
                              {Number(m.totalIssuedQty.toFixed(2))} {m.unit}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: '700' }}>
                              {hasExtra ? (
                                <span style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '1px 6px', borderRadius: '8px', fontSize: '10px' }}>
                                  +{variancePercent}% Extra
                                </span>
                              ) : (
                                <span style={{ color: '#16a34a', backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '8px', fontSize: '10px' }}>
                                  Standard 1st Issue
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  fontSize: '11px',
                  borderTop: '1px solid #000000',
                  paddingTop: '16px',
                  marginTop: '10px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Issued By (Store Keeper)</div>
                    <div style={{ fontSize: '10px' }}>Store In-charge</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Received By (Cutting/Master)</div>
                    <div style={{ fontSize: '10px' }}>Cutting Line Head</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '30px' }}></div>
                    <div style={{ borderBottom: '1px solid #000000', width: '85%', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '4px', fontWeight: '700' }}>Audited / Authorized</div>
                    <div style={{ fontSize: '10px' }}>Production Head / Admin</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5% Extra Material Threshold Warning & Admin Approval Request Modal */}
      {extraApprovalModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10050,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '840px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid #fca5a5',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              backgroundColor: '#fef2f2',
              borderBottom: '2px solid #fecaca',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #fca5a5',
                  flexShrink: 0
                }}>
                  <ShieldAlert size={26} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Extra Issue Exceeds 1% Limit
                    <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Admin Approval Required
                    </span>
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#b91c1c', fontWeight: '500' }}>
                    Requisition exceeds the standard 1.0% threshold limit. Approval request will be sent to Admin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtraApprovalModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '26px',
                  fontWeight: '700',
                  lineHeight: 1,
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Policy Warning Callout */}
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <AlertTriangle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.55' }}>
                  <strong>1% Limit Exceeded:</strong> You are issuing extra material of <strong>+{Math.max(...extraApprovalModal.items.map(i => i.percentage))}%</strong>, which exceeds the allowable <strong>1% threshold limit</strong>. Direct material issue has been withheld. An <strong>Approval Request</strong> will be submitted to the <strong>Admin</strong>. Material will be issued and inventory deducted only after the <strong>Admin approves</strong> this request.
                </div>
              </div>

              {/* Lot & Requisition Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '12.5px'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Lot Number</span>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{extraApprovalModal.selectedDesign?.id || extraApprovalModal.lotNumber}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Total Lot Order</span>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{extraApprovalModal.pieces} Pcs</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Issuer (Store)</span>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{extraApprovalModal.personName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Receiver / Dept</span>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{extraApprovalModal.receiverName || 'N/A'} ({extraApprovalModal.receiverDept || 'Cutting'})</strong>
                </div>
              </div>

              {/* Components Exceeding 1% Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#1e293b' }}>
                    Component(s) Requiring Admin Approval ({extraApprovalModal.items.length})
                  </h4>
                  <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '800' }}>
                    Max Issue Excess: +{Math.max(...extraApprovalModal.items.map(i => i.percentage))}%
                  </span>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>BOM Component</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Inventory Material</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Base Req.</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#dc2626', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>Extra Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#dc2626' }}>Issue %</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>1% Limit Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#b91c1c' }}>Excess Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraApprovalModal.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < extraApprovalModal.items.length - 1 ? '1px solid #e2e8f0' : 'none', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '9px 10px', fontWeight: '700', color: '#0f172a' }}>{it.item.bomItemName}</td>
                          <td style={{ padding: '9px 10px', color: '#334155' }}>
                            {it.mat ? (it.mat.color && it.mat.color !== 'Default' ? `${it.mat.name} (${it.mat.color})` : it.mat.name) : it.item.bomItemName}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', color: '#64748b' }}>
                            {it.baseQty} {it.item.unit}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '800', color: '#dc2626', backgroundColor: 'rgba(254, 226, 226, 0.3)' }}>
                            +{it.extraQty} {it.item.unit}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '12px', fontWeight: '800', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <ShieldAlert size={11} /> +{it.percentage}%
                            </span>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                            {it.maxAllowedQty} {it.item.unit}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', color: '#b91c1c', fontWeight: '800' }}>
                            +{it.excessQty} {it.item.unit}
                          </td>
                          <td style={{ padding: '9px 10px', color: '#64748b', fontSize: '11.5px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.reason}>
                            {it.reason || 'Extra requisition'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={() => setExtraApprovalModal(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel / Adjust Quantity
              </button>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Routed to Admin Approval Queue
                </span>
                <button
                  type="button"
                  onClick={handleConfirmSubmitApproval}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  <ShieldAlert size={16} />
                  Submit for Admin Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Ask Material / Component Name to Add */}
      {showAddWoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10050,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28)',
            border: '2px solid #fdba74',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#fff7ed',
                  color: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #fdba74'
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                    Select / Enter Material Name
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Which component or material do you want to issue?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWoModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Quick 1-Click Preset Buttons */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                Quick Click Presets:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { label: '🏷️ Label', val: 'Label' },
                  { label: '🔖 Tag', val: 'Tag' },
                  { label: '🎗️ Tape', val: 'Tape' },
                  { label: '🧵 Elastic', val: 'Elastic' },
                  { label: '🤐 Zipper', val: 'Zipper' },
                  { label: '🔘 Button', val: 'Button' },
                  { label: '👖 Pocketing', val: 'Pocketing' },
                  { label: '🧵 Drawcord', val: 'Drawcord' },
                  { label: '📦 All / Generic', val: '' }
                ].map(chip => (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => confirmAddWoItem(chip.val)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: (addWoInputName.toLowerCase() === chip.val.toLowerCase() && chip.val !== '') ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                      background: (addWoInputName.toLowerCase() === chip.val.toLowerCase() && chip.val !== '') ? '#fff7ed' : '#f8fafc',
                      color: (addWoInputName.toLowerCase() === chip.val.toLowerCase() && chip.val !== '') ? '#c2410c' : '#1e293b',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Free Text Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                Or Custom Material Name:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Label, Tape, Tag, Bone, Thread..."
                  value={addWoInputName}
                  onChange={(e) => setAddWoInputName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmAddWoItem(addWoInputName);
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    height: '42px',
                    padding: '8px 14px',
                    fontSize: '14px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    border: '2px solid #ea580c',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => confirmAddWoItem(addWoInputName)}
                  style={{
                    padding: '0 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + Add Row
                </button>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                Tip: If you choose <strong>"Label"</strong>, the new row will automatically filter and show only <strong>Label</strong> materials in the dropdown!
              </div>
            </div>

            {/* Cancel Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAddWoModal(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Review & Confirm Extra Material Issue */}
      {confirmIssueModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10050,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid #c7d2fe',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              backgroundColor: '#eef2ff',
              borderBottom: '2px solid #c7d2fe',
              padding: '16px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                }}>
                  <Send size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Confirm Extra Material Issue
                    <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#6366f1', color: '#ffffff', padding: '2px 8px', borderRadius: '10px' }}>
                      {confirmIssueModal.items.length} {confirmIssueModal.items.length === 1 ? 'Component' : 'Components'}
                    </span>
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#4338ca', fontWeight: '500' }}>
                    Please review requisition details before confirming stock issue and generating voucher.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmIssueModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '24px',
                  fontWeight: '700',
                  lineHeight: 1,
                  padding: '4px'
                }}
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Lot & Requisition Info Box */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: '700' }}>Lot Number</span>
                  <strong style={{ color: '#4f46e5', fontSize: '13px' }}>
                    Lot {confirmIssueModal.selectedDesign?.id} {confirmIssueModal.selectedDesign?.lotNo2 ? `(${confirmIssueModal.selectedDesign.lotNo2})` : ''}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: '700' }}>Garment Volume</span>
                  <strong style={{ color: '#059669', fontSize: '13px' }}>
                    {confirmIssueModal.pieces.toLocaleString()} Pcs
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: '700' }}>Issuer Person</span>
                  <strong style={{ color: '#0f172a', fontSize: '12.5px' }}>{confirmIssueModal.personName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: '700' }}>Receiver / Dept</span>
                  <strong style={{ color: '#0f172a', fontSize: '12.5px' }}>
                    {confirmIssueModal.receiverName || '—'} ({confirmIssueModal.receiverDept || 'Cutting'})
                  </strong>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    Material Requisition Breakdown
                  </h4>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Ready for store dispatch
                  </span>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>BOM Component</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Assigned Inventory Material</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Available Stock</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#4f46e5', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>Extra Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Reason / Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmIssueModal.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < confirmIssueModal.items.length - 1 ? '1px solid #e2e8f0' : 'none', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>
                            {it.item.bomItemName}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#4f46e5', marginRight: '5px' }}>
                              [{it.mat.id}]
                            </span>
                            {it.mat.name} {it.mat.color && it.mat.color !== 'Default' ? `(${it.mat.color})` : ''}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#059669', fontWeight: '600' }}>
                            {it.mat.stock} {it.mat.unit || 'Pcs'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#4f46e5', backgroundColor: 'rgba(99, 102, 241, 0.06)' }}>
                            +{it.extraQty} {it.mat.unit || it.item.unit || 'Pcs'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '11.5px' }}>
                            {it.reason || 'Extra requisition'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compliance note */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '11.5px',
                color: '#166534'
              }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0, color: '#16a34a' }} />
                <span>
                  All items are within standard allowable limits (&le; 1.0%). On confirmation, inventory stock will be deducted immediately, saved to database, and an issue receipt voucher will be generated.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '12px 22px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={() => setConfirmIssueModal(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12.5px'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedIssue}
                style={{
                  padding: '8px 22px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                }}
              >
                <CheckCircle size={15} />
                Confirm &amp; Issue Material
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
