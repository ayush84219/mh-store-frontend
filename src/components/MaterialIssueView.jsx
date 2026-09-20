import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClipboardList, AlertTriangle, CheckCircle, ArrowRight, Layers, HelpCircle, Printer, Trash2, Plus, RotateCcw, X, PrinterCheck, Shield, Send, ChevronDown, Search, FileText, Eye, Info, CheckCircle2, History, TrendingUp, BarChart3 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function SearchableMaterialSelect({ materials = [], value, onChange, disabled = false, placeholder = "-- Select Material --", hasError = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  const selectedMaterial = materials.find(m => String(m.id) === String(value));

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
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 99999 : 1 }}>
      <div 
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen) setSearchQuery('');
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
                fontWeight: '800',
                fontSize: '11px',
                backgroundColor: 'rgba(99,102,241,0.12)',
                color: '#4f46e5',
                padding: '1px 5px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                [{selectedMaterial.id}]
              </span>
              <span style={{ fontWeight: '600' }}>
                {selectedMaterial.name}
              </span>
              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  ({selectedMaterial.color})
                </span>
              )}
              {selectedMaterial.stock !== undefined && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>
                  • {selectedMaterial.stock} {selectedMaterial.unit || 'Pcs'}
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

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          width: 'max-content',
          minWidth: '100%',
          maxWidth: '360px',
          border: '1.5px solid var(--border-color, #cbd5e1)',
          borderRadius: '8px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22), 0 4px 10px rgba(0, 0, 0, 0.08)',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          zIndex: 999999,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxSizing: 'border-box'
        }}>
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
            maxHeight: '220px',
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
                      padding: '7px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#6366f1' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-main, #0f172a)',
                      fontWeight: isSelected ? '700' : '400',
                      transition: 'background-color 0.15s ease',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-secondary, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: '800',
                        fontSize: '11px',
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(99,102,241,0.12)',
                        color: isSelected ? '#ffffff' : '#4f46e5',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        flexShrink: 0
                      }}>
                        {m.id}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      {m.color && m.color !== 'Default' && (
                        <span style={{ fontSize: '11px', opacity: 0.8, flexShrink: 0 }}>
                          ({m.color})
                        </span>
                      )}
                    </div>
                    {m.stock !== undefined && (
                      <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: '700', flexShrink: 0 }}>
                        {m.stock} {m.unit || 'Pcs'}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
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
  const [issueMode, setIssueMode] = useState('initial'); // 'initial' or 'reissue'
  const [personName, setPersonName] = useState(currentUser?.name || '');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [printLog, setPrintLog] = useState(null);
  const [auditTab, setAuditTab] = useState('by_lot'); // 'by_lot' or 'all_logs'
  const [selectedLotAuditDetail, setSelectedLotAuditDetail] = useState(null);
  const [printLotAudit, setPrintLotAudit] = useState(null);
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

    const initialMappings = requiredBom.map(bomItem => {
      // Find matching raw material automatically by comparing descriptions
      const detailLower = (bomItem.detail || '').toLowerCase();
      const nameLower = (bomItem.name || '').toLowerCase();

      // Determine description: use description field, or if empty, check if detail is a text string (not numeric)
      const descLower = (bomItem.description || '').trim().toLowerCase() ||
        (!/^\d+(\.\d+)?$/.test(detailLower.trim()) ? detailLower.trim() : '');

      // Load stored materialId from database, or fallback to auto-mapping score
      let matchedMaterialId = bomItem.materialId || "";

      if (!matchedMaterialId && descLower) {
        // Intelligently score each inventory material to find the best match
        let bestMaterial = null;
        let highestScore = 0;

        materials.forEach(m => {
          const mName = m.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
          const bName = nameLower.replace(/[^a-z0-9\s]/g, '');
          const bDesc = descLower.replace(/[^a-z0-9\s]/g, '');

          let score = 0;

          // Clean alphanumeric matches (ignoring spaces/special chars entirely)
          const cleanStr = str => str.replace(/\s+/g, '');
          const mClean = cleanStr(mName);
          const bDescClean = cleanStr(bDesc);

          if (mClean && bDescClean) {
            if (mClean === bDescClean) {
              score += 100; // Perfect match on description (e.g. "buttonnew1" vs "buttonnew1")
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

          // Base matching on standard BOM item category/name (e.g. "button" or "zip")
          if (bName && mName.includes(bName)) {
            score += 10;
          }

          if (score > highestScore) {
            highestScore = score;
            bestMaterial = m;
          }
        });

        // Set mapped material if score is significant (e.g. score >= 15)
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

    doc.autoTable({
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
    const finalY = doc.previousAutoTable.finalY + 40;
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
      setFormError('Please enter the name of the person issuing the materials.');
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
      isReissue: issueMode === 'reissue',
      personName: personName.trim(),
      date: dateStr
    };

    if (!isAdmin && issueMode === 'reissue' && onSubmitApproval) {
      // Normal user: submit for admin approval (only for re-issues/wastage)
      onSubmitApproval('material_issue', {
        lotId: selectedDesign.id,
        category: selectedDesign.category,
        pieces,
        items: itemsToIssue,
        isReissue: true,
        personName: personName.trim()
      }, currentUser);

      setFormSuccess(`Your material re-issue request for Lot ${selectedDesign.id} has been submitted for Admin approval!`);
      setSelectedDesignId('');
      setSearchQuery('');
      setPieces(100);
      setBomMappings([]);
      setPersonName(currentUser?.name || '');
      setTimeout(() => setFormSuccess(''), 7000);
    } else {
      // Admin: show print preview directly
      setPreviewIssue(issuePayload);
    }
  };

  const handleConfirmIssue = () => {
    if (!previewIssue) return;
    const { design, pieces: p, items, isReissue, personName: pName, date } = previewIssue;

    // Perform actual issue
    onIssueMaterials(design.id, p, items, isReissue, pName);

    setFormSuccess(`Successfully issued materials for Lot ${design.id} production batch of ${p} units!`);

    // Save issue data for the print prompt, close preview
    setShowPrintPrompt({ design, pieces: p, items, isReissue, personName: pName, date });
    setPreviewIssue(null);
    setSelectedDesignId('');
    setSearchQuery('');
    setPieces(100);
    setBomMappings([]);
    setPersonName(currentUser?.name || '');

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

      if (log.isReturn) {
        entry.returnLogs.push(log);
      } else if (log.isReissue) {
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
          if (log.isReturn) {
            entry.materialsSummary[key].returnedQty += mQty;
          } else if (log.isReissue) {
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

  const handlePrintLotAudit = (lotAudit) => {
    setPrintLotAudit(lotAudit);
    document.body.classList.add('print-lot-audit-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-lot-audit-mode');
      setPrintLotAudit(null);
    }, 100);
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
              {issueMode === 'reissue' ? 'Re-issue Materials (Wastage/Missed)' : 'Start Production Batch'}
            </h3>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Issue Mode Toggle tabs */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-primary)',
              padding: '4px',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--border-color)',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIssueMode('initial');
                  setSelectedDesignId('');
                  setPieces(100);
                  setFormError('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: issueMode === 'initial' ? 'var(--accent-color)' : 'transparent',
                  color: issueMode === 'initial' ? '#ffffff' : 'var(--text-main)',
                  transition: 'all 0.2s',
                  boxShadow: 'none'
                }}
              >
                First-Time Issue
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIssueMode('reissue');
                  setSelectedDesignId('');
                  setPieces(10);
                  setFormError('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: issueMode === 'reissue' ? 'var(--accent-color)' : 'transparent',
                  color: issueMode === 'reissue' ? '#ffffff' : 'var(--text-main)',
                  transition: 'all 0.2s',
                  boxShadow: 'none'
                }}
              >
                Re-issue (Wastage/Missed)
              </button>
            </div>

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
                            const isSelectionDisabled = issueMode === 'initial'
                              ? lotStatus === 'completed'
                              : lotStatus === 'ready';
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
                                {issueMode === 'initial' ? (
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
                                ) : (
                                  <>
                                    {lotStatus === 'ready' ? (
                                      <span className="status-badge rejected" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                        Not Issued Yet
                                      </span>
                                    ) : (
                                      <span className="status-badge verified" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                        Ready to Re-issue
                                      </span>
                                    )}
                                  </>
                                )}
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
                <label className="form-label">Person Name (Issuer)</label>
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
            </div>

            {/* Live Lot Audit & Pieces Verification Snapshot */}
            {selectedDesignId && selectedLotAudit && (
              <div style={{
                marginBottom: '20px',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
                    <BarChart3 size={15} style={{ color: 'var(--accent-color)' }} />
                    <span>Audit Breakdown for Lot {selectedDesignId}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setSelectedLotAuditDetail(selectedLotAudit)}
                    style={{ fontSize: '11px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Eye size={12} />
                    <span>View Audit</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Initial Issue</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                      {selectedLotAudit.initialPieces.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: '500' }}>pcs</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Re-issued</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: selectedLotAudit.reissuePieces > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {selectedLotAudit.reissuePieces.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: '500' }}>pcs</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--accent-color)', textTransform: 'uppercase', fontWeight: '700' }}>Total Issued</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-color)' }}>
                      {selectedLotAudit.totalPieces.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: '600' }}>pcs</span>
                    </div>
                  </div>
                </div>

                {issueMode === 'reissue' && pieces > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: '600', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={13} />
                    <span>Adding {pieces.toLocaleString()} pcs in this re-issue will bring total issued to {(selectedLotAudit.totalPieces + Number(pieces)).toLocaleString()} pcs.</span>
                  </div>
                )}
              </div>
            )}

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
                <span>Materials already issued for Lot {selectedDesignId}. First-time issue is blocked. Select &quot;Re-issue&quot; mode above to add replacement/waste items.</span>
              </div>
            )}

            {issueMode === 'reissue' && selectedDesignId && (
              <div style={{
                color: 'var(--warning)',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: 'var(--warning-light)',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <AlertTriangle size={16} />
                <span>Re-issuing materials for Lot {selectedDesignId} (Wastage / Replacement). Set unneeded items to 0 in the table.</span>
              </div>
            )}

            {selectedDesign && bomMappings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                {/* Role indicator for non-admin users */}
                {!isAdmin && issueMode === 'reissue' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)',
                    border: '1px solid rgba(99,102,241,0.2)', fontSize: '12px', fontWeight: '600',
                    width: '100%'
                  }}>
                    <Shield size={14} />
                    <span>As a non-admin user, your re-issue request will be sent to Admin for approval before materials are deducted.</span>
                  </div>
                )}
                <button
                  type="submit"
                  className="btn"
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'center', gap: '8px',
                    padding: '12px 20px', fontWeight: '700', fontSize: '14px',
                    borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', border: 'none',
                    backgroundColor: (isAdmin || issueMode === 'initial') ? 'var(--accent-color)' : '#7c3aed',
                    color: '#fff', transition: 'opacity 0.2s',
                    opacity: (hasShortage || isSelectedDesignAlreadyIssued) ? 0.5 : 1
                  }}
                  disabled={hasShortage || isSelectedDesignAlreadyIssued}
                  onMouseEnter={e => { if (!hasShortage && !isSelectedDesignAlreadyIssued) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => e.currentTarget.style.opacity = (hasShortage || isSelectedDesignAlreadyIssued) ? '0.5' : '1'}
                >
                  {(isAdmin || issueMode === 'initial') ? (
                    <><Layers size={16} /><span>{issueMode === 'reissue' ? 'Re-issue Materials' : 'Issue Materials for Batch'}</span></>
                  ) : (
                    <><Send size={16} /><span>Submit Re-issue for Approval</span></>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Side: Materials Calculation Checklist */}
        <div className="panel" style={{ minHeight: '320px' }}>
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

              <div className="custom-table-container" style={{ overflow: 'visible', minHeight: '320px' }}>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
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
                      <th style={{ width: '160px' }}>BOM Component</th>
                      <th style={{ minWidth: '280px' }}>Inventory Item Map</th>

                      <th>Description</th>
                      <th style={{ textAlign: 'center' }}>Total Needed</th>
                      <th style={{ textAlign: 'center' }}>Current Stock</th>
                      <th style={{ textAlign: 'center' }}>After Issue</th>
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
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!item.issued}
                              onChange={(e) => handleMappingChange(idx, 'issued', e.target.checked)}
                              disabled={item.alreadyIssued}
                              style={{ cursor: item.alreadyIssued ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td>
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
                          <td>
                            <SearchableMaterialSelect
                              materials={materials}
                              value={item.materialId}
                              onChange={(val) => handleMappingChange(idx, 'materialId', val)}
                              disabled={!item.issued || item.alreadyIssued}
                              hasError={!item.materialId && item.issued && !item.alreadyIssued}
                            />
                          </td>

                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {item.bomItemDetail || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
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
                          <td style={{ textAlign: 'center', fontWeight: '500', color: (item.issued && !item.alreadyIssued) ? 'inherit' : 'var(--text-muted)' }}>
                            {item.currentStock} {item.unit}
                          </td>
                          <td style={{ textAlign: 'center' }}>
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
                  <span>By-Lot Audit Report</span>
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
              <div style={{ position: 'relative', width: '220px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ height: '32px', fontSize: '13px', paddingLeft: '12px' }}
                  placeholder={auditTab === 'by_lot' ? "🔍 Search lot or brand..." : "🔍 Search logs..."}
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
                          <tr key={lotAudit.lotId}>
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
                              </div>
                            </td>
                          </tr>
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
                        <th style={{ textAlign: 'right' }}>Initial Issue Qty</th>
                        <th style={{ textAlign: 'right' }}>Re-issue Qty</th>
                        <th style={{ textAlign: 'right' }}>Returned Qty</th>
                        <th style={{ textAlign: 'right', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>Total Net Issued</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(selectedLotAuditDetail.materialsSummary).map((mat, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>{mat.bomItemName}</td>
                          <td>{mat.materialName}</td>
                          <td style={{ textAlign: 'right' }}>{mat.initialQty > 0 ? Number(mat.initialQty.toFixed(2)) : '0'}</td>
                          <td style={{ textAlign: 'right', color: mat.reissueQty > 0 ? 'var(--warning)' : 'inherit', fontWeight: mat.reissueQty > 0 ? '700' : 'normal' }}>
                            {mat.reissueQty > 0 ? `+${Number(mat.reissueQty.toFixed(2))}` : '0'}
                          </td>
                          <td style={{ textAlign: 'right', color: mat.returnedQty > 0 ? 'var(--success)' : 'inherit' }}>
                            {mat.returnedQty > 0 ? `-${Number(mat.returnedQty.toFixed(2))}` : '0'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--accent-color)', backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                            {Number(mat.totalIssuedQty.toFixed(2))}
                          </td>
                          <td>{mat.unit}</td>
                        </tr>
                      ))}
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
           PRINTABLE LOT AUDIT REPORT SLIP (Visible during print media)
          ============================================================ */}
      {printLotAudit && (
        <div className="lot-audit-print-slip">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', flex: 1, justifyContent: 'space-between' }}>
            <div>
              {/* Slip Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>G-PDMS Secure Systems</h2>
                  <span style={{ fontSize: '11px', color: '#555' }}>Garment Product Data Management System</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
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

              {/* SECTION 1: Detailed Issues & Re-issues Breakdown Table */}
              <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
                1. Chronological Issues &amp; Re-issues Transaction Log
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#eee' }}>
                    <th style={{ textAlign: 'left', padding: '5px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '5px' }}>Slip ID</th>
                    <th style={{ textAlign: 'left', padding: '5px' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '5px' }}>Date &amp; Time</th>
                    <th style={{ textAlign: 'right', padding: '5px' }}>Pieces</th>
                    <th style={{ textAlign: 'left', padding: '5px' }}>Issuer (Person)</th>
                    <th style={{ textAlign: 'left', padding: '5px' }}>Dispatched Materials Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {printLotAudit.allLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '5px' }}>{idx + 1}</td>
                      <td style={{ padding: '5px', fontWeight: 'bold' }}>{log.id}</td>
                      <td style={{ padding: '5px' }}>
                        {log.isReturn ? 'Return' : log.isReissue ? 'Re-issue' : 'Initial Issue'}
                      </td>
                      <td style={{ padding: '5px' }}>{log.date}</td>
                      <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                        {log.isReturn ? '—' : `${Number(log.volume).toLocaleString()} pcs`}
                      </td>
                      <td style={{ padding: '5px' }}>{log.personName || 'System'}</td>
                      <td style={{ padding: '5px' }}>
                        {log.materials && log.materials.map((m, mIdx) => (
                          <span key={mIdx} style={{ marginRight: '6px' }}>
                            {m.bomItemName ? `${m.bomItemName}: ` : ''}<strong>{m.qty} {m.unit}</strong>{mIdx < log.materials.length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* SECTION 2: Consolidated Material Consumption Breakdown */}
              <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
                2. Consolidated Material Sourcing &amp; Net Dispatched Matrix
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#eee' }}>
                    <th style={{ textAlign: 'left', padding: '5px' }}>BOM Component</th>
                    <th style={{ textAlign: 'left', padding: '5px' }}>Inventory Material Name</th>
                    <th style={{ textAlign: 'right', padding: '5px' }}>Initial Qty</th>
                    <th style={{ textAlign: 'right', padding: '5px' }}>Re-issue Qty</th>
                    <th style={{ textAlign: 'right', padding: '5px' }}>Returned Qty</th>
                    <th style={{ textAlign: 'right', padding: '5px', fontWeight: 'bold' }}>Total Net Issued</th>
                    <th style={{ textAlign: 'left', padding: '5px', paddingLeft: '8px' }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(printLotAudit.materialsSummary).map((mat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '5px', fontWeight: 'bold' }}>{mat.bomItemName}</td>
                      <td style={{ padding: '5px' }}>{mat.materialName}</td>
                      <td style={{ padding: '5px', textAlign: 'right' }}>{mat.initialQty > 0 ? Number(mat.initialQty.toFixed(2)) : '0'}</td>
                      <td style={{ padding: '5px', textAlign: 'right' }}>{mat.reissueQty > 0 ? `+${Number(mat.reissueQty.toFixed(2))}` : '0'}</td>
                      <td style={{ padding: '5px', textAlign: 'right' }}>{mat.returnedQty > 0 ? `-${Number(mat.returnedQty.toFixed(2))}` : '0'}</td>
                      <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{Number(mat.totalIssuedQty.toFixed(2))}</td>
                      <td style={{ padding: '5px', paddingLeft: '8px' }}>{mat.unit}</td>
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
      )}
    </div>
  );
}
