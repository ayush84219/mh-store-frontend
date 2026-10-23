import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  ChevronDown,
  Settings,
  Filter
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to get official Item Code (guarantees Item Code ST... is used, never MT or ITM- placeholder)
export const getItemCodeDisplay = (m, materialsList = []) => {
  if (!m) return '';

  let code = '';
  const list = (Array.isArray(materialsList) && materialsList.length > 0)
    ? materialsList
    : (typeof window !== 'undefined' && window.__gpdms_materials ? window.__gpdms_materials : []);

  if (typeof m === 'string') {
    const raw = m.trim();
    if (!raw || raw.toUpperCase().startsWith('ITM-')) return '';
    const match = list.find(x =>
      String(x.id).toLowerCase() === raw.toLowerCase() ||
      String(x.itemCode || '').toLowerCase() === raw.toLowerCase() ||
      String(x.stCode || '').toLowerCase() === raw.toLowerCase() ||
      String(x.name || '').trim().toLowerCase() === raw.toLowerCase()
    );
    if (match && (match.itemCode || match.stCode)) {
      code = String(match.itemCode || match.stCode).trim();
    } else {
      code = raw;
    }
  } else if (typeof m === 'object') {
    code = String(m.itemCode || m.stCode || m.item_code || m.materialCode || '').trim();
    if (code.toUpperCase().startsWith('ITM-')) code = '';

    // If not found directly, check if m.id or m.materialId is an ST/MT code
    const matId = String(m.materialId || m.id || '').trim();
    if (!code && matId && !matId.toUpperCase().startsWith('ITM-')) {
      if (matId.toUpperCase().startsWith('ST') || matId.toUpperCase().startsWith('MT')) {
        code = matId;
      }
    }

    // Look up in materials list by ID or by Name
    if (!code && list.length > 0) {
      const targetId = String(m.materialId || m.id || '').trim().toLowerCase();
      const targetName = String(m.name || m.materialName || '').trim().toLowerCase();
      const match = list.find(x =>
        (targetId && (String(x.id).toLowerCase() === targetId || String(x.itemCode || '').toLowerCase() === targetId || String(x.stCode || '').toLowerCase() === targetId)) ||
        (targetName && String(x.name || '').trim().toLowerCase() === targetName)
      );
      if (match && (match.itemCode || match.stCode || match.id)) {
        code = String(match.itemCode || match.stCode || match.id).trim();
      }
    }
  }

  if (!code || code.toUpperCase().startsWith('ITM-')) return '';

  // Clean out any MT prefix: MT1222 -> ST1222, MT0014 -> ST0014
  if (code.toUpperCase().startsWith('MT')) {
    code = 'ST' + code.substring(2);
  } else if (/^M\d+/i.test(code)) {
    code = 'ST' + code.replace(/^\D+/g, '').padStart(5, '0');
  } else if (/^\d+$/.test(code) && code.length <= 5) {
    code = 'ST' + code.padStart(5, '0');
  }

  return code;
};

// Helper to look up material store stock from materials inventory
export const getMaterialStoreStock = (m, allMaterials = []) => {
  if (!m) return 0;
  // 1. Direct availableStock or stock on m
  if (m.availableStock !== undefined && m.availableStock !== null && Number(m.availableStock) > 0) {
    return Number(m.availableStock);
  }
  if (m.stock !== undefined && m.stock !== null && Number(m.stock) > 0) {
    return Number(m.stock);
  }

  const matsList = Array.isArray(allMaterials) ? allMaterials : [];
  if (matsList.length > 0) {
    // 2. Look up by ID
    const targetId = m.materialId || m.id;
    if (targetId) {
      const found = matsList.find(x => String(x.id).trim().toLowerCase() === String(targetId).trim().toLowerCase());
      if (found && found.stock !== undefined && found.stock !== null) {
        return Number(found.stock) || 0;
      }
    }

    // 3. Look up by itemCode
    const targetCode = String(m.itemCode || m.stCode || '').trim().toLowerCase();
    if (targetCode) {
      const found = matsList.find(x => {
        const c = String(x.itemCode || x.stCode || '').trim().toLowerCase();
        return c && c === targetCode;
      });
      if (found && found.stock !== undefined && found.stock !== null) {
        return Number(found.stock) || 0;
      }
    }

    // 4. Look up by name
    const targetName = String(m.name || m.bomItemName || '').trim().toLowerCase();
    if (targetName) {
      const found = matsList.find(x => String(x.name || '').trim().toLowerCase() === targetName);
      if (found && found.stock !== undefined && found.stock !== null) {
        return Number(found.stock) || 0;
      }
    }
  }

  return Number(m.stock || m.availableStock || 0);
};

// Helper to calculate Total Pieces (Cutting Total Pieces according to lot wise), Issued Pcs, and Variance (Cutting - Issue)
export const getChallanPiecesMetrics = (log, allMaterials = [], cuttingMap = {}, designs = []) => {
  if (!log) return { totalPieces: 0, issuePcs: 0, variance: 0, totalStoreStock: 0, stockBreakdown: [], cuttingVolume: 0, isDirect: true };
  const mats = log.materials || [];
  const issuePcs = mats.reduce((sum, m) => sum + (Number(m.qty) || 0), 0);

  const cleanLot = String(log.lotId || '').trim().toLowerCase();
  const isDirect = !cleanLot || cleanLot === 'direct-item' || cleanLot.includes('direct');

  // 1. Resolve Cutting Total Pieces for this lot from cuttingMap (cutting_header database)
  let cuttingVolume = 0;
  if (!isDirect && cleanLot) {
    if (cuttingMap && cuttingMap[cleanLot] !== undefined && cuttingMap[cleanLot] !== null) {
      cuttingVolume = Number(cuttingMap[cleanLot]) || 0;
    }
  }

  // 2. Fallback to designs prop (if design has garment quantity)
  if (!cuttingVolume && !isDirect && cleanLot && Array.isArray(designs)) {
    const dMatch = designs.find(d => 
      String(d.id || '').trim().toLowerCase() === cleanLot || 
      String(d.lotNumber || '').trim().toLowerCase() === cleanLot
    );
    if (dMatch && Number(dMatch.quantity) > 0) {
      cuttingVolume = Number(dMatch.quantity);
    }
  }

  // 3. Fallback to log.volume / log.pieces if recorded
  if (!cuttingVolume && !isDirect) {
    const rawVol = Number(log.volume !== undefined && log.volume !== null ? log.volume : (log.pieces || 0));
    if (rawVol > 0) {
      cuttingVolume = rawVol;
    }
  }

  // Stock breakdown for materials inventory reference
  const stockBreakdown = mats.map(m => {
    const matName = m.name || m.bomItemName || 'Material';
    const unit = m.unit || 'Pcs';
    const qty = Number(m.qty) || 0;
    const storeStock = getMaterialStoreStock(m, allMaterials);
    const itemCode = getItemCodeDisplay(m) || m.itemCode || '';
    const location = m.location || '';
    return {
      name: matName,
      unit,
      qty,
      storeStock,
      itemCode,
      location,
      variance: storeStock - qty
    };
  });
  const totalStoreStock = stockBreakdown.reduce((sum, item) => sum + (item.storeStock || 0), 0);

  // Total Pieces shows ONLY cutting total pieces according to lot wise
  const totalPieces = isDirect ? 0 : cuttingVolume;
  const variance = totalPieces > 0 ? (totalPieces - issuePcs) : -issuePcs;

  return { 
    totalPieces, 
    totalStoreStock, 
    issuePcs, 
    variance, 
    stockBreakdown, 
    cuttingVolume,
    isDirect
  };
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
      else if (ct && ct !== '__custom__' && ct !== '__manage__') matchKeywords = [ct];

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

              {selectedMaterial.category && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  background: '#fff7ed',
                  color: '#c2410c',
                  border: '1px solid #fed7aa',
                  padding: '1.5px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  flexShrink: 0
                }}>
                  {selectedMaterial.category}
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

                      {/* Category Badge */}
                      {mat.category && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          background: '#fff7ed',
                          color: '#c2410c',
                          border: '1px solid #fed7aa',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {mat.category}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px', flexWrap: 'wrap' }}>
                          {mat.location && (
                            <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={10} style={{ color: '#0284c7' }} />
                              <span>{mat.location}</span>
                            </div>
                          )}
                          {mat.category && (
                            <span style={{ fontSize: '10px', color: '#ea580c', fontWeight: '700' }}>
                              • {mat.category}
                            </span>
                          )}
                        </div>
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
  onRedirectToTab,
  onSubmitApproval = null,
  initialTab = 'issue',
  isMovementReport = false
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'issue');

  useEffect(() => {
    if (Array.isArray(materials) && materials.length > 0 && typeof window !== 'undefined') {
      window.__gpdms_materials = materials;
    }
  }, [materials]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Issue Workflow Mode: 'item_only' (Direct single/multiple items issue without lot) vs 'floor_lot' (Batch issue against lot)
  const [issueMode, setIssueMode] = useState('item_only'); // 'item_only' | 'floor_lot'

  // Form Fields
  const [lotNo, setLotNo] = useState('');
  const [brandName, setBrandName] = useState('');
  const [styleName, setStyleName] = useState('Direct Item Requisition');
  const [pieces, setPieces] = useState(1);
  const [personName, setPersonName] = useState(currentUser?.name || 'paras');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDept, setReceiverDept] = useState('Cutting');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Available brands from designs list
  const availableBrands = useMemo(() => {
    const set = new Set();
    (designs || []).forEach(d => {
      if (d.brand && typeof d.brand === 'string') {
        const b = d.brand.trim();
        if (b) set.add(b);
      }
    });
    return Array.from(set).sort();
  }, [designs]);

  // ── Cutting Cache Management & 30-Minute Auto-Reload ───────────────────────
  const CUTTING_CACHE_MAX_ENTRIES = 100;
  const CUTTING_CACHE_RELOAD_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  const [cuttingHeaders, setCuttingHeaders] = useState([]);
  const [lastCuttingCacheReload, setLastCuttingCacheReload] = useState(() => new Date());
  const [isReloadingCuttingCache, setIsReloadingCuttingCache] = useState(false);
  const [cuttingCacheRefreshCount, setCuttingCacheRefreshCount] = useState(0);
  const [cacheReloadNotice, setCacheReloadNotice] = useState('');

  // ── In-Memory Matrix Cache to avoid repeat API hits ──
  const matrixCacheRef = useRef({});

  // Reload cache function: empties in-memory matrix cache and reloads cutting headers from MySQL
  const reloadCuttingCache = useCallback(async (manual = false) => {
    setIsReloadingCuttingCache(true);
    // 1. If cache is full or on 30m reload, empty the cache
    matrixCacheRef.current = {};
    console.log('[Cutting Cache] Matrix cache emptied');

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
      console.log('[Cutting Cache] 30-minute interval timer fired: Emptying cache and reloading headers');
      reloadCuttingCache(false);
    }, CUTTING_CACHE_RELOAD_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [reloadCuttingCache]);

  // Map of lowercase lot number -> Cutting Total Pieces
  const cuttingLotMap = useMemo(() => {
    const map = {};
    (cuttingHeaders || []).forEach(ch => {
      if (ch.Lot_Number) {
        const k = String(ch.Lot_Number).trim().toLowerCase();
        const q = Number(ch.Cutting_Qty) || 0;
        if (q > 0) map[k] = q;
      }
    });
    (designs || []).forEach(d => {
      const q = Number(d.quantity) || 0;
      if (q > 0) {
        if (d.id) {
          const k1 = String(d.id).trim().toLowerCase();
          if (!map[k1]) map[k1] = q;
        }
        if (d.lotNumber) {
          const k2 = String(d.lotNumber).trim().toLowerCase();
          if (!map[k2]) map[k2] = q;
        }
      }
    });
    return map;
  }, [cuttingHeaders, designs]);

  // Effective cutting map from in-memory cuttingHeaders and designs (Instant 0ms, zero network lag)
  const effectiveCuttingMap = cuttingLotMap;



  // ── Active Lot Cutting Details State & Fetch ────────────────────────────────
  const [activeLotCutting, setActiveLotCutting] = useState(null);
  const [loadingActiveLotCutting, setLoadingActiveLotCutting] = useState(false);
  const [showActiveCuttingMatrix, setShowActiveCuttingMatrix] = useState(false);

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

  // Synchronous INSTANT lookup from memory (0ms) + debounced background matrix fetch
  useEffect(() => {
    const cleanLot = String(lotNo || '').trim();
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

    const memoryTotal = Number(headerMatch?.Cutting_Qty) || Number(designMatch?.quantity) || 0;
    const hasMemoryData = Boolean(headerMatch || designMatch);

    // Set immediate cutting details synchronously without waiting for network!
    setActiveLotCutting({
      lotNumber: cleanLot,
      totalPieces: memoryTotal,
      style: headerMatch?.Style || designMatch?.category || '',
      fabric: headerMatch?.Fabric || '',
      brand: headerMatch?.Brand || designMatch?.brand || '',
      partyName: headerMatch?.Party_Name || '',
      garmentType: headerMatch?.Garment_Type || '',
      dateOfIssue: headerMatch?.Date_of_Issue || headerMatch?.JobOrder_Date || '',
      shades: headerMatch?.Shades || '',
      sizes: headerMatch?.Sizes || '',
      rows: matrixCacheRef.current[cleanLower]?.rows || [],
      hasDetails: hasMemoryData
    });

    // Auto-fill form fields immediately
    if (headerMatch?.Brand || designMatch?.brand) {
      setBrandName(headerMatch?.Brand || designMatch?.brand);
    }
    if (headerMatch?.Style || designMatch?.category) {
      setStyleName(headerMatch?.Style || designMatch?.category);
    }
    if (memoryTotal > 0 && (!pieces || pieces === 1)) {
      setPieces(memoryTotal);
    }

    // If already cached in matrixCache, we have full matrix!
    if (matrixCacheRef.current[cleanLower]) {
      setLoadingActiveLotCutting(false);
      return;
    }

    // 2. Debounced background fetch for detailed Color-Size Matrix (350ms debounce to avoid typing lag)
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setLoadingActiveLotCutting(true);
      try {
        const res = await fetch(`${getBackendUrl()}/api/cutting/${encodeURIComponent(cleanLot)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        // If cache is full (capacity limit reached), empty cache to prevent memory bloat
        if (Object.keys(matrixCacheRef.current).length >= CUTTING_CACHE_MAX_ENTRIES) {
          console.log(`[Cutting Cache] Cache reached capacity (${CUTTING_CACHE_MAX_ENTRIES} entries). Emptying cache...`);
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
        const dateVal = data?.dateOfIssue || data?.header?.Date_of_Issue || data?.jobOrderDate || '';

        setActiveLotCutting(prev => ({
          ...prev,
          totalPieces: resolvedTotal,
          style: prev?.style || styleVal,
          fabric: prev?.fabric || fabricVal,
          brand: prev?.brand || brandVal,
          partyName: prev?.partyName || partyVal,
          shades: prev?.shades || shadesVal,
          sizes: prev?.sizes || sizesVal,
          dateOfIssue: prev?.dateOfIssue || dateVal,
          rows: matrixRows,
          hasDetails: Boolean(hasMemoryData || matrixRows.length > 0 || resolvedTotal > 0 || styleVal || fabricVal)
        }));

        if (brandVal && !brandName) setBrandName(brandVal);
        if (styleVal && (!styleName || styleName === 'Direct Item Requisition')) setStyleName(styleVal);
        if (resolvedTotal > 0 && (!pieces || pieces === 1)) setPieces(resolvedTotal);
      } catch (err) {
        // Silently keep the in-memory data
      } finally {
        if (!isCancelled) setLoadingActiveLotCutting(false);
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [lotNo, cuttingHeaders, designs, cuttingCacheRefreshCount]);

  // ── Cutting Pieces & 1% Extra Material Allowance ──
  // Resolves cutting pieces from verified cutting sheet / cuttingHeaders / designs
  const cuttingPieces = useMemo(() => {
    const clean = String(lotNo || '').trim().toLowerCase();
    if (!clean) return 0;
    if (activeLotCutting?.totalPieces > 0) return Number(activeLotCutting.totalPieces);
    if (effectiveCuttingMap && effectiveCuttingMap[clean] > 0) return Number(effectiveCuttingMap[clean]);
    return 0;
  }, [lotNo, activeLotCutting, effectiveCuttingMap]);

  // Automatic 1% material addition: e.g. 1000 pieces -> 1% = 10 -> Total 1010 pieces
  const onePercentAllowance = useMemo(() => {
    if (cuttingPieces <= 0) return 0;
    return Math.round(cuttingPieces * 0.01);
  }, [cuttingPieces]);

  // Default Issue Quantity: Cutting Pieces + 1% Extra (e.g. 1000 + 10 = 1010)
  const defaultAutoIssueQty = useMemo(() => {
    if (cuttingPieces <= 0) return 1;
    return cuttingPieces + onePercentAllowance;
  }, [cuttingPieces, onePercentAllowance]);

  // Automatically update initial or unedited items when cutting quantity resolves with 1% extra
  useEffect(() => {
    if (defaultAutoIssueQty > 1) {
      setItems(prev => prev.map(item => {
        // If row is at initial default value (1) or 0, update to defaultAutoIssueQty (capped by rack stock if mapped)
        if (!item.totalQty || Number(item.totalQty) === 1) {
          const liveMat = (materials || []).find(m => String(m.id) === String(item.materialId));
          const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(item.availableStock) || 0);
          if (item.materialId && item.entryMode !== 'manual') {
            const cappedQty = rackStock > 0 ? Math.min(defaultAutoIssueQty, rackStock) : (rackStock === 0 ? 0 : 1);
            return { ...item, totalQty: cappedQty };
          }
          return { ...item, totalQty: defaultAutoIssueQty };
        }
        return item;
      }));
    }
  }, [defaultAutoIssueQty, materials]);

  // 1% Threshold Exceeded Approval Modal State
  const [approvalModalData, setApprovalModalData] = useState(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalReason, setApprovalReason] = useState('Extra floor material requisition exceeding 1% cutting allowance');

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

  // Compute stock shortages across all currently chosen items
  const shortageItemsList = useMemo(() => {
    return items.filter(i => {
      if (!i.materialId || i.entryMode === 'manual') return false;
      const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
      const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(i.availableStock) || 0);
      return Number(i.totalQty) > rackStock;
    });
  }, [items, materials]);

  const hasShortageItems = shortageItemsList.length > 0;

  // Helper to extract clean photo URL for any material in logs or materials prop
  const getMaterialPhoto = (m) => {
    if (!m) return '';
    const direct = m.imageUrl || m.photo || m.image || m.imgUrl;
    if (direct) return getCleanImageUrl(direct);
    const mId = m.materialId || m.id;
    const mName = m.name || m.materialName || m.bomItemName;
    if (mId || mName) {
      const match = (materials || []).find(mat => 
        (mId && String(mat.id) === String(mId)) ||
        (mName && String(mat.name).trim().toLowerCase() === String(mName).trim().toLowerCase()) ||
        (m.itemCode && String(mat.itemCode || '').trim().toLowerCase() === String(m.itemCode).trim().toLowerCase())
      );
      if (match) {
        const foundImg = match.imageUrl || match.image || match.photo || match.imgUrl;
        if (foundImg) return getCleanImageUrl(foundImg);
      }
    }
    return '';
  };

  // Helper to extract component/category name for any material item
  const getMaterialCategory = (m) => {
    if (!m) return '';
    const directType = m.componentType || m.bomItemName;
    if (directType && directType !== 'Accessory' && directType !== 'Material Item' && directType !== 'Standard' && directType !== 'Custom Accessory') {
      return directType;
    }
    if (m.category && m.category !== 'General' && m.category !== 'Standard') {
      return m.category;
    }

    const mId = m.materialId || m.id;
    const mName = m.name || m.materialName;
    if (mId || mName) {
      const match = (materials || []).find(mat => 
        (mId && String(mat.id) === String(mId)) ||
        (mName && String(mat.name).trim().toLowerCase() === String(mName).trim().toLowerCase()) ||
        (m.itemCode && String(mat.itemCode || '').trim().toLowerCase() === String(m.itemCode).trim().toLowerCase())
      );
      if (match) {
        return match.category || match.componentType || match.type || directType || '';
      }
    }
    return directType || m.category || '';
  };

  // Helper to extract location / rack number for any material item
  const getMaterialLocation = (m) => {
    if (!m) return '';
    const directLoc = m.location || m.warehouseLocation || m.storeLocation || m.rack || m.rackNo;
    if (directLoc && directLoc !== 'Store' && directLoc !== 'Main Store') {
      return directLoc;
    }
    const mId = m.materialId || m.id;
    const mName = m.name || m.materialName || m.bomItemName;
    const code = m.itemCode;
    const mCat = (m.bomItemName || m.componentType || m.category || '').trim().toLowerCase();

    if (mId || mName || code) {
      let match = (materials || []).find(mat => 
        (mId && String(mat.id) === String(mId)) ||
        (code && String(mat.itemCode || '').trim().toLowerCase() === String(code).trim().toLowerCase())
      );

      if (!match && mName && mCat) {
        match = (materials || []).find(mat => {
          const matName = String(mat.name || '').trim().toLowerCase();
          const matCat = String(mat.category || mat.componentType || mat.type || '').trim().toLowerCase();
          return matName === String(mName).trim().toLowerCase() && (matCat.includes(mCat) || mCat.includes(matCat));
        });
      }

      if (!match && mName) {
        match = (materials || []).find(mat => 
          String(mat.name || '').trim().toLowerCase() === String(mName).trim().toLowerCase()
        );
      }

      if (match && (match.location || match.warehouseLocation || match.storeLocation || match.rack || match.rackNo)) {
        return match.location || match.warehouseLocation || match.storeLocation || match.rack || match.rackNo;
      }
    }
    return directLoc || '';
  };

  // Helper to parse log date string (DD/MM/YYYY or YYYY-MM-DD) into standard YYYY-MM-DD
  const parseLogDateToYmd = (dateStr) => {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    // Check if DD/MM/YYYY or DD-MM-YYYY (e.g. "15/10/2026" or "15/10/2026 18:14")
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    // Check if YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  };

  // History Tab Filters State (Dates, Category Multi-Select, Person, Search)
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyCategories, setHistoryCategories] = useState([]); // multi-select categories array e.g. ['TAG', 'LABEL']
  const [historyPersons, setHistoryPersons] = useState([]); // multi-select person array e.g. ['iss:paras', 'rec:PINTU']

  // Scrollable Category Dropdown Menu State
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const categoryDropdownRef = useRef(null);

  // Scrollable Person Dropdown Menu State
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const personDropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
      if (personDropdownRef.current && !personDropdownRef.current.contains(e.target)) {
        setPersonDropdownOpen(false);
      }
    };
    if (categoryDropdownOpen || personDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [categoryDropdownOpen, personDropdownOpen]);

  // Category multi-select toggle (allows choosing 2-3+ categories together)
  const handleToggleHistoryCategory = (catName) => {
    const upper = catName.trim().toUpperCase();
    setHistoryCategories(prev => {
      if (prev.includes(upper)) {
        return prev.filter(c => c !== upper);
      } else {
        return [...prev, upper];
      }
    });
  };

  // Person multi-select toggle (allows choosing multiple store issuers / floor masters)
  const handleToggleHistoryPerson = (personKey) => {
    setHistoryPersons(prev => {
      if (prev.includes(personKey)) {
        return prev.filter(p => p !== personKey);
      } else {
        return [...prev, personKey];
      }
    });
  };

  const formatPersonKey = (key) => {
    if (!key) return '';
    if (key.startsWith('iss:')) return `Store: ${key.replace('iss:', '')}`;
    if (key.startsWith('rec:')) return `Floor: ${key.replace('rec:', '')}`;
    return key;
  };

  // Date Quick Preset Handlers
  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setHistoryDateFrom(today);
    setHistoryDateTo(today);
  };

  const handleSetYesterday = () => {
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    setHistoryDateFrom(yest);
    setHistoryDateTo(yest);
  };

  const handleSetLast7Days = () => {
    const today = new Date().toISOString().split('T')[0];
    const past = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    setHistoryDateFrom(past);
    setHistoryDateTo(today);
  };

  const handleResetAllFilters = () => {
    setHistorySearch('');
    setHistoryDateFrom('');
    setHistoryDateTo('');
    setHistoryCategories([]);
    setHistoryPersons([]);
    setPersonSearchTerm('');
    setPersonDropdownOpen(false);
    setCategorySearchTerm('');
    setCategoryDropdownOpen(false);
  };

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

  // Raw without-bom issue logs for history tab (Strictly Without-BOM only)
  const rawWithoutBomLogs = useMemo(() => {
    const logs = [...(issueLogs || [])];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const localElastic = localStorage.getItem('gpdms_elastic_issue_history');
        if (localElastic) {
          const parsed = JSON.parse(localElastic);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              const pSlip = String(p.slipNo || p.slip_no || '').trim().toUpperCase();
              if (pSlip.startsWith('OTHER-') && !logs.some(l => String(l.id || '').toUpperCase() === pSlip)) {
                logs.push({
                  id: p.slipNo || p.slip_no,
                  lotId: p.lotNo || 'W/O BOM',
                  isWithoutBom: true,
                  category: 'OTHER ACCESSORIES',
                  volume: Number(p.otherRollCount || p.rolls || 1),
                  pieces: Number(p.quantity || p.issuePcs || 0),
                  personName: p.issuerName || 'Store In-charge',
                  receiverName: p.receiverName || 'Cutting Master',
                  date: p.date || p.issueDate || '',
                  style: p.style || 'LOWER',
                  remarks: p.remarks || 'Other Accessories Issue',
                  materials: [{
                    name: p.otherMaterialName || 'Other Accessory',
                    bomItemName: 'OTHER ACCESSORIES',
                    qty: Number(p.otherRollCount || p.rolls || 1),
                    unit: p.otherUnit || 'Roll',
                    itemCode: p.otherItemCode || ''
                  }]
                });
              }
            });
          }
        }
      }
    } catch (_) {}

    return logs.filter(l => {
      const vid = String(l.id || '').toUpperCase();
      // STRICT: Exclude Extra Material & Re-Issues
      if (l.isReissue || vid.startsWith('EMI-') || vid.startsWith('RI-') || String(l.personName || '').toLowerCase().includes('extra')) {
        return false;
      }
      return Boolean(
        l.isWithoutBom ||
        vid.startsWith('BILL-MI-') ||
        vid.startsWith('CH-MI-') ||
        vid.startsWith('WO-MI-') ||
        vid.startsWith('MI-WO-') ||
        vid.startsWith('OTHER-') ||
        String(l.category || '').toUpperCase().includes('WITHOUT BOM') ||
        String(l.category || '').toUpperCase().includes('OTHER') ||
        String(l.lotId || '').toUpperCase().includes('DIRECT')
      );
    });
  }, [issueLogs]);

  // Distinct categories available in Without-BOM logs + count of challans having them
  const availableHistoryCategories = useMemo(() => {
    const counts = {};
    // Seed default common categories
    ['TAG', 'LABEL', 'DORI', 'ZIP', 'ELASTIC', 'BUTTON', 'OTHER ACCESSORIES'].forEach(c => { counts[c] = 0; });

    rawWithoutBomLogs.forEach(l => {
      const seenInThisLog = new Set();
      (l.materials || []).forEach(m => {
        const cat = getMaterialCategory(m);
        if (cat && typeof cat === 'string' && cat.trim()) {
          seenInThisLog.add(cat.trim().toUpperCase());
        }
      });
      if (l.category && typeof l.category === 'string' && l.category.trim() && !l.category.toUpperCase().includes('WITHOUT BOM')) {
        seenInThisLog.add(l.category.trim().toUpperCase());
      }
      seenInThisLog.forEach(cat => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });

    return Object.keys(counts)
      .filter(Boolean)
      .sort((a, b) => {
        if ((counts[b] > 0) !== (counts[a] > 0)) {
          return counts[b] > 0 ? 1 : -1;
        }
        return a.localeCompare(b);
      })
      .map(name => ({ name, count: counts[name] || 0 }));
  }, [rawWithoutBomLogs, materials]);

  // Filtered categories for category dropdown menu search
  const filteredCategoryOptions = useMemo(() => {
    if (!categorySearchTerm.trim()) return availableHistoryCategories;
    const term = categorySearchTerm.trim().toLowerCase();
    return availableHistoryCategories.filter(c => c.name.toLowerCase().includes(term));
  }, [availableHistoryCategories, categorySearchTerm]);

  // Distinct issuers & receivers for person filter with challan count
  const availablePeople = useMemo(() => {
    const issuerCounts = {};
    const receiverCounts = {};
    rawWithoutBomLogs.forEach(l => {
      const iss = l.personName && typeof l.personName === 'string' ? l.personName.trim() : '';
      if (iss) {
        issuerCounts[iss] = (issuerCounts[iss] || 0) + 1;
      }
      const rec = l.receiverName && typeof l.receiverName === 'string' ? l.receiverName.trim() : '';
      if (rec) {
        receiverCounts[rec] = (receiverCounts[rec] || 0) + 1;
      }
    });

    const issuers = Object.keys(issuerCounts)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({ key: `iss:${name}`, name, role: 'Store', count: issuerCounts[name] }));

    const receivers = Object.keys(receiverCounts)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({ key: `rec:${name}`, name, role: 'Floor', count: receiverCounts[name] }));

    return {
      issuers,
      receivers,
      total: issuers.length + receivers.length
    };
  }, [rawWithoutBomLogs]);

  // Filtered issuers & receivers for person dropdown search
  const filteredPeople = useMemo(() => {
    if (!personSearchTerm.trim()) return availablePeople;
    const term = personSearchTerm.trim().toLowerCase();
    return {
      issuers: availablePeople.issuers.filter(p => p.name.toLowerCase().includes(term) || `store: ${p.name}`.toLowerCase().includes(term)),
      receivers: availablePeople.receivers.filter(p => p.name.toLowerCase().includes(term) || `floor: ${p.name}`.toLowerCase().includes(term)),
      total: availablePeople.total
    };
  }, [availablePeople, personSearchTerm]);

  // Filtered without-bom issue logs based on search, dates, multi-select categories, and multi-select persons
  const withoutBomLogs = useMemo(() => {
    return rawWithoutBomLogs.filter(l => {
      // 1. Date Range Filter
      if (historyDateFrom || historyDateTo) {
        const logDateYmd = parseLogDateToYmd(l.date);
        if (!logDateYmd) return false;
        if (historyDateFrom && logDateYmd < historyDateFrom) return false;
        if (historyDateTo && logDateYmd > historyDateTo) return false;
      }

      // 2. Category Multi-Select Filter (user can pick 2-3+ categories at once)
      if (historyCategories.length > 0) {
        const hasMatchingCat = (l.materials || []).some(m => {
          const cat = (getMaterialCategory(m) || '').trim().toUpperCase();
          return historyCategories.some(sel => {
            const selUpper = sel.trim().toUpperCase();
            return cat === selUpper || cat.includes(selUpper) || selUpper.includes(cat);
          });
        }) || (l.category && historyCategories.some(sel => String(l.category).toUpperCase().includes(sel.toUpperCase())));

        if (!hasMatchingCat) return false;
      }

      // 3. Person Wise Multi-Select Filter (Store Issuer or Floor Receiver)
      if (historyPersons.length > 0) {
        const matchesAnyPerson = historyPersons.some(hp => {
          if (hp.startsWith('iss:')) {
            const target = hp.replace('iss:', '').trim().toLowerCase();
            return String(l.personName || '').trim().toLowerCase() === target;
          } else if (hp.startsWith('rec:')) {
            const target = hp.replace('rec:', '').trim().toLowerCase();
            return String(l.receiverName || '').trim().toLowerCase().includes(target);
          } else {
            const target = hp.trim().toLowerCase();
            const issMatch = String(l.personName || '').trim().toLowerCase().includes(target);
            const recMatch = String(l.receiverName || '').trim().toLowerCase().includes(target);
            return issMatch || recMatch;
          }
        });
        if (!matchesAnyPerson) return false;
      }

      // 4. Free text search
      if (historySearch) {
        const q = historySearch.toLowerCase();
        const matches = (
          String(l.id || '').toLowerCase().includes(q) ||
          String(l.lotId || '').toLowerCase().includes(q) ||
          String(l.brand || l.brandName || '').toLowerCase().includes(q) ||
          String(l.receiverName || '').toLowerCase().includes(q) ||
          String(l.receiverDept || '').toLowerCase().includes(q) ||
          String(l.personName || '').toLowerCase().includes(q) ||
          String(l.category || '').toLowerCase().includes(q) ||
          (l.materials || []).some(m => String(m.name || m.bomItemName || '').toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [rawWithoutBomLogs, historyDateFrom, historyDateTo, historyCategories, historyPersons, historySearch, materials]);

  // Total active filter criteria count
  const activeFiltersCount = (historyDateFrom ? 1 : 0) + 
    (historyDateTo ? 1 : 0) + 
    (historyCategories.length > 0 ? historyCategories.length : 0) + 
    (historyPersons.length > 0 ? historyPersons.length : 0) + 
    (historySearch ? 1 : 0);

  // Base default accessory component types
  const BASE_COMPONENT_TYPES = useMemo(() => ['DORI', 'ELASTIC', 'ZIP'], []);

  // Custom accessory component types persisted in localStorage
  const [customComponentTypes, setCustomComponentTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('without_bom_custom_component_types');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim().toUpperCase()).filter(Boolean);
      }
    } catch (e) {
      console.error('Failed to load custom component types', e);
    }
    return [];
  });

  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [newTypeNameInput, setNewTypeNameInput] = useState('');

  // Persist custom types whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('without_bom_custom_component_types', JSON.stringify(customComponentTypes));
    } catch (e) {}
  }, [customComponentTypes]);

  // Helper to add a custom component type into list
  const addCustomComponentType = (rawName) => {
    if (!rawName) return '';
    const clean = String(rawName).trim().toUpperCase();
    if (!clean || clean === '__CUSTOM__' || clean === '__MANAGE__') return '';

    const existsInBase = BASE_COMPONENT_TYPES.some(t => t.toUpperCase() === clean);
    const existsInCustom = customComponentTypes.some(t => t.toUpperCase() === clean);

    if (!existsInBase && !existsInCustom) {
      setCustomComponentTypes(prev => {
        const updated = [...prev, clean];
        try {
          localStorage.setItem('without_bom_custom_component_types', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }
    return clean;
  };

  // Helper to remove a custom component type from list
  const removeCustomComponentType = (typeToRemove) => {
    setCustomComponentTypes(prev => {
      const updated = prev.filter(t => t.toUpperCase() !== String(typeToRemove).toUpperCase());
      try {
        localStorage.setItem('without_bom_custom_component_types', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Unified list of all types: 1. DORI, 2. ELASTIC, 3. ZIP, 4. [CUSTOM 1], ...
  const allComponentTypes = useMemo(() => {
    const list = [...BASE_COMPONENT_TYPES];
    customComponentTypes.forEach(t => {
      const clean = String(t).trim().toUpperCase();
      if (clean && !list.includes(clean)) {
        list.push(clean);
      }
    });
    return list;
  }, [BASE_COMPONENT_TYPES, customComponentTypes]);

  // Dropdown options
  const componentTypeOptions = useMemo(() => {
    const opts = allComponentTypes.map((type, idx) => ({
      value: type,
      label: `${idx + 1}. ${type}`
    }));
    opts.push({ value: '__custom__', label: '✏️ + Add Manually (Custom Type)' });
    if (customComponentTypes.length > 0) {
      opts.push({ value: '__manage__', label: `⚙️ Manage Types (${customComponentTypes.length})...` });
    }
    return opts;
  }, [allComponentTypes, customComponentTypes]);

  // Commit custom type entered in a row input
  const commitCustomType = (rowId, rawVal) => {
    const clean = String(rawVal || '').trim().toUpperCase();
    if (!clean) {
      setItems(prev => prev.map(item => {
        if (item.id !== rowId) return item;
        return {
          ...item,
          isCustomType: false,
          customComponentType: '',
          componentType: item.componentType && item.componentType !== '__custom__' ? item.componentType : (allComponentTypes[0] || 'DORI')
        };
      }));
      return;
    }

    addCustomComponentType(clean);

    setItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return {
        ...item,
        isCustomType: false,
        customComponentType: clean,
        componentType: clean,
        unit: (clean === 'DORI' || clean === 'ELASTIC') ? (item.unit || 'Mtr') : (item.unit || 'Pcs')
      };
    }));
  };

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
        totalQty: mat ? ((Number(mat.stock) || 0) > 0 ? (defaultAutoIssueQty > 0 ? Math.min(defaultAutoIssueQty, Number(mat.stock)) : 1) : 0) : (defaultAutoIssueQty > 0 ? defaultAutoIssueQty : 1)
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
      const rackStock = Number(mat.stock) || 0;
      const safeInitialQty = (defaultAutoIssueQty > 0 && rackStock > 0)
        ? Math.min(defaultAutoIssueQty, rackStock)
        : (rackStock > 0 ? 1 : 0);

      return {
        ...item,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: getItemCodeDisplay(mat, materials),
        imageUrl: mat.imageUrl || mat.image || mat.photo || mat.imgUrl || '',
        color: mat.color || mat.shade || '',
        unit: mat.unit || 'Pcs',
        availableStock: rackStock,
        totalQty: safeInitialQty,
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
            totalQty: Number(matched.stock) > 0 ? (defaultAutoIssueQty > 0 ? Math.min(defaultAutoIssueQty, Number(matched.stock)) : 1) : 0
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
    doc.text('Lot / Brand:', im + 128, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    const lotBrandText = (issueData.brandName || issueData.brand)
      ? `LOT #${issueData.lotId} (${issueData.brandName || issueData.brand})`
      : `LOT #${issueData.lotId}`;
    doc.text(lotBrandText, im + 148, y + 8);
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
      const c = getItemCodeDisplay(item, materials) || (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '');
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
      brand: brandName.trim(),
      brandName: brandName.trim(),
      style: styleName || (issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Issue'),
      pieces: issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
      cuttingPieces: cuttingPieces || (parseInt(pieces, 10) > 1 ? parseInt(pieces, 10) : 0),
      onePercentAllowance: onePercentAllowance || 0,
      defaultAutoIssueQty: defaultAutoIssueQty || 0,
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

  // Helper to execute confirmed material issue and stock deduction
  const executeConfirmedIssue = async (isAdminOverride = false) => {
    const effectiveLot = lotNo.trim();
    const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);

    // Strict stock verification against store rack inventory - STRICT BLOCKING
    const shortageItems = validItems.filter(i => {
      if (!i.materialId || i.entryMode === 'manual') return false;
      const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
      const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(i.availableStock) || 0);
      return Number(i.totalQty) > rackStock;
    });

    if (shortageItems.length > 0) {
      const errorDetails = shortageItems.map(s => {
        const liveMat = (materials || []).find(m => String(m.id) === String(s.materialId));
        const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(s.availableStock) || 0);
        return `• "${s.materialName}" [${s.itemCode || 'ST'}] (Rack: ${s.location || 'Store'}): Available in Rack = ${rackStock} ${s.unit}, Attempted Issue = ${s.totalQty} ${s.unit}`;
      }).join('\n');

      const msg = `⛔ CANNOT ISSUE — INSUFFICIENT STORE RACK STOCK!\n\nStore rack me utna stock available nahi hai:\n${errorDetails}\n\nNegative stock issue karna strictly blocked hai. Please issue quantity ko rack stock ke barabar ya kam karein.`;
      setFormError(msg);
      playFeedbackSound('error');
      alert(msg);
      return;
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
          itemCode: getItemCodeDisplay(i, materials) || (i.itemCode && !i.itemCode.toUpperCase().startsWith('ITM-') ? i.itemCode : '') || (i.entryMode === 'manual' ? 'MANUAL' : ''),
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
        brand: brandName.trim(),
        brandName: brandName.trim(),
        style: styleName || (issueMode === 'item_only' ? 'Direct Item Requisition' : 'Floor Issue'),
        pieces: issueMode === 'item_only' ? 1 : (parseInt(pieces, 10) || 1),
        cuttingPieces: cuttingPieces || (parseInt(pieces, 10) > 1 ? parseInt(pieces, 10) : 0),
        onePercentAllowance: onePercentAllowance || 0,
        defaultAutoIssueQty: defaultAutoIssueQty || 0,
        personName: personName.trim(),
        receiverName: receiverName.trim(),
        receiverDept: receiverDept.trim(),
        remarks: remarks.trim() + (isAdminOverride ? ' [Admin Approved Excess Over 1%]' : ''),
        items: validItems.map(i => {
          const rawType = i.isCustomType ? (i.customComponentType?.trim() || 'Custom Accessory') : (i.componentType || 'DORI');
          if (rawType && rawType !== 'Custom Accessory') {
            addCustomComponentType(rawType);
          }
          const effectiveType = rawType;
          const effectiveName = i.entryMode === 'manual' ? (i.materialName?.trim() || `${effectiveType} Item`) : i.materialName;
          return {
            ...i,
            componentType: effectiveType,
            materialName: effectiveName,
            itemCode: getItemCodeDisplay(i, materials) || (i.itemCode && !i.itemCode.toUpperCase().startsWith('ITM-') ? i.itemCode : '') || (i.entryMode === 'manual' ? 'MANUAL' : '')
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
      setFormSuccess(`✓ Bill #${voucherId} (Lot #${effectiveLot}${brandName ? ` • ${brandName}` : ''}) confirmed & stock deducted. Printing window opened. Form is reset & ready for next bill.`);

      // Automatically launch the printing window directly
      setTimeout(() => {
        handleDirectPrintWindow(issueData, voucherId);
      }, 100);

      // Process complete: refill and reset all columns/inputs back to clean state for next bill
      handleResetForm();

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

  // Submit Issue with 1% Cutting Allowance Verification
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

    // ── STRICT STORE RACK INVENTORY VERIFICATION ──
    // If the rack does not have enough bundles, rolls, or pieces, strictly block the issue!
    const stockShortageItems = validItems.filter(i => {
      if (!i.materialId || i.entryMode === 'manual') return false;
      const liveMat = (materials || []).find(m => String(m.id) === String(i.materialId));
      const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(i.availableStock) || 0);
      return Number(i.totalQty) > rackStock;
    });

    if (stockShortageItems.length > 0) {
      const errorList = stockShortageItems.map(s => {
        const liveMat = (materials || []).find(m => String(m.id) === String(s.materialId));
        const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(s.availableStock) || 0);
        return `• "${s.materialName}" [${s.itemCode || 'ST'}]: Store rack (${s.location || 'Rack'}) only has ${rackStock} ${s.unit}, but tried to issue ${s.totalQty} ${s.unit}`;
      }).join('\n');

      const msg = `⛔ CANNOT ISSUE — INSUFFICIENT STORE RACK STOCK!\n\nStore rack me utna stock available nahi hai:\n${errorList}\n\nPlease issue quantity ko rack stock (${stockShortageItems[0].availableStock || 0}) ke barabar ya kam karein.`;
      setFormError(msg);
      playFeedbackSound('error');
      alert(msg);
      return;
    }

    // ── 1% CUTTING THRESHOLD VERIFICATION ──
    // e.g. Cutting = 1,000 Pcs -> 1% = 10 Pcs -> Max = 1,010 Pcs.
    // If quantity is <= 1,010 Pcs, it is OK and issues normally.
    // If quantity > 1,010 Pcs, it requires Supervisor / Admin Approval!
    if (cuttingPieces > 0) {
      const exceeded = validItems.filter(i => Number(i.totalQty) > defaultAutoIssueQty);
      if (exceeded.length > 0) {
        setApprovalModalData({
          lotNo: effectiveLot,
          cuttingPieces,
          onePercentAllowance,
          defaultAutoIssueQty,
          exceededItems: exceeded.map(i => {
            const qty = Number(i.totalQty);
            const excess = qty - defaultAutoIssueQty;
            const excessPct = ((excess / cuttingPieces) * 100).toFixed(1);
            return {
              ...i,
              qty,
              excess,
              excessPct
            };
          }),
          allItems: validItems
        });
        return;
      }
    }

    await executeConfirmedIssue();
  };

  // Handle Submit Approval for >1% Requisition
  const handleConfirmSubmitApproval = async () => {
    if (!approvalModalData) return;
    setApprovalSubmitting(true);
    const { lotNo: reqLot, cuttingPieces: pcs, defaultAutoIssueQty: maxAllowed, exceededItems } = approvalModalData;

    const payloadItems = exceededItems.map(it => ({
      materialId: it.materialId || '',
      materialName: it.materialName || `${it.componentType} Item`,
      bomItemName: it.componentType || 'Accessory',
      totalRequired: it.qty,
      unit: it.unit || 'Pcs',
      itemCode: it.itemCode || '',
      color: it.color || '',
      availableStock: it.availableStock || 0,
      location: it.location || '',
      excessQty: it.excess,
      excessPct: it.excessPct
    }));

    const maxExcess = Math.max(...exceededItems.map(i => i.excess));
    const exceededSummary = exceededItems.map(i => `${i.materialName || i.componentType}: ${i.qty} ${i.unit} (1% max: ${maxAllowed}, +${i.excess} excess)`).join(', ');

    const approvalRequestData = {
      id: `AR${Date.now()}`,
      type: 'material_issue',
      subType: 'without_bom_excess_1pct',
      lotId: reqLot,
      category: styleName || 'Without-BOM Issue',
      brand: brandName || 'Mohit Hosiery',
      pieces: pcs,
      cuttingPieces: pcs,
      onePercentLimit: maxAllowed,
      items: payloadItems,
      isReissue: false,
      isWithoutBom: true,
      personName: personName.trim() || 'Store Staff',
      receiverName: receiverName.trim() || 'Cutting Master',
      receiverDept: receiverDept.trim() || 'Cutting',
      exceedsLimit: true,
      extraPercentage: ((maxExcess / pcs) * 100).toFixed(1),
      reason: approvalReason || `Without-BOM Issue Exceeds 1% Limit: ${exceededSummary}`,
      requesterName: currentUser?.name || personName || 'Store Staff',
      requesterRole: currentUser?.role || 'Store',
      status: 'pending',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };

    try {
      if (typeof onSubmitApproval === 'function') {
        onSubmitApproval('material_issue', approvalRequestData, currentUser);
      } else {
        await fetch(`${getBackendUrl()}/api/approval-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approvalRequestData)
        });
      }

      setFormSuccess(`✓ Approval Request submitted to Admin! Lot #${reqLot} issue (${exceededSummary}) is now pending Admin approval. Material can be issued after approval.`);
      setApprovalModalData(null);
      handleResetForm();
      setTimeout(() => setFormSuccess(''), 8000);
    } catch (err) {
      console.error('Failed to submit approval request:', err);
      setFormError('Failed to submit approval request: ' + err.message);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  // Adjust all items back to 1% limit
  const handleAdjustAllTo1Percent = () => {
    if (!approvalModalData) return;
    const maxAllowed = approvalModalData.defaultAutoIssueQty;
    setItems(prev => prev.map(item => {
      if (Number(item.totalQty) > maxAllowed) {
        return { ...item, totalQty: maxAllowed };
      }
      return item;
    }));
    setApprovalModalData(null);
    setFormSuccess(`✓ Quantities adjusted to 1% limit (${maxAllowed.toLocaleString()} Pcs). You can now issue directly.`);
    setTimeout(() => setFormSuccess(''), 4000);
  };

  // Admin Override
  const handleAdminOverrideIssue = async () => {
    setApprovalModalData(null);
    await executeConfirmedIssue(true);
  };

  // Clear and refill all form columns/inputs for a fresh issue
  const handleResetForm = () => {
    setLotNo('');
    setBrandName('');
    setReceiverName('');
    setReceiverDept('Cutting');
    setStyleName('Direct Item Requisition');
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
    const cleanLot = String(log.lotId || '').replace(/^LOT\s*#?/i, '').trim().toLowerCase();
    const resolvedCutting = (effectiveCuttingMap && effectiveCuttingMap[cleanLot] ? Number(effectiveCuttingMap[cleanLot]) : 0) || 
      (log.volume > 1 ? Number(log.volume) : 0);
    const onePct = resolvedCutting > 0 ? Math.round(resolvedCutting * 0.01) : 0;
    const defaultQty = resolvedCutting + onePct;

    return {
      voucherId: log.id,
      date: log.date || new Date().toLocaleDateString('en-GB'),
      issueMode: String(log.lotId || '').toLowerCase().includes('direct') ? 'item_only' : 'floor_lot',
      lotId: log.lotId || 'DIRECT-ITEM',
      brand: log.brand || log.brandName || '',
      brandName: log.brandName || log.brand || '',
      style: log.style || log.category || 'Store Issue',
      pieces: log.volume || 1,
      cuttingPieces: resolvedCutting,
      onePercentAllowance: onePct,
      defaultAutoIssueQty: defaultQty,
      personName: log.personName || 'Store In-charge',
      receiverName: log.receiverName || 'Cutting Master',
      receiverDept: log.receiverDept || 'Cutting',
      remarks: log.remarks || '',
      items: (log.materials || []).map((m, idx) => {
        const itemCodeResolved = getItemCodeDisplay(m, materials) ||
          (m.itemCode && !m.itemCode.toUpperCase().startsWith('ITM-') ? m.itemCode : '') ||
          (m.materialId && String(m.materialId).toUpperCase().startsWith('ST') ? String(m.materialId) : '') ||
          (m.materialId && /^\d+$/.test(String(m.materialId)) ? `ST${String(m.materialId).padStart(5, '0')}` : '-');
        return {
          componentType: m.bomItemName || 'Accessory',
          materialName: m.name || 'Material Item',
          itemCode: itemCodeResolved,
          color: m.color || 'Standard',
          location: getMaterialLocation(m) || m.location || 'Main Store',
          availableStock: m.qty || 0,
          totalQty: m.qty || 1,
          unit: m.unit || 'Pcs'
        };
      })
    };
  };

  // Generate complete, robust HTML for printable challan sheet (Dual Copy - Pure Black & White)
  const generatePrintHtml = (issueData) => {
    const lotText = issueData.lotId ? `LOT #${issueData.lotId}` : 'LOT REQUIRED';
    const voucherId = issueData.voucherId || nextVoucherId || 'CHALLAN';
    const dateStr = issueData.date || new Date().toLocaleDateString('en-GB');
    const items = issueData.items || [];
    const remarksHtml = issueData.remarks ? `<div class="remarks"><strong>Remarks / Allocation Notes:</strong> ${issueData.remarks}</div>` : '';

    const cleanLot = String(issueData.lotId || '').replace(/^LOT\s*#?/i, '').trim().toLowerCase();
    const resolvedCutting = Number(issueData.cuttingPieces) || 
      (effectiveCuttingMap && effectiveCuttingMap[cleanLot] ? Number(effectiveCuttingMap[cleanLot]) : 0) || 
      (activeLotCutting && String(activeLotCutting.lotNumber).trim().toLowerCase() === cleanLot ? Number(activeLotCutting.totalPieces) : 0) ||
      (Number(issueData.pieces) > 1 ? Number(issueData.pieces) : 0);

    const onePct = resolvedCutting > 0 ? Math.round(resolvedCutting * 0.01) : 0;
    const totalAllowedWith1Pct = resolvedCutting + onePct;

    // Check if any issued item includes 1% extra
    const isOnePercentExtraIssued = items.some(it => {
      const q = Number(it.totalQty);
      return (resolvedCutting > 0 && q >= totalAllowedWith1Pct) || (resolvedCutting > 0 && q > resolvedCutting);
    });

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
          <div class="field">
            <span class="lbl">CUTTING PIECES / VOLUME:</span>
            ${resolvedCutting > 0 ? `
              <strong class="volume-val">${resolvedCutting.toLocaleString()} Pcs</strong>
              ${isOnePercentExtraIssued ? `
                <div class="extra-badge">✓ +1% EXTRA MATERIAL ISSUED: ${totalAllowedWith1Pct.toLocaleString()} PCS</div>
              ` : (onePct > 0 ? `
                <div class="extra-badge-subtle">(1% Max Allowed: ${totalAllowedWith1Pct.toLocaleString()} Pcs)</div>
              ` : '')}
            ` : `
              <strong class="volume-val">${issueData.pieces > 1 ? `${issueData.pieces} Pcs` : 'Ad-Hoc Issue'}</strong>
            `}
          </div>
          <div class="field"><span class="lbl">TOTAL LINE ITEMS:</span> <span>${items.length} Material Item(s)</span></div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th style="width: 110px;">Component</th>
              <th>Store Material Description</th>
              <th style="width: 90px;">Item Code</th>
              <th style="width: 90px;">Rack Loc</th>
              <th style="width: 120px; text-align: right;">Issued Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
              const code = getItemCodeDisplay(item, materials) ||
                (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '') ||
                '-';
              const qty = Number(item.totalQty);
              const isItemExtra = resolvedCutting > 0 && (qty >= totalAllowedWith1Pct || qty > resolvedCutting);
              return `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td><strong>${item.componentType || 'Accessory'}</strong></td>
                  <td>${item.materialName || 'Material'}</td>
                  <td style="font-family: monospace; font-weight: bold;">${code}</td>
                  <td>${item.location || 'Store'}</td>
                  <td style="text-align: right;">
                    <span style="font-weight: 900; font-size: 11px;">${item.totalQty} ${item.unit || 'Pcs'}</span>
                    ${isItemExtra ? `<div style="font-size: 8.5px; font-weight: 900; color: #000000; text-transform: uppercase;">[ +1% Extra Added ]</div>` : ''}
                  </td>
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 12px;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4 portrait;
            margin: 7mm 7mm;
          }
          .challan-card {
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 12px;
            page-break-inside: avoid;
            background: #ffffff;
          }
          .cut-divider {
            border-top: 1.5px dashed #000000;
            text-align: center;
            margin: 12px 0;
            position: relative;
          }
          .cut-divider span {
            background: #ffffff;
            padding: 2px 10px;
            font-size: 9px;
            font-weight: 900;
            color: #000000;
            position: relative;
            top: -9px;
            letter-spacing: 0.8px;
            border: 1px solid #000000;
            border-radius: 3px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .brand h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #000000;
          }
          .brand .dept {
            font-size: 9.5px;
            font-weight: 700;
            color: #000000;
            margin-top: 1px;
          }
          .brand .main-heading {
            display: inline-block;
            background: #000000;
            color: #ffffff;
            font-weight: 900;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 3px;
            margin-top: 4px;
            letter-spacing: 0.5px;
            border: 1px solid #000000;
          }
          .brand .sub-heading {
            font-size: 9.5px;
            font-weight: 700;
            color: #000000;
            margin-top: 2px;
          }
          .meta {
            text-align: right;
          }
          .meta .challan-no {
            font-family: monospace;
            font-size: 14px;
            font-weight: 900;
            color: #000000;
          }
          .meta .date {
            font-size: 10px;
            color: #000000;
            font-weight: 600;
            margin-top: 2px;
          }
          .copy-badge {
            display: inline-block;
            margin-top: 4px;
            padding: 2px 7px;
            background: #000000;
            color: #ffffff;
            font-size: 9px;
            font-weight: 900;
            border-radius: 3px;
            border: 1px solid #000000;
          }
          .status-badge {
            font-size: 9px;
            font-weight: 900;
            color: #000000;
            margin-top: 2px;
          }
          .particulars-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            background: #ffffff;
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 10px;
            font-size: 11px;
          }
          .particulars-grid .field {
            line-height: 1.35;
          }
          .particulars-grid .lbl {
            font-size: 9px;
            color: #000000;
            font-weight: 900;
            display: block;
            text-transform: uppercase;
          }
          .lot-val {
            color: #000000;
            font-size: 12px;
            font-weight: 900;
          }
          .volume-val {
            color: #000000;
            font-size: 12px;
            font-weight: 900;
          }
          .extra-badge {
            display: inline-block;
            margin-top: 2px;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 900;
            color: #000000;
            border: 1px solid #000000;
            background: #f0f0f0;
            border-radius: 2px;
          }
          .extra-badge-subtle {
            font-size: 9px;
            color: #000000;
            font-weight: 700;
            margin-top: 2px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            margin-bottom: 8px;
            border: 1.5px solid #000000;
          }
          .items-table th {
            background: #f0f0f0;
            border: 1px solid #000000;
            padding: 5px 6px;
            text-align: left;
            font-size: 9.5px;
            text-transform: uppercase;
            color: #000000;
            font-weight: 900;
          }
          .items-table td {
            border: 1px solid #000000;
            padding: 5px 6px;
            vertical-align: middle;
            color: #000000;
          }
          .items-table tbody tr {
            background: #ffffff !important;
          }
          .remarks {
            background: #ffffff;
            border: 1px solid #000000;
            border-left: 4px solid #000000;
            padding: 4px 8px;
            font-size: 10px;
            margin-bottom: 8px;
            color: #000000;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1.5px solid #000000;
            text-align: center;
            font-size: 9.5px;
            color: #000000;
          }
          .sig-box .sig-line {
            height: 22px;
            border-bottom: 1.5px solid #000000;
            width: 75%;
            margin: 0 auto 4px auto;
          }
          .footer-note {
            text-align: center;
            font-size: 8.5px;
            color: #000000;
            margin-top: 8px;
            font-weight: 600;
          }
          .print-btn-bar {
            text-align: center;
            padding: 10px;
            background: #f0f0f0;
            margin-bottom: 12px;
            border-radius: 6px;
            border: 1px solid #000000;
          }
          .btn-print {
            background: #000000;
            color: #ffffff;
            border: 1px solid #000000;
            padding: 8px 24px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .print-btn-bar, .cut-divider { page-break-after: avoid; }
            .print-btn-bar { display: none !important; }
            body { padding: 0; }
            * { color: #000000 !important; }
            .brand .main-heading, .copy-badge {
              background: #000000 !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .items-table th {
              background: #f0f0f0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
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
    if (cuttingPieces > 0) {
      const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
      const exceeded = validItems.filter(i => Number(i.totalQty) > defaultAutoIssueQty);
      if (exceeded.length > 0) {
        setApprovalModalData({
          lotNo: lotNo.trim(),
          cuttingPieces,
          onePercentAllowance,
          defaultAutoIssueQty,
          exceededItems: exceeded.map(i => {
            const qty = Number(i.totalQty);
            const excess = qty - defaultAutoIssueQty;
            const excessPct = ((excess / cuttingPieces) * 100).toFixed(1);
            return { ...i, qty, excess, excessPct };
          }),
          allItems: validItems
        });
        return;
      }
    }
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

  // Direct 1-Click Export of Individual Challan / Bill as PDF File
  const handleDownloadChallanPdf = (log) => {
    try {
      const issueData = buildIssueDataFromLog(log);
      const doc = generatePDFVoucher(issueData);
      doc.save(`${log.id || 'Challan'}_Material_Issue_Slip.pdf`);
    } catch (err) {
      alert('Failed to export Challan PDF: ' + err.message);
    }
  };

  // Direct 1-Click Export of Current Form Challan as PDF File
  const handleSavePdfFromForm = () => {
    setFormError('');
    if (cuttingPieces > 0) {
      const validItems = items.filter(i => (i.materialId || i.materialName.trim()) && Number(i.totalQty) > 0);
      const exceeded = validItems.filter(i => Number(i.totalQty) > defaultAutoIssueQty);
      if (exceeded.length > 0) {
        setApprovalModalData({
          lotNo: lotNo.trim(),
          cuttingPieces,
          onePercentAllowance,
          defaultAutoIssueQty,
          exceededItems: exceeded.map(i => {
            const qty = Number(i.totalQty);
            const excess = qty - defaultAutoIssueQty;
            const excessPct = ((excess / cuttingPieces) * 100).toFixed(1);
            return { ...i, qty, excess, excessPct };
          }),
          allItems: validItems
        });
        return;
      }
    }
    const issueData = buildIssueDataFromForm();
    if (!issueData) return;
    try {
      const doc = generatePDFVoucher(issueData);
      doc.save(`${issueData.voucherId || 'Challan'}_Material_Issue_Slip.pdf`);
    } catch (err) {
      setFormError('Failed to export Challan PDF: ' + err.message);
    }
  };

  // Export Full History Audit Register as a Beautiful Multi-Page PDF Document
  const handleExportFullReportPdf = () => {
    if (!withoutBomLogs || withoutBomLogs.length === 0) {
      alert('No Without-BOM challan records found to export.');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, margin, pw - (margin * 2), 22, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('MOHIT HOSIERY — CENTRAL STORE & PRODUCTION ACCESSORIES', margin + 6, margin + 8);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(249, 115, 22); // orange-500
      doc.text('WITHOUT-BOM & ITEM ISSUE AUDIT REGISTER', margin + 6, margin + 15);

      const nowStr = new Date().toLocaleString('en-GB');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Generated: ${nowStr} | Total Records: ${withoutBomLogs.length}`, pw - margin - 6, margin + 15, { align: 'right' });

      // Active Filter Summary
      const filterParts = [];
      if (historyDateFrom || historyDateTo) {
        filterParts.push(`Dates: ${historyDateFrom || 'Start'} to ${historyDateTo || 'Today'}`);
      }
      if (historyCategories.length > 0) {
        filterParts.push(`Categories: ${historyCategories.join(', ')}`);
      }
      if (historyPersons.length > 0) {
        filterParts.push(`Persons: ${historyPersons.map(p => formatPersonKey(p)).join(', ')}`);
      }
      if (historySearch) {
        filterParts.push(`Search: "${historySearch}"`);
      }

      let startTableY = margin + 26;
      if (filterParts.length > 0) {
        doc.setFillColor(255, 247, 237);
        doc.setDrawColor(254, 215, 170);
        doc.roundedRect(margin, startTableY, pw - (margin * 2), 7, 1.5, 1.5, 'FD');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(194, 65, 12);
        doc.text(`Active Filters: ${filterParts.join('  |  ')}`, margin + 4, startTableY + 4.8);
        startTableY += 10;
      }

      // Prepare Table Data
      let grandTotalPieces = 0;
      let grandIssuePcs = 0;

      const tableRows = withoutBomLogs.map((log, idx) => {
        const dateStr = log.date || '—';
        const rawLot = String(log.lotId || '').trim();
        const isDirect = !rawLot || rawLot === 'DIRECT-ITEM' || rawLot.toLowerCase().includes('direct');
        const lotDisplay = isDirect ? 'DIRECT REQUISITION' : `LOT #${rawLot}`;
        const brandDisplay = log.brand || log.brandName || (isDirect ? 'Direct Material' : '—');

        const mats = log.materials || [];
        const matLines = mats.map(m => {
          const c = getItemCodeDisplay(m);
          const name = m.name || m.bomItemName || 'Material';
          const qty = `${m.qty || 0} ${m.unit || 'Pcs'}`;
          const loc = getMaterialLocation(m) || m.location;
          return `${c ? `[${c}] ` : ''}${name}: ${qty}${loc ? ` (${loc})` : ''}`;
        }).join('\n');

        const { totalPieces, issuePcs, variance } = getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs);
        grandTotalPieces += totalPieces;
        grandIssuePcs += issuePcs;
        const varStr = variance > 0 ? `+${variance}` : `${variance}`;

        const issuer = log.personName || 'Store Incharge';
        const receiver = log.receiverName ? `${log.receiverName}${log.receiverDept ? `\n(${log.receiverDept})` : ''}` : 'Floor Master';
        const remarks = log.remarks || '—';

        const cuttingDetailStr = totalPieces > 0
          ? `${totalPieces.toLocaleString()} Pcs\n(Cutting Qty)`
          : '—';

        return [
          idx + 1,
          log.id || `BILL-${idx + 1}`,
          dateStr,
          lotDisplay,
          brandDisplay,
          matLines || '—',
          cuttingDetailStr,
          `${issuePcs.toLocaleString()} Pcs`,
          totalPieces > 0 ? `${varStr} Pcs` : '—',
          issuer,
          receiver,
          remarks
        ];
      });

      const grandVariance = grandTotalPieces - grandIssuePcs;
      const grandVarStr = grandVariance > 0 ? `+${grandVariance.toLocaleString()}` : `${grandVariance.toLocaleString()}`;

      autoTable(doc, {
        startY: startTableY,
        head: [['#', 'Challan No', 'Date', 'Lot Reference', 'Brand', 'Issued Materials', 'Total Pieces\n(Cutting)', 'Issue Pcs', 'Variance\n(Cutting - Issue)', 'Issued By', 'Received By', 'Remarks']],
        body: tableRows,
        foot: [['', 'TOTALS', '', '', '', `${withoutBomLogs.length} Challan(s)`, `${grandTotalPieces.toLocaleString()} Pcs Cutting`, `${grandIssuePcs.toLocaleString()} Pcs`, `${grandVarStr} Pcs Balance`, '', '', '']],
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'top',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' },
          1: { cellWidth: 22, fontStyle: 'bold', textColor: [194, 65, 12] },
          2: { cellWidth: 20 },
          3: { cellWidth: 24, fontStyle: 'bold' },
          4: { cellWidth: 20 },
          5: { cellWidth: 58 },
          6: { cellWidth: 19, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 19, halign: 'right', fontStyle: 'bold', textColor: [234, 88, 12] },
          8: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
          9: { cellWidth: 20 },
          10: { cellWidth: 22 },
          11: { cellWidth: 22 }
        }
      });

      // Add page numbers on all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${totalPages}`, pw - margin, ph - 4, { align: 'right' });
        doc.text('Mohit Hosiery Central Store • Material Issue Without BOM Official Audit Register', margin, ph - 4);
      }

      const fileName = `Without_BOM_Challan_Register_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF Export failed:', err);
      alert('Failed to export PDF: ' + err.message);
    }
  };

  // Handler to print full page report with detailed table, brand-wise, lot-wise summaries and photos
  const handlePrintFullHistoryReport = () => {
    if (!withoutBomLogs || withoutBomLogs.length === 0) {
      alert('No Without-BOM challan records found to print.');
      return;
    }

    // Filter summary text for printed report
    const filterParts = [];
    if (historyDateFrom || historyDateTo) {
      filterParts.push(`Dates: ${historyDateFrom || 'Start'} to ${historyDateTo || 'Today'}`);
    }
    if (historyCategories.length > 0) {
      filterParts.push(`Categories: ${historyCategories.join(', ')}`);
    }
    if (historyPersons.length > 0) {
      filterParts.push(`Persons: ${historyPersons.map(p => formatPersonKey(p)).join(', ')}`);
    }
    if (historySearch) {
      filterParts.push(`Search: "${historySearch}"`);
    }
    const filterBannerHtml = filterParts.length > 0
      ? `<div style="margin-top: 4px; font-size: 10px; font-weight: 700; color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; padding: 2px 7px; border-radius: 4px;">🔍 Filtered By: ${filterParts.join(' &nbsp;|&nbsp; ')}</div>`
      : '';

    const printWin = window.open('', '_blank', 'width=1200,height=850');
    if (!printWin) {
      alert('Popup was blocked by your browser. Please allow popups to open the print report.');
      return;
    }

    const totalChallans = withoutBomLogs.length;
    let totalLineItems = 0;
    let totalQtyIssued = 0;
    let grandTotalPieces = 0;
    const uniqueLots = new Set();
    const uniqueBrands = new Set();

    // Data structures for summaries
    const brandSummaryMap = {};
    const lotSummaryMap = {};
    const materialSummaryMap = {};

    withoutBomLogs.forEach((log) => {
      const rawBrand = (log.brand || log.brandName || '').trim();
      const rawLot = String(log.lotId || '').trim();
      const isDirect = !rawLot || rawLot === 'DIRECT-ITEM' || rawLot.toLowerCase().includes('direct');
      
      const effectiveLot = isDirect ? 'DIRECT REQUISITION' : `LOT #${rawLot}`;
      const { totalPieces: logVol } = getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs);
      grandTotalPieces += logVol;

      if (rawBrand) {
        uniqueBrands.add(rawBrand);
        if (!brandSummaryMap[rawBrand]) {
          brandSummaryMap[rawBrand] = {
            brand: rawBrand,
            lots: new Set(),
            materials: {}
          };
        }
        if (!isDirect) brandSummaryMap[rawBrand].lots.add(rawLot);
      }

      if (!isDirect) uniqueLots.add(rawLot);

      if (!lotSummaryMap[effectiveLot]) {
        lotSummaryMap[effectiveLot] = {
          lot: effectiveLot,
          rawLot: rawLot,
          isDirect: isDirect,
          brand: rawBrand || '',
          challans: new Set(),
          materials: {},
          totalPieces: logVol
        };
      } else {
        if (logVol > lotSummaryMap[effectiveLot].totalPieces) {
          lotSummaryMap[effectiveLot].totalPieces = logVol;
        }
      }
      if (rawBrand && !lotSummaryMap[effectiveLot].brand) {
        lotSummaryMap[effectiveLot].brand = rawBrand;
      }
      if (log.id) lotSummaryMap[effectiveLot].challans.add(log.id);

      (log.materials || []).forEach(m => {
        totalLineItems += 1;
        const q = Number(m.qty) || 0;
        totalQtyIssued += q;
        const matName = m.name || m.bomItemName || 'Material';
        const unit = m.unit || 'Pcs';
        const matKey = `${matName.toLowerCase()}__${unit.toLowerCase()}`;
        const photo = getMaterialPhoto(m);
        const code = getItemCodeDisplay(m) || m.itemCode || '';
        const cat = getMaterialCategory(m);

        // Brand map (only when genuine brand exists)
        if (rawBrand) {
          if (!brandSummaryMap[rawBrand].materials[matKey]) {
            brandSummaryMap[rawBrand].materials[matKey] = {
              name: matName,
              componentType: cat || m.bomItemName || 'Accessory',
              itemCode: code,
              unit,
              photo,
              totalQty: 0
            };
          }
          brandSummaryMap[rawBrand].materials[matKey].totalQty += q;
        }

        const loc = getMaterialLocation(m);

        // Lot map
        if (!lotSummaryMap[effectiveLot].materials[matKey]) {
          lotSummaryMap[effectiveLot].materials[matKey] = {
            name: matName,
            componentType: cat || m.bomItemName || 'Accessory',
            itemCode: code,
            location: loc,
            unit,
            photo,
            totalQty: 0
          };
        }
        lotSummaryMap[effectiveLot].materials[matKey].totalQty += q;

        // Overall material map
        if (!materialSummaryMap[matKey]) {
          materialSummaryMap[matKey] = {
            name: matName,
            componentType: cat || m.bomItemName || 'Accessory',
            itemCode: code,
            location: loc,
            unit,
            photo,
            totalQty: 0,
            challanCount: 0
          };
        }
        materialSummaryMap[matKey].totalQty += q;
        materialSummaryMap[matKey].challanCount += 1;
      });
    });

    const grandVariance = grandTotalPieces - totalQtyIssued;

    // Build Rows for Main Log Table
    const tableRowsHtml = withoutBomLogs.map((log, idx) => {
      const isDirect = !log.lotId || log.lotId === 'DIRECT-ITEM' || String(log.lotId).toLowerCase().includes('direct');
      const lotDisplay = isDirect ? 'DIRECT REQUISITION' : `LOT #${log.lotId}`;
      const brandDisplay = (log.brand || log.brandName) ? ` (${log.brand || log.brandName})` : '';
      const { totalPieces, issuePcs, variance } = getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs);

      const materialsHtml = (log.materials || []).map(m => {
        const photo = getMaterialPhoto(m);
        const code = getItemCodeDisplay(m) || m.itemCode || '';
        const cat = getMaterialCategory(m);
        const loc = getMaterialLocation(m);
        return `
          <div class="mat-item-row">
            ${photo ? `<img src="${photo}" alt="${m.name}" class="mat-thumb" onerror="this.style.display='none'" />` : `<span class="no-photo">📦</span>`}
            <div class="mat-info">
              ${cat ? `<span class="cat-badge">${cat.toUpperCase()}</span>` : ''}
              <span class="mat-name"><strong>${m.name || m.bomItemName}</strong>${code ? ` <span class="mat-code">[${code}]</span>` : ''}</span>
              <span class="mat-qty-badge">${m.qty} ${m.unit || 'Pcs'}</span>
              ${loc ? `<span class="rack-badge">📍 ${loc}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <tr>
          <td style="text-align: center; font-weight: 800; font-family: monospace;">#${idx + 1}</td>
          <td style="font-weight: 800; font-family: monospace; white-space: nowrap;">
            <span class="challan-badge">${log.id}</span>
          </td>
          <td style="white-space: nowrap; font-size: 10px;">${log.date || '—'}</td>
          <td style="font-weight: 700;">
            <div style="font-size: 11px; font-weight: 900; color: #000000;">${lotDisplay}${brandDisplay}</div>
            <div style="font-size: 9px; color: #555555; font-weight: 600;">W/O BOM CHALLAN</div>
          </td>
          <td>
            <div class="mat-list-container">
              ${materialsHtml}
            </div>
          </td>
          <td style="text-align: right; vertical-align: top; white-space: nowrap;">
            <div style="font-weight: 900; font-size: 11.5px; color: #000000;">
              ${totalPieces > 0 ? `${totalPieces.toLocaleString('en-IN')} Pcs` : '—'}
            </div>
            ${totalPieces > 0 ? `
              <div style="font-size: 8.5px; font-weight: 800; color: #1d4ed8; margin-top: 1px;">
                ✂️ CUTTING PCS
              </div>
            ` : ''}
          </td>
          <td style="text-align: right; font-weight: 900; font-size: 11.5px; color: #ea580c; white-space: nowrap; vertical-align: top;">
            ${issuePcs.toLocaleString('en-IN')} Pcs
          </td>
          <td style="text-align: right; font-weight: 900; font-size: 11.5px; white-space: nowrap; vertical-align: top;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; border: 1px solid ${variance === 0 ? '#bbf7d0' : variance > 0 ? '#bfdbfe' : '#fecaca'}; background: ${variance === 0 ? '#f0fdf4' : variance > 0 ? '#eff6ff' : '#fef2f2'}; color: ${variance === 0 ? '#15803d' : variance > 0 ? '#1d4ed8' : '#b91c1c'};">
              ${variance > 0 ? `+${variance.toLocaleString('en-IN')}` : variance.toLocaleString('en-IN')} Pcs
            </span>
          </td>
          <td style="font-size: 10px;">${log.personName || 'Store In-charge'}</td>
          <td style="font-size: 10px; font-weight: 700;">
            ${log.receiverName || 'Cutting Master'}
            ${log.receiverDept ? `<br/><small style="font-weight: normal; color: #555;">(${log.receiverDept})</small>` : ''}
          </td>
          <td style="font-size: 9.5px; max-width: 130px; word-break: break-word;">
            ${log.remarks || log.style || 'Standard Floor Issue'}
          </td>
        </tr>
      `;
    }).join('');

    // Check if there are real brands
    const hasRealBrands = Object.keys(brandSummaryMap).length > 0;

    // Build Brand-Wise Summary Section (Only when actual brands exist)
    const brandSectionsHtml = hasRealBrands ? Object.values(brandSummaryMap).map(bData => {
      const lotsArr = Array.from(bData.lots);
      const matItems = Object.values(bData.materials);
      const brandTotalQty = matItems.reduce((acc, m) => acc + m.totalQty, 0);

      return `
        <div class="summary-group-box">
          <div class="group-header">
            <div>
              <span class="group-title">🏷️ BRAND: ${bData.brand.toUpperCase()}</span>
              ${lotsArr.length > 0 ? `<span class="group-sub">• Lots: ${lotsArr.map(l => `LOT #${l}`).join(', ')}</span>` : ''}
            </div>
            <div class="group-badge">
              Total Materials: <strong>${brandTotalQty.toLocaleString('en-IN')} Units / Pcs</strong>
            </div>
          </div>
          <table class="sub-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">PHOTO</th>
                <th>MATERIAL / ACCESSORY NAME</th>
                <th style="width: 100px;">CATEGORY</th>
                <th style="width: 90px;">ITEM CODE</th>
                <th style="width: 120px; text-align: right;">TOTAL ISSUE QTY</th>
              </tr>
            </thead>
            <tbody>
              ${matItems.map(m => `
                <tr>
                  <td style="text-align: center;">
                    ${m.photo ? `<img src="${m.photo}" alt="${m.name}" class="mat-thumb" onerror="this.style.display='none'" />` : `<span class="no-photo">📦</span>`}
                  </td>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.componentType}</td>
                  <td style="font-family: monospace; font-weight: 700;">${m.itemCode || '—'}</td>
                  <td style="text-align: right; font-weight: 900; font-size: 12px; color: #000000;">
                    ${m.totalQty.toLocaleString('en-IN')} ${m.unit}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('') : '';



    // Build Consolidated Material Summary (With Location / Rack No column)
    const materialListHtml = Object.values(materialSummaryMap).map(m => `
      <tr>
        <td style="text-align: center;">
          ${m.photo ? `<img src="${m.photo}" alt="${m.name}" class="mat-thumb" onerror="this.style.display='none'" />` : `<span class="no-photo">📦</span>`}
        </td>
        <td><strong>${m.name}</strong></td>
        <td style="font-family: monospace; font-weight: 700;">${m.itemCode || '—'}</td>
        <td style="font-weight: 700; color: #000000;">
          ${m.location ? `<span class="rack-badge">📍 ${m.location}</span>` : '<span style="color: #94a3b8;">—</span>'}
        </td>
        <td style="text-align: center; font-weight: 700;">${m.challanCount} Challan(s)</td>
        <td style="text-align: right; font-weight: 900; font-size: 13px; color: #000000;">
          ${m.totalQty.toLocaleString('en-IN')} ${m.unit}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Without-BOM Material Issue Register &amp; Summary Report - Mohit Hosiery</title>
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
            background: #ea580c;
            color: #ffffff;
            border: none;
            padding: 7px 18px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-close {
            background: #475569;
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
            body { padding: 0 !important; color: #000000 !important; }
            thead { display: table-header-group !important; }
            tr { page-break-inside: avoid !important; }
            .page-break { page-break-before: always; }
            th, td { border: 1.5px solid #000000 !important; color: #000000 !important; }
            .summary-group-box { page-break-inside: avoid !important; }
          }
          .header-box {
            border-bottom: 2px solid #000000;
            padding-bottom: 6px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .company-title {
            font-size: 18px;
            font-weight: 900;
            color: #000000;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
          }
          .doc-title {
            font-size: 13px;
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
            margin-bottom: 12px;
          }
          .summary-card {
            flex: 1;
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 10px;
            text-align: center;
            background: #ffffff;
          }
          .summary-card span {
            display: block;
            font-size: 9px;
            color: #000000;
            font-weight: 800;
            text-transform: uppercase;
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
            margin-bottom: 16px;
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
          .challan-badge {
            font-family: monospace;
            font-weight: 800;
            font-size: 11px;
            background: #f1f5f9;
            padding: 2px 6px;
            border: 1px solid #000000;
            border-radius: 4px;
            display: inline-block;
          }
          .mat-list-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .mat-item-row {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .mat-thumb {
            width: 28px;
            height: 28px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #000000;
            background: #ffffff;
            flex-shrink: 0;
          }
          .no-photo {
            width: 28px;
            height: 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 12px;
            flex-shrink: 0;
          }
          .mat-info {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }
          .mat-name {
            font-size: 11px;
            color: #000000;
          }
          .mat-code {
            font-family: monospace;
            font-size: 9.5px;
            color: #555555;
          }
          .mat-qty-badge {
            font-weight: 900;
            font-size: 11px;
            background: #f0fdf4;
            border: 1px solid #000000;
            padding: 1px 5px;
            border-radius: 3px;
          }
          .cat-badge {
            font-size: 8.5px;
            font-weight: 800;
            background: #f1f5f9;
            color: #0f172a;
            border: 1px solid #000000;
            padding: 1px 4px;
            border-radius: 3px;
            text-transform: uppercase;
            white-space: nowrap;
            letter-spacing: 0.3px;
            display: inline-block;
          }
          .rack-badge {
            font-size: 8.5px;
            font-weight: 800;
            background: #fff7ed;
            color: #9a3412;
            border: 1px solid #000000;
            padding: 1px 5px;
            border-radius: 3px;
            white-space: nowrap;
            letter-spacing: 0.2px;
            display: inline-block;
          }
          .section-banner {
            background: #0f172a;
            color: #ffffff;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 18px 0 10px 0;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .summary-group-box {
            border: 1.5px solid #000000;
            border-radius: 6px;
            margin-bottom: 12px;
            background: #ffffff;
            overflow: hidden;
          }
          .group-header {
            background: #f1f5f9;
            border-bottom: 1.5px solid #000000;
            padding: 6px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .group-title {
            font-weight: 900;
            font-size: 12px;
            color: #000000;
          }
          .group-sub {
            font-size: 10px;
            color: #475569;
            margin-left: 6px;
          }
          .group-badge {
            font-size: 11px;
            color: #000000;
          }
          table.sub-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }
          table.sub-table th, table.sub-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 8px;
            vertical-align: middle;
          }
          table.sub-table th {
            background: #f8fafc;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 9px;
            color: #000000;
          }
          .footer-signs {
            margin-top: 24px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            page-break-inside: avoid;
          }
          .sign-box {
            border-top: 1.5px solid #000000;
            width: 190px;
            text-align: center;
            padding-top: 6px;
            font-weight: 800;
            color: #000000;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn-print" onclick="window.print()">🖨️ Print Full Report Now</button>
            <span style="font-size: 12px; color: #cbd5e1;">A4 Landscape • High-Contrast Black &amp; White with Photos</span>
          </div>
          <button class="btn-close" onclick="window.close()">✕ Close Preview</button>
        </div>

        <!-- 1. Header Box -->
        <div class="header-box">
          <div>
            <div class="company-title">MOHIT HOSIERY</div>
            <div class="doc-title">WITHOUT-BOM &amp; MATERIAL ISSUE REGISTER (AUDIT REPORT)</div>
            <div class="doc-sub">Central Store &amp; Accessories Department • Complete Floor Issue Track</div>
            ${filterBannerHtml}
          </div>
          <div class="meta-info">
            <div><strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Total Challans:</strong> ${totalChallans} Records</div>
            <div><strong>Total Units:</strong> ${totalQtyIssued.toLocaleString('en-IN')} Units / Pcs</div>
            <div><strong>Printed By:</strong> ${(currentUser?.name || 'STORE STAFF').toUpperCase()}</div>
          </div>
        </div>

        <!-- 2. Summary Metric Strip -->
        <div class="summary-strip">
          <div class="summary-card">
            <span>TOTAL CHALLANS</span>
            <strong>${totalChallans}</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL LINE ITEMS</span>
            <strong>${totalLineItems}</strong>
          </div>
          <div class="summary-card" style="background: #f8fafc;">
            <span style="color: #0f172a;">TOTAL PIECES (CUTTING)</span>
            <strong style="color: #0f172a;">${grandTotalPieces.toLocaleString('en-IN')} Pcs</strong>
          </div>
          <div class="summary-card" style="background: #fff7ed;">
            <span style="color: #c2410c;">ISSUE PCS</span>
            <strong style="color: #c2410c;">${totalQtyIssued.toLocaleString('en-IN')} Pcs</strong>
          </div>
          <div class="summary-card" style="background: ${grandVariance === 0 ? '#f0fdf4' : grandVariance > 0 ? '#eff6ff' : '#fef2f2'};">
            <span style="color: ${grandVariance === 0 ? '#15803d' : grandVariance > 0 ? '#1d4ed8' : '#b91c1c'};">VARIANCE (CUTTING - ISSUE)</span>
            <strong style="color: ${grandVariance === 0 ? '#15803d' : grandVariance > 0 ? '#1d4ed8' : '#b91c1c'};">${grandVariance > 0 ? `+${grandVariance.toLocaleString('en-IN')}` : grandVariance.toLocaleString('en-IN')} Pcs</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL UNIQUE LOTS</span>
            <strong>${uniqueLots.size} Lot(s)</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL BRANDS</span>
            <strong>${uniqueBrands.size} Brand(s)</strong>
          </div>
        </div>

        <!-- 3. Main Challans Register Table -->
        <div style="margin-bottom: 6px; font-weight: 800; font-size: 11.5px; text-transform: uppercase;">
          1. Issue Challans / Bill Logs Register
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">SEQ #</th>
              <th style="width: 105px;">CHALLAN NO</th>
              <th style="width: 85px;">DATE</th>
              <th style="width: 130px;">LOT &amp; BRAND</th>
              <th>ISSUED MATERIALS (WITH PHOTO &amp; QTY)</th>
              <th style="width: 115px; text-align: right;">TOTAL PIECES (CUTTING)</th>
              <th style="width: 85px; text-align: right;">ISSUE PCS</th>
              <th style="width: 105px; text-align: right;">VARIANCE (CUTTING - ISSUE)</th>
              <th style="width: 90px;">ISSUED BY</th>
              <th style="width: 105px;">RECEIVED BY</th>
              <th style="width: 110px;">REMARKS</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 900; font-size: 11px; border-top: 2px solid #000000;">
              <td colspan="5" style="text-align: right; text-transform: uppercase; font-size: 11.5px;">Register Total (${totalChallans} Challans):</td>
              <td style="text-align: right; font-weight: 900; font-size: 12px; white-space: nowrap; background: #f8fafc;">
                ${grandTotalPieces.toLocaleString('en-IN')} Pcs Cutting
              </td>
              <td style="text-align: right; font-weight: 900; font-size: 12px; color: #ea580c; white-space: nowrap; background: #fff7ed;">
                ${totalQtyIssued.toLocaleString('en-IN')} Pcs
              </td>
              <td style="text-align: right; font-weight: 900; font-size: 11.5px; white-space: nowrap; background: ${grandVariance === 0 ? '#f0fdf4' : grandVariance > 0 ? '#eff6ff' : '#fef2f2'};">
                <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; border: 1px solid ${grandVariance === 0 ? '#bbf7d0' : grandVariance > 0 ? '#bfdbfe' : '#fecaca'}; color: ${grandVariance === 0 ? '#15803d' : grandVariance > 0 ? '#1d4ed8' : '#b91c1c'};">
                  ${grandVariance > 0 ? `+${grandVariance.toLocaleString('en-IN')}` : grandVariance.toLocaleString('en-IN')} Pcs
                </span>
              </td>
              <td colspan="3" style="font-size: 10px; color: #475569; font-weight: 700;">
                ${totalLineItems} Material Item Rows Across ${uniqueLots.size} Lot(s)
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- 2. Consolidated Material Grand Totals (With Location / Rack No) -->
        <div class="section-banner" style="margin-top: 18px;">
          <span>2. CONSOLIDATED MATERIAL GRAND TOTALS</span>
          <span style="font-size: 10px; font-weight: 600;">(Complete Material-wise Issue Volume Across All Lots)</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">PHOTO</th>
              <th>MATERIAL / ACCESSORY NAME</th>
              <th style="width: 110px;">ITEM CODE</th>
              <th style="width: 140px;">LOCATION / RACK NO</th>
              <th style="width: 130px; text-align: center;">CHALLAN COUNT</th>
              <th style="width: 170px; text-align: right;">GRAND TOTAL ISSUED</th>
            </tr>
          </thead>
          <tbody>
            ${materialListHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 900; font-size: 12px; border-top: 2px solid #000000;">
              <td colspan="4" style="text-align: right; text-transform: uppercase;">Overall Register Grand Total:</td>
              <td style="text-align: center;">${totalChallans} Challans</td>
              <td style="text-align: right; font-size: 13.5px; color: #000000; background: #f0fdf4;">
                <strong>${totalQtyIssued.toLocaleString('en-IN')} Units / Pcs</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- 7. Footer Signatures -->
        <div class="footer-signs">
          <div class="sign-box">Prepared / Issued By<br/><small style="font-weight: normal; color: #444;">Store In-charge</small></div>
          <div class="sign-box">Received By<br/><small style="font-weight: normal; color: #444;">Cutting Master</small></div>
          <div class="sign-box">Verified By<br/><small style="font-weight: normal; color: #444;">Floor Supervisor</small></div>
          <div class="sign-box">Authorized Signatory<br/><small style="font-weight: normal; color: #444;">Production Manager</small></div>
        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
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
                {isMovementReport ? 'MATERIAL ISSUE' : 'MATERIAL ISSUE WITHOUT BOM'}
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
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>Requisition Type:</span>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                }}
              >
                <Tag size={14} />
                <span>🏷️ Direct Item Issue</span>
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

              {/* Brand Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Brand Name
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    list="existing-brands-list"
                    className="form-input"
                    placeholder="Enter or select Brand Name (e.g. Mohit, Lux, Dixcy)..."
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <datalist id="existing-brands-list">
                    {availableBrands.map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  Optional brand/buyer label for this lot
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

            {/* ── LIVE CUTTING DETAILS ACCORDING TO ENTERED LOT NUMBER ── */}
            {lotNo.trim() && (
              <div style={{
                marginTop: '16px',
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
                          Lot #{lotNo.trim()}
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
                        Production batch particulars automatically synchronized with Lot #{lotNo.trim()} • Auto-refreshes every 30m
                      </span>
                    </div>
                  </div>

                  {/* Cutting Total Pieces Hero Badge + Matrix Toggle Button */}
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
                      <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total Cutting Quantity
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: '900', color: '#14532d' }}>
                        {(activeLotCutting?.totalPieces || 0).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '700' }}>Pcs</span>
                      </span>
                    </div>

                    {activeLotCutting?.rows?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowActiveCuttingMatrix(prev => !prev)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #0284c7',
                          background: showActiveCuttingMatrix ? '#0284c7' : '#f0f9ff',
                          color: showActiveCuttingMatrix ? '#ffffff' : '#0369a1',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Eye size={13} />
                        <span>{showActiveCuttingMatrix ? 'Hide Matrix' : `Matrix Breakdown (${activeLotCutting.rows.length} Colors)`}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata Pills Grid */}
                {activeLotCutting && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '10px',
                    marginBottom: activeLotCutting?.rows?.length > 0 && showActiveCuttingMatrix ? '14px' : '0'
                  }}>
                    <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Garment Style</span>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting.style || '—'}</span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Fabric</span>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting.fabric || '—'}</span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Brand / Buyer</span>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting.brand || brandName || '—'}</span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Party Name</span>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>{activeLotCutting.partyName || '—'}</span>
                    </div>
                    {activeLotCutting.shades && (
                      <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Shades</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{activeLotCutting.shades}</span>
                      </div>
                    )}
                    {activeLotCutting.sizes && (
                      <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Sizes</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{activeLotCutting.sizes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Expandable Cutting Color-Size Matrix Table */}
                {showActiveCuttingMatrix && activeLotCutting?.rows?.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>Cutting Ratio &amp; Color Matrix Breakdown</span>
                      <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                        {activeLotCutting.rows.length} Colors &bull; Total {(activeLotCutting.totalPieces || 0).toLocaleString()} Pcs
                      </span>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '220px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                            <th style={{ padding: '6px 10px', fontWeight: '800' }}>Color / Shade</th>
                            <th style={{ padding: '6px 8px', fontWeight: '800', textAlign: 'center' }}>Table</th>
                            {activeSizes.map(sz => (
                              <th key={sz} style={{ padding: '6px 8px', fontWeight: '800', textAlign: 'center' }}>{sz}</th>
                            ))}
                            <th style={{ padding: '6px 10px', fontWeight: '800', textAlign: 'right' }}>Total Pcs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLotCutting.rows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                              <td style={{ padding: '6px 10px', fontWeight: '700', color: '#0f172a' }}>{row.color || '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{row.cuttingTable || '—'}</td>
                              {activeSizes.map(sz => (
                                <td key={sz} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600', color: Number(row.sizes?.[sz]) > 0 ? '#0f172a' : '#cbd5e1' }}>
                                  {row.sizes?.[sz] || 0}
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

            {/* ── CUTTING PIECES & 1% EXTRA MATERIAL BANNER ── */}
            {cuttingPieces > 0 && (
              <div style={{
                marginBottom: '14px',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                border: '1.5px solid #86efac',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '900',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    ✂️
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#065f46' }}>
                        CUTTING QUANTITY &amp; 1% AUTO-ALLOWANCE ACTIVE
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        background: '#d1fae5',
                        color: '#047857',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid #a7f3d0'
                      }}>
                        Lot #{lotNo.trim()}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span>
                        Cutting Pieces: <strong>{cuttingPieces.toLocaleString()} Pcs</strong>
                      </span>
                      <span>+</span>
                      <span>
                        1% Auto Material: <strong>+{onePercentAllowance.toLocaleString()} Pcs</strong> (1%)
                      </span>
                      <span>=</span>
                      <span style={{
                        fontSize: '12.5px',
                        fontWeight: '900',
                        color: '#065f46',
                        background: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #86efac'
                      }}>
                        Auto Issue Qty: {defaultAutoIssueQty.toLocaleString()} Pcs
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#065f46',
                    background: '#ffffff',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                    fontWeight: '600',
                    lineHeight: '1.4'
                  }}>
                    <div>✓ <strong>&le; {defaultAutoIssueQty.toLocaleString()} Pcs</strong>: Direct Issue OK</div>
                    <div style={{ color: '#b91c1c' }}>⚠️ <strong>&gt; {defaultAutoIssueQty.toLocaleString()} Pcs</strong>: Admin Approval Needed</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setItems(prev => prev.map(item => ({ ...item, totalQty: defaultAutoIssueQty })));
                      setFormSuccess(`✓ Set all items to 1% cutting quantity (${defaultAutoIssueQty.toLocaleString()} Pcs)`);
                      setTimeout(() => setFormSuccess(''), 3000);
                    }}
                    style={{
                      padding: '7px 12px',
                      background: '#047857',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '7px',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ⚡ Set 1% ({defaultAutoIssueQty}) on All
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '10px 12px', width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '10px 12px', width: '175px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span>Component / Type</span>
                        {customComponentTypes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowManageTypesModal(true)}
                            title="Manage custom types"
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              padding: '2px 5px',
                              fontSize: '10px',
                              fontWeight: '700',
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <Settings size={10} />
                            <span>({customComponentTypes.length})</span>
                          </button>
                        )}
                      </div>
                    </th>
                    <th style={{ padding: '10px 12px', minWidth: '260px' }}>Store Material Item</th>
                    <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Current Stock</th>
                    <th style={{ padding: '10px 12px', width: '130px' }}>Method</th>
                    <th style={{ padding: '10px 12px', width: '145px', textAlign: 'right' }}>
                      <div>Issue Quantity</div>
                      {cuttingPieces > 0 && (
                        <div style={{ fontSize: '9px', color: '#047857', fontWeight: '800', textTransform: 'none' }}>
                          (1% Limit: {defaultAutoIssueQty})
                        </div>
                      )}
                    </th>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder="Type name (e.g. BUTTON)..."
                                  value={item.customComponentType || ''}
                                  onChange={(e) => {
                                    handleUpdateItem(item.id, 'customComponentType', e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitCustomType(item.id, item.customComponentType);
                                    } else if (e.key === 'Escape') {
                                      handleUpdateItem(item.id, 'isCustomType', false);
                                      handleUpdateItem(item.id, 'customComponentType', '');
                                    }
                                  }}
                                  onBlur={() => {
                                    if (item.customComponentType && item.customComponentType.trim()) {
                                      commitCustomType(item.id, item.customComponentType);
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
                                  onClick={() => commitCustomType(item.id, item.customComponentType)}
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
                                    handleUpdateItem(item.id, 'isCustomType', false);
                                    handleUpdateItem(item.id, 'customComponentType', '');
                                    handleUpdateItem(item.id, 'componentType', allComponentTypes[0] || 'DORI');
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
                                ↵ Enter or click ✓ Add to save to list
                              </span>
                            </div>
                          ) : (
                            <select
                              value={item.componentType}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  handleUpdateItem(item.id, 'isCustomType', true);
                                  handleUpdateItem(item.id, 'customComponentType', '');
                                } else if (val === '__manage__') {
                                  setShowManageTypesModal(true);
                                } else {
                                  handleUpdateItem(item.id, 'componentType', val);
                                  handleUpdateItem(item.id, 'isCustomType', false);
                                  if (val === 'DORI' || val === 'ELASTIC') {
                                    if (!item.materialId) handleUpdateItem(item.id, 'unit', 'Mtr');
                                  } else {
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
                                  fontSize: '12px'
                                }}
                              />
                            </div>
                          ) : (() => {
                            const qty = Number(item.totalQty) || 0;
                            const liveMat = (materials || []).find(m => String(m.id) === String(item.materialId));
                            const rackStock = liveMat ? (Number(liveMat.stock) || 0) : (Number(item.availableStock) || 0);
                            const hasMaterial = Boolean(item.materialId && item.entryMode !== 'manual');
                            const isStockShortage = hasMaterial && qty > rackStock;
                            const isExceeded = !isStockShortage && cuttingPieces > 0 && qty > defaultAutoIssueQty;
                            const isWithin = !isStockShortage && cuttingPieces > 0 && qty > 0 && qty <= defaultAutoIssueQty;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                <input
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  max={hasMaterial ? rackStock : undefined}
                                  value={item.totalQty || ''}
                                  onChange={(e) => handleUpdateItem(item.id, 'totalQty', parseFloat(e.target.value) || 0)}
                                  style={{
                                    width: '100px',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: isStockShortage
                                      ? '2px solid #dc2626'
                                      : isExceeded
                                        ? '2px solid #ef4444'
                                        : isWithin
                                          ? '1.5px solid #10b981'
                                          : '1.5px solid #cbd5e1',
                                    background: isStockShortage
                                      ? '#fef2f2'
                                      : isExceeded
                                        ? '#fef2f2'
                                        : isWithin
                                          ? '#f0fdf4'
                                          : '#ffffff',
                                    textAlign: 'right',
                                    fontSize: '13px',
                                    fontWeight: '800',
                                    color: isStockShortage || isExceeded ? '#b91c1c' : '#0f172a',
                                    boxSizing: 'border-box'
                                  }}
                                />
                                {isStockShortage && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      color: '#991b1b',
                                      background: '#fee2e2',
                                      border: '1px solid #fca5a5',
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      ⛔ Exceeds Rack Stock! (Rack: {rackStock} {item.unit})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(item.id, 'totalQty', rackStock)}
                                      style={{
                                        fontSize: '9.5px',
                                        color: '#b91c1c',
                                        background: '#ffffff',
                                        border: '1px solid #f87171',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        padding: '1px 5px'
                                      }}
                                      title="Set to max available rack stock"
                                    >
                                      Set to Rack Stock ({rackStock})
                                    </button>
                                  </div>
                                )}
                                {!isStockShortage && isExceeded && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      color: '#dc2626',
                                      background: '#fee2e2',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      ⚠️ &gt;1% (+{qty - defaultAutoIssueQty}) Approval Req
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(item.id, 'totalQty', defaultAutoIssueQty)}
                                      style={{
                                        fontSize: '9.5px',
                                        color: '#047857',
                                        background: '#ecfdf5',
                                        border: '1px solid #a7f3d0',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        padding: '1px 5px'
                                      }}
                                      title="Reset to 1% cutting allowance"
                                    >
                                      Set 1% ({defaultAutoIssueQty})
                                    </button>
                                  </div>
                                )}
                                {!isStockShortage && isWithin && (
                                  <span style={{ fontSize: '9.5px', color: '#059669', fontWeight: '700' }}>
                                    ✓ &le; 1% Allowed
                                  </span>
                                )}
                              </div>
                            );
                          })()}
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

              {/* Direct Save PDF Button */}
              <button
                type="button"
                onClick={handleSavePdfFromForm}
                style={{
                  padding: '11px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid #dc2626',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.1)'
                }}
                title="Save & Download Challan Slip as PDF"
              >
                <Download size={16} style={{ color: '#dc2626' }} />
                <span>Save PDF</span>
              </button>

              {/* Confirm & Issue Button */}
              <button
                type="button"
                disabled={submitting || hasShortageItems}
                onClick={handleSubmitIssue}
                style={{
                  padding: '12px 28px',
                  borderRadius: '10px',
                  border: 'none',
                  background: hasShortageItems
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: (submitting || hasShortageItems) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: hasShortageItems ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.35)',
                  transition: 'all 0.2s',
                  opacity: hasShortageItems ? 0.75 : 1
                }}
              >
                <Zap size={18} />
                <span>
                  {hasShortageItems
                    ? '⛔ Stock Shortage in Rack (Cannot Issue)'
                    : submitting
                      ? 'Issuing & Generating Challan...'
                      : '⚡ Confirm Issue & Give Challan / Bill'}
                </span>
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
                {isMovementReport ? 'Material Issue Challan / Bill Logs' : 'Without-BOM & Item Issue Challan / Bill Logs'}
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                {isMovementReport ? 'Audit history and cutting variance of all store material issue slips and challans.' : 'Audit history of all material issue slips and challans generated without approved BOM.'}
              </p>
            </div>

            {/* Search & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '260px' }}>
                <input
                  type="text"
                  placeholder="Search Bill No, Material, Receiver..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 30px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handlePrintFullHistoryReport}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #0f172a',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Print full audit register with material photos, brand-wise and lot-wise summaries"
              >
                <Printer size={14} style={{ color: '#ea580c' }} />
                <span>Print Full Report ({withoutBomLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={handleExportFullReportPdf}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #dc2626',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Export full filtered audit register with items, quantities, and departments to PDF document"
              >
                <Download size={14} style={{ color: '#ffffff' }} />
                <span>Export PDF ({withoutBomLogs.length})</span>
              </button>
            </div>
          </div>

          {/* ── INTERACTIVE MULTI-FILTER PANEL (Dates, Categories Multi-Select, Person) ── */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* ROW 1: Date Filter + Person Filter + Reset Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              
              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={14} style={{ color: '#ea580c' }} />
                  Dates Wise:
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ffffff', padding: '3px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    title="From Date"
                    style={{ border: 'none', background: 'transparent', fontSize: '11.5px', color: '#0f172a', fontWeight: '600', outline: 'none' }}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>to</span>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    title="To Date"
                    style={{ border: 'none', background: 'transparent', fontSize: '11.5px', color: '#0f172a', fontWeight: '600', outline: 'none' }}
                  />
                  {(historyDateFrom || historyDateTo) && (
                    <button
                      type="button"
                      onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }}
                      title="Clear Dates"
                      style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Quick Date Presets */}
                <div style={{ display: 'inline-flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleSetToday}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: (historyDateFrom && historyDateFrom === new Date().toISOString().split('T')[0] && historyDateTo === historyDateFrom) ? '#0f172a' : '#ffffff',
                      color: (historyDateFrom && historyDateFrom === new Date().toISOString().split('T')[0] && historyDateTo === historyDateFrom) ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleSetYesterday}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={handleSetLast7Days}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Last 7 Days
                  </button>
                </div>
              </div>

              {/* Person Filter - Multi-Select Choose Option */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <User size={14} style={{ color: '#0284c7' }} />
                  Person Wise:
                </span>

                {/* Multi-Select Person Dropdown Menu Trigger Container */}
                <div ref={personDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    onClick={() => setPersonDropdownOpen(prev => !prev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: historyPersons.length > 0 ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: historyPersons.length > 0 ? '#f0f9ff' : '#ffffff',
                      color: historyPersons.length > 0 ? '#0369a1' : '#0f172a',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: historyPersons.length > 0 ? '0 1px 4px rgba(2,132,199,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    title="Click to select multiple Store Issuers or Floor Receivers"
                  >
                    <User size={13} style={{ color: historyPersons.length > 0 ? '#0284c7' : '#64748b' }} />
                    <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {historyPersons.length === 0
                        ? `All Persons (${availablePeople.total})`
                        : historyPersons.length === 1
                        ? formatPersonKey(historyPersons[0])
                        : `${formatPersonKey(historyPersons[0])} +${historyPersons.length - 1} more`}
                    </span>
                    {historyPersons.length > 0 && (
                      <span style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '1px 6px',
                        borderRadius: '10px'
                      }}>
                        {historyPersons.length}
                      </span>
                    )}
                    <ChevronDown size={13} style={{ transform: personDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: '#64748b', marginLeft: '2px' }} />
                  </button>

                  {/* The Floating Scrollable Person Dropdown Menu (Right-Aligned to prevent overflow) */}
                  {personDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 150,
                      width: '300px',
                      maxWidth: 'calc(100vw - 24px)',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.22), 0 8px 16px -6px rgba(15, 23, 42, 0.12)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      {/* Search & Quick Action Buttons */}
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                          <input
                            type="text"
                            placeholder="Search Store or Floor person..."
                            value={personSearchTerm}
                            onChange={(e) => setPersonSearchTerm(e.target.value)}
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '6px 26px 6px 26px',
                              fontSize: '11.5px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              boxSizing: 'border-box',
                              outline: 'none',
                              background: '#ffffff'
                            }}
                          />
                          <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          {personSearchTerm && (
                            <X
                              size={12}
                              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }}
                              onClick={() => setPersonSearchTerm('')}
                            />
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const allKeys = [
                                ...availablePeople.issuers.map(p => p.key),
                                ...availablePeople.receivers.map(p => p.key)
                              ];
                              setHistoryPersons(allKeys);
                            }}
                            style={{
                              border: 'none',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              transition: 'background 0.1s ease'
                            }}
                          >
                            Select All ({availablePeople.total})
                          </button>
                          {historyPersons.length > 0 && (
                            <span style={{ fontSize: '10.5px', color: '#0369a1', fontWeight: '800' }}>
                              {historyPersons.length} selected
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setHistoryPersons([])}
                            style={{
                              border: 'none',
                              background: historyPersons.length > 0 ? '#fee2e2' : 'transparent',
                              color: historyPersons.length > 0 ? '#b91c1c' : '#64748b',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              transition: 'background 0.1s ease'
                            }}
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>

                      {/* Scrollable Person List */}
                      <div style={{
                        maxHeight: '260px',
                        overflowY: 'auto',
                        padding: '6px 8px'
                      }}>
                        {/* Store Team Section */}
                        {filteredPeople.issuers.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: '#0369a1',
                              background: '#f0f9ff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              marginBottom: '3px'
                            }}>
                              <span>Issued By (Store Team)</span>
                              <span>{filteredPeople.issuers.length}</span>
                            </div>
                            {filteredPeople.issuers.map(p => {
                              const isChecked = historyPersons.includes(p.key);
                              return (
                                <div
                                  key={p.key}
                                  onClick={() => handleToggleHistoryPerson(p.key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    background: isChecked ? '#e0f2fe' : 'transparent',
                                    transition: 'background 0.1s ease',
                                    fontSize: '12px',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                                    />
                                    <span style={{ fontWeight: isChecked ? '800' : '600', color: isChecked ? '#0369a1' : '#334155' }}>
                                      Store: {p.name}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    color: isChecked ? '#0284c7' : '#64748b',
                                    background: isChecked ? '#bae6fd' : '#f1f5f9',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: '700'
                                  }}>
                                    {p.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Floor / Masters Section */}
                        {filteredPeople.receivers.length > 0 && (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: '#4338ca',
                              background: '#eef2ff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              marginBottom: '3px'
                            }}>
                              <span>Received By (Floor / Masters)</span>
                              <span>{filteredPeople.receivers.length}</span>
                            </div>
                            {filteredPeople.receivers.map(p => {
                              const isChecked = historyPersons.includes(p.key);
                              return (
                                <div
                                  key={p.key}
                                  onClick={() => handleToggleHistoryPerson(p.key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    background: isChecked ? '#ede9fe' : 'transparent',
                                    transition: 'background 0.1s ease',
                                    fontSize: '12px',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      style={{ cursor: 'pointer', accentColor: '#4338ca' }}
                                    />
                                    <span style={{ fontWeight: isChecked ? '800' : '600', color: isChecked ? '#4338ca' : '#334155' }}>
                                      Floor: {p.name}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    color: isChecked ? '#4338ca' : '#64748b',
                                    background: isChecked ? '#ddd6fe' : '#f1f5f9',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: '700'
                                  }}>
                                    {p.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {filteredPeople.issuers.length === 0 && filteredPeople.receivers.length === 0 && (
                          <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                            No person found matching "{personSearchTerm}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset Filters button if any filter active */}
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fca5a5',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Clear all active filters"
                  >
                    <RefreshCw size={12} />
                    <span>Reset Filters ({activeFiltersCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* ROW 2: Category Multi-Select Scrollable Dropdown Menu */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              borderTop: '1px dashed #e2e8f0',
              paddingTop: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Tag size={13} style={{ color: '#7c3aed' }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap' }}>
                  Category Wise:
                </span>
              </div>

              {/* Scrollable Dropdown Menu Trigger Container */}
              <div ref={categoryDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(prev => !prev)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: historyCategories.length > 0 ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: historyCategories.length > 0 ? '#eff6ff' : '#ffffff',
                    color: historyCategories.length > 0 ? '#1d4ed8' : '#0f172a',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: historyCategories.length > 0 ? '0 1px 3px rgba(37,99,235,0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Click to open scrollable category multi-select menu"
                >
                  <Tag size={12} style={{ color: historyCategories.length > 0 ? '#2563eb' : '#64748b' }} />
                  <span>
                    {historyCategories.length === 0 
                      ? `All Categories (${rawWithoutBomLogs.length})` 
                      : historyCategories.length === 1 
                      ? `${historyCategories[0]}` 
                      : `${historyCategories.slice(0, 2).join(', ')}${historyCategories.length > 2 ? ` +${historyCategories.length - 2}` : ''}`}
                  </span>
                  {historyCategories.length > 0 && (
                    <span style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}>
                      {historyCategories.length}
                    </span>
                  )}
                  <ChevronDown size={13} style={{ transform: categoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: '#64748b' }} />
                </button>

                {/* The Floating Scrollable Dropdown Menu */}
                {categoryDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    left: 0,
                    zIndex: 100,
                    width: '300px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.2), 0 8px 12px -6px rgba(15, 23, 42, 0.12)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Header with Search and Quick Actions */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={categorySearchTerm}
                          onChange={(e) => setCategorySearchTerm(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px 8px 6px 26px',
                            fontSize: '11.5px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                        <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        {categorySearchTerm && (
                          <X
                            size={12}
                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }}
                            onClick={() => setCategorySearchTerm('')}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const allNames = availableHistoryCategories.map(c => c.name);
                            setHistoryCategories(allNames);
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}
                        >
                          Select All ({availableHistoryCategories.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryCategories([])}
                          style={{ border: 'none', background: 'transparent', color: '#64748b', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Category List */}
                    <div style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      padding: '4px 6px'
                    }}>
                      {/* "All Categories" row option */}
                      <div
                        onClick={() => setHistoryCategories([])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: historyCategories.length === 0 ? '#f1f5f9' : 'transparent',
                          transition: 'background 0.1s ease',
                          fontSize: '12px'
                        }}
                        onMouseEnter={(e) => { if (historyCategories.length !== 0) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (historyCategories.length !== 0) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={historyCategories.length === 0}
                            onChange={() => setHistoryCategories([])}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: historyCategories.length === 0 ? '800' : '600', color: historyCategories.length === 0 ? '#0f172a' : '#334155' }}>
                            All Categories (No Filter)
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '8px', fontWeight: '700' }}>
                          {rawWithoutBomLogs.length}
                        </span>
                      </div>

                      {filteredCategoryOptions.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                          No categories found matching "{categorySearchTerm}"
                        </div>
                      ) : (
                        filteredCategoryOptions.map(catItem => {
                          const isChecked = historyCategories.includes(catItem.name);
                          return (
                            <div
                              key={catItem.name}
                              onClick={() => handleToggleHistoryCategory(catItem.name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: isChecked ? '#eff6ff' : 'transparent',
                                transition: 'background 0.1s ease',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                              onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: isChecked ? '800' : '600', color: isChecked ? '#1d4ed8' : '#0f172a' }}>
                                  {catItem.name}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                color: isChecked ? '#ffffff' : '#64748b',
                                background: isChecked ? '#2563eb' : '#e2e8f0',
                                padding: '1px 6px',
                                borderRadius: '8px'
                              }}>
                                {catItem.count}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                        {historyCategories.length === 0 ? 'Showing all categories' : `${historyCategories.length} selected`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryDropdownOpen(false)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#0f172a',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Categories Display Tags */}
              {historyCategories.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Selected:</span>
                  {historyCategories.map(cat => (
                    <span
                      key={cat}
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#1d4ed8',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {cat}
                      <X
                        size={11}
                        style={{ cursor: 'pointer', opacity: 0.8 }}
                        onClick={() => handleToggleHistoryCategory(cat)}
                        title={`Remove ${cat}`}
                      />
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHistoryCategories([])}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* ROW 3: Active Filters Summary & Count Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11.5px',
              color: '#64748b',
              paddingTop: '6px',
              borderTop: '1px dashed #e2e8f0',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>
                  Showing <span style={{ color: '#ea580c', fontWeight: '900' }}>{withoutBomLogs.length}</span> of {rawWithoutBomLogs.length} Challans
                </span>

                {/* Badges for active filters */}
                {historyDateFrom && (
                  <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    📅 {historyDateFrom} to {historyDateTo || 'Today'}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }} />
                  </span>
                )}
                {historyCategories.length > 0 && (
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    🏷️ {historyCategories.join(', ')}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setHistoryCategories([])} />
                  </span>
                )}
                {historyPersons.map(pKey => (
                  <span
                    key={pKey}
                    style={{
                      background: pKey.startsWith('iss:') ? '#e0f2fe' : '#ede9fe',
                      color: pKey.startsWith('iss:') ? '#0369a1' : '#4338ca',
                      border: pKey.startsWith('iss:') ? '1px solid #bae6fd' : '1px solid #ddd6fe',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    👤 {formatPersonKey(pKey)}
                    <X
                      size={10}
                      style={{ cursor: 'pointer', strokeWidth: 2.5 }}
                      onClick={() => handleToggleHistoryPerson(pKey)}
                      title={`Remove ${formatPersonKey(pKey)}`}
                    />
                  </span>
                ))}
                {historySearch && (
                  <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    🔍 "{historySearch}"
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setHistorySearch('')} />
                  </span>
                )}
              </div>

              {activeFiltersCount > 0 && (
                <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: '700' }}>
                  Print button will export only these {withoutBomLogs.length} filtered records.
                </span>
              )}
            </div>
          </div>

          {withoutBomLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <FileText size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#475569' }}>
                {activeFiltersCount > 0 ? 'No Without-BOM challans match your selected filters.' : 'No Without-BOM issue slips found.'}
              </div>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                {activeFiltersCount > 0 
                  ? 'Try broadening your dates, clearing category selection, or resetting filters.' 
                  : 'Issue materials above to track them in this audit log.'}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  style={{
                    marginTop: '12px',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1.5px solid #0f172a',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Reset All Filters
                </button>
              )}
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
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Pieces (Cutting)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Issue Pcs</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Variance (Cutting - Issue)</th>
                    <th style={{ padding: '10px 12px' }}>Issued By</th>
                    <th style={{ padding: '10px 12px' }}>Received By</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withoutBomLogs.map((log, idx) => {
                    const { totalPieces, issuePcs, variance, isDirect } = getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs);
                    return (
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
                            <span>LOT #{log.lotId}{(log.brand || log.brandName) ? ` (${log.brand || log.brandName})` : ''}</span>
                          )}
                          <span style={{ marginLeft: '6px', fontSize: '10px', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#475569', fontWeight: '800' }}>
                            W/O BOM
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(log.materials || []).slice(0, 4).map((m, mIdx) => {
                              const photoSrc = getMaterialPhoto(m);
                              const categoryName = getMaterialCategory(m);
                              const loc = getMaterialLocation(m);
                              return (
                                <div key={mIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {photoSrc ? (
                                    <img
                                      src={photoSrc}
                                      alt={m.name || 'material'}
                                      style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>📦</span>
                                  )}
                                  {categoryName && (
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      background: '#f1f5f9',
                                      color: '#1e293b',
                                      border: '1px solid #cbd5e1',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.3px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {categoryName}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '12px', color: '#0f172a' }}>
                                    <strong>{m.name || m.bomItemName}:</strong> {m.qty} {m.unit || 'pcs'}
                                  </span>
                                  {loc && (
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '800',
                                      background: '#fff7ed',
                                      color: '#c2410c',
                                      border: '1px solid #fed7aa',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      📍 {loc}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {(log.materials || []).length > 4 && (
                              <span style={{ fontSize: '10.5px', color: '#ea580c', fontWeight: '700', marginLeft: '4px' }}>
                                +{(log.materials || []).length - 4} more item(s)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                            {totalPieces > 0 ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>
                                    {totalPieces.toLocaleString('en-IN')}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Pcs</span>
                                </div>
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '800',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  padding: '1.5px 6px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  ✂️ Cutting: {totalPieces.toLocaleString('en-IN')} Pcs
                                </span>
                              </>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: '#94a3b8', fontSize: '12px' }}>—</span>
                                <span style={{ fontSize: '9px', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px' }}>
                                  {isDirect ? 'Direct Issue' : 'No Lot Qty'}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '900', color: '#ea580c', fontSize: '12.5px' }}>{issuePcs.toLocaleString('en-IN')}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '3px' }}>Pcs</span>
                          <div style={{ fontSize: '9px', color: '#9a3412', fontWeight: '700', marginTop: '2px' }}>
                            ISSUED
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {totalPieces > 0 ? (
                            <>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: '800',
                                border: '1px solid',
                                background: variance === 0 ? '#f0fdf4' : variance > 0 ? '#eff6ff' : '#fef2f2',
                                borderColor: variance === 0 ? '#bbf7d0' : variance > 0 ? '#bfdbfe' : '#fecaca',
                                color: variance === 0 ? '#15803d' : variance > 0 ? '#1d4ed8' : '#b91c1c'
                              }}>
                                {variance > 0 ? `+${variance.toLocaleString('en-IN')}` : variance.toLocaleString('en-IN')} Pcs
                              </span>
                              <div style={{
                                fontSize: '9px',
                                fontWeight: '800',
                                marginTop: '2px',
                                color: variance === 0 ? '#166534' : variance > 0 ? '#1e40af' : '#991b1b'
                              }}>
                                {variance === 0 ? 'BALANCED' : variance > 0 ? 'CUTTING BALANCE' : 'OVER ISSUED'}
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                              —
                            </span>
                          )}
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
                              onClick={() => handleDownloadChallanPdf(log)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1.5px solid #dc2626',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              title="Direct 1-Click Export Challan to PDF"
                            >
                              <Download size={13} style={{ color: '#dc2626' }} />
                              <span>PDF</span>
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
                    );
                  })}
                </tbody>
                {(() => {
                  const screenTotalPieces = withoutBomLogs.reduce((sum, log) => sum + getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs).totalPieces, 0);
                  const screenIssuePcs = withoutBomLogs.reduce((sum, log) => sum + getChallanPiecesMetrics(log, materials, effectiveCuttingMap, designs).issuePcs, 0);
                  const screenVariance = screenTotalPieces - screenIssuePcs;
                  return (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: '800', fontSize: '12px' }}>
                        <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', color: '#475569', textTransform: 'uppercase' }}>
                          Grand Total ({withoutBomLogs.length} Challans):
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '900', color: '#0f172a' }}>{screenTotalPieces.toLocaleString('en-IN')}</span> <span style={{ fontSize: '11px', color: '#64748b' }}>Pcs Cutting</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '900', color: '#ea580c' }}>{screenIssuePcs.toLocaleString('en-IN')}</span> <span style={{ fontSize: '11px', color: '#64748b' }}>Pcs</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '900',
                            border: '1px solid',
                            background: screenVariance === 0 ? '#f0fdf4' : screenVariance > 0 ? '#eff6ff' : '#fef2f2',
                            borderColor: screenVariance === 0 ? '#bbf7d0' : screenVariance > 0 ? '#bfdbfe' : '#fecaca',
                            color: screenVariance === 0 ? '#15803d' : screenVariance > 0 ? '#1d4ed8' : '#b91c1c'
                          }}>
                            {screenVariance > 0 ? `+${screenVariance.toLocaleString('en-IN')}` : screenVariance.toLocaleString('en-IN')} Pcs Balance
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  );
                })()}
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
                      {(previewModal.issueData?.brandName || previewModal.issueData?.brand) && (
                        <span style={{ fontSize: '11px', color: '#0284c7', marginLeft: '6px' }}>
                          ({previewModal.issueData.brandName || previewModal.issueData.brand})
                        </span>
                      )}
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

      {/* Manage Custom Types Modal */}
      {showManageTypesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Manage Component / Types
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setNewTypeNameInput('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748b' }}>
                All custom accessory types entered are saved and shown in your dropdown list across bills.
              </p>

              {/* Add New Type input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newTypeNameInput.trim()) {
                    addCustomComponentType(newTypeNameInput.trim().toUpperCase());
                    setNewTypeNameInput('');
                  }
                }}
                style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}
              >
                <input
                  type="text"
                  placeholder="Type new component name (e.g. BUTTON)..."
                  value={newTypeNameInput}
                  onChange={(e) => setNewTypeNameInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '7px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '600'
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newTypeNameInput.trim()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: newTypeNameInput.trim() ? '#0f172a' : '#cbd5e1',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: newTypeNameInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  + Add
                </button>
              </form>

              {/* Types List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {/* Default Types */}
                {BASE_COMPONENT_TYPES.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#f8fafc',
                      fontSize: '12.5px',
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
                {customComponentTypes.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      color: '#0f172a'
                    }}
                  >
                    <span>{BASE_COMPONENT_TYPES.length + idx + 1}. {t}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomComponentType(t)}
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

                {customComponentTypes.length === 0 && (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No custom types added yet. Use "+ Add Manually" in the table or add one above!
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setNewTypeNameInput('');
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN PRINT CONTAINER (FOR WINDOW.PRINT DUAL COPY) ── */}
      {(previewModal || activePrintData) && (() => {
        const printIssue = previewModal?.issueData || activePrintData;
        const printVid = previewModal?.voucherId || activePrintData?.voucherId || nextVoucherId;
        if (!printIssue) return null;

        const cleanLot = String(printIssue.lotId || '').replace(/^LOT\s*#?/i, '').trim().toLowerCase();
        const resolvedCutting = Number(printIssue.cuttingPieces) || 
          (effectiveCuttingMap && effectiveCuttingMap[cleanLot] ? Number(effectiveCuttingMap[cleanLot]) : 0) || 
          (activeLotCutting && String(activeLotCutting.lotNumber).trim().toLowerCase() === cleanLot ? Number(activeLotCutting.totalPieces) : 0) ||
          (Number(printIssue.pieces) > 1 ? Number(printIssue.pieces) : 0);
        const onePct = resolvedCutting > 0 ? Math.round(resolvedCutting * 0.01) : 0;
        const totalAllowedWith1Pct = resolvedCutting + onePct;
        const isOnePercentExtraIssued = (printIssue.items || []).some(it => {
          const q = Number(it.totalQty);
          return (resolvedCutting > 0 && q >= totalAllowedWith1Pct) || (resolvedCutting > 0 && q > resolvedCutting);
        });

        const renderVolumeContent = () => {
          if (resolvedCutting > 0) {
            return (
              <span>
                <strong>{resolvedCutting.toLocaleString()} Pcs</strong>
                {isOnePercentExtraIssued ? (
                  <span style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                    (+1% Extra: {totalAllowedWith1Pct.toLocaleString()} Pcs)
                  </span>
                ) : (
                  <span style={{ marginLeft: '4px' }}>(1% Max: {totalAllowedWith1Pct.toLocaleString()} Pcs)</span>
                )}
              </span>
            );
          }
          return <span>{printIssue.pieces > 1 ? `${printIssue.pieces} Pcs` : 'Ad-Hoc Issue'}</span>;
        };

        return (
          <div className="without-bom-print-container">
            {/* Copy 1: ORIGINAL (STORE COPY) */}
            <div className="without-bom-challan-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#000000' }}>MOHIT HOSIERY</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT</div>
                  <div style={{ fontSize: '12px', fontWeight: '900', marginTop: '3px', letterSpacing: '0.5px', color: '#000000' }}>
                    MATERIAL ISSUE WITHOUT BOM
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>
                    OFFICIAL STORE CHALLAN / STORE ISSUE BILL
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#000000' }}>CHALLAN NO: {printVid}</div>
                  <div style={{ fontSize: '10px', color: '#000000', fontWeight: '600' }}>DATE: {printIssue.date}</div>
                  <div style={{ fontSize: '10px', fontWeight: '900', marginTop: '3px', color: '#000000' }}>[ ORIGINAL - STORE COPY ]</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', border: '1.5px solid #000', padding: '8px', marginBottom: '10px', color: '#000000' }}>
                <div><strong>LOT NO:</strong> LOT #{printIssue.lotId}{(printIssue.brandName || printIssue.brand) ? ` • BRAND: ${printIssue.brandName || printIssue.brand}` : ''}</div>
                <div><strong>ISSUED BY:</strong> {printIssue.personName}</div>
                <div><strong>RECEIVED BY:</strong> {printIssue.receiverName} ({printIssue.receiverDept})</div>
                <div><strong>REQUISITION:</strong> {printIssue.style}</div>
                <div><strong>CUTTING PIECES / VOLUME:</strong> {renderVolumeContent()}</div>
                <div><strong>STATUS:</strong> {printIssue.isPreviewOnly ? 'DRAFT PREVIEW' : 'REAL STOCK DEDUCTED'}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px', border: '1.5px solid #000' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f0f0f0', color: '#000000' }}>
                    <th style={{ padding: '5px', textAlign: 'center', width: '25px', border: '1px solid #000' }}>#</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Component</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Material Description</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Item Code</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Rack Loc</th>
                    <th style={{ padding: '5px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Issued Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printIssue.items || []).map((item, idx) => {
                    const qty = Number(item.totalQty);
                    const isItemExtra = resolvedCutting > 0 && (qty >= totalAllowedWith1Pct || qty > resolvedCutting);
                    return (
                      <tr key={idx} style={{ color: '#000000' }}>
                        <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #000', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}><strong>{item.componentType}</strong></td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.materialName}</td>
                        <td style={{ padding: '5px', border: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {getItemCodeDisplay(item, materials) || (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '') || '-'}
                        </td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.location || 'Store'}</td>
                        <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #000' }}>
                          <div>{item.totalQty} {item.unit || 'Pcs'}</div>
                          {isItemExtra && (
                            <div style={{ fontSize: '8.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>
                              [ +1% Extra Added ]
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {printIssue.remarks && (
                <div style={{ fontSize: '10px', marginBottom: '12px', border: '1px solid #000', borderLeft: '4px solid #000', padding: '5px 8px', color: '#000000' }}>
                  <strong>Remarks:</strong> {printIssue.remarks}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '10px', borderTop: '1.5px solid #000', fontSize: '10px', textAlign: 'center', color: '#000000' }}>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Issued By ({printIssue.personName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Received By ({printIssue.receiverName})</strong>
                </div>
                <div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
                  <strong>Supervisor Sign &amp; Stamp</strong>
                </div>
              </div>
            </div>

            <div style={{ height: '18px' }}></div>

            {/* Copy 2: DUPLICATE (DEPARTMENT / RECEIVER COPY) */}
            <div className="without-bom-challan-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#000000' }}>MOHIT HOSIERY</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>CENTRAL STORE &amp; PRODUCTION ACCESSORIES DEPARTMENT</div>
                  <div style={{ fontSize: '12px', fontWeight: '900', marginTop: '3px', letterSpacing: '0.5px', color: '#000000' }}>
                    MATERIAL ISSUE WITHOUT BOM
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000000' }}>
                    DUPLICATE DEPARTMENT COPY
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#000000' }}>CHALLAN NO: {printVid}</div>
                  <div style={{ fontSize: '10px', color: '#000000', fontWeight: '600' }}>DATE: {printIssue.date}</div>
                  <div style={{ fontSize: '10px', fontWeight: '900', marginTop: '3px', color: '#000000' }}>[ DUPLICATE - RECEIVER COPY ]</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', border: '1.5px solid #000', padding: '8px', marginBottom: '10px', color: '#000000' }}>
                <div><strong>LOT NO:</strong> LOT #{printIssue.lotId}{(printIssue.brandName || printIssue.brand) ? ` • BRAND: ${printIssue.brandName || printIssue.brand}` : ''}</div>
                <div><strong>ISSUED BY:</strong> {printIssue.personName}</div>
                <div><strong>RECEIVED BY:</strong> {printIssue.receiverName} ({printIssue.receiverDept})</div>
                <div><strong>REQUISITION:</strong> {printIssue.style}</div>
                <div><strong>CUTTING PIECES / VOLUME:</strong> {renderVolumeContent()}</div>
                <div><strong>STATUS:</strong> {printIssue.isPreviewOnly ? 'DRAFT PREVIEW' : 'REAL STOCK DEDUCTED'}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px', border: '1.5px solid #000' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f0f0f0', color: '#000000' }}>
                    <th style={{ padding: '5px', textAlign: 'center', width: '25px', border: '1px solid #000' }}>#</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Component</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Material Description</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Item Code</th>
                    <th style={{ padding: '5px', textAlign: 'left', border: '1px solid #000' }}>Rack Loc</th>
                    <th style={{ padding: '5px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Issued Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printIssue.items || []).map((item, idx) => {
                    const qty = Number(item.totalQty);
                    const isItemExtra = resolvedCutting > 0 && (qty >= totalAllowedWith1Pct || qty > resolvedCutting);
                    return (
                      <tr key={idx} style={{ color: '#000000' }}>
                        <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #000', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}><strong>{item.componentType}</strong></td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.materialName}</td>
                        <td style={{ padding: '5px', border: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {getItemCodeDisplay(item, materials) || (item.itemCode && !item.itemCode.toUpperCase().startsWith('ITM-') ? item.itemCode : '') || '-'}
                        </td>
                        <td style={{ padding: '5px', border: '1px solid #000' }}>{item.location || 'Store'}</td>
                        <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #000' }}>
                          <div>{item.totalQty} {item.unit || 'Pcs'}</div>
                          {isItemExtra && (
                            <div style={{ fontSize: '8.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>
                              [ +1% Extra Added ]
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {printIssue.remarks && (
                <div style={{ fontSize: '10px', marginBottom: '12px', border: '1px solid #000', borderLeft: '4px solid #000', padding: '5px 8px', color: '#000000' }}>
                  <strong>Remarks:</strong> {printIssue.remarks}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '10px', borderTop: '1.5px solid #000', fontSize: '10px', textAlign: 'center', color: '#000000' }}>
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

      {/* ── 1% CUTTING THRESHOLD EXCEEDED - APPROVAL MODAL ── */}
      {approvalModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '620px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '2px solid #f87171',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)',
              padding: '16px 20px',
              borderBottom: '1.5px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#991b1b' }}>
                    Approval Required: Issue Exceeds 1% Cutting Allowance
                  </h3>
                  <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
                    Lot #{approvalModalData.lotNo} • Cutting Pieces: {approvalModalData.cuttingPieces.toLocaleString()} Pcs
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalData(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  color: '#991b1b',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Allowance Summary Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>CUTTING PIECES</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                    {approvalModalData.cuttingPieces.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700' }}>1% ALLOWED EXTRA</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669', marginTop: '2px' }}>
                    +{approvalModalData.onePercentAllowance.toLocaleString()} Pcs
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: '700' }}>MAX PERMITTED (1%)</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#ea580c', marginTop: '2px' }}>
                    {approvalModalData.defaultAutoIssueQty.toLocaleString()} Pcs
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#9f1239',
                lineHeight: '1.5'
              }}>
                <strong>Store Issue Policy:</strong> Requisitions up to <strong>1% ({approvalModalData.defaultAutoIssueQty.toLocaleString()} Pcs)</strong> are issued automatically. The following item(s) exceed the 1% threshold and require official Admin approval or adjustment back to the 1% limit.
              </div>

              {/* Exceeded Items Table */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                  ITEMS EXCEEDING 1% THRESHOLD:
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: '800', textTransform: 'uppercase', fontSize: '10.5px' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item / Component</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Requested Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>1% Allowed Limit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Excess (+%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalModalData.exceededItems.map((exItem, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: '800', color: '#0f172a' }}>{exItem.materialName || exItem.componentType}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{exItem.componentType} {exItem.color ? `• ${exItem.color}` : ''}</div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#dc2626' }}>
                            {exItem.qty} {exItem.unit}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                            {approvalModalData.defaultAutoIssueQty} {exItem.unit}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: '900',
                              color: '#b91c1c',
                              background: '#fee2e2',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}>
                              +{exItem.excess} ({exItem.excessPct}%)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Justification / Note for Admin */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  REASON / JUSTIFICATION FOR ADMIN APPROVAL:
                </label>
                <textarea
                  rows={2}
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Enter reason for requesting more than 1% cutting extra..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              background: '#f8fafc',
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setApprovalModalData(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '7px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ✕ Cancel / Edit Quantities
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAdjustAllTo1Percent}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '7px',
                    border: '1.5px solid #86efac',
                    background: '#f0fdf4',
                    color: '#065f46',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ⚡ Auto-Adjust to 1% ({approvalModalData.defaultAutoIssueQty}) &amp; Issue
                </button>

                {(currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'owner') && (
                  <button
                    type="button"
                    onClick={handleAdminOverrideIssue}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '7px',
                      border: 'none',
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    👑 Admin Direct Override
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmSubmitApproval}
                  disabled={approvalSubmitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: approvalSubmitting ? 'not-allowed' : 'pointer',
                    opacity: approvalSubmitting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  {approvalSubmitting ? 'Submitting...' : '📤 Submit for Admin Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
