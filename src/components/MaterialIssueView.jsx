import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, AlertTriangle, CheckCircle, ArrowRight, Layers, HelpCircle, Printer, Trash2, Plus, RotateCcw, X, PrinterCheck, Shield, Send, ChevronDown, Search, FileText, Eye, Info, CheckCircle2, History, TrendingUp, BarChart3 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function SearchableMaterialSelect({ materials = [], value, onChange, disabled = false, placeholder = "-- Select Material --", hasError = false, brandHint = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320, isAbove: false });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedMaterial = materials.find(m => String(m.id) === String(value));

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

  const filtered = materials
    .filter(m => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const codeStr = String(m.id || '').toLowerCase();
      const nameStr = String(m.name || '').toLowerCase();
      const colorStr = String(m.color || '').toLowerCase();
      const catStr = String(m.category || '').toLowerCase();
      const locStr = String(m.location || '').toLowerCase();
      return codeStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q) || locStr.includes(q);
    })
    .sort((a, b) => {
      // Brand-matched items always float to the top
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
          height: '34px',
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: hasError ? 'var(--danger)' : isOpen ? '#6366f1' : 'var(--border-color)',
          background: disabled ? 'var(--bg-secondary, #f1f5f9)' : 'var(--bg-primary, #ffffff)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
          fontSize: '12px',
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
          gap: '6px'
        }}>
          {selectedMaterial ? (
            <>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: '700',
                fontSize: '11px',
                backgroundColor: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                padding: '1px 5px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.id}
              </span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>
                {selectedMaterial.name}
              </span>
              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  ({selectedMaterial.color})
                </span>
              )}
              {selectedMaterial.stock !== undefined && (
                <span style={{ fontSize: '11px', color: '#334155', fontWeight: '700' }}>
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
                  padding: '1px 5px',
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
        <ChevronDown size={14} style={{ 
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
            <Search size={14} style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b'
            }} />
            <input
              type="text"
              autoFocus
              placeholder="Search MT Code, Name, Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '32px',
                padding: '4px 8px 4px 30px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                background: '#f8fafc',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{
                padding: '6px 10px',
                fontSize: '11.5px',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#64748b',
                fontStyle: 'italic',
                backgroundColor: value === '' ? 'rgba(99,102,241,0.1)' : 'transparent'
              }}
            >
              -- Clear / Select Material --
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: '11.5px', color: '#94a3b8', textAlign: 'center' }}>
                No materials found
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
                  // Show separator between brand matches and others
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
                          padding: '7px 10px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          borderRadius: '5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSelected
                            ? '#6366f1'
                            : isBrand
                            ? 'rgba(16, 185, 129, 0.05)'
                            : 'transparent',
                          color: isSelected ? '#ffffff' : '#0f172a',
                          fontWeight: isSelected ? '700' : '400',
                          transition: 'background-color 0.15s ease',
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
                          if (!isSelected) e.currentTarget.style.backgroundColor = isBrand ? '#f0fdf4' : 'var(--bg-secondary, #f1f5f9)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = isBrand ? 'rgba(16, 185, 129, 0.05)' : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
                            {m.id}
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
                          {m.stock !== undefined && (
                            <span style={{ fontSize: '11.5px', fontWeight: '700', color: isSelected ? '#fff' : Number(m.stock) <= 0 ? '#ef4444' : '#0f172a' }}>
                              {m.stock} {m.unit || 'Pcs'}
                            </span>
                          )}
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
    </div>
  );
}

export default function MaterialIssueView({
  designs = [],
  materials = [],
  vendors = [],
  onIssueMaterials,
  onReturnMaterials,
  issueLogs = [],
  currencySymbol = 'R',
  currentUser = null,
  onSubmitApproval = null,
  onRedirectToZipPO,
  onRedirectToTab
}) {
  const isAdmin = currentUser?.role === 'Admin';
  const approvedDesigns = designs.filter(d => d.status === 'Approved');

  // Form states
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showRgpModal, setShowRgpModal] = useState(false);
  const [rgpVendorId, setRgpVendorId] = useState('');
  const [rgpNotes, setRgpNotes] = useState('Sent for job work/finishing.');
  const [rgpDate, setRgpDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pieces, setPieces] = useState(100);
  const [isLoadingPieces, setIsLoadingPieces] = useState(false);
  const [bomMappings, setBomMappings] = useState([]);

  // Lock refs to prevent re-fetching or resetting form when background polling occurs
  const fetchedLotIdRef = useRef('');
  const mappedLotIdRef = useRef('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [returnError, setReturnError] = useState('');
  const issueMode = 'initial';
  const [personName, setPersonName] = useState(currentUser?.name || '');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDept, setReceiverDept] = useState('Cutting');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [printLog, setPrintLog] = useState(null);
  const [auditTab, setAuditTab] = useState('combined_audit'); // 'combined_audit', 'by_lot', or 'all_logs'
  const [expandedAuditLots, setExpandedAuditLots] = useState({});
  const toggleAuditLotExpand = (lotId) => {
    setExpandedAuditLots(prev => ({ ...prev, [lotId]: !prev[lotId] }));
  };
  const [selectedLotAuditDetail, setSelectedLotAuditDetail] = useState(null);
  const [printLotAudit, setPrintLotAudit] = useState(null);
  const [isSnapshotBreakdownOpen, setIsSnapshotBreakdownOpen] = useState(false);
  // Print Preview (issue confirmation) modal
  const [previewIssue, setPreviewIssue] = useState(null); // { design, pieces, items, isReissue, personName }
  // Print prompt shown AFTER confirming issue
  const [showPrintPrompt, setShowPrintPrompt] = useState(null); // same shape as previewIssue

  // Return Modal states
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isQuickReturn, setIsQuickReturn] = useState(false);
  const [returnLotId, setReturnLotId] = useState('N/A');
  const [returnItems, setReturnItems] = useState([{ materialId: '', bomItemName: '', qty: '' }]);
  const [returnNotes, setReturnNotes] = useState('');

  const handleAddReturnRow = () => {
    setReturnItems([...returnItems, { materialId: '', bomItemName: '', qty: '' }]);
  };

  const handleRemoveReturnRow = (index) => {
    setReturnItems(returnItems.filter((_, idx) => idx !== index));
  };

  const handleReturnItemChange = (index, field, value) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const handleReturnSubmit = (e) => {
    e.preventDefault();
    if (returnItems.some(item => !item.materialId || parseFloat(item.qty) <= 0 || isNaN(parseFloat(item.qty)))) {
      setReturnError('Please select a valid material and ensure all return quantities are positive.');
      return;
    }
    setReturnError('');

    const itemsToSubmit = returnItems.map(item => ({
      materialId: item.materialId,
      bomItemName: item.bomItemName ? item.bomItemName.trim() : 'General Return',
      qty: parseFloat(item.qty)
    }));

    onReturnMaterials(itemsToSubmit, returnNotes.trim(), returnLotId);
    setFormSuccess('Successfully processed returned materials! Inventory stock has been updated.');
    setIsReturnModalOpen(false);
    setReturnLotId('N/A');
    setReturnItems([{ materialId: '', bomItemName: '', qty: '' }]);
    setReturnNotes('');

    // Clear success message after 5 seconds
    setTimeout(() => setFormSuccess(''), 5000);
  };

  // Sync personName when currentUser is loaded
  useEffect(() => {
    if (currentUser?.name && !personName) {
      setPersonName(currentUser.name);
    }
  }, [currentUser]);

  // Filter approved designs by search query
  const filteredDesigns = approvedDesigns.filter(design => {
    const q = searchQuery.toLowerCase();
    const lotIdMatch = String(design.id).toLowerCase().includes(q);
    const brandMatch = (design.brand || '').toLowerCase().includes(q);
    const categoryMatch = (design.category || '').toLowerCase().includes(q);
    return lotIdMatch || brandMatch || categoryMatch;
  });

  // Extract selected design details
  const selectedDesign = designs.find(d => d.id === selectedDesignId);

  // Get issue status of a design lot
  // Returns: 'ready' (no components issued), 'in_process' (some components issued), 'completed' (all components issued)
  const getLotIssueStatus = (design) => {
    if (!design || !design.bom) return 'ready';

    // 1. Get required BOM components
    const requiredNames = design.bom
      .filter(item => String(item.status).toLowerCase() === 'yes')
      .map(item => item.name);

    if (requiredNames.length === 0) return 'completed';

    // 2. Find all non-reissue logs for this lot
    const logs = issueLogs.filter(log => String(log.lotId) === String(design.id) && !log.isReissue);

    // 3. Extract all issued BOM component names from logs
    const issuedNames = new Set();
    logs.forEach(log => {
      if (log.materials) {
        log.materials.forEach(m => {
          if (m.bomItemName) {
            issuedNames.add(m.bomItemName);
          } else {
            // Fallback lookup
            const matchedBom = design.bom.find(b => {
              const bName = (b.name || '').toLowerCase();
              const bDetail = (b.detail || '').toLowerCase();
              const mName = (m.name || '').toLowerCase();
              return bName.includes(mName) || mName.includes(bName) ||
                bDetail.includes(mName) || mName.includes(bDetail);
            });
            if (matchedBom) {
              issuedNames.add(matchedBom.name);
            }
          }
        });
      }
    });

    // 4. Calculate status
    let issuedCount = 0;
    requiredNames.forEach(name => {
      if (issuedNames.has(name)) {
        issuedCount++;
      }
    });

    if (issuedCount === 0) {
      return 'ready';
    } else if (issuedCount >= requiredNames.length) {
      return 'completed';
    } else {
      return 'in_process';
    }
  };

  // In 'initial' mode, block if the lot has already issued all required components
  const isSelectedDesignAlreadyIssued = selectedDesignId && issueMode === 'initial'
    ? getLotIssueStatus(selectedDesign) === 'completed'
    : false;

  // Fetch total pieces cut from database for the selected lot and prefill pieces (ONE TIME PER LOT SELECTION)
  useEffect(() => {
    if (!selectedDesignId) {
      fetchedLotIdRef.current = '';
      setIsLoadingPieces(false);
      return;
    }

    // Only fetch once per selected lot ID
    if (fetchedLotIdRef.current === selectedDesignId) {
      return;
    }

    const fetchTotalPieces = async () => {
      setIsLoadingPieces(true);
      fetchedLotIdRef.current = selectedDesignId;
      let finalPieces = selectedDesign?.quantity || 100;
      try {
        const response = await fetch(`${getBackendUrl()}/api/cutting/${selectedDesignId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.rows && data.rows.length > 0) {
            const totalPcs = data.rows.reduce((sum, row) => sum + (row.totalPcs || 0), 0);
            if (totalPcs > 0) {
              finalPieces = totalPcs;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch total pieces from local API, falling back:', err.message);
      } finally {
        setPieces(finalPieces);
        setIsLoadingPieces(false);
      }
    };

    fetchTotalPieces();
  }, [selectedDesignId]);

  // Auto-generate mappings when design is selected or issueMode changes (ONE TIME PER LOT / MODE SELECTION)
  useEffect(() => {
    if (!selectedDesign || !selectedDesign.bom) {
      mappedLotIdRef.current = '';
      setBomMappings([]);
      return;
    }

    const mappingKey = `${selectedDesignId}_${issueMode}`;
    if (mappedLotIdRef.current === mappingKey) {
      return;
    }
    mappedLotIdRef.current = mappingKey;

    // Extract issued components for this lot (only for initial mode)
    const logs = issueLogs.filter(log => String(log.lotId) === String(selectedDesign.id) && !log.isReissue);
    const issuedNames = new Set();
    logs.forEach(log => {
      if (log.materials) {
        log.materials.forEach(m => {
          if (m.bomItemName) {
            issuedNames.add(m.bomItemName);
          } else {
            const matchedBom = selectedDesign.bom.find(b => {
              const bName = (b.name || '').toLowerCase();
              const bDetail = (b.detail || '').toLowerCase();
              const mName = (m.name || '').toLowerCase();
              return bName.includes(mName) || mName.includes(bName) ||
                bDetail.includes(mName) || mName.includes(bDetail);
            });
            if (matchedBom) {
              issuedNames.add(matchedBom.name);
            }
          }
        });
      }
    });

    // Filter BOM items where status is 'Yes' (required)
    const requiredBom = selectedDesign.bom.filter(item => String(item.status).toLowerCase() === 'yes');

    // Extract brand keywords from the selected design for brand-aware scoring
    const lotBrandRaw = (selectedDesign.brand || '').toLowerCase().trim();
    const lotBrandWords = lotBrandRaw.split(/\s+/).filter(w => w.length > 2);

    const initialMappings = requiredBom.map(bomItem => {
      // Find matching raw material automatically by comparing descriptions
      const detailLower = (bomItem.detail || '').toLowerCase();
      const nameLower = (bomItem.name || '').toLowerCase();

      // Determine description: use description field, or if empty, check if detail is a text string (not numeric)
      const descLower = (bomItem.description || '').trim().toLowerCase() ||
        (!/^\d+(\.\d+)?$/.test(detailLower.trim()) ? detailLower.trim() : '');

      // Load stored materialId from database, or fallback to auto-mapping score
      let matchedMaterialId = bomItem.materialId || "";

      if (!matchedMaterialId) {
        // Intelligently score each inventory material to find the best match
        let bestMaterial = null;
        let highestScore = 0;

        materials.forEach(m => {
          const mName = m.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
          const mCategory = (m.category || '').toLowerCase();
          const bName = nameLower.replace(/[^a-z0-9\s]/g, '');
          const bDesc = descLower.replace(/[^a-z0-9\s]/g, '');

          let score = 0;

          // ─── BRAND-AWARE SCORING (highest priority) ───────────────────────
          // If the lot has a brand (e.g. ADIDAS) and the material name contains
          // that brand keyword, give a massive bonus so brand-specific materials
          // always win over generic ones for their matching BOM component type.
          if (lotBrandWords.length > 0) {
            const brandMatchInMaterial = lotBrandWords.some(word =>
              mName.includes(word) || mCategory.includes(word)
            );
            if (brandMatchInMaterial) {
              // Also verify the material is relevant to this BOM component type
              // (e.g., don't map a "zip" brand item to a "button" BOM row)
              const componentTypeWords = bName.split(/\s+/).filter(Boolean);
              const isMaterialRelevantToComponent = componentTypeWords.length === 0 ||
                componentTypeWords.some(cw => mName.includes(cw) || cw.length <= 2) ||
                bName.length === 0;
              if (isMaterialRelevantToComponent || componentTypeWords.every(cw => cw.length <= 2)) {
                score += 200; // Strong brand-match bonus
              } else {
                score += 30; // Mild brand affinity bonus even if component type differs
              }
            }
          }

          // ─── DESCRIPTION MATCH SCORING ────────────────────────────────────
          if (bDesc) {
            // Clean alphanumeric matches (ignoring spaces/special chars entirely)
            const cleanStr = str => str.replace(/\s+/g, '');
            const mClean = cleanStr(mName);
            const bDescClean = cleanStr(bDesc);

            if (mClean && bDescClean) {
              if (mClean === bDescClean) {
                score += 100; // Perfect match on description
              } else if (mClean.includes(bDescClean) || bDescClean.includes(mClean)) {
                score += 80;
              }
            }

            // Word-by-word overlap match for description
            const mWords = mName.split(/\s+/).filter(Boolean);
            const bDescWords = bDesc.split(/\s+/).filter(Boolean);
            if (mWords.length > 0 && bDescWords.length > 0) {
              let matchedDescWords = 0;
              bDescWords.forEach(w => {
                if (mName.includes(w)) {
                  matchedDescWords++;
                }
              });
              if (matchedDescWords > 0) {
                score += (matchedDescWords / bDescWords.length) * 50;
              }
            }
          }

          // ─── BOM COMPONENT NAME MATCH ─────────────────────────────────────
          // Base matching on standard BOM item category/name (e.g. "button" or "zip")
          if (bName && mName.includes(bName)) {
            score += 10;
          }

          if (score > highestScore) {
            highestScore = score;
            bestMaterial = m;
          }
        });

        // Set mapped material if score is significant (>= 15 for desc match, or brand bonus >= 30)
        if (highestScore >= 15 && bestMaterial) {
          matchedMaterialId = bestMaterial.id;
        }
      }

      // Establish default usage rates based on accessory categories
      let defaultRate = 1.0;
      const parsedRate = parseInt(bomItem.detail, 10);
      if (!isNaN(parsedRate) && parsedRate >= 0) {
        defaultRate = parsedRate;
      } else {
        if (nameLower.includes('button') || detailLower.includes('button')) {
          defaultRate = 6.0;
        } else if (nameLower.includes('fabric') || detailLower.includes('fabric') || nameLower.includes('denim') || detailLower.includes('denim') || nameLower.includes('pocket') || detailLower.includes('pocket')) {
          defaultRate = 1.5;
        } else if (nameLower.includes('lace') || nameLower.includes('elastic') || nameLower.includes('rib')) {
          defaultRate = 0.5;
        }
      }

      const wasAlreadyIssued = issueMode === 'initial' && issuedNames.has(bomItem.name);

      return {
        bomItemName: bomItem.name,
        bomItemDetail: bomItem.description || 'Required',
        materialId: matchedMaterialId,
        ratePerPiece: defaultRate,
        issued: !wasAlreadyIssued,
        alreadyIssued: wasAlreadyIssued
      };
    });

    setBomMappings(initialMappings);
    setFormError('');
    setFormSuccess('');
  }, [selectedDesignId, issueMode, selectedDesign]);

  const handleMappingChange = (index, field, value) => {
    const updated = [...bomMappings];
    if (field === 'ratePerPiece') {
      const parsed = parseFloat(value);
      updated[index][field] = isNaN(parsed) ? 0 : Math.max(0, parsed);
    } else if (field === 'totalRequired') {
      const parsed = parseFloat(value);
      const currentPieces = Math.max(1, pieces);
      updated[index]['ratePerPiece'] = isNaN(parsed) ? 0 : Math.max(0, parsed / currentPieces);
    } else if (field === 'issued') {
      updated[index][field] = !!value;
    } else {
      updated[index][field] = value;
    }
    setBomMappings(updated);
    setFormError('');
  };

  // Perform stock validation check
  const getValidationDetails = () => {
    let hasShortage = false;
    const computedItems = bomMappings.map(mapping => {
      const material = materials.find(m => m.id === mapping.materialId);
      const totalRequired = Math.round(pieces * mapping.ratePerPiece * 100) / 100;
      const currentStock = material ? material.stock : 0;
      const isShortage = totalRequired > currentStock;

      if (isShortage && mapping.issued) {
        hasShortage = true;
      }

      return {
        ...mapping,
        materialName: material ? (material.color && material.color !== 'Default' ? `${material.name} (${material.color})` : material.name) : 'Unknown Material',
        unit: material ? material.unit : 'pcs',
        currentStock,
        totalRequired,
        isShortage
      };
    });

    return { computedItems, hasShortage };
  };

  const { computedItems, hasShortage } = getValidationDetails();

  const shortageItems = computedItems.filter(item => item.issued && (item.currentStock - item.totalRequired < 0)).map(item => {
    const shortageQty = Math.abs(item.currentStock - item.totalRequired);
    return {
      name: item.bomItemName,
      qty: Math.round(shortageQty * 100) / 100,
      unit: item.unit
    };
  });

  const handlePrintRgp = () => {
    const doc = new jsPDF();
    const vendor = vendors.find(v => v.id === rgpVendorId) || { name: 'Walk-in Vendor', email: 'N/A', address: 'N/A' };
    const gpNumber = `GP-${Math.floor(100000 + Math.random() * 900000)}`;

    // Top Brand Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55); // #1f2937
    doc.text('MH ACCESSORIES & BOM', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // #6b7280
    doc.text('Premium Garment Production Management System', 14, 25);

    // Document Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241); // #6366f1
    doc.text('RETURNABLE GATE PASS (RGP)', 14, 40);

    // Divider Line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 45, 196, 45);

    // Metadata Block
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);

    doc.text(`Gate Pass No: ${gpNumber}`, 14, 55);
    doc.text(`Date Issued: ${rgpDate}`, 14, 66);
    doc.text(`Issuer: ${personName || currentUser?.name || 'System'}`, 14, 77);

    doc.text('Sent To Vendor/Receiver:', 120, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(vendor.name, 120, 66);
    doc.setFont('helvetica', 'normal');
    doc.text(`Email: ${vendor.email || 'N/A'}`, 120, 77);
    doc.text(`Address: ${vendor.address || 'N/A'}`, 120, 88);

    // Notes
    doc.text(`Purpose/Notes: ${rgpNotes}`, 14, 105);

    // Table of Items
    const tableColumns = ['S.No', 'Item Description', 'Quantity Requested', 'Unit'];
    const tableRows = shortageItems.map((item, idx) => [
      idx + 1,
      item.name,
      item.qty.toLocaleString(),
      item.unit
    ]);

    autoTable(doc, {
      startY: 115,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], halign: 'center' },
      columnStyles: {
        0: { width: 15, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' }
      }
    });

    // Signature Area
    const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 160) + 40;
    doc.setFont('helvetica', 'normal');
    doc.line(14, finalY, 74, finalY);
    doc.text('Authorized Signatory (Issuer)', 14, finalY + 5);

    doc.line(136, finalY, 196, finalY);
    doc.text('Receiver Signature (Vendor)', 136, finalY + 5);

    // Save PDF
    doc.save(`RGP_${gpNumber}_${rgpDate}.pdf`);
    setFormSuccess('RGP PDF generated and downloaded successfully!');
    setShowRgpModal(false);
    setTimeout(() => setFormSuccess(''), 5000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDesignId) {
      setFormError('Please select a valid approved lot number.');
      return;
    }
    if (isSelectedDesignAlreadyIssued) {
      setFormError(`Materials for Lot ${selectedDesignId} have already been issued. Re-issuing is not permitted.`);
      return;
    }
    if (pieces <= 0) {
      setFormError('Manufacturing quantity must be greater than zero.');
      return;
    }
    if (bomMappings.length === 0) {
      setFormError('The selected design lot does not contain any required accessories in its BOM.');
      return;
    }
    if (hasShortage) {
      setFormError('Insufficient inventory stock! Please procure missing materials before issuing.');
      return;
    }

    const itemsToIssue = computedItems.filter(item => item.issued);
    if (itemsToIssue.length === 0) {
      setFormError('Please select at least one component to issue.');
      return;
    }
    const unmappedItem = itemsToIssue.find(item => !item.materialId);
    if (unmappedItem) {
      setFormError(`Please select a valid inventory material mapping for BOM Component: "${unmappedItem.bomItemName}".`);
      return;
    }
    if (!personName || !personName.trim()) {
      setFormError('Please enter the name of the person issuing the materials (Issuer).');
      return;
    }
    if (!receiverName || !receiverName.trim()) {
      setFormError('Please enter the received name / person receiving the materials.');
      return;
    }

    // For admin: show print preview modal before confirming issue
    // For normal users: submit for approval instead
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const issuePayload = {
      design: selectedDesign,
      pieces,
      items: itemsToIssue,
      isReissue: false,
      personName: personName.trim(),
      receiverName: receiverName.trim(),
      receiverDept: receiverDept.trim() || 'Cutting',
      date: dateStr
    };

    setPreviewIssue(issuePayload);
  };

  const handleConfirmIssue = () => {
    if (!previewIssue) return;
    const { design, pieces: p, items, isReissue, personName: pName, receiverName: rName, receiverDept: rDept, date } = previewIssue;

    // Perform actual issue
    onIssueMaterials(design.id, p, items, isReissue, pName, rName, rDept);

    setFormSuccess(`Successfully issued materials for Lot ${design.id} production batch of ${p} units!`);

    // Save issue data for the print prompt, close preview
    setShowPrintPrompt({ design, pieces: p, items, isReissue, personName: pName, receiverName: rName, receiverDept: rDept, date });
    setPreviewIssue(null);
    setSelectedDesignId('');
    setSearchQuery('');
    setPieces(100);
    setBomMappings([]);
    setPersonName(currentUser?.name || '');
    setReceiverName('');
    setReceiverDept('Cutting');

    // Clear success message after 5 seconds
    setTimeout(() => setFormSuccess(''), 5000);
  };

  const handlePrintPreview = () => {
    document.body.classList.add('print-issue-preview-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-issue-preview-mode');
    }, 100);
  };

  // Group issue logs by Lot Number for complete audit and pieces verification
  const lotAuditSummary = useMemo(() => {
    const map = {};

    issueLogs.forEach(log => {
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
          materialsSummary: {} // { [key]: { bomItemName, materialName, unit, initialQty, reissueQty, returnedQty, totalIssuedQty } }
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

  // Selected Lot Audit summary for form display
  const selectedLotAudit = useMemo(() => {
    if (!selectedDesignId) return null;
    return lotAuditSummary.find(l => String(l.lotId) === String(selectedDesignId)) || null;
  }, [selectedDesignId, lotAuditSummary]);

  // Filtered lot audit summary for report view
  const filteredLotAudits = useMemo(() => {
    const q = logSearchQuery.toLowerCase().trim();
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
  }, [lotAuditSummary, logSearchQuery]);

  const filteredLogs = issueLogs.filter(log => {
    const q = logSearchQuery.toLowerCase();
    const idMatch = String(log.id).toLowerCase().includes(q);
    const lotMatch = `lot ${log.lotId}`.toLowerCase().includes(q) || String(log.lotId).toLowerCase().includes(q);
    const categoryMatch = String(log.category).toLowerCase().includes(q);
    const personMatch = String(log.personName || '').toLowerCase().includes(q);
    const dateMatch = String(log.date).toLowerCase().includes(q);
    const materialMatch = log.materials && log.materials.some(m => String(m.name).toLowerCase().includes(q));
    return idMatch || lotMatch || categoryMatch || personMatch || dateMatch || materialMatch;
  });

  const handlePrintAllLogs = () => {
    document.body.classList.add('print-issue-logs-mode');
    window.print();
  };

  const handlePrintSingleLog = (log) => {
    setPrintLog(log);
    document.body.classList.add('print-single-issue-slip-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-single-issue-slip-mode');
      setPrintLog(null);
    }, 100);
  };

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

  const handlePrintLotAudit = (lotAudit) => {
    setPrintLotAudit(lotAudit);
  };

  return (
    <div className="animate-fade" style={{ paddingBottom: '60px' }}>
      <div style={{ height: '8px' }} />


      {formSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px',
          backgroundColor: 'var(--success-light)',
          color: 'var(--success)',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          marginBottom: '24px',
          fontWeight: '600'
        }}>
          <CheckCircle size={20} />
          <span>{formSuccess}</span>
        </div>
      )}

      <div className="split-view split-view-asymmetric">
        {/* Left Side: Manufacturing Batch Selector */}
        <div className="panel" style={{ height: 'fit-content' }}>
          <div className="panel-header">
            <h3 className="panel-title">
              <ClipboardList size={18} className="text-accent" />
              Start Production Batch
            </h3>
          </div>

          <form onSubmit={handleSubmit}>
            {formError && (
              <div style={{
                color: 'var(--danger)',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* Setup Inputs Stack */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '20px'
            }}>
              {/* Search & Select Approved Lot */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Search & Select Approved Lot</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Type Lot ID, Brand, or Category to filter & select..."
                    value={
                      isFocused
                        ? searchQuery
                        : (selectedDesign
                          ? `Lot ${selectedDesign.id} — ${selectedDesign.brand || 'No Brand'} (${selectedDesign.category})`
                          : ''
                        )
                    }
                    onFocus={() => {
                      setIsFocused(true);
                      setIsOpen(true);
                      setSearchQuery('');
                    }}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingRight: '32px' }}
                  />

                  {/* Custom dropdown caret indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '10px',
                      pointerEvents: 'none'
                    }}
                  >
                    ▼
                  </div>

                  {isOpen && (
                    <>
                      {/* Transparent Click-Outside Overlay */}
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 40,
                          background: 'transparent'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          setIsFocused(false);
                        }}
                      />

                      {/* Scrollable floating dropdown menu list */}
                      <div className="custom-dropdown-menu">
                        {filteredDesigns.length === 0 ? (
                          <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                            No matching lots found
                          </div>
                        ) : (
                          filteredDesigns.map(design => {
                            const lotStatus = getLotIssueStatus(design);
                            const isSelectionDisabled = lotStatus === 'completed';
                            const isSelected = String(design.id) === String(selectedDesignId);

                            return (
                              <div
                                key={design.id}
                                onClick={() => {
                                  if (!isSelectionDisabled) {
                                    setSelectedDesignId(design.id);
                                    setIsOpen(false);
                                    setIsFocused(false);
                                    setSearchQuery('');
                                  }
                                }}
                                style={{
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                  cursor: isSelectionDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isSelectionDisabled ? 0.5 : 1,
                                  backgroundColor: isSelected
                                    ? 'var(--accent-color)'
                                    : 'transparent',
                                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  borderBottom: '1px solid var(--border-color)',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelectionDisabled && !isSelected) {
                                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelectionDisabled && !isSelected) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                              >
                                <div>
                                  <strong>Lot {design.id}</strong>
                                  <span style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.8 }}>
                                    ({design.category}) &mdash; {design.brand || 'No Brand'}
                                  </span>
                                </div>
                                <>
                                  {lotStatus === 'completed' && (
                                    <span className="status-badge rejected" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                      Already Issued
                                    </span>
                                  )}
                                  {lotStatus === 'in_process' && (
                                    <span className="status-badge pending" style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
                                      In Process
                                    </span>
                                  )}
                                  {lotStatus === 'ready' && (
                                    <span className="status-badge verified" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                      Ready
                                    </span>
                                  )}
                                </>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Garment Pieces to Manufacture */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Garment Pieces to Manufacture</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  placeholder={isLoadingPieces ? "Fetching..." : "e.g. 500"}
                  value={isLoadingPieces ? "" : pieces}
                  onChange={(e) => setPieces(Math.max(1, Number(e.target.value)))}
                  disabled={isSelectedDesignAlreadyIssued || isLoadingPieces}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  {isLoadingPieces
                    ? "Retrieving pieces count from cutting logs..."
                    : "Scales required BOM quantities automatically."
                  }
                </span>
              </div>

              {/* Person Name (Issuer) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Person Name (Issuer)</span>
                  <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  disabled={isSelectedDesignAlreadyIssued}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Records the name of the person issuing the raw materials.
                </span>
              </div>

              {/* Received Name (Receiver Person) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Received Name (Receiver Person)</span>
                  <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Masterji / Tailor / Line Incharge"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  disabled={isSelectedDesignAlreadyIssued}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Records the name of the person receiving the materials.
                </span>
              </div>

              {/* Receiver Department / Line */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Receiver Department / Line</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cutting / Stitching / Line 1"
                  value={receiverDept}
                  onChange={(e) => setReceiverDept(e.target.value)}
                  disabled={isSelectedDesignAlreadyIssued}
                />
              </div>
            </div>



            {/* Warning alerts placed cleanly below inputs */}
            {isSelectedDesignAlreadyIssued && (
              <div style={{
                color: 'var(--danger)',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: 'var(--danger-light)',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <AlertTriangle size={16} />
                <span>Materials already issued for Lot {selectedDesignId}. First-time issue is completed. For additional materials, please use the &quot;Extra Material Issue&quot; tab.</span>
              </div>
            )}

            {selectedDesign && bomMappings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'center', gap: '8px',
                    padding: '12px 20px', fontWeight: '700', fontSize: '14px',
                    borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', border: 'none',
                    backgroundColor: 'var(--accent-color)',
                    color: '#fff', transition: 'opacity 0.2s',
                    opacity: (hasShortage || isSelectedDesignAlreadyIssued) ? 0.5 : 1
                  }}
                  disabled={hasShortage || isSelectedDesignAlreadyIssued}
                  onMouseEnter={e => { if (!hasShortage && !isSelectedDesignAlreadyIssued) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => e.currentTarget.style.opacity = (hasShortage || isSelectedDesignAlreadyIssued) ? '0.5' : '1'}
                >
                  <Layers size={16} />
                  <span>Issue Materials for Batch</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Side: Materials Calculation Checklist */}
        <div className="panel" style={{ minHeight: '320px', minWidth: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <h3 className="panel-title">
              <Layers size={18} className="text-accent" />
              Calculated Material Requirements
            </h3>
          </div>

          {!selectedDesign ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)', textAlign: 'center' }}>
              <HelpCircle size={48} strokeWidth={1} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Select an approved design lot on the left to analyze production material needs.</p>
            </div>
          ) : isLoadingPieces ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)', textAlign: 'center' }}>
              <div className="spinner-loader" style={{
                border: '4px solid rgba(0, 0, 0, 0.1)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                borderLeftColor: 'var(--accent-color)',
                animation: 'spin 1.2s linear infinite',
                marginBottom: '16px'
              }} />
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Analyzing production specifications & cutting reports...</p>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span><strong>Garment Item:</strong> {selectedDesign.category}</span>
                  <span><strong>Primary Fabric:</strong> {selectedDesign.fabricType}</span>
                </div>
              </div>



              {/* Informative Tip Box explaining calculations */}
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: 'var(--accent-light)',
                borderRadius: '8px',
                borderLeft: '4px solid var(--accent-color)',
                fontSize: '12px',
                lineHeight: '1.5',
                color: 'var(--text-main)'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <HelpCircle size={16} style={{ color: 'var(--accent-color)', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong>Calculation Guide:</strong>
                    <ul style={{ margin: '4px 0 0 16px', paddingLeft: '0' }}>
                      <li><strong>Total Needed</strong> = Garment Pieces &times; Qty/Piece. Feel free to edit either field; the other will recalculate automatically!</li>
                      <li><strong>Current Stock</strong> is the available raw material stock in your catalog.</li>
                      <li><strong>After Issue</strong> is your remaining inventory balance (<code>Current Stock &minus; Total Needed</code>). If it is negative, a shortage is flagged in red.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="custom-table-container" style={{ overflowX: 'auto', minHeight: '320px', width: '100%', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '780px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '36px', textAlign: 'center', padding: '10px 8px' }}>
                        <input
                          type="checkbox"
                          checked={computedItems.length > 0 && computedItems.filter(item => !item.alreadyIssued).every(item => item.issued)}
                          onChange={(e) => {
                            const allChecked = e.target.checked;
                            const updated = bomMappings.map(m => {
                              if (m.alreadyIssued) return m;
                              return { ...m, issued: allChecked };
                            });
                            setBomMappings(updated);
                          }}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          title="Select / Deselect All Components"
                        />
                      </th>
                      <th style={{ width: '140px', padding: '10px 8px' }}>BOM Component</th>
                      <th style={{ minWidth: '220px', maxWidth: '280px', padding: '10px 8px' }}>Inventory Item Map</th>

                      <th style={{ minWidth: '100px', padding: '10px 8px' }}>Description</th>
                      <th style={{ textAlign: 'center', width: '110px', padding: '10px 8px' }}>Total Needed</th>
                      <th style={{ textAlign: 'center', width: '95px', padding: '10px 8px' }}>Current Stock</th>
                      <th style={{ textAlign: 'center', width: '110px', padding: '10px 8px' }}>After Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedItems.map((item, idx) => {
                      const afterIssue = item.issued
                        ? Math.round((item.currentStock - item.totalRequired) * 100) / 100
                        : item.currentStock;
                      const isShortage = item.issued && afterIssue < 0;

                      return (
                        <tr key={idx} style={{
                          opacity: item.issued && !item.alreadyIssued ? 1 : 0.6,
                          backgroundColor: (item.issued && !item.alreadyIssued) ? 'transparent' : 'var(--bg-primary)',
                          transition: 'opacity 0.2s, background-color 0.2s',
                          color: item.alreadyIssued ? 'var(--text-muted)' : 'inherit'
                        }}>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            <input
                              type="checkbox"
                              checked={!!item.issued}
                              onChange={(e) => handleMappingChange(idx, 'issued', e.target.checked)}
                              disabled={item.alreadyIssued}
                              style={{ cursor: item.alreadyIssued ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{
                                textDecoration: (item.alreadyIssued || !item.issued) ? 'line-through' : 'none',
                                color: (item.alreadyIssued || !item.issued) ? 'var(--text-muted)' : 'inherit'
                              }}>
                                {item.bomItemName}
                              </strong>
                              {item.alreadyIssued && (
                                <div style={{ marginTop: '2px' }}>
                                  <span className="status-badge verified" style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: 'var(--success-light)', color: 'var(--success)', display: 'inline-block' }}>
                                    Issued
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <SearchableMaterialSelect
                              materials={materials}
                              value={item.materialId}
                              onChange={(val) => handleMappingChange(idx, 'materialId', val)}
                              disabled={!item.issued || item.alreadyIssued}
                              hasError={!item.materialId && item.issued && !item.alreadyIssued}
                              brandHint={selectedDesign?.brand || ''}
                            />
                          </td>

                          <td style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px 8px' }}>
                            {item.bomItemDetail || '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="form-input"
                                style={{ height: '30px', width: '75px', padding: '4px', textAlign: 'center', display: 'inline-block', fontSize: '12px', fontWeight: 'bold' }}
                                value={item.totalRequired}
                                onChange={(e) => handleMappingChange(idx, 'totalRequired', e.target.value)}
                                disabled={!item.issued || item.alreadyIssued}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.unit}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '500', color: (item.issued && !item.alreadyIssued) ? 'inherit' : 'var(--text-muted)', padding: '10px 8px' }}>
                            {item.currentStock} {item.unit}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            {item.alreadyIssued ? (
                              <span className="status-badge verified" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', fontWeight: 'bold' }}>
                                Already Issued
                              </span>
                            ) : item.issued ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                                <span
                                  className={`status-badge ${isShortage ? 'rejected' : 'verified'}`}
                                  style={{
                                    display: 'inline-flex',
                                    gap: '4px',
                                    alignItems: 'center',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {isShortage
                                    ? `${afterIssue} ${item.unit} (Short)`
                                    : `${afterIssue} ${item.unit}`
                                  }
                                </span>
                              </div>
                            ) : (
                              <span className="status-badge" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                                Skipped
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>


            </div>
          )}
        </div>
      </div>

      {/* Toggle button for Material Issue Logs Section */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowLogs(!showLogs)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontWeight: '600',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <ClipboardList size={18} />
          <span>{showLogs ? 'Hide Material Issue Logs' : 'Show Material Issue Logs (Audit Trail)'}</span>
        </button>
      </div>

      {showLogs && (
        <div className="panel issue-logs-panel animate-scale" style={{ marginTop: '24px' }}>
          {/* Header & Tabs */}
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={20} className="text-accent" />
                <span>Material Issue &amp; Re-issue Audit Reports</span>
              </h3>

              {/* View mode toggle tabs */}
              <div style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg-secondary)',
                padding: '3px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                marginLeft: '8px'
              }}>
                <button
                  type="button"
                  onClick={() => setAuditTab('combined_audit')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: auditTab === 'combined_audit' ? 'var(--accent-color)' : 'transparent',
                    color: auditTab === 'combined_audit' ? '#ffffff' : 'var(--text-main)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Layers size={13} />
                  <span>Combined Audit (1st Time & Extra)</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    backgroundColor: auditTab === 'combined_audit' ? 'rgba(255,255,255,0.25)' : 'var(--bg-primary)',
                    color: auditTab === 'combined_audit' ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {lotAuditSummary.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTab('by_lot')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: auditTab === 'by_lot' ? 'var(--accent-color)' : 'transparent',
                    color: auditTab === 'by_lot' ? '#ffffff' : 'var(--text-main)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BarChart3 size={13} />
                  <span>By-Lot Summary</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    backgroundColor: auditTab === 'by_lot' ? 'rgba(255,255,255,0.25)' : 'var(--bg-primary)',
                    color: auditTab === 'by_lot' ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {lotAuditSummary.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTab('all_logs')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: auditTab === 'all_logs' ? 'var(--accent-color)' : 'transparent',
                    color: auditTab === 'all_logs' ? '#ffffff' : 'var(--text-main)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <History size={13} />
                  <span>All Transaction Slips</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    backgroundColor: auditTab === 'all_logs' ? 'rgba(255,255,255,0.25)' : 'var(--bg-primary)',
                    color: auditTab === 'all_logs' ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {issueLogs.length}
                  </span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {auditTab === 'combined_audit' && (
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
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 10px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}
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
              )}
              <div style={{ position: 'relative', width: '230px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ height: '32px', fontSize: '13px', paddingLeft: '12px' }}
                  placeholder={auditTab === 'all_logs' ? "🔍 Search logs..." : "🔍 Search lot, garment, material..."}
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                />
              </div>
              {auditTab === 'all_logs' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrintAllLogs}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px' }}
                  title="Print Overall Filtered Transaction Logs"
                  disabled={filteredLogs.length === 0}
                >
                  <Printer size={14} />
                  <span>Print Logs</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: Combined Audit Report (1st Time vs Extra Material Issue Matrix) */}
          {auditTab === 'combined_audit' && (
            <div>
              {/* Aggregate KPI Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Lots with Material Audit</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                    {lotAuditSummary.length} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>Production Lots</span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(37, 99, 235, 0.08)', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700', textTransform: 'uppercase' }}>1st Time Issue Volume</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#1d4ed8', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.initialPieces, 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>pieces</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.initialLogs.length, 0)} initial voucher slips
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase' }}>Extra Material Volume</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#b91c1c', marginTop: '2px' }}>
                    +{lotAuditSummary.reduce((sum, l) => sum + l.reissuePieces, 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>pieces</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.reissueLogs.length, 0)} extra requisition slips
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: '700', textTransform: 'uppercase' }}>Total Combined Dispatched</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-color)', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.totalPieces, 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>total pieces</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Cumulative verified production
                  </div>
                </div>
              </div>

              {/* Combined Matrix Lot Cards List */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredLotAudits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    {lotAuditSummary.length === 0 ? 'No material transactions recorded yet.' : 'No matching audit records found.'}
                  </div>
                ) : (
                  filteredLotAudits.map((lotAudit) => {
                    const materialsList = Object.values(lotAudit.materialsSummary || {});
                    const hasReissues = lotAudit.reissuePieces > 0 || lotAudit.reissueLogs.length > 0;
                    const isExpanded = !!expandedAuditLots[lotAudit.lotId]; // Default collapsed: only show full detail when user clicks Expand

                    return (
                      <div
                        key={lotAudit.lotId}
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-xs)',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Lot Header Bar */}
                        <div style={{
                          padding: '12px 16px',
                          backgroundColor: 'var(--bg-secondary)',
                          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                                {lotAudit.lotId && lotAudit.lotId !== 'N/A' ? `Lot ${lotAudit.lotId}` : 'General / No Lot'}
                              </strong>
                              {lotAudit.design?.lotNo2 && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', fontWeight: '700' }}>
                                  {lotAudit.design.lotNo2}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                              • {lotAudit.category} {lotAudit.brand && lotAudit.brand !== '—' && `(${lotAudit.brand})`}
                            </span>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', fontWeight: '700' }}>
                              {materialsList.length} BOM Components
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {/* Comparison Pills */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11.5px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#1d4ed8', fontWeight: '700' }}>
                                1st Time: {lotAudit.initialPieces.toLocaleString()} pcs
                              </span>
                              <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: hasReissues ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-primary)', color: hasReissues ? '#dc2626' : 'var(--text-muted)', fontWeight: '700' }}>
                                Extra: {hasReissues ? `+${lotAudit.reissuePieces.toLocaleString()} pcs` : '0 pcs'}
                              </span>
                              <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#4f46e5', fontWeight: '800' }}>
                                Combined: {lotAudit.totalPieces.toLocaleString()} pcs
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => toggleAuditLotExpand(lotAudit.lotId)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                            >
                              <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setSelectedLotAuditDetail(lotAudit)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              title="Open Full Audit Trail Modal"
                            >
                              <Eye size={12} />
                              <span>Slips & Details</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => handlePrintLotAudit(lotAudit)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              title="Print Formal Audit Slip"
                            >
                              <Printer size={12} />
                              <span>Print Audit</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleDownloadLotAuditPdf(lotAudit)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
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
                                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
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
                                        <tr key={lIdx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: lIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
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
                                              onClick={() => handlePrintSingleLog(rLog)}
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
                                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
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
                                          No material details recorded for this lot.
                                        </td>
                                      </tr>
                                    ) : (
                                      materialsList.map((m, mIdx) => {
                                        const variancePercent = m.initialQty > 0 ? ((m.reissueQty / m.initialQty) * 100).toFixed(1) : (m.reissueQty > 0 ? '100.0' : '0.0');
                                        const hasExtra = m.reissueQty > 0;

                                        return (
                                          <tr key={mIdx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}>
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
          )}

          {/* TAB 1: By-Lot Audit Report */}
          {auditTab === 'by_lot' && (
            <div>
              {/* Aggregate KPI Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Lots Audited</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                    {lotAuditSummary.length} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>Production Lots</span>
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Initial Issues Volume</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.initialPieces, 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>pieces</span>
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Re-issue Volume (Wastage)</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--warning)', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.reissuePieces, 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>pieces</span>
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: '700', textTransform: 'uppercase' }}>Total Pieces Audited</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-color)', marginTop: '2px' }}>
                    {lotAuditSummary.reduce((sum, l) => sum + l.totalPieces, 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>total pieces</span>
                  </div>
                </div>
              </div>

              {/* By-Lot Audit Table */}
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Lot Number</th>
                      <th>Garment Category &amp; Brand</th>
                      <th style={{ textAlign: 'center' }}>Initial Issue (Pcs)</th>
                      <th style={{ textAlign: 'center' }}>Re-issue (Pcs)</th>
                      <th style={{ textAlign: 'center', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>Total Pieces Issued</th>
                      <th>Audit Trail History</th>
                      <th className="print-hide" style={{ textAlign: 'center', minWidth: '160px' }}>Audit Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLotAudits.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                          {lotAuditSummary.length === 0
                            ? 'No material issue transactions recorded yet.'
                            : 'No matching lot audit records found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredLotAudits.map((lotAudit) => {
                        const hasReissues = lotAudit.reissuePieces > 0 || lotAudit.reissueLogs.length > 0;
                        const hasReturns = lotAudit.returnLogs.length > 0;

                        return (
                          <React.Fragment key={lotAudit.lotId}>
                            <tr>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ fontSize: '13px' }}>
                                  {lotAudit.lotId && lotAudit.lotId !== 'N/A' ? `Lot ${lotAudit.lotId}` : 'General / No Lot'}
                                </strong>
                              </div>
                            </td>
                            <td>
                              <div>
                                <strong style={{ color: 'var(--text-main)' }}>{lotAudit.category}</strong>
                                {lotAudit.brand && lotAudit.brand !== '—' && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                    Brand: {lotAudit.brand}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: '700', fontSize: '13px' }}>
                                {lotAudit.initialPieces > 0 ? `${lotAudit.initialPieces.toLocaleString()} pcs` : '—'}
                              </div>
                              {lotAudit.initialLogs.length > 0 && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {lotAudit.initialLogs[0].date.split(' ')[0]}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {hasReissues ? (
                                <div>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    backgroundColor: 'var(--warning-light)',
                                    color: 'var(--warning)'
                                  }}>
                                    +{lotAudit.reissuePieces.toLocaleString()} pcs
                                  </span>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {lotAudit.reissueLogs.length} re-issue{lotAudit.reissueLogs.length > 1 ? 's' : ''}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>0 pcs</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '800',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                color: 'var(--accent-color)',
                                border: '1px solid rgba(99, 102, 241, 0.25)'
                              }}>
                                {lotAudit.totalPieces.toLocaleString()} pieces
                              </div>
                              {hasReissues && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                  ({lotAudit.initialPieces.toLocaleString()} initial + {lotAudit.reissuePieces.toLocaleString()} re-issue)
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>Total Slips: {lotAudit.allLogs.length}</span>
                                  {hasReissues && (
                                    <span className="status-badge rejected" style={{ fontSize: '9px', padding: '0 4px' }}>Re-issued</span>
                                  )}
                                  {hasReturns && (
                                    <span className="status-badge verified" style={{ fontSize: '9px', padding: '0 4px' }}>Return</span>
                                  )}
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>
                                  Last Activity: {lotAudit.allLogs[0]?.date || '—'}
                                </div>
                              </div>
                            </td>
                            <td className="print-hide" style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => toggleAuditLotExpand(lotAudit.lotId)}
                                  style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Toggle Combined Material Matrix"
                                >
                                  <Layers size={12} />
                                  <span>{expandedAuditLots[lotAudit.lotId] ? 'Hide Materials' : 'Materials'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => setSelectedLotAuditDetail(lotAudit)}
                                  style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="View full audit trail, comparison and material breakdown"
                                >
                                  <Eye size={12} />
                                  <span>Audit View</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => handlePrintLotAudit(lotAudit)}
                                  style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Print Formal Lot Audit Report"
                                >
                                  <Printer size={12} />
                                  <span>Print Audit</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => handleDownloadLotAuditPdf(lotAudit)}
                                  style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Download Combined Audit PDF"
                                >
                                  <FileText size={12} />
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedAuditLots[lotAudit.lotId] && (
                            <tr key={lotAudit.lotId + '-expanded'}>
                              <td colSpan="7" style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px 16px' }}>
                                <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                  <div style={{ padding: '8px 12px', backgroundColor: 'rgba(99, 102, 241, 0.08)', fontWeight: '700', fontSize: '12px', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Combined Material Dispatched Matrix — Lot {lotAudit.lotId}</span>
                                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                                      <span style={{ color: '#2563eb' }}>1st Time: {lotAudit.initialPieces.toLocaleString()} pcs</span>
                                      <span style={{ color: '#dc2626' }}>Extra: +{lotAudit.reissuePieces.toLocaleString()} pcs</span>
                                      <span style={{ color: '#059669', fontWeight: '800' }}>Combined: {lotAudit.totalPieces.toLocaleString()} pcs</span>
                                    </div>
                                  </div>
                                  <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                                        <th style={{ padding: '6px 10px' }}>BOM Component</th>
                                        <th style={{ padding: '6px 10px' }}>Inventory Material</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', color: '#1d4ed8' }}>1st Issue Qty</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', color: '#dc2626' }}>Extra Issue Qty</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Returned Qty</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#4f46e5' }}>Combined Net Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.values(lotAudit.materialsSummary || {}).map((m, mIdx) => (
                                        <tr key={mIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                          <td style={{ padding: '6px 10px', fontWeight: '700' }}>{m.bomItemName}</td>
                                          <td style={{ padding: '6px 10px' }}>{m.materialName}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>
                                            {m.initialQty > 0 ? `${Number(m.initialQty.toFixed(2))} ${m.unit}` : '—'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '600', color: m.reissueQty > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                                            {m.reissueQty > 0 ? `+${Number(m.reissueQty.toFixed(2))} ${m.unit}` : '0'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', color: m.returnedQty > 0 ? '#059669' : 'var(--text-muted)' }}>
                                            {m.returnedQty > 0 ? `-${Number(m.returnedQty.toFixed(2))} ${m.unit}` : '0'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#4f46e5' }}>
                                            {Number(m.totalIssuedQty.toFixed(2))} {m.unit}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: All Transaction Logs (Chronological Flat Table) */}
          {auditTab === 'all_logs' && (
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Lot Number</th>
                    <th>Garment Category</th>
                    <th>Volume (Pieces)</th>
                    <th>Person Name</th>
                    <th>Date Issued</th>
                    <th>Issued Materials Details</th>
                    <th className="print-hide" style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        {issueLogs.length === 0
                          ? 'No material issues logged for this manufacturing cycle.'
                          : 'No matching transaction logs found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 'bold' }}>
                          {log.id}
                          {log.isReissue && (
                            <span className="status-badge rejected" style={{ fontSize: '9px', padding: '1px 4px', marginLeft: '6px', textTransform: 'uppercase' }}>
                              Re-issue
                            </span>
                          )}
                          {log.isReturn && (
                            <span className="status-badge verified" style={{ fontSize: '9px', padding: '1px 4px', marginLeft: '6px', textTransform: 'uppercase', backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                              Return
                            </span>
                          )}
                        </td>
                        <td>
                          {log.isReturn ? (
                            <span className="status-badge" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                              {log.lotId && log.lotId !== 'N/A' ? `Lot ${log.lotId}` : 'No Lot'}
                            </span>
                          ) : (
                            <span className={`status-badge ${log.isReissue ? 'pending' : 'po-generated'}`}>Lot {log.lotId}</span>
                          )}
                        </td>
                        <td>{log.category}</td>
                        <td>
                          {log.isReturn ? (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          ) : (
                            <strong>{log.volume.toLocaleString()} units</strong>
                          )}
                        </td>
                        <td><strong>{log.personName || 'System'}</strong></td>
                        <td>{log.date}</td>
                        <td style={{ fontSize: '12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {log.materials.map((m, mIdx) => (
                              <span key={mIdx} style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                {m.bomItemName ? (
                                  <>
                                    <strong>{m.bomItemName}</strong> ({m.name}): <strong>{m.qty} {m.unit}</strong>
                                  </>
                                ) : (
                                  <>
                                    {m.name}: <strong>{m.qty} {m.unit}</strong>
                                  </>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="print-hide" style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handlePrintSingleLog(log)}
                            style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Print Single Issue Slip"
                          >
                            <Printer size={12} />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Printable Single Requisition Slip */}
      {printLog && (
        <div className="single-issue-print-slip">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', flex: 1, justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>G-PDMS Secure Systems</h2>
                  <span style={{ fontSize: '11px', color: '#666' }}>Garment Product Data Management System</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                    {printLog.isReturn ? 'Material Return Receipt' : 'Material Requisition & Issue Slip'}
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Slip ID: {printLog.id}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', padding: '12px', border: '1px solid #000', borderRadius: '4px', marginBottom: '16px', fontSize: '12px' }}>
                <div><strong>Lot Number:</strong> {printLog.lotId && printLog.lotId !== 'N/A' ? `Lot ${printLog.lotId}` : 'N/A (General Inventory)'}</div>
                <div><strong>Date {printLog.isReturn ? 'Returned' : 'Issued'}:</strong> {printLog.date}</div>
                <div><strong>Garment Category:</strong> {printLog.category}</div>
                <div><strong>{printLog.isReturn ? 'Reason / Notes' : 'Issuer (Person)'}:</strong> {printLog.personName || 'System'}</div>
                {!printLog.isReturn && <div><strong>Batch Volume:</strong> {printLog.volume.toLocaleString()} units</div>}
                <div><strong>Status:</strong> {printLog.isReturn ? 'Returned to Inventory' : printLog.isReissue ? 'Re-issue (Wastage / Replacement)' : 'First-Time Initial Issue'}</div>
              </div>

              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
                {printLog.isReturn ? 'Returned Materials Details' : 'Issued Materials Details'}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>BOM Component</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>{printLog.isReturn ? 'Inventory Material Returned' : 'Inventory Material Issued'}</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>{printLog.isReturn ? 'Quantity Returned' : 'Quantity Issued'}</th>
                  </tr>
                </thead>
                <tbody>
                  {printLog.materials.map((m, mIdx) => (
                    <tr key={mIdx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{m.bomItemName || 'N/A'}</td>
                      <td style={{ padding: '6px 8px' }}>{m.name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{m.qty} {m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Block - pinned at bottom */}
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', fontSize: '11px', borderTop: '1px solid #000', paddingTop: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                  <div style={{ marginTop: '6px', fontWeight: 'bold' }}>{printLog.isReturn ? 'Returned By (Name & Sign)' : 'Issued By (Name & Sign)'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                  <div style={{ marginTop: '6px', fontWeight: 'bold' }}>{printLog.isReturn ? 'Received By / Storekeeper' : 'Received By (Name & Sign)'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                  <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Approved By (Supervisor)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
           PRINT PREVIEW MODAL — shown when "Issue Materials" clicked
          ============================================================ */}
      {previewIssue && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          {/* Screen modal card */}
          <div className="modal-content animate-scale" style={{
            maxWidth: '800px',
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal header */}
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={22} style={{ color: 'var(--accent-color)' }} />
                <div>
                  <h3 className="modal-title" style={{ margin: 0 }}>Material Issue Slip — Preview</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Review the slip before confirming. Click Print to print 2 copies (Original + Duplicate).
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewIssue(null)}
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
            </div>

            {/* Slip preview body (screen view) */}
            <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
              {/* ---- Slip card ---- */}
              <div style={{
                border: '2px solid #1a1a2e',
                borderRadius: '8px',
                padding: '24px',
                backgroundColor: '#fff',
                color: '#000',
                fontFamily: 'Arial, sans-serif',
                minHeight: '520px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
              }}>
                <div>
                  {/* Slip header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>G-PDMS Secure Systems</h2>
                      <span style={{ fontSize: '12px', color: '#555' }}>Garment Product Data Management System</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                        {previewIssue.isReissue ? 'Re-issue Requisition Slip' : 'Material Requisition & Issue Slip'}
                      </h3>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Date: {previewIssue.date}</span>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                    <div><strong>Lot Number:</strong> Lot {previewIssue.design.id}</div>
                    <div><strong>Date Issued:</strong> {previewIssue.date}</div>
                    <div><strong>Garment Category:</strong> {previewIssue.design.category}</div>
                    <div><strong>Brand:</strong> {previewIssue.design.brand || '—'}</div>
                    <div><strong>Batch Volume:</strong> {previewIssue.pieces.toLocaleString()} units</div>
                    <div><strong>Issuer (Person):</strong> {previewIssue.personName}</div>
                    <div><strong>Status:</strong> {previewIssue.isReissue ? 'Re-issue (Wastage / Replacement)' : 'First-Time Initial Issue'}</div>
                  </div>

                  {/* Materials table */}
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '4px' }}>Issued Materials</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '24px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#f4f4f4' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>BOM Component</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Inventory Material</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>Total Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewIssue.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '7px 6px', color: '#555' }}>{idx + 1}</td>
                          <td style={{ padding: '7px 6px', fontWeight: 'bold' }}>{item.bomItemName}</td>
                          <td style={{ padding: '7px 6px' }}>{item.materialName}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 'bold' }}>{item.totalRequired} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signature block */}
                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', fontSize: '12px', borderTop: '1px solid #000', paddingTop: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ height: '36px' }}></div>
                      <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                      <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Issued By (Name & Sign)</div>
                      <div style={{ marginTop: '4px', color: '#333' }}>{previewIssue.personName}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ height: '36px' }}></div>
                      <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                      <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Received By (Name & Sign)</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ height: '36px' }}></div>
                      <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                      <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Approved By (Supervisor)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexShrink: 0,
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewIssue(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={15} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmIssue}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '160px', justifyContent: 'center' }}
              >
                <CheckCircle size={15} />
                <span>Confirm &amp; Issue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
           PRINT PROMPT — shown after Confirm & Issue
          ============================================================ */}
      {showPrintPrompt && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <div className="animate-scale" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '0',
            maxWidth: '460px',
            width: '95%',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px 28px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              {/* Success check icon */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--success-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                border: '2px solid rgba(16, 185, 129, 0.3)'
              }}>
                <CheckCircle size={32} style={{ color: 'var(--success)' }} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>
                Materials Issued Successfully!
              </h3>
              <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Lot <strong>{showPrintPrompt.design.id}</strong> — {showPrintPrompt.pieces.toLocaleString()} units
              </p>
              <p style={{ margin: '0', fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>
                Do you want to print the issue slip?
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Printing will produce <strong>2 copies</strong> — Original Copy &amp; Duplicate Copy
              </p>
            </div>

            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '24px 28px',
              justifyContent: 'center'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPrintPrompt(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <X size={16} />
                <span>No, Skip</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  // Print first, then clear prompt after dialog closes
                  document.body.classList.add('print-issue-preview-mode');
                  setTimeout(() => {
                    window.print();
                    document.body.classList.remove('print-issue-preview-mode');
                    setShowPrintPrompt(null);
                  }, 100);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, var(--accent-color) 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                }}
              >
                <Printer size={16} />
                <span>Yes, Print 2 Copies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden dual-copy print layout — only visible when printing via prompt */}
      {showPrintPrompt && (
        <div className="issue-preview-print-layout">
          {['ORIGINAL COPY', 'DUPLICATE COPY'].map((copyLabel, copyIdx) => (
            <div key={copyIdx} className={copyIdx === 0 ? 'print-copy' : 'print-copy print-copy-second'}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  {/* Copy stamp */}
                  <div style={{
                    textAlign: 'right',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    color: copyIdx === 0 ? '#000' : '#555',
                    borderBottom: copyIdx === 0 ? '2px solid #000' : '2px dashed #888',
                    paddingBottom: '4px'
                  }}>{copyLabel}</div>

                  {/* Slip header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>G-PDMS Secure Systems</h2>
                      <span style={{ fontSize: '11px', color: '#555' }}>Garment Product Data Management System</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {showPrintPrompt.isReissue ? 'Re-issue Requisition Slip' : 'Material Requisition & Issue Slip'}
                      </h3>
                      <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Date: {showPrintPrompt.date}</span>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 20px', padding: '10px', border: '1px solid #000', borderRadius: '4px', marginBottom: '14px', fontSize: '11px' }}>
                    <div><strong>Lot Number:</strong> Lot {showPrintPrompt.design.id}</div>
                    <div><strong>Date Issued:</strong> {showPrintPrompt.date}</div>
                    <div><strong>Garment Category:</strong> {showPrintPrompt.design.category}</div>
                    <div><strong>Brand:</strong> {showPrintPrompt.design.brand || '—'}</div>
                    <div><strong>Batch Volume:</strong> {showPrintPrompt.pieces.toLocaleString()} units</div>
                    <div><strong>Issuer (Person):</strong> {showPrintPrompt.personName}</div>
                    <div><strong>Issue Type:</strong> {showPrintPrompt.isReissue ? 'Re-issue (Wastage / Replacement)' : 'First-Time Initial Issue'}</div>
                  </div>

                  {/* Materials table */}
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '3px' }}>Issued Materials</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '18px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#eee' }}>
                        <th style={{ textAlign: 'left', padding: '6px 5px' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '6px 5px' }}>BOM Component</th>
                        <th style={{ textAlign: 'left', padding: '6px 5px' }}>Inventory Material</th>
                        <th style={{ textAlign: 'right', padding: '6px 5px' }}>Total Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showPrintPrompt.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                          <td style={{ padding: '5px' }}>{idx + 1}</td>
                          <td style={{ padding: '5px', fontWeight: 'bold' }}>{item.bomItemName}</td>
                          <td style={{ padding: '5px' }}>{item.materialName}</td>
                          <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{item.totalRequired} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signature block - pinned to bottom */}
                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '11px', borderTop: '1px solid #000', paddingTop: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ height: '36px' }}></div>
                      <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                      <div style={{ marginTop: '5px', fontWeight: 'bold' }}>Issued By (Name & Sign)</div>
                      <div style={{ marginTop: '2px' }}>{showPrintPrompt.personName}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ height: '36px' }}></div>
                      <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                      <div style={{ marginTop: '5px', fontWeight: 'bold' }}>Received By (Name & Sign)</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ height: '36px' }}></div>
                      <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                      <div style={{ marginTop: '5px', fontWeight: 'bold' }}>Approved By (Supervisor)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Return Excess Material Modal */}
      {isReturnModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={20} style={{ color: 'var(--success)' }} />
                <span>Return Excess Material</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsReturnModalOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleReturnSubmit}>
              {returnError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{returnError}</span>
                </div>
              )}

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="is-quick-return"
                  checked={isQuickReturn}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsQuickReturn(checked);
                    if (checked) {
                      setReturnLotId('N/A');
                      setReturnItems(returnItems.map(item => ({ ...item, bomItemName: '' })));
                    }
                  }}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="is-quick-return" style={{ fontWeight: '600', cursor: 'pointer', fontSize: '14px', color: 'var(--text-color)' }}>
                  Quick Stock Return (No Lot or BOM Component mapping needed)
                </label>
              </div>

              {!isQuickReturn && (
                <div className="form-group animate-fade">
                  <label className="form-label">Associated Lot Number (Optional)</label>
                  <select
                    className="form-input"
                    value={returnLotId}
                    onChange={(e) => setReturnLotId(e.target.value)}
                  >
                    <option value="N/A">General Inventory Return (No Lot)</option>
                    {approvedDesigns.map(design => (
                      <option key={design.id} value={design.id}>
                        Lot {design.id} &mdash; {design.brand || 'No Brand'} ({design.category})
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    If returned materials were originally issued for a specific approved manufacturing lot, select it here.
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Materials to Return</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddReturnRow}
                    style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} />
                    <span>Add Item</span>
                  </button>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {/* Table headers inside the modal */}
                  <div style={{ display: 'grid', gridTemplateColumns: isQuickReturn ? '1.8fr 1fr auto' : '1.2fr 1.2fr 0.8fr auto', gap: '12px', alignItems: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    {!isQuickReturn && <div>BOM Component Name (Optional)</div>}
                    <div>Inventory Material Map</div>
                    <div>Return Qty</div>
                    <div></div>
                  </div>

                  {returnItems.map((item, index) => {
                    const selectedMaterial = materials.find(m => m.id === item.materialId);
                    const selectedDesign = designs.find(d => d.id === returnLotId);
                    const bomItems = selectedDesign?.bom || [];

                    return (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: isQuickReturn ? '1.8fr 1fr auto' : '1.2fr 1.2fr 0.8fr auto', gap: '12px', alignItems: 'center' }}>
                        {!isQuickReturn && (
                          <div>
                            <input
                              list={`bom-options-${index}`}
                              type="text"
                              className="form-input"
                              placeholder="e.g. Button, Thread..."
                              value={item.bomItemName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                let matchedMaterialId = '';
                                const logs = issueLogs.filter(log => String(log.lotId) === String(returnLotId) && !log.isReturn);
                                for (const log of logs) {
                                  const found = log.materials.find(m => m.bomItemName === val);
                                  if (found) {
                                    const mat = materials.find(m => {
                                      const mName = m.color && m.color !== 'Default' ? `${m.name} (${m.color})` : m.name;
                                      return mName === found.name;
                                    });
                                    if (mat) {
                                      matchedMaterialId = mat.id;
                                      break;
                                    }
                                  }
                                }
                                if (!matchedMaterialId && selectedDesign) {
                                  const bomItem = selectedDesign.bom?.find(b => b.name === val);
                                  if (bomItem && bomItem.materialId) {
                                    matchedMaterialId = bomItem.materialId;
                                  }
                                }

                                const updated = [...returnItems];
                                updated[index].bomItemName = val;
                                if (matchedMaterialId) {
                                  updated[index].materialId = matchedMaterialId;
                                }
                                setReturnItems(updated);
                              }}
                            />
                            <datalist id={`bom-options-${index}`}>
                              {bomItems.map((b, bIdx) => (
                                <option key={bIdx} value={b.name} />
                              ))}
                            </datalist>
                          </div>
                        )}
                        <div>
                          <SearchableMaterialSelect
                            materials={materials}
                            value={item.materialId}
                            onChange={(val) => handleReturnItemChange(index, 'materialId', val)}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            placeholder="Qty"
                            className="form-input"
                            value={item.qty}
                            onChange={(e) => handleReturnItemChange(index, 'qty', e.target.value)}
                            required
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '40px' }}>
                            {selectedMaterial ? selectedMaterial.unit : ''}
                          </span>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveReturnRow(index)}
                            disabled={returnItems.length === 1}
                            style={{ padding: '8px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label">Reason for Return / Notes</label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Leftover trim and fabric rolls returned to warehouse storage..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReturnModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle size={16} />
                  <span>Submit Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* RGP Generator Modal */}
      {showRgpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-main)',
            padding: '28px',
            borderRadius: 'var(--border-radius-lg)',
            width: '90%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowRgpModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: 'var(--accent-color)' }}>
              Generate Returnable Gate Pass (RGP)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Create an RGP documentation for shortage items sent out for job work/vendors.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handlePrintRgp(); }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Select Vendor / Receiver</label>
                <select
                  className="form-input"
                  value={rgpVendorId}
                  onChange={(e) => setRgpVendorId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.materialsJoined})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Gate Pass Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={rgpDate}
                  onChange={(e) => setRgpDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Purpose / Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', padding: '10px', resize: 'vertical' }}
                  value={rgpNotes}
                  onChange={(e) => setRgpNotes(e.target.value)}
                  placeholder="e.g. Sent for printing or job work restock"
                />
              </div>

              <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>RGP Shortage Items:</strong>
                {shortageItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                    <span>{item.name}</span>
                    <strong>{item.qty} {item.unit}</strong>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRgpModal(false)}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-accent"
                  style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Print RGP PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ============================================================
           DETAILED LOT AUDIT MODAL — Breakdown of Issue & Re-issue
          ============================================================ */}
      {selectedLotAuditDetail && (
        <div className="modal-overlay" style={{ zIndex: 250 }}>
          <div className="modal-content animate-scale" style={{
            maxWidth: '900px',
            width: '95%',
            maxHeight: '92vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart3 size={22} style={{ color: 'var(--accent-color)' }} />
                <div>
                  <h3 className="modal-title" style={{ margin: 0 }}>
                    Lot {selectedLotAuditDetail.lotId} — Material Issue &amp; Re-issue Audit Report
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Category: <strong>{selectedLotAuditDetail.category}</strong> {selectedLotAuditDetail.brand && `| Brand: ${selectedLotAuditDetail.brand}`} | Total Transactions: {selectedLotAuditDetail.allLogs.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedLotAuditDetail(null)}
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              {/* 4 KPI Metric Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Initial Issue Pieces</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                    {selectedLotAuditDetail.initialPieces.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>pcs</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedLotAuditDetail.initialLogs.length} initial transaction{selectedLotAuditDetail.initialLogs.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Re-issued (Wastage)</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: selectedLotAuditDetail.reissuePieces > 0 ? 'var(--warning)' : 'var(--text-muted)', marginTop: '4px' }}>
                    {selectedLotAuditDetail.reissuePieces > 0 ? `+${selectedLotAuditDetail.reissuePieces.toLocaleString()}` : '0'} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>pcs</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedLotAuditDetail.reissueLogs.length} re-issue transaction{selectedLotAuditDetail.reissueLogs.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: '700', textTransform: 'uppercase' }}>Total Pieces Issued</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-color)', marginTop: '4px' }}>
                    {selectedLotAuditDetail.totalPieces.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>pieces</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-color)', marginTop: '2px', fontWeight: '500' }}>
                    Verified total volume
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Components Dispatched</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                    {Object.keys(selectedLotAuditDetail.materialsSummary).length} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>items</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedLotAuditDetail.returnLogs.length > 0 ? `${selectedLotAuditDetail.returnLogs.length} returns logged` : 'Zero returns'}
                  </div>
                </div>
              </div>

              {/* SECTION 1: Chronological Issue & Re-issue Timeline */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={15} className="text-accent" />
                  <span>1. Issues &amp; Re-issues Transaction Timeline</span>
                </h4>
                <div className="custom-table-container">
                  <table className="custom-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Slip ID</th>
                        <th>Transaction Type</th>
                        <th>Date &amp; Time</th>
                        <th>Pieces Issued</th>
                        <th>Issuer (Person)</th>
                        <th>Dispatched Materials</th>
                        <th style={{ textAlign: 'center' }}>Print</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLotAuditDetail.allLogs.map((log, idx) => (
                        <tr key={log.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold' }}>{log.id}</td>
                          <td>
                            {log.isReturn ? (
                              <span className="status-badge verified" style={{ fontSize: '10px', padding: '1px 6px' }}>Return</span>
                            ) : log.isReissue ? (
                              <span className="status-badge rejected" style={{ fontSize: '10px', padding: '1px 6px' }}>Re-issue</span>
                            ) : (
                              <span className="status-badge po-generated" style={{ fontSize: '10px', padding: '1px 6px' }}>Initial Issue</span>
                            )}
                          </td>
                          <td>{log.date}</td>
                          <td>
                            {log.isReturn ? (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : (
                              <strong>{Number(log.volume).toLocaleString()} pcs</strong>
                            )}
                          </td>
                          <td>{log.personName || 'System'}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {log.materials && log.materials.map((m, mIdx) => (
                                <span key={mIdx} style={{ fontSize: '11px', padding: '1px 6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                                  {m.bomItemName ? `${m.bomItemName}: ` : ''}<strong>{m.qty} {m.unit}</strong>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handlePrintSingleLog(log)}
                              style={{ padding: '3px 6px' }}
                              title="Print this individual slip"
                            >
                              <Printer size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: Consolidated Material Consumption Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} className="text-accent" />
                  <span>2. Consolidated Material Sourcing &amp; Net Dispatched Matrix</span>
                </h4>
                <div className="custom-table-container">
                  <table className="custom-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>BOM Component</th>
                        <th>Inventory Material Name</th>
                        <th style={{ textAlign: 'right', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#1d4ed8' }}>1st Time Issue (Initial)</th>
                        <th style={{ textAlign: 'right', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#dc2626' }}>Extra Material Issue</th>
                        <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Returned Qty</th>
                        <th style={{ textAlign: 'right', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', fontWeight: '800' }}>Combined Net Total</th>
                        <th style={{ textAlign: 'center' }}>Extra % Ratio</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(selectedLotAuditDetail.materialsSummary).map((mat, idx) => {
                        const variancePercent = mat.initialQty > 0 ? ((mat.reissueQty / mat.initialQty) * 100).toFixed(1) : (mat.reissueQty > 0 ? '100.0' : '0.0');
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '700' }}>{mat.bomItemName}</td>
                            <td>{mat.materialName}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#1d4ed8', backgroundColor: 'rgba(37, 99, 235, 0.02)' }}>
                              {mat.initialQty > 0 ? Number(mat.initialQty.toFixed(2)) : '0'}
                            </td>
                            <td style={{ textAlign: 'right', color: mat.reissueQty > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: mat.reissueQty > 0 ? '700' : 'normal', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                              {mat.reissueQty > 0 ? `+${Number(mat.reissueQty.toFixed(2))}` : '0'}
                            </td>
                            <td style={{ textAlign: 'right', color: mat.returnedQty > 0 ? '#059669' : 'inherit' }}>
                              {mat.returnedQty > 0 ? `-${Number(mat.returnedQty.toFixed(2))}` : '0'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#4f46e5', backgroundColor: 'rgba(99, 102, 241, 0.06)' }}>
                              {Number(mat.totalIssuedQty.toFixed(2))}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {mat.reissueQty > 0 ? (
                                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: '700' }}>
                                  +{variancePercent}%
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#059669' }}>0% Extra</span>
                              )}
                            </td>
                            <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{mat.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexShrink: 0,
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedLotAuditDetail(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handlePrintLotAudit(selectedLotAuditDetail)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} />
                <span>Print Lot Audit Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
           PRINTABLE LOT AUDIT REPORT MODAL & PRINT SLIP
          ============================================================ */}
      {printLotAudit && (
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
                  Lot Material Issue &amp; Re-issue Audit Voucher — Lot {printLotAudit.lotId}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    document.body.classList.add('print-lot-audit-mode');
                    window.print();
                    setTimeout(() => {
                      document.body.classList.remove('print-lot-audit-mode');
                    }, 1000);
                  }}
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
                  onClick={() => handleDownloadLotAuditPdf(printLotAudit)}
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
                  onClick={() => setPrintLotAudit(null)}
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

            {/* Modal Body with Printable Area */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>
              <div className="lot-audit-print-slip" style={{ display: 'block' }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    {/* Slip Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>MH ACCESSORIES &amp; BOM STORE</h2>
                        <span style={{ fontSize: '11px', color: '#555' }}>Garment Product Data Management System (G-PDMS)</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4f46e5' }}>
                          Lot Material Issue &amp; Re-issue Audit Report
                        </h3>
                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                          Audit Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Lot & Pieces Audit Verification Summary Box */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px', border: '2px solid #000', borderRadius: '4px', marginBottom: '16px', fontSize: '11px', backgroundColor: '#fcfcfc' }}>
                      <div>
                        <div><strong>Lot Number:</strong> Lot {printLotAudit.lotId}</div>
                        <div><strong>Garment Category:</strong> {printLotAudit.category}</div>
                        <div><strong>Brand:</strong> {printLotAudit.brand || '—'}</div>
                      </div>
                      <div>
                        <div><strong>Initial Issue Pieces:</strong> {printLotAudit.initialPieces.toLocaleString()} units</div>
                        <div><strong>Re-issued Pieces (Wastage):</strong> {printLotAudit.reissuePieces.toLocaleString()} units</div>
                        <div><strong>Total Issue Slips:</strong> {printLotAudit.allLogs.length} transactions</div>
                      </div>
                      <div style={{ borderLeft: '1px solid #000', paddingLeft: '12px' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#555' }}>Total Audited Pieces Issued</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#000', marginTop: '2px' }}>
                          {printLotAudit.totalPieces.toLocaleString()} units
                        </div>
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                          ({printLotAudit.initialPieces.toLocaleString()} initial + {printLotAudit.reissuePieces.toLocaleString()} re-issue)
                        </div>
                      </div>
                    </div>

                    {/* 1. FIRST-TIME ISSUE DETAILS (INITIAL ALLOCATION) */}
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
                          {printLotAudit.initialPieces.toLocaleString()} Pcs • {printLotAudit.initialLogs.length} Slip(s)
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
                          {printLotAudit.initialLogs.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>No initial issue slip recorded for this lot.</td>
                            </tr>
                          ) : (
                            printLotAudit.initialLogs.map((l, lIdx) => (
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
                        backgroundColor: printLotAudit.reissueLogs.length > 0 ? '#fef2f2' : '#f0fdf4',
                        borderLeft: `4px solid ${printLotAudit.reissueLogs.length > 0 ? '#dc2626' : '#16a34a'}`,
                        borderTop: `1px solid ${printLotAudit.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                        borderRight: `1px solid ${printLotAudit.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                        borderBottom: `1px solid ${printLotAudit.reissueLogs.length > 0 ? '#fecaca' : '#bbf7d0'}`,
                        borderRadius: '4px 4px 0 0',
                        fontSize: '11px',
                        fontWeight: '800',
                        color: printLotAudit.reissueLogs.length > 0 ? '#991b1b' : '#166534'
                      }}>
                        <span>2. EXTRA MATERIAL ISSUE DETAILS (WASTAGE &amp; RE-ISSUES)</span>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          backgroundColor: printLotAudit.reissueLogs.length > 0 ? '#fee2e2' : '#dcfce7',
                          color: printLotAudit.reissueLogs.length > 0 ? '#b91c1c' : '#15803d',
                          padding: '1px 8px',
                          borderRadius: '10px'
                        }}>
                          {printLotAudit.reissueLogs.length > 0
                            ? `+${printLotAudit.reissuePieces.toLocaleString()} Pcs • ${printLotAudit.reissueLogs.length} Extra Slip(s)`
                            : '0 Extra Pcs • Zero Wastage'}
                        </span>
                      </div>

                      {printLotAudit.reissueLogs.length === 0 ? (
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
                            {printLotAudit.reissueLogs.map((l, lIdx) => (
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

                    {/* 3. BOTH COMBINED DETAILS (CONSOLIDATED SOURCING & NET DISPATCHED MATRIX) */}
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
                          Combined Total: {printLotAudit.totalPieces.toLocaleString()} Pcs Net
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
                          {Object.values(printLotAudit.materialsSummary || {}).map((m, mIdx) => {
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
                  </div>

                  {/* Signature Block - pinned at bottom */}
                  <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', fontSize: '11px', borderTop: '1px solid #000', paddingTop: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '36px' }}></div>
                        <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                        <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Issued By (Store In-charge)</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '36px' }}></div>
                        <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                        <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Verified By (Production Supervisor)</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '36px' }}></div>
                        <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                        <div style={{ marginTop: '6px', fontWeight: 'bold' }}>Audited &amp; Approved By (Admin)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
