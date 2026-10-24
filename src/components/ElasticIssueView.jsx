import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, Search, Plus, Minus, Download, Printer, RefreshCw,
  CheckCircle, AlertTriangle, Layers, X,
  Calendar, User, Scissors, Sliders, Calculator, Zap, ArrowRight, Table,
  ShieldCheck, Lock, ExternalLink, Ruler, Edit2, MapPin, Tag, Box, Package, Scale,
  ChevronDown, ZoomIn, Check, Sparkles, Filter, CheckCircle2, Eye, Trash2, Clock, Scan
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import SmartSelectWithManual from './SmartSelectWithManual';
import { SearchableMaterialDropdown } from './WithoutBomMaterialIssueView';

// ── Accessory Unit Normalizer: Mtr, Roll, Pcs, Box, Pkt, Cone, Kg, etc. ──
export const normalizeAccUnit = (rawUnit) => {
  if (!rawUnit) return 'Roll';
  const s = String(rawUnit).trim();
  if (/^m(eter|tr)?s?$/i.test(s)) return 'Mtr';
  if (/^p(ie)?ce?s?$/i.test(s)) return 'Pcs';
  if (/^rolls?$/i.test(s)) return 'Roll';
  if (/^box(es)?$/i.test(s)) return 'Box';
  if (/^pkts?|packets?$/i.test(s)) return 'Pkt';
  if (/^cones?$/i.test(s)) return 'Cone';
  if (/^kg(s)?|kilograms?$/i.test(s)) return 'Kg';
  if (/^doz(en)?s?$/i.test(s)) return 'Dozen';
  if (/^gross$/i.test(s)) return 'Gross';
  return s;
};

// ── Clean Material Name Helper: strips bracketed MT/ST codes and extra whitespace ──
export const cleanMaterialName = (name) => {
  if (!name) return '';
  return String(name)
    .replace(/\s*\[MT[^\]]*\]/gi, '')
    .replace(/\s*\[ST[^\]]*\]/gi, '')
    .replace(/\s*\[\s*\]/g, '')
    .trim();
};

// ── Item Code Formatter: guarantees Item Code (ST...) is used, NEVER internal MT ID ──
export const formatItemCode = (val, matObj = null, materialsList = []) => {
  let code = '';
  if (matObj && (matObj.itemCode || matObj.stCode)) {
    code = String(matObj.itemCode || matObj.stCode).trim();
  } else if (val && typeof val === 'object' && (val.itemCode || val.stCode)) {
    code = String(val.itemCode || val.stCode).trim();
  } else if (val) {
    const list = Array.isArray(materialsList) ? materialsList : [];
    const match = list.find(m =>
      String(m.id).toLowerCase() === String(val).toLowerCase() ||
      String(m.itemCode || '').toLowerCase() === String(val).toLowerCase() ||
      String(m.stCode || '').toLowerCase() === String(val).toLowerCase()
    );
    if (match && (match.itemCode || match.stCode)) {
      code = String(match.itemCode || match.stCode).trim();
    } else {
      code = String(val).trim();
    }
  }

  if (!code) return '';

  // Clean out any MT prefix: MT1222 -> ST1222, MT0014 -> ST0014
  if (code.toUpperCase().startsWith('MT')) {
    code = 'ST' + code.substring(2);
  } else if (/^M\d+/i.test(code)) {
    code = 'ST' + code.replace(/^\D+/g, '').padStart(5, '0');
  }

  return code;
};

// ── Rich Searchable Material Selector with Photos, Live Search & Category Chips ──
function SearchableMaterialSelect({
  materials = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = "-- Select Material --",
  themeColor = '#7c3aed',
  componentHint = '',
  onPreviewPhoto = () => { },
  compact = false,
  showCategoryFilter = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 340, isAbove: false });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedMaterial = useMemo(() => {
    return (materials || []).find(m => String(m.id) === String(value));
  }, [materials, value]);

  // Extract unique categories for quick-filter tabs
  const categories = useMemo(() => {
    const counts = {};
    (materials || []).forEach(m => {
      const cat = (m.category || 'Accessory').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const uniqueCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [{ name: 'ALL', count: (materials || []).length }, ...uniqueCats.map(c => ({ name: c, count: counts[c] }))];
  }, [materials]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Position calculation for popover portal
  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isAbove = spaceBelow < 340 && rect.top > 340;
      const desiredWidth = Math.min(680, Math.max(rect.width, 520));
      setCoords({
        top: isAbove ? rect.top : rect.bottom + 6,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - desiredWidth - 14)),
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
      }, 60);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
      };
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filtered materials
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (materials || []).filter(m => {
      // 1. Category check
      if (selectedCategory !== 'ALL') {
        const cat = (m.category || '').toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }
      // 2. Query check
      if (!q) return true;
      const idStr = String(m.id || '').toLowerCase();
      const itemCodeStr = String(m.itemCode || '').toLowerCase();
      const nameStr = String(m.name || '').toLowerCase();
      const catStr = String(m.category || '').toLowerCase();
      const locStr = String(m.location || '').toLowerCase();
      const colorStr = String(m.color || '').toLowerCase();
      return idStr.includes(q) || itemCodeStr.includes(q) || nameStr.includes(q) || catStr.includes(q) || locStr.includes(q) || colorStr.includes(q);
    }).sort((a, b) => {
      const aHasImg = (a.imageUrl || a.image || a.photo || a.imgUrl) ? 1 : 0;
      const bHasImg = (b.imageUrl || b.image || b.photo || b.imgUrl) ? 1 : 0;
      const aStock = Number(a.stock) || 0;
      const bStock = Number(b.stock) || 0;
      if (aStock > 0 && bStock <= 0) return -1;
      if (bStock > 0 && aStock <= 0) return 1;
      if (bHasImg !== aHasImg) return bHasImg - aHasImg;
      return bStock - aStock;
    });
  }, [materials, searchQuery, selectedCategory]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Box */}
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
          width: '100%',
          minHeight: compact ? '36px' : '46px',
          padding: compact ? '4px 8px' : '6px 12px',
          borderRadius: '8px',
          border: `1.5px solid ${isOpen ? themeColor : '#cbd5e1'}`,
          background: disabled ? '#f8fafc' : '#ffffff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? `0 0 0 3px ${themeColor}22` : 'none',
          boxSizing: 'border-box',
          gap: '8px',
          transition: 'all 0.15s ease'
        }}
      >
        {selectedMaterial ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            {/* Selected Photo Thumbnail */}
            {(() => {
              const rawImg = selectedMaterial.imageUrl || selectedMaterial.image || selectedMaterial.photo || selectedMaterial.imgUrl;
              const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
              return (
                <div
                  onClick={(e) => {
                    if (cleanImg) {
                      e.stopPropagation();
                      onPreviewPhoto({
                        url: cleanImg,
                        title: selectedMaterial.name,
                        code: formatItemCode(selectedMaterial, null, materials),
                        stock: `${selectedMaterial.stock || 0} ${normalizeAccUnit(selectedMaterial.unit)}`,
                        location: selectedMaterial.location || 'Main Store'
                      });
                    }
                  }}
                  title={cleanImg ? "Click to view photo fullscreen" : "No photo available"}
                  style={{
                    width: compact ? '26px' : '34px',
                    height: compact ? '26px' : '34px',
                    borderRadius: '6px',
                    border: cleanImg ? `1.5px solid ${themeColor}` : '1px dashed #cbd5e1',
                    background: cleanImg ? '#ffffff' : '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    cursor: cleanImg ? 'zoom-in' : 'pointer',
                    position: 'relative'
                  }}
                >
                  {cleanImg ? (
                    <img src={cleanImg} alt={selectedMaterial.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Package size={compact ? 13 : 16} color="#94a3b8" />
                  )}
                </div>
              );
            })()}

            <span style={{
              fontFamily: 'monospace',
              fontWeight: '800',
              fontSize: '11px',
              color: themeColor,
              background: `${themeColor}15`,
              border: `1px solid ${themeColor}30`,
              padding: '2px 6px',
              borderRadius: '4px',
              flexShrink: 0
            }}>
              {formatItemCode(selectedMaterial, null, materials)}
            </span>

            <span style={{
              fontSize: compact ? '12px' : '13px',
              fontWeight: '800',
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {selectedMaterial.name}
            </span>

            {selectedMaterial.category && (
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#475569',
                background: '#f1f5f9',
                padding: '1px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.category}
              </span>
            )}

            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              color: (Number(selectedMaterial.stock) || 0) > 0 ? '#059669' : '#dc2626',
              background: (Number(selectedMaterial.stock) || 0) > 0 ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${(Number(selectedMaterial.stock) || 0) > 0 ? '#a7f3d0' : '#fecaca'}`,
              padding: '1px 6px',
              borderRadius: '4px',
              flexShrink: 0
            }}>
              Stock: {selectedMaterial.stock || 0} {normalizeAccUnit(selectedMaterial.unit)}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: compact ? '12px' : '13px' }}>
            <Search size={compact ? 13 : 15} color={themeColor} />
            <span style={{ fontWeight: '600' }}>{placeholder}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {selectedMaterial && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              title="Clear selection"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            color="#64748b"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Popover Dropdown Portal with Photos & Instant Search */}
      {isOpen && !disabled && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.isAbove
              ? { bottom: `${window.innerHeight - coords.top + 6}px` }
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 20px)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25), 0 4px 12px rgba(0, 0, 0, 0.08)',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            zIndex: 9999999,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.15s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: themeColor, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {componentHint ? `${componentHint.toUpperCase()} INVENTORY` : 'STORE INVENTORY ACCESSORIES'}
              </span>
              <span style={{ fontSize: '10px', background: `${themeColor}15`, color: themeColor, padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                {materials.length} Items
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none', background: 'transparent', color: '#94a3b8',
                cursor: 'pointer', padding: '2px', display: 'flex'
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search Input Box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by Item Code, Name, Category, Location, Color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '36px',
                padding: '4px 30px 4px 32px',
                fontSize: '12.5px',
                borderRadius: '8px',
                border: `1.5px solid ${themeColor}`,
                outline: 'none',
                background: '#faf5ff',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Filter Chips Bar */}
          {showCategoryFilter && categories.length > 2 && (
            <div style={{
              display: 'flex',
              gap: '4px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'thin'
            }}>
              {categories.map(cat => {
                const isCatActive = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      border: isCatActive ? `1.5px solid ${themeColor}` : '1px solid #e2e8f0',
                      background: isCatActive ? themeColor : '#f8fafc',
                      color: isCatActive ? '#ffffff' : '#475569',
                      fontSize: '10.5px',
                      fontWeight: isCatActive ? '800' : '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{cat.name}</span>
                    <span style={{
                      fontSize: '9px',
                      opacity: 0.85,
                      background: isCatActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      padding: '0 4px',
                      borderRadius: '8px'
                    }}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Items Scrollable List with Photo Gallery */}
          <div style={{
            maxHeight: '340px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            paddingRight: '2px'
          }}>
            {/* Clear option */}
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              style={{
                padding: '6px 10px',
                fontSize: '11.5px',
                cursor: 'pointer',
                borderRadius: '6px',
                color: '#64748b',
                fontStyle: 'italic',
                backgroundColor: value === '' ? `${themeColor}12` : '#f8fafc'
              }}
            >
              -- Clear / Select Material --
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '24px 10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                <Package size={24} style={{ display: 'block', margin: '0 auto 6px auto', opacity: 0.6 }} />
                No materials found matching "{searchQuery}"
              </div>
            ) : (
              filtered.map(m => {
                const isSelected = String(m.id) === String(value);
                const rawImg = m.imageUrl || m.image || m.photo || m.imgUrl;
                const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                const inStock = (Number(m.stock) || 0) > 0;

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? `${themeColor}12` : '#ffffff',
                      border: isSelected ? `1.5px solid ${themeColor}` : '1px solid #f1f5f9',
                      borderLeft: isSelected ? `4px solid ${themeColor}` : '1px solid #f1f5f9',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = `${themeColor}0a`;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    {/* Material Photo Thumbnail with Zoom Option */}
                    <div
                      onClick={(e) => {
                        if (cleanImg) {
                          e.stopPropagation();
                          onPreviewPhoto({
                            url: cleanImg,
                            title: m.name,
                            code: formatItemCode(m, null, materials),
                            stock: `${m.stock || 0} ${m.unit || 'Roll'}`,
                            location: m.location || 'Main Store'
                          });
                        }
                      }}
                      title={cleanImg ? "Click to view photo fullscreen" : "No photo available"}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '7px',
                        border: cleanImg ? `1.5px solid ${themeColor}` : '1px dashed #cbd5e1',
                        background: cleanImg ? '#ffffff' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: cleanImg ? 'zoom-in' : 'pointer',
                        boxShadow: cleanImg ? '0 2px 5px rgba(0,0,0,0.08)' : 'none'
                      }}
                    >
                      {cleanImg ? (
                        <>
                          <img
                            src={cleanImg}
                            alt={m.name}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.3)',
                              opacity: 0,
                              transition: 'opacity 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                          >
                            <ZoomIn size={14} />
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
                          <Package size={17} />
                          <span style={{ fontSize: '7px', fontWeight: '700', textTransform: 'uppercase' }}>No Photo</span>
                        </div>
                      )}
                    </div>

                    {/* Material Information */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          fontWeight: '800',
                          color: themeColor,
                          background: `${themeColor}15`,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: `1px solid ${themeColor}30`
                        }}>
                          {formatItemCode(m, null, materials)}
                        </span>
                        <span style={{
                          fontSize: '12.5px',
                          fontWeight: '800',
                          color: isSelected ? themeColor : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '300px'
                        }}>
                          {m.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                        {m.category && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            color: '#475569',
                            background: '#f1f5f9',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            {m.category}
                          </span>
                        )}
                        {m.color && m.color !== 'Default' && (
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            • {m.color}
                          </span>
                        )}
                        {m.location && (
                          <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <MapPin size={9} color={themeColor} /> {m.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock badge & Selected indicator */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: inStock ? '#059669' : '#dc2626',
                        background: inStock ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${inStock ? '#a7f3d0' : '#fecaca'}`,
                        padding: '2px 7px',
                        borderRadius: '5px',
                        display: 'inline-block'
                      }}>
                        {m.stock || 0} {normalizeAccUnit(m.unit)}
                      </span>
                      {isSelected && (
                        <div style={{ fontSize: '10px', fontWeight: '800', color: themeColor, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                          <Check size={11} /> Selected
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ElasticIssueView({
  materials: initialMaterialsProp = [],
  onUpdateMaterial,
  syncMaterialsToDb,
  currencySymbol = '₹',
  currentUser = null,
  prefilledLotNo = '',
  setPrefilledLotNo = () => { },
  onNavigate = () => { }
}) {
  // Tab Mode: 'generator' (Issue Form) or 'history' (Past Issue Slips)
  const [viewMode, setViewMode] = useState('generator');

  // Step 1: Search Lot State
  const [searchLotInput, setSearchLotInput] = useState(prefilledLotNo || '');
  const [searchingLot, setSearchingLot] = useState(false);
  const [lotDetails, setLotDetails] = useState(null);
  const [lotError, setLotError] = useState('');
  const [recentLots, setRecentLots] = useState([]);

  // ── Cutting Details Cache & 30-Minute Auto-Reload ───────────────────────────
  const CUTTING_CACHE_MAX_ENTRIES = 100;
  const CUTTING_CACHE_RELOAD_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const [cuttingHeaders, setCuttingHeaders] = useState([]);
  const [lastCuttingCacheReload, setLastCuttingCacheReload] = useState(() => new Date());
  const [isReloadingCuttingCache, setIsReloadingCuttingCache] = useState(false);
  const [cuttingCacheRefreshCount, setCuttingCacheRefreshCount] = useState(0);
  const [cacheReloadNotice, setCacheReloadNotice] = useState('');
  const matrixCacheRef = useRef({});

  // ── Active Lot Cutting Details State & Matrix ──
  const [activeLotCutting, setActiveLotCutting] = useState(null);
  const [loadingActiveLotCutting, setLoadingActiveLotCutting] = useState(false);
  const [showActiveCuttingMatrix, setShowActiveCuttingMatrix] = useState(false);

  // Reload cache function: empties in-memory matrix cache and reloads cutting headers from MySQL
  const reloadCuttingCache = useCallback(async (manual = false) => {
    setIsReloadingCuttingCache(true);
    matrixCacheRef.current = {};
    try {
      const res = await fetch(`${getBackendUrl()}/api/cutting-headers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCuttingHeaders(data);
        }
      }
      setLastCuttingCacheReload(new Date());
      setCuttingCacheRefreshCount(c => c + 1);
      if (manual) {
        setCacheReloadNotice('✓ Cache emptied & reloaded');
        setTimeout(() => setCacheReloadNotice(''), 3500);
      }
    } catch (err) {
      console.warn('Failed to reload cutting headers cache:', err);
    } finally {
      setIsReloadingCuttingCache(false);
    }
  }, []);

  // Auto-reload every 30 minutes and on initial mount
  useEffect(() => {
    reloadCuttingCache(false);
    const intervalId = setInterval(() => {
      reloadCuttingCache(false);
    }, CUTTING_CACHE_RELOAD_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [reloadCuttingCache]);

  // Dynamically extract all distinct size columns present in cutting matrix rows
  const activeSizes = useMemo(() => {
    if (!activeLotCutting || !activeLotCutting.rows || activeLotCutting.rows.length === 0) return [];
    const sizeSet = new Set();
    activeLotCutting.rows.forEach(r => {
      if (r.sizes && typeof r.sizes === 'object') {
        Object.keys(r.sizes).forEach(sz => {
          if (Number(r.sizes[sz]) > 0) sizeSet.add(sz);
        });
      }
    });
    const standardOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', 'FREE', 'FS'];
    return Array.from(sizeSet).sort((a, b) => {
      const idxA = standardOrder.indexOf(a.toUpperCase());
      const idxB = standardOrder.indexOf(b.toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [activeLotCutting]);



  // BOM & Design Verification States
  const [designs, setDesigns] = useState([]);
  const [bomStatus, setBomStatus] = useState('idle'); // 'idle' | 'approved' | 'pending' | 'not_created' | 'rejected'
  const [bomDesign, setBomDesign] = useState(null);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // Step 1.5: Automatic Size to Meter Backend Calculation State & Switch Mode
  const [issuePcs, setIssuePcs] = useState('');
  const [materialMode, setMaterialMode] = useState('elastic'); // 'elastic' | 'tape' | 'bone' | 'other' | 'both' | 'all'
  const [otherMaterialName, setOtherMaterialName] = useState('Drawcord / Other Accessory');
  const [otherRollCount, setOtherRollCount] = useState(1);
  const [otherUnit, setOtherUnit] = useState('Roll');
  const [isManualOtherUnit, setIsManualOtherUnit] = useState(false);
  const [manualUnitInput, setManualUnitInput] = useState('');
  const [isWithoutLot, setIsWithoutLot] = useState(false); // Without Lot / Direct Floor Issue Mode
  const [isWithoutPo, setIsWithoutPo] = useState(false); // W/O PO (Direct Floor Issue) Mode
  const withoutLotActive = isWithoutLot || isWithoutPo;
  const [boneRollCount, setBoneRollCount] = useState(1);
  const [boneWeightKg, setBoneWeightKg] = useState('2.50');
  const [boneWidth, setBoneWidth] = useState('1.5 Inch (Standard)');
  const [customBoneWidth, setCustomBoneWidth] = useState('');
  const [boneEntryMode, setBoneEntryMode] = useState('choose'); // 'choose' | 'manual'
  const [withoutLotStyle, setWithoutLotStyle] = useState('Lower / Tracksuit');
  const [elasticSizeInput, setElasticSizeInput] = useState('50');
  const [elasticUnit, setElasticUnit] = useState('inch'); // 'inch' or 'cm'
  const [tapeSizeInput, setTapeSizeInput] = useState('62');
  const [tapeUnit, setTapeUnit] = useState('cm'); // 'inch' or 'cm'
  const [calcResult, setCalcResult] = useState({
    elasticPerPcMtr: 1.27,
    tapePerPcMtr: 0.62,
    totalElasticMtr: 0,
    totalTapeMtr: 0,
    recommendedRolls: 0,
    elasticFormula: '50 Inch × 0.0254 = 1.27 m',
    tapeFormula: '62 CM / 100 = 0.62 m',
    formulaExplanation: '50 Inch × 0.0254 = 1.27 m | 62 CM / 100 = 0.62 m'
  });
  const [calculating, setCalculating] = useState(false);

  // Step 2: Elastic, Tape & Bone Issue Details
  const [rollCount, setRollCount] = useState(0);
  const [tapeRollCount, setTapeRollCount] = useState(0);
  const [elasticWidth, setElasticWidth] = useState('1 Inch (Standard)');
  const [customWidth, setCustomWidth] = useState('');
  const [tapeWidth, setTapeWidth] = useState('0.5 Inch (Standard)');
  const [customTapeWidth, setCustomTapeWidth] = useState('');
  const [selectedShade, setSelectedShade] = useState('');
  const [customDivisor, setCustomDivisor] = useState('');
  const [tapeDivisor, setTapeDivisor] = useState('');

  const effectiveWidth = elasticWidth === 'Custom' ? (customWidth || '1 Inch') : elasticWidth;
  const effectiveTapeWidth = tapeWidth === 'Custom' ? (customTapeWidth || '0.5 Inch') : tapeWidth;
  const effectiveBoneWidth = boneWidth === 'Custom' ? (customBoneWidth || '1.5 Inch') : boneWidth;
  const defaultElasticDivisor = (String(effectiveWidth).includes('1.5') || String(effectiveWidth).includes('2')) ? 23 : 25;
  const effectiveDivisor = (customDivisor !== '' && !isNaN(parseFloat(customDivisor)) && parseFloat(customDivisor) > 0)
    ? parseFloat(customDivisor)
    : defaultElasticDivisor;
  const effectiveTapeDivisor = (tapeDivisor !== '' && !isNaN(parseFloat(tapeDivisor)) && parseFloat(tapeDivisor) > 1)
    ? parseFloat(tapeDivisor)
    : 45;

  // Issuer, Receiver & Supervisor
  const [issuerName, setIssuerName] = useState(currentUser?.name || 'paras');
  const [receiverName, setReceiverName] = useState('');
  const [supervisorName, setSupervisorName] = useState('ROHIT / MONU');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [issueSlipNo, setIssueSlipNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Generation & Modal State
  const [generating, setGenerating] = useState(false);
  const [generatedSlipData, setGeneratedSlipData] = useState(null);
  const [toast, setToast] = useState(null);

  // History State
  const [issueHistory, setIssueHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState(''); // 'YYYY-MM-DD' or '' for all dates
  const [historyLineFilter, setHistoryLineFilter] = useState('all'); // 'all' | 'elastic_wo' | 'tape_wo' | 'bone_wo' | 'other_wo' | 'standard'
  const [historySortMode, setHistorySortMode] = useState('seq_asc'); // 'seq_asc' | 'seq_desc' | 'date_desc'
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null); // { url, title, code, stock, location }

  // Helper to extract sequence metadata from slip number
  const getSlipMeta = (slipNo) => {
    const s = String(slipNo || '').trim().toLowerCase();
    if (s.startsWith('elastic-w/o-')) {
      const num = parseInt(s.replace('elastic-w/o-', ''), 10);
      return { line: 'elastic_wo', label: 'Elastic W/O', seq: isNaN(num) ? 0 : num, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', badgeText: 'ELASTIC W/O' };
    }
    if (s.startsWith('tape-w/o-')) {
      const num = parseInt(s.replace('tape-w/o-', ''), 10);
      return { line: 'tape_wo', label: 'Tape W/O', seq: isNaN(num) ? 0 : num, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', badgeText: 'TAPE W/O' };
    }
    if (s.startsWith('bone-w/o-')) {
      const num = parseInt(s.replace('bone-w/o-', ''), 10);
      return { line: 'bone_wo', label: 'Bone W/O', seq: isNaN(num) ? 0 : num, color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', badgeText: 'BONE W/O' };
    }
    if (s.startsWith('other-w/o-')) {
      const num = parseInt(s.replace('other-w/o-', ''), 10);
      return { line: 'other_wo', label: 'Other Acc W/O', seq: isNaN(num) ? 0 : num, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', badgeText: 'OTHER W/O' };
    }
    const numMatch = s.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 0;
    return { line: 'standard', label: 'With LOT', seq: num, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', badgeText: 'WITH LOT' };
  };

  // Counts of each line in history (dynamically updates when date filter is chosen)
  const historyLineCounts = useMemo(() => {
    const counts = { all: 0, elastic_wo: 0, tape_wo: 0, bone_wo: 0, other_wo: 0, standard: 0 };
    (issueHistory || []).forEach(h => {
      if (historyDateFilter) {
        const itemDateStr = String(h.date || h.issueDate || '').slice(0, 10);
        if (itemDateStr !== historyDateFilter) return;
      }
      counts.all++;
      const meta = getSlipMeta(h.slipNo);
      if (counts[meta.line] !== undefined) {
        counts[meta.line]++;
      }
    });
    return counts;
  }, [issueHistory, historyDateFilter]);

  // Line-wise, date-filtered and sequence-sorted history list
  const processedHistory = useMemo(() => {
    let list = (issueHistory || []).filter(h => {
      const meta = getSlipMeta(h.slipNo);
      if (historyLineFilter !== 'all' && meta.line !== historyLineFilter) return false;
      if (historyDateFilter) {
        const itemDateStr = String(h.date || h.issueDate || '').slice(0, 10);
        if (itemDateStr !== historyDateFilter) return false;
      }
      if (!historySearch) return true;
      const q = historySearch.toLowerCase();
      return String(h.slipNo || '').toLowerCase().includes(q) ||
        String(h.lotNo || '').toLowerCase().includes(q) ||
        String(h.receiverName || '').toLowerCase().includes(q) ||
        String(h.issuerName || '').toLowerCase().includes(q) ||
        String(h.otherMaterialName || '').toLowerCase().includes(q) ||
        String(h.date || '').toLowerCase().includes(q) ||
        String(h.style || '').toLowerCase().includes(q);
    });

    return [...list].sort((a, b) => {
      const metaA = getSlipMeta(a.slipNo);
      const metaB = getSlipMeta(b.slipNo);

      if (historySortMode === 'seq_asc') {
        if (historyLineFilter === 'all') {
          const priority = { elastic_wo: 1, tape_wo: 2, bone_wo: 3, other_wo: 4, standard: 5 };
          const pA = priority[metaA.line] || 99;
          const pB = priority[metaB.line] || 99;
          if (pA !== pB) return pA - pB;
        }
        return (metaA.seq - metaB.seq) || String(a.slipNo).localeCompare(String(b.slipNo), undefined, { numeric: true });
      }

      if (historySortMode === 'seq_desc') {
        if (historyLineFilter === 'all') {
          const priority = { elastic_wo: 1, tape_wo: 2, bone_wo: 3, other_wo: 4, standard: 5 };
          const pA = priority[metaA.line] || 99;
          const pB = priority[metaB.line] || 99;
          if (pA !== pB) return pA - pB;
        }
        return (metaB.seq - metaA.seq) || String(b.slipNo).localeCompare(String(a.slipNo), undefined, { numeric: true });
      }

      if (historySortMode === 'date_asc') {
        const dateA = new Date(a.date || a.issueDate || 0).getTime();
        const dateB = new Date(b.date || b.issueDate || 0).getTime();
        return dateA - dateB;
      }

      // Date desc (newest first)
      const dateA = new Date(a.date || a.issueDate || 0).getTime();
      const dateB = new Date(b.date || b.issueDate || 0).getTime();
      return dateB - dateA;
    });
  }, [issueHistory, historyLineFilter, historyDateFilter, historySortMode, historySearch]);

  const searchInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Materials list & mapped items (Elastic, Tape, Bone, Other Accessories)
  const [materials, setMaterials] = useState(Array.isArray(initialMaterialsProp) && initialMaterialsProp.length > 0 ? initialMaterialsProp : []);

  useEffect(() => {
    if (Array.isArray(initialMaterialsProp) && initialMaterialsProp.length > 0) {
      setMaterials(initialMaterialsProp);
    }
  }, [initialMaterialsProp]);
  const [elasticMaterialName, setElasticMaterialName] = useState('Elastic');
  const [selectedElasticMaterialId, setSelectedElasticMaterialId] = useState('');
  const [tapeMaterialName, setTapeMaterialName] = useState('Tape');
  const [selectedTapeMaterialId, setSelectedTapeMaterialId] = useState('');
  const [boneMaterialName, setBoneMaterialName] = useState('Bone Chinese (Beige)');
  const [selectedBoneMaterialId, setSelectedBoneMaterialId] = useState('ST00346');
  const [selectedOtherMaterialId, setSelectedOtherMaterialId] = useState('');
  const [otherEntryMode, setOtherEntryMode] = useState('choose'); // 'choose' | 'manual'
  const [selectedOtherCategory, setSelectedOtherCategory] = useState('ALL'); // 'ALL' | 'DORI' | 'ELASTIC' | 'ZIP' | 'LABEL' | 'BUTTON' | ...

  // Base default accessory component categories (Standard types: 1. DORI, 2. ELASTIC, 3. ZIP, 4. LABEL, 5. BUTTON, etc.)
  const BASE_OTHER_COMPONENT_TYPES = useMemo(() => [
    'DORI',
    'ELASTIC',
    'ZIP',
    'LABEL',
    'BUTTON',
    'TAPE',
    'LACE',
    'BADGE',
    'EYELET'
  ], []);

  // Custom accessory component types persisted in localStorage
  const [customOtherComponentTypes, setCustomOtherComponentTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('elastic_custom_component_types') || localStorage.getItem('without_bom_custom_component_types');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim().toUpperCase()).filter(Boolean);
      }
    } catch (e) {
      console.error('Failed to load custom component types', e);
    }
    return [];
  });

  const [showManageOtherTypesModal, setShowManageOtherTypesModal] = useState(false);
  const [newOtherTypeNameInput, setNewOtherTypeNameInput] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [inlineCustomCategoryInput, setInlineCustomCategoryInput] = useState('');

  // Persist custom types whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('elastic_custom_component_types', JSON.stringify(customOtherComponentTypes));
      localStorage.setItem('without_bom_custom_component_types', JSON.stringify(customOtherComponentTypes));
    } catch (e) { }
  }, [customOtherComponentTypes]);

  // Helper to add custom component type
  const addCustomOtherComponentType = (rawName) => {
    if (!rawName) return '';
    const clean = String(rawName).trim().toUpperCase();
    if (!clean || clean === '__CUSTOM__' || clean === '__MANAGE__' || clean === 'ALL') return '';

    const existsInBase = BASE_OTHER_COMPONENT_TYPES.some(t => t.toUpperCase() === clean);
    const existsInCustom = customOtherComponentTypes.some(t => t.toUpperCase() === clean);

    if (!existsInBase && !existsInCustom) {
      setCustomOtherComponentTypes(prev => {
        const updated = [...prev, clean];
        try {
          localStorage.setItem('elastic_custom_component_types', JSON.stringify(updated));
          localStorage.setItem('without_bom_custom_component_types', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });
    }
    return clean;
  };

  // Helper to remove custom component type
  const removeCustomOtherComponentType = (typeToRemove) => {
    setCustomOtherComponentTypes(prev => {
      const updated = prev.filter(t => t.toUpperCase() !== String(typeToRemove).toUpperCase());
      try {
        localStorage.setItem('elastic_custom_component_types', JSON.stringify(updated));
        localStorage.setItem('without_bom_custom_component_types', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  // Unified list of all component types (1. DORI, 2. ELASTIC, 3. ZIP, 4. LABEL, 5. BUTTON, ...)
  const allOtherComponentTypes = useMemo(() => {
    const list = [...BASE_OTHER_COMPONENT_TYPES];
    customOtherComponentTypes.forEach(t => {
      const clean = String(t).trim().toUpperCase();
      if (clean && !list.includes(clean)) {
        list.push(clean);
      }
    });
    return list;
  }, [BASE_OTHER_COMPONENT_TYPES, customOtherComponentTypes]);

  // Dropdown options matching Image 2
  const otherComponentTypeOptions = useMemo(() => {
    const opts = allOtherComponentTypes.map((type, idx) => ({
      value: type,
      label: `${idx + 1}. ${type}`
    }));
    opts.push({ value: '__custom__', label: '✏️ + Add Manually (Custom Type)' });
    if (customOtherComponentTypes.length > 0) {
      opts.push({ value: '__manage__', label: `⚙️ Manage Types (${customOtherComponentTypes.length})...` });
    }
    return opts;
  }, [allOtherComponentTypes, customOtherComponentTypes]);

  // ── Multi-Row Other Accessories Allocation State ──
  const [otherItems, setOtherItems] = useState([
    {
      id: 1,
      componentType: 'DORI',
      customComponentType: '',
      isCustomType: false,
      entryMode: 'choose', // 'choose' | 'manual'
      materialId: '',
      materialName: '',
      itemCode: '',
      color: '',
      unit: 'Mtr',
      availableStock: 0,
      location: '',
      calcMode: 'direct',
      totalQty: 1
    }
  ]);
  const [otherBarcodeInput, setOtherBarcodeInput] = useState('');
  const otherBarcodeInputRef = useRef(null);

  // Commit custom component type entered directly in row input
  const commitOtherCustomType = (rowId, rawVal) => {
    const clean = String(rawVal || '').trim().toUpperCase();
    if (!clean) {
      setOtherItems(prev => prev.map(item => {
        if (item.id !== rowId) return item;
        return {
          ...item,
          isCustomType: false,
          customComponentType: '',
          componentType: item.componentType && item.componentType !== '__custom__' ? item.componentType : (allOtherComponentTypes[0] || 'DORI')
        };
      }));
      return;
    }
    addCustomOtherComponentType(clean);
    setOtherItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return {
        ...item,
        isCustomType: false,
        customComponentType: clean,
        componentType: clean,
        unit: (clean === 'DORI' || clean === 'ELASTIC' || clean === 'TAPE' || clean === 'LACE') ? (item.unit || 'Mtr') : (item.unit || 'Pcs')
      };
    }));
  };

  // Add Item Row
  const handleAddOtherItemRow = (compType = 'DORI', defaultMatId = '', entryMode = 'choose') => {
    const mat = defaultMatId ? (materials || []).find(m => String(m.id) === String(defaultMatId)) : null;
    let defUnit = (compType === 'DORI' || compType === 'ELASTIC' || compType === 'TAPE' || compType === 'LACE') ? 'Mtr' : 'Pcs';
    setOtherItems(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        componentType: compType,
        customComponentType: '',
        isCustomType: false,
        entryMode: entryMode,
        materialId: mat ? mat.id : '',
        materialName: mat ? mat.name : (entryMode === 'manual' ? `${compType} Item` : ''),
        itemCode: mat ? (formatItemCode(mat, null, materials) || mat.itemCode || '') : '',
        imageUrl: mat ? (mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '') : '',
        color: mat ? (mat.color || mat.shade || '') : '',
        unit: mat ? (mat.unit || defUnit) : defUnit,
        availableStock: mat ? (Number(mat.stock) || 0) : 0,
        location: mat ? (mat.location || 'Main Store') : (entryMode === 'manual' ? 'Custom Entry' : ''),
        calcMode: 'direct',
        totalQty: 1
      }
    ]);
  };

  // Remove Item Row (preserves at least one clean row)
  const handleRemoveOtherItemRow = (rowId) => {
    if (otherItems.length <= 1) {
      setOtherItems([{
        id: Date.now(),
        componentType: allOtherComponentTypes[0] || 'DORI',
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
        totalQty: 1
      }]);
      return;
    }
    setOtherItems(prev => prev.filter(item => item.id !== rowId));
  };

  // Update Item Row Field
  const handleUpdateOtherItem = (rowId, field, value) => {
    setOtherItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return { ...item, [field]: value };
    }));
  };

  // Handle Material Selection for Row
  const handleSelectOtherRowMaterial = (rowId, materialId) => {
    const mat = (materials || []).find(m => String(m.id) === String(materialId));
    setOtherItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      if (!mat) {
        return {
          ...item,
          materialId: '',
          materialName: '',
          itemCode: '',
          imageUrl: '',
          color: '',
          unit: 'Mtr',
          availableStock: 0,
          location: ''
        };
      }
      const rackStock = Number(mat.stock) || 0;
      return {
        ...item,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: formatItemCode(mat, null, materials) || mat.itemCode || '',
        imageUrl: mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '',
        color: mat.color || mat.shade || '',
        unit: mat.unit || 'Mtr',
        availableStock: rackStock,
        totalQty: item.totalQty > 0 ? item.totalQty : 1,
        location: mat.location || 'Main Store'
      };
    }));
  };

  // Barcode / Fast Code Search Scanner
  const handleOtherBarcodeSubmit = (e) => {
    if (e) e.preventDefault();
    const query = String(otherBarcodeInput || '').trim().toLowerCase();
    if (!query) return;
    const match = (materials || []).find(m =>
      String(m.id || '').toLowerCase() === query ||
      String(m.itemCode || '').toLowerCase() === query ||
      String(m.stCode || '').toLowerCase() === query ||
      String(m.barcode || '').toLowerCase() === query ||
      String(m.name || '').toLowerCase().includes(query)
    );
    if (!match) {
      showToast(`No material found matching: "${otherBarcodeInput}"`, 'error');
      return;
    }
    const emptyRow = otherItems.find(r => !r.materialId && r.entryMode !== 'manual');
    if (emptyRow) {
      handleSelectOtherRowMaterial(emptyRow.id, match.id);
    } else {
      handleAddOtherItemRow(match.category ? match.category.toUpperCase() : 'DORI', match.id, 'choose');
    }
    setOtherBarcodeInput('');
    showToast(`Added ${match.name} (${formatItemCode(match, null, materials)})`, 'success');
  };

  // Synchronize first item with legacy state
  useEffect(() => {
    if (materialMode === 'other' && otherItems.length > 0) {
      const first = otherItems[0];
      setOtherMaterialName(first.materialName || first.componentType || 'Other Accessory');
      setOtherRollCount(otherItems.reduce((sum, it) => sum + (Number(it.totalQty) || 0), 0) || 1);
      setOtherUnit(first.unit || 'Mtr');
      setSelectedOtherMaterialId(first.materialId || '');
    }
  }, [otherItems, materialMode]);

  // Helper to get normalized select dropdown value
  const getSelectedCategoryValue = () => {
    if (!selectedOtherCategory || selectedOtherCategory === 'ALL') return 'ALL';
    const upper = selectedOtherCategory.toUpperCase();
    if (upper === 'DRAWCORD' || upper === 'DORI') return 'DORI';
    if (upper === 'ZIPPER' || upper === 'ZIP') return 'ZIP';
    const found = allOtherComponentTypes.find(t => t.toUpperCase() === upper);
    return found || upper;
  };

  // Dropdown selection change handler
  const handleCategorySelectChange = (val) => {
    if (val === '__custom__') {
      setIsAddingCustomCategory(true);
      setInlineCustomCategoryInput('');
    } else if (val === '__manage__') {
      setShowManageOtherTypesModal(true);
    } else if (val === 'ALL') {
      handleSelectComponentCategory('ALL');
    } else {
      let unit = 'Pcs';
      const u = val.toUpperCase();
      if (u === 'DORI' || u === 'DRAWCORD' || u === 'ELASTIC' || u === 'TAPE' || u === 'LACE') {
        unit = 'Mtr';
      }
      handleSelectComponentCategory(val, unit);
    }
  };

  // Commit inline custom category
  const commitInlineCustomCategory = (rawVal) => {
    const clean = String(rawVal || '').trim().toUpperCase();
    if (!clean) {
      setIsAddingCustomCategory(false);
      setInlineCustomCategoryInput('');
      return;
    }
    addCustomOtherComponentType(clean);
    handleSelectComponentCategory(clean, 'Pcs');
    setIsAddingCustomCategory(false);
    setInlineCustomCategoryInput('');
    showToast(`Added custom category "${clean}"!`);
  };

  const [customOtherNames, setCustomOtherNames] = useState(() => {
    try {
      const s = localStorage.getItem('gpdms_custom_other_names');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  // Fetch materials to support mapping & inventory display
  const fetchMaterials = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/materials`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMaterials(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch materials in ElasticIssueView:', e);
    }
  };

  // Filter materials to only show Elastic category
  const elasticMaterials = useMemo(() => {
    return (materials || []).filter(m =>
      (m.category || '').toLowerCase().includes('elastic') ||
      (m.name || '').toLowerCase().includes('elastic')
    );
  }, [materials]);

  // Filter materials to show Tape category
  const tapeMaterials = useMemo(() => {
    return (materials || []).filter(m =>
      (m.category || '').toLowerCase().includes('tape') ||
      (m.name || '').toLowerCase().includes('tape')
    );
  }, [materials]);

  // Filter materials to show Bone category
  const boneMaterials = useMemo(() => {
    const matched = (materials || []).filter(m => {
      const c = (m.category || '').toLowerCase();
      const n = (m.name || '').toLowerCase();
      return c.includes('bone') || n.includes('bone') || c.includes('pocketing') || n.includes('pocketing') || c.includes('piping') || n.includes('piping');
    });
    return matched.length > 0 ? matched : (materials || []);
  }, [materials]);

  // Active Selected Material Objects from Inventory
  const currentElasticMaterial = useMemo(() => {
    return (elasticMaterials || []).find(m => String(m.id) === String(selectedElasticMaterialId)) || null;
  }, [elasticMaterials, selectedElasticMaterialId]);

  const currentTapeMaterial = useMemo(() => {
    return (tapeMaterials || []).find(m => String(m.id) === String(selectedTapeMaterialId)) || null;
  }, [tapeMaterials, selectedTapeMaterialId]);

  const currentBoneMaterial = useMemo(() => {
    return (boneMaterials || []).find(m => String(m.id) === String(selectedBoneMaterialId)) || null;
  }, [boneMaterials, selectedBoneMaterialId]);

  // Filter materials to show Other Accessories (Trims & Accessories from store inventory)
  const otherMaterials = useMemo(() => {
    if (!materials || materials.length === 0) return [];
    if (!selectedOtherCategory || selectedOtherCategory === 'ALL') return materials;
    const filterKey = selectedOtherCategory.toLowerCase().trim();
    return materials.filter(m => {
      const name = (m.name || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const subCat = (m.subCategory || '').toLowerCase();
      const itemCode = (m.itemCode || '').toLowerCase();
      if (filterKey === 'tape') {
        return name.includes('tape') || cat.includes('tape') || name.includes('ribbon') || cat.includes('ribbon') || name.includes('niwar');
      }
      if (filterKey === 'button') {
        return name.includes('button') || cat.includes('button') || name.includes('snap') || cat.includes('snap') || name.includes('kaj');
      }
      if (filterKey === 'lace') {
        return name.includes('lace') || cat.includes('lace') || name.includes('gota') || cat.includes('gota') || name.includes('crochet');
      }
      if (filterKey === 'drawcord' || filterKey === 'dori') {
        return name.includes('dori') || cat.includes('dori') || name.includes('cord') || cat.includes('cord') || name.includes('rope');
      }
      if (filterKey === 'zipper' || filterKey === 'zip') {
        return name.includes('zip') || cat.includes('zip') || name.includes('chain') || cat.includes('runner');
      }
      if (filterKey === 'label') {
        return name.includes('label') || cat.includes('label') || name.includes('tag') || cat.includes('tag');
      }
      if (filterKey === 'badge') {
        return name.includes('patch') || cat.includes('patch') || name.includes('badge') || cat.includes('badge') || name.includes('matel patch');
      }
      if (filterKey === 'eyelet') {
        return name.includes('eyelet') || cat.includes('eyelet') || name.includes('grommet') || name.includes('ring');
      }
      if (filterKey === 'elastic') {
        return name.includes('elastic') || cat.includes('elastic') || name.includes('waistband');
      }
      return name.includes(filterKey) || cat.includes(filterKey) || subCat.includes(filterKey) || itemCode.includes(filterKey);
    });
  }, [materials, selectedOtherCategory]);

  const currentOtherMaterial = useMemo(() => {
    return (materials || []).find(m => String(m.id) === String(selectedOtherMaterialId)) || null;
  }, [materials, selectedOtherMaterialId]);

  // Handler for selecting an Other Accessory item from store inventory
  const handleSelectOtherMaterial = (id) => {
    setSelectedOtherMaterialId(id);
    const mat = (materials || []).find(m => String(m.id) === String(id));
    if (mat) {
      setOtherMaterialName(mat.name);
      if (mat.unit) {
        const detectedUnit = normalizeAccUnit(mat.unit);
        setOtherUnit(detectedUnit);
        setIsManualOtherUnit(false);
      }
    }
  };

  // Quick Component Category Picker (Tape, Button, Lace, Drawcord, Zipper, etc.)
  const handleSelectComponentCategory = (catName, defaultUnit = 'Pcs') => {
    setSelectedOtherCategory(catName);
    if (!catName || catName === 'ALL') {
      return;
    }
    const filterKey = catName.toLowerCase().trim();
    const matching = (materials || []).filter(m => {
      const name = (m.name || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const subCat = (m.subCategory || '').toLowerCase();
      const itemCode = (m.itemCode || '').toLowerCase();
      if (filterKey === 'tape') return name.includes('tape') || cat.includes('tape') || name.includes('ribbon') || cat.includes('ribbon') || name.includes('niwar');
      if (filterKey === 'button') return name.includes('button') || cat.includes('button') || name.includes('snap') || cat.includes('snap');
      if (filterKey === 'lace') return name.includes('lace') || cat.includes('lace') || name.includes('gota') || cat.includes('gota');
      if (filterKey === 'drawcord' || filterKey === 'dori') return name.includes('dori') || cat.includes('dori') || name.includes('cord') || cat.includes('cord');
      if (filterKey === 'zipper' || filterKey === 'zip') return name.includes('zip') || cat.includes('zip') || name.includes('chain') || cat.includes('runner');
      if (filterKey === 'label') return name.includes('label') || cat.includes('label') || name.includes('tag') || cat.includes('tag');
      if (filterKey === 'badge') return name.includes('patch') || cat.includes('patch') || name.includes('badge') || cat.includes('badge');
      if (filterKey === 'eyelet') return name.includes('eyelet') || cat.includes('eyelet') || name.includes('ring');
      if (filterKey === 'elastic') return name.includes('elastic') || cat.includes('elastic') || name.includes('waistband');
      return name.includes(filterKey) || cat.includes(filterKey) || subCat.includes(filterKey) || itemCode.includes(filterKey);
    });

    if (matching.length > 0) {
      setOtherEntryMode('choose');
      const alreadyMatches = matching.some(m => String(m.id) === String(selectedOtherMaterialId));
      if (!alreadyMatches) {
        const first = matching[0];
        setSelectedOtherMaterialId(first.id);
        setOtherMaterialName(first.name);
        if (first.unit) {
          setOtherUnit(normalizeAccUnit(first.unit));
          setIsManualOtherUnit(false);
        }
      }
    } else {
      // No materials in stock for this category: set name and smart default unit
      setOtherMaterialName(catName);
      setOtherUnit(defaultUnit);
      setIsManualOtherUnit(false);
    }
  };

  // Handler for adding and saving a new custom material name
  const handleAddNewCustomName = (nameToAdd) => {
    const trimmed = (nameToAdd || otherMaterialName || '').trim();
    if (!trimmed) return;
    setOtherMaterialName(trimmed);
    if (!customOtherNames.includes(trimmed)) {
      const updated = [trimmed, ...customOtherNames].slice(0, 30);
      setCustomOtherNames(updated);
      try {
        localStorage.setItem('gpdms_custom_other_names', JSON.stringify(updated));
      } catch (e) { }
    }
    showToast(`Saved "${trimmed}" to quick names.`);
  };

  const handleRemoveCustomName = (nameToRemove, e) => {
    if (e) e.stopPropagation();
    const updated = customOtherNames.filter(n => n !== nameToRemove);
    setCustomOtherNames(updated);
    try {
      localStorage.setItem('gpdms_custom_other_names', JSON.stringify(updated));
    } catch (err) { }
  };

  // Auto-link first suitable other material on initial load if not selected
  useEffect(() => {
    if (materials.length > 0 && !selectedOtherMaterialId) {
      const firstOther = materials.find(m => {
        const cat = (m.category || '').toLowerCase();
        const n = (m.name || '').toLowerCase();
        return !cat.includes('elastic') && !cat.includes('bone') && !n.includes('elastic') && !n.includes('bone');
      }) || materials[0];
      if (firstOther) {
        setSelectedOtherMaterialId(firstOther.id);
        if (!otherMaterialName || otherMaterialName === 'Drawcord / Other Accessory') {
          setOtherMaterialName(firstOther.name);
        }
        if (firstOther.unit) {
          setOtherUnit(firstOther.unit);
        }
      }
    }
  }, [materials]);

  // Handler for selecting an Elastic item
  const handleSelectElasticMaterial = (id) => {
    setSelectedElasticMaterialId(id);
    if (!id) {
      setElasticMaterialName('');
      return;
    }
    const mat = elasticMaterials.find(m => String(m.id) === String(id));
    if (mat) {
      setElasticMaterialName(mat.name);
      const n = (mat.name || '').toLowerCase();
      if (n.includes('1.5')) setElasticWidth('1.5 Inch');
      else if (n.includes('2')) setElasticWidth('2 Inch');
      else setElasticWidth('1 Inch');
    }
  };

  // Handler for selecting a Tape item
  const handleSelectTapeMaterial = (id) => {
    setSelectedTapeMaterialId(id);
    if (!id) {
      setTapeMaterialName('');
      return;
    }
    const mat = tapeMaterials.find(m => String(m.id) === String(id));
    if (mat) {
      setTapeMaterialName(mat.name);
    }
  };

  // Handler for selecting a Bone item
  const handleSelectBoneMaterial = (id) => {
    setSelectedBoneMaterialId(id);
    if (!id) {
      setBoneMaterialName('');
      return;
    }
    const mat = boneMaterials.find(m => String(m.id) === String(id));
    if (mat) {
      setBoneMaterialName(mat.name);
    }
  };

  // Auto-link matching elastic material on load or when width changes if not manually selected
  useEffect(() => {
    if (elasticMaterials.length > 0 && !selectedElasticMaterialId) {
      const match = elasticMaterials.find(m => {
        const n = (m.name || '').toLowerCase();
        if (effectiveWidth.includes('1.5')) return n.includes('1.5');
        if (effectiveWidth.includes('2')) return n.includes('2') && !n.includes('1.5');
        return n.includes('1') && !n.includes('1.5');
      }) || elasticMaterials[0];
      if (match) {
        setSelectedElasticMaterialId(match.id);
        if (!elasticMaterialName || elasticMaterialName === 'Elastic') {
          setElasticMaterialName(match.name);
        }
      }
    }
  }, [elasticMaterials, effectiveWidth]);

  // Auto-link tape material on load
  useEffect(() => {
    if (tapeMaterials.length > 0 && !selectedTapeMaterialId) {
      const firstTape = tapeMaterials[0];
      if (firstTape) {
        setSelectedTapeMaterialId(firstTape.id);
        if (!tapeMaterialName || tapeMaterialName === 'Tape') {
          setTapeMaterialName(firstTape.name);
        }
      }
    }
  }, [tapeMaterials]);

  // Auto-link bone material on load
  useEffect(() => {
    if (boneMaterials.length > 0 && !selectedBoneMaterialId) {
      const firstBone = boneMaterials[0];
      if (firstBone) {
        setSelectedBoneMaterialId(firstBone.id);
        if (!boneMaterialName || boneMaterialName === 'Bone Pocketing') {
          setBoneMaterialName(firstBone.name);
        }
      }
    }
  }, [boneMaterials]);

  // Fetch designs to verify BOM existence and approval status
  const fetchDesigns = async () => {
    try {
      setLoadingDesigns(true);
      const res = await fetch(`${getBackendUrl()}/api/designs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDesigns(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch designs in ElasticIssueView:', e);
    } finally {
      setLoadingDesigns(false);
    }
  };

  // Computed: List of all designs with Approved BOMs
  const approvedDesignsList = useMemo(() => {
    return (designs || []).filter(d => String(d.status || '').toLowerCase().trim() === 'approved');
  }, [designs]);

  // Helper to calculate sequential without lot slip number from history
  const getNextWithoutLotSeq = (history = issueHistory, mode = materialMode) => {
    const prefix = mode === 'tape' ? 'tape-w/o-' : mode === 'bone' ? 'bone-w/o-' : mode === 'other' ? 'other-w/o-' : 'elastic-w/o-';
    let max = 0;
    (history || []).forEach(h => {
      const s = String(h.slipNo || '').toLowerCase();
      if (s.startsWith(prefix)) {
        const n = parseInt(s.replace(prefix, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return `${prefix}${max + 1}`;
  };

  // Fetch next Issue Slip Number from backend or local sequence
  const fetchNextIssueSlipNo = async (isWo = withoutLotActive, mode = materialMode) => {
    if (isWo) {
      const type = mode === 'tape' ? 'tape_wo' : mode === 'bone' ? 'bone_wo' : mode === 'other' ? 'other_wo' : 'elastic_wo';
      try {
        const res = await fetch(`${getBackendUrl()}/api/po-number/next/${type}`);
        if (res.ok) {
          const data = await res.json();
          if (data.poNumber) {
            setIssueSlipNo(data.poNumber);
            return data.poNumber;
          }
        }
      } catch (_) { }
      const fallback = getNextWithoutLotSeq(issueHistory, mode);
      setIssueSlipNo(fallback);
      return fallback;
    }

    try {
      const res = await fetch(`${getBackendUrl()}/api/po-number/next/elastic_issue`);
      if (res.ok) {
        const data = await res.json();
        if (data.poNumber) {
          setIssueSlipNo(data.poNumber);
          return data.poNumber;
        }
      }
    } catch (_) { }
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const fallback = `ELASTIC-ISSUE-${randomSuffix}`;
    setIssueSlipNo(fallback);
    return fallback;
  };

  // Initialize next slip number on mount
  useEffect(() => {
    fetchNextIssueSlipNo();
    loadIssueHistory();
    fetchDesigns();
    fetchMaterials();
  }, []);

  // Update slip number when withoutLotActive or materialMode changes
  useEffect(() => {
    fetchNextIssueSlipNo(withoutLotActive, materialMode);
  }, [withoutLotActive, materialMode]);

  // Auto-search lot with debounce as user types
  useEffect(() => {
    const trimmed = (searchLotInput || '').trim();
    if (!trimmed || trimmed.length < 3) {
      return;
    }
    if (lotDetails && String(lotDetails.lotNo || '').toLowerCase() === trimmed.toLowerCase() && lotDetails.quantity) {
      return;
    }

    const timer = setTimeout(() => {
      handleSearchLot(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchLotInput]);

  // Sync if prefilled lot passed from another view
  useEffect(() => {
    if (prefilledLotNo) {
      setSearchLotInput(prefilledLotNo);
      handleSearchLot(prefilledLotNo);
    }
  }, [prefilledLotNo]);

  const normalizeSlipNo = (s) => {
    const str = String(s || '').trim();
    if (str === 'elastic-w/o-20') return 'elastic-w/o-1';
    if (str === 'elastic-w/o-34') return 'elastic-w/o-2';
    if (str === 'elastic-w/o-43') return 'elastic-w/o-3';
    if (str === 'elastic-w/o-62') return 'elastic-w/o-4';
    if (str === 'bone-w/o-40') return 'bone-w/o-1';
    if (str === 'tape-w/o-01') return 'tape-w/o-1';
    return str;
  };

  // Load Issue History from backend and localStorage
  const loadIssueHistory = async () => {
    setLoadingHistory(true);
    try {
      const localSaved = localStorage.getItem('gpdms_elastic_issue_history');
      let localList = [];
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed)) {
            localList = parsed.map(p => ({ ...p, slipNo: normalizeSlipNo(p.slipNo) }));
          }
        } catch (_) { }
      }

      // 1. Fetch from Dedicated elastic_issue Table
      try {
        const res = await fetch(`${getBackendUrl()}/api/elastic-issues`);
        if (res.ok) {
          const records = await res.json();
          if (Array.isArray(records) && records.length > 0) {
            const normalized = records.map(r => ({ ...r, slipNo: normalizeSlipNo(r.slipNo) }));
            setIssueHistory(normalized);
            localStorage.setItem('gpdms_elastic_issue_history', JSON.stringify(normalized.slice(0, 100)));
            setLoadingHistory(false);
            return;
          }
        }
      } catch (_) { }

      // 2. Legacy fallback from issue_logs
      try {
        const res = await fetch(`${getBackendUrl()}/api/issue-logs`);
        if (res.ok) {
          const logs = await res.json();
          const elasticLogs = (Array.isArray(logs) ? logs : []).filter(l =>
            String(l.id || '').toUpperCase().includes('ELASTIC') ||
            String(l.category || '').toUpperCase().includes('ELASTIC')
          ).map(l => ({
            slipNo: normalizeSlipNo(l.id),
            lotNo: l.lotId,
            date: l.date,
            rolls: l.volume || 1,
            issuerName: l.personName,
            receiverName: l.receiverName,
            remarks: l.materials ? (typeof l.materials === 'string' ? l.materials : JSON.stringify(l.materials)) : ''
          }));

          const combined = [];
          elasticLogs.forEach(el => {
            if (!combined.some(c => c.slipNo === el.slipNo)) {
              combined.push(el);
            }
          });
          localList.forEach(item => {
            if (!combined.some(c => c.slipNo === item.slipNo)) {
              combined.push(item);
            }
          });
          setIssueHistory(combined);
          localStorage.setItem('gpdms_elastic_issue_history', JSON.stringify(combined.slice(0, 100)));
          setLoadingHistory(false);
          return;
        }
      } catch (_) { }

      setIssueHistory(localList);
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Automatic Backend Calculation Trigger
  const triggerCalculation = async (
    eSize = elasticSizeInput,
    eUnit = elasticUnit,
    tSize = tapeSizeInput,
    tUnit = tapeUnit,
    targetLot = lotDetails,
    customPcs = issuePcs,
    eWidth = elasticWidth
  ) => {
    try {
      setCalculating(true);
      const pcs = parseInt(customPcs || targetLot?.quantity || 0, 10);
      if (!pcs || pcs <= 0) {
        setCalcResult(prev => ({
          ...prev,
          totalElasticMtr: 0,
          totalTapeMtr: 0,
          recommendedRolls: 0
        }));
        setRollCount(0);
        return;
      }

      // Without BOM Mode: direct piece allocation by width divisor (1" ÷ 25, 1.5" ÷ 23, 2" ÷ 23, or user-edited divisor)
      if (withoutLotActive) {
        const currentDiv = (div && parseFloat(div) > 0) ? parseFloat(div) : ((String(eWidth).includes('1.5') || String(eWidth).includes('2')) ? 23 : 25);
        const woRolls = pcs > 0 ? Math.ceil(pcs / currentDiv) : 0;
        const exactRolls = pcs > 0 ? (pcs / currentDiv).toFixed(2) : '0';
        const currentTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
        const tapeRolls = pcs > 0 ? Math.ceil(pcs / currentTapeDiv) : 0;
        setCalcResult(prev => ({
          ...prev,
          totalElasticMtr: 0,
          totalTapeMtr: 0,
          recommendedRolls: woRolls,
          tapeRolls: tapeRolls,
          elasticFormula: `${pcs} Pcs ÷ ${currentDiv} (${eWidth}) = ${exactRolls} Rolls ➔ TOTAL = ${woRolls} Roll(s)`,
          tapeFormula: `${pcs} Pcs ÷ ${currentTapeDiv} = ${pcs > 0 ? (pcs / currentTapeDiv).toFixed(2) : 0} Rolls ➔ TOTAL = ${tapeRolls} Roll(s)`,
          formulaExplanation: `Without BOM: ${pcs} Pcs ÷ ${currentDiv} (${eWidth}) = ${exactRolls} Rolls ➔ TOTAL = ${woRolls} Roll(s)`
        }));
        setRollCount(woRolls);
        setTapeRollCount(tapeRolls);
        return;
      }

      const res = await fetch(`${getBackendUrl()}/api/elastic/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNo: targetLot?.lotNo || searchLotInput,
          pcs,
          sizeInput: eSize,
          elasticUnit: eUnit,
          unit: eUnit,
          tapeSizeInput: tSize,
          tapeUnit: tUnit,
          elasticWidth: eWidth
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
        if (data.recommendedRolls) {
          setRollCount(data.recommendedRolls);
        }
      }
    } catch (e) {
      console.warn('Calculation error:', e);
    } finally {
      setCalculating(false);
    }
  };

  // Re-calculate automatically when size, unit, tape, lot, issue pcs, elasticWidth, effectiveDivisor, or withoutLotActive changes
  useEffect(() => {
    triggerCalculation(elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, lotDetails, issuePcs, elasticWidth, effectiveDivisor);
  }, [elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, lotDetails, issuePcs, elasticWidth, effectiveDivisor, effectiveTapeDivisor, withoutLotActive]);

  // Synchronous INSTANT lookup from memory (0ms) + debounced background matrix fetch
  useEffect(() => {
    const rawLot = searchLotInput || lotDetails?.lotNo || prefilledLotNo || '';
    const cleanLot = String(rawLot).trim();
    if (!cleanLot) {
      setActiveLotCutting(null);
      setLoadingActiveLotCutting(false);
      return;
    }

    const cleanLower = cleanLot.toLowerCase();

    // 1. INSTANT (0ms) In-Memory Lookup from cuttingHeaders & designs
    const headerMatch = (cuttingHeaders || []).find(ch =>
      String(ch.Lot_Number || '').trim().toLowerCase() === cleanLower
    );
    const designMatch = (designs || []).find(d =>
      String(d.id || '').trim().toLowerCase() === cleanLower ||
      String(d.lotNumber || '').trim().toLowerCase() === cleanLower
    );

    const memoryTotal = Number(headerMatch?.Cutting_Qty) || Number(designMatch?.quantity) || Number(lotDetails?.quantity) || 0;
    const hasMemoryData = Boolean(headerMatch || designMatch || lotDetails);

    setActiveLotCutting({
      lotNumber: cleanLot,
      totalPieces: memoryTotal,
      style: headerMatch?.Style || designMatch?.category || lotDetails?.style || '',
      fabric: headerMatch?.Fabric || lotDetails?.fabric || '',
      brand: headerMatch?.Brand || designMatch?.brand || lotDetails?.brand || '',
      partyName: headerMatch?.Party_Name || lotDetails?.partyName || '',
      garmentType: headerMatch?.Garment_Type || lotDetails?.garmentType || '',
      dateOfIssue: headerMatch?.Date_of_Issue || headerMatch?.JobOrder_Date || '',
      shades: headerMatch?.Shades || lotDetails?.shade || '',
      sizes: headerMatch?.Sizes || lotDetails?.size || '',
      rows: matrixCacheRef.current[cleanLower]?.rows || [],
      hasDetails: hasMemoryData
    });

    if (memoryTotal > 0) {
      setIssuePcs(memoryTotal);
      triggerCalculation(elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, { ...lotDetails, quantity: memoryTotal }, memoryTotal);
    }
    if (headerMatch?.Style || designMatch?.category) {
      setWithoutLotStyle(headerMatch?.Style || designMatch?.category);
    }

    // If already cached in matrixCache, resolve immediately
    if (matrixCacheRef.current[cleanLower]) {
      const cached = matrixCacheRef.current[cleanLower];
      const matrixRows = cached?.rows || [];
      const matrixTotal = matrixRows.reduce((sum, r) => sum + (Number(r.totalPcs) || 0), 0);
      const resolvedTotal = matrixTotal > 0 ? matrixTotal : (memoryTotal > 0 ? memoryTotal : (Number(cached?.cuttingQty) || Number(cached?.header?.Cutting_Qty) || 0));
      setActiveLotCutting(prev => ({
        ...prev,
        totalPieces: resolvedTotal,
        rows: matrixRows,
        hasDetails: true
      }));
      setLoadingActiveLotCutting(false);
      return;
    }

    // 2. Debounced background fetch for detailed Color-Size Matrix (300ms)
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setLoadingActiveLotCutting(true);
      try {
        const res = await fetch(`${getBackendUrl()}/api/cutting/${encodeURIComponent(cleanLot)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();

        if (Object.keys(matrixCacheRef.current).length >= CUTTING_CACHE_MAX_ENTRIES) {
          matrixCacheRef.current = {};
        }

        matrixCacheRef.current[cleanLower] = data;
        const matrixRows = data?.rows || [];
        const matrixTotal = matrixRows.reduce((sum, r) => sum + (Number(r.totalPcs) || 0), 0);
        const resolvedTotal = matrixTotal > 0
          ? matrixTotal
          : (memoryTotal > 0 ? memoryTotal : (Number(data?.cuttingQty) || Number(data?.header?.Cutting_Qty) || 0));

        const styleVal = data?.style || data?.header?.Style || '';
        const fabricVal = data?.fabric || data?.header?.Fabric || '';
        const brandVal = data?.brand || data?.header?.Brand || '';
        const partyVal = data?.partyName || data?.header?.Party_Name || '';
        const shadesVal = data?.shades || data?.header?.Shades || '';
        const sizesVal = data?.sizes || data?.header?.Sizes || '';

        if (!isCancelled) {
          setActiveLotCutting(prev => ({
            ...prev,
            totalPieces: resolvedTotal,
            style: prev?.style || styleVal,
            fabric: prev?.fabric || fabricVal,
            brand: prev?.brand || brandVal,
            partyName: prev?.partyName || partyVal,
            shades: prev?.shades || shadesVal,
            sizes: prev?.sizes || sizesVal,
            rows: matrixRows,
            hasDetails: true
          }));

          if (resolvedTotal > 0) {
            setIssuePcs(resolvedTotal);
            triggerCalculation(elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, { ...lotDetails, quantity: resolvedTotal }, resolvedTotal);
          }
          if (styleVal) {
            setWithoutLotStyle(styleVal);
          }
          setLotDetails(prev => ({
            ...(prev || {}),
            lotNo: cleanLot,
            quantity: resolvedTotal || prev?.quantity || 0,
            style: styleVal || prev?.style || '',
            fabric: fabricVal || prev?.fabric || '',
            brand: brandVal || prev?.brand || '',
            partyName: partyVal || prev?.partyName || '',
            shade: shadesVal || prev?.shade || '',
            size: sizesVal || prev?.size || ''
          }));
        }
      } catch (err) {
        if (!isCancelled) {
          setActiveLotCutting(prev => (prev ? { ...prev, hasDetails: prev.hasDetails || hasMemoryData } : null));
        }
      } finally {
        if (!isCancelled) setLoadingActiveLotCutting(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchLotInput, lotDetails, prefilledLotNo, cuttingHeaders, designs, cuttingCacheRefreshCount]);

  // Save new issue to history, deduct stock from inventory & sync to database
  const saveToHistory = async (record) => {
    try {
      const mode = record.materialMode || materialMode;

      // 1. Determine all materials to deduct for this issue bill
      const itemsToDeduct = [];

      // Elastic item deduction
      if (mode === 'elastic' || mode === 'both' || mode === 'all') {
        const matId = record.selectedElasticMaterialId || selectedElasticMaterialId;
        if (matId) {
          const mat = (materials || []).find(m => String(m.id) === String(matId) || String(m.itemCode) === String(matId));
          const isMtr = mat && normalizeAccUnit(mat.unit).toLowerCase() === 'mtr';
          const qty = (isMtr && parseFloat(record.totalElasticMtr) > 0)
            ? parseFloat(record.totalElasticMtr)
            : (parseFloat(record.rolls) || 1);
          itemsToDeduct.push({
            materialId: mat ? mat.id : matId,
            materialName: mat ? mat.name : (record.elasticMaterialName || 'Elastic Waistband Roll'),
            itemCode: formatItemCode(matId, mat, materials),
            bomItemName: 'Elastic',
            unit: mat?.unit || (isMtr ? 'Mtr' : 'Roll'),
            totalRequired: qty,
            location: mat?.location || 'Main Store',
            stockBefore: mat ? (Number(mat.stock) || 0) : 0
          });
        }
      }

      // Tape item deduction
      if (mode === 'tape' || mode === 'both' || mode === 'all') {
        const matId = record.selectedTapeMaterialId || selectedTapeMaterialId;
        if (matId) {
          const mat = (materials || []).find(m => String(m.id) === String(matId) || String(m.itemCode) === String(matId));
          const isMtr = mat && normalizeAccUnit(mat.unit).toLowerCase() === 'mtr';
          const qty = (isMtr && parseFloat(record.totalTapeMtr) > 0)
            ? parseFloat(record.totalTapeMtr)
            : (parseFloat(record.tapeRolls) || parseFloat(record.rolls) || 1);
          itemsToDeduct.push({
            materialId: mat ? mat.id : matId,
            materialName: mat ? mat.name : (record.tapeMaterialName || 'Tape Roll'),
            itemCode: formatItemCode(matId, mat, materials),
            bomItemName: 'Tape',
            unit: mat?.unit || (isMtr ? 'Mtr' : 'Roll'),
            totalRequired: qty,
            location: mat?.location || 'Main Store',
            stockBefore: mat ? (Number(mat.stock) || 0) : 0
          });
        }
      }

      // Bone item deduction
      if (mode === 'bone' || mode === 'all') {
        const matId = record.selectedBoneMaterialId || selectedBoneMaterialId;
        if (matId) {
          const mat = (materials || []).find(m => String(m.id) === String(matId) || String(m.itemCode) === String(matId));
          const isKg = mat && normalizeAccUnit(mat.unit).toLowerCase() === 'kg';
          const qty = (isKg && parseFloat(record.boneWeightKg) > 0)
            ? parseFloat(record.boneWeightKg)
            : (parseFloat(record.boneRollCount) || parseFloat(record.rolls) || 1);
          itemsToDeduct.push({
            materialId: mat ? mat.id : matId,
            materialName: mat ? mat.name : (record.boneMaterialName || 'Bone Pocketing Roll'),
            itemCode: formatItemCode(matId, mat, materials),
            bomItemName: 'Bone',
            unit: mat?.unit || (isKg ? 'Kg' : 'Roll'),
            totalRequired: qty,
            location: mat?.location || 'Main Store',
            stockBefore: mat ? (Number(mat.stock) || 0) : 0
          });
        }
      }

      // Other Accessories item deduction (Multi-Row Support)
      if (mode === 'other') {
        const rawItems = Array.isArray(record.otherItems) && record.otherItems.length > 0
          ? record.otherItems
          : otherItems;
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          rawItems.forEach(item => {
            const matId = item.materialId;
            if (matId && item.entryMode !== 'manual') {
              const mat = (materials || []).find(m => String(m.id) === String(matId) || String(m.itemCode) === String(matId));
              const qty = parseFloat(item.totalQty || item.qty) || 1;
              itemsToDeduct.push({
                materialId: mat ? mat.id : matId,
                materialName: mat ? mat.name : (item.materialName || item.componentType || 'Other Accessory'),
                itemCode: formatItemCode(matId, mat, materials),
                bomItemName: item.componentType || item.materialName || 'Other Accessory',
                unit: mat?.unit || item.unit || 'Mtr',
                totalRequired: qty,
                location: mat?.location || 'Main Store',
                stockBefore: mat ? (Number(mat.stock) || 0) : 0
              });
            }
          });
        }
        // Fallback if no array items matched:
        if (itemsToDeduct.length === 0) {
          const matId = record.selectedOtherMaterialId || selectedOtherMaterialId;
          if (matId) {
            const mat = (materials || []).find(m => String(m.id) === String(matId) || String(m.itemCode) === String(matId));
            const qty = parseFloat(record.otherRollCount) || parseFloat(record.rolls) || 1;
            itemsToDeduct.push({
              materialId: mat ? mat.id : matId,
              materialName: mat ? mat.name : (record.otherMaterialName || 'Other Accessory'),
              itemCode: formatItemCode(matId, mat, materials),
              bomItemName: record.otherMaterialName || 'Other Accessory',
              unit: mat?.unit || record.otherUnit || 'Roll',
              totalRequired: qty,
              location: mat?.location || 'Main Store',
              stockBefore: mat ? (Number(mat.stock) || 0) : 0
            });
          }
        }
      }

      // 2. Direct stock subtraction (total stock - issue stock)
      const changedMaterials = [];
      const updatedMaterials = (materials || []).map(m => {
        const matched = itemsToDeduct.find(i => String(i.materialId) === String(m.id) || (m.itemCode && String(i.itemCode) === String(m.itemCode)));
        if (matched) {
          const oldStock = Number(m.stock) || 0;
          const newStock = Math.max(0, Math.round((oldStock - matched.totalRequired) * 100) / 100);
          matched.stockAfter = newStock;
          const updatedMat = { ...m, stock: newStock };
          changedMaterials.push(updatedMat);
          if (typeof onUpdateMaterial === 'function') {
            try { onUpdateMaterial(updatedMat); } catch (_) { }
          }
          return updatedMat;
        }
        return m;
      });

      // Update local state in ElasticIssueView immediately
      setMaterials(updatedMaterials);

      if (typeof syncMaterialsToDb === 'function' && changedMaterials.length > 0) {
        try { syncMaterialsToDb(changedMaterials); } catch (_) { }
      }

      // Send PUT requests to MySQL
      changedMaterials.forEach(cm => {
        fetch(`${getBackendUrl()}/api/materials/${cm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cm)
        }).catch(err => console.warn('Failed to PUT material stock update:', err));
      });

      // Update realIssuedMap in localStorage so all components know stock is deducted
      const issueTimestamp = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      try {
        const realMap = JSON.parse(localStorage.getItem('gpdms_real_material_issued_bills') || '{}');
        realMap[record.slipNo] = {
          isIssued: true,
          issuedAt: issueTimestamp,
          issuedBy: record.issuerName || currentUser?.name || 'Store Staff',
          issuedReceiver: record.receiverName,
          deductedItems: itemsToDeduct
        };
        localStorage.setItem('gpdms_real_material_issued_bills', JSON.stringify(realMap));
      } catch (_) { }

      const recordWithDeduction = {
        ...record,
        realMaterialIssued: true,
        deductedItems: itemsToDeduct,
        issuedAt: issueTimestamp
      };

      const current = [...issueHistory];
      const updated = [recordWithDeduction, ...current.filter(c => c.slipNo !== record.slipNo)];
      setIssueHistory(updated);
      localStorage.setItem('gpdms_elastic_issue_history', JSON.stringify(updated.slice(0, 100)));

      // 3. Save directly into dedicated elastic_issue MySQL table
      await fetch(`${getBackendUrl()}/api/elastic-issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipNo: record.slipNo,
          lotNo: record.lotNo,
          rolls: record.rolls,
          issuerName: record.issuerName,
          receiverName: record.receiverName,
          supervisorName: record.supervisorName || lotDetails?.supervisor || '',
          issueDate: record.date,
          style: record.style,
          brand: record.brand,
          garmentType: record.garmentType,
          fabric: record.fabric,
          quantity: record.quantity,
          shade: record.shade,
          size: record.size,
          elasticWidth: record.width,
          unitType: elasticUnit,
          elasticSizeInput: parseFloat(elasticSizeInput) || 0,
          elasticPerPcMtr: calcResult.elasticPerPcMtr,
          totalElasticMtr: calcResult.totalElasticMtr,
          tapePerPcMtr: calcResult.tapePerPcMtr,
          totalTapeMtr: calcResult.totalTapeMtr,
          materialMode: record.materialMode || materialMode,
          otherMaterialName: record.otherMaterialName || otherMaterialName,
          otherUnit: record.otherUnit || otherUnit,
          otherRollCount: record.otherRollCount || otherRollCount,
          selectedOtherMaterialId: record.selectedOtherMaterialId || selectedOtherMaterialId,
          otherItemCode: record.otherItemCode,
          remarks: record.remarks,
          payload: JSON.stringify(recordWithDeduction)
        })
      });

      // 4. Also sync to global issue_logs with deducted materials details
      try {
        const issueCat = (record.materialMode === 'other' || materialMode === 'other')
          ? 'OTHER ACCESSORIES'
          : (record.materialMode === 'tape' || materialMode === 'tape')
            ? 'TAPE'
            : (record.materialMode === 'bone' || materialMode === 'bone')
              ? 'BONE'
              : 'ELASTIC / WAISTBAND';

        await fetch(`${getBackendUrl()}/api/issue-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: record.slipNo,
            lotId: record.lotNo,
            isReissue: false,
            isReturn: false,
            category: issueCat,
            volume: record.rolls,
            personName: record.issuerName,
            receiverName: record.receiverName,
            receiverDept: 'CUTTING',
            date: record.date,
            materials: itemsToDeduct.length > 0
              ? itemsToDeduct.map(i => ({
                name: i.materialName,
                materialId: i.materialId,
                bomItemName: i.bomItemName,
                qty: i.totalRequired,
                unit: i.unit,
                billNo: record.slipNo,
                location: i.location,
                remainingStock: i.stockAfter
              }))
              : [
                (materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') ? {
                  name: record.elasticMaterialName || elasticMaterialName || 'Elastic Waistband Roll',
                  materialId: record.selectedElasticMaterialId || selectedElasticMaterialId || '',
                  rolls: record.rolls,
                  shade: record.shade,
                  width: record.width,
                  elasticPerPcMtr: calcResult.elasticPerPcMtr,
                  totalElasticMtr: calcResult.totalElasticMtr
                } : null,
                (materialMode === 'tape' || materialMode === 'both' || materialMode === 'all') ? {
                  name: record.tapeMaterialName || tapeMaterialName || 'Tape Roll',
                  materialId: record.selectedTapeMaterialId || selectedTapeMaterialId || '',
                  rolls: record.tapeRollCount || 1,
                  width: record.tapeWidth,
                  tapePerPcMtr: calcResult.tapePerPcMtr,
                  totalTapeMtr: calcResult.totalTapeMtr
                } : null,
                (materialMode === 'bone' || materialMode === 'all') ? {
                  name: record.boneMaterialName || boneMaterialName || 'Bone Pocketing Roll',
                  materialId: record.selectedBoneMaterialId || selectedBoneMaterialId || '',
                  rolls: record.boneRolls || boneRollCount || 1,
                  width: record.boneWidth
                } : null,
                (materialMode === 'other') ? {
                  name: record.otherMaterialName || otherMaterialName || 'Other Accessory',
                  materialId: record.selectedOtherMaterialId || selectedOtherMaterialId || '',
                  rolls: record.otherRollCount || otherRollCount || 1,
                  unit: record.otherUnit || otherUnit || 'Roll'
                } : null
              ].filter(Boolean)
          })
        });
      } catch (_) { }

      return itemsToDeduct;
    } catch (e) {
      console.warn('Backend sync warning:', e);
      return [];
    }
  };

  // Verify BOM existence and approval status for a specific lot
  const verifyBOMStatus = async (lotQuery) => {
    try {
      let currentDesigns = designs;
      try {
        const res = await fetch(`${getBackendUrl()}/api/designs`);
        if (res.ok) {
          const fresh = await res.json();
          if (Array.isArray(fresh)) {
            setDesigns(fresh);
            currentDesigns = fresh;
          }
        }
      } catch (_) { }

      const cleanQ = String(lotQuery || '').trim().toLowerCase();
      const matched = (currentDesigns || []).find(d =>
        String(d.id || '').trim().toLowerCase() === cleanQ ||
        String(d.lot_no || '').trim().toLowerCase() === cleanQ
      );

      if (!matched) {
        setBomStatus('not_created');
        setBomDesign(null);
      } else {
        setBomDesign(matched);
        const elasticBomRow = (matched.bom || []).find(b => (b.name || '').toLowerCase().includes('elastic'));
        if (elasticBomRow && elasticBomRow.materialId) {
          setSelectedElasticMaterialId(elasticBomRow.materialId);
          const mappedMat = (materials || []).find(m => String(m.id) === String(elasticBomRow.materialId));
          if (mappedMat) {
            setElasticMaterialName(mappedMat.name);
            const n = (mappedMat.name || '').toLowerCase();
            if (n.includes('1.5')) setElasticWidth('1.5 Inch');
            else if (n.includes('2')) setElasticWidth('2 Inch');
            else if (n.includes('1')) setElasticWidth('1 Inch');
          }
        }
        const tapeBomRow = (matched.bom || []).find(b => (b.name || '').toLowerCase().includes('tape'));
        if (tapeBomRow && tapeBomRow.materialId) {
          setSelectedTapeMaterialId(tapeBomRow.materialId);
          const mappedTape = (materials || []).find(m => String(m.id) === String(tapeBomRow.materialId));
          if (mappedTape) {
            setTapeMaterialName(mappedTape.name);
          }
        }
        const boneBomRow = (matched.bom || []).find(b => (b.name || '').toLowerCase().includes('bone'));
        if (boneBomRow && boneBomRow.materialId) {
          setSelectedBoneMaterialId(boneBomRow.materialId);
          const mappedBone = (materials || []).find(m => String(m.id) === String(boneBomRow.materialId));
          if (mappedBone) {
            setBoneMaterialName(mappedBone.name);
          }
        }
        const st = String(matched.status || '').trim().toLowerCase();
        if (st === 'approved') {
          setBomStatus('approved');
        } else if (st === 'rejected') {
          setBomStatus('rejected');
        } else {
          setBomStatus('pending');
        }
      }
    } catch (e) {
      console.warn('Error verifying BOM status:', e);
    }
  };

  // Search Lot Details
  const handleSearchLot = async (targetLot = null) => {
    const lotToQuery = (targetLot || searchLotInput || '').trim();
    if (!lotToQuery) {
      setLotError('Please enter a Lot Number to search.');
      setBomStatus('idle');
      setBomDesign(null);
      return;
    }

    setSearchingLot(true);
    setLotError('');

    // Check BOM status in parallel
    verifyBOMStatus(lotToQuery);

    try {
      const cleanLot = encodeURIComponent(lotToQuery);
      const res = await fetch(`${getBackendUrl()}/api/lot/${cleanLot}`);

      if (!res.ok) {
        throw new Error(`Lot "${lotToQuery}" not found. You can still enter details and issue pieces manually.`);
      }

      const data = await res.json();
      setLotDetails(data);
      const cuttingQty = parseInt(data.quantity || 0, 10);
      const effQty = cuttingQty > 0 ? cuttingQty : (issuePcs || '');
      setIssuePcs(effQty);
      triggerCalculation(elasticSizeInput, elasticUnit, tapeSizeInput, tapeUnit, data, effQty || 0);

      // Extract primary shade if available
      let primaryShade = '';
      if (data.shade) {
        const raw = String(data.shade);
        const first = raw.split(',')[0].replace(/\[.*?\]/g, '').trim();
        primaryShade = first || raw;
      }
      setSelectedShade(primaryShade);

      // Automatically sync style and garment info into withoutLotStyle so "STYLE / GARMENT ITEM" updates
      if (data.style || data.garmentType) {
        setWithoutLotStyle(data.style || data.garmentType);
      }

      const modeDesc = materialMode === 'other'
        ? `${otherMaterialName || 'Other Accessory'} floor issue`
        : materialMode === 'tape'
          ? `${tapeMaterialName || 'Tape'} issue`
          : materialMode === 'bone'
            ? `${boneMaterialName || 'Bone'} issue`
            : 'Internal Elastic waistband issue';
      setRemarks(`${modeDesc} for Lot ${data.lotNo || cleanLot} (${data.style || 'Garment'} - ${data.brand || ''}).`);

      setRecentLots(prev => {
        const updated = [lotToQuery, ...prev.filter(l => l !== lotToQuery)];
        return updated.slice(0, 6);
      });

      showToast(`Lot ${data.lotNo || lotToQuery} details loaded (${effQty || 0} Pcs).`);
    } catch (err) {
      console.warn('Lot search warning:', err);
      setLotError(err.message || 'Lot details not found in Google Sheets / Cutting Matrix.');
      if (!withoutLotActive) {
        setLotDetails(null);
        setIssuePcs('');
      }
    } finally {
      setSearchingLot(false);
    }
  };



  // ── Build Original Issue Bill / PO PDF Document (Clean B&W Layout) ──────
  const createElasticIssuePDFDocument = async (data) => {
    const {
      slipNo,
      lotNo,
      isWithoutLot = false,
      isWithoutPo = false,
      issuerName = '',
      receiverName = '',
      supervisorName = 'ROHIT / MONU',
      date = new Date().toISOString().split('T')[0],
      style = 'LOWER',
      brand = 'Mohit Hosiery',
      garmentType = 'LOWER',
      fabric = 'Cotton Poly Blend',
      quantity = 0,
      shade = 'Standard',
      size = 'M, L, XL, 2XL',
      width = '1 Inch (Standard)',
      tapeWidth = '0.5 Inch (Standard)',
      boneWidth = '1.5 Inch (Standard)',
      boneRolls = 1,
      boneWeightKg = '2.50',
      elasticPerPcMtr = 1.27,
      totalElasticMtr = 0,
      tapePerPcMtr = 0.62,
      totalTapeMtr = 0,
      elasticSizeInput = '50',
      elasticUnit = 'inch',
      tapeSizeInput = '62',
      materialMode = 'elastic',
      elasticMaterialName = 'Elastic Waistband Roll',
      selectedElasticMaterialId = '',
      tapeMaterialName = 'Tape Roll (Drawcord Tape)',
      selectedTapeMaterialId = '',
      boneMaterialName = 'Bone Pocketing / Piping Roll',
      selectedBoneMaterialId = '',
      formulaExplanation = '',
      remarks = ''
    } = data;

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Outer & Inner Borders (Crisp Black & White)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.2);
    doc.rect(20, 20, pw - 40, ph - 40);

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.6);
    doc.rect(23, 23, pw - 46, ph - 46);

    const im = 36;
    const iw = pw - im * 2;
    let y = 36;

    // Header Box
    doc.setFillColor(248, 248, 248);
    doc.rect(im, y, iw, 58, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(im, y, iw, 58, 'S');

    const withoutLotMode = Boolean(isWithoutLot || isWithoutPo || String(slipNo).toLowerCase().includes('-w/o-'));
    const effectiveMode = String(slipNo || '').toLowerCase().startsWith('tape')
      ? 'tape'
      : String(slipNo || '').toLowerCase().startsWith('bone')
        ? 'bone'
        : String(slipNo || '').toLowerCase().startsWith('other')
          ? 'other'
          : String(slipNo || '').toLowerCase().startsWith('elastic')
            ? 'elastic'
            : (materialMode || 'elastic');

    const modeLabel = effectiveMode === 'tape'
      ? 'TAPE'
      : effectiveMode === 'bone'
        ? 'BONE'
        : effectiveMode === 'other'
          ? 'OTHER ACCESSORIES'
          : effectiveMode === 'both'
            ? 'ELASTIC & TAPE'
            : effectiveMode === 'all'
              ? 'ALL ACCESSORIES'
              : 'ELASTIC';

    // Company & Document Title (Pure Black)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text('MOHIT HOSIERY', im + 12, y + 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const docTitle = withoutLotMode
      ? `MATERIAL ISSUE SLIP (W/O BOM - ${modeLabel} ISSUE)`
      : `MATERIAL ISSUE BILL / PURCHASE ORDER (${modeLabel} ORIGINAL)`;
    doc.text(docTitle, im + 12, y + 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(withoutLotMode ? 'Store & Accessories Department • Direct Floor Stock Issue' : `Store & Accessories Department • Production Floor Issue (${modeLabel})`, im + 12, y + 48);

    // Right Header Information Box (Pure Black & White)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(withoutLotMode ? `SLIP NO: ${slipNo}` : `BILL / PO NO: ${slipNo}`, pw - im - 12, y + 19, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`DATE: ${date}`, pw - im - 12, y + 33, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(withoutLotMode ? `[ W/O BOM - ${modeLabel} ]` : `[ ORIGINAL BILL - ${modeLabel} ]`, pw - im - 12, y + 48, { align: 'right' });

    y += 68;

    // ── 1. PRODUCTION & LOT SPECIFICATIONS ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(withoutLotMode ? `1. DIRECT FLOOR MOVEMENT SPECIFICATIONS (W/O BOM - ${modeLabel})` : `1. PRODUCTION & LOT SPECIFICATIONS (${modeLabel})`, im + 8, y + 12);

    // Spacing so text does not overwrite the section header
    y += 30;

    const colW = iw / 2;
    const drawField = (label, val, xPos, yPos) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(75, 75, 75);
      doc.text(`${label}:`, xPos, yPos);

      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(val || '—'), xPos + labelW + 3, yPos);
    };

    if (withoutLotMode) {
      drawField('Lot Number', `LOT #${lotNo || '—'}`, im + 6, y);
      drawField('Issue Quantity', `${quantity || 0} Pcs`, im + colW + 20, y);
      y += 18;

      drawField('Issue Mode', `WITHOUT BOM (${modeLabel})`, im + 6, y);
      drawField('Style Name', style || garmentType || 'LOWER', im + colW + 20, y);
      y += 18;

      drawField('Department', 'CUTTING FLOOR', im + 6, y);
      drawField('Supervisor Name', supervisorName || 'ROHIT / MONU', im + colW + 20, y);
      y += 18;

      drawField('Issued By', issuerName || 'STORE INCHARGE', im + 6, y);
      drawField('Received By', receiverName || 'CUTTING MASTER', im + colW + 20, y);
      y += 24;
    } else {
      drawField('Lot Number', `LOT #${lotNo}`, im + 6, y);
      drawField('Total Cutting Quantity', `${quantity || 0} Pcs`, im + colW + 6, y);
      y += 18;

      drawField('Item / Style Name', style || garmentType || 'LOWER', im + 6, y);
      drawField('Buyer / Brand', brand || 'Mohit Hosiery', im + colW + 6, y);
      y += 18;

      drawField('Garment Type', garmentType || 'LOWER / Pants', im + 6, y);
      drawField('Supervisor Name', supervisorName || 'ROHIT / MONU', im + colW + 6, y);
      y += 18;

      drawField('Lot Shade / Color', shade || 'Standard', im + 6, y);
      drawField('Target Sizes', size || 'M, L, XL, 2XL', im + colW + 6, y);
      y += 24;
    }

    // ── 2. MATERIAL ALLOCATION & TOTAL REQUIREMENT ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`2. MATERIAL ALLOCATION & TOTAL REQUIREMENT (${modeLabel} SPEC)`, im + 8, y + 12);

    // Spacing before table header
    y += 26;

    // Table Header (Crisp Solid Black Bar with White Text)
    const thH = 20;
    doc.setFillColor(0, 0, 0);
    doc.rect(im, y, iw, thH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('#', im + 6, y + 13);
    doc.text('ITEM / MATERIAL DESCRIPTION', im + 24, y + 13);
    doc.text('SPECIFICATION', im + 180, y + 13);
    doc.text('PER PC REQ.', im + 290, y + 13);
    doc.text(
      effectiveMode === 'bone'
        ? 'TOTAL WEIGHT / ROLLS'
        : (effectiveMode === 'other' || effectiveMode === 'tape')
          ? 'TOTAL ISSUE QTY'
          : (withoutLotMode ? 'TOTAL ROLLS' : 'TOTAL REQ. (MTR)'),
      pw - im - 10,
      y + 13,
      { align: 'right' }
    );
    y += thH;

    let itemIdx = 1;
    let grandTotalMtr = 0;

    const effDiv = (String(width || '').includes('1.5') || String(width || '').includes('2')) ? 23 : 25;
    const effRolls = withoutLotMode
      ? (data.rolls || Math.ceil((quantity || 0) / effDiv) || 1)
      : (data.rolls || Math.ceil((parseFloat(totalElasticMtr) || 0) / effDiv) || 1);
    const effTapeRolls = Math.ceil((quantity || 0) / 45) || 1;
    const effBoneTot = data.boneWeightKg || boneWeightKg || (String(boneRolls).includes('Kg') ? boneRolls : `${boneRolls || 1} Kg`);

    // Row: Elastic (Shown if elastic, both, or all)
    if (effectiveMode === 'elastic' || effectiveMode === 'both' || effectiveMode === 'all') {
      const rowH = 26;
      doc.setFillColor(255, 255, 255);
      doc.rect(im, y, iw, rowH, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.6);
      doc.line(im, y + rowH, pw - im, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(itemIdx++), im + 6, y + 16);

      doc.setFont('helvetica', 'bold');
      const chosenElasticId = data.elasticItemCode || data.selectedElasticMaterialId || selectedElasticMaterialId;
      const matchedElasticMat = (materials || []).find(m => String(m.id) === String(chosenElasticId) || String(m.itemCode) === String(chosenElasticId));
      const effElasticCode = formatItemCode(chosenElasticId, matchedElasticMat, materials);
      const rawElasticName = cleanMaterialName(data.elasticMaterialName || elasticMaterialName || 'Elastic Waistband Roll');
      const effElasticTitle = effElasticCode
        ? `${rawElasticName} [${effElasticCode}]`
        : rawElasticName;
      doc.text(effElasticTitle, im + 24, y + 16);

      doc.setFont('helvetica', 'normal');
      doc.text(width || '1 Inch (Standard)', im + 180, y + 16);

      if (withoutLotMode) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Pcs ÷ ${effDiv} Rule (${width || '1 Inch'})`, im + 290, y + 16);
        doc.text(`${quantity || 0} Pcs`, im + 375, y + 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(4, 120, 87);
        doc.text(`= ${effRolls} ROLL(S)`, pw - im - 10, y + 16, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.text(`${elasticPerPcMtr} Mtr (${elasticSizeInput} ${elasticUnit})`, im + 290, y + 16);
        doc.text(`${quantity || 0} Pcs`, im + 375, y + 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${totalElasticMtr} Mtr`, pw - im - 10, y + 10, { align: 'right' });
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(4, 120, 87);
        doc.text(`= ${effRolls} ROLL(S)`, pw - im - 10, y + 20, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }

      grandTotalMtr += parseFloat(totalElasticMtr) || 0;
      y += rowH;
    }

    // Row: Tape (Shown if tape, both, or all)
    if (effectiveMode === 'tape' || effectiveMode === 'both' || effectiveMode === 'all') {
      const rowH = 24;
      doc.setFillColor(255, 255, 255);
      doc.rect(im, y, iw, rowH, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.6);
      doc.line(im, y + rowH, pw - im, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(itemIdx++), im + 6, y + 15);

      doc.setFont('helvetica', 'bold');
      const chosenTapeId = data.tapeItemCode || data.selectedTapeMaterialId || selectedTapeMaterialId;
      const matchedTapeMat = (materials || []).find(m => String(m.id) === String(chosenTapeId) || String(m.itemCode) === String(chosenTapeId));
      const effTapeCode = formatItemCode(chosenTapeId, matchedTapeMat, materials);
      const rawTapeName = cleanMaterialName(data.tapeMaterialName || tapeMaterialName || 'Tape Roll (Drawcord Tape)');
      const effTapeTitle = effTapeCode
        ? `${rawTapeName} [${effTapeCode}]`
        : rawTapeName;
      doc.text(effTapeTitle, im + 24, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.text(tapeWidth || '0.5 Inch (Standard)', im + 180, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text(`Pcs / 45 Rule`, im + 290, y + 15);

      doc.text(`${quantity || 0} Pcs`, im + 375, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${effTapeRolls} Roll(s)`, pw - im - 10, y + 15, { align: 'right' });

      grandTotalMtr += parseFloat(totalTapeMtr) || 0;
      y += rowH;
    }

    // Row: Bone (Shown if bone or all)
    if (effectiveMode === 'bone' || effectiveMode === 'all') {
      const rowH = 24;
      doc.setFillColor(255, 255, 255);
      doc.rect(im, y, iw, rowH, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.6);
      doc.line(im, y + rowH, pw - im, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(String(itemIdx++), im + 6, y + 15);

      doc.setFont('helvetica', 'bold');
      const chosenBoneId = data.boneItemCode || data.selectedBoneMaterialId || selectedBoneMaterialId;
      const matchedBoneMat = (materials || []).find(m => String(m.id) === String(chosenBoneId) || String(m.itemCode) === String(chosenBoneId));
      const effBoneCode = formatItemCode(chosenBoneId, matchedBoneMat, materials);
      const rawBoneName = cleanMaterialName(data.boneMaterialName || boneMaterialName || 'Bone Pocketing / Piping Roll');
      const effBoneTitle = effBoneCode
        ? `${rawBoneName} [${effBoneCode}]`
        : rawBoneName;
      doc.text(effBoneTitle, im + 24, y + 15);

      doc.setFont('helvetica', 'normal');
      doc.text(boneWidth || '1.5 Inch (Standard)', im + 180, y + 15);

      const effBoneRollsVal = data.boneRolls || boneRolls || 1;
      const effBoneWeightVal = data.boneWeightKg || boneWeightKg || (String(boneRolls).includes('Kg') ? boneRolls : `${(parseFloat(effBoneRollsVal) * 2.5).toFixed(2)} Kg`);
      const effBoneWeightStr = String(effBoneWeightVal).includes('Kg') ? effBoneWeightVal : `${effBoneWeightVal} Kg`;
      const bPcs = quantity || data.issuePcs || 0;

      doc.setFont('helvetica', 'bold');
      if (bPcs > 0) {
        const bGramStr = ((parseFloat(effBoneWeightVal) * 1000) / bPcs).toFixed(1);
        doc.text(`${bGramStr} g/pc`, im + 290, y + 15);
        doc.text(`${bPcs} Pcs`, im + 375, y + 15);
      } else {
        doc.text('Direct Issue', im + 290, y + 15);
        doc.text('—', im + 375, y + 15);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${effBoneRollsVal} Roll(s) (${effBoneWeightStr})`, pw - im - 10, y + 15, { align: 'right' });
      y += rowH;
    }

    // Row: Other Accessories (Multi-Row Support if otherItems provided)
    if (effectiveMode === 'other') {
      const itemsList = Array.isArray(data.otherItems) && data.otherItems.length > 0
        ? data.otherItems
        : [{
            materialName: data.otherMaterialName || otherMaterialName || 'Other Accessory',
            materialId: data.selectedOtherMaterialId || selectedOtherMaterialId,
            itemCode: data.otherItemCode,
            totalQty: data.rolls || otherRollCount || 1,
            unit: data.otherUnit || otherUnit || 'Roll'
          }];

      itemsList.forEach(it => {
        const rowH = 24;
        doc.setFillColor(255, 255, 255);
        doc.rect(im, y, iw, rowH, 'F');
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.6);
        doc.line(im, y + rowH, pw - im, y + rowH);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(itemIdx++), im + 6, y + 15);

        doc.setFont('helvetica', 'bold');
        const chosenOtherId = it.itemCode || it.materialId;
        const matchedOtherMat = (materials || []).find(m => String(m.id) === String(chosenOtherId) || String(m.itemCode) === String(chosenOtherId));
        const effOtherCode = formatItemCode(chosenOtherId, matchedOtherMat, materials);
        const rawOtherName = cleanMaterialName(it.materialName || it.componentType || 'Other Accessory');
        const effOtherTitle = rawOtherName + (effOtherCode ? ` [${effOtherCode}]` : '');
        doc.text(effOtherTitle, im + 24, y + 15);

        doc.setFont('helvetica', 'normal');
        doc.text(it.unit || 'Mtr', im + 180, y + 15);

        doc.setFont('helvetica', 'bold');
        doc.text('Direct Floor Issue', im + 290, y + 15);

        doc.text(`${quantity || 0} Pcs`, im + 375, y + 15);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(109, 40, 217);
        doc.text(`= ${it.totalQty || 1} ${it.unit || 'Mtr'}(s)`, pw - im - 10, y + 15, { align: 'right' });
        doc.setTextColor(0, 0, 0);

        y += rowH;
      });
    }

    // Table Outer Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(im, y, pw - im, y);

    // ── Total Material Requirement Summary Bar ──
    const totH = 24;
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, totH, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(im, y, iw, totH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL MATERIAL REQUIREMENT ON BILL (${modeLabel}):`, im + 8, y + 15);

    doc.setFontSize(9.5);
    const totalDisplay = effectiveMode === 'bone'
      ? `${String(effBoneTot).includes('Kg') ? effBoneTot : `${effBoneTot} Kg`} (Direct Weight Issue)`
      : effectiveMode === 'other'
        ? `${cleanMaterialName(data.otherMaterialName || otherMaterialName || 'Material')}: ${data.rolls || otherRollCount || 1} ${data.otherUnit || otherUnit || 'Roll'}(s)`
        : effectiveMode === 'tape'
          ? `${((quantity || 0) / 45).toFixed(2)} Rolls  ===>  TOTAL = ${effTapeRolls} ROLL(S)`
          : withoutLotMode
            ? `${quantity || 0} Pcs ÷ ${effDiv} (${width || '1 Inch'})  ===>  TOTAL = ${effRolls} ROLL(S)`
            : `${grandTotalMtr.toFixed(2).replace(/\.00$/, '')} Mtr / ${effDiv}  ===>  TOTAL = ${effRolls} ROLL(S)`;
    doc.text(totalDisplay, pw - im - 10, y + 15, { align: 'right' });
    y += totH + 18;

    // ── 3. FORMULA BREAKDOWN & INSTRUCTIONS ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text((effectiveMode === 'bone' || effectiveMode === 'other') ? '3. ISSUE INSTRUCTIONS & ALLOCATION' : '3. FORMULA BREAKDOWN & INSTRUCTIONS', im + 8, y + 12);
    y += 24;

    const boxH = 48;
    doc.setFillColor(255, 255, 255);
    doc.rect(im, y, iw, boxH, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, boxH, 'S');

    if (effectiveMode === 'elastic') {
      if (withoutLotMode) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        const exactElasticRolls = effDiv > 0 ? ((quantity || 0) / effDiv).toFixed(2) : effRolls;
        doc.text(`Step 1 (Elastic Allocation): ${quantity || 0} Pcs ÷ ${effDiv} Divisor (${width || '1 Inch'}) = ${exactElasticRolls} Rolls`, im + 8, y + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(4, 120, 87);
        doc.text(`Step 2 (Final Calculation): Math.ceil(${exactElasticRolls})  ===>  FINAL ISSUE = ${effRolls} ROLL(S) (${width || '1 Inch'})`, im + 8, y + 28);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`Step 1 (Meter Conversion): ${elasticSizeInput} ${elasticUnit} * 0.0254 = ${elasticPerPcMtr} Mtr/Pc  x  ${quantity || 0} Pcs = ${totalElasticMtr} Mtr`, im + 8, y + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(4, 120, 87);
        const exactElasticRolls = effDiv > 0 ? ((parseFloat(totalElasticMtr) || 0) / effDiv).toFixed(2) : effRolls;
        doc.text(`Step 2 (Final Calculation): ${totalElasticMtr} Mtr / ${effDiv} Mtr = ${exactElasticRolls} Rolls  ===>  FINAL ISSUE = ${effRolls} ROLL(S) (${width || '1 Inch'})`, im + 8, y + 28);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const remText = remarks || `Standard internal material issue bill for Elastic (${style || 'Garment'}). Cutting Qty: ${quantity || 0} Pcs.`;
      doc.text(`Remarks: ${remText}`, im + 8, y + 41);

    } else if (effectiveMode === 'tape') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const exactTapeRolls = ((quantity || 0) / 45).toFixed(2);
      doc.text(`Step 1 (Tape Allocation): ${quantity || 0} Pcs / 45 Pcs per Roll = ${exactTapeRolls} Rolls`, im + 8, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(29, 78, 216);
      doc.text(`Step 2 (Final Calculation): Math.ceil(${exactTapeRolls})  ===>  FINAL ISSUE = ${effTapeRolls} ROLL(S) (${tapeWidth || '0.5 Inch'})`, im + 8, y + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const remText = remarks || `Standard internal material issue bill for Tape (${style || 'Garment'}). Cutting Qty: ${quantity || 0} Pcs.`;
      doc.text(`Remarks: ${remText}`, im + 8, y + 41);

    } else if (effectiveMode === 'bone') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Step 1 (Bone Weight Allocation): Direct floor stock issue in Kilograms (Kg-Wise)`, im + 8, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(3, 105, 161);
      doc.text(`Step 2 (Final Floor Issue): Weight = ${effBoneTot}  ===>  FINAL ISSUE = ${effBoneTot}`, im + 8, y + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const remText = remarks || `Standard internal material issue bill for Bone (${style || 'Garment'}).`;
      doc.text(`Remarks: ${remText}`, im + 8, y + 41);

    } else if (effectiveMode === 'other') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Step 1 (Other Accessory Allocation): Direct floor stock issue for ${cleanMaterialName(data.otherMaterialName || otherMaterialName || 'Other Accessory')}`, im + 8, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(109, 40, 217);
      doc.text(`Step 2 (Final Issue): Total Issue = ${data.rolls || otherRollCount || 1} ${data.otherUnit || otherUnit || 'Roll'}(s)`, im + 8, y + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const remText = (remarks && !remarks.toLowerCase().includes('elastic waistband'))
        ? remarks
        : `Direct material floor issue for ${cleanMaterialName(data.otherMaterialName || otherMaterialName || 'Other Accessory')} (${style || 'Garment'}).`;
      doc.text(`Remarks: ${remText}`, im + 8, y + 41);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`Elastic: ${elasticSizeInput} ${elasticUnit} = ${elasticPerPcMtr}m * ${quantity}pcs = ${totalElasticMtr}m / ${effDiv} = ${effRolls} Rolls`, im + 8, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(4, 120, 87);
      doc.text(`Tape: ${quantity} Pcs / 45 = ${effTapeRolls} Rolls | Bone: ${effBoneTot}`, im + 8, y + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Remarks: ${remarks || 'Standard internal combined material issue bill.'}`, im + 8, y + 41);
    }

    doc.setTextColor(0, 0, 0);
    y += boxH + 14;

    // ── 4. VERIFICATION & SIGNATURES ──
    doc.setFillColor(242, 242, 242);
    doc.rect(im, y, iw, 17, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(im, y, iw, 17, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('4. VERIFICATION & SIGNATURES', im + 8, y + 12);
    y += 26;

    const sigColW = (iw - 20) / 3;

    // Box 1: Store Staff (Issuer)
    const x1 = im;
    doc.setFillColor(255, 255, 255);
    doc.rect(x1, y, sigColW, 64, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(x1, y, sigColW, 64, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('ISSUED BY (STORE STAFF)', x1 + 6, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Name: ', x1 + 6, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(issuerName || 'STORE STAFF', x1 + 38, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date}`, x1 + 6, y + 39);
    doc.text('Sign: ____________________', x1 + 6, y + 54);

    // Box 2: Cutting Master (Receiver)
    const x2 = x1 + sigColW + 10;
    doc.setFillColor(255, 255, 255);
    doc.rect(x2, y, sigColW, 64, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(x2, y, sigColW, 64, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('RECEIVED BY (CUTTING MASTER)', x2 + 6, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Name: ', x2 + 6, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(receiverName || 'CUTTING MASTER', x2 + 38, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date}`, x2 + 6, y + 39);
    doc.text('Sign: ____________________', x2 + 6, y + 54);

    // Box 3: Supervisor Approval
    const x3 = x2 + sigColW + 10;
    doc.setFillColor(255, 255, 255);
    doc.rect(x3, y, sigColW, 64, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(x3, y, sigColW, 64, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('SUPERVISOR / AUTHORIZED', x3 + 6, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Name: ', x3 + 6, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(supervisorName || 'SUPERVISOR', x3 + 38, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date}`, x3 + 6, y + 39);
    doc.text('Sign: ____________________', x3 + 6, y + 54);

    // Official Footer (Subtle B&W)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Official Material Issue Bill / Purchase Order (Original) • Mohit Hosiery Quality & Production Management', pw / 2, ph - 30, { align: 'center' });

    return doc;
  };

  // Navigation helpers to BOM Creation & Approval Queue
  const handleCreateBOM = (targetLot = null) => {
    const lot = targetLot || lotDetails?.lotNo || searchLotInput.trim();
    if (lot) {
      setPrefilledLotNo(lot);
    }
    if (typeof onNavigate === 'function') {
      onNavigate('design');
    }
  };

  const handleViewApprovalQueue = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('approval_queue');
    }
  };

  // ── Generate Professional Original Issue Bill / PO / W/O PO Slip ─────────────────────────────
  const generateElasticIssueBill = async () => {
    const enteredLotNo = (lotDetails?.lotNo || searchLotInput || '').trim();
    if (!withoutLotActive && !enteredLotNo) {
      showToast('Please enter a Lot Number for With BOM issue.', 'error');
      return;
    }

    // Lot Number is required for Elastic, Tape, Bone (only optional in Other Accessories)
    if (withoutLotActive && materialMode !== 'other' && !enteredLotNo) {
      const modeLabel = materialMode === 'tape' ? 'Tape' : materialMode === 'bone' ? 'Bone' : 'Elastic';
      showToast(`Lot Number is required for ${modeLabel} issue. Only Other Accessories can be issued without a Lot Number.`, 'error');
      return;
    }

    // MANDATORY WORKFLOW RULE: BOM MUST BE CREATED AND APPROVED (UNLESS WITHOUT BOM / W/O PO MODE)
    if (!withoutLotActive && bomStatus !== 'approved') {
      if (bomStatus === 'not_created') {
        showToast('Workflow Blocked: BOM is not created for this Lot! Create BOM first or switch to "Without BOM" mode.', 'error');
      } else if (bomStatus === 'pending') {
        showToast('Workflow Blocked: BOM is Pending Approval! Approve in queue or switch to "Without BOM" mode.', 'error');
      } else if (bomStatus === 'rejected') {
        showToast('Workflow Blocked: BOM was rejected! Revise in Design View or switch to "Without BOM" mode.', 'error');
      } else {
        showToast('Workflow Blocked: BOM must be created and Approved before issue, or switch to "Without BOM" mode.', 'error');
      }
      return;
    }

    if (!issuerName || !receiverName) {
      showToast('Please provide both Issuer and Receiver names.', 'error');
      return;
    }

    setGenerating(true);
    try {
      // Ensure slip prefix matches active mode in without lot mode
      let currentSlipNo = issueSlipNo;
      if (withoutLotActive) {
        const expectedPrefix = materialMode === 'tape' ? 'tape-w/o-' : materialMode === 'bone' ? 'bone-w/o-' : materialMode === 'other' ? 'other-w/o-' : 'elastic-w/o-';
        if (!currentSlipNo || !currentSlipNo.toLowerCase().startsWith(expectedPrefix)) {
          currentSlipNo = await fetchNextIssueSlipNo(true, materialMode);
        }
      } else if (!currentSlipNo) {
        currentSlipNo = await fetchNextIssueSlipNo(false);
      }
      const currentLotNo = (enteredLotNo || (withoutLotActive ? 'W/O LOT' : '')).toUpperCase();
      const totalOtherQty = otherItems.reduce((sum, it) => sum + (Number(it.totalQty) || 0), 0) || parseFloat(otherRollCount) || 1;
      const currentQuantity = parseInt(issuePcs || lotDetails?.quantity || activeLotCutting?.totalPieces || (materialMode === 'other' ? totalOtherQty : 0) || 0, 10);
      const effTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
      const calculatedTapeRolls = Math.ceil(currentQuantity / effTapeDiv) || 1;
      const calculatedElasticRolls = withoutLotActive
        ? (Math.ceil(currentQuantity / effectiveDivisor) || 1)
        : (calcResult.recommendedRolls || Math.ceil((calcResult.totalElasticMtr || 0) / effectiveDivisor) || rollCount || 1);
      const calculatedRolls = materialMode === 'tape'
        ? calculatedTapeRolls
        : materialMode === 'other'
          ? totalOtherQty
          : calculatedElasticRolls;

      const payload = {
        slipNo: currentSlipNo,
        lotNo: currentLotNo,
        isWithoutLot: withoutLotActive,
        isWithoutPo: withoutLotActive,
        rolls: materialMode === 'bone' ? (boneRollCount ? Number(boneRollCount) : (parseFloat(boneWeightKg) || 1)) : calculatedRolls,
        otherRollCount: totalOtherQty,
        otherMaterialName: otherItems.map(it => it.materialName || it.componentType).filter(Boolean).join(', ') || otherMaterialName || 'Other Accessory',
        otherUnit: otherItems[0]?.unit || otherUnit || 'Roll',
        otherItems: otherItems.map(it => ({
          id: it.id,
          componentType: it.componentType || 'ACCESSORY',
          materialId: it.materialId || '',
          materialName: it.materialName || it.componentType || 'Accessory Item',
          itemCode: it.itemCode || formatItemCode(it.materialId, null, materials) || '',
          entryMode: it.entryMode || 'choose',
          availableStock: it.availableStock || 0,
          totalQty: Number(it.totalQty) || 1,
          unit: it.unit || 'Mtr',
          color: it.color || '',
          location: it.location || 'Main Store'
        })),
        tapeRolls: calculatedTapeRolls,
        totalTapeRolls: calculatedTapeRolls,
        width: effectiveWidth,
        tapeWidth: effectiveTapeWidth,
        boneWidth: effectiveBoneWidth,
        boneRolls: boneRollCount ? `${boneRollCount} Roll(s) (${boneWeightKg || '0'} Kg)` : `${boneWeightKg || '0'} Kg`,
        boneRollCount: boneRollCount || '',
        boneWeightKg: boneWeightKg || '0',
        weight: boneWeightKg || '0',
        shade: selectedShade || lotDetails?.shade || 'Standard Shade',
        issuerName,
        receiverName,
        supervisorName: supervisorName || lotDetails?.supervisor || 'ROHIT / MONU',
        date: issueDate,
        style: withoutLotActive ? (withoutLotStyle || 'Floor Issue') : (lotDetails?.style || 'LOWER'),
        brand: lotDetails?.brand || 'Mohit Hosiery',
        garmentType: lotDetails?.garmentType || 'LOWER',
        fabric: lotDetails?.fabric || 'Cotton Poly Blend',
        quantity: currentQuantity,
        cuttingQty: parseInt(lotDetails?.quantity || currentQuantity, 10),
        issuePcs: currentQuantity,
        size: lotDetails?.size || 'M, L, XL, 2XL',
        elasticPerPcMtr: calcResult.elasticPerPcMtr,
        totalElasticMtr: calcResult.totalElasticMtr,
        tapePerPcMtr: calcResult.tapePerPcMtr,
        totalTapeMtr: calcResult.totalTapeMtr,
        elasticSizeInput,
        elasticUnit,
        tapeSizeInput,
        tapeUnit,
        materialMode,
        elasticMaterialName: cleanMaterialName(elasticMaterialName),
        selectedElasticMaterialId,
        elasticItemCode: formatItemCode(selectedElasticMaterialId, currentElasticMaterial, materials),
        tapeMaterialName: cleanMaterialName(tapeMaterialName),
        selectedTapeMaterialId,
        tapeItemCode: formatItemCode(selectedTapeMaterialId, currentTapeMaterial, materials),
        boneMaterialName: cleanMaterialName(boneMaterialName),
        selectedBoneMaterialId,
        boneItemCode: formatItemCode(selectedBoneMaterialId, currentBoneMaterial, materials),
        selectedOtherMaterialId,
        otherItemCode: formatItemCode(selectedOtherMaterialId, currentOtherMaterial, materials),
        formulaExplanation: calcResult.formulaExplanation,
        remarks: remarks || (isWithoutPo ? 'Floor Material Issue without PO' : '')
      };

      const doc = await createElasticIssuePDFDocument(payload);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const generatedData = {
        ...payload,
        doc,
        pdfUrl,
        isSaved: false
      };

      setGeneratedSlipData(generatedData);
      showToast(`Bill ${currentSlipNo} preview ready. Review and confirm to save.`);
    } catch (err) {
      console.error('Issue bill generation error:', err);
      showToast(err.message || 'Failed to generate Original Bill.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const [savingSlip, setSavingSlip] = useState(false);

  const handleConfirmAndSaveBill = async () => {
    if (!generatedSlipData) return;
    setSavingSlip(true);
    try {
      const deducted = await saveToHistory(generatedSlipData);
      await fetchNextIssueSlipNo();
      setGeneratedSlipData(prev => prev ? { ...prev, isSaved: true } : null);
      if (Array.isArray(deducted) && deducted.length > 0) {
        const summary = deducted.map(d => `${d.materialName}: -${d.totalRequired} ${d.unit} (Stock: ${d.stockAfter})`).join(', ');
        showToast(`Original Bill ${generatedSlipData.slipNo} saved & Stock Deducted! [${summary}]`, 'success');
      } else {
        showToast(`Original Material Issue Bill ${generatedSlipData.slipNo} confirmed and saved successfully!`);
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save bill details.', 'error');
    } finally {
      setSavingSlip(false);
    }
  };

  const handleDownloadPDF = () => {
    if (generatedSlipData?.doc) {
      generatedSlipData.doc.save(`${generatedSlipData.slipNo}_Original_Material_Issue_Bill.pdf`);
    }
  };

  const handlePrintBill = () => {
    if (generatedSlipData?.pdfUrl) {
      const printWin = window.open(generatedSlipData.pdfUrl, '_blank');
      if (printWin) {
        printWin.focus();
      } else {
        alert('Please allow popups to open print preview.');
      }
    }
  };

  const handleReprintFromHistory = async (item) => {
    try {
      const isItemWithoutLot = Boolean(item.isWithoutLot || item.isWithoutPo || !item.lotNo || item.lotNo === 'W/O-LOT' || item.lotNo === 'W/O-PO-FLOOR' || String(item.slipNo).toLowerCase().includes('-w/o-'));
      const isOther = String(item.slipNo || '').toLowerCase().startsWith('other');
      const itemMode = isOther
        ? 'other'
        : String(item.slipNo || '').toLowerCase().startsWith('tape')
          ? 'tape'
          : String(item.slipNo || '').toLowerCase().startsWith('bone')
            ? 'bone'
            : String(item.slipNo || '').toLowerCase().startsWith('elastic')
              ? 'elastic'
              : (item.materialMode || materialMode);

      const doc = await createElasticIssuePDFDocument({
        ...item,
        otherMaterialName: item.otherMaterialName || 'Other Accessory',
        otherRollCount: item.otherRollCount || item.rolls || 1,
        otherUnit: item.otherUnit || 'Roll',
        otherItems: item.otherItems || [],
        selectedOtherMaterialId: item.selectedOtherMaterialId || '',
        slipNo: item.slipNo,
        lotNo: item.lotNo,
        isWithoutLot: isItemWithoutLot,
        isWithoutPo: isItemWithoutLot,
        width: item.width || item.elasticWidth || '1 Inch (Standard)',
        tapeWidth: item.tapeWidth || '0.5 Inch (Standard)',
        boneWidth: item.boneWidth || '1.5 Inch (Standard)',
        shade: item.shade || 'Standard',
        issuerName: item.issuerName || 'Store Staff',
        receiverName: item.receiverName || 'Cutting Master',
        supervisorName: item.supervisorName || 'ROHIT / MONU',
        date: item.date || new Date().toISOString().split('T')[0],
        style: item.style || 'LOWER',
        brand: item.brand || 'Mohit Hosiery',
        garmentType: item.garmentType || 'LOWER',
        fabric: item.fabric || 'Cotton Poly Blend',
        quantity: item.quantity || item.issuePcs || 0,
        size: item.size || 'M, L, XL, 2XL',
        elasticPerPcMtr: item.elasticPerPcMtr || calcResult.elasticPerPcMtr,
        totalElasticMtr: item.totalElasticMtr || calcResult.totalElasticMtr,
        tapePerPcMtr: item.tapePerPcMtr || calcResult.tapePerPcMtr,
        totalTapeMtr: item.totalTapeMtr || calcResult.totalTapeMtr,
        elasticSizeInput,
        elasticUnit,
        tapeSizeInput,
        tapeUnit,
        materialMode: itemMode,
        formulaExplanation: item.formulaExplanation || calcResult.formulaExplanation,
        remarks: item.remarks || ''
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setGeneratedSlipData({
        ...item,
        doc,
        pdfUrl,
        isSaved: true
      });
    } catch (err) {
      console.error('Reprint error:', err);
      showToast('Failed to open bill for printing.', 'error');
    }
  };

  const handlePrintAllDetails = (format = 'register') => {
    if (!processedHistory || processedHistory.length === 0) {
      showToast('No records found to print for the selected filter.', 'error');
      return;
    }

    const printWin = window.open('', '_blank', 'width=1200,height=850');
    if (!printWin) {
      alert('Popup was blocked by your browser. Please allow popups to open the print report.');
      return;
    }

    const totalSlips = processedHistory.length;
    const totalPcs = processedHistory.reduce((sum, item) => sum + Number(item.quantity || item.issuePcs || 0), 0);
    const totalRolls = processedHistory.reduce((sum, item) => {
      if (item.tapeRolls) return sum + Number(item.tapeRolls);
      if (item.boneRolls) return sum + Number(item.boneRolls);
      if (item.rolls) return sum + Number(item.rolls);
      return sum + 1;
    }, 0);

    const filterLabels = {
      all: 'All Slips (Consolidated History)',
      elastic_wo: 'Elastic W/O BOM (Internal Roll Issue)',
      tape_wo: 'Tape W/O BOM (Drawcord / Tape Issue)',
      bone_wo: 'Bone W/O BOM (Chinese Piping Issue)',
      other_wo: 'Other Accessories W/O BOM (Direct Issue)',
      standard: 'With LOT (BOM Approved Issue)'
    };
    const activeFilterLabel = filterLabels[historyLineFilter] || 'All Slips';
    const sortLabels = {
      seq_asc: 'Sequence Ascending (#1, #2, #3...)',
      seq_desc: 'Latest Sequence Descending',
      date_desc: 'Newest Date First',
      date_asc: 'Oldest Date First'
    };
    const activeSortLabel = sortLabels[historySortMode] || 'Sequence Order';

    const tableRowsHtml = processedHistory.map((item, idx) => {
      const meta = getSlipMeta(item.slipNo);
      const isWO = Boolean(String(item.slipNo || '').toLowerCase().includes('-w/o-') || item.isWithoutLot || item.isWithoutPo);
      const lotDisplay = isWO
        ? (item.lotNo && item.lotNo !== 'W/O-LOT' && item.lotNo !== 'W/O-PO-FLOOR' ? `LOT #${item.lotNo} (W/O BOM)` : 'W/O BOM (Floor)')
        : `LOT #${item.lotNo || '—'}`;

      const perPc = String(item.slipNo || '').toLowerCase().includes('tape-') || item.tapeRolls
        ? '1/45 Roll'
        : String(item.slipNo || '').toLowerCase().includes('bone-') || item.boneRolls
          ? '18 CM Cut'
          : (item.elasticPerPcMtr || item.elastic_per_pc_mtr ? `${item.elasticPerPcMtr || item.elastic_per_pc_mtr} Mtr` : '—');

      const totalReq = String(item.slipNo || '').toLowerCase().includes('tape-') || item.tapeRolls
        ? `${item.tapeRolls || item.rolls || Math.ceil((item.quantity || item.issuePcs || 0) / 45)} Roll(s)`
        : String(item.slipNo || '').toLowerCase().includes('bone-') || item.boneRolls
          ? `${item.boneRolls || item.rolls || 1} Roll(s)`
          : (item.totalElasticMtr || item.total_elastic_mtr ? `${item.totalElasticMtr || item.total_elastic_mtr} Mtr` : `${item.rolls || 1} Roll(s)`);

      return `
        <tr>
          <td style="text-align: center; font-weight: 800; font-family: monospace;">#${idx + 1}</td>
          <td style="font-weight: 800; font-family: monospace; white-space: nowrap;">
            ${item.slipNo || '—'}
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <span class="badge" style="border: 1px solid #000000; color: #000000; background: #ffffff; padding: 2px 6px; font-weight: 800;">
              ${meta.badgeText}
            </span>
          </td>
          <td style="text-align: center; white-space: nowrap; font-size: 10px;">${item.date || '—'}</td>
          <td style="font-weight: 700; font-size: 10.5px;">${lotDisplay}</td>
          <td style="text-align: center; font-weight: 700;">${item.style || item.garmentType || 'LOWER'}</td>
          ${!historyLineFilter.includes('wo') ? `
            <td style="text-align: center; font-weight: 800;">${item.quantity || item.issuePcs ? `${item.quantity || item.issuePcs} Pcs` : '—'}</td>
            <td style="text-align: center; font-weight: 700;">${perPc}</td>
          ` : ''}
          <td style="text-align: center; font-weight: 900; font-size: 11px;">${totalReq}</td>
          <td style="text-align: center; font-size: 10px;">${item.issuerName || 'STORE STAFF'}</td>
          <td style="text-align: center; font-size: 10px; font-weight: 800;">${item.receiverName || 'CUTTING MASTER'}</td>
          <td style="text-align: center; font-size: 10px; font-weight: 700;">${item.supervisorName || 'ROHIT / MONU'}</td>
        </tr>
      `;
    }).join('');

    const vouchersHtml = processedHistory.map((item, idx) => {
      const meta = getSlipMeta(item.slipNo);
      const isWO = Boolean(String(item.slipNo || '').toLowerCase().includes('-w/o-') || item.isWithoutLot || item.isWithoutPo);
      const lotDisplay = isWO
        ? (item.lotNo && item.lotNo !== 'W/O-LOT' && item.lotNo !== 'W/O-PO-FLOOR' ? `LOT #${item.lotNo}` : 'DIRECT FLOOR')
        : `LOT #${item.lotNo || '—'}`;

      const totalReq = String(item.slipNo || '').toLowerCase().includes('tape-') || item.tapeRolls
        ? `${item.tapeRolls || item.rolls || Math.ceil((item.quantity || item.issuePcs || 0) / 45)} Roll(s)`
        : String(item.slipNo || '').toLowerCase().includes('bone-') || item.boneRolls
          ? `${item.boneRolls || item.rolls || 1} Roll(s)`
          : (item.totalElasticMtr || item.total_elastic_mtr ? `${item.totalElasticMtr || item.total_elastic_mtr} Mtr` : `${item.rolls || 1} Roll(s)`);

      return `
        <div class="voucher-card">
          <div class="voucher-header">
            <div>
              <div class="vh-company">MOHIT HOSIERY</div>
              <div class="vh-title">${isWO ? 'MATERIAL ISSUE SLIP (W/O BOM - FLOOR ISSUE)' : 'OFFICIAL MATERIAL ISSUE VOUCHER'}</div>
              <div class="vh-sub">Store &amp; Accessories Department • Issue Line: ${meta.badgeText}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-family: monospace; font-size: 13px; font-weight: 900;">SLIP: ${item.slipNo}</div>
              <div style="font-size: 10px; color: #333;">Seq #${idx + 1} • Date: ${item.date || '—'}</div>
              <div style="display: inline-block; padding: 2px 6px; font-size: 9.5px; font-weight: 800; border: 1px solid #000; border-radius: 4px; margin-top: 3px;">
                ${isWO ? 'DIRECT ISSUE (WITHOUT BOM)' : 'WITH APPROVED BOM'}
              </div>
            </div>
          </div>

          <table class="voucher-table">
            <tr>
              <td style="width: 25%;"><strong>Lot Number:</strong></td>
              <td style="width: 25%; font-weight: 800;">${lotDisplay}</td>
              <td style="width: 25%;"><strong>Garment Quantity:</strong></td>
              <td style="width: 25%; font-weight: 800; font-size: 11.5px;">${item.quantity || item.issuePcs || 0} Pcs</td>
            </tr>
            <tr>
              <td><strong>Garment / Style:</strong></td>
              <td style="font-weight: 700;">${item.style || item.garmentType || 'LOWER'}</td>
              <td><strong>Fabric / Shade:</strong></td>
              <td>${item.fabric || 'Cotton Poly Blend'} / ${item.shade || 'Standard'}</td>
            </tr>
            <tr>
              <td><strong>Accessory Material:</strong></td>
              <td style="font-weight: 700;">${meta.badgeText}</td>
              <td><strong>Total Issued:</strong></td>
              <td style="font-weight: 900; font-size: 12px; color: #047857;">${totalReq}</td>
            </tr>
            <tr>
              <td><strong>Issued By:</strong></td>
              <td>${item.issuerName || 'STORE STAFF'}</td>
              <td><strong>Received By:</strong></td>
              <td style="font-weight: 800;">${item.receiverName || 'CUTTING MASTER'}</td>
            </tr>
            <tr>
              <td><strong>Floor Supervisor:</strong></td>
              <td>${item.supervisorName || 'ROHIT / MONU'}</td>
              <td><strong>Remarks / Notes:</strong></td>
              <td>${(item.remarks && !String(item.remarks).trim().startsWith('[') && !String(item.remarks).trim().startsWith('{')) ? item.remarks : 'Standard Issue'}</td>
            </tr>
          </table>

          <div class="voucher-signatures">
            <div class="sig-box">Store Staff (Issued)</div>
            <div class="sig-box">Cutting Master (Received)</div>
            <div class="sig-box">Supervisor (ROHIT / MONU)</div>
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Elastic &amp; Material Issue History - MH Store</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 6mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }
          body {
            margin: 0;
            padding: 12px;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print-bar {
            background: #0f172a;
            color: #ffffff;
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .btn-print {
            background: #000000;
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.4);
            padding: 7px 16px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-toggle {
            background: #334155;
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 7px 14px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            margin-left: 8px;
          }
          .btn-close {
            background: #64748b;
            color: #ffffff;
            border: none;
            padding: 7px 14px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0 !important; }
            thead { display: table-header-group !important; }
            tr { page-break-inside: avoid !important; }
            .voucher-card { page-break-inside: avoid !important; margin-bottom: 24px !important; }
          }
          .header-box {
            border-bottom: 2px solid #000000;
            padding-bottom: 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .company-title {
            font-size: 17px;
            font-weight: 900;
            color: #000000;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
          }
          .doc-title {
            font-size: 12.5px;
            font-weight: 800;
            color: #000000;
            margin: 0;
          }
          .doc-sub {
            font-size: 10px;
            color: #333333;
            margin-top: 2px;
          }
          .meta-info {
            text-align: right;
            font-size: 10px;
            color: #000000;
            line-height: 1.4;
          }
          .summary-strip {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
          }
          .summary-card {
            flex: 1;
            border: 1px solid #000000;
            padding: 6px 8px;
            font-size: 10px;
            text-align: center;
          }
          .summary-card span {
            display: block;
            font-size: 9px;
            color: #475569;
            font-weight: 700;
          }
          .summary-card strong {
            display: block;
            font-size: 13px;
            color: #000000;
            margin-top: 2px;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          table.report-table th, table.report-table td {
            border: 1.5px solid #000000;
            padding: 6px 7px;
            vertical-align: middle;
            color: #000000;
          }
          table.report-table th {
            background-color: #f8fafc;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 9.5px;
            letter-spacing: 0.03em;
            text-align: left;
            color: #000000;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            white-space: nowrap;
          }
          .footer-signs {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            page-break-inside: avoid;
          }
          .sign-box {
            border-top: 1px solid #000000;
            width: 190px;
            text-align: center;
            padding-top: 6px;
            font-weight: 700;
          }
          .voucher-card {
            border: 1.5px solid #000000;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 16px;
            background: #ffffff;
          }
          .voucher-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1.5px solid #000000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .vh-company { font-size: 14px; font-weight: 900; }
          .vh-title { font-size: 11px; font-weight: 800; }
          .vh-sub { font-size: 9.5px; color: #475569; }
          table.voucher-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 8px;
          }
          table.voucher-table td {
            border: 1px solid #e2e8f0;
            padding: 5px 8px;
          }
          .voucher-signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px dashed #cbd5e1;
            font-size: 9.5px;
          }
          .sig-box {
            font-weight: 700;
            color: #334155;
            border-top: 1px solid #000;
            padding-top: 4px;
            width: 160px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn-print" onclick="window.print()">🖨️ Print Now (Black &amp; White)</button>
            <button class="btn-toggle" onclick="toggleView()" id="toggleBtn">
              ${format === 'vouchers' ? '📋 Switch to Register Table' : '📑 Switch to All Slips (Vouchers)'}
            </button>
            <span style="font-size: 12px; color: #cbd5e1; margin-left: 6px;">A4 Landscape • High Contrast Ink-Saver</span>
          </div>
          <button class="btn-close" onclick="window.close()">✕ Close Preview</button>
        </div>

        <!-- 1. Register Table View -->
        <div id="registerView" style="${format === 'vouchers' ? 'display: none;' : 'display: block;'}">
          <div class="header-box">
            <div>
              <div class="company-title">MOHIT HOSIERY</div>
              <div class="doc-title">ELASTIC &amp; MATERIAL ISSUE REGISTER (ALL DETAILS)</div>
              <div class="doc-sub">MH Textiles &amp; Accessories Store • Internal Floor Issue Records</div>
            </div>
            <div class="meta-info">
              <div><strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              <div><strong>Line Filter:</strong> ${activeFilterLabel.toUpperCase()}</div>
              <div><strong>Sort Order:</strong> ${activeSortLabel.toUpperCase()}</div>
              <div><strong>Total Slips:</strong> ${totalSlips}</div>
              <div><strong>Printed By:</strong> ${(currentUser?.name || 'STORE STAFF').toUpperCase()}</div>
            </div>
          </div>

          <div class="summary-strip">
            <div class="summary-card">
              <span>TOTAL ISSUE SLIPS</span>
              <strong>${totalSlips}</strong>
            </div>
            ${!historyLineFilter.includes('wo') ? `
            <div class="summary-card">
              <span>TOTAL GARMENT PCS</span>
              <strong>${totalPcs.toLocaleString('en-IN')} Pcs</strong>
            </div>
            ` : ''}
            <div class="summary-card">
              <span>TOTAL ROLLS ISSUED</span>
              <strong>${totalRolls} Roll(s)</strong>
            </div>
            <div class="summary-card">
              <span>ISSUE LINE TRACK</span>
              <strong>${activeFilterLabel}</strong>
            </div>
            <div class="summary-card">
              <span>DESTINATION FLOOR</span>
              <strong>CUTTING FLOOR</strong>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">SEQ #</th>
                <th>BILL / SLIP NO</th>
                <th style="text-align: center;">LINE TYPE</th>
                <th style="text-align: center;">DATE</th>
                <th>LOT NO</th>
                <th style="text-align: center;">ITEM / STYLE</th>
                ${!historyLineFilter.includes('wo') ? `
                  <th style="text-align: center;">PCS</th>
                  <th style="text-align: center;">PER PC REQ.</th>
                ` : ''}
                <th style="text-align: center;">TOTAL ISSUE</th>
                <th style="text-align: center;">ISSUED BY</th>
                <th style="text-align: center;">RECEIVED BY</th>
                <th style="text-align: center;">SUPERVISOR</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-signs">
            <div class="sign-box">Prepared / Issued By<br/><small style="font-weight: normal; color: #444;">Store Incharge</small></div>
            <div class="sign-box">Received By<br/><small style="font-weight: normal; color: #444;">Cutting Master</small></div>
            <div class="sign-box">Verified By<br/><small style="font-weight: normal; color: #444;">Floor Supervisor (ROHIT / MONU)</small></div>
            <div class="sign-box">Authorized Signatory<br/><small style="font-weight: normal; color: #444;">Production Manager</small></div>
          </div>
        </div>

        <!-- 2. Individual Vouchers View -->
        <div id="vouchersView" style="${format === 'vouchers' ? 'display: block;' : 'display: none;'}">
          <div class="header-box" style="margin-bottom: 14px;">
            <div>
              <div class="company-title">MOHIT HOSIERY</div>
              <div class="doc-title">BATCH MATERIAL ISSUE VOUCHERS (${totalSlips} SLIPS)</div>
              <div class="doc-sub">Full Voucher Printout for All Filtered Records</div>
            </div>
            <div class="meta-info">
              <div><strong>Printed Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
              <div><strong>Filter:</strong> ${activeFilterLabel}</div>
              <div><strong>Total Vouchers:</strong> ${totalSlips}</div>
            </div>
          </div>
          ${vouchersHtml}
        </div>

        <script>
          function toggleView() {
            var reg = document.getElementById('registerView');
            var vou = document.getElementById('vouchersView');
            var btn = document.getElementById('toggleBtn');
            if (reg.style.display === 'none') {
              reg.style.display = 'block';
              vou.style.display = 'none';
              btn.innerText = '📑 Switch to All Slips (Vouchers)';
            } else {
              reg.style.display = 'none';
              vou.style.display = 'block';
              btn.innerText = '📋 Switch to Register Table';
            }
          }
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  return (
    <div style={{ padding: '20px 24px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
          padding: '14px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff', fontWeight: '700', boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(8px)'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="panel" style={{
        padding: '18px 24px',
        borderRadius: '16px',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #dbeafe)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35)',
            flexShrink: 0
          }}>
            <Sliders size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Elastic Issue (Internal Roll Issue)
              </h1>
              <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                Internal Floor Issue
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
              Search Lot Number, specify quantity of rolls, width, enter Issuer & Receiver names, and generate official Issue Voucher.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Issue Form vs History) */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-primary, #f0fdf4)', padding: '5px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
          <button
            type="button"
            onClick={() => setViewMode('generator')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '700',
              background: viewMode === 'generator' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: viewMode === 'generator' ? '#ffffff' : 'var(--text-muted, #64748b)',
              boxShadow: viewMode === 'generator' ? '0 2px 8px rgba(5, 150, 105, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={14} /> New Elastic Issue
          </button>
          <button
            type="button"
            onClick={() => setViewMode('history')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '700',
              background: viewMode === 'history' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: viewMode === 'history' ? '#ffffff' : 'var(--text-muted, #64748b)',
              boxShadow: viewMode === 'history' ? '0 2px 8px rgba(5, 150, 105, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Calendar size={14} /> Issue Slips History
          </button>
        </div>
      </div>

      {viewMode === 'generator' ? (
        <>
          {/* STEP 1: SEARCH LOT NUMBER */}
          <div className="panel" style={{
            padding: '22px 24px',
            borderRadius: '16px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #dbeafe)',
            boxShadow: 'var(--shadow-card)'
          }}>
            {/* ISSUE METHOD SELECTOR: WITH BOM vs WITHOUT BOM */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Issue Method:
                </span>
                <div style={{ display: 'inline-flex', background: '#ffffff', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1', gap: '3px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWithoutLot(false);
                      setIsWithoutPo(false);
                      setLotDetails(null);
                      setSearchLotInput('');
                      setBomStatus('idle');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: !withoutLotActive ? '#0f172a' : 'transparent',
                      color: !withoutLotActive ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <ShieldCheck size={14} /> With BOM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWithoutLot(true);
                      setIsWithoutPo(true);
                      setBomStatus('idle');
                      if (!lotDetails) {
                        setLotDetails({
                          lotNo: searchLotInput.trim() || '',
                          style: withoutLotStyle || 'Floor Issue',
                          quantity: issuePcs || 0,
                          brand: 'Floor Issue',
                          garmentType: withoutLotStyle || 'Floor Issue',
                          fabric: 'Standard',
                          shade: 'Standard'
                        });
                      }
                      if (materialMode === 'both' || materialMode === 'all') {
                        setMaterialMode('elastic');
                      }
                      if (searchLotInput.trim() && (!lotDetails || !lotDetails.quantity)) {
                        handleSearchLot(searchLotInput.trim());
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: withoutLotActive ? '#0f172a' : 'transparent',
                      color: withoutLotActive ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Zap size={14} /> Without BOM (Direct Issue)
                  </button>
                </div>
              </div>

              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#64748b' }}>
                {withoutLotActive
                  ? 'Direct floor requisition without BOM'
                  : 'Verify Lot against approved BOM'}
              </span>
            </div>

            {/* STEP 1: CONDITIONAL DISPLAY FOR WITHOUT BOM VS WITH BOM */}
            {withoutLotActive ? (
              <div style={{
                marginBottom: '16px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: '#0f172a', color: '#ffffff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800'
                    }}>1</span>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', letterSpacing: '0.2px' }}>
                      Floor Movement Details (Without BOM)
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Voucher No: <strong style={{ color: '#0f172a' }}>{issueSlipNo || 'Loading...'}</strong>
                    <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>DIRECT ISSUE</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {/* Lot Number (Optional for Other Accessories, Required for Elastic / Tape / Bone) */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      LOT NUMBER {materialMode === 'other' ? (
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'none' }}>(Optional)</span>
                      ) : (
                        <>
                          <span style={{ color: '#ef4444' }}>*</span>{' '}
                          <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '700', textTransform: 'none' }}>
                            (Required for {materialMode === 'tape' ? 'Tape' : materialMode === 'bone' ? 'Bone' : 'Elastic'})
                          </span>
                        </>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder={materialMode === 'other' ? "Enter Lot # (e.g. 62114) - Optional" : "Enter Lot # (e.g. 62114) * Required"}
                      value={searchLotInput}
                      onChange={(e) => setSearchLotInput(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: (withoutLotActive && materialMode !== 'other' && !searchLotInput) ? '1.5px solid #f87171' : '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box',
                        outline: 'none', transition: 'border-color 0.15s ease'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                      onBlur={(e) => { e.target.style.borderColor = (withoutLotActive && materialMode !== 'other' && !searchLotInput) ? '#f87171' : '#cbd5e1'; }}
                    />
                  </div>

                  {/* Style / Garment Name */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      STYLE / GARMENT ITEM
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lower, Tracksuit, Shirt..."
                      value={withoutLotStyle}
                      onChange={(e) => setWithoutLotStyle(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '13px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box',
                        outline: 'none', transition: 'border-color 0.15s ease'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                    />
                  </div>

                  {/* Quantity Pcs / Weight */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {materialMode === 'bone' ? 'TARGET ISSUE WEIGHT (KGS)' : 'TARGET CUTTING / ISSUE PCS'} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        step={materialMode === 'bone' ? '0.01' : '1'}
                        min={materialMode === 'bone' ? '0.01' : '1'}
                        placeholder={materialMode === 'bone' ? 'e.g. 2.50' : 'e.g. 3000'}
                        value={materialMode === 'bone' ? boneWeightKg : issuePcs}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (materialMode === 'bone') {
                            setBoneWeightKg(val);
                          } else {
                            if (val === '') {
                              setIssuePcs('');
                            } else {
                              const parsed = parseInt(val, 10);
                              setIssuePcs(isNaN(parsed) ? '' : Math.max(1, parsed));
                            }
                          }
                        }}
                        style={{
                          flex: 1, padding: '9px 12px', borderRadius: '8px',
                          border: '1px solid #cbd5e1', background: '#ffffff',
                          fontSize: '13.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box',
                          outline: 'none', transition: 'border-color 0.15s ease'
                        }}
                        onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                      />
                      {materialMode === 'bone' && (
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', background: '#f1f5f9', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          Kg
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: '#059669', color: '#ffffff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800'
                    }}>1</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                      Search Lot Number
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                    Voucher No: <strong style={{ color: '#059669' }}>{issueSlipNo || 'Loading...'}</strong>
                  </div>
                </div>

                {/* Search Input Box */}
                <div style={{ display: 'flex', gap: '10px', maxWidth: '640px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Enter Lot Number (auto-searches on typing)..."
                      value={searchLotInput}
                      onChange={(e) => setSearchLotInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSearchLot(); }}
                      style={{
                        width: '100%',
                        padding: '11px 16px 11px 38px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border-color, #cbd5e1)',
                        background: 'var(--bg-input, #f8fafc)',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--text-main, #0f172a)',
                        boxSizing: 'border-box'
                      }}
                    />
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    {searchingLot && (
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11.5px', fontWeight: '700', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw size={12} className="animate-spin" /> Searching...
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSearchLot()}
                    disabled={searchingLot}
                    style={{
                      padding: '0 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: searchingLot ? 'wait' : 'pointer',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {searchingLot ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                    <span>{searchingLot ? 'Searching...' : 'Search Lot'}</span>
                  </button>
                </div>

                {/* Approved BOM Lots Quick Selector */}
                {approvedDesignsList.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(5, 150, 105, 0.06)',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} /> Ready to Issue (Approved BOM Lots):
                    </span>
                    {approvedDesignsList.slice(0, 8).map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setSearchLotInput(d.id); handleSearchLot(d.id); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #86efac',
                          background: (lotDetails?.lotNo === d.id || searchLotInput === d.id) ? '#059669' : '#ffffff',
                          color: (lotDetails?.lotNo === d.id || searchLotInput === d.id) ? '#ffffff' : '#047857',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        <span>LOT #{d.id}</span>
                        <span style={{ opacity: 0.8, fontSize: '10px' }}>({d.style || 'Garment'})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent suggestions */}
                {recentLots.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Recent:</span>
                    {recentLots.map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setSearchLotInput(l); handleSearchLot(l); }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#f1f5f9',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Lot #{l}
                      </button>
                    ))}
                  </div>
                )}

                {lotError && (
                  <div style={{
                    marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626',
                    fontSize: '12.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <AlertTriangle size={16} />
                    <span>{lotError}</span>
                  </div>
                )}

                {/* BOM STATUS BANNER (APPROVAL WORKFLOW) */}
                {lotDetails && (
                  <div style={{
                    marginTop: '16px',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: bomStatus === 'approved' ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : bomStatus === 'pending' ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    border: bomStatus === 'approved' ? '1.5px solid #86efac' : bomStatus === 'pending' ? '1.5px solid #fcd34d' : '1.5px solid #fca5a5',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: bomStatus === 'approved' ? '#16a34a' : bomStatus === 'pending' ? '#d97706' : '#dc2626',
                          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {bomStatus === 'approved' ? <CheckCircle size={18} /> : bomStatus === 'pending' ? <Clock size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: '800',
                              color: bomStatus === 'approved' ? '#166534' : bomStatus === 'pending' ? '#92400e' : '#991b1b'
                            }}>
                              {bomStatus === 'approved' && '✓ BOM Approved & Verified for Issue'}
                              {bomStatus === 'pending' && `⏳ BOM Pending Approval (Status: ${bomDesign?.status || 'In Verification'})`}
                              {bomStatus === 'not_created' && '⚠️ BOM Not Created for this Lot'}
                              {bomStatus === 'rejected' && '❌ BOM Rejected by Admin'}
                              {bomStatus === 'idle' && 'Verifying BOM Status...'}
                            </h4>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: bomStatus === 'approved' ? '#bbf7d0' : bomStatus === 'pending' ? '#fde68a' : '#fecaca',
                              color: bomStatus === 'approved' ? '#14532d' : bomStatus === 'pending' ? '#78350f' : '#7f1d1d'
                            }}>
                              {bomStatus === 'approved' ? 'READY TO ISSUE' : 'ISSUE LOCKED'}
                            </span>
                          </div>

                          <p style={{
                            margin: '3px 0 0 0',
                            fontSize: '12px',
                            color: bomStatus === 'approved' ? '#15803d' : bomStatus === 'pending' ? '#b45309' : '#b91c1c',
                            fontWeight: '600',
                            lineHeight: '1.4'
                          }}>
                            {bomStatus === 'approved' && `BOM verified with ${(bomDesign?.bom || []).length} accessory items configured (${bomDesign?.style || lotDetails?.style || 'Garment Design'}). You are authorized to issue Elastic materials.`}
                            {bomStatus === 'pending' && `A BOM design was submitted for Lot #${lotDetails?.lotNo || searchLotInput}, but it is awaiting Admin Approval in the Approval Queue. Elastic materials can only be issued after approval.`}
                            {bomStatus === 'not_created' && `No Bill of Materials (BOM) found for Lot #${lotDetails?.lotNo || searchLotInput}. Workflow Rule: BOM must be created and approved first in Design Management.`}
                            {bomStatus === 'rejected' && `The BOM for Lot #${lotDetails?.lotNo || searchLotInput} was rejected. Please review and revise the BOM in Design Management.`}
                            {bomStatus === 'idle' && 'Checking if a verified BOM exists for this lot...'}
                          </p>
                        </div>
                      </div>

                      {/* 1-Click Action Buttons for Unapproved or Missing BOM */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {bomStatus === 'not_created' && (
                          <button
                            type="button"
                            onClick={() => handleCreateBOM(lotDetails?.lotNo || searchLotInput)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                              color: '#ffffff',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Plus size={15} /> Create BOM for Lot #{lotDetails?.lotNo || searchLotInput}
                          </button>
                        )}

                        {bomStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={handleViewApprovalQueue}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                color: '#ffffff',
                                fontSize: '12.5px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              Open Approval Queue
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateBOM(lotDetails?.lotNo || searchLotInput)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #f59e0b',
                                background: '#ffffff',
                                color: '#b45309',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              View/Edit BOM
                            </button>
                          </>
                        )}

                        {bomStatus === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleCreateBOM(lotDetails?.lotNo || searchLotInput)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#dc2626',
                              color: '#ffffff',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            Revise BOM in Design View
                          </button>
                        )}

                        {/* Quick 1-Click W/O PO Issue Bypass Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsWithoutPo(true);
                            if (!lotDetails) {
                              setLotDetails({
                                lotNo: searchLotInput || 'W/O-PO-FLOOR',
                                style: withoutLotStyle || 'Floor Issue',
                                quantity: issuePcs || 0,
                                brand: 'Mohit Hosiery',
                                garmentType: withoutLotStyle || 'LOWER',
                                fabric: 'Cotton Poly Blend',
                                shade: 'Standard'
                              });
                            }
                            if (searchLotInput.trim() && (!lotDetails || !lotDetails.quantity)) {
                              handleSearchLot(searchLotInput.trim());
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Zap size={15} /> ⚡ Issue W/O BOM (Bypass BOM)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── LIVE CUTTING DETAILS ACCORDING TO ENTERED LOT NUMBER (ALWAYS VISIBLE IN ALL MODES) ── */}
            {Boolean((searchLotInput && searchLotInput.trim()) || lotDetails?.lotNo) && (
              <div style={{
                marginTop: '16px',
                marginBottom: '16px',
                padding: '14px 18px',
                borderRadius: '10px',
                background: activeLotCutting?.hasDetails
                  ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                  : '#f8fafc',
                border: activeLotCutting?.hasDetails ? '1.5px solid #86efac' : '1px dashed #cbd5e1',
                boxShadow: activeLotCutting?.hasDetails ? '0 2px 8px rgba(34, 197, 94, 0.08)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                {/* Header of Cutting Card */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '10px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: activeLotCutting?.hasDetails ? '#dcfce7' : '#f1f5f9',
                      color: activeLotCutting?.hasDetails ? '#15803d' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Scissors size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                          Cutting Details &amp; Batch Metrics
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          fontFamily: 'monospace',
                          background: '#0f172a',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          Lot #{searchLotInput?.trim() || lotDetails?.lotNo || '—'}
                        </span>
                        {activeLotCutting?.hasDetails ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <CheckCircle2 size={11} /> Verified Cutting Sheet
                          </span>
                        ) : loadingActiveLotCutting ? (
                          <span style={{ fontSize: '11px', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={11} className="animate-spin" /> Checking cutting database...
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '2px 7px',
                            borderRadius: '6px'
                          }}>
                            No cutting sheet in DB
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => reloadCuttingCache(true)}
                          disabled={isReloadingCuttingCache}
                          title="Empty in-memory cache & reload cutting database now (Auto-reloads every 30 minutes)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            color: '#0284c7',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: '6px',
                            cursor: isReloadingCuttingCache ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <RefreshCw size={10} className={isReloadingCuttingCache ? "animate-spin" : ""} />
                          {isReloadingCuttingCache ? 'Reloading...' : 'Reload (30m Auto)'}
                        </button>
                        {cacheReloadNotice && (
                          <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '700' }}>
                            {cacheReloadNotice}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Production batch particulars automatically synchronized with Lot #{searchLotInput?.trim() || lotDetails?.lotNo || '—'} • Auto-refreshes every 30m
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      background: '#ffffff',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #86efac',
                      boxShadow: '0 1px 3px rgba(34, 197, 94, 0.12)'
                    }}>
                      <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        TOTAL CUTTING QUANTITY
                      </span>
                      <strong style={{ fontSize: '17px', fontWeight: '900', color: '#15803d' }}>
                        {(activeLotCutting?.totalPieces || (Number(lotDetails?.quantity) || 0)).toLocaleString()} <span style={{ fontSize: '12px' }}>Pcs</span>
                      </strong>
                    </div>

                    {activeLotCutting?.rows && activeLotCutting.rows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowActiveCuttingMatrix(!showActiveCuttingMatrix)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          border: showActiveCuttingMatrix ? '1.5px solid #0284c7' : '1px solid #bae6fd',
                          background: showActiveCuttingMatrix ? '#0284c7' : '#f0f9ff',
                          color: showActiveCuttingMatrix ? '#ffffff' : '#0369a1',
                          cursor: 'pointer',
                          boxShadow: '0 1px 4px rgba(2, 132, 199, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Eye size={13} />
                        {showActiveCuttingMatrix ? 'Hide Matrix' : `Matrix Breakdown (${activeLotCutting.rows.length} Colors)`}
                      </button>
                    )}
                  </div>
                </div>

                {/* 6 Particulars Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px'
                }}>
                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>GARMENT STYLE</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.style || lotDetails?.style || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>FABRIC</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.fabric || lotDetails?.fabric || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>BRAND / BUYER</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.brand || lotDetails?.brand || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>PARTY NAME</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.partyName || lotDetails?.partyName || 'Mohit Hosiery'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>SHADES</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', marginTop: '2px', wordBreak: 'break-word', maxHeight: '42px', overflowY: 'auto' }}>
                      {activeLotCutting?.shades || (activeLotCutting?.rows?.map(r => `${r.color} [${r.totalPcs || 0}]`).join(', ')) || lotDetails?.shade || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>SIZES</div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {activeLotCutting?.sizes || (activeSizes.length > 0 ? activeSizes.join(', ') : (lotDetails?.size || '—'))}
                    </div>
                  </div>
                </div>

                {/* Expandable Color-Size Cutting Matrix */}
                {showActiveCuttingMatrix && activeLotCutting?.rows && activeLotCutting.rows.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1.5px solid #bae6fd',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0369a1' }}>
                        Full Color-Size Cutting Matrix ({activeLotCutting.rows.length} Colors)
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Source: MySQL `cutting` / Master Google Sheets
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <thead>
                          <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '800', color: '#0369a1' }}>Color / Shade</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Table</th>
                            {activeSizes.map(sz => (
                              <th key={sz} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>{sz}</th>
                            ))}
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>Total Pcs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLotCutting.rows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '6px 10px', fontWeight: '800', color: '#0f172a' }}>{row.color}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontSize: '10.5px' }}>{row.cuttingTable || '—'}</td>
                              {activeSizes.map(sz => (
                                <td key={sz} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: row.sizes?.[sz] ? '700' : '400', color: row.sizes?.[sz] ? '#0f172a' : '#cbd5e1' }}>
                                  {row.sizes?.[sz] ? Number(row.sizes[sz]).toLocaleString() : '—'}
                                </td>
                              ))}
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>
                                {(Number(row.totalPcs) || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: '900', color: '#0f172a' }}>
                            <td colSpan={2} style={{ padding: '7px 10px' }}>Grand Total</td>
                            {activeSizes.map(sz => {
                              const szSum = activeLotCutting.rows.reduce((sum, r) => sum + (Number(r.sizes?.[sz]) || 0), 0);
                              return (
                                <td key={sz} style={{ padding: '7px 8px', textAlign: 'center', fontWeight: '900', color: '#0f172a' }}>
                                  {szSum.toLocaleString()}
                                </td>
                              );
                            })}
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '900', color: '#15803d' }}>
                              {(activeLotCutting.totalPieces || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BACKEND CALCULATION & STEP 2 (SHOWN AFTER LOT IS ENTERED & BOM APPROVED, OR IF W/O PO) */}
            {(lotDetails || isWithoutPo) && (bomStatus === 'approved' || isWithoutPo) && (
              <>
                {/* MATERIAL SWITCH CONTROLS (ELASTIC, TAPE, BONE) */}
                <div style={{
                  marginTop: '18px',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Material To Issue:</span>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {materialMode === 'bone' ? 'Bone Pocketing Selected • Choose Material from Stock or Custom Entry' : 'Select material type to configure consumption'}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#f1f5f9',
                    padding: '4px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      type="button"
                      onClick={() => setMaterialMode('elastic')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: materialMode === 'elastic' ? '#059669' : 'transparent',
                        color: materialMode === 'elastic' ? '#ffffff' : '#475569',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: materialMode === 'elastic' ? '0 2px 8px rgba(5, 150, 105, 0.35)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'elastic' ? '#a7f3d0' : '#059669' }}></span>
                      Elastic Only
                    </button>

                    <button
                      type="button"
                      onClick={() => setMaterialMode('tape')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: materialMode === 'tape' ? '#2563eb' : 'transparent',
                        color: materialMode === 'tape' ? '#ffffff' : '#475569',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: materialMode === 'tape' ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'tape' ? '#bfdbfe' : '#2563eb' }}></span>
                      Tape Only
                    </button>

                    <button
                      type="button"
                      onClick={() => setMaterialMode('bone')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: materialMode === 'bone' ? '#0284c7' : 'transparent',
                        color: materialMode === 'bone' ? '#ffffff' : '#475569',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: materialMode === 'bone' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'bone' ? '#bae6fd' : '#0284c7' }}></span>
                      Bone Only
                    </button>

                    <button
                      type="button"
                      onClick={() => setMaterialMode('other')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: materialMode === 'other' ? '#7c3aed' : 'transparent',
                        color: materialMode === 'other' ? '#ffffff' : '#475569',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: materialMode === 'other' ? '0 2px 8px rgba(124, 58, 237, 0.35)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: materialMode === 'other' ? '#e9d5ff' : '#7c3aed' }}></span>
                      Other Accessories
                    </button>

                    {!withoutLotActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMaterialMode('both')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: materialMode === 'both' ? '#0f172a' : 'transparent',
                            color: materialMode === 'both' ? '#ffffff' : '#475569',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: materialMode === 'both' ? '0 2px 8px rgba(15, 23, 42, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Sliders size={13} />
                          Elastic + Tape
                        </button>

                        <button
                          type="button"
                          onClick={() => setMaterialMode('all')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: materialMode === 'all' ? '#7c3aed' : 'transparent',
                            color: materialMode === 'all' ? '#ffffff' : '#475569',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: materialMode === 'all' ? '0 2px 8px rgba(124, 58, 237, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Layers size={13} />
                          All (Elastic + Tape + Bone)
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* MATERIAL ALLOCATION & CONVERSION CARDS */}
                {materialMode === 'other' ? (
                  /* OTHER ACCESSORIES MULTI-ITEM ALLOCATION & STOCK DEDUCTION (STANDALONE CARD) */
                  <div style={{
                    marginTop: '16px',
                    padding: '20px 22px',
                    borderRadius: '14px',
                    background: '#ffffff',
                    border: '1.5px solid #7c3aed',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.08)'
                  }}>
                    {/* Header with Icon, Title, Items Count & Quick Barcode Scanner */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
                          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)'
                        }}>
                          <Package size={20} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Other Accessories Manual Allocation &amp; Floor Issue</span>
                            <span style={{ fontSize: '11px', fontWeight: '800', background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: '12px' }}>
                              {otherItems.length} Item{otherItems.length > 1 ? 's' : ''} Configured
                            </span>
                          </h4>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            Pick materials from store inventory or type manual item names &bull; Issue multiple accessories in a single transaction
                          </span>
                        </div>
                      </div>

                      {/* Quick Barcode Scan */}
                      <form onSubmit={handleOtherBarcodeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            ref={otherBarcodeInputRef}
                            type="text"
                            placeholder="Scan Barcode / Enter Code..."
                            value={otherBarcodeInput}
                            onChange={(e) => setOtherBarcodeInput(e.target.value)}
                            style={{
                              padding: '7px 10px 7px 30px',
                              borderRadius: '8px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '12.5px',
                              width: '230px',
                              boxSizing: 'border-box',
                              outline: 'none'
                            }}
                          />
                          <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>
                        <button
                          type="submit"
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#0f172a',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Scan size={13} />
                          <span>Scan Add</span>
                        </button>
                      </form>
                    </div>

                    {/* Items Table */}
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.4px' }}>
                            <th style={{ padding: '10px 12px', width: '38px', textAlign: 'center' }}>#</th>
                            <th style={{ padding: '10px 12px', width: '160px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>COMPONENT / TYPE</span>
                                {customOtherComponentTypes.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowManageOtherTypesModal(true)}
                                    title="Manage custom types"
                                    style={{
                                      background: 'rgba(255,255,255,0.2)',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '2px 5px',
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      color: '#ffffff',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}
                                  >
                                    <Sliders size={10} />
                                    <span>({customOtherComponentTypes.length})</span>
                                  </button>
                                )}
                              </div>
                            </th>
                            <th style={{ padding: '10px 12px', minWidth: '280px' }}>STORE MATERIAL ITEM</th>
                            <th style={{ padding: '10px 12px', width: '105px', textAlign: 'center' }}>CURRENT STOCK</th>
                            <th style={{ padding: '10px 12px', width: '95px', textAlign: 'center' }}>METHOD</th>
                            <th style={{ padding: '10px 12px', width: '125px', textAlign: 'right' }}>ISSUE QUANTITY</th>
                            <th style={{ padding: '10px 12px', width: '75px', textAlign: 'center' }}>UNIT</th>
                            <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right' }}>BALANCE</th>
                            <th style={{ padding: '10px 12px', width: '42px', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherItems.map((item, idx) => {
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          placeholder="Type name (e.g. BUTTON)..."
                                          value={item.customComponentType || ''}
                                          onChange={(e) => handleUpdateOtherItem(item.id, 'customComponentType', e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              commitOtherCustomType(item.id, item.customComponentType);
                                            } else if (e.key === 'Escape') {
                                              handleUpdateOtherItem(item.id, 'isCustomType', false);
                                              handleUpdateOtherItem(item.id, 'customComponentType', '');
                                            }
                                          }}
                                          onBlur={() => {
                                            if (item.customComponentType && item.customComponentType.trim()) {
                                              commitOtherCustomType(item.id, item.customComponentType);
                                            }
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
                                          onClick={() => commitOtherCustomType(item.id, item.customComponentType)}
                                          title="Save and add to list"
                                          style={{
                                            background: '#059669',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            padding: '5px 8px',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                        >
                                          ✓ Add
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleUpdateOtherItem(item.id, 'isCustomType', false);
                                            handleUpdateOtherItem(item.id, 'customComponentType', '');
                                            handleUpdateOtherItem(item.id, 'componentType', allOtherComponentTypes[0] || 'DORI');
                                          }}
                                          title="Cancel"
                                          style={{
                                            background: '#f1f5f9',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            padding: '5px 7px',
                                            fontSize: '11px',
                                            color: '#64748b'
                                          }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      <span style={{ fontSize: '10px', color: '#ea580c', fontWeight: '600' }}>
                                        ↵ Enter or click ✓ Add to save
                                      </span>
                                    </div>
                                  ) : (
                                    <select
                                      value={item.componentType}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '__custom__') {
                                          handleUpdateOtherItem(item.id, 'isCustomType', true);
                                          handleUpdateOtherItem(item.id, 'customComponentType', '');
                                        } else if (val === '__manage__') {
                                          setShowManageOtherTypesModal(true);
                                        } else {
                                          handleUpdateOtherItem(item.id, 'componentType', val);
                                          handleUpdateOtherItem(item.id, 'isCustomType', false);
                                          if (val === 'DORI' || val === 'ELASTIC' || val === 'TAPE' || val === 'LACE') {
                                            if (!item.materialId) handleUpdateOtherItem(item.id, 'unit', 'Mtr');
                                          } else {
                                            if (!item.materialId) handleUpdateOtherItem(item.id, 'unit', 'Pcs');
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
                                      {otherComponentTypeOptions.map(opt => (
                                        <option
                                          key={opt.value}
                                          value={opt.value}
                                          style={{
                                            fontWeight: opt.value.startsWith('__') ? '600' : '700',
                                            color: opt.value === '__custom__' ? '#c2410c' : opt.value === '__manage__' ? '#475569' : '#0f172a'
                                          }}
                                        >
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>

                                {/* Material Item Selector or Manual Entry */}
                                <td style={{ padding: '8px 12px' }}>
                                  {item.entryMode === 'manual' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="text"
                                          placeholder="✏️ Type Material Name (e.g. 5mm White Dori)..."
                                          value={item.materialName || ''}
                                          onChange={(e) => handleUpdateOtherItem(item.id, 'materialName', e.target.value)}
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
                                            handleUpdateOtherItem(item.id, 'entryMode', 'choose');
                                            handleUpdateOtherItem(item.id, 'materialName', '');
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
                                          placeholder="Color / Shade (optional)"
                                          value={item.color || ''}
                                          onChange={(e) => handleUpdateOtherItem(item.id, 'color', e.target.value)}
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
                                          onChange={(e) => handleUpdateOtherItem(item.id, 'itemCode', e.target.value)}
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
                                          onChange={(matId) => handleSelectOtherRowMaterial(item.id, matId)}
                                          onSwitchToManual={() => {
                                            handleUpdateOtherItem(item.id, 'entryMode', 'manual');
                                            handleUpdateOtherItem(item.id, 'materialId', '');
                                            handleUpdateOtherItem(item.id, 'availableStock', 0);
                                          }}
                                          placeholder="🔍 Search & Choose Material (Name / Code)..."
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateOtherItem(item.id, 'entryMode', 'manual');
                                          handleUpdateOtherItem(item.id, 'materialId', '');
                                          handleUpdateOtherItem(item.id, 'availableStock', 0);
                                        }}
                                        title="Type custom material manually"
                                        style={{
                                          padding: '5px 8px',
                                          fontSize: '11px',
                                          borderRadius: '6px',
                                          border: '1.5px dashed #ea580c',
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

                                {/* Current Stock */}
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
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
                                      border: item.availableStock > 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {item.availableStock} {item.unit}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>—</span>
                                  )}
                                </td>

                                {/* Method: Direct Qty */}
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <div style={{
                                    background: '#f8fafc',
                                    color: '#475569',
                                    fontWeight: '800',
                                    fontSize: '11px',
                                    padding: '4px 6px',
                                    borderRadius: '5px',
                                    border: '1px solid #e2e8f0',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    Direct Qty
                                  </div>
                                </td>

                                {/* Issue Qty */}
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  {(() => {
                                    const qty = Number(item.totalQty) || 0;
                                    const liveMat = (materials || []).find(m => String(m.id) === String(item.materialId));
                                    const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(item.availableStock) || 0);
                                    const hasMaterial = Boolean(item.materialId && item.entryMode !== 'manual');
                                    const isStockShortage = hasMaterial && qty > rackStock;

                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                        <input
                                          type="number"
                                          step="any"
                                          min="0.01"
                                          value={item.totalQty === '' ? '' : item.totalQty}
                                          onChange={(e) => handleUpdateOtherItem(item.id, 'totalQty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                                          style={{
                                            width: '85px',
                                            padding: '5px 8px',
                                            borderRadius: '6px',
                                            border: isStockShortage ? '2px solid #dc2626' : '1.5px solid #cbd5e1',
                                            background: isStockShortage ? '#fef2f2' : '#ffffff',
                                            textAlign: 'right',
                                            fontSize: '13px',
                                            fontWeight: '800',
                                            color: isStockShortage ? '#b91c1c' : '#0f172a',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                          }}
                                        />
                                        {isStockShortage && (
                                          <span style={{
                                            fontSize: '9.5px',
                                            fontWeight: '800',
                                            color: '#991b1b',
                                            background: '#fee2e2',
                                            border: '1px solid #fca5a5',
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            ⛔ Exceeds ({rackStock})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>

                                {/* Unit */}
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) => handleUpdateOtherItem(item.id, 'unit', e.target.value)}
                                    style={{
                                      width: '60px',
                                      padding: '5px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '11.5px',
                                      fontWeight: '700',
                                      textAlign: 'center',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </td>

                                {/* Balance */}
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  {item.entryMode === 'manual' ? (
                                    <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Custom Issue</span>
                                  ) : item.materialId ? (
                                    <span style={{
                                      fontWeight: '800',
                                      color: isShortage ? '#dc2626' : '#059669',
                                      background: isShortage ? '#fef2f2' : '#f0fdf4',
                                      padding: '3px 7px',
                                      borderRadius: '5px',
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
                                    onClick={() => handleRemoveOtherItemRow(item.id)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#94a3b8',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: '4px',
                                      transition: 'color 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
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
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleAddOtherItemRow('DORI', '', 'choose')}
                          style={{
                            padding: '8px 18px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                            color: '#ffffff',
                            fontWeight: '800',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Plus size={15} />
                          <span>Add Accessory Item</span>
                        </button>
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>
                          Total: <strong>{otherItems.length}</strong> item{otherItems.length > 1 ? 's' : ''} &bull; <strong>{otherItems.reduce((sum, it) => sum + (Number(it.totalQty) || 0), 0)}</strong> units
                        </span>
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
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* BACKEND CALCULATION & CONVERSION CARD (ELASTIC, TAPE & BONE) */
                  <div style={{
                    marginTop: '16px',
                    padding: '18px 20px',
                    borderRadius: '14px',
                    background: '#ffffff',
                    border: materialMode === 'tape' ? '1.5px solid #3b82f6' : materialMode === 'bone' ? '1.5px solid #0284c7' : '1.5px solid #059669',
                    boxShadow: materialMode === 'tape' ? '0 4px 14px rgba(37, 99, 235, 0.08)' : materialMode === 'bone' ? '0 4px 14px rgba(2, 132, 199, 0.08)' : '0 4px 14px rgba(5, 150, 105, 0.08)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: materialMode === 'tape'
                            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                            : materialMode === 'bone'
                              ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                              : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff'
                        }}>
                          {materialMode === 'bone' ? <Layers size={18} /> : <Calculator size={18} />}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                            {materialMode === 'tape'
                              ? 'Tape Issue Allocation & Consumption (Pcs ÷ 45 Rule)'
                              : materialMode === 'bone'
                                ? 'Bone Pocketing Material Allocation & Floor Issue'
                                : withoutLotActive
                                  ? `Elastic Without BOM Allocation `
                                  : 'Automated Backend Meter Conversion & Consumption'}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {materialMode === 'tape'
                              ? <span>Formula: <strong>Pieces ÷ 45 = Rolls To Issue</strong> &bull; Direct piece allocation without size conversion</span>
                              : materialMode === 'bone'
                                ? <span>Direct Weight &amp; Roll Issue &bull; Choose bone material from inventory ({boneMaterials.length} items) or enter custom name</span>
                                : withoutLotActive
                                  ? <span>Divisors: <strong>1 Inch ÷ 25</strong> &bull; <strong>1.5 Inch ÷ 23</strong> &bull; <strong>2 Inch ÷ 23</strong> &bull; Formula: <strong>Issue Pcs ÷ Inch Divisor = Total Rolls</strong></span>
                                  : <span>Formulas: <strong>Inchs × 0.0254 = Mtr</strong> &bull; <strong>CMs ÷ 100 = Mtr</strong> &bull; <strong>Tape: Pcs ÷ 45 = Rolls</strong></span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* INPUT CONTROLS: ELASTIC, TAPE & BONE */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: materialMode === 'both' ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
                      gap: '16px',
                      padding: '16px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}>
                    {/* BONE POCKETING SPECIFICATION CARD */}
                    {materialMode === 'bone' && (
                      <div style={{
                        padding: '18px 20px',
                        borderRadius: '14px',
                        background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
                        border: '2px solid #38bdf8',
                        boxShadow: '0 4px 16px rgba(2, 132, 199, 0.09)'
                      }}>
                        {/* Card Header with Dual-Mode Toggle */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '14px',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#ffffff', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
                            }}>
                              <Package size={17} />
                            </div>
                            <div>
                              <label style={{ fontSize: '13.5px', fontWeight: '800', color: '#0369a1', margin: 0, display: 'block', letterSpacing: '0.2px' }}>
                                BONE / POCKETING SPECIFICATION
                              </label>
                              <span style={{ fontSize: '11px', color: '#0284c7' }}>
                                Pick bone roll / pocketing from live stock or enter custom material name
                              </span>
                            </div>
                          </div>

                          {/* Dual Mode Toggle: Choose Material vs Add Manually */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: '#e0f2fe',
                            padding: '3px',
                            borderRadius: '8px',
                            border: '1.5px solid #7dd3fc',
                            gap: '3px'
                          }}>
                            <button
                              type="button"
                              onClick={() => setBoneEntryMode('choose')}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: boneEntryMode === 'choose' ? '#0284c7' : 'transparent',
                                color: boneEntryMode === 'choose' ? '#ffffff' : '#0369a1',
                                fontSize: '11.5px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                boxShadow: boneEntryMode === 'choose' ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Box size={13} />
                              📦 Choose Material ({boneMaterials.length})
                            </button>

                            <button
                              type="button"
                              onClick={() => setBoneEntryMode('manual')}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: boneEntryMode === 'manual' ? '#0284c7' : 'transparent',
                                color: boneEntryMode === 'manual' ? '#ffffff' : '#0369a1',
                                fontSize: '11.5px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                boxShadow: boneEntryMode === 'manual' ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Edit2 size={13} />
                              ✍️ + Add Manually
                            </button>
                          </div>
                        </div>

                        {/* 2-Column Specification Controls */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                          gap: '14px',
                          background: '#ffffff',
                          padding: '16px',
                          borderRadius: '10px',
                          border: '1px solid #bae6fd',
                          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.04)'
                        }}>
                          {/* Col 1: Material Selection */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                  1. {boneEntryMode === 'choose' ? 'CHOOSE BONE MATERIAL FROM INVENTORY:' : 'ENTER BONE MATERIAL NAME:'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBoneEntryMode(boneEntryMode === 'choose' ? 'manual' : 'choose')}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#0284c7',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: 0
                                  }}
                                >
                                  {boneEntryMode === 'choose' ? '✍️ Type Custom Name' : '📋 Pick from Inventory'}
                                </button>
                              </div>

                              {boneEntryMode === 'choose' ? (
                                <div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <SearchableMaterialSelect
                                      materials={boneMaterials}
                                      value={selectedBoneMaterialId}
                                      onChange={handleSelectBoneMaterial}
                                      placeholder="🔍 Search & Choose Bone Material (with Photos)..."
                                      themeColor="#0284c7"
                                      componentHint="Bone"
                                      onPreviewPhoto={(photoData) => setPreviewPhotoUrl(photoData)}
                                      showCategoryFilter={false}
                                    />
                                  </div>

                                  {/* Selected Material Card with Image Swatch */}
                                  {currentBoneMaterial && (
                                    <div style={{
                                      display: 'flex',
                                      gap: '10px',
                                      alignItems: 'center',
                                      background: '#f8fafc',
                                      padding: '10px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #e2e8f0'
                                    }}>
                                      {(() => {
                                        const rawImg = currentBoneMaterial.imageUrl || currentBoneMaterial.image || currentBoneMaterial.photo;
                                        const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                        return cleanImg ? (
                                          <img
                                            src={cleanImg}
                                            alt={currentBoneMaterial.name}
                                            onClick={() => {
                                              setPreviewPhotoUrl({
                                                url: cleanImg,
                                                title: currentBoneMaterial.name || boneMaterialName || 'Bone Material',
                                                code: formatItemCode(currentBoneMaterial, null, materials),
                                                stock: `${currentBoneMaterial.stock || 0} ${currentBoneMaterial.unit || 'Kg'}`,
                                                location: currentBoneMaterial.location || ''
                                              });
                                            }}
                                            style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1', cursor: 'zoom-in' }}
                                            title="Click to view & zoom material photo"
                                          />
                                        ) : (
                                          <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                            <Package size={22} />
                                          </div>
                                        );
                                      })()}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {currentBoneMaterial.name}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '10.5px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                            ITEM CODE: {formatItemCode(currentBoneMaterial, null, materials)}
                                          </span>
                                          <span style={{ fontSize: '10.5px', background: (parseFloat(currentBoneMaterial.stock) > 0 ? '#dcfce7' : '#fee2e2'), color: (parseFloat(currentBoneMaterial.stock) > 0 ? '#166534' : '#991b1b'), padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                                            Stock: {currentBoneMaterial.stock} {currentBoneMaterial.unit || 'Kg/Roll'}
                                          </span>
                                          {currentBoneMaterial.location && (
                                            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                                              📍 {currentBoneMaterial.location}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="text"
                                    value={boneMaterialName}
                                    onChange={(e) => setBoneMaterialName(e.target.value)}
                                    placeholder="e.g. Bone Chinese 1.5 Inch (Beige)..."
                                    style={{
                                      width: '100%',
                                      padding: '9px 12px',
                                      borderRadius: '8px',
                                      border: '1.5px solid #0284c7',
                                      background: '#ffffff',
                                      fontSize: '13px',
                                      fontWeight: '700',
                                      color: '#0f172a',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                  <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                    Manually type the name of the bone / pocketing roll to issue.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Col 2: Weight, Roll Count, and Summary */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                                2. ISSUE WEIGHT &amp; ROLL METRICS:
                              </span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '3px' }}>
                                    TARGET WEIGHT (KG) <span style={{ color: '#ef4444' }}>*</span>
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={boneWeightKg}
                                    onChange={(e) => setBoneWeightKg(e.target.value)}
                                    placeholder="e.g. 2.50"
                                    style={{
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '13px',
                                      fontWeight: '800',
                                      color: '#0369a1',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '3px' }}>
                                    ROLL COUNT (ROLLS)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={boneRollCount}
                                    onChange={(e) => setBoneRollCount(e.target.value ? Number(e.target.value) : 1)}
                                    placeholder="1"
                                    style={{
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '13px',
                                      fontWeight: '800',
                                      color: '#0369a1',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                              </div>

                              <div style={{ marginTop: '10px' }}>
                                <label style={{ fontSize: '10px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '3px' }}>
                                  WIDTH / SPECIFICATION
                                </label>
                                <select
                                  value={boneWidth}
                                  onChange={(e) => setBoneWidth(e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: '#0f172a',
                                    background: '#ffffff',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <option value="1.5 Inch (Standard)">1.5 Inch (Standard)</option>
                                  <option value="1 Inch">1 Inch</option>
                                  <option value="1.25 Inch">1.25 Inch</option>
                                  <option value="1.75 Inch">1.75 Inch</option>
                                  <option value="2 Inch">2 Inch</option>
                                  <option value="Custom">Custom Width</option>
                                </select>
                              </div>
                            </div>

                            {/* Real-time Summary Badge */}
                            <div style={{
                              marginTop: '12px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1' }}>
                                📦 ISSUE SUMMARY:
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: '900', color: '#0284c7' }}>
                                {boneWeightKg || '2.50'} Kg &bull; {boneRollCount || 1} Roll(s) &bull; {boneMaterialName || 'Bone Pocketing'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ELASTIC INPUT: WITHOUT BOM DIRECT PIECE DIVISION BY INCH DIVISOR */}
                    {withoutLotActive && (materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                      <div style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        background: '#ecfdf5',
                        border: '1.5px solid #86efac',
                        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.06)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                          <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span>
                            ELASTIC ALLOCATION
                          </label>
                          <span style={{ fontSize: '11px', background: '#dcfce7', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                            Selected: {effectiveWidth} &bull; Rule: Pcs ÷ {effectiveDivisor}
                          </span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                          background: '#ffffff',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #bbf7d0',
                          alignItems: 'center'
                        }}>
                          {/* 1. Pieces Input */}
                          <div>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                              1. ENTER / VERIFY PIECES:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="1"
                                value={issuePcs}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setIssuePcs(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                                }}
                                placeholder="Enter Pcs..."
                                style={{
                                  width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px',
                                  border: '1.5px solid #059669', fontSize: '15px', fontWeight: '800',
                                  color: '#0f172a', background: '#f8fafc', outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#047857' }}>Pcs</span>
                            </div>
                          </div>

                          {/* 2. Inch Width & Divisor (Editable) */}
                          <div style={{ textAlign: 'center', borderLeft: '1px dashed #cbd5e1', borderRight: '1px dashed #cbd5e1', padding: '0 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b' }}>
                                2. INCH DIVISOR ({effectiveWidth}):
                              </span>
                              <span style={{ fontSize: '9px', background: '#dcfce7', color: '#047857', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                Editable
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', margin: '3px 0' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: '#047857', lineHeight: '1' }}>÷</span>
                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={customDivisor !== '' ? customDivisor : defaultElasticDivisor}
                                onChange={(e) => setCustomDivisor(e.target.value)}
                                title="Click to edit divisor number directly (e.g. 25, 23, 20...)"
                                style={{
                                  width: '68px',
                                  boxSizing: 'border-box',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  border: '2px solid #059669',
                                  background: '#ffffff',
                                  fontSize: '18px',
                                  fontWeight: '900',
                                  color: '#047857',
                                  textAlign: 'center',
                                  outline: 'none',
                                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.15)'
                                }}
                              />
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Pcs / Roll</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                              {[
                                { label: '1 Inch', div: 25 },
                                { label: '1.5 Inch', div: 23 },
                                { label: '2 Inch', div: 23 }
                              ].map(item => {
                                const isSelected = effectiveWidth.includes(item.label) && Number(effectiveDivisor) === item.div;
                                return (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => {
                                      setElasticWidth(item.label);
                                      setCustomDivisor(String(item.div));
                                    }}
                                    style={{
                                      padding: '1px 6px',
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      borderRadius: '4px',
                                      border: isSelected ? '1px solid #059669' : '1px solid #cbd5e1',
                                      background: isSelected ? '#dcfce7' : '#f8fafc',
                                      color: isSelected ? '#047857' : '#64748b',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {item.label} (÷{item.div})
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 3. Result Amount to Issue */}
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#047857', display: 'block', marginBottom: '4px' }}>
                              3. TOTAL ROLLS TO ISSUE:
                            </span>
                            <div style={{ fontSize: '22px', fontWeight: '900', color: '#047857', lineHeight: '1.1' }}>
                              {Math.ceil(parseInt(issuePcs || lotDetails?.quantity || 0, 10) / effectiveDivisor)} <span style={{ fontSize: '14px', fontWeight: '800' }}>Roll(s)</span>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginTop: '3px' }}>
                              ({parseInt(issuePcs || lotDetails?.quantity || 0, 10)} ÷ {effectiveDivisor} = {(parseInt(issuePcs || lotDetails?.quantity || 0, 10) / effectiveDivisor).toFixed(2)} Rolls)
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ELASTIC INPUT (WITH BOM STANDARD MODE) */}
                    {!withoutLotActive && (materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                      <div style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1.5px solid #86efac',
                        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.06)'
                      }}>
                        <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span>
                            ELASTIC SIZE INPUT
                          </span>
                          <span style={{ fontSize: '11px', background: '#dcfce7', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            Formula: {String(elasticUnit).toLowerCase() === 'cm' ? '÷ 100' : String(elasticUnit).toLowerCase() === 'mtr' ? '× 1' : String(elasticUnit).toLowerCase() === 'yard' ? '× 0.9144' : '× 0.0254'}
                          </span>
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={elasticSizeInput}
                            onChange={(e) => setElasticSizeInput(e.target.value)}
                            placeholder="e.g. 50"
                            style={{
                              width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px',
                              border: '1.5px solid #059669', fontSize: '16px', fontWeight: '800',
                              color: '#0f172a', background: '#ffffff', outline: 'none'
                            }}
                          />
                          <SmartSelectWithManual
                            value={elasticUnit}
                            onChange={setElasticUnit}
                            options={[
                              { label: 'Inch (×0.0254)', value: 'inch' },
                              { label: 'CM (÷100)', value: 'cm' },
                              { label: 'Mtr (×1)', value: 'mtr' },
                              { label: 'Yard (×0.9144)', value: 'yard' },
                              { label: 'MM (÷1000)', value: 'mm' }
                            ]}
                            placeholder="Unit"
                            manualPlaceholder="e.g. inch"
                            manualLabel="+ Manual Unit"
                            unitMode={true}
                            icon="ruler"
                            theme="emerald"
                          />
                        </div>

                        {/* Elastic Presets */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                          {[
                            { label: '50 Inch (1.27m)', size: '50', u: 'inch' },
                            { label: '32 Inch (0.81m)', size: '32', u: 'inch' },
                            { label: '40 Inch (1.02m)', size: '40', u: 'inch' }
                          ].map(p => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => {
                                setElasticSizeInput(p.size);
                                setElasticUnit(p.u);
                              }}
                              style={{
                                padding: '4px 9px', borderRadius: '6px',
                                border: elasticSizeInput === p.size && elasticUnit === p.u ? '1.5px solid #059669' : '1px solid #cbd5e1',
                                background: elasticSizeInput === p.size && elasticUnit === p.u ? '#dcfce7' : '#ffffff',
                                color: elasticSizeInput === p.size && elasticUnit === p.u ? '#059669' : '#475569',
                                fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAPE CONSUMPTION (DIRECT PIECES ÷ 45 RULE - NO SIZE INPUT) */}
                    {(materialMode === 'tape' || materialMode === 'both' || materialMode === 'all') && (
                      <div style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        background: '#eff6ff',
                        border: '1.5px solid #93c5fd',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                          <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                            TAPE ALLOCATION (DIRECT PIECES ÷ 45)
                          </label>
                          <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                            Formula: Issue Pcs ÷ 45 = Total Tape Rolls
                          </span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                          background: '#ffffff',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #bfdbfe',
                          alignItems: 'center'
                        }}>
                          {/* 1. Pieces Input */}
                          <div>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                              1. ENTER / VERIFY PIECES:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="1"
                                value={issuePcs}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setIssuePcs(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                                }}
                                placeholder="Enter Pcs..."
                                style={{
                                  width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px',
                                  border: '1.5px solid #3b82f6', fontSize: '15px', fontWeight: '800',
                                  color: '#0f172a', background: '#f8fafc', outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e40af' }}>Pcs</span>
                            </div>
                          </div>

                          {/* 2. Divisor 45 (Editable) */}
                          <div style={{ textAlign: 'center', borderLeft: '1px dashed #cbd5e1', borderRight: '1px dashed #cbd5e1', padding: '0 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b' }}>
                                2. STANDARD DIVISOR:
                              </span>
                              <span style={{ fontSize: '9px', background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                Editable
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', margin: '3px 0' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: '#1d4ed8', lineHeight: '1' }}>÷</span>
                              <input
                                type="number"
                                min="2"
                                step="any"
                                value={tapeDivisor !== '' && Number(tapeDivisor) > 1 ? tapeDivisor : 45}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTapeDivisor(val);
                                }}
                                title="Click to edit tape divisor (Standard: 45 pcs per roll)"
                                style={{
                                  width: '68px',
                                  boxSizing: 'border-box',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  border: '2px solid #2563eb',
                                  background: '#ffffff',
                                  fontSize: '18px',
                                  fontWeight: '900',
                                  color: '#1d4ed8',
                                  textAlign: 'center',
                                  outline: 'none',
                                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)'
                                }}
                              />
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Pcs / Roll</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                              {[
                                { label: '÷ 45 (Std)', val: '45' },
                                { label: '÷ 40', val: '40' },
                                { label: '÷ 50', val: '50' }
                              ].map(p => {
                                const isSel = (tapeDivisor === p.val || (p.val === '45' && (!tapeDivisor || tapeDivisor === '45' || Number(tapeDivisor) <= 1)));
                                return (
                                  <button
                                    key={p.val}
                                    type="button"
                                    onClick={() => setTapeDivisor(p.val)}
                                    style={{
                                      padding: '1px 5px',
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      borderRadius: '3px',
                                      border: isSel ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                      background: isSel ? '#dbeafe' : '#f8fafc',
                                      color: isSel ? '#1d4ed8' : '#64748b',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 3. Result Amount to Issue */}
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                              3. TAPE AMOUNT TO ISSUE:
                            </span>
                            {(() => {
                              const currentTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
                              const tapePcsNum = parseInt(issuePcs || lotDetails?.quantity || 0, 10);
                              const rollsToIssue = Math.ceil(tapePcsNum / currentTapeDiv);
                              const exactDec = (tapePcsNum / currentTapeDiv).toFixed(2);
                              return (
                                <>
                                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#1d4ed8', lineHeight: '1.1' }}>
                                    {rollsToIssue} <span style={{ fontSize: '14px', fontWeight: '800' }}>Roll(s)</span>
                                  </div>
                                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginTop: '3px' }}>
                                    ({tapePcsNum} ÷ {currentTapeDiv} = {exactDec} Rolls)
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* EXACT BREAKDOWN TABLE: ELASTIC, TAPE & BONE */}
                  <div style={{ marginTop: '16px', overflowX: 'auto', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#0f172a', color: '#ffffff', fontSize: '12px', fontWeight: '800' }}>
                          <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', minWidth: '290px' }}>Material (Editable & Mapped)</th>
                          <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'right' }}>Input</th>
                          <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'center' }}>Conversion Formula</th>
                          <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'right' }}>Per Pc (In Mtr)</th>
                          <th style={{ padding: '10px 14px', borderRight: '1px solid #334155', textAlign: 'right' }}>Pcs</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Requirement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const effPcs = parseInt(issuePcs || lotDetails?.quantity || 0, 10);
                          const ePerPc = parseFloat(calcResult.elasticPerPcMtr || (elasticUnit === 'cm' ? (parseFloat(elasticSizeInput) || 0) / 100 : (parseFloat(elasticSizeInput) || 0) * 0.0254).toFixed(4)) || 0;
                          const eTotal = parseFloat((ePerPc * effPcs).toFixed(4));

                          const effTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
                          const tapeExactRolls = effPcs > 0 ? parseFloat((effPcs / effTapeDiv).toFixed(2)) : 0;
                          const tapeCalculatedRolls = effPcs > 0 ? Math.ceil(effPcs / effTapeDiv) : 0;

                          return (
                            <>
                              {/* ELASTIC ROW */}
                              {(materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                                <tr style={{ background: '#ffffff', borderBottom: (materialMode === 'both' || materialMode === 'all') ? '1px solid #e2e8f0' : 'none' }}>
                                  <td style={{ padding: '10px 12px', borderRight: '1px solid #f1f5f9', minWidth: '320px' }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                      {/* Material Image Swatch Thumbnail */}
                                      {(() => {
                                        const rawImg = currentElasticMaterial?.imageUrl || currentElasticMaterial?.image || currentElasticMaterial?.photo || currentElasticMaterial?.imgUrl;
                                        const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                        return (
                                          <div
                                            onClick={() => {
                                              if (cleanImg) {
                                                setPreviewPhotoUrl({
                                                  url: cleanImg,
                                                  title: currentElasticMaterial?.name || elasticMaterialName || 'Elastic Material',
                                                  code: currentElasticMaterial?.id || currentElasticMaterial?.itemCode || '',
                                                  stock: `${currentElasticMaterial?.stock || 0} ${currentElasticMaterial?.unit || 'Roll'}`,
                                                  location: currentElasticMaterial?.location || ''
                                                });
                                              }
                                            }}
                                            title={cleanImg ? "Click to view & zoom material photo" : "No photo available for this elastic item"}
                                            style={{
                                              width: '56px',
                                              height: '56px',
                                              borderRadius: '8px',
                                              border: cleanImg ? '2px solid #059669' : '1.5px dashed #cbd5e1',
                                              background: cleanImg ? '#ffffff' : '#f8fafc',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                              cursor: cleanImg ? 'zoom-in' : 'default',
                                              overflow: 'hidden',
                                              boxShadow: cleanImg ? '0 2px 6px rgba(5, 150, 105, 0.2)' : 'none',
                                              position: 'relative',
                                              transition: 'all 0.15s ease',
                                              marginTop: '2px'
                                            }}
                                            onMouseEnter={(e) => { if (cleanImg) e.currentTarget.style.transform = 'scale(1.06)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                          >
                                            {cleanImg ? (
                                              <>
                                                <img
                                                  src={cleanImg}
                                                  alt={currentElasticMaterial?.name || 'Elastic'}
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                                <div style={{
                                                  position: 'absolute',
                                                  bottom: 0,
                                                  left: 0,
                                                  right: 0,
                                                  background: 'rgba(5, 150, 105, 0.85)',
                                                  color: '#ffffff',
                                                  fontSize: '8px',
                                                  fontWeight: '800',
                                                  textAlign: 'center',
                                                  padding: '1px 0',
                                                  letterSpacing: '0.5px'
                                                }}>
                                                  ZOOM
                                                </div>
                                              </>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <Package size={20} />
                                                <span style={{ fontSize: '7.5px', fontWeight: '700', marginTop: '2px', textTransform: 'uppercase' }}>No Photo</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {/* Right Controls: Name, Dropdown & Details */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Top: Bullet & Editable Material Name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', flexShrink: 0 }}></span>
                                          <div style={{ flex: 1, position: 'relative' }}>
                                            <input
                                              type="text"
                                              value={elasticMaterialName}
                                              onChange={(e) => setElasticMaterialName(e.target.value)}
                                              placeholder="Material Name (e.g. Elastic 1 Inch)..."
                                              title="Click to edit material name directly"
                                              style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '5px 8px',
                                                paddingRight: '26px',
                                                borderRadius: '6px',
                                                border: '1.5px solid #86efac',
                                                background: '#f0fdf4',
                                                color: '#047857',
                                                fontSize: '13px',
                                                fontWeight: '800',
                                                outline: 'none',
                                                transition: 'all 0.15s ease'
                                              }}
                                            />
                                            <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#059669', opacity: 0.7 }}>
                                              <Edit2 size={12} />
                                            </span>
                                          </div>
                                        </div>

                                        {/* Middle: Map to choose material dropdown (Elastic category only) */}
                                        <div style={{ marginBottom: '6px' }}>
                                          <SearchableMaterialSelect
                                            materials={elasticMaterials}
                                            value={selectedElasticMaterialId}
                                            onChange={handleSelectElasticMaterial}
                                            placeholder="🔍 Map Elastic Item (with Photos)..."
                                            themeColor="#059669"
                                            componentHint="Elastic"
                                            compact={true}
                                            showCategoryFilter={false}
                                            onPreviewPhoto={(photoData) => setPreviewPhotoUrl(photoData)}
                                          />
                                        </div>

                                        {/* Bottom: All material details according to issue */}
                                        {currentElasticMaterial ? (
                                          <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            alignItems: 'center',
                                            fontSize: '10.5px',
                                            background: '#ecfdf5',
                                            padding: '5px 7px',
                                            borderRadius: '6px',
                                            border: '1px dashed #a7f3d0'
                                          }}>
                                            <span style={{ fontWeight: '800', color: '#065f46', background: '#dcfce7', padding: '1px 5px', borderRadius: '3px' }}>
                                              ITEM CODE: {formatItemCode(currentElasticMaterial, null, materials)}
                                            </span>
                                            <span style={{ fontWeight: '700', color: currentElasticMaterial.stock > 0 ? '#047857' : '#dc2626' }}>
                                              Stock: {currentElasticMaterial.stock} {currentElasticMaterial.unit || 'Roll'}
                                            </span>
                                            {currentElasticMaterial.location && (
                                              <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <MapPin size={10} color="#059669" />
                                                {currentElasticMaterial.location}
                                              </span>
                                            )}
                                            <span style={{ color: '#047857', fontWeight: '800' }}>
                                              {effectiveDivisor === 25 ? '÷ 25 (1")' : `÷ ${effectiveDivisor} (${effectiveWidth})`}
                                            </span>
                                            {currentElasticMaterial.packets > 0 && (
                                              <span style={{ color: '#64748b' }}>
                                                {currentElasticMaterial.packets} Pkts
                                              </span>
                                            )}
                                            {(() => {
                                              const rawImg = currentElasticMaterial.imageUrl || currentElasticMaterial.image || currentElasticMaterial.photo || currentElasticMaterial.imgUrl;
                                              const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                              return cleanImg ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setPreviewPhotoUrl({
                                                    url: cleanImg,
                                                    title: currentElasticMaterial.name,
                                                    code: formatItemCode(currentElasticMaterial, null, materials),
                                                    stock: `${currentElasticMaterial.stock} ${currentElasticMaterial.unit || 'Roll'}`,
                                                    location: currentElasticMaterial.location
                                                  })}
                                                  style={{
                                                    border: 'none',
                                                    background: '#059669',
                                                    color: '#ffffff',
                                                    fontSize: '9.5px',
                                                    fontWeight: '800',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                  }}
                                                  title="Click to zoom image"
                                                >
                                                  🔍 View Photo
                                                </button>
                                              ) : null;
                                            })()}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', paddingLeft: '4px' }}>
                                            Custom Name • Select item above to map inventory & details
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                    {withoutLotActive ? `Direct (${effectiveWidth})` : `${elasticSizeInput || 0} ${elasticUnit === 'cm' ? 'CM' : 'Inch'}`}
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <code style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>
                                      {withoutLotActive ? `${effPcs} Pcs ÷ ${effectiveDivisor}` : (elasticUnit === 'cm' ? `${elasticSizeInput || 0} ÷ 100` : `${elasticSizeInput || 0} × 0.0254`)}
                                    </code>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '900', color: '#047857', fontSize: '14px', background: '#f0fdf4' }}>
                                    {withoutLotActive ? `1/${effectiveDivisor} Roll` : `${ePerPc} m`}
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                    {effPcs}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', background: '#dcfce7' }}>
                                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#065f46', lineHeight: '1.1' }}>
                                      {withoutLotActive ? Math.ceil(effPcs / effectiveDivisor) : Math.ceil(eTotal / effectiveDivisor)} <span style={{ fontSize: '13px', fontWeight: '800' }}>Rolls</span>
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#047857', marginTop: '2px' }}>
                                      {withoutLotActive ? `(${effPcs} ÷ ${effectiveDivisor} = ${(effPcs / effectiveDivisor).toFixed(2)} Rolls)` : `Total: ${eTotal} m • (÷ ${effectiveDivisor} for ${effectiveWidth})`}
                                    </div>
                                    <span style={{ fontSize: '10px', background: '#059669', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800', display: 'inline-block', marginTop: '3px' }}>
                                      Total Issue: {withoutLotActive ? Math.ceil(effPcs / effectiveDivisor) : Math.ceil(eTotal / effectiveDivisor)} Rolls
                                    </span>
                                  </td>
                                </tr>
                              )}

                              {/* TAPE ROW */}
                              {(materialMode === 'tape' || materialMode === 'both' || materialMode === 'all') && (
                                <tr style={{ background: '#ffffff', borderBottom: (materialMode === 'all') ? '1px solid #e2e8f0' : 'none' }}>
                                  <td style={{ padding: '10px 12px', borderRight: '1px solid #f1f5f9', minWidth: '320px' }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                      {/* Material Image Swatch Thumbnail */}
                                      {(() => {
                                        const rawImg = currentTapeMaterial?.imageUrl || currentTapeMaterial?.image || currentTapeMaterial?.photo || currentTapeMaterial?.imgUrl;
                                        const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                        return (
                                          <div
                                            onClick={() => {
                                              if (cleanImg) {
                                                setPreviewPhotoUrl({
                                                  url: cleanImg,
                                                  title: currentTapeMaterial?.name || tapeMaterialName || 'Tape Material',
                                                  code: currentTapeMaterial?.id || currentTapeMaterial?.itemCode || '',
                                                  stock: `${currentTapeMaterial?.stock || 0} ${currentTapeMaterial?.unit || 'Mtr'}`,
                                                  location: currentTapeMaterial?.location || ''
                                                });
                                              }
                                            }}
                                            title={cleanImg ? "Click to view & zoom material photo" : "No photo available for this tape item"}
                                            style={{
                                              width: '56px',
                                              height: '56px',
                                              borderRadius: '8px',
                                              border: cleanImg ? '2px solid #3b82f6' : '1.5px dashed #cbd5e1',
                                              background: cleanImg ? '#ffffff' : '#f8fafc',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                              cursor: cleanImg ? 'zoom-in' : 'default',
                                              overflow: 'hidden',
                                              boxShadow: cleanImg ? '0 2px 6px rgba(59, 130, 246, 0.22)' : 'none',
                                              position: 'relative',
                                              transition: 'all 0.15s ease',
                                              marginTop: '2px'
                                            }}
                                            onMouseEnter={(e) => { if (cleanImg) e.currentTarget.style.transform = 'scale(1.06)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                          >
                                            {cleanImg ? (
                                              <>
                                                <img
                                                  src={cleanImg}
                                                  alt={currentTapeMaterial?.name || 'Tape'}
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                                <div style={{
                                                  position: 'absolute',
                                                  bottom: 0,
                                                  left: 0,
                                                  right: 0,
                                                  background: 'rgba(30, 64, 175, 0.85)',
                                                  color: '#ffffff',
                                                  fontSize: '8px',
                                                  fontWeight: '800',
                                                  textAlign: 'center',
                                                  padding: '1px 0',
                                                  letterSpacing: '0.5px'
                                                }}>
                                                  ZOOM
                                                </div>
                                              </>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <Package size={20} />
                                                <span style={{ fontSize: '7.5px', fontWeight: '700', marginTop: '2px', textTransform: 'uppercase' }}>No Photo</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {/* Right Controls: Name, Dropdown & Details */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Top: Bullet & Editable Material Name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }}></span>
                                          <div style={{ flex: 1, position: 'relative' }}>
                                            <input
                                              type="text"
                                              value={tapeMaterialName}
                                              onChange={(e) => setTapeMaterialName(e.target.value)}
                                              placeholder="Tape Material Name (e.g. Tape 2 Inch)..."
                                              title="Click to edit tape material name directly"
                                              style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '5px 8px',
                                                paddingRight: '26px',
                                                borderRadius: '6px',
                                                border: '1.5px solid #93c5fd',
                                                background: '#eff6ff',
                                                color: '#1d4ed8',
                                                fontSize: '13px',
                                                fontWeight: '800',
                                                outline: 'none',
                                                transition: 'all 0.15s ease'
                                              }}
                                            />
                                            <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#3b82f6', opacity: 0.7 }}>
                                              <Edit2 size={12} />
                                            </span>
                                          </div>
                                        </div>

                                        {/* Middle: Map to choose material dropdown (Tape category only) */}
                                        <div style={{ marginBottom: '6px' }}>
                                          <SearchableMaterialSelect
                                            materials={tapeMaterials}
                                            value={selectedTapeMaterialId}
                                            onChange={handleSelectTapeMaterial}
                                            placeholder="🔍 Map Tape Item (with Photos)..."
                                            themeColor="#2563eb"
                                            componentHint="Tape"
                                            compact={true}
                                            showCategoryFilter={false}
                                            onPreviewPhoto={(photoData) => setPreviewPhotoUrl(photoData)}
                                          />
                                        </div>

                                        {/* Bottom: All material details according to issue */}
                                        {currentTapeMaterial ? (
                                          <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            alignItems: 'center',
                                            fontSize: '10.5px',
                                            background: '#eff6ff',
                                            padding: '5px 7px',
                                            borderRadius: '6px',
                                            border: '1px dashed #bfdbfe'
                                          }}>
                                            <span style={{ fontWeight: '800', color: '#1e40af', background: '#dbeafe', padding: '1px 5px', borderRadius: '3px' }}>
                                              ITEM CODE: {formatItemCode(currentTapeMaterial, null, materials)}
                                            </span>
                                            <span style={{ fontWeight: '700', color: currentTapeMaterial.stock > 0 ? '#1d4ed8' : '#dc2626' }}>
                                              Stock: {currentTapeMaterial.stock} {currentTapeMaterial.unit || 'Mtr'}
                                            </span>
                                            {currentTapeMaterial.location && (
                                              <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <MapPin size={10} color="#3b82f6" />
                                                {currentTapeMaterial.location}
                                              </span>
                                            )}
                                            {(() => {
                                              const rawImg = currentTapeMaterial.imageUrl || currentTapeMaterial.image || currentTapeMaterial.photo || currentTapeMaterial.imgUrl;
                                              const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                              return cleanImg ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setPreviewPhotoUrl({
                                                    url: cleanImg,
                                                    title: currentTapeMaterial.name,
                                                    code: formatItemCode(currentTapeMaterial, null, materials),
                                                    stock: `${currentTapeMaterial.stock} ${currentTapeMaterial.unit || 'Mtr'}`,
                                                    location: currentTapeMaterial.location
                                                  })}
                                                  style={{
                                                    border: 'none',
                                                    background: '#2563eb',
                                                    color: '#ffffff',
                                                    fontSize: '9.5px',
                                                    fontWeight: '800',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                  }}
                                                  title="Click to zoom image"
                                                >
                                                  🔍 View Photo
                                                </button>
                                              ) : null;
                                            })()}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', paddingLeft: '4px' }}>
                                            Custom Name • Select item above to map inventory & details
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#1d4ed8' }}>
                                    Direct ({effTapeDiv} Pcs/Roll)
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
                                      {effPcs} Pcs ÷ {effTapeDiv}
                                    </code>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#1d4ed8', fontSize: '13px', background: '#eff6ff' }}>
                                    1/{effTapeDiv} Roll
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                    {effPcs}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#1e3a8a', fontSize: '15px', background: '#dbeafe' }}>
                                    <div>
                                      <span style={{ fontSize: '16px' }}>{tapeCalculatedRolls} Roll(s)</span>
                                      {effPcs > 0 && (
                                        <span style={{ fontSize: '10.5px', display: 'block', color: '#64748b', fontWeight: '700' }}>
                                          ({tapeExactRolls} Exact)
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* BONE ROW (Shown if bone or all) */}
                              {(materialMode === 'bone' || materialMode === 'all') && (
                                <tr style={{ background: '#ffffff', borderBottom: 'none' }}>
                                  <td style={{ padding: '10px 12px', borderRight: '1px solid #f1f5f9', minWidth: '320px' }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                      {/* Material Image Swatch Thumbnail */}
                                      {(() => {
                                        const rawImg = currentBoneMaterial?.imageUrl || currentBoneMaterial?.image || currentBoneMaterial?.photo || currentBoneMaterial?.imgUrl;
                                        const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                        return (
                                          <div
                                            onClick={() => {
                                              if (cleanImg) {
                                                setPreviewPhotoUrl({
                                                  url: cleanImg,
                                                  title: currentBoneMaterial?.name || boneMaterialName || 'Bone Material',
                                                  code: currentBoneMaterial?.id || currentBoneMaterial?.itemCode || '',
                                                  stock: `${currentBoneMaterial?.stock || 0} ${currentBoneMaterial?.unit || 'Roll'}`,
                                                  location: currentBoneMaterial?.location || ''
                                                });
                                              }
                                            }}
                                            title={cleanImg ? "Click to view & zoom material photo" : "No photo available for this bone item"}
                                            style={{
                                              width: '56px',
                                              height: '56px',
                                              borderRadius: '8px',
                                              border: cleanImg ? '2px solid #0284c7' : '1.5px dashed #cbd5e1',
                                              background: cleanImg ? '#ffffff' : '#f8fafc',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                              cursor: cleanImg ? 'zoom-in' : 'default',
                                              overflow: 'hidden',
                                              boxShadow: cleanImg ? '0 2px 6px rgba(2, 132, 199, 0.22)' : 'none',
                                              position: 'relative',
                                              transition: 'all 0.15s ease',
                                              marginTop: '2px'
                                            }}
                                            onMouseEnter={(e) => { if (cleanImg) e.currentTarget.style.transform = 'scale(1.06)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                          >
                                            {cleanImg ? (
                                              <>
                                                <img
                                                  src={cleanImg}
                                                  alt={currentBoneMaterial?.name || 'Bone'}
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                                <div style={{
                                                  position: 'absolute',
                                                  bottom: 0,
                                                  left: 0,
                                                  right: 0,
                                                  background: 'rgba(2, 132, 199, 0.85)',
                                                  color: '#ffffff',
                                                  fontSize: '8px',
                                                  fontWeight: '800',
                                                  textAlign: 'center',
                                                  padding: '1px 0',
                                                  letterSpacing: '0.5px'
                                                }}>
                                                  ZOOM
                                                </div>
                                              </>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <Package size={20} />
                                                <span style={{ fontSize: '7.5px', fontWeight: '700', marginTop: '2px', textTransform: 'uppercase' }}>No Photo</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {/* Right Controls: Name, Dropdown & Details */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Top: Bullet & Editable Material Name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7', flexShrink: 0 }}></span>
                                          <div style={{ flex: 1, position: 'relative' }}>
                                            <input
                                              type="text"
                                              value={boneMaterialName}
                                              onChange={(e) => setBoneMaterialName(e.target.value)}
                                              placeholder="Bone Material Name (e.g. Bone Chinese)..."
                                              title="Click to edit bone material name directly"
                                              style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '5px 8px',
                                                paddingRight: '26px',
                                                borderRadius: '6px',
                                                border: '1.5px solid #7dd3fc',
                                                background: '#f0f9ff',
                                                color: '#0369a1',
                                                fontSize: '13px',
                                                fontWeight: '800',
                                                outline: 'none',
                                                transition: 'all 0.15s ease'
                                              }}
                                            />
                                            <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#0284c7', opacity: 0.7 }}>
                                              <Edit2 size={12} />
                                            </span>
                                          </div>
                                        </div>

                                        {/* Middle: Map to choose material dropdown (Bone category only) */}
                                        <div style={{ marginBottom: '6px' }}>
                                          <SearchableMaterialSelect
                                            materials={boneMaterials}
                                            value={selectedBoneMaterialId}
                                            onChange={handleSelectBoneMaterial}
                                            placeholder="🔍 Map Bone Item (with Photos)..."
                                            themeColor="#0284c7"
                                            componentHint="Bone"
                                            compact={true}
                                            showCategoryFilter={false}
                                            onPreviewPhoto={(photoData) => setPreviewPhotoUrl(photoData)}
                                          />
                                        </div>

                                        {/* Bottom: All material details according to issue */}
                                        {currentBoneMaterial ? (
                                          <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            alignItems: 'center',
                                            fontSize: '10.5px',
                                            background: '#f0f9ff',
                                            padding: '5px 7px',
                                            borderRadius: '6px',
                                            border: '1px dashed #bae6fd'
                                          }}>
                                            <span style={{ fontWeight: '800', color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: '3px' }}>
                                              ITEM CODE: {formatItemCode(currentBoneMaterial, null, materials)}
                                            </span>
                                            <span style={{ fontWeight: '700', color: currentBoneMaterial.stock > 0 ? '#0284c7' : '#dc2626' }}>
                                              Stock: {currentBoneMaterial.stock} {currentBoneMaterial.unit || 'Roll'}
                                            </span>
                                            {currentBoneMaterial.location && (
                                              <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <MapPin size={10} color="#0284c7" />
                                                {currentBoneMaterial.location}
                                              </span>
                                            )}
                                            {(() => {
                                              const rawImg = currentBoneMaterial.imageUrl || currentBoneMaterial.image || currentBoneMaterial.photo || currentBoneMaterial.imgUrl;
                                              const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                                              return cleanImg ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setPreviewPhotoUrl({
                                                    url: cleanImg,
                                                    title: currentBoneMaterial.name,
                                                    code: formatItemCode(currentBoneMaterial, null, materials),
                                                    stock: `${currentBoneMaterial.stock} ${currentBoneMaterial.unit || 'Roll'}`,
                                                    location: currentBoneMaterial.location
                                                  })}
                                                  style={{
                                                    border: 'none',
                                                    background: '#0284c7',
                                                    color: '#ffffff',
                                                    fontSize: '9.5px',
                                                    fontWeight: '800',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                  }}
                                                  title="Click to zoom image"
                                                >
                                                  🔍 View Photo
                                                </button>
                                              ) : null;
                                            })()}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', paddingLeft: '4px' }}>
                                            Custom Name • Select item above to map inventory & details
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                    Direct: {boneWeightKg || '0'} Kg
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <code style={{ background: '#f0f9ff', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>
                                      Weight-Wise Issue
                                    </code>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '900', color: '#0284c7', fontSize: '14px', background: '#f0f9ff' }}>
                                    {effPcs > 0 ? `${(parseFloat(boneWeightKg || 0) / effPcs).toFixed(4)} kg` : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                    {effPcs || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#0369a1', fontSize: '15px', background: '#e0f2fe' }}>
                                    <div>{boneWeightKg || '0'} Kg</div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                                      Direct Floor Issue
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* EXCEL SHEET PRODUCTION ROW PREVIEW */}
                  <div style={{ marginTop: '16px', borderTop: '1px dashed #cbd5e1', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Table size={14} color="#059669" />
                        <span>Excel Sheet Output Preview ({materialMode === 'elastic' ? 'Elastic' : materialMode === 'tape' ? 'Tape' : materialMode === 'bone' ? 'Bone' : 'All'}):</span>
                      </span>
                      {materialMode !== 'tape' && materialMode !== 'bone' && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Total Requirement: <strong>{calcResult.totalElasticMtr} Mtr</strong> &bull; <strong>÷ {effectiveDivisor} = {calcResult.recommendedRolls || Math.ceil((calcResult.totalElasticMtr || 0) / effectiveDivisor)} Roll(s) ({effectiveWidth})</strong>
                        </span>
                      )}
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: '800', borderBottom: '1.5px solid #cbd5e1' }}>
                            <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>DATE</th>
                            {!withoutLotActive && (
                              <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Lot No.</th>
                            )}
                            <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Item Name</th>
                            <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Mapped Material</th>
                            <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Pcs (Issued)</th>
                            <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Supervisor Name</th>
                            {(materialMode === 'tape' || materialMode === 'both' || materialMode === 'all') && (
                              <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>Tape Roll(s) (Pcs ÷ {(effectiveTapeDivisor > 1 ? effectiveTapeDivisor : 45)})</th>
                            )}
                            {(materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                              <th style={{ padding: '8px 10px', borderRight: (materialMode === 'bone' || materialMode === 'all') ? '1px solid #e2e8f0' : 'none' }}>Elastic Per Pc (In mtr.)</th>
                            )}
                            {(materialMode === 'bone' || materialMode === 'all') && (
                              <th style={{ padding: '8px 10px' }}>Bone Weight (Kg)</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: '#ffffff', color: '#0f172a' }}>
                            <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>{issueDate}</td>
                            {!withoutLotActive && (
                              <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '800', color: '#059669' }}>
                                {lotDetails?.lotNo || searchLotInput || '—'}
                              </td>
                            )}
                            <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '700' }}>
                              {withoutLotActive ? (withoutLotStyle || 'LOWER') : (lotDetails?.garmentType || lotDetails?.style || 'LOWER')}
                            </td>
                            <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '800' }}>
                              {materialMode === 'elastic' ? (
                                <span style={{ color: '#047857' }}>
                                  {cleanMaterialName(elasticMaterialName) || 'Elastic'} {formatItemCode(currentElasticMaterial || selectedElasticMaterialId, null, materials) ? `[${formatItemCode(currentElasticMaterial || selectedElasticMaterialId, null, materials)}]` : ''}
                                </span>
                              ) : materialMode === 'tape' ? (
                                <span style={{ color: '#1d4ed8' }}>
                                  {cleanMaterialName(tapeMaterialName) || 'Tape'} {formatItemCode(currentTapeMaterial || selectedTapeMaterialId, null, materials) ? `[${formatItemCode(currentTapeMaterial || selectedTapeMaterialId, null, materials)}]` : ''}
                                </span>
                              ) : materialMode === 'bone' ? (
                                <span style={{ color: '#0369a1' }}>
                                  {cleanMaterialName(boneMaterialName) || 'Bone'} {formatItemCode(currentBoneMaterial || selectedBoneMaterialId, null, materials) ? `[${formatItemCode(currentBoneMaterial || selectedBoneMaterialId, null, materials)}]` : ''}
                                </span>
                              ) : materialMode === 'other' ? (
                                <span style={{ color: '#7c3aed' }}>
                                  {cleanMaterialName(otherMaterialName) || 'Other Accessory'} {formatItemCode(currentOtherMaterial || selectedOtherMaterialId, null, materials) ? `[${formatItemCode(currentOtherMaterial || selectedOtherMaterialId, null, materials)}]` : ''}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ color: '#047857' }}>{cleanMaterialName(elasticMaterialName)} {formatItemCode(currentElasticMaterial || selectedElasticMaterialId, null, materials) ? `[${formatItemCode(currentElasticMaterial || selectedElasticMaterialId, null, materials)}]` : ''}</span>
                                  <span style={{ color: '#1d4ed8', fontSize: '11px' }}>{cleanMaterialName(tapeMaterialName)} {formatItemCode(currentTapeMaterial || selectedTapeMaterialId, null, materials) ? `[${formatItemCode(currentTapeMaterial || selectedTapeMaterialId, null, materials)}]` : ''}</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '800' }}>
                              {issuePcs}
                            </td>
                            <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>
                              {lotDetails?.supervisor || issuerName || 'ROHIT / MONU'}
                            </td>
                            {(materialMode === 'tape' || materialMode === 'both' || materialMode === 'all') && (() => {
                              const effTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
                              const effPcsNum = parseInt(issuePcs || lotDetails?.quantity || 0, 10);
                              return (
                                <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '800', color: '#1d4ed8', background: '#eff6ff' }}>
                                  {Math.ceil(effPcsNum / effTapeDiv)} Roll(s)
                                  {effPcsNum > 0 && (
                                    <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', marginLeft: '4px' }}>
                                      ({(effPcsNum / effTapeDiv).toFixed(2)})
                                    </span>
                                  )}
                                </td>
                              );
                            })()}
                            {(materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                              <td style={{ padding: '8px 10px', borderRight: (materialMode === 'bone' || materialMode === 'all') ? '1px solid #e2e8f0' : 'none', fontWeight: '800', color: '#047857', background: '#f0fdf4' }}>
                                {calcResult.elasticPerPcMtr || 0}
                              </td>
                            )}
                            {(materialMode === 'bone' || materialMode === 'all') && (
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0284c7', background: '#f0f9ff' }}>
                                {boneWeightKg || '0'} Kg
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

                {/* STEP 2: ISSUE DETAILS & ORIGINAL BILL SPECIFICATIONS */}
                <div style={{
                  marginTop: '28px',
                  paddingTop: '22px',
                  borderTop: '2px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '18px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#ffffff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800',
                      boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
                    }}>2</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                        Issue Details (Date, Issuer, Receiver & Supervisor)
                      </h3>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Fill date, issuer, receiver and review total requirement before generating original bill / PO
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

                  {/* LEFT COLUMN: ISSUER, RECEIVER, SUPERVISOR & DATE */}
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                      <User size={16} color="#059669" />
                      <span>Issue & Requisition Information:</span>
                    </div>

                    {/* ISSUER NAME */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <User size={14} color="#059669" />
                        <span>Issuer Name (Store Staff / Prepared By):</span>
                      </label>
                      <SmartSelectWithManual
                        value={issuerName}
                        onChange={setIssuerName}
                        options={['PARAS', 'RASHMI', 'STORE STAFF', 'ADMIN', 'STORE INCHARGE']}
                        placeholder="Select Issuer or + Manual Entry"
                        manualPlaceholder="Type custom issuer name..."
                        manualLabel="+ Manual Entry (Store Staff)"
                        localStorageKey="elastic_issuer_names"
                        icon="user"
                        theme="emerald"
                      />
                    </div>

                    {/* RECEIVER NAME */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Scissors size={14} color="#059669" />
                        <span>Receiver Name (Cutting Master / Received By):</span>
                      </label>
                      <SmartSelectWithManual
                        value={receiverName}
                        onChange={setReceiverName}
                        options={['JAYBIR', 'ROHIT', 'MONU', 'CUTTING MASTER', 'SEWING MASTER']}
                        placeholder="Select Receiver or + Manual Entry"
                        manualPlaceholder="Type custom receiver name..."
                        manualLabel="+ Manual Entry (Cutting Master)"
                        localStorageKey="elastic_receiver_names"
                        icon="scissors"
                        theme="emerald"
                      />
                    </div>

                    {/* SUPERVISOR NAME */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <ShieldCheck size={14} color="#059669" />
                        <span>Supervisor / Floor Incharge Name:</span>
                      </label>
                      <SmartSelectWithManual
                        value={supervisorName}
                        onChange={setSupervisorName}
                        options={['ROHIT / MONU', 'MOHIT SIR', 'MANISH', 'FLOOR SUPERVISOR', 'STORE INCHARGE']}
                        placeholder="Select Supervisor or + Manual Entry"
                        manualPlaceholder="Type custom supervisor name..."
                        manualLabel="+ Manual Entry (Supervisor)"
                        localStorageKey="elastic_supervisor_names"
                        icon="shield"
                        theme="emerald"
                      />
                    </div>

                    {/* ELASTIC SPECIFICATION & MATERIAL MAPPING (3 TYPES: 1" ÷ 25, 1.5" ÷ 23, 2" ÷ 23) */}
                    {(materialMode === 'elastic' || materialMode === 'both' || materialMode === 'all') && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Ruler size={14} color="#059669" />
                            <span>Elastic Specification & Material Mapping:</span>
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            background: '#dcfce7',
                            color: '#065f46',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: '800'
                          }}>
                            Divisor: ÷ {effectiveDivisor} ({effectiveWidth})
                          </span>
                        </div>

                        {/* 3 Standard Elastic Types Quick Selection */}
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', display: 'block', marginBottom: '4px' }}>
                            ELASTIC WIDTH TYPE (3 TYPES):
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            {[
                              { label: '1 Inch', desc: '÷ 25 Formula', val: '1 Inch' },
                              { label: '1.5 Inch', desc: '÷ 23 Formula', val: '1.5 Inch' },
                              { label: '2 Inch', desc: '÷ 23 Formula', val: '2 Inch' }
                            ].map(t => {
                              const isActive = effectiveWidth.includes(t.val) || (t.val === '1 Inch' && (effectiveWidth.includes('Standard') || effectiveWidth === '1 Inch'));
                              return (
                                <button
                                  key={t.val}
                                  type="button"
                                  onClick={() => {
                                    setElasticWidth(t.val);
                                    const dVal = t.val === '1 Inch' ? '25' : '23';
                                    setCustomDivisor(dVal);
                                    const match = elasticMaterials.find(m => {
                                      const n = (m.name || '').toLowerCase();
                                      if (t.val === '1.5 Inch') return n.includes('1.5');
                                      if (t.val === '2 Inch') return n.includes('2') && !n.includes('1.5');
                                      return n.includes('1') && !n.includes('1.5');
                                    });
                                    if (match) setSelectedElasticMaterialId(match.id);
                                  }}
                                  style={{
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    border: isActive ? '2px solid #059669' : '1px solid #cbd5e1',
                                    background: isActive ? '#dcfce7' : '#ffffff',
                                    color: isActive ? '#065f46' : '#334155',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ fontSize: '12px', fontWeight: '800' }}>{t.label}</div>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: isActive ? '#047857' : '#64748b' }}>
                                    {t.desc}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Mapped Elastic Inventory Material Dropdown (Elastic Category Only) */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', margin: 0 }}>
                              MATERIAL NAME MAPPING (ELASTIC CATEGORY):
                            </label>
                            <span style={{ fontSize: '10px', color: '#047857', fontWeight: '700' }}>
                              {elasticMaterials.length} Items Available
                            </span>
                          </div>
                          <select
                            value={selectedElasticMaterialId}
                            onChange={(e) => {
                              const id = e.target.value;
                              setSelectedElasticMaterialId(id);
                              const mat = elasticMaterials.find(m => String(m.id) === String(id));
                              if (mat) {
                                const n = (mat.name || '').toLowerCase();
                                if (n.includes('1.5')) setElasticWidth('1.5 Inch');
                                else if (n.includes('2')) setElasticWidth('2 Inch');
                                else setElasticWidth('1 Inch');
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #86efac',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none'
                            }}
                          >
                            <option value="">— Select Elastic Inventory Item —</option>
                            {elasticMaterials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.id}) • Stock: {m.stock} {m.unit || 'Roll'} &bull; Divisor: {(m.name || '').includes('1.5') ? '÷ 23' : (m.name || '').includes('2') ? '÷ 23' : '÷ 25'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Roll Count Input & Live Division Formula */}
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                          <div>
                            <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#047857', display: 'block', marginBottom: '2px' }}>
                              ROLLS (AUTO):
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={rollCount || calcResult.recommendedRolls || Math.ceil((calcResult.totalElasticMtr || 0) / effectiveDivisor) || 1}
                              onChange={(e) => setRollCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              style={{
                                width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '6px',
                                border: '1.5px solid #059669', fontSize: '13px', fontWeight: '800',
                                color: '#0f172a', background: '#ffffff', outline: 'none'
                              }}
                            />
                          </div>
                          <div style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px dashed #86efac',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#047857',
                            lineHeight: '1.3'
                          }}>
                            <div>Calculation: {calcResult.totalElasticMtr} Mtr ÷ {effectiveDivisor}</div>
                            <div style={{ color: '#065f46', fontWeight: '800' }}>
                              = {calcResult.recommendedRolls || Math.ceil((calcResult.totalElasticMtr || 0) / effectiveDivisor)} Roll(s) ({effectiveWidth})
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BONE SPECIFICATION & MATERIAL MAPPING (FOR BONE MODE) */}
                    {(materialMode === 'bone' || materialMode === 'all') && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#f0f9ff',
                        border: '1.5px solid #bae6fd',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Scale size={14} color="#0284c7" />
                            <span>Bone Specification & Material Mapping:</span>
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: '800'
                          }}>
                            {effectiveBoneWidth || '1.5 Inch'}
                          </span>
                        </div>

                        {/* Mapped Bone Inventory Item Dropdown */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#0369a1', margin: 0 }}>
                              MATERIAL NAME MAPPING (BONE CATEGORY):
                            </label>
                            <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: '700' }}>
                              {boneMaterials.length} Items Available
                            </span>
                          </div>
                          <select
                            value={selectedBoneMaterialId}
                            onChange={(e) => handleSelectBoneMaterial(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #bae6fd',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none'
                            }}
                          >
                            <option value="">— Select Bone Inventory Item —</option>
                            {boneMaterials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.id}) • Stock: {m.stock} Kg
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* OTHER ACCESSORIES SUMMARY (CONFIGURED IN GRID) */}
                    {materialMode === 'other' && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11.5px',
                        color: '#475569'
                      }}>
                        <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={14} color="#059669" />
                          <span>Other Accessories Configured: <strong>{otherItems.length} Item(s)</strong> in Grid Above</span>
                        </span>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>
                          Total Quantity: {otherItems.reduce((sum, it) => sum + (Number(it.totalQty) || 0), 0)} Unit(s)
                        </span>
                      </div>
                    )}

                    {/* Issue Date & Remarks */}
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                          ISSUE DATE
                        </span>
                        <input
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          style={{
                            width: '100%', padding: '8px', borderRadius: '8px',
                            border: '1px solid #cbd5e1', background: '#ffffff',
                            fontSize: '12.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                          REMARKS / INSTRUCTIONS
                        </span>
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="e.g. Elastic for waistband..."
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '8px',
                            border: '1px solid #cbd5e1', background: '#ffffff',
                            fontSize: '12px', fontWeight: '600', color: '#0f172a', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>



                  </div>

                  {/* RIGHT COLUMN: TOTAL REQUIREMENT LIVE SUMMARY */}
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1.5px solid #059669',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.08)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={16} color="#059669" />
                          <span>Total Requirement on Original Bill:</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#059669', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                          ORIGINAL BILL SPEC
                        </span>
                      </div>

                      {/* Production Quick Details & Editable Issue Pcs */}
                      {withoutLotActive ? (
                        <div style={{
                          background: '#f8fafc',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          marginBottom: '12px',
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              ISSUE MODE & LOT
                            </span>
                            <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                              LOT #{searchLotInput || lotDetails?.lotNo || '—'} {withoutLotStyle ? `(${withoutLotStyle})` : ''}
                            </strong>
                          </div>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1'
                          }}>
                            DIRECT ISSUE
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1.5px solid #bfdbfe',
                          marginBottom: '12px',
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <span style={{ fontSize: '10.5px', color: '#1d4ed8', display: 'block', fontWeight: '800', textTransform: 'uppercase' }}>
                              ISSUE MODE & LOT
                            </span>
                            <strong style={{ color: '#1e40af', fontSize: '13.5px' }}>
                              With BOM — LOT #{lotDetails?.lotNo || searchLotInput || '—'} ({lotDetails?.style || lotDetails?.garmentType || withoutLotStyle || 'Lower / Tracksuit'})
                            </strong>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            background: '#2563eb',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            🛡️ BOM APPROVED ({lotDetails?.quantity || issuePcs || 0} Pcs)
                          </span>
                        </div>
                      )}

                      {/* Editable Issue Box: Direct Weight in Kgs for Bone, Pcs for Elastic & Tape */}
                      {materialMode === 'bone' ? (
                        <div style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: '#f0f9ff',
                          border: '1.5px solid #0284c7',
                          marginBottom: '14px',
                          boxShadow: '0 2px 10px rgba(2, 132, 199, 0.08)'
                        }}>
                          <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Scale size={16} color="#0284c7" />
                              <span>Direct Issue Weight (Editable):</span>
                            </span>
                            <span style={{ fontSize: '10.5px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                              Kg-Wise Floor Issue
                            </span>
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', alignItems: 'flex-start' }}>
                            {/* 1. Bone Issue Weight */}
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', display: 'block', marginBottom: '4px' }}>
                                Issue Weight (Kg):
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={boneWeightKg}
                                  onChange={(e) => setBoneWeightKg(e.target.value)}
                                  placeholder="e.g. 2.50"
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '2px solid #0284c7',
                                    background: '#ffffff',
                                    fontSize: '15px',
                                    fontWeight: '900',
                                    color: '#0f172a',
                                    outline: 'none'
                                  }}
                                />
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '900',
                                  color: '#0369a1',
                                  background: '#e0f2fe',
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  border: '1.5px solid #bae6fd',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Kg
                                </span>
                              </div>
                            </div>

                            {/* 2. Roll Quantity (Optional) */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1' }}>
                                  Roll Quantity:
                                </span>
                                <span style={{
                                  fontSize: '9.5px',
                                  color: '#0284c7',
                                  background: '#e0f2fe',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: '700'
                                }}>
                                  Optional
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={boneRollCount}
                                  onChange={(e) => setBoneRollCount(e.target.value)}
                                  placeholder="e.g. 1, 2 (Optional)"
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #0284c7',
                                    background: '#ffffff',
                                    fontSize: '15px',
                                    fontWeight: '800',
                                    color: '#0f172a',
                                    outline: 'none'
                                  }}
                                />
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '900',
                                  color: '#0369a1',
                                  background: '#e0f2fe',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: '1.5px solid #bae6fd',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Roll(s)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Weights & Quick Rolls */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Quick Weights:</span>
                            {['0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '5.0', '10.0'].map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => setBoneWeightKg(w)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: boneWeightKg === w ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                                  background: boneWeightKg === w ? '#0284c7' : '#ffffff',
                                  color: boneWeightKg === w ? '#ffffff' : '#0369a1',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  transition: 'all 0.1s ease'
                                }}
                              >
                                {w} Kg
                              </button>
                            ))}

                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginLeft: '6px' }}>Rolls (Opt):</span>
                            {['1', '2', '3', '4', '5'].map(r => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setBoneRollCount(r)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: String(boneRollCount) === r ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                                  background: String(boneRollCount) === r ? '#0284c7' : '#ffffff',
                                  color: String(boneRollCount) === r ? '#ffffff' : '#0369a1',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  transition: 'all 0.1s ease'
                                }}
                              >
                                {r} Roll{r > 1 ? 's' : ''}
                              </button>
                            ))}
                            {boneRollCount && (
                              <button
                                type="button"
                                onClick={() => setBoneRollCount('')}
                                style={{
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                                title="Clear Roll Count"
                              >
                                ✕ Clear
                              </button>
                            )}
                          </div>
                        </div>
                      ) : materialMode === 'other' ? (
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: '#faf5ff',
                          border: '1.5px solid #d8b4fe',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 4px rgba(124, 58, 237, 0.05)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              background: '#f3e8ff', color: '#7c3aed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Scissors size={14} />
                            </div>
                            <div>
                              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>
                                REAL ISSUE PIECES
                              </span>
                              <strong style={{ fontSize: '15px', fontWeight: '900', color: '#4c1d95' }}>
                                {lotDetails?.quantity || issuePcs || 0} Pcs
                              </strong>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            background: '#7c3aed',
                            color: '#ffffff',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)'
                          }}>
                            {withoutLotActive ? 'Direct Issue' : `Lot #${lotDetails?.lotNo || searchLotInput || '—'} Cutting Quantity`}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: '#f0fdf4',
                          border: '1.5px solid #86efac',
                          marginBottom: '14px'
                        }}>
                          <label style={{ fontSize: '12px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Scissors size={14} color="#059669" />
                              <span>Issue Pcs (Editable):</span>
                            </span>
                            <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              Live Auto-Calculation
                            </span>
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              min="1"
                              value={issuePcs}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  setIssuePcs('');
                                } else {
                                  const parsed = parseInt(val, 10);
                                  setIssuePcs(isNaN(parsed) ? '' : Math.max(1, parsed));
                                }
                              }}
                              placeholder="Enter Issue Pcs"
                              style={{
                                flex: 1,
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1.5px solid #059669',
                                background: '#ffffff',
                                fontSize: '15px',
                                fontWeight: '800',
                                color: '#0f172a',
                                outline: 'none'
                              }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>Pcs</span>
                            {!withoutLotActive && lotDetails?.quantity && (
                              <button
                                type="button"
                                onClick={() => setIssuePcs(parseInt(lotDetails.quantity, 10))}
                                style={{
                                  padding: '6px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid #86efac',
                                  background: '#ffffff',
                                  color: '#047857',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                Match Cutting ({lotDetails.quantity})
                              </button>
                            )}
                          </div>
                          {materialMode === 'all' && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #86efac', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0369a1', minWidth: '130px' }}>Bone Weight (Kg):</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={boneWeightKg}
                                onChange={(e) => setBoneWeightKg(e.target.value)}
                                placeholder="e.g. 2.50"
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #0284c7',
                                  background: '#ffffff',
                                  fontSize: '14px',
                                  fontWeight: '800',
                                  color: '#0f172a',
                                  outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '13px', fontWeight: '900', color: '#0369a1' }}>Kgs</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Material Requirement Highlights */}
                      {(materialMode === 'elastic' || materialMode === 'both') && (() => {
                        const effectiveRollsToIssue = withoutLotActive
                          ? (Math.ceil((parseInt(issuePcs, 10) || 0) / effectiveDivisor) || 1)
                          : (calcResult.recommendedRolls || Math.ceil((calcResult.totalElasticMtr || 0) / effectiveDivisor) || 1);
                        return (
                          <div style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: '#f0fdf4',
                            border: '2px solid #059669',
                            marginBottom: materialMode === 'both' ? '12px' : '16px',
                            boxShadow: '0 3px 12px rgba(5, 150, 105, 0.08)'
                          }}>
                            {/* Top: Material Name & Per Pc Details */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span>
                                  <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {elasticMaterialName || 'Elastic'} Total Requirement
                                  </span>
                                  {currentElasticMaterial && (
                                    <span style={{ fontSize: '10px', background: '#dcfce7', color: '#065f46', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>
                                      ITEM CODE: {formatItemCode(currentElasticMaterial || selectedElasticMaterialId, null, materials)}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#334155', fontWeight: '600', marginTop: '3px' }}>
                                  {withoutLotActive ? (
                                    <span>Rule: <strong>{issuePcs} Pcs ÷ {effectiveDivisor}</strong> ({effectiveWidth})</span>
                                  ) : (
                                    <span>Per Pc: <strong>{calcResult.elasticPerPcMtr} Mtr</strong> ({elasticSizeInput} {elasticUnit}) × <strong>{issuePcs} Pcs</strong></span>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                                  {withoutLotActive ? 'Issue Pcs' : 'Total Length'}
                                </span>
                                <span style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                                  {withoutLotActive ? `${issuePcs} Pcs` : `${calcResult.totalElasticMtr} Mtr`}
                                </span>
                              </div>
                            </div>

                            {/* HERO CALLOUT: TOTAL ISSUE (31 ROLLS) */}
                            <div style={{
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '38px', height: '38px', borderRadius: '8px',
                                  background: 'rgba(255,255,255,0.2)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '20px', fontWeight: '900'
                                }}>
                                  📦
                                </div>
                                <div>
                                  <div style={{ fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.95 }}>
                                    TOTAL ISSUE QUANTITY
                                  </div>
                                  <div style={{ fontSize: '11.5px', fontWeight: '600', opacity: 0.95 }}>
                                    {withoutLotActive
                                      ? `Formula: ${issuePcs} Pcs ÷ ${effectiveDivisor} (${effectiveWidth})`
                                      : `Formula: ${calcResult.totalElasticMtr} Mtr ÷ ${effectiveDivisor} (${effectiveWidth})`}
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1', letterSpacing: '-0.5px' }}>
                                  = {effectiveRollsToIssue} <span style={{ fontSize: '18px', fontWeight: '800' }}>Roll(s)</span>
                                </div>
                                <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: '700', marginTop: '3px' }}>
                                  {currentElasticMaterial ? `Stock in store: ${currentElasticMaterial.stock} Roll(s)` : 'Total to hand over'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {(materialMode === 'tape' || materialMode === 'both') && (() => {
                        const effTapePcs = parseInt(issuePcs || lotDetails?.quantity || 0, 10);
                        const effTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
                        const tapeExact = effTapePcs > 0 ? (effTapePcs / effTapeDiv).toFixed(2) : '0';
                        const tapeRolls = effTapePcs > 0 ? Math.ceil(effTapePcs / effTapeDiv) : 0;

                        return (
                          <div style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: '#eff6ff',
                            border: '2px solid #2563eb',
                            marginBottom: '14px',
                            boxShadow: '0 3px 12px rgba(37, 99, 235, 0.08)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                                  <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {tapeMaterialName || 'Tape'} Total Requirement (Pcs ÷ {effTapeDiv})
                                  </span>
                                  {currentTapeMaterial && (
                                    <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>
                                      ITEM CODE: {formatItemCode(currentTapeMaterial || selectedTapeMaterialId, null, materials)}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#334155', fontWeight: '600', marginTop: '3px' }}>
                                  Formula: <strong>{effTapePcs} Pcs ÷ {effTapeDiv}</strong> = <strong>{tapeExact} Rolls</strong>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                                  Standard Rule
                                </span>
                                <span style={{ fontSize: '14px', fontWeight: '900', color: '#1d4ed8' }}>
                                  1 Roll / {effTapeDiv} Pcs
                                </span>
                              </div>
                            </div>

                            {/* HERO CALLOUT: TAPE TOTAL ISSUE */}
                            <div style={{
                              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '42px', height: '42px', borderRadius: '8px',
                                  background: 'rgba(255,255,255,0.2)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '22px'
                                }}>
                                  📦
                                </div>
                                <div>
                                  <div style={{ fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.95 }}>
                                    TOTAL TAPE ISSUE QUANTITY
                                  </div>
                                  <div style={{ fontSize: '11.5px', fontWeight: '600', opacity: 0.95 }}>
                                    {effTapePcs} Pcs ÷ {effTapeDiv} = {tapeExact} → {tapeRolls} Roll(s)
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1', letterSpacing: '-0.5px' }}>
                                  {tapeRolls} <span style={{ fontSize: '16px', fontWeight: '800' }}>Roll(s)</span>
                                </div>
                                <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: '700', marginTop: '3px' }}>
                                  {currentTapeMaterial ? `Stock in store: ${currentTapeMaterial.stock} ${currentTapeMaterial.unit || 'Roll'}` : 'Total to issue'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bone Roll Requirement Highlight */}
                      {(materialMode === 'bone' || materialMode === 'all') && (
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: '#f0f9ff',
                          border: '2px solid #0284c7',
                          marginBottom: '14px',
                          boxShadow: '0 3px 12px rgba(2, 132, 199, 0.08)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                                <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  • {(boneMaterialName || 'BONE CHINESE (BEIGE)').toUpperCase()} REQUIREMENT
                                </span>
                                {(currentBoneMaterial?.id || selectedBoneMaterialId || 'ST00346') && (
                                  <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>
                                    ITEM CODE: {formatItemCode(currentBoneMaterial || selectedBoneMaterialId, null, materials) || 'ST00346'}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '700', marginTop: '3px' }}>
                                {!withoutLotActive ? 'With BOM Approved Floor Issue (Kg-Wise)' : 'Direct Floor Issue (Kg-Wise)'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                                ISSUE UNIT
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                                Kilograms (Kg)
                              </span>
                            </div>
                          </div>

                          {/* HERO CALLOUT: BONE TOTAL ISSUE */}
                          <div style={{
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '38px', height: '38px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '20px', fontWeight: '900'
                              }}>
                                📦
                              </div>
                              <div>
                                <div style={{ fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.95 }}>
                                  TOTAL BONE ISSUE
                                </div>
                                <div style={{ fontSize: '11.5px', fontWeight: '600', opacity: 0.95 }}>
                                  {!withoutLotActive ? 'Approved BOM Floor Weight Issue (Kg-Wise)' : 'Direct Floor Weight Issue (Kg-Wise)'}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1', letterSpacing: '-0.5px' }}>
                                {boneWeightKg || '0'} <span style={{ fontSize: '18px', fontWeight: '800' }}>Kg</span>
                              </div>
                              {boneRollCount ? (
                                <div style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                                  {boneRollCount} Roll{Number(boneRollCount) > 1 ? 's' : ''}
                                </div>
                              ) : null}
                              <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: '700', marginTop: '3px' }}>
                                Store stock: {currentBoneMaterial ? (currentBoneMaterial.stock ?? '15') : '15'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Other Accessories Requirement Highlight */}
                      {materialMode === 'other' && (
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: '#faf5ff',
                          border: '2px solid #7c3aed',
                          marginBottom: '14px',
                          boxShadow: '0 3px 12px rgba(124, 58, 237, 0.08)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }}></span>
                                <span style={{ fontSize: '11px', color: '#6b21a8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  • OTHER ACCESSORIES ALLOCATION ({otherItems.length} ITEM{otherItems.length > 1 ? 'S' : ''})
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b21a8', fontWeight: '700', marginTop: '3px' }}>
                                {otherItems.map(it => `${it.materialName || it.componentType} (${it.totalQty || 1} ${it.unit})`).join(' • ')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                                TOTAL ITEMS
                              </span>
                              <span style={{
                                fontSize: '13px',
                                fontWeight: '900',
                                color: '#7c3aed',
                                background: '#f3e8ff',
                                border: '1px solid #d8b4fe',
                                padding: '2px 8px',
                                borderRadius: '6px'
                              }}>
                                {otherItems.length} Item(s)
                              </span>
                            </div>
                          </div>

                          {/* HERO CALLOUT: OTHER ACCESSORIES TOTAL ISSUE */}
                          <div style={{
                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '38px', height: '38px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '20px', fontWeight: '900'
                              }}>
                                📦
                              </div>
                              <div>
                                <div style={{ fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.95 }}>
                                  TOTAL MATERIAL ALLOCATIONS
                                </div>
                                <div style={{ fontSize: '11.5px', fontWeight: '600', opacity: 0.95 }}>
                                  {otherItems.length} Item(s) configured in Grid for deduction
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '26px', fontWeight: '900', lineHeight: '1', letterSpacing: '-0.5px' }}>
                                = {otherItems.reduce((sum, it) => sum + (Number(it.totalQty) || 0), 0)} <span style={{ fontSize: '16px', fontWeight: '800' }}>Total Units</span>
                              </div>
                              <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: '700', marginTop: '3px' }}>
                                Direct Floor Handover ({otherItems.length} distinct item{otherItems.length > 1 ? 's' : ''})
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Formula Note (Shown for Elastic, Tape & Other) */}
                      {materialMode !== 'bone' && (() => {
                        const effTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
                        const pCount = parseInt(issuePcs || lotDetails?.quantity || 0, 10);
                        const tRolls = Math.ceil(pCount / effTapeDiv);
                        return (
                          <div style={{ fontSize: '11.5px', color: '#64748b', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>
                            Conversion Formula: <strong style={{ color: '#0f172a' }}>{materialMode === 'other' ? `Manual Material Issue: ${otherRollCount || 1} ${normalizeAccUnit(otherUnit)}(s)` : materialMode === 'tape' ? (calcResult.tapeFormula || `${pCount} Pcs ÷ ${effTapeDiv} = ${tRolls} Roll(s)`) : withoutLotActive ? `Without BOM: ${issuePcs || 0} Pcs ÷ ${effectiveDivisor} (${effectiveWidth}) = ${Math.ceil((parseInt(issuePcs, 10) || 0) / effectiveDivisor)} Roll(s)` : calcResult.formulaExplanation}</strong>
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700', marginTop: '10px', textAlign: 'center' }}>
                      ✓ All details verified & ready to print formal original bill / PO
                    </div>
                  </div>

                </div>

                {/* ACTION: GENERATE BILL BUTTON */}
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {(() => {
                      const effTapeDiv = (effectiveTapeDivisor && parseFloat(effectiveTapeDivisor) > 1) ? parseFloat(effectiveTapeDivisor) : 45;
                      const pCount = parseInt(issuePcs || lotDetails?.quantity || 0, 10);
                      const tRolls = Math.ceil(pCount / effTapeDiv) || 1;
                      return withoutLotActive ? (
                        <span style={{ color: '#c2410c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Zap size={15} /> Without BOM Mode ({materialMode === 'other' ? 'Other Accessories' : materialMode === 'tape' ? 'Tape Only' : materialMode === 'bone' ? 'Bone Only' : 'Elastic Only'}) &bull; LOT #{searchLotInput || lotDetails?.lotNo || '—'} &bull; Total Issue: <strong style={{ color: '#ea580c' }}>{materialMode === 'other' ? `${otherRollCount || 1} ${otherUnit || 'Roll'}(s)` : materialMode === 'tape' ? `${tRolls} Roll(s)` : materialMode === 'bone' ? `${boneWeightKg || '0'} Kg${boneRollCount ? ` (${boneRollCount} Roll${Number(boneRollCount) > 1 ? 's' : ''})` : ''}` : `${Math.ceil(pCount / effectiveDivisor)} Roll(s) (${effectiveWidth})`}</strong>
                        </span>
                      ) : bomStatus === 'approved' ? (
                        <span>
                          Total Requirement: <strong style={{ color: '#059669' }}>{materialMode === 'tape' ? `${tRolls} Roll(s)` : materialMode === 'bone' ? `${boneWeightKg || '0'} Kg${boneRollCount ? ` (${boneRollCount} Roll${Number(boneRollCount) > 1 ? 's' : ''})` : ''}` : `${calcResult.totalElasticMtr} Mtr`}</strong> for <strong>LOT #{lotDetails?.lotNo || searchLotInput || '—'}</strong> (BOM Approved ✓)
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Lock size={15} /> Original Issue Bill / PO generation locked until BOM is created & approved
                        </span>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={generateElasticIssueBill}
                    disabled={generating || (!withoutLotActive && bomStatus !== 'approved')}
                    title={(!withoutLotActive && bomStatus !== 'approved') ? 'BOM must be created and approved by Admin before generating issue bill' : 'Generate official Original Material Issue Bill / PO'}
                    style={{
                      padding: '12px 32px',
                      borderRadius: '12px',
                      border: 'none',
                      background: (withoutLotActive || bomStatus === 'approved')
                        ? (withoutLotActive ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)')
                        : '#94a3b8',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: '800',
                      cursor: (generating || (!withoutLotActive && bomStatus !== 'approved')) ? 'not-allowed' : 'pointer',
                      boxShadow: (withoutLotActive || bomStatus === 'approved') ? (withoutLotActive ? '0 6px 18px rgba(234, 88, 12, 0.4)' : '0 6px 18px rgba(5, 150, 105, 0.4)') : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      opacity: (withoutLotActive || bomStatus === 'approved') ? 1 : 0.7
                    }}
                  >
                    {generating ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (withoutLotActive || bomStatus === 'approved') ? (
                      <Printer size={18} />
                    ) : (
                      <Lock size={18} />
                    )}
                    <span>
                      {generating
                        ? 'Generating Original Bill...'
                        : withoutLotActive
                          ? `Generate W/O BOM ${materialMode === 'tape' ? 'Tape' : materialMode === 'bone' ? 'Bone' : 'Elastic'} Issue Slip`
                          : 'Generate Original Issue Bill / PO'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* EMPTY WAITING STATE (WHEN NO LOT HAS BEEN SEARCHED / ENTERED YET AND NOT IN W/O PO MODE) */}
          {!lotDetails && !isWithoutPo && (
            <div className="panel" style={{
              padding: '36px 24px',
              borderRadius: '16px',
              background: 'var(--bg-card, #ffffff)',
              border: '1.5px dashed #cbd5e1',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#f0fdf4',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Search size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                Enter or Select a Lot Number Above
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted, #64748b)', fontWeight: '500', maxWidth: '440px' }}>
                Search a Lot Number above or click an Approved Lot to verify BOM approval and open the Elastic / Tape calculation and issue form.
              </p>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsWithoutLot(true);
                    setIsWithoutPo(true);
                    if (!lotDetails) {
                      setLotDetails({
                        lotNo: searchLotInput || '',
                        style: withoutLotStyle || 'Floor Issue',
                        quantity: issuePcs || 0,
                        brand: 'Mohit Hosiery',
                        garmentType: withoutLotStyle || 'LOWER',
                        fabric: 'Cotton Poly Blend',
                        shade: 'Standard'
                      });
                    }
                    if (searchLotInput.trim() && (!lotDetails || !lotDetails.quantity)) {
                      handleSearchLot(searchLotInput.trim());
                    }
                  }}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Zap size={16} /> ⚡ Direct Issue Without BOM (No BOM Required)
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* HISTORY TAB */
        <div className="panel" style={{
          padding: '22px 24px',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Elastic Issue Slips History
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Sequence-tracked records of all material issue slips (Elastic, Tape, Bone, Other Accessories & Standard)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Sequence Sort Mode Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <button
                  type="button"
                  onClick={() => setHistorySortMode('seq_asc')}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '6px',
                    border: 'none',
                    background: historySortMode === 'seq_asc' ? '#0f172a' : 'transparent',
                    color: historySortMode === 'seq_asc' ? '#ffffff' : '#475569',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  title="Sort sequence ascending (track in exact order)"
                >
                  🔢 Sequence
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySortMode('seq_desc')}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '6px',
                    border: 'none',
                    background: historySortMode === 'seq_desc' ? '#0f172a' : 'transparent',
                    color: historySortMode === 'seq_desc' ? '#ffffff' : '#475569',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  title="Sort latest sequence descending"
                >
                  🔢 Latest Seq
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySortMode('date_desc')}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '6px',
                    border: 'none',
                    background: historySortMode === 'date_desc' ? '#0f172a' : 'transparent',
                    color: historySortMode === 'date_desc' ? '#ffffff' : '#475569',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  title="Sort newest date first"
                >
                  📅 Date
                </button>
              </div>

              {/* Date Choose Filter Picker */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: historyDateFilter ? '#eff6ff' : '#f8fafc',
                border: historyDateFilter ? '2px solid #2563eb' : '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '4px 9px',
                transition: 'all 0.15s ease'
              }}>
                <Calendar size={13} style={{ color: historyDateFilter ? '#2563eb' : '#64748b' }} />
                <span style={{ fontSize: '11px', fontWeight: '800', color: historyDateFilter ? '#1d4ed8' : '#475569' }}>
                  Date:
                </span>
                <input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="Choose a specific date to filter slips"
                />
                {historyDateFilter ? (
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter('')}
                    title="Clear date filter (show all slips)"
                    style={{
                      border: 'none',
                      background: '#ef4444',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter(new Date().toISOString().split('T')[0])}
                    title="Filter by Today's slips"
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#2563eb',
                      borderRadius: '5px',
                      padding: '2px 6px',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                )}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: '200px' }}>
                <input
                  type="text"
                  placeholder="Search Slip / Lot / Receiver..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px 6px 30px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box'
                  }}
                />
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>

              <button
                type="button"
                onClick={() => handlePrintAllDetails('register')}
                style={{
                  padding: '6px 13px',
                  borderRadius: '8px',
                  border: '1px solid #0f172a',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
                  transition: 'all 0.15s ease'
                }}
                title="Print complete register with all details (A4 Landscape Table)"
              >
                <Printer size={13} />
                <span>Print All Details</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintAllDetails('vouchers')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
                title="Print all individual vouchers in batch"
              >
                <FileText size={13} />
                <span>Print All Slips</span>
              </button>

              <button
                type="button"
                onClick={loadIssueHistory}
                style={{
                  padding: '6px 11px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                }}
                title="Refresh History"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Line-Wise Filter Tabs & Active Date Filter Status */}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            paddingBottom: '12px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', marginRight: '4px' }}>
              LINE WISE TRACK:
            </span>
            {[
              { id: 'all', label: 'All Slips', count: historyLineCounts.all, color: '#0f172a', bg: '#f1f5f9' },
              { id: 'elastic_wo', label: 'Elastic W/O', count: historyLineCounts.elastic_wo, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
              { id: 'tape_wo', label: 'Tape W/O', count: historyLineCounts.tape_wo, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
              { id: 'bone_wo', label: 'Bone W/O', count: historyLineCounts.bone_wo, color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
              { id: 'other_wo', label: 'Other Acc W/O', count: historyLineCounts.other_wo, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
              { id: 'standard', label: 'With LOT (BOM)', count: historyLineCounts.standard, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' }
            ].map(tab => {
              const isActive = historyLineFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryLineFilter(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isActive ? `2px solid ${tab.color}` : '1px solid #cbd5e1',
                    background: isActive ? tab.bg : '#ffffff',
                    color: isActive ? tab.color : '#475569',
                    fontSize: '12px',
                    fontWeight: isActive ? '800' : '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    background: isActive ? tab.color : '#e2e8f0',
                    color: isActive ? '#ffffff' : '#475569',
                    padding: '1px 6px',
                    borderRadius: '10px'
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {historyDateFilter && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#eff6ff',
                border: '1px solid #93c5fd',
                color: '#1d4ed8',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                marginLeft: 'auto'
              }}>
                <Calendar size={12} />
                <span>Date: <strong>{historyDateFilter}</strong> ({processedHistory.length} slips)</span>
                <button
                  type="button"
                  onClick={() => setHistoryDateFilter('')}
                  style={{
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    marginLeft: '4px'
                  }}
                  title="Clear date filter"
                >
                  Clear ✕
                </button>
              </div>
            )}
          </div>

          {/* History Table */}
          {processedHistory.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <Layers size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: '700' }}>No issue slips found for current filter.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Try selecting "All Slips" or clear your search term.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11.5px', fontWeight: '800' }}>
                    <th
                      style={{ padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setHistorySortMode(prev => prev === 'seq_asc' ? 'seq_desc' : 'seq_asc')}
                      title="Click to toggle sequence 1, 2, 3, 4 series sort"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>SEQ #</span>
                        <span style={{ fontSize: '10px', color: '#2563eb' }}>
                          {historySortMode === 'seq_asc' ? '▲ 1-2-3' : historySortMode === 'seq_desc' ? '▼ Latest' : '↕'}
                        </span>
                      </div>
                    </th>
                    <th style={{ padding: '10px 12px' }}>BILL / SLIP NO</th>
                    <th style={{ padding: '10px 12px' }}>LINE TYPE</th>
                    <th
                      style={{ padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setHistorySortMode(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc')}
                      title="Click to toggle date sort"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>DATE</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {historySortMode === 'date_desc' ? '▼' : historySortMode === 'date_asc' ? '▲' : '↕'}
                        </span>
                      </div>
                    </th>
                    <th style={{ padding: '10px 12px' }}>LOT NO</th>
                    <th style={{ padding: '10px 12px' }}>ITEM / STYLE</th>
                    {!historyLineFilter.includes('wo') && (
                      <>
                        <th style={{ padding: '10px 12px' }}>PCS</th>
                        <th style={{ padding: '10px 12px' }}>PER PC REQ.</th>
                      </>
                    )}
                    <th style={{ padding: '10px 12px' }}>TOTAL ISSUE</th>
                    <th style={{ padding: '10px 12px' }}>ISSUED BY</th>
                    <th style={{ padding: '10px 12px' }}>RECEIVED BY</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {processedHistory.map((item, idx) => {
                    const meta = getSlipMeta(item.slipNo);
                    return (
                      <tr key={item.slipNo || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                        {/* Sequence Tracker - Proper 1, 2, 3, 4 Format */}
                        <td style={{ padding: '10px 12px', fontWeight: '900' }}>
                          <span style={{
                            background: '#f8fafc',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            fontWeight: '800',
                            display: 'inline-block'
                          }}>
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Slip No */}
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '12.5px',
                            fontWeight: '800',
                            color: meta.color,
                            background: meta.bg,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${meta.border}`,
                            display: 'inline-block',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.slipNo}
                          </span>
                        </td>

                        {/* Line Type Tag */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            {meta.badgeText}
                          </span>
                        </td>

                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                          {String(item.slipNo || '').toLowerCase().includes('-w/o-') || item.isWithoutLot || item.isWithoutPo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>{item.lotNo && item.lotNo !== 'W/O-LOT' && item.lotNo !== 'W/O-PO-FLOOR' ? `LOT #${item.lotNo}` : 'LOT #—'}</span>
                              <span style={{
                                background: '#fff7ed',
                                color: '#c2410c',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '800',
                                border: '1px solid #fed7aa'
                              }}>
                                W/O BOM
                              </span>
                            </div>
                          ) : (
                            `LOT #${item.lotNo || '—'}`
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.style || item.garmentType || 'LOWER'}
                        </td>
                        {!historyLineFilter.includes('wo') && (
                          <>
                            <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                              {item.quantity || item.issuePcs ? `${item.quantity || item.issuePcs} Pcs` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '800', color: '#047857' }}>
                              {String(item.slipNo || '').toLowerCase().includes('other-')
                                ? (item.otherMaterialName ? item.otherMaterialName : 'Direct Issue')
                                : String(item.slipNo || '').toLowerCase().includes('tape-') || item.tapeRolls
                                  ? '1/45 Roll'
                                  : String(item.slipNo || '').toLowerCase().includes('bone-') || item.boneRolls
                                    ? '18 CM Cut'
                                    : (item.elasticPerPcMtr || item.elastic_per_pc_mtr ? `${item.elasticPerPcMtr || item.elastic_per_pc_mtr} Mtr` : '—')}
                            </td>
                          </>
                        )}
                        <td style={{ padding: '10px 12px', fontWeight: '900', color: '#065f46', background: '#f0fdf4' }}>
                          {String(item.slipNo || '').toLowerCase().includes('other-')
                            ? `${item.otherRollCount || item.rolls || 1} ${item.otherUnit || 'Roll'}(s)`
                            : String(item.slipNo || '').toLowerCase().includes('tape-') || item.tapeRolls
                              ? `${item.tapeRolls || item.rolls || Math.ceil((item.quantity || item.issuePcs || 0) / 45)} Roll(s)`
                              : String(item.slipNo || '').toLowerCase().includes('bone-') || item.boneRolls
                                ? `${item.boneRolls || item.rolls || 1} Roll(s)`
                                : (item.totalElasticMtr || item.total_elastic_mtr ? `${item.totalElasticMtr || item.total_elastic_mtr} Mtr` : `${item.rolls || 1} Roll(s)`)}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>
                          {item.issuerName || 'STORE STAFF'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '700' }}>
                          {item.receiverName || 'CUTTING MASTER'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleReprintFromHistory(item)}
                            title="Print Original Bill (B&W)"
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #0f172a',
                              background: '#0f172a',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              marginRight: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Printer size={11} /> Print (Original)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchLotInput(item.lotNo);
                              handleSearchLot(item.lotNo);
                              setViewMode('generator');
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#059669',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Re-issue
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GENERATED BILL / CONFIRMATION MODAL */}
      {generatedSlipData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '580px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            animation: 'scaleIn 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: generatedSlipData.isSaved
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '18px 24px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: generatedSlipData.isSaved ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: generatedSlipData.isSaved ? '#ffffff' : '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    {generatedSlipData.isSaved ? 'Original Issue Bill Saved & Ready!' : 'Review & Confirm Bill Details'}
                  </h3>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Bill / PO No: <strong>{generatedSlipData.slipNo}</strong> {!generatedSlipData.isSaved && '• (Pending Save Confirmation)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedSlipData(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px' }}>
              {/* Notice banner depending on saved state */}
              {!generatedSlipData.isSaved ? (
                <div style={{
                  background: '#fefce8',
                  border: '1.5px solid #fde047',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#854d0e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600'
                }}>
                  <AlertTriangle size={18} style={{ color: '#ca8a04', flexShrink: 0 }} />
                  <span>Please verify all details below. Click <strong>"Confirm & Save Bill"</strong> to record in system.</span>
                </div>
              ) : (
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '700'
                }}>
                  <CheckCircle size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>✓ Successfully saved to database & history! You can now print or download the original bill.</span>
                </div>
              )}

              {/* Details Grid */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>
                      {(generatedSlipData.isWithoutLot || generatedSlipData.isWithoutPo) ? 'LOT NUMBER & MODE' : 'LOT NUMBER'}
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      LOT #{generatedSlipData.lotNo || '—'}
                      {(generatedSlipData.isWithoutLot || generatedSlipData.isWithoutPo) && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#ea580c', background: '#fff7ed', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                          ⚡ WITHOUT BOM
                        </span>
                      )}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>TOTAL ISSUE ON BILL</span>
                    <strong style={{ color: '#059669', fontSize: '16px' }}>
                      {materialMode === 'tape' || String(generatedSlipData.slipNo || '').toLowerCase().includes('tape-')
                        ? `${generatedSlipData.tapeRolls || generatedSlipData.rolls || Math.ceil((generatedSlipData.issuePcs || generatedSlipData.quantity || 0) / 45)} Roll(s)`
                        : materialMode === 'bone' || String(generatedSlipData.slipNo || '').toLowerCase().includes('bone-')
                          ? `${generatedSlipData.boneRolls || 1} Roll(s)`
                          : `${generatedSlipData.totalElasticMtr || 0} Mtr (${generatedSlipData.rolls || 1} Rolls)`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ITEM / STYLE & PCS</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.style || 'LOWER'} • {generatedSlipData.issuePcs || generatedSlipData.quantity || 0} Pcs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>PER PC REQUIREMENT</span>
                    <strong style={{ color: '#047857' }}>
                      {materialMode === 'tape' || String(generatedSlipData.slipNo || '').toLowerCase().includes('tape-')
                        ? '1/45 Roll / Pc (Pcs ÷ 45 Rule)'
                        : materialMode === 'bone' || String(generatedSlipData.slipNo || '').toLowerCase().includes('bone-')
                          ? '18 CM / Pc (Standard Cut)'
                          : `${generatedSlipData.elasticPerPcMtr || 1.27} Mtr / Pc`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUE DATE</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>SUPERVISOR</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.supervisorName || 'ROHIT / MONU'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>ISSUED BY (STORE)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.issuerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>RECEIVED BY (CUTTING)</span>
                    <strong style={{ color: '#0f172a' }}>{generatedSlipData.receiverName}</strong>
                  </div>
                  {generatedSlipData.remarks && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '600' }}>REMARKS / NOTES</span>
                      <span style={{ color: '#334155', fontStyle: 'italic' }}>{generatedSlipData.remarks}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Pending Confirm vs Saved */}
              {!generatedSlipData.isSaved ? (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={handleConfirmAndSaveBill}
                      disabled={savingSlip}
                      style={{
                        flex: 1.3,
                        padding: '14px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: '800',
                        cursor: savingSlip ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
                        opacity: savingSlip ? 0.8 : 1
                      }}
                    >
                      {savingSlip ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Saving Details...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={17} />
                          <span>Confirm & Save Bill Details</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintBill}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1.5px solid #0f172a',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Printer size={16} />
                      <span>Preview / Print (B&W)</span>
                    </button>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setGeneratedSlipData(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Cancel & Edit Details
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={handlePrintBill}
                      style={{
                        flex: 1.2,
                        padding: '13px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '13.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.35)'
                      }}
                    >
                      <Printer size={16} />
                      <span>Print Original Bill (B&W)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      style={{
                        flex: 1,
                        padding: '13px',
                        borderRadius: '10px',
                        border: '1.5px solid #059669',
                        background: '#ffffff',
                        color: '#059669',
                        fontSize: '13.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Download size={16} />
                      <span>Download Bill (PDF)</span>
                    </button>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setGeneratedSlipData(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#059669',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Done / Issue Next Lot →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HIGH-RES MATERIAL PHOTO ZOOM MODAL */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              animation: 'scaleIn 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 18px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {previewPhotoUrl.title || 'Material Photo Preview'}
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#94a3b8', marginTop: '3px', flexWrap: 'wrap' }}>
                  {previewPhotoUrl.code && <span>ID: <strong style={{ color: '#60a5fa' }}>{previewPhotoUrl.code}</strong></span>}
                  {previewPhotoUrl.stock && <span>Stock: <strong style={{ color: '#4ade80' }}>{previewPhotoUrl.stock}</strong></span>}
                  {previewPhotoUrl.location && <span>Loc: {previewPhotoUrl.location}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Image Area */}
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: '75vh',
              overflow: 'auto'
            }}>
              <img
                src={previewPhotoUrl.url || previewPhotoUrl}
                alt={previewPhotoUrl.title || 'Material'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MANAGE ACCESSORY COMPONENT TYPES MODAL */}
      {showManageOtherTypesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(3px)',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            border: '1px solid #cbd5e1'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={16} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  Manage Accessory Component Types
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageOtherTypesModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748b' }}>
                All custom accessory types entered are saved and shown in your dropdown list across other accessories issues.
              </p>

              {/* Add New Type input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newOtherTypeNameInput.trim()) {
                    const added = addCustomOtherComponentType(newOtherTypeNameInput);
                    if (added) {
                      handleSelectComponentCategory(added, 'Pcs');
                      showToast(`Added custom category "${added}"!`);
                    }
                    setNewOtherTypeNameInput('');
                  }
                }}
                style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}
              >
                <input
                  type="text"
                  placeholder="Type new category (e.g. VELCRO, BUCKLE)..."
                  value={newOtherTypeNameInput}
                  onChange={(e) => setNewOtherTypeNameInput(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '7px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    outline: 'none'
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newOtherTypeNameInput.trim()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: newOtherTypeNameInput.trim() ? '#7c3aed' : '#cbd5e1',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: newOtherTypeNameInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  + Add
                </button>
              </form>

              {/* Types List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {/* Default Standard Types */}
                {BASE_OTHER_COMPONENT_TYPES.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#475569'
                    }}
                  >
                    <span>{idx + 1}. {t}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                      Standard
                    </span>
                  </div>
                ))}

                {/* Custom Types */}
                {customOtherComponentTypes.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#0f172a'
                    }}
                  >
                    <span>{BASE_OTHER_COMPONENT_TYPES.length + idx + 1}. {t}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeCustomOtherComponentType(t);
                        if (selectedOtherCategory.toUpperCase() === t.toUpperCase()) {
                          handleSelectComponentCategory('ALL');
                        }
                        showToast(`Removed custom category "${t}".`);
                      }}
                      title={`Delete "${t}" from list`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                ))}

                {customOtherComponentTypes.length === 0 && (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No custom types added yet. Use "+ Add Manually (Custom Type)" in the dropdown or add one above!
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowManageOtherTypesModal(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
