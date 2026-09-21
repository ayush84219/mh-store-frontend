import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers, Search, CheckCircle2, AlertTriangle, Printer,
  FileText, Shield, ShieldAlert, ArrowRight, RotateCcw, Clock,
  Package, ChevronDown, CheckCircle, HelpCircle,
  TrendingUp, Sparkles, Filter, RefreshCw, Eye, BarChart3,
  User, Send, Box, Scissors, Tag, Info, Calendar
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Reusable Searchable Material Select with Portal & Smart Positioning
function SearchableMaterialSelect({ materials = [], value, onChange, disabled = false, placeholder = "-- Select Material --", hasError = false }) {
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
      
      setCoords({
        top: isAbove ? rect.top : rect.bottom + 4,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 360)),
        width: Math.max(rect.width, 320),
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

  const filtered = materials.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const codeStr = String(m.id || '').toLowerCase();
    const nameStr = String(m.name || '').toLowerCase();
    const colorStr = String(m.color || '').toLowerCase();
    const catStr = String(m.category || '').toLowerCase();
    return codeStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q);
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
              <span style={{
                fontFamily: 'monospace',
                fontWeight: '800',
                fontSize: '12px',
                backgroundColor: 'rgba(99,102,241,0.12)',
                color: '#4f46e5',
                padding: '2px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                [{selectedMaterial.id}]
              </span>
              <span style={{ fontWeight: '600', fontSize: '13px' }}>
                {selectedMaterial.name}
              </span>
              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ({selectedMaterial.color})
                </span>
              )}
              {selectedMaterial.stock !== undefined && (
                <span style={{ fontSize: '12px', color: selectedMaterial.stock <= 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: '700' }}>
                  • {selectedMaterial.stock} {selectedMaterial.unit || 'Pcs'}
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
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1)',
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
              placeholder="Search Material Code, Name, Color..."
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

          <div style={{
            maxHeight: '220px',
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
              filtered.map(m => {
                const isSelected = String(m.id) === String(value);
                return (
                  <div
                    key={m.id}
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
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      color: isSelected ? '#4f46e5' : 'var(--text-main, #0f172a)',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        fontSize: '11px',
                        color: '#6366f1',
                        flexShrink: 0
                      }}>
                        [{m.id}]
                      </span>
                      <span style={{ fontWeight: isSelected ? '700' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.name}
                        {m.color && m.color !== 'Default' && ` (${m.color})`}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: m.stock <= 0 ? '#ef4444' : '#10b981',
                      flexShrink: 0,
                      marginLeft: '10px'
                    }}>
                      {m.stock} {m.unit || 'Pcs'}
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
  const approvedDesigns = useMemo(() => {
    return designs.filter(d => d.status === 'Approved');
  }, [designs]);

  // Main UI states
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [searchLotQuery, setSearchLotQuery] = useState('');
  const [pieces, setPieces] = useState(100);
  const [isLoadingPieces, setIsLoadingPieces] = useState(false);
  const [bomMappings, setBomMappings] = useState([]);
  const [personName, setPersonName] = useState(currentUser?.name || 'Store Keeper');
  const [receiverName, setReceiverName] = useState('Cutting Master');
  const [receiverDept, setReceiverDept] = useState('Cutting Dept');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('issue'); // 'issue', 'history', or 'combined_audit'
  const [historySearch, setHistorySearch] = useState('');
  const [auditLotSearch, setAuditLotSearch] = useState('');
  const [expandedAuditLots, setExpandedAuditLots] = useState({});
  const toggleAuditLotExpand = (lotId) => {
    setExpandedAuditLots(prev => ({ ...prev, [lotId]: !prev[lotId] }));
  };
  const [showAllBom, setShowAllBom] = useState(false);
  
  // Printable slip modal
  const [printSlipData, setPrintSlipData] = useState(null);
  const [printAuditModalData, setPrintAuditModalData] = useState(null);
  const activeLotIdRef = useRef(null);

  // 5% Threshold Exceeded Approval Modal State
  const [extraApprovalModal, setExtraApprovalModal] = useState(null);

  // Calculate extra issue percentage and 5% threshold compliance
  const getComponentExtraPercentage = (item) => {
    if (!item) return { baseQty: 0, extraQty: 0, percentage: 0, exceedsLimit: false, maxAllowedQty: 0, excessQty: 0 };
    const extraQty = parseFloat(item.extraQty) || 0;
    const baseQty = item.previouslyIssuedQty > 0
      ? item.previouslyIssuedQty
      : ((Number(pieces) || Number(selectedDesign?.quantity) || 100) * (Number(item.qtyPerPiece) || 1));
    
    const percentage = baseQty > 0 ? (extraQty / baseQty) * 100 : (extraQty > 0 ? 100 : 0);
    const maxAllowedQty = Math.round((baseQty * 0.05) * 100) / 100;
    const exceedsLimit = percentage > 5.0;

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

  // Auto-fill personName from currentUser
  useEffect(() => {
    if (currentUser?.name) {
      setPersonName(currentUser.name);
    }
  }, [currentUser]);

  // Filter approved designs
  const filteredDesigns = useMemo(() => {
    const q = searchLotQuery.toLowerCase().trim();
    if (!q) return approvedDesigns;
    return approvedDesigns.filter(d => {
      const idMatch = String(d.id || '').toLowerCase().includes(q);
      const lot2Match = String(d.lotNo2 || '').toLowerCase().includes(q);
      const brandMatch = String(d.brand || '').toLowerCase().includes(q);
      const catMatch = String(d.category || '').toLowerCase().includes(q);
      const styleMatch = String(d.style || '').toLowerCase().includes(q);
      const fabricMatch = String(d.fabricType || '').toLowerCase().includes(q);
      return idMatch || lot2Match || brandMatch || catMatch || styleMatch || fabricMatch;
    });
  }, [approvedDesigns, searchLotQuery]);

  // Calculate previous issues for the selected lot
  const lotPreviousIssues = useMemo(() => {
    if (!selectedDesignId) return [];
    return issueLogs.filter(log => String(log.lotId) === String(selectedDesignId));
  }, [issueLogs, selectedDesignId]);

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
          extraQty: newQty,
          selectedForExtra: newQty > 0 ? true : item.selectedForExtra
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
      reason: `Extra Material Requisition Exceeds 5% Limit: ${exceededSummary}`,
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

    setFormSuccess(`Approval Request submitted to Admin! Lot ${design.id} extra requisition (${exceededSummary}) is now pending Admin approval. Material will be issued after Admin approval.`);

    // Reset rows that were submitted
    if (isSingle && typeof singleIdx === 'number') {
      handleMappingChange(singleIdx, 'extraQty', '');
      handleMappingChange(singleIdx, 'extraRemarks', '');
    } else {
      setBomMappings(prev => prev.map(m => m.selectedForExtra ? { ...m, extraQty: '', extraRemarks: '', selectedForExtra: false } : m));
    }

    setExtraApprovalModal(null);
    setTimeout(() => setFormSuccess(''), 8000);
  };

  // Issue SINGLE component
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
      setFormError('Please provide the Issuer Name.');
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

    // Direct Issue (<= 5% standard limit)
    const voucherId = `EMI-${Date.now().toString().slice(-6)}`;
    const issueDateStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const issuedPayloadItem = {
      materialId: mat.id,
      materialName: mat.color && mat.color !== 'Default' ? `${mat.name} (${mat.color})` : mat.name,
      bomItemName: item.bomItemName,
      bomItemDetail: item.bomItemDetail,
      totalRequired: extraQty,
      unit: mat.unit || item.unit || 'Pcs',
      reason: item.extraReason + (item.extraRemarks ? ` - ${item.extraRemarks}` : ''),
      previouslyIssued: item.previouslyIssuedQty,
      receiverDept: receiverDept,
      receiverName: receiverName
    };

    // 1. Call onIssueMaterials to deduct stock & record log
    if (onIssueMaterials) {
      onIssueMaterials(
        selectedDesign.id,
        pieces,
        [issuedPayloadItem],
        true, // isReissue / extra issue
        `${personName.trim()} (Extra: ${item.extraReason})`
      );
    }

    // 2. Prepare print slip data and trigger preview modal
    const slipPayload = {
      voucherId,
      issueDate: issueDateStr,
      design: selectedDesign,
      pieces,
      personName: personName.trim(),
      receiverName: receiverName.trim(),
      receiverDept: receiverDept.trim(),
      items: [issuedPayloadItem],
      isSingle: true
    };

    setPrintSlipData(slipPayload);
    setFormSuccess(`Successfully issued ${extraQty} ${issuedPayloadItem.unit} of "${issuedPayloadItem.materialName}" for Lot ${selectedDesign.id}!`);

    // Reset extra quantity for that row
    handleMappingChange(index, 'extraQty', '');
    handleMappingChange(index, 'extraRemarks', '');

    // Auto-clear success banner after 6s
    setTimeout(() => setFormSuccess(''), 6000);
  };

  // Issue ALL SELECTED components
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
      setFormError('Please provide the Issuer Name.');
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

    // Direct Issue (all selected items are <= 5% standard limit)
    const voucherId = `EMI-${Date.now().toString().slice(-6)}`;
    const issueDateStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const issuedPayloadItems = selectedItems.map(item => {
      const mat = materials.find(m => String(m.id) === String(item.materialId));
      return {
        materialId: mat.id,
        materialName: mat.color && mat.color !== 'Default' ? `${mat.name} (${mat.color})` : mat.name,
        bomItemName: item.bomItemName,
        bomItemDetail: item.bomItemDetail,
        totalRequired: parseFloat(item.extraQty),
        unit: mat.unit || item.unit || 'Pcs',
        reason: item.extraReason + (item.extraRemarks ? ` - ${item.extraRemarks}` : ''),
        previouslyIssued: item.previouslyIssuedQty,
        receiverDept: receiverDept,
        receiverName: receiverName
      };
    });

    if (onIssueMaterials) {
      onIssueMaterials(
        selectedDesign.id,
        pieces,
        issuedPayloadItems,
        true,
        `${personName.trim()} (Extra Batch Issue)`
      );
    }

    const slipPayload = {
      voucherId,
      issueDate: issueDateStr,
      design: selectedDesign,
      pieces,
      personName: personName.trim(),
      receiverName: receiverName.trim(),
      receiverDept: receiverDept.trim(),
      items: issuedPayloadItems,
      isSingle: false
    };

    setPrintSlipData(slipPayload);
    setFormSuccess(`Successfully issued ${issuedPayloadItems.length} extra material components for Lot ${selectedDesign.id}!`);

    // Reset rows
    setBomMappings(prev => prev.map(m => m.selectedForExtra ? { ...m, extraQty: '', extraRemarks: '', selectedForExtra: false } : m));

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
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(14, 30, 182, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('EXTRA MATERIAL REQUISITION & ISSUE VOUCHER', 16, 37);

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
    doc.text(`Lot ${data.design?.id || '—'} ${data.design?.lotNo2 ? `(${data.design.lotNo2})` : ''}`, 44, 59);

    doc.setFont('helvetica', 'bold');
    doc.text(`Category:`, 110, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.design?.category || '—'} [${data.design?.brand || 'Generic'}]`, 135, 59);

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
    doc.text('EXTRA / WASTAGE REQUISITION', 135, 74);

    // Items Table
    const tableRows = (data.items || []).map((item, idx) => [
      idx + 1,
      item.bomItemName || '—',
      `[${item.materialId}] ${item.materialName}`,
      item.previouslyIssued ? `${item.previouslyIssued} ${item.unit}` : '0 Pcs',
      `${item.totalRequired} ${item.unit}`,
      item.reason || 'Extra Issue'
    ]);

    autoTable(doc, {
      startY: 82,
      head: [['#', 'BOM Component', 'Inventory Material Code & Name', 'Prev Issued', 'Extra Issued', 'Reason / Remarks']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
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

    doc.save(`EXTRA_MATERIAL_SLIP_${data.voucherId}_LOT_${data.design?.id}.pdf`);
  };

  // Browser print trigger
  const handleTriggerBrowserPrint = () => {
    document.body.classList.add('print-extra-issue-mode');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-extra-issue-mode');
    }, 1000);
  };

  // All extra/re-issue logs (unfiltered) for accurate KPI statistics
  const allExtraLogs = useMemo(() => {
    return issueLogs.filter(log => {
      const isExtra = log.isReissue || 
        (log.id && (log.id.startsWith('EMI') || log.id.startsWith('RI'))) || 
        (log.personName && log.personName.toLowerCase().includes('extra'));
      return isExtra;
    });
  }, [issueLogs]);

  // Filter extra logs for History Tab Search
  const extraIssueLogs = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return allExtraLogs;
    return allExtraLogs.filter(log => {
      const idMatch = String(log.id || '').toLowerCase().includes(q);
      const lotMatch = String(log.lotId || '').toLowerCase().includes(q);
      const personMatch = String(log.personName || '').toLowerCase().includes(q);
      const catMatch = String(log.category || '').toLowerCase().includes(q);
      const matMatch = log.materials && log.materials.some(m => 
        (m.name || '').toLowerCase().includes(q) || 
        (m.bomItemName || '').toLowerCase().includes(q) ||
        (m.reason || '').toLowerCase().includes(q)
      );
      return idMatch || lotMatch || personMatch || catMatch || matMatch;
    });
  }, [allExtraLogs, historySearch]);

  // Calculate lifetime stats for History tab overview cards
  const historyStats = useMemo(() => {
    let totalItemsCount = 0;
    let totalQtySum = 0;
    const uniqueLots = new Set();
    allExtraLogs.forEach(log => {
      if (log.lotId) uniqueLots.add(String(log.lotId));
      if (log.materials && Array.isArray(log.materials)) {
        totalItemsCount += log.materials.length;
        log.materials.forEach(m => {
          totalQtySum += (parseFloat(m.qty) || 0);
        });
      }
    });
    return {
      totalVouchers: allExtraLogs.length,
      totalItems: totalItemsCount,
      totalQty: totalQtySum,
      uniqueLotsCount: uniqueLots.size
    };
  }, [allExtraLogs]);

  // Group all issue logs by Lot Number for complete 1st Time vs Extra Material audit
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
    <div className="extra-material-issue-container" style={{ padding: '6px 10px 14px 10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Banner Header - Extra Material Issue Box with padding: 9px */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        padding: '9px 16px',
        backgroundColor: 'var(--bg-secondary, #f8fafc)',
        borderRadius: '9px',
        border: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Extra Material Issue
              </h1>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                • Approved production lots & extra material requisition slips
              </span>
            </div>
          </div>
        </div>

        {/* Tab switcher: Issue Extra Material vs Extra Issue Logs - Normal and Easy to See */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${activeSubTab === 'issue' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('issue')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '600',
              borderRadius: '7px'
            }}
          >
            <Layers size={15} />
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
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '600',
              borderRadius: '7px'
            }}
          >
            <Clock size={15} />
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
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '600',
              borderRadius: '7px'
            }}
          >
            <BarChart3 size={15} />
            <span>Combined Audit Report ({lotAuditSummary.length})</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {formError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#dc2626',
          borderRadius: '6px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '6px',
          fontSize: '11.5px',
          fontWeight: '500'
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{formError}</div>
          <button onClick={() => setFormError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>&times;</button>
        </div>
      )}

      {formSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: '#059669',
          borderRadius: '6px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          marginBottom: '6px',
          fontSize: '11.5px',
          fontWeight: '500'
        }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{formSuccess}</div>
          <button onClick={() => setFormSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669' }}>&times;</button>
        </div>
      )}

      {/* SUB TAB 1: ISSUE EXTRA MATERIAL */}
      {activeSubTab === 'issue' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '215px minmax(0, 1fr)',
          gap: '10px',
          alignItems: 'start',
          width: '100%',
          minWidth: 0
        }}>
          
          {/* Left Column: Approved Lots Browser with Search Bar */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: 'calc(100vh - 100px)',
            position: 'sticky',
            top: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle size={14} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                  Approved Lots ({filteredDesigns.length})
                </h3>
              </div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                Total: {approvedDesigns.length}
              </span>
            </div>

            {/* Search Approved Lots */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{
                position: 'absolute',
                left: '9px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Search Lot, Brand, Style..."
                value={searchLotQuery}
                onChange={(e) => setSearchLotQuery(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '30px',
                  paddingRight: '26px',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                  borderRadius: '6px'
                }}
              />
              {searchLotQuery && (
                <button
                  type="button"
                  onClick={() => setSearchLotQuery('')}
                  style={{
                    position: 'absolute',
                    right: '7px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Lots List */}
            <div style={{
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 280px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingRight: '2px'
            }}>
              {filteredDesigns.length === 0 ? (
                <div style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-color)'
                }}>
                  No approved lots match your search.
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
                        padding: '9px 11px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #6366f1' : '1px solid var(--border-color, #e2e8f0)',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-primary, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.12)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{
                            fontWeight: '800',
                            fontSize: '12.5px',
                            color: isSelected ? '#4f46e5' : 'var(--text-main, #0f172a)'
                          }}>
                            Lot {d.id}
                          </span>
                          {d.lotNo2 && (
                            <span style={{
                              fontSize: '9.5px',
                              padding: '1px 5px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366f1',
                              borderRadius: '3px',
                              fontWeight: '700'
                            }}>
                              {d.lotNo2}
                            </span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d'
                        }}>
                          Approved
                        </span>
                      </div>

                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {d.brand || 'No Brand'} • {d.category}
                        </span>
                        <span style={{
                          fontWeight: '700',
                          fontSize: '11px',
                          color: '#4f46e5',
                          backgroundColor: 'rgba(99, 102, 241, 0.08)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          flexShrink: 0
                        }}>
                          {bomCount} BOM
                        </span>
                      </div>

                      {d.fabricType && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Fabric: {d.fabricType}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Lot Header & BOM Components Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
            
            {!selectedDesign ? (
              <div style={{
                backgroundColor: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '10px',
                border: '1.5px dashed var(--border-color, #cbd5e1)',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--text-muted, #64748b)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}>
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
                  <Layers size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
                  No Lot Selected
                </h3>
                <p style={{ margin: 0, fontSize: '12px', maxWidth: '400px' }}>
                  Please select an approved production lot from the left panel to inspect its BOM components and issue extra materials.
                </p>
              </div>
            ) : (
              <>
                {/* Lot Header Info Box - Compact View */}
                <div style={{
                  backgroundColor: 'var(--bg-secondary, #f8fafc)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  padding: '6px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <div style={{
                        padding: '2px 7px',
                        backgroundColor: '#6366f1',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontWeight: '800',
                        fontSize: '11px',
                        letterSpacing: '0.5px'
                      }}>
                        LOT {selectedDesign.id}
                      </div>
                      {selectedDesign.lotNo2 && (
                        <div style={{
                          padding: '2px 5px',
                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                          color: '#4f46e5',
                          borderRadius: '4px',
                          fontWeight: '700',
                          fontSize: '10.5px'
                        }}>
                          MH: {selectedDesign.lotNo2}
                        </div>
                      )}
                      <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {selectedDesign.brand ? `${selectedDesign.brand} — ` : ''}{selectedDesign.name || selectedDesign.category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Garment Vol:</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>
                        {isLoadingPieces ? 'Loading...' : `${pieces.toLocaleString()} Units`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Metadata Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '4px 12px',
                    padding: '3px 8px',
                    backgroundColor: 'var(--bg-primary, #ffffff)',
                    borderRadius: '5px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    fontSize: '10.5px'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Category: </span>
                      <strong>{selectedDesign.category || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Style Code: </span>
                      <strong>{selectedDesign.style || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Fabric: </span>
                      <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '140px', verticalAlign: 'bottom' }}>
                        {selectedDesign.fabricType || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Prev Issues: </span>
                      <strong>{lotPreviousIssues.length} records</strong>
                    </div>
                  </div>

                  {/* Issuer & Receiver Settings Bar - 3 Columns Side-by-Side */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color, #e2e8f0)'
                  }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main, #334155)', display: 'block', marginBottom: '4px' }}>
                        Issuer Person:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '36px', fontSize: '13px', width: '100%', padding: '6px 12px', borderRadius: '7px' }}
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        placeholder="Store Incharge"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main, #334155)', display: 'block', marginBottom: '4px' }}>
                        Receiver Person:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '36px', fontSize: '13px', width: '100%', padding: '6px 12px', borderRadius: '7px' }}
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Master / Tailor"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main, #334155)', display: 'block', marginBottom: '4px' }}>
                        Receiver Dept / Line:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '36px', fontSize: '13px', width: '100%', padding: '6px 12px', borderRadius: '7px' }}
                        value={receiverDept}
                        onChange={(e) => setReceiverDept(e.target.value)}
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

                  {/* Table Container - Fits comfortably with clear, legible sizing */}
                  <div style={{
                    width: '100%',
                    maxWidth: '100%',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    overflowX: 'auto',
                    boxSizing: 'border-box'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: 'var(--bg-primary, #ffffff)' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)', borderBottom: '1.5px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>
                          <th style={{ width: '28px', padding: '9px 4px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={displayedBomMappings.length > 0 && displayedBomMappings.every(m => m.selectedForExtra)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const displayedIds = new Set(displayedBomMappings.map(m => m.id));
                                setBomMappings(prev => prev.map(m => displayedIds.has(m.id) ? { ...m, selectedForExtra: checked } : m));
                              }}
                              style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                              title="Select All"
                            />
                          </th>
                          <th style={{ width: '115px', padding: '9px 6px', fontWeight: '700' }}>BOM Component</th>
                          <th style={{ minWidth: '170px', padding: '9px 6px', fontWeight: '700' }}>Assigned Inventory Item Map</th>
                          <th style={{ width: '55px', padding: '9px 4px', textAlign: 'center', fontWeight: '700' }}>Stock</th>
                          <th style={{ width: '58px', padding: '9px 4px', textAlign: 'center', fontWeight: '700' }}>Prev Issued</th>
                          <th style={{ width: '105px', padding: '9px 4px', textAlign: 'center', fontWeight: '700' }}>Extra Qty</th>
                          <th style={{ width: '115px', padding: '9px 4px', fontWeight: '700' }}>Reason / Remarks</th>
                          <th style={{ width: '65px', padding: '9px 4px', textAlign: 'center', fontWeight: '700' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedBomMappings.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <Package size={24} style={{ opacity: 0.5 }} />
                                <div style={{ fontSize: '13px', fontWeight: '600' }}>No active BOM components mapped for this lot.</div>
                                <button
                                  type="button"
                                  onClick={() => setShowAllBom(true)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ marginTop: '4px', fontSize: '11.5px', padding: '5px 12px' }}
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
                                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                  transition: 'background-color 0.15s'
                                }}
                              >
                                {/* Checkbox */}
                                <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!item.selectedForExtra}
                                    onChange={(e) => handleMappingChange(originalIdx, 'selectedForExtra', e.target.checked)}
                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                  />
                                </td>

                                {/* BOM Component Name & Details */}
                                <td style={{ padding: '10px 8px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                                        {item.bomItemName}
                                      </strong>
                                      {item.isRequired && (
                                        <span style={{
                                          fontSize: '9.5px',
                                          fontWeight: '700',
                                          padding: '2px 5px',
                                          borderRadius: '4px',
                                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                          color: '#059669'
                                        }}>
                                          Required
                                        </span>
                                      )}
                                    </div>
                                    {item.bomItemDetail && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '135px' }}>
                                        {item.bomItemDetail}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                      Req: {item.qtyPerPiece}/pc ({(pieces * item.qtyPerPiece).toFixed(0)} {item.unit})
                                    </span>
                                  </div>
                                </td>

                                {/* Material Select */}
                                <td style={{ padding: '10px 8px' }}>
                                  <SearchableMaterialSelect
                                    materials={materials}
                                    value={item.materialId}
                                    onChange={(val) => handleMappingChange(originalIdx, 'materialId', val)}
                                    hasError={!item.materialId && hasExtraQty}
                                  />
                                </td>

                                {/* Stock Badge */}
                                <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{
                                      fontWeight: '800',
                                      fontSize: '13px',
                                      color: stock <= 0 ? '#ef4444' : stock < 50 ? '#f59e0b' : '#10b981'
                                    }}>
                                      {stock} {item.unit}
                                    </span>
                                    {isStockShortage && (
                                      <span style={{ fontSize: '9px', fontWeight: '700', color: '#ef4444', backgroundColor: '#fee2e2', padding: '1px 4px', borderRadius: '3px', marginTop: '2px' }}>
                                        Low Stock
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Previously Issued */}
                                <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{
                                      fontWeight: '700',
                                      fontSize: '12.5px',
                                      color: item.previouslyIssuedQty > 0 ? '#3b82f6' : 'var(--text-muted)'
                                    }}>
                                      {item.previouslyIssuedQty} {item.unit}
                                    </span>
                                    {item.previousLogsCount > 0 && (
                                      <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                                        ({item.previousLogsCount} logs)
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Extra Quantity Input + Quick Add + Live 5% Threshold Status */}
                                <td style={{ padding: '8px 4px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0"
                                        className="form-input"
                                        style={{
                                          width: '52px',
                                          height: '30px',
                                          textAlign: 'center',
                                          fontWeight: '800',
                                          fontSize: '13px',
                                          padding: '2px 4px',
                                          borderRadius: '5px',
                                          borderColor: isStockShortage
                                            ? '#ef4444'
                                            : hasExtraQty
                                            ? '#6366f1'
                                            : 'var(--border-color)'
                                        }}
                                        value={item.extraQty}
                                        onChange={(e) => handleMappingChange(originalIdx, 'extraQty', e.target.value)}
                                      />
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                        {item.unit}
                                      </span>
                                    </div>

                                    {/* Quick +Buttons */}
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                      {[5, 10, 25, 50].map(amt => (
                                        <button
                                          key={amt}
                                          type="button"
                                          onClick={() => handleQuickAddQty(originalIdx, amt)}
                                          style={{
                                            padding: '2px 4px',
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            borderRadius: '3px',
                                            border: '1px solid var(--border-color, #cbd5e1)',
                                            backgroundColor: 'var(--bg-secondary, #f1f5f9)',
                                            color: 'var(--text-main, #0f172a)',
                                            cursor: 'pointer'
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
                                <td style={{ padding: '8px 4px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <select
                                      className="form-input"
                                      style={{ height: '27px', fontSize: '11px', padding: '2px 4px', borderRadius: '5px', width: '100%' }}
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
                                      style={{ height: '25px', fontSize: '11px', padding: '2px 5px', borderRadius: '5px', width: '100%' }}
                                      value={item.extraRemarks}
                                      onChange={(e) => handleMappingChange(originalIdx, 'extraRemarks', e.target.value)}
                                    />
                                  </div>
                                </td>

                                {/* Single Component Issue Action */}
                                <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleIssueSingleComponent(originalIdx)}
                                    className="btn btn-sm"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '5px 10px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      borderRadius: '5px',
                                      backgroundColor: !hasExtraQty
                                        ? 'var(--bg-secondary, #e2e8f0)'
                                        : '#6366f1',
                                      color: !hasExtraQty ? 'var(--text-muted, #64748b)' : '#ffffff',
                                      cursor: hasExtraQty ? 'pointer' : 'not-allowed',
                                      border: 'none',
                                      boxShadow: hasExtraQty ? '0 1px 4px rgba(99, 102, 241, 0.25)' : 'none',
                                      whiteSpace: 'nowrap'
                                    }}
                                    disabled={!hasExtraQty}
                                    title="Issue Extra Material"
                                  >
                                    <Send size={11} />
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
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: '600', display: 'block' }}>Total Units Re-Issued</span>
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

              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by Lot No, Material, Person, Reason..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '36px',
                    paddingLeft: '34px',
                    paddingRight: historySearch ? '30px' : '12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
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

            {/* Table Container */}
            <div style={{ overflowX: 'auto', width: '100%', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', backgroundColor: 'var(--bg-primary, #ffffff)' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)', borderBottom: '1.5px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>
                    <th style={{ width: '120px', padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>Voucher ID</th>
                    <th style={{ width: '150px', padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>Lot & Garment</th>
                    <th style={{ width: '140px', padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>Date & Time</th>
                    <th style={{ width: '160px', padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>Issued By / Details</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>Issued Materials (Qty & Reason)</th>
                    <th style={{ width: '120px', padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {extraIssueLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                      </td>
                    </tr>
                  ) : (
                    extraIssueLogs.map((log, idx) => {
                      const matchedDesign = designs.find(d => String(d.id) === String(log.lotId));

                      return (
                        <tr
                          key={log.id || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color, #e2e8f0)',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f8fafc)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {/* Log Voucher ID */}
                          <td style={{ padding: '12px' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: '#4f46e5',
                              borderRadius: '6px',
                              fontFamily: 'monospace',
                              fontWeight: '800',
                              fontSize: '12px'
                            }}>
                              <FileText size={13} />
                              <span>{log.id}</span>
                            </div>
                          </td>

                          {/* Lot & Garment */}
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                                Lot {log.lotId}
                              </strong>
                              {matchedDesign?.lotNo2 && (
                                <span style={{
                                  fontSize: '9.5px',
                                  padding: '1px 5px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                  color: '#4f46e5',
                                  borderRadius: '3px',
                                  fontWeight: '700'
                                }}>
                                  {matchedDesign.lotNo2}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {matchedDesign?.brand ? `${matchedDesign.brand} • ` : ''}{log.category || matchedDesign?.category || 'Garment'}
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-main)', fontSize: '12px', fontWeight: '600' }}>
                              <Calendar size={13} style={{ color: '#6366f1' }} />
                              <span>{log.date}</span>
                            </div>
                          </td>

                          {/* Issuer / Details */}
                          <td style={{ padding: '12px' }}>
                            {(() => {
                              const rawName = log.personName || 'Store Incharge';
                              const noteMatch = rawName.match(/\((.*?)\)/);
                              const cleanName = rawName.replace(/\s*\(.*?\)/, '').trim() || 'Store Incharge';
                              const extraNote = noteMatch ? noteMatch[1] : null;

                              return (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                      color: '#059669',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}>
                                      <User size={13} />
                                    </div>
                                    <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '12.5px' }}>
                                      {cleanName}
                                    </span>
                                  </div>
                                  {extraNote && (
                                    <div style={{ marginTop: '3px', marginLeft: '30px' }}>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        color: '#4f46e5',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        display: 'inline-block'
                                      }}>
                                        {extraNote}
                                      </span>
                                    </div>
                                  )}
                                  {log.category && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', marginLeft: '30px' }}>
                                      {log.category}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>

                          {/* Issued Materials Chips */}
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(log.materials || []).map((m, mIdx) => (
                                <div
                                  key={mIdx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    fontSize: '11.5px'
                                  }}
                                >
                                  <span style={{ fontWeight: '700', color: '#334155' }}>
                                    {m.bomItemName || m.name}
                                  </span>
                                  <span style={{
                                    fontWeight: '800',
                                    color: '#dc2626',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11.5px'
                                  }}>
                                    +{m.qty} {m.unit || 'Pcs'}
                                  </span>
                                  {m.reason && (
                                    <span style={{
                                      fontSize: '10.5px',
                                      color: '#64748b',
                                      backgroundColor: 'rgba(0,0,0,0.04)',
                                      padding: '1px 5px',
                                      borderRadius: '3px'
                                    }}>
                                      {m.reason}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Reprint Action Button */}
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const slipData = {
                                  voucherId: log.id,
                                  issueDate: log.date,
                                  design: matchedDesign || { id: log.lotId, category: log.category, brand: '' },
                                  pieces: log.volume || 100,
                                  personName: log.personName || 'Store Staff',
                                  receiverName: 'Cutting Dept',
                                  receiverDept: 'Cutting Line',
                                  items: (log.materials || []).map(m => ({
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
                              className="btn btn-primary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                borderRadius: '6px',
                                backgroundColor: '#6366f1',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)',
                                whiteSpace: 'nowrap'
                              }}
                              title="Reprint Extra Material Slip"
                            >
                              <Printer size={13} />
                              <span>Reprint Slip</span>
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
                  <div><strong>Lot Number:</strong> Lot {printSlipData.design?.id} {printSlipData.design?.lotNo2 ? `(${printSlipData.design.lotNo2})` : ''}</div>
                  <div><strong>Brand:</strong> {printSlipData.design?.brand || '—'}</div>
                  <div><strong>Garment Type:</strong> {printSlipData.design?.category || '—'}</div>
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
                      <th style={{ padding: '6px', textAlign: 'left' }}>BOM Component</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Material Description</th>
                      <th style={{ padding: '6px', textAlign: 'center', width: '90px' }}>Extra Qty</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Reason / Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printSlipData.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '6px', fontWeight: '700' }}>{item.bomItemName}</td>
                        <td style={{ padding: '6px' }}>{item.materialName}</td>
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
                  <div><strong>Lot Number:</strong> Lot {printSlipData.design?.id} {printSlipData.design?.lotNo2 ? `(${printSlipData.design.lotNo2})` : ''}</div>
                  <div><strong>Brand:</strong> {printSlipData.design?.brand || '—'}</div>
                  <div><strong>Garment Type:</strong> {printSlipData.design?.category || '—'}</div>
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
                      <th style={{ padding: '6px', textAlign: 'left' }}>BOM Component</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Material Description</th>
                      <th style={{ padding: '6px', textAlign: 'center', width: '90px' }}>Extra Qty</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Reason / Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printSlipData.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '6px', fontWeight: '700' }}>{item.bomItemName}</td>
                        <td style={{ padding: '6px' }}>{item.materialName}</td>
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
                    Extra Issue Exceeds 5% Limit
                    <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Admin Approval Required
                    </span>
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#b91c1c', fontWeight: '500' }}>
                    Requisition exceeds the standard 5.0% threshold limit. Approval request will be sent to Admin.
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
                  <strong>5% Limit Exceeded:</strong> You are issuing extra material of <strong>+{Math.max(...extraApprovalModal.items.map(i => i.percentage))}%</strong>, which exceeds the allowable <strong>5% threshold limit</strong>. Direct material issue has been withheld. An <strong>Approval Request</strong> will be submitted to the <strong>Admin</strong>. Material will be issued and inventory deducted only after the <strong>Admin approves</strong> this request.
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

              {/* Components Exceeding 5% Table */}
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
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>5% Limit Qty</th>
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
    </div>
  );
}
